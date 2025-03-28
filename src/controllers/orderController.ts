import { RequestHandler } from 'express';
import { createProduct, createOrder, getOrderStatus } from '../services/printifyService';
import { prisma } from '../server';

export const createOrderController: RequestHandler = async (req, res) => {
  try {
    const { paymentId, shippingAddress, selectedImageUrl, userId } = req.body;

    if (!paymentId || !shippingAddress || !selectedImageUrl || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create a product in Printify with the selected image
    const productId = await createProduct(selectedImageUrl);

    // Create an order in Printify
    const printifyOrderId = await createOrder({
      selectedImageUrl,
      shippingAddress,
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
            productId,
            quantity: 1,
            imageUrl: selectedImageUrl,
          },
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
    
    if (!orderId) {
      return res.status(400).json({ error: 'Missing order ID' });
    }
    
    // Get the order from our database
    const order = await prisma.order.findUnique({
      where: {
        id: parseInt(orderId)
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
      
      order.status = printifyStatus;
    }
    
    return res.status(200).json({ order });
  } catch (error) {
    console.error('Error in getOrderStatusController:', error);
    return res.status(500).json({ error: 'Failed to get order status' });
  }
} 