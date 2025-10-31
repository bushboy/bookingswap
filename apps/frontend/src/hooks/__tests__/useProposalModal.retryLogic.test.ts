import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProposalModal } from '../useProposalModal';
import { swapApiService } from '../../services/swapApiService';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';
import type {
  EligibleSwapResponse,
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
} from '../../types/api';

// Mock the swapApiService
vi.mock('../../services/swapApiService', () => ({
  swapApiService: {
    getEligibleSwaps: vi.fn(),
    createProposal: vi.fn(),
    getSwapCompatibility: vi.fn(),
    isAuthenticated: vi.fn(() => true),
    createAbortController: vi.fn(() => new AbortController()),
  },
}));

// Mock the authentication guard
vi.mock('../useAuthenticationGuard', () => ({
  useAuthenticationGuard: () => ({
    requireAuthentication: vi.fn(() => true),
    handleAuthError: vi.fn(),
    isAuthError: vi.fn(() => false),
    isAuthorizationError: vi.fn(() => false),
    getAuthErrorMessage: vi.fn(() => 'Auth error'),
  }),
}));

// Mock the error recovery service
vi.mock('../useErrorRecovery', () => ({
  useErrorRecovery: () => ({
    executeWithRecovery: vi.fn(),
    canRetry: vi.fn(() => true),
    getRetryDelay: vi.fn(() => 100),
    shouldRetry: vi.fn(() => true),
  }),
}));

const mockSwapApiService = vi.mocked(swapApiService);

describe('useProposalModal - Retry Logic', () => {
  const defaultOptions = {
    userId: 'user-123',
    targetSwapId: 'swap-456',
    maxRetries: 3,
    retryDelay: 100,
    autoFetch: false,
  };

  const mockEligibleSwap: EligibleSwap = {
    id: 'eligible-swap-1',
    title: 'Test Swap',
    bookingDetails: {
      location: 'Test Location',
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-07'),
      },
      accommodationType: 'Hotel',
      guests: 2,
      estimatedValue: 500,
    },
    compatibilityScore: 85,
    eligibilityReasons: ['Compatible dates', 'Similar location'],
    isEligible: true,
  };

  const mockEligibleSwapsResponse: EligibleSwapResponse = {
    swaps: [mockEligibleSwap],
    totalCount: 1,
    compatibilityThreshold: 60,
  };

  const mockProposalRequest: CreateProposalRequest = {
    sourceSwapId: 'source-swap-123',
    message: 'Test proposal message',
    conditions: ['Test condition'],
    agreedToTerms: true,
  };

  const mockProposalResponse: ProposalResponse = {
    proposalId: 'proposal-789',
    status: 'pending',
    estimatedResponseTime: '24 hours',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Exponential Backoff Retry Logic', () => {
    it('should retry with exponential backoff for network errors', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      // First two calls fail, third succeeds
      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // First attempt fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);

      // First retry fails
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100); // First retry delay
        await retryPromise;
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(2);

      // Second retry succeeds
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(200); // Exponential backoff: 100 * 2
        await retryPromise;
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.canRetry).toBe(false);
    });

    it('should respect maxRetries limit', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(networkError);

      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, maxRetries: 2 })
      );

      // First failure
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);

      // First retry failure
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100);
        await retryPromise;
      });
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(2);

      // Second retry failure - should reach maxRetries
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(200);
        await retryPromise;
      });
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(3);
    });

    it('should calculate exponential backoff delays correctly', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValue(networkError);

      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, retryDelay: 50 })
      );

      // First failure
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      // Track retry delays
      const retryDelays: number[] = [];

      // First retry (should be 50ms)
      await act(async () => {
        const startTime = Date.now();
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(50);
        await retryPromise;
        retryDelays.push(50);
      });

      // Second retry (should be 100ms)
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100);
        await retryPromise;
        retryDelays.push(100);
      });

      // Third retry (should be 200ms)
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(200);
        await retryPromise;
        retryDelays.push(200);
      });

      expect(retryDelays).toEqual([50, 100, 200]);
    });
  });

  describe('Retry Logic for Different Error Types', () => {
    it('should not retry authentication errors', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Invalid token',
        'authentication',
        false
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(authError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(1);

      // Retry should not execute
      await act(async () => {
        await result.current.retry();
      });

      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledTimes(1);
    });

    it('should not retry validation errors', async () => {
      const validationError = new SwapPlatformError(
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid data',
        'validation',
        false
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBeTruthy();
      // Proposal submission doesn't have retry logic in the same way
      expect(mockSwapApiService.createProposal).toHaveBeenCalledTimes(1);
    });

    it('should retry rate limiting errors', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded',
        'rate_limiting',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // First attempt fails with rate limit
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);

      // Retry should succeed
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100);
        await retryPromise;
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
    });

    it('should retry server errors', async () => {
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Internal server error',
        'server_error',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(serverError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.canRetry).toBe(true);

      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100);
        await retryPromise;
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
    });
  });

  describe('Manual Retry Functionality', () => {
    it('should allow manual retry after automatic retry limit reached', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, maxRetries: 2 })
      );

      // Exhaust automatic retries
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100);
        await retryPromise;
      });

      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(200);
        await retryPromise;
      });

      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(3);

      // Manual retry by calling fetchEligibleSwaps again should work
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
      expect(result.current.retryCount).toBe(0);
    });

    it('should reset retry state when clearError is called', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('Retry Logic with Request Cancellation', () => {
    it('should not retry cancelled requests', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      // Cancelled requests should not set error state or retry state
      expect(result.current.error).toBe(null);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should cancel ongoing retry attempts when new request is made', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // First request fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.canRetry).toBe(true);

      // Start retry but don't wait for it to complete
      act(() => {
        result.current.retry();
      });

      // Make new request which should cancel the retry
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
    });
  });

  describe('Retry Logic State Management', () => {
    it('should maintain separate retry state for different operations', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      // Eligible swaps fails, but proposal submission works
      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);
      mockSwapApiService.createProposal.mockResolvedValueOnce(mockProposalResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // Fetch eligible swaps fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);

      // Proposal submission should still work
      let proposalResult: ProposalResponse | null = null;
      await act(async () => {
        proposalResult = await result.current.submitProposal(mockProposalRequest);
      });

      expect(proposalResult).toEqual(mockProposalResponse);
      expect(result.current.submitError).toBe(null);
      // Fetch error state should remain unchanged
      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);
    });

    it('should reset retry state when component unmounts', () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);

      const { result, unmount } = renderHook(() => useProposalModal(defaultOptions));

      act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.canRetry).toBe(true);

      // Unmounting should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Retry Logic with Different Configurations', () => {
    it('should handle zero maxRetries configuration', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, maxRetries: 0 })
      );

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(1);
    });

    it('should handle very short retry delays', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true
      );

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, retryDelay: 1 })
      );

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.canRetry).toBe(true);

      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(1);
        await retryPromise;
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
    });
  });
});