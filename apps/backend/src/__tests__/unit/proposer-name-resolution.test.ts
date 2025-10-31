import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapProposalService } from '../../services/swap/SwapProposalService';

describe('Proposer Name Resolution Tests', () => {
    let mockPool: Pool;
    let swapRepository: SwapRepository;
    let swapProposalService: SwapProposalService;

    beforeEach(() => {
        mockPool = {
            query: vi.fn(),
            connect: vi.fn(),
        } as any;

        swapRepository = new SwapRepository(mockPool);

        // Mock dependencies for SwapProposalService
        const mockSwapTargetingRepository = {
            findActiveTargetsByUserId: vi.fn(),
            createTarget: vi.fn(),
        } as any;

        const mockAuctionRepository = {
            findActiveAuctionsByUserId: vi.fn(),
        } as any;

        const mockBookingService = {
            getBookingById: vi.fn(),
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

    describe('JOIN Chain Validation', () => {
        it('should detect complete JOIN chain with valid proposer data', async () => {
            // Requirements: 2.1, 2.2
            const mockRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: 'John Doe',
                    proposer_email: 'john@example.com',
                    join_chain_status: 'complete',
                    swap_target_id: 'target-1',
                    target_swap_id: 'swap-2',
                    proposer_user_id: 'user-123',
                    user_record_id: 'user-123'
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(result).toHaveLength(1);
            expect(result[0].proposer_name).toBe('John Doe');
            expect(result[0].join_chain_status).toBe('complete');
        });

        it('should detect broken JOIN chain at swap_targets level', async () => {
            // Requirements: 2.1, 2.3
            const mockRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: null,
                    proposer_name: null,
                    join_chain_status: 'no_swap_target',
                    swap_target_id: null,
                    target_swap_id: null,
                    proposer_user_id: null,
                    user_record_id: null
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(result).toHaveLength(1);
            expect(result[0].join_chain_status).toBe('no_swap_target');
            expect(result[0].proposer_name).toBeNull();
        });

        it('should detect broken JOIN chain at user level', async () => {
            // Requirements: 2.1, 2.3
            const mockRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: null,
                    join_chain_status: 'missing_user',
                    swap_target_id: 'target-1',
                    target_swap_id: 'swap-2',
                    proposer_user_id: 'user-123',
                    user_record_id: null
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(result).toHaveLength(1);
            expect(result[0].join_chain_status).toBe('missing_user');
            expect(result[0].proposer_name).toBeNull();
        });
    });

    describe('Proposer Data Validation', () => {
        it('should validate complete proposer data', () => {
            // Requirements: 1.1, 1.2
            const validRow = {
                source_swap_id: 'swap-123',
                proposer_id: 'user-456',
                proposer_name: 'Jane Smith',
                proposer_email: 'jane@example.com'
            };

            const service = swapProposalService as any;
            const validation = service.validateProposerData(validRow);

            expect(validation.isValid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should detect missing proposer_name', () => {
            // Requirements: 1.1, 1.2
            const invalidRow = {
                source_swap_id: 'swap-123',
                proposer_id: 'user-456',
                proposer_name: null,
                proposer_email: 'jane@example.com'
            };

            const service = swapProposalService as any;
            const validation = service.validateProposerData(invalidRow);

            expect(validation.isValid).toBe(false);
            expect(validation.issues).toContain('proposer_name is null or empty');
        });

        it('should detect empty proposer_name', () => {
            // Requirements: 1.1, 1.2
            const invalidRow = {
                source_swap_id: 'swap-123',
                proposer_id: 'user-456',
                proposer_name: '',
                proposer_email: 'jane@example.com'
            };

            const service = swapProposalService as any;
            const validation = service.validateProposerData(invalidRow);

            expect(validation.isValid).toBe(false);
            expect(validation.issues).toContain('proposer_name is null or empty');
        });
    });

    describe('Fallback Mechanisms', () => {
        it('should handle proposer data enrichment when JOIN fails', async () => {
            // Requirements: 1.2, 2.4
            const mockRowsWithMissingData = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: null, // Missing from JOIN
                    join_chain_status: 'missing_user'
                }
            ];

            const mockEnrichedRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: 'Enriched User Name', // Enriched via fallback
                    join_chain_status: 'missing_user',
                    enrichment_applied: true,
                    lookup_method: 'direct'
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRowsWithMissingData });

            // Mock the enrichment method
            const enrichSpy = vi.spyOn(swapRepository as any, 'enrichSwapCardsWithProposerDataMonitored')
                .mockResolvedValue(mockEnrichedRows);

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(enrichSpy).toHaveBeenCalledWith(mockRowsWithMissingData);
            expect(result).toHaveLength(1);
            expect(result[0].proposer_name).toBe('Enriched User Name');
            expect(result[0].enrichment_applied).toBe(true);
        });

        it('should handle fallback failure gracefully', async () => {
            // Requirements: 1.4, 2.4
            const mockRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: null
                }
            ];

            const mockEnrichedRows = [
                {
                    ...mockRows[0],
                    proposer_name: 'Unknown User', // Fallback when enrichment fails
                    lookup_method: 'fallback',
                    enrichment_failed: true
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            const enrichSpy = vi.spyOn(swapRepository as any, 'enrichSwapCardsWithProposerDataMonitored')
                .mockResolvedValue(mockEnrichedRows);

            const result = await swapRepository.findSwapCardsWithProposals('user-789');

            expect(result).toHaveLength(1);
            expect(result[0].proposer_name).toBe('Unknown User');
            expect(result[0].lookup_method).toBe('fallback');
            expect(result[0].enrichment_failed).toBe(true);
        });
    });

    describe('Edge Cases with Missing/Corrupted Data', () => {
        it('should handle completely null row data', async () => {
            // Requirements: 1.1, 1.2
            const mockRows = [
                {
                    swap_id: null,
                    proposer_id: null,
                    proposer_name: null,
                    proposer_email: null,
                    join_chain_status: null
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(result).toHaveLength(1);
            expect(result[0].proposer_name).toBeNull();
        });

        it('should handle database connection errors', async () => {
            // Requirements: 2.1, 2.2
            mockPool.query = vi.fn().mockRejectedValue(new Error('Database connection failed'));

            await expect(swapRepository.findSwapCardsWithProposals('user-456'))
                .rejects.toThrow('Database connection failed');
        });

        it('should handle mixed valid and invalid data in same result set', async () => {
            // Requirements: 1.1, 1.2, 2.1, 2.2
            const mockRows = [
                {
                    swap_id: 'swap-1',
                    proposer_id: 'user-123',
                    proposer_name: 'Valid User',
                    join_chain_status: 'complete'
                },
                {
                    swap_id: 'swap-2',
                    proposer_id: null,
                    proposer_name: null,
                    join_chain_status: 'missing_user'
                }
            ];

            const mockEnrichedRows = [
                mockRows[0], // Valid data unchanged
                {
                    ...mockRows[1],
                    proposer_name: 'Enriched User',
                    lookup_method: 'direct'
                }
            ];

            mockPool.query = vi.fn().mockResolvedValue({ rows: mockRows });

            vi.spyOn(swapRepository as any, 'enrichSwapCardsWithProposerDataMonitored')
                .mockResolvedValue(mockEnrichedRows);

            const result = await swapRepository.findSwapCardsWithProposals('user-456');

            expect(result).toHaveLength(2);
            expect(result[0].proposer_name).toBe('Valid User');
            expect(result[1].proposer_name).toBe('Enriched User');
        });
    });
});