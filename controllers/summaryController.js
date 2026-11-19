import { RESOURCES } from '../config/resources.js';
import { RESOURCE_PAGE, hasPage } from '../config/adminPages.js';
import Enquiry from '../models/Enquiry.js';
import Media from '../models/Media.js';
import Blog from '../models/Blog.js';
import { visitorHeadline } from './analyticsController.js';

// Admin dashboard: one request gives every count the home screen needs.
// Only the counts for pages this admin can open are included.
export async function getSummary(req, res) {
  const access = req.admin;
  const visible = RESOURCES.filter((cfg) => hasPage(access, RESOURCE_PAGE[cfg.name]));
  const canEnquiries = hasPage(access, 'enquiries');
  const canMedia = hasPage(access, 'media');
  const canBlogs = hasPage(access, 'blogs');
  const canVisitors = hasPage(access, 'visitors');

  const entries = await Promise.all(visible.map(async (cfg) => [cfg.name, await cfg.model.countDocuments()]));
  const count = (allowed, fn) => (allowed ? fn() : Promise.resolve(null));
  const [enquiriesTotal, enquiriesNew, mediaTotal, blogDrafts, blogsTotal, blogsPublished] = await Promise.all([
    count(canEnquiries, () => Enquiry.countDocuments()),
    count(canEnquiries, () => Enquiry.countDocuments({ status: 'New' })),
    count(canMedia, () => Media.countDocuments()),
    count(canBlogs, () => Blog.countDocuments({ status: 'draft' })),
    count(canBlogs, () => Blog.countDocuments()),
    count(canBlogs, () => Blog.countDocuments({ status: 'published' })),
  ]);

  const visitors = canVisitors ? await visitorHeadline() : null;

  res.json({
    ok: true,
    counts: Object.fromEntries(entries),
    ...(visitors ? { visitors } : {}),
    ...(canEnquiries ? { enquiries: { total: enquiriesTotal, new: enquiriesNew } } : {}),
    ...(canMedia ? { media: { total: mediaTotal } } : {}),
    ...(canBlogs ? { blogDrafts, blogs: { total: blogsTotal, published: blogsPublished, drafts: blogDrafts } } : {}),
  });
}
