import { BaseEntity } from './base.js';

// Completion validation result interfaces
export interface CompletionValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    inconsistentEntities: string[];
    correctionAttempts?: CorrectionAttempt[];
}

export interface CorrectionAttempt {
    entityType: 'swap' | 'booking' | 'proposal';
    entityId: string;
    expectedStatus: string;
    actualStatus: string;
    correctionApplied: boolean;
    correctionError?: string;
}

// Swap completion audit model
export interface SwapCompletionAudit extends BaseEntity {
    proposalId: string;
    completionType: 'booking_exchange' | 'cash_payment';
    initiatedBy: string;
    completedAt: Date;

    // Entities involved
    affectedSwaps: string[];
    affectedBookings: string[];

    // Transaction details
    databaseTransactionId: string;
    blockchainTransactionId?: string;

    // Status tracking
    status: 'initiated' | 'completed' | 'failed' | 'rolled_back';
    errorDetails?: string;

    // Validation results
    preValidationResult?: CompletionValidationResult;
    postValidationResult?: CompletionValidationResult;
}

// Enhanced swap completion tracking
export interface SwapCompletion {
    completedAt?: Date;
    completedBy?: string;
    completionTransactionId?: string;
    relatedSwapCompletions?: string[]; // IDs of other swaps completed in same transaction
    blockchainCompletionId?: string;
}

// Enhanced booking swap completion tracking
export interface BookingSwapCompletion {
    swappedAt?: Date;
    swapTransactionId?: string;
    originalOwnerId?: string; // For tracking ownership transfers
    swapCompletionId?: string;
    relatedBookingSwaps?: string[]; // IDs of other bookings swapped in same transaction
}

// Completion request and result interfaces
export interface SwapCompletionRequest {
    proposalId: string;
    acceptingUserId: string;
    proposalType: 'booking' | 'cash';
    sourceSwapId: string;
    targetSwapId?: string; // For booking exchanges
    paymentTransactionId?: string; // For cash payments
}

export interface CompletedSwapInfo {
    swapId: string;
    previousStatus: string;
    newStatus: string;
    completedAt: Date;
}

export interface CompletedBookingInfo {
    bookingId: string;
    previousStatus: string;
    newStatus: string;
    swappedAt: Date;
    newOwnerId?: string; // For ownership transfers
}

export interface SwapCompletionResult {
    completedSwaps: CompletedSwapInfo[];
    updatedBookings: CompletedBookingInfo[];
    proposal: any; // Will be typed as SwapProposal when imported
    blockchainTransaction: {
        transactionId: string;
        consensusTimestamp?: string;
    };
    completionTimestamp: Date;
}

// Related entities for completion processing
export interface RelatedEntities {
    proposal: any; // SwapProposal type
    sourceSwap: any; // Swap type
    sourceBooking: any; // Booking type
    targetSwap?: any; // Swap type
    targetBooking?: any; // Booking type
    paymentTransaction?: any; // PaymentTransaction type
}

// Completion transaction data for atomic operations
export interface CompletionTransactionData {
    swapUpdates: Array<{
        swapId: string;
        status: string;
        completedAt: Date;
        blockchainTransactionId?: string;
    }>;
    bookingUpdates: Array<{
        bookingId: string;
        status: string;
        swappedAt: Date;
        newOwnerId?: string;
    }>;
    proposalUpdate: {
        proposalId: string;
        status: 'accepted';
        respondedAt: Date;
        respondedBy: string;
    };
}

// Rollback result interface
export interface RollbackResult {
    success: boolean;
    restoredEntities: string[];
    failedRestorations: string[];
    requiresManualIntervention: boolean;
    errorDetails?: string;
}

// Error codes for completion operations
export enum SwapCompletionErrorCodes {
    INVALID_PROPOSAL_STATE = 'INVALID_PROPOSAL_STATE',
    MISSING_RELATED_ENTITIES = 'MISSING_RELATED_ENTITIES',
    COMPLETION_VALIDATION_FAILED = 'COMPLETION_VALIDATION_FAILED',
    DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
    BLOCKCHAIN_RECORDING_FAILED = 'BLOCKCHAIN_RECORDING_FAILED',
    INCONSISTENT_ENTITY_STATES = 'INCONSISTENT_ENTITY_STATES',
    AUTOMATIC_CORRECTION_FAILED = 'AUTOMATIC_CORRECTION_FAILED',
    ROLLBACK_FAILED = 'ROLLBACK_FAILED'
}

// Completion error class
export class SwapCompletionError extends Error {
    constructor(
        public code: SwapCompletionErrorCodes,
        public message: string,
        public affectedEntities?: string[],
        public details?: Record<string, any>
    ) {
        super(message);
        this.name = 'SwapCompletionError';
    }
}

// WebSocket event for real-time completion updates
export interface SwapCompletionUpdate {
    completionId: string;
    status: 'initiated' | 'completed' | 'failed';
    affectedSwaps: string[];
    affectedBookings: string[];
    completedAt?: Date;
    errorDetails?: string;
}

// Configuration interface for completion system
export interface SwapCompletionConfig {
    maxConcurrentCompletions: number;
    completionTimeoutMs: number;
    validationLevel: 'basic' | 'comprehensive';
    automaticCorrectionEnabled: boolean;
    rollbackTimeoutMs: number;
    blockchainRetryAttempts: number;
}