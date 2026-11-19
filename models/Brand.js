import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tag: { type: String, default: '', trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    bestFor: { type: String, default: '', trim: true, maxlength: 300 },
    points: { type: [String], default: [] },
    logo: { type: String, default: '', maxlength: 500 },
    websiteUrl: { type: String, default: '', maxlength: 500 },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('Brand', schema);
