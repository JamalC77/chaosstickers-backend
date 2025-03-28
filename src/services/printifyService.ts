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
  selectedImageUrl: string;
  shippingAddress: ShippingAddress;
}

interface PrintifyVariant {
  id: number;
  variant_id: number;
  quantity: number;
}

interface PrintifyLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

interface PrintifyOrder {
  external_id?: string;
  line_items: PrintifyLineItem[];
  shipping_method: number;
  shipping_address: ShippingAddress;
  send_shipping_notification: boolean;
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

// Helper function to make authenticated requests to Printify API
async function printifyRequest(endpoint: string, method = 'GET', body?: any) {
  const url = `${PRINTIFY_API_URL}${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Printify API error (${response.status}): ${error}`);
  }

  return response.json();
}

// Upload image to Printify
async function uploadImageToPrintify(imageUrl: string): Promise<string> {
  try {
    const uploadResponse = await printifyRequest('/uploads/images.json', 'POST', {
      file_name: `sticker-design-${Date.now()}.png`,
      url: imageUrl
    });
    
    return (uploadResponse as PrintifyImageUploadResponse).id;
  } catch (error) {
    console.error('Error uploading image to Printify:', error);
    throw new Error('Failed to upload image to Printify');
  }
}

// Get available sticker products from blueprint catalog
export async function getAvailableStickerProducts() {
  try {
    const blueprints = await printifyRequest('/catalog/blueprints.json');
    return blueprints.filter((blueprint: any) => 
      blueprint.title.toLowerCase().includes('sticker')
    );
  } catch (error) {
    console.error('Error fetching sticker products from Printify:', error);
    throw new Error('Failed to fetch sticker products');
  }
}

// Create a product in Printify with the custom image
export async function createProduct(imageUrl: string): Promise<string> {
  try {
    // Upload the image to Printify
    const printifyImageId = await uploadImageToPrintify(imageUrl);
    
    // For this example, we'll use a specific sticker blueprint
    // In production, you might want to get this from your database or configuration
    const STICKER_BLUEPRINT_ID = '13'; // Example blueprint ID for a sticker product
    
    // Create a product with the uploaded image
    const productData = {
      title: `Custom Sticker - ${new Date().toISOString().split('T')[0]}`,
      description: 'Custom sticker created by ChaosStickers',
      blueprint_id: STICKER_BLUEPRINT_ID,
      print_provider_id: 1, // Example print provider ID
      variants: [
        {
          id: 1, // Variant ID from the blueprint
          price: 9.99, // Price in USD
          is_enabled: true
        }
      ],
      print_areas: {
        default: {
          position: 'center',
          images: [
            { id: printifyImageId }
          ]
        }
      }
    };
    
    const product = await printifyRequest(`/shops/${SHOP_ID}/products.json`, 'POST', productData);
    
    // Publish the product to make it available for ordering
    await printifyRequest(`/shops/${SHOP_ID}/products/${product.id}/publish.json`, 'POST', {
      title: product.title,
      description: product.description,
      blueprint_id: STICKER_BLUEPRINT_ID,
      print_provider_id: 1,
      variants: product.variants,
      print_areas: product.print_areas
    });
    
    return product.id;
  } catch (error) {
    console.error('Error creating product with Printify:', error);
    throw new Error('Failed to create product');
  }
}

// Place an order in Printify
export async function createOrder(orderDetails: OrderDetails): Promise<string> {
  try {
    // Create a product with the selected image
    const productId = await createProduct(orderDetails.selectedImageUrl);
    
    // Get available variants for the product
    const productDetails = await printifyRequest(`/shops/${SHOP_ID}/products/${productId}.json`);
    const variant = productDetails.variants[0]; // Use the first variant for simplicity
    
    // Create the order
    const orderData: PrintifyOrder = {
      external_id: `order-${Date.now()}`,
      line_items: [
        {
          product_id: productId,
          variant_id: variant.id,
          quantity: 1
        }
      ],
      shipping_method: 1, // Standard shipping method ID
      shipping_address: orderDetails.shippingAddress,
      send_shipping_notification: true
    };
    
    const order = await printifyRequest(`/shops/${SHOP_ID}/orders.json`, 'POST', orderData);
    
    return order.id;
  } catch (error) {
    console.error('Error creating order with Printify:', error);
    throw new Error('Failed to create order');
  }
}

// Get order status from Printify
export async function getOrderStatus(orderId: string) {
  try {
    const order = await printifyRequest(`/shops/${SHOP_ID}/orders/${orderId}.json`);
    return order.status;
  } catch (error) {
    console.error('Error fetching order status from Printify:', error);
    throw new Error('Failed to fetch order status');
  }
} 