import express from 'express';
import { generateImageController, getRecentImagesController, getUserImagesController, removeBackgroundController } from '../controllers/imageController';

const router = express.Router();

router.post('/', generateImageController);
router.get('/recent', getRecentImagesController);
router.get('/user/:userId', getUserImagesController);
router.post('/remove-background', removeBackgroundController);

export default router; 