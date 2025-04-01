import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Using node-fetch for compatibility
import FormData from 'form-data';

dotenv.config();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

/**
 * Uploads a base64 encoded image to ImgBB.
 * @param base64ImageData The base64 encoded image data (without the 'data:image/png;base64,' prefix).
 * @returns The public URL of the uploaded image.
 */
export async function uploadImageToImgBB(base64ImageData: string): Promise<string> {
  if (!IMGBB_API_KEY) {
    throw new Error('IMGBB_API_KEY is not set in environment variables');
  }

  try {
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64ImageData); // ImgBB API takes base64 string directly
    // Optional: Add expiration if needed
    // form.append('expiration', '600'); // e.g., 10 minutes

    console.log('[imgbbService] Uploading image to ImgBB...');
    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: form,
      // Headers are set automatically by form-data with node-fetch
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[imgbbService] ImgBB upload failed:', response.status, errorText);
      throw new Error(`ImgBB upload failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any; // Type assertion for simplicity

    if (result && result.data && result.data.url) {
      console.log('[imgbbService] Image uploaded successfully:', result.data.url);
      return result.data.url;
    } else {
      console.error('[imgbbService] ImgBB response missing URL:', result);
      throw new Error('Failed to parse image URL from ImgBB response');
    }
  } catch (error) {
    console.error('[imgbbService] Error uploading image to ImgBB:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during ImgBB upload';
    throw new Error(`Failed to upload image to ImgBB: ${errorMessage}`);
  }
} 