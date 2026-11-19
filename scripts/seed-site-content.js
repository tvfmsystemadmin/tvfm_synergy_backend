// Copies the website's built-in content from seed/*.json into MongoDB, so the admin panel owns it from then on.
//
// Each seed file (read in name order, so 00-, 10-, 20- ... control dependencies) looks like:
//   { "resource": "services", "matchOn": "slug", "items": [ { ... }, ... ] }
//   { "resource": "contact", "item": { ... } }                  (single record)
// Values can refer to other content:
//   "asset:brands/luxe.webp"                        -> copied into uploads/brands and added to the media library
//   "ref:product-categories:slug:beauty-tools"      -> the _id of the matching record (must be seeded first)
//
// Only MISSING records are created. Anything already in the database is left alone, so running this again
// never overwrites edits made in the admin panel.
//
// Usage: npm run seed   (MongoDB must be running and .env must be set)

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { connectDb } from '../config/db.js';
import { UPLOAD_ROOT } from '../middleware/upload.js';
import HeroSection from '../models/HeroSection.js';
import Brand from '../models/Brand.js';
import PosVideo from '../models/PosVideo.js';
import PosModule from '../models/PosModule.js';
import PosPlan from '../models/PosPlan.js';
import Faq from '../models/Faq.js';
import Testimonial from '../models/Testimonial.js';
import ProductCategory from '../models/ProductCategory.js';
import Product from '../models/Product.js';
import ProductCombo from '../models/ProductCombo.js';
import Service from '../models/Service.js';
import Blog from '../models/Blog.js';
import ContentBlock from '../models/ContentBlock.js';
import ContactInfo from '../models/ContactInfo.js';
import Media from '../models/Media.js';
import { copyHomeSlidesFromBlocks } from '../services/homeSlides.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seedDir = path.resolve(here, '..', 'seed');
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm' };

const MODELS = {
  hero: HeroSection,
  brands: Brand,
  'pos-videos': PosVideo,
  'pos-modules': PosModule,
  'pos-plans': PosPlan,
  faqs: Faq,
  testimonials: Testimonial,
  'product-categories': ProductCategory,
  products: Product,
  'product-combos': ProductCombo,
  services: Service,
  blogs: Blog,
  'content-blocks': ContentBlock,
};

// Copies a seed asset into uploads/<folder>/ and registers it in the media library.
async function importAsset(relative) {
  const [folder, file] = [relative.split('/')[0], relative.split('/').slice(1).join('/')];
  const ext = path.extname(file).slice(1).toLowerCase();
  const storedName = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.mkdir(dir, { recursive: true });
  const target = path.join(dir, storedName);
  await fs.copyFile(path.join(seedDir, 'assets', relative), target);
  const { size } = await fs.stat(target);
  const url = `/uploads/${folder}/${storedName}`;
  const kind = ['mp4', 'webm'].includes(ext) ? 'video' : 'image';
  await Media.create({ url, kind, folder, storedName, mime: MIME[ext] || 'application/octet-stream', size, originalName: path.basename(file), uploadedBy: 'seed' });
  return url;
}

// Turns seed values into database values (assets copied, references resolved).
async function resolve(value) {
  if (Array.isArray(value)) return Promise.all(value.map(resolve));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await resolve(v);
    return out;
  }
  if (typeof value !== 'string') return value;
  if (value.startsWith('asset:')) return importAsset(value.slice(6));
  if (value.startsWith('ref:')) {
    const [, resource, field, ...rest] = value.split(':');
    const wanted = rest.join(':');
    const doc = await MODELS[resource].findOne({ [field]: wanted }).select('_id');
    if (!doc) throw new Error(`reference not found: ${resource} where ${field} = "${wanted}" (seed it first)`);
    return doc._id;
  }
  return value;
}

async function seedFile(file) {
  const spec = JSON.parse(await fs.readFile(path.join(seedDir, file), 'utf8'));
  const report = { file, created: 0, kept: 0 };

  if (spec.resource === 'contact') {
    if (await ContactInfo.exists({ key: 'main' })) report.kept += 1;
    else {
      await ContactInfo.create({ key: 'main', ...(await resolve(spec.item)) });
      report.created += 1;
    }
    return report;
  }

  const model = MODELS[spec.resource];
  if (!model) throw new Error(`${file}: unknown resource "${spec.resource}"`);

  for (const item of spec.items) {
    // matchOn is one field name, or several (for example ["title", "showInDemo"]) when one value is not unique.
    const keys = [].concat(spec.matchOn || []);
    const match = Object.fromEntries(keys.map((k) => [k, item[k]]));
    if (keys.length && (await model.exists(match))) {
      report.kept += 1;
      continue;
    }
    try {
      await model.create(await resolve(item));
      report.created += 1;
    } catch (err) {
      throw new Error(`${file}: "${item[[].concat(spec.matchOn || [])[0]] || item.key || item.name || item.title || '?'}" -> ${err.message}`);
    }
  }
  return report;
}

async function main() {
  const files = (await fs.readdir(seedDir)).filter((f) => f.endsWith('.json')).sort();
  await connectDb();
  const reports = [];
  for (const file of files) reports.push(await seedFile(file));
  for (const r of reports) console.log(`${r.file}: created ${r.created}, kept ${r.kept}`);
  const slides = await copyHomeSlidesFromBlocks();
  console.log(slides.copied ? `home slides: copied ${slides.copied}` : `home slides: ${slides.reason}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
