/**
 * Unit Tests for Swap Data Validator
 * Requirements: 4.1, 4.2, 4.3, 6.4 - Sanitize and validate complete swap data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwapDataValidator } from '../../../apps/backend/src/utils/swapDataValidator';

// Mock logger to avoid console output during tests
vi.mock('../../../apps/backend/src/utils/logger', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('SwapDataValidator', () => {
    let validSwapData: any;

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
                currency: 'EUR'
            },
            targeting: {
                incomingProposals: [],
                outgoingTarget: null
            },
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-02')
        };
    });

    describe('validateAndSanitize', () => {
        it('should validate and sanitize valid swap data', () => {
            const result = SwapDataValidator.validateAndSanitize(validSwapData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedData).toBeDefined();
            expect(result.sanitizedData!.id).toBe('swap-123');
            expect(result.sanitizedData!.title).toBe('Test Swap');
            expect(result.sanitizedData!.ownerName).toBe('John Doe');
        });

        it('should handle null or undefined input', () => {
            const result = SwapDataValidator.validateAndSanitize(null);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Swap data is null or undefined');
            expect(result.sanitizedData).toBe(null);
        });

        it('should handle missing required fields', () => {
            const invalidData = { ...validSwapData };
            delete invalidData.id;
            delete invalidData.title;

            const result = SwapDataValidator.validateAndSanitize(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Missing swap ID');
            expect(result.errors).toContain('Missing swap title');
        });

        it('should provide fallback values for missing optional fields', () => {
            const dataWithMissingFields = {
                id: 'swap-123',
                title: '',
                description: '',
                ownerId: 'user-456',
                ownerName: '',
                status: 'active'
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithMissingFields);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.title).toBe('Untitled Swap');
            expect(result.sanitizedData!.ownerName).toBe('Unknown User');
            expect(result.warnings).toContain('Owner name not provided, using fallback');
        });

        it('should sanitize pricing data correctly', () => {
            const dataWithPricing = {
                ...validSwapData,
                pricing: {
                    amount: '50.00',
                    currency: 'USD'
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithPricing);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.pricing.amount).toBe(50);
            expect(result.sanitizedData!.pricing.currency).toBe('USD');
            expect(result.sanitizedData!.pricing.formatted).toBe('$50.00');
        });

        it('should handle invalid pricing data', () => {
            const dataWithInvalidPricing = {
                ...validSwapData,
                pricing: {
                    amount: 'invalid',
                    currency: 'EUR'
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithInvalidPricing);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.pricing.amount).toBe(null);
            expect(result.sanitizedData!.pricing.formatted).toBe('Invalid price');
        });

        it('should validate targeting data consistency', () => {
            const dataWithInconsistentTargeting = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        { id: 'prop-1', proposerId: 'user-1', proposerName: 'User 1' },
                        { id: 'prop-2', proposerId: 'user-2', proposerName: 'User 2' }
                    ],
                    totalIncomingCount: 3 // Inconsistent count
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithInconsistentTargeting);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Inconsistent proposal count'))).toBe(true);
        });
    });

    describe('proposal sanitization', () => {
        it('should sanitize valid proposals', () => {
            const dataWithProposals = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1',
                            proposerName: 'Alice',
                            proposerSwapId: 'swap-456',
                            proposerSwapTitle: 'Alice Swap',
                            proposerSwapDescription: 'Alice description',
                            proposedTerms: {
                                pricing: { amount: 75, currency: 'EUR' },
                                message: 'Great swap!'
                            },
                            status: 'pending',
                            createdAt: new Date('2024-01-01')
                        }
                    ]
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithProposals);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.targeting.incomingProposals).toHaveLength(1);

            const proposal = result.sanitizedData!.targeting.incomingProposals[0];
            expect(proposal.id).toBe('prop-1');
            expect(proposal.proposerName).toBe('Alice');
            expect(proposal.proposedTerms.pricing.formatted).toBe('€75.00');
        });

        it('should filter out invalid proposals', () => {
            const dataWithInvalidProposals = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        { id: 'prop-1', proposerId: 'user-1', proposerName: 'Alice' }, // Valid
                        { proposerId: 'user-2' }, // Missing ID
                        null, // Null proposal
                        { id: 'prop-3', proposerId: 'user-3', proposerName: 'Bob' } // Valid
                    ]
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithInvalidProposals);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.targeting.incomingProposals).toHaveLength(2);
            expect(result.sanitizedData!.targeting.totalIncomingCount).toBe(2);
        });

        it('should provide fallback values for missing proposal fields', () => {
            const dataWithIncompleteProposal = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [
                        {
                            id: 'prop-1',
                            proposerId: 'user-1'
                            // Missing other fields
                        }
                    ]
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithIncompleteProposal);

            expect(result.isValid).toBe(true);

            const proposal = result.sanitizedData!.targeting.incomingProposals[0];
            expect(proposal.proposerName).toBe('Unknown User');
            expect(proposal.proposerSwapTitle).toBe('Untitled Swap');
            expect(proposal.status).toBe('pending');
        });
    });

    describe('target sanitization', () => {
        it('should sanitize valid target data', () => {
            const dataWithTarget = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [],
                    outgoingTarget: {
                        id: 'target-1',
                        targetSwapId: 'swap-789',
                        targetOwnerName: 'Bob',
                        targetSwapTitle: 'Bob Swap',
                        status: 'accepted',
                        createdAt: new Date('2024-01-01')
                    }
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithTarget);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.targeting.outgoingTarget).toBeDefined();

            const target = result.sanitizedData!.targeting.outgoingTarget!;
            expect(target.id).toBe('target-1');
            expect(target.targetOwnerName).toBe('Bob');
            expect(target.status).toBe('accepted');
        });

        it('should handle null target data', () => {
            const dataWithNullTarget = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [],
                    outgoingTarget: null
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithNullTarget);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.targeting.outgoingTarget).toBe(null);
        });

        it('should provide fallback values for incomplete target data', () => {
            const dataWithIncompleteTarget = {
                ...validSwapData,
                targeting: {
                    incomingProposals: [],
                    outgoingTarget: {
                        id: 'target-1'
                        // Missing other fields
                    }
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithIncompleteTarget);

            expect(result.isValid).toBe(true);

            const target = result.sanitizedData!.targeting.outgoingTarget!;
            expect(target.targetOwnerName).toBe('Unknown User');
            expect(target.targetSwapTitle).toBe('Untitled Swap');
            expect(target.status).toBe('pending');
        });
    });

    describe('date sanitization', () => {
        it('should handle valid date objects', () => {
            const validDate = new Date('2024-01-01');
            const dataWithDates = {
                ...validSwapData,
                createdAt: validDate,
                updatedAt: validDate
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithDates);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.createdAt).toEqual(validDate);
            expect(result.sanitizedData!.updatedAt).toEqual(validDate);
        });

        it('should handle date strings', () => {
            const dataWithDateStrings = {
                ...validSwapData,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z'
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithDateStrings);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.createdAt).toBeInstanceOf(Date);
            expect(result.sanitizedData!.updatedAt).toBeInstanceOf(Date);
        });

        it('should handle invalid dates', () => {
            const dataWithInvalidDates = {
                ...validSwapData,
                createdAt: 'invalid-date',
                updatedAt: null
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithInvalidDates);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.createdAt).toBeInstanceOf(Date);
            expect(result.sanitizedData!.updatedAt).toBeInstanceOf(Date);
        });
    });

    describe('batch validation', () => {
        it('should validate multiple swaps correctly', () => {
            const swapArray = [
                validSwapData,
                { ...validSwapData, id: 'swap-456', title: 'Second Swap' },
                { ...validSwapData, id: 'swap-789', title: 'Third Swap' }
            ];

            const result = SwapDataValidator.validateBatch(swapArray);

            expect(result.validSwaps).toHaveLength(3);
            expect(result.invalidSwaps).toHaveLength(0);
            expect(result.summary.total).toBe(3);
            expect(result.summary.valid).toBe(3);
            expect(result.summary.invalid).toBe(0);
        });

        it('should handle mixed valid and invalid swaps', () => {
            const swapArray = [
                validSwapData,
                null, // Invalid
                { id: 'swap-456' }, // Missing title
                { ...validSwapData, id: 'swap-789', title: 'Valid Swap' }
            ];

            const result = SwapDataValidator.validateBatch(swapArray);

            expect(result.validSwaps).toHaveLength(2);
            expect(result.invalidSwaps).toHaveLength(2);
            expect(result.summary.total).toBe(4);
            expect(result.summary.valid).toBe(2);
            expect(result.summary.invalid).toBe(2);
        });

        it('should handle non-array input', () => {
            const result = SwapDataValidator.validateBatch('not-an-array' as any);

            expect(result.validSwaps).toHaveLength(0);
            expect(result.invalidSwaps).toHaveLength(1);
            expect(result.summary.total).toBe(0);
            expect(result.summary.invalid).toBe(1);
        });
    });

    describe('error handling', () => {
        it('should handle validation errors gracefully', () => {
            // Create data that will cause an error during validation
            const problematicData = {
                ...validSwapData,
                targeting: {
                    get incomingProposals() {
                        throw new Error('Simulated error');
                    }
                }
            };

            const result = SwapDataValidator.validateAndSanitize(problematicData);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(error => error.includes('Validation error'))).toBe(true);
            expect(result.sanitizedData).toBe(null);
        });
    });

    describe('edge cases', () => {
        it('should handle empty strings and whitespace', () => {
            const dataWithWhitespace = {
                ...validSwapData,
                title: '   ',
                description: '\t\n',
                ownerName: '  John Doe  '
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithWhitespace);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.title).toBe('Untitled Swap');
            expect(result.sanitizedData!.description).toBe('');
            expect(result.sanitizedData!.ownerName).toBe('John Doe');
        });

        it('should handle different data structure formats', () => {
            const alternativeFormat = {
                id: 'swap-123',
                title: 'Test Swap',
                owner_id: 'user-456', // Snake case
                owner_name: 'John Doe', // Snake case
                status: 'active',
                price_amount: 100, // Alternative pricing format
                price_currency: 'EUR',
                created_at: '2024-01-01', // Snake case
                updated_at: '2024-01-02'
            };

            const result = SwapDataValidator.validateAndSanitize(alternativeFormat);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.ownerId).toBe('user-456');
            expect(result.sanitizedData!.ownerName).toBe('John Doe');
            expect(result.sanitizedData!.pricing.amount).toBe(100);
            expect(result.sanitizedData!.pricing.currency).toBe('EUR');
        });

        it('should handle very large datasets', () => {
            const dataWithManyProposals = {
                ...validSwapData,
                targeting: {
                    incomingProposals: Array.from({ length: 100 }, (_, i) => ({
                        id: `prop-${i}`,
                        proposerId: `user-${i}`,
                        proposerName: `User ${i}`,
                        proposerSwapId: `swap-${i}`,
                        proposerSwapTitle: `Swap ${i}`,
                        status: 'pending',
                        createdAt: new Date()
                    }))
                }
            };

            const result = SwapDataValidator.validateAndSanitize(dataWithManyProposals);

            expect(result.isValid).toBe(true);
            expect(result.sanitizedData!.targeting.incomingProposals).toHaveLength(100);
            expect(result.sanitizedData!.targeting.totalIncomingCount).toBe(100);
        });
    });
});