// Removes the TVFMMart page from the database, after the page was removed from the code.
// Deletes its hero and slides and its text blocks, and takes it off FAQs and testimonials.
// Usage: npm run cleanup:mart   (MongoDB must be running and .env must be set). Safe to run more than once.
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import HeroSection from '../models/HeroSection.js';
import HomeSlide from '../models/HomeSlide.js';
import ContentBlock from '../models/ContentBlock.js';
import Faq from '../models/Faq.js';
import Testimonial from '../models/Testimonial.js';

async function main() {
  await connectDb();

  const heroes = await HeroSection.deleteMany({ pageKey: 'mart' });
  const slides = await HomeSlide.deleteMany({ page: 'mart' });
  const blocks = await ContentBlock.deleteMany({ key: /^mart\./ });
  const faqs = await Faq.updateMany({ pages: 'mart' }, { $pull: { pages: 'mart' } });
  const testimonials = await Testimonial.updateMany({ pages: 'mart' }, { $pull: { pages: 'mart' } });

  console.log(`Removed ${heroes.deletedCount} hero, ${slides.deletedCount} slide(s), ${blocks.deletedCount} text block(s).`);
  console.log(`Took the page off ${faqs.modifiedCount} FAQ(s) and ${testimonials.modifiedCount} testimonial(s).`);
  const orphans = [
    ...(await Faq.find({ pages: { $size: 0 } }).select('question').lean()),
    ...(await Testimonial.find({ pages: { $size: 0 } }).select('customerName').lean()),
  ];
  if (orphans.length) {
    console.log(`${orphans.length} FAQ or testimonial(s) now show on no page. Choose a page for them in the admin panel, or turn them off.`);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Cleanup failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
