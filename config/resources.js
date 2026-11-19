import mongoose from 'mongoose';
import HeroSection from '../models/HeroSection.js';
import Brand from '../models/Brand.js';
import PosVideo from '../models/PosVideo.js';
import PosModule from '../models/PosModule.js';
import PosPlan from '../models/PosPlan.js';
import Faq from '../models/Faq.js';
import Job, { JOB_TYPES, openJobsFilter } from '../models/Job.js';
import Testimonial from '../models/Testimonial.js';
import ProductCategory from '../models/ProductCategory.js';
import Product from '../models/Product.js';
import ProductCombo from '../models/ProductCombo.js';
import Service from '../models/Service.js';
import Blog from '../models/Blog.js';
import EnquiryRoute from '../models/EnquiryRoute.js';
import ContentBlock from '../models/ContentBlock.js';
import HomeSlide from '../models/HomeSlide.js';
import { PAGE_KEYS, BLOG_STATUSES, MAX_HERO_SLIDES_PER_PAGE } from './constants.js';
import { HttpError } from '../utils/httpError.js';
import { cleanList, cleanText } from '../utils/strings.js';
import { checkCta, isAssetUrl, isHttpUrl } from '../utils/links.js';
import { sanitizeBlogHtml } from '../utils/sanitize.js';
import { emailOk } from '../utils/validators.js';
import { cleanEmails } from '../services/routing.js';

// Every content type below is described here. The generic CRUD engine (controllers/crud.js) builds its routes.
// public: true means the website can read it. Admin-only data (enquiry routes) is never public.

const invalid = (errors) => {
  if (Object.keys(errors).length) throw new HttpError(400, 'Please check the highlighted fields.', errors);
};
const checkAsset = (errors, data, field) => {
  if (data[field] && !isAssetUrl(data[field])) {
    errors[field] = 'Upload the file first, or use a full link starting with https://';
  }
};
const checkLink = (errors, data, field) => {
  if (data[field] && !isHttpUrl(data[field])) errors[field] = 'Enter a full link starting with https://';
};
const checkPages = (data, errors) => {
  if (data.pages === undefined) return;
  data.pages = [...new Set(cleanList(data.pages, { max: 20, maxLength: 40 }))].filter((p) => PAGE_KEYS.includes(p));
  if (!data.pages.length) errors.pages = 'Choose at least one page where this should appear.';
};
const cleanSpecs = (value) =>
  (Array.isArray(value) ? value : [])
    .filter((s) => s && typeof s === 'object')
    .map((s) => ({ label: cleanText(s.label, 80), value: cleanText(s.value, 300) }))
    .filter((s) => s.label && s.value)
    .slice(0, 30);
const categoryFilter = (query) => {
  const id = typeof query.category === 'string' ? query.category : '';
  return mongoose.isValidObjectId(id) ? { category: id } : {};
};

const ROUTE_KEY = /^(default|(pos|product|career|service|contact)(:[^:\r\n]{1,100})?)$/;

