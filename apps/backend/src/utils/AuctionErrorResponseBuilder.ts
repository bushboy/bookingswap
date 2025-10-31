/**
 * Auction Error Response Builder
 * Creates structured error responses for API consumers with detailed context
 */

import {
    AuctionCreationError,
    ValidationError,
    DateValidationError,
    AuctionSettingsValidationError,
    AuctionErrorUtils
} from './AuctionErrors';

export interface StructuredErrorResponse {
    error: {
        code: string;
        message: string;
        type: 'validation' | 'business' | 'system' | 'blockchain';
        timestamp: string;
        requestId?: string;
    };
    details?: {
        field?: string;
        value?: any;
        expectedType?: string;
        validationRule?: string;
        phase?: string;
        auctionId?: string;
        swapId?: string;
    };
    context?: {
        operation?: string;
        suggestions?: string[];
        documentation?: string;
        retryable?: boolean;
    };
    validation?: {
        invalidFields?: Array<{
            field: string;
            value: any;
            error: string;
            suggestion?: string;
        }>;
        fieldCount?: number;
        validationSummary?: Record<string, any>;
    };
    debugging?: {
        originalError?: {
            name: string;
            message: string;
            stack?: string;
        };
        metadata?: Record<string, any>;
        traceId?: string;
    };
}

export interface AuctionValidationErrorResponse {
    error: 'AUCTION_VALIDATION_FAILED';
    message: string;
    details: {
        field: string;
        value: any;
        expectedType: string;
        validationRule: string;
    }[];
    suggestions: string[];
    documentation: string;
}

export interface DateValidationErrorResponse {
    error: 'DATE_VALIDATION_FAILED';
    message: string;
    field: string;
    value: any;
    expectedFormat: string;
    actualType: string;
    examples: string[];
    suggestions: string[];
}

export interface BlockchainErrorResponse {
    error: 'BLOCKCHAIN_OPERATION_FAILED';
    message: string;
    operation: string;
    auctionId?: string;
    swapId?: string;
    retryable: boolean;
    suggestions: string[];
}

/**
 * Builder class for creating structured error responses
 */
export class AuctionErrorResponseBuilder {
    private requestId?: string;
    private traceId?: string;
    private includeDebugging: boolean = false;

    constructor(requestId?: string, traceId?: string) {
        this.requestId = requestId;
        this.traceId = traceId;
        this.includeDebugging = process.env.NODE_ENV !== 'production';
    }

    /**
     * Build structured error response from any auction-related error
     */
    buildErrorResponse(error: Error, context?: {
        operation?: string;
        auctionId?: string;
        swapId?: string;
        metadata?: Record<string, any>;
    }): StructuredErrorResponse {
        const baseResponse: StructuredErrorResponse = {
            error: {
                code: this.getErrorCode(error),
                message: AuctionErrorUtils.getUserFriendlyMessage(error),
                type: this.getErrorType(error),
                timestamp: new Date().toISOString(),
                requestId: this.requestId
            }
        };

        // Add specific error details based on error type
        if (error instanceof DateValidationError) {
            return this.buildDateValidationResponse(error, baseResponse, context);
        }

        if (error instanceof AuctionSettingsValidationError) {
            return this.buildAuctionSettingsValidationResponse(error, baseResponse, context);
        }

        if (error instanceof ValidationError) {
            return this.buildValidationErrorResponse(error, baseResponse, context);
        }

        if (error instanceof AuctionCreationError) {
            return this.buildAuctionCreationErrorResponse(error, baseResponse, context);
        }

        // Generic error response
        return this.buildGenericErrorResponse(error, baseResponse, context);
    }

    /**
     * Build date validation error response
     */
    private buildDateValidationResponse(
        error: DateValidationError,
        baseResponse: StructuredErrorResponse,
        context?: any
    ): StructuredErrorResponse {
        return {
            ...baseResponse,
            error: {
                ...baseResponse.error,
                code: 'DATE_VALIDATION_FAILED'
            },
            details: {
                field: error.field || 'unknown',
                value: error.dateValue,
                expectedType: 'Date object or ISO 8601 string',
                validationRule: 'Date must be valid and properly formatted',
                ...context
            },
            context: {
                operation: context?.operation || 'date_validation',
                suggestions: [
                    'Ensure dates are in ISO 8601 format (e.g., "2025-11-02T15:00:00.000Z")',
                    'Use Date objects when possible',
                    'Verify timezone information is included',
                    'Check that the date is in the future for auction end dates'
                ],
                documentation: '/docs/api/date-formats',
                retryable: true
            },
            validation: {
                invalidFields: [{
                    field: error.field || 'unknown',
                    value: error.dateValue,
                    error: error.message,
                    suggestion: `Convert to proper Date format. Expected: ${error.expectedFormat || 'ISO 8601 string or Date object'}`
                }],
                fieldCount: 1,
                validationSummary: {
                    [error.field || 'unknown']: {
                        error: error.message,
                        value: error.dateValue,
                        actualType: error.actualType,
                        expectedFormat: error.expectedFormat
                    }
                }
            },
            debugging: this.includeDebugging ? {
                originalError: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                metadata: {
                    dateValue: error.dateValue,
                    expectedFormat: error.expectedFormat,
                    actualType: error.actualType,
                    ...context?.metadata
                },
                traceId: this.traceId
            } : undefined
        };
    }

