import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  swapService,
  SwapWithBookings,
  SwapServiceFilters,
} from '../swapService';
import { swapFilterService, SwapFilters } from '../SwapFilterService';
import {
  ValidationError,
  SwapPlatformError,
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

// Mock SwapFilterService
vi.mock('../SwapFilterService', () => ({
  swapFilterService: {
    validateFilters: vi.fn(),
    applyAllFilters: vi.fn(),
    applyCoreBrowsingFilters: vi.fn(),
  },
  SwapFilters: {},
}));

const mockedAxios = vi.mocked(axios);
const mockedSwapFilterService = vi.mocked(swapFilterService);

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

describe('SwapService Enhanced Filtering', () => {
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
    
    // Setup default mock implementations
    mockedSwapFilterService.validateFilters.mockReturnValue({
      isValid: true,
      errors: [],
    });
    mockedSwapFilterService.applyAllFilters.mockImplementation((swaps) => swaps);
    mockedSwapFilterService.applyCoreBrowsingFilters.mockImplementation((swaps) => swaps);
  });

  afterEach(() => {
    vi.resetAllMocks();
    swapService.clearCache();
  });

  const mockSwapWithBookings: SwapWithBookings = {
    id: 'swap1',
    sourceBookingId: 'booking1',
    targetBookingId: 'booking2',
    proposerId: 'user1',
    ownerId: 'user2',
    status: 'pending',
    terms: {
      additionalPayment: 50,
      conditions: ['Flexible dates'],
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
    swapType: 'booking',
    hasActiveProposals: true,
    activeProposalCount: 1,
  };

  describe('getBrowsableSwaps', () => {
    it('should validate currentUserId parameter', async () => {
      await expect(
        swapService.getBrowsableSwaps('')
      ).rejects.toThrow(ValidationError);

      await expect(
        swapService.getBrowsableSwaps('   ')
      ).rejects.toThrow(ValidationError);
    });

    it('should validate filters using SwapFilterService', async () => {
      const invalidFilters: SwapFilters = {
        priceRange: { min: 100, max: 50 }, // Invalid: min > max
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      mockedSwapFilterService.validateFilters.mockReturnValue({
        isValid: false,
        errors: ['Minimum price cannot be greater than maximum price'],
      });

      await expect(
        swapService.getBrowsableSwaps('user1', invalidFilters)
      ).rejects.toThrow(ValidationError);

      expect(mockedSwapFilterService.validateFilters).toHaveBeenCalledWith(invalidFilters);
    });

    it('should use cached results when available', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(mockSwaps);

      // First call should hit the API
      const result1 = await swapService.getBrowsableSwaps('user1');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockSwaps);

      // Second call should use cache
      const result2 = await swapService.getBrowsableSwaps('user1');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(mockSwaps);
    });

    it('should apply client-side filtering using SwapFilterService', async () => {
      const mockSwaps = [mockSwapWithBookings];
      const filteredSwaps = [mockSwapWithBookings];
      const filters: SwapFilters = {
        swapType: 'booking',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyAllFilters.mockReturnValue(filteredSwaps);

      const result = await swapService.getBrowsableSwaps('user1', filters);

      expect(mockedSwapFilterService.applyAllFilters).toHaveBeenCalledWith(
        mockSwaps,
        'user1',
        filters
      );
      expect(result).toEqual(filteredSwaps);
    });

    it('should fall back to core filtering when client-side filtering fails', async () => {
      const mockSwaps = [mockSwapWithBookings];
      const coreFilteredSwaps = [mockSwapWithBookings];
      const filters: SwapFilters = {
        swapType: 'booking',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      // Mock filtering to throw an error
      mockedSwapFilterService.applyAllFilters.mockImplementation(() => {
        throw new Error('Filtering error');
      });
      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(coreFilteredSwaps);

      const result = await swapService.getBrowsableSwaps('user1', filters);

      expect(mockedSwapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledWith(
        mockSwaps,
        'user1'
      );
      expect(result).toEqual(coreFilteredSwaps);
    });

    it('should apply core filtering even without user filters', async () => {
      const mockSwaps = [mockSwapWithBookings];
      const coreFilteredSwaps = [mockSwapWithBookings];

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(coreFilteredSwaps);

      const result = await swapService.getBrowsableSwaps('user1');

      expect(mockedSwapFilterService.applyCoreBrowsingFilters).toHaveBeenCalledWith(
        mockSwaps,
        'user1'
      );
      expect(result).toEqual(coreFilteredSwaps);
    });

    it('should handle API errors gracefully', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 400, data: { error: { message: 'Bad request' } } },
      });

      await expect(
        swapService.getBrowsableSwaps('user1')
      ).rejects.toThrow('Invalid browsing parameters');
    });

    it('should handle authorization errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 403, data: { error: { message: 'Forbidden' } } },
      });

      await expect(
        swapService.getBrowsableSwaps('user1')
      ).rejects.toThrow(SwapPlatformError);
    });

    it('should handle generic server errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 500, data: { error: { message: 'Server error' } } },
      });

      await expect(
        swapService.getBrowsableSwaps('user1')
      ).rejects.toThrow(SwapPlatformError);
    });
  });

  describe('getCashSwaps', () => {
    it('should validate currentUserId parameter', async () => {
      await expect(
        swapService.getCashSwaps('')
      ).rejects.toThrow(ValidationError);
    });

    it('should call getBrowsableSwaps with cash filter', async () => {
      const mockSwaps = [{ ...mockSwapWithBookings, swapType: 'cash' as const }];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyAllFilters.mockReturnValue(mockSwaps);

      const result = await swapService.getCashSwaps('user1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps/browse', {
        params: expect.objectContaining({
          currentUserId: 'user1',
          swapType: 'cash',
        }),
      });
    });

    it('should handle errors with specific context', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(
        swapService.getCashSwaps('user1')
      ).rejects.toThrow('Failed to fetch browsable swaps');
    });
  });

  describe('getBookingSwaps', () => {
    it('should validate currentUserId parameter', async () => {
      await expect(
        swapService.getBookingSwaps('')
      ).rejects.toThrow(ValidationError);
    });

    it('should call getBrowsableSwaps with booking filter', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyAllFilters.mockReturnValue(mockSwaps);

      const result = await swapService.getBookingSwaps('user1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps/browse', {
        params: expect.objectContaining({
          currentUserId: 'user1',
          swapType: 'booking',
        }),
      });
    });
  });

  describe('searchSwaps', () => {
    it('should validate required parameters', async () => {
      await expect(
        swapService.searchSwaps('', 'query')
      ).rejects.toThrow(ValidationError);

      await expect(
        swapService.searchSwaps('user1', '')
      ).rejects.toThrow(ValidationError);

      await expect(
        swapService.searchSwaps('user1', '   ')
      ).rejects.toThrow(ValidationError);
    });

    it('should use cached search results', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(mockSwaps);

      // First search should hit the API
      const result1 = await swapService.searchSwaps('user1', 'hotel');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);

      // Second search with same parameters should use cache
      const result2 = await swapService.searchSwaps('user1', 'hotel');
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1); // Still 1
      expect(result2).toEqual(result1);
    });

    it('should apply filtering to search results', async () => {
      const mockSwaps = [mockSwapWithBookings];
      const filters: SwapFilters = {
        swapType: 'booking',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyAllFilters.mockReturnValue(mockSwaps);

      const result = await swapService.searchSwaps('user1', 'hotel', filters);

      expect(mockedSwapFilterService.applyAllFilters).toHaveBeenCalledWith(
        mockSwaps,
        'user1',
        filters
      );
    });

    it('should call search endpoint with correct parameters', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(mockSwaps);

      await swapService.searchSwaps('user1', 'hotel NYC');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/swaps/search', {
        params: expect.objectContaining({
          currentUserId: 'user1',
          q: 'hotel NYC',
        }),
      });
    });
  });

  describe('Cache Management', () => {
    it('should clear cache when new swap is created', async () => {
      const mockSwap = { id: 'swap1', status: 'pending' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockSwap });

      // First populate cache
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: [mockSwapWithBookings] } },
      });
      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue([mockSwapWithBookings]);
      
      await swapService.getBrowsableSwaps('user1');

      // Verify cache has data
      expect(swapService.getCacheStats().size).toBeGreaterThan(0);

      // Create swap should clear cache
      await swapService.createEnhancedSwap({
        sourceBookingId: 'booking1',
        targetBookingId: 'booking2',
        terms: {
          conditions: ['test'],
          expiresAt: new Date('2024-12-31'),
        },
      });

      // Cache should be cleared
      expect(swapService.getCacheStats().size).toBe(0);
    });

    it('should invalidate user-specific cache', async () => {
      // Populate cache for multiple users
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: [mockSwapWithBookings] } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue([mockSwapWithBookings]);

      await swapService.getBrowsableSwaps('user1');
      await swapService.getBrowsableSwaps('user2');

      expect(swapService.getCacheStats().size).toBe(2);

      // Invalidate cache for user1 only
      swapService.invalidateUserCache('user1');

      const stats = swapService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys[0]).toContain('user2');
    });

    it('should provide cache statistics', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: [mockSwapWithBookings] } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue([mockSwapWithBookings]);

      await swapService.getBrowsableSwaps('user1');

      const stats = swapService.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toHaveLength(1);
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.newestEntry).toBeDefined();
    });

    it('should expire cached entries after TTL', async () => {
      const mockSwaps = [mockSwapWithBookings];
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: { swaps: mockSwaps } },
      });

      mockedSwapFilterService.applyCoreBrowsingFilters.mockReturnValue(mockSwaps);

      // Mock Date.now to control time
      const originalNow = Date.now;
      let currentTime = 1000000;
      Date.now = vi.fn(() => currentTime);

      try {
        // First call should cache results
        await swapService.getBrowsableSwaps('user1');
        expect(swapService.getCacheStats().size).toBe(1);

        // Advance time beyond TTL (5 minutes = 300000ms)
        currentTime += 400000;

        // Second call should not use cache (expired)
        await swapService.getBrowsableSwaps('user1');
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(2);
      } finally {
        Date.now = originalNow;
      }
    });
  });

  describe('Additional Methods', () => {
    describe('getSwapRecommendations', () => {
      it('should validate parameters', async () => {
        await expect(
          swapService.getSwapRecommendations('', 'user1')
        ).rejects.toThrow(ValidationError);

        await expect(
          swapService.getSwapRecommendations('booking1', '')
        ).rejects.toThrow(ValidationError);
      });

      it('should filter out user\'s own bookings from recommendations', async () => {
        const mockRecommendations = [
          { id: 'booking1', userId: 'user1', title: 'User\'s booking' },
          { id: 'booking2', userId: 'user2', title: 'Other user\'s booking' },
        ];

        mockAxiosInstance.get.mockResolvedValue({ data: mockRecommendations });

        const result = await swapService.getSwapRecommendations('booking1', 'user1');

        expect(result).toHaveLength(1);
        expect(result[0].userId).toBe('user2');
      });
    });

    describe('getSwapByBookingId', () => {
      it('should validate bookingId parameter', async () => {
        await expect(
          swapService.getSwapByBookingId('')
        ).rejects.toThrow(ValidationError);
      });

      it('should return null when swap not found', async () => {
        mockAxiosInstance.get.mockRejectedValue({
          response: { status: 404 },
        });

        const result = await swapService.getSwapByBookingId('booking1');
        expect(result).toBeNull();
      });

      it('should return swap when found', async () => {
        mockAxiosInstance.get.mockResolvedValue({ data: mockSwapWithBookings });

        const result = await swapService.getSwapByBookingId('booking1');
        expect(result).toEqual(mockSwapWithBookings);
      });
    });

    describe('createBookingProposal', () => {
      it('should validate swapId parameter', async () => {
        await expect(
          swapService.createBookingProposal('', { bookingId: 'booking1' })
        ).rejects.toThrow(ValidationError);
      });

      it('should create booking proposal with correct data', async () => {
        const mockProposal = { id: 'proposal1', swapId: 'swap1' };
        mockAxiosInstance.post.mockResolvedValue({ data: mockProposal });

        const result = await swapService.createBookingProposal('swap1', {
          bookingId: 'booking1',
          message: 'Test message',
          additionalPayment: 50,
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/swaps/swap1/proposals', {
          bookingId: 'booking1',
          message: 'Test message',
          additionalPayment: 50,
          conditions: ['Standard booking swap'],
        });
        expect(result).toEqual(mockProposal);
      });
    });

    describe('createCashProposal', () => {
      it('should validate parameters', async () => {
        await expect(
          swapService.createCashProposal('', { amount: 100, currency: 'USD' })
        ).rejects.toThrow(ValidationError);

        await expect(
          swapService.createCashProposal('swap1', { amount: 0, currency: 'USD' })
        ).rejects.toThrow(ValidationError);

        await expect(
          swapService.createCashProposal('swap1', { amount: -100, currency: 'USD' })
        ).rejects.toThrow(ValidationError);
      });

      it('should create cash proposal with correct data', async () => {
        const mockProposal = { id: 'proposal1', swapId: 'swap1' };
        mockAxiosInstance.post.mockResolvedValue({ data: mockProposal });

        const result = await swapService.createCashProposal('swap1', {
          amount: 100,
          currency: 'USD',
          paymentMethod: 'credit_card',
          message: 'Cash offer',
        });

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/swaps/swap1/cash-proposals', {
          amount: 100,
          currency: 'USD',
          paymentMethod: 'credit_card',
          message: 'Cash offer',
        });
        expect(result).toEqual(mockProposal);
      });
    });
  });
});