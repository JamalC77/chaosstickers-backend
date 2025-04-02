import express from 'express';
import {
  getPurchasedDesignsController,
  getRecentDesignsController,
} from '../controllers/designController';
// import { requireAuth } from '../middleware/authMiddleware'; // Assuming you have auth middleware

const router = express.Router();

// Route to get designs purchased by the logged-in user
// Add authentication middleware here once implemented
// router.get('/purchased', requireAuth, getPurchasedDesignsController);
router.get('/purchased', getPurchasedDesignsController); // Temporarily open

// Route to get the most recent designs (paginated)
router.get('/recent', getRecentDesignsController);

export default router; 