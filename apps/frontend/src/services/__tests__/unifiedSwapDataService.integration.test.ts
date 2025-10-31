import { describe, it, expect, beforeEach } from 'vitest';
import { dataConsistencyValidator } from '../../utils/dataConsistencyValidator';
import { SwapCardData } from '@booking-swap/shared';

/**
 * Integration tests for data consistency functionality
 * 
 * These tests verify that the data consistency validation works correctly
 * with real data structures and edge cases.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

describe('Data Consistency Integration Tests', () => {
    let validSwapData: SwapCardData;

    beforeEach(() => {
        validSwapData = {
            userSwap: {
                id: 'swap-123',
                status: 'pending',
                bookingDetails: {
                    id: 'booking-456',
                    title: 'Luxury Hotel in Paris',
                    type: 'hotel',
                    location: {
                        city: 'Paris',
                        country: 'France'
                    },
                    dateRange: {
                        checkIn: new Date('2024-06-01'),
                        checkOut: new Date('2024-06-07')
                    },
                    swapValue: 1200,
                    currency: 'EUR'
                },
                createdAt: new Date('2024-01-15T10:00:00Z'),
                expiresAt: new Date('2024-06-01T10:00:00Z')
            }
        };
    });

    describe('Data Validation', () => {
        it('should validate complete swap data successfully', () => {
            const result = dataConsistencyValidator.validateSwapData(validSwapData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.score).toBeGreaterThan(90);
        });

        it('should handle financial data edge cases', () => {
            // Test with null swap value
            const dataWithNullValue = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        swapValue: null
                    }
                }
            };

            const result = dataConsistencyValidator.validateSwapData(dataWithNullValue);
            expect(result.isValid).toBe(true); // Should be valid with warnings
            expect(result.warnings.some(w => w.message.includes('Price not set'))).toBe(true);
        });

        it('should detect missing critical information', () => {
            const incompleteData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    id: '', // Missing ID
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        title: 'Untitled Booking' // Default title
                    }
                }
            };

            const result = dataConsistencyValidator.validateSwapData(incompleteData);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.field === 'userSwap.id')).toBe(true);
            expect(result.errors.some(e => e.field === 'userSwap.bookingDetails.title')).toBe(true);
        });
    });

    describe('Consistency Checking', () => {
        it('should detect data inconsistencies between sources', () => {
            const alternativeData = {
                userSwap: {
                    id: validSwapData.userSwap.id,
                    status: 'accepted', // Different status
                    bookingDetails: {
                        swapValue: 1500 // Different value
                    }
                }
            };

            const result = dataConsistencyValidator.checkDataConsistency(
                validSwapData,
                alternativeData
            );

            expect(result.isConsistent).toBe(false);
            expect(result.discrepancies.length).toBeGreaterThan(0);
            expect(result.discrepancies.some(d => d.field === 'userSwap.status')).toBe(true);
        });

        it('should validate display element consistency', () => {
            const displayElements = {
                header: {
                    swapId: validSwapData.userSwap.id,
                    status: validSwapData.userSwap.status,
                    title: validSwapData.userSwap.bookingDetails.title,
                    swapValue: validSwapData.userSwap.bookingDetails.swapValue
                },
                card: {
                    swapId: 'different-id', // Inconsistent ID
                    status: validSwapData.userSwap.status,
                    title: validSwapData.userSwap.bookingDetails.title,
                    swapValue: validSwapData.userSwap.bookingDetails.swapValue
                }
            };

            const result = dataConsistencyValidator.validateDisplayConsistency(
                validSwapData,
                displayElements
            );

            expect(result.isConsistent).toBe(false);
            expect(result.issues.some(issue => issue.includes('Swap ID mismatch'))).toBe(true);
        });
    });

    describe('Real-world Scenarios', () => {
        it('should handle incomplete API responses gracefully', () => {
            const incompleteApiData = {
                userSwap: {
                    id: 'swap-123',
                    status: 'pending',
                    bookingDetails: {
                        id: 'booking-456',
                        // Missing title, location, etc.
                        type: 'hotel',
                        location: { city: '', country: '' },
                        dateRange: { checkIn: new Date(), checkOut: new Date() },
                        swapValue: undefined,
                        currency: ''
                    },
                    createdAt: new Date(),
                    expiresAt: undefined
                }
            };

            const result = dataConsistencyValidator.validateSwapData(incompleteApiData as any);

            // Should detect multiple issues but not crash
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.score).toBeLessThan(80); // Adjusted expectation
        });

        it('should detect stale data scenarios', () => {
            const currentData = validSwapData;
            const externalData = {
                id: validSwapData.userSwap.id,
                status: 'completed', // Updated status from external source
                lastUpdated: new Date()
            };

            const discrepancies = dataConsistencyValidator.detectDiscrepancies(
                currentData,
                undefined,
                externalData
            );

            expect(discrepancies.some(d =>
                d.type === 'stale_data' &&
                d.field === 'userSwap.status'
            )).toBe(true);
        });

        it('should validate enhanced swap data with targeting', () => {
            const enhancedData = {
                ...validSwapData,
                targeting: {
                    incomingTargets: [
                        {
                            id: 'target-1',
                            sourceSwapId: 'swap-789',
                            proposerName: 'John Doe',
                            proposerSwapTitle: 'Beach Resort',
                            status: 'pending',
                            createdAt: new Date()
                        },
                        {
                            id: 'target-2',
                            sourceSwapId: 'swap-101',
                            proposerName: 'Unknown User', // Default name
                            proposerSwapTitle: 'Untitled Swap', // Default title
                            status: 'pending',
                            createdAt: new Date()
                        }
                    ],
                    outgoingTarget: null,
                    canTarget: true
                }
            };

            const result = dataConsistencyValidator.validateSwapData(enhancedData as any);

            expect(result.isValid).toBe(true);
            expect(result.warnings.some(w => w.message.includes('Proposer name is missing'))).toBe(true);
            expect(result.warnings.some(w => w.message.includes('Proposer swap title is missing'))).toBe(true);
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large datasets efficiently', () => {
            const largeTargetingData = {
                ...validSwapData,
                targeting: {
                    incomingTargets: Array.from({ length: 100 }, (_, i) => ({
                        id: `target-${i}`,
                        sourceSwapId: `swap-${i}`,
                        proposerName: `User ${i}`,
                        proposerSwapTitle: `Swap ${i}`,
                        status: 'pending',
                        createdAt: new Date()
                    })),
                    outgoingTarget: null,
                    canTarget: true
                }
            };

            const startTime = Date.now();
            const result = dataConsistencyValidator.validateSwapData(largeTargetingData as any);
            const endTime = Date.now();

            expect(result).toBeDefined();
            expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should handle malformed data without crashing', () => {
            const malformedData = {
                userSwap: {
                    id: null,
                    status: undefined,
                    bookingDetails: null,
                    createdAt: 'invalid-date',
                    expiresAt: 'also-invalid'
                }
            };

            expect(() => {
                dataConsistencyValidator.validateSwapData(malformedData as any);
            }).not.toThrow();
        });

        it('should provide meaningful error messages', () => {
            const invalidData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    id: '',
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        swapValue: -100 // Negative value
                    }
                }
            };

            const result = dataConsistencyValidator.validateSwapData(invalidData);

            const idError = result.errors.find(e => e.field === 'userSwap.id');
            const valueError = result.errors.find(e => e.field === 'userSwap.bookingDetails.swapValue');

            expect(idError?.message).toContain('missing');
            expect(idError?.suggestion).toBeDefined();
            expect(valueError?.message).toContain('negative');
        });
    });
});