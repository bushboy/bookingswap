import { BaseEntity } from './index.js';
import { BookingDetails } from './swap-with-booking-details.js';

export type SwapStatus = 'pending' | 'active' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface SwapTerms {
  additionalPayment?: number;
  conditions: string[];
  expiresAt: Date;
}

export interface SwapBlockchain {
  proposalTransactionId: string;
  executionTransactionId?: string;
  escrowContractId?: string;
}

export interface SwapTimeline {
  proposedAt: Date;
  respondedAt?: Date;
  completedAt?: Date;
}

export interface Swap extends BaseEntity {
  sourceBookingId: string;
  status: SwapStatus;
  terms: SwapTerms;
  blockchain: SwapBlockchain;
  timeline: SwapTimeline;
}

// Interface for swap data with derived relationships
export interface SwapWithRelationships extends Swap {
  // Derived proposer information
  proposerId: string;
  proposerName: string;
  proposerBooking: BookingDetails;

  // Derived target information (if targeting)
  targetBookingId?: string;
  targetOwnerId?: string;
  targetOwnerName?: string;
  targetBooking?: BookingDetails;

  // Targeting metadata
  isTargeting: boolean;
  isTargeted: boolean;
  targetingCreatedAt?: Date;
}

// Enhanced Swap Types for Payment and Auction Features

export interface PaymentTypePreference {
  bookingExchange: boolean;
  cashPayment: boolean;
  minimumCashAmount?: number;
  preferredCashAmount?: number;
}

export type AcceptanceStrategyType = 'first_match' | 'auction';

export interface AcceptanceStrategy {
  type: AcceptanceStrategyType;
  auctionEndDate?: Date;
  autoSelectHighest?: boolean;
}



export interface CashSwapConfiguration {
  enabled: boolean;
  minimumAmount: number;
  preferredAmount?: number;
  currency: string;
  escrowRequired: boolean;
  platformFeePercentage: number;
}

export interface EnhancedSwap extends Swap {
  paymentTypes: PaymentTypePreference;
  acceptanceStrategy: AcceptanceStrategy;
  auctionId?: string;
  cashDetails?: CashSwapConfiguration;
}

// Enhanced Swap Creation Request
export interface EnhancedCreateSwapRequest {
  sourceBookingId: string;
  title: string;
  description: string;
  paymentTypes: PaymentTypePreference;
  acceptanceStrategy: AcceptanceStrategy;
  auctionSettings?: {
    endDate: Date;
    allowBookingProposals: boolean;
    allowCashProposals: boolean;
    minimumCashOffer?: number;
    autoSelectAfterHours?: number;
  };
  swapPreferences: SwapPreferences;
  expirationDate: Date;
  walletAddress: string;
}

export interface SwapPreferences {
  preferredLocations?: string[];
  preferredDates?: Date[];
  additionalRequirements?: string[];
}

// Enhanced Swap Response Types
export interface EnhancedSwapResult {
  swap: EnhancedSwap;
  auction?: any; // Will be typed as SwapAuction when imported
  validationWarnings?: string[];
}

export interface CreateEnhancedProposalRequest {
  swapId: string;
  proposalType: 'booking' | 'cash';
  bookingId?: string;
  cashOffer?: {
    amount: number;
    currency: string;
    paymentMethodId: string;
    escrowAgreement: boolean;
  };
  message?: string;
  conditions: string[];
}

// Swap Filtering and Search Types
export interface SwapFilters {
  paymentTypes?: ('booking' | 'cash')[];
  acceptanceStrategy?: AcceptanceStrategyType[];
  priceRange?: {
    min?: number;
    max?: number;
  };
  locations?: string[];
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  auctionStatus?: ('active' | 'ending_soon' | 'ended')[];
}

export interface SwapSearchCriteria extends SwapFilters {
  query?: string;
  sortBy?: 'created_date' | 'event_date' | 'price' | 'auction_end_date';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Enhanced Swap Statistics
export interface SwapStatistics {
  totalSwaps: number;
  activeAuctions: number;
  completedSwaps: number;
  averageAuctionDuration: number; // hours
  averageCashOffer: number;
  successRate: number; // percentage
}

// Comprehensive Swap Proposal Interface
export interface SwapProposal extends BaseEntity {
  sourceSwapId: string;
  targetSwapId?: string; // For booking proposals
  proposerId: string;
  targetUserId: string;
  proposalType: 'booking' | 'cash';
  status: 'pending' | 'accepted' | 'rejected' | 'expired';

  // Financial proposal fields
  cashOffer?: {
    amount: number;
    currency: string;
    escrowAccountId?: string;
    paymentMethodId: string;
  };

  // Acceptance/Rejection tracking
  respondedAt?: Date;
  respondedBy?: string;
  rejectionReason?: string;

  // Blockchain tracking
  blockchain?: {
    proposalTransactionId?: string;
    responseTransactionId?: string;
  };

  // Additional metadata
  message?: string;
  conditions: string[];
  expiresAt: Date;
}

// Swap Card Data Types for Frontend Display
export interface SwapProposalCard {
  id: string;
  proposerId: string; // Will never equal current user's ID
  proposerName: string;
  targetBookingDetails: BookingDetails;
  status: SwapStatus;
  createdAt: Date;
  additionalPayment?: number;
  conditions: string[];
  expiresAt?: Date;
}

export interface SwapCardData {
  userSwap: {
    id: string;
    bookingDetails: BookingDetails;
    status: SwapStatus;
    createdAt: Date;
    expiresAt?: Date;
  };
  proposalsFromOthers: SwapProposalCard[]; // Only proposals from other users
  proposalCount: number; // Count of valid proposals from others
}

// Data Transfer Objects for API responses with derived relationships
export interface SwapWithRelationshipsDTO {
  // Core swap data
  id: string;
  sourceBookingId: string;
  status: SwapStatus;
  terms: SwapTerms;
  blockchain: SwapBlockchain;
  timeline: SwapTimeline;
  createdAt: Date;
  updatedAt: Date;

  // Derived proposer information
  proposerId: string;
  proposerName: string;
  proposerBooking: BookingDetails;

  // Derived target information (if targeting)
  targetBookingId?: string;
  targetOwnerId?: string;
  targetOwnerName?: string;
  targetBooking?: BookingDetails;

  // Targeting metadata
  isTargeting: boolean;
  isTargeted: boolean;
  targetingCreatedAt?: Date;
}

export interface SwapListResponseDTO {
  swaps: SwapWithRelationshipsDTO[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
  metadata: {
    hasMore: boolean;
    totalPages: number;
    currentPage: number;
  };
}

export interface SwapDetailsResponseDTO extends SwapWithRelationshipsDTO {
  // Additional details for single swap responses
  enhancedData?: {
    paymentTypes?: PaymentTypePreference;
    acceptanceStrategy?: AcceptanceStrategy;
    cashDetails?: CashSwapConfiguration;
  };
}