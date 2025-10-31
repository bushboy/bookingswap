import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SwapResponseService, SwapResponseRequest } from '../SwapResponseService';
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

describe('SwapResponseService', () => {
  let swapResponseService: SwapResponseService;
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
    status: 'locked',
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
    status: 'locked',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPendingSwap: Swap = {
    id: 'swap-id',
    sourceBookingId: 'source-booking-id',
    targetBookingId: 'target-booking-id',
    proposerId: 'proposer-user-id',
    ownerId: 'owner-user-id',
    status: 'pending',
    terms: {
      additionalPayment: 100,
      conditions: ['Non-refundable'],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    blockchain: { proposalTransactionId: 'tx-123' },
    timeline: { proposedAt: new Date() },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSwapRepository = vi.mocked(new SwapRepository({} as any));
    mockBookingService = vi.mocked(new BookingService({} as any, {} as any, {} as any));
    mockHederaService = vi.mocked(new HederaService({} as any));
    mockNotificationService = vi.mocked(new NotificationService());

    swapResponseService = new SwapResponseService(
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService
    );
  });

  describe('acceptSwapProposal', () => {
    const acceptRequest: SwapResponseRequest = {
      swapId: 'swap-id',
      userId: 'owner-user-id',
      response: 'accept',
    };

    it('should accept a swap proposal successfully', async () => {
      // Arrange
      const acceptedSwap = { ...mockPendingSwap, status: 'accepted' as SwapStatus };
      const updatedSwap = {
        ...acceptedSwap,
        timeline: { ...acceptedSwap.timeline, respondedAt: new Date() },
      };

      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking)
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockSwapRepository.updateStatus.mockResolvedValue(acceptedSwap);
      mockSwapRepository.updateTimeline.mockResolvedValue(updatedSwap);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'accept-tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapResponseNotification.mockResolvedValue();

      // Act
      const result = await swapResponseService.acceptSwapProposal(acceptRequest);

      // Assert
      expect(result.swap.status).toBe('accepted');
      expect(result.blockchainTransaction?.transactionId).toBe('accept-tx-123');
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledWith('swap-id', 'accepted');
      expect(mockSwapRepository.updateTimeline).toHaveBeenCalledWith('swap-id', {
        respondedAt: expect.any(Date),
      });
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal_accepted',
          payload: expect.objectContaining({
            swapId: 'swap-id',
            acceptedBy: 'owner-user-id',
          }),
        })
      );
      expect(mockNotificationService.sendSwapResponseNotification).toHaveBeenCalledWith({
        swapId: 'swap-id',
        recipientUserId: 'proposer-user-id',
        responderUserId: 'owner-user-id',
        response: 'accepted',
        sourceBooking: mockSourceBooking,
        targetBooking: mockTargetBooking,
      });
    });

    it('should throw error for invalid response type', async () => {
      // Arrange
      const invalidRequest = { ...acceptRequest, response: 'reject' as const };

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(invalidRequest))
        .rejects.toThrow('Invalid response type for accept operation');
    });

    it('should throw error if swap not found', async () => {
      // Arrange
      mockSwapRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(acceptRequest))
        .rejects.toThrow('Swap proposal not found');
    });

    it('should throw error if user is not the owner', async () => {
      // Arrange
      const wrongUserRequest = { ...acceptRequest, userId: 'wrong-user-id' };
      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(wrongUserRequest))
        .rejects.toThrow('Only the booking owner can respond to this swap proposal');
    });

    it('should throw error if swap is not pending', async () => {
      // Arrange
      const completedSwap = { ...mockPendingSwap, status: 'completed' as SwapStatus };
      mockSwapRepository.findById.mockResolvedValue(completedSwap);

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(acceptRequest))
        .rejects.toThrow('Cannot respond to swap proposal with status: completed');
    });

    it('should throw error if proposal has expired', async () => {
      // Arrange
      const expiredSwap = {
        ...mockPendingSwap,
        terms: {
          ...mockPendingSwap.terms,
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        },
      };
      mockSwapRepository.findById.mockResolvedValue(expiredSwap);

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(acceptRequest))
        .rejects.toThrow('Swap proposal has expired');
    });

    it('should throw error if source booking is not locked', async () => {
      // Arrange
      const availableSourceBooking = { ...mockSourceBooking, status: 'available' as const };
      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(availableSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);

      // Act & Assert
      await expect(swapResponseService.acceptSwapProposal(acceptRequest))
        .rejects.toThrow('Source booking is not locked (status: available)');
    });
  });

  describe('rejectSwapProposal', () => {
    const rejectRequest: SwapResponseRequest = {
      swapId: 'swap-id',
      userId: 'owner-user-id',
      response: 'reject',
    };

    it('should reject a swap proposal successfully', async () => {
      // Arrange
      const rejectedSwap = { ...mockPendingSwap, status: 'rejected' as SwapStatus };
      const updatedSwap = {
        ...rejectedSwap,
        timeline: { ...rejectedSwap.timeline, respondedAt: new Date() },
      };

      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking)
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);
      mockSwapRepository.updateStatus.mockResolvedValue(rejectedSwap);
      mockSwapRepository.updateTimeline.mockResolvedValue(updatedSwap);
      mockBookingService.unlockBooking.mockResolvedValue({} as any);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'reject-tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapResponseNotification.mockResolvedValue();

      // Act
      const result = await swapResponseService.rejectSwapProposal(rejectRequest);

      // Assert
      expect(result.swap.status).toBe('rejected');
      expect(result.blockchainTransaction?.transactionId).toBe('reject-tx-123');
      expect(mockSwapRepository.updateStatus).toHaveBeenCalledWith('swap-id', 'rejected');
      expect(mockBookingService.unlockBooking).toHaveBeenCalledTimes(2);
      expect(mockBookingService.unlockBooking).toHaveBeenCalledWith('source-booking-id');
      expect(mockBookingService.unlockBooking).toHaveBeenCalledWith('target-booking-id');
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'swap_proposal_rejected',
          payload: expect.objectContaining({
            swapId: 'swap-id',
            rejectedBy: 'owner-user-id',
          }),
        })
      );
      expect(mockNotificationService.sendSwapResponseNotification).toHaveBeenCalledWith({
        swapId: 'swap-id',
        recipientUserId: 'proposer-user-id',
        responderUserId: 'owner-user-id',
        response: 'rejected',
        sourceBooking: mockSourceBooking,
        targetBooking: mockTargetBooking,
      });
    });

    it('should throw error for invalid response type', async () => {
      // Arrange
      const invalidRequest = { ...rejectRequest, response: 'accept' as const };

      // Act & Assert
      await expect(swapResponseService.rejectSwapProposal(invalidRequest))
        .rejects.toThrow('Invalid response type for reject operation');
    });
  });

  describe('processSwapResponse', () => {
    it('should process accept response', async () => {
      // Arrange
      const acceptRequest: SwapResponseRequest = {
        swapId: 'swap-id',
        userId: 'owner-user-id',
        response: 'accept',
      };

      const acceptedSwap = { ...mockPendingSwap, status: 'accepted' as SwapStatus };
      const updatedSwap = {
        ...acceptedSwap,
        timeline: { ...acceptedSwap.timeline, respondedAt: new Date() },
      };

      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);
      mockBookingService.getBookingById
        .mockResolvedValue(mockSourceBooking)
        .mockResolvedValue(mockTargetBooking);
      mockSwapRepository.updateStatus.mockResolvedValue(acceptedSwap);
      mockSwapRepository.updateTimeline.mockResolvedValue(updatedSwap);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapResponseNotification.mockResolvedValue();

      // Act
      const result = await swapResponseService.processSwapResponse(acceptRequest);

      // Assert
      expect(result.swap.status).toBe('accepted');
    });

    it('should process reject response', async () => {
      // Arrange
      const rejectRequest: SwapResponseRequest = {
        swapId: 'swap-id',
        userId: 'owner-user-id',
        response: 'reject',
      };

      const rejectedSwap = { ...mockPendingSwap, status: 'rejected' as SwapStatus };
      const updatedSwap = {
        ...rejectedSwap,
        timeline: { ...rejectedSwap.timeline, respondedAt: new Date() },
      };

      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);
      mockBookingService.getBookingById
        .mockResolvedValue(mockSourceBooking)
        .mockResolvedValue(mockTargetBooking);
      mockSwapRepository.updateStatus.mockResolvedValue(rejectedSwap);
      mockSwapRepository.updateTimeline.mockResolvedValue(updatedSwap);
      mockBookingService.unlockBooking.mockResolvedValue({} as any);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });
      mockNotificationService.sendSwapResponseNotification.mockResolvedValue();

      // Act
      const result = await swapResponseService.processSwapResponse(rejectRequest);

      // Assert
      expect(result.swap.status).toBe('rejected');
    });

    it('should throw error for invalid response type', async () => {
      // Arrange
      const invalidRequest = {
        swapId: 'swap-id',
        userId: 'owner-user-id',
        response: 'invalid' as any,
      };

      // Act & Assert
      await expect(swapResponseService.processSwapResponse(invalidRequest))
        .rejects.toThrow('Invalid response type: invalid');
    });
  });

  describe('prepareSwapExecution', () => {
    it('should prepare swap execution successfully', async () => {
      // Arrange
      const acceptedSwap = { ...mockPendingSwap, status: 'accepted' as SwapStatus };
      mockSwapRepository.findById.mockResolvedValue(acceptedSwap);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);

      // Act
      const result = await swapResponseService.prepareSwapExecution('swap-id');

      // Assert
      expect(result.swap).toEqual(acceptedSwap);
      expect(result.executionPlan).toEqual({
        sourceBookingTransfer: {
          fromUserId: 'proposer-user-id',
          toUserId: 'owner-user-id',
          bookingId: 'source-booking-id',
        },
        targetBookingTransfer: {
          fromUserId: 'owner-user-id',
          toUserId: 'proposer-user-id',
          bookingId: 'target-booking-id',
        },
        additionalPayment: {
          fromUserId: 'proposer-user-id',
          toUserId: 'owner-user-id',
          amount: 100,
        },
      });
    });

    it('should throw error if swap not found', async () => {
      // Arrange
      mockSwapRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(swapResponseService.prepareSwapExecution('swap-id'))
        .rejects.toThrow('Swap not found');
    });

    it('should throw error if swap is not accepted', async () => {
      // Arrange
      mockSwapRepository.findById.mockResolvedValue(mockPendingSwap);

      // Act & Assert
      await expect(swapResponseService.prepareSwapExecution('swap-id'))
        .rejects.toThrow('Cannot prepare execution for swap with status: pending');
    });

    it('should prepare execution without additional payment', async () => {
      // Arrange
      const acceptedSwapNoPayment = {
        ...mockPendingSwap,
        status: 'accepted' as SwapStatus,
        terms: {
          ...mockPendingSwap.terms,
          additionalPayment: undefined,
        },
      };
      mockSwapRepository.findById.mockResolvedValue(acceptedSwapNoPayment);
      mockBookingService.getBookingById
        .mockResolvedValueOnce(mockSourceBooking)
        .mockResolvedValueOnce(mockTargetBooking);

      // Act
      const result = await swapResponseService.prepareSwapExecution('swap-id');

      // Assert
      expect(result.executionPlan.additionalPayment).toBeUndefined();
    });
  });

  describe('getUserSwapResponses', () => {
    it('should get user swap responses successfully', async () => {
      // Arrange
      const userSwaps = [mockPendingSwap];
      mockSwapRepository.findByFilters.mockResolvedValue(userSwaps);

      // Act
      const result = await swapResponseService.getUserSwapResponses('owner-user-id');

      // Assert
      expect(result).toEqual(userSwaps);
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { ownerId: 'owner-user-id' },
        100,
        0
      );
    });

    it('should get user swap responses with status filter', async () => {
      // Arrange
      const userSwaps = [mockPendingSwap];
      mockSwapRepository.findByFilters.mockResolvedValue(userSwaps);

      // Act
      const result = await swapResponseService.getUserSwapResponses('owner-user-id', 'pending');

      // Assert
      expect(result).toEqual(userSwaps);
      expect(mockSwapRepository.findByFilters).toHaveBeenCalledWith(
        { ownerId: 'owner-user-id', status: 'pending' },
        100,
        0
      );
    });
  });
});