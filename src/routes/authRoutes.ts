import express from 'express';
import {
  requestMagicLinkController,
  verifyMagicLinkController,
  verifyMagicLinkGetController,
} from '../controllers/authController';

const router = express.Router();

// POST /api/auth/magic-link - Request a magic link
router.post('/magic-link', requestMagicLinkController);

// POST /api/auth/verify - Verify magic link token (for frontend AJAX calls)
router.post('/verify', verifyMagicLinkController);

// GET /api/auth/verify - Verify magic link token (for direct link clicks)
router.get('/verify', verifyMagicLinkGetController);

export default router;
