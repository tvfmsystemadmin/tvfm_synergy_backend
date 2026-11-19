import { Router } from 'express';
import { RESOURCES } from '../config/resources.js';
import { buildResource } from '../controllers/crud.js';
import { listEnquiries, getEnquiry, updateEnquiry, addNote, deleteEnquiry, testEnquiryRoute } from '../controllers/enquiryController.js';
import { uploadMedia, listMedia, deleteMedia, mediaSummary } from '../controllers/mediaController.js';
import { getAdminContact, putContact, getAdminSiteSettings, putSiteSettings, getAdminLogo, putLogo } from '../controllers/siteController.js';
import { getSummary } from '../controllers/summaryController.js';
import { accountSendCode, accountConfirmPassword, updateProfile } from '../controllers/authController.js';
import { overview, liveVisitors } from '../controllers/analyticsController.js';
import {
  listPages,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  revealPassword,
} from '../controllers/accessController.js';
import { uploadSingle, uploadDocument } from '../middleware/upload.js';
import { requirePage } from '../middleware/auth.js';
import { RESOURCE_PAGE, READ_ALSO, UPLOAD_PAGES } from '../config/adminPages.js';
import {
  getThankYouEmail,
  putThankYouEmail,
  uploadThankYouAttachment,
  getThankYouAttachmentFile,
  removeThankYouAttachment,
} from '../controllers/thankYouController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { sanitizeBlogHtml } from '../utils/sanitize.js';

// Every route below needs a signed-in admin (see routes/index.js). requirePage(...) adds the page permission.
// The account page (password, sign-out) is open to every signed-in admin.

const router = Router();

// Anyone signed in may upload a profile photo (folder "avatars"). Other uploads need a page that uses them.
const uploadGate = (req, res, next) => (req.query.folder === 'avatars' ? next() : requirePage(...UPLOAD_PAGES)(req, res, next));

// The dashboard counts only show the pages this admin can open (see summaryController.js).
router.get('/summary', asyncHandler(getSummary));

// Cleans article HTML exactly as saving an article does. The admin preview calls it, so the preview shows the
// same HTML the live article will show. Nothing is saved here.
router.post(
  '/blog-preview',
  requirePage('blogs'),
  asyncHandler(async (req, res) => {
    const html = typeof req.body?.contentHtml === 'string' ? req.body.contentHtml : '';
    if (html.length > 200000) throw new HttpError(400, 'This article is too long. Shorten it or split it into two posts.');
    res.json({ ok: true, contentHtml: sanitizeBlogHtml(html) });
  }),
);

// My account: changing the password needs a code from the Owner. Name and photo need no code.
router.post('/account/password/send-code', asyncHandler(accountSendCode));
router.post('/account/password/confirm', asyncHandler(accountConfirmPassword));
router.patch('/account/profile', asyncHandler(updateProfile));

router.use('/enquiries', requirePage('enquiries'));
router.get('/enquiries', asyncHandler(listEnquiries));
router.get('/enquiries/:id', asyncHandler(getEnquiry));
router.patch('/enquiries/:id', asyncHandler(updateEnquiry));
router.post('/enquiries/:id/notes', asyncHandler(addNote));
router.delete('/enquiries/:id', asyncHandler(deleteEnquiry));

// Thank-you email sent to customers after an enquiry, with an optional PDF.
router.use('/thank-you-email', requirePage('thank-you-email'));
router.get('/thank-you-email', asyncHandler(getThankYouEmail));
router.put('/thank-you-email', asyncHandler(putThankYouEmail));
router.post('/thank-you-email/attachments', uploadDocument, asyncHandler(uploadThankYouAttachment));
router.get('/thank-you-email/attachments/:id/file', asyncHandler(getThankYouAttachmentFile));
router.delete('/thank-you-email/attachments/:id', asyncHandler(removeThankYouAttachment));

// The media library is shared by every page that has pictures. Uploads are allowed for those pages.
router.get('/media', requirePage(...UPLOAD_PAGES), asyncHandler(listMedia));
router.get('/media/summary', requirePage('media'), asyncHandler(mediaSummary));
router.post('/uploads', uploadGate, uploadSingle, asyncHandler(uploadMedia));
router.delete('/media/:id', requirePage('media'), asyncHandler(deleteMedia));

router.use('/contact', requirePage('contact'));
router.get('/contact', asyncHandler(getAdminContact));
router.put('/contact', asyncHandler(putContact));

// The website maintenance switch lives in site settings.
router.use('/site-settings', requirePage('maintenance'));
router.get('/site-settings', asyncHandler(getAdminSiteSettings));
router.put('/site-settings', asyncHandler(putSiteSettings));

// Website logos (light and dark). Needs the Website logo page.
router.get('/logo', requirePage('logo'), asyncHandler(getAdminLogo));
router.put('/logo', requirePage('logo'), asyncHandler(putLogo));

router.post('/enquiry-routes/:id/test', requirePage('enquiry-routes'), asyncHandler(testEnquiryRoute));

// Website visitors: live count, page views and the most visited pages.
router.use('/analytics', requirePage('visitors'));
router.get('/analytics/overview', asyncHandler(overview));
router.get('/analytics/live', asyncHandler(liveVisitors));

// Roles and users. The role list is also needed by the Users page to choose a role, so both pages can read it.
router.get('/access/pages', requirePage('roles', 'users'), asyncHandler(listPages));
router.get('/roles', requirePage('roles', 'users'), asyncHandler(listRoles));
router.post('/roles', requirePage('roles'), asyncHandler(createRole));
router.patch('/roles/:id', requirePage('roles'), asyncHandler(updateRole));
router.delete('/roles/:id', requirePage('roles'), asyncHandler(deleteRole));

router.get('/users', requirePage('users'), asyncHandler(listUsers));
router.get('/users/:id/password', requirePage('users'), asyncHandler(revealPassword));
router.post('/users', requirePage('users'), asyncHandler(createUser));
router.patch('/users/:id', requirePage('users'), asyncHandler(updateUser));
router.delete('/users/:id', requirePage('users'), asyncHandler(deleteUser));

// Content types (hero slides, products, blogs, ...). Reading may be allowed for a few extra pages (see READ_ALSO).
const gate = (name) => {
  const page = RESOURCE_PAGE[name];
  const readers = READ_ALSO[name] || [];
  return (req, res, next) => (req.method === 'GET' ? requirePage(page, ...readers) : requirePage(page))(req, res, next);
};
for (const cfg of RESOURCES) {
  router.use(`/${cfg.name}`, gate(cfg.name), buildResource(cfg).adminRouter);
}

export default router;
