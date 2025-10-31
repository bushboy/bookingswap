/**
 * Enhanced authentication error classification system
 * 
 * This module provides comprehensive error classification for authentication
 * failures, with special handling for targeting-related authentication issues
 * that should not trigger user logout.
 * 
 * Requirements satisfied:
 * - 3.1: Authentication error classification for targeting-related failures
 * - 3.2: Error handling that preserves authentication state
 * - 3.3: Targeting-specific error handling that maintains user session
 */

// ============================================================================
// Enhanced Authentication Error Types
// ============================================================================

/**
 * Extended authentication error types including targeting-specific errors
 */
export enum AuthErrorType {
    // Standard authentication errors
    TOKEN_EXPIRED = 'token_expired',
    TOKEN_INVALID = 'token_invalid',
    TOKEN_MISSING = 'token_missing',
    NETWORK_ERROR = 'network_error',

    // Targeting-specific authentication errors
    TARGETING_AUTH_FAILURE = 'targeting_auth_failure',
    CROSS_USER_ACCESS_DENIED = 'cross_user_access_denied',
    FALSE_POSITIVE_AUTH_FAILURE = 'false_positive_auth_failure',
    TARGETING_TOKEN_VALIDATION_FAILED = 'targeting_token_validation_failed',
    TARGETING_PERMISSION_DENIED = 'targeting_permission_denied',

    // Server and system errors
    SERVER_ERROR = 'server_error',
    RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
    UNKNOWN_ERROR = 'unknown_error'
}

/**
 * Enhanced authentication error interface with targeting context
 */
export interface AuthError {
    type: AuthErrorType;
    message: string;
    shouldRetry: boolean;
    retryDelay?: number;
    isTargetingRelated: boolean;
    shouldTriggerLogout: boolean;
    context?: AuthErrorContext;
    originalError?: any;
    timestamp: Date;
}

/**
 * Context information for authentication errors
 */
export interface AuthErrorContext {
    endpoint?: string;
    operation?: string;
    swapId?: string;
    targetSwapId?: string;
    userId?: string;
    requestId?: string;
    httpStatus?: number;
    isRetry?: boolean;
    retryCount?: number;
}

/**
 * Authentication error classification result
 */
export interface AuthErrorClassification {
    error: AuthError;
    shouldTriggerLogout: boolean;
    shouldRetry: boolean;
    retryStrategy?: RetryStrategy;
    userMessage: string;
    technicalMessage: string;
}

/**
 * Retry strategy for authentication errors
 */
export interface RetryStrategy {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    exponentialBackoff: boolean;
    retryableErrorTypes: AuthErrorType[];
}

// ============================================================================
// Error Classification Logic
// ============================================================================

/**
 * Authentication error classifier
 * Analyzes errors and determines appropriate handling strategy
 */
export class AuthErrorClassifier {
    private static readonly TARGETING_ENDPOINTS = [
        '/swaps/targeting-status',
        '/swaps/target',
        '/swaps/retarget',
        '/swaps/validate-targeting',
        '/swaps/can-target',
        '/swaps/auction-eligibility',
        '/swaps/one-for-one-eligibility',
        '/swaps/targeting-history',
        '/users/targeting-activity',
        '/swaps/targeted-by'
    ];

    private static readonly LOGOUT_TRIGGERING_ERRORS = [
        AuthErrorType.TOKEN_EXPIRED,
        AuthErrorType.TOKEN_INVALID,
        AuthErrorType.TOKEN_MISSING
    ];

    private static readonly RETRYABLE_ERRORS = [
        AuthErrorType.NETWORK_ERROR,
        AuthErrorType.SERVER_ERROR,
        AuthErrorType.RATE_LIMIT_EXCEEDED,
        AuthErrorType.TARGETING_AUTH_FAILURE,
        AuthErrorType.FALSE_POSITIVE_AUTH_FAILURE,
        AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED
    ];

    /**
     * Classify an authentication error and determine handling strategy
     */
    static classifyError(
        error: any,
        context?: Partial<AuthErrorContext>
    ): AuthErrorClassification {
        const authError = this.createAuthError(error, context);
        const shouldTriggerLogout = this.shouldTriggerLogout(authError);
        const shouldRetry = this.shouldRetry(authError);
        const retryStrategy = shouldRetry ? this.getRetryStrategy(authError) : undefined;
        const userMessage = this.getUserMessage(authError);
        const technicalMessage = this.getTechnicalMessage(authError);

        return {
            error: authError,
            shouldTriggerLogout,
            shouldRetry,
            retryStrategy,
            userMessage,
            technicalMessage
        };
    }

