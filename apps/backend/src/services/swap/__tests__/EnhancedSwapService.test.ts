import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwapProposalService } from '../SwapProposalService';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { AuctionRepository } from '../../../database/repositories/AuctionRepository';
import { BookingService } from '../../booking/BookingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';
import { PaymentProcessingService } from '../../payment/PaymentProcessingService';
import { AuctionManagementService } from '../../auction/AuctionManagementService';
import { 
  EnhancedCreateSwapRequest,
  EnhancedSwap,
  PaymentTypePreference,
  AcceptanceStrategy,
  CreateEnhancedProposalRequest,
  Booking,
  SwapAuction
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../../database/repositories/AuctionRepository');
vi.mock('../../booking/BookingService');
vi.mock('../../hedera/HederaService');
vi.mock('../../notification/NotificationService');
vi.mock('../../payment/PaymentProcessingService');
vi.mock('../../auction/AuctionManagementService');

describe('EnhancedSwapService', () => {
  let swapService: SwapProposalService;
  let mockSwapRepository: any;
  let mockAuctionRepository: any;
  let mockBookingService: any;
  let mockHederaService: any;
  let mockNotificationService: any;
  let mockPaymentService: any;
  let mockAuctionService: any;

  beforeEach(() => {
    mockSwapRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findPendingProposalBetweenBookings: vi.fn(),
      updateBlockchainInfo: vi.fn(),
      findSwapsByFilters: vi.fn(),
    };

    mockAuctionRepository = {
      findBySwapId: vi.fn(),
      createAuction: vi.fn(),
    };

    mockBookingService = {
      getBookingById: vi.fn(),
      lockBooking: vi.fn(),
      unlockBooking: vi.fn(),
    };

    mockHederaService = {
      submitTransaction: vi.fn(),
    };

    mockNotificationService = {
      sendSwapProposalNotification: vi.fn(),
      sendEnhancedSwapCreatedNotification: vi.fn(),
    };

    mockPaymentService = {
      validateCashOffer: vi.fn(),
      createEscrow: vi.fn(),
    };

    mockAuctionService = {
      validateAuctionTiming: vi.fn(),
      createEnhancedAuction: vi.fn(),
      isLastMinuteBooking: vi.fn(),
    };

    swapService = new SwapProposalService(
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService,
      mockPaymentService,
      mockAuctionService
    );
  });

  describe('createEnhancedSwap', () => {
    const mockBooking: Booking = {
      id: 'booking-123',
      userId: 'user-123',
      type: 'hotel',
      title: 'Paris Hotel',
      description: 'Nice hotel in Paris',
      location: { city: 'Paris', country: 'France' },
      dateRange: {
        checkIn: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks from now
        checkOut: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      },
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

    const paymentTypes: PaymentTypePreference = {
      bookingExchange: true,
      cashPayment: true,
      minimumCashAmount: 200,
      preferredCashAmount: 400,
    };

    const auctionStrategy: AcceptanceStrategy = {
      type: 'auction',
      auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      autoSelectHighest: true,
    };

    const firstMatchStrategy: AcceptanceStrategy = {
      type: 'first_match',
    };

    it('should create enhanced swap with auction mode successfully', async () => {
      const request: EnhancedCreateSwapRequest = {
        sourceBookingId: 'booking-123',
        title: 'Paris Hotel Swap',
        description: 'Looking to swap my Paris hotel booking',
        paymentTypes,
        acceptanceStrategy: auctionStrategy,
        auctionSettings: {
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 200,
          autoSelectAfterHours: 24,
        },
        swapPreferences: {
          preferredLocations: ['London', 'Rome'],
          additionalRequirements: ['Same star rating'],
        },
        expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      const mockEnhancedSwap: EnhancedSwap = {
        id: 'swap-123',
        sourceBookingId: 'booking-123',
        targetBookingId: '',
        proposerId: 'user-123',
        ownerId: 'user-123',
        status: 'pending',
        terms: {
          conditions: ['Same star rating'],
          expiresAt: request.expirationDate,
        },
        blockchain: { proposalTransactionId: 'tx-123' },
        timeline: { proposedAt: new Date() },
        paymentTypes,
        acceptanceStrategy: auctionStrategy,
        auctionId: 'auction-123',
        cashDetails: {
          enabled: true,
          minimumAmount: 200,
          preferredAmount: 400,
          currency: 'USD',
          escrowRequired: true,
          platformFeePercentage: 5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: request.auctionSettings!,
        proposals: [],
        blockchain: { creationTransactionId: 'tx-auction-123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking);
      mockAuctionService.isLastMinuteBooking.mockResolvedValue(false);
      mockAuctionService.validateAuctionTiming.mockResolvedValue({
        isValid: true,
        errors: [],
        isLastMinute: false,
        minimumEndDate: new Date(),
        eventDate: mockBooking.dateRange.checkIn,
        auctionEndDate: request.auctionSettings!.endDate,
      });
      mockSwapRepository.create.mockResolvedValue(mockEnhancedSwap);
      mockAuctionService.createEnhancedAuction.mockResolvedValue(mockAuction);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await swapService.createEnhancedSwap(request);

      expect(result.swap.paymentTypes).toEqual(paymentTypes);
      expect(result.swap.acceptanceStrategy).toEqual(auctionStrategy);
      expect(result.swap.auctionId).toBe('auction-123');
      expect(result.auction).toEqual(mockAuction);
      expect(mockAuctionService.createEnhancedAuction).toHaveBeenCalledWith(
        'swap-123',
        request.auctionSettings
      );
      expect(mockNotificationService.sendEnhancedSwapCreatedNotification).toHaveBeenCalled();
    });

    it('should create enhanced swap with first-match mode successfully', async () => {
      const request: EnhancedCreateSwapRequest = {
        sourceBookingId: 'booking-123',
        title: 'Paris Hotel Swap',
        description: 'Looking to swap my Paris hotel booking',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false, // Only booking exchange
        },
        acceptanceStrategy: firstMatchStrategy,
        swapPreferences: {
          preferredLocations: ['London'],
        },
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const mockEnhancedSwap: EnhancedSwap = {
        id: 'swap-456',
        sourceBookingId: 'booking-123',
        targetBookingId: '',
        proposerId: 'user-123',
        ownerId: 'user-123',
        status: 'pending',
        terms: {
          conditions: [],
          expiresAt: request.expirationDate,
        },
        blockchain: { proposalTransactionId: 'tx-456' },
        timeline: { proposedAt: new Date() },
        paymentTypes: request.paymentTypes,
        acceptanceStrategy: firstMatchStrategy,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking);
      mockSwapRepository.create.mockResolvedValue(mockEnhancedSwap);
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-456',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await swapService.createEnhancedSwap(request);

      expect(result.swap.acceptanceStrategy.type).toBe('first_match');
      expect(result.swap.auctionId).toBeUndefined();
      expect(result.auction).toBeUndefined();
      expect(mockAuctionService.createEnhancedAuction).not.toHaveBeenCalled();
    });

    it('should reject auction mode for last-minute bookings', async () => {
      const lastMinuteBooking = {
        ...mockBooking,
        dateRange: {
          checkIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      };

      const request: EnhancedCreateSwapRequest = {
        sourceBookingId: 'booking-123',
        title: 'Last Minute Swap',
        description: 'Need to swap urgently',
        paymentTypes,
        acceptanceStrategy: auctionStrategy,
        auctionSettings: {
          endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      };

      mockBookingService.getBookingById.mockResolvedValue(lastMinuteBooking);
      mockAuctionService.isLastMinuteBooking.mockResolvedValue(true);

      await expect(swapService.createEnhancedSwap(request))
        .rejects.toThrow('Auction mode is not available for bookings less than one week away');
    });

    it('should validate cash payment configuration', async () => {
      const request: EnhancedCreateSwapRequest = {
        sourceBookingId: 'booking-123',
        title: 'Cash Enabled Swap',
        description: 'Accepting cash offers',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 50, // Below platform minimum
        },
        acceptanceStrategy: firstMatchStrategy,
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking);

      await expect(swapService.createEnhancedSwap(request))
        .rejects.toThrow('Minimum cash amount must be at least 100 USD');
    });

    it('should handle auction timing validation errors', async () => {
      const request: EnhancedCreateSwapRequest = {
        sourceBookingId: 'booking-123',
        title: 'Invalid Timing Swap',
        description: 'Auction with bad timing',
        paymentTypes,
        acceptanceStrategy: auctionStrategy,
        auctionSettings: {
          endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // Too close to event
          allowBookingProposals: true,
          allowCashProposals: true,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking);
      mockAuctionService.isLastMinuteBooking.mockResolvedValue(false);
      mockAuctionService.validateAuctionTiming.mockResolvedValue({
        isValid: false,
        errors: ['Auction must end at least one week before the event'],
        isLastMinute: false,
        minimumEndDate: new Date(),
        eventDate: mockBooking.dateRange.checkIn,
        auctionEndDate: request.auctionSettings!.endDate,
      });

      await expect(swapService.createEnhancedSwap(request))
        .rejects.toThrow('Invalid auction timing: Auction must end at least one week before the event');
    });
  });

  describe('createEnhancedProposal', () => {
    const mockSwap: EnhancedSwap = {
      id: 'swap-123',
      sourceBookingId: 'booking-456',
      targetBookingId: '',
      proposerId: 'user-456',
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
        minimumCashAmount: 200,
      },
      acceptanceStrategy: { type: 'first_match' },
      cashDetails: {
        enabled: true,
        minimumAmount: 200,
        currency: 'USD',
        escrowRequired: true,
        platformFeePercentage: 5,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create booking proposal for enhanced swap', async () => {
      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'booking',
        bookingId: 'booking-789',
        message: 'Perfect match for your booking',
        conditions: ['Same check-in date'],
      };

      const mockProposerBooking: Booking = {
        id: 'booking-789',
        userId: 'user-789',
        type: 'hotel',
        title: 'London Hotel',
        description: 'Great hotel in London',
        location: { city: 'London', country: 'UK' },
        dateRange: {
          checkIn: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
          checkOut: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
        },
        originalPrice: 400,
        swapValue: 380,
        providerDetails: {
          provider: 'expedia.com',
          confirmationNumber: 'XYZ789',
          bookingReference: 'REF789',
        },
        verification: { status: 'verified', documents: [] },
        blockchain: { topicId: 'topic-789' },
        status: 'available',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockBookingService.getBookingById.mockResolvedValue(mockProposerBooking);
      mockBookingService.lockBooking.mockResolvedValue({
        ...mockProposerBooking,
        status: 'locked',
      });
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-proposal-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await swapService.createEnhancedProposal(proposalRequest, 'user-789');

      expect(result.proposalType).toBe('booking');
      expect(result.bookingId).toBe('booking-789');
      expect(mockBookingService.lockBooking).toHaveBeenCalledWith('booking-789', 'user-789');
      expect(mockNotificationService.sendSwapProposalNotification).toHaveBeenCalled();
    });

    it('should create cash proposal for enhanced swap', async () => {
      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'cash',
        cashOffer: {
          amount: 300,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        message: 'Cash offer for your booking',
        conditions: [],
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockPaymentService.validateCashOffer.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        estimatedFees: {
          platformFee: 15,
          processingFee: 5,
          totalFees: 20,
          netAmount: 280,
        },
        requiresEscrow: true,
      });
      mockPaymentService.createEscrow.mockResolvedValue({
        escrowId: 'escrow-123',
        status: 'created',
        amount: 300,
        currency: 'USD',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      mockHederaService.submitTransaction.mockResolvedValue({
        transactionId: 'tx-cash-proposal-123',
        consensusTimestamp: '2024-01-01T00:00:00Z',
      });

      const result = await swapService.createEnhancedProposal(proposalRequest, 'user-789');

      expect(result.proposalType).toBe('cash');
      expect(result.cashOffer?.amount).toBe(300);
      expect(result.escrowId).toBe('escrow-123');
      expect(mockPaymentService.validateCashOffer).toHaveBeenCalledWith(
        300, 'USD', 200, 'pm-123', 'user-789'
      );
      expect(mockPaymentService.createEscrow).toHaveBeenCalled();
    });

    it('should reject cash proposal when not allowed', async () => {
      const bookingOnlySwap = {
        ...mockSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false, // Cash not allowed
        },
      };

      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'cash',
        cashOffer: {
          amount: 300,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        conditions: [],
      };

      mockSwapRepository.findById.mockResolvedValue(bookingOnlySwap);

      await expect(swapService.createEnhancedProposal(proposalRequest, 'user-789'))
        .rejects.toThrow('Cash proposals are not accepted for this swap');
    });

    it('should reject cash proposal below minimum amount', async () => {
      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'cash',
        cashOffer: {
          amount: 150, // Below minimum of 200
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        conditions: [],
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockPaymentService.validateCashOffer.mockResolvedValue({
        isValid: false,
        errors: ['Amount must be at least 200 USD as specified by swap owner'],
        warnings: [],
        estimatedFees: { platformFee: 0, processingFee: 0, totalFees: 0, netAmount: 0 },
        requiresEscrow: false,
      });

      await expect(swapService.createEnhancedProposal(proposalRequest, 'user-789'))
        .rejects.toThrow('Cash offer validation failed: Amount must be at least 200 USD as specified by swap owner');
    });

    it('should reject booking proposal when not allowed', async () => {
      const cashOnlySwap = {
        ...mockSwap,
        paymentTypes: {
          bookingExchange: false, // Booking exchange not allowed
          cashPayment: true,
        },
      };

      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'booking',
        bookingId: 'booking-789',
        conditions: [],
      };

      mockSwapRepository.findById.mockResolvedValue(cashOnlySwap);

      await expect(swapService.createEnhancedProposal(proposalRequest, 'user-789'))
        .rejects.toThrow('Booking proposals are not accepted for this swap');
    });
  });

  describe('Enhanced Swap Filtering', () => {
    it('should filter swaps by payment types', async () => {
      const filters = {
        paymentTypes: ['cash'] as const,
        priceRange: { min: 100, max: 500 },
      };

      const mockSwaps: EnhancedSwap[] = [
        {
          id: 'swap-1',
          sourceBookingId: 'booking-1',
          targetBookingId: '',
          proposerId: 'user-1',
          ownerId: 'user-1',
          status: 'pending',
          terms: { conditions: [], expiresAt: new Date() },
          blockchain: { proposalTransactionId: 'tx-1' },
          timeline: { proposedAt: new Date() },
          paymentTypes: { bookingExchange: true, cashPayment: true, minimumCashAmount: 200 },
          acceptanceStrategy: { type: 'first_match' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockSwapRepository.findSwapsByFilters.mockResolvedValue(mockSwaps);

      const result = await swapService.findEnhancedSwaps(filters);

      expect(result).toEqual(mockSwaps);
      expect(mockSwapRepository.findSwapsByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentTypes: ['cash'],
          priceRange: { min: 100, max: 500 },
        })
      );
    });

    it('should filter swaps by acceptance strategy', async () => {
      const filters = {
        acceptanceStrategy: ['auction'] as const,
        auctionStatus: ['active'] as const,
      };

      mockSwapRepository.findSwapsByFilters.mockResolvedValue([]);

      await swapService.findEnhancedSwaps(filters);

      expect(mockSwapRepository.findSwapsByFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          acceptanceStrategy: ['auction'],
          auctionStatus: ['active'],
        })
      );
    });
  });
});