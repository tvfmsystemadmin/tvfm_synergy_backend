import mongoose from 'mongoose';
import { schemaOptions, defineModel, ctaFields } from './base.js';

// Keyed text for the website that does not fit a dedicated collection, for example a list of principles,
// values or reasons. The key is fixed in code (for example "about.principles") and the admin edits the rest.
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    page: { type: String, default: '', maxlength: 40, index: true },
    eyebrow: { type: String, default: '', trim: true, maxlength: 120 },
    title: { type: String, default: '', trim: true, maxlength: 200 },
    body: { type: String, default: '', trim: true, maxlength: 3000 },
    items: { type: [String], default: [] },
    image: { type: String, default: '', maxlength: 500 },
    alt: { type: String, default: '', trim: true, maxlength: 300 },
    ctaEnabled: { type: Boolean, default: false },
    ...ctaFields(),
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('ContentBlock', schema);
