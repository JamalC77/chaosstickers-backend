import express from 'express';
import { createPaymentIntentController, backgroundRemovalPaymentController } from '../controllers/paymentController';

const router = express.Router();

router.post('/create-payment-intent', createPaymentIntentController);
router.post('/background-removal-payment', backgroundRemovalPaymentController);

export default router; 