import { BaseEntity } from './index.js';

// Auction Status Types
export type AuctionStatus = 'active' | 'ended' | 'cancelled';
export type ProposalStatus = 'pending' | 'selected' | 'rejected';
export type ProposalType = 'booking' | 'cash';

// Core Auction Interface
export interface SwapAuction extends BaseEntity {
  swapId: string;
  ownerId: string;
  status: AuctionStatus;
  settings: AuctionSettings;
  proposals: AuctionProposal[];
  winningProposalId?: string;
  endedAt?: Date;
  blockchain: AuctionBlockchain;
}

export interface AuctionSettings {
  endDate: Date;
  allowBookingProposals: boolean;
  allowCashProposals: boolean;
  minimumCashOffer?: number;
  autoSelectAfterHours?: number;
}

export interface AuctionBlockchain {
  creationTransactionId: string;
  endTransactionId?: string;
}

// Auction Proposal Types
export interface AuctionProposal extends BaseEntity {
  auctionId: string;
  proposerId: string;
  proposalType: ProposalType;
  bookingId?: string;
  cashOffer?: CashOffer;
  message?: string;
  conditions: string[];
  status: ProposalStatus;
  submittedAt: Date;
  blockchain: ProposalBlockchain;
}

export interface ProposalBlockchain {
  transactionId: string;
}

export interface CashOffer {
  amount: number;
  currency: string;
  paymentMethodId: string;
  escrowAccountId?: string;
  escrowRequired: boolean;
}

// Auction Creation and Management
export interface CreateAuctionRequest {
  swapId: string;
  settings: AuctionSettings;
}

export interface CreateProposalRequest {
  swapId: string;
  proposerId?: string; // Will be set from auth context in most cases
  proposalType: ProposalType;
  bookingId?: string; // For booking proposals
  cashOffer?: CashOfferRequest; // For cash proposals
  message?: string;
  conditions: string[];
}

export interface CashOfferRequest {
  amount: number;
  currency: string;
  paymentMethodId: string;
  escrowAgreement: boolean;
}

// Auction Results and Responses
export interface AuctionResult {
  auctionId: string;
  status: AuctionStatus;
  winningProposalId?: string;
  endedAt: Date;
  totalProposals: number;
}

export interface ProposalResult {
  proposalId: string;
  status: ProposalStatus;
  submittedAt: Date;
  validationErrors?: string[];
}

// Timing Validation Types
export interface AuctionTimingValidation {
  eventDate: Date;
  auctionEndDate: Date;
  isValid: boolean;
  minimumEndDate: Date;
  isLastMinute: boolean;
  errors: string[];
}

export interface ProposalValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  paymentMethodValid?: boolean;
  escrowRequired?: boolean;
}

// Auction Dashboard and UI Types
export interface AuctionDashboardData {
  auction: SwapAuction;
  proposals: AuctionProposal[];
  canSelectWinner: boolean;
  timeRemaining: number; // milliseconds
}

export interface ProposalComparison {
  bookingProposals: AuctionProposal[];
  cashProposals: AuctionProposal[];
  highestCashOffer?: CashOffer;
  recommendedProposal?: string; // proposal ID
}