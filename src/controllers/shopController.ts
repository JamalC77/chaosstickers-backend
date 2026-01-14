import { RequestHandler } from 'express';
import { prisma } from '../server';
import {
  calculateBuildAPackPrice,
  calculateStickerSheetPrice,
  calculateFullSetPrice,
  PackSize,
  SheetSize,
  DEFAULT_PACK_PRICING,
} from '../services/packPricingService';
import { createProduct } from '../services/printifyService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Browse all published drops
export const browseDrops: RequestHandler = async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const creatorSlug = req.query.creator as string | undefined;

  try {
    const whereClause: any = { status: 'PUBLISHED' };

    if (creatorSlug) {
      const creator = await prisma.creator.findUnique({
        where: { storeName: creatorSlug },
        select: { id: true },
      });
      if (creator) {
        whereClause.creatorId = creator.id;
      }
    }

    const [drops, totalCount] = await Promise.all([
      prisma.drop.findMany({
        where: whereClause,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: {
          creator: {
            select: {
              name: true,
              storeName: true,
              profileImageUrl: true,
              isVerified: true,
            },
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
          _count: {
            select: { designs: true },
          },
          packs: {
            where: { isActive: true, isDefault: true },
            take: 1,
            select: { priceInCents: true },
          },
        },
      }),
      prisma.drop.count({ where: whereClause }),
    ]);

    res.status(200).json({
      drops: drops.map(drop => ({
        id: drop.id,
        title: drop.title,
        slug: drop.slug,
        description: drop.description,
        coverImageUrl: drop.coverImageUrl || drop.designs[0]?.image?.imageUrl,
        publishedAt: drop.publishedAt,
        expiresAt: drop.expiresAt,
        designCount: drop._count.designs,
        startingPrice: drop.packs[0]?.priceInCents,
        creator: drop.creator,
      })),
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[Shop] Browse drops error:', error);
    res.status(500).json({ error: 'Failed to browse drops' });
  }
};

// Get drop details for shop
export const getShopDrop: RequestHandler = async (req, res) => {
  const { creatorSlug, dropSlug } = req.params;

  try {
    const drop = await prisma.drop.findFirst({
      where: {
        slug: dropSlug,
        creator: { storeName: creatorSlug },
        status: 'PUBLISHED',
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            storeName: true,
            profileImageUrl: true,
            bio: true,
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
          orderBy: [{ isDefault: 'desc' }, { designCount: 'asc' }],
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    res.status(200).json({ drop });
  } catch (error) {
    console.error('[Shop] Get drop error:', error);
    res.status(500).json({ error: 'Failed to get drop' });
  }
};

// Calculate price for pack order
export const calculatePackPrice: RequestHandler = async (req, res) => {
  const { packId, selectedDesignIds, quantity, country } = req.body;

  if (!packId || isNaN(parseInt(packId))) {
    return res.status(400).json({ error: 'Valid pack ID is required' });
  }

  try {
    const pack = await prisma.pack.findUnique({
      where: { id: parseInt(packId) },
      include: {
        drop: {
          include: {
            _count: { select: { designs: true } },
          },
        },
      },
    });

    if (!pack || !pack.isActive) {
      return res.status(404).json({ error: 'Pack not found or inactive' });
    }

    const isInternational = country && country !== 'US';
    const qty = quantity || 1;

    let priceBreakdown;

    switch (pack.type) {
      case 'BUILD_A_PACK':
        // Validate selected designs
        if (!selectedDesignIds || !Array.isArray(selectedDesignIds)) {
          return res.status(400).json({ error: 'Selected design IDs required for build-a-pack' });
        }
        if (selectedDesignIds.length !== pack.designCount) {
          return res.status(400).json({
            error: `Please select exactly ${pack.designCount} designs`,
          });
        }
        priceBreakdown = calculateBuildAPackPrice(
          pack.designCount as PackSize,
          qty,
          isInternational
        );
        break;

      case 'STICKER_SHEET':
        // Map design count to sheet size
        let sheetSize: SheetSize = 'small';
        if (pack.designCount >= 10) sheetSize = 'medium';
        if (pack.designCount >= 15) sheetSize = 'large';
        priceBreakdown = calculateStickerSheetPrice(sheetSize, qty, isInternational);
        break;

      case 'FULL_SET':
        priceBreakdown = calculateFullSetPrice(
          pack.drop._count.designs,
          qty,
          isInternational
        );
        break;

      default:
        return res.status(400).json({ error: 'Invalid pack type' });
    }

    res.status(200).json({
      pack: {
        id: pack.id,
        name: pack.name,
        type: pack.type,
        designCount: pack.designCount,
      },
      pricing: {
        ...priceBreakdown,
        subtotal: `$${(priceBreakdown.subtotalCents / 100).toFixed(2)}`,
        shipping: `$${(priceBreakdown.shippingCents / 100).toFixed(2)}`,
        total: `$${(priceBreakdown.totalCents / 100).toFixed(2)}`,
      },
    });
  } catch (error) {
    console.error('[Shop] Calculate price error:', error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
};

// Create checkout session for pack purchase
export const createPackCheckout: RequestHandler = async (req, res) => {
  const { packId, selectedDesignIds, quantity, shippingDetails } = req.body;

  if (!packId || isNaN(parseInt(packId))) {
    return res.status(400).json({ error: 'Valid pack ID is required' });
  }

  if (!shippingDetails || !shippingDetails.email) {
    return res.status(400).json({ error: 'Shipping details required' });
  }

  try {
    const pack = await prisma.pack.findUnique({
      where: { id: parseInt(packId) },
      include: {
        drop: {
          include: {
            creator: { select: { id: true, storeName: true, name: true } },
            designs: {
              include: {
                image: { select: { id: true, imageUrl: true, noBackgroundUrl: true } },
              },
            },
          },
        },
      },
    });

    if (!pack || !pack.isActive) {
      return res.status(404).json({ error: 'Pack not found or inactive' });
    }

    const isInternational = shippingDetails.country && shippingDetails.country !== 'US';
    const qty = quantity || 1;

    // Calculate pricing
    let priceBreakdown;
    let designsToOrder: { imageId: number; imageUrl: string }[] = [];

    switch (pack.type) {
      case 'BUILD_A_PACK':
        if (!selectedDesignIds || selectedDesignIds.length !== pack.designCount) {
          return res.status(400).json({
            error: `Please select exactly ${pack.designCount} designs`,
          });
        }
        // Verify selected designs belong to this drop
        const validIds = pack.drop.designs.map(d => d.image.id);
        const allValid = selectedDesignIds.every((id: number) => validIds.includes(id));
        if (!allValid) {
          return res.status(400).json({ error: 'Invalid design selection' });
        }
        designsToOrder = pack.drop.designs
          .filter(d => selectedDesignIds.includes(d.image.id))
          .map(d => ({
            imageId: d.image.id,
            imageUrl: d.image.noBackgroundUrl || d.image.imageUrl,
          }));
        priceBreakdown = calculateBuildAPackPrice(
          pack.designCount as PackSize,
          qty,
          isInternational
        );
        break;

      case 'FULL_SET':
        designsToOrder = pack.drop.designs.map(d => ({
          imageId: d.image.id,
          imageUrl: d.image.noBackgroundUrl || d.image.imageUrl,
        }));
        priceBreakdown = calculateFullSetPrice(
          pack.drop.designs.length,
          qty,
          isInternational
        );
        break;

      case 'STICKER_SHEET':
        // For sheets, we'll handle this differently (composite image)
        designsToOrder = pack.drop.designs.slice(0, pack.designCount).map(d => ({
          imageId: d.image.id,
          imageUrl: d.image.noBackgroundUrl || d.image.imageUrl,
        }));
        let sheetSize: SheetSize = 'small';
        if (pack.designCount >= 10) sheetSize = 'medium';
        if (pack.designCount >= 15) sheetSize = 'large';
        priceBreakdown = calculateStickerSheetPrice(sheetSize, qty, isInternational);
        break;

      default:
        return res.status(400).json({ error: 'Invalid pack type' });
    }

    // Create Stripe line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${pack.drop.title} - ${pack.name}`,
            description: `${pack.designCount} sticker pack from ${pack.drop.creator.name || pack.drop.creator.storeName}`,
          },
          unit_amount: priceBreakdown.subtotalCents,
        },
        quantity: qty,
      },
    ];

    // Add shipping as separate line item
    if (priceBreakdown.shippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
          },
          unit_amount: priceBreakdown.shippingCents,
        },
        quantity: 1,
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${frontendUrl}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/shop/${pack.drop.creator.storeName}/${pack.drop.slug}`,
      customer_email: shippingDetails.email,
      metadata: {
        type: 'pack_order',
        packId: pack.id.toString(),
        dropId: pack.dropId.toString(),
        creatorId: pack.drop.creator.id.toString(),
        packType: pack.type,
        designIds: JSON.stringify(designsToOrder.map(d => d.imageId)),
        imageUrls: JSON.stringify(designsToOrder.map(d => d.imageUrl)),
        quantity: qty.toString(),
        shipping_details: JSON.stringify(shippingDetails),
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[Shop] Create checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

// Get fan's collection for a drop
export const getFanCollection: RequestHandler = async (req, res) => {
  const { dropSlug } = req.params;
  const email = req.query.email as string;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const drop = await prisma.drop.findUnique({
      where: { slug: dropSlug },
      include: {
        designs: {
          orderBy: { displayOrder: 'asc' },
          include: {
            image: {
              select: { id: true, imageUrl: true },
            },
          },
        },
      },
    });

    if (!drop) {
      return res.status(404).json({ error: 'Drop not found' });
    }

    // Get fan's collection
    const collection = await prisma.fanCollection.findUnique({
      where: {
        fanEmail_dropId: {
          fanEmail: email.toLowerCase(),
          dropId: drop.id,
        },
      },
    });

    const allDesignIds = drop.designs.map(d => d.image.id);
    const ownedIds = collection ? (collection.ownedDesignIds as number[]) : [];

    res.status(200).json({
      drop: {
        id: drop.id,
        title: drop.title,
        slug: drop.slug,
        totalDesigns: allDesignIds.length,
      },
      collection: {
        ownedCount: ownedIds.length,
        totalCount: allDesignIds.length,
        isComplete: ownedIds.length >= allDesignIds.length,
        ownedDesignIds: ownedIds,
        designs: drop.designs.map(d => ({
          id: d.image.id,
          imageUrl: d.image.imageUrl,
          owned: ownedIds.includes(d.image.id),
        })),
      },
    });
  } catch (error) {
    console.error('[Shop] Get collection error:', error);
    res.status(500).json({ error: 'Failed to get collection' });
  }
};

// Subscribe to notifications
export const subscribeToNotifications: RequestHandler = async (req, res) => {
  const { email, dropId, creatorId } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  if (!dropId && !creatorId) {
    return res.status(400).json({ error: 'Either dropId or creatorId is required' });
  }

  try {
    // Upsert notification subscription
    if (dropId) {
      await prisma.notifyMe.upsert({
        where: {
          email_dropId: {
            email: email.toLowerCase(),
            dropId: parseInt(dropId),
          },
        },
        create: {
          email: email.toLowerCase(),
          dropId: parseInt(dropId),
        },
        update: {},
      });
    } else if (creatorId) {
      // For creator-level subscriptions, we need a different approach
      // since the unique constraint is on email+dropId
      const existing = await prisma.notifyMe.findFirst({
        where: {
          email: email.toLowerCase(),
          creatorId: parseInt(creatorId),
          dropId: null,
        },
      });

      if (!existing) {
        await prisma.notifyMe.create({
          data: {
            email: email.toLowerCase(),
            creatorId: parseInt(creatorId),
          },
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'You\'ll be notified when this drops!',
    });
  } catch (error) {
    console.error('[Shop] Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
};
