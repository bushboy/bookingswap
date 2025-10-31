import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProposalAcceptanceService } from '../ProposalAcceptanceService';
import { PaymentProcessingService } from '../../payment/PaymentProcessingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { BookingService } from '../../booking/BookingService';
import { EnhancedProposalRepository } from '../../../database/repositories/EnhancedProposalRepository';
import { ProposalTransactionManager } from '../ProposalTransactionManager';
import { SwapProposal } from '@booking-swap/shared';

describe('ProposalAcceptanceService', () => {
    let service: ProposalAcceptanceService;
    let mockPaymentService: PaymentProcessingService;
    let mockHederaService: HederaService;
    let mockNotificationService: NotificationService;
    let mockSwapRepository: SwapRepository;
    let mockBookingService: BookingService;
    let mockEnhancedProposalRepository: EnhancedProposalRepository;
    let mockTransactionManager: ProposalTransactionManager;

    beforeEach(() => {
        // Create mock services
        mockPaymentService = {
            processPayment: vi.fn(),
            releaseEscrow: vi.fn(),
        } as any;

        mockHederaService = {
            submitTransaction: vi.fn().mockResolvedValue({
                transactionId: 'tx-123',
                consensusTimestamp: '2023-01-01T00:00:00Z'
            }),
            recordProposalAcceptance: vi.fn().mockResolvedValue('tx-accept-123'),
            recordProposalRejection: vi.fn().mockResolvedValue('tx-reject-123'),
        } as any;

        mockNotificationService = {
            sendSwapResponseNotification: vi.fn(),
        } as any;

        mockSwapRepository = {
            findById: vi.fn(),
            create: vi.fn(),
            updateStatus: vi.fn(),
            updateTimeline: vi.fn(),
            updateBlockchainInfo: vi.fn(),
        } as any;

        mockBookingService = {
            getBookingById: vi.fn(),
        } as any;

        mockEnhancedProposalRepository = {
            findByProposalId: vi.fn(),
            getProposalByIdWithUserInfo: vi.fn(),
        } as any;

        mockTransactionManager = {
            pool: {
                query: vi.fn(),
            },
        } as any;

        service = new ProposalAcceptanceService(
            mockPaymentService,
            mockHederaService,
            mockNotificationService,
            mockSwapRepository,
            mockBookingService,
            mockTransactionManager,
            mockEnhancedProposalRepository
        );
    });

    describe('acceptProposal', () => {
        it('should successfully accept a booking proposal', async () => {
            // Mock proposal data
            const mockProposal: SwapProposal = {
                id: 'proposal-123',
                sourceSwapId: 'swap-123',
                targetSwapId: 'swap-456',
                proposerId: 'user-123',
                targetUserId: 'user-456',
                proposalType: 'booking',
                status: 'pending',
                conditions: [],
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Mock booking data
            const mockBooking = {
                id: 'booking-123',
                userId: 'user-456',
                status: 'available',
                title: 'Test Booking'
            };

            const mockSwap = {
                id: 'swap-456',
                sourceBookingId: 'booking-456',
                status: 'pending'
            };

            // Setup mocks
            vi.spyOn(service as any, 'getProposal').mockResolvedValue(mockProposal);
            mockSwapRepository.findById = vi.fn()
                .mockResolvedValueOnce(mockSwap) // For source swap validation
                .mockResolvedValueOnce(mockSwap) // For target swap validation
                .mockResolvedValueOnce(mockSwap) // For validateAcceptanceAuthorization
                .mockResolvedValueOnce(mockSwap) // For createSwapFromAcceptedProposal - source swap
                .mockResolvedValueOnce(mockSwap); // For createSwapFromAcceptedProposal - target swap
            mockBookingService.getBookingById = vi.fn().mockResolvedValue(mockBooking);
            mockSwapRepository.create = vi.fn().mockResolvedValue({
                id: 'new-swap-123',
                sourceBookingId: 'booking-123',
                status: 'accepted'
            });
            mockSwapRepository.updateStatus = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateTimeline = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateBlockchainInfo = vi.fn().mockResolvedValue(mockSwap);

            const request = {
                proposalId: 'proposal-123',
                userId: 'user-456',
                action: 'accept' as const
            };

            const result = await service.acceptProposal(request);

            expect(result).toBeDefined();
            expect(result.proposal.status).toBe('accepted');
            expect(result.blockchainTransaction.transactionId).toBe('tx-accept-123');
            expect(mockHederaService.recordProposalAcceptance).toHaveBeenCalledWith(
                'proposal-123',
                'user-456',
                expect.any(Date)
            );
        });

        it('should throw error for non-existent proposal', async () => {
            vi.spyOn(service as any, 'getProposal').mockResolvedValue(null);

            const request = {
                proposalId: 'non-existent',
                userId: 'user-456',
                action: 'accept' as const
            };

            await expect(service.acceptProposal(request)).rejects.toThrow('Proposal not found');
        });

        it('should throw error for unauthorized user', async () => {
            const mockProposal: SwapProposal = {
                id: 'proposal-123',
                sourceSwapId: 'swap-123',
                targetSwapId: 'swap-456',
                proposerId: 'user-123',
                targetUserId: 'user-456',
                proposalType: 'booking',
                status: 'pending',
                conditions: [],
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            vi.spyOn(service as any, 'getProposal').mockResolvedValue(mockProposal);

            const request = {
                proposalId: 'proposal-123',
                userId: 'unauthorized-user',
                action: 'accept' as const
            };

            await expect(service.acceptProposal(request)).rejects.toThrow('not authorized');
        });
    });

    describe('rejectProposal', () => {
        it('should successfully reject a proposal with reason', async () => {
            const mockProposal: SwapProposal = {
                id: 'proposal-123',
                sourceSwapId: 'swap-123',
                targetSwapId: 'swap-456',
                proposerId: 'user-123',
                targetUserId: 'user-456',
                proposalType: 'booking',
                status: 'pending',
                conditions: [],
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const mockBooking = {
                id: 'booking-123',
                userId: 'user-456',
                status: 'available',
                title: 'Test Booking'
            };

            const mockSwap = {
                id: 'swap-456',
                sourceBookingId: 'booking-456',
                status: 'pending'
            };

            vi.spyOn(service as any, 'getProposal').mockResolvedValue(mockProposal);
            mockBookingService.getBookingById = vi.fn().mockResolvedValue(mockBooking);
            mockSwapRepository.findById = vi.fn()
                .mockResolvedValueOnce(mockSwap) // For source swap validation
                .mockResolvedValueOnce(mockSwap); // For target swap validation
            mockSwapRepository.updateStatus = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateTimeline = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateBlockchainInfo = vi.fn().mockResolvedValue(mockSwap);

            const request = {
                proposalId: 'proposal-123',
                userId: 'user-456',
                action: 'reject' as const,
                rejectionReason: 'Not interested'
            };

            const result = await service.rejectProposal(request);

            expect(result).toBeDefined();
            expect(result.proposal.status).toBe('rejected');
            expect(result.proposal.rejectionReason).toBe('Not interested');
            expect(result.blockchainTransaction.transactionId).toBe('tx-reject-123');
            expect(mockHederaService.recordProposalRejection).toHaveBeenCalledWith(
                'proposal-123',
                'user-456',
                expect.any(Date),
                'Not interested'
            );
        });
    });

    describe('blockchain transaction retry logic', () => {
        it('should retry blockchain transaction with exponential backoff on failure', async () => {
            const mockProposal: SwapProposal = {
                id: 'proposal-123',
                sourceSwapId: 'swap-123',
                targetSwapId: 'swap-456',
                proposerId: 'user-123',
                targetUserId: 'user-456',
                proposalType: 'booking',
                status: 'pending',
                conditions: [],
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const mockBooking = {
                id: 'booking-123',
                userId: 'user-456',
                status: 'available',
                title: 'Test Booking'
            };

            const mockSwap = {
                id: 'swap-456',
                sourceBookingId: 'booking-456',
                status: 'pending'
            };

            vi.spyOn(service as any, 'getProposal').mockResolvedValue(mockProposal);
            mockBookingService.getBookingById = vi.fn().mockResolvedValue(mockBooking);
            mockSwapRepository.findById = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.create = vi.fn().mockResolvedValue({
                id: 'new-swap-123',
                sourceBookingId: 'booking-123',
                status: 'accepted'
            });
            mockSwapRepository.updateStatus = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateTimeline = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateBlockchainInfo = vi.fn().mockResolvedValue(mockSwap);

            // Mock blockchain service to fail twice, then succeed
            mockHederaService.recordProposalAcceptance = vi.fn()
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce('tx-accept-123');

            // Mock sleep to avoid actual delays in tests
            vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

            const request = {
                proposalId: 'proposal-123',
                userId: 'user-456',
                action: 'accept' as const
            };

            const result = await service.acceptProposal(request);

            expect(result).toBeDefined();
            expect(result.blockchainTransaction.transactionId).toBe('tx-accept-123');
            expect(mockHederaService.recordProposalAcceptance).toHaveBeenCalledTimes(3);
            expect((service as any).sleep).toHaveBeenCalledTimes(2); // Called for first two failures
        });

        it('should fail after maximum retries', async () => {
            const mockProposal: SwapProposal = {
                id: 'proposal-123',
                sourceSwapId: 'swap-123',
                targetSwapId: 'swap-456',
                proposerId: 'user-123',
                targetUserId: 'user-456',
                proposalType: 'booking',
                status: 'pending',
                conditions: [],
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const mockBooking = {
                id: 'booking-123',
                userId: 'user-456',
                status: 'available',
                title: 'Test Booking'
            };

            const mockSwap = {
                id: 'swap-456',
                sourceBookingId: 'booking-456',
                status: 'pending'
            };

            vi.spyOn(service as any, 'getProposal').mockResolvedValue(mockProposal);
            mockBookingService.getBookingById = vi.fn().mockResolvedValue(mockBooking);
            mockSwapRepository.findById = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.create = vi.fn().mockResolvedValue({
                id: 'new-swap-123',
                sourceBookingId: 'booking-123',
                status: 'accepted'
            });
            mockSwapRepository.updateStatus = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateTimeline = vi.fn().mockResolvedValue(mockSwap);
            mockSwapRepository.updateBlockchainInfo = vi.fn().mockResolvedValue(mockSwap);

            // Mock blockchain service to always fail
            mockHederaService.recordProposalAcceptance = vi.fn()
                .mockRejectedValue(new Error('Persistent network error'));

            // Mock sleep to avoid actual delays in tests
            vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);

            const request = {
                proposalId: 'proposal-123',
                userId: 'user-456',
                action: 'accept' as const
            };

            await expect(service.acceptProposal(request)).rejects.toThrow('Blockchain transaction failed after 3 attempts');
            expect(mockHederaService.recordProposalAcceptance).toHaveBeenCalledTimes(3);
        });
    });
});