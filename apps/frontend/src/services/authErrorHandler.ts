/**
 * Enhanced authentication error handler service
 * 
 * This service provides sophisticated error handling for authentication failures,
 * with special logic to preserve authentication state when targeting-related
 * operations fail, preventing unnecessary user logouts.
 * 
 * Requirements satisfied:
 * - 3.1: Authentication error handlers that don't corrupt main auth state for targeting errors
 * - 3.2: Targeting-specific error handling that maintains user session
 * - 3.3: Logic to only trigger logout for genuine token invalidity
 * - 3.4: Preserve authentication state during targeting failures
 */

import {
    AuthError,
    AuthErrorType,
    AuthErrorClassifier,
    AuthErrorClassification,
    AuthErrorContext,
    createTargetingErrorContext
} from '@/types/authError';

// ============================================================================
// Authentication Error Handler Service
// ============================================================================

/**
 * Enhanced authentication error handler with targeting-aware logic
 */
export class AuthErrorHandler {
    private static instance: AuthErrorHandler;
    private retryAttempts: Map<string, number> = new Map();
    private errorListeners: Set<AuthErrorListener> = new Set();

    private constructor() { }

    /**
     * Get singleton instance
     */
    static getInstance(): AuthErrorHandler {
        if (!AuthErrorHandler.instance) {
            AuthErrorHandler.instance = new AuthErrorHandler();
        }
        return AuthErrorHandler.instance;
    }

    /**
     * Handle authentication error with context-aware logic
     */
    async handleAuthError(
        error: any,
        context?: Partial<AuthErrorContext>
    ): Promise<AuthErrorHandlingResult> {
        // Classify the error
        const classification = AuthErrorClassifier.classifyError(error, context);
        const authError = classification.error;

        // Log the error for debugging
        this.logAuthError(authError, classification);

        // Notify listeners
        this.notifyErrorListeners(authError, classification);

        // Handle based on error type and context
        if (authError.isTargetingRelated) {
            return this.handleTargetingError(authError, classification);
        } else {
            return this.handleStandardAuthError(authError, classification);
        }
    }

    /**
     * Handle targeting-specific authentication errors
     * These errors should NOT corrupt the main authentication state
     */
    private async handleTargetingError(
        authError: AuthError,
        classification: AuthErrorClassification
    ): Promise<AuthErrorHandlingResult> {
        console.log('Handling targeting-specific auth error:', {
            type: authError.type,
            message: authError.message,
            shouldTriggerLogout: authError.shouldTriggerLogout,
            context: authError.context
        });

        // For targeting errors, we preserve the main authentication state
        const result: AuthErrorHandlingResult = {
            shouldTriggerLogout: false, // Never logout for targeting errors
            shouldRetry: classification.shouldRetry,
            retryStrategy: classification.retryStrategy,
            userMessage: classification.userMessage,
            technicalMessage: classification.technicalMessage,
            preserveAuthState: true,
            isTargetingError: true,
            errorType: authError.type
        };

        // Handle specific targeting error types
        switch (authError.type) {
            case AuthErrorType.TARGETING_AUTH_FAILURE:
            case AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED:
                // These are likely false positives - retry without affecting main auth
                result.shouldRetry = true;
                result.userMessage = 'Temporary issue loading targeting data. Your session remains active.';
                break;

            case AuthErrorType.TARGETING_PERMISSION_DENIED:
                // Permission issue - don't retry, but don't logout
                result.shouldRetry = false;
                result.userMessage = 'Unable to access targeting information for this swap.';
                break;

            case AuthErrorType.CROSS_USER_ACCESS_DENIED:
                // Cross-user access issue - expected behavior, don't retry or logout
                result.shouldRetry = false;
                result.userMessage = 'This targeting operation is not available.';
                break;

            case AuthErrorType.FALSE_POSITIVE_AUTH_FAILURE:
                // Definitely a false positive - retry aggressively
                result.shouldRetry = true;
                result.retryStrategy = {
                    maxRetries: 5,
                    baseDelay: 500,
                    maxDelay: 3000,
                    exponentialBackoff: true,
                    retryableErrorTypes: [AuthErrorType.FALSE_POSITIVE_AUTH_FAILURE]
                };
                result.userMessage = 'Retrying targeting operation...';
                break;

            default:
                // Other targeting errors - be conservative but don't logout
                result.shouldRetry = classification.shouldRetry;
                result.userMessage = 'Targeting information temporarily unavailable.';
        }

        return result;
    }

