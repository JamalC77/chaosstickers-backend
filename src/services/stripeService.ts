import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface PaymentItem {
  imageUrl: string;
  quantity: number;
}

export async function createPaymentIntent(items: PaymentItem[]): Promise<string> {
  try {
    // For now, we'll use a simple pricing model
    // In a real application, you would calculate the price based on products
    const amount = items.reduce((total, item) => total + item.quantity * 1000, 0); // $10.00 per item

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