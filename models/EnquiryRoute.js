import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// Decides which mailboxes receive an enquiry. Keys: "default", "pos", "product", "career", "service",
// "contact", or a form with a category, for example "contact:Distributorship".
const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 140 },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    emails: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  schemaOptions,
);

export default defineModel('EnquiryRoute', schema);
