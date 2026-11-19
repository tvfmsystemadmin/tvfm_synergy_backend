import SiteVisit from '../models/SiteVisit.js';
import LiveVisitor from '../models/LiveVisitor.js';
import { HttpError } from '../utils/httpError.js';
import { cleanText } from '../utils/strings.js';
import { VISITOR_ID_RE, isBot, normalizePath, istDayStart, istDateKey, DAY_MS } from '../utils/visits.js';

// Website visit tracking. The website sends a "view" on every page change and a "ping" every 30 seconds.
// Nothing personal is stored: a random visitor code, the page address, and the time.

export const LIVE_WINDOW_MS = 2 * 60 * 1000;
const TIME_ZONE = 'Asia/Kolkata';
const RANGE_DAYS = [1, 7, 30, 90];
const TOP_PAGES = 15;

// POST /api/public/track  { visitorId, path, type: "view" | "ping" }
export async function trackVisit(req, res) {
  if (isBot(req.get('user-agent'))) return res.json({ ok: true, counted: false });

  const body = req.body || {};
  const visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
  const path = normalizePath(body.path);
  if (!VISITOR_ID_RE.test(visitorId) || !path) throw new HttpError(400, 'Invalid visit.');

  const now = new Date();
  const isView = body.type === 'view';
  if (isView) await SiteVisit.create({ visitorId, path, createdAt: now });
  await LiveVisitor.updateOne(
    { visitorId },
    { $set: { path, lastSeenAt: now }, $setOnInsert: { firstSeenAt: now } },
    { upsert: true },
  );
  res.json({ ok: true, counted: isView });
}

// Views and different visitors between two times. "Visitors" counts each visitor code once.
export async function totalsBetween(from, to) {
  const [row] = await SiteVisit.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
    { $project: { _id: 0, views: 1, visitors: { $size: '$visitors' } } },
  ]).allowDiskUse(true);
  return { views: row?.views || 0, visitors: row?.visitors || 0 };
}

// One entry per India calendar day, with zero for days that had no visits, so the chart has no gaps.
async function dailySeries(from, days, to) {
  const rows = await SiteVisit.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: TIME_ZONE } },
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      },
    },
    { $project: { _id: 0, date: '$_id', views: 1, visitors: { $size: '$visitors' } } },
  ]).allowDiskUse(true);

  const byDate = new Map(rows.map((r) => [r.date, r]));
  const series = [];
  for (let i = 0; i < days; i += 1) {
    const date = istDateKey(from.getTime() + i * DAY_MS);
    const row = byDate.get(date);
    series.push({ date, views: row?.views || 0, visitors: row?.visitors || 0 });
  }
  return series;
}

async function topPagesBetween(from, to) {
  return SiteVisit.aggregate([
    { $match: { createdAt: { $gte: from, $lte: to } } },
    { $group: { _id: '$path', views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
    { $project: { _id: 0, path: '$_id', views: 1, visitors: { $size: '$visitors' } } },
    { $sort: { views: -1, path: 1 } },
    { $limit: TOP_PAGES },
  ]).allowDiskUse(true);
}

// Short summary for the dashboard: visitors today, in the last 30 days, and on the site now.
export async function visitorHeadline(now = new Date()) {
  const todayStart = istDayStart(now);
  const monthStart = new Date(todayStart.getTime() - 29 * DAY_MS);
  const liveSince = new Date(now.getTime() - LIVE_WINDOW_MS);
  const [live, today, month] = await Promise.all([
    LiveVisitor.countDocuments({ lastSeenAt: { $gte: liveSince } }),
    totalsBetween(todayStart, now),
    totalsBetween(monthStart, now),
  ]);
  return {
    live,
    visitorsToday: today.visitors,
    pageViewsToday: today.views,
    visitors30Days: month.visitors,
  };
}

// GET /api/admin/analytics/overview?days=7
export async function overview(req, res) {
  const requested = Number(req.query.days);
  const days = RANGE_DAYS.includes(requested) ? requested : 30;
  const now = new Date();
  const todayStart = istDayStart(now);
  const rangeStart = new Date(todayStart.getTime() - (days - 1) * DAY_MS);
  const liveSince = new Date(now.getTime() - LIVE_WINDOW_MS);

  const [live, today, period, allTimeViews, series, topPages] = await Promise.all([
    LiveVisitor.countDocuments({ lastSeenAt: { $gte: liveSince } }),
    totalsBetween(todayStart, now),
    totalsBetween(rangeStart, now),
    SiteVisit.countDocuments(),
    dailySeries(rangeStart, days, now),
    topPagesBetween(rangeStart, now),
  ]);

  res.json({
    ok: true,
    days,
    timeZone: TIME_ZONE,
    live,
    today,
    period,
    allTime: { views: allTimeViews },
    series,
    topPages,
    generatedAt: now,
  });
}

// GET /api/admin/analytics/live. The visitors active in the last two minutes. Codes are the last four characters.
export async function liveVisitors(req, res) {
  const since = new Date(Date.now() - LIVE_WINDOW_MS);
  const [count, rows] = await Promise.all([
    LiveVisitor.countDocuments({ lastSeenAt: { $gte: since } }),
    LiveVisitor.find({ lastSeenAt: { $gte: since } })
      .sort({ lastSeenAt: -1 })
      .limit(100)
      .select('visitorId path firstSeenAt lastSeenAt')
      .lean(),
  ]);
  res.json({
    ok: true,
    count,
    visitors: rows.map((r) => ({
      code: cleanText(r.visitorId, 64).slice(-4).toUpperCase(),
      path: r.path,
      firstSeenAt: r.firstSeenAt,
      lastSeenAt: r.lastSeenAt,
    })),
  });
}

