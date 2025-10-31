/**
 * Service-specific error types and handling utilities
 * Provides structured error handling for service method availability and integration issues
 */

export interface ServiceError extends Error {
    code: string;
    category: 'service_unavailable' | 'method_missing' | 'integration_failure' | 'validation_error' | 'business_logic';
    serviceName: string;
    methodName?: string;
    recoverable: boolean;
    userMessage: string;
    technicalDetails?: Record<string, any>;
}

/**
 * Service error codes for consistent error handling
 */
export const SERVICE_ERROR_CODES = {
    // BookingService errors
    BOOKING_SERVICE_UNAVAILABLE: 'BOOKING_SERVICE_UNAVAILABLE',
    BOOKING_METHOD_MISSING: 'BOOKING_METHOD_MISSING',
    BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
    BOOKING_ACCESS_DENIED: 'BOOKING_ACCESS_DENIED',
    BOOKING_VALIDATION_FAILED: 'BOOKING_VALIDATION_FAILED',

    // SwapProposalService errors
    SWAP_CREATION_FAILED: 'SWAP_CREATION_FAILED',
    SWAP_VALIDATION_FAILED: 'SWAP_VALIDATION_FAILED',
    SWAP_SERVICE_INTEGRATION_ERROR: 'SWAP_SERVICE_INTEGRATION_ERROR',

    // General service errors
    SERVICE_METHOD_NOT_AVAILABLE: 'SERVICE_METHOD_NOT_AVAILABLE',
    SERVICE_DEPENDENCY_MISSING: 'SERVICE_DEPENDENCY_MISSING',
    SERVICE_INITIALIZATION_FAILED: 'SERVICE_INITIALIZATION_FAILED',
} as const;

/**
 * Creates a structured service error
 */
export function createServiceError(
    code: string,
    message: string,
    serviceName: string,
    options: {
        methodName?: string;
        category?: ServiceError['category'];
        recoverable?: boolean;
        userMessage?: string;
        technicalDetails?: Record<string, any>;
        cause?: Error;
    } = {}
): ServiceError {
    const error = new Error(message) as ServiceError;
    error.code = code;
    error.serviceName = serviceName;
    error.methodName = options.methodName;
    error.category = options.category || 'integration_failure';
    error.recoverable = options.recoverable ?? true;
    error.userMessage = options.userMessage || getDefaultUserMessage(code);
    error.technicalDetails = options.technicalDetails;

    if (options.cause) {
        error.cause = options.cause;
    }

    return error;
}

/**
 * Gets user-friendly error messages for service error codes
 */
function getDefaultUserMessage(code: string): string {
    switch (code) {
        case SERVICE_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE:
            return 'The booking service is temporarily unavailable. Please try again in a few moments.';

        case SERVICE_ERROR_CODES.BOOKING_METHOD_MISSING:
            return 'There was an issue accessing booking information. Our team has been notified.';

        case SERVICE_ERROR_CODES.BOOKING_NOT_FOUND:
            return 'The requested booking could not be found. Please verify the booking ID and try again.';

        case SERVICE_ERROR_CODES.BOOKING_ACCESS_DENIED:
            return 'You do not have permission to access this booking.';

        case SERVICE_ERROR_CODES.BOOKING_VALIDATION_FAILED:
            return 'The booking information could not be validated. Please check the details and try again.';

        case SERVICE_ERROR_CODES.SWAP_CREATION_FAILED:
            return 'Unable to create the swap proposal. Please check your information and try again.';

        case SERVICE_ERROR_CODES.SWAP_VALIDATION_FAILED:
            return 'The swap proposal contains invalid information. Please review and correct the details.';

        case SERVICE_ERROR_CODES.SWAP_SERVICE_INTEGRATION_ERROR:
            return 'There was an issue processing your swap request. Please try again.';

        case SERVICE_ERROR_CODES.SERVICE_METHOD_NOT_AVAILABLE:
            return 'A required service feature is temporarily unavailable. Please try again later.';

        case SERVICE_ERROR_CODES.SERVICE_DEPENDENCY_MISSING:
            return 'A required service component is not available. Our team has been notified.';

        case SERVICE_ERROR_CODES.SERVICE_INITIALIZATION_FAILED:
            return 'Service initialization failed. Please refresh the page and try again.';

        default:
            return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }
}

