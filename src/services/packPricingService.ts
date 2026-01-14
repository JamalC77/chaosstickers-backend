// Pack pricing configuration and calculation service
// All prices in cents

export interface PackPricing {
  buildAPack: {
    [designCount: number]: {
      pricePerStickerCents: number;
      discountLabel: string;
    };
  };
  stickerSheet: {
    small: { priceCents: number; designCount: number };
    medium: { priceCents: number; designCount: number };
    large: { priceCents: number; designCount: number };
  };
  shipping: {
    usFirstItemCents: number;
    usAdditionalStickerCents: number;
    usAdditionalSheetCents: number;
    internationalMultiplier: number;
  };
  platformFeeRate: number; // Percentage of profit (0.20 = 20%)
}

// Default pricing configuration
export const DEFAULT_PACK_PRICING: PackPricing = {
  buildAPack: {
    6: { pricePerStickerCents: 280, discountLabel: '20% off' },
    8: { pricePerStickerCents: 260, discountLabel: '25% off' },
    10: { pricePerStickerCents: 250, discountLabel: '30% off' },
  },
  stickerSheet: {
    small: { priceCents: 1499, designCount: 6 },
    medium: { priceCents: 1999, designCount: 10 },
    large: { priceCents: 2499, designCount: 15 },
  },
  shipping: {
    usFirstItemCents: 509,           // $5.09
    usAdditionalStickerCents: 7,      // $0.07
    usAdditionalSheetCents: 40,       // $0.40
    internationalMultiplier: 1.5,     // 50% more for international
  },
  platformFeeRate: 0.20,              // 20% of profit
};

export type PackSize = 6 | 8 | 10;
export type SheetSize = 'small' | 'medium' | 'large';

export interface BuildAPackOrder {
  type: 'build_a_pack';
  packSize: PackSize;
  quantity: number;
}

export interface StickerSheetOrder {
  type: 'sticker_sheet';
  sheetSize: SheetSize;
  quantity: number;
}

export interface FullSetOrder {
  type: 'full_set';
  designCount: number;
  quantity: number;
}

export type PackOrder = BuildAPackOrder | StickerSheetOrder | FullSetOrder;

export interface PriceBreakdown {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  itemCount: number;
  savingsLabel?: string;
}

// Calculate price for a build-a-pack order
export const calculateBuildAPackPrice = (
  packSize: PackSize,
  quantity: number = 1,
  isInternational: boolean = false,
  pricing: PackPricing = DEFAULT_PACK_PRICING
): PriceBreakdown => {
  const packPricing = pricing.buildAPack[packSize];
  if (!packPricing) {
    throw new Error(`Invalid pack size: ${packSize}`);
  }

  const subtotalCents = packPricing.pricePerStickerCents * packSize * quantity;

  // Calculate shipping: first item + additional items
  const totalStickers = packSize * quantity;
  let shippingCents = pricing.shipping.usFirstItemCents;
  if (totalStickers > 1) {
    shippingCents += (totalStickers - 1) * pricing.shipping.usAdditionalStickerCents;
  }

  if (isInternational) {
    shippingCents = Math.round(shippingCents * pricing.shipping.internationalMultiplier);
  }

  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    itemCount: totalStickers,
    savingsLabel: packPricing.discountLabel,
  };
};

// Calculate price for a sticker sheet order
export const calculateStickerSheetPrice = (
  sheetSize: SheetSize,
  quantity: number = 1,
  isInternational: boolean = false,
  pricing: PackPricing = DEFAULT_PACK_PRICING
): PriceBreakdown => {
  const sheetPricing = pricing.stickerSheet[sheetSize];
  if (!sheetPricing) {
    throw new Error(`Invalid sheet size: ${sheetSize}`);
  }

  const subtotalCents = sheetPricing.priceCents * quantity;

  // Sheets ship as single items
  let shippingCents = pricing.shipping.usFirstItemCents;
  if (quantity > 1) {
    shippingCents += (quantity - 1) * pricing.shipping.usAdditionalSheetCents;
  }

  if (isInternational) {
    shippingCents = Math.round(shippingCents * pricing.shipping.internationalMultiplier);
  }

  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    itemCount: quantity,
    savingsLabel: `${sheetPricing.designCount} designs per sheet`,
  };
};

