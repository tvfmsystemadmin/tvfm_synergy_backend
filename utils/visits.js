// Small helpers for website visit tracking. No imports, so they can be tested without the database.

export const VISITOR_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

// Crawlers, link-preview robots and headless browsers are not counted as visitors.
const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit|preview|monitor/i;

export const isBot = (userAgent) => BOT_RE.test(String(userAgent || ''));

// Keeps the page address only: no query text, no #anchor, no trailing slash. Admin pages are never counted.
// Returns null for anything that is not a website address.
export function normalizePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/')) return null;
  const clean = value.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (clean.length > 200) return null;
  if (clean === '/admin' || clean.startsWith('/admin/')) return null;
  return clean;
}

// The business works in India, so "today" and the daily chart follow India time (UTC+5:30).
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

// Midnight in India at the start of the day that contains `now`, as a real point in time.
export function istDayStart(now = new Date()) {
  const local = now.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

// "2026-11-13" for the India calendar day that starts at `ms`.
export const istDateKey = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
