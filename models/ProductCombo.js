import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 3000 },
    products: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    images: { type: [String], default: [] },
    tag: { type: String, default: '', trim: true, maxlength: 60 },
    price: { type: Number, default: null, min: 0 },
    details: { type: String, default: '', trim: true, maxlength: 5000 },
    highlights: { type: [String], default: [] },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('ProductCombo', schema);
