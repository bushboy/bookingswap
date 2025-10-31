import { describe, it, expect, beforeEach } from 'vitest';
import { dataConsistencyValidator } from '../dataConsistencyValidator';
import { SwapCardData, EnhancedSwapCardData } from '@booking-swap/shared';

/**
 * Tests for Data Consistency Validator
 * 
 * These tests ensure that the data consistency validation works correctly
 * and can detect various types of data issues and discrepancies.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

describe('DataConsistencyValidator', () => {
    let validSwapData: SwapCardData;
    let enhancedSwapData: EnhancedSwapCardData;

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

        enhancedSwapData = {
            ...validSwapData,
            targeting: {
                incomingTargets: [
                    {
                        id: 'target-1',
                        sourceSwapId: 'swap-789',
                        proposerName: 'John Doe',
                        proposerSwapTitle: 'Beach Resort in Nice',
                        status: 'pending',
                        createdAt: new Date('2024-01-16T10:00:00Z')
                    },
                    {
                        id: 'target-2',
                        sourceSwapId: 'swap-101',
                        proposerName: 'Jane Smith',
                        proposerSwapTitle: 'Mountain Cabin in Alps',
                        status: 'pending',
                        createdAt: new Date('2024-01-17T10:00:00Z')
                    }
                ],
                outgoingTarget: {
                    id: 'target-out-1',
                    targetSwapId: 'swap-202',
                    targetOwnerName: 'Bob Wilson',
                    targetSwapTitle: 'City Apartment in Rome',
                    status: 'pending',
                    createdAt: new Date('2024-01-18T10:00:00Z')
                },
                canTarget: true
            }
        };
    });

    describe('validateSwapData', () => {
        it('should validate correct swap data without errors', () => {
            const result = dataConsistencyValidator.validateSwapData(validSwapData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.score).toBeGreaterThan(90);
        });

        it('should detect missing critical fields', () => {
            const invalidData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    id: '', // Missing ID
                    status: undefined as any // Missing status
                }
            };

            const result = dataConsistencyValidator.validateSwapData(invalidData);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors.some(e => e.field === 'userSwap.id')).toBe(true);
            expect(result.errors.some(e => e.field === 'userSwap.status')).toBe(true);
            expect(result.score).toBeLessThan(50);
        });

        it('should detect invalid financial data', () => {
            const invalidData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        swapValue: NaN, // Invalid value
                        currency: '' // Missing currency
                    }
                }
            };

            const result = dataConsistencyValidator.validateSwapData(invalidData);

            // Should have errors for invalid financial data
            expect(result.errors.some(e => e.field === 'userSwap.bookingDetails.swapValue')).toBe(true);
            expect(result.warnings.some(w => w.field === 'userSwap.bookingDetails.currency')).toBe(true);

            // Check if it's invalid due to critical errors
            const hasCriticalErrors = result.errors.some(e => e.severity === 'critical');
            expect(result.isValid).toBe(!hasCriticalErrors);
        });

        it('should handle null swap values gracefully', () => {
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

            expect(result.isValid).toBe(true); // Should be valid, just with warnings
            expect(result.warnings.some(w =>
                w.field === 'userSwap.bookingDetails.swapValue' &&
                w.message.includes('Price not set')
            )).toBe(true);
        });

        it('should detect default/placeholder values', () => {
            const dataWithDefaults = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        title: 'Untitled Booking' // Default title
                    }
                }
            };

            const result = dataConsistencyValidator.validateSwapData(dataWithDefaults);

            expect(result.errors.some(e =>
                e.field === 'userSwap.bookingDetails.title' &&
                e.message.includes('default value')
            )).toBe(true);
        });

        it('should validate enhanced swap data with targeting', () => {
            const result = dataConsistencyValidator.validateSwapData(enhancedSwapData);

            expect(result.isValid).toBe(true);
            expect(result.score).toBeGreaterThan(90);
        });

        it('should detect missing targeting information', () => {
            const dataWithMissingTargeting = {
                ...enhancedSwapData,
                targeting: {
                    ...enhancedSwapData.targeting,
                    incomingTargets: [
                        {
                            ...enhancedSwapData.targeting.incomingTargets[0],
                            proposerName: 'Unknown User', // Default name
                            proposerSwapTitle: 'Untitled Swap' // Default title
                        }
                    ]
                }
            };

            const result = dataConsistencyValidator.validateSwapData(dataWithMissingTargeting);

            expect(result.warnings.some(w => w.message.includes('Proposer name is missing'))).toBe(true);
            expect(result.warnings.some(w => w.message.includes('Proposer swap title is missing'))).toBe(true);
        });
    });

    describe('checkDataConsistency', () => {
        it('should detect no discrepancies with identical data', () => {
            const result = dataConsistencyValidator.checkDataConsistency(validSwapData, validSwapData);

            expect(result.isConsistent).toBe(true);
            expect(result.discrepancies).toHaveLength(0);
            expect(result.overallScore).toBe(100);
        });

        it('should detect swap ID mismatch', () => {
            const alternativeData = {
                userSwap: {
                    id: 'different-swap-id',
                    status: validSwapData.userSwap.status
                }
            };

            const result = dataConsistencyValidator.checkDataConsistency(validSwapData, alternativeData);

            expect(result.isConsistent).toBe(false);
            expect(result.discrepancies.some(d =>
                d.type === 'inconsistent_values' &&
                d.field === 'userSwap.id'
            )).toBe(true);
            expect(result.overallScore).toBeLessThan(100);
        });

        it('should detect status mismatch', () => {
            const alternativeData = {
                userSwap: {
                    id: validSwapData.userSwap.id,
                    status: 'accepted' // Different status
                }
            };

            const result = dataConsistencyValidator.checkDataConsistency(validSwapData, alternativeData);

            expect(result.isConsistent).toBe(false);
            expect(result.discrepancies.some(d =>
                d.type === 'inconsistent_values' &&
                d.field === 'userSwap.status'
            )).toBe(true);
        });

        it('should detect financial data mismatch', () => {
            const alternativeData = {
                userSwap: {
                    id: validSwapData.userSwap.id,
                    bookingDetails: {
                        swapValue: 1500 // Different value
                    }
                }
            };

            const result = dataConsistencyValidator.checkDataConsistency(validSwapData, alternativeData);

            expect(result.discrepancies.some(d =>
                d.field === 'userSwap.bookingDetails.swapValue'
            )).toBe(true);
        });

        it('should detect internal consistency issues', () => {
            const inconsistentData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    createdAt: new Date('2024-06-01T10:00:00Z'),
                    expiresAt: new Date('2024-01-15T10:00:00Z') // Expires before creation
                }
            };

            const result = dataConsistencyValidator.checkDataConsistency(inconsistentData);

            expect(result.discrepancies.some(d =>
                d.type === 'invalid_format' &&
                d.field === 'userSwap.expiresAt'
            )).toBe(true);
        });
    });

    describe('detectDiscrepancies', () => {
        it('should detect changes between data versions', () => {
            const previousData = { ...validSwapData };
            const currentData = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    bookingDetails: {
                        ...validSwapData.userSwap.bookingDetails,
                        title: 'Updated Hotel Title'
                    }
                }
            };

            const discrepancies = dataConsistencyValidator.detectDiscrepancies(
                currentData,
                previousData
            );

            expect(discrepancies.some(d =>
                d.type === 'inconsistent_values' &&
                d.field === 'userSwap.bookingDetails.title'
            )).toBe(true);
        });

        it('should detect discrepancies with external data', () => {
            const externalData = {
                id: validSwapData.userSwap.id,
                status: 'accepted' // Different from current 'pending'
            };

            const discrepancies = dataConsistencyValidator.detectDiscrepancies(
                validSwapData,
                undefined,
                externalData
            );

            expect(discrepancies.some(d =>
                d.type === 'stale_data' &&
                d.field === 'userSwap.status'
            )).toBe(true);
        });
    });

    describe('validateDisplayConsistency', () => {
        it('should validate consistent display elements', () => {
            const displayElements = {
                header: {
                    swapId: validSwapData.userSwap.id,
                    status: validSwapData.userSwap.status,
                    title: validSwapData.userSwap.bookingDetails.title,
                    swapValue: validSwapData.userSwap.bookingDetails.swapValue
                },
                card: {
                    swapId: validSwapData.userSwap.id,
                    status: validSwapData.userSwap.status,
                    title: validSwapData.userSwap.bookingDetails.title,
                    swapValue: validSwapData.userSwap.bookingDetails.swapValue
                }
            };

            const result = dataConsistencyValidator.validateDisplayConsistency(
                validSwapData,
                displayElements
            );

            expect(result.isConsistent).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect inconsistent display elements', () => {
            const displayElements = {
                header: {
                    swapId: validSwapData.userSwap.id,
                    status: 'accepted', // Different status
                    title: validSwapData.userSwap.bookingDetails.title,
                    swapValue: validSwapData.userSwap.bookingDetails.swapValue
                },
                card: {
                    swapId: 'different-id', // Different ID
                    status: validSwapData.userSwap.status,
                    title: 'Different Title', // Different title
                    swapValue: 1500 // Different value
                }
            };

            const result = dataConsistencyValidator.validateDisplayConsistency(
                validSwapData,
                displayElements
            );

            expect(result.isConsistent).toBe(false);
            expect(result.issues.length).toBeGreaterThan(0);
            expect(result.issues.some(issue => issue.includes('Status mismatch'))).toBe(true);
            expect(result.issues.some(issue => issue.includes('Swap ID mismatch'))).toBe(true);
            expect(result.issues.some(issue => issue.includes('Title mismatch'))).toBe(true);
            expect(result.issues.some(issue => issue.includes('Swap value mismatch'))).toBe(true);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle empty swap data gracefully', () => {
            const emptyData = {
                userSwap: {
                    id: '',
                    status: '' as any,
                    bookingDetails: {
                        id: '',
                        title: '',
                        type: 'hotel' as any,
                        location: { city: '', country: '' },
                        dateRange: { checkIn: new Date(), checkOut: new Date() },
                        swapValue: null,
                        currency: ''
                    },
                    createdAt: new Date(),
                    expiresAt: undefined
                }
            };

            const result = dataConsistencyValidator.validateSwapData(emptyData);

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.score).toBeLessThan(50);
        });

        it('should handle malformed dates', () => {
            const dataWithBadDates = {
                ...validSwapData,
                userSwap: {
                    ...validSwapData.userSwap,
                    createdAt: new Date('invalid-date'),
                    expiresAt: new Date('also-invalid')
                }
            };

            // Should not throw an error
            expect(() => {
                dataConsistencyValidator.validateSwapData(dataWithBadDates);
            }).not.toThrow();
        });

        it('should handle missing targeting data in enhanced swap', () => {
            const enhancedWithoutTargeting = {
                ...validSwapData,
                targeting: undefined
            } as any;

            const result = dataConsistencyValidator.validateSwapData(enhancedWithoutTargeting);

            expect(result.warnings.some(w => w.message.includes('Targeting data is missing'))).toBe(true);
        });
    });
});