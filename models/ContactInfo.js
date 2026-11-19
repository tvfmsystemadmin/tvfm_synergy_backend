import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// Only one document is used. Its key is "main".
const labelled = (valueField) =>
  new mongoose.Schema(
    {
      label: { type: String, default: '', maxlength: 40 },
      [valueField]: { type: String, default: '', maxlength: 254 },
    },
    { _id: false },
  );

const phoneSchema = new mongoose.Schema(
  {
    label: { type: String, default: '', maxlength: 40 },
    display: { type: String, default: '', maxlength: 40 },
    href: { type: String, default: '', maxlength: 20 },
  },
  { _id: false },
);

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    phones: { type: [phoneSchema], default: [] },
    emails: { type: [labelled('address')], default: [] },
    addressLines: { type: [String], default: [] },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    mapUrl: { type: String, default: '', maxlength: 500 },
    whatsappNumber: { type: String, default: '', maxlength: 20 },
    socialLinks: { type: [labelled('url')], default: [] },
  },
  schemaOptions,
);

export default defineModel('ContactInfo', schema);
