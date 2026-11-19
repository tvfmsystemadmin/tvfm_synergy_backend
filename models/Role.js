import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// A role is a named set of admin pages. Users get one role, and can only open the pages in it.
// The Owner role (key "owner") is created at startup, always has every page, and cannot be edited or deleted.
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    pages: { type: [String], default: [] },
    // Only the Owner role has a key. It is left unset for every other role (sparse unique index).
    key: { type: String, unique: true, sparse: true },
    isSystem: { type: Boolean, default: false },
  },
  schemaOptions,
);

export default defineModel('Role', schema);
