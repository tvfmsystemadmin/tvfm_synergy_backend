import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';
import { BLOG_STATUSES } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, maxlength: 220 },
    subtitle: { type: String, default: '', trim: true, maxlength: 300 },
    excerpt: { type: String, default: '', trim: true, maxlength: 500 },
    coverImage: { type: String, default: '', maxlength: 500 },
    contentHtml: { type: String, default: '', maxlength: 200000 },
    videoUrl: { type: String, default: '', maxlength: 500 },
    category: { type: String, default: '', trim: true, maxlength: 100 },
    authorName: { type: String, default: '', trim: true, maxlength: 100 },
    authorRole: { type: String, default: '', trim: true, maxlength: 100 },
    publishDate: { type: Date, default: Date.now },
    status: { type: String, enum: BLOG_STATUSES, default: 'draft', index: true },
    readMinutes: { type: Number, default: 2, min: 1, max: 120 },
    showPosDemo: { type: Boolean, default: false },
  },
  schemaOptions,
);

schema.index({ status: 1, publishDate: -1 });

export default defineModel('Blog', schema);
