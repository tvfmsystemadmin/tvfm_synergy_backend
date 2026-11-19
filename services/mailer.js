import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = env.mailDryRun
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: { user: env.smtp.user, pass: env.smtp.pass },
      });
  return transporter;
}

function mailError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// Resolves with { sent: true } only when the mail server accepts the message.
// In test mode (MAIL_DRY_RUN=1) nothing leaves the server, so it resolves with { sent: false, dryRun: true }.
// Errors carry a code: NOT_CONFIGURED when the SMTP login is missing, NO_RECIPIENTS when nobody is given.
export async function sendMail({ to, subject, text, replyTo, attachments }) {
  if (!to.length) throw mailError('NO_RECIPIENTS', 'No recipients were given.');

  if (env.mailDryRun) {
    const info = await getTransporter().sendMail({
      from: env.smtp.user || 'dry-run@localhost',
      to,
      replyTo,
      subject,
      text,
      attachments,
    });
    console.log(`[mail] TEST MODE, not sent:\n${info.message}`);
    return { sent: false, dryRun: true, messageId: null };
  }

  if (!(env.smtp.user && env.smtp.pass)) {
    throw mailError('NOT_CONFIGURED', 'Email is not set up on the server. Add SMTP_USER and SMTP_PASS to the backend .env file.');
  }
  const info = await getTransporter().sendMail({
    from: { name: env.smtp.fromName, address: env.smtp.user },
    to,
    replyTo,
    subject,
    text,
    attachments,
  });
  return { sent: true, dryRun: false, messageId: info.messageId || null };
}
