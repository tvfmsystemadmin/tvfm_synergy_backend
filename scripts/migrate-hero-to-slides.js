// Moves the old single page heroes (HeroSection) into the page hero slides (HomeSlide), and gives every old
// slide a page. Safe to run more than once: nothing is created twice, and slides edited in the admin are not touched.
// Usage: npm run migrate:hero-slides   (MongoDB must be running and .env must be set)
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import HeroSection from '../models/HeroSection.js';
import HomeSlide from '../models/HomeSlide.js';

async function main() {
  await connectDb();

  // 1. Slides made before the page field existed belong to the Home page.
  const backfill = await HomeSlide.updateMany({ page: { $exists: false } }, { $set: { page: 'home' } });
  console.log(`Slides given the Home page: ${backfill.modifiedCount}.`);

  // 2. Each enabled page hero becomes one slide, but only for pages that have no slide yet.
  const heroes = await HeroSection.find({ enabled: true }).sort({ pageKey: 1 });
  let created = 0;
  for (const hero of heroes) {
    if (await HomeSlide.exists({ page: hero.pageKey })) {
      console.log(`Skipped ${hero.pageKey}: it already has slides.`);
      continue;
    }
    await HomeSlide.create({
      page: hero.pageKey,
      title: hero.heading,
      body: hero.description || '',
      alt: hero.heading,
      image: hero.heroImage || '',
      backgroundImage: hero.backgroundImage || '',
      ctaEnabled: Boolean(hero.ctaEnabled),
      ctaText: hero.ctaText || '',
      ctaType: hero.ctaType || 'page',
      ctaPage: hero.ctaPage || '',
      ctaUrl: hero.ctaUrl || '',
      enabled: true,
      order: 0,
    });
    created += 1;
    console.log(`Created a slide for ${hero.pageKey}.`);
  }
  console.log(created ? `Done. Created ${created} slide(s).` : 'Done. Nothing new to create.');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
