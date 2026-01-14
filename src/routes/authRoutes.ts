import express from 'express';
import {
  requestMagicLink,
  verifyMagicLinkHandler,
  getCurrentCreator,
  logout,
  checkStoreName,
} from '../controllers/authController';

const router = express.Router();

// POST /api/auth/magic-link - Request magic link email
router.post('/magic-link', requestMagicLink);

// GET /api/auth/verify - Verify magic link token
router.get('/verify', verifyMagicLinkHandler);

// GET /api/auth/me - Get current authenticated creator
router.get('/me', getCurrentCreator);

// POST /api/auth/logout - Logout and destroy session
router.post('/logout', logout);

// GET /api/auth/check-store-name - Check if store name is available
router.get('/check-store-name', checkStoreName);

export default router;