    /**
     * Create an AuthError from various error types
     */
    private static createAuthError(
        error: any,
        context?: Partial<AuthErrorContext>
    ): AuthError {
        const isTargetingRelated = this.isTargetingRelated(error, context);
        const errorType = this.determineErrorType(error, isTargetingRelated);
        const message = this.extractErrorMessage(error);
        const shouldTriggerLogout = this.LOGOUT_TRIGGERING_ERRORS.includes(errorType) && !isTargetingRelated;

        return {
            type: errorType,
            message,
            shouldRetry: this.RETRYABLE_ERRORS.includes(errorType),
            retryDelay: this.getRetryDelay(errorType),
            isTargetingRelated,
            shouldTriggerLogout,
            context: context || {},
            originalError: error,
            timestamp: new Date()
        };
    }

    /**
     * Determine if an error is targeting-related
     */
    private static isTargetingRelated(
        error: any,
        context?: Partial<AuthErrorContext>
    ): boolean {
        // Check context for targeting indicators
        if (context?.endpoint && this.TARGETING_ENDPOINTS.some(ep => context.endpoint?.includes(ep))) {
            return true;
        }

        if (context?.operation && context.operation.toLowerCase().includes('target')) {
            return true;
        }

        if (context?.targetSwapId || context?.swapId) {
            return true;
        }

        // Check error response for targeting indicators
        if (error?.response?.config?.url) {
            const url = error.response.config.url;
            return this.TARGETING_ENDPOINTS.some(ep => url.includes(ep));
        }

        // Check error message for targeting keywords
        const message = this.extractErrorMessage(error).toLowerCase();
        const targetingKeywords = ['target', 'targeting', 'cross-user', 'swap access'];
        return targetingKeywords.some(keyword => message.includes(keyword));
    }

    /**
     * Determine the specific error type
     */
    private static determineErrorType(error: any, isTargetingRelated: boolean): AuthErrorType {
        // Network errors
        if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
            return AuthErrorType.NETWORK_ERROR;
        }

        // HTTP status-based classification
        if (error?.response?.status) {
            const status = error.response.status;

            switch (status) {
                case 401:
                    if (isTargetingRelated) {
                        // Check if it's a false positive or genuine auth failure
                        const errorMessage = this.extractErrorMessage(error).toLowerCase();
                        if (errorMessage.includes('cross-user') || errorMessage.includes('targeting')) {
                            return AuthErrorType.TARGETING_AUTH_FAILURE;
                        }
                        return AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED;
                    }

                    // Determine specific 401 error type
                    const authHeader = error.response.headers?.['www-authenticate'];
                    if (authHeader?.includes('expired')) {
                        return AuthErrorType.TOKEN_EXPIRED;
                    }
                    if (authHeader?.includes('invalid')) {
                        return AuthErrorType.TOKEN_INVALID;
                    }
                    return AuthErrorType.TOKEN_MISSING;

                case 403:
                    if (isTargetingRelated) {
                        return AuthErrorType.TARGETING_PERMISSION_DENIED;
                    }
                    return AuthErrorType.CROSS_USER_ACCESS_DENIED;

                case 429:
                    return AuthErrorType.RATE_LIMIT_EXCEEDED;

                case 500:
                case 502:
                case 503:
                case 504:
                    return AuthErrorType.SERVER_ERROR;

                default:
                    if (isTargetingRelated) {
                        return AuthErrorType.TARGETING_AUTH_FAILURE;
                    }
                    return AuthErrorType.UNKNOWN_ERROR;
            }
        }

        // Token validation errors
        if (error?.reason) {
            switch (error.reason) {
                case 'expired':
                    return isTargetingRelated ? AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED : AuthErrorType.TOKEN_EXPIRED;
                case 'invalid_format':
                    return isTargetingRelated ? AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED : AuthErrorType.TOKEN_INVALID;
                case 'missing_claims':
                    return isTargetingRelated ? AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED : AuthErrorType.TOKEN_INVALID;
                default:
                    return isTargetingRelated ? AuthErrorType.TARGETING_AUTH_FAILURE : AuthErrorType.UNKNOWN_ERROR;
            }
        }

