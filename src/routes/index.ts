import express from 'express';

// Import route modules
import imageRoutes from './imageRoutes';
import orderRoutes from './orderRoutes';
import paymentRoutes from './paymentRoutes';
import designRoutes from './designRoutes';
import authRoutes from './authRoutes';

const router = express.Router();

// Apply route groups
router.use('/auth', authRoutes);
router.use('/generate-image', imageRoutes);
router.use('/orders', orderRoutes);
router.use('/payment', paymentRoutes);
router.use('/designs', designRoutes);

export default router; 