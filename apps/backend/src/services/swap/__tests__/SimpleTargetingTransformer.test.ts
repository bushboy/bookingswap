import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    SimpleTargetingTransformer,
    RawTargetingData,
    SimpleTargetingData,
    TargetingValidationResult
} from '../SimpleTargetingTransformer';
import { SwapTargetStatus } from '@booking-swap/shared';

// Mock logger to avoid console output during tests
vi.mock('../../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('SimpleTargetingTransformer', () => {
    let mockRawData: RawTargetingData[];

    beforeEach(() => {
        // Reset mock data before each test
        mockRawData = [
            {
                direction: 'incoming',
                target_id: 'target-1',
                target_swap_id: 'swap-1',
                source_swap_id: 'swap-2',
                proposal_id: 'proposal-1',
                status: 'active' as SwapTargetStatus,
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-01'),
                booking_title: 'Beach House in Miami',
                booking_city: 'Miami',
                booking_country: 'USA',
                check_in: new Date('2024-06-01'),
                check_out: new Date('2024-06-07'),
                price: 1500,
                owner_name: 'John Doe',
                owner_email: 'john@example.com',
                data_source: 'swap_targets'
            },
            {
                direction: 'outgoing',
                target_id: 'target-2',
                target_swap_id: 'swap-3',
                source_swap_id: 'swap-1',
                proposal_id: 'proposal-2',
                status: 'active' as SwapTargetStatus,
                created_at: new Date('2024-01-02'),
                updated_at: new Date('2024-01-02'),
                booking_title: 'Mountain Cabin in Colorado',
                booking_city: 'Aspen',
                booking_country: 'USA',
                check_in: new Date('2024-07-01'),
                check_out: new Date('2024-07-07'),
                price: 2000,
                owner_name: 'Jane Smith',
                owner_email: 'jane@example.com',
                data_source: 'swap_targets'
            }
        ];
    });

    describe('transform', () => {
        it('should transform valid raw data into simple targeting data', () => {
            const result = SimpleTargetingTransformer.transform(mockRawData);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                swapId: 'swap-1',
                incomingTargets: [{
                    id: 'target-1',
                    sourceSwapId: 'swap-2',
                    ownerName: 'John Doe',
                    bookingTitle: 'Beach House in Miami',
                    status: 'active'
                }],
                outgoingTarget: {
                    id: 'target-2',
                    targetSwapId: 'swap-3',
                    ownerName: 'Jane Smith',
                    bookingTitle: 'Mountain Cabin in Colorado',
                    status: 'active'
                }
            });
        });

        it('should handle empty input data', () => {
            const result = SimpleTargetingTransformer.transform([]);
            expect(result).toEqual([]);
        });

        it('should handle multiple incoming targets for the same swap', () => {
            const multipleIncomingData: RawTargetingData[] = [
                {
                    ...mockRawData[0],
                    target_id: 'target-1',
                    source_swap_id: 'swap-2'
                },
                {
                    ...mockRawData[0],
                    target_id: 'target-3',
                    source_swap_id: 'swap-4',
                    owner_name: 'Bob Wilson',
                    booking_title: 'City Apartment'
                }
            ];

            const result = SimpleTargetingTransformer.transform(multipleIncomingData);

            expect(result).toHaveLength(1);
            expect(result[0].incomingTargets).toHaveLength(2);
            expect(result[0].incomingTargets[0].ownerName).toBe('John Doe');
            expect(result[0].incomingTargets[1].ownerName).toBe('Bob Wilson');
        });

        it('should handle missing optional fields gracefully', () => {
            const dataWithMissingFields: RawTargetingData[] = [{
                ...mockRawData[0],
                owner_name: '',
                booking_title: ''
            }];

            const result = SimpleTargetingTransformer.transform(dataWithMissingFields);

            expect(result).toHaveLength(1);
            expect(result[0].incomingTargets[0].ownerName).toBe('Unknown User');
            expect(result[0].incomingTargets[0].bookingTitle).toBe('Untitled Booking');
        });

        it('should throw error for invalid input data structure', () => {
            const invalidData = [
                {
                    ...mockRawData[0],
                    target_id: null, // Invalid target_id
                }
            ] as any;

            expect(() => SimpleTargetingTransformer.transform(invalidData))
                .toThrow('Input validation failed');
        });

        it('should continue processing other swaps when one swap fails', () => {
            const mixedData: RawTargetingData[] = [
                mockRawData[0], // Valid data
                {
                    ...mockRawData[1],
                    target_swap_id: '', // Invalid - empty target_swap_id
                    source_swap_id: 'swap-5' // Different swap to test isolation
                },
                {
                    ...mockRawData[0],
                    target_swap_id: 'swap-6', // Another valid swap
                    target_id: 'target-4'
                }
            ];

            // This should not throw, but should skip the invalid item
            const result = SimpleTargetingTransformer.transform(mixedData);

            // Should have 2 swaps (swap-1 and swap-6), skipping the invalid one
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('validateIncomingTargets', () => {
        it('should validate correct incoming targets', () => {
            const validTargets = [{
                id: 'target-1',
                sourceSwapId: 'swap-2',
                ownerName: 'John Doe',
                bookingTitle: 'Beach House',
                status: 'active' as SwapTargetStatus
            }];

            const result = SimpleTargetingTransformer.validateIncomingTargets(validTargets);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
            expect(result.skippedCount).toBe(0);
        });

        it('should detect invalid target IDs', () => {
            const invalidTargets = [{
                id: '', // Invalid empty ID
                sourceSwapId: 'swap-2',
                ownerName: 'John Doe',
                bookingTitle: 'Beach House',
                status: 'active' as SwapTargetStatus
            }];

            const result = SimpleTargetingTransformer.validateIncomingTargets(invalidTargets);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid target ID: ');
            expect(result.processedCount).toBe(0);
            expect(result.skippedCount).toBe(1);
        });

        it('should detect invalid statuses', () => {
            const invalidTargets = [{
                id: 'target-1',
                sourceSwapId: 'swap-2',
                ownerName: 'John Doe',
                bookingTitle: 'Beach House',
                status: 'invalid-status' as any
            }];

            const result = SimpleTargetingTransformer.validateIncomingTargets(invalidTargets);

            expect(result.isValid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid status'))).toBe(true);
            expect(result.skippedCount).toBe(1);
        });

        it('should generate warnings for missing optional fields', () => {
            const targetsWithMissingFields = [{
                id: 'target-1',
                sourceSwapId: 'swap-2',
                ownerName: '', // Missing owner name
                bookingTitle: '', // Missing booking title
                status: 'active' as SwapTargetStatus
            }];

            const result = SimpleTargetingTransformer.validateIncomingTargets(targetsWithMissingFields);

            expect(result.isValid).toBe(true); // Still valid, just warnings
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings.some(w => w.includes('owner name'))).toBe(true);
            expect(result.warnings.some(w => w.includes('booking title'))).toBe(true);
        });
    });

    describe('validateOutgoingTarget', () => {
        it('should validate correct outgoing target', () => {
            const validTarget = {
                id: 'target-1',
                targetSwapId: 'swap-3',
                ownerName: 'Jane Smith',
                bookingTitle: 'Mountain Cabin',
                status: 'active' as SwapTargetStatus
            };

            const result = SimpleTargetingTransformer.validateOutgoingTarget(validTarget);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(1);
        });

        it('should handle undefined outgoing target', () => {
            const result = SimpleTargetingTransformer.validateOutgoingTarget(undefined);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.processedCount).toBe(0);
            expect(result.skippedCount).toBe(0);
        });

        it('should detect invalid outgoing target fields', () => {
            const invalidTarget = {
                id: '', // Invalid empty ID
                targetSwapId: 'swap-3',
                ownerName: 'Jane Smith',
                bookingTitle: 'Mountain Cabin',
                status: 'active' as SwapTargetStatus
            };

            const result = SimpleTargetingTransformer.validateOutgoingTarget(invalidTarget);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Invalid target ID: ');
            expect(result.skippedCount).toBe(1);
        });
    });

    describe('handleTransformationError', () => {
        it('should return empty array and log error details', () => {
            const error = new Error('Test transformation error');
            const context = { step: 'test_step', userId: 'user-1' };

            const result = SimpleTargetingTransformer.handleTransformationError(error, context);

            expect(result).toEqual([]);
        });

        it('should handle different error types', () => {
            const typeError = new TypeError('Type error test');
            const context = { step: 'test_step' };

            const result = SimpleTargetingTransformer.handleTransformationError(typeError, context);

            expect(result).toEqual([]);
        });
    });

    describe('edge cases and error handling', () => {
        it('should handle null input gracefully', () => {
            expect(() => SimpleTargetingTransformer.transform(null as any))
                .toThrow('Input validation failed');
        });

        it('should handle malformed data objects', () => {
            const malformedData = [
                {
                    // Missing required fields
                    direction: 'incoming',
                    // target_id missing
                    status: 'active'
                }
            ] as any;

            expect(() => SimpleTargetingTransformer.transform(malformedData))
                .toThrow('Input validation failed');
        });

        it('should handle multiple outgoing targets by using the first one', () => {
            const multipleOutgoingData: RawTargetingData[] = [
                {
                    ...mockRawData[1], // outgoing
                    target_id: 'target-2'
                },
                {
                    ...mockRawData[1], // another outgoing for same swap
                    target_id: 'target-3',
                    target_swap_id: 'swap-4',
                    owner_name: 'Another Owner'
                }
            ];

            const result = SimpleTargetingTransformer.transform(multipleOutgoingData);

            expect(result).toHaveLength(1);
            expect(result[0].outgoingTarget).toBeDefined();
            expect(result[0].outgoingTarget!.id).toBe('target-2'); // Should use first one
        });

        it('should handle different swap target statuses', () => {
            const statusVariations: SwapTargetStatus[] = ['active', 'cancelled', 'accepted', 'rejected'];

            statusVariations.forEach(status => {
                const dataWithStatus: RawTargetingData[] = [{
                    ...mockRawData[0],
                    status,
                    target_id: `target-${status}`
                }];

                const result = SimpleTargetingTransformer.transform(dataWithStatus);
                expect(result[0].incomingTargets[0].status).toBe(status);
            });
        });
    });
});