import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SwapProposalService, CreateSwapProposalRequest } from '../SwapProposalService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { BookingService } from '../../booking/BookingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';
import { Booking, Swap, SwapStatus } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../booking/BookingService');
vi.mock('../../hedera/HederaService');
vi.mock('../../notification/NotificationService');
vi.mock('../../../utils/logger');

describe('SwapProposalService', () => {
  let swapProposalService: SwapProposalService;
  let mockSwapRepository: vi.Mocked<SwapRepository>;
  let mockBookingService: vi.Mocked<BookingService>;
  let mockHederaService: vi.Mocked<HederaService>;
  let mockNotificationService: vi.Mocked<NotificationService>;

  const mockSourceBooking: Booking = {
    id: 'source-booking-id',
    userId: 'proposer-user-id',
    type: 'hotel',
    title: 'Source Hotel Booking',
    description: 'A nice hotel in Paris',
    location: { city: 'Paris', country: 'France' },
    dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF123',
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { topicId: 'topic-123' },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTargetBooking: Booking = {
    id: 'target-booking-id',
    userId: 'owner-user-id',
    type: 'hotel',
    title: 'Target Hotel Booking',
    description: 'A nice hotel in London',
    location: { city: 'London', country: 'UK' },
    dateRange: { checkIn: new Date('2024-06-10'), checkOut: new Date('2024-06-15') },
    originalPrice: 600,
    swapValue: 550,
    providerDetails: {
      provider: 'expedia.com',
      confirmationNumber: 'XYZ789',
      bookingReference: 'REF789',
    },
    verification: { status: 'verified', documents: [] },
    blockchain: { topicId: 'topic-456' },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSwapRequest: CreateSwapProposalRequest = {
    sourceBookingId: 'source-booking-id',
    targetBookingId: 'target-booking-id',
    proposerId: 'proposer-user-id',
    terms: {
      additionalPayment: 100,
      conditions: ['Non-refundable', 'Same dates required'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSwapRepository = vi.mocked(new SwapRepository({} as any));
    mockBookingService = vi.mocked(new BookingService({} as any, {} as any, {} as any));
    mockHederaService = vi.mocked(new HederaService({} as any));
    mockNotificationService = vi.mocked(new NotificationService());

    swapProposalService = new SwapProposalService(
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService
    );
  });

  describe('createSwapProposal', () => {
    it('should create a swap proposal successfully', async () => {
      // Arrange
      const mockSwap: Swap = {
        id: 'swap-id',
        sourceBookingId: mockSwapRequest.sourceBookingId,
        targetBookingId: mockSwapRequest.targetBookingId,
        proposerId: mockSwapRequest.proposerId,
        ownerId: 'owner-user-id',
        status: 'pending',
        terms: mockSwapRequest.terms,
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockResolvedValueOnce({ ...mockTargetBooking, status: 'locked' });
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockSwapRepository.create.mockResolvedValue(mockSwap);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockSwapRepository.updateBlockchainInfo.mockResolvedValue(mockSwap);
      mockNotificationService.sendSwapProposalNotification.mockResolvedValue();

      // Act
      const result = await swapProposalService.createSwapProposal(mockSwapRequest);

      // Assert
      expect(result.swap).toEqual(mockSwap);
      expect(result.blockchainTransaction.transactionId).toBe('tx-123');
      expect(mockBookingService.lockBooking).toHaveBeenCalledTimes(2);
      expect(mockSwapRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceBookingId: mockSwapRequest.sourceBookingId,
          targetBookingId: mockSwapRequest.targetBookingId,
          proposerId: mockSwapRequest.proposerId,
          ownerId: 'owner-user-id',
          status: 'pending',
        })
      );
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal',
          payload: expect.objectContaining({
            sourceBookingId: mockSwapRequest.sourceBookingId,
            targetBookingId: mockSwapRequest.targetBookingId,
          }),
        })
      );
      expect(mockNotificationService.sendSwapProposalNotification).toHaveBeenCalled();
    });

    it('should throw error if source booking not found', async () => {
      // Arrange
      mockBookingService.getBookingById.mockResolvedValue(null);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Source booking not found');
    });

    it('should throw error if proposer does not own source booking', async () => {
      // Arrange
      const wrongOwnerBooking = { ...mockSourceBooking, userId: 'different-user-id' };
      mockBookingService.getBookingById.mockResolvedValue(wrongOwnerBooking);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Proposer does not own the source booking');
    });

    it('should throw error if source booking is not available', async () => {
      // Arrange
      const lockedBooking = { ...mockSourceBooking, status: 'locked' as const };
      mockBookingService.getBookingById.mockResolvedValue(lockedBooking);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Source booking is not available for swap (status: locked)');
    });

    it('should throw error if source booking is not verified', async () => {
      // Arrange
      const unverifiedBooking = {
        ...mockSourceBooking,
        verification: { status: 'pending' as const, documents: [] },
      };
      mockBookingService.getBookingById.mockResolvedValue(unverifiedBooking);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Source booking must be verified before proposing a swap');
    });

    it('should throw error if target booking not found', async () => {
      // Arrange
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(null);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Target booking not found');
    });

    it('should throw error if trying to swap with own booking', async () => {
      // Arrange
      const ownBooking = { ...mockTargetBooking, userId: 'proposer-user-id' };
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(ownBooking);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Cannot propose swap with your own booking');
    });

    it('should throw error if proposal expires in the past', async () => {
      // Arrange
      const pastExpiryRequest = {
        ...mockSwapRequest,
        terms: {
          ...mockSwapRequest.terms,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      };

      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(pastExpiryRequest))
        .rejects.toThrow('Proposal expiration date must be in the future');
    });

    it('should throw error if pending proposal already exists', async () => {
      // Arrange
      const existingProposal: Swap = {
        id: 'existing-swap-id',
        sourceBookingId: mockSwapRequest.sourceBookingId,
        targetBookingId: mockSwapRequest.targetBookingId,
        proposerId: 'other-user-id',
        ownerId: 'owner-user-id',
        status: 'pending',
        terms: mockSwapRequest.terms,
        blockchain: { proposalTransactionId: 'tx-456' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(existingProposal);

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('A pending swap proposal already exists between these bookings');
    });

    it('should unlock source booking if target booking lock fails', async () => {
      // Arrange
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockSwapRepository.findPendingProposalBetweenBookings.mockResolvedValue(null);
      mockBookingService.lockBooking
        .mockResolvedValueOnce({ ...mockSourceBooking, status: 'locked' })
        .mockRejectedValueOnce(new Error('Target booking already locked'));

      // Act & Assert
      await expect(swapProposalService.createSwapProposal(mockSwapRequest))
        .rejects.toThrow('Target booking already locked');

      expect(mockBookingService.unlockBooking).toHaveBeenCalledWith(
        mockSwapRequest.sourceBookingId,
        mockSwapRequest.proposerId
      );
    });
  });

  describe('cancelSwapProposal', () => {
    it('should cancel a swap proposal successfully', async () => {
      // Arrange
      const mockSwap: Swap = {
        id: 'swap-id',
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        proposerId: 'proposer-user-id',
        ownerId: 'owner-user-id',
        status: 'pending',
        terms: mockSwapRequest.terms,
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const cancelledSwap = { ...mockSwap, status: 'cancelled' as SwapStatus };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockSwapRepository.updateStatus.mockResolvedValue(cancelledSwap);
      mockBookingService.unlockBooking.mockResolvedValue({} as any);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'cancel-tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapCancellationNotification.mockResolvedValue();

      // Act
      const result = await swapProposalService.cancelSwapProposal('swap-id', 'proposer-user-id');

      // Assert
      expect(result.status).toBe('cancelled');
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledWith('swap-id', 'cancelled');
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal_cancelled',
          payload: expect.objectContaining({
            swapId: 'swap-id',
            cancelledBy: 'proposer-user-id',
          }),
        })
      );
      expect(mockNotificationService.sendSwapCancellationNotification).toHaveBeenCalled();
    });

    it('should throw error if swap not found', async () => {
      // Arrange
      mockSwapRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(swapProposalService.cancelSwapProposal('swap-id', 'user-id'))
        .rejects.toThrow('Swap proposal not found');
    });

    it('should throw error if user is not the proposer', async () => {
      // Arrange
      const mockSwap: Swap = {
        id: 'swap-id',
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        proposerId: 'different-user-id',
        ownerId: 'owner-user-id',
        status: 'pending',
        terms: mockSwapRequest.terms,
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);

      // Act & Assert
      await expect(swapProposalService.cancelSwapProposal('swap-id', 'user-id'))
        .rejects.toThrow('Only the proposer can cancel a swap proposal');
    });

    it('should throw error if swap is not pending', async () => {
      // Arrange
      const mockSwap: Swap = {
        id: 'swap-id',
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        proposerId: 'proposer-user-id',
        ownerId: 'owner-user-id',
        status: 'completed',
        terms: mockSwapRequest.terms,
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);

      // Act & Assert
      await expect(swapProposalService.cancelSwapProposal('swap-id', 'proposer-user-id'))
        .rejects.toThrow('Cannot cancel swap proposal with status: completed');
    });
  });

  describe('handleExpiredProposals', () => {
    it('should handle expired proposals successfully', async () => {
      // Arrange
      const expiredProposal: Swap = {
        id: 'expired-swap-id',
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        proposerId: 'proposer-user-id',
        ownerId: 'owner-user-id',
        status: 'pending',
        terms: {
          ...mockSwapRequest.terms,
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findExpiredProposals.mockResolvedValue([expiredProposal]);
      mockSwapRepository.updateStatus.mockResolvedValue({ ...expiredProposal, status: 'cancelled' });
      mockBookingService.unlockBooking.mockResolvedValue({} as any);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'expire-tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapExpirationNotification.mockResolvedValue();

      // Act
      await swapProposalService.handleExpiredProposals();

      // Assert
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledWith('expired-swap-id', 'cancelled');
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal_expired',
          payload: expect.objectContaining({
            swapId: 'expired-swap-id',
          }),
        })
      );
      expect(mockNotificationService.sendSwapExpirationNotification).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other proposals if one fails', async () => {
      // Arrange
      const expiredProposal1: Swap = {
        id: 'expired-swap-1',
        sourceBookingId: 'source-booking-1',
        targetBookingId: 'target-booking-1',
        proposerId: 'proposer-1',
        ownerId: 'owner-1',
        status: 'pending',
        terms: { ...mockSwapRequest.terms, expiresAt: new Date(Date.now() - 1000) },
        blockchain: { proposalTransactionId: 'tx-1' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const expiredProposal2: Swap = {
        id: 'expired-swap-2',
        sourceBookingId: 'source-booking-2',
        targetBookingId: 'target-booking-2',
        proposerId: 'proposer-2',
        ownerId: 'owner-2',
        status: 'pending',
        terms: { ...mockSwapRequest.terms, expiresAt: new Date(Date.now() - 1000) },
        blockchain: { proposalTransactionId: 'tx-2' },
        timeline: { proposedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findExpiredProposals.mockResolvedValue([expiredProposal1, expiredProposal2]);
      mockSwapRepository.updateStatus
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce({ ...expiredProposal2, status: 'cancelled' });
      mockBookingService.unlockBooking.mockResolvedValue({} as any);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'expire-tx',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapExpirationNotification.mockResolvedValue();

      // Act
      await swapProposalService.handleExpiredProposals();

      // Assert
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledTimes(2);
      // Second proposal should still be processed despite first one failing
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledWith('expired-swap-2', 'cancelled');
    });
  });

  describe('proposer data validation and enrichment', () => {
    it('should validate proposer data correctly', async () => {
      // Test the private validateProposerData method through transformRowToSwapProposal
      const validRow = {
        source_swap_id: 'swap-123',
        proposer_id: 'proposer-456',
        proposer_name: 'John Doe',
        proposal_status: 'pending',
        proposal_created_at: new Date(),
        proposal_additional_payment: 0,
        proposal_conditions: [],
        proposal_expires_at: new Date(Date.now() + 86400000)
      };

      // Access the private method for testing
      const service = swapProposalService as any;
      const validation = service.validateProposerData(validRow);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect invalid proposer data', async () => {
      const invalidRow = {
        source_swap_id: 'swap-123',
        proposer_id: 'proposer-456',
        proposer_name: null, // Invalid - null name
        proposal_status: 'pending'
      };

      const service = swapProposalService as any;
      const validation = service.validateProposerData(invalidRow);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('proposer_name is null or empty');
    });

    it('should detect "Unknown User" fallback value', async () => {
      const fallbackRow = {
        source_swap_id: 'swap-123',
        proposer_id: 'proposer-456',
        proposer_name: 'Unknown User', // Fallback value
        proposal_status: 'pending'
      };

      const service = swapProposalService as any;
      const validation = service.validateProposerData(fallbackRow);

      expect(validation.isValid).toBe(false);
      expect(validation.issues).toContain('proposer_name is fallback value "Unknown User"');
    });

    it('should enrich proposer data when primary JOIN fails', async () => {
      // Mock the repository method
      mockSwapRepository.getProposerDetails = vi.fn().mockResolvedValue({
        userId: 'proposer-456',
        displayName: 'John Doe',
        email: 'john@example.com',
        lookupMethod: 'direct',
        isValid: true
      });

      const service = swapProposalService as any;
      const enrichedData = await service.enrichProposerData('swap-123', 'proposer-456');

      expect(enrichedData.isValid).toBe(true);
      expect(enrichedData.displayName).toBe('John Doe');
      expect(enrichedData.lookupMethod).toBe('direct');
    });

    it('should handle enrichment failure gracefully', async () => {
      // Mock the repository method to return invalid data
      mockSwapRepository.getProposerDetails = vi.fn().mockResolvedValue({
        userId: null,
        displayName: null,
        email: null,
        lookupMethod: 'fallback',
        isValid: false
      });

      const service = swapProposalService as any;
      const enrichedData = await service.enrichProposerData('swap-123', 'proposer-456');

      expect(enrichedData.isValid).toBe(false);
      expect(enrichedData.displayName).toBe(null);
      expect(enrichedData.lookupMethod).toBe('fallback');
    });
  });
});