import { RequestHandler } from 'express';
import { prisma } from '../server';
import crypto from 'crypto';

// Generate a unique slug for a drop
const generateSlug = (title: string): string => {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
  const uniqueSuffix = crypto.randomBytes(4).toString('hex');
  return `${baseSlug}-${uniqueSuffix}`;
};

// Create a new drop
export const createDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { title, description, coverImageUrl } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return res.status(400).json({ error: 'Title is required (minimum 2 characters)' });
  }

  try {
    const slug = generateSlug(title);

    const drop = await prisma.drop.create({
      data: {
        creatorId: creator.id,
        title: title.trim(),
        description: description?.trim() || null,
        coverImageUrl: coverImageUrl || null,
        slug,
        status: 'DRAFT',
      },
      include: {
        _count: {
          select: { designs: true, packs: true },
        },
      },
    });

    res.status(201).json({ drop });
  } catch (error) {
    console.error('[Drop] Create error:', error);
    res.status(500).json({ error: 'Failed to create drop' });
  }
};

// Get all drops for authenticated creator
export const getCreatorDrops: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const status = req.query.status as string | undefined;

  try {
    const drops = await prisma.drop.findMany({
      where: {
        creatorId: creator.id,
        ...(status && { status: status as any }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { designs: true, orders: true },
        },
        designs: {
          where: { isHero: true },
          take: 1,
          include: {
            image: {
              select: { imageUrl: true, noBackgroundUrl: true },
            },
          },
        },
      },
    });

    res.status(200).json({
      drops: drops.map(drop => ({
        ...drop,
        heroImage: drop.designs[0]?.image || null,
        designs: undefined, // Remove full designs array
      })),
    });
  } catch (error) {
    console.error('[Drop] Get creator drops error:', error);
    res.status(500).json({ error: 'Failed to get drops' });
  }
};

// Get drop by ID (for creator editing)
export const getDropById: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  try {
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
      include: {
        designs: {
          orderBy: { displayOrder: 'asc' },
          include: {
            image: true,
          },
        },
        packs: {
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    res.status(200).json({ drop });
  } catch (error) {
    console.error('[Drop] Get by ID error:', error);
    res.status(500).json({ error: 'Failed to get drop' });
  }
};

// Get drop by slug (public)
export const getDropBySlug: RequestHandler = async (req, res) => {
  const { slug } = req.params;

  if (!slug) {
    return res.status(400).json({ error: 'Slug is required' });
  }

  try {
    const drop = await prisma.drop.findUnique({
      where: { slug },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            storeName: true,
            profileImageUrl: true,
            isVerified: true,
          },
        },
        designs: {
          orderBy: { displayOrder: 'asc' },
          include: {
            image: {
              select: {
                id: true,
                imageUrl: true,
                noBackgroundUrl: true,
                prompt: true,
              },
            },
          },
        },
        packs: {
          where: { isActive: true },
          orderBy: { designCount: 'asc' },
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // Don't show unpublished drops to non-creators
    if (drop.status !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Drop not found' });
    }

    res.status(200).json({ drop });
  } catch (error) {
    console.error('[Drop] Get by slug error:', error);
    res.status(500).json({ error: 'Failed to get drop' });
  }
};

// Update drop
export const updateDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;
  const { title, description, coverImageUrl, expiresAt, settings } = req.body;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  try {
    // Verify ownership
    const existing = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    const drop = await prisma.drop.update({
      where: { id: parseInt(dropId) },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(settings !== undefined && { settings }),
      },
      include: {
        _count: {
          select: { designs: true, packs: true },
        },
      },
    });

    res.status(200).json({ drop });
  } catch (error) {
    console.error('[Drop] Update error:', error);
    res.status(500).json({ error: 'Failed to update drop' });
  }
};

// Publish drop
export const publishDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  try {
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
      include: {
        _count: {
          select: { designs: true, packs: true },
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // Validation checks
    const errors: string[] = [];

    if (drop._count.designs < 3) {
      errors.push('Drop needs at least 3 designs');
    }

    if (drop._count.packs === 0) {
      errors.push('Drop needs at least one pack configured');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Cannot publish drop',
        details: errors,
      });
    }

    const publishedDrop = await prisma.drop.update({
      where: { id: parseInt(dropId) },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
    });

    // TODO: Send notifications to subscribers

    res.status(200).json({ drop: publishedDrop });
  } catch (error) {
    console.error('[Drop] Publish error:', error);
    res.status(500).json({ error: 'Failed to publish drop' });
  }
};

