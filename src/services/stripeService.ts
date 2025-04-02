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

// Define an interface for shipping details based on frontend formData
interface ShippingDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string; // Optional
  city: string;
  zip: string;
}

// New function to create a Stripe Checkout Session
export async function createCheckoutSession(items: PaymentItem[], shippingDetails: ShippingDetails, userId: number): Promise<{ sessionId: string }> {
  try {
    // --- Dynamic Pricing Logic ---
    const basePricePerItem = 350; // $3.50 in cents
    const backgroundRemovalCost = 200; // $2.00 in cents
    const standardShippingCost = 469; // $4.69 in cents
    const freeShippingThreshold = 2000; // $20.00 in cents

    let totalQuantity = 0;
    items.forEach(item => totalQuantity += item.quantity);

    let stickerPricePerItem = basePricePerItem;
    if (totalQuantity >= 5) {
      stickerPricePerItem = Math.round(basePricePerItem * 0.8); // 20% discount
    } else if (totalQuantity >= 2) {
      stickerPricePerItem = Math.round(basePricePerItem * 0.9); // 10% discount
    }

    let stickerSubtotal = 0;
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Add sticker item(s) with potentially discounted price
    items.forEach(item => {
      const itemSubtotal = stickerPricePerItem * item.quantity;
      stickerSubtotal += itemSubtotal;

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Custom Sticker',
            // description: `Your custom design: ${item.imageUrl}`, // Optional
            metadata: { product_id: 'prod_S3JYagYrE9krFR' } // Keep existing product ID if it represents the base sticker
          },
          unit_amount: stickerPricePerItem, // Use the calculated price
        },
        quantity: item.quantity,
      });

      // Add background removal if applicable (price doesn't change)
      if (item.removeBackground) {
        stickerSubtotal += backgroundRemovalCost * item.quantity; // Add to subtotal for shipping calc
        lineItems.push({
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Background Removal Service',
            },
            unit_amount: backgroundRemovalCost,
          },
          quantity: item.quantity,
        });
      }
    });

    // Determine if shipping is free based on quantity
    const isShippingFree = totalQuantity >= 10;
    const finalShippingCost = isShippingFree ? 0 : standardShippingCost;

    // Add shipping as a line item only if it's not free
    if (!isShippingFree) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping & Handling',
          },
          unit_amount: finalShippingCost, // Use final calculated shipping cost
        },
        quantity: 1,
      });
    }

    // Define success and cancel URLs
    const successUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}` : 'http://localhost:3000/confirmation?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/checkout` : 'http://localhost:3000/checkout';

    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: userId.toString(),
        shipping_details: JSON.stringify(shippingDetails),
        image_url: items[0]?.imageUrl || '', // Still assuming one primary image for now
        quantity: items[0]?.quantity.toString() || '0',
        has_removed_background: items[0]?.removeBackground ? 'true' : 'false',
        product_id: 'prod_S3JYagYrE9krFR', // Keep product ID for reference
        applied_discount: stickerPricePerItem !== basePricePerItem ? `${((basePricePerItem - stickerPricePerItem) / basePricePerItem * 100).toFixed(0)}%` : 'None',
        shipping_cost_applied: finalShippingCost.toString(), // Store applied shipping cost
      },
      customer_email: shippingDetails.email,
      // Include shipping options to potentially display free shipping clearly in Stripe Checkout
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: finalShippingCost, // Set the calculated shipping cost
              currency: 'usd',
            },
            display_name: isShippingFree ? 'Free Shipping (10+ Items)' : 'Standard Shipping',
            // delivery_estimate: { // Optional: Add delivery estimate
            //   minimum: { unit: 'business_day', value: 5 },
            //   maximum: { unit: 'business_day', value: 7 },
            // },
          },
        },
      ],
      // If collecting address via Stripe:
      // shipping_address_collection: { allowed_countries: ['US'] }, // Adjust countries as needed
    });

    if (!session.id) {
      throw new Error('Failed to create Stripe Checkout session: No Session ID returned.');
    }

    return { sessionId: session.id };

  } catch (error) {
    console.error('Error creating Stripe Checkout session:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to create checkout session: ${error.message}`);
    }
    throw new Error('Failed to create checkout session due to an unknown error');
  }
}

// --- Old createPaymentIntent function (can be removed or kept for reference) ---
/*
export async function createPaymentIntent(items: PaymentItem[], shippingDetails: ShippingDetails): Promise<string> {
  // ... (previous implementation) ... 
}
*/ 