import mongoose from 'mongoose';
import { schemaOptions, defineModel, ctaFields } from './base.js';
import { PAGE_KEYS } from '../config/constants.js';

// One slide of a page hero. Each slide belongs to one website page (page), so every page can have its own slider.
// The admin adds, edits, orders and hides slides the same way as products.
//   image:           the main picture, shown on the right over the background (or filling the slide when there is no background).
//   backgroundImage: the full-width picture behind the whole slide.
const schema = new mongoose.Schema(
  {
    page: { type: String, enum: PAGE_KEYS, default: 'home', index: true },
    // Optional: a slide with only a picture has no heading. The resource rules require a heading or a picture.
    title: { type: String, default: '', trim: true, maxlength: 200 },
    // Optional short points shown as a small bullet list ABOVE the heading (for example "ISO certified", "Pan India").
    points: { type: [String], default: [] },
    body: { type: String, default: '', trim: true, maxlength: 3000 },
    alt: { type: String, default: '', trim: true, maxlength: 300 },
    image: { type: String, default: '', maxlength: 500 },
    backgroundImage: { type: String, default: '', maxlength: 500 },
    ctaEnabled: { type: Boolean, default: false },
    ...ctaFields(),
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('HomeSlide', schema);
