import { RequestHandler } from 'express';
import { createProduct, createOrder, getOrderStatus, getAvailableStickerProducts, getShopInfo } from '../services/printifyService';
import { prisma } from '../server'; // Import prisma client instance
import { Prisma } from '@prisma/client';
import { generateImage } from '../services/googleGenAIService';
import { saveGeneratedImage } from '../services/databaseService';
import { removeBackground } from '../services/backgroundRemovalService';
import Stripe from 'stripe'; // Import Stripe

// Initialize Stripe client (reuse from webhookController or create instance)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

export const createOrderController: RequestHandler = async (req, res) => {
  try {
    // Destructure new expected fields: productId, variantId, quantity
    // Keep selectedImageUrl for DB storage
    const { paymentId, shippingAddress, selectedImageUrl, userId, productId, variantId, quantity } = req.body;

    // Update validation to check for new required fields
    if (!paymentId || !shippingAddress || !selectedImageUrl || !userId || !productId || !variantId || !quantity) {
      return res.status(400).json({ error: 'Missing required fields (paymentId, shippingAddress, selectedImageUrl, userId, productId, variantId, quantity)' });
    }

    // Ensure quantity and variantId are numbers
    const parsedQuantity = parseInt(quantity);
    const parsedVariantId = parseInt(variantId);
    if (isNaN(parsedQuantity) || isNaN(parsedVariantId)) {
      return res.status(400).json({ error: 'Invalid quantity or variantId format.'});
    }

    // Prepare line items for the existing product
    const lineItems = [
      {
        product_id: productId, // Use productId from request
        variant_id: parsedVariantId,
        quantity: parsedQuantity,
      },
    ];

    // Create an order in Printify using the updated service function
    const printifyOrderId = await createOrder({
      line_items: lineItems,
      shippingAddress,
      // external_id: `user-${userId}-payment-${paymentId}` // Optional
    });

    // Create the order in our database
    const order = await prisma.order.create({
      data: {
        userId: parseInt(userId),
        printifyOrderId,
        stripePaymentId: paymentId,
        status: 'pending',
        items: {
          create: {
            printifyProductId: productId,          // Correct field name (String)
            printifyVariantId: parsedVariantId,    // Correct field name (Int)
            quantity: parsedQuantity,
            imageUrl: selectedImageUrl,
          } as Prisma.OrderItemUncheckedCreateWithoutOrderInput,
        },
      },
      include: {
        items: true,
      },
    });

    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error in createOrderController:', error);
    return res.status(500).json({ error: 'Failed to create order' });
  }
}

