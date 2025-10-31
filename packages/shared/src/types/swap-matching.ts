import { BaseEntity } from './index.js';
import { Swap, SwapStatus } from './swap.js';
import { BookingDateRange } from './booking.js';

// Proposal Status Types
export type SwapProposalStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';

// Browse-Initiated Proposal Request Types
export interface CreateProposalFromBrowseRequest {
  targetSwapId: string;
  sourceSwapId?: string; // Optional for cash proposals
  proposerId: string;
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
  cashOffer?: {
    amount: number;
    currency: string;
  };
  walletAddress?: string; // Optional: wallet address to use for the proposal (prevents race conditions)
}

// Proposal Result Types
export interface SwapProposalResult {
  proposalId: string;
  swap: Swap;
  status: 'created' | 'pending_review';
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
  estimatedResponseTime: string;
  nextSteps: string[];
}

// Eligibility Types
export interface EligibleSwap {
  id: string;
  sourceBookingId: string;
  title: string;
  description: string;
  bookingDetails: {
    location: string;
    dateRange: BookingDateRange;
    accommodationType: string;
    guests: number;
    estimatedValue: number;
  };
  status: SwapStatus;
  createdAt: Date;
  isCompatible: boolean;
  compatibilityScore?: number;
}

export interface EligibleSwapsResponse {
  eligibleSwaps: EligibleSwap[];
  totalCount: number;
  compatibilityAnalysis: CompatibilityAnalysis[];
}

// Compatibility Analysis Types
export interface CompatibilityFactor {
  score: number; // 0-100
  weight: number; // Importance weight
  details: string;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface CompatibilityAnalysis {
  overallScore: number; // 0-100
  factors: {
    locationCompatibility: CompatibilityFactor;
    dateCompatibility: CompatibilityFactor;
    valueCompatibility: CompatibilityFactor;
    accommodationCompatibility: CompatibilityFactor;
    guestCompatibility: CompatibilityFactor;
  };
  recommendations: string[];
  potentialIssues: string[];
}

export interface CompatibilityResponse {
  compatibility: CompatibilityAnalysis;
  recommendation: 'highly_recommended' | 'recommended' | 'possible' | 'not_recommended';
}

// Validation Result Types
export interface SwapMatchingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  eligibilityChecks: {
    userOwnsSourceSwap: boolean;
    sourceSwapAvailable: boolean;
    targetSwapAvailable: boolean;
    noExistingProposal: boolean;
    swapsAreCompatible: boolean;
  };
}

export interface ProposalValidationError extends Error {
  code: 'INVALID_SOURCE_SWAP' | 'INVALID_TARGET_SWAP' | 'EXISTING_PROPOSAL' | 'SWAP_NOT_AVAILABLE' | 'USER_NOT_AUTHORIZED';
  details: {
    sourceSwapId?: string;
    targetSwapId?: string;
    userId?: string;
    reason: string;
  };
}

// Enhanced Swap Card Types
export interface SwapCardActions {
  canMakeProposal: boolean;
  canViewDetails: boolean;
  hasEligibleSwaps: boolean;
  proposalButtonText: string;
  // Targeting-specific actions
  canTarget?: boolean;
  targetingRestriction?: 'auction_ended' | 'proposal_pending' | 'own_swap' | 'already_targeted';
  targetButtonText?: string;
}

export interface EnhancedSwapCardProps {
  swap: Swap | SwapWithProposalInfo;
  mode: 'browse' | 'own' | 'manage';
  currentUserId: string;
  actions?: SwapCardActions;
  onMakeProposal?: (swapId: string) => void;
  onViewDetails?: (swapId: string) => void;
  // Targeting-specific props
  userActiveSwap?: Swap;
  onTargetSwap?: (targetSwapId: string) => void;
  onViewTargetingDetails?: (swapId: string) => void;
}

