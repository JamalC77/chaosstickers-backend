import express from 'express';
import { requireAuth } from '../controllers/authController';
import {
  createDrop,
  getCreatorDrops,
  getDropById,
  getDropBySlug,
  updateDrop,
  publishDrop,
  endDrop,
  deleteDrop,
  addDesignToDrop,
  updateDesign,
  reorderDesigns,
  removeDesign,
  createPack,
  updatePack,
  deletePack,
} from '../controllers/dropController';

const router = express.Router();

// === Drop CRUD ===

// POST /api/drops - Create new drop (authenticated)
router.post('/', requireAuth, createDrop);

// GET /api/drops - Get all drops for creator (authenticated)
router.get('/', requireAuth, getCreatorDrops);

// GET /api/drops/public/:slug - Get drop by slug (public)
router.get('/public/:slug', getDropBySlug);

// GET /api/drops/:dropId - Get drop by ID (authenticated, creator only)
router.get('/:dropId', requireAuth, getDropById);

// PUT /api/drops/:dropId - Update drop (authenticated)
router.put('/:dropId', requireAuth, updateDrop);

// POST /api/drops/:dropId/publish - Publish drop (authenticated)
router.post('/:dropId/publish', requireAuth, publishDrop);

// POST /api/drops/:dropId/end - End drop (authenticated)
router.post('/:dropId/end', requireAuth, endDrop);

// DELETE /api/drops/:dropId - Delete draft drop (authenticated)
router.delete('/:dropId', requireAuth, deleteDrop);

// === Design Management ===

// POST /api/drops/:dropId/designs - Add design to drop
router.post('/:dropId/designs', requireAuth, addDesignToDrop);

// PUT /api/drops/:dropId/designs/reorder - Reorder designs
router.put('/:dropId/designs/reorder', requireAuth, reorderDesigns);

// PUT /api/drops/:dropId/designs/:designId - Update design
router.put('/:dropId/designs/:designId', requireAuth, updateDesign);

// DELETE /api/drops/:dropId/designs/:designId - Remove design
router.delete('/:dropId/designs/:designId', requireAuth, removeDesign);

// === Pack Management ===

// POST /api/drops/:dropId/packs - Create pack
router.post('/:dropId/packs', requireAuth, createPack);

// PUT /api/drops/:dropId/packs/:packId - Update pack
router.put('/:dropId/packs/:packId', requireAuth, updatePack);

// DELETE /api/drops/:dropId/packs/:packId - Delete pack
router.delete('/:dropId/packs/:packId', requireAuth, deletePack);

export default router;
