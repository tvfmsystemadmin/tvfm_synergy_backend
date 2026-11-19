import crypto from 'node:crypto';
import { env } from '../config/env.js';

// The Owner can read an admin password on the Users page. To allow that, the server keeps an ENCRYPTED copy next to
// the bcrypt hash that is used to sign in. The hash itself is never reversed. The copy is AES-256-GCM.
//
// Key: ADMIN_VAULT_KEY (64 hex characters) if set in backend/.env. Otherwise the key is derived from JWT_SECRET.
// Set ADMIN_VAULT_KEY to a separate random value for better separation. Changing the key makes the stored
// copies unreadable, so the Users page then asks for a new password (sign-in is not affected).

const VERSION = 'v1';

function vaultKey() {
  const custom = (process.env.ADMIN_VAULT_KEY || '').trim();
  if (/^[0-9a-fA-F]{64}$/.test(custom)) return Buffer.from(custom, 'hex');
  return crypto.createHash('sha256').update(`tvfm-admin-password-vault:${env.jwtSecret}`).digest();
}

export function sealPassword(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey(), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), data.toString('base64')].join(':');
}

// Returns the password, or null when there is no copy or it cannot be read with the current key.
export function openPassword(sealed) {
  if (typeof sealed !== 'string' || !sealed) return null;
  const [version, iv, tag, data] = sealed.split(':');
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
