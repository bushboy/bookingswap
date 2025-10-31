import { SwapPlatformError, ErrorContext, ERROR_CODES } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

/**
 * Specific error codes for proposal acceptance operations
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export const PROPOSAL_ACCEPTANCE_ERROR_CODES = {
    // Proposal validation errors
    PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
    PROPOSAL_ALREADY_RESPONDED: 'PROPOSAL_ALREADY_RESPONDED',
    PROPOSAL_EXPIRED: 'PROPOSAL_EXPIRED',
    INVALID_PROPOSAL_STATUS: 'INVALID_PROPOSAL_STATUS',

    // Authorization errors
    UNAUTHORIZED_USER: 'UNAUTHORIZED_USER',
    INVALID_TARGET_USER: 'INVALID_TARGET_USER',
    PROPOSAL_OWNERSHIP_VIOLATION: 'PROPOSAL_OWNERSHIP_VIOLATION',

    // Payment processing errors
    PAYMENT_PROCESSING_FAILED: 'PAYMENT_PROCESSING_FAILED',
    ESCROW_VALIDATION_FAILED: 'ESCROW_VALIDATION_FAILED',
    ESCROW_TRANSFER_FAILED: 'ESCROW_TRANSFER_FAILED',
    INSUFFICIENT_ESCROW_FUNDS: 'INSUFFICIENT_ESCROW_FUNDS',
    PAYMENT_METHOD_UNAVAILABLE: 'PAYMENT_METHOD_UNAVAILABLE',

    // Blockchain recording errors
    BLOCKCHAIN_RECORDING_FAILED: 'BLOCKCHAIN_RECORDING_FAILED',
    BLOCKCHAIN_TRANSACTION_TIMEOUT: 'BLOCKCHAIN_TRANSACTION_TIMEOUT',
    BLOCKCHAIN_CONSENSUS_FAILED: 'BLOCKCHAIN_CONSENSUS_FAILED',
    BLOCKCHAIN_RETRY_EXHAUSTED: 'BLOCKCHAIN_RETRY_EXHAUSTED',

    // Database transaction errors
    DATABASE_TRANSACTION_FAILED: 'DATABASE_TRANSACTION_FAILED',
    DATABASE_ROLLBACK_FAILED: 'DATABASE_ROLLBACK_FAILED',
    CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
    DATA_INTEGRITY_VIOLATION: 'DATA_INTEGRITY_VIOLATION',

    // Rollback and recovery errors
    ROLLBACK_OPERATION_FAILED: 'ROLLBACK_OPERATION_FAILED',
    PARTIAL_ROLLBACK_COMPLETED: 'PARTIAL_ROLLBACK_COMPLETED',
    MANUAL_INTERVENTION_REQUIRED: 'MANUAL_INTERVENTION_REQUIRED',
    RECOVERY_STATE_INCONSISTENT: 'RECOVERY_STATE_INCONSISTENT',

    // Integration errors
    NOTIFICATION_DELIVERY_FAILED: 'NOTIFICATION_DELIVERY_FAILED',
    SWAP_CREATION_FAILED: 'SWAP_CREATION_FAILED',
    BOOKING_SERVICE_ERROR: 'BOOKING_SERVICE_ERROR',

    // System errors
    OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
    RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',
    SYSTEM_OVERLOADED: 'SYSTEM_OVERLOADED'
} as const;

export type ProposalAcceptanceErrorCode = typeof PROPOSAL_ACCEPTANCE_ERROR_CODES[keyof typeof PROPOSAL_ACCEPTANCE_ERROR_CODES];

/**
 * Enhanced error context for proposal acceptance operations
 */
export interface ProposalAcceptanceErrorContext extends ErrorContext {
    proposalId?: string;
    userId?: string;
    action?: 'accept' | 'reject' | 'rollback';
    proposalType?: 'booking' | 'cash';
    paymentTransactionId?: string;
    blockchainTransactionId?: string;
    escrowAccountId?: string;
    rollbackData?: {
        stepsCompleted: string[];
        stepsToRollback: string[];
        rollbackStartedAt: Date;
    };
    retryAttempt?: number;
    maxRetries?: number;
    operationStartTime?: Date;
    errorSource?: 'validation' | 'database' | 'blockchain' | 'payment' | 'notification' | 'system';
}

