/**
 * Comprehensive error handling utilities for SwapController
 * Provides structured error responses with recovery guidance and monitoring integration
 */

import { Response } from 'express';
import { logger } from './logger';

export interface SwapErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        category: 'authentication' | 'validation' | 'business' | 'service' | 'network' | 'system';
        recoverable: boolean;
        userGuidance?: string[];
        technicalDetails?: Record<string, any>;
        recovery?: {
            canRetry: boolean;
            retryDelay?: number;
            maxRetries?: number;
            fallbackAction?: string;
        };
    };
    requestId?: string;
    timestamp: string;
}

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
 * Error codes specific to swap operations
 */
export const SWAP_ERROR_CODES = {
    // Service availability errors
    BOOKING_SERVICE_UNAVAILABLE: 'BOOKING_SERVICE_UNAVAILABLE',
    BOOKING_METHOD_MISSING: 'BOOKING_METHOD_MISSING',
    SERVICE_INTEGRATION_FAILED: 'SERVICE_INTEGRATION_FAILED',

    // Swap creation errors
    SWAP_CREATION_FAILED: 'SWAP_CREATION_FAILED',
    SWAP_VALIDATION_FAILED: 'SWAP_VALIDATION_FAILED',
    SWAP_TIMING_RESTRICTION: 'SWAP_TIMING_RESTRICTION',
    SWAP_BLOCKCHAIN_ERROR: 'SWAP_BLOCKCHAIN_ERROR',

    // Booking-related errors
    BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
    BOOKING_ACCESS_DENIED: 'BOOKING_ACCESS_DENIED',
    BOOKING_NOT_AVAILABLE: 'BOOKING_NOT_AVAILABLE',
    BOOKING_VALIDATION_FAILED: 'BOOKING_VALIDATION_FAILED',

    // Authentication and authorization
    UNAUTHORIZED: 'UNAUTHORIZED',
    INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

    // Validation errors
    INVALID_REQUEST_DATA: 'INVALID_REQUEST_DATA',
    MISSING_REQUIRED_FIELDS: 'MISSING_REQUIRED_FIELDS',
    INVALID_DATE_FORMAT: 'INVALID_DATE_FORMAT',

    // System errors
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
} as const;

/**
 * Maps error types to HTTP status codes
 */
const ERROR_STATUS_CODES: Record<string, number> = {
    [SWAP_ERROR_CODES.UNAUTHORIZED]: 401,
    [SWAP_ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 403,
    [SWAP_ERROR_CODES.BOOKING_NOT_FOUND]: 404,
    [SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED]: 403,
    [SWAP_ERROR_CODES.BOOKING_NOT_AVAILABLE]: 409,
    [SWAP_ERROR_CODES.SWAP_TIMING_RESTRICTION]: 422,
    [SWAP_ERROR_CODES.INVALID_REQUEST_DATA]: 400,
    [SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS]: 400,
    [SWAP_ERROR_CODES.INVALID_DATE_FORMAT]: 400,
    [SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED]: 422,
    [SWAP_ERROR_CODES.BOOKING_VALIDATION_FAILED]: 422,
    [SWAP_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE]: 503,
    [SWAP_ERROR_CODES.SERVICE_INTEGRATION_FAILED]: 502,
    [SWAP_ERROR_CODES.NETWORK_ERROR]: 502,
    [SWAP_ERROR_CODES.TIMEOUT_ERROR]: 504,
};

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
 * Analyzes error and determines appropriate error code and category
 */
export function analyzeError(error: any): { code: string; category: SwapErrorResponse['error']['category']; recoverable: boolean } {
    // Handle service errors
    if (isServiceError(error)) {
        return {
            code: error.code,
            category: mapServiceCategoryToResponseCategory(error.category),
            recoverable: error.recoverable
        };
    }

    // Analyze error message for patterns
    const errorMessage = (error.message || '').toLowerCase();

    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
        return { code: SWAP_ERROR_CODES.UNAUTHORIZED, category: 'authentication', recoverable: false };
    }

    // Booking-related errors
    if (errorMessage.includes('booking not found') || errorMessage.includes('not found')) {
        return { code: SWAP_ERROR_CODES.BOOKING_NOT_FOUND, category: 'business', recoverable: false };
    }

    if (errorMessage.includes('not available') || errorMessage.includes('unavailable')) {
        return { code: SWAP_ERROR_CODES.BOOKING_NOT_AVAILABLE, category: 'business', recoverable: false };
    }

    if (errorMessage.includes('access denied') || errorMessage.includes('permission')) {
        return { code: SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED, category: 'business', recoverable: false };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
        return { code: SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED, category: 'validation', recoverable: true };
    }

    // Service availability errors
    if (errorMessage.includes('service') && errorMessage.includes('unavailable')) {
        return { code: SWAP_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE, category: 'service', recoverable: true };
    }

    if (errorMessage.includes('method') && (errorMessage.includes('missing') || errorMessage.includes('not a function'))) {
        return { code: SWAP_ERROR_CODES.BOOKING_METHOD_MISSING, category: 'service', recoverable: false };
    }

    // Timing restrictions
    if (errorMessage.includes('auction') && errorMessage.includes('last-minute')) {
        return { code: SWAP_ERROR_CODES.SWAP_TIMING_RESTRICTION, category: 'business', recoverable: false };
    }

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        return { code: SWAP_ERROR_CODES.NETWORK_ERROR, category: 'network', recoverable: true };
    }

    // Blockchain errors
    if (errorMessage.includes('blockchain') || errorMessage.includes('transaction')) {
        return { code: SWAP_ERROR_CODES.SWAP_BLOCKCHAIN_ERROR, category: 'system', recoverable: true };
    }

    // Default to internal server error
    return { code: SWAP_ERROR_CODES.INTERNAL_SERVER_ERROR, category: 'system', recoverable: true };
}

