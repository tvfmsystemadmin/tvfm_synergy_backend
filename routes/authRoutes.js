import { Router } from 'express';
import { login, logout, session, sendResetCode, verifyResetCode, resetPassword } from '../controllers/authController.js';
import { loginLimiter, resetLimiter } from '../middleware/rateLimits.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
router.post('/login', loginLimiter, asyncHandler(login));
router.post('/logout', logout);
router.get('/me', asyncHandler(session));
router.post('/password/send-code', resetLimiter, asyncHandler(sendResetCode));
router.post('/password/verify-code', resetLimiter, asyncHandler(verifyResetCode));
router.post('/password/reset', resetLimiter, asyncHandler(resetPassword));
export default router;
