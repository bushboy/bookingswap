import { SwapPlatformError, ErrorContext } from '@booking-swap/shared';

/**
 * Error codes specific to swap completion operations
 */
export enum SwapCompletionErrorCodes {
    INVALID_PROPOSAL_STATE = 'INVALID_PROPOSAL_STATE',
    MISSING_RELATED_ENTITIES = 'MISSING_RELATED_ENTITIES',
    COMPLETION_VALIDATION_FAILED = 'COMPLETION_VALIDATION_FAILED',
    DATABASE_TRANSACTION_FAILED = 'DATABASE_TRANSACTION_FAILED',
    BLOCKCHAIN_RECORDING_FAILED = 'BLOCKCHAIN_RECORDING_FAILED',
    INCONSISTENT_ENTITY_STATES = 'INCONSISTENT_ENTITY_STATES',
    AUTOMATIC_CORRECTION_FAILED = 'AUTOMATIC_CORRECTION_FAILED',
    ROLLBACK_FAILED = 'ROLLBACK_FAILED',
    COMPLETION_TIMEOUT = 'COMPLETION_TIMEOUT',
    CONCURRENT_COMPLETION_CONFLICT = 'CONCURRENT_COMPLETION_CONFLICT',
    INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
    ENTITY_LOCKED = 'ENTITY_LOCKED',
    VALIDATION_RETRY_EXCEEDED = 'VALIDATION_RETRY_EXCEEDED',
    BLOCKCHAIN_CONSENSUS_TIMEOUT = 'BLOCKCHAIN_CONSENSUS_TIMEOUT',
    NOTIFICATION_DELIVERY_FAILED = 'NOTIFICATION_DELIVERY_FAILED'
}

/**
 * Specialized error class for swap completion operations
 * Extends SwapPlatformError with completion-specific context
 */
export class SwapCompletionError extends SwapPlatformError {
    public readonly affectedEntities?: string[];
    public readonly completionId?: string;
    public readonly rollbackRequired: boolean;
    public readonly retryAttempts?: number;
    public readonly maxRetries?: number;

    constructor(
        code: SwapCompletionErrorCodes,
        message: string,
        options: {
            affectedEntities?: string[];
            completionId?: string;
            rollbackRequired?: boolean;
            retryAttempts?: number;
            maxRetries?: number;
            retryable?: boolean;
            context?: ErrorContext;
            originalError?: Error;
        } = {}
    ) {
        const {
            affectedEntities,
            completionId,
            rollbackRequired = false,
            retryAttempts,
            maxRetries,
            retryable = SwapCompletionError.isRetryableError(code),
            context,
            originalError
        } = options;

        super(
            code,
            message,
            'business',
            retryable,
            {
                ...context,
                metadata: {
                    ...context?.metadata,
                    affectedEntities,
                    completionId,
                    rollbackRequired,
                    retryAttempts,
                    maxRetries,
                    errorCategory: 'swap_completion'
                }
            },
            originalError
        );

        this.name = 'SwapCompletionError';
        this.affectedEntities = affectedEntities;
        this.completionId = completionId;
        this.rollbackRequired = rollbackRequired;
        this.retryAttempts = retryAttempts;
        this.maxRetries = maxRetries;
    }

    /**
     * Determines if an error code represents a retryable error
     */
    private static isRetryableError(code: SwapCompletionErrorCodes): boolean {
        const retryableErrors = [
            SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
            SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED,
            SwapCompletionErrorCodes.COMPLETION_TIMEOUT,
            SwapCompletionErrorCodes.ENTITY_LOCKED,
            SwapCompletionErrorCodes.BLOCKCHAIN_CONSENSUS_TIMEOUT,
            SwapCompletionErrorCodes.NOTIFICATION_DELIVERY_FAILED
        ];

        return retryableErrors.includes(code);
    }

    /**
     * Creates a user-friendly error message based on the error code
     */
    static getUserFriendlyMessage(code: SwapCompletionErrorCodes): string {
        switch (code) {
            case SwapCompletionErrorCodes.INVALID_PROPOSAL_STATE:
                return 'The proposal is no longer in a valid state for completion. Please refresh and try again.';

            case SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES:
                return 'Some required information for completing this swap is missing. Please contact support.';

            case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
                return 'The swap completion could not be validated. Please check all details and try again.';

            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                return 'There was a temporary issue saving your changes. Please try again in a moment.';

            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                return 'The blockchain transaction failed. Your swap will be retried automatically.';

            case SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES:
                return 'There is an inconsistency in the swap data. Our system is attempting to correct this automatically.';

            case SwapCompletionErrorCodes.AUTOMATIC_CORRECTION_FAILED:
                return 'Automatic correction of the swap data failed. Please contact support for assistance.';

            case SwapCompletionErrorCodes.ROLLBACK_FAILED:
                return 'There was an issue reversing the changes. Please contact support immediately.';

            case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
                return 'The swap completion is taking longer than expected. Please wait a moment and check the status.';

            case SwapCompletionErrorCodes.CONCURRENT_COMPLETION_CONFLICT:
                return 'Another completion operation is in progress for this swap. Please wait and try again.';

            case SwapCompletionErrorCodes.INSUFFICIENT_PERMISSIONS:
                return 'You do not have permission to complete this swap operation.';

            case SwapCompletionErrorCodes.ENTITY_LOCKED:
                return 'This swap is currently being processed by another operation. Please try again in a moment.';

            case SwapCompletionErrorCodes.VALIDATION_RETRY_EXCEEDED:
                return 'Validation attempts have been exceeded. Please contact support for assistance.';

            case SwapCompletionErrorCodes.BLOCKCHAIN_CONSENSUS_TIMEOUT:
                return 'The blockchain network is experiencing delays. Your transaction will be retried automatically.';

            case SwapCompletionErrorCodes.NOTIFICATION_DELIVERY_FAILED:
                return 'The swap completed successfully, but notifications could not be sent. You may not receive email updates.';

            default:
                return 'An unexpected error occurred during swap completion. Please try again or contact support.';
        }
    }

