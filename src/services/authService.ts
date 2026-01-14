import crypto from 'crypto';
import { prisma } from '../server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Magic link token expiry time (15 minutes)
const TOKEN_EXPIRY_MINUTES = 15;

// Generate a secure random token
export const generateMagicToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Create or update creator with magic link token
export const createMagicLink = async (email: string): Promise<{ success: boolean; isNewCreator: boolean }> => {
  const token = generateMagicToken();
  const tokenExpiry = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  // Check if creator exists
  const existingCreator = await prisma.creator.findUnique({
    where: { email },
  });

  if (existingCreator) {
    // Update existing creator with new token
    await prisma.creator.update({
      where: { email },
      data: {
        magicLinkToken: token,
        tokenExpiry,
      },
    });
  } else {
    // Create new creator with temporary store name (will be updated on first login)
    const tempStoreName = `creator-${crypto.randomBytes(8).toString('hex')}`;
    await prisma.creator.create({
      data: {
        email,
        storeName: tempStoreName,
        magicLinkToken: token,
        tokenExpiry,
      },
    });
  }

  // Send magic link email
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const magicLinkUrl = `${frontendUrl}/creator/verify?token=${token}&email=${encodeURIComponent(email)}`;

  try {
    await resend.emails.send({
      from: 'Creator Sticker Drops <noreply@chaosstickers.com>',
      to: email,
      subject: existingCreator ? 'Sign in to Creator Sticker Drops' : 'Welcome to Creator Sticker Drops!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Creator Sticker Drops</h1>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #18181b; margin: 0 0 20px 0;">
                ${existingCreator ? 'Welcome back!' : 'Welcome to Creator Sticker Drops!'}
              </h2>
              <p style="color: #52525b; line-height: 1.6; margin: 0 0 30px 0;">
                ${existingCreator
                  ? 'Click the button below to sign in to your creator dashboard.'
                  : 'You\'re one click away from launching your first sticker drop. Click the button below to get started!'}
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${magicLinkUrl}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  ${existingCreator ? 'Sign In' : 'Get Started'}
                </a>
              </div>
              <p style="color: #a1a1aa; font-size: 14px; margin: 30px 0 0 0;">
                This link expires in ${TOKEN_EXPIRY_MINUTES} minutes. If you didn't request this email, you can safely ignore it.
              </p>
            </div>
            <div style="background-color: #f4f4f5; padding: 20px 30px; text-align: center;">
              <p style="color: #71717a; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Creator Sticker Drops. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Auth] Magic link sent to ${email}`);
    return { success: true, isNewCreator: !existingCreator };
  } catch (error) {
    console.error('[Auth] Error sending magic link email:', error);
    throw new Error('Failed to send magic link email');
  }
};

// Verify magic link token and return creator
export const verifyMagicLink = async (
  email: string,
  token: string
): Promise<{ valid: boolean; creator?: any; error?: string }> => {
  const creator = await prisma.creator.findUnique({
    where: { email },
  });

  if (!creator) {
    return { valid: false, error: 'Creator not found' };
  }

  if (!creator.magicLinkToken || creator.magicLinkToken !== token) {
    return { valid: false, error: 'Invalid token' };
  }

  if (!creator.tokenExpiry || new Date() > creator.tokenExpiry) {
    return { valid: false, error: 'Token expired' };
  }

  // Clear the token after successful verification
  await prisma.creator.update({
    where: { email },
    data: {
      magicLinkToken: null,
      tokenExpiry: null,
    },
  });

  // Return creator without sensitive fields
  const { magicLinkToken, tokenExpiry, ...safeCreator } = creator;
  return { valid: true, creator: safeCreator };
};

// Generate a session token for authenticated creator
export const generateSessionToken = (): string => {
  return crypto.randomBytes(48).toString('base64url');
};

// Simple in-memory session store (use Redis in production)
const sessions = new Map<string, { creatorId: number; email: string; expiresAt: Date }>();

export const createSession = (creatorId: number, email: string): string => {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  sessions.set(token, { creatorId, email, expiresAt });

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  return token;
};

export const validateSession = (token: string): { creatorId: number; email: string } | null => {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (new Date() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }

  return { creatorId: session.creatorId, email: session.email };
};

export const destroySession = (token: string): void => {
  sessions.delete(token);
};

const cleanupExpiredSessions = (): void => {
  const now = new Date();
  for (const [token, session] of sessions.entries()) {
    if (now > session.expiresAt) {
      sessions.delete(token);
    }
  }
};

// Get creator by session token
export const getCreatorFromSession = async (token: string) => {
  const session = validateSession(token);
  if (!session) {
    return null;
  }

  const creator = await prisma.creator.findUnique({
    where: { id: session.creatorId },
    select: {
      id: true,
      email: true,
      name: true,
      bio: true,
      profileImageUrl: true,
      storeName: true,
      styleTemplate: true,
      isVerified: true,
      createdAt: true,
    },
  });

  return creator;
};
