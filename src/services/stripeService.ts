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

// --- Refund Functions ---

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  status?: string;
  error?: string;
}

/**
 * Creates a full refund for a payment intent
 * @param paymentIntentId - The Stripe payment intent ID to refund
 * @param reason - Optional reason for the refund (for internal tracking)
 * @returns RefundResult with success status and details
 */
export async function createRefund(
  paymentIntentId: string,
  reason?: string
): Promise<RefundResult> {
  try {
    console.log(`[Stripe] Creating refund for payment intent: ${paymentIntentId}, reason: ${reason || 'Not specified'}`);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer', // Stripe's enum value
      metadata: {
        internal_reason: reason || 'IP violation detected',
        refund_type: 'auto_refund',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`[Stripe] Refund created successfully: ${refund.id}, amount: ${refund.amount}, status: ${refund.status}`);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status
    };
  } catch (error) {
    console.error('[Stripe] Error creating refund:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error creating refund';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Creates a partial refund for a payment intent
 * @param paymentIntentId - The Stripe payment intent ID to refund
 * @param amountInCents - The amount to refund in cents
 * @param reason - Optional reason for the refund
 * @returns RefundResult with success status and details
 */
export async function createPartialRefund(
  paymentIntentId: string,
  amountInCents: number,
  reason?: string
): Promise<RefundResult> {
  try {
    console.log(`[Stripe] Creating partial refund for payment intent: ${paymentIntentId}, amount: ${amountInCents} cents, reason: ${reason || 'Not specified'}`);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amountInCents,
      reason: 'requested_by_customer',
      metadata: {
        internal_reason: reason || 'Partial refund',
        refund_type: 'partial_refund',
        timestamp: new Date().toISOString()
      }
    });

    console.log(`[Stripe] Partial refund created successfully: ${refund.id}, amount: ${refund.amount}, status: ${refund.status}`);

    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status
    };
  } catch (error) {
    console.error('[Stripe] Error creating partial refund:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error creating partial refund';
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Gets the refund status for a payment intent
 * @param paymentIntentId - The Stripe payment intent ID
 * @returns Array of refunds associated with the payment intent
 */
export async function getRefundStatus(paymentIntentId: string): Promise<{
  hasRefunds: boolean;
  refunds: Array<{ id: string; amount: number; status: string; created: Date }>;
}> {
  try {
    const refunds = await stripe.refunds.list({
      payment_intent: paymentIntentId
    });

    return {
      hasRefunds: refunds.data.length > 0,
      refunds: refunds.data.map(r => ({
        id: r.id,
        amount: r.amount,
        status: r.status,
        created: new Date(r.created * 1000)
      }))
    };
  } catch (error) {
    console.error('[Stripe] Error getting refund status:', error);
    return {
      hasRefunds: false,
      refunds: []
    };
  }
}

// --- Old createPaymentIntent function (can be removed or kept for reference) ---
/*
export async function createPaymentIntent(items: PaymentItem[], shippingDetails: ShippingDetails): Promise<string> {
  // ... (previous implementation) ...
}
*/ 