import mongoose from 'mongoose';
import { schemaOptions, defineModel, ctaFields } from './base.js';

// One service. Fields are used in two places:
//   Services page section: chip, title, lead, points, primaryLabel (shown when showOnServicesPage is on)
//   Service detail page:   short, intro, helps, bullets, questions (shown when hasDetailPage is on)
const schema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, maxlength: 160 },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    chip: { type: String, default: '', trim: true, maxlength: 120 },
    pageTitle: { type: String, default: '', trim: true, maxlength: 200 },
    short: { type: String, default: '', trim: true, maxlength: 80 },
    line: { type: String, default: '', trim: true, maxlength: 300 },
    lead: { type: String, default: '', trim: true, maxlength: 1000 },
    intro: { type: String, default: '', trim: true, maxlength: 1000 },
    helps: { type: String, default: '', trim: true, maxlength: 300 },
    points: { type: [String], default: [] },
    bullets: { type: [String], default: [] },
    questions: { type: [String], default: [] },
    primaryLabel: { type: String, default: '', trim: true, maxlength: 60 },
    iconName: { type: String, default: '', trim: true, maxlength: 40 },
    image: { type: String, default: '', maxlength: 500 },
    showOnServicesPage: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: false },
    hasDetailPage: { type: Boolean, default: true },
    category: { type: String, default: '', trim: true, maxlength: 100 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },
    details: { type: String, default: '', trim: true, maxlength: 5000 },
    icon: { type: String, default: '', maxlength: 500 },
    ...ctaFields(),
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('Service', schema);
