import { LumaAI } from 'lumaai';
import dotenv from 'dotenv';
import axios from 'axios'; // Import axios

dotenv.config();

const LUMA_API_KEY = process.env.LUMAAI_API_KEY;

if (!LUMA_API_KEY) {
  console.warn('LUMAAI_API_KEY is not set in environment variables. Luma AI service will not work.');
  // Optional: throw error if Luma AI is essential
  // throw new Error('LUMAAI_API_KEY is not set in environment variables');
}

// Initialize Luma AI client only if the key exists
const client = LUMA_API_KEY ? new LumaAI({ authToken: LUMA_API_KEY }) : null;

const POLLING_INTERVAL = 5000; // 5 seconds
const MAX_POLLING_ATTEMPTS = 24; // 2 minutes total polling time

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateImage(prompt: string): Promise<Buffer> { // Return Buffer
  if (!client) {
    throw new Error('Luma AI client is not initialized. Check LUMAAI_API_KEY.');
  }

  try {
    console.log(`Initiating image generation with Luma AI for prompt:`, prompt);

    // 1. Start the generation process (Endpoint seems video-focused)
    const initialGeneration = await client.generations.image.create({
      prompt: prompt,
      aspect_ratio: '1:1', // Keep aspect ratio square for stickers
      // generation_type: 'image', // Removed: Type definitions indicate this expects 'video' or doesn't support the param here
    });

    const generationId = initialGeneration.id;
    if (!generationId) {
      console.error('Luma AI did not return a generation ID.', initialGeneration);
      throw new Error('Luma AI did not return a generation ID.');
    }
    console.log(`Luma AI generation started with ID: ${generationId}`);

    // 2. Poll for the result
    for (let i = 0; i < MAX_POLLING_ATTEMPTS; i++) {
      await delay(POLLING_INTERVAL);
      console.log(`Polling Luma AI generation status for ID: ${generationId} (Attempt ${i + 1})`);
      const currentStatus = await client.generations.get(generationId);

      const state = (currentStatus as any).state;
      const assets = (currentStatus as any).assets;

      console.log(`Luma AI Status: ${state}`); 

      if (state === 'completed') {
        console.log('Luma AI generation completed.');
        // Look for URL in assets.image
        if (assets && assets.image) {
          const imageUrl = assets.image;
          console.log(`Luma AI image generated successfully (using assets.image): ${imageUrl}`);

          const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
          const imageBuffer = Buffer.from(response.data as ArrayBuffer);
          console.log(`Luma AI image downloaded and converted to Buffer`);
          return imageBuffer;
        } else {
          console.error('Luma AI generation completed but no image asset/URL found. Status:', currentStatus);
          throw new Error('Luma AI generation completed but no image asset found.');
        }
      } else if (state === 'failed' || state === 'rejected') { 
        console.error(`Luma AI generation failed or was rejected. Status: ${state}`, currentStatus);
        throw new Error(`Luma AI generation failed with state: ${state}`);
      } 
      else if (state === 'pending' || state === 'processing' || state === 'queued' || state === 'dreaming') {
         console.log(`Luma AI generation state is '${state}', continuing poll.`);
      } else {
          console.warn(`Luma AI generation in unexpected state: ${state}`, currentStatus);
      }
    }

    console.error(`Luma AI generation polling timed out for ID: ${generationId}`);
    throw new Error(`Luma AI generation timed out after ${MAX_POLLING_ATTEMPTS * POLLING_INTERVAL / 1000} seconds.`);

  } catch (error) {
    console.error('Error generating image with Luma AI:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during Luma AI image generation';
    throw new Error(`Failed to generate image using Luma AI: ${errorMessage}`);
  }
} 