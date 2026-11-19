import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

const specSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    slug: { type: String, required: true, unique: true, maxlength: 160 },
    description: { type: String, default: '', trim: true, maxlength: 3000 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', required: true, index: true },
    subcategory: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductCategory', default: null },
    brand: { type: String, default: '', trim: true, maxlength: 100 },
    tagline: { type: String, default: '', trim: true, maxlength: 200 },
    storeUrl: { type: String, default: '', trim: true, maxlength: 500 },
    specifications: { type: [specSchema], default: [] },
    ingredients: { type: String, default: '', trim: true, maxlength: 3000 },
    features: { type: [String], default: [] },
    highlights: { type: [String], default: [] },
    price: { type: Number, default: null, min: 0 },
    details: { type: String, default: '', trim: true, maxlength: 5000 },
    images: { type: [String], default: [] },
    // Optional product video, shown in a popup from the "Watch video" button. Uploaded MP4/WebM or a YouTube/Vimeo/https link.
    videoUrl: { type: String, default: '', maxlength: 500 },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('Product', schema);
