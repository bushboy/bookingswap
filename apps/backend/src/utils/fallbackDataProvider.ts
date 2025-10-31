/**
 * Fallback Data Provider for Swap Card Display Accuracy
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Graceful error handling and fallback data
 */

import { CompleteSwapData, ProposalDetail, TargetDetail, ValidatedTargeting } from './swapDataValidator';
import { ValidatedPricing } from './financialDataHandler';
import { logger } from './logger';

export interface FallbackConfig {
    enableLogging: boolean;
    defaultCurrency: string;
    fallbackUserName: string;
    fallbackSwapTitle: string;
    maxRetries: number;
}

export interface FallbackContext {
    originalError?: Error;
    attemptedOperation: string;
    swapId?: string;
    userId?: string;
    timestamp: Date;
}

export class FallbackDataProvider {
    private static readonly DEFAULT_CONFIG: FallbackConfig = {
        enableLogging: true,
        defaultCurrency: 'EUR',
        fallbackUserName: 'Unknown User',
        fallbackSwapTitle: 'Swap data unavailable',
        maxRetries: 3
    };

    private static config: FallbackConfig = { ...this.DEFAULT_CONFIG };

    /**
     * Configure fallback behavior
     */
    static configure(newConfig: Partial<FallbackConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get empty swap data with safe fallbacks
     * Requirements: 4.1, 4.2 - Provide fallback when data is unavailable
     */
    static getEmptySwapData(swapId: string, context?: Partial<FallbackContext>): CompleteSwapData {
        const fallbackContext: FallbackContext = {
            attemptedOperation: 'getSwapData',
            swapId,
            timestamp: new Date(),
            ...context
        };

        if (this.config.enableLogging) {
            logger.warn('Providing fallback swap data', {
                swapId,
                context: fallbackContext,
                reason: context?.originalError?.message || 'Data unavailable'
            });
        }

        return {
            id: swapId || 'unknown',
            title: this.config.fallbackSwapTitle,
            description: '',
            ownerId: '',
            ownerName: this.config.fallbackUserName,
            status: 'unknown',
            pricing: this.getEmptyPricing(),
            targeting: this.getEmptyTargeting(),
            location: undefined,
            dateRange: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: undefined
        };
    }

    /**
     * Get empty pricing data with safe fallbacks
     * Requirements: 4.1, 4.2, 4.3 - Handle pricing data gracefully
     */
    static getEmptyPricing(context?: Partial<FallbackContext>): ValidatedPricing {
        if (this.config.enableLogging && context) {
            logger.debug('Providing fallback pricing data', { context });
        }

        return {
            amount: null,
            currency: this.config.defaultCurrency,
            formatted: 'Price not available'
        };
    }

    /**
     * Get empty targeting data with safe fallbacks
     * Requirements: 6.4 - Provide consistent empty targeting data
     */
    static getEmptyTargeting(context?: Partial<FallbackContext>): ValidatedTargeting {
        if (this.config.enableLogging && context) {
            logger.debug('Providing fallback targeting data', { context });
        }

        return {
            incomingProposals: [],
            outgoingTarget: null,
            totalIncomingCount: 0
        };
    }

    /**
     * Get fallback proposal data
     * Requirements: 5.1, 5.2 - Provide fallback proposal information
     */
    static getFallbackProposal(proposalId: string, context?: Partial<FallbackContext>): ProposalDetail {
        const fallbackContext: FallbackContext = {
            attemptedOperation: 'getProposalData',
            timestamp: new Date(),
            ...context
        };

        if (this.config.enableLogging) {
            logger.warn('Providing fallback proposal data', { proposalId, context: fallbackContext });
        }

        return {
            id: proposalId || 'unknown',
            proposerId: '',
            proposerName: this.config.fallbackUserName,
            proposerSwapId: '',
            proposerSwapTitle: 'Proposal data unavailable',
            proposerSwapDescription: '',
            proposedTerms: {
                pricing: this.getEmptyPricing(fallbackContext),
                message: undefined
            },
            status: 'pending',
            createdAt: new Date()
        };
    }

    /**
     * Get fallback target data
     */
    static getFallbackTarget(targetId: string, context?: Partial<FallbackContext>): TargetDetail {
        const fallbackContext: FallbackContext = {
            attemptedOperation: 'getTargetData',
            timestamp: new Date(),
            ...context
        };

        if (this.config.enableLogging) {
            logger.warn('Providing fallback target data', { targetId, context: fallbackContext });
        }

        return {
            id: targetId || 'unknown',
            targetSwapId: '',
            targetOwnerName: this.config.fallbackUserName,
            targetSwapTitle: 'Target data unavailable',
            status: 'pending',
            createdAt: new Date()
        };
    }

    /**
     * Safely execute operation with fallback
     * Requirements: 6.4 - Graceful error handling
     */
    static async withFallback<T>(
        operation: () => Promise<T>,
        fallbackProvider: (error: Error) => T,
        context: Partial<FallbackContext>
    ): Promise<T> {
        const fullContext: FallbackContext = {
            attemptedOperation: 'unknown',
            timestamp: new Date(),
            ...context
        };

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                const result = await operation();

                if (attempt > 1 && this.config.enableLogging) {
                    logger.info('Operation succeeded after retry', {
                        attempt,
                        context: fullContext
                    });
                }

                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                if (this.config.enableLogging) {
                    logger.warn(`Operation failed, attempt ${attempt}/${this.config.maxRetries}`, {
                        error: lastError.message,
                        context: fullContext,
                        willRetry: attempt < this.config.maxRetries
                    });
                }

                if (attempt === this.config.maxRetries) {
                    break;
                }

                // Wait before retry (exponential backoff)
                await this.delay(Math.pow(2, attempt - 1) * 100);
            }
        }

