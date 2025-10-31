import { logger } from '@/utils/logger';

/**
 * Error response interface for proposal operations
 */
export interface ProposalErrorResponse {
    error: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    timestamp: string;
    requestId: string;
}

/**
 * Enhanced error information for user feedback
 */
export interface EnhancedError {
    message: string;
    code: string;
    shouldRetry: boolean;
    shouldRedirectToLogin: boolean;
    userAction?: string;
    retryDelay?: number;
}

/**
 * Comprehensive error handler for proposal acceptance operations
 * Implements requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class ProposalErrorHandler {
    /**
     * Handle API errors and convert to enhanced error information
     * Requirements: 6.1, 6.2, 6.3
     */
    static handleApiError(error: any, proposalId?: string): EnhancedError {
        logger.error('Handling proposal API error', {
            proposalId,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        });

        // Network errors (no response)
        if (!error.response) {
            return {
                message: 'Network error. Please check your internet connection and try again.',
                code: 'NETWORK_ERROR',
                shouldRetry: true,
                shouldRedirectToLogin: false,
                userAction: 'Check your internet connection and try again',
                retryDelay: 3000
            };
        }

        const status = error.response.status;
        const errorData = error.response.data as ProposalErrorResponse;
        const errorCode = errorData?.error?.code;
        const errorMessage = errorData?.error?.message;

        switch (status) {
            case 400:
                return this.handle400Error(errorCode, errorMessage);

            case 401:
                return this.handle401Error(errorCode, errorMessage);

            case 403:
                return this.handle403Error(errorCode, errorMessage);

            case 404:
                return this.handle404Error(errorCode, errorMessage);

            case 409:
                return this.handle409Error(errorCode, errorMessage);

            case 422:
                return this.handle422Error(errorCode, errorMessage);

            case 429:
                return this.handle429Error(errorCode, errorMessage);

            case 500:
                return this.handle500Error(errorCode, errorMessage);

            case 502:
            case 503:
            case 504:
                return this.handleServiceUnavailable(status, errorCode, errorMessage);

            default:
                return this.handleUnknownError(status, errorCode, errorMessage);
        }
    }

    /**
     * Handle 400 Bad Request errors
     */
    private static handle400Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'INVALID_PROPOSAL_STATUS':
                return {
                    message: 'This proposal cannot be processed in its current state. It may have already been responded to or expired.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page to see the current proposal status'
                };

            case 'INVALID_USER_ID':
                return {
                    message: 'Invalid user information. Please log out and log back in.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: true,
                    userAction: 'Log out and log back in'
                };

            case 'MISSING_REQUIRED_FIELDS':
                return {
                    message: 'Required information is missing. Please refresh the page and try again.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page and try again'
                };

            default:
                return {
                    message: errorMessage || 'Invalid request. Please check your input and try again.',
                    code: errorCode || 'BAD_REQUEST',
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Check your input and try again'
                };
        }
    }

    /**
     * Handle 401 Unauthorized errors
     * Requirement: 6.2
     */
    private static handle401Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'TOKEN_EXPIRED':
                return {
                    message: 'Your session has expired. Please log in again.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: true,
                    userAction: 'Log in again'
                };

            case 'INVALID_TOKEN':
                return {
                    message: 'Authentication failed. Please log in again.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: true,
                    userAction: 'Log in again'
                };

            default:
                return {
                    message: 'Authentication required. Please log in and try again.',
                    code: errorCode || 'UNAUTHORIZED',
                    shouldRetry: false,
                    shouldRedirectToLogin: true,
                    userAction: 'Log in and try again'
                };
        }
    }

    /**
     * Handle 403 Forbidden errors
     */
    private static handle403Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'INSUFFICIENT_PERMISSIONS':
                return {
                    message: 'You do not have permission to perform this action on this proposal.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Contact the proposal owner if you believe this is an error'
                };

            case 'ACCOUNT_SUSPENDED':
                return {
                    message: 'Your account has been suspended. Please contact support.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Contact support for assistance'
                };

            default:
                return {
                    message: 'You do not have permission to perform this action.',
                    code: errorCode || 'FORBIDDEN',
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Contact support if you believe this is an error'
                };
        }
    }

    /**
     * Handle 404 Not Found errors
     * Requirement: 6.3
     */
    private static handle404Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'PROPOSAL_NOT_FOUND':
                return {
                    message: 'Proposal not found. It may have been removed or expired.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page to see current proposals'
                };

            case 'USER_NOT_FOUND':
                return {
                    message: 'User account not found. Please log in again.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: true,
                    userAction: 'Log in again'
                };

            default:
                return {
                    message: 'The requested resource was not found.',
                    code: errorCode || 'NOT_FOUND',
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page and try again'
                };
        }
    }

    /**
     * Handle 409 Conflict errors
     * Requirement: 6.3
     */
    private static handle409Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'PROPOSAL_ALREADY_RESPONDED':
                return {
                    message: 'This proposal has already been accepted or rejected.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page to see the current status'
                };

            case 'CONCURRENT_MODIFICATION':
                return {
                    message: 'This proposal was modified by another user. Please refresh and try again.',
                    code: errorCode,
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page and try again',
                    retryDelay: 2000
                };

            default:
                return {
                    message: 'Conflict detected. The proposal may have been modified by another user.',
                    code: errorCode || 'CONFLICT',
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Refresh the page and try again',
                    retryDelay: 2000
                };
        }
    }

    /**
     * Handle 422 Unprocessable Entity errors
     * Requirement: 6.3
     */
    private static handle422Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'PAYMENT_PROCESSING_FAILED':
                return {
                    message: 'Payment processing failed. Please check your payment method and try again.',
                    code: errorCode,
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Check your payment method and try again',
                    retryDelay: 5000
                };

            case 'ESCROW_TRANSFER_FAILED':
                return {
                    message: 'Fund transfer failed. Please contact support for assistance.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Contact support for assistance'
                };

            case 'BLOCKCHAIN_RECORDING_FAILED':
                return {
                    message: 'Blockchain recording failed. The operation will be retried automatically.',
                    code: errorCode,
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Please wait while we retry the operation',
                    retryDelay: 10000
                };

            case 'INSUFFICIENT_FUNDS':
                return {
                    message: 'Insufficient funds in your account. Please add funds and try again.',
                    code: errorCode,
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Add funds to your account and try again'
                };

            default:
                return {
                    message: errorMessage || 'Unable to process request due to validation errors.',
                    code: errorCode || 'VALIDATION_ERROR',
                    shouldRetry: false,
                    shouldRedirectToLogin: false,
                    userAction: 'Check your input and try again'
                };
        }
    }

    /**
     * Handle 429 Too Many Requests errors
     */
    private static handle429Error(errorCode?: string, errorMessage?: string): EnhancedError {
        return {
            message: 'Too many requests. Please wait a moment and try again.',
            code: errorCode || 'RATE_LIMITED',
            shouldRetry: true,
            shouldRedirectToLogin: false,
            userAction: 'Wait a moment and try again',
            retryDelay: 30000 // 30 seconds
        };
    }

    /**
     * Handle 500 Internal Server Error
     */
    private static handle500Error(errorCode?: string, errorMessage?: string): EnhancedError {
        switch (errorCode) {
            case 'BLOCKCHAIN_RECORDING_FAILED':
                return {
                    message: 'Blockchain recording failed. The operation will be retried automatically.',
                    code: errorCode,
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Please wait while we retry the operation',
                    retryDelay: 15000
                };

            case 'DATABASE_ERROR':
                return {
                    message: 'Database error occurred. Please try again in a few moments.',
                    code: errorCode,
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Try again in a few moments',
                    retryDelay: 10000
                };

            default:
                return {
                    message: 'Server error occurred. Please try again in a few moments.',
                    code: errorCode || 'INTERNAL_SERVER_ERROR',
                    shouldRetry: true,
                    shouldRedirectToLogin: false,
                    userAction: 'Try again in a few moments',
                    retryDelay: 5000
                };
        }
    }

    /**
     * Handle service unavailable errors (502, 503, 504)
     */
    private static handleServiceUnavailable(status: number, errorCode?: string, errorMessage?: string): EnhancedError {
        const statusMessages = {
            502: 'Service temporarily unavailable due to gateway error.',
            503: 'Service temporarily unavailable for maintenance.',
            504: 'Service timeout occurred.'
        };

        return {
            message: statusMessages[status as keyof typeof statusMessages] || 'Service temporarily unavailable. Please try again later.',
            code: errorCode || `SERVICE_UNAVAILABLE_${status}`,
            shouldRetry: true,
            shouldRedirectToLogin: false,
            userAction: 'Try again in a few minutes',
            retryDelay: 60000 // 1 minute
        };
    }

    /**
     * Handle unknown errors
     */
    private static handleUnknownError(status: number, errorCode?: string, errorMessage?: string): EnhancedError {
        return {
            message: errorMessage || `An unexpected error occurred (${status}). Please try again.`,
            code: errorCode || `UNKNOWN_ERROR_${status}`,
            shouldRetry: true,
            shouldRedirectToLogin: false,
            userAction: 'Try again or contact support if the problem persists',
            retryDelay: 5000
        };
    }

    /**
     * Check if an error is retryable based on error information
     * Requirement: 6.4
     */
    static isRetryableError(error: any): boolean {
        if (!error.response) {
            return true; // Network errors are retryable
        }

        const status = error.response.status;
        const errorCode = error.response.data?.error?.code;

        // Retryable HTTP status codes
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        if (retryableStatuses.includes(status)) {
            return true;
        }

        // Retryable error codes
        const retryableErrorCodes = [
            'NETWORK_ERROR',
            'TIMEOUT',
            'INTERNAL_SERVER_ERROR',
            'SERVICE_UNAVAILABLE',
            'BLOCKCHAIN_RECORDING_FAILED',
            'PAYMENT_PROCESSING_FAILED',
            'CONCURRENT_MODIFICATION',
            'DATABASE_ERROR'
        ];

        return retryableErrorCodes.includes(errorCode);
    }

    /**
     * Get retry delay for an error
     */
    static getRetryDelay(error: any, attempt: number): number {
        const enhancedError = this.handleApiError(error);
        const baseDelay = enhancedError.retryDelay || 1000;

        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter

        return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
    }

    /**
     * Check if error should trigger login redirect
     * Requirement: 6.2
     */
    static shouldRedirectToLogin(error: any): boolean {
        const enhancedError = this.handleApiError(error);
        return enhancedError.shouldRedirectToLogin;
    }

    /**
     * Get user-friendly error message
     */
    static getUserMessage(error: any): string {
        const enhancedError = this.handleApiError(error);
        return enhancedError.message;
    }

    /**
     * Get suggested user action
     */
    static getUserAction(error: any): string | undefined {
        const enhancedError = this.handleApiError(error);
        return enhancedError.userAction;
    }
}