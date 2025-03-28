import { RequestHandler } from 'express';
import { createPaymentIntent } from '../services/stripeService';
import { prisma } from '../server';

export const createPaymentIntentController: RequestHandler = async (req, res) => {
  try {
    const { items, userId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    // Create the payment intent
    const clientSecret = await createPaymentIntent(items);

    return res.status(200).json({ clientSecret });
  } catch (error) {
    console.error('Error in createPaymentIntentController:', error);
    return res.status(500).json({ error: 'Failed to create payment intent' });
  }
} 