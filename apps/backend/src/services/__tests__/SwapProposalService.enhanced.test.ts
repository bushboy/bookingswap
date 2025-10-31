import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SwapProposalService } from '../swap/SwapProposalService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { BookingService } from '../booking/BookingService';
import { AuctionManagementService } from '../auction/AuctionManagementService';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { NotificationService } from '../notification/NotificationService';
import { AuctionNotificationService } from '../notification/AuctionNotificationService';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { TimingNotificationService } from '../notification/TimingNotificationService';
import { HederaService } from '../hedera/HederaService';
import { 
  EnhancedSwap,
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
  SwapAuction,
  PaymentTypePreference,
  AcceptanceStrategy,
  AuctionSettings,
  Booking,
  BookingType
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/SwapRepository');
vi.mock('../../database/repositories/AuctionRepository');
vi.mock('../booking/BookingService');
vi.mock('../auction/AuctionManagementService');
vi.mock('../payment/PaymentProcessingService');
vi.mock('../notification/NotificationService');
vi.mock('../notification/AuctionNotificationService');
vi.mock('../notification/PaymentNotificationService');
vi.mock('../notification/TimingNotificationService');
vi.mock('../hedera/HederaService');

describe('SwapProposalService - Enhanced Functionality', () => {
  let swapProposalService: SwapProposalService;
  let mockSwapRepository: Mock;
  let mockAuctionRepository: Mock;
  let mockBookingService: Mock;
  let mockAuctionService: Mock;
  let mockPaymentService: Mock;
  let mockNotificationService: Mock;
  let mockAuctionNotificationService: Mock;
  let mockPaymentNotificationService: Mock;
  let mockTimingNotificationService: Mock;
  let mockHederaService: Mock;

  const mockBooking: Booking = {
    id: 'booking-123',
    userId: 'user-123',
    type: 'hotel' as BookingType,
    title: 'Paris Hotel Stay',
    description: 'Luxury hotel in central Paris',
    location: {
      city: 'Paris',
      country: 'France',
      address: '123 Champs Elysees',
      coordinates: { lat: 48.8566, lng: 2.3522 }
    },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05')
    },
    originalPrice: 800,
    currency: 'EUR',
    bookingReference: 'BK123456',
    provider: 'booking.com',
    status: 'confirmed',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockCreateSwapRequest: EnhancedCreateSwapRequest = {
    sourceBookingId: 'booking-123',
    title: 'Test Enhanced Swap',
    description: 'Testing enhanced swap functionality',
    paymentTypes: {
      bookingExchange: true,
      cashPayment: true,
      minimumCashAmount: 200,
      preferredCashAmount: 300,
    },
    acceptanceStrategy: {
      type: 'auction',
      auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      autoSelectHighest: false,
    },
    auctionSettings: {
      endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      allowBookingProposals: true,
      allowCashProposals: true,
      minimumCashOffer: 200,
      autoSelectAfterHours: 24,
    },
    swapPreferences: {
      preferredLocations: ['London', 'Paris'],
      additionalRequirements: ['Same star rating'],
    },
    expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  };

  const mockEnhancedSwap: EnhancedSwap = {
    id: 'swap-123',
    sourceBookingId: 'booking-123',
    targetBookingId: '',
    proposerId: '',
    ownerId: 'user-123',
    status: 'pending',
    terms: {
      conditions: [],
      expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    },
    blockchain: {
      proposalTransactionId: 'tx-123',
    },
    timeline: {
      proposedAt: new Date(),
    },
    paymentTypes: mockCreateSwapRequest.paymentTypes,
    acceptanceStrategy: mockCreateSwapRequest.acceptanceStrategy,
    auctionId: 'auction-123',
    cashDetails: {
      enabled: true,
      minimumAmount: 200,
      preferredAmount: 300,
      currency: 'USD',
      escrowRequired: true,
      platformFeePercentage: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSwapRepository = vi.mocked(SwapRepository);
    mockAuctionRepository = vi.mocked(AuctionRepository);
    mockBookingService = vi.mocked(BookingService);
    mockAuctionService = vi.mocked(AuctionManagementService);
    mockPaymentService = vi.mocked(PaymentProcessingService);
    mockNotificationService = vi.mocked(NotificationService);
    mockAuctionNotificationService = vi.mocked(AuctionNotificationService);
    mockPaymentNotificationService = vi.mocked(PaymentNotificationService);
    mockTimingNotificationService = vi.mocked(TimingNotificationService);
    mockHederaService = vi.mocked(HederaService);

    swapProposalService = new SwapProposalService(
      mockSwapRepository.prototype,
      mockAuctionRepository.prototype,
      mockBookingService.prototype,
      mockHederaService.prototype,
      mockNotificationService.prototype,
      mockAuctionNotificationService.prototype,
      mockPaymentNotificationService.prototype,
      mockTimingNotificationService.prototype,
      mockAuctionService.prototype,
      mockPaymentService.prototype
    );
  });

  describe('createEnhancedSwapProposal', () => {
    it('should create enhanced swap with auction mode', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockCreateSwapRequest.auctionSettings!,
        proposals: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        blockchain: { creationTransactionId: 'tx-auction-123' },
      };

      // Mock the booking service
      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);
      
      // Mock repository calls
      mockSwapRepository.prototype.createEnhancedSwap = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockSwapRepository.prototype.updateSwapWithAuction = vi.fn().mockResolvedValue({
        ...mockEnhancedSwap,
        auctionId: 'auction-123'
      });
      
      // Mock auction service
      mockAuctionService.prototype.createAuction = vi.fn().mockResolvedValue(mockAuction);
      
      // Mock blockchain service
      mockHederaService.prototype.recordTransaction = vi.fn().mockResolvedValue('tx-123');
      
      // Mock notification service
      mockNotificationService.prototype.sendSwapCreatedNotification = vi.fn();

      const result = await swapProposalService.createEnhancedSwapProposal(mockCreateSwapRequest);

      expect(result.swap).toBeDefined();
      expect(result.auction).toEqual(mockAuction);
      expect(mockSwapRepository.prototype.createEnhancedSwap).toHaveBeenCalled();
      expect(mockAuctionService.prototype.createAuction).toHaveBeenCalledWith(
        'swap-123',
        mockCreateSwapRequest.auctionSettings
      );
      expect(mockHederaService.prototype.recordTransaction).toHaveBeenCalled();
    });

    it('should create enhanced swap with first match mode', async () => {
      const firstMatchRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        acceptanceStrategy: {
          type: 'first_match',
        },
        auctionSettings: undefined,
      };

      const firstMatchSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        acceptanceStrategy: { type: 'first_match' },
        auctionId: undefined,
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);
      mockSwapRepository.prototype.createEnhancedSwap = vi.fn().mockResolvedValue(firstMatchSwap);
      mockHederaService.prototype.recordTransaction = vi.fn().mockResolvedValue('tx-123');
      mockNotificationService.prototype.sendSwapCreatedNotification = vi.fn();

      const result = await swapProposalService.createEnhancedSwapProposal(firstMatchRequest);

      expect(result.swap).toEqual(firstMatchSwap);
      expect(result.auction).toBeUndefined();
      expect(mockAuctionService.prototype.createAuction).not.toHaveBeenCalled();
    });

    it('should validate payment type configuration', async () => {
      const invalidRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        paymentTypes: {
          bookingExchange: false,
          cashPayment: false, // Both disabled
        },
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);

      await expect(
        swapProposalService.createEnhancedSwapProposal(invalidRequest)
      ).rejects.toThrow('At least one payment type must be enabled');
    });

    it('should validate cash payment configuration', async () => {
      const invalidCashRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: undefined, // Missing required field
        },
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);

      await expect(
        swapProposalService.createEnhancedSwapProposal(invalidCashRequest)
      ).rejects.toThrow('Minimum cash amount required when cash payments enabled');
    });

    it('should validate auction timing requirements', async () => {
      const eventDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const auctionEndDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now (too close to event)
      
      const invalidTimingRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate,
        },
        auctionSettings: {
          ...mockCreateSwapRequest.auctionSettings!,
          endDate: auctionEndDate,
        },
      };

      const bookingWithNearEvent: Booking = {
        ...mockBooking,
        dateRange: {
          checkIn: eventDate,
          checkOut: new Date(eventDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(bookingWithNearEvent);

      await expect(
        swapProposalService.createEnhancedSwapProposal(invalidTimingRequest)
      ).rejects.toThrow('Auction must end at least one week before the event date');
    });
  });

  describe('createEnhancedProposal', () => {
    const mockBookingProposal: CreateEnhancedProposalRequest = {
      swapId: 'swap-123',
      proposalType: 'booking',
      bookingId: 'booking-456',
      message: 'Great booking swap opportunity',
      conditions: ['Same quality level'],
    };

    const mockCashProposal: CreateEnhancedProposalRequest = {
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

    it('should create booking proposal for first-match swap', async () => {
      const firstMatchSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        acceptanceStrategy: { type: 'first_match' },
        paymentTypes: { bookingExchange: true, cashPayment: false },
      };

      const mockProposal = {
        proposalId: 'proposal-123',
        validationResult: {
          isValid: true,
          errors: [],
          warnings: [],
        },
      };

      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(firstMatchSwap);
      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);
      mockSwapRepository.prototype.createProposal = vi.fn().mockResolvedValue({ id: 'proposal-123' });
      mockHederaService.prototype.recordTransaction = vi.fn().mockResolvedValue('tx-proposal-123');
      mockNotificationService.prototype.sendProposalCreatedNotification = vi.fn();

      const result = await swapProposalService.createEnhancedProposal(mockBookingProposal);

      expect(result.proposalId).toBe('proposal-123');
      expect(result.validationResult.isValid).toBe(true);
      expect(mockSwapRepository.prototype.createProposal).toHaveBeenCalled();
      expect(mockHederaService.prototype.recordTransaction).toHaveBeenCalled();
    });

    it('should create cash proposal for cash-enabled swap', async () => {
      const cashEnabledSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200,
        },
      };

      const mockCashProposalResult = {
        proposalId: 'proposal-123',
        validationResult: {
          isValid: true,
          errors: [],
          warnings: [],
          escrowRequired: true,
        },
      };

      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(cashEnabledSwap);
      mockPaymentService.prototype.validateCashOffer = vi.fn().mockResolvedValue({ 
        isValid: true, 
        errors: [],
        warnings: []
      });
      mockPaymentService.prototype.createEscrow = vi.fn().mockResolvedValue({ id: 'escrow-123' });
      mockSwapRepository.prototype.createProposal = vi.fn().mockResolvedValue({ id: 'proposal-123' });
      mockHederaService.prototype.recordTransaction = vi.fn().mockResolvedValue('tx-proposal-123');

      const result = await swapProposalService.createEnhancedProposal(mockCashProposal);

      expect(result.proposalId).toBe('proposal-123');
      expect(result.validationResult.isValid).toBe(true);
      expect(mockPaymentService.prototype.validateCashOffer).toHaveBeenCalledWith(mockCashProposal.cashOffer);
      expect(mockPaymentService.prototype.createEscrow).toHaveBeenCalled();
    });

    it('should reject cash proposal on booking-only swap', async () => {
      const bookingOnlySwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: true, cashPayment: false },
      };

      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(bookingOnlySwap);

      await expect(
        swapProposalService.createEnhancedProposal(mockCashProposal)
      ).rejects.toThrow('Cash proposals not accepted for this swap');
    });

    it('should validate cash offer meets minimum amount', async () => {
      const cashEnabledSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 500, // Higher than offer
        },
      };

      const lowCashProposal: CreateEnhancedProposalRequest = {
        ...mockCashProposal,
        cashOffer: {
          ...mockCashProposal.cashOffer!,
          amount: 300, // Below minimum
        },
      };

      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(cashEnabledSwap);

      await expect(
        swapProposalService.createEnhancedProposal(lowCashProposal)
      ).rejects.toThrow('Cash offer amount ($300) is below the minimum required ($500)');
    });
  });

  describe('getEnhancedSwapById', () => {
    it('should return enhanced swap by ID', async () => {
      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(mockEnhancedSwap);

      const result = await swapProposalService.getEnhancedSwapById('swap-123');

      expect(result).toEqual(mockEnhancedSwap);
      expect(mockSwapRepository.prototype.findEnhancedById).toHaveBeenCalledWith('swap-123');
    });

    it('should return null for non-existent swap', async () => {
      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(null);

      const result = await swapProposalService.getEnhancedSwapById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        swapProposalService.getEnhancedSwapById('swap-123')
      ).rejects.toThrow('Database error');
    });
  });

  describe('getEnhancedSwaps', () => {
    it('should return filtered enhanced swaps', async () => {
      const mockSwaps = [mockEnhancedSwap];
      const filters = { paymentType: 'cash', status: 'active' };

      mockSwapRepository.prototype.findEnhancedSwaps = vi.fn().mockResolvedValue(mockSwaps);

      const result = await swapProposalService.getEnhancedSwaps(filters, 10, 0);

      expect(result).toEqual(mockSwaps);
      expect(mockSwapRepository.prototype.findEnhancedSwaps).toHaveBeenCalledWith(filters, 10, 0);
    });

    it('should handle empty results', async () => {
      mockSwapRepository.prototype.findEnhancedSwaps = vi.fn().mockResolvedValue([]);

      const result = await swapProposalService.getEnhancedSwaps({}, 10, 0);

      expect(result).toEqual([]);
    });
  });

  describe('auction timing validation', () => {
    it('should validate auction end date is at least one week before event', async () => {
      const eventDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now
      const validAuctionEndDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now (valid)
      
      const validRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: validAuctionEndDate,
        },
        auctionSettings: {
          ...mockCreateSwapRequest.auctionSettings!,
          endDate: validAuctionEndDate,
        },
      };

      const bookingWithFutureEvent: Booking = {
        ...mockBooking,
        dateRange: {
          checkIn: eventDate,
          checkOut: new Date(eventDate.getTime() + 4 * 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(bookingWithFutureEvent);
      mockSwapRepository.prototype.createEnhancedSwap = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockHederaService.prototype.recordTransaction = vi.fn().mockResolvedValue('tx-123');
      mockNotificationService.prototype.sendSwapCreatedNotification = vi.fn();

      const result = await swapProposalService.createEnhancedSwapProposal(validRequest);

      expect(result.swap).toBeDefined();
      expect(mockSwapRepository.prototype.createEnhancedSwap).toHaveBeenCalled();
    });

    it('should reject auction for last-minute bookings', async () => {
      const nearEventDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      
      const lastMinuteRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        acceptanceStrategy: {
          type: 'auction',
        },
      };

      const lastMinuteBooking: Booking = {
        ...mockBooking,
        dateRange: {
          checkIn: nearEventDate,
          checkOut: new Date(nearEventDate.getTime() + 2 * 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(lastMinuteBooking);

      await expect(
        swapProposalService.createEnhancedSwapProposal(lastMinuteRequest)
      ).rejects.toThrow('Auction mode not available for bookings less than one week away');
    });
  });

  describe('error handling', () => {
    it('should handle booking service errors', async () => {
      mockBookingService.prototype.getBookingById = vi.fn().mockRejectedValue(new Error('Booking not found'));

      await expect(
        swapProposalService.createEnhancedSwapProposal(mockCreateSwapRequest)
      ).rejects.toThrow('Booking not found');
    });

    it('should handle repository errors gracefully', async () => {
      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);
      mockSwapRepository.prototype.createEnhancedSwap = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        swapProposalService.createEnhancedSwapProposal(mockCreateSwapRequest)
      ).rejects.toThrow('Database error');
    });

    it('should handle auction service errors', async () => {
      mockBookingService.prototype.getBookingById = vi.fn().mockResolvedValue(mockBooking);
      mockSwapRepository.prototype.createEnhancedSwap = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockAuctionService.prototype.createAuction = vi.fn().mockRejectedValue(new Error('Auction creation failed'));

      await expect(
        swapProposalService.createEnhancedSwapProposal(mockCreateSwapRequest)
      ).rejects.toThrow('Auction creation failed');
    });

    it('should handle payment service errors', async () => {
      const cashEnabledSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: true, cashPayment: true, minimumCashAmount: 200 },
      };

      mockSwapRepository.prototype.findEnhancedById = vi.fn().mockResolvedValue(cashEnabledSwap);
      mockPaymentService.prototype.validateCashOffer = vi.fn().mockRejectedValue(new Error('Payment validation failed'));

      const mockCashProposal: CreateEnhancedProposalRequest = {
        swapId: 'swap-123',
        proposalType: 'cash',
        cashOffer: {
          amount: 300,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        },
        message: 'Cash offer',
        conditions: [],
      };

      await expect(
        swapProposalService.createEnhancedProposal(mockCashProposal)
      ).rejects.toThrow('Payment validation failed');
    });
  });
});