// Calculate price for a full set order
export const calculateFullSetPrice = (
  designCount: number,
  quantity: number = 1,
  isInternational: boolean = false,
  pricing: PackPricing = DEFAULT_PACK_PRICING
): PriceBreakdown => {
  // Full set gets best per-sticker price ($2.50)
  const pricePerStickerCents = 250;
  const subtotalCents = pricePerStickerCents * designCount * quantity;

  const totalStickers = designCount * quantity;
  let shippingCents = pricing.shipping.usFirstItemCents;
  if (totalStickers > 1) {
    shippingCents += (totalStickers - 1) * pricing.shipping.usAdditionalStickerCents;
  }

  // Free shipping for full sets of 10+ designs
  if (designCount >= 10) {
    shippingCents = 0;
  }

  if (isInternational && shippingCents > 0) {
    shippingCents = Math.round(shippingCents * pricing.shipping.internationalMultiplier);
  }

  return {
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    itemCount: totalStickers,
    savingsLabel: designCount >= 10 ? 'Free shipping + 30% off' : '30% off',
  };
};

// Calculate earnings breakdown for a creator
export interface EarningsBreakdown {
  grossRevenueCents: number;
  printifyCostCents: number;
  stripeFeeCents: number;
  platformFeeCents: number;
  creatorPayoutCents: number;
  profitCents: number;
}

export const calculateEarnings = (
  totalPaidCents: number,
  printifyProductionCents: number,
  printifyShippingCents: number,
  platformFeeRate: number = DEFAULT_PACK_PRICING.platformFeeRate
): EarningsBreakdown => {
  const grossRevenueCents = totalPaidCents;
  const printifyCostCents = printifyProductionCents + printifyShippingCents;

  // Stripe fee: 2.9% + $0.30
  const stripeFeeCents = Math.round(grossRevenueCents * 0.029) + 30;

  // Profit before platform fee
  const profitCents = grossRevenueCents - printifyCostCents - stripeFeeCents;

  // Platform takes percentage of profit (only if there's profit)
  const platformFeeCents = profitCents > 0 ? Math.round(profitCents * platformFeeRate) : 0;

  // Creator gets the rest
  const creatorPayoutCents = profitCents - platformFeeCents;

  return {
    grossRevenueCents,
    printifyCostCents,
    stripeFeeCents,
    platformFeeCents,
    creatorPayoutCents: Math.max(0, creatorPayoutCents), // Never negative
    profitCents,
  };
};

// Estimate Printify costs (before actual order)
// These are rough estimates based on typical Printify pricing
export const estimatePrintifyCosts = (
  stickerCount: number,
  isSheet: boolean = false
): { productionCents: number; shippingCents: number } => {
  if (isSheet) {
    // Sticker sheets have different production costs
    return {
      productionCents: 599, // ~$5.99 per sheet
      shippingCents: 509,   // $5.09 first item
    };
  }

  // Individual stickers (Kiss-Cut Vinyl)
  // Production: ~$2.00-2.50 per sticker depending on size
  const productionCents = stickerCount * 220; // ~$2.20 avg

  // Shipping: $5.09 first + $0.07 each additional
  let shippingCents = 509;
  if (stickerCount > 1) {
    shippingCents += (stickerCount - 1) * 7;
  }

  return { productionCents, shippingCents };
};

// Get pricing display info for the UI
export const getPricingDisplay = (pricing: PackPricing = DEFAULT_PACK_PRICING) => {
  return {
    buildAPack: Object.entries(pricing.buildAPack).map(([size, p]) => ({
      size: parseInt(size),
      pricePerSticker: `$${(p.pricePerStickerCents / 100).toFixed(2)}`,
      totalPrice: `$${((p.pricePerStickerCents * parseInt(size)) / 100).toFixed(2)}`,
      discount: p.discountLabel,
    })),
    stickerSheets: Object.entries(pricing.stickerSheet).map(([size, p]) => ({
      size,
      price: `$${(p.priceCents / 100).toFixed(2)}`,
      designCount: p.designCount,
    })),
    shipping: {
      usBase: `$${(pricing.shipping.usFirstItemCents / 100).toFixed(2)}`,
      usAdditional: `$${(pricing.shipping.usAdditionalStickerCents / 100).toFixed(2)}`,
      freeShippingThreshold: '10+ stickers or full set',
    },
    platformFee: `${pricing.platformFeeRate * 100}% of profit`,
  };
};
