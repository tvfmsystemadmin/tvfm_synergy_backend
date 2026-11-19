import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';
import { PAGE_KEYS } from '../config/constants.js';

const schema = new mongoose.Schema(
  {
    customerName: { type: String, required: true, trim: true, maxlength: 100 },
    designation: { type: String, default: '', trim: true, maxlength: 120 },
    salonName: { type: String, default: '', trim: true, maxlength: 150 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    image: { type: String, default: '', maxlength: 500 },
    // Optional video of the customer. An uploaded MP4/WebM file, or a YouTube, Vimeo or https link.
    videoUrl: { type: String, default: '', maxlength: 500 },
    pages: { type: [{ type: String, enum: PAGE_KEYS }], default: [], index: true },
    enabled: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0, index: true },
  },
  schemaOptions,
);

export default defineModel('Testimonial', schema);
