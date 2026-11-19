// Copies the old home page slides into the Home hero slides. Safe to run more than once.
// Usage: npm run migrate:home-slides   (MongoDB must be running and .env must be set)
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { copyHomeSlidesFromBlocks } from '../services/homeSlides.js';

async function main() {
  await connectDb();
  const result = await copyHomeSlidesFromBlocks();
  console.log(result.copied ? `Copied ${result.copied} home slide(s).` : `Nothing copied: ${result.reason}.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
