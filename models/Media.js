import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// A reference to an uploaded file. The file itself lives in backend/uploads, not in MongoDB.
const schema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    kind: { type: String, enum: ['image', 'video'], required: true },
    folder: { type: String, required: true },
    storedName: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '', maxlength: 200 },
    uploadedBy: { type: String, default: '', maxlength: 254 },
  },
  schemaOptions,
);

export default defineModel('Media', schema);
