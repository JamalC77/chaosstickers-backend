import { RequestHandler } from 'express';
import { generateImage } from '../services/openAiService';
import { saveGeneratedImage, getRecentGeneratedImages, getUserGeneratedImages } from '../services/databaseService';

// Standard prefix to add to all image generation requests
const PROMPT_PREFIX = `
This is for a service called ChaosStickers.
Sticker illustration of a [INSERT USER PROMPT] with:
- A thick white outline surrounding the entire design
- Make sure it is recognizably a sticker, with a distinct cutout and cohesive composition
- Bright, vibrant colors that pop
- A simplified, cartoonish style
- No background (use solid white or a single plain color)
- Bold, high-contrast details
- The overall tone should be fun/whimsical/cute/modern
- Make the image easy to cut out, focusing on the main subject only
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

    // Check if we have a cached result for this prompt
    const cacheKey = prompt.trim().toLowerCase();
    const cachedResult = requestCache.get(cacheKey);
    
    // If we have a valid cached result, return it
    if (!regenerate && cachedResult && Date.now() - cachedResult.timestamp < CACHE_TIMEOUT) {
      console.log('Returning cached image result for prompt:', prompt);
      return res.status(200).json({ imageUrl: cachedResult.imageUrl });
    }
    
    // Combine the prefix with the user's prompt
    const enhancedPrompt = PROMPT_PREFIX.replace('[INSERT USER PROMPT]', prompt);
    
    const imageUrl = await generateImage(enhancedPrompt);
    
    // Save the generated image to database with optional userId
    await saveGeneratedImage(prompt, imageUrl, userId);
    
    // Cache the result
    requestCache.set(cacheKey, { imageUrl, timestamp: Date.now() });
    
    return res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Error in generateImageController:', error);
    return res.status(500).json({ error: 'Failed to generate image' });
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