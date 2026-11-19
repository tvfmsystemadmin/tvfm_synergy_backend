import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';
import { ENQUIRY_STATUSES, FORMS } from '../config/constants.js';

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 2000 },
    by: { type: String, default: 'admin', maxlength: 254 },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    form: { type: String, enum: FORMS, required: true, index: true },
    source: { type: String, required: true, maxlength: 40 },
    category: { type: String, default: '', maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, required: true, maxlength: 20 },
    message: { type: String, default: '', maxlength: 3000 },
    cvFilename: { type: String, default: '', maxlength: 150 },
    pageUrl: { type: String, default: '', maxlength: 300 },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'New', index: true },
    notes: { type: [noteSchema], default: [] },
    routeKey: { type: String, default: null },
    routedTo: { type: [String], default: [] },
    emailSent: { type: Boolean, default: false },
    emailError: { type: String, default: '', maxlength: 300 },
    emailedAt: { type: Date, default: null },
    // Thank-you email to the customer (see services/thankYou.js).
    thankYouSent: { type: Boolean, default: false },
    thankYouError: { type: String, default: '', maxlength: 300 },
  },
  schemaOptions,
);

schema.index({ createdAt: -1 });

export default defineModel('Enquiry', schema);
