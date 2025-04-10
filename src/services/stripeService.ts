import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

interface PaymentItem {
  id: number;
  imageUrl: string;
  quantity: number;
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
export async function createCheckoutSession(items: PaymentItem[], shippingDetails: ShippingDetails): Promise<{ sessionId: string }> {
  try {
    // --- Dynamic Pricing Logic ---
    const basePricePerItem = 350; // $3.50 in cents
    const standardShippingCost = 469; // $4.69 in cents

    let totalQuantity = 0;
    items.forEach(item => totalQuantity += (item.quantity || 0));

    let stickerPricePerItem = basePricePerItem;
    let discountPercentage = 0;
    if (totalQuantity >= 10) {
        stickerPricePerItem = Math.round(basePricePerItem * 0.8); // 20% discount
        discountPercentage = 20;
    } else if (totalQuantity >= 5) {
        stickerPricePerItem = Math.round(basePricePerItem * 0.8); // 20% discount
        discountPercentage = 20;
    } else if (totalQuantity >= 2) {
        stickerPricePerItem = Math.round(basePricePerItem * 0.9); // 10% discount
        discountPercentage = 10;
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Add sticker item(s) with potentially discounted price
    items.forEach(item => {
        if (!item || item.quantity == null || item.quantity <= 0) {
            console.warn('Skipping invalid item in checkout session creation:', item);
            return; // Skip invalid items
        }

      // Use a generic product or create one if needed
      const stickerProductName = 'Custom Sticker'; // Can potentially add details from item if desired

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: stickerProductName,
            description: `Item ID: ${item.id}`, // Include item ID for reference
            images: [item.imageUrl], // Use item image if possible
            metadata: {
                // Keep product_id if you have a specific base product in Stripe
                // product_id: 'prod_base_sticker' 
            }
          },
          unit_amount: stickerPricePerItem, // Use the calculated price
        },
        quantity: item.quantity,
      });
    });

    // Determine if shipping is free based on quantity
    const isShippingFree = totalQuantity >= 10;
    const finalShippingCost = isShippingFree ? 0 : standardShippingCost;

    // Define success and cancel URLs
    const successUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/confirmation?session_id={CHECKOUT_SESSION_ID}` : 'http://localhost:3000/confirmation?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/checkout` : 'http://localhost:3000/checkout';

    // Ensure lineItems is not empty
    if (lineItems.length === 0) {
      throw new Error('No valid items found to create a checkout session.');
    }

    // Create the Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        // Store essential info needed by the webhook
        shipping_details: JSON.stringify(shippingDetails),
        // Store the *entire* items array as JSON string, including numeric ID
        items: JSON.stringify(items.map(item => ({ 
            id: item.id, // Include numeric ID
            quantity: item.quantity, // Include quantity
        }))),
        // Optional: Store calculated values for reference/logging if needed
        // applied_discount: `${discountPercentage}%`,
        // shipping_cost_applied: finalShippingCost.toString(),
      },
      customer_email: shippingDetails.email,
      // Include shipping options
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: finalShippingCost,
              currency: 'usd',
            },
            display_name: isShippingFree ? 'Free Shipping (10+ Items)' : 'Standard Shipping',
            // delivery_estimate: { ... } // Optional
          },
        },
      ],
      // shipping_address_collection: { allowed_countries: ['US'] }, // Collect via Stripe if preferred
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