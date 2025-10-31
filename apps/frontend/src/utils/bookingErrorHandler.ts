/**
 * Enhanced error handling utilities for booking operations
 * Provides comprehensive error parsing and user-friendly error messages
 */

import { getBookingTypeOptions } from '@booking-swap/shared';

export interface BookingApiError {
    code: string;
    message: string;
    category: string;
    details?: Array<{
        field: string;
        message: string;
        value?: any;
    }>;
    acceptedBookingTypes?: Array<{
        value: string;
        label: string;
        icon: string;
    }>;
}

export interface EnhancedBookingError {
    type: 'validation' | 'network' | 'server' | 'booking_type' | 'unknown';
    title: string;
    message: string;
    details?: string[];
    acceptedBookingTypes?: Array<{
        value: string;
        label: string;
        icon: string;
    }>;
    canRetry: boolean;
    suggestedActions?: string[];
}

/**
 * Parse API error response and extract booking-specific error information
 */
export function parseBookingApiError(error: any): EnhancedBookingError {
    // Handle network errors
    if (!error.response) {
        return {
            type: 'network',
            title: 'Connection Error',
            message: 'Unable to connect to the server. Please check your internet connection.',
            canRetry: true,
            suggestedActions: [
                'Check your internet connection',
                'Try again in a few moments',
                'Contact support if the problem persists'
            ]
        };
    }

    const { status, data } = error.response;
    const apiError: BookingApiError = data?.error || {};

    // Handle booking type validation errors specifically
    if (apiError.code === 'INVALID_BOOKING_TYPE' ||
        (apiError.details && apiError.details.some(d => d.field.includes('type')))) {

        const acceptedTypes = apiError.acceptedBookingTypes || getBookingTypeOptions();

        return {
            type: 'booking_type',
            title: 'Invalid Booking Type',
            message: apiError.message || 'The selected booking type is not currently supported.',
            acceptedBookingTypes: acceptedTypes,
            canRetry: true,
            suggestedActions: [
                'Select one of the supported booking types',
                'Only accommodation bookings are currently available',
                'Event and travel bookings are temporarily disabled'
            ],
            details: acceptedTypes.map(type => `${type.icon} ${type.label}`)
        };
    }

    // Handle general validation errors
    if (status === 400 && apiError.code === 'VALIDATION_ERROR') {
        const fieldErrors = apiError.details?.map(detail =>
            `${detail.field}: ${detail.message}`
        ) || [];

        return {
            type: 'validation',
            title: 'Validation Error',
            message: 'Please correct the following issues with your booking information:',
            details: fieldErrors,
            canRetry: true,
            suggestedActions: [
                'Review and correct the highlighted fields',
                'Ensure all required information is provided',
                'Check that dates and prices are valid'
            ]
        };
    }

    // Handle server errors
    if (status >= 500) {
        return {
            type: 'server',
            title: 'Server Error',
            message: 'A server error occurred while processing your booking. Please try again.',
            canRetry: true,
            suggestedActions: [
                'Try submitting your booking again',
                'Wait a few minutes and retry',
                'Contact support if the error persists'
            ]
        };
    }

    // Handle authentication/authorization errors
    if (status === 401 || status === 403) {
        return {
            type: 'validation',
            title: 'Authentication Required',
            message: 'You need to be logged in to create or edit bookings.',
            canRetry: false,
            suggestedActions: [
                'Please log in to your account',
                'Refresh the page and try again'
            ]
        };
    }

    // Handle unknown errors
    return {
        type: 'unknown',
        title: 'Unexpected Error',
        message: apiError.message || 'An unexpected error occurred. Please try again.',
        canRetry: true,
        suggestedActions: [
            'Try again in a few moments',
            'Refresh the page',
            'Contact support if the problem continues'
        ]
    };
}

/**
 * Format error message for display in UI components
 */
export function formatBookingErrorMessage(error: EnhancedBookingError): {
    title: string;
    message: string;
    details?: string[];
    acceptedBookingTypes?: Array<{
        value: string;
        label: string;
        icon: string;
    }>;
} {
    return {
        title: error.title,
        message: error.message,
        details: error.details,
        acceptedBookingTypes: error.acceptedBookingTypes
    };
}

/**
 * Get user-friendly error message for booking type validation
 */
export function getBookingTypeErrorMessage(acceptedTypes?: Array<{ value: string; label: string; icon: string }>): string {
    const types = acceptedTypes || getBookingTypeOptions();
    const typeList = types.map(type => `${type.icon} ${type.label}`).join(', ');

    return `Only accommodation bookings are currently supported: ${typeList}. Event, flight, and rental bookings are temporarily disabled.`;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: EnhancedBookingError): boolean {
    return error.canRetry;
}

/**
 * Get suggested actions for an error
 */
export function getErrorSuggestedActions(error: EnhancedBookingError): string[] {
    return error.suggestedActions || [];
}

/**
 * Log booking error for debugging and monitoring
 */
export function logBookingError(error: EnhancedBookingError, context?: {
    bookingId?: string;
    userId?: string;
    action?: string;
}): void {
    console.error('Booking Error:', {
        type: error.type,
        title: error.title,
        message: error.message,
        details: error.details,
        context,
        timestamp: new Date().toISOString()
    });

    // In production, this would send to monitoring service
    if (import.meta.env.PROD) {
        // Send to monitoring service (e.g., Sentry, LogRocket, etc.)
        // monitoringService.captureException(error, context);
    }
}