        return isTargetingRelated ? AuthErrorType.TARGETING_AUTH_FAILURE : AuthErrorType.UNKNOWN_ERROR;
    }

    /**
     * Extract error message from various error formats
     */
    private static extractErrorMessage(error: any): string {
        if (typeof error === 'string') {
            return error;
        }

        if (error?.response?.data?.error?.message) {
            return error.response.data.error.message;
        }

        if (error?.response?.data?.message) {
            return error.response.data.message;
        }

        if (error?.message) {
            return error.message;
        }

        return 'Unknown authentication error';
    }

    /**
     * Determine if error should trigger logout
     */
    private static shouldTriggerLogout(authError: AuthError): boolean {
        return authError.shouldTriggerLogout;
    }

    /**
     * Determine if error should be retried
     */
    private static shouldRetry(authError: AuthError): boolean {
        return authError.shouldRetry;
    }

    /**
     * Get retry delay for error type
     */
    private static getRetryDelay(errorType: AuthErrorType): number {
        switch (errorType) {
            case AuthErrorType.RATE_LIMIT_EXCEEDED:
                return 5000; // 5 seconds
            case AuthErrorType.SERVER_ERROR:
                return 2000; // 2 seconds
            case AuthErrorType.NETWORK_ERROR:
                return 1000; // 1 second
            case AuthErrorType.TARGETING_AUTH_FAILURE:
            case AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED:
                return 1500; // 1.5 seconds
            default:
                return 1000; // 1 second default
        }
    }

    /**
     * Get retry strategy for error
     */
    private static getRetryStrategy(authError: AuthError): RetryStrategy {
        const baseStrategy: RetryStrategy = {
            maxRetries: 3,
            baseDelay: authError.retryDelay || 1000,
            maxDelay: 10000,
            exponentialBackoff: true,
            retryableErrorTypes: this.RETRYABLE_ERRORS
        };

        // Customize strategy based on error type
        switch (authError.type) {
            case AuthErrorType.RATE_LIMIT_EXCEEDED:
                return {
                    ...baseStrategy,
                    maxRetries: 2,
                    baseDelay: 5000,
                    exponentialBackoff: false
                };

            case AuthErrorType.TARGETING_AUTH_FAILURE:
            case AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED:
                return {
                    ...baseStrategy,
                    maxRetries: 2,
                    baseDelay: 1500
                };

            case AuthErrorType.NETWORK_ERROR:
                return {
                    ...baseStrategy,
                    maxRetries: 5,
                    baseDelay: 1000
                };

            default:
                return baseStrategy;
        }
    }

    /**
     * Get user-friendly error message
     */
    private static getUserMessage(authError: AuthError): string {
        switch (authError.type) {
            case AuthErrorType.TOKEN_EXPIRED:
                return 'Your session has expired. Please log in again.';

            case AuthErrorType.TOKEN_INVALID:
            case AuthErrorType.TOKEN_MISSING:
                return 'Authentication required. Please log in.';

            case AuthErrorType.TARGETING_AUTH_FAILURE:
                return 'Unable to load targeting information. This won\'t affect your main session.';

            case AuthErrorType.TARGETING_TOKEN_VALIDATION_FAILED:
                return 'Temporary issue accessing targeting data. Retrying...';

            case AuthErrorType.TARGETING_PERMISSION_DENIED:
                return 'You don\'t have permission to access this targeting information.';

            case AuthErrorType.CROSS_USER_ACCESS_DENIED:
                return 'Access denied for this operation.';

            case AuthErrorType.NETWORK_ERROR:
                return 'Network connection issue. Please check your connection.';

            case AuthErrorType.SERVER_ERROR:
                return 'Server temporarily unavailable. Please try again.';

            case AuthErrorType.RATE_LIMIT_EXCEEDED:
                return 'Too many requests. Please wait a moment before trying again.';

            case AuthErrorType.FALSE_POSITIVE_AUTH_FAILURE:
                return 'Temporary authentication issue. Retrying...';

            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    /**
     * Get technical error message for logging
     */
    private static getTechnicalMessage(authError: AuthError): string {
        const context = authError.context;
        const contextStr = context ? JSON.stringify(context) : 'no context';

        return `${authError.type}: ${authError.message} | Context: ${contextStr} | Targeting: ${authError.isTargetingRelated} | Should logout: ${authError.shouldTriggerLogout}`;
    }
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard for AuthError
 */
export function isAuthError(error: any): error is AuthError {
    return (
        error &&
        typeof error === 'object' &&
        Object.values(AuthErrorType).includes(error.type) &&
        typeof error.message === 'string' &&
        typeof error.shouldRetry === 'boolean' &&
        typeof error.isTargetingRelated === 'boolean' &&
        typeof error.shouldTriggerLogout === 'boolean'
    );
}

/**
 * Type guard for targeting-related errors
 */
export function isTargetingError(error: AuthError): boolean {
    return error.isTargetingRelated;
}

/**
 * Type guard for logout-triggering errors
 */
export function shouldTriggerLogout(error: AuthError): boolean {
    return error.shouldTriggerLogout;
}

/**
 * Create a targeting-specific error context
 */
export function createTargetingErrorContext(
    endpoint: string,
    swapId?: string,
    targetSwapId?: string,
    operation?: string
): AuthErrorContext {
    return {
        endpoint,
        operation: operation || 'targeting_operation',
        swapId,
        targetSwapId,
        requestId: `targeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
}

/**
 * Create a standard error context
 */
export function createErrorContext(
    endpoint: string,
    operation?: string,
    userId?: string
): AuthErrorContext {
    return {
        endpoint,
        operation: operation || 'api_operation',
        userId,
        requestId: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
}