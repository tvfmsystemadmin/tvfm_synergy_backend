import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

// One active password reset code at a time. The code is stored only as a hash, it expires after 10 minutes,
// and MongoDB removes the record once it has expired.
const schema = new mongoose.Schema(
  {
    // The admin account the code was sent for. The password is changed for this account only.
    // The account the code is for. A code is always emailed to the Owner(s), never to the person asking.
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    codeHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    // Set once the 6-digit code has been entered correctly. Only then can the password be changed.
    verifiedAt: { type: Date, default: null },
  },
  schemaOptions,
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default defineModel('PasswordResetCode', schema);
