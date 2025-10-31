import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapProposalService } from '../../services/swap/SwapProposalService';

describe('Proposer Name Resolution Integration Tests', () => {
    let mockPool: Pool;
    let swapRepository: SwapRepository;
    let swapProposalService: SwapProposalService;

    beforeEach(() => {
        mockPool = {
            query: vi.fn(),
            connect: vi.fn(),
        } as any;

        swapRepository = new SwapRepository(mockPool);

        // Mock all dependencies for SwapProposalService
        const mockSwapTargetingRepository = {
            findActiveTargetsByUserId: vi.fn().mockResolvedValue([]),
            createTarget: vi.fn(),
        } as any;

        const mockAuctionRepository = {
            findActiveAuctionsByUserId: vi.fn().mockResolvedValue([]),
        } as any;

        const mockBookingService = {
            getBookingById: vi.fn().mockResolvedValue({
                id: 'booking-123',
                title: 'Test Booking',
                city: 'Test City',
                country: 'Test Country'
            }),
        } as any;

        const mockHederaService = {
            submitTransaction: vi.fn(),
        } as any;

        const mockNotificationService = {
            sendNotification: vi.fn(),
        } as any;

        swapProposalService = new SwapProposalService(
            swapRepository,
            mockSwapTargetingRepository,
            mockAuctionRepository,
            mockBookingService,
            mockHederaService,
            mockNotificationService,
            {} as any, // auctionNotificationService
            {} as any, // paymentNotificationService
            {} as any, // timingNotificationService
            {} as any, // auctionManagementService
            {} as any  // paymentProcessingService
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Complete Data Flow Scenarios', () => {
        it('should handle complete successful data flow with valid proposer names', async () => {
            // Requirements: 1.1, 1.4, 2.4
            const mockSwapCardsData = [
                {
                    swap_id: 'swap-1',
                    owner_id: 'user-456',
                    proposer_id: 'user-123',
                    proposer_name: 'Alice Johnson',
                    proposer_email: 'alice@example.com',
                    user_booking_id: 'booking-456',
                    user_booking_title: 'Paris Hotel',
                    user_booking_city: 'Paris',
                    user_booking_country: 'France',
                    user_booking_check_in: '2024-06-01',
                    user_booking_check_out: '2024-06-05',
                    user_booking_original_price: '200.00',
                    user_booking_swap_value: '180.00',
                    proposer_booking_id_full: 'booking-123',
                    proposer_booking_title: 'London Hotel',
                    proposer_booking_city: 'London',
                    proposer_booking_country: 'UK',
                    proposer_booking_check_in: '2024-06-01',
                    proposer_booking_check_out: '2024-06-05',
                    proposer_booking_original_price: '150.00',
                    proposer_booking_swap_value: '140.00',
                    swap_status: 'pending',
                    swap_created_at: new Date('2024-01-01'),
                    proposal_additional_payment: '20.00',
                    proposal_conditions: JSON.stringify(['No smoking']),
                    join_chain_status: 'complete'
                }
            ];

            // Mock repository method
            vi.spyOn(swapRepository, 'findSwapCardsWithProposals')
                .mockResolvedValue(mockSwapCardsData);

            const result = await swapProposalService.getSwapCardsWithProposals('user-456', 10, 0);

            expect(result.swapCards).toHaveLength(1);
            expect(result.swapCards[0].proposalsFromOthers).toHaveLength(1);
            expect(result.swapCards[0].proposalsFromOthers[0].proposerName).toBe('Alice Johnson');
            expect(result.swapCards[0].proposalCount).toBe(1);
        });

        it('should handle self-proposal filtering in complete data flow', async () => {
            // Requirements: 1.1
            const mockSwapCardsData = [
                // Valid proposal from another user
                {
                    swap_id: 'swap-1',
                    owner_id: 'user-456',
                    proposer_id: 'user-123',
                    proposer_name: 'Alice Johnson',
                    user_booking_id: 'booking-456',
                    proposer_booking_id_full: 'booking-123',
                    swap_status: 'pending',
                    swap_created_at: new Date('2024-01-01'),
                    join_chain_status: 'complete'
                },
                // Self-proposal (should be filtered out)
                {
                    swap_id: 'swap-1',
                    owner_id: 'user-456',
                    proposer_id: 'user-456', // Same as owner
                    proposer_name: 'User 456',
                    user_booking_id: 'booking-456',
                    proposer_booking_id_full: 'booking-456',
                    swap_status: 'pending',
                    swap_created_at: new Date('2024-01-01'),
                    join_chain_status: 'complete'
                }
            ];

            vi.spyOn(swapRepository, 'findSwapCardsWithProposals')
                .mockResolvedValue(mockSwapCardsData);

            const result = await swapProposalService.getSwapCardsWithProposals('user-456', 10, 0);

            expect(result.swapCards).toHaveLength(1);
            expect(result.swapCards[0].proposalsFromOthers).toHaveLength(1);
            expect(result.swapCards[0].proposalsFromOthers[0].proposerId).toBe('user-123');
            expect(result.swapCards[0].proposalsFromOthers[0].proposerName).toBe('Alice Johnson');
        });

        it('should handle database errors gracefully in complete data flow', async () => {
            // Requirements: 2.1, 2.2
            vi.spyOn(swapRepository, 'findSwapCardsWithProposals')
                .mockRejectedValue(new Error('Database connection timeout'));

            await expect(swapProposalService.getSwapCardsWithProposals('user-456', 10, 0))
                .rejects.toThrow('Database connection timeout');
        });

        it('should handle empty result set in complete data flow', async () => {
            // Requirements: 1.1, 2.1
            vi.spyOn(swapRepository, 'findSwapCardsWithProposals')
                .mockResolvedValue([]);

            const result = await swapProposalService.getSwapCardsWithProposals('user-456', 10, 0);

            expect(result.swapCards).toHaveLength(0);
            expect(result.totalCount).toBe(0);
        });

        it('should handle concurrent proposer name resolution requests', async () => {
            // Requirements: 1.1, 2.1, 2.2
            const mockSwapCardsData = [
                {
                    swap_id: 'swap-1',
                    owner_id: 'user-456',
                    proposer_id: 'user-123',
                    proposer_name: 'Alice Johnson',
                    user_booking_id: 'booking-456',
                    proposer_booking_id_full: 'booking-123',
                    swap_status: 'pending',
                    swap_created_at: new Date('2024-01-01'),
                    join_chain_status: 'complete'
                }
            ];

            vi.spyOn(swapRepository, 'findSwapCardsWithProposals')
                .mockResolvedValue(mockSwapCardsData);

            // Make multiple concurrent requests
            const promises = Array.from({ length: 3 }, () =>
                swapProposalService.getSwapCardsWithProposals('user-456', 10, 0)
            );

            const results = await Promise.all(promises);

            // All requests should succeed with consistent results
            results.forEach(result => {
                expect(result.swapCards).toHaveLength(1);
                expect(result.swapCards[0].proposalsFromOthers[0].proposerName).toBe('Alice Johnson');
            });
        });
    });
});