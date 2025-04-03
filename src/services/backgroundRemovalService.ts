import dotenv from 'dotenv';
import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal-node";
import fetch from 'node-fetch'; // Keep for ImgBB upload
import FormData from 'form-data'; // Keep for ImgBB upload
import sharp from 'sharp'; // <-- Import sharp
import fs from 'fs'; // <-- Import fs for saving file
import path from 'path'; // <-- Import path for saving file
import { pathToFileURL } from 'url'; // <-- Import pathToFileURL

dotenv.config();

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

// Ensure temp directory exists (using absolute path in container)
const TEMP_DIR = '/app/temp_images'; // Use an absolute path
if (!fs.existsSync(TEMP_DIR)) {
  // Create recursively if needed, handle potential errors
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true }); 
  } catch (err) {
    console.error(`[backgroundRemovalService] Failed to create temp directory ${TEMP_DIR}:`, err);
    // Decide if you want to throw or handle differently
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create temporary directory: ${message}`);
  }
}

/**
 * Removes the background from an image using @imgly/background-removal-node 
 * and uploads the result to ImgBB.
 * @param inputImage Can be a URL (string) or Buffer.
 * @returns The public URL of the background-removed image uploaded to ImgBB.
 */
export async function removeBackground(inputImage: string | Buffer): Promise<string> {
  if (!IMGBB_API_KEY) {
    console.error('[backgroundRemovalService] IMGBB_API_KEY is missing!');
    throw new Error('IMGBB_API_KEY is not set in environment variables for upload');
  }

  let imageBlob: Blob;
  let tempFilePath: string | null = null; // Store path to normalized file
  let inputForImgly: string | Buffer | undefined; // <-- Declare here with wider scope

  try {
    if (Buffer.isBuffer(inputImage)) {
      console.log('[backgroundRemovalService] Input is buffer, normalizing with sharp...'); // Re-enable sharp
      const processedInputBuffer = await sharp(inputImage).png().toBuffer(); // Re-enable sharp
      console.log(`[backgroundRemovalService] Normalization complete. Buffer size: ${processedInputBuffer.length} bytes.`);

      // Use the SHARP-PROCESSED buffer directly
      inputForImgly = processedInputBuffer;
      console.log('[backgroundRemovalService] Using sharp-normalized buffer directly for Imgly.');

      // Ensure buffer isn't empty after sharp processing
      if (processedInputBuffer.length === 0) {
         console.warn('[backgroundRemovalService] Warning: Normalized buffer size is 0 after sharp processing.');
         throw new Error('Normalized image buffer is empty after sharp processing.');
      }
      
    } else {
      // If input is a URL string, pass it directly
      console.log('[backgroundRemovalService] Input is URL string, using directly for Imgly.');
      inputForImgly = inputImage;
    }

    // Ensure inputForImgly is defined before proceeding
    if (!inputForImgly) {
      throw new Error('Input for Imgly background removal could not be determined.');
    }

    console.log(`[backgroundRemovalService] Removing background using Imgly with input type: ${typeof inputForImgly}...`);
    // Use the Imgly library with the potentially normalized input (now possibly a file path)
    imageBlob = await imglyRemoveBackground(inputForImgly, {
      debug: true, // Enable debug logging
      model: 'small', // Try the smaller model
      output: { 
        // Specify output if needed, otherwise defaults are fine
        format: 'image/png' // Keep default PNG output
      }
      // config options if needed
    });
    console.log('[backgroundRemovalService] Background removal successful.');

  } catch (error) {
     console.error('[backgroundRemovalService] Error removing background with Imgly:', error);
     const errorMessage = error instanceof Error ? error.message : 'Unknown error during background removal';
     // Now inputForImgly should be accessible here (it might be undefined if error occurred before assignment)
     const inputType = inputForImgly ? typeof inputForImgly : 'unknown'; 
     throw new Error(`Failed to remove background using Imgly (Input type: ${inputType}): ${errorMessage}`);
  } finally {
      // Clean up the temporary file if it was created
      if (tempFilePath && fs.existsSync(tempFilePath)) {
          console.log(`[backgroundRemovalService] Cleaning up temporary file: ${tempFilePath}`);
          try {
              fs.unlinkSync(tempFilePath);
          } catch (cleanupError) {
              console.error(`[backgroundRemovalService] Failed to cleanup temporary file ${tempFilePath}:`, cleanupError);
          }
      }
  }

  try {
    // Convert Blob to Buffer for ImgBB upload
    const arrayBuffer = await imageBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Result = buffer.toString('base64');

    // Upload the processed image (with transparency) to ImgBB
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64Result);

    console.log('[backgroundRemovalService] Uploading background-removed image to ImgBB...');
    const imgbbResponse = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: form,
    });

    if (!imgbbResponse.ok) {
      const errorText = await imgbbResponse.text();
      console.error('[backgroundRemovalService] ImgBB upload failed:', imgbbResponse.status, errorText);
      throw new Error(`ImgBB upload failed with status ${imgbbResponse.status}: ${errorText}`);
    }

    const imgbbData = await imgbbResponse.json() as any;

    if (imgbbData && imgbbData.data && imgbbData.data.url) {
      console.log('[backgroundRemovalService] Background-removed image uploaded successfully:', imgbbData.data.url);
      return imgbbData.data.url;
    } else {
      console.error('[backgroundRemovalService] ImgBB response missing URL:', imgbbData);
      throw new Error('Failed to parse image URL from ImgBB response after background removal');
    }

  } catch (error) {
    console.error('[backgroundRemovalService] Error uploading background-removed image to ImgBB:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during ImgBB upload';
    throw new Error(`Failed to upload background-removed image to ImgBB: ${errorMessage}`);
  }
} 