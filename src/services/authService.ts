import { Resend } from 'resend';
import crypto from 'crypto';
import { prisma } from '../server';

const resend = new Resend(process.env.RESEND_API_KEY);

// Token expiration time (15 minutes)
const TOKEN_EXPIRATION_MINUTES = 15;

/**
 * Generates a secure random token for magic link
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Creates a magic link and sends it to the user's email
 */
export async function sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();

    // Generate token and expiration
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MINUTES * 60 * 1000);

    // Invalidate any existing unused tokens for this email
    await prisma.magicLink.updateMany({
      where: {
        email: normalizedEmail,
        used: false,
      },
      data: {
        used: true,
      },
    });

    // Create new magic link record
    await prisma.magicLink.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    // Build the magic link URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const magicLinkUrl = `${frontendUrl}/auth/verify?token=${token}`;

    // Send the email
    const emailResult = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@chaos-stickers.com',
      to: normalizedEmail,
      subject: 'Sign in to ChaosStickers',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; background-color: #f5f5f5;">
          <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h1 style="margin: 0 0 24px; font-size: 24px; color: #333;">Sign in to ChaosStickers</h1>
            <p style="margin: 0 0 24px; color: #666; line-height: 1.6;">
              Click the button below to sign in to your account. This link will expire in ${TOKEN_EXPIRATION_MINUTES} minutes.
            </p>
            <a href="${magicLinkUrl}" style="display: inline-block; background: #6366f1; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
              Sign In
            </a>
            <p style="margin: 24px 0 0; color: #999; font-size: 14px; line-height: 1.6;">
              If you didn't request this email, you can safely ignore it.
            </p>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;">
            <p style="margin: 0; color: #999; font-size: 12px;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${magicLinkUrl}" style="color: #6366f1; word-break: break-all;">${magicLinkUrl}</a>
            </p>
          </div>
        </body>
        </html>
      `,
    });

    console.log(`[Auth] Magic link sent to ${normalizedEmail}, email ID: ${emailResult.data?.id}`);

    return { success: true };
  } catch (error) {
    console.error('[Auth] Error sending magic link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to send magic link';
    return { success: false, error: errorMessage };
  }
}

/**
 * Verifies a magic link token and returns user info if valid
 */
export async function verifyMagicLink(token: string): Promise<{
  success: boolean;
  user?: { id: number; email: string; name: string | null };
  error?: string;
}> {
  try {
    // Find the magic link
    const magicLink = await prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink) {
      return { success: false, error: 'Invalid or expired link' };
    }

    if (magicLink.used) {
      return { success: false, error: 'This link has already been used' };
    }

    if (new Date() > magicLink.expiresAt) {
      return { success: false, error: 'This link has expired' };
    }

    // Mark the token as used
    await prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { used: true },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: magicLink.email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: magicLink.email,
        },
      });
      console.log(`[Auth] Created new user for ${magicLink.email}, ID: ${user.id}`);
    } else {
      console.log(`[Auth] Verified existing user ${magicLink.email}, ID: ${user.id}`);
    }

    // Generate a session token for the user
    const sessionToken = generateToken();

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  } catch (error) {
    console.error('[Auth] Error verifying magic link:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to verify magic link';
    return { success: false, error: errorMessage };
  }
}

/**
 * Cleanup expired magic links (can be run periodically)
 */
export async function cleanupExpiredLinks(): Promise<number> {
  const result = await prisma.magicLink.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      ],
    },
  });

  console.log(`[Auth] Cleaned up ${result.count} expired/used magic links`);
  return result.count;
}
