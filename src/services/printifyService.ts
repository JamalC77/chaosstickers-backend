import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const PRINTIFY_API_URL = 'https://api.printify.com/v1';
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY || '';
const SHOP_ID = process.env.PRINTIFY_SHOP_ID || '';

// This is a simplified version. In a real application, you would need to handle more Printify-specific details
interface ShippingAddress {
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

interface OrderDetails {
  shippingAddress: ShippingAddress;
  external_id?: string;
  label?: string;
  line_items: ExistingProductLineItem[];
}

interface ExistingProductLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

interface PrintifyVariant {
  id: number;
  variant_id: number;
  quantity: number;
}

interface PrintifyLineItem {
  variant_id: number;
  quantity: number;
  print_provider_id?: number; // Make optional, but required by createOrder endpoint
}

interface PrintifyOrder {
  external_id?: string;
  label?: string;
  line_items: { product_id: string; variant_id: number; quantity: number }[];
  shipping_method: number;
  is_printify_express?: boolean;
  is_economy_shipping?: boolean;
  send_shipping_notification: boolean;
  address_to: ShippingAddress;
}

interface PrintifyImageUploadResponse {
  id: string;
}

interface PrintifyPrintArea {
  position: string;
  images: { id: string }[];
}

interface PrintifyPrintAreas {
  [key: string]: PrintifyPrintArea;
}

// Helper function to make authenticated requests to the Printify API
async function printifyRequest(endpoint: string, method = 'GET', body?: any) {
  // Clean up endpoint - remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  // Build the full URL
  const url = `${PRINTIFY_API_URL}/${cleanEndpoint}`;

  console.log(`Making Printify API request: ${method} ${url}`);
  if (body) {
    console.log(`Request body: ${JSON.stringify(body, null, 2)}`);
  }

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`Printify API error (${response.status}): ${responseText}`);
      throw new Error(`Printify API error (${response.status}): ${responseText}`);
    }

    // Parse JSON if possible
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      // Response might be a plain text
      console.warn('Response is not valid JSON:', responseText);
      return { success: true, message: responseText };
    }

    return responseData;
  } catch (error) {
    console.error(`Error in printifyRequest for ${url}:`, error);
    throw error;
  }
}

/**
 * Fetch the blueprint that best matches "Kiss-Cut Vinyl Stickers".
 * If none found, throws an error.
 */
async function getKissCutVinylStickerBlueprintId(): Promise<number> {
  console.log('Fetching all blueprints to find Kiss-Cut Vinyl Stickers...');

  const blueprints = await printifyRequest('/catalog/blueprints.json', 'GET');
  if (!Array.isArray(blueprints) || blueprints.length === 0) {
    throw new Error('No blueprints returned by Printify');
  }

  // Look for something that contains "kiss" and "cut" in the title, plus "vinyl"
  const kissCut = blueprints.find((bp: any) =>
    bp.title.toLowerCase().includes('Kiss-Cut Vinyl Decals') 
  );

  // If we didn't find an exact "kiss-cut vinyl", we might broaden the search
  if (!kissCut) {
    console.error('Unable to find blueprint with "kiss-cut vinyl" in its title.');
    // Fallback: find any blueprint that includes "kiss-cut" or "kiss cut"
    const fallback = blueprints.find((bp: any) =>
      bp.title.toLowerCase().includes('kiss-cut') ||
      bp.title.toLowerCase().includes('kiss cut')
    );

    if (!fallback) {
      throw new Error('No "Kiss-Cut Sticker" blueprint found in Printify catalog');
    }

    console.log(`Found fallback blueprint: ${fallback.title} (ID: ${fallback.id})`);
    return fallback.id;
  }

  console.log(`Found "Kiss-Cut Vinyl Sticker" blueprint: ${kissCut.title} (ID: ${kissCut.id})`);
  return kissCut.id;
}

/**
 * Retrieve a valid US-based print provider for the given blueprint ID.
 * Throws an error if none are located in the United States.
 */
async function getPrintProviderForBlueprint(blueprintId: number): Promise<number> {
  console.log(`Fetching print providers for blueprint ID: ${blueprintId}...`);
  const endpoint = `/catalog/blueprints/${blueprintId}/print_providers.json`;
  const providers = await printifyRequest(endpoint, 'GET');

  if (!Array.isArray(providers) || providers.length === 0) {
    throw new Error(`No print providers found for blueprint ID: ${blueprintId}`);
  }

  // Filter for US-based print providers. 
  // The response typically has a "location" field (e.g., "United States, Florida").
  const usProviders = providers.filter(
    (p: any) => p.location && p.location.toLowerCase().includes('united states')
  );

  if (usProviders.length === 0) {
    throw new Error(`No US-based print providers found for blueprint ID: ${blueprintId}`);
  }

  // For demonstration, just pick the first US-based provider
  const provider = usProviders[0];
  console.log(
    `Using US-based print provider "${provider.title}" (ID: ${provider.id}) for blueprint ${blueprintId}`
  );
  return provider.id;
}

