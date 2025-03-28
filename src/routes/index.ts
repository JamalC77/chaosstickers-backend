import express from 'express';

// Import route modules
import imageRoutes from './imageRoutes';
import orderRoutes from './orderRoutes';
import paymentRoutes from './paymentRoutes';

const router = express.Router();

// Apply route groups
router.use('/generate-image', imageRoutes);
router.use('/order', orderRoutes);
router.use('/payment', paymentRoutes);

export default router; 