    /**
     * Build auction settings validation error response
     */
    private buildAuctionSettingsValidationResponse(
        error: AuctionSettingsValidationError,
        baseResponse: StructuredErrorResponse,
        context?: any
    ): StructuredErrorResponse {
        return {
            ...baseResponse,
            error: {
                ...baseResponse.error,
                code: 'AUCTION_SETTINGS_VALIDATION_FAILED'
            },
            details: {
                validationRule: 'All auction settings must be valid and consistent',
                ...context
            },
            context: {
                operation: context?.operation || 'auction_settings_validation',
                suggestions: [
                    'Review all auction settings for proper types and values',
                    'Ensure at least one proposal type is allowed',
                    'Verify auction end date is in the future',
                    'Check that autoSelectAfterHours is a positive number if provided'
                ],
                documentation: '/docs/api/auction-settings',
                retryable: true
            },
            validation: {
                invalidFields: error.invalidFields || [],
                fieldCount: error.invalidFields?.length || 0,
                validationSummary: error.invalidFields?.reduce((acc, field) => {
                    acc[field.field] = {
                        error: field.error,
                        value: field.value,
                        suggestion: field.suggestion
                    };
                    return acc;
                }, {} as Record<string, any>)
            },
            debugging: this.includeDebugging ? {
                originalError: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                metadata: {
                    invalidFields: error.invalidFields,
                    ...context?.metadata
                },
                traceId: this.traceId
            } : undefined
        };
    }

    /**
     * Build validation error response
     */
    private buildValidationErrorResponse(
        error: ValidationError,
        baseResponse: StructuredErrorResponse,
        context?: any
    ): StructuredErrorResponse {
        return {
            ...baseResponse,
            error: {
                ...baseResponse.error,
                code: 'VALIDATION_FAILED'
            },
            details: {
                field: error.field,
                value: error.value,
                validationRule: 'Field must meet validation requirements',
                ...context
            },
            context: {
                operation: context?.operation || 'field_validation',
                suggestions: [
                    'Check field value format and type',
                    'Ensure required fields are provided',
                    'Verify field values meet business rules'
                ],
                documentation: '/docs/api/validation-rules',
                retryable: true
            },
            debugging: this.includeDebugging ? {
                originalError: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                metadata: {
                    field: error.field,
                    value: error.value,
                    ...context?.metadata
                },
                traceId: this.traceId
            } : undefined
        };
    }

    /**
     * Build auction creation error response
     */
    private buildAuctionCreationErrorResponse(
        error: AuctionCreationError,
        baseResponse: StructuredErrorResponse,
        context?: any
    ): StructuredErrorResponse {
        const isBlockchainError = error.phase === 'blockchain_recording';
        const isRetryable = !isBlockchainError || error.message.includes('timeout');

        return {
            ...baseResponse,
            error: {
                ...baseResponse.error,
                code: isBlockchainError ? 'BLOCKCHAIN_OPERATION_FAILED' : 'AUCTION_CREATION_FAILED'
            },
            details: {
                phase: error.phase,
                auctionId: error.auctionId,
                swapId: error.swapId,
                ...context
            },
            context: {
                operation: context?.operation || 'auction_creation',
                suggestions: this.getAuctionCreationSuggestions(error),
                documentation: '/docs/api/auction-creation',
                retryable: isRetryable
            },
            debugging: this.includeDebugging ? {
                originalError: error.originalError ? {
                    name: error.originalError.name,
                    message: error.originalError.message,
                    stack: error.originalError.stack
                } : undefined,
                metadata: {
                    phase: error.phase,
                    auctionId: error.auctionId,
                    swapId: error.swapId,
                    ...context?.metadata
                },
                traceId: this.traceId
            } : undefined
        };
    }

    /**
     * Build generic error response
     */
    private buildGenericErrorResponse(
        error: Error,
        baseResponse: StructuredErrorResponse,
        context?: any
    ): StructuredErrorResponse {
        return {
            ...baseResponse,
            error: {
                ...baseResponse.error,
                code: 'AUCTION_OPERATION_FAILED'
            },
            context: {
                operation: context?.operation || 'auction_operation',
                suggestions: [
                    'Review the error message for specific guidance',
                    'Ensure all required parameters are provided',
                    'Try the operation again after a brief delay'
                ],
                documentation: '/docs/api/error-handling',
                retryable: true
            },
            debugging: this.includeDebugging ? {
                originalError: {
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                },
                metadata: context?.metadata,
                traceId: this.traceId
            } : undefined
        };
    }

