import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import ThankYouEmail, { MAX_THANK_YOU_ATTACHMENTS } from '../models/ThankYouEmail.js';
import { HttpError } from '../utils/httpError.js';
import { cleanText } from '../utils/strings.js';
import { DOCUMENTS_DIR, getThankYouSettings, isStoredPdfName, pdfPath, attachmentsOf } from '../services/thankYou.js';

const BODY_MAX = 5000;

// What the admin panel receives: never the stored file names, only ids and the names the customer will see.
const publicSettings = (s) => ({
  enabled: s.enabled,
  subject: s.subject,
  body: s.body,
  attachments: s.attachments.map((a) => ({ id: a.id, name: a.name })),
  maxAttachments: MAX_THANK_YOU_ATTACHMENTS,
});

async function readHead(file) {
  const handle = await fs.promises.open(file, 'r');
  try {
    const buffer = Buffer.alloc(8);
    const { bytesRead } = await handle.read(buffer, 0, 8, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

// Keeps letters, digits and a few safe marks, so the file name is clean in the customer's mail client.
function displayName(original) {
  const base = String(original || '')
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9._() -]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return `${base || 'TVFM-Synergy'}.pdf`;
}

async function removeStoredPdf(file) {
  if (!isStoredPdfName(file)) return;
  await fs.promises.rm(pdfPath(file), { force: true }).catch(() => {});
}

// Moves a PDF from the first version (one attachment field) into the list, so every attachment has an id.
async function migrateLegacy() {
  const doc = await ThankYouEmail.findOne({ key: 'main' }).lean();
  if (!doc?.attachmentFile) return;
  const list = attachmentsOf(doc);
  await ThankYouEmail.updateOne(
    { key: 'main' },
    { $set: { attachments: list.filter((a) => a.id !== 'legacy').map((a) => ({ file: a.file, name: a.name })), attachmentFile: '', attachmentName: '' } },
    { upsert: true },
  );
  const legacy = list.find((a) => a.id === 'legacy');
  if (legacy) {
    await ThankYouEmail.updateOne({ key: 'main' }, { $push: { attachments: { file: legacy.file, name: legacy.name } } });
  }
}

// GET /api/admin/thank-you-email
export async function getThankYouEmail(req, res) {
  await migrateLegacy();
  res.json({ ok: true, item: publicSettings(await getThankYouSettings()) });
}

// PUT /api/admin/thank-you-email
export async function putThankYouEmail(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const errors = {};
  const subject = cleanText(body.subject, 150).replace(/[\r\n]+/g, ' ');
  if (!subject) errors.subject = 'Enter the subject line.';
  const text = typeof body.body === 'string' ? body.body.replace(/\r\n/g, '\n').trim() : '';
  if (!text) errors.body = 'Write the message the customer will receive.';
  else if (text.length > BODY_MAX) errors.body = `Keep the message under ${BODY_MAX.toLocaleString('en-IN')} characters.`;
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  await ThankYouEmail.updateOne(
    { key: 'main' },
    { $set: { enabled: body.enabled !== false, subject, body: text } },
    { upsert: true },
  );
  res.json({ ok: true, item: publicSettings(await getThankYouSettings()) });
}

// POST /api/admin/thank-you-email/attachments (one PDF, multipart field "file")
export async function uploadThankYouAttachment(req, res) {
  const file = req.file;
  if (!file) throw new HttpError(400, 'Choose a PDF file to upload.');
  let stored = null;
  try {
    await migrateLegacy();
    const current = await ThankYouEmail.findOne({ key: 'main' }).lean();
    if (attachmentsOf(current).length >= MAX_THANK_YOU_ATTACHMENTS) {
      throw new HttpError(400, `You can attach up to ${MAX_THANK_YOU_ATTACHMENTS} PDFs. Remove one first.`);
    }

    const head = await readHead(file.path);
    if (!head.toString('latin1').startsWith('%PDF-')) {
      throw new HttpError(415, 'This file is not a real PDF. Choose a PDF file.');
    }
    await fs.promises.mkdir(DOCUMENTS_DIR, { recursive: true });
    const storedName = `${crypto.randomUUID()}.pdf`;
    stored = pdfPath(storedName);
    await fs.promises.rename(file.path, stored);

    const name = displayName(cleanText(file.originalname, 200));
    const saved = await ThankYouEmail.findOneAndUpdate(
      { key: 'main' },
      { $push: { attachments: { file: storedName, name } } },
      { upsert: true, new: true },
    );
    stored = null; // saved: keep the file
    const added = saved.attachments[saved.attachments.length - 1];
    res.status(201).json({ ok: true, attachment: { id: String(added._id), name } });
  } finally {
    await fs.promises.rm(file.path, { force: true }).catch(() => {});
    if (stored) await fs.promises.rm(stored, { force: true }).catch(() => {});
  }
}

// Finds one attachment by its id. Returns null when it does not exist.
async function findAttachment(id) {
  if (!mongoose.isValidObjectId(id)) return null;
  await migrateLegacy();
  const doc = await ThankYouEmail.findOne({ key: 'main' }).lean();
  return attachmentsOf(doc).find((a) => a.id === String(id)) || null;
}

// GET /api/admin/thank-you-email/attachments/:id/file (the PDF, for the admin preview)
export async function getThankYouAttachmentFile(req, res) {
  const item = await findAttachment(req.params.id);
  const file = item && isStoredPdfName(item.file) ? pdfPath(item.file) : '';
  if (!file || !fs.existsSync(file)) throw new HttpError(404, 'This PDF was not found. Upload it again.');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${item.name.replace(/"/g, '')}"`);
  // The admin preview shows the PDF in a frame on this site, so the security header from the API is relaxed for this file only.
  res.setHeader('Content-Security-Policy', "default-src 'none'; object-src 'self'; frame-ancestors 'self'");
  fs.createReadStream(file).pipe(res);
}

// DELETE /api/admin/thank-you-email/attachments/:id
export async function removeThankYouAttachment(req, res) {
  const item = await findAttachment(req.params.id);
  if (!item) throw new HttpError(404, 'This PDF was not found.');
  await ThankYouEmail.updateOne({ key: 'main' }, { $pull: { attachments: { _id: req.params.id } } });
  await removeStoredPdf(item.file);
  res.json({ ok: true, item: publicSettings(await getThankYouSettings()) });
}
