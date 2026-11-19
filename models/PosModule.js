import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// A POS module card. The same collection feeds the "Key modules" grid (showOnPage) and the
// interactive POS demo tabs (showInDemo), which also use `ask` (the button label) and `points`.
const schema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    points: { type: [String], default: [] },
    ask: { type: String, default: '', trim: true, maxlength: 60 },
    iconName: { type: String, default: '', trim: true, maxlength: 40 },
    image: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: '', maxlength: 500 },
    showOnPage: { type: Boolean, default: true },
    showInDemo: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('PosModule', schema);