    /**
     * Handle standard authentication errors
     * These may trigger logout if the token is genuinely invalid
     */
    private async handleStandardAuthError(
        authError: AuthError,
        classification: AuthErrorClassification
    ): Promise<AuthErrorHandlingResult> {
        console.log('Handling standard auth error:', {
            type: authError.type,
            message: authError.message,
            shouldTriggerLogout: authError.shouldTriggerLogout,
            context: authError.context
        });

        const result: AuthErrorHandlingResult = {
            shouldTriggerLogout: classification.shouldTriggerLogout,
            shouldRetry: classification.shouldRetry,
            retryStrategy: classification.retryStrategy,
            userMessage: classification.userMessage,
            technicalMessage: classification.technicalMessage,
            preserveAuthState: false,
            isTargetingError: false,
            errorType: authError.type
        };

        // Handle specific standard error types
        switch (authError.type) {
            case AuthErrorType.TOKEN_EXPIRED:
            case AuthErrorType.TOKEN_INVALID:
            case AuthErrorType.TOKEN_MISSING:
                // Genuine authentication failures - trigger logout
                result.shouldTriggerLogout = true;
                result.shouldRetry = false;
                this.triggerAuthenticationCleanup();
                break;

            case AuthErrorType.NETWORK_ERROR:
            case AuthErrorType.SERVER_ERROR:
                // System errors - retry without logout
                result.shouldTriggerLogout = false;
                result.shouldRetry = true;
                break;

            case AuthErrorType.RATE_LIMIT_EXCEEDED:
                // Rate limiting - wait and retry without logout
                result.shouldTriggerLogout = false;
                result.shouldRetry = true;
                break;

            default:
                // Unknown errors - be conservative, don't logout unless explicitly required
                result.shouldTriggerLogout = authError.shouldTriggerLogout;
        }

        return result;
    }

