import { RequestHandler } from 'express';
import Stripe from 'stripe';
// Import Prisma namespace and client
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../server'; // Assuming prisma client is exported from server.ts
import { createProduct, createOrder } from '../services/printifyService';
// Revert path for types import, assuming it's in src/types
// Assuming ShippingDetails might be defined elsewhere or inline if not used broadly
// import { ShippingDetails } from '../types'; 
import { Resend } from 'resend';

// Define ShippingDetails inline if not imported
interface ShippingDetails {
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
}

// Define the structure of items expected from metadata
interface OrderItemMetadata {
    id: number; // Expect numeric DB ID from metadata
    // imageUrl: string; // REMOVED - Will be fetched from DB
    quantity: number;
    // Add fields for Printify IDs after processing
    printifyProductId?: string;
    printifyVariantId?: number;
    // Add fetched imageUrl
    imageUrl?: string;
}

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Ensure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are in your .env file
// ... (Stripe initialization remains the same)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  // ... (Signature verification remains the same)
  console.log('[Webhook] Received request'); 
  
  if (!webhookSecret) {
    console.error('[Webhook] Stripe webhook secret is not configured.');
    return res.status(500).send('Webhook Error: Server configuration error');
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  console.log('[Webhook] Attempting signature verification...');
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`[Webhook] Signature verified. Event ID: ${event.id}, Type: ${event.type}`);
  } catch (err: any) {
    console.error(`[Webhook] Signature verification failed: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const eventId = event.id; // Keep event ID for logging

    console.log(`[Webhook ${eventId}] Processing checkout.session.completed for session: ${session.id}`);

    // Log raw metadata
    console.log(`[Webhook ${eventId}] Raw Metadata:`, JSON.stringify(session.metadata)); 

    // Extract metadata
    // const userIdString = session.metadata?.userId; // REMOVED - Not sent anymore
    const shippingDetailsString = session.metadata?.shipping_details;
    const itemsString = session.metadata?.items; // Get items JSON string
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    // console.log(`[Webhook ${eventId}] Extracted - UserID: ${userIdString}, HasShipping: ${!!shippingDetailsString}, HasItems: ${!!itemsString}, PI: ${paymentIntentId}`); // Updated log
    console.log(`[Webhook ${eventId}] Extracted - HasShipping: ${!!shippingDetailsString}, HasItems: ${!!itemsString}, PI: ${paymentIntentId}`); // Updated log

    // Validate required metadata
    // if (!userIdString || !shippingDetailsString || !itemsString || !paymentIntentId) { // REMOVED userIdString check
    if (!shippingDetailsString || !itemsString || !paymentIntentId) { 
      // console.error(`[Webhook ${eventId}] Validation Error: Missing required metadata (userId, shipping_details, items, paymentIntentId).`); // Updated log
      console.error(`[Webhook ${eventId}] Validation Error: Missing required metadata (shipping_details, items, paymentIntentId).`); // Updated log
      return res.status(400).json({ error: 'Webhook Error: Missing required metadata.' });
    }

    // Parse userId - REMOVED
    /*
    const userId = parseInt(userIdString, 10);
    if (isNaN(userId)) {
        console.error(`[Webhook ${eventId}] Validation Error: Invalid userId received (${userIdString}).`);
        return res.status(400).json({ error: 'Webhook Error: Invalid user ID.' });
    }
    */

    let shippingAddress: ShippingDetails;
    let items: OrderItemMetadata[];

    try {
      console.log(`[Webhook ${eventId}] Parsing shipping details and items...`);
      shippingAddress = JSON.parse(shippingDetailsString);
      items = JSON.parse(itemsString);

      // Validate parsed items array
      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Parsed items metadata is not a valid non-empty array.');
      }
      // Basic validation of item structure (can be enhanced)
      items.forEach((item, index) => {
        if (!item ||
            typeof item.id !== 'number' || // Validate numeric ID
            // !item.imageUrl || // REMOVED check for imageUrl
            !item.quantity ||
            typeof item.quantity !== 'number' || // Ensure quantity is number
            item.quantity < 1
           ) {
          throw new Error(`Invalid structure, type (id should be number), or quantity for item at index ${index}.`);
        }
        // Ensure quantity is an integer
        item.quantity = Math.floor(item.quantity);
      });

      console.log(`[Webhook ${eventId}] Shipping and items parsed successfully. Items count: ${items.length}`);

    } catch (parseError: any) {
      console.error(`[Webhook ${eventId}] Metadata Parsing Error: ${parseError.message}`);
      return res.status(400).json({ error: `Webhook Error: Invalid metadata format - ${parseError.message}` });
    }

    try {
        // Idempotency check
        console.log(`[Webhook ${eventId}] Checking for existing order with PI: ${paymentIntentId}...`);
        const existingOrder = await prisma.order.findFirst({
          where: { stripePaymentId: paymentIntentId }
        });
        if (existingOrder) {
          console.log(`[Webhook ${eventId}] Order for PI ${paymentIntentId} already processed (DB ID: ${existingOrder.id}). Skipping.`);
          return res.status(200).json({ received: true, message: 'Order already processed' });
        }
        console.log(`[Webhook ${eventId}] No existing order found. Proceeding...`);

        // --- Find or Create User by Email --- 
        // (Keep existing user upsert logic)
        let appUser;
        try {
          console.log(`[Webhook ${eventId}] Finding or creating user for email: ${shippingAddress.email}`);
          appUser = await prisma.user.upsert({
            where: { email: shippingAddress.email },
            update: { 
              name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim()
            },
            create: {
              email: shippingAddress.email,
              name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim(),
            },
          });
          console.log(`[Webhook ${eventId}] User found/created with ID: ${appUser.id}`);
        } catch (userError: any) {
          console.error(`[Webhook ${eventId}] User find/create FAILED:`, userError);
          return res.status(500).json({ error: `Webhook processing failed: User handling error - ${userError.message}` });
        }

        // --- Fetch Image URLs from Database ---
        console.log(`[Webhook ${eventId}] Fetching image URLs for ${items.length} items...`);
        try {
            const itemIds = items.map(item => item.id);
            const images = await prisma.generatedImage.findMany({
                where: {
                    id: { in: itemIds }
                },
                select: { id: true, imageUrl: true, noBackgroundUrl: true, hasRemovedBackground: true } // Select URLs
            });

            // Create a map for quick lookup
            const imageUrlMap = new Map<number, string>();
            images.forEach(img => {
                // Prefer noBackgroundUrl if available, otherwise use original imageUrl
                const urlToUse = img.hasRemovedBackground && img.noBackgroundUrl ? img.noBackgroundUrl : img.imageUrl;
                if (urlToUse) { // Ensure we have a valid URL
                    imageUrlMap.set(img.id, urlToUse);
                } else {
                     console.warn(`[Webhook ${eventId}] Image ID ${img.id} found but has no valid imageUrl or noBackgroundUrl.`);
                     // Decide how to handle this - throw error or skip? For now, we'll throw later if needed.
                }
            });

            // Populate items with fetched URLs
            items.forEach(item => {
                const fetchedUrl = imageUrlMap.get(item.id);
                if (!fetchedUrl) {
                    throw new Error(`Image URL not found in database for item ID: ${item.id}`);
                }
                item.imageUrl = fetchedUrl;
            });
            console.log(`[Webhook ${eventId}] Image URLs fetched and assigned successfully.`);

        } catch (imageFetchError: any) {
            console.error(`[Webhook ${eventId}] Image URL fetch FAILED:`, imageFetchError);
            return res.status(500).json({ error: `Webhook processing failed: Database error fetching image URLs - ${imageFetchError.message}` });
        }

        // 1. Create Printify Products for EACH item
        console.log(`[Webhook ${eventId}] Creating Printify products for ${items.length} items...`);
        try {
          // Use Promise.all to create products concurrently
          await Promise.all(items.map(async (item) => {
              // Ensure imageUrl was fetched before proceeding
              if (!item.imageUrl) {
                 throw new Error(`Missing image URL for item ID ${item.id} before creating Printify product.`);
              }
              console.log(`[Webhook ${eventId}] Creating Printify product for item ID: ${item.id}, Image: ${item.imageUrl}`); // Use fetched URL
              const productResult = await createProduct(item.imageUrl); // Use fetched URL
              if (!productResult || !productResult.productId || !productResult.variantId) {
                  throw new Error(`Failed to create Printify product or received invalid IDs for item ${item.id} (Image: ${item.imageUrl})`); // Use fetched URL
              }
              item.printifyProductId = productResult.productId;
              item.printifyVariantId = productResult.variantId;
              console.log(`[Webhook ${eventId}] Printify product created for item ID: ${item.id} -> Product: ${item.printifyProductId}, Variant: ${item.printifyVariantId}`);
          }));
          console.log(`[Webhook ${eventId}] All Printify products created successfully.`);
        } catch (printifyProductError: any) {
            console.error(`[Webhook ${eventId}] Printify createProduct FAILED:`, printifyProductError);
            // If any product creation fails, we stop processing this order.
            return res.status(500).json({ error: `Webhook processing failed: Printify product creation error - ${printifyProductError.message}` });
        }

        // 2. Create ONE Order in Printify with multiple line items
        const printifyLineItems = items.map(item => {
            if (!item.printifyProductId || !item.printifyVariantId) {
                // This should ideally not happen if the previous step succeeded
                throw new Error(`Missing Printify IDs for item ${item.id} before creating Printify order.`);
            }
            return {
                product_id: item.printifyProductId, 
                variant_id: item.printifyVariantId, 
                quantity: item.quantity
            };
        });

        console.log(`[Webhook ${eventId}] Creating Printify order with external_id: ${paymentIntentId}, ${printifyLineItems.length} line items...`);
        let printifyOrderId: string;
        try {
            printifyOrderId = await createOrder({
                shippingAddress,
                external_id: paymentIntentId, // Use payment intent ID for idempotency/linking
                line_items: printifyLineItems 
            });
            console.log(`[Webhook ${eventId}] Printify order created: ${printifyOrderId}`);
        } catch (printifyOrderError: any) {
            console.error(`[Webhook ${eventId}] Printify createOrder FAILED:`, printifyOrderError);
            return res.status(500).json({ error: `Webhook processing failed: Printify order creation error - ${printifyOrderError.message}` });
        }

        // 3. Create Order and OrderItems in our Database
        console.log(`[Webhook ${eventId}] Saving order to database (PI: ${paymentIntentId})...`);
        let order;
        try {
            // Prepare OrderItem data for Prisma createMany
            const orderItemsData: Prisma.OrderItemCreateManyOrderInput[] = items.map(item => {
                 if (!item.printifyProductId || !item.printifyVariantId) {
                    throw new Error(`Missing Printify IDs for item ${item.id} before saving to DB.`);
                 }
                 // Ensure imageUrl was fetched
                 if (!item.imageUrl) {
                    throw new Error(`Missing image URL for item ${item.id} before saving OrderItem to DB.`);
                 }
                return {
                    printifyProductId: item.printifyProductId,
                    printifyVariantId: item.printifyVariantId,
                    quantity: item.quantity,
                    imageUrl: item.imageUrl, // Use fetched URL
                    // Add original frontend item ID if schema supports it
                    // originalGeneratedImageId: item.id // Could store the original DB ID here
                };
            });
          
            order = await prisma.order.create({
                data: {
                    userId: appUser.id, 
                    printifyOrderId, 
                    stripePaymentId: paymentIntentId,
                    status: 'processing', // Initial status after payment
                    // Use createMany for items
                    items: {
                        createMany: {
                            data: orderItemsData,
                        },
                    },
                     // Store shipping details directly on the order
                    shippingFirstName: shippingAddress.first_name,
                    shippingLastName: shippingAddress.last_name,
                    shippingEmail: shippingAddress.email,
                    shippingPhone: shippingAddress.phone,
                    shippingCountry: shippingAddress.country,
                    shippingRegion: shippingAddress.region,
                    shippingAddress1: shippingAddress.address1,
                    shippingAddress2: shippingAddress.address2 || null,
                    shippingCity: shippingAddress.city,
                    shippingZip: shippingAddress.zip,
                },
                include: {
                    items: true, // Include items in the returned object
                },
            });
            console.log(`[Webhook ${eventId}] Database order created with ID: ${order.id} including ${order.items.length} items.`);
        } catch (dbError: any) {
            console.error(`[Webhook ${eventId}] Database order creation FAILED:`, dbError);
            return res.status(500).json({ error: `Webhook processing failed: Database error - ${dbError.message}` });
        }

        // ** Send Confirmation Email **
        console.log(`[Webhook ${eventId}] Attempting to send confirmation email for order ${order.id} to ${shippingAddress.email}`);
        try {
            const orderLink = process.env.FRONTEND_URL 
                ? `${process.env.FRONTEND_URL}/orders/${order.printifyOrderId}` // Link to Printify order ID
                : `http://localhost:3000/orders/${order.printifyOrderId}`;
            
            // Generate HTML for multiple items
            const itemsHtml = items.map(item => {
                 // Ensure imageUrl was fetched
                 if (!item.imageUrl) {
                    console.error(`[Webhook ${eventId}] Missing image URL for item ${item.id} when generating email HTML.`);
                    return `<div>Error displaying item ${item.id}</div>`; // Fallback HTML
                 }
                 return `
                <div style="margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                    <img src="${item.imageUrl}" alt="Sticker" width="80" style="vertical-align: middle; margin-right: 10px;" />
                    <span>ID: ${item.id}</span>
                    <span>Quantity: ${item.quantity}</span>
                </div>
            `}).join('');

            const emailHtml = `
                <h1>Thanks for your ChaosStickers order, ${shippingAddress.first_name}!</h1>
                <p>Your order #${order.id} has been confirmed and is now being processed.</p>
                <h2>Order Summary:</h2>
                ${itemsHtml}
                <p>You can check the status of your order here:</p>
                <a href="${orderLink}">${orderLink}</a>
                <p>We'll notify you again when it ships.</p>
            `;

            await resend.emails.send({
                from: 'orders@chaos-stickers.com', // Replace with your verified sending domain/email
                to: shippingAddress.email,
                subject: `ChaosStickers Order Confirmation #${order.id}`,
                html: emailHtml,
            });
            console.log(`[Webhook ${eventId}] Confirmation email sent successfully to ${shippingAddress.email}`);
        } catch (emailError: any) {
            console.error(`[Webhook ${eventId}] FAILED to send confirmation email to ${shippingAddress.email}:`, emailError);
        }

        // Acknowledge successful processing
        console.log(`[Webhook ${eventId}] Processing completed successfully.`);
        return res.status(200).json({ received: true, orderId: order.id });
    } catch (error: any) {
        console.error(`[Webhook ${eventId}] Unexpected error during processing:`, error);
        return res.status(500).json({ error: `Webhook processing failed unexpectedly: ${error.message}` });
    }
  } else {
    console.log(`[Webhook] Received unhandled event type: ${event.type}`);
    return res.status(200).json({ received: true, message: `Unhandled event type: ${event.type}` });
  }
};
