import { Router } from 'express';
import { postEnquiry } from '../controllers/enquiryController.js';
import { enquiryLimiter } from '../middleware/rateLimits.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.post('/', enquiryLimiter, asyncHandler(postEnquiry));
export default router;
