// Run once after installing and after first setting up .env: "npm run setup".
// Creates the first admin login and the starting enquiry routes. Existing data is never overwritten.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import AdminUser from '../models/AdminUser.js';
import { createStartingRoutes } from '../services/startingRoutes.js';
import { createStartingJobs } from '../services/startingJobs.js';

async function main() {
  await connectDb();

  const jobsCreated = await createStartingJobs();
  console.log(`Job openings: ${jobsCreated} created (only when there are none yet).`);
  const routesCreated = await createStartingRoutes();
  console.log(`Enquiry routes: ${routesCreated} created, existing routes left unchanged.`);

  if (env.admin.email && env.admin.password) {
    if (env.admin.password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
    if (await AdminUser.exists({ email: env.admin.email })) {
      console.log('Admin account already exists. Its password was not changed.');
    } else {
      const passwordHash = await bcrypt.hash(env.admin.password, 12);
      await AdminUser.create({ email: env.admin.email, name: env.admin.name, passwordHash });
      console.log(`Admin account created for ${env.admin.email}.`);
    }
  } else {
    console.log('Admin account not created: set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env, then run again.');
  }
}

main()
  .catch((err) => {
    console.error(`Setup failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
