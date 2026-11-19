import { Router } from 'express';
import { RESOURCES } from '../config/resources.js';
import { buildResource } from '../controllers/crud.js';
import { getPublicContact, getPublicSiteSettings } from '../controllers/siteController.js';
import { trackVisit } from '../controllers/analyticsController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { trackLimiter } from '../middleware/rateLimits.js';

const router = Router();
router.get('/contact', asyncHandler(getPublicContact));
router.get('/site-settings', asyncHandler(getPublicSiteSettings));
// The website reports page views and "still here" pings. Nothing is returned that the site needs.
router.post('/track', trackLimiter, asyncHandler(trackVisit));
for (const cfg of RESOURCES.filter((r) => r.public)) {
  router.use(`/${cfg.name}`, buildResource(cfg).publicRouter);
}
export default router;
