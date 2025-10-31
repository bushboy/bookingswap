import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedAuctionService } from '../EnhancedAuctionService';
import { AuctionRepository } from '../../../database/repositories/AuctionRepository';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { BookingService } from '../../booking/BookingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';
import { PaymentProcessingService } from '../../payment/PaymentProcessingService';
import { 
  SwapAuction, 
  AuctionProposal, 
  AuctionSettings,
  EnhancedSwap,
  PaymentTypePreference,
  AcceptanceStrategy
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/AuctionRepository');
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../booking/BookingService');
vi.mock('../../hedera/HederaService');
vi.mock('../../notification/NotificationService');
vi.mock('../../payment/PaymentProcessingService');

describe('EnhancedAuctionService', () => {
  let service: EnhancedAuctionService;
  let mockAuctionRepository: any;
  let mockSwapRepository: any;
  let mockBookingService: any;
  let mockHederaService: any;
  let mockNotificationService: any;
  let mockPaymentService: any;

  beforeEach(() => {
    mockAuctionRepository = {
      findById: vi.fn(),
      findBySwapId: vi.fn(),
      createAuction: vi.fn(),
      updateStatus: vi.fn(),
      createProposal: vi.fn(),
      getAuctionProposals: vi.fn(),
      selectWinningProposal: vi.fn(),
      updateProposalStatus: vi.fn(),
      findExpiredAuctions: vi.fn(),
    };

    mockSwapRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockBookingService = {
      getBookingById: vi.fn(),
    };

    mockHederaService = {
      submitTransaction: vi.fn(),
    };

    mockNotificationService = {
      sendAuctionCreatedNotification: vi.fn(),
      sendAuctionEndedNotification: vi.fn(),
      sendAuctionProposalNotification: vi.fn(),
      sendAuctionWinnerNotification: vi.fn(),
    };

    mockPaymentService = {
      validateCashOffer: vi.fn(),
      createEscrow: vi.fn(),
    };

    service = new EnhancedAuctionService(
      mockAuctionRepository,
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService,
      mockPaymentService
    );
  });

  describe('validateAuctionTiming', () => {
    it('should validate correct auction timing for events more than one week away', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now (11 days before event)

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isLastMinute).toBe(false);
      expect(result.minimumEndDate).toBeDefined();
    });

    it('should reject auction for events less than one week away', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 5); // 5 days from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 2); // 2 days from now

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.isLastMinute).toBe(true);
      expect(result.errors).toContain('Auctions are not allowed for events less than one week away');
    });

    it('should reject auction ending less than one week before event', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now (4 days before event)

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction must end at least one week before the event');
    });

    it('should reject auction ending in the past', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() - 1); // Yesterday

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction end date must be in the future');
    });

    it('should calculate correct minimum end date', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      const expectedMinimumEndDate = new Date(eventDate);
      expectedMinimumEndDate.setDate(expectedMinimumEndDate.getDate() - 7); // One week before event

      expect(result.minimumEndDate.getTime()).toBeCloseTo(expectedMinimumEndDate.getTime(), -1000);
    });
  });

  describe('createEnhancedAuction', () => {
    const mockSwap: EnhancedSwap = {
      id: 'swap-123',
      sourceBookingId: 'booking-123',
      targetBookingId: 'booking-456',
      proposerId: 'user-123',
      ownerId: 'user-456',
      status: 'pending',
      terms: {
        conditions: [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      blockchain: { proposalTransactionId: 'tx-123' },
      timeline: { proposedAt: new Date() },
      paymentTypes: {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 100,
      },
      acceptanceStrategy: {
        type: 'auction',
        auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockBooking = {
      id: 'booking-123',
      dateRange: {
        checkIn: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks from now
        checkOut: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
    };

    const auctionSettings: AuctionSettings = {
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      allowBookingProposals: true,
      allowCashProposals: true,
      minimumCashOffer: 100,
      autoSelectAfterHours: 24,
    };

    it('should create auction successfully with valid timing', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-456',
        status: 'active',
        settings: auctionSettings,
        proposals: [],
        blockchain: { creationTransactionId: 'tx-auction-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockBookingService.getBookingById.mockResolvedValue(mockBooking);
      mockAuctionRepository.createAuction.mockResolvedValue(mockAuction);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-auction-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await service.createEnhancedAuction('swap-123', auctionSettings);

      expect(result.id).toBe('auction-123');
      expect(result.status).toBe('active');
      expect(mockAuctionRepository.createAuction).toHaveBeenCalledWith(
        expect.objectContaining({
          swapId: 'swap-123',
          ownerId: 'user-456',
          status: 'active',
          settings: auctionSettings,
        })
      );
      expect(mockHederaService.submitTransaction).toHaveBeenCalled();
      expect(mockNotificationService.sendAuctionCreatedNotification).toHaveBeenCalled();
    });

    it('should throw error for non-existent swap', async () => {
      mockSwapRepository.findById.mockResolvedValue(null);

      await expect(
        service.createEnhancedAuction('non-existent', auctionSettings)
      ).rejects.toThrow('Swap not found');
    });

    it('should throw error for invalid auction timing', async () => {
      const invalidSettings = {
        ...auctionSettings,
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Too close to event
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockBookingService.getBookingById.mockResolvedValue(mockBooking);

      await expect(
        service.createEnhancedAuction('swap-123', invalidSettings)
      ).rejects.toThrow('Invalid auction timing');
    });

    it('should throw error for swap not in auction mode', async () => {
      const nonAuctionSwap = {
        ...mockSwap,
        acceptanceStrategy: { type: 'first_match' as const },
      };

      mockSwapRepository.findById.mockResolvedValue(nonAuctionSwap);

      await expect(
        service.createEnhancedAuction('swap-123', auctionSettings)
      ).rejects.toThrow('Swap is not configured for auction mode');
    });
  });

  describe('submitAuctionProposal', () => {
    const mockAuction: SwapAuction = {
      id: 'auction-123',
      swapId: 'swap-123',
      ownerId: 'user-456',
      status: 'active',
      settings: {
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        allowBookingProposals: true,
        allowCashProposals: true,
        minimumCashOffer: 100,
      },
      proposals: [],
      blockchain: { creationTransactionId: 'tx-123' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should submit booking proposal successfully', async () => {
      const proposalRequest = {
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'booking' as const,
        bookingId: 'booking-789',
        message: 'Great booking for swap',
        conditions: ['Same dates required'],
      };

      const mockProposal: AuctionProposal = {
        id: 'proposal-123',
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'booking',
        bookingId: 'booking-789',
        message: 'Great booking for swap',
        conditions: ['Same dates required'],
        status: 'pending',
        submittedAt: new Date(),
        blockchain: { transactionId: 'tx-proposal-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuctionRepository.findById.mockResolvedValue(mockAuction);
      mockAuctionRepository.createProposal.mockResolvedValue(mockProposal);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-proposal-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await service.submitAuctionProposal(proposalRequest);

      expect(result.proposalId).toBe('proposal-123');
      expect(result.status).toBe('pending');
      expect(mockAuctionRepository.createProposal).toHaveBeenCalled();
      expect(mockNotificationService.sendAuctionProposalNotification).toHaveBeenCalled();
    });

    it('should submit cash proposal successfully', async () => {
      const proposalRequest = {
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'cash' as const,
        cashOffer: {
          amount: 200,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        message: 'Cash offer for booking',
        conditions: [],
      };

      mockAuctionRepository.findById.mockResolvedValue(mockAuction);
      mockPaymentService.validateCashOffer.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        estimatedFees: { platformFee: 10, processingFee: 5, totalFees: 15, netAmount: 185 },
        requiresEscrow: true,
      });

      const mockProposal: AuctionProposal = {
        id: 'proposal-456',
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'cash',
        cashOffer: {
          amount: 200,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowRequired: true,
        },
        message: 'Cash offer for booking',
        conditions: [],
        status: 'pending',
        submittedAt: new Date(),
        blockchain: { transactionId: 'tx-proposal-456' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockAuctionRepository.createProposal.mockResolvedValue(mockProposal);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-proposal-456',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await service.submitAuctionProposal(proposalRequest);

      expect(result.proposalId).toBe('proposal-456');
      expect(mockPaymentService.validateCashOffer).toHaveBeenCalledWith(
        200, 'USD', 100, 'pm-123', 'user-789'
      );
    });

    it('should reject proposal for non-existent auction', async () => {
      mockAuctionRepository.findById.mockResolvedValue(null);

      const proposalRequest = {
        auctionId: 'non-existent',
        proposerId: 'user-789',
        proposalType: 'booking' as const,
        bookingId: 'booking-789',
        conditions: [],
      };

      await expect(
        service.submitAuctionProposal(proposalRequest)
      ).rejects.toThrow('Auction not found');
    });

    it('should reject proposal for ended auction', async () => {
      const endedAuction = { ...mockAuction, status: 'ended' as const };
      mockAuctionRepository.findById.mockResolvedValue(endedAuction);

      const proposalRequest = {
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'booking' as const,
        bookingId: 'booking-789',
        conditions: [],
      };

      await expect(
        service.submitAuctionProposal(proposalRequest)
      ).rejects.toThrow('Cannot submit proposal to ended auction');
    });

    it('should reject cash proposal below minimum amount', async () => {
      mockAuctionRepository.findById.mockResolvedValue(mockAuction);
      mockPaymentService.validateCashOffer.mockResolvedValue({
        isValid: false,
        errors: ['Amount must be at least 100 USD as specified by swap owner'],
        warnings: [],
        estimatedFees: { platformFee: 0, processingFee: 0, totalFees: 0, netAmount: 0 },
        requiresEscrow: false,
      });

      const proposalRequest = {
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'cash' as const,
        cashOffer: {
          amount: 50, // Below minimum
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        conditions: [],
      };

      await expect(
        service.submitAuctionProposal(proposalRequest)
      ).rejects.toThrow('Cash offer validation failed');
    });

    it('should reject booking proposal when not allowed', async () => {
      const cashOnlyAuction = {
        ...mockAuction,
        settings: {
          ...mockAuction.settings,
          allowBookingProposals: false,
        },
      };

      mockAuctionRepository.findById.mockResolvedValue(cashOnlyAuction);

      const proposalRequest = {
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'booking' as const,
        bookingId: 'booking-789',
        conditions: [],
      };

      await expect(
        service.submitAuctionProposal(proposalRequest)
      ).rejects.toThrow('Booking proposals are not allowed for this auction');
    });
  });

  describe('selectAuctionWinner', () => {
    const mockAuction: SwapAuction = {
      id: 'auction-123',
      swapId: 'swap-123',
      ownerId: 'user-456',
      status: 'ended',
      settings: {
        endDate: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        allowBookingProposals: true,
        allowCashProposals: true,
      },
      proposals: [],
      blockchain: { creationTransactionId: 'tx-123' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockProposal: AuctionProposal = {
      id: 'proposal-123',
      auctionId: 'auction-123',
      proposerId: 'user-789',
      proposalType: 'cash',
      cashOffer: {
        amount: 200,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        escrowRequired: true,
      },
      conditions: [],
      status: 'pending',
      submittedAt: new Date(),
      blockchain: { transactionId: 'tx-proposal-123' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should select winner successfully', async () => {
      const updatedAuction = {
        ...mockAuction,
        winningProposalId: 'proposal-123',
      };

      mockAuctionRepository.findById.mockResolvedValue(mockAuction);
      mockAuctionRepository.getAuctionProposals.mockResolvedValue([mockProposal]);
      mockAuctionRepository.selectWinningProposal.mockResolvedValue(updatedAuction);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-winner-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await service.selectAuctionWinner('auction-123', 'proposal-123', 'user-456');

      expect(result.winningProposalId).toBe('proposal-123');
      expect(mockAuctionRepository.selectWinningProposal).toHaveBeenCalledWith(
        'auction-123',
        'proposal-123'
      );
      expect(mockNotificationService.sendAuctionWinnerNotification).toHaveBeenCalled();
    });

    it('should throw error if user is not auction owner', async () => {
      mockAuctionRepository.findById.mockResolvedValue(mockAuction);

      await expect(
        service.selectAuctionWinner('auction-123', 'proposal-123', 'wrong-user')
      ).rejects.toThrow('Only auction owner can select winner');
    });

    it('should throw error for non-existent proposal', async () => {
      mockAuctionRepository.findById.mockResolvedValue(mockAuction);
      mockAuctionRepository.getAuctionProposals.mockResolvedValue([]);

      await expect(
        service.selectAuctionWinner('auction-123', 'non-existent', 'user-456')
      ).rejects.toThrow('Proposal not found in auction');
    });

    it('should throw error for active auction', async () => {
      const activeAuction = { ...mockAuction, status: 'active' as const };
      mockAuctionRepository.findById.mockResolvedValue(activeAuction);

      await expect(
        service.selectAuctionWinner('auction-123', 'proposal-123', 'user-456')
      ).rejects.toThrow('Cannot select winner for active auction');
    });
  });

  describe('handleAuctionTimeout', () => {
    it('should auto-select highest cash offer when owner does not respond', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-456',
        status: 'ended',
        settings: {
          endDate: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          allowBookingProposals: true,
          allowCashProposals: true,
          autoSelectAfterHours: 24,
        },
        proposals: [],
        blockchain: { creationTransactionId: 'tx-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const proposals: AuctionProposal[] = [
        {
          id: 'proposal-1',
          auctionId: 'auction-123',
          proposerId: 'user-1',
          proposalType: 'cash',
          cashOffer: { amount: 150, currency: 'USD', paymentMethodId: 'pm-1', escrowRequired: true },
          conditions: [],
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'proposal-2',
          auctionId: 'auction-123',
          proposerId: 'user-2',
          proposalType: 'cash',
          cashOffer: { amount: 200, currency: 'USD', paymentMethodId: 'pm-2', escrowRequired: true },
          conditions: [],
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-2' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAuctionRepository.findExpiredAuctions.mockResolvedValue([mockAuction]);
      mockAuctionRepository.getAuctionProposals.mockResolvedValue(proposals);
      mockAuctionRepository.selectWinningProposal.mockResolvedValue({
        ...mockAuction,
        winningProposalId: 'proposal-2',
      });
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-auto-select',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      await service.handleAuctionTimeouts();

      expect(mockAuctionRepository.selectWinningProposal).toHaveBeenCalledWith(
        'auction-123',
        'proposal-2' // Highest cash offer
      );
      expect(mockNotificationService.sendAuctionWinnerNotification).toHaveBeenCalled();
    });

    it('should handle multiple expired auctions', async () => {
      const expiredAuctions = [
        {
          id: 'auction-1',
          swapId: 'swap-1',
          ownerId: 'user-1',
          status: 'ended' as const,
          settings: {
            endDate: new Date(Date.now() - 25 * 60 * 60 * 1000),
            allowBookingProposals: true,
            allowCashProposals: true,
            autoSelectAfterHours: 24,
          },
          proposals: [],
          blockchain: { creationTransactionId: 'tx-1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'auction-2',
          swapId: 'swap-2',
          ownerId: 'user-2',
          status: 'ended' as const,
          settings: {
            endDate: new Date(Date.now() - 25 * 60 * 60 * 1000),
            allowBookingProposals: true,
            allowCashProposals: true,
            autoSelectAfterHours: 24,
          },
          proposals: [],
          blockchain: { creationTransactionId: 'tx-2' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAuctionRepository.findExpiredAuctions.mockResolvedValue(expiredAuctions);
      mockAuctionRepository.getAuctionProposals.mockResolvedValue([]);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-auto-select',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      await service.handleAuctionTimeouts();

      expect(mockAuctionRepository.getAuctionProposals).toHaveBeenCalledTimes(2);
    });
  });
});