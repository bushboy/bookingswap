import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { SwapProposalService } from '../swap/SwapProposalService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { AuctionService } from '../auction/AuctionService';
import { PaymentService } from '../payment/PaymentService';
import { NotificationService } from '../notification/NotificationService';
import { HederaService } from '../hedera/HederaService';
import { 
  EnhancedSwap,
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
  SwapAuction,
  PaymentTypePreference,
  AcceptanceStrategy,
  AuctionSettings
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/SwapRepository');
vi.mock('../auction/AuctionService');
vi.mock('../payment/PaymentService');
vi.mock('../notification/NotificationService');
vi.mock('../hedera/HederaService');

describe('EnhancedSwapService', () => {
  let swapProposalService: SwapProposalService;
  let mockSwapRepository: Mock;
  let mockAuctionService: Mock;
  let mockPaymentService: Mock;
  let mockNotificationService: Mock;
  let mockHederaService: Mock;

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
    ownerId: 'user-123',
    title: 'Test Enhanced Swap',
    description: 'Testing enhanced swap functionality',
    paymentTypes: mockCreateSwapRequest.paymentTypes,
    acceptanceStrategy: mockCreateSwapRequest.acceptanceStrategy,
    status: 'active',
    createdAt: new Date(),
    expirationDate: mockCreateSwapRequest.expirationDate,
    swapPreferences: mockCreateSwapRequest.swapPreferences,
    blockchain: {
      topicId: 'topic-123',
      creationTransactionId: 'tx-123',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSwapRepository = vi.mocked(SwapRepository);
    mockAuctionService = vi.mocked(AuctionService);
    mockPaymentService = vi.mocked(PaymentService);
    mockNotificationService = vi.mocked(NotificationService);
    mockHederaService = vi.mocked(HederaService);

    swapProposalService = new SwapProposalService(
      mockSwapRepository.prototype,
      mockAuctionService.prototype,
      mockPaymentService.prototype,
      mockNotificationService.prototype,
      mockHederaService.prototype
    );
  });

  describe('createEnhancedSwap', () => {
    it('should create enhanced swap with auction mode', async () => {
      const mockAuction: SwapAuction = {
        id: 'auction-123',
        swapId: 'swap-123',
        ownerId: 'user-123',
        status: 'active',
        settings: mockCreateSwapRequest.auctionSettings!,
        proposals: [],
        createdAt: new Date(),
        blockchain: { creationTransactionId: 'tx-auction-123' },
      };

      mockSwapRepository.prototype.create = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockAuctionService.prototype.createAuction = vi.fn().mockResolvedValue(mockAuction);
      mockHederaService.prototype.recordEnhancedSwapCreation = vi.fn().mockResolvedValue('tx-123');
      mockNotificationService.prototype.sendSwapCreatedNotification = vi.fn();

      const result = await swapProposalService.createEnhancedSwapProposal(mockCreateSwapRequest);

      expect(result.swap).toEqual(mockEnhancedSwap);
      expect(result.auction).toEqual(mockAuction);
      expect(mockSwapRepository.prototype.create).toHaveBeenCalledWith({
        ...mockCreateSwapRequest,
        ownerId: 'user-123',
        status: 'active',
      });
      expect(mockAuctionService.prototype.createAuction).toHaveBeenCalledWith(
        'swap-123',
        mockCreateSwapRequest.auctionSettings
      );
      expect(mockHederaService.prototype.recordEnhancedSwapCreation).toHaveBeenCalled();
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
      };

      mockSwapRepository.prototype.create = vi.fn().mockResolvedValue(firstMatchSwap);
      mockHederaService.prototype.recordEnhancedSwapCreation = vi.fn().mockResolvedValue('tx-123');
      mockNotificationService.prototype.sendSwapCreatedNotification = vi.fn();

      const result = await enhancedSwapService.createEnhancedSwap(firstMatchRequest, 'user-123');

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

      await expect(
        enhancedSwapService.createEnhancedSwap(invalidRequest, 'user-123')
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

      await expect(
        enhancedSwapService.createEnhancedSwap(invalidCashRequest, 'user-123')
      ).rejects.toThrow('Minimum cash amount required when cash payments enabled');
    });

    it('should validate auction settings when auction mode selected', async () => {
      const invalidAuctionRequest: EnhancedCreateSwapRequest = {
        ...mockCreateSwapRequest,
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
        auctionSettings: undefined, // Missing auction settings
      };

      await expect(
        enhancedSwapService.createEnhancedSwap(invalidAuctionRequest, 'user-123')
      ).rejects.toThrow('Auction settings required for auction mode');
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
        id: 'proposal-123',
        swapId: 'swap-123',
        proposerId: 'user-456',
        proposalType: 'booking' as const,
        bookingId: 'booking-456',
        status: 'pending' as const,
        createdAt: new Date(),
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(firstMatchSwap);
      mockSwapRepository.prototype.createProposal = vi.fn().mockResolvedValue(mockProposal);
      mockHederaService.prototype.recordProposalCreation = vi.fn().mockResolvedValue('tx-proposal-123');
      mockNotificationService.prototype.sendProposalCreatedNotification = vi.fn();

      const result = await enhancedSwapService.createEnhancedProposal(mockBookingProposal, 'user-456');

      expect(result).toEqual(mockProposal);
      expect(mockSwapRepository.prototype.createProposal).toHaveBeenCalledWith(mockBookingProposal, 'user-456');
      expect(mockHederaService.prototype.recordProposalCreation).toHaveBeenCalled();
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
        id: 'proposal-123',
        swapId: 'swap-123',
        proposerId: 'user-456',
        proposalType: 'cash' as const,
        cashOffer: mockCashProposal.cashOffer,
        status: 'pending' as const,
        escrowId: 'escrow-123',
        createdAt: new Date(),
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(cashEnabledSwap);
      mockPaymentService.prototype.validateCashOffer = vi.fn().mockResolvedValue({ isValid: true, errors: [] });
      mockPaymentService.prototype.createEscrow = vi.fn().mockResolvedValue({ id: 'escrow-123' });
      mockSwapRepository.prototype.createProposal = vi.fn().mockResolvedValue(mockCashProposalResult);
      mockHederaService.prototype.recordProposalCreation = vi.fn().mockResolvedValue('tx-proposal-123');

      const result = await enhancedSwapService.createEnhancedProposal(mockCashProposal, 'user-456');

      expect(result).toEqual(mockCashProposalResult);
      expect(mockPaymentService.prototype.validateCashOffer).toHaveBeenCalledWith(mockCashProposal.cashOffer);
      expect(mockPaymentService.prototype.createEscrow).toHaveBeenCalled();
    });

    it('should reject cash proposal on booking-only swap', async () => {
      const bookingOnlySwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: true, cashPayment: false },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(bookingOnlySwap);

      await expect(
        enhancedSwapService.createEnhancedProposal(mockCashProposal, 'user-456')
      ).rejects.toThrow('Cash proposals not accepted for this swap');
    });

    it('should reject booking proposal on cash-only swap', async () => {
      const cashOnlySwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: false, cashPayment: true, minimumCashAmount: 200 },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(cashOnlySwap);

      await expect(
        enhancedSwapService.createEnhancedProposal(mockBookingProposal, 'user-456')
      ).rejects.toThrow('Booking proposals not accepted for this swap');
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

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(cashEnabledSwap);

      await expect(
        enhancedSwapService.createEnhancedProposal(lowCashProposal, 'user-456')
      ).rejects.toThrow('Cash offer below minimum amount of $500');
    });

    it('should route auction proposals to auction service', async () => {
      const auctionSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        acceptanceStrategy: { type: 'auction' },
        auctionId: 'auction-123',
      };

      const mockAuctionProposal = {
        id: 'proposal-123',
        auctionId: 'auction-123',
        proposerId: 'user-456',
        proposalType: 'booking' as const,
        bookingId: 'booking-456',
        status: 'pending' as const,
        submittedAt: new Date(),
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(auctionSwap);
      mockAuctionService.prototype.addProposalToAuction = vi.fn().mockResolvedValue(mockAuctionProposal);

      const result = await enhancedSwapService.createEnhancedProposal(mockBookingProposal, 'user-456');

      expect(result).toEqual(mockAuctionProposal);
      expect(mockAuctionService.prototype.addProposalToAuction).toHaveBeenCalledWith(
        'auction-123',
        expect.objectContaining({
          proposerId: 'user-456',
          proposalType: 'booking',
          bookingId: 'booking-456',
        })
      );
    });
  });

  describe('validateCashProposal', () => {
    const mockCashProposalRequest = {
      amount: 300,
      currency: 'USD',
      paymentMethodId: 'pm-123',
      escrowAgreement: true,
    };

    it('should validate valid cash proposal', async () => {
      const cashEnabledSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200,
        },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(cashEnabledSwap);
      mockPaymentService.prototype.validateCashOffer = vi.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      const result = await enhancedSwapService.validateCashProposal('swap-123', mockCashProposalRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cash proposal for booking-only swap', async () => {
      const bookingOnlySwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: true, cashPayment: false },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(bookingOnlySwap);

      const result = await enhancedSwapService.validateCashProposal('swap-123', mockCashProposalRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cash payments not accepted for this swap');
    });

    it('should validate minimum cash amount', async () => {
      const highMinimumSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 500,
        },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(highMinimumSwap);

      const result = await enhancedSwapService.validateCashProposal('swap-123', mockCashProposalRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount below minimum required: $500');
    });
  });

  describe('initiateCashTransaction', () => {
    it('should initiate cash transaction for accepted proposal', async () => {
      const mockTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        amount: 300,
        status: 'processing' as const,
        escrowId: 'escrow-123',
      };

      mockPaymentService.prototype.processPayment = vi.fn().mockResolvedValue(mockTransaction);
      mockNotificationService.prototype.sendPaymentInitiatedNotification = vi.fn();

      const result = await enhancedSwapService.initiateCashTransaction('proposal-123');

      expect(result).toEqual(mockTransaction);
      expect(mockPaymentService.prototype.processPayment).toHaveBeenCalled();
      expect(mockNotificationService.prototype.sendPaymentInitiatedNotification).toHaveBeenCalled();
    });

    it('should handle payment processing failure', async () => {
      mockPaymentService.prototype.processPayment = vi.fn().mockRejectedValue(new Error('Payment failed'));

      await expect(
        enhancedSwapService.initiateCashTransaction('proposal-123')
      ).rejects.toThrow('Failed to initiate cash transaction');
    });
  });

  describe('getEnhancedSwapsByUser', () => {
    it('should return user swaps with payment type filtering', async () => {
      const userSwaps: EnhancedSwap[] = [
        {
          ...mockEnhancedSwap,
          id: 'swap-1',
          paymentTypes: { bookingExchange: true, cashPayment: false },
        },
        {
          ...mockEnhancedSwap,
          id: 'swap-2',
          paymentTypes: { bookingExchange: true, cashPayment: true, minimumCashAmount: 200 },
        },
      ];

      mockSwapRepository.prototype.findByUserId = vi.fn().mockResolvedValue(userSwaps);

      const result = await enhancedSwapService.getEnhancedSwapsByUser('user-123', {
        paymentType: 'cash',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('swap-2');
      expect(result[0].paymentTypes.cashPayment).toBe(true);
    });

    it('should return user swaps with auction status filtering', async () => {
      const userSwaps: EnhancedSwap[] = [
        {
          ...mockEnhancedSwap,
          id: 'swap-1',
          acceptanceStrategy: { type: 'first_match' },
        },
        {
          ...mockEnhancedSwap,
          id: 'swap-2',
          acceptanceStrategy: { type: 'auction' },
          auctionId: 'auction-123',
        },
      ];

      mockSwapRepository.prototype.findByUserId = vi.fn().mockResolvedValue(userSwaps);

      const result = await enhancedSwapService.getEnhancedSwapsByUser('user-123', {
        acceptanceStrategy: 'auction',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('swap-2');
      expect(result[0].acceptanceStrategy.type).toBe('auction');
    });
  });

  describe('updateSwapPreferences', () => {
    it('should update swap preferences', async () => {
      const updatedPreferences = {
        preferredLocations: ['Tokyo', 'Seoul'],
        additionalRequirements: ['Pet-friendly', 'WiFi included'],
      };

      const updatedSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        swapPreferences: updatedPreferences,
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockSwapRepository.prototype.updatePreferences = vi.fn().mockResolvedValue(updatedSwap);
      mockHederaService.prototype.recordSwapUpdate = vi.fn().mockResolvedValue('tx-update-123');

      const result = await enhancedSwapService.updateSwapPreferences(
        'swap-123',
        'user-123',
        updatedPreferences
      );

      expect(result.swapPreferences).toEqual(updatedPreferences);
      expect(mockSwapRepository.prototype.updatePreferences).toHaveBeenCalledWith(
        'swap-123',
        updatedPreferences
      );
      expect(mockHederaService.prototype.recordSwapUpdate).toHaveBeenCalled();
    });

    it('should reject update by non-owner', async () => {
      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(mockEnhancedSwap);

      await expect(
        enhancedSwapService.updateSwapPreferences('swap-123', 'user-456', {
          preferredLocations: ['Tokyo'],
          additionalRequirements: [],
        })
      ).rejects.toThrow('Only swap owner can update preferences');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      mockSwapRepository.prototype.create = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        enhancedSwapService.createEnhancedSwap(mockCreateSwapRequest, 'user-123')
      ).rejects.toThrow('Failed to create enhanced swap');
    });

    it('should handle auction service errors', async () => {
      mockSwapRepository.prototype.create = vi.fn().mockResolvedValue(mockEnhancedSwap);
      mockAuctionService.prototype.createAuction = vi.fn().mockRejectedValue(new Error('Auction error'));

      await expect(
        enhancedSwapService.createEnhancedSwap(mockCreateSwapRequest, 'user-123')
      ).rejects.toThrow('Failed to create auction');
    });

    it('should handle payment service errors', async () => {
      const cashEnabledSwap: EnhancedSwap = {
        ...mockEnhancedSwap,
        paymentTypes: { bookingExchange: true, cashPayment: true, minimumCashAmount: 200 },
      };

      mockSwapRepository.prototype.findById = vi.fn().mockResolvedValue(cashEnabledSwap);
      mockPaymentService.prototype.validateCashOffer = vi.fn().mockRejectedValue(new Error('Payment error'));

      await expect(
        enhancedSwapService.createEnhancedProposal(mockCashProposal, 'user-456')
      ).rejects.toThrow('Payment validation failed');
    });
  });
});