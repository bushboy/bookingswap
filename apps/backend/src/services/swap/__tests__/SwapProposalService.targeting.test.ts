import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwapProposalService } from '../SwapProposalService';
import { TargetingDataTransformer } from '../TargetingDataTransformer';

// Mock dependencies
const mockSwapRepository = {
    findById: vi.fn(),
    create: vi.fn(),
    updateBlockchainInfo: vi.fn(),
    findByUserId: vi.fn(),
    findSwapCardsWithProposals: vi.fn(),
    findByUserIdWithBookingDetails: vi.fn(),
    findPendingProposalBetweenBookings: vi.fn(),
    delete: vi.fn(),
};

const mockSwapTargetingRepository = {
    getTargetingDataForUserSwaps: vi.fn(),
    createTarget: vi.fn(),
};

const mockBookingService = {
    getBookingById: vi.fn(),
    lockBooking: vi.fn(),
    unlockBooking: vi.fn(),
};

const mockHederaService = {
    submitTransaction: vi.fn(),
};

const mockNotificationService = {
    sendSwapProposalNotification: vi.fn(),
};

const mockAuctionNotificationService = {
    sendAuctionCreated: vi.fn(),
};

const mockPaymentNotificationService = {
    sendPaymentRequired: vi.fn(),
};

const mockTimingNotificationService = {
    sendLastMinuteBookingRestriction: vi.fn(),
};

const mockAuctionService = {
    createAuction: vi.fn(),
};

const mockPaymentService = {
    processPayment: vi.fn(),
};

const mockAuctionRepository = {
    create: vi.fn(),
    findById: vi.fn(),
};

describe('SwapProposalService - Targeting Integration', () => {
    let swapProposalService: SwapProposalService;

    beforeEach(() => {
        vi.clearAllMocks();

        swapProposalService = new SwapProposalService(
            mockSwapRepository as any,
            mockSwapTargetingRepository as any,
            mockAuctionRepository as any,
            mockBookingService as any,
            mockHederaService as any,
            mockNotificationService as any,
            mockAuctionNotificationService as any,
            mockPaymentNotificationService as any,
            mockTimingNotificationService as any,
            mockAuctionService as any,
            mockPaymentService as any
        );
    });

    describe('getUserSwapsWithTargeting', () => {
        it('should successfully integrate with TargetingDataTransformer', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockSwapCards = [
                {
                    userSwap: {
                        id: 'swap-1',
                        bookingDetails: {
                            id: 'booking-1',
                            title: 'Test Booking',
                            location: { city: 'Paris', country: 'France' },
                            dateRange: { checkIn: new Date(), checkOut: new Date() },
                            originalPrice: 100,
                            swapValue: 100
                        },
                        status: 'pending' as const,
                        createdAt: new Date(),
                    },
                    proposalsFromOthers: [],
                    proposalCount: 0
                }
            ];

            const mockTargetingData = {
                incomingTargets: [
                    {
                        targetId: 'target-1',
                        targetSwapId: 'swap-1',
                        sourceSwapId: 'swap-2',
                        sourceSwapDetails: {
                            bookingTitle: 'Source Booking',
                            bookingLocation: 'London, UK',
                            bookingCheckIn: new Date(),
                            bookingCheckOut: new Date(),
                            bookingPrice: 150,
                            ownerName: 'John Doe',
                            ownerEmail: 'john@example.com'
                        },
                        proposalId: 'proposal-1',
                        status: 'active' as const,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ],
                outgoingTargets: []
            };

            // Mock the dependencies
            mockSwapRepository.findSwapCardsWithProposals.mockResolvedValue([
                {
                    swap_id: 'swap-1',
                    swap_status: 'pending',
                    swap_created_at: new Date(),
                    user_booking_id: 'booking-1',
                    user_booking_title: 'Test Booking',
                    user_booking_city: 'Paris',
                    user_booking_country: 'France',
                    user_booking_check_in: new Date(),
                    user_booking_check_out: new Date(),
                    user_booking_original_price: 100,
                    proposal_id: null,
                    proposer_id: null,
                    proposer_name: null,
                    proposal_booking_id: null,
                    proposal_booking_title: null,
                    proposal_booking_city: null,
                    proposal_booking_country: null,
                    proposal_booking_check_in: null,
                    proposal_booking_check_out: null,
                    proposal_booking_original_price: null,
                    proposal_status: null,
                    proposal_created_at: null,
                    proposal_additional_payment: null,
                    proposal_conditions: null,
                    proposal_expires_at: null
                }
            ]);

            mockSwapTargetingRepository.getTargetingDataForUserSwaps.mockResolvedValue(mockTargetingData);
            mockSwapRepository.findById.mockResolvedValue({
                id: 'swap-1',
                status: 'pending',
                terms: { expiresAt: new Date(Date.now() + 86400000) }
            });

            // Act
            const result = await swapProposalService.getUserSwapsWithTargeting(userId);

            // Assert
            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result[0].targeting).toBeDefined();
            expect(result[0].targeting.incomingTargets).toBeDefined();
            expect(result[0].targeting.incomingTargetCount).toBe(1);
            expect(result[0].targeting.outgoingTarget).toBeUndefined();
            expect(result[0].targeting.canReceiveTargets).toBe(true);
            expect(result[0].targeting.canTarget).toBe(true);

            // Verify that the targeting repository was called
            expect(mockSwapTargetingRepository.getTargetingDataForUserSwaps).toHaveBeenCalledWith(userId);
        });

        it('should handle targeting data fetch failure gracefully', async () => {
            // Arrange
            const userId = 'test-user-id';
            const mockSwapCards = [
                {
                    userSwap: {
                        id: 'swap-1',
                        bookingDetails: {
                            id: 'booking-1',
                            title: 'Test Booking',
                            location: { city: 'Paris', country: 'France' },
                            dateRange: { checkIn: new Date(), checkOut: new Date() },
                            originalPrice: 100,
                            swapValue: 100
                        },
                        status: 'pending' as const,
                        createdAt: new Date(),
                    },
                    proposalsFromOthers: [],
                    proposalCount: 0
                }
            ];

            // Mock the dependencies
            mockSwapRepository.findSwapCardsWithProposals.mockResolvedValue([
                {
                    swap_id: 'swap-1',
                    swap_status: 'pending',
                    swap_created_at: new Date(),
                    user_booking_id: 'booking-1',
                    user_booking_title: 'Test Booking',
                    user_booking_city: 'Paris',
                    user_booking_country: 'France',
                    user_booking_check_in: new Date(),
                    user_booking_check_out: new Date(),
                    user_booking_original_price: 100,
                    proposal_id: null,
                    proposer_id: null,
                    proposer_name: null,
                    proposal_booking_id: null,
                    proposal_booking_title: null,
                    proposal_booking_city: null,
                    proposal_booking_country: null,
                    proposal_booking_check_in: null,
                    proposal_booking_check_out: null,
                    proposal_booking_original_price: null,
                    proposal_status: null,
                    proposal_created_at: null,
                    proposal_additional_payment: null,
                    proposal_conditions: null,
                    proposal_expires_at: null
                }
            ]);

            // Mock targeting data fetch to fail
            mockSwapTargetingRepository.getTargetingDataForUserSwaps.mockRejectedValue(new Error('Database connection failed'));

            // Act
            const result = await swapProposalService.getUserSwapsWithTargeting(userId);

            // Assert - should fallback to basic swap cards
            expect(result).toBeDefined();
            expect(result).toHaveLength(1);
            expect(result[0].targeting).toBeDefined();
            expect(result[0].targeting.incomingTargets).toEqual([]);
            expect(result[0].targeting.incomingTargetCount).toBe(0);
            expect(result[0].targeting.outgoingTarget).toBeUndefined();
            expect(result[0].targeting.targetingRestrictions).toBeDefined();
            expect(result[0].targeting.targetingRestrictions![0].type).toBe('swap_unavailable');
        });

        it('should validate transformed targeting data consistency', async () => {
            // Arrange
            const mockQueryResults = [
                {
                    direction: 'incoming' as const,
                    target_id: 'target-1',
                    target_swap_id: 'swap-1',
                    source_swap_id: 'swap-2',
                    proposal_id: 'proposal-1',
                    status: 'active' as const,
                    created_at: new Date(),
                    updated_at: new Date(),
                    booking_title: 'Test Booking',
                    booking_city: 'Paris',
                    booking_country: 'France',
                    check_in: new Date(),
                    check_out: new Date(),
                    price: 100,
                    owner_name: 'John Doe',
                    owner_email: 'john@example.com',
                    data_source: 'swap_targets' as const
                }
            ];

            // Act
            const transformedData = TargetingDataTransformer.transformBidirectionalData(mockQueryResults);
            const validationResult = TargetingDataTransformer.validateTargetingConsistency(transformedData);

            // Assert
            expect(transformedData).toHaveLength(1);
            expect(transformedData[0].swapId).toBe('swap-1');
            expect(transformedData[0].incomingCount).toBe(1);
            expect(transformedData[0].outgoingCount).toBe(0);
            expect(transformedData[0].hasTargeting).toBe(true);
            expect(validationResult.isValid).toBe(true);
            expect(validationResult.issues).toHaveLength(0);
        });
    });
});