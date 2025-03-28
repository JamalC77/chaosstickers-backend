import express from 'express';
import { createPaymentIntentController } from '../controllers/paymentController';

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntentController);

export default router; 