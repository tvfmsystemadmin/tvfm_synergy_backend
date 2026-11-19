import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';
import { PAGE_KEYS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: 300 },
    answer: { type: String, required: true, trim: true, maxlength: 2000 },
    pages: { type: [{ type: String, enum: PAGE_KEYS }], default: [], index: true },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('Faq', schema);