/**
 * Error recovery strategies for service errors
 */
export interface ServiceErrorRecovery {
    canRetry: boolean;
    retryDelay?: number;
    maxRetries?: number;
    fallbackAction?: string;
    userGuidance: string[];
    requiresSupport: boolean;
}

/**
 * Gets recovery strategy for service errors
 */
export function getServiceErrorRecovery(error: ServiceError): ServiceErrorRecovery {
    const baseRecovery: ServiceErrorRecovery = {
        canRetry: error.recoverable,
        userGuidance: [],
        requiresSupport: false,
    };

    switch (error.code) {
        case SERVICE_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE:
            return {
                ...baseRecovery,
                canRetry: true,
                retryDelay: 5000,
                maxRetries: 3,
                userGuidance: [
                    'Wait a few moments and try again',
                    'Check your internet connection',
                    'If the issue persists, contact support'
                ],
            };

        case SERVICE_ERROR_CODES.BOOKING_METHOD_MISSING:
            return {
                ...baseRecovery,
                canRetry: false,
                requiresSupport: true,
                userGuidance: [
                    'This appears to be a system issue',
                    'Please contact support with the error details',
                    'Try refreshing the page as a temporary workaround'
                ],
            };

        case SERVICE_ERROR_CODES.BOOKING_NOT_FOUND:
            return {
                ...baseRecovery,
                canRetry: false,
                userGuidance: [
                    'Verify the booking ID is correct',
                    'Check if the booking still exists',
                    'Try searching for the booking again'
                ],
            };

        case SERVICE_ERROR_CODES.BOOKING_ACCESS_DENIED:
            return {
                ...baseRecovery,
                canRetry: false,
                userGuidance: [
                    'Ensure you are logged in with the correct account',
                    'Verify you have permission to access this booking',
                    'Contact the booking owner if you need access'
                ],
            };

        case SERVICE_ERROR_CODES.SWAP_CREATION_FAILED:
            return {
                ...baseRecovery,
                canRetry: true,
                retryDelay: 2000,
                maxRetries: 2,
                userGuidance: [
                    'Review all swap details for accuracy',
                    'Ensure your booking is available for swapping',
                    'Try again with the same information'
                ],
            };

        case SERVICE_ERROR_CODES.SWAP_VALIDATION_FAILED:
            return {
                ...baseRecovery,
                canRetry: true,
                userGuidance: [
                    'Check all required fields are filled correctly',
                    'Verify dates are valid and in the future',
                    'Ensure payment amounts are positive numbers'
                ],
            };

        default:
            return {
                ...baseRecovery,
                canRetry: true,
                retryDelay: 3000,
                maxRetries: 2,
                userGuidance: [
                    'Try the action again',
                    'Refresh the page if the issue continues',
                    'Contact support if the problem persists'
                ],
            };
    }
}

/**
 * Checks if an error is a service error
 */
export function isServiceError(error: any): error is ServiceError {
    return error &&
        typeof error.code === 'string' &&
        typeof error.serviceName === 'string' &&
        typeof error.category === 'string' &&
        typeof error.recoverable === 'boolean';
}

/**
 * Formats service error for logging
 */
export function formatServiceErrorForLogging(error: ServiceError): Record<string, any> {
    return {
        code: error.code,
        message: error.message,
        serviceName: error.serviceName,
        methodName: error.methodName,
        category: error.category,
        recoverable: error.recoverable,
        technicalDetails: error.technicalDetails,
        stack: error.stack,
    };
}

/**
 * Formats service error for API response
 */
export function formatServiceErrorForResponse(error: ServiceError): {
    error: {
        code: string;
        message: string;
        category: string;
        recoverable: boolean;
        recovery?: ServiceErrorRecovery;
    };
} {
    const recovery = getServiceErrorRecovery(error);

    return {
        error: {
            code: error.code,
            message: error.userMessage,
            category: error.category,
            recoverable: error.recoverable,
            recovery: recovery.canRetry || recovery.userGuidance.length > 0 ? recovery : undefined,
        },
    };
}