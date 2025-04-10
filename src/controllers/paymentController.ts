import { RequestHandler } from 'express';
import { createCheckoutSession } from '../services/stripeService';

interface PaymentItem {
  id: number;
  imageUrl: string;
  quantity: number;
  imageId?: string; // Keep for potential future use, though not used in current flow
  removeBackground?: boolean;
}

// Define an interface for the expected request body
interface CreatePaymentRequestBody {
  items: PaymentItem[];
  shippingAddress: { // Match the structure sent from the frontend
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    country: string;
    region: string;
    address1: string;
    address2?: string;
    city: string;
    zip: string;
  };
  // userId: number; // REMOVED - No longer sent from frontend
}

// Rename controller to reflect its purpose
export const createCheckoutSessionController: RequestHandler = async (req, res) => {
  try {
    // Explicitly type the request body
    const { items, shippingAddress } = req.body as CreatePaymentRequestBody; // REMOVED userId

    // Basic Validations (can be kept or enhanced)
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required and must be a non-empty array' });
    }
    if (!shippingAddress) {
        return res.status(400).json({ error: 'Shipping address is required' });
    }
    if (!shippingAddress.first_name || !shippingAddress.last_name || !shippingAddress.email || 
        !shippingAddress.phone || !shippingAddress.country || !shippingAddress.region || 
        !shippingAddress.address1 || !shippingAddress.city || !shippingAddress.zip) {
      return res.status(400).json({ error: 'Missing required shipping address fields' });
    }
    // REMOVED userId validation
    /*
    if (userId === undefined) {
        return res.status(400).json({ error: 'User ID is required' });
    }
    */

    // Call the service function without userId
    const { sessionId } = await createCheckoutSession(items, shippingAddress);
    
    // console.log(`Checkout session created for user email: ${shippingAddress.email}, sessionId: ${sessionId}`); // Updated log

    // Return the session ID to the frontend
    return res.status(200).json({ sessionId });

  } catch (error) {
    console.error('Error in createCheckoutSessionController:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session';
    return res.status(500).json({ error: errorMessage });
  }
};

// Remove the backgroundRemovalPaymentController as it's no longer needed
/*
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
    
    // NOTE: This previous logic didn't pass shipping details, which is incorrect.
    // The new approach integrates this cost into the main payment intent.
    const clientSecret = await createPaymentIntent(items, {} as any); // Placeholder, needs proper shipping
    
    return res.status(200).json({ 
      clientSecret,
      imageId
    });
  } catch (error) {
    console.error('Error in backgroundRemovalPaymentController:', error);
    return res.status(500).json({ error: 'Failed to create payment intent for background removal' });
  }
};
*/ 