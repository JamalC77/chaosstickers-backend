import { RequestHandler } from 'express';
import Stripe from 'stripe';
// Import Prisma namespace and client
import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../server'; // Assuming prisma client is exported from server.ts
import { createProduct, createOrder } from '../services/printifyService';
// Revert path for types import, assuming it's in src/types
import { ShippingDetails } from '../types';
// Import Resend
import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Ensure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are in your .env file
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export const stripeWebhookHandler: RequestHandler = async (req, res) => {
  // Add log at the very beginning
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
    const userId = session.metadata?.userId;
    const shippingDetailsString = session.metadata?.shipping_details;
    const imageUrl = session.metadata?.image_url;
    // Extract quantity from metadata
    const quantityString = session.metadata?.quantity; 
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    console.log(`[Webhook ${eventId}] Extracted - UserID: ${userId}, HasShipping: ${!!shippingDetailsString}, ImageURL: ${imageUrl}, Quantity: ${quantityString}, PI: ${paymentIntentId}`);

    // Validate required metadata, including quantity
    if (!userId || !shippingDetailsString || !imageUrl || !paymentIntentId || !quantityString) {
      console.error(`[Webhook ${eventId}] Validation Error: Missing required metadata (userId, shipping, imageUrl, paymentIntentId, quantity).`);
      return res.status(400).json({ error: 'Webhook Error: Missing required metadata.' });
    }

    // Parse quantity
    const quantity = parseInt(quantityString, 10);
    if (isNaN(quantity) || quantity < 1) {
        console.error(`[Webhook ${eventId}] Validation Error: Invalid quantity received (${quantityString}).`);
        return res.status(400).json({ error: 'Webhook Error: Invalid quantity.' });
    }

    try {
      console.log(`[Webhook ${eventId}] Parsing shipping details...`);
      const shippingAddress: ShippingDetails = JSON.parse(shippingDetailsString);
      console.log(`[Webhook ${eventId}] Shipping details parsed successfully.`);

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
      let appUser;
      try {
        console.log(`[Webhook ${eventId}] Finding or creating user for email: ${shippingAddress.email}`);
        appUser = await prisma.user.upsert({
          where: { email: shippingAddress.email },
          update: { 
            // Optionally update name or other details if user exists
            name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim()
          },
          create: {
            email: shippingAddress.email,
            name: `${shippingAddress.first_name} ${shippingAddress.last_name}`.trim(),
            // Add default values for any other required User fields
            // password: 'some_default_or_generated_password', // Example if password is required
          },
        });
        console.log(`[Webhook ${eventId}] User found/created with ID: ${appUser.id}`);
      } catch (userError: any) {
        console.error(`[Webhook ${eventId}] User find/create FAILED:`, userError);
        return res.status(500).json({ error: `Webhook processing failed: User handling error - ${userError.message}` });
      }
      // --- End Find or Create User ---

      // 1. Create Product in Printify
      console.log(`[Webhook ${eventId}] Creating Printify product for image: ${imageUrl}...`);
      let printifyProductId: string, printifyVariantId: number;
      try {
         const productResult = await createProduct(imageUrl);
         printifyProductId = productResult.productId;
         printifyVariantId = productResult.variantId;
         console.log(`[Webhook ${eventId}] Printify product created: ${printifyProductId}, Variant ID: ${printifyVariantId}`);
         if (!printifyVariantId) { 
            throw new Error(`Printify createProduct returned invalid variant ID for image ${imageUrl}`);
         }
      } catch (printifyProductError: any) {
          console.error(`[Webhook ${eventId}] Printify createProduct FAILED:`, printifyProductError);
          return res.status(500).json({ error: `Webhook processing failed: Printify product creation error - ${printifyProductError.message}` });
      }

      // 2. Create Order in Printify
      // Construct line_items using the correct structure (product_id, variant_id)
      const line_items: { product_id: string; variant_id: number; quantity: number }[] = [{
          product_id: printifyProductId, 
          variant_id: printifyVariantId, 
          quantity: quantity // Use extracted quantity
      }];
      console.log(`[Webhook ${eventId}] Creating Printify order with external_id: ${paymentIntentId}, lineItems:`, JSON.stringify(line_items));
      let printifyOrderId: string;
      try {
          // Call createOrder with CORRECT payload structure
          printifyOrderId = await createOrder({
            shippingAddress,
            external_id: paymentIntentId,
            line_items: line_items // Use the correctly structured items
          });
          console.log(`[Webhook ${eventId}] Printify order created: ${printifyOrderId}`);
      } catch (printifyOrderError: any) {
          console.error(`[Webhook ${eventId}] Printify createOrder FAILED:`, printifyOrderError);
          return res.status(500).json({ error: `Webhook processing failed: Printify order creation error - ${printifyOrderError.message}` });
      }

      // 3. Create Order in our Database
      console.log(`[Webhook ${eventId}] Saving order to database (PI: ${paymentIntentId})...`);
      let order;
      try {
          // Use CORRECT Prisma field names (productId, variantId)
          const orderItemData: Prisma.OrderItemUncheckedCreateWithoutOrderInput = {
              printifyProductId: printifyProductId,          
              printifyVariantId: printifyVariantId,        
              quantity: quantity, // Use extracted quantity                               
              imageUrl: imageUrl,
          };
          
          order = await prisma.order.create({
            data: {
              // Use the ID from the upserted user
              userId: appUser.id, 
              printifyOrderId,
              stripePaymentId: paymentIntentId,
              status: 'processing',
              items: {
                create: orderItemData, // Use the typed object
              },
            },
            include: {
              items: true,
            },
          });
          console.log(`[Webhook ${eventId}] Database order created with ID: ${order.id}`);
      } catch (dbError: any) {
          console.error(`[Webhook ${eventId}] Database order creation FAILED:`, dbError);
          // Critical error: Printify order likely exists, but DB save failed.
          // Return 500, but requires manual intervention or more robust error handling.
          return res.status(500).json({ error: `Webhook processing failed: Database error - ${dbError.message}` });
      }

      // ** Send Confirmation Email **
      console.log(`[Webhook ${eventId}] Attempting to send confirmation email for order ${order.id} to ${shippingAddress.email}`);
      try {
        const orderLink = `https://chaos-stickers.com/orders/${order.printifyOrderId}`;
        const emailHtml = `
          <h1>Thanks for your Chaos Stickers order, ${shippingAddress.first_name}!</h1>
          <p>Your order #${order.id} has been confirmed and is now being processed.</p>
          <p>Sticker Image:</p>
          <img src="${imageUrl}" alt="Your Sticker" width="100" /> 
          <p>You can check the status of your order here:</p>
          <a href="${orderLink}">${orderLink}</a>
          <p>We'll notify you again when it ships.</p>
        `;

        await resend.emails.send({
          from: 'orders@chaos-stickers.com', // Replace with your verified sending domain/email
          to: shippingAddress.email,
          subject: `Chaos Stickers Order Confirmation #${order.id}`,
          html: emailHtml,
        });
        console.log(`[Webhook ${eventId}] Confirmation email sent successfully to ${shippingAddress.email}`);
      } catch (emailError: any) {
        // Log email sending failure but don't fail the webhook processing
        console.error(`[Webhook ${eventId}] FAILED to send confirmation email to ${shippingAddress.email}:`, emailError);
        // Optionally, add more robust error handling like queuing the email for retry
      }
      // ** End Send Confirmation Email **

      // Acknowledge successful processing
      console.log(`[Webhook ${eventId}] Processing completed successfully.`);
      return res.status(200).json({ received: true, orderId: order.id });
    } catch (error: any) {
      // Corrected catch block for unexpected errors during processing
      console.error(`[Webhook ${eventId}] Unexpected error during processing:`, error);
      return res.status(500).json({ error: `Webhook processing failed unexpectedly: ${error.message}` });
    }
  } else {
    // Corrected handler for other event types
    console.log(`[Webhook] Received unhandled event type: ${event.type}`);
    return res.status(200).json({ received: true, message: `Unhandled event type: ${event.type}` });
  }
};
