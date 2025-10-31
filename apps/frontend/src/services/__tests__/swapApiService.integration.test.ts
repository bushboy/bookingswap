import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { swapApiService } from '../swapApiService';
import {
  SwapPlatformError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';
import type {
  EligibleSwapResponse,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
} from '../../types/api';

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

// Mock performance monitor
vi.mock('../../services/performanceMonitor', () => ({
  apiPerformanceMonitor: {
    measureApiCall: vi.fn((name, operation) => operation()),
  },
}));

// Mock cache service
vi.mock('../../services/cacheService', () => ({
  swapCacheService: {
    getEligibleSwaps: vi.fn(() => null),
    setEligibleSwaps: vi.fn(),
    getCompatibilityAnalysis: vi.fn(() => null),
    setCompatibilityAnalysis: vi.fn(),
  },
}));

describe('SwapApiService - Integration Tests', () => {
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

  describe('Complete API Flow Integration', () => {
    it('should handle complete proposal creation flow', async () => {
      // Mock eligible swaps response
      const mockEligibleSwapsResponse: EligibleSwapResponse = {
        swaps: [
          {
            id: 'swap-1',
            title: 'Paris Apartment',
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
            eligibilityReasons: ['Good location match', 'Similar value range'],
            isEligible: true,
          },
        ],
        totalCount: 1,
        compatibilityThreshold: 60,
      };

      // Mock compatibility analysis response
      const mockCompatibilityResponse: CompatibilityAnalysis = {
        score: 88,
        reasons: ['Excellent location match', 'Perfect date overlap'],
        isEligible: true,
      };

      // Mock proposal creation response
      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-123',
        status: 'pending',
        estimatedResponseTime: '24 hours',
      };

      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockEligibleSwapsResponse })
        .mockResolvedValueOnce({ data: mockCompatibilityResponse });
      
      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockProposalResponse });

      // Step 1: Fetch eligible swaps
      const eligibleSwaps = await swapApiService.getEligibleSwaps('user-1', {
        targetSwapId: 'target-swap-1',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/user-1/swaps/eligible?targetSwapId=target-swap-1'
      );
      expect(eligibleSwaps.swaps).toHaveLength(1);
      expect(eligibleSwaps.swaps[0].bookingDetails.dateRange.checkIn).toBeInstanceOf(Date);

      // Step 2: Get compatibility analysis
      const compatibility = await swapApiService.getSwapCompatibility('swap-1', 'target-swap-1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/swaps/swap-1/compatibility/target-swap-1'
      );
      expect(compatibility.score).toBe(88);

      // Step 3: Create proposal
      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'swap-1',
        message: 'I would love to swap with you!',
        conditions: ['Flexible check-in time', 'Pet-friendly'],
        agreedToTerms: true,
      };

      const proposal = await swapApiService.createProposal('target-swap-1', proposalData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/target-swap-1/proposals',
        proposalData
      );
      expect(proposal.proposalId).toBe('proposal-123');
      expect(proposal.status).toBe('pending');
    });

    it('should handle authentication flow with token refresh', async () => {
      // First request fails with 401
      const authError = {
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

      mockAxiosInstance.get.mockRejectedValueOnce(authError);

      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.INVALID_TOKEN);
      }

      // Verify tokens were cleared
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_user');
    });

    it('should handle pagination for large result sets', async () => {
      const mockPagedResponse: EligibleSwapResponse = {
        swaps: Array.from({ length: 10 }, (_, i) => ({
          id: `swap-${i + 1}`,
          title: `Swap ${i + 1}`,
          bookingDetails: {
            location: `Location ${i + 1}`,
            dateRange: {
              checkIn: new Date('2024-06-01'),
              checkOut: new Date('2024-06-07'),
            },
            accommodationType: 'Apartment',
            guests: 2,
            estimatedValue: 500 + i * 100,
          },
          compatibilityScore: 70 + i,
          eligibilityReasons: [`Reason ${i + 1}`],
          isEligible: true,
        })),
        totalCount: 25,
        compatibilityThreshold: 60,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockPagedResponse });

      const result = await swapApiService.getEligibleSwaps('user-1', {
        targetSwapId: 'target-swap-1',
        limit: 10,
        offset: 0,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/users/user-1/swaps/eligible?targetSwapId=target-swap-1&limit=10&offset=0'
      );
      expect(result.swaps).toHaveLength(10);
      expect(result.totalCount).toBe(25);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle network interruption and recovery', async () => {
      const networkError = {
        request: {},
        message: 'Network Error',
        code: 'ECONNABORTED',
      };

      const mockResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      // First call fails, second succeeds
      mockAxiosInstance.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: mockResponse });

      // First attempt should fail
      try {
        await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
        expect.fail('Should have thrown network error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.NETWORK_ERROR);
        expect(error.retryable).toBe(true);
      }

      // Second attempt should succeed
      const result = await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
      expect(result.swaps).toEqual([]);
    });

    it('should handle server overload scenario', async () => {
      const serverError = {
        response: {
          status: 503,
          data: {
            error: {
              code: 'SERVICE_UNAVAILABLE',
              message: 'Service temporarily unavailable',
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(serverError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'swap-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-swap-1', proposalData);
        expect.fail('Should have thrown server error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.retryable).toBe(true);
      }
    });

    it('should handle rate limiting with proper backoff', async () => {
      const rateLimitError = {
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

      mockAxiosInstance.get.mockRejectedValueOnce(rateLimitError);

      try {
        await swapApiService.getSwapCompatibility('swap-1', 'swap-2');
        expect.fail('Should have thrown rate limit error');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapPlatformError);
        expect(error.code).toBe(ERROR_CODES.RATE_LIMIT_EXCEEDED);
        expect(error.retryable).toBe(true);
      }
    });
  });

  describe('Data Validation Integration', () => {
    it('should validate proposal data before API call', async () => {
      const invalidProposalData = {
        sourceSwapId: '', // Invalid: empty
        message: 'a'.repeat(1001), // Invalid: too long
        conditions: [''], // Invalid: empty condition
        agreedToTerms: false, // Invalid: must agree to terms
      };

      try {
        await swapApiService.createProposal('target-swap-1', invalidProposalData);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      }
    });

    it('should handle server-side validation errors', async () => {
      const serverValidationError = {
        response: {
          status: 400,
          data: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: {
                sourceSwapId: ['Source swap is not available'],
                conditions: ['Invalid condition format'],
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValueOnce(serverValidationError);

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'unavailable-swap',
        conditions: ['Invalid condition'],
        agreedToTerms: true,
      };

      try {
        await swapApiService.createProposal('target-swap-1', proposalData);
        expect.fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.details).toEqual({
          sourceSwapId: ['Source swap is not available'],
          conditions: ['Invalid condition format'],
        });
      }
    });
  });

  describe('Request Configuration Integration', () => {
    it('should handle custom timeout configurations', async () => {
      const mockResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      await swapApiService.getEligibleSwaps(
        'user-1',
        { targetSwapId: 'swap-1' },
        { timeout: 5000 }
      );

      // Verify the request was made (timeout is handled internally)
      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });

    it('should handle request cancellation', async () => {
      const abortController = new AbortController();
      const mockResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      const result = await swapApiService.getEligibleSwaps(
        'user-1',
        { targetSwapId: 'swap-1' },
        { abortController }
      );

      expect(result).toEqual(mockResponse);
    });

    it('should handle request with custom headers', async () => {
      const mockResponse: ProposalResponse = {
        proposalId: 'proposal-123',
        status: 'pending',
        estimatedResponseTime: '24 hours',
      };

      mockAxiosInstance.post.mockResolvedValueOnce({ data: mockResponse });

      const proposalData: CreateProposalRequest = {
        sourceSwapId: 'swap-1',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      await swapApiService.createProposal(
        'target-swap-1',
        proposalData,
        'user-1',
        { headers: { 'X-Custom-Header': 'test-value' } }
      );

      expect(mockAxiosInstance.post).toHaveBeenCalled();
    });
  });

  describe('Authentication Integration', () => {
    it('should include auth token in requests', async () => {
      mockLocalStorage.getItem.mockReturnValue('test-auth-token');
      
      const mockResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });

      // Verify interceptor was set up (we can't directly test the interceptor execution)
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should handle missing auth token gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const mockResponse: EligibleSwapResponse = {
        swaps: [],
        totalCount: 0,
        compatibilityThreshold: 60,
      };

      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockResponse });

      // Should not throw error even without token
      const result = await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });
      expect(result).toEqual(mockResponse);
    });

    it('should check authentication status correctly', () => {
      // Test with token present
      mockLocalStorage.getItem.mockReturnValue('valid-token');
      expect(swapApiService.isAuthenticated()).toBe(true);

      // Test with no token
      mockLocalStorage.getItem.mockReturnValue(null);
      expect(swapApiService.isAuthenticated()).toBe(false);

      // Test with empty token
      mockLocalStorage.getItem.mockReturnValue('');
      expect(swapApiService.isAuthenticated()).toBe(false);
    });
  });

  describe('Response Processing Integration', () => {
    it('should correctly parse date strings in responses', async () => {
      const mockResponse = {
        data: {
          swaps: [
            {
              id: 'swap-1',
              title: 'Test Swap',
              bookingDetails: {
                location: 'Test Location',
                dateRange: {
                  checkIn: '2024-06-15T00:00:00.000Z',
                  checkOut: '2024-06-22T00:00:00.000Z',
                },
                accommodationType: 'Hotel',
                guests: 2,
                estimatedValue: 500,
              },
              compatibilityScore: 85,
              eligibilityReasons: ['Good match'],
              isEligible: true,
            },
          ],
          totalCount: 1,
          compatibilityThreshold: 60,
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });

      expect(result.swaps[0].bookingDetails.dateRange.checkIn).toBeInstanceOf(Date);
      expect(result.swaps[0].bookingDetails.dateRange.checkOut).toBeInstanceOf(Date);
      expect(result.swaps[0].bookingDetails.dateRange.checkIn.getTime()).toBe(
        new Date('2024-06-15T00:00:00.000Z').getTime()
      );
    });

    it('should handle malformed date strings gracefully', async () => {
      const mockResponse = {
        data: {
          swaps: [
            {
              id: 'swap-1',
              title: 'Test Swap',
              bookingDetails: {
                location: 'Test Location',
                dateRange: {
                  checkIn: 'invalid-date',
                  checkOut: '2024-06-22T00:00:00.000Z',
                },
                accommodationType: 'Hotel',
                guests: 2,
                estimatedValue: 500,
              },
              compatibilityScore: 85,
              eligibilityReasons: ['Good match'],
              isEligible: true,
            },
          ],
          totalCount: 1,
          compatibilityThreshold: 60,
        },
      };

      mockAxiosInstance.get.mockResolvedValueOnce(mockResponse);

      const result = await swapApiService.getEligibleSwaps('user-1', { targetSwapId: 'swap-1' });

      // Should handle invalid dates gracefully (implementation dependent)
      expect(result.swaps).toHaveLength(1);
    });
  });
});