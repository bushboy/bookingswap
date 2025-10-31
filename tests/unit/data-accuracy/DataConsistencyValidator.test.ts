/**
 * Unit Tests for Data Consistency Validator
 * Requirements: 6.1, 6.2, 6.3, 6.4 - Check for data integrity issues
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataConsistencyValidator } from '../../../apps/backend/src/utils/dataConsistencyValidator';
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

describe('DataConsistencyValidator', () => {
    let validSwapData: CompleteSwapData;

    beforeEach(() => {
        validSwapData = {
            id: 'swap-123',
            title: 'Test Swap',
            description: 'A test swap description',
            ownerId: 'user-456',
            ownerName: 'John Doe',
            status: 'active',
            pricing: {
                amount: 100,
                currency: 'EUR',
                formatted: '€100.00'
            },
            targeting: {
                incomingProposals: [],
                outgoingTarget: null,
                totalIncomingCount: 0
            },
            createdAt: new Date('2024-01-01T10:00:00Z'),
            updatedAt: new Date('2024-01-02T10:00:00Z')
        };
    });

    describe('validateSwapConsistency', () => {
        it('should validate consistent swap data', () => {
            const result = DataConsistencyValidator.validateSwapConsistency(validSwapData);

            expect(result.isConsistent).toBe(true);
            expect(result.swapId).toBe('swap-123');
            expect(result.issues).toHaveLength(0);
            expect(result.summary.errorCount).toBe(0);
            expect(result.summary.warningCount).toBe(0);
            expect(result.summary.highSeverityCount).toBe(0);
        });

        it('should detect missing required fields', () => {
            const inconsistentData = {
                ...validSwapData,
                id: '',
                ownerId: ''
            };

            const result = DataConsistencyValidator.validateSwapConsistency(inconsistentData);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'missing_data' &&
                issue.description.includes('Swap ID is missing')
            )).toBe(true);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'missing_data' &&
                issue.description.includes('Owner ID is missing')
            )).toBe(true);
        });

        it('should detect fallback values', () => {
            const dataWithFallbacks = {
                ...validSwapData,
                title: 'Untitled Swap',
                ownerName: 'Unknown User'
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithFallbacks);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.description.includes('title is missing or using fallback')
            )).toBe(true);
            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.description.includes('Owner name is missing or using fallback')
            )).toBe(true);
        });

        it('should detect invalid status values', () => {
            const dataWithInvalidStatus = {
                ...validSwapData,
                status: 'invalid_status'
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithInvalidStatus);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'invalid_reference' &&
                issue.description.includes('Invalid swap status')
            )).toBe(true);
        });
    });

    describe('targeting consistency validation', () => {
        it('should detect proposal count mismatches', () => {
            const dataWithMismatch = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 3 // Mismatch: should be 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithMismatch);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'count_mismatch' &&
                issue.description.includes('Proposal count mismatch')
            )).toBe(true);
        });

        it('should detect duplicate proposals', () => {
            const dataWithDuplicates = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        },
                        {
                            id: 'prop-1', // Duplicate ID
                            proposerId: 'user-2',
                            proposerName: 'Bob',
                            proposerSwapId: 'swap-789',
                            proposerSwapTitle: 'Bob Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 75, currency: 'EUR', formatted: '€75.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 2
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithDuplicates);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'data_mismatch' &&
                issue.description.includes('Duplicate proposals detected')
            )).toBe(true);
        });

        it('should detect missing proposal data', () => {
            const dataWithMissingProposalData = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: '', // Missing
                            proposerName: 'Unknown User', // Fallback value
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithMissingProposalData);

            expect(result.issues.some(issue =>
                issue.description.includes('missing or invalid proposer ID')
            )).toBe(true);
            expect(result.issues.some(issue =>
                issue.description.includes('missing proposer name')
            )).toBe(true);
        });

        it('should validate outgoing target data', () => {
            const dataWithInvalidTarget = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [],
                    outgoingTarget: {
                        id: 'target-1',
                        targetSwapId: '', // Missing
                        targetOwnerName: 'Unknown User', // Fallback
                        targetSwapTitle: 'Target Swap',
                        status: 'pending' as const,
                        createdAt: new Date()
                    },
                    totalIncomingCount: 0
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithInvalidTarget);

            expect(result.issues.some(issue =>
                issue.description.includes('missing target swap ID')
            )).toBe(true);
            expect(result.issues.some(issue =>
                issue.description.includes('missing target owner name')
            )).toBe(true);
        });
    });

    describe('financial consistency validation', () => {
        it('should detect pricing inconsistencies', () => {
            const dataWithPricingIssues = {
                ...validSwapData,
                pricing: {
                    amount: null,
                    currency: 'EUR',
                    formatted: '€50.00' // Inconsistent with null amount
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithPricingIssues);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'data_mismatch' &&
                issue.description.includes('Null amount but formatted price is not "Price not set"')
            )).toBe(true);
        });

        it('should detect NaN in formatted prices', () => {
            const dataWithNaN = {
                ...validSwapData,
                pricing: {
                    amount: 100,
                    currency: 'EUR',
                    formatted: '€NaN'
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithNaN);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'data_mismatch' &&
                issue.description.includes('Invalid formatted price contains NaN')
            )).toBe(true);
        });

        it('should detect missing currency', () => {
            const dataWithMissingCurrency = {
                ...validSwapData,
                pricing: {
                    amount: 100,
                    currency: '',
                    formatted: '100.00'
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithMissingCurrency);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'missing_data' &&
                issue.description.includes('Currency is missing')
            )).toBe(true);
        });

        it('should validate proposal pricing consistency', () => {
            const dataWithInvalidProposalPricing = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: {
                                    amount: 50,
                                    currency: 'EUR',
                                    formatted: '€NaN' // Invalid
                                }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithInvalidProposalPricing);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.description.includes('invalid formatted price')
            )).toBe(true);
        });
    });

    describe('temporal consistency validation', () => {
        it('should detect future creation dates', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            const dataWithFutureDate = {
                ...validSwapData,
                createdAt: futureDate
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithFutureDate);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'temporal_inconsistency' &&
                issue.description.includes('creation date is in the future')
            )).toBe(true);
        });

        it('should detect updated date before creation date', () => {
            const dataWithInvalidDates = {
                ...validSwapData,
                createdAt: new Date('2024-01-02'),
                updatedAt: new Date('2024-01-01') // Before creation
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithInvalidDates);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'temporal_inconsistency' &&
                issue.description.includes('Updated date is before creation date')
            )).toBe(true);
        });

        it('should detect old swaps', () => {
            const oldDate = new Date();
            oldDate.setFullYear(oldDate.getFullYear() - 2);

            const dataWithOldDate = {
                ...validSwapData,
                createdAt: oldDate,
                updatedAt: oldDate
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithOldDate);

            expect(result.issues.some(issue =>
                issue.type === 'info' &&
                issue.category === 'temporal_inconsistency' &&
                issue.description.includes('older than one year')
            )).toBe(true);
        });

        it('should validate proposal creation dates', () => {
            const dataWithInvalidProposalDate = {
                ...validSwapData,
                createdAt: new Date('2024-01-02'),
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date('2024-01-01') // Before swap creation
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithInvalidProposalDate);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'temporal_inconsistency' &&
                issue.description.includes('created before the target swap')
            )).toBe(true);
        });
    });

    describe('reference integrity validation', () => {
        it('should detect self-proposals', () => {
            const dataWithSelfProposal = {
                ...validSwapData,
                ownerId: 'user-456',
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-456', // Same as owner
                            proposerName: 'John Doe',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Self Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    totalIncomingCount: 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithSelfProposal);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.category === 'invalid_reference' &&
                issue.description.includes('self-proposal')
            )).toBe(true);
        });

        it('should detect circular targeting', () => {
            const dataWithCircularTargeting = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-target', // Same as outgoing target
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: '',
                            proposedTerms: {
                                pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                            },
                            status: 'pending' as const,
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: {
                        id: 'target-1',
                        targetSwapId: 'swap-target', // Same as proposer swap
                        targetOwnerName: 'Alice',
                        targetSwapTitle: 'Target Swap',
                        status: 'pending' as const,
                        createdAt: new Date()
                    },
                    totalIncomingCount: 1
                }
            };

            const result = DataConsistencyValidator.validateSwapConsistency(dataWithCircularTargeting);

            expect(result.issues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'invalid_reference' &&
                issue.description.includes('Circular targeting detected')
            )).toBe(true);
        });
    });

    describe('cross-swap consistency validation', () => {
        it('should validate consistency across multiple swaps', () => {
            const swapArray = [
                validSwapData,
                {
                    ...validSwapData,
                    id: 'swap-456',
                    ownerId: 'user-789',
                    ownerName: 'Jane Doe'
                }
            ];

            const result = DataConsistencyValidator.validateCrossSwapConsistency(swapArray);

            expect(result.totalSwapsChecked).toBe(2);
            expect(result.consistentSwaps).toBe(2);
            expect(result.inconsistentSwaps).toBe(0);
            expect(result.globalIssues).toHaveLength(0);
        });

        it('should detect inconsistent user names across swaps', () => {
            const swapArray = [
                { ...validSwapData, ownerId: 'user-456', ownerName: 'John Doe' },
                { ...validSwapData, id: 'swap-456', ownerId: 'user-456', ownerName: 'Johnny Doe' } // Different name
            ];

            const result = DataConsistencyValidator.validateCrossSwapConsistency(swapArray);

            expect(result.globalIssues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'data_mismatch' &&
                issue.description.includes('Inconsistent user name')
            )).toBe(true);
        });

        it('should detect invalid cross-references', () => {
            const swapArray = [
                {
                    ...validSwapData,
                    targeting: {
                        incomingProposals: [],
                        outgoingTarget: {
                            id: 'target-1',
                            targetSwapId: 'non-existent-swap', // Invalid reference
                            targetOwnerName: 'Alice',
                            targetSwapTitle: 'Target Swap',
                            status: 'pending' as const,
                            createdAt: new Date()
                        },
                        totalIncomingCount: 0
                    }
                }
            ];

            const result = DataConsistencyValidator.validateCrossSwapConsistency(swapArray);

            expect(result.globalIssues.some(issue =>
                issue.type === 'warning' &&
                issue.category === 'invalid_reference' &&
                issue.description.includes('targets non-existent swap')
            )).toBe(true);
        });

        it('should generate appropriate recommendations', () => {
            const swapArray = [
                {
                    ...validSwapData,
                    id: '', // Missing ID - high severity
                    pricing: {
                        amount: 100,
                        currency: 'EUR',
                        formatted: '€NaN' // Invalid format - high severity
                    }
                }
            ];

            const result = DataConsistencyValidator.validateCrossSwapConsistency(swapArray);

            expect(result.summary.criticalIssues).toBeGreaterThan(0);
            expect(result.summary.recommendations.length).toBeGreaterThan(0);
            expect(result.summary.recommendations.some(rec =>
                rec.includes('Review and fix data retrieval queries')
            )).toBe(true);
        });
    });

    describe('error handling', () => {
        it('should handle validation errors gracefully', () => {
            // Create a proxy that throws an error when accessing pricing
            const problematicData = new Proxy(validSwapData, {
                get(target, prop) {
                    if (prop === 'pricing') {
                        throw new Error('Simulated error');
                    }
                    return target[prop as keyof CompleteSwapData];
                }
            });

            const result = DataConsistencyValidator.validateSwapConsistency(problematicData);

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue =>
                issue.type === 'error' &&
                issue.description.includes('Validation error')
            )).toBe(true);
        });
    });

    describe('performance with large datasets', () => {
        it('should handle large numbers of proposals efficiently', () => {
            const dataWithManyProposals = {
                ...validSwapData,
                targeting: {
                    incomingProposals: Array.from({ length: 1000 }, (_, i) => ({
                        id: `prop-${i}`,
                        proposerId: `user-${i}`,
                        proposerName: `User ${i}`,
                        proposerSwapId: `swap-${i}`,
                        proposerSwapTitle: `Swap ${i}`,
                        proposerSwapDescription: '',
                        proposedTerms: {
                            pricing: { amount: 50, currency: 'EUR', formatted: '€50.00' }
                        },
                        status: 'pending' as const,
                        createdAt: new Date()
                    })),
                    outgoingTarget: null,
                    totalIncomingCount: 1000
                }
            };

            const startTime = Date.now();
            const result = DataConsistencyValidator.validateSwapConsistency(dataWithManyProposals);
            const endTime = Date.now();

            expect(result.isConsistent).toBe(true);
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });
});