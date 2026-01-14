import express from 'express';
import { requireAuth } from '../controllers/authController';
import {
  getCreatorProfile,
  updateCreatorProfile,
  updateStyleTemplate,
  getCreatorAnalytics,
  getCreatorEarnings,
  getCreatorImages,
  getPricing,
} from '../controllers/creatorController';

const router = express.Router();

// Public routes
// GET /api/creators/pricing - Get pricing info
router.get('/pricing', getPricing);

// GET /api/creators/:storeSlug - Get public creator profile
router.get('/:storeSlug', getCreatorProfile);

// Protected routes (require authentication)
// PUT /api/creators/profile - Update creator profile
router.put('/profile', requireAuth, updateCreatorProfile);

// PUT /api/creators/style-template - Update style template
router.put('/style-template', requireAuth, updateStyleTemplate);

// GET /api/creators/analytics - Get creator analytics
router.get('/me/analytics', requireAuth, getCreatorAnalytics);

// GET /api/creators/earnings - Get creator earnings
router.get('/me/earnings', requireAuth, getCreatorEarnings);

// GET /api/creators/images - Get creator's generated images
router.get('/me/images', requireAuth, getCreatorImages);

export default router;