    /**
     * Execute retry logic with exponential backoff
     */
    async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: AuthErrorContext,
        maxRetries: number = 3
    ): Promise<T> {
        const operationKey = `${context.endpoint}_${context.operation}`;
        let retryCount = this.retryAttempts.get(operationKey) || 0;

        try {
            const result = await operation();
            // Success - reset retry count
            this.retryAttempts.delete(operationKey);
            return result;
        } catch (error) {
            // Handle the error
            const updatedContext = { ...context, isRetry: retryCount > 0, retryCount };
            const handlingResult = await this.handleAuthError(error, updatedContext);

            // Check if we should retry
            if (handlingResult.shouldRetry && retryCount < maxRetries) {
                retryCount++;
                this.retryAttempts.set(operationKey, retryCount);

                // Calculate delay
                const baseDelay = handlingResult.retryStrategy?.baseDelay || 1000;
                const maxDelay = handlingResult.retryStrategy?.maxDelay || 10000;
                const exponentialBackoff = handlingResult.retryStrategy?.exponentialBackoff ?? true;

                const delay = exponentialBackoff
                    ? Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay)
                    : baseDelay;

                console.log(`Retrying operation ${operationKey} in ${delay}ms (attempt ${retryCount}/${maxRetries})`);

                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeWithRetry(operation, context, maxRetries);
            } else {
                // No more retries or shouldn't retry
                this.retryAttempts.delete(operationKey);
                throw error;
            }
        }
    }

    /**
     * Handle targeting-specific API calls with error isolation
     */
    async executeTargetingOperation<T>(
        operation: () => Promise<T>,
        endpoint: string,
        swapId?: string,
        targetSwapId?: string
    ): Promise<TargetingOperationResult<T>> {
        const context = createTargetingErrorContext(endpoint, swapId, targetSwapId);

        try {
            const result = await this.executeWithRetry(operation, context, 2); // Fewer retries for targeting
            return {
                success: true,
                data: result,
                error: null,
                preservedAuthState: true
            };
        } catch (error) {
            const handlingResult = await this.handleAuthError(error, context);

            return {
                success: false,
                data: null,
                error: {
                    type: handlingResult.errorType,
                    message: handlingResult.userMessage,
                    isTargetingError: handlingResult.isTargetingError,
                    shouldTriggerLogout: handlingResult.shouldTriggerLogout
                },
                preservedAuthState: handlingResult.preserveAuthState
            };
        }
    }

    /**
     * Add error listener for monitoring and debugging
     */
    addErrorListener(listener: AuthErrorListener): void {
        this.errorListeners.add(listener);
    }

    /**
     * Remove error listener
     */
    removeErrorListener(listener: AuthErrorListener): void {
        this.errorListeners.delete(listener);
    }

    /**
     * Clear all retry attempts (useful for testing or reset scenarios)
     */
    clearRetryAttempts(): void {
        this.retryAttempts.clear();
    }

    /**
     * Get current retry statistics
     */
    getRetryStats(): RetryStats {
        const stats: RetryStats = {
            totalOperations: this.retryAttempts.size,
            operationsWithRetries: 0,
            averageRetries: 0,
            operations: []
        };

        let totalRetries = 0;
        for (const [operation, retries] of this.retryAttempts.entries()) {
            if (retries > 0) {
                stats.operationsWithRetries++;
                totalRetries += retries;
            }
            stats.operations.push({ operation, retries });
        }

        stats.averageRetries = stats.operationsWithRetries > 0
            ? totalRetries / stats.operationsWithRetries
            : 0;

        return stats;
    }

    /**
     * Log authentication error for debugging
     */
    private logAuthError(authError: AuthError, classification: AuthErrorClassification): void {
        const logLevel = authError.shouldTriggerLogout ? 'error' : 'warn';
        const logData = {
            type: authError.type,
            message: authError.message,
            isTargetingRelated: authError.isTargetingRelated,
            shouldTriggerLogout: authError.shouldTriggerLogout,
            shouldRetry: classification.shouldRetry,
            context: authError.context,
            timestamp: authError.timestamp.toISOString()
        };

        if (logLevel === 'error') {
            console.error('Authentication Error:', logData);
        } else {
            console.warn('Authentication Warning:', logData);
        }
    }

    /**
     * Notify error listeners
     */
    private notifyErrorListeners(authError: AuthError, classification: AuthErrorClassification): void {
        for (const listener of this.errorListeners) {
            try {
                listener(authError, classification);
            } catch (error) {
                console.error('Error in auth error listener:', error);
            }
        }
    }

    /**
     * Trigger authentication cleanup for genuine auth failures
     */
    private triggerAuthenticationCleanup(): void {
        // Dispatch custom event for auth cleanup
        window.dispatchEvent(new CustomEvent('auth:token-expired', {
            detail: { reason: 'genuine_auth_failure', timestamp: new Date() }
        }));
    }
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Result of authentication error handling
 */
export interface AuthErrorHandlingResult {
    shouldTriggerLogout: boolean;
    shouldRetry: boolean;
    retryStrategy?: {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        exponentialBackoff: boolean;
        retryableErrorTypes: AuthErrorType[];
    };
    userMessage: string;
    technicalMessage: string;
    preserveAuthState: boolean;
    isTargetingError: boolean;
    errorType: AuthErrorType;
}

/**
 * Result of targeting operation execution
 */
export interface TargetingOperationResult<T> {
    success: boolean;
    data: T | null;
    error: {
        type: AuthErrorType;
        message: string;
        isTargetingError: boolean;
        shouldTriggerLogout: boolean;
    } | null;
    preservedAuthState: boolean;
}

/**
 * Authentication error listener function
 */
export type AuthErrorListener = (
    authError: AuthError,
    classification: AuthErrorClassification
) => void;

/**
 * Retry statistics
 */
export interface RetryStats {
    totalOperations: number;
    operationsWithRetries: number;
    averageRetries: number;
    operations: Array<{
        operation: string;
        retries: number;
    }>;
}

// ============================================================================
// Singleton Instance Export
// ============================================================================

/**
 * Singleton instance of the authentication error handler
 */
export const authErrorHandler = AuthErrorHandler.getInstance();

/**
 * Convenience function for handling authentication errors
 */
export const handleAuthError = (error: any, context?: Partial<AuthErrorContext>) => {
    return authErrorHandler.handleAuthError(error, context);
};

/**
 * Convenience function for executing targeting operations
 */
export const executeTargetingOperation = <T>(
    operation: () => Promise<T>,
    endpoint: string,
    swapId?: string,
    targetSwapId?: string
) => {
    return authErrorHandler.executeTargetingOperation(operation, endpoint, swapId, targetSwapId);
};