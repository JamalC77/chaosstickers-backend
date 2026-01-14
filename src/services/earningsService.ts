import { prisma } from '../server';
import { calculateEarnings } from './packPricingService';

// Process earnings for a creator after a successful pack order
export const processCreatorEarnings = async (
  orderId: number,
  creatorId: number,
  totalPaidCents: number,
  printifyProductionCents: number,
  printifyShippingCents: number
): Promise<{
  success: boolean;
  earningId?: number;
  creatorPayoutCents?: number;
  error?: string;
}> => {
  try {
    // Calculate earnings breakdown
    const earnings = calculateEarnings(
      totalPaidCents,
      printifyProductionCents,
      printifyShippingCents
    );

    // Check if earning already exists for this order
    const existingEarning = await prisma.earning.findUnique({
      where: { orderId },
    });

    if (existingEarning) {
      console.log(`[Earnings] Earning already exists for order ${orderId}`);
      return {
        success: true,
        earningId: existingEarning.id,
        creatorPayoutCents: existingEarning.creatorPayout,
      };
    }

    // Create earning record
    const earning = await prisma.earning.create({
      data: {
        creatorId,
        orderId,
        grossRevenue: earnings.grossRevenueCents,
        printifyCost: earnings.printifyCostCents,
        stripeFee: earnings.stripeFeeCents,
        platformFee: earnings.platformFeeCents,
        creatorPayout: earnings.creatorPayoutCents,
        status: 'PENDING',
      },
    });

    console.log(
      `[Earnings] Created earning record for order ${orderId}: ` +
      `gross=$${(earnings.grossRevenueCents / 100).toFixed(2)}, ` +
      `printify=$${(earnings.printifyCostCents / 100).toFixed(2)}, ` +
      `stripe=$${(earnings.stripeFeeCents / 100).toFixed(2)}, ` +
      `platform=$${(earnings.platformFeeCents / 100).toFixed(2)}, ` +
      `creator=$${(earnings.creatorPayoutCents / 100).toFixed(2)}`
    );

    return {
      success: true,
      earningId: earning.id,
      creatorPayoutCents: earning.creatorPayout,
    };
  } catch (error: any) {
    console.error(`[Earnings] Error processing earnings for order ${orderId}:`, error);
    return {
      success: false,
      error: error.message,
    };
  }
};

// Update fan collection after purchase
export const updateFanCollection = async (
  fanEmail: string,
  dropId: number,
  designIds: number[]
): Promise<void> => {
  try {
    // Get the drop to know total design count
    const drop = await prisma.drop.findUnique({
      where: { id: dropId },
      include: {
        _count: { select: { designs: true } },
      },
    });

    if (!drop) {
      console.error(`[Collection] Drop ${dropId} not found`);
      return;
    }

    // Upsert fan collection
    const existingCollection = await prisma.fanCollection.findUnique({
      where: {
        fanEmail_dropId: {
          fanEmail: fanEmail.toLowerCase(),
          dropId,
        },
      },
    });

    let currentOwnedIds: number[] = [];
    if (existingCollection) {
      currentOwnedIds = existingCollection.ownedDesignIds as number[];
    }

    // Merge new design IDs with existing
    const allOwnedIds = [...new Set([...currentOwnedIds, ...designIds])];
    const isComplete = allOwnedIds.length >= drop._count.designs;

    await prisma.fanCollection.upsert({
      where: {
        fanEmail_dropId: {
          fanEmail: fanEmail.toLowerCase(),
          dropId,
        },
      },
      create: {
        fanEmail: fanEmail.toLowerCase(),
        dropId,
        ownedDesignIds: allOwnedIds,
        completedAt: isComplete ? new Date() : null,
      },
      update: {
        ownedDesignIds: allOwnedIds,
        completedAt: isComplete ? new Date() : null,
      },
    });

    console.log(
      `[Collection] Updated collection for ${fanEmail} on drop ${dropId}: ` +
      `${allOwnedIds.length}/${drop._count.designs} designs owned` +
      (isComplete ? ' (COMPLETE!)' : '')
    );
  } catch (error: any) {
    console.error(`[Collection] Error updating fan collection:`, error);
  }
};

// Get pending payouts for a creator
export const getCreatorPendingPayout = async (
  creatorId: number
): Promise<{ pendingCents: number; earningCount: number }> => {
  const result = await prisma.earning.aggregate({
    where: {
      creatorId,
      status: 'PENDING',
    },
    _sum: {
      creatorPayout: true,
    },
    _count: true,
  });

  return {
    pendingCents: result._sum.creatorPayout || 0,
    earningCount: result._count,
  };
};

// Mark earnings as paid (for payout processing)
export const markEarningsAsPaid = async (
  earningIds: number[]
): Promise<{ success: boolean; paidCount: number }> => {
  try {
    const result = await prisma.earning.updateMany({
      where: {
        id: { in: earningIds },
        status: 'PENDING',
      },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    return {
      success: true,
      paidCount: result.count,
    };
  } catch (error: any) {
    console.error('[Earnings] Error marking earnings as paid:', error);
    return {
      success: false,
      paidCount: 0,
    };
  }
};
