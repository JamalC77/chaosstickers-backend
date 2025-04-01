import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface PaymentItem {
  imageUrl: string;
  quantity: number;
  removeBackground?: boolean;
}

export async function createPaymentIntent(items: PaymentItem[]): Promise<string> {
  try {
    // For now, we'll use a simple pricing model
    // In a real application, you would calculate the price based on products
    let amount = items.reduce((total, item) => {
      // Base price of $10.00 per item
      let itemPrice = item.quantity * 1000;
      
      // Add $1.00 for background removal if requested
      if (item.removeBackground) {
        itemPrice += 100;
      }
      
      return total + itemPrice;
    }, 0);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        items: JSON.stringify(items),
      },
    });

    return paymentIntent.client_secret || '';
  } catch (error) {
    console.error('Error creating payment intent with Stripe:', error);
    throw new Error('Failed to create payment intent');
  }
} 