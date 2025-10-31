import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuctionService } from '../AuctionService';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { NotificationService } from '../notification/NotificationService';
import { HederaService } from '../hedera/HederaService';
import { 
  SwapAuction, 
  AuctionProposal, 
  EnhancedSwap,
  AuctionSettings,
  AuctionTimingValidation 
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/AuctionRepository');
vi.mock('../../database/repositories/SwapRepository');
vi.mock('../notification/NotificationService');
vi.mock('../hedera/HederaService');

describe('AuctionService', () => {
  let auctionService: AuctionService;
  let mockAuctionRepository: Mock;
  let mockSwapRepository: Mock;
  let mockNotificationService: Mock;
  let mockHederaService: Mock;

  const mockSwap: EnhancedSwap = {
    id: 'swap-123',
    sourceBookingId: 'booking-123',
    ownerId: 'user-123',
    title: 'Test Swap',
    description: 'Test Description',
    paymentTypes: {
      bookingExchange: true,
      cashPayment: true,
      minimumCashAmount: 200,
    },
    acceptanceStrategy: {
      type: 'auction',
      auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    },
    status: 'active',
    createdAt: new Date(),
    expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    swapPreferences: {
      preferredLocations: [],
      additionalRequirements: [],
    },
    blockchain: {
      topicId: 'topic-123',
      creationTransactionId: 'tx-123',
    },
  };

  const mockAuctionSettings: AuctionSettings = {
    endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    allowBookingProposals: true,
    allowCashProposals: true,
    minimumCashOffer: 200,
    autoSelectAfterHours: 24,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockAuctionRepository = vi.mocked(AuctionRepository);
    mockSwapRepository = vi.mocked(SwapRepository);
    mockNotificationService = vi.mocked(NotificationService);
    mockHederaService = vi.mocked(HederaService);

    auctionService = new AuctionService(
      mockAuctionRepository.prototype,
      mockSwapRepository.prototype,
      mockNotificationService.prototype,
      mockHederaService.prototype
    );
  });

  describe('createAuction', () => {
    it('should create auction with valid timing', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        blockchain: {
          creationTransactionId: 'tx-auction-123',
        },
      };

      mockAuctionRepository.prototype.create = vi.fn().mockResolvedValue(mockAuction);
      mockHederaService.prototype.recordAuctionCreation = vi.fn().mockResolvedValue('tx-auction-123');
      mockNotificationService.prototype.sendAuctionCreatedNotification = vi.fn();

      const result = await auctionService.createAuction('swap-123', mockAuctionSettings);

      expect(result).toEqual(mockAuction);
      expect(mockAuctionRepository.prototype.create).toHaveBeenCalledWith({
        swapId: 'swap-123',
        settings: mockAuctionSettings,
        status: 'active',
      });
      expect(mockHederaService.prototype.recordAuctionCreation).toHaveBeenCalled();
      expect(mockNotificationService.prototype.sendAuctionCreatedNotification).toHaveBeenCalled();
    });

    it('should reject auction creation for last-minute bookings', async () => {
      const lastMinuteSettings: AuctionSettings = {
        ...mockAuctionSettings,
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      };

      const lastMinuteSwap: EnhancedSwap = {
        ...mockSwap,
        sourceBooking: {
          dateRange: {
            checkIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
            checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        },
      } as any;

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(lastMinuteSwap);

      await expect(
        auctionService.createAuction('swap-123', lastMinuteSettings)
      ).rejects.toThrow('LAST_MINUTE_RESTRICTION');
    });

    it('should validate auction end date is at least one week before event', async () => {
      const invalidSettings: AuctionSettings = {
        ...mockAuctionSettings,
        endDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
      };

      const futureSwap: EnhancedSwap = {
        ...mockSwap,
        sourceBooking: {
          dateRange: {
            checkIn: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000), // 28 days from now (only 3 days after auction end)
            checkOut: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      } as any;

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(futureSwap);

      await expect(
        auctionService.createAuction('swap-123', invalidSettings)
      ).rejects.toThrow('AUCTION_TOO_CLOSE_TO_EVENT');
    });
  });

  describe('validateAuctionTiming', () => {
    it('should validate correct timing', async () => {
      const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      const auctionEndDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now

      const result = await auctionService.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(true);
      expect(result.isLastMinute).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect last-minute bookings', async () => {
      const eventDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const auctionEndDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days from now

      const result = await auctionService.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.isLastMinute).toBe(true);
      expect(result.errors).toContain('Event is less than one week away');
    });

    it('should validate minimum one week gap', async () => {
      const eventDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now
      const auctionEndDate = new Date(Date.now() + 18 * 24 * 60 * 60 * 1000); // 18 days from now (only 2 days before event)

      const result = await auctionService.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction must end at least one week before event');
    });
  });

  describe('addProposalToAuction', () => {
    const mockProposal: AuctionProposal = {
      id: 'proposal-123',
      auctionId: 'auction-123',
      proposerId: 'user-456',
      proposalType: 'cash',
      cashOffer: {
        amount: 300,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        escrowRequired: true,
      },
      message: 'Cash offer',
      conditions: [],
      status: 'pending',
      submittedAt: new Date(),
      blockchain: {
        transactionId: 'tx-proposal-123',
      },
    };

    it('should add valid proposal to active auction', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(mockAuction);
      mockAuctionRepository.prototype.addProposal = vi.fn().mockResolvedValue(mockProposal);
      mockHederaService.prototype.recordProposalSubmission = vi.fn().mockResolvedValue('tx-proposal-123');
      mockNotificationService.prototype.sendProposalSubmittedNotification = vi.fn();

      const result = await auctionService.addProposalToAuction('auction-123', mockProposal);

      expect(result).toEqual(mockProposal);
      expect(mockAuctionRepository.prototype.addProposal).toHaveBeenCalledWith('auction-123', mockProposal);
      expect(mockHederaService.prototype.recordProposalSubmission).toHaveBeenCalled();
    });

    it('should reject proposal for ended auction', async () => {
      const endedAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        endedAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(endedAuction);

      await expect(
        auctionService.addProposalToAuction('auction-123', mockProposal)
      ).rejects.toThrow('AUCTION_ALREADY_ENDED');
    });

    it('should validate cash proposal meets minimum amount', async () => {
      const lowCashProposal: AuctionProposal = {
        ...mockProposal,
        cashOffer: {
          ...mockProposal.cashOffer!,
          amount: 100, // Below minimum of 200
        },
      };

      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(mockAuction);

      await expect(
        auctionService.addProposalToAuction('auction-123', lowCashProposal)
      ).rejects.toThrow('Cash offer below minimum amount');
    });

    it('should prevent duplicate proposals from same user', async () => {
      const existingProposal: AuctionProposal = {
        ...mockProposal,
        id: 'existing-proposal',
      };

      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [existingProposal],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(mockAuction);

      await expect(
        auctionService.addProposalToAuction('auction-123', mockProposal)
      ).rejects.toThrow('User has already submitted a proposal');
    });
  });

  describe('endAuction', () => {
    it('should end active auction successfully', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      const endedAuction: SwapAuction = {
        ...mockAuction,
        status: 'ended',
        endedAt: new Date(),
        blockchain: {
          ...mockAuction.blockchain,
          endTransactionId: 'tx-end-123',
        },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(mockAuction);
      mockAuctionRepository.prototype.update = vi.fn().mockResolvedValue(endedAuction);
      mockHederaService.prototype.recordAuctionEnd = vi.fn().mockResolvedValue('tx-end-123');
      mockNotificationService.prototype.sendAuctionEndedNotification = vi.fn();

      const result = await auctionService.endAuction('auction-123');

      expect(result.status).toBe('ended');
      expect(result.endedAt).toBeDefined();
      expect(mockHederaService.prototype.recordAuctionEnd).toHaveBeenCalled();
      expect(mockNotificationService.prototype.sendAuctionEndedNotification).toHaveBeenCalled();
    });

    it('should handle ending already ended auction', async () => {
      const endedAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        endedAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(endedAuction);

      const result = await auctionService.endAuction('auction-123');

      expect(result).toEqual(endedAuction);
      expect(mockAuctionRepository.prototype.update).not.toHaveBeenCalled();
    });
  });

  describe('selectWinningProposal', () => {
    const mockProposal1: AuctionProposal = {
      id: 'proposal-1',
      auctionId: 'auction-123',
      proposerId: 'user-456',
      proposalType: 'cash',
      cashOffer: { amount: 250, currency: 'USD', paymentMethodId: 'pm-1', escrowRequired: true },
      status: 'pending',
      submittedAt: new Date(),
      blockchain: { transactionId: 'tx-1' },
    };

    const mockProposal2: AuctionProposal = {
      id: 'proposal-2',
      auctionId: 'auction-123',
      proposerId: 'user-789',
      proposalType: 'cash',
      cashOffer: { amount: 300, currency: 'USD', paymentMethodId: 'pm-2', escrowRequired: true },
      status: 'pending',
      submittedAt: new Date(),
      blockchain: { transactionId: 'tx-2' },
    };

    it('should select winning proposal and reject others', async () => {
      const endedAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: mockAuctionSettings,
        proposals: [mockProposal1, mockProposal2],
        createdAt: new Date(),
        endedAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      const updatedAuction: SwapAuction = {
        ...endedAuction,
        winningProposalId: 'proposal-2',
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(endedAuction);
      mockAuctionRepository.prototype.selectWinner = vi.fn().mockResolvedValue(updatedAuction);
      mockNotificationService.prototype.sendWinnerSelectedNotification = vi.fn();
      mockNotificationService.prototype.sendProposalRejectedNotification = vi.fn();

      const result = await auctionService.selectWinningProposal('auction-123', 'proposal-2', 'user-123');

      expect(result.winningProposalId).toBe('proposal-2');
      expect(mockAuctionRepository.prototype.selectWinner).toHaveBeenCalledWith('auction-123', 'proposal-2');
      expect(mockNotificationService.prototype.sendWinnerSelectedNotification).toHaveBeenCalledWith('proposal-2');
      expect(mockNotificationService.prototype.sendProposalRejectedNotification).toHaveBeenCalledWith('proposal-1');
    });

    it('should reject selection by non-owner', async () => {
      const endedAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: mockAuctionSettings,
        proposals: [mockProposal1],
        createdAt: new Date(),
        endedAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(endedAuction);

      await expect(
        auctionService.selectWinningProposal('auction-123', 'proposal-1', 'user-456') // Wrong user
      ).rejects.toThrow('Only auction owner can select winner');
    });

    it('should reject selection for active auction', async () => {
      const activeAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockAuctionSettings,
        proposals: [mockProposal1],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(activeAuction);

      await expect(
        auctionService.selectWinningProposal('auction-123', 'proposal-1', 'user-123')
      ).rejects.toThrow('Cannot select winner for active auction');
    });
  });

  describe('handleAuctionTimeout', () => {
    it('should auto-select highest cash offer on timeout', async () => {
      const proposal1: AuctionProposal = {
        id: 'proposal-1',
        auctionId: 'auction-123',
        proposerId: 'user-456',
        proposalType: 'cash',
        cashOffer: { amount: 250, currency: 'USD', paymentMethodId: 'pm-1', escrowRequired: true },
        status: 'pending',
        submittedAt: new Date(),
        blockchain: { transactionId: 'tx-1' },
      };

      const proposal2: AuctionProposal = {
        id: 'proposal-2',
        auctionId: 'auction-123',
        proposerId: 'user-789',
        proposalType: 'cash',
        cashOffer: { amount: 350, currency: 'USD', paymentMethodId: 'pm-2', escrowRequired: true },
        status: 'pending',
        submittedAt: new Date(),
        blockchain: { transactionId: 'tx-2' },
      };

      const timedOutAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: { ...mockAuctionSettings, autoSelectAfterHours: 24 },
        proposals: [proposal1, proposal2],
        createdAt: new Date(),
        endedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // Ended 25 hours ago
        blockchain: { creationTransactionId: 'tx-123' },
      };

      const autoSelectedAuction: SwapAuction = {
        ...timedOutAuction,
        winningProposalId: 'proposal-2',
        autoSelected: true,
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(timedOutAuction);
      mockAuctionRepository.prototype.autoSelectWinner = vi.fn().mockResolvedValue(autoSelectedAuction);
      mockNotificationService.prototype.sendAutoSelectionNotification = vi.fn();

      const result = await auctionService.handleAuctionTimeout('auction-123');

      expect(result.winningProposalId).toBe('proposal-2'); // Highest cash offer
      expect(result.autoSelected).toBe(true);
      expect(mockNotificationService.prototype.sendAutoSelectionNotification).toHaveBeenCalled();
    });

    it('should convert to first-match mode when no proposals exist', async () => {
      const emptyAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'ended',
        settings: mockAuctionSettings,
        proposals: [],
        createdAt: new Date(),
        endedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
        blockchain: { creationTransactionId: 'tx-123' },
      };

      mockAuctionRepository.prototype.findById = vi.fn().mockResolvedValue(emptyAuction);
      mockSwapRepository.prototype.convertToFirstMatch = vi.fn();
      mockNotificationService.prototype.sendAuctionConvertedNotification = vi.fn();

      await auctionService.handleAuctionTimeout('auction-123');

      expect(mockSwapRepository.prototype.convertToFirstMatch).toHaveBeenCalledWith('swap-123');
      expect(mockNotificationService.prototype.sendAuctionConvertedNotification).toHaveBeenCalled();
    });
  });

  describe('getAuctionProposals', () => {
    it('should return proposals sorted by value', async () => {
      const proposals: AuctionProposal[] = [
        {
          id: 'proposal-1',
          auctionId: 'auction-123',
          proposerId: 'user-456',
          proposalType: 'cash',
          cashOffer: { amount: 200, currency: 'USD', paymentMethodId: 'pm-1', escrowRequired: true },
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-1' },
        },
        {
          id: 'proposal-2',
          auctionId: 'auction-123',
          proposerId: 'user-789',
          proposalType: 'cash',
          cashOffer: { amount: 350, currency: 'USD', paymentMethodId: 'pm-2', escrowRequired: true },
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-2' },
        },
      ];

      mockAuctionRepository.prototype.getProposals = vi.fn().mockResolvedValue(proposals);

      const result = await auctionService.getAuctionProposals('auction-123');

      expect(result).toHaveLength(2);
      expect(result[0].cashOffer?.amount).toBe(350); // Highest first
      expect(result[1].cashOffer?.amount).toBe(200);
    });

    it('should group proposals by type', async () => {
      const mixedProposals: AuctionProposal[] = [
        {
          id: 'proposal-booking',
          auctionId: 'auction-123',
          proposerId: 'user-456',
          proposalType: 'booking',
          bookingId: 'booking-456',
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-booking' },
        },
        {
          id: 'proposal-cash',
          auctionId: 'auction-123',
          proposerId: 'user-789',
          proposalType: 'cash',
          cashOffer: { amount: 300, currency: 'USD', paymentMethodId: 'pm-1', escrowRequired: true },
          status: 'pending',
          submittedAt: new Date(),
          blockchain: { transactionId: 'tx-cash' },
        },
      ];

      mockAuctionRepository.prototype.getProposals = vi.fn().mockResolvedValue(mixedProposals);

      const result = await auctionService.getAuctionProposals('auction-123', { groupByType: true });

      expect(result.bookingProposals).toHaveLength(1);
      expect(result.cashProposals).toHaveLength(1);
      expect(result.bookingProposals[0].proposalType).toBe('booking');
      expect(result.cashProposals[0].proposalType).toBe('cash');
    });
  });
});