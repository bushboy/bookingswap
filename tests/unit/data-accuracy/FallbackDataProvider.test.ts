/**
 * Unit Tests for Fallback Data Provider
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Graceful error handling and fallback data
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FallbackDataProvider } from '../../../apps/backend/src/utils/fallbackDataProvider';
import { CompleteSwapData } from '../../../apps/backend/src/utils/swapDataValidator';

// Mock logger to avoid console output during tests
vi.mock('../../../apps/backend/src/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('FallbackDataProvider', () => {
    beforeEach(() => {
        // Reset configuration before each test
        FallbackDataProvider.resetConfig();
    });

    afterEach(() => {
        // Clean up after each test
        FallbackDataProvider.resetConfig();
    });

    describe('configuration', () => {
        it('should use default configuration initially', () => {
            const config = FallbackDataProvider.getConfig();

            expect(config.enableLogging).toBe(true);
            expect(config.defaultCurrency).toBe('EUR');
            expect(config.fallbackUserName).toBe('Unknown User');
            expect(config.fallbackSwapTitle).toBe('Swap data unavailable');
            expect(config.maxRetries).toBe(3);
        });

        it('should allow configuration updates', () => {
            const newConfig: Partial<FallbackConfig> = {
                enableLogging: false,
                defaultCurrency: 'USD',
                maxRetries: 5
            };

            FallbackDataProvider.configure(newConfig);
            const config = FallbackDataProvider.getConfig();

            expect(config.enableLogging).toBe(false);
            expect(config.defaultCurrency).toBe('USD');
            expect(config.maxRetries).toBe(5);
            // Should preserve other defaults
            expect(config.fallbackUserName).toBe('Unknown User');
        });

        it('should reset configuration to defaults', () => {
            FallbackDataProvider.configure({ enableLogging: false, maxRetries: 10 });
            FallbackDataProvider.resetConfig();

            const config = FallbackDataProvider.getConfig();
            expect(config.enableLogging).toBe(true);
            expect(config.maxRetries).toBe(3);
        });
    });

    describe('getEmptySwapData', () => {
        it('should generate valid empty swap data', () => {
            const swapId = 'test-swap-123';
            const result = FallbackDataProvider.getEmptySwapData(swapId);

            expect(result.id).toBe(swapId);
            expect(result.title).toBe('Swap data unavailable');
            expect(result.description).toBe('');
            expect(result.ownerId).toBe('');
            expect(result.ownerName).toBe('Unknown User');
            expect(result.status).toBe('unknown');
            expect(result.pricing.amount).toBe(null);
            expect(result.pricing.currency).toBe('EUR');
            expect(result.pricing.formatted).toBe('Price not available');
            expect(result.targeting.incomingProposals).toEqual([]);
            expect(result.targeting.outgoingTarget).toBe(null);
            expect(result.targeting.totalIncomingCount).toBe(0);
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);
        });

        it('should handle missing swap ID', () => {
            const result = FallbackDataProvider.getEmptySwapData('');
            expect(result.id).toBe('unknown');
        });

        it('should use custom configuration', () => {
            FallbackDataProvider.configure({
                defaultCurrency: 'USD',
                fallbackUserName: 'Anonymous',
                fallbackSwapTitle: 'Data not found'
            });

            const result = FallbackDataProvider.getEmptySwapData('test-swap');

            expect(result.title).toBe('Data not found');
            expect(result.ownerName).toBe('Anonymous');
            expect(result.pricing.currency).toBe('USD');
        });

        it('should include context information when provided', () => {
            const context: Partial<FallbackContext> = {
                originalError: new Error('Network timeout'),
                attemptedOperation: 'fetchSwapData',
                userId: 'user-123'
            };

            const result = FallbackDataProvider.getEmptySwapData('test-swap', context);

            // Should still generate valid data regardless of context
            expect(result.id).toBe('test-swap');
            expect(result.title).toBe('Swap data unavailable');
        });
    });

    describe('getEmptyPricing', () => {
        it('should generate valid empty pricing data', () => {
            const result = FallbackDataProvider.getEmptyPricing();

            expect(result.amount).toBe(null);
            expect(result.currency).toBe('EUR');
            expect(result.formatted).toBe('Price not available');
        });

        it('should use custom currency configuration', () => {
            FallbackDataProvider.configure({ defaultCurrency: 'GBP' });

            const result = FallbackDataProvider.getEmptyPricing();
            expect(result.currency).toBe('GBP');
        });
    });

    describe('getEmptyTargeting', () => {
        it('should generate valid empty targeting data', () => {
            const result = FallbackDataProvider.getEmptyTargeting();

            expect(result.incomingProposals).toEqual([]);
            expect(result.outgoingTarget).toBe(null);
            expect(result.totalIncomingCount).toBe(0);
        });
    });

    describe('getFallbackProposal', () => {
        it('should generate valid fallback proposal', () => {
            const proposalId = 'prop-123';
            const result = FallbackDataProvider.getFallbackProposal(proposalId);

            expect(result.id).toBe(proposalId);
            expect(result.proposerId).toBe('');
            expect(result.proposerName).toBe('Unknown User');
            expect(result.proposerSwapId).toBe('');
            expect(result.proposerSwapTitle).toBe('Proposal data unavailable');
            expect(result.proposerSwapDescription).toBe('');
            expect(result.proposedTerms.pricing.amount).toBe(null);
            expect(result.proposedTerms.pricing.formatted).toBe('Price not available');
            expect(result.status).toBe('pending');
            expect(result.createdAt).toBeInstanceOf(Date);
        });

        it('should handle missing proposal ID', () => {
            const result = FallbackDataProvider.getFallbackProposal('');
            expect(result.id).toBe('unknown');
        });
    });

    describe('getFallbackTarget', () => {
        it('should generate valid fallback target', () => {
            const targetId = 'target-123';
            const result = FallbackDataProvider.getFallbackTarget(targetId);

            expect(result.id).toBe(targetId);
            expect(result.targetSwapId).toBe('');
            expect(result.targetOwnerName).toBe('Unknown User');
            expect(result.targetSwapTitle).toBe('Target data unavailable');
            expect(result.status).toBe('pending');
            expect(result.createdAt).toBeInstanceOf(Date);
        });
    });

    describe('withFallback', () => {
        it('should return successful operation result', async () => {
            const successfulOperation = async () => 'success';
            const fallbackProvider = (error: Error) => 'fallback';

            const result = await FallbackDataProvider.withFallback(
                successfulOperation,
                fallbackProvider,
                { attemptedOperation: 'test' }
            );

            expect(result).toBe('success');
        });

        it('should use fallback when operation fails', async () => {
            const failingOperation = async () => {
                throw new Error('Operation failed');
            };
            const fallbackProvider = (error: Error) => `fallback: ${error.message}`;

            const result = await FallbackDataProvider.withFallback(
                failingOperation,
                fallbackProvider,
                { attemptedOperation: 'test' }
            );

            expect(result).toBe('fallback: Operation failed');
        });

        it('should retry failed operations', async () => {
            let attemptCount = 0;
            const retryingOperation = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error(`Attempt ${attemptCount} failed`);
                }
                return 'success after retries';
            };
            const fallbackProvider = (error: Error) => 'fallback';

            const result = await FallbackDataProvider.withFallback(
                retryingOperation,
                fallbackProvider,
                { attemptedOperation: 'test' }
            );

            expect(result).toBe('success after retries');
            expect(attemptCount).toBe(3);
        });

        it('should use fallback after max retries', async () => {
            FallbackDataProvider.configure({ maxRetries: 2 });

            let attemptCount = 0;
            const alwaysFailingOperation = async () => {
                attemptCount++;
                throw new Error(`Attempt ${attemptCount} failed`);
            };
            const fallbackProvider = (error: Error) => `fallback after ${attemptCount} attempts`;

            const result = await FallbackDataProvider.withFallback(
                alwaysFailingOperation,
                fallbackProvider,
                { attemptedOperation: 'test' }
            );

            expect(result).toBe('fallback after 2 attempts');
            expect(attemptCount).toBe(2);
        });

        it('should handle exponential backoff delays', async () => {
            const startTime = Date.now();
            let attemptCount = 0;

            const failingOperation = async () => {
                attemptCount++;
                throw new Error('Always fails');
            };
            const fallbackProvider = () => 'fallback';

            FallbackDataProvider.configure({ maxRetries: 3 });

            await FallbackDataProvider.withFallback(
                failingOperation,
                fallbackProvider,
                { attemptedOperation: 'test' }
            );

            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should have some delay due to exponential backoff
            // (100ms + 200ms + 400ms = 700ms minimum)
            expect(duration).toBeGreaterThan(600);
            expect(attemptCount).toBe(3);
        });
    });

    describe('safeGetSwapData', () => {
        it('should return data from successful provider', async () => {
            const swapData: CompleteSwapData = {
                id: 'swap-123',
                title: 'Real Swap',
                description: 'Real description',
                ownerId: 'user-456',
                ownerName: 'Real User',
                status: 'active',
                pricing: { amount: 100, currency: 'EUR', formatted: '€100.00' },
                targeting: { incomingProposals: [], outgoingTarget: null, totalIncomingCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const successfulProvider = async () => swapData;

            const result = await FallbackDataProvider.safeGetSwapData(
                'swap-123',
                successfulProvider
            );

            expect(result).toEqual(swapData);
        });

        it('should return fallback data when provider fails', async () => {
            const failingProvider = async () => {
                throw new Error('Data not found');
            };

            const result = await FallbackDataProvider.safeGetSwapData(
                'swap-123',
                failingProvider
            );

            expect(result.id).toBe('swap-123');
            expect(result.title).toBe('Swap data unavailable');
            expect(result.ownerName).toBe('Unknown User');
        });
    });

    describe('safeGetMultipleSwaps', () => {
        it('should return all swaps when provider succeeds', async () => {
            const swapIds = ['swap-1', 'swap-2', 'swap-3'];
            const swapData = swapIds.map(id => ({
                id,
                title: `Swap ${id}`,
                description: '',
                ownerId: 'user-1',
                ownerName: 'User',
                status: 'active',
                pricing: { amount: 100, currency: 'EUR', formatted: '€100.00' },
                targeting: { incomingProposals: [], outgoingTarget: null, totalIncomingCount: 0 },
                createdAt: new Date(),
                updatedAt: new Date()
            })) as CompleteSwapData[];

            const successfulProvider = async (ids: string[]) => swapData;

            const result = await FallbackDataProvider.safeGetMultipleSwaps(
                swapIds,
                successfulProvider
            );

            expect(result).toHaveLength(3);
            expect(result.map(s => s.id)).toEqual(swapIds);
        });

        it('should provide fallbacks for missing swaps', async () => {
            const requestedIds = ['swap-1', 'swap-2', 'swap-3'];
            const partialData = [
                {
                    id: 'swap-1',
                    title: 'Real Swap 1',
                    description: '',
                    ownerId: 'user-1',
                    ownerName: 'User',
                    status: 'active',
                    pricing: { amount: 100, currency: 'EUR', formatted: '€100.00' },
                    targeting: { incomingProposals: [], outgoingTarget: null, totalIncomingCount: 0 },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ] as CompleteSwapData[];

            const partialProvider = async (ids: string[]) => partialData;

            const result = await FallbackDataProvider.safeGetMultipleSwaps(
                requestedIds,
                partialProvider
            );

            expect(result).toHaveLength(3);
            expect(result[0].title).toBe('Real Swap 1'); // Real data
            expect(result[1].title).toBe('Swap data unavailable'); // Fallback
            expect(result[2].title).toBe('Swap data unavailable'); // Fallback
        });

        it('should provide all fallbacks when provider fails completely', async () => {
            const swapIds = ['swap-1', 'swap-2'];
            const failingProvider = async (ids: string[]) => {
                throw new Error('Complete failure');
            };

            const result = await FallbackDataProvider.safeGetMultipleSwaps(
                swapIds,
                failingProvider
            );

            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('Swap data unavailable');
            expect(result[1].title).toBe('Swap data unavailable');
            expect(result[0].id).toBe('swap-1');
            expect(result[1].id).toBe('swap-2');
        });
    });

    describe('repairSwapData', () => {
        it('should repair missing fields with fallbacks', () => {
            const partialData: Partial<CompleteSwapData> = {
                id: 'swap-123',
                title: 'Partial Swap',
                // Missing other fields
            };

            const result = FallbackDataProvider.repairSwapData(partialData, 'swap-123');

            expect(result.id).toBe('swap-123');
            expect(result.title).toBe('Partial Swap');
            expect(result.description).toBe('');
            expect(result.ownerName).toBe('Unknown User');
            expect(result.status).toBe('unknown');
            expect(result.pricing.formatted).toBe('Price not available');
            expect(result.targeting.incomingProposals).toEqual([]);
        });

        it('should preserve existing valid data', () => {
            const partialData: Partial<CompleteSwapData> = {
                id: 'swap-123',
                title: 'Valid Title',
                ownerName: 'Valid Owner',
                pricing: { amount: 50, currency: 'USD', formatted: '$50.00' }
            };

            const result = FallbackDataProvider.repairSwapData(partialData);

            expect(result.title).toBe('Valid Title');
            expect(result.ownerName).toBe('Valid Owner');
            expect(result.pricing.amount).toBe(50);
            expect(result.pricing.currency).toBe('USD');
            expect(result.pricing.formatted).toBe('$50.00');
        });
    });

    describe('getContextualFallback', () => {
        it('should provide network error context', () => {
            const networkError = new Error('Network timeout occurred');
            const result = FallbackDataProvider.getContextualFallback(networkError, 'swap-123');

            expect(result.title).toBe('Network error - data temporarily unavailable');
            expect(result.description).toBe('Please check your connection and try again');
        });

        it('should provide permission error context', () => {
            const permissionError = new Error('Unauthorized access');
            const result = FallbackDataProvider.getContextualFallback(permissionError, 'swap-123');

            expect(result.title).toBe('Access denied');
            expect(result.description).toBe('You may not have permission to view this swap');
        });

        it('should provide not found error context', () => {
            const notFoundError = new Error('Resource not found (404)');
            const result = FallbackDataProvider.getContextualFallback(notFoundError, 'swap-123');

            expect(result.title).toBe('Swap not found');
            expect(result.description).toBe('This swap may have been deleted or moved');
        });

        it('should provide database error context', () => {
            const dbError = new Error('Database connection failed');
            const result = FallbackDataProvider.getContextualFallback(dbError, 'swap-123');

            expect(result.title).toBe('Database error - data temporarily unavailable');
            expect(result.description).toBe('Please try again in a few moments');
        });

        it('should provide generic fallback for unknown errors', () => {
            const unknownError = new Error('Something unexpected happened');
            const result = FallbackDataProvider.getContextualFallback(unknownError, 'swap-123');

            expect(result.title).toBe('Swap data unavailable');
            expect(result.description).toBe('');
        });
    });

    describe('logging behavior', () => {
        it('should respect logging configuration', () => {
            FallbackDataProvider.configure({ enableLogging: false });

            // Should not throw even with logging disabled
            const result = FallbackDataProvider.getEmptySwapData('test-swap');
            expect(result.id).toBe('test-swap');
        });
    });

    describe('edge cases', () => {
        it('should handle very long swap IDs', () => {
            const longId = 'a'.repeat(1000);
            const result = FallbackDataProvider.getEmptySwapData(longId);
            expect(result.id).toBe(longId);
        });

        it('should handle special characters in IDs', () => {
            const specialId = 'swap-123!@#$%^&*()';
            const result = FallbackDataProvider.getEmptySwapData(specialId);
            expect(result.id).toBe(specialId);
        });

        it('should handle null and undefined contexts gracefully', () => {
            const result1 = FallbackDataProvider.getEmptySwapData('test', undefined);
            const result2 = FallbackDataProvider.getEmptySwapData('test', null as any);

            expect(result1.id).toBe('test');
            expect(result2.id).toBe('test');
        });
    });
});