// Enhanced Swap with Proposal Information
export interface SwapWithProposalInfo extends Swap {
  proposalCount?: number;
  userCanPropose?: boolean;
  userEligibleSwapsCount?: number;
  paymentTypes?: PaymentTypePreference;
  acceptanceStrategy?: AcceptanceStrategy;
  auctionId?: string;
  cashDetails?: CashSwapConfiguration;
  // Additional properties for targeting functionality
  sourceBooking?: {
    id: string;
    title: string;
    type: string;
    location?: {
      city: string;
      country: string;
    };
    dateRange?: {
      checkIn: Date;
      checkOut: Date;
    };
    swapValue: number;
  };
  targetBooking?: {
    id: string;
    title: string;
    type: string;
    location?: {
      city: string;
      country: string;
    };
    dateRange?: {
      checkIn: Date;
      checkOut: Date;
    };
    swapValue: number;
  };
  expiresAt?: Date;
  // Targeting information
  targeting?: {
    isTargeting: boolean;
    targetSwapId?: string;
    targetedAt?: Date;
  };
  targetedBy?: {
    count: number;
    recentTargets: any[];
  };
  auctionInfo?: {
    isAuction: boolean;
    endDate?: Date;
    proposalCount: number;
    canReceiveMoreProposals: boolean;
  };
}

// Import types from swap.ts to avoid duplication
import { PaymentTypePreference, AcceptanceStrategy, CashSwapConfiguration } from './swap.js';

// Proposal Form Types
export interface ProposalFormData {
  selectedSwapId: string;
  message?: string;
  conditions: string[];
  agreedToTerms: boolean;
}

export interface ProposalPreview {
  targetSwap: SwapSummary;
  proposedSwap: SwapSummary;
  compatibility: CompatibilityAnalysis;
  estimatedTimeline: ProposalTimeline;
}

export interface SwapSummary {
  id: string;
  title: string;
  location: string;
  dateRange: BookingDateRange;
  estimatedValue: number;
  accommodationType: string;
  guests: number;
}

export interface ProposalTimeline {
  estimatedResponseTime: string;
  proposalExpiresAt: Date;
  nextMilestones: string[];
}

// Modal Component Props
export interface MakeProposalModalProps {
  isOpen: boolean;
  targetSwap: Swap | SwapWithProposalInfo;
  userEligibleSwaps: EligibleSwap[];
  onClose: () => void;
  onSubmit: (proposalData: CreateProposalFromBrowseRequest) => void;
  loading?: boolean;
}

export interface ProposalCreationFormProps {
  targetSwap: Swap | SwapWithProposalInfo;
  eligibleSwaps: EligibleSwap[];
  onSubmit: (data: ProposalFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

// Proposal History Types
export interface ProposalSummary extends BaseEntity {
  sourceSwapId: string;
  targetSwapId: string;
  proposerId: string;
  targetOwnerId: string;
  status: SwapProposalStatus;
  message?: string;
  conditions: string[];
  compatibilityScore?: number;
  respondedAt?: Date;
  expiresAt: Date;
  blockchainTransactionId: string;
  sourceSwapTitle: string;
  targetSwapTitle: string;
}

export interface ProposalHistoryResponse {
  proposals: ProposalSummary[];
  pagination: PaginationInfo;
}

export interface PaginationInfo {
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Error Response Types
export interface ProposalErrorResponse {
  message: string;
  suggestion: string;
  allowedActions: string[];
}

// API Response Types
export interface SwapDetailsResponse {
  swap: Swap;
  proposalCount: number;
  userCanPropose: boolean;
  userEligibleSwapsCount: number;
}

// Proposal Metadata Types
export interface ProposalMetadata {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId: string;
  message?: string;
  compatibilityScore: number;
  createdFromBrowse: boolean;
  proposalSource: 'browse' | 'direct' | 'auction';
  proposerId?: string;
  targetOwnerId?: string;
  blockchainTransactionId?: string;
}