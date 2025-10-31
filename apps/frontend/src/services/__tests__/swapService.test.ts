import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  swapService,
  CreateSwapRequest,
  SwapWithBookings,
  ProposalData,
} from '../swapService';
import {
  Swap,
  SwapStatus,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('SwapService', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockSwap: Swap = {
    id: 'swap1',
    sourceBookingId: 'booking1',
    targetBookingId: 'booking2',
    proposerId: 'user1',
    ownerId: 'user2',
    status: 'pending',
    terms: {
      additionalPayment: 50,
      conditions: ['Flexible dates', 'Same location'],
      expiresAt: new Date('2024-12-31'),
    },
    blockchain: {
      proposalTransactionId: 'tx123',
      executionTransactionId: undefined,
      escrowContractId: undefined,
    },
    timeline: {
      proposedAt: new Date(),
      respondedAt: undefined,
      completedAt: undefined,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSwapWithBookings: SwapWithBookings = {
    ...mockSwap,
    sourceBooking: {
      id: 'booking1',
      userId: 'user1',
      type: 'hotel',
      title: 'Source Hotel',
      description: 'Source booking',
      location: { city: 'NYC', country: 'USA' },
      dateRange: { checkIn: new Date(), checkOut: new Date() },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'Provider1',
        confirmationNumber: 'CONF1',
        bookingReference: 'REF1',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { transactionId: 'tx1', topicId: 'topic1' },
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    targetBooking: {
      id: 'booking2',
      userId: 'user2',
      type: 'hotel',
      title: 'Target Hotel',
      description: 'Target booking',
      location: { city: 'LA', country: 'USA' },
      dateRange: { checkIn: new Date(), checkOut: new Date() },
      originalPrice: 400,
      swapValue: 400,
      providerDetails: {
        provider: 'Provider2',
        confirmationNumber: 'CONF2',
        bookingReference: 'REF2',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { transactionId: 'tx2', topicId: 'topic2' },
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    proposer: {
      id: 'user1',
      walletAddress: 'wallet1',
      verificationLevel: 'verified',
    },
    owner: {
      id: 'user2',
      walletAddress: 'wallet2',
      verificationLevel: 'verified',
    },
  };

  describe('createSwap', () => {
    const validSwapData: CreateSwapRequest = {
      sourceBookingId: 'booking1',
      targetBookingId: 'booking2',
      terms: {
        additionalPayment: 50,
        conditions: ['Flexible dates'],
        expiresAt: new Date('2024-12-31'),
      },
      message: 'Interested in swapping',
    };

    it('should create a swap successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockSwap });

      const result = await swapService.createSwap(validSwapData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps',
        validSwapData
      );
      expect(result).toEqual(mockSwap);
    });

    it('should validate swap data before creating', async () => {
      const invalidData = {
        ...validSwapData,
        sourceBookingId: '',
        terms: {
          ...validSwapData.terms,
          expiresAt: new Date('2020-01-01'), // Past date
        },
      };

      await expect(swapService.createSwap(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should reject swap with same source and target booking', async () => {
      const invalidData = {
        ...validSwapData,
        targetBookingId: 'booking1', // Same as source
      };

      await expect(swapService.createSwap(invalidData)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getSwaps', () => {
    it('should fetch swaps successfully', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwaps });

      const result = await swapService.getSwaps();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps', {
        params: {},
      });
      expect(result).toEqual(mockSwaps);
    });

    it('should fetch swaps with user filter', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwaps });

      const result = await swapService.getSwaps('user1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps', {
        params: { userId: 'user1' },
      });
      expect(result).toEqual(mockSwaps);
    });

    it('should fetch swaps with filters', async () => {
      const mockSwaps = [mockSwapWithBookings];
      const filters = {
        status: ['pending' as SwapStatus],
        bookingType: ['hotel'],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSwaps });

      const result = await swapService.getSwaps('user1', filters);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps', {
        params: {
          userId: 'user1',
          status: 'pending',
          bookingType: 'hotel',
        },
      });
      expect(result).toEqual(mockSwaps);
    });
  });

  describe('getSwap', () => {
    it('should fetch a single swap successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapWithBookings });

      const result = await swapService.getSwap('swap1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps/swap1');
      expect(result).toEqual(mockSwapWithBookings);
    });

    it('should handle swap not found error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: { message: 'Swap not found' } },
        },
      });

      await expect(swapService.getSwap('nonexistent')).rejects.toThrow(
        BusinessLogicError
      );
    });
  });

  describe('acceptSwap', () => {
    it('should accept a swap successfully', async () => {
      const acceptedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };
      mockAxiosInstance.post.mockResolvedValue({ data: acceptedSwap });

      const result = await swapService.acceptSwap('swap1', 'Looks good!');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/swap1/accept',
        {
          message: 'Looks good!',
        }
      );
      expect(result).toEqual(acceptedSwap);
    });
  });

  describe('rejectSwap', () => {
    it('should reject a swap successfully', async () => {
      const rejectedSwap = { ...mockSwap, status: 'rejected' as SwapStatus };
      mockAxiosInstance.post.mockResolvedValue({ data: rejectedSwap });

      const result = await swapService.rejectSwap('swap1', 'Not suitable');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/swap1/reject',
        {
          reason: 'Not suitable',
        }
      );
      expect(result).toEqual(rejectedSwap);
    });
  });

  describe('cancelSwap', () => {
    it('should cancel a swap successfully', async () => {
      const cancelledSwap = { ...mockSwap, status: 'cancelled' as SwapStatus };
      mockAxiosInstance.post.mockResolvedValue({ data: cancelledSwap });

      const result = await swapService.cancelSwap('swap1', 'Changed my mind');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/swap1/cancel',
        {
          reason: 'Changed my mind',
        }
      );
      expect(result).toEqual(cancelledSwap);
    });
  });

  describe('createProposal', () => {
    const validProposalData: ProposalData = {
      bookingId: 'booking3',
      message: 'Counter proposal',
      additionalPayment: 25,
      conditions: ['Same dates'],
    };

    it('should create a proposal successfully', async () => {
      const mockProposal = {
        id: 'proposal1',
        swapId: 'swap1',
        proposerId: 'user3',
        bookingId: 'booking3',
        message: 'Counter proposal',
        additionalPayment: 25,
        conditions: ['Same dates'],
        status: 'pending',
        createdAt: new Date(),
      };

      mockAxiosInstance.post.mockResolvedValue({ data: mockProposal });

      const result = await swapService.createProposal(
        'swap1',
        validProposalData
      );

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/swap1/proposals',
        validProposalData
      );
      expect(result).toEqual(mockProposal);
    });

    it('should validate proposal data', async () => {
      const invalidData = {
        ...validProposalData,
        bookingId: '',
        conditions: [],
      };

      await expect(
        swapService.createProposal('swap1', invalidData)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getProposals', () => {
    it('should fetch proposals for a swap', async () => {
      const mockProposals = [
        {
          id: 'proposal1',
          swapId: 'swap1',
          proposerId: 'user3',
          bookingId: 'booking3',
          status: 'pending',
          conditions: ['Same dates'],
          createdAt: new Date(),
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockProposals });

      const result = await swapService.getProposals('swap1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/swap1/proposals'
      );
      expect(result).toEqual(mockProposals);
    });
  });

  describe('getSwapHistory', () => {
    it('should fetch swap history successfully', async () => {
      const mockHistory = [
        {
          id: 'event1',
          swapId: 'swap1',
          type: 'created',
          userId: 'user1',
          data: {},
          timestamp: new Date(),
        },
      ];

      mockAxiosInstance.get.mockResolvedValue({ data: mockHistory });

      const result = await swapService.getSwapHistory('swap1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/swap1/history'
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe('canCreateSwap', () => {
    it('should check if swap can be created', async () => {
      const mockResponse = { canCreate: true };
      mockAxiosInstance.get.mockResolvedValue({ data: mockResponse });

      const result = await swapService.canCreateSwap('booking1', 'booking2');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/can-create?source=booking1&target=booking2'
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await swapService.canCreateSwap('booking1', 'booking2');

      expect(result).toEqual({
        canCreate: false,
        reason: 'Unable to verify swap eligibility',
      });
    });
  });

  describe('estimateSwapFees', () => {
    it('should estimate swap fees', async () => {
      const mockFees = {
        platformFee: 10,
        blockchainFee: 5,
        totalFee: 15,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockFees });

      const result = await swapService.estimateSwapFees('booking1', 'booking2');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/estimate-fees?source=booking1&target=booking2'
      );
      expect(result).toEqual(mockFees);
    });
  });

  describe('getUserSwapStats', () => {
    it('should fetch user swap statistics', async () => {
      const mockStats = {
        total: 10,
        pending: 2,
        completed: 7,
        cancelled: 1,
        successRate: 0.7,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockStats });

      const result = await swapService.getUserSwapStats('user1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/user1/swap-stats'
      );
      expect(result).toEqual(mockStats);
    });
  });
});
