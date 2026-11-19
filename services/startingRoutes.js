import EnquiryRoute from '../models/EnquiryRoute.js';
import { env } from '../config/env.js';
import { cleanEmails } from './routing.js';

// The routes a new installation starts with. The .env addresses are only used when a route does not exist yet.
// After that the admin panel is the only place that changes who receives enquiries.
export function startingRoutes() {
  return [
    { key: 'default', label: 'Default: enquiries without their own route', emails: [env.defaultEnquiryEmail], order: 0 },
    { key: 'pos', label: 'Salon POS software', emails: [env.defaultEnquiryEmail, env.posEnquiryEmail], order: 1 },
    { key: 'product', label: 'Product enquiries', emails: [env.defaultEnquiryEmail, env.productEnquiryEmail], order: 2 },
    { key: 'contact:Salon POS Software', label: 'Contact: Salon POS Software', emails: [env.defaultEnquiryEmail, env.posEnquiryEmail], order: 3 },
    { key: 'contact:Professional Products', label: 'Contact: Professional Products', emails: [env.defaultEnquiryEmail, env.productEnquiryEmail], order: 4 },
    { key: 'contact:Glam Company E-commerce', label: 'Contact: Glam Company E-commerce', emails: [env.defaultEnquiryEmail, env.productEnquiryEmail], order: 5 },
    { key: 'contact:Distributorship', label: 'Contact: Distributorship', emails: [env.defaultEnquiryEmail, env.productEnquiryEmail], order: 6 },
  ];
}

// Creates one route if it does not exist. A route that already exists is never changed.
async function createIfMissing({ key, ...rest }) {
  const result = await EnquiryRoute.updateOne(
    { key },
    { $setOnInsert: { ...rest, emails: cleanEmails(rest.emails) } },
    { upsert: true },
  );
  return result.upsertedCount > 0;
}

// Runs on every start. The default route always exists, so an enquiry is never left without a recipient.
// It is not deleted or changed when it already exists.
export async function ensureDefaultRoute() {
  const route = startingRoutes().find((r) => r.key === 'default');
  return createIfMissing(route);
}

// Creates every starting route that is missing. Used by "npm run setup".
export async function createStartingRoutes() {
  let created = 0;
  for (const route of startingRoutes()) {
    if (await createIfMissing(route)) created += 1;
  }
  return created;
}