// End drop
export const endDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  try {
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
        status: 'PUBLISHED',
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Published drop not found' });
    }

    const endedDrop = await prisma.drop.update({
      where: { id: parseInt(dropId) },
      data: { status: 'ENDED' },
    });

    res.status(200).json({ drop: endedDrop });
  } catch (error) {
    console.error('[Drop] End error:', error);
    res.status(500).json({ error: 'Failed to end drop' });
  }
};

// Delete drop (only drafts)
export const deleteDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  try {
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    if (drop.status !== 'DRAFT') {
      return res.status(400).json({
        error: 'Only draft drops can be deleted. End the drop first, then archive it.',
      });
    }

    await prisma.drop.delete({
      where: { id: parseInt(dropId) },
    });

    res.status(200).json({ success: true, message: 'Drop deleted' });
  } catch (error) {
    console.error('[Drop] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete drop' });
  }
};

// === Design Management ===

// Add design to drop
export const addDesignToDrop: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;
  const { imageId, isHero } = req.body;

  if (!dropId || isNaN(parseInt(dropId))) {
    return res.status(400).json({ error: 'Valid drop ID is required' });
  }

  if (!imageId || isNaN(parseInt(imageId))) {
    return res.status(400).json({ error: 'Valid image ID is required' });
  }

  try {
    // Verify drop ownership
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // Verify image ownership
    const image = await prisma.generatedImage.findFirst({
      where: {
        id: parseInt(imageId),
        creatorId: creator.id,
      },
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found or not owned by you' });
    }

    // Get current max display order
    const maxOrder = await prisma.dropDesign.aggregate({
      where: { dropId: parseInt(dropId) },
      _max: { displayOrder: true },
    });

    // If setting as hero, unset existing hero
    if (isHero) {
      await prisma.dropDesign.updateMany({
        where: { dropId: parseInt(dropId), isHero: true },
        data: { isHero: false },
      });
    }

    const design = await prisma.dropDesign.create({
      data: {
        dropId: parseInt(dropId),
        imageId: parseInt(imageId),
        displayOrder: (maxOrder._max.displayOrder || 0) + 1,
        isHero: isHero || false,
      },
      include: {
        image: true,
      },
    });

    res.status(201).json({ design });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This design is already in the drop' });
    }
    console.error('[Drop] Add design error:', error);
    res.status(500).json({ error: 'Failed to add design to drop' });
  }
};

// Update design in drop
export const updateDesign: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId, designId } = req.params;
  const { displayOrder, isHero } = req.body;

  try {
    // Verify ownership
    const design = await prisma.dropDesign.findFirst({
      where: {
        id: parseInt(designId),
        dropId: parseInt(dropId),
        drop: { creatorId: creator.id },
      },
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    // If setting as hero, unset existing hero
    if (isHero) {
      await prisma.dropDesign.updateMany({
        where: { dropId: parseInt(dropId), isHero: true },
        data: { isHero: false },
      });
    }

    const updatedDesign = await prisma.dropDesign.update({
      where: { id: parseInt(designId) },
      data: {
        ...(displayOrder !== undefined && { displayOrder }),
        ...(isHero !== undefined && { isHero }),
      },
      include: {
        image: true,
      },
    });

    res.status(200).json({ design: updatedDesign });
  } catch (error) {
    console.error('[Drop] Update design error:', error);
    res.status(500).json({ error: 'Failed to update design' });
  }
};

// Reorder designs
export const reorderDesigns: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;
  const { designIds } = req.body; // Array of design IDs in new order

  if (!Array.isArray(designIds)) {
    return res.status(400).json({ error: 'designIds must be an array' });
  }

  try {
    // Verify ownership
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // Update display order for each design
    await Promise.all(
      designIds.map((id, index) =>
        prisma.dropDesign.updateMany({
          where: {
            id: parseInt(id),
            dropId: parseInt(dropId),
          },
          data: { displayOrder: index },
        })
      )
    );

    // Fetch updated designs
    const designs = await prisma.dropDesign.findMany({
      where: { dropId: parseInt(dropId) },
      orderBy: { displayOrder: 'asc' },
      include: { image: true },
    });

    res.status(200).json({ designs });
  } catch (error) {
    console.error('[Drop] Reorder designs error:', error);
    res.status(500).json({ error: 'Failed to reorder designs' });
  }
};

// Remove design from drop
export const removeDesign: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId, designId } = req.params;

  try {
    // Verify ownership
    const design = await prisma.dropDesign.findFirst({
      where: {
        id: parseInt(designId),
        dropId: parseInt(dropId),
        drop: { creatorId: creator.id },
      },
    });

    if (!design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    await prisma.dropDesign.delete({
      where: { id: parseInt(designId) },
    });

    res.status(200).json({ success: true, message: 'Design removed from drop' });
  } catch (error) {
    console.error('[Drop] Remove design error:', error);
    res.status(500).json({ error: 'Failed to remove design' });
  }
};

// === Pack Management ===

// Create pack for drop
export const createPack: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId } = req.params;
  const { type, name, description, designCount, priceInCents, isDefault } = req.body;

  if (!type || !['BUILD_A_PACK', 'STICKER_SHEET', 'FULL_SET'].includes(type)) {
    return res.status(400).json({ error: 'Valid pack type is required' });
  }

  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Pack name is required' });
  }

  if (!designCount || typeof designCount !== 'number' || designCount < 1) {
    return res.status(400).json({ error: 'Valid design count is required' });
  }

  if (!priceInCents || typeof priceInCents !== 'number' || priceInCents < 100) {
    return res.status(400).json({ error: 'Price must be at least $1.00' });
  }

  try {
    // Verify ownership
    const drop = await prisma.drop.findFirst({
      where: {
        id: parseInt(dropId),
        creatorId: creator.id,
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // If setting as default, unset existing default
    if (isDefault) {
      await prisma.pack.updateMany({
        where: { dropId: parseInt(dropId), isDefault: true },
        data: { isDefault: false },
      });
    }

    const pack = await prisma.pack.create({
      data: {
        dropId: parseInt(dropId),
        type,
        name: name.trim(),
        description: description?.trim() || null,
        designCount,
        priceInCents,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json({ pack });
  } catch (error) {
    console.error('[Drop] Create pack error:', error);
    res.status(500).json({ error: 'Failed to create pack' });
  }
};

// Update pack
export const updatePack: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId, packId } = req.params;
  const { name, description, priceInCents, isDefault, isActive } = req.body;

  try {
    // Verify ownership
    const pack = await prisma.pack.findFirst({
      where: {
        id: parseInt(packId),
        dropId: parseInt(dropId),
        drop: { creatorId: creator.id },
      },
    });

    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    // If setting as default, unset existing default
    if (isDefault) {
      await prisma.pack.updateMany({
        where: { dropId: parseInt(dropId), isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatedPack = await prisma.pack.update({
      where: { id: parseInt(packId) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(priceInCents !== undefined && { priceInCents }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.status(200).json({ pack: updatedPack });
  } catch (error) {
    console.error('[Drop] Update pack error:', error);
    res.status(500).json({ error: 'Failed to update pack' });
  }
};

// Delete pack
export const deletePack: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { dropId, packId } = req.params;

  try {
    // Verify ownership
    const pack = await prisma.pack.findFirst({
      where: {
        id: parseInt(packId),
        dropId: parseInt(dropId),
        drop: { creatorId: creator.id },
      },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!pack) {
      return res.status(404).json({ error: 'Pack not found' });
    }

    if (pack._count.orders > 0) {
      return res.status(400).json({
        error: 'Cannot delete a pack that has orders. Deactivate it instead.',
      });
    }

    await prisma.pack.delete({
      where: { id: parseInt(packId) },
    });

    res.status(200).json({ success: true, message: 'Pack deleted' });
  } catch (error) {
    console.error('[Drop] Delete pack error:', error);
    res.status(500).json({ error: 'Failed to delete pack' });
  }
};
