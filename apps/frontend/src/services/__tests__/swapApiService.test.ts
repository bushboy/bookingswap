import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { swapApiService } from '../swapApiService';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('SwapApiService', () => {
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
    vi.clearAllMocks();
  });

  describe('getEligibleSwaps', () => {
    it('should fetch eligible swaps successfully', async () => {
      const mockResponse = {
        data: {
          swaps: [
            {
              id: 'swap-1',
              title: 'Test Swap',
              bookingDetails: {
                location: 'Paris, France',
                dateRange: {
                  checkIn: '2024-06-15T00:00:00.000Z',
                  checkOut: '2024-06-22T00:00:00.000Z',
                },
                accommodationType: 'Apartment',
                guests: 2,
                estimatedValue: 1200,
              },
              compatibilityScore: 85,
              eligibilityReasons: ['Good location match'],
              isEligible: true,
            },
          ],
          totalCount: 1,
          compatibilityThreshold: 60,
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await swapApiService.getEligibleSwaps('user-1', 'target-swap-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/user-1/swaps/eligible?targetSwapId=target-swap-1'
      );
      expect(result.swaps).toHaveLength(1);
      expect(result.swaps[0].bookingDetails.dateRange.checkIn).toBeInstanceOf(Date);
      expect(result.swaps[0].bookingDetails.dateRange.checkOut).toBeInstanceOf(Date);
    });

    it('should include query parameters when provided', async () => {
      const mockResponse = {
        data: {
          swaps: [],
          totalCount: 0,
          compatibilityThreshold: 60,
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      await swapApiService.getEligibleSwaps('user-1', 'target-swap-1', {
        limit: 10,
        offset: 20,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/user-1/swaps/eligible?targetSwapId=target-swap-1&limit=10&offset=20'
      );
    });

    it('should handle API errors correctly', async () => {
      const mockError = {
        response: {
          status: 404,
          data: {
            error: {
              code: 'SWAP_NOT_FOUND',
              message: 'Swap not found',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', 'invalid-swap')
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  describe('createProposal', () => {
    const validProposalData = {
      sourceSwapId: 'source-swap-1',
      message: 'Test proposal',
      conditions: ['Condition 1', 'Condition 2'],
      agreedToTerms: true,
    };

    it('should create proposal successfully', async () => {
      const mockResponse = {
        data: {
          proposalId: 'proposal-123',
          status: 'pending' as const,
          estimatedResponseTime: '24 hours',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await swapApiService.createProposal('target-swap-1', validProposalData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-1/proposals',
        validProposalData
      );
      expect(result.proposalId).toBe('proposal-123');
      expect(result.status).toBe('pending');
    });

    it('should validate proposal data before submission', async () => {
      const invalidProposalData = {
        sourceSwapId: '',
        conditions: [],
        agreedToTerms: false,
      };

      await expect(
        swapApiService.createProposal('target-swap-1', invalidProposalData)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate message length', async () => {
      const longMessage = 'a'.repeat(1001);
      const invalidProposalData = {
        sourceSwapId: 'source-swap-1',
        message: longMessage,
        conditions: ['Condition 1'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-swap-1', invalidProposalData)
      ).rejects.toThrow(ValidationError);
    });

    it('should validate condition content', async () => {
      const invalidProposalData = {
        sourceSwapId: 'source-swap-1',
        conditions: ['', 'Valid condition'],
        agreedToTerms: true,
      };

      await expect(
        swapApiService.createProposal('target-swap-1', invalidProposalData)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getSwapCompatibility', () => {
    it('should fetch compatibility analysis successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            compatibility: {
              overallScore: 85,
              factors: {
                locationCompatibility: { score: 90, weight: 0.25, details: 'Good location match', status: 'excellent' },
                dateCompatibility: { score: 80, weight: 0.30, details: 'Good date compatibility', status: 'good' },
                valueCompatibility: { score: 85, weight: 0.20, details: 'Similar value range', status: 'good' },
                accommodationCompatibility: { score: 85, weight: 0.15, details: 'Compatible accommodations', status: 'good' },
                guestCompatibility: { score: 90, weight: 0.10, details: 'Compatible guest count', status: 'excellent' }
              },
              recommendations: ['Good location match', 'Similar value range'],
              potentialIssues: []
            },
            recommendation: 'recommended'
          },
          requestId: 'test-request-id',
          timestamp: '2025-10-12T10:00:00.000Z'
        }
      };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await swapApiService.getSwapCompatibility('source-swap-1', 'target-swap-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/source-swap-1/compatibility/target-swap-1'
      );
      expect(result.overallScore).toBe(85);
      expect(result.recommendations).toEqual(['Good location match', 'Similar value range']);
    });
  });

  describe('error handling', () => {
    it('should handle 401 authentication errors', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            error: {
              code: 'INVALID_TOKEN',
              message: 'Token expired',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', 'target-swap-1')
      ).rejects.toThrow(SwapPlatformError);

      // Should clear token on auth error
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('should handle 403 authorization errors', async () => {
      const mockError = {
        response: {
          status: 403,
          data: {
            error: {
              code: 'ACCESS_DENIED',
              message: 'Access denied',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', 'target-swap-1')
      ).rejects.toThrow(SwapPlatformError);
    });

    it('should handle network errors', async () => {
      const mockError = {
        request: {},
        message: 'Network Error',
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(
        swapApiService.getEligibleSwaps('user-1', 'target-swap-1')
      ).rejects.toThrow(SwapPlatformError);
    });

    it('should handle 429 rate limiting errors', async () => {
      const mockError = {
        response: {
          status: 429,
          data: {
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      const error = await swapApiService.getEligibleSwaps('user-1', 'target-swap-1').catch(e => e);
      expect(error).toBeInstanceOf(SwapPlatformError);
      expect(error.retryable).toBe(true);
    });
  });

  describe('authentication', () => {
    it('should check authentication status correctly', () => {
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      expect(swapApiService.isAuthenticated()).toBe(true);

      mockLocalStorage.getItem.mockReturnValue(null);
      expect(swapApiService.isAuthenticated()).toBe(false);
    });
  });

  describe('request cancellation', () => {
    it('should create abort controller', () => {
      const controller = swapApiService.createAbortController();
      expect(controller).toBeInstanceOf(AbortController);
    });

    it('should support request cancellation', async () => {
      const controller = new AbortController();
      const mockResponse = { data: { test: 'data' } };

      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await swapApiService.makeRequest('get', '/test', undefined, controller);

      expect(result).toEqual({ test: 'data' });
    });
  });
});