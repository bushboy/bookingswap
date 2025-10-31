import { apiClient } from './apiClient';
import { SwapCompletionAudit, CompletionValidationResult, SwapCompletionErrorCodes, CompletedSwapInfo, CompletedBookingInfo } from '@booking-swap/shared';
import { logger } from '@/utils/logger';

export interface CompletionStatus {
    id: string;
    status: 'initiated' | 'completed' | 'failed' | 'rolled_back';
    completionType: 'booking_exchange' | 'cash_payment';
    completedAt?: Date;
    initiatedAt: Date;
    completedSwaps: CompletedSwapInfo[];
    updatedBookings: CompletedBookingInfo[];
    errorDetails?: string;
    errorCode?: SwapCompletionErrorCodes;
    blockchainTransactionId?: string;
    validationWarnings?: string[];
}

/**
 * Retry configuration for completion API requests
 */
interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    retryableErrors: string[];
}

/**
 * API service for completion operations with comprehensive error handling and retry logic
 * Implements requirements 5.1, 6.1, 8.1 from the design document
 */
export class CompletionAPI {
    private static readonly retryConfig: RetryConfig = {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: [
            'NETWORK_ERROR',
            'TIMEOUT',
            'INTERNAL_SERVER_ERROR',
            'SERVICE_UNAVAILABLE',
            'DATABASE_TRANSACTION_FAILED',
            'BLOCKCHAIN_RECORDING_FAILED'
        ]
    };

    /**
     * Get completion status for a specific swap with error handling and retry logic
     * Requirements: 5.1, 6.1
     */
    static async getCompletionStatus(swapId: string): Promise<CompletionStatus | null> {
        logger.debug('Getting completion status for swap', { swapId });

        return this.executeWithRetry(async () => {
            try {
                const response = await apiClient.get(`/api/swaps/${swapId}/completion-status`);

                logger.debug('Completion status retrieved successfully', {
                    swapId,
                    status: response.data?.status,
                    completionType: response.data?.completionType
                });

                return response.data;
            } catch (error: any) {
                if (error.response?.status === 404) {
                    logger.debug('No completion found for swap', { swapId });
                    return null; // No completion found for this swap
                }

                logger.error('Failed to get completion status', {
                    swapId,
                    error: error.message,
                    status: error.response?.status
                });

                throw this.handleCompletionError(error, 'getCompletionStatus');
            }
        }, `getCompletionStatus-${swapId}`);
    }

    /**
     * Get completion audit trail with error handling and retry logic
     * Requirements: 6.1
     */
    static async getCompletionAudit(completionId: string): Promise<SwapCompletionAudit> {
        logger.debug('Getting completion audit trail', { completionId });

        return this.executeWithRetry(async () => {
            try {
                const response = await apiClient.get(`/api/completions/${completionId}/audit`);

                logger.debug('Completion audit retrieved successfully', {
                    completionId,
                    status: response.data?.status,
                    affectedSwaps: response.data?.affectedSwaps?.length,
                    affectedBookings: response.data?.affectedBookings?.length
                });

                return response.data;
            } catch (error: any) {
                logger.error('Failed to get completion audit', {
                    completionId,
                    error: error.message,
                    status: error.response?.status
                });

                throw this.handleCompletionError(error, 'getCompletionAudit');
            }
        }, `getCompletionAudit-${completionId}`);
    }

    /**
     * Validate completion consistency with error handling and retry logic
     * Requirements: 5.1
     */
    static async validateCompletion(data: {
        swapIds: string[];
        bookingIds: string[];
        proposalIds: string[];
    }): Promise<CompletionValidationResult> {
        logger.debug('Validating completion consistency', {
            swapCount: data.swapIds.length,
            bookingCount: data.bookingIds.length,
            proposalCount: data.proposalIds.length
        });

        return this.executeWithRetry(async () => {
            try {
                const response = await apiClient.post('/api/completions/validate', data);

                logger.debug('Completion validation completed', {
                    isValid: response.data?.isValid,
                    errorCount: response.data?.errors?.length || 0,
                    warningCount: response.data?.warnings?.length || 0,
                    inconsistentEntities: response.data?.inconsistentEntities?.length || 0
                });

                return response.data;
            } catch (error: any) {
                logger.error('Failed to validate completion', {
                    data,
                    error: error.message,
                    status: error.response?.status
                });

                throw this.handleCompletionError(error, 'validateCompletion');
            }
        }, 'validateCompletion');
    }

    /**
     * Get completion status for multiple swaps with optimized error handling
     * Requirements: 6.1
     */
    static async getMultipleSwapCompletions(swapIds: string[]): Promise<Record<string, CompletionStatus | null>> {
        logger.debug('Getting completion status for multiple swaps', { swapCount: swapIds.length });

        try {
            const promises = swapIds.map(id => this.getCompletionStatus(id));
            const results = await Promise.allSettled(promises);

            const completions: Record<string, CompletionStatus | null> = {};
            const errors: string[] = [];

            swapIds.forEach((swapId, index) => {
                const result = results[index];
                if (result.status === 'fulfilled') {
                    completions[swapId] = result.value;
                } else {
                    completions[swapId] = null;
                    errors.push(`${swapId}: ${result.reason?.message || 'Unknown error'}`);
                }
            });

            if (errors.length > 0) {
                logger.warn('Some completion status requests failed', {
                    totalRequests: swapIds.length,
                    failedRequests: errors.length,
                    errors: errors.slice(0, 5) // Log first 5 errors
                });
            }

            logger.debug('Multiple completion status retrieval completed', {
                totalRequests: swapIds.length,
                successfulRequests: swapIds.length - errors.length,
                failedRequests: errors.length
            });

            return completions;
        } catch (error: any) {
            logger.error('Error fetching multiple swap completions', {
                swapIds,
                error: error.message
            });
            return {};
        }
    }

