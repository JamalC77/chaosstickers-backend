import express from 'express';
import {
  browseDrops,
  getShopDrop,
  calculatePackPrice,
  createPackCheckout,
  getFanCollection,
  subscribeToNotifications,
} from '../controllers/shopController';

const router = express.Router();

// GET /api/shop/drops - Browse all published drops
router.get('/drops', browseDrops);

// GET /api/shop/drops/:creatorSlug/:dropSlug - Get specific drop for shopping
router.get('/drops/:creatorSlug/:dropSlug', getShopDrop);

// POST /api/shop/calculate-price - Calculate price for pack selection
router.post('/calculate-price', calculatePackPrice);

// POST /api/shop/checkout - Create checkout session for pack purchase
router.post('/checkout', createPackCheckout);

// GET /api/shop/collection/:dropSlug - Get fan's collection for a drop
router.get('/collection/:dropSlug', getFanCollection);

// POST /api/shop/notify - Subscribe to drop/creator notifications
router.post('/notify', subscribeToNotifications);

export default router;
