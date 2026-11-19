import mongoose from 'mongoose';
import { defineModel } from './base.js';

// One row per page view on the website. Only an anonymous visitor code is kept: no IP address, no name.
// MongoDB removes rows older than the retention period by itself (see the expireAfterSeconds below).
export const VISIT_RETENTION_DAYS = 400;

const schema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, maxlength: 64 },
    path: { type: String, required: true, maxlength: 200 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

schema.index({ createdAt: 1 }, { expireAfterSeconds: VISIT_RETENTION_DAYS * 24 * 60 * 60 });
schema.index({ path: 1, createdAt: 1 });

export default defineModel('SiteVisit', schema);