        // All retries failed, use fallback
        if (this.config.enableLogging) {
            logger.error('All retry attempts failed, using fallback', {
                error: lastError?.message,
                context: fullContext,
                totalAttempts: this.config.maxRetries
            });
        }

        return fallbackProvider(lastError!);
    }

    /**
     * Safely get swap data with automatic fallback
     * Requirements: 4.1, 4.2, 6.4 - Comprehensive fallback for swap data
     */
    static async safeGetSwapData(
        swapId: string,
        dataProvider: () => Promise<CompleteSwapData>,
        context?: Partial<FallbackContext>
    ): Promise<CompleteSwapData> {
        return this.withFallback(
            dataProvider,
            (error) => this.getEmptySwapData(swapId, { ...context, originalError: error }),
            { attemptedOperation: 'getSwapData', swapId, ...context }
        );
    }

    /**
     * Safely get multiple swaps with partial fallbacks
     * Requirements: 6.4 - Batch operation with fallbacks
     */
    static async safeGetMultipleSwaps(
        swapIds: string[],
        dataProvider: (ids: string[]) => Promise<CompleteSwapData[]>,
        context?: Partial<FallbackContext>
    ): Promise<CompleteSwapData[]> {
        try {
            const swaps = await dataProvider(swapIds);

            // Check if we got all requested swaps
            const receivedIds = new Set(swaps.map(s => s.id));
            const missingIds = swapIds.filter(id => !receivedIds.has(id));

            if (missingIds.length > 0) {
                if (this.config.enableLogging) {
                    logger.warn('Some swaps missing from batch result, providing fallbacks', {
                        requestedCount: swapIds.length,
                        receivedCount: swaps.length,
                        missingIds,
                        context
                    });
                }

                // Add fallback data for missing swaps
                const fallbackSwaps = missingIds.map(id =>
                    this.getEmptySwapData(id, {
                        ...context,
                        originalError: new Error(`Swap ${id} not found in batch result`)
                    })
                );

                return [...swaps, ...fallbackSwaps];
            }

            return swaps;
        } catch (error) {
            if (this.config.enableLogging) {
                logger.error('Batch swap retrieval failed completely, providing all fallbacks', {
                    error: error instanceof Error ? error.message : String(error),
                    swapIds,
                    context
                });
            }

            // Provide fallback for all requested swaps
            return swapIds.map(id =>
                this.getEmptySwapData(id, {
                    ...context,
                    originalError: error instanceof Error ? error : new Error(String(error))
                })
            );
        }
    }

    /**
     * Repair partial swap data with fallbacks
     * Requirements: 6.4 - Data repair and consistency
     */
    static repairSwapData(partialSwapData: Partial<CompleteSwapData>, swapId?: string): CompleteSwapData {
        const fallbackData = this.getEmptySwapData(swapId || 'unknown', {
            attemptedOperation: 'repairSwapData'
        });

        const repairedData: CompleteSwapData = {
            id: partialSwapData.id || fallbackData.id,
            title: partialSwapData.title || fallbackData.title,
            description: partialSwapData.description ?? fallbackData.description,
            ownerId: partialSwapData.ownerId || fallbackData.ownerId,
            ownerName: partialSwapData.ownerName || fallbackData.ownerName,
            status: partialSwapData.status || fallbackData.status,
            pricing: partialSwapData.pricing || fallbackData.pricing,
            targeting: partialSwapData.targeting || fallbackData.targeting,
            location: partialSwapData.location || fallbackData.location,
            dateRange: partialSwapData.dateRange || fallbackData.dateRange,
            createdAt: partialSwapData.createdAt || fallbackData.createdAt,
            updatedAt: partialSwapData.updatedAt || fallbackData.updatedAt,
            expiresAt: partialSwapData.expiresAt || fallbackData.expiresAt
        };

        if (this.config.enableLogging) {
            const repairedFields = Object.keys(partialSwapData).filter(
                key => partialSwapData[key as keyof CompleteSwapData] === undefined ||
                    partialSwapData[key as keyof CompleteSwapData] === null
            );

            if (repairedFields.length > 0) {
                logger.info('Repaired swap data with fallbacks', {
                    swapId: repairedData.id,
                    repairedFields
                });
            }
        }

        return repairedData;
    }

    /**
     * Get fallback data for specific error types
     * Requirements: 4.1, 4.2, 4.3 - Context-aware fallbacks
     */
    static getContextualFallback(error: Error, swapId?: string): CompleteSwapData {
        let fallbackTitle = this.config.fallbackSwapTitle;
        let fallbackDescription = '';

        // Customize fallback based on error type
        if (error.message.includes('network') || error.message.includes('timeout')) {
            fallbackTitle = 'Network error - data temporarily unavailable';
            fallbackDescription = 'Please check your connection and try again';
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            fallbackTitle = 'Access denied';
            fallbackDescription = 'You may not have permission to view this swap';
        } else if (error.message.includes('not found') || error.message.includes('404')) {
            fallbackTitle = 'Swap not found';
            fallbackDescription = 'This swap may have been deleted or moved';
        } else if (error.message.includes('database') || error.message.includes('sql')) {
            fallbackTitle = 'Database error - data temporarily unavailable';
            fallbackDescription = 'Please try again in a few moments';
        }

        const fallbackData = this.getEmptySwapData(swapId || 'unknown', {
            originalError: error,
            attemptedOperation: 'getContextualFallback'
        });

        return {
            ...fallbackData,
            title: fallbackTitle,
            description: fallbackDescription
        };
    }

    /**
     * Utility method for delays
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Reset configuration to defaults
     */
    static resetConfig(): void {
        this.config = { ...this.DEFAULT_CONFIG };
    }

    /**
     * Get current configuration
     */
    static getConfig(): FallbackConfig {
        return { ...this.config };
    }
}