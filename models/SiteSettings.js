import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// Website-wide settings. There is one document, with key 'main'.
// maintenance: when enabled, every public page shows the "We will be back soon" page instead (the admin still works).
export const MAINTENANCE_DEFAULTS = {
  enabled: false,
  title: 'We will be back soon',
  message: 'Our website is under maintenance. Please check back shortly.',
};

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    maintenance: {
      enabled: { type: Boolean, default: MAINTENANCE_DEFAULTS.enabled },
      title: { type: String, default: MAINTENANCE_DEFAULTS.title, trim: true, maxlength: 120 },
      message: { type: String, default: MAINTENANCE_DEFAULTS.message, trim: true, maxlength: 500 },
    },
    // Website logos. Empty means the logo built into the website is used.
    branding: {
      logoLight: { type: String, default: '', maxlength: 500 },
      logoDark: { type: String, default: '', maxlength: 500 },
    },
  },
  schemaOptions,
);

export default defineModel('SiteSettings', schema);
