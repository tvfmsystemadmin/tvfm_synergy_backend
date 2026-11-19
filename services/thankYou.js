import fs from 'node:fs';
import path from 'node:path';
import ThankYouEmail, { DEFAULT_THANK_YOU_BODY, DEFAULT_THANK_YOU_SUBJECT, MAX_THANK_YOU_ATTACHMENTS } from '../models/ThankYouEmail.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import { sendMail } from './mailer.js';
import { env } from '../config/env.js';
import { oneLine } from '../utils/strings.js';

export const DOCUMENTS_DIR = path.join(UPLOAD_ROOT, 'documents');
// Only names this server generates (uuid.pdf) are ever opened, so a stored name can never point elsewhere.
export const isStoredPdfName = (name) => /^[0-9a-f-]{36}\.pdf$/.test(String(name || ''));
export const pdfPath = (file) => path.join(DOCUMENTS_DIR, file);

// The attachments as a list: { id, file, name }. A PDF saved by the first version counts as one attachment.
export function attachmentsOf(doc) {
  const list = (doc?.attachments || []).map((a) => ({ id: String(a._id), file: a.file, name: a.name }));
  if (doc?.attachmentFile && !list.some((a) => a.file === doc.attachmentFile)) {
    list.push({ id: 'legacy', file: doc.attachmentFile, name: doc.attachmentName || 'TVFM-Synergy.pdf' });
  }
  return list.slice(0, MAX_THANK_YOU_ATTACHMENTS);
}

// Returns the saved thank-you settings, or the defaults when nothing has been saved yet.
export async function getThankYouSettings() {
  const doc = await ThankYouEmail.findOne({ key: 'main' }).lean();
  return {
    enabled: doc ? doc.enabled !== false : true,
    subject: doc?.subject || DEFAULT_THANK_YOU_SUBJECT,
    body: doc?.body || DEFAULT_THANK_YOU_BODY,
    attachments: attachmentsOf(doc),
  };
}

// Fills {name} and {enquiry}. Unknown placeholders are left as they are.
export function fillTemplate(text, values) {
  return String(text).replace(/\{(name|enquiry)\}/g, (match, key) => values[key] ?? match);
}

// Sends the thank-you email to the customer who sent the enquiry. Never throws: the caller stores the outcome.
// Returns { sent, error } so the admin panel can say whether the customer got the email.
export async function sendThankYou(lead, formLabel) {
  try {
    const settings = await getThankYouSettings();
    if (!settings.enabled) {
      return { sent: false, error: 'The thank-you email is switched off in the admin panel.' };
    }

    const values = { name: oneLine(lead.name), enquiry: formLabel || 'website' };
    const attachments = [];
    for (const item of settings.attachments) {
      const file = isStoredPdfName(item.file) ? pdfPath(item.file) : '';
      if (!file || !fs.existsSync(file)) {
        return { sent: false, error: `The PDF "${item.name}" attached to the thank-you email is missing. Upload it again.` };
      }
      attachments.push({ filename: item.name || 'TVFM-Synergy.pdf', path: file, contentType: 'application/pdf' });
    }

    const result = await sendMail({
      to: [lead.email],
      subject: oneLine(fillTemplate(settings.subject, values)).slice(0, 150),
      text: fillTemplate(settings.body, values),
      replyTo: { name: 'TVFM Synergy', address: env.defaultEnquiryEmail },
      attachments: attachments.length ? attachments : undefined,
    });
    if (!result.sent) {
      return { sent: false, error: 'Test mode is on, so the thank-you email was not sent.' };
    }
    return { sent: true, error: '' };
  } catch (err) {
    console.error('[thank-you] email not sent:', err.message);
    return { sent: false, error: 'The thank-you email could not be sent. Check the email settings on the server.' };
  }
}
