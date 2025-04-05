import { RequestHandler } from 'express';
import { generateImage } from '../services/lumaAIService'; // Or '../services/lumaAIService'
import { saveGeneratedImage, getRecentGeneratedImages, getUserGeneratedImages, getImageById, saveImageWithRemovedBackground } from '../services/databaseService';
import { removeBackground } from '../services/backgroundRemovalService';

// Standard prefix to add to all image generation requests
// Filename: chaosStickersPrompt.js
// Filename: singleStickerPrompt.js

const PROMPT_PREFIX = `
Image of user prompt: [INSERT_USER_PROMPT] end user prompt. With:
• A thick white outline surrounding the entire design main subject
• Ideally this looks cute, colorful, and fun unless the user specifies otherwise.
• Focus on the main subject only, making it easy to cut out.
• IMPORTANT: The background must be an extremely contrasting solid color compared to the main subject to make background removal easier.

Absolutely DO NOT include:
• No text, official logos, brand names, or watermarks
• No additional decorative shapes or backgrounds
• No inappropriate content
`;

// Simple in-memory cache to prevent duplicate requests
const requestCache = new Map<string, { imageUrl: string; timestamp: number }>();
const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

export const generateImageController: RequestHandler = async (req, res) => {
  try {
    const { prompt, regenerate, userId } = req.body;

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
    const imageBuffer = await generateImage(enhancedPrompt);
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

export const removeBackgroundController: RequestHandler = async (req, res) => {
  try {
    const { imageId } = req.body;

    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    // Get the image from the database
    const image = await getImageById(imageId);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Check if background is already removed
    if ('hasRemovedBackground' in image && image.hasRemovedBackground && 'noBackgroundUrl' in image && image.noBackgroundUrl) {
      return res.status(200).json({ 
        imageUrl: image.noBackgroundUrl,
        message: 'Background already removed for this image'
      });
    }

    // Process the image to remove background
    const noBackgroundUrl = await removeBackground(image.imageUrl);
    
    // Save the processed image URL to the database
    await saveImageWithRemovedBackground(imageId, noBackgroundUrl);
    
    return res.status(200).json({ 
      imageUrl: noBackgroundUrl,
      message: 'Background removed successfully'
    });
  } catch (error) {
    console.error('Error in removeBackgroundController:', error);
    return res.status(500).json({ error: 'Failed to remove background' });
  }
} 