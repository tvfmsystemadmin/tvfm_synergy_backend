import mongoose from 'mongoose';
import { CTA_TYPES } from '../config/constants.js';

// The admin panel edits records by their _id. Keep _id as a string in every JSON reply (and keep the
// "id" virtual too), so the panel never receives records without an identifier.
export const schemaOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => {
      ret._id = String(ret._id);
      return ret;
    },
  },
};

// Shared "button" fields: text, type (page or external), and the destination.
export const ctaFields = () => ({
  ctaText: { type: String, default: '', trim: true, maxlength: 60 },
  ctaType: { type: String, enum: CTA_TYPES, default: 'page' },
  ctaPage: { type: String, default: '', maxlength: 100 },
  ctaUrl: { type: String, default: '', maxlength: 500 },
});

// Avoids "Cannot overwrite model" errors when a module is loaded more than once.
export function defineModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}
