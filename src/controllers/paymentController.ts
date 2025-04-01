import { RequestHandler } from 'express';
import { createPaymentIntent } from '../services/stripeService';

interface PaymentItem {
  imageUrl: string;
  quantity: number;
  imageId?: string;
  removeBackground?: boolean;
}

export const createPaymentIntentController: RequestHandler = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required and must be a non-empty array' });
    }

    const clientSecret = await createPaymentIntent(items);
    
    return res.status(200).json({ clientSecret });
  } catch (error) {
    console.error('Error in createPaymentIntentController:', error);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

export const backgroundRemovalPaymentController: RequestHandler = async (req, res) => {
  try {
    const { imageId } = req.body;

    if (!imageId) {
      return res.status(400).json({ error: 'Image ID is required' });
    }

    // Create an item with background removal flag
    const items = [{
      imageUrl: '', // Not needed for this specific purpose
      quantity: 1,
      imageId,
      removeBackground: true
    }];

    const clientSecret = await createPaymentIntent(items);
    
    return res.status(200).json({ 
      clientSecret,
      imageId
    });
  } catch (error) {
    console.error('Error in backgroundRemovalPaymentController:', error);
    return res.status(500).json({ error: 'Failed to create payment intent for background removal' });
  }
}; 