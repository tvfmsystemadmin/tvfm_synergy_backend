import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// A top-level category has no parent. A subcategory points at its parent category.
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, maxlength: 140 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', default: null, index: true },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('ProductCategory', schema);
