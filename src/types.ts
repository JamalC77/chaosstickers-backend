// Shipping details for orders
export interface ShippingDetails {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

// Creator types
export interface CreatorProfile {
  id: number;
  email: string;
  name: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  storeName: string;
  isVerified: boolean;
  createdAt: Date;
}

export interface CreatorStyleTemplate {
  colorPalette?: string[];
  outlineStyle?: 'thick' | 'thin' | 'none';
  allowedThemes?: string[];
  bannedTopics?: string[];
  defaultPromptPrefix?: string;
}

// Drop types
export type DropStatus = 'DRAFT' | 'PUBLISHED' | 'ENDED' | 'ARCHIVED';

export interface DropSummary {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  status: DropStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
  designCount: number;
  orderCount: number;
}

export interface DropDesignItem {
  id: number;
  imageId: number;
  imageUrl: string;
  noBackgroundUrl: string | null;
  prompt: string;
  displayOrder: number;
  isHero: boolean;
}

// Pack types
export type PackType = 'BUILD_A_PACK' | 'STICKER_SHEET' | 'FULL_SET';

export interface PackConfig {
  id: number;
  type: PackType;
  name: string;
  description: string | null;
  designCount: number;
  priceInCents: number;
  isDefault: boolean;
  isActive: boolean;
}

// Order types for pack purchases
export interface PackOrderRequest {
  packId: number;
  selectedDesignIds?: number[]; // Required for BUILD_A_PACK
  quantity: number;
  shippingDetails: ShippingDetails;
}

export interface PackOrderItem {
  imageId: number;
  imageUrl: string;
  printifyProductId?: string;
}

// Collection types
export interface FanCollectionStatus {
  dropId: number;
  dropTitle: string;
  ownedCount: number;
  totalCount: number;
  isComplete: boolean;
  ownedDesignIds: number[];
}

// Earnings types
export interface EarningRecord {
  id: number;
  orderId: number;
  grossRevenue: number;
  printifyCost: number;
  stripeFee: number;
  platformFee: number;
  creatorPayout: number;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt: Date | null;
  createdAt: Date;
}

export interface EarningsStats {
  totalGrossRevenue: number;
  totalPrintifyCost: number;
  totalStripeFee: number;
  totalPlatformFee: number;
  totalPayout: number;
  pendingPayout: number;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiError {
  error: string;
  details?: string[];
}

// Pricing display types
export interface PricingDisplay {
  buildAPack: {
    size: number;
    pricePerSticker: string;
    totalPrice: string;
    discount: string;
  }[];
  stickerSheets: {
    size: string;
    price: string;
    designCount: number;
  }[];
  shipping: {
    usBase: string;
    usAdditional: string;
    freeShippingThreshold: string;
  };
  platformFee: string;
}

// Webhook metadata for pack orders
export interface PackOrderMetadata {
  type: 'pack_order';
  packId: string;
  dropId: string;
  creatorId: string;
  packType: PackType;
  designIds: string; // JSON string of number[]
  imageUrls: string; // JSON string of string[]
  quantity: string;
  shipping_details: string; // JSON string of ShippingDetails
}

// Analytics types
export interface CreatorAnalytics {
  drops: {
    total: number;
    published: number;
    draft: number;
  };
  designs: {
    total: number;
  };
  orders: {
    total: number;
  };
  earnings: {
    totalGross: number;
    totalPayout: number;
  };
  recentOrders: {
    dropTitle: string;
    dropSlug: string;
    status: string;
    amount: number | null;
    createdAt: Date;
  }[];
}
