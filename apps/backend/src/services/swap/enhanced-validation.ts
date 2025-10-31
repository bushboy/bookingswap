/**
 * Enhanced Validation Services and Interfaces
 * 
 * This module exports all the enhanced validation services and interfaces
 * required for the payment transaction foreign key fix implementation.
 */

// Core workflow interfaces and types
export * from './SwapOfferWorkflowService';
export * from './SwapOfferErrorHandler';
export * from './SwapOfferTransactionManager';

// Enhanced service interfaces
export * from '../payment/EnhancedPaymentTransactionService';
export * from '../auction/EnhancedAuctionProposalService';
export * from '../monitoring/DatabaseIntegrityMonitor';

// Re-export commonly used types for convenience
export type {
    OfferMode,
    SwapOfferRequest,
    SwapOfferResult,
    ValidationResult,
    ValidationError,
    ValidationWarning,
    SwapValidationResult,
    PaymentTransactionRequest,
    SwapScenario,
    EnhancedSwap
} from './SwapOfferWorkflowService';

export type {
    ValidatedPaymentTransactionRequest,
    PaymentTransactionStatus
} from '../payment/EnhancedPaymentTransactionService';

export type {
    CashProposalRequest
} from '../auction/EnhancedAuctionProposalService';

export type {
    SwapOfferContext,
    RollbackContext,
    RollbackStep,
    DatabaseError,
    PermissionResult,
    PaymentMethodValidation
} from './SwapOfferErrorHandler';

export type {
    TransactionContext,
    ConsistencyResult,
    IntegrityReport,
    CleanupResult,
    ViolationReport,
    DatabaseOperation
} from './SwapOfferTransactionManager';

export type {
    IntegrityCheckOptions,
    IntegrityCheckResult,
    OrphanedRecord
} from '../monitoring/DatabaseIntegrityMonitor';

// Export validation error codes constant
export { VALIDATION_ERROR_CODES } from './SwapOfferWorkflowService';