    /**
     * Creates a SwapCompletionError with enhanced context
     */
    static create(
        code: SwapCompletionErrorCodes,
        message: string,
        options: {
            affectedEntities?: string[];
            completionId?: string;
            rollbackRequired?: boolean;
            retryAttempts?: number;
            maxRetries?: number;
            context?: ErrorContext;
            originalError?: Error;
        } = {}
    ): SwapCompletionError {
        return new SwapCompletionError(code, message, options);
    }

    /**
     * Creates a validation error for completion operations
     */
    static validationError(
        message: string,
        affectedEntities?: string[],
        completionId?: string
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
            message,
            {
                affectedEntities,
                completionId,
                rollbackRequired: false
            }
        );
    }

    /**
     * Creates a database transaction error
     */
    static databaseError(
        message: string,
        completionId?: string,
        originalError?: Error
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
            message,
            {
                completionId,
                rollbackRequired: true,
                originalError
            }
        );
    }

    /**
     * Creates a blockchain recording error
     */
    static blockchainError(
        message: string,
        completionId?: string,
        retryAttempts?: number,
        maxRetries?: number
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED,
            message,
            {
                completionId,
                rollbackRequired: true,
                retryAttempts,
                maxRetries
            }
        );
    }

    /**
     * Creates a rollback failure error
     */
    static rollbackError(
        message: string,
        affectedEntities?: string[],
        completionId?: string,
        originalError?: Error
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.ROLLBACK_FAILED,
            message,
            {
                affectedEntities,
                completionId,
                rollbackRequired: false, // Already failed rollback
                originalError,
                context: {
                    metadata: { retryable: false }
                }
            }
        );
    }

    /**
     * Creates a timeout error
     */
    static timeoutError(
        message: string,
        completionId?: string,
        timeoutMs?: number
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.COMPLETION_TIMEOUT,
            message,
            {
                completionId,
                rollbackRequired: true,
                context: {
                    metadata: { timeoutMs }
                }
            }
        );
    }

    /**
     * Creates a concurrency conflict error
     */
    static concurrencyError(
        message: string,
        affectedEntities?: string[],
        completionId?: string
    ): SwapCompletionError {
        return SwapCompletionError.create(
            SwapCompletionErrorCodes.CONCURRENT_COMPLETION_CONFLICT,
            message,
            {
                affectedEntities,
                completionId,
                rollbackRequired: false
            }
        );
    }

    /**
     * Enhanced JSON representation for API responses
     */
    toJSON() {
        const baseJson = super.toJSON();
        return {
            ...baseJson,
            error: {
                ...baseJson.error,
                affectedEntities: this.affectedEntities,
                completionId: this.completionId,
                rollbackRequired: this.rollbackRequired,
                retryAttempts: this.retryAttempts,
                maxRetries: this.maxRetries,
                userFriendlyMessage: SwapCompletionError.getUserFriendlyMessage(this.code as SwapCompletionErrorCodes),
                recoveryActions: this.getRecoveryActions()
            }
        };
    }

    /**
     * Gets recommended recovery actions based on error type
     */
    private getRecoveryActions(): string[] {
        switch (this.code as SwapCompletionErrorCodes) {
            case SwapCompletionErrorCodes.INVALID_PROPOSAL_STATE:
                return ['Refresh the page', 'Check proposal status', 'Try again'];

            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                return ['Wait a moment', 'Try again', 'Contact support if issue persists'];

            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                return ['Wait for automatic retry', 'Check blockchain network status', 'Contact support if needed'];

            case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
                return ['Check completion status', 'Wait for processing to complete', 'Try again if status is unclear'];

            case SwapCompletionErrorCodes.CONCURRENT_COMPLETION_CONFLICT:
                return ['Wait for other operation to complete', 'Refresh and try again', 'Check swap status'];

            case SwapCompletionErrorCodes.ENTITY_LOCKED:
                return ['Wait a moment', 'Try again', 'Check if another operation is in progress'];

            case SwapCompletionErrorCodes.ROLLBACK_FAILED:
                return ['Contact support immediately', 'Do not attempt to retry', 'Provide error details to support'];

            default:
                return ['Try again', 'Contact support if issue persists', 'Check system status'];
        }
    }
}