import express from 'express';
import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';
import { cleanText, escapeRegex, hasOwn, slugify } from '../utils/strings.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

// Keeps only the fields listed for this resource. This stops callers from setting fields they should not.
function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (hasOwn(body, field)) out[field] = body[field];
  }
  return out;
}

const boolParam = (value) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
};

// Builds the public and admin routes for one content type. Each resource is described in config/resources.js.
export function buildResource(cfg) {
  const { model } = cfg;
  const sort = cfg.sort || { order: 1, createdAt: -1 };
  const populate = cfg.populate || [];
  const hasEnabled = cfg.fields.includes('enabled');
  const ordered = cfg.fields.includes('order');

  async function uniqueSlug(source, excludeId) {
    const base = slugify(source) || `item-${Date.now().toString(36)}`;
    let candidate = base;
    for (let n = 2; await model.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); n += 1) {
      if (n > 200) throw new HttpError(409, 'Could not create a unique link for this item. Try a different title.');
      candidate = `${base}-${n}`;
    }
    return candidate;
  }

  async function prepareBody(body, { isCreate, doc }) {
    const data = pick(body, cfg.fields);
    if (cfg.slugFrom && (data.slug !== undefined || isCreate)) {
      const source = typeof data.slug === 'string' && data.slug.trim() ? data.slug : data[cfg.slugFrom];
      data.slug = await uniqueSlug(String(source || ''), doc?._id);
    }
    if (cfg.prepare) await cfg.prepare(data, { isCreate, doc });
    return data;
  }

  function admin(req) {
    const filter = { ...(cfg.adminFilter ? cfg.adminFilter(req.query) : {}) };
    if (hasEnabled) {
      const enabled = boolParam(req.query.enabled);
      if (enabled !== undefined) filter.enabled = enabled;
    }
    if (cfg.pageField && typeof req.query.page === 'string' && req.query.page) {
      filter[cfg.pageField] = req.query.page.slice(0, 40);
    }
    const q = cleanText(req.query.q, 100);
    if (q && cfg.search?.length) {
      const rx = new RegExp(escapeRegex(q), 'i');
      filter.$or = cfg.search.map((field) => ({ [field]: rx }));
    }
    return filter;
  }

  function publicFilter(req) {
    const filter = cfg.publicFilter ? cfg.publicFilter(req.query) : hasEnabled ? { enabled: true } : {};
    if (cfg.pageField && typeof req.query.page === 'string' && req.query.page) {
      filter[cfg.pageField] = req.query.page.slice(0, 40);
    }
    return filter;
  }

  // Public routes: only published content. Used by the website.
  const publicRouter = express.Router();
  publicRouter.get(
    '/',
    asyncHandler(async (req, res) => {
      const items = await model.find(publicFilter(req)).sort(sort).populate(populate);
      res.json({ ok: true, items });
    }),
  );
  if (cfg.lookup) {
    publicRouter.get(
      `/:key`,
      asyncHandler(async (req, res) => {
        const filter = { ...publicFilter(req), [cfg.lookup]: String(req.params.key) };
        const item = await model.findOne(filter).populate(populate);
        if (!item) throw new HttpError(404, 'Not found.');
        res.json({ ok: true, item });
      }),
    );
  }

  // Admin routes. The admin router is mounted behind requireAdmin in routes/adminRoutes.js.
  const adminRouter = express.Router();
  adminRouter.get(
    '/',
    asyncHandler(async (req, res) => {
      const items = await model.find(admin(req)).sort(sort).populate(populate);
      res.json({ ok: true, items });
    }),
  );
  adminRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const item = await model.findById(req.params.id).populate(populate);
      if (!item) throw new HttpError(404, 'Not found.');
      res.json({ ok: true, item });
    }),
  );
  if (cfg.createable !== false) {
    adminRouter.post(
      '/',
      asyncHandler(async (req, res) => {
        const data = await prepareBody(req.body || {}, { isCreate: true });
        const item = await model.create(data);
        res.status(201).json({ ok: true, item });
      }),
    );
  }

  if (ordered) {
    adminRouter.put(
      '/reorder',
      asyncHandler(async (req, res) => {
        const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 500) : [];
        const ops = items
          .filter((i) => i && mongoose.isValidObjectId(i.id) && Number.isFinite(Number(i.order)))
          .map((i) => ({ updateOne: { filter: { _id: i.id }, update: { $set: { order: Number(i.order) } } } }));
        if (!ops.length) throw new HttpError(400, 'Nothing to reorder.');
        await model.bulkWrite(ops);
        res.json({ ok: true, updated: ops.length });
      }),
    );
  }

  const update = asyncHandler(async (req, res) => {
    const doc = await model.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'Not found.');
    const data = await prepareBody(req.body || {}, { isCreate: false, doc });
    doc.set(data);
    await doc.save();
    if (populate.length) await doc.populate(populate);
    res.json({ ok: true, item: doc });
  });
  adminRouter.patch('/:id', update);
  adminRouter.put('/:id', update);

  if (cfg.deletable !== false) {
    adminRouter.delete(
      '/:id',
      asyncHandler(async (req, res) => {
        const doc = await model.findById(req.params.id);
        if (!doc) throw new HttpError(404, 'Not found.');
        if (cfg.protect) {
          const reason = await cfg.protect(doc);
          if (reason) throw new HttpError(409, reason);
        }
        await doc.deleteOne();
        res.json({ ok: true });
      }),
    );
  }

  return { publicRouter, adminRouter };
}
