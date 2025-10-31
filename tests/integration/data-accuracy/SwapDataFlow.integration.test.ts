/**
 * Integration Tests for Complete Swap Data Flow
 * Requirements: 2.1, 2.2, 5.1, 5.2, 6.1 - Complete data flow from database to UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SwapDataValidator, CompleteSwapData } from '../../../apps/backend/src/utils/swapDataValidator';
import { DataConsistencyValidator } from '../../../apps/backend/src/utils/dataConsistencyValidator';
import { FallbackDataProvider } from '../../../apps/backend/src/utils/fallbackDataProvider';
import { FinancialDataHandler } from '../../../apps/backend/src/utils/financialDataHandler';

// Mock logger to avoid console output during tests
vi.mock('../../../apps/backend/src/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('Swap Data Flow Integration Tests', () => {
    let mockDatabaseData: any;
    let mockSwapService: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();
        FallbackDataProvider.resetConfig();

        // Mock database response data
        mockDatabaseData = {
            id: 'swap-123',
            title: 'Test Swap',
            description: 'A test swap for integration testing',
            user_id: 'user-456',
            owner_name: 'John Doe',
            status: 'active',
            price_amount: 100.50,
            price_currency: 'EUR',
            created_at: '2024-01-01T10:00:00Z',
            updated_at: '2024-01-02T10:00:00Z',
            incoming_proposals: [
                {
                    id: 'prop-1',
                    source_user_id: 'user-789',
                    proposer_name: 'Alice Smith',
                    source_swap_id: 'swap-456',
                    proposer_swap_title: 'Alice Swap',
                    proposer_swap_description: 'Alice description',
                    price_amount: 75.00,
                    price_currency: 'EUR',
                    status: 'pending',
                    created_at: '2024-01-01T11:00:00Z'
                }
            ],
            outgoing_target: null
        };

        // Mock swap service
        mockSwapService = {
            getUserSwapsWithTargeting: vi.fn(),
            getSwapById: vi.fn(),
            updateSwapData: vi.fn()
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('complete data flow from database to validated output', () => {
        it('should process valid database data through complete pipeline', async () => {
            // Simulate successful database retrieval
            mockSwapService.getUserSwapsWithTargeting.mockResolvedValue([mockDatabaseData]);

            // Process through validation pipeline
            const validationResult = SwapDataValidator.validateAndSanitize(mockDatabaseData);

            expect(validationResult.isValid).toBe(true);
            expect(validationResult.sanitizedData).toBeDefined();

            const swapData = validationResult.sanitizedData!;

            // Verify basic data transformation
            expect(swapData.id).toBe('swap-123');
            expect(swapData.title).toBe('Test Swap');
            expect(swapData.ownerId).toBe('user-456');
            expect(swapData.ownerName).toBe('John Doe');

            // Verify financial data processing
            expect(swapData.pricing.amount).toBe(100.50);
            expect(swapData.pricing.currency).toBe('EUR');
            expect(swapData.pricing.formatted).toBe('€100.50');

            // Verify targeting data processing
            expect(swapData.targeting.incomingProposals).toHaveLength(1);
            expect(swapData.targeting.totalIncomingCount).toBe(1);

            const proposal = swapData.targeting.incomingProposals[0];
            expect(proposal.proposerName).toBe('Alice Smith');
            expect(proposal.proposedTerms.pricing.formatted).toBe('€75.00');

            // Verify consistency validation
            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(swapData);
            expect(consistencyReport.isConsistent).toBe(true);
            expect(consistencyReport.issues).toHaveLength(0);
        });

        it('should handle corrupted database data gracefully', async () => {
            const corruptedData = {
                id: 'swap-123',
                title: null, // Corrupted
                user_id: 'user-456',
                owner_name: null, // Corrupted
                price_amount: 'invalid', // Corrupted
                price_currency: 'EUR',
                incoming_proposals: [
                    {
                        id: 'prop-1',
                        source_user_id: null, // Corrupted
                        proposer_name: null, // Corrupted
                        price_amount: NaN // Corrupted
                    }
                ]
            };

            mockSwapService.getUserSwapsWithTargeting.mockResolvedValue([corruptedData]);

            // Process through validation pipeline
            const validationResult = SwapDataValidator.validateAndSanitize(corruptedData);

            expect(validationResult.isValid).toBe(true); // Should still be valid with fallbacks
            expect(validationResult.warnings.length).toBeGreaterThan(0);

            const swapData = validationResult.sanitizedData!;

            // Verify fallback values are applied
            expect(swapData.title).toBe('Untitled Swap');
            expect(swapData.ownerName).toBe('Unknown User');
            expect(swapData.pricing.formatted).toBe('Invalid price');

            // Verify proposal fallbacks
            expect(swapData.targeting.incomingProposals).toHaveLength(1);
            const proposal = swapData.targeting.incomingProposals[0];
            expect(proposal.proposerName).toBe('Unknown User');
            expect(proposal.proposedTerms.pricing.formatted).toBe('Invalid price');
        });

        it('should handle complete database failure with fallbacks', async () => {
            const swapId = 'swap-123';
            const networkError = new Error('Database connection failed');

            // Simulate database failure
            mockSwapService.getUserSwapsWithTargeting.mockRejectedValue(networkError);

            // Use fallback provider to handle failure
            const fallbackData = await FallbackDataProvider.safeGetSwapData(
                swapId,
                () => mockSwapService.getUserSwapsWithTargeting(),
                { attemptedOperation: 'getUserSwapsWithTargeting' }
            );

            expect(fallbackData.id).toBe(swapId);
            expect(fallbackData.title).toBe('Swap data unavailable');
            expect(fallbackData.ownerName).toBe('Unknown User');
            expect(fallbackData.pricing.formatted).toBe('Price not available');
            expect(fallbackData.targeting.incomingProposals).toEqual([]);
            expect(fallbackData.targeting.totalIncomingCount).toBe(0);

            // Verify consistency even with fallback data
            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(fallbackData);
            expect(consistencyReport.isConsistent).toBe(true);
        });
    });

    describe('financial data accuracy throughout pipeline', () => {
        it('should prevent $NaN displays in all scenarios', () => {
            const testCases = [
                { amount: null, expected: 'Price not set' },
                { amount: undefined, expected: 'Price not set' },
                { amount: '', expected: 'Price not set' },
                { amount: 'invalid', expected: 'Invalid price' },
                { amount: NaN, expected: 'Invalid price' },
                { amount: Infinity, expected: 'Invalid price' },
                { amount: 50.75, expected: '€50.75' },
                { amount: '100.00', expected: '€100.00' },
                { amount: 0, expected: '€0.00' }
            ];

            testCases.forEach(({ amount, expected }) => {
                const testData = {
                    ...mockDatabaseData,
                    price_amount: amount
                };

                const validationResult = SwapDataValidator.validateAndSanitize(testData);
                expect(validationResult.isValid).toBe(true);

                const formatted = validationResult.sanitizedData!.pricing.formatted;
                expect(formatted).toBe(expected);
                expect(formatted).not.toContain('NaN');
                expect(formatted).not.toContain('undefined');
            });
        });

        it('should handle currency formatting consistently', () => {
            const currencies = [
                { code: 'EUR', symbol: '€', amount: 100, expected: '€100.00' },
                { code: 'USD', symbol: '$', amount: 100, expected: '$100.00' },
                { code: 'GBP', symbol: '£', amount: 100, expected: '£100.00' }
            ];

            currencies.forEach(({ code, amount, expected }) => {
                const testData = {
                    ...mockDatabaseData,
                    price_amount: amount,
                    price_currency: code
                };

                const validationResult = SwapDataValidator.validateAndSanitize(testData);
                const formatted = validationResult.sanitizedData!.pricing.formatted;
                expect(formatted).toBe(expected);
            });
        });

        it('should validate financial calculations safely', () => {
            // Test safe arithmetic operations
            expect(FinancialDataHandler.safeAdd(10, 20)).toBe(30);
            expect(FinancialDataHandler.safeAdd(null, 20)).toBe(null);
            expect(FinancialDataHandler.safeAdd('invalid', 20)).toBe(null);

            expect(FinancialDataHandler.safeSubtract(30, 10)).toBe(20);
            expect(FinancialDataHandler.safeSubtract(null, 10)).toBe(null);

            expect(FinancialDataHandler.safeMultiply(10, 2)).toBe(20);
            expect(FinancialDataHandler.safeMultiply(null, 2)).toBe(null);

            // Test validation before calculations
            expect(FinancialDataHandler.isValidForCalculation(50)).toBe(true);
            expect(FinancialDataHandler.isValidForCalculation(null)).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation('invalid')).toBe(false);
            expect(FinancialDataHandler.isValidForCalculation(-5)).toBe(false);
        });
    });

    describe('targeting data consistency throughout pipeline', () => {
        it('should maintain proposal count consistency', () => {
            const testData = {
                ...mockDatabaseData,
                incoming_proposals: [
                    { id: 'prop-1', source_user_id: 'user-1', proposer_name: 'User 1' },
                    { id: 'prop-2', source_user_id: 'user-2', proposer_name: 'User 2' },
                    { id: 'prop-3', source_user_id: 'user-3', proposer_name: 'User 3' }
                ]
            };

            const validationResult = SwapDataValidator.validateAndSanitize(testData);
            expect(validationResult.isValid).toBe(true);

            const swapData = validationResult.sanitizedData!;
            expect(swapData.targeting.incomingProposals).toHaveLength(3);
            expect(swapData.targeting.totalIncomingCount).toBe(3);

            // Verify consistency validation
            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(swapData);
            expect(consistencyReport.isConsistent).toBe(true);
        });

        it('should detect and handle proposal count mismatches', () => {
            // Create data with inconsistent count (simulating corrupted data)
            const validationResult = SwapDataValidator.validateAndSanitize(mockDatabaseData);
            const swapData = validationResult.sanitizedData!;

            // Manually corrupt the count to test consistency validation
            swapData.targeting.totalIncomingCount = 5; // Wrong count

            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(swapData);
            expect(consistencyReport.isConsistent).toBe(false);
            expect(consistencyReport.issues.some(issue =>
                issue.category === 'count_mismatch' &&
                issue.description.includes('Proposal count mismatch')
            )).toBe(true);
        });

        it('should filter out invalid proposals during processing', () => {
            const testData = {
                ...mockDatabaseData,
                incoming_proposals: [
                    { id: 'prop-1', source_user_id: 'user-1', proposer_name: 'Valid User' }, // Valid
                    { source_user_id: 'user-2' }, // Missing ID - invalid
                    null, // Null proposal - invalid
                    { id: 'prop-3', source_user_id: 'user-3', proposer_name: 'Another Valid User' } // Valid
                ]
            };

            const validationResult = SwapDataValidator.validateAndSanitize(testData);
            expect(validationResult.isValid).toBe(true);

            const swapData = validationResult.sanitizedData!;
            expect(swapData.targeting.incomingProposals).toHaveLength(2); // Only valid proposals
            expect(swapData.targeting.totalIncomingCount).toBe(2);

            // All remaining proposals should be valid
            swapData.targeting.incomingProposals.forEach(proposal => {
                expect(proposal.id).toBeDefined();
                expect(proposal.proposerId).toBeDefined();
            });
        });
    });

    describe('cross-swap data consistency', () => {
        it('should validate consistency across multiple swaps', () => {
            const swapArray = [
                mockDatabaseData,
                {
                    ...mockDatabaseData,
                    id: 'swap-456',
                    user_id: 'user-789',
                    owner_name: 'Alice Smith'
                },
                {
                    ...mockDatabaseData,
                    id: 'swap-789',
                    user_id: 'user-101',
                    owner_name: 'Bob Johnson'
                }
            ];

            // Validate each swap individually
            const validatedSwaps = swapArray.map(rawData => {
                const result = SwapDataValidator.validateAndSanitize(rawData);
                expect(result.isValid).toBe(true);
                return result.sanitizedData!;
            });

            // Validate cross-swap consistency
            const crossSwapReport = DataConsistencyValidator.validateCrossSwapConsistency(validatedSwaps);

            expect(crossSwapReport.totalSwapsChecked).toBe(3);
            expect(crossSwapReport.consistentSwaps).toBe(3);
            expect(crossSwapReport.inconsistentSwaps).toBe(0);
            expect(crossSwapReport.globalIssues).toHaveLength(0);
        });

        it('should detect inconsistent user names across swaps', () => {
            const swapArray = [
                { ...mockDatabaseData, user_id: 'user-456', owner_name: 'John Doe' },
                { ...mockDatabaseData, id: 'swap-456', user_id: 'user-456', owner_name: 'Johnny Doe' } // Different name
            ];

            const validatedSwaps = swapArray.map(rawData => {
                const result = SwapDataValidator.validateAndSanitize(rawData);
                return result.sanitizedData!;
            });

            const crossSwapReport = DataConsistencyValidator.validateCrossSwapConsistency(validatedSwaps);

            expect(crossSwapReport.globalIssues.some(issue =>
                issue.category === 'data_mismatch' &&
                issue.description.includes('Inconsistent user name')
            )).toBe(true);
        });
    });

    describe('error recovery and retry mechanisms', () => {
        it('should retry failed operations before using fallbacks', async () => {
            let attemptCount = 0;
            const retryingOperation = async () => {
                attemptCount++;
                if (attemptCount < 3) {
                    throw new Error(`Attempt ${attemptCount} failed`);
                }
                return mockDatabaseData;
            };

            const result = await FallbackDataProvider.withFallback(
                retryingOperation,
                (error) => FallbackDataProvider.getEmptySwapData('swap-123', { originalError: error }),
                { attemptedOperation: 'retryTest' }
            );

            expect(attemptCount).toBe(3);
            expect(result).toEqual(mockDatabaseData);
        });

        it('should use fallback after max retries exceeded', async () => {
            FallbackDataProvider.configure({ maxRetries: 2 });

            let attemptCount = 0;
            const alwaysFailingOperation = async () => {
                attemptCount++;
                throw new Error(`Attempt ${attemptCount} failed`);
            };

            const result = await FallbackDataProvider.withFallback(
                alwaysFailingOperation,
                (error) => FallbackDataProvider.getEmptySwapData('swap-123', { originalError: error }),
                { attemptedOperation: 'maxRetryTest' }
            );

            expect(attemptCount).toBe(2);
            expect(result.id).toBe('swap-123');
            expect(result.title).toBe('Swap data unavailable');
        });

        it('should handle partial batch failures gracefully', async () => {
            const requestedIds = ['swap-1', 'swap-2', 'swap-3'];
            const partialData = [
                { ...mockDatabaseData, id: 'swap-1' }
                // Missing swap-2 and swap-3
            ];

            const partialProvider = async () => partialData as CompleteSwapData[];

            const result = await FallbackDataProvider.safeGetMultipleSwaps(
                requestedIds,
                partialProvider
            );

            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('swap-1');
            expect(result[0].title).toBe('Test Swap'); // Real data
            expect(result[1].id).toBe('swap-2');
            expect(result[1].title).toBe('Swap data unavailable'); // Fallback
            expect(result[2].id).toBe('swap-3');
            expect(result[2].title).toBe('Swap data unavailable'); // Fallback
        });
    });

    describe('performance with large datasets', () => {
        it('should handle large numbers of proposals efficiently', () => {
            const largeProposalSet = Array.from({ length: 100 }, (_, i) => ({
                id: `prop-${i}`,
                source_user_id: `user-${i}`,
                proposer_name: `User ${i}`,
                source_swap_id: `swap-${i}`,
                proposer_swap_title: `Swap ${i}`,
                price_amount: 50 + i,
                price_currency: 'EUR',
                status: 'pending',
                created_at: new Date().toISOString()
            }));

            const testData = {
                ...mockDatabaseData,
                incoming_proposals: largeProposalSet
            };

            const startTime = Date.now();
            const validationResult = SwapDataValidator.validateAndSanitize(testData);
            const validationTime = Date.now() - startTime;

            expect(validationResult.isValid).toBe(true);
            expect(validationResult.sanitizedData!.targeting.incomingProposals).toHaveLength(100);
            expect(validationTime).toBeLessThan(1000); // Should complete within 1 second

            // Test consistency validation performance
            const consistencyStartTime = Date.now();
            const consistencyReport = DataConsistencyValidator.validateSwapConsistency(validationResult.sanitizedData!);
            const consistencyTime = Date.now() - consistencyStartTime;

            expect(consistencyReport.isConsistent).toBe(true);
            expect(consistencyTime).toBeLessThan(500); // Should complete within 0.5 seconds
        });

        it('should handle batch validation efficiently', () => {
            const batchSize = 50;
            const swapBatch = Array.from({ length: batchSize }, (_, i) => ({
                ...mockDatabaseData,
                id: `swap-${i}`,
                user_id: `user-${i}`,
                owner_name: `User ${i}`
            }));

            const startTime = Date.now();
            const batchResult = SwapDataValidator.validateBatch(swapBatch);
            const batchTime = Date.now() - startTime;

            expect(batchResult.summary.total).toBe(batchSize);
            expect(batchResult.summary.valid).toBe(batchSize);
            expect(batchResult.summary.invalid).toBe(0);
            expect(batchTime).toBeLessThan(2000); // Should complete within 2 seconds

            // Test cross-swap consistency validation performance
            const crossSwapStartTime = Date.now();
            const crossSwapReport = DataConsistencyValidator.validateCrossSwapConsistency(batchResult.validSwaps);
            const crossSwapTime = Date.now() - crossSwapStartTime;

            expect(crossSwapReport.totalSwapsChecked).toBe(batchSize);
            expect(crossSwapTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });

    describe('edge cases and boundary conditions', () => {
        it('should handle empty and null data gracefully', () => {
            const edgeCases = [
                null,
                undefined,
                {},
                { id: '' },
                { id: 'swap-123' }, // Minimal data
            ];

            edgeCases.forEach((testCase) => {
                const validationResult = SwapDataValidator.validateAndSanitize(testCase);

                if (testCase === null || testCase === undefined) {
                    expect(validationResult.isValid).toBe(false);
                    expect(validationResult.sanitizedData).toBe(null);
                } else {
                    // Should provide fallbacks for missing data
                    expect(validationResult.sanitizedData).toBeDefined();
                    expect(validationResult.sanitizedData!.pricing.formatted).not.toContain('NaN');
                }
            });
        });

        it('should handle very large monetary values', () => {
            const largeAmount = 999999999.99;
            const testData = {
                ...mockDatabaseData,
                price_amount: largeAmount
            };

            const validationResult = SwapDataValidator.validateAndSanitize(testData);
            expect(validationResult.isValid).toBe(true);

            const pricing = validationResult.sanitizedData!.pricing;
            expect(pricing.amount).toBe(largeAmount);
            expect(pricing.formatted).toBe('€999999999.99');
            expect(pricing.formatted).not.toContain('NaN');
        });

        it('should handle special characters in text fields', () => {
            const testData = {
                ...mockDatabaseData,
                title: 'Swap with émojis 🚀 and spëcial chars!',
                description: 'Description with\nnewlines\tand\ttabs',
                owner_name: 'Üser Nämé with àccents'
            };

            const validationResult = SwapDataValidator.validateAndSanitize(testData);
            expect(validationResult.isValid).toBe(true);

            const swapData = validationResult.sanitizedData!;
            expect(swapData.title).toBe('Swap with émojis 🚀 and spëcial chars!');
            expect(swapData.description).toBe('Description with\nnewlines\tand\ttabs');
            expect(swapData.ownerName).toBe('Üser Nämé with àccents');
        });

        it('should handle different date formats consistently', () => {
            const dateFormats = [
                '2024-01-01T10:00:00Z',
                '2024-01-01T10:00:00.000Z',
                '2024-01-01 10:00:00',
                new Date('2024-01-01T10:00:00Z'),
                1704110400000 // Timestamp
            ];

            dateFormats.forEach(dateFormat => {
                const testData = {
                    ...mockDatabaseData,
                    created_at: dateFormat,
                    updated_at: dateFormat
                };

                const validationResult = SwapDataValidator.validateAndSanitize(testData);
                expect(validationResult.isValid).toBe(true);

                const swapData = validationResult.sanitizedData!;
                expect(swapData.createdAt).toBeInstanceOf(Date);
                expect(swapData.updatedAt).toBeInstanceOf(Date);
                expect(isNaN(swapData.createdAt.getTime())).toBe(false);
                expect(isNaN(swapData.updatedAt.getTime())).toBe(false);
            });
        });
    });
});