    /**
     * Get completion status for a booking with error handling and retry logic
     * Requirements: 6.1
     */
    static async getBookingCompletionStatus(bookingId: string): Promise<CompletionStatus | null> {
        logger.debug('Getting completion status for booking', { bookingId });

        return this.executeWithRetry(async () => {
            try {
                const response = await apiClient.get(`/api/bookings/${bookingId}/completion-status`);

                logger.debug('Booking completion status retrieved successfully', {
                    bookingId,
                    status: response.data?.status,
                    completionType: response.data?.completionType
                });

                return response.data;
            } catch (error: any) {
                if (error.response?.status === 404) {
                    logger.debug('No completion found for booking', { bookingId });
                    return null; // No completion found for this booking
                }

                logger.error('Failed to get booking completion status', {
                    bookingId,
                    error: error.message,
                    status: error.response?.status
                });

                throw this.handleCompletionError(error, 'getBookingCompletionStatus');
            }
        }, `getBookingCompletionStatus-${bookingId}`);
    }

    /**
     * Execute API call with retry logic for failed completion requests
     * Requirements: 5.1, 6.1, 8.1
     */
    private static async executeWithRetry<T>(
        operation: () => Promise<T>,
        operationId: string
    ): Promise<T> {
        let lastError: Error;
        let delay = this.retryConfig.baseDelay;

        for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                lastError = error;

                // Don't retry on the last attempt or for non-retryable errors
                if (attempt === this.retryConfig.maxRetries || !this.isRetryableError(error)) {
                    break;
                }

                logger.warn('Completion API call failed, retrying', {
                    operationId,
                    attempt: attempt + 1,
                    maxRetries: this.retryConfig.maxRetries,
                    delay,
                    error: error.message,
                    errorCode: error.code
                });

                // Wait before retrying with exponential backoff
                await this.sleep(delay);
                delay = Math.min(delay * 2, this.retryConfig.maxDelay);
            }
        }

        logger.error('Completion API call failed after all retries', {
            operationId,
            maxRetries: this.retryConfig.maxRetries,
            finalError: lastError!.message
        });

        throw lastError!;
    }

    /**
     * Check if an error is retryable based on error type and status code
     * Requirements: 5.1, 8.1
     */
    private static isRetryableError(error: any): boolean {
        // Network errors are always retryable
        if (!error.response) {
            return true;
        }

        const status = error.response.status;
        const errorCode = error.response.data?.error?.code || error.code;

        // Retryable HTTP status codes
        const retryableStatuses = [408, 429, 500, 502, 503, 504];
        if (retryableStatuses.includes(status)) {
            return true;
        }

        // Retryable error codes
        if (errorCode && this.retryConfig.retryableErrors.includes(errorCode)) {
            return true;
        }

        // Don't retry client errors (4xx except specific ones)
        if (status >= 400 && status < 500) {
            return false;
        }

        return false;
    }

    /**
     * Handle completion-specific errors with enhanced error information
     * Requirements: 5.1, 8.1
     */
    private static handleCompletionError(error: any, operation: string): Error {
        const status = error.response?.status;
        const errorData = error.response?.data?.error;
        const errorCode = errorData?.code || 'UNKNOWN_ERROR';

        let message = error.message;
        let shouldRetry = this.isRetryableError(error);

        // Handle specific completion error codes
        switch (errorCode) {
            case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
                message = 'Completion validation failed. Please check entity states and try again.';
                shouldRetry = false;
                break;
            case SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES:
                message = 'Inconsistent entity states detected. Manual intervention may be required.';
                shouldRetry = false;
                break;
            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                message = 'Database transaction failed. Please try again.';
                shouldRetry = true;
                break;
            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                message = 'Blockchain recording failed. Please try again.';
                shouldRetry = true;
                break;
            default:
                if (status === 404) {
                    message = 'Completion record not found.';
                    shouldRetry = false;
                } else if (status === 403) {
                    message = 'Access denied to completion information.';
                    shouldRetry = false;
                } else if (status >= 500) {
                    message = 'Server error occurred. Please try again.';
                    shouldRetry = true;
                }
        }

        const enhancedError = new Error(message);
        (enhancedError as any).code = errorCode;
        (enhancedError as any).operation = operation;
        (enhancedError as any).shouldRetry = shouldRetry;
        (enhancedError as any).status = status;
        (enhancedError as any).originalError = error;

        return enhancedError;
    }

    /**
     * Sleep utility for retry delays
     */
    private static sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Legacy method aliases for backward compatibility
    static async getSwapCompletionStatus(swapId: string): Promise<CompletionStatus | null> {
        return this.getCompletionStatus(swapId);
    }
}