export const RESOURCES = [
  {
    name: 'hero',
    model: HeroSection,
    public: true,
    fields: ['pageKey', 'heading', 'subtitle', 'description', 'heroImage', 'backgroundImage', 'ctaEnabled', 'ctaText', 'ctaType', 'ctaPage', 'ctaUrl', 'enabled'],
    search: ['heading', 'pageKey'],
    sort: { pageKey: 1 },
    lookup: 'pageKey',
    publicFilter: () => ({ enabled: true }),
    prepare(data, { isCreate }) {
      const errors = {};
      if (!isCreate) delete data.pageKey; // a hero stays attached to its page
      checkAsset(errors, data, 'heroImage');
      checkAsset(errors, data, 'backgroundImage');
      checkCta(data, errors, data.ctaEnabled === true);
      invalid(errors);
    },
    protect: () => 'Hero sections cannot be deleted. Turn the section off instead.',
  },
  {
    name: 'brands',
    model: Brand,
    public: true,
    // The name and logo are used on the home page. tag and description are used by the About page "Our brands" cards.
    fields: ['name', 'logo', 'tag', 'description', 'enabled', 'order'],
    search: ['name'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      checkAsset(errors, data, 'logo');
      invalid(errors);
    },
  },
  {
    name: 'pos-videos',
    model: PosVideo,
    public: true,
    fields: ['title', 'description', 'sourceType', 'videoUrl', 'posterUrl', 'enabled', 'order'],
    search: ['title'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      if (data.sourceType === 'url' && !isHttpUrl(data.videoUrl)) {
        errors.videoUrl = 'Enter a YouTube, Vimeo or .mp4 link starting with https://';
      }
      if (data.sourceType === 'upload' && !isAssetUrl(data.videoUrl)) errors.videoUrl = 'Upload the video file first.';
      checkAsset(errors, data, 'posterUrl');
      invalid(errors);
    },
  },
  {
    name: 'pos-modules',
    model: PosModule,
    public: true,
    fields: ['title', 'description', 'points', 'ask', 'iconName', 'image', 'icon', 'showOnPage', 'showInDemo', 'enabled', 'order'],
    search: ['title'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      if (data.points !== undefined) data.points = cleanList(data.points, { max: 12, maxLength: 200 });
      checkAsset(errors, data, 'image');
      checkAsset(errors, data, 'icon');
      invalid(errors);
    },
  },
  {
    name: 'pos-plans',
    model: PosPlan,
    public: true,
    fields: ['name', 'description', 'priceAmount', 'currency', 'billingPeriod', 'extraNote', 'features', 'ctaText', 'ctaType', 'ctaPage', 'ctaUrl', 'highlighted', 'enabled', 'order'],
    search: ['name'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      if (data.features !== undefined) data.features = cleanList(data.features, { max: 30, maxLength: 200 });
      checkCta(data, errors, Boolean(data.ctaText));
      invalid(errors);
    },
  },
  {
    name: 'faqs',
    model: Faq,
    public: true,
    pageField: 'pages',
    fields: ['question', 'answer', 'pages', 'enabled', 'order'],
    search: ['question', 'answer'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      checkPages(data, errors);
      invalid(errors);
    },
  },
  {
    // Job openings on the Career page. Closed or turned-off openings are hidden from the website and cannot be applied for.
    name: 'jobs',
    model: Job,
    public: true,
    fields: ['title', 'type', 'place', 'summary', 'duties', 'needs', 'closesOn', 'enabled', 'order'],
    search: ['title', 'place', 'summary'],
    publicFilter: () => openJobsFilter(),
    prepare(data) {
      const errors = {};
      if (data.title !== undefined) data.title = cleanText(data.title, 120);
      if (data.title !== undefined && !data.title) errors.title = 'Enter the job title.';
      if (data.type !== undefined && !JOB_TYPES.includes(data.type)) errors.type = 'Choose a job type.';
      if (data.duties !== undefined) data.duties = cleanList(data.duties, { max: 12, maxLength: 240 });
      if (data.needs !== undefined) data.needs = cleanList(data.needs, { max: 12, maxLength: 240 });
      if (data.closesOn !== undefined && data.closesOn !== null && Number.isNaN(new Date(data.closesOn).getTime())) {
        errors.closesOn = 'Check the closing date.';
      }
      invalid(errors);
    },
  },
  {
    name: 'testimonials',
    model: Testimonial,
    public: true,
    pageField: 'pages',
    fields: ['customerName', 'designation', 'salonName', 'content', 'image', 'videoUrl', 'pages', 'enabled', 'order'],
    search: ['customerName', 'salonName', 'content'],
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      checkPages(data, errors);
      checkAsset(errors, data, 'image');
      checkAsset(errors, data, 'videoUrl');
      invalid(errors);
    },
  },
  {
    name: 'product-categories',
    model: ProductCategory,
    public: true,
    fields: ['name', 'slug', 'parent', 'enabled', 'order'],
    search: ['name'],
    slugFrom: 'name',
    publicFilter: () => ({ enabled: true }),
    prepare(data, { doc }) {
      const errors = {};
      if (data.parent === '') data.parent = null;
      if (doc && data.parent && String(data.parent) === String(doc._id)) {
        errors.parent = 'A category cannot be its own parent.';
      }
      invalid(errors);
    },
    async protect(doc) {
      if (await Product.exists({ $or: [{ category: doc._id }, { subcategory: doc._id }] })) {
        return 'Products use this category. Move or delete those products first.';
      }
      if (await ProductCategory.exists({ parent: doc._id })) return 'Move or delete the subcategories first.';
      return null;
    },
  },
  {
    name: 'products',
    model: Product,
    public: true,
    fields: ['name', 'slug', 'description', 'category', 'subcategory', 'brand', 'tagline', 'storeUrl', 'specifications', 'ingredients', 'features', 'highlights', 'price', 'details', 'images', 'videoUrl', 'enabled', 'order'],
    search: ['name', 'brand', 'description'],
    populate: ['category', 'subcategory'],
    slugFrom: 'name',
    publicFilter: (query) => ({ enabled: true, ...categoryFilter(query) }),
    adminFilter: (query) => categoryFilter(query),
    prepare(data) {
      const errors = {};
      if (data.subcategory === '') data.subcategory = null;
      if (data.specifications !== undefined) data.specifications = cleanSpecs(data.specifications);
      if (data.features !== undefined) data.features = cleanList(data.features, { max: 30, maxLength: 200 });
      if (data.highlights !== undefined) data.highlights = cleanList(data.highlights, { max: 20, maxLength: 200 });
      if (data.images !== undefined) {
        data.images = cleanList(data.images, { max: 10, maxLength: 500 });
        if (!data.images.every((url) => isAssetUrl(url))) errors.images = 'Upload the product images first.';
      }
      checkAsset(errors, data, 'videoUrl');
      invalid(errors);
    },
  },
  {
    name: 'product-combos',
    model: ProductCombo,
    public: true,
    fields: ['name', 'slug', 'description', 'tag', 'products', 'images', 'price', 'details', 'highlights', 'enabled', 'order'],
    search: ['name'],
    populate: ['products'],
    slugFrom: 'name',
    publicFilter: () => ({ enabled: true }),
    async prepare(data) {
      const errors = {};
      if (data.products !== undefined) {
        const ids = [...new Set(cleanList(data.products, { max: 50, maxLength: 40 }))].filter((id) =>
          mongoose.isValidObjectId(id),
        );
        const found = ids.length ? await Product.countDocuments({ _id: { $in: ids } }) : 0;
        if (!ids.length || found !== ids.length) errors.products = 'Choose at least one existing product for this combo pack.';
        data.products = ids;
      }
      if (data.images !== undefined) {
        data.images = cleanList(data.images, { max: 10, maxLength: 500 });
        if (!data.images.every((url) => isAssetUrl(url))) errors.images = 'Upload the combo images first.';
      }
      if (data.highlights !== undefined) data.highlights = cleanList(data.highlights, { max: 20, maxLength: 200 });
      invalid(errors);
    },
  },
  {
    name: 'services',
    model: Service,
    public: true,
    fields: ['slug', 'title', 'chip', 'pageTitle', 'short', 'line', 'lead', 'intro', 'helps', 'points', 'bullets', 'questions', 'primaryLabel', 'iconName', 'image', 'showOnServicesPage', 'showOnHome', 'hasDetailPage', 'category', 'description', 'details', 'icon', 'ctaText', 'ctaType', 'ctaPage', 'ctaUrl', 'enabled', 'order'],
    search: ['title', 'category'],
    slugFrom: 'title',
    lookup: 'slug',
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      checkAsset(errors, data, 'image');
      checkAsset(errors, data, 'icon');
      for (const key of ['points', 'bullets', 'questions']) {
        if (data[key] !== undefined) data[key] = cleanList(data[key], { max: 12, maxLength: 300 });
      }
      checkCta(data, errors, Boolean(data.ctaText));
      invalid(errors);
    },
  },
  {
    name: 'blogs',
    model: Blog,
    public: true,
    fields: ['title', 'slug', 'subtitle', 'excerpt', 'coverImage', 'contentHtml', 'videoUrl', 'showPosDemo', 'readMinutes', 'category', 'authorName', 'authorRole', 'publishDate', 'status'],
    search: ['title', 'category', 'authorName'],
    slugFrom: 'title',
    lookup: 'slug',
    sort: { publishDate: -1, createdAt: -1 },
    // Only published articles whose publish date has arrived are shown to visitors.
    publicFilter: () => ({ status: 'published', publishDate: { $lte: new Date() } }),
    adminFilter: (query) => (BLOG_STATUSES.includes(query.status) ? { status: query.status } : {}),
    prepare(data, { isCreate }) {
      const errors = {};
      if (data.contentHtml !== undefined) {
        data.contentHtml = sanitizeBlogHtml(data.contentHtml);
        if (data.contentHtml.length > 200000) {
          errors.contentHtml = 'This article is too long. Shorten it or split it into two posts.';
        }
      }
      if (data.videoUrl && !isAssetUrl(data.videoUrl)) errors.videoUrl = 'Enter a YouTube, Vimeo or .mp4 link, or upload the video.';
      checkAsset(errors, data, 'coverImage');
      if (data.status !== undefined && !BLOG_STATUSES.includes(data.status)) errors.status = 'Choose draft or published.';
      if (isCreate && !data.publishDate) data.publishDate = new Date();
      invalid(errors);
    },
  },
  {
    name: 'content-blocks',
    model: ContentBlock,
    public: true,
    fields: ['key', 'page', 'eyebrow', 'title', 'body', 'items', 'image', 'alt', 'ctaEnabled', 'ctaText', 'ctaType', 'ctaPage', 'ctaUrl', 'enabled', 'order'],
    search: ['key', 'title', 'page'],
    sort: { order: 1, key: 1 },
    lookup: 'key',
    ordered: true,
    adminFilter: () => ({ key: { $not: /^home\.slide\./ } }),
    publicFilter: () => ({ enabled: true }),
    prepare(data) {
      const errors = {};
      if (data.items !== undefined) data.items = cleanList(data.items, { max: 30, maxLength: 400 });
      checkAsset(errors, data, 'image');
      checkCta(data, errors, data.ctaEnabled === true);
      invalid(errors);
    },
  },
  {
    // Admin only. These addresses are never sent to the public website.
    name: 'enquiry-routes',
    model: EnquiryRoute,
    public: false,
    // The routes are a fixed set (one per enquiry form, plus default). Admins can change them, not add or remove them.
    createable: false,
    deletable: false,
    fields: ['key', 'label', 'emails', 'enabled', 'order'],
    search: ['key', 'label'],
    sort: { order: 1, key: 1 },
    prepare(data, { isCreate, doc }) {
      const errors = {};
      if (data.key !== undefined || isCreate) {
        const key = cleanText(data.key, 140);
        if (!ROUTE_KEY.test(key)) {
          errors.key = 'Use default, pos, product, career, service or contact, optionally with a category after a colon.';
        } else if (doc && key !== doc.key) {
          errors.key = 'The key cannot be changed. Create a new route instead.';
        }
        data.key = key;
      }
      const key = doc ? doc.key : data.key;
      if (key === 'default' && data.enabled === false) errors.enabled = 'The default route must stay on.';
      if (data.emails !== undefined) {
        data.emails = cleanEmails(data.emails);
        if (data.emails.some((e) => !emailOk(e))) errors.emails = 'One or more email addresses are not valid.';
        else if (!data.emails.length && data.enabled !== false) {
          errors.emails = 'Add at least one email address, or turn this route off.';
        }
      }
      invalid(errors);
    },
    protect: (doc) => (doc.key === 'default' ? 'The default route cannot be deleted. Change its email addresses instead.' : null),
  },
  {
    // Hero slides for every page (the Home page included). Each slide has a page key, and the list is ordered by page, then order.
    name: 'hero-slides',
    model: HomeSlide,
    public: true,
    fields: ['page', 'points', 'title', 'body', 'alt', 'image', 'backgroundImage', 'ctaEnabled', 'ctaText', 'ctaType', 'ctaPage', 'ctaUrl', 'enabled', 'order'],
    search: ['title', 'body', 'page'],
    sort: { page: 1, order: 1, createdAt: -1 },
    // The admin can filter by page (?page=pos). The website reads every enabled slide and filters by page itself.
    adminFilter: (query) => (PAGE_KEYS.includes(query.page) ? { page: query.page } : {}),
    publicFilter: () => ({ enabled: true }),
    async prepare(data, { isCreate, doc }) {
      const errors = {};
      if (isCreate && data.page === undefined) data.page = 'home';
      if (data.page !== undefined && !PAGE_KEYS.includes(data.page)) errors.page = 'Choose the page this slide belongs to.';
      if (data.points !== undefined) data.points = cleanList(data.points, { max: 5, maxLength: 160 });

      // A slide needs a heading or a picture. A slide with only a picture has no text at all.
      const title = String(data.title !== undefined ? data.title : (doc?.title || '')).trim();
      const image = data.image !== undefined ? data.image : doc?.image;
      const backgroundImage = data.backgroundImage !== undefined ? data.backgroundImage : doc?.backgroundImage;
      if (!title && !image && !backgroundImage) {
        errors.title = 'Enter a heading, or add a background or hero picture for this slide.';
      }
      checkAsset(errors, data, 'image');
      checkAsset(errors, data, 'backgroundImage');
      checkCta(data, errors, data.ctaEnabled === true);

      // Each page can show up to MAX_HERO_SLIDES_PER_PAGE slides. A slide moved to another page counts on that page.
      const page = data.page !== undefined ? data.page : doc?.page;
      if (page && (isCreate || page !== doc?.page)) {
        const count = await HomeSlide.countDocuments({ page });
        if (count >= MAX_HERO_SLIDES_PER_PAGE) {
          errors.page = `This page already has ${MAX_HERO_SLIDES_PER_PAGE} slides, the most it can show. Delete one of its slides first.`;
        }
      }
      invalid(errors);
    },
  },
];