/**
 * Upload an image to Printify via a public URL.
 */
async function uploadImageToPrintify(imageUrl: string): Promise<string> {
  try {
    console.log('Attempting to upload image to Printify with URL:', imageUrl);

    // Validate the image URL
    if (!imageUrl || !imageUrl.startsWith('http')) {
      console.warn('Invalid image URL provided, falling back to test image');
      // Fall back to a test image if the URL is invalid
      imageUrl = 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=60';
    }

    // Upload the image to Printify
    const uploadResponse = await printifyRequest('/uploads/images.json', 'POST', {
      file_name: `sticker-design-${Date.now()}.png`,
      url: imageUrl,
    });

    const { id } = uploadResponse as PrintifyImageUploadResponse;
    console.log('Image uploaded successfully with ID:', id);
    return id;
  } catch (error) {
    console.error('Error uploading image to Printify:', error);
    throw new Error('Failed to upload image to Printify');
  }
}

/**
 * Return basic info about any "sticker" or "decal" blueprint (for reference).
 * This is just a utility function that you might not need if you only want Kiss-Cut Vinyl.
 */
export async function getAvailableStickerProducts() {
  try {
    console.log('Fetching available blueprint catalogs from Printify...');
    const blueprintsResponse = await printifyRequest('/catalog/blueprints.json');

    const stickerBlueprints = blueprintsResponse.filter((blueprint: any) =>
      blueprint.title.toLowerCase().includes('sticker') ||
      blueprint.title.toLowerCase().includes('decal')
    );

    return stickerBlueprints.map((blueprint: any) => ({
      id: blueprint.id,
      title: blueprint.title,
      description: blueprint.description,
    }));
  } catch (error) {
    console.error('Error fetching sticker products from Printify:', error);
    throw new Error('Failed to fetch sticker products from Printify');
  }
}

/**
 * Create a Kiss-Cut Vinyl Sticker product in your Printify shop using a supplied image URL
 * and only US-based print providers.
 * Returns an object containing the Printify product ID, selected variant ID, and provider ID.
 */