// Handle Printify webhooks for order status updates
export const printifyWebhookController: RequestHandler = async (req, res) => {
  try {
    // Verify webhook signature (in production, implement proper signature verification)
    // const signature = req.headers['x-printify-signature'];
    
    const { event, data } = req.body;
    
    if (event === 'order:status-changed' && data && data.id) {
      // Find the order in our database
      const order = await prisma.order.findFirst({
        where: {
          printifyOrderId: data.id
        }
      });
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Update the order status in our database
      await prisma.order.update({
        where: {
          id: order.id
        },
        data: {
          status: data.status
        }
      });
      
      // You could also send email notifications to the customer here
      
      return res.status(200).json({ success: true });
    }
    
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in printifyWebhookController:', error);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}

// Get order status
export const getOrderStatusController: RequestHandler = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Validate orderId is a number
    const numericOrderId = parseInt(orderId, 10);
    if (isNaN(numericOrderId)) {
      return res.status(400).json({ error: 'Invalid Order ID format. Must be a number.' });
    }
    
    // Get the order from our database using the validated ID
    const order = await prisma.order.findUnique({
      where: {
        id: numericOrderId // Use the parsed numeric ID
      },
      include: {
        items: true
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Get the latest status from Printify
    if (!order.printifyOrderId) {
      return res.status(400).json({ error: 'Order has no Printify ID' });
    }
    
    const printifyStatus = await getOrderStatus(order.printifyOrderId);
    
    // Update our database if the status changed
    if (printifyStatus !== order.status) {
      await prisma.order.update({
        where: {
          id: order.id
        },
        data: {
          status: printifyStatus
        }
      });
      order.status = printifyStatus; // Update actual order status
    }
    
    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error in getOrderStatusController:', error);
    return res.status(500).json({ error: 'Failed to get order status' });
  }
}

// Test Printify integration without payment
export const testPrintifyIntegrationController: RequestHandler = async (req, res) => {
  try {
    const { shippingAddress, selectedImageUrl, userId } = req.body;

    if (!shippingAddress || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get environment variables for debug purposes
    const shopId = process.env.PRINTIFY_SHOP_ID || 'Not set';
    const apiKey = process.env.PRINTIFY_API_KEY ? 'Set (hidden for security)' : 'Not set';
    const apiUrl = process.env.PRINTIFY_API_URL || 'https://api.printify.com/v1';

    console.log('Testing Printify integration with:');
    console.log('- API URL:', apiUrl);
    console.log('- Shop ID:', shopId);
    console.log('- API Key Set:', !!process.env.PRINTIFY_API_KEY);

    try {
      // Step 1: Create a product using a test image
      const testImage = selectedImageUrl || 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg';
      console.log('Creating product with image:', testImage);
      
      // This test still needs createProduct
      const productResult = await createProduct(testImage);
      console.log('Product created:', productResult);

      // Step 2: Create a test order using the newly created product
      // Update call to createOrder to use line_items
      const printifyOrderId = await createOrder({
        line_items: [
          {
            product_id: productResult.productId,
            variant_id: productResult.variantId,
            quantity: 1
          }
        ],
        shippingAddress,
      });
      console.log('Order created with ID:', printifyOrderId);

      // Step 3: Create the order record in our database (mocked section)
      const mockOrder = {
          id: Date.now(),
          userId: parseInt(userId),
          printifyOrderId,
          stripePaymentId: 'test-payment-id-' + Date.now(),
          status: 'pending',
          items: [{ printifyProductId: productResult.productId, printifyVariantId: productResult.variantId, quantity: 1, imageUrl: testImage }]
      };

      return res.status(200).json({ 
        order: mockOrder, // Return mock data
        message: 'Test order created successfully',
        note: printifyOrderId.startsWith('mock') 
          ? 'This was a mock order (Printify API was not used)' 
          : 'Real Printify order was created'
      });
    } catch (error) {
      // Return detailed error info for debugging
      return res.status(500).json({ 
        error: 'Failed to create test order',
        details: error instanceof Error ? error.message : String(error),
        configInfo: {
          shopId,
          apiKey,
          apiUrl
        }
      });
    }
  } catch (error) {
    console.error('Error in testPrintifyIntegrationController:', error);
    return res.status(500).json({ error: 'Failed to create test order' });
  }
};

// Debug endpoint to validate Printify configuration
export const debugPrintifyController: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.PRINTIFY_API_KEY;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    
    if (!apiKey || !shopId) {
      return res.status(500).json({ 
        error: 'Printify configuration incomplete',
        apiKeySet: !!apiKey,
        shopIdSet: !!shopId
      });
    }
    
    // Try to fetch shop info first to test the API connection
    try {
      const shopInfo = await getShopInfo();
      
      // If that succeeded, try to get available sticker products
      try {
        const blueprints = await getAvailableStickerProducts();
        return res.status(200).json({
          success: true,
          message: 'Printify API connection successful',
          shopInfo,
          shopId,
          apiKeyValid: true,
          blueprints
        });
      } catch (blueprintError) {
        // If getting blueprints failed but shop info worked, still success
        return res.status(200).json({
          success: true,
          message: 'Printify API connection successful, but error fetching blueprints',
          shopInfo,
          shopId,
          apiKeyValid: true,
          blueprintError: blueprintError instanceof Error ? blueprintError.message : String(blueprintError)
        });
      }
    } catch (apiError) {
      return res.status(500).json({
        error: 'Printify API connection failed',
        details: apiError instanceof Error ? apiError.message : String(apiError),
        shopId,
        apiKeySet: true
      });
    }
  } catch (error) {
    console.error('Error in debugPrintifyController:', error);
    return res.status(500).json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Test product creation with specific catalog IDs
export const testProductCreationController: RequestHandler = async (req, res) => {
  try {
    // Test image that should work with Printify
    const testImageUrl = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=800&q=60';
    
    // Get API details first
    const apiKey = process.env.PRINTIFY_API_KEY;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    
    if (!apiKey || !shopId) {
      return res.status(500).json({ 
        error: 'Printify configuration incomplete',
        apiKeySet: !!apiKey,
        shopIdSet: !!shopId
      });
    }
    
    // First try to validate shop info
    let validShopInfo;
    try {
      validShopInfo = await getShopInfo();
      // If we reach here, the auth worked and we have shop(s)
      
      // Now try product creation
      try {
        // Create a test product
        const productId = await createProduct(testImageUrl);
        
        return res.status(200).json({
          success: true,
          message: 'Test product created successfully',
          productId,
          shopInfo: validShopInfo
        });
      } catch (productError) {
        return res.status(500).json({
          error: 'Product creation failed',
          details: productError instanceof Error ? productError.message : String(productError),
          shopInfo: validShopInfo,
          apiKeyValid: true
        });
      }
      
    } catch (shopError) {
      return res.status(500).json({
        error: 'Shop validation failed',
        details: shopError instanceof Error ? shopError.message : String(shopError),
        apiKeySet: !!apiKey,
        shopIdSet: !!shopId
      });
    }
  } catch (error) {
    console.error('Error in testProductCreationController:', error);
    return res.status(500).json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Get Printify catalog information
export const getPrintifyCatalogController: RequestHandler = async (req, res) => {
  try {
    const apiKey = process.env.PRINTIFY_API_KEY;
    const shopId = process.env.PRINTIFY_SHOP_ID;
    
    if (!apiKey || !shopId) {
      return res.status(500).json({ 
        error: 'Printify configuration incomplete',
        apiKeySet: !!apiKey,
        shopIdSet: !!shopId
      });
    }
    
    // Try to get shop info first
    try {
      const shopInfo = await getShopInfo();
      
      // Now get the blueprint catalog
      try {
        console.log("Getting detailed blueprint catalog");
        const response = await fetch(`${process.env.PRINTIFY_API_URL || 'https://api.printify.com/v1'}/catalog/blueprints.json`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          return res.status(500).json({
            error: 'Failed to fetch blueprints',
            details: errorText,
            shopInfo
          });
        }
        
        const blueprints = await response.json();
        
        // Find sticker blueprints specifically
        const stickerBlueprints = blueprints.filter((blueprint: any) => 
          blueprint.title.toLowerCase().includes('sticker') || 
          blueprint.title.toLowerCase().includes('decal')
        );
        
        return res.status(200).json({
          success: true,
          message: 'Printify catalog fetched successfully',
          shopInfo,
          allBlueprintCount: blueprints.length,
          stickerBlueprints,
          sampleBlueprints: blueprints.slice(0, 5) // Just the first 5 as examples
        });
      } catch (catalogError) {
        return res.status(500).json({
          error: 'Catalog fetching failed',
          details: catalogError instanceof Error ? catalogError.message : String(catalogError),
          shopInfo
        });
      }
    } catch (shopError) {
      return res.status(500).json({
        error: 'Shop validation failed',
        details: shopError instanceof Error ? shopError.message : String(shopError)
      });
    }
  } catch (error) {
    console.error('Error in getPrintifyCatalogController:', error);
    return res.status(500).json({ 
      error: 'Failed to get Printify catalog', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Test basic Printify API access
export const testBasicPrintifyAccessController: RequestHandler = async (req, res) => {
  try {
    // Access a simple endpoint that should always work
    const PRINTIFY_API_URL = process.env.PRINTIFY_API_URL || 'https://api.printify.com/v1';
    const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY || '';
    
    console.log('Testing basic API access with catalog endpoint...');
    
    // Test the catalog endpoint which is a simple GET request
    const response = await fetch(`${PRINTIFY_API_URL}/catalog/blueprints`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        error: 'Basic API access failed',
        status: response.status,
        details: errorText
      });
    }
    
    // If catalog works, test shops endpoint
    const shopsResponse = await fetch(`${PRINTIFY_API_URL}/shops`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const shopsData = await shopsResponse.json();
    
    if (!shopsResponse.ok) {
      return res.status(500).json({
        error: 'Shops API access failed',
        catalogSuccess: true,
        status: shopsResponse.status,
        details: await shopsResponse.text()
      });
    }
    
    // If we have shops, test the first one
    if (Array.isArray(shopsData) && shopsData.length > 0) {
      const shopId = shopsData[0].id;
      
      // Test product access
      const productsResponse = await fetch(`${PRINTIFY_API_URL}/shops/${shopId}/products`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Return our full access test results
      return res.status(200).json({
        success: true,
        message: 'Basic API access test successful',
        catalogAccess: true,
        shopsAccess: true,
        firstShop: shopsData[0],
        productsAccess: productsResponse.ok,
        productsStatus: productsResponse.status,
        productsResult: productsResponse.ok ? await productsResponse.json() : null
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'API access test partially successful',
      catalogAccess: true,
      shopsAccess: true,
      shopsData,
      note: 'No shops found to test products access'
    });
    
  } catch (error) {
    console.error('Error in testBasicPrintifyAccessController:', error);
    return res.status(500).json({ 
      error: 'API access test failed', 
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Test creating an external order with Printify (bypasses product creation)
export const testExternalOrderController: RequestHandler = async (req, res) => {
  try {
    const { shippingAddress, userId } = req.body;

    if (!shippingAddress || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
      // The createOrder function now requires line_items, 
      // so this external order test needs mock product/variant IDs.
      // It cannot directly call createOrder without them.
      const mockProductId = 'mock-external-product-id';
      const mockVariantId = 99999;

      const printifyOrderId = await createOrder({
        shippingAddress,
        line_items: [
            {
                product_id: mockProductId,
                variant_id: mockVariantId,
                quantity: 1
            }
        ]
      });

      // Create the order in our database
      const order = await prisma.order.create({
        data: {
          userId: parseInt(userId),
          printifyOrderId,
          stripePaymentId: 'test-external-order-' + Date.now(),
          status: 'pending',
          items: {
            create: {
              printifyProductId: mockProductId,        // Correct field name (String)
              printifyVariantId: mockVariantId,       // Correct field name (Int)
              quantity: 1,
              imageUrl: 'no-image-needed',
            } as Prisma.OrderItemUncheckedCreateWithoutOrderInput,
          },
        },
        include: {
          items: true,
        },
      });

      return res.status(200).json({ 
        order,
        message: 'External order created successfully',
        note: 'This order bypasses the product/image upload process'
      });
    } catch (error) {
      return res.status(500).json({ 
        error: 'Failed to create external order',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  } catch (error) {
    console.error('Error in testExternalOrderController:', error);
    return res.status(500).json({ error: 'Failed to create external order' });
  }
};

// Create a fully mocked order (no Printify API calls)
export const createMockOrderController: RequestHandler = async (req, res) => {
  try {
    const { shippingAddress, selectedImageUrl, userId } = req.body;

    if (!shippingAddress || !selectedImageUrl || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate mock IDs
    const mockPrintifyOrderId = `mock-printify-${Date.now()}`;
    const mockProductId = `mock-product-${Date.now()}`;
    const mockVariantId = -1;
    
    console.log('Creating fully mocked order with:', {
      shippingAddress,
      imageUrl: selectedImageUrl,
      mockPrintifyOrderId,
      mockProductId
    });

    // Create a record in our database
    const order = await prisma.order.create({
      data: {
        userId: parseInt(userId),
        printifyOrderId: mockPrintifyOrderId,
        stripePaymentId: 'simulated-payment-' + Date.now(),
        status: 'pending',
        items: {
          create: {
            printifyProductId: mockProductId,        // Correct field name (String)
            printifyVariantId: mockVariantId, // Correct field name (Int)
            quantity: 1,
            imageUrl: selectedImageUrl,
          } as Prisma.OrderItemUncheckedCreateWithoutOrderInput,
        },
      },
      include: {
        items: true,
      },
    });

    return res.status(200).json({ 
      order,
      message: 'Mock order created successfully',
      note: 'This is a fully simulated order - no Printify API calls were made'
    });
  } catch (error) {
    console.error('Error creating mock order:', error);
    return res.status(500).json({ 
      error: 'Failed to create mock order',
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Generate an image, remove its background, upload transparent version to ImgBB, 
 * and use it to create a product in Printify
 */
export const generateImageAndCreateProductController: RequestHandler = async (req, res) => {
  const { prompt, userId = null } = req.body; // Allow optional userId

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Simple hardcoded prefix for testing (replace if needed)
  const PROMPT_PREFIX = `
    This is for a service called ChaosStickers.
    Sticker illustration of a [INSERT_USER_PROMPT] with:
    • A thick white outline surrounding the entire design
    • Bright, vibrant colors that pop
    • A simplified, cartoonish style
    • A fun, whimsical, modern, cute tone
    • Bold, high-contrast details
    • Focus on the main subject only, making it easy to cut out
    • No background: solid white or transparent only

    Absolutely DO NOT include:
    • No text, logos, brand names, or watermarks
    • No color swatches, color bars, or palette references
    • No rulers, cutting mats, measurement lines, or design tool interfaces
    • No mockups, no multi-sticker sheets, no other objects in the scene
    • No shadows or reflections on any surface
    • No additional decorative shapes or backgrounds

    Goal:
    Produce exactly one single, die-cut sticker design for ChaosStickers.
    Only the main subject + thick white border + plain background.
    Nothing else. No environment. No design references or materials.
  `;
  const enhancedPrompt = PROMPT_PREFIX.replace('[INSERT_USER_PROMPT]', prompt);

  try {
    console.log(`[generateImageAndCreateProductController] Generating image for prompt: ${prompt}`);
    // 1. Generate image using the Google service (returns base64)
    const base64ImageData = await generateImage(enhancedPrompt);
    console.log(`[generateImageAndCreateProductController] Image generated (base64 received)`);
    
    // 2. Convert base64 to Buffer
    const imageBuffer = Buffer.from(base64ImageData, 'base64');
    
    // 3. Remove background and upload transparent result to ImgBB
    const finalImageUrl = await removeBackground(imageBuffer);
    console.log(`[generateImageAndCreateProductController] Background removed and uploaded to ImgBB: ${finalImageUrl}`);

    // 4. Save the final ImgBB URL (transparent image) to the database
    const savedImage = await saveGeneratedImage(prompt, finalImageUrl, userId || undefined);
    console.log(`[generateImageAndCreateProductController] Final ImgBB URL saved to DB (ID: ${savedImage.id})`);

    // 5. Create a product in Printify using the final ImgBB URL
    console.log(`[generateImageAndCreateProductController] Creating Printify product with final ImgBB URL...`);
    // This controller still needs createProduct
    const { productId: printifyProductIdResult, variantId: printifyVariantIdResult } = await createProduct(finalImageUrl);
    console.log(`[generateImageAndCreateProductController] Printify product created (ID: ${printifyProductIdResult}, Variant: ${printifyVariantIdResult})`);

    return res.status(200).json({ 
      success: true,
      message: 'Image generated, background removed, uploaded, and product created successfully',
      imageUrl: finalImageUrl, // Return the final ImgBB URL
      imageId: savedImage.id.toString(),
      printifyProductId: printifyProductIdResult,
      printifyVariantId: printifyVariantIdResult,
    });

  } catch (error) {
    console.error('Error in generateImageAndCreateProductController:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate image and create product';
    return res.status(500).json({ 
        error: 'Failed to generate image and create product',
        details: errorMessage
    });
  }
};

// --- NEW CONTROLLER for Confirmation Page ---
export const confirmAndFetchOrderController: RequestHandler = async (req, res) => {
  const { sessionId } = req.query;
  const MAX_POLL_RETRIES = 7;
  const POLL_DELAY = 3000; // milliseconds (increased from 1500)

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid session_id query parameter' });
  }

  try {
    // 1. Retrieve the Stripe Checkout Session to get Payment Intent ID
    console.log(`[Confirm] Fetching Stripe session: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

    if (!paymentIntentId) {
      console.error(`[Confirm] No payment_intent found for session: ${sessionId}`);
      return res.status(404).json({ error: 'Payment information not found for this session.' });
    }
    console.log(`[Confirm] Found Payment Intent ID: ${paymentIntentId}`);

    // 2. Poll the database for the order created by the webhook
    let order = null;
    for (let i = 0; i < MAX_POLL_RETRIES; i++) {
      console.log(`[Confirm] Polling DB for order with PI: ${paymentIntentId} (Attempt ${i + 1}/${MAX_POLL_RETRIES})`);
      order = await prisma.order.findFirst({
        where: { stripePaymentId: paymentIntentId },
        include: {
          items: true,
          user: { select: { name: true, email: true } }
        },
      });

      if (order) {
        console.log(`[Confirm] Order found in DB: ${order.id}`);
        break; // Exit loop if order is found
      }

      // If order not found and more retries left, wait
      if (i < MAX_POLL_RETRIES - 1) {
        console.log(`[Confirm] Order not found yet, waiting ${POLL_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, POLL_DELAY));
      }
    }

    // 3. Check if order was found after polling
    if (!order) {
      console.error(`[Confirm] Order with PI: ${paymentIntentId} not found after ${MAX_POLL_RETRIES} attempts.`);
      return res.status(404).json({ error: 'Order processing is delayed or failed. Please check back later or contact support.' });
    }

    // 4. Return the found order details
    console.log(`[Confirm] Returning order ${order.id} details.`);
    return res.status(200).json({ order });

  } catch (error: any) {
    console.error(`[Confirm] Error fetching/confirming order for session ${sessionId}:`, error);
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Invalid session ID provided.' });
    }
    return res.status(500).json({ error: 'Failed to retrieve order details' });
  }
};

// Remove or comment out the old getOrderBySessionIdController if no longer needed
// export const getOrderBySessionIdController: RequestHandler = async (req, res) => { ... };

// ... rest of the file ... 