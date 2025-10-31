/**
 * Auction-specific error classes for structured error handling
 */

import { ValidationError as BaseValidationError, SwapPlatformError, ErrorContext } from '@booking-swap/shared';

/**
 * Enhanced ValidationError with additional context for auction validation
 */
export class ValidationError extends BaseValidationError {
    public readonly field?: string;
    public readonly value?: any;

    constructor(message: string, field?: string, value?: any, context?: ErrorContext) {
        super(message, { field, value }, context);
        this.name = 'ValidationError';
        this.field = field;
        this.value = value;
    }

    /**
     * Creates a validation error for a specific field
     */
    static forField(field: string, message: string, value?: any, context?: ErrorContext): ValidationError {
        return new ValidationError(`${field}: ${message}`, field, value, context);
    }

    /**
     * Creates a validation error for date-related issues
     */
    static forDateField(field: string, value: any, reason: string, context?: ErrorContext): ValidationError {
        const message = `Invalid date for ${field}: ${reason}`;
        return new ValidationError(message, field, value, context);
    }

    /**
     * Creates a validation error for range violations
     */
    static forRangeViolation(
        field: string,
        value: any,
        min?: number | Date,
        max?: number | Date,
        context?: ErrorContext
    ): ValidationError {
        let message = `${field} value ${value} is out of range`;
        if (min !== undefined && max !== undefined) {
            message += ` (must be between ${min} and ${max})`;
        } else if (min !== undefined) {
            message += ` (must be at least ${min})`;
        } else if (max !== undefined) {
            message += ` (must not exceed ${max})`;
        }

        return new ValidationError(message, field, value, context);
    }
}

/**
 * Auction creation specific error
 */
export class AuctionCreationError extends SwapPlatformError {
    public readonly auctionId?: string;
    public readonly swapId?: string;
    public readonly originalError?: Error;
    public readonly phase?: 'validation' | 'creation' | 'blockchain_recording' | 'rollback';

    constructor(
        message: string,
        auctionId?: string,
        swapId?: string,
        originalError?: Error,
        phase?: 'validation' | 'creation' | 'blockchain_recording' | 'rollback',
        context?: ErrorContext
    ) {
        super('AUCTION_CREATION_FAILED', message, 'business', false, context, originalError);
        this.name = 'AuctionCreationError';
        this.auctionId = auctionId;
        this.swapId = swapId;
        this.originalError = originalError;
        this.phase = phase;
    }

    /**
     * Creates an auction creation error for validation phase
     */
    static forValidation(
        message: string,
        swapId?: string,
        originalError?: Error,
        context?: ErrorContext
    ): AuctionCreationError {
        return new AuctionCreationError(
            `Auction validation failed: ${message}`,
            undefined,
            swapId,
            originalError,
            'validation',
            context
        );
    }

    /**
     * Creates an auction creation error for blockchain recording phase
     */
    static forBlockchainRecording(
        message: string,
        auctionId?: string,
        swapId?: string,
        originalError?: Error,
        context?: ErrorContext
    ): AuctionCreationError {
        return new AuctionCreationError(
            `Blockchain recording failed: ${message}`,
            auctionId,
            swapId,
            originalError,
            'blockchain_recording',
            context
        );
    }

    /**
     * Creates an auction creation error for rollback phase
     */
    static forRollback(
        message: string,
        auctionId?: string,
        swapId?: string,
        originalError?: Error,
        context?: ErrorContext
    ): AuctionCreationError {
        return new AuctionCreationError(
            `Rollback failed: ${message}`,
            auctionId,
            swapId,
            originalError,
            'rollback',
            context
        );
    }

    /**
     * Enhanced JSON representation with auction-specific details
     */
    toJSON() {
        const baseJson = super.toJSON();
        return {
            ...baseJson,
            error: {
                ...baseJson.error,
                auctionId: this.auctionId,
                swapId: this.swapId,
                phase: this.phase,
                originalError: this.originalError ? {
                    name: this.originalError.name,
                    message: this.originalError.message,
                    stack: this.originalError.stack
                } : undefined
            }
        };
    }
}

/**
 * Date validation specific error with enhanced context
 */
export class DateValidationError extends ValidationError {
    public readonly dateValue?: any;
    public readonly expectedFormat?: string;
    public readonly actualType?: string;

    constructor(
        message: string,
        field: string,
        dateValue?: any,
        expectedFormat?: string,
        context?: ErrorContext
    ) {
        super(message, field, dateValue, context);
        this.name = 'DateValidationError';
        this.dateValue = dateValue;
        this.expectedFormat = expectedFormat;
        this.actualType = typeof dateValue;
    }

    /**
     * Creates a date validation error for invalid format
     */
    static forInvalidFormat(
        field: string,
        value: any,
        expectedFormat: string = 'ISO 8601 date string or Date object',
        context?: ErrorContext
    ): DateValidationError {
        const message = `Invalid date format for ${field}. Expected: ${expectedFormat}, received: ${typeof value}`;
        return new DateValidationError(message, field, value, expectedFormat, context);
    }

    /**
     * Creates a date validation error for timing issues
     */
    static forTimingIssue(
        field: string,
        value: any,
        issue: string,
        context?: ErrorContext
    ): DateValidationError {
        const message = `Date timing issue for ${field}: ${issue}`;
        return new DateValidationError(message, field, value, undefined, context);
    }

    /**
     * Enhanced JSON representation with date-specific details
     */
    toJSON() {
        const baseJson = super.toJSON();
        return {
            ...baseJson,
            error: {
                ...baseJson.error,
                dateValue: this.dateValue,
                expectedFormat: this.expectedFormat,
                actualType: this.actualType,
                validationHelp: {
                    supportedFormats: [
                        'ISO 8601 string (e.g., "2025-11-02T15:00:00.000Z")',
                        'Date object',
                        'Unix timestamp (number)'
                    ],
                    examples: [
                        'new Date("2025-11-02T15:00:00.000Z")',
                        '"2025-11-02T15:00:00.000Z"',
                        '1730559600000'
                    ]
                }
            }
        };
    }
}

/**
 * Auction settings validation error with field-specific context
 */
export class AuctionSettingsValidationError extends ValidationError {
    public readonly invalidFields?: Array<{
        field: string;
        value: any;
        error: string;
        suggestion?: string;
    }>;

    constructor(
        message: string,
        invalidFields?: Array<{
            field: string;
            value: any;
            error: string;
            suggestion?: string;
        }>,
        context?: ErrorContext
    ) {
        super(message, undefined, undefined, context);
        this.name = 'AuctionSettingsValidationError';
        this.invalidFields = invalidFields;
    }

    /**
     * Creates an auction settings validation error from multiple field errors
     */
    static fromFieldErrors(
        fieldErrors: Array<{
            field: string;
            value: any;
            error: string;
            suggestion?: string;
        }>,
        context?: ErrorContext
    ): AuctionSettingsValidationError {
        const message = `Auction settings validation failed for ${fieldErrors.length} field(s): ${fieldErrors.map(f => f.field).join(', ')}`;
        return new AuctionSettingsValidationError(message, fieldErrors, context);
    }

    /**
     * Enhanced JSON representation with field-specific details
     */
    toJSON() {
        const baseJson = super.toJSON();
        return {
            ...baseJson,
            error: {
                ...baseJson.error,
                invalidFields: this.invalidFields,
                fieldCount: this.invalidFields?.length || 0,
                validationSummary: this.invalidFields?.reduce((acc, field) => {
                    acc[field.field] = {
                        error: field.error,
                        value: field.value,
                        suggestion: field.suggestion
                    };
                    return acc;
                }, {} as Record<string, any>)
            }
        };
    }
}

/**
 * Utility functions for error handling
 */
export class AuctionErrorUtils {
    /**
     * Wraps a function to catch and enhance errors with auction context
     */
    static wrapWithAuctionContext<T>(
        operation: () => T | Promise<T>,
        context: {
            auctionId?: string;
            swapId?: string;
            phase?: string;
            operation?: string;
        }
    ): () => Promise<T> {
        return async () => {
            try {
                const result = await Promise.resolve(operation());
                return result;
            } catch (error) {
                if (error instanceof ValidationError || error instanceof AuctionCreationError) {
                    // Already properly typed, just add context
                    throw error;
                }

                // Wrap unknown errors
                throw new AuctionCreationError(
                    error instanceof Error ? error.message : 'Unknown error occurred',
                    context.auctionId,
                    context.swapId,
                    error instanceof Error ? error : undefined,
                    context.phase as any,
                    {
                        operation: context.operation,
                        metadata: {
                            timestamp: new Date().toISOString()
                        }
                    }
                );
            }
        };
    }

    /**
     * Checks if an error is auction-related
     */
    static isAuctionError(error: any): error is AuctionCreationError | ValidationError | DateValidationError | AuctionSettingsValidationError {
        return error instanceof AuctionCreationError ||
            error instanceof ValidationError ||
            error instanceof DateValidationError ||
            error instanceof AuctionSettingsValidationError;
    }

    /**
     * Extracts user-friendly error message from auction errors
     */
    static getUserFriendlyMessage(error: Error): string {
        if (error instanceof DateValidationError) {
            return `Date validation failed: ${error.message}. Please ensure dates are in the correct format and within valid ranges.`;
        }

        if (error instanceof AuctionSettingsValidationError) {
            const fieldCount = error.invalidFields?.length || 0;
            return `Auction settings validation failed for ${fieldCount} field(s). Please review and correct the highlighted fields.`;
        }

        if (error instanceof ValidationError) {
            return `Validation failed: ${error.message}`;
        }

        if (error instanceof AuctionCreationError) {
            switch (error.phase) {
                case 'validation':
                    return 'Auction settings validation failed. Please review your auction configuration.';
                case 'blockchain_recording':
                    return 'Failed to record auction on blockchain. Please try again or contact support.';
                case 'rollback':
                    return 'Auction creation failed and cleanup encountered issues. Please contact support.';
                default:
                    return 'Auction creation failed. Please review your settings and try again.';
            }
        }

        return error.message || 'An unexpected error occurred during auction creation.';
    }

    /**
     * Logs auction errors with structured context
     */
    static logError(error: Error, context?: Record<string, any>): void {
        const logData: any = {
            timestamp: new Date().toISOString(),
            errorType: error.constructor.name,
            message: error.message,
            stack: error.stack,
            ...context
        };

        if (this.isAuctionError(error)) {
            if (error instanceof AuctionCreationError) {
                logData.auctionId = error.auctionId;
                logData.swapId = error.swapId;
                logData.phase = error.phase;
                logData.originalError = error.originalError ? {
                    name: error.originalError.name,
                    message: error.originalError.message
                } : undefined;
            }

            if (error instanceof ValidationError) {
                logData.field = error.field;
                logData.value = error.value;
            }

            if (error instanceof DateValidationError) {
                logData.dateValue = error.dateValue;
                logData.expectedFormat = error.expectedFormat;
                logData.actualType = error.actualType;
            }

            if (error instanceof AuctionSettingsValidationError) {
                logData.invalidFields = error.invalidFields;
                logData.fieldCount = error.invalidFields?.length || 0;
            }
        }

        console.error('Auction Error:', logData);
    }
}