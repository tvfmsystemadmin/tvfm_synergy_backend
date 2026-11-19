import mongoose from 'mongoose';
import { schemaOptions, defineModel, ctaFields } from './base.js';
import { PAGE_KEYS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    pageKey: { type: String, enum: PAGE_KEYS, required: true, unique: true },
    heading: { type: String, required: true, trim: true, maxlength: 200 },
    subtitle: { type: String, default: '', trim: true, maxlength: 300 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    heroImage: { type: String, default: '', maxlength: 500 },
    backgroundImage: { type: String, default: '', maxlength: 500 },
    ctaEnabled: { type: Boolean, default: false },
    ...ctaFields(),
    enabled: { type: Boolean, default: true },
  },
  schemaOptions,
);

export default defineModel('HeroSection', schema);
