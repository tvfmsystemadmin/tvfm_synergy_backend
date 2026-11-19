import ContentBlock from '../models/ContentBlock.js';
import HomeSlide from '../models/HomeSlide.js';

// Copies the home page slides from the old 'home.slide.N' text blocks into the Home hero slides.
// It runs only when there are no slides yet, and then turns the old blocks off. Running it again never brings back
// slides that were deleted in the admin panel, and never overwrites edits made there.
export async function copyHomeSlidesFromBlocks() {
  if (await HomeSlide.exists({})) return { copied: 0, reason: 'slides already exist' };
  const blocks = await ContentBlock.find({ key: /^home\.slide\./, enabled: true }).sort({ order: 1, key: 1 });
  if (!blocks.length) return { copied: 0, reason: 'no old home slides found' };
  const docs = blocks.map((b, i) => ({
    title: b.title || 'Untitled slide',
    body: b.body || '',
    alt: b.alt || '',
    image: b.image || '',
    backgroundImage: '',
    ctaEnabled: Boolean(b.ctaEnabled),
    ctaText: b.ctaText || '',
    ctaType: b.ctaType || 'page',
    ctaPage: b.ctaPage || '',
    ctaUrl: b.ctaUrl || '',
    enabled: true,
    order: b.order || i + 1,
  }));
  await HomeSlide.insertMany(docs);
  await ContentBlock.updateMany({ key: /^home\.slide\./ }, { $set: { enabled: false } });
  return { copied: docs.length, reason: '' };
}
