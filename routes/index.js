import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './authRoutes.js';
import enquiryRoutes from './enquiryRoutes.js';
import publicRoutes from './publicRoutes.js';
import adminRoutes from './adminRoutes.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public health check. The admin login screen uses it to tell "backend is down" apart from "wrong password".
router.get('/health', (req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    ok: dbReady,
    api: 'running',
    database: dbReady ? 'connected' : 'not connected',
  });
});

router.use('/auth', authRoutes);
// Same path the website already uses, so the existing forms keep working without changes.
// Admin enquiry lists are served under /api/admin/enquiries (see adminRoutes.js).
router.use('/enquiry', enquiryRoutes);
router.use('/public', publicRoutes);
router.use('/admin', requireAdmin, adminRoutes);
export default router;
