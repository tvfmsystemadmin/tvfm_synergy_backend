import mongoose from 'mongoose';
import { schemaOptions, defineModel, ctaFields } from './base.js';

// A POS package. priceAmount is the price before GST; the price list shows the total with GST added.
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    priceAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR', trim: true, maxlength: 5 },
    billingPeriod: { type: String, default: 'monthly', trim: true, maxlength: 40 },
    extraNote: { type: String, default: '', trim: true, maxlength: 60 },
    features: { type: [String], default: [] },
    ...ctaFields(),
    highlighted: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('PosPlan', schema);
