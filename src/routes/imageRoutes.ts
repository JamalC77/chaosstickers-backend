import express from 'express';
import { generateImageController, getRecentImagesController, getUserImagesController } from '../controllers/imageController';

const router = express.Router();

router.post('/', generateImageController);
router.get('/recent', getRecentImagesController);
router.get('/user/:userId', getUserImagesController);

export default router; 