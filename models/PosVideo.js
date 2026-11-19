import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    sourceType: { type: String, enum: ['url', 'upload'], default: 'url' },
    videoUrl: { type: String, default: '', maxlength: 500 },
    posterUrl: { type: String, default: '', maxlength: 500 },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('PosVideo', schema);
