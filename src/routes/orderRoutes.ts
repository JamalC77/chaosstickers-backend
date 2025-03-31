import express from 'express';
import { createOrderController, printifyWebhookController, getOrderStatusController, testPrintifyIntegrationController, debugPrintifyController, testProductCreationController, getPrintifyCatalogController, testBasicPrintifyAccessController, testExternalOrderController, createMockOrderController, generateImageAndCreateProductController } from '../controllers/orderController';

const router = express.Router();

// Define specific routes first
router.post('/', createOrderController);
router.post('/test-printify', testPrintifyIntegrationController);
router.post('/test-external', testExternalOrderController);
router.post('/test-mock', createMockOrderController);
router.post('/test/generate-and-create', generateImageAndCreateProductController);
router.post('/webhook', printifyWebhookController);
router.get('/debug/printify', debugPrintifyController);
router.get('/debug/catalog', getPrintifyCatalogController);
router.get('/test/product', testProductCreationController);
router.get('/test/basic-access', testBasicPrintifyAccessController);

// Define generic/catch-all route last
router.get('/:orderId', getOrderStatusController);

export default router; 