import { describe, it, expect } from 'vitest';
import {
    TargetingDataTransformer,
    BidirectionalQueryResult,
    TargetingDisplayData
} from '../TargetingDataTransformer';
import { SwapTargetStatus } from '@booking-swap/shared';

describe('TargetingDataTransformer', () => {

    describe('transformBidirectionalData', () => {
        it('should properly transform both incoming and outgoing targets', () => {
            const mockQueryResults: BidirectionalQueryResult[] = [
                {
                    direction: 'incoming',
                    target_id: 'target1',
                    target_swap_id: 'swap1',
                    source_swap_id: 'swap2',
                    proposal_id: 'proposal1',
                    status: 'active' as SwapTargetStatus,
                    created_at: new Date('2024-01-01'),
                    updated_at: new Date('2024-01-01'),
                    booking_title: 'Paris Apartment',
                    booking_city: 'Paris',
                    booking_country: 'France',
                    check_in: new Date('2024-02-01'),
                    check_out: new Date('2024-02-07'),
                    price: 500,
                    owner_name: 'John Doe',
                    owner_email: 'john@example.com',
                    data_source: 'swap_targets'
                },
                {
                    direction: 'outgoing',
                    target_id: 'target2',
                    target_swap_id: 'swap3',
                    source_swap_id: 'swap1',
                    proposal_id: 'proposal2',
                    status: 'active' as SwapTargetStatus,
                    created_at: new Date('2024-01-02'),
                    updated_at: new Date('2024-01-02'),
                    booking_title: 'Rome Villa',
                    booking_city: 'Rome',
                    booking_country: 'Italy',
                    check_in: new Date('2024-03-01'),
                    check_out: new Date('2024-03-07'),
                    price: 700,
                    owner_name: 'Jane Smith',
                    owner_email: 'jane@example.com',
                    data_source: 'swap_targets'
                }
            ];

            const result = TargetingDataTransformer.transformBidirectionalData(mockQueryResults);

            expect(result).toHaveLength(1);
            expect(result[0].swapId).toBe('swap1');
            expect(result[0].incomingCount).toBe(1);
            expect(result[0].outgoingCount).toBe(1);
            expect(result[0].hasTargeting).toBe(true);

            // Check incoming target details
            expect(result[0].incomingTargets[0].targetId).toBe('target1');
            expect(result[0].incomingTargets[0].sourceSwapDetails.bookingTitle).toBe('Paris Apartment');
            expect(result[0].incomingTargets[0].displayLabel).toContain('John Doe');
            expect(result[0].incomingTargets[0].displayLabel).toContain('targeting your swap');

            // Check outgoing target details
            expect(result[0].outgoingTargets[0].targetId).toBe('target2');
            expect(result[0].outgoingTargets[0].targetSwapDetails.bookingTitle).toBe('Rome Villa');
            expect(result[0].outgoingTargets[0].displayLabel).toContain('Jane Smith');
            expect(result[0].outgoingTargets[0].displayLabel).toContain('Your swap is targeting');
        });

        it('should handle empty query results gracefully', () => {
            const result = TargetingDataTransformer.transformBidirectionalData([]);

            expect(result).toHaveLength(0);
        });

        it('should group multiple targets by swap ID', () => {
            const mockQueryResults: BidirectionalQueryResult[] = [
                {
                    direction: 'incoming',
                    target_id: 'target1',
                    target_swap_id: 'swap1',
                    source_swap_id: 'swap2',
                    proposal_id: 'proposal1',
                    status: 'active' as SwapTargetStatus,
                    created_at: new Date('2024-01-01'),
                    updated_at: new Date('2024-01-01'),
                    booking_title: 'Paris Apartment',
                    booking_city: 'Paris',
                    booking_country: 'France',
                    check_in: new Date('2024-02-01'),
                    check_out: new Date('2024-02-07'),
                    price: 500,
                    owner_name: 'John Doe',
                    owner_email: 'john@example.com',
                    data_source: 'swap_targets'
                },
                {
                    direction: 'incoming',
                    target_id: 'target2',
                    target_swap_id: 'swap1',
                    source_swap_id: 'swap3',
                    proposal_id: 'proposal2',
                    status: 'active' as SwapTargetStatus,
                    created_at: new Date('2024-01-02'),
                    updated_at: new Date('2024-01-02'),
                    booking_title: 'London House',
                    booking_city: 'London',
                    booking_country: 'UK',
                    check_in: new Date('2024-03-01'),
                    check_out: new Date('2024-03-07'),
                    price: 600,
                    owner_name: 'Jane Smith',
                    owner_email: 'jane@example.com',
                    data_source: 'swap_targets'
                }
            ];

            const result = TargetingDataTransformer.transformBidirectionalData(mockQueryResults);

            expect(result).toHaveLength(1);
            expect(result[0].swapId).toBe('swap1');
            expect(result[0].incomingCount).toBe(2);
            expect(result[0].outgoingCount).toBe(0);
            expect(result[0].incomingTargets).toHaveLength(2);
        });
    });

    describe('generateTargetingIndicators', () => {
        it('should generate appropriate visual indicators', () => {
            const targetingData: TargetingDisplayData = {
                swapId: 'swap1',
                incomingTargets: [],
                incomingCount: 2,
                outgoingTargets: [],
                outgoingCount: 1,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            };

            const indicators = TargetingDataTransformer.generateTargetingIndicators(targetingData);

            expect(indicators).toHaveLength(3); // incoming, outgoing, bidirectional

            const incomingIndicator = indicators.find(i => i.type === 'incoming');
            expect(incomingIndicator).toBeDefined();
            expect(incomingIndicator?.count).toBe(2);
            expect(incomingIndicator?.tooltip).toContain('2 swaps targeting this');

            const outgoingIndicator = indicators.find(i => i.type === 'outgoing');
            expect(outgoingIndicator).toBeDefined();
            expect(outgoingIndicator?.count).toBe(1);
            expect(outgoingIndicator?.tooltip).toContain('Targeting 1 other swap');

            const bidirectionalIndicator = indicators.find(i => i.type === 'bidirectional');
            expect(bidirectionalIndicator).toBeDefined();
            expect(bidirectionalIndicator?.count).toBe(3);
            expect(bidirectionalIndicator?.tooltip).toBe('Both targeting and being targeted');
        });

        it('should generate only incoming indicator when no outgoing targets', () => {
            const targetingData: TargetingDisplayData = {
                swapId: 'swap1',
                incomingTargets: [],
                incomingCount: 1,
                outgoingTargets: [],
                outgoingCount: 0,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            };

            const indicators = TargetingDataTransformer.generateTargetingIndicators(targetingData);

            expect(indicators).toHaveLength(1);
            expect(indicators[0].type).toBe('incoming');
            expect(indicators[0].count).toBe(1);
        });

        it('should generate only outgoing indicator when no incoming targets', () => {
            const targetingData: TargetingDisplayData = {
                swapId: 'swap1',
                incomingTargets: [],
                incomingCount: 0,
                outgoingTargets: [],
                outgoingCount: 1,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            };

            const indicators = TargetingDataTransformer.generateTargetingIndicators(targetingData);

            expect(indicators).toHaveLength(1);
            expect(indicators[0].type).toBe('outgoing');
            expect(indicators[0].count).toBe(1);
        });
    });

    describe('validateTargetingConsistency', () => {
        it('should validate consistent targeting data', () => {
            const targetingData: TargetingDisplayData[] = [{
                swapId: 'swap1',
                incomingTargets: [
                    {
                        targetId: 'target1',
                        sourceSwapId: 'swap2',
                        sourceSwapDetails: {
                            id: 'swap2',
                            bookingTitle: 'Paris Apartment',
                            bookingLocation: 'Paris, France',
                            checkIn: new Date(),
                            checkOut: new Date(),
                            price: 500,
                            ownerName: 'John Doe'
                        },
                        status: 'active' as SwapTargetStatus,
                        createdAt: new Date(),
                        displayLabel: 'Test',
                        statusIcon: 'clock',
                        statusColor: '#f59e0b',
                        actionable: true
                    }
                ],
                incomingCount: 1,
                outgoingTargets: [],
                outgoingCount: 0,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            }];

            const result = TargetingDataTransformer.validateTargetingConsistency(targetingData);

            expect(result.isValid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should detect count mismatch issues', () => {
            const targetingData: TargetingDisplayData[] = [{
                swapId: 'swap1',
                incomingTargets: [], // Empty array but count is 1
                incomingCount: 1,
                outgoingTargets: [],
                outgoingCount: 0,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            }];

            const result = TargetingDataTransformer.validateTargetingConsistency(targetingData);

            expect(result.isValid).toBe(false);
            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('missing_bidirectional');
            expect(result.issues[0].severity).toBe('medium');
        });
    });

    describe('convertToEnhancedSwapCardFormat', () => {
        it('should convert to enhanced swap card format', () => {
            const targetingData: TargetingDisplayData[] = [{
                swapId: 'swap1',
                incomingTargets: [
                    {
                        targetId: 'target1',
                        sourceSwapId: 'swap2',
                        sourceSwapDetails: {
                            id: 'swap2',
                            bookingTitle: 'Paris Apartment',
                            bookingLocation: 'Paris, France',
                            checkIn: new Date('2024-02-01'),
                            checkOut: new Date('2024-02-07'),
                            price: 500,
                            ownerName: 'John Doe'
                        },
                        status: 'active' as SwapTargetStatus,
                        createdAt: new Date(),
                        displayLabel: 'Test',
                        statusIcon: 'clock',
                        statusColor: '#f59e0b',
                        actionable: true
                    }
                ],
                incomingCount: 1,
                outgoingTargets: [],
                outgoingCount: 0,
                hasTargeting: true,
                displayMode: 'compact',
                indicators: []
            }];

            const result = TargetingDataTransformer.convertToEnhancedSwapCardFormat(targetingData);

            expect(result.has('swap1')).toBe(true);

            const swapData = result.get('swap1');
            expect(swapData?.incomingTargets).toHaveLength(1);
            expect(swapData?.incomingTargets[0].targetId).toBe('target1');
            expect(swapData?.incomingTargets[0].sourceSwap.bookingDetails.title).toBe('Paris Apartment');
            expect(swapData?.incomingTargets[0].sourceSwap.bookingDetails.location.city).toBe('Paris');
            expect(swapData?.incomingTargets[0].sourceSwap.bookingDetails.location.country).toBe('France');
            expect(swapData?.outgoingTarget).toBeUndefined();
        });
    });
});