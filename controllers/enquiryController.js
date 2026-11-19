import mongoose from 'mongoose';
import Enquiry from '../models/Enquiry.js';
import EnquiryRoute from '../models/EnquiryRoute.js';
import { submitEnquiry } from '../services/enquiryService.js';
import { cleanEmails } from '../services/routing.js';
import { sendMail } from '../services/mailer.js';
import { ENQUIRY_STATUSES, FORMS } from '../config/constants.js';
import { HttpError } from '../utils/httpError.js';
import { cleanText, escapeRegex, oneLine, parseDay } from '../utils/strings.js';

// Public: called by the website forms.
export async function postEnquiry(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  // Honeypot: real visitors never fill the hidden "website" field. Pretend success so bots move on.
  if (body.website) return res.json({ ok: true, saved: false, emailSent: false });
  const pageUrl =
    typeof body.pageUrl === 'string' && body.pageUrl.startsWith('/') && !body.pageUrl.startsWith('//')
      ? body.pageUrl.slice(0, 300)
      : '';
  const result = await submitEnquiry(body, { pageUrl });
  return res.status(201).json(result);
}

// Admin: list with search, filters and pages.
export async function listEnquiries(req, res) {
  const filter = {};
  const status = cleanText(req.query.status, 20);
  if (ENQUIRY_STATUSES.includes(status)) filter.status = status;
  const form = cleanText(req.query.form, 20);
  if (FORMS.includes(form)) filter.form = form;

  const from = parseDay(cleanText(req.query.from, 10));
  const to = parseDay(cleanText(req.query.to, 10), true);
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }

  const q = cleanText(req.query.q, 100);
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = ['name', 'email', 'phone', 'message', 'category'].map((field) => ({ [field]: rx }));
  }

  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 25));
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Enquiry.countDocuments(filter),
  ]);
  res.json({ ok: true, items, total, page, limit });
}

export async function getEnquiry(req, res) {
  const item = await Enquiry.findById(req.params.id);
  if (!item) throw new HttpError(404, 'Enquiry not found.');
  res.json({ ok: true, item });
}

export async function updateEnquiry(req, res) {
  const status = req.body?.status;
  if (!ENQUIRY_STATUSES.includes(status)) {
    throw new HttpError(400, 'Choose New, Pending, Contacted or Completed.', { status: 'Choose a valid status.' });
  }
  const item = await Enquiry.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
  if (!item) throw new HttpError(404, 'Enquiry not found.');
  res.json({ ok: true, item });
}

export async function addNote(req, res) {
  const text = cleanText(req.body?.text, 2000);
  if (!text) throw new HttpError(400, 'Write a note before saving.', { text: 'Write a note.' });
  const item = await Enquiry.findByIdAndUpdate(
    req.params.id,
    { $push: { notes: { text, by: req.admin?.email || 'admin', at: new Date() } } },
    { new: true },
  );
  if (!item) throw new HttpError(404, 'Enquiry not found.');
  res.status(201).json({ ok: true, item });
}

export async function deleteEnquiry(req, res) {
  const item = await Enquiry.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'Enquiry not found.');
  res.json({ ok: true });
}

// Admin: sends a test email to the saved addresses of one routing rule, so the admin can check that mail arrives.
export async function testEnquiryRoute(req, res) {
  const route = mongoose.isValidObjectId(req.params.id) ? await EnquiryRoute.findById(req.params.id).lean() : null;
  if (!route) throw new HttpError(404, 'Routing rule not found.');
  const emails = cleanEmails(route.emails);
  if (!emails.length) throw new HttpError(400, 'This rule has no email addresses yet. Add one, save, then send the test.');

  const sentAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  try {
    const result = await sendMail({
      to: emails,
      subject: oneLine(`Test email: ${route.label}`),
      text: [
        'This is a test email from the TVFM Synergy admin panel.',
        '',
        `Routing rule: ${route.label} (${route.key})`,
        `Sent to: ${emails.join(', ')}`,
        `Sent: ${sentAt} (IST)`,
        '',
        'If you can read this, enquiries for this rule will reach these addresses.',
      ].join('\n'),
    });
    if (!result.sent) {
      return res.json({
        ok: true,
        sent: false,
        message: 'Not sent: the website is in test mode (MAIL_DRY_RUN=1 in the backend .env file). Set it to 0, restart the server, then try again.',
      });
    }
    return res.json({ ok: true, sent: true, message: `Test email sent to ${emails.join(', ')}.` });
  } catch (err) {
    if (err.code === 'NOT_CONFIGURED') throw new HttpError(503, err.message);
    console.error('[test email] not sent:', err.message);
    throw new HttpError(502, 'The test email could not be sent. Check the SMTP settings in the backend .env file.');
  }
}