/**
 * Maps service error categories to response categories
 */
function mapServiceCategoryToResponseCategory(serviceCategory: ServiceError['category']): SwapErrorResponse['error']['category'] {
    switch (serviceCategory) {
        case 'service_unavailable':
            return 'service';
        case 'method_missing':
            return 'service';
        case 'integration_failure':
            return 'system';
        case 'validation_error':
            return 'validation';
        case 'business_logic':
            return 'business';
        default:
            return 'system';
    }
}

/**
 * Gets user guidance for error recovery
 */
export function getUserGuidance(code: string, error: any): string[] {
    const guidance: string[] = [];

    switch (code) {
        case SWAP_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE:
            guidance.push('Wait a few moments and try again');
            guidance.push('Check your internet connection');
            guidance.push('If the issue persists, contact support');
            break;

        case SWAP_ERROR_CODES.BOOKING_METHOD_MISSING:
            guidance.push('This appears to be a system issue');
            guidance.push('Please contact support with the error details');
            guidance.push('Try refreshing the page as a temporary workaround');
            break;

        case SWAP_ERROR_CODES.BOOKING_NOT_FOUND:
            guidance.push('Verify the booking ID is correct');
            guidance.push('Check if the booking still exists');
            guidance.push('Try searching for the booking again');
            break;

        case SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED:
            guidance.push('Ensure you are logged in with the correct account');
            guidance.push('Verify you have permission to access this booking');
            guidance.push('Contact the booking owner if you need access');
            break;

        case SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED:
            guidance.push('Review all swap details for accuracy');
            guidance.push('Ensure all required fields are filled correctly');
            guidance.push('Check that dates are valid and in the future');
            break;

        case SWAP_ERROR_CODES.SWAP_TIMING_RESTRICTION:
            guidance.push('Use first-match acceptance instead of auction mode');
            guidance.push('Auctions require at least one week before the event');
            guidance.push('Consider creating the swap closer to the event date');
            break;

        case SWAP_ERROR_CODES.SWAP_BLOCKCHAIN_ERROR:
            guidance.push('Try the transaction again');
            guidance.push('Check your wallet connection if applicable');
            guidance.push('Wait for network congestion to clear');
            break;

        case SWAP_ERROR_CODES.NETWORK_ERROR:
            guidance.push('Check your internet connection');
            guidance.push('Try again in a few moments');
            guidance.push('Refresh the page if the issue continues');
            break;

        default:
            guidance.push('Try the action again');
            guidance.push('Refresh the page if the issue continues');
            guidance.push('Contact support if the problem persists');
    }

    return guidance;
}

/**
 * Gets recovery options for errors
 */
export function getRecoveryOptions(code: string, recoverable: boolean): SwapErrorResponse['error']['recovery'] {
    if (!recoverable) {
        return undefined;
    }

    const baseRecovery = {
        canRetry: true,
        retryDelay: 2000,
        maxRetries: 3,
    };

    switch (code) {
        case SWAP_ERROR_CODES.BOOKING_SERVICE_UNAVAILABLE:
            return {
                ...baseRecovery,
                retryDelay: 5000,
                fallbackAction: 'Try again later or contact support',
            };

        case SWAP_ERROR_CODES.NETWORK_ERROR:
            return {
                ...baseRecovery,
                retryDelay: 3000,
                fallbackAction: 'Check your internet connection',
            };

        case SWAP_ERROR_CODES.SWAP_BLOCKCHAIN_ERROR:
            return {
                ...baseRecovery,
                retryDelay: 10000,
                maxRetries: 2,
                fallbackAction: 'Wait for network congestion to clear',
            };

        case SWAP_ERROR_CODES.SWAP_VALIDATION_FAILED:
            return {
                canRetry: true,
                fallbackAction: 'Review and correct the validation errors',
            };

        default:
            return baseRecovery;
    }
}

/**
 * Handles swap-related errors and sends appropriate response
 */
export function handleSwapError(
    error: any,
    res: Response,
    context: {
        operation: string;
        userId?: string;
        requestId?: string;
        requestData?: any;
    }
): void {
    const { code, category, recoverable } = analyzeError(error);
    const statusCode = ERROR_STATUS_CODES[code] || 500;
    const userGuidance = getUserGuidance(code, error);
    const recovery = getRecoveryOptions(code, recoverable);

    // Extract user message from service error or use default
    const userMessage = isServiceError(error) ? error.userMessage : error.message;

    // Prepare technical details for logging
    const technicalDetails = {
        operation: context.operation,
        originalError: error.message,
        errorType: error.constructor.name,
        stack: error.stack,
        ...(isServiceError(error) ? error.technicalDetails : {}),
        ...(context.requestData ? { requestData: sanitizeForLogging(context.requestData) } : {}),
    };

    // Log the error with full context
    logger.error(`Swap operation failed: ${context.operation}`, {
        code,
        category,
        recoverable,
        statusCode,
        userId: context.userId,
        requestId: context.requestId,
        userMessage,
        technicalDetails,
    });

    // Prepare error response
    const errorResponse: SwapErrorResponse = {
        success: false,
        error: {
            code,
            message: userMessage,
            category,
            recoverable,
            userGuidance,
            recovery,
            technicalDetails: process.env.NODE_ENV === 'development' ? technicalDetails : undefined,
        },
        requestId: context.requestId,
        timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
}

/**
 * Sanitizes request data for logging (removes sensitive information)
 */
function sanitizeForLogging(data: any): any {
    if (!data || typeof data !== 'object') {
        return data;
    }

    const sanitized = { ...data };

    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

/**
 * Creates a request ID for tracking
 */
export function generateRequestId(operation: string): string {
    return `${operation}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}