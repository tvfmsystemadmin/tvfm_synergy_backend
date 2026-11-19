import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// The thank-you email sent to a customer after they send an enquiry. One record (key "main"), edited in the admin panel.
// Placeholders in the subject and body: {name} = the customer's name, {enquiry} = the kind of enquiry.
export const DEFAULT_THANK_YOU_SUBJECT = 'Thank you for contacting TVFM Synergy';
export const DEFAULT_THANK_YOU_BODY = [
  'Dear {name},',
  '',
  'Thank you for your {enquiry} enquiry with TVFM Synergy. We have received your details, and our team will contact you shortly.',
  '',
  'If you have any questions in the meantime, reply to this email or call us.',
  '',
  'Warm regards,',
  'Team TVFM Synergy',
].join('\n');
export const MAX_THANK_YOU_ATTACHMENTS = 3;

// One PDF attached to the thank-you email. "file" is the generated name under uploads/documents, "name" is shown to people.
const attachmentSchema = new mongoose.Schema(
  {
    file: { type: String, required: true, maxlength: 80 },
    name: { type: String, required: true, maxlength: 150 },
  },
  { timestamps: true },
);

const schema = new mongoose.Schema(
  {
    key: { type: String, default: 'main', unique: true },
    enabled: { type: Boolean, default: true },
    subject: { type: String, default: DEFAULT_THANK_YOU_SUBJECT, trim: true, maxlength: 150 },
    body: { type: String, default: DEFAULT_THANK_YOU_BODY, maxlength: 5000 },
    attachments: { type: [attachmentSchema], default: [] },
    // Single-PDF fields from the first version. Still read, and moved into "attachments" on the next change.
    attachmentFile: { type: String, default: '', maxlength: 80 },
    attachmentName: { type: String, default: '', maxlength: 150 },
  },
  schemaOptions,
);

export default defineModel('ThankYouEmail', schema);
