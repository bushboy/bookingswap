export { SwapProposalService, TargetingDisplayError, TargetingDisplayErrorCodes } from './SwapProposalService';
export { SwapResponseService } from './SwapResponseService';
export { SwapExpirationService } from './SwapExpirationService';
export { AtomicSwapService } from './AtomicSwapService';
export { SwapMatchingService } from './SwapMatchingService';
export { CompatibilityAnalysisEngine } from './CompatibilityAnalysisEngine';
export { ProposalCreationWorkflow } from './ProposalCreationWorkflow';
export { ProposalVerificationService } from './ProposalVerificationService';
export { ProposalAcceptanceService } from './ProposalAcceptanceService';

export type {
  CreateSwapProposalRequest,
  SwapProposalResult,
} from './SwapProposalService';

export type {
  ProposalAcceptanceRequest,
  ProposalAcceptanceResult,
  FinancialTransferRequest,
  FinancialTransferResult,
} from './ProposalAcceptanceService';

export type {
  SwapResponseRequest,
  SwapResponseResult,
} from './SwapResponseService';

export type {
  SwapExecutionRequest,
  SwapExecutionResult,
  SwapVerification,
  SwapExecutionContext,
} from './AtomicSwapService';

export type {
  SwapBookingDetails,
  LocationAnalysisConfig,
  DateAnalysisConfig,
  ValueAnalysisConfig,
  CompatibilityWeights,
} from './CompatibilityAnalysisEngine';

export type {
  SwapLockInfo,
} from './ProposalCreationWorkflow';

export type {
  ProposalAuthenticityResult,
  ProposalDisputeResult,
} from './ProposalVerificationService';

// Enhanced validation services and interfaces
export * from './enhanced-validation';

// Swap Offer Workflow Service
export {
  SwapOfferWorkflowService,
  SwapOfferWorkflowServiceImpl,
  type SwapOfferRequest,
  type SwapOfferResult,
  type OfferMode,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type SwapValidationResult,
  type PaymentTransactionRequest,
  type SwapScenario,
  type EnhancedSwap,
  VALIDATION_ERROR_CODES
} from './SwapOfferWorkflowService';

export { SwapOfferWorkflowServiceFactory } from './SwapOfferWorkflowServiceFactory';

// Targeting Data Transformer
export {
  TargetingDataTransformer,
  type BidirectionalQueryResult,
  type TargetingDisplayData,
  type IncomingTargetDisplay,
  type OutgoingTargetDisplay,
  type TargetingIndicator,
  type TargetingIssue,
  type TargetingValidationResult
} from './TargetingDataTransformer';

// Targeting Error Handling
export { TargetingDisplayErrorHandler } from './TargetingDisplayErrorHandler';
export { TargetingValidationService } from './TargetingValidationService';

// Completion Transaction Manager
export { CompletionTransactionManager } from './CompletionTransactionManager';
export type { CompletionTransactionResult } from './CompletionTransactionManager';

// Completion Validation Service
export { CompletionValidationService } from './CompletionValidationService';

// Completion Rollback Manager
export { CompletionRollbackManager } from './CompletionRollbackManager';

// Swap Completion Orchestrator
export { SwapCompletionOrchestrator } from './SwapCompletionOrchestrator';

// Swap Completion Audit Services
export { SwapCompletionAuditService } from './SwapCompletionAuditService';
export { SwapCompletionAuditCleanupService } from './SwapCompletionAuditCleanupService';