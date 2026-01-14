import { RequestHandler } from 'express';
import { prisma } from '../server';
import {
  createMagicLink,
  verifyMagicLink,
  createSession,
  destroySession,
  getCreatorFromSession,
} from '../services/authService';

// Request magic link
export const requestMagicLink: RequestHandler = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const result = await createMagicLink(email.toLowerCase().trim());
    res.status(200).json({
      success: true,
      message: 'Magic link sent to your email',
      isNewCreator: result.isNewCreator,
    });
  } catch (error) {
    console.error('[Auth] Magic link request error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
};

// Verify magic link and create session
export const verifyMagicLinkHandler: RequestHandler = async (req, res) => {
  const { email, token } = req.query;

  if (!email || !token || typeof email !== 'string' || typeof token !== 'string') {
    return res.status(400).json({ error: 'Email and token are required' });
  }

  try {
    const result = await verifyMagicLink(email.toLowerCase().trim(), token);

    if (!result.valid) {
      return res.status(401).json({ error: result.error || 'Invalid or expired link' });
    }

    // Create session
    const sessionToken = createSession(result.creator.id, result.creator.email);

    res.status(200).json({
      success: true,
      creator: result.creator,
      sessionToken,
    });
  } catch (error) {
    console.error('[Auth] Verify magic link error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
};

// Get current authenticated creator
export const getCurrentCreator: RequestHandler = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No session token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const creator = await getCreatorFromSession(token);

    if (!creator) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    res.status(200).json({ creator });
  } catch (error) {
    console.error('[Auth] Get current creator error:', error);
    res.status(500).json({ error: 'Failed to get creator info' });
  }
};

// Logout - destroy session
export const logout: RequestHandler = async (req, res) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    destroySession(token);
  }

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// Check if store name is available
export const checkStoreName: RequestHandler = async (req, res) => {
  const { storeName } = req.query;

  if (!storeName || typeof storeName !== 'string') {
    return res.status(400).json({ error: 'Store name is required' });
  }

  // Validate store name format (lowercase, alphanumeric, hyphens)
  const storeNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  const sanitizedName = storeName.toLowerCase().trim();

  if (sanitizedName.length < 3 || sanitizedName.length > 30) {
    return res.status(400).json({
      available: false,
      error: 'Store name must be between 3 and 30 characters',
    });
  }

  if (!storeNameRegex.test(sanitizedName)) {
    return res.status(400).json({
      available: false,
      error: 'Store name can only contain lowercase letters, numbers, and hyphens',
    });
  }

  // Reserved names
  const reservedNames = [
    'admin', 'api', 'shop', 'creator', 'creators', 'drops', 'drop',
    'support', 'help', 'about', 'settings', 'dashboard', 'login',
    'signup', 'checkout', 'cart', 'account', 'profile', 'explore',
  ];

  if (reservedNames.includes(sanitizedName)) {
    return res.status(200).json({ available: false, error: 'This name is reserved' });
  }

  try {
    const existing = await prisma.creator.findUnique({
      where: { storeName: sanitizedName },
      select: { id: true },
    });

    res.status(200).json({ available: !existing });
  } catch (error) {
    console.error('[Auth] Check store name error:', error);
    res.status(500).json({ error: 'Failed to check store name availability' });
  }
};

// Middleware to require authentication
export const requireAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const creator = await getCreatorFromSession(token);

    if (!creator) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Attach creator to request for use in route handlers
    (req as any).creator = creator;
    next();
  } catch (error) {
    console.error('[Auth] Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};
