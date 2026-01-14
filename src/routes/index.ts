import express from 'express';

// Import route modules
import imageRoutes from './imageRoutes';
import orderRoutes from './orderRoutes';
import paymentRoutes from './paymentRoutes';
import designRoutes from './designRoutes';
import authRoutes from './authRoutes';
import creatorRoutes from './creatorRoutes';
import dropRoutes from './dropRoutes';
import shopRoutes from './shopRoutes';

const router = express.Router();

// Apply route groups
router.use('/generate-image', imageRoutes);
router.use('/orders', orderRoutes);
router.use('/payment', paymentRoutes);
router.use('/designs', designRoutes);

// Creator platform routes
router.use('/auth', authRoutes);
router.use('/creators', creatorRoutes);
router.use('/drops', dropRoutes);
router.use('/shop', shopRoutes);

export default router;