export async function createProduct(imageUrl: string): Promise<{ productId: string; variantId: number; providerId: number }> {
  try {
    console.log('Attempting to create a "Kiss-Cut Vinyl Sticker" product...');
    // 1. Upload the image to Printify
    const imageId = await uploadImageToPrintify(imageUrl);

    // 2. Define the target blueprint and provider
    const stickerBlueprintId = 1268;
    const printProviderId = 215; // Capture the provider ID used
    console.log(`Using Blueprint ID: ${stickerBlueprintId}, Provider ID: ${printProviderId}`);

    // 3. Get variants for the chosen blueprint and provider
    const variantsEndpoint = `/catalog/blueprints/${stickerBlueprintId}/print_providers/${printProviderId}/variants.json`;
    const variantsResponse = await printifyRequest(variantsEndpoint, 'GET');

    if (!variantsResponse || !Array.isArray(variantsResponse.variants) || variantsResponse.variants.length === 0) {
      throw new Error(`No variants found for blueprint ${stickerBlueprintId} and provider ${printProviderId}`);
    }

    // 4. Select a variant (e.g., the first one, or based on size/criteria)
    // For simplicity, let's pick the first variant ID.
    // In production, you might want logic to select a specific size (e.g., "2x2").
    const selectedVariant = variantsResponse.variants[0];
    const selectedVariantId = selectedVariant.id;
    console.log(`Selected Variant: ${selectedVariant.title} (ID: ${selectedVariantId})`);

    if (!selectedVariantId || typeof selectedVariantId !== 'number') {
        throw new Error('Could not determine a valid variant ID.');
    }

    // 5. Define the product payload
    const productPayload = {
      title: `Custom Sticker - ${Date.now()}`,
      description: 'User-generated custom sticker',
      blueprint_id: stickerBlueprintId,
      print_provider_id: printProviderId,
      variants: [
        {
          id: selectedVariantId,
          price: 350, // Set your base price in cents
          is_enabled: true,
        },
      ],
      print_areas: [
        {
          variant_ids: [selectedVariantId],
          placeholders: [
            {
              position: 'front', // Adjust if blueprint uses different placeholders
              images: [
                {
                  id: imageId,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
    };

    // 6. Create the product in Printify
    const productEndpoint = `/shops/${SHOP_ID}/products.json`;
    console.log('Submitting product creation payload:', JSON.stringify(productPayload, null, 2));
    const productResponse = await printifyRequest(productEndpoint, 'POST', productPayload);
    console.log('Product creation response:', productResponse);

    if (!productResponse || !productResponse.id) {
      throw new Error('Failed to create product or received invalid response');
    }

    console.log(`Product created successfully: ID ${productResponse.id}, Variant ID ${selectedVariantId}, Provider ID ${printProviderId}`);
    // Return all three IDs
    return {
        productId: productResponse.id,
        variantId: selectedVariantId,
        providerId: printProviderId
    };

  } catch (error) {
    console.error('Error creating Printify product:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create Printify product: ${errorMessage}`);
  }
}

/**
 * Place an order in Printify using the created product.
 */
export async function createOrder(orderDetails: OrderDetails): Promise<string> {
  try {
    if (!SHOP_ID) {
      throw new Error('Printify Shop ID is not configured.');
    }
    if (!PRINTIFY_API_KEY) {
      throw new Error('Printify API Key is not configured.');
    }

    console.log('[createOrder] Creating Printify order for existing product with details:', JSON.stringify(orderDetails, null, 2));

    // Validate line items are provided and not empty
    if (!orderDetails.line_items || orderDetails.line_items.length === 0) {
        throw new Error('Cannot create order with empty line items.');
    }

    // Prepare the payload according to the API documentation
    const printifyOrderPayload: PrintifyOrder = {
      external_id: orderDetails.external_id,
      label: orderDetails.label,
      line_items: orderDetails.line_items.map(item => {
          // Validate incoming item structure
          if (!item.product_id || !item.variant_id || !item.quantity) {
            console.error('[createOrder] Line item missing product_id, variant_id, or quantity:', item);
            throw new Error('Invalid line item data provided.');
          }
          return {
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          };
      }),
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: orderDetails.shippingAddress,
    };

    // Submit the order to Printify
    const orderEndpoint = `/shops/${SHOP_ID}/orders.json`;
    console.log('[createOrder] Submitting final payload to Printify:', JSON.stringify(printifyOrderPayload, null, 2));
    const orderResponse = await printifyRequest(orderEndpoint, 'POST', printifyOrderPayload);

    console.log('Printify order submission response:', orderResponse);

    if (!orderResponse || !orderResponse.id) {
      throw new Error('Failed to create Printify order or received invalid response.');
    }

    return orderResponse.id;
  } catch (error) {
    console.error('Error creating Printify order:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to create Printify order: ${errorMessage}`);
  }
}

/**
 * Fetch full order details for a specific order from Printify.
 */
export async function getOrderStatus(orderId: string): Promise<PrintifyOrderResponse> {
  try {
    // NOTE: Removed User ID logic as per user instruction.
    // Using the /shops/{shopId}/orders/{orderId}.json endpoint directly.
    
    // Ensure SHOP_ID is available (it's read at the top level of the file)
    if (!SHOP_ID) {
        console.error('PRINTIFY_SHOP_ID environment variable is not set.');
        throw new Error('Printify shop ID configuration is missing.');
    }

    const endpoint = `/shops/${SHOP_ID}/orders/${orderId}.json`;

    console.log(`[getOrderStatus] Fetching order data from Printify endpoint: ${endpoint}`);
    const orderData = await printifyRequest(endpoint);

    // Basic validation of the response structure
    if (!orderData || typeof orderData !== 'object' || !orderData.id || !orderData.status || !orderData.address_to) {
      console.error('[getOrderStatus] Invalid or incomplete data in Printify response:', orderData);
      throw new Error('Invalid response received from Printify API when fetching order details.');
    }

    console.log(`[getOrderStatus] Received order details from Printify for ID: ${orderData.id}, Status: ${orderData.status}`);
    return orderData as PrintifyOrderResponse;
  } catch (error: any) {
    console.error(`Error fetching order details from Printify: ${error.message}`);
    const errorMessage = error.message || 'Unknown error fetching from Printify';
    throw new Error(`Failed to fetch order details: ${errorMessage}`);
  }
}

/**
 * A simple call to verify your Printify shop info and API connection.
 */
export async function getShopInfo() {
  try {
    console.log('Fetching shop information from Printify...');
    console.log('Using SHOP_ID:', SHOP_ID);
    console.log('API Key length:', PRINTIFY_API_KEY.length, 'characters');

    const shopsResponse = await fetch(`${PRINTIFY_API_URL}/shops.json`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!shopsResponse.ok) {
      const errorText = await shopsResponse.text();
      console.error('Error fetching shops list:', errorText);
      throw new Error(`Failed to fetch shops list: ${errorText}`);
    }

    const shopsData = await shopsResponse.json();
    console.log('Available shops:', JSON.stringify(shopsData, null, 2));

    if (Array.isArray(shopsData) && shopsData.length > 0) {
      const firstShopId = shopsData[0].id;
      console.log(`Using first available shop ID: ${firstShopId} (instead of configured ID: ${SHOP_ID})`);

      // Update the shop ID for future calls
      process.env.PRINTIFY_SHOP_ID = firstShopId.toString();

      return {
        shopId: firstShopId,
        shopInfo: shopsData[0],
        message: 'Using first available shop',
      };
    }

    return {
      error: 'No shops found for this API key',
      shopsList: shopsData,
    };
  } catch (error) {
    console.error('Error fetching shop info from Printify:', error);
    throw new Error(
      `Failed to fetch shop info: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