    /**
     * Get error code based on error type
     */
    private getErrorCode(error: Error): string {
        if (error instanceof DateValidationError) {
            return 'DATE_VALIDATION_FAILED';
        }
        if (error instanceof AuctionSettingsValidationError) {
            return 'AUCTION_SETTINGS_VALIDATION_FAILED';
        }
        if (error instanceof ValidationError) {
            return 'VALIDATION_FAILED';
        }
        if (error instanceof AuctionCreationError) {
            return error.phase === 'blockchain_recording' ? 'BLOCKCHAIN_OPERATION_FAILED' : 'AUCTION_CREATION_FAILED';
        }
        return 'AUCTION_OPERATION_FAILED';
    }

    /**
     * Get error type for categorization
     */
    private getErrorType(error: Error): 'validation' | 'business' | 'system' | 'blockchain' {
        if (error instanceof ValidationError || error instanceof DateValidationError || error instanceof AuctionSettingsValidationError) {
            return 'validation';
        }
        if (error instanceof AuctionCreationError) {
            return error.phase === 'blockchain_recording' ? 'blockchain' : 'business';
        }
        return 'system';
    }

    /**
     * Get suggestions based on auction creation error
     */
    private getAuctionCreationSuggestions(error: AuctionCreationError): string[] {
        const suggestions: string[] = [];

        switch (error.phase) {
            case 'validation':
                suggestions.push(
                    'Review auction settings for proper format and values',
                    'Ensure all required fields are provided',
                    'Check date formats and timing constraints'
                );
                break;
            case 'blockchain_recording':
                suggestions.push(
                    'Check blockchain service connectivity',
                    'Verify transaction parameters are valid',
                    'Try the operation again after a brief delay',
                    'Contact support if the issue persists'
                );
                break;
            case 'rollback':
                suggestions.push(
                    'Contact support immediately - data consistency may be affected',
                    'Do not retry the operation until the issue is resolved',
                    'Provide the auction ID and swap ID to support'
                );
                break;
            default:
                suggestions.push(
                    'Review the error message for specific guidance',
                    'Ensure all auction parameters are valid',
                    'Try the operation again with corrected data'
                );
        }

        return suggestions;
    }

    /**
     * Create legacy validation error response for backward compatibility
     */
    static createLegacyValidationErrorResponse(
        error: ValidationError,
        context?: { swapId?: string; auctionId?: string }
    ): AuctionValidationErrorResponse {
        return {
            error: 'AUCTION_VALIDATION_FAILED',
            message: error.message,
            details: [{
                field: error.field || 'unknown',
                value: error.value,
                expectedType: 'valid value',
                validationRule: error.message
            }],
            suggestions: [
                'Review the field value and format',
                'Ensure all required fields are provided',
                'Check the API documentation for valid formats'
            ],
            documentation: '/docs/api/validation-rules'
        };
    }

    /**
     * Create date validation error response for API consumers
     */
    static createDateValidationErrorResponse(
        error: DateValidationError
    ): DateValidationErrorResponse {
        return {
            error: 'DATE_VALIDATION_FAILED',
            message: error.message,
            field: error.field || 'unknown',
            value: error.dateValue,
            expectedFormat: error.expectedFormat || 'ISO 8601 string or Date object',
            actualType: error.actualType || typeof error.dateValue,
            examples: [
                '2025-11-02T15:00:00.000Z',
                'new Date("2025-11-02T15:00:00.000Z")',
                '1730559600000'
            ],
            suggestions: [
                'Use ISO 8601 format for date strings',
                'Ensure dates are in the future for auction end dates',
                'Include timezone information in date strings',
                'Use Date objects when possible'
            ]
        };
    }

    /**
     * Create blockchain error response for API consumers
     */
    static createBlockchainErrorResponse(
        error: AuctionCreationError,
        operation: string
    ): BlockchainErrorResponse {
        const isRetryable = error.message.includes('timeout') ||
            error.message.includes('network') ||
            error.message.includes('connection');

        return {
            error: 'BLOCKCHAIN_OPERATION_FAILED',
            message: error.message,
            operation,
            auctionId: error.auctionId,
            swapId: error.swapId,
            retryable: isRetryable,
            suggestions: isRetryable ? [
                'Try the operation again after a brief delay',
                'Check network connectivity',
                'Contact support if the issue persists'
            ] : [
                'Review the operation parameters',
                'Contact support for assistance',
                'Do not retry without resolving the underlying issue'
            ]
        };
    }
}