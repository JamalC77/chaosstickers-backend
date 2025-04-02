import express from 'express';
import { createCheckoutSessionController } from '../controllers/paymentController';

const router = express.Router();

router.post('/create-checkout-session', createCheckoutSessionController);

export default router; 