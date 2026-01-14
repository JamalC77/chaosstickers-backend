import { RequestHandler } from 'express';
import { prisma } from '../server';
import { getPricingDisplay } from '../services/packPricingService';

// Get creator profile (public)
export const getCreatorProfile: RequestHandler = async (req, res) => {
  const { storeSlug } = req.params;

  if (!storeSlug) {
    return res.status(400).json({ error: 'Store slug is required' });
  }

  try {
    const creator = await prisma.creator.findUnique({
      where: { storeName: storeSlug },
      select: {
        id: true,
        name: true,
        bio: true,
        profileImageUrl: true,
        storeName: true,
        isVerified: true,
        createdAt: true,
        drops: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            coverImageUrl: true,
            publishedAt: true,
            expiresAt: true,
            _count: {
              select: { designs: true },
            },
          },
        },
      },
    });

    if (!creator) {
      return res.status(404).json({ error: 'Creator not found' });
    }

    res.status(200).json({ creator });
  } catch (error) {
    console.error('[Creator] Get profile error:', error);
    res.status(500).json({ error: 'Failed to get creator profile' });
  }
};

// Update creator profile (authenticated)
export const updateCreatorProfile: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { name, bio, profileImageUrl, storeName } = req.body;

  try {
    // If updating store name, check availability
    if (storeName && storeName !== creator.storeName) {
      const storeNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      const sanitizedName = storeName.toLowerCase().trim();

      if (sanitizedName.length < 3 || sanitizedName.length > 30) {
        return res.status(400).json({ error: 'Store name must be between 3 and 30 characters' });
      }

      if (!storeNameRegex.test(sanitizedName)) {
        return res.status(400).json({
          error: 'Store name can only contain lowercase letters, numbers, and hyphens',
        });
      }

      const existing = await prisma.creator.findUnique({
        where: { storeName: sanitizedName },
        select: { id: true },
      });

      if (existing && existing.id !== creator.id) {
        return res.status(400).json({ error: 'Store name is already taken' });
      }
    }

    const updatedCreator = await prisma.creator.update({
      where: { id: creator.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(profileImageUrl !== undefined && { profileImageUrl }),
        ...(storeName && { storeName: storeName.toLowerCase().trim() }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        bio: true,
        profileImageUrl: true,
        storeName: true,
        isVerified: true,
        createdAt: true,
      },
    });

    res.status(200).json({ creator: updatedCreator });
  } catch (error) {
    console.error('[Creator] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

// Update creator style template (authenticated)
export const updateStyleTemplate: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const { styleTemplate } = req.body;

  if (!styleTemplate || typeof styleTemplate !== 'object') {
    return res.status(400).json({ error: 'Style template must be an object' });
  }

  try {
    const updatedCreator = await prisma.creator.update({
      where: { id: creator.id },
      data: { styleTemplate },
      select: {
        id: true,
        storeName: true,
        styleTemplate: true,
      },
    });

    res.status(200).json({ creator: updatedCreator });
  } catch (error) {
    console.error('[Creator] Update style template error:', error);
    res.status(500).json({ error: 'Failed to update style template' });
  }
};

// Get creator analytics (authenticated)
export const getCreatorAnalytics: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;

  try {
    // Get drop count and stats
    const drops = await prisma.drop.findMany({
      where: { creatorId: creator.id },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
        _count: {
          select: {
            designs: true,
            orders: true,
          },
        },
      },
    });

    // Get total earnings
    const earnings = await prisma.earning.aggregate({
      where: { creatorId: creator.id },
      _sum: {
        grossRevenue: true,
        creatorPayout: true,
      },
      _count: true,
    });

    // Get recent orders
    const recentOrders = await prisma.dropOrder.findMany({
      where: {
        drop: { creatorId: creator.id },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        drop: {
          select: { title: true, slug: true },
        },
        order: {
          select: {
            status: true,
            totalPaidCents: true,
            createdAt: true,
          },
        },
      },
    });

    // Get total design count
    const totalDesigns = await prisma.dropDesign.count({
      where: {
        drop: { creatorId: creator.id },
      },
    });

    res.status(200).json({
      analytics: {
        drops: {
          total: drops.length,
          published: drops.filter(d => d.status === 'PUBLISHED').length,
          draft: drops.filter(d => d.status === 'DRAFT').length,
        },
        designs: {
          total: totalDesigns,
        },
        orders: {
          total: earnings._count,
        },
        earnings: {
          totalGross: earnings._sum.grossRevenue || 0,
          totalPayout: earnings._sum.creatorPayout || 0,
        },
        recentOrders: recentOrders.map(o => ({
          dropTitle: o.drop.title,
          dropSlug: o.drop.slug,
          status: o.order.status,
          amount: o.order.totalPaidCents,
          createdAt: o.order.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('[Creator] Get analytics error:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
};

// Get creator earnings history (authenticated)
export const getCreatorEarnings: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [earnings, totalCount] = await Promise.all([
      prisma.earning.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.earning.count({
        where: { creatorId: creator.id },
      }),
    ]);

    // Get aggregate stats
    const stats = await prisma.earning.aggregate({
      where: { creatorId: creator.id },
      _sum: {
        grossRevenue: true,
        printifyCost: true,
        stripeFee: true,
        platformFee: true,
        creatorPayout: true,
      },
    });

    const pendingPayout = await prisma.earning.aggregate({
      where: {
        creatorId: creator.id,
        status: 'PENDING',
      },
      _sum: {
        creatorPayout: true,
      },
    });

    res.status(200).json({
      earnings,
      stats: {
        totalGrossRevenue: stats._sum.grossRevenue || 0,
        totalPrintifyCost: stats._sum.printifyCost || 0,
        totalStripeFee: stats._sum.stripeFee || 0,
        totalPlatformFee: stats._sum.platformFee || 0,
        totalPayout: stats._sum.creatorPayout || 0,
        pendingPayout: pendingPayout._sum.creatorPayout || 0,
      },
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[Creator] Get earnings error:', error);
    res.status(500).json({ error: 'Failed to get earnings' });
  }
};

// Get creator's generated images (for adding to drops)
export const getCreatorImages: RequestHandler = async (req, res) => {
  const creator = (req as any).creator;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;

  try {
    const [images, totalCount] = await Promise.all([
      prisma.generatedImage.findMany({
        where: { creatorId: creator.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          dropDesigns: {
            select: {
              dropId: true,
              drop: {
                select: { title: true, slug: true },
              },
            },
          },
        },
      }),
      prisma.generatedImage.count({
        where: { creatorId: creator.id },
      }),
    ]);

    res.status(200).json({
      images: images.map(img => ({
        ...img,
        usedInDrops: img.dropDesigns.map(dd => ({
          dropId: dd.dropId,
          title: dd.drop.title,
          slug: dd.drop.slug,
        })),
      })),
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[Creator] Get images error:', error);
    res.status(500).json({ error: 'Failed to get images' });
  }
};

// Get pricing info for display
export const getPricing: RequestHandler = async (req, res) => {
  try {
    const pricing = getPricingDisplay();
    res.status(200).json({ pricing });
  } catch (error) {
    console.error('[Creator] Get pricing error:', error);
    res.status(500).json({ error: 'Failed to get pricing info' });
  }
};
