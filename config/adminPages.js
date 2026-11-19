// The admin panel's pages and the permission each one needs. A role stores a list of these ids.
// Keep the ids identical to the sidebar ids in frontend/src/admin/config.js (NAV).
// This file has no imports, so the tests and scripts can load it without the database.

export const OWNER_KEY = 'owner';

// "account" (My account: password and sign-out) is not listed here. Every signed-in admin can always open it.
export const ADMIN_PAGES = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { id: 'visitors', label: 'Website visitors', group: 'Overview' },
  { id: 'hero-slides', label: 'Page hero slides', group: 'Website pages', uploads: true },
  { id: 'brands', label: 'Brands', group: 'Website pages', uploads: true },
  { id: 'careers', label: 'Job openings', group: 'Website pages' },
  { id: 'faqs', label: 'FAQs', group: 'Website pages' },
  { id: 'testimonials', label: 'Testimonials', group: 'Website pages', uploads: true },
  { id: 'content-blocks', label: 'Page text', group: 'Website pages' },
  { id: 'pos-videos', label: 'POS videos', group: 'POS software', uploads: true },
  { id: 'pos-modules', label: 'POS modules', group: 'POS software', uploads: true },
  { id: 'pos-plans', label: 'POS plans', group: 'POS software' },
  { id: 'products', label: 'Products', group: 'Products', uploads: true },
  { id: 'product-combos', label: 'Product combos', group: 'Products', uploads: true },
  { id: 'services', label: 'Services', group: 'Services & blog', uploads: true },
  { id: 'blogs', label: 'Blogs', group: 'Services & blog', uploads: true },
  { id: 'enquiries', label: 'Enquiry inbox', group: 'Enquiries' },
  { id: 'enquiry-routes', label: 'Email routing', group: 'Enquiries' },
  { id: 'thank-you-email', label: 'Thank-you email', group: 'Enquiries', uploads: true },
  { id: 'contact', label: 'Contact details', group: 'Others', uploads: true },
  { id: 'media', label: 'Media library', group: 'Others', uploads: true },
  { id: 'logo', label: 'Website logo', group: 'Others', uploads: true },
  { id: 'maintenance', label: 'Website maintenance switch', group: 'Others' },
  { id: 'roles', label: 'Roles', group: 'Overview' },
  { id: 'users', label: 'Users', group: 'Overview' },
];

export const ALL_PAGE_IDS = ADMIN_PAGES.map((p) => p.id);

// Pages whose uploads (images, PDFs, videos) can be sent to the media library.
export const UPLOAD_PAGES = ADMIN_PAGES.filter((p) => p.uploads).map((p) => p.id);

// Which page owns each content type (the names used in config/resources.js).
// A resource with no entry here cannot be opened by anyone except the Owner.
export const RESOURCE_PAGE = {
  hero: 'hero-slides',
  'hero-slides': 'hero-slides',
  brands: 'brands',
  'pos-videos': 'pos-videos',
  'pos-modules': 'pos-modules',
  'pos-plans': 'pos-plans',
  faqs: 'faqs',
  jobs: 'careers',
  testimonials: 'testimonials',
  'product-categories': 'products',
  products: 'products',
  'product-combos': 'product-combos',
  services: 'services',
  blogs: 'blogs',
  'content-blocks': 'content-blocks',
  'enquiry-routes': 'enquiry-routes',
};

// Some pages only need to READ a list that belongs to another page. Product combos need the product list.
// Reading is allowed for these extra pages; saving is not.
export const READ_ALSO = {
  products: ['product-combos'],
  'product-categories': ['product-combos'],
};

export const isKnownPage = (id) => ALL_PAGE_IDS.includes(id);

// access: { isOwner, pages } as built by services/access.js. The Owner can open every page.
export const hasPage = (access, page) =>
  Boolean(access) && (access.isOwner === true || (Array.isArray(access.pages) && access.pages.includes(page)));

export const hasAnyPage = (access, pages) => pages.some((page) => hasPage(access, page));

// A person can only give out pages they can open themselves. This stops anyone from granting more than they have.
export const canGrantPages = (actor, pages) => actor.isOwner === true || pages.every((p) => actor.pages.includes(p));