/**
 * Comprehensive error class for proposal acceptance operations
 * Provides detailed error information and recovery guidance
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class ProposalAcceptanceError extends SwapPlatformError {
    public readonly proposalId?: string;
    public readonly userId?: string;
    public readonly action?: 'accept' | 'reject' | 'rollback';
    public readonly errorSource?: string;
    public readonly rollbackRequired: boolean;
    public readonly manualInterventionRequired: boolean;
    public readonly recoveryActions: string[];

    constructor(
        code: ProposalAcceptanceErrorCode,
        message: string,
        context?: ProposalAcceptanceErrorContext,
        originalError?: Error
    ) {
        const category = ProposalAcceptanceError.determineErrorCategory(code);
        const retryable = ProposalAcceptanceError.isRetryable(code);

        super(code, message, category, retryable, context, originalError);

        this.name = 'ProposalAcceptanceError';
        this.proposalId = context?.proposalId;
        this.userId = context?.userId;
        this.action = context?.action;
        this.errorSource = context?.errorSource;
        this.rollbackRequired = ProposalAcceptanceError.requiresRollback(code);
        this.manualInterventionRequired = ProposalAcceptanceError.requiresManualIntervention(code);
        this.recoveryActions = ProposalAcceptanceError.getRecoveryActions(code);

        // Log error creation for monitoring
        this.logErrorCreation();
    }

    /**
     * Determine error category based on error code
     */
    private static determineErrorCategory(code: ProposalAcceptanceErrorCode): 'validation' | 'business' | 'blockchain' | 'integration' | 'server_error' {
        // Use string comparison to avoid TypeScript strict checking issues
        const codeStr = code as string;

        if (codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_NOT_FOUND ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.INVALID_PROPOSAL_STATUS ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_EXPIRED) {
            return 'validation';
        }

        if (codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.UNAUTHORIZED_USER ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_OWNERSHIP_VIOLATION ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_ALREADY_RESPONDED) {
            return 'business';
        }

        if (codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_TRANSACTION_TIMEOUT ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_CONSENSUS_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RETRY_EXHAUSTED) {
            return 'blockchain';
        }

        if (codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.NOTIFICATION_DELIVERY_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BOOKING_SERVICE_ERROR ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED) {
            return 'integration';
        }

        return 'server_error';
    }

    /**
     * Determine if error is retryable
     */
    private static isRetryable(code: ProposalAcceptanceErrorCode): boolean {
        const codeStr = code as string;

        return codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_TRANSACTION_TIMEOUT ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_TRANSACTION_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.NOTIFICATION_DELIVERY_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.OPERATION_TIMEOUT ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.RESOURCE_UNAVAILABLE ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.SYSTEM_OVERLOADED;
    }

    /**
     * Determine if error requires rollback
     */
    private static requiresRollback(code: ProposalAcceptanceErrorCode): boolean {
        const codeStr = code as string;

        return codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_TRANSACTION_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.ESCROW_TRANSFER_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.SWAP_CREATION_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.DATA_INTEGRITY_VIOLATION;
    }

    /**
     * Determine if error requires manual intervention
     */
    private static requiresManualIntervention(code: ProposalAcceptanceErrorCode): boolean {
        const codeStr = code as string;

        return codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.MANUAL_INTERVENTION_REQUIRED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.RECOVERY_STATE_INCONSISTENT ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_ROLLBACK_FAILED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.PARTIAL_ROLLBACK_COMPLETED ||
            codeStr === PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RETRY_EXHAUSTED;
    }

    /**
     * Get recovery actions for specific error codes
     */
    private static getRecoveryActions(code: ProposalAcceptanceErrorCode): string[] {
        const codeStr = code as string;

        switch (codeStr) {
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_NOT_FOUND:
                return [
                    'Verify proposal ID is correct',
                    'Check if proposal was deleted or expired',
                    'Refresh proposal data from database'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_ALREADY_RESPONDED:
                return [
                    'Check current proposal status',
                    'Verify user permissions',
                    'Review proposal response history'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.UNAUTHORIZED_USER:
                return [
                    'Verify user authentication',
                    'Check user permissions for this proposal',
                    'Validate proposal ownership'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED:
                return [
                    'Verify payment method is valid',
                    'Check escrow account status',
                    'Retry payment processing',
                    'Initiate rollback if necessary'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED:
                return [
                    'Check blockchain network status',
                    'Verify transaction parameters',
                    'Retry with exponential backoff',
                    'Consider manual blockchain submission'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_TRANSACTION_FAILED:
                return [
                    'Check database connectivity',
                    'Verify transaction isolation level',
                    'Retry database operation',
                    'Initiate rollback procedure'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.MANUAL_INTERVENTION_REQUIRED:
                return [
                    'Contact system administrator',
                    'Review error logs and context',
                    'Perform manual data verification',
                    'Execute manual recovery procedures'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.ESCROW_TRANSFER_FAILED:
                return [
                    'Verify escrow account status',
                    'Check fund availability',
                    'Validate transfer parameters',
                    'Initiate escrow rollback'
                ];
            case PROPOSAL_ACCEPTANCE_ERROR_CODES.ROLLBACK_OPERATION_FAILED:
                return [
                    'Review rollback logs',
                    'Identify failed rollback steps',
                    'Execute manual rollback',
                    'Verify system consistency'
                ];
            default:
                return [
                    'Review error details and context',
                    'Check system logs for additional information',
                    'Contact technical support if issue persists'
                ];
        }
    }

    /**
     * Log error creation for monitoring and alerting
     */
    private logErrorCreation(): void {
        const logData = {
            errorCode: this.code,
            errorMessage: this.message,
            errorCategory: this.category,
            proposalId: this.proposalId,
            userId: this.userId,
            action: this.action,
            errorSource: this.errorSource,
            rollbackRequired: this.rollbackRequired,
            manualInterventionRequired: this.manualInterventionRequired,
            retryable: this.retryable,
            context: this.context,
            timestamp: new Date().toISOString()
        };

        if (this.manualInterventionRequired) {
            logger.error('Proposal acceptance error requiring manual intervention', logData);
        } else if (this.rollbackRequired) {
            logger.warn('Proposal acceptance error requiring rollback', logData);
        } else {
            logger.info('Proposal acceptance error occurred', logData);
        }
    }

    /**
     * Create enhanced error response with recovery guidance
     */
    toEnhancedJSON(): {
        error: {
            code: string;
            message: string;
            category: string;
            retryable: boolean;
            rollbackRequired: boolean;
            manualInterventionRequired: boolean;
            recoveryActions: string[];
            context: ProposalAcceptanceErrorContext;
            timestamp: string;
        };
    } {
        return {
            error: {
                code: this.code,
                message: this.message,
                category: this.category,
                retryable: this.retryable,
                rollbackRequired: this.rollbackRequired,
                manualInterventionRequired: this.manualInterventionRequired,
                recoveryActions: this.recoveryActions,
                context: this.context as ProposalAcceptanceErrorContext,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Factory methods for creating specific error types
     */
    static proposalNotFound(proposalId: string, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_NOT_FOUND,
            `Proposal not found: ${proposalId}`,
            {
                ...context,
                proposalId,
                errorSource: 'validation'
            }
        );
    }

    static unauthorizedUser(userId: string, proposalId: string, action: 'accept' | 'reject', context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.UNAUTHORIZED_USER,
            `User ${userId} is not authorized to ${action} proposal ${proposalId}`,
            {
                ...context,
                userId,
                proposalId,
                action,
                errorSource: 'validation'
            }
        );
    }

    static paymentProcessingFailed(proposalId: string, paymentTransactionId?: string, originalError?: Error, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED,
            `Payment processing failed for proposal ${proposalId}`,
            {
                ...context,
                proposalId,
                paymentTransactionId,
                errorSource: 'payment'
            },
            originalError
        );
    }

    static blockchainRecordingFailed(proposalId: string, retryAttempt: number, maxRetries: number, originalError?: Error, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        const code = retryAttempt >= maxRetries
            ? PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RETRY_EXHAUSTED
            : PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED;

        return new ProposalAcceptanceError(
            code,
            `Blockchain recording failed for proposal ${proposalId} (attempt ${retryAttempt}/${maxRetries})`,
            {
                ...context,
                proposalId,
                retryAttempt,
                maxRetries,
                errorSource: 'blockchain'
            },
            originalError
        );
    }

    static databaseTransactionFailed(proposalId: string, operation: string, originalError?: Error, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_TRANSACTION_FAILED,
            `Database transaction failed for proposal ${proposalId} during ${operation}`,
            {
                ...context,
                proposalId,
                errorSource: 'database',
                metadata: {
                    ...context?.metadata,
                    operation
                }
            },
            originalError
        );
    }

    static rollbackOperationFailed(proposalId: string, rollbackStep: string, originalError?: Error, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.ROLLBACK_OPERATION_FAILED,
            `Rollback operation failed for proposal ${proposalId} at step: ${rollbackStep}`,
            {
                ...context,
                proposalId,
                errorSource: 'system',
                metadata: {
                    ...context?.metadata,
                    rollbackStep
                }
            },
            originalError
        );
    }

    static manualInterventionRequired(proposalId: string, reason: string, context?: Partial<ProposalAcceptanceErrorContext>): ProposalAcceptanceError {
        return new ProposalAcceptanceError(
            PROPOSAL_ACCEPTANCE_ERROR_CODES.MANUAL_INTERVENTION_REQUIRED,
            `Manual intervention required for proposal ${proposalId}: ${reason}`,
            {
                ...context,
                proposalId,
                errorSource: 'system',
                metadata: {
                    ...context?.metadata,
                    interventionReason: reason
                }
            }
        );
    }
}