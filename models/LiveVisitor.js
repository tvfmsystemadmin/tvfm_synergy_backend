import mongoose from 'mongoose';
import { defineModel } from './base.js';

// One row per browser that is (or was recently) on the website. The website pings every 30 seconds.
// A visitor counts as "live" for two minutes after the last ping. The row is removed a day later.
const schema = new mongoose.Schema(
  {
    visitorId: { type: String, required: true, unique: true, maxlength: 64 },
    path: { type: String, default: '/', maxlength: 200 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

schema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default defineModel('LiveVisitor', schema);
