import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';
import { DAY_MS } from '../utils/visits.js';

export const JOB_TYPES = ['Full time', 'Part time', 'Contract', 'Internship'];

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: JOB_TYPES, default: 'Full time' },
    place: { type: String, default: '', trim: true, maxlength: 120 },
    summary: { type: String, default: '', trim: true, maxlength: 600 },
    duties: { type: [String], default: [] },
    needs: { type: [String], default: [] },
    // Last day to apply. Empty means the opening stays until it is turned off.
    closesOn: { type: Date, default: null },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

// Openings that can be applied for now. A closing date counts for the whole day (dates are saved at noon).
export const openJobsFilter = (now = new Date()) => ({
  enabled: true,
  $or: [{ closesOn: null }, { closesOn: { $gte: new Date(now.getTime() - DAY_MS) } }],
});

export default defineModel('Job', schema);
