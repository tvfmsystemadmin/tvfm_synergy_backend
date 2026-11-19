// Website pages that can have a hero, FAQs and testimonials. Keys match the page routes.
export const PAGE_KEYS = [
  'home',
  'about',
  'salon-network',
  'services',
  'pos',
  'products',
  'blogs',
  'contact',
  'career',
  'privacy',
];

export const FORMS = ['pos', 'product', 'contact', 'career', 'service'];
export const ENQUIRY_STATUSES = ['New', 'Pending', 'Contacted', 'Completed'];
export const BLOG_STATUSES = ['draft', 'published'];
export const CTA_TYPES = ['page', 'external'];

// Most slides one page can have in its hero slider. The admin panel shows the same number (config/resources.js uses it).
export const MAX_HERO_SLIDES_PER_PAGE = 4;

// Maps the "source" sent by each website form to its enquiry form.
export const SOURCE_TO_FORM = {
  'salon-pos-registration': 'pos',
  'product-enquiry': 'product',
  contact: 'contact',
  'career-application': 'career',
  'service-enquiry': 'service',
};
