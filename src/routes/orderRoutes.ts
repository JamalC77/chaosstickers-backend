import express from 'express';
import { createOrderController, printifyWebhookController, getOrderStatusController } from '../controllers/orderController';

const router = express.Router();

router.post('/', createOrderController);
router.post('/webhook', printifyWebhookController);
router.get('/:orderId', getOrderStatusController);

export default router; 