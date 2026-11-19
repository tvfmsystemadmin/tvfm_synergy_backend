import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import AdminUser from '../models/AdminUser.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { COOKIE_NAME, SESSION_MS, cookieBase } from '../middleware/auth.js';
import { cleanText } from '../utils/strings.js';
import crypto from 'node:crypto';
import PasswordResetCode from '../models/PasswordResetCode.js';
import { sendMail } from '../services/mailer.js';
import { accessFor, adminRecipients } from '../services/access.js';
import { sealPassword } from '../services/passwordVault.js';

export const MIN_PASSWORD_LENGTH = 12;

// Used when the email is unknown, so a wrong email and a wrong password take about the same time.
let dummyHash = null;
const getDummyHash = () => {
  dummyHash ??= bcrypt.hashSync('not-a-real-password', 12);
  return dummyHash;
};

const readPassword = (value) => (typeof value === 'string' ? value.slice(0, 200) : '');

// POST /api/auth/login
export async function login(req, res) {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  const password = readPassword(req.body?.password);

  const errors = {};
  if (!email) errors.email = 'Enter your email address.';
  if (!password) errors.password = 'Enter your password.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Enter your email and password.', errors);

  const user = await AdminUser.findOne({ email }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : getDummyHash());
  if (!user || !ok) throw new HttpError(401, 'Email or password is incorrect.');

  if (user.active === false) {
    throw new HttpError(403, 'This account is turned off. Ask an administrator to turn it on.');
  }
  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign({ sub: String(user._id), email: user.email }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '8h',
  });
  res.cookie(COOKIE_NAME, token, { ...cookieBase(), maxAge: SESSION_MS });
  res.json({ ok: true, admin: await accessFor(user._id) });
}

// GET /api/auth/me. Returns admin:null when nobody is signed in, so the login screen can check without an error.
// Only an invalid or expired token clears the cookie. A database outage is reported as an error and keeps the
// session, so an admin is not signed out just because MongoDB restarted.
export async function session(req, res) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ ok: true, admin: null });

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    res.clearCookie(COOKIE_NAME, cookieBase());
    return res.json({ ok: true, admin: null });
  }

  // Returns the current role and pages, so the panel always shows what this account may open.
  const access = await accessFor(payload.sub);
  if (!access) {
    res.clearCookie(COOKIE_NAME, cookieBase());
    return res.json({ ok: true, admin: null });
  }
  return res.json({ ok: true, admin: access });
}

// POST /api/auth/logout
export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, cookieBase());
  res.json({ ok: true });
}

// ---------- Password codes ----------
// A code is always emailed to the Owner(s) of the admin panel, never to the person asking. That person gets the
// code from the Owner. One code is active at a time, it expires after 10 minutes, and it works for one account only.

const CODE_MINUTES = 10;
const RESEND_WAIT_MS = 60 * 1000;
const MAX_CODE_TRIES = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_RE = /^\/uploads\/avatars\/[A-Za-z0-9-]+\.(jpg|png|webp|gif)$/;

const hashCode = (code) => crypto.createHmac('sha256', env.jwtSecret).update(code).digest('hex');

const sameText = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// sy***@tvfmsynergy.com: enough to recognise the address, not enough to use it.
export const maskEmail = (email) => {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(3, name.length - 2))}@${domain || ''}`;
};

const newestCode = () => PasswordResetCode.findOne({}).sort({ createdAt: -1 }).select('+codeHash');
const cleanCode = (value) => (typeof value === 'string' ? value.replace(/\s/g, '') : '');

// Creates a code for one account and emails it to the Owner(s). Used by the sign-in screen and by My account.
async function sendCodeFor(account) {
  const recipients = await adminRecipients(account.email);
  const previous = await PasswordResetCode.findOne({}).sort({ createdAt: -1 });
  if (previous && Date.now() - previous.createdAt.getTime() < RESEND_WAIT_MS) {
    throw new HttpError(429, 'Please wait one minute before asking for a new code.');
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await PasswordResetCode.deleteMany({});
  const record = await PasswordResetCode.create({
    accountId: account._id,
    email: account.email,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
    attempts: 0,
  });

  try {
    const result = await sendMail({
      to: recipients,
      subject: `TVFM admin: password code for ${account.name || account.email}`,
      text: [
        `Someone asked to change the password of the admin account ${account.name || ''} (${account.email}).`,
        '',
        `Code: ${code}`,
        '',
        `It expires in ${CODE_MINUTES} minutes. Give it only to the person who asked. If you did not expect this, ignore it. The password does not change.`,
      ].join('\n'),
    });
    return {
      sentTo: recipients.map(maskEmail).join(', '),
      testMode: !result.sent,
      expiresInMinutes: CODE_MINUTES,
      resendInSeconds: RESEND_WAIT_MS / 1000,
    };
  } catch (err) {
    await record.deleteOne();
    console.error('[password-reset] code not sent:', err.message);
    throw new HttpError(503, err.code === 'NOT_CONFIGURED'
      ? 'Email is not set up on the server (SMTP_USER and SMTP_PASS are missing), so the code could not be sent.'
      : 'The code could not be emailed. Please try again in a few minutes.');
  }
}

// Compares the entered code. A wrong code uses up one of the tries.
async function checkCode(record, code) {
  if (record.attempts >= MAX_CODE_TRIES) throw new HttpError(429, 'Too many wrong codes. Ask for a new code.');
  if (sameText(record.codeHash, hashCode(code))) return;
  record.attempts += 1;
  await record.save();
  const left = MAX_CODE_TRIES - record.attempts;
  throw new HttpError(400, 'Please check the highlighted fields.', {
    code: left > 0 ? `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'That code is not correct. Ask for a new code.',
  });
}

// ---------- Sign-in screen: forgot password ----------

// POST /api/auth/password/send-code  { email }
export async function sendResetCode(req, res) {
  const email = cleanText(req.body?.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) {
    throw new HttpError(400, 'Please check the highlighted fields.', { email: 'Enter your sign-in email address.' });
  }
  const account = await AdminUser.findOne({ email }).select('_id name email');
  if (!account) {
    throw new HttpError(404, 'No admin account uses this email address. Check the spelling, or ask the Owner to create the account.', {
      email: 'No admin account uses this email.',
    });
  }
  res.json({ ok: true, ...(await sendCodeFor(account)) });
}

// POST /api/auth/password/verify-code  { code }
export async function verifyResetCode(req, res) {
  const code = cleanCode(req.body?.code);
  if (!/^\d{6}$/.test(code)) {
    throw new HttpError(400, 'Please check the highlighted fields.', { code: 'Enter the 6-digit code from the admin.' });
  }
  const record = await newestCode();
  if (!record || record.expiresAt <= new Date()) throw new HttpError(400, 'This code has expired. Ask for a new code.');
  await checkCode(record, code);
  record.verifiedAt = new Date();
  await record.save();
  const resetToken = jwt.sign({ sub: String(record._id), purpose: 'password-reset' }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: '10m',
  });
  res.json({ ok: true, resetToken });
}

// POST /api/auth/password/reset  { resetToken, newPassword, confirmPassword }
export async function resetPassword(req, res) {
  const expired = () => new HttpError(401, 'This reset has expired. Start again from Forgot password.');
  const token = typeof req.body?.resetToken === 'string' ? req.body.resetToken : '';
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw expired();
  }
  if (payload.purpose !== 'password-reset') throw expired();

  const next = readPassword(req.body?.newPassword);
  const confirm = readPassword(req.body?.confirmPassword);
  const errors = {};
  if (next.length < MIN_PASSWORD_LENGTH) errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (next !== confirm) errors.confirmPassword = 'The two passwords do not match.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  const record = await PasswordResetCode.findById(payload.sub);
  if (!record || !record.verifiedAt || record.expiresAt <= new Date()) throw expired();

  const user = await AdminUser.findById(record.accountId).select('+passwordHash');
  if (!user) throw new HttpError(404, 'This admin account no longer exists.');
  user.passwordHash = await bcrypt.hash(next, 12);
  user.passwordVault = sealPassword(next);
  await user.save();
  await PasswordResetCode.deleteMany({});
  res.json({ ok: true });
}

// ---------- My account ----------

// POST /api/admin/account/password/send-code  { currentPassword }
// The current password is checked first. Then the code goes to the Owner(s). The new password is entered after the code.
export async function accountSendCode(req, res) {
  const current = readPassword(req.body?.currentPassword);
  if (!current) throw new HttpError(400, 'Please check the highlighted fields.', { currentPassword: 'Enter your current password.' });

  const user = await AdminUser.findById(req.admin.id).select('+passwordHash _id name email');
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  const ok = await bcrypt.compare(current, user.passwordHash);
  if (!ok) {
    throw new HttpError(400, 'Please check the highlighted fields.', { currentPassword: 'Your current password is not correct.' });
  }
  res.json({ ok: true, ...(await sendCodeFor(user)) });
}

// POST /api/admin/account/password/confirm  { code, newPassword, confirmPassword }
export async function accountConfirmPassword(req, res) {
  const code = cleanCode(req.body?.code);
  const next = readPassword(req.body?.newPassword);
  const confirm = readPassword(req.body?.confirmPassword);
  const errors = {};
  if (!/^\d{6}$/.test(code)) errors.code = 'Enter the 6-digit code from the admin.';
  if (next.length < MIN_PASSWORD_LENGTH) errors.newPassword = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (next !== confirm) errors.confirmPassword = 'The two new passwords do not match.';
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);

  const record = await newestCode();
  if (!record || record.expiresAt <= new Date()) throw new HttpError(400, 'This code has expired. Ask for a new code.');
  if (String(record.accountId) !== req.admin.id) {
    throw new HttpError(400, 'This code was not sent for your account. Ask for a new code.');
  }
  await checkCode(record, code);

  const user = await AdminUser.findById(req.admin.id).select('+passwordHash');
  if (!user) throw new HttpError(401, 'Please log in to continue.');
  user.passwordHash = await bcrypt.hash(next, 12);
  user.passwordVault = sealPassword(next);
  await user.save();
  await PasswordResetCode.deleteMany({});
  res.json({ ok: true });
}

// PATCH /api/admin/account/profile  { name, avatarUrl }. Any signed-in admin can change their own name and photo.
export async function updateProfile(req, res) {
  const body = req.body || {};
  const errors = {};
  const $set = {};
  if (body.name !== undefined) {
    const name = cleanText(body.name, 100);
    if (!name) errors.name = 'Enter your name.';
    else $set.name = name;
  }
  if (body.avatarUrl !== undefined) {
    const url = typeof body.avatarUrl === 'string' ? body.avatarUrl : '';
    if (url && !AVATAR_RE.test(url)) errors.avatarUrl = 'Upload the picture first.';
    else $set.avatarUrl = url;
  }
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);
  if (Object.keys($set).length) await AdminUser.updateOne({ _id: req.admin.id }, { $set });
  res.json({ ok: true, admin: await accessFor(req.admin.id) });
}
