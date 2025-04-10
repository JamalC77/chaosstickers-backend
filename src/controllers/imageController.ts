import { RequestHandler } from 'express';
import { generateImage } from '../services/lumaAIService'; // Or '../services/lumaAIService'
import { saveGeneratedImage, getRecentGeneratedImages, getUserGeneratedImages, getImageById, saveImageWithRemovedBackground } from '../services/databaseService';
import { removeBackground } from '../services/backgroundRemovalService';

// Standard prefix to add to all image generation requests
// Filename: chaosStickersPrompt.js
// Filename: singleStickerPrompt.js

const PROMPT_PREFIX = `
Image of USER_PROMPT: [INSERT_USER_PROMPT] END_USER_PROMPT. With:
• Follow the user prompt as closely as possible as long as it doesn't conflict with the other guidelines.
• A thin white outline surrounding the entire design's main subject which allows for easy cutting out.
• Ideally this looks cute, colorful, and fun unless the user specifies otherwise.
• Focus on the main subject and supporting elements only, making it easy to cut out.
• IMPORTANT: The background must be black to the main subject to make background removal easier.

Absolutely DO NOT include:
• No text, official logos, brand names, or watermarks
• No additional decorative backgrounds
• No inappropriate content
• No NSFW content
`;

// Simple in-memory cache to prevent duplicate requests
const requestCache = new Map<string, { imageUrl: string; timestamp: number }>();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export const generateImageController: RequestHandler = async (req, res) => {
  try {
    const { prompt, regenerate, userId, referenceUrl } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const cacheKey = prompt.trim().toLowerCase();
    const cachedResult = requestCache.get(cacheKey);
    
    if (!regenerate && cachedResult && Date.now() - cachedResult.timestamp < CACHE_TIMEOUT) {
      console.log('Returning cached background-removed image result (ImgBB URL) for prompt:', prompt);
      return res.status(200).json({ imageUrl: cachedResult.imageUrl });
    }
    
    const enhancedPrompt = PROMPT_PREFIX.replace('[INSERT_USER_PROMPT]', prompt);
    
    // 1. Generate image using the imported service (returns Buffer)
    console.log('[generateImageController] Calling generateImage service');
    const imageBuffer = await generateImage(enhancedPrompt, referenceUrl);
    console.log(`[generateImageController] Image Buffer received from service`);

    // 2. Remove background and upload transparent result to ImgBB
    const finalImageUrl = await removeBackground(imageBuffer);
    console.log(`[generateImageController] Background removed and uploaded to ImgBB: ${finalImageUrl}`);
    
    // 3. Save the final ImgBB URL (transparent image) to database
    const savedImage = await saveGeneratedImage(prompt, finalImageUrl, userId || undefined);
    console.log(`[generateImageController] Final ImgBB URL saved to DB (ID: ${savedImage.id})`);
    
    // 4. Cache the final ImgBB URL (transparent image)
    requestCache.set(cacheKey, { imageUrl: finalImageUrl, timestamp: Date.now() });
    
    return res.status(200).json({ 
      imageUrl: finalImageUrl, // Return the final ImgBB URL
      id: savedImage.id.toString() 
    });
  } catch (error) {
    console.error('Error in generateImageController:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
    return res.status(500).json({ error: errorMessage });
  }
}

// Cleanup function to periodically remove old entries from the cache
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TIMEOUT) {
      requestCache.delete(key);
    }
  }
}, CACHE_TIMEOUT);

export const getRecentImagesController: RequestHandler = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const recentImages = await getRecentGeneratedImages(limit);
    return res.status(200).json(recentImages);
  } catch (error) {
    console.error('Error in getRecentImagesController:', error);
    return res.status(500).json({ error: 'Failed to retrieve recent images' });
  }
}

export const getUserImagesController: RequestHandler = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 5;
    const userImages = await getUserGeneratedImages(userId, limit);
    
    return res.status(200).json(userImages);
  } catch (error) {
    console.error('Error in getUserImagesController:', error);
    return res.status(500).json({ error: 'Failed to retrieve user images' });
  }
}
