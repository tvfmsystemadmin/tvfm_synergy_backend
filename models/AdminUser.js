import mongoose from 'mongoose';
import { schemaOptions, defineModel } from './base.js';

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, trim: true, maxlength: 100, default: '' },
    passwordHash: { type: String, required: true, select: false },
    // Encrypted copy of the current password, so the Owner can read it on the Users page (services/passwordVault.js).
    // Empty for accounts whose password was set before this existed.
    passwordVault: { type: String, default: '', maxlength: 400, select: false },
    lastLoginAt: { type: Date, default: null },
    // The role decides which admin pages this person can open. Null only for accounts from before roles existed;
    // services/access.js gives those accounts the Owner role at startup.
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null, index: true },
    // A turned-off account cannot sign in, and its open sessions stop working on the next request.
    active: { type: Boolean, default: true },
    // Profile photo, a file in /uploads/avatars. Empty means the initial is shown.
    avatarUrl: { type: String, default: '', maxlength: 300 },
  },
  schemaOptions,
);

export default defineModel('AdminUser', schema);
