import { BaseEntity } from './index.js';

// Payment Method Types
export type PaymentMethodType =
  | 'credit_card'
  | 'bank_transfer'
  | 'digital_wallet';
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'rolled_back';
export type EscrowStatus = 'created' | 'funded' | 'active' | 'released' | 'refunded' | 'disputed' | 'expired';

// Payment Method Interface
export interface PaymentMethod extends BaseEntity {
  userId: string;
  type: PaymentMethodType;
  displayName: string;
  isVerified: boolean;
  metadata: Record<string, unknown>;
}

// Payment Transaction Interface
export interface PaymentTransaction extends BaseEntity {
  swapId: string;
  proposalId: string | null; // NULL for direct swaps, UUID for auction swaps
  payerId: string;
  recipientId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  escrowId?: string;
  gatewayTransactionId: string;
  platformFee: number;
  netAmount: number;
  completedAt?: Date;
  blockchain: PaymentBlockchain;

  // Metadata columns for tracking and debugging
  offerMode: 'auction' | 'direct';
  validationMetadata: PaymentValidationMetadata;
  createdVia: 'auction_proposal' | 'direct_cash_offer' | 'booking_exchange';
}

export interface PaymentBlockchain {
  transactionId: string;
}

// Payment Validation Metadata for debugging and auditing
export interface PaymentValidationMetadata {
  scenario?: 'auction' | 'direct';
  validationPassed?: boolean;
  rollbackAvailable?: boolean;
  validatedAt?: Date;
  validationType?: string;
  rollbackSteps?: RollbackStep[];
  constraintViolations?: string[];
  foreignKeyValidation?: {
    swapExists: boolean;
    proposalExists: boolean | null;
    usersExist: boolean;
  };
}

export interface RollbackStep {
  type: 'delete_auction_proposal' | 'delete_payment_transaction' | 'revert_swap_status';
  data: Record<string, any>;
  executedAt?: Date;
  success?: boolean;
  error?: string;
}

// Escrow Account Interface
export interface EscrowAccount extends BaseEntity {
  transactionId: string;
  swapId: string;
  proposalId: string;
  payerId: string;
  recipientId: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  expiresAt?: Date;
  releasedAt?: Date;
}

// Payment Request Types
export interface PaymentRequest {
  amount: number;
  currency: string;
  payerId: string;
  recipientId: string;
  paymentMethodId: string;
  swapId: string;
  proposalId: string;
  escrowRequired: boolean;
}

export interface EscrowRequest {
  amount: number;
  currency: string;
  payerId: string;
  recipientId: string;
  swapId: string;
  proposalId: string | null; // Allow null for escrow creation before proposal exists
}

export interface EscrowReleaseRequest {
  escrowId: string;
  recipientId: string;
  amount: number;
  reason: string;
}

// Payment Validation Types
export interface PaymentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedFees: PaymentFees;
  requiresEscrow: boolean;
}

export interface PaymentFees {
  platformFee: number;
  processingFee: number;
  totalFees: number;
  netAmount: number;
}

// Payment Processing Results
export interface PaymentProcessingResult {
  transactionId: string;
  status: PaymentStatus;
  gatewayTransactionId: string;
  escrowId?: string;
  fees: PaymentFees;
  estimatedCompletionTime?: Date;
}

export interface EscrowCreationResult {
  escrowId: string;
  status: EscrowStatus;
  amount: number;
  currency: string;
  expiresAt?: Date;
}

// Cash Offer Details
export interface CashOfferDetails {
  amount: number;
  currency: string;
  paymentMethod: string;
  escrowRequired: boolean;
  estimatedFees: PaymentFees;
}

// Payment Receipt
export interface PaymentReceipt {
  transactionId: string;
  swapId: string;
  amount: number;
  currency: string;
  fees: PaymentFees;
  paymentMethod: string;
  completedAt: Date;
  receiptUrl?: string;
}

// Payment Error Types
export interface PaymentErrorDetails {
  code:
  | 'PAYMENT_METHOD_INVALID'
  | 'INSUFFICIENT_FUNDS'
  | 'ESCROW_CREATION_FAILED'
  | 'PAYMENT_PROCESSING_FAILED'
  | 'REFUND_FAILED'
  | 'ESCROW_RELEASE_FAILED';
  transactionId?: string;
  paymentMethodId?: string;
  escrowId?: string;
}

// Risk Assessment
export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  requiresManualReview: boolean;
  additionalVerificationRequired: boolean;
}

// Payment Security Types
export interface PaymentSecurityContext {
  userId: string;
  ipAddress: string;
  deviceFingerprint?: string;
  previousTransactions: number;
  accountAge: number; // days
}

export interface FraudDetectionResult {
  isSuspicious: boolean;
  riskScore: number; // 0-100
  flags: string[];
  recommendedAction: 'approve' | 'review' | 'reject';
}
