import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import { ensureOwnerRole } from '../services/access.js';
import { sealPassword } from '../services/passwordVault.js';

async function resetAdmin() {
  if (!env.admin.email || !env.admin.password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env first.');
  }
  if (env.admin.password.length < 12) {
    throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  }

  await connectDb();
  const passwordHash = await bcrypt.hash(env.admin.password, 12);

  await AdminUser.updateOne(
    { email: env.admin.email },
    {
      // The name is set only when the account is first created. Later resets keep the name the person has chosen
      // (My account or Users page), so a reset never changes a name back to the ADMIN_NAME value.
      $set: {
        email: env.admin.email,
        passwordHash,
        passwordVault: sealPassword(env.admin.password),
      },
      $setOnInsert: { name: env.admin.name || 'Admin', lastLoginAt: null },
    },
    { upsert: true, runValidators: true },
  );

  // A new account gets the Owner role. An account that already has a role keeps it.
  const owner = await ensureOwnerRole();
  await AdminUser.updateOne({ email: env.admin.email, roleId: null }, { $set: { roleId: owner._id } });

  console.log('Admin account created/updated successfully.');
  console.log(`Admin email: ${env.admin.email}`);
}

resetAdmin()
  .catch((error) => {
    console.error(`Admin reset failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
