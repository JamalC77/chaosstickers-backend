import { RequestHandler } from 'express';
import { sendMagicLink, verifyMagicLink } from '../services/authService';

/**
 * POST /api/auth/magic-link
 * Request a magic link to be sent to the user's email
 */
export const requestMagicLinkController: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const result = await sendMagicLink(email);

    if (result.success) {
      // Always return success to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a magic link has been sent to your email',
      });
    } else {
      console.error('[Auth Controller] Failed to send magic link:', result.error);
      // Still return success message to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a magic link has been sent to your email',
      });
    }
  } catch (error) {
    console.error('[Auth Controller] Error in requestMagicLink:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /api/auth/verify
 * Verify a magic link token and authenticate the user
 */
export const verifyMagicLinkController: RequestHandler = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await verifyMagicLink(token);

    if (result.success && result.user) {
      return res.status(200).json({
        success: true,
        user: result.user,
      });
    } else {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid or expired link',
      });
    }
  } catch (error) {
    console.error('[Auth Controller] Error in verifyMagicLink:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/auth/verify?token=xxx
 * Alternative GET endpoint for verifying magic links (useful for direct link clicks)
 */
export const verifyMagicLinkGetController: RequestHandler = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await verifyMagicLink(token);

    if (result.success && result.user) {
      return res.status(200).json({
        success: true,
        user: result.user,
      });
    } else {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid or expired link',
      });
    }
  } catch (error) {
    console.error('[Auth Controller] Error in verifyMagicLinkGet:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
