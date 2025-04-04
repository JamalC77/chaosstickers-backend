import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

// Instantiate the correct client from @google/genai, passing the key in an options object
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GEN_API_KEY || "" });

// Define the Imagen 3 model to use
const IMAGE_GEN_MODEL = "imagen-3.0-generate-002";

export async function generateImage(prompt: string): Promise<Buffer> {
  if (!process.env.GOOGLE_GEN_API_KEY) {
    throw new Error('GOOGLE_GEN_API_KEY is not set in environment variables');
  }

  try {
    console.log(`Generating image with Google Imagen 3 (${IMAGE_GEN_MODEL}) for prompt:`, prompt);

    // Use the generateImages method specific to @google/genai
    const response = await ai.models.generateImages({
        model: IMAGE_GEN_MODEL,
        prompt: prompt,
        config: {
          numberOfImages: 1, // We only need one sticker image
          aspectRatio: "1:1", // Maintain square aspect ratio like DALL-E output
          // personGeneration: "ALLOW_ADULT" // Default setting, can be adjusted if needed
        },
        // safetySettings can be added here if necessary
    });

    // Parse the response structure provided by generateImages
    if (response && response.generatedImages && response.generatedImages.length > 0) {
        const generatedImage = response.generatedImages[0];
        if (generatedImage && generatedImage.image && generatedImage.image.imageBytes) {
            console.log('Image generated successfully by Google Imagen 3.');
            // Convert base64 to Buffer before returning
            return Buffer.from(generatedImage.image.imageBytes, 'base64');
        }
    }

    // If no image data found in the expected structure
    console.error('Failed to parse image data from Google Imagen 3 response:', JSON.stringify(response, null, 2));
    throw new Error('Failed to generate image: No image data found in Imagen 3 response');

  } catch (error) {
    console.error('Error generating image with Google Imagen 3:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during image generation';
    // You might want to check for specific error types/codes from the API
    throw new Error(`Failed to generate image using Google Imagen 3: ${errorMessage}`);
  }
}