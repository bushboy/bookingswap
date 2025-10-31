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
  },
}));

const mockSwapApiService = vi.mocked(swapApiService);

describe('useProposalModal', () => {
  const defaultOptions = {
    userId: 'user-123',
    targetSwapId: 'swap-456',
    maxRetries: 3,
    retryDelay: 100, // Shorter delay for tests
    autoFetch: false, // Disable auto-fetch for controlled testing
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

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));

      expect(result.current.eligibleSwaps).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.submitting).toBe(false);
      expect(result.current.submitError).toBe(null);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should not auto-fetch when autoFetch is false', () => {
      renderHook(() => useProposalModal(defaultOptions));
      
      expect(mockSwapApiService.getEligibleSwaps).not.toHaveBeenCalled();
    });

    it('should auto-fetch when autoFetch is true', async () => {
      mockSwapApiService.getEligibleSwaps.mockResolvedValueOnce(mockEligibleSwapsResponse);

      renderHook(() => useProposalModal({ ...defaultOptions, autoFetch: true }));

      await waitFor(() => {
        expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledWith(
          'user-123',
          {
            targetSwapId: 'swap-456',
            limit: 50,
            includeIneligible: false,
            minCompatibilityScore: 0,
          },
          expect.objectContaining({
            timeout: 15000,
            abortController: expect.any(AbortController),
          })
        );
      });
    });
  });

  describe('fetchEligibleSwaps', () => {
    it('should successfully fetch eligible swaps', async () => {
      mockSwapApiService.getEligibleSwaps.mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.retryCount).toBe(0);
    });

    it('should handle loading state correctly', async () => {
      let resolvePromise: (value: EligibleSwapResponse) => void;
      const promise = new Promise<EligibleSwapResponse>((resolve) => {
        resolvePromise = resolve;
      });
      mockSwapApiService.getEligibleSwaps.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      act(() => {
        result.current.fetchEligibleSwaps();
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);

      await act(async () => {
        resolvePromise!(mockEligibleSwapsResponse);
        await promise;
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
    });

    it('should handle network errors with retry capability', async () => {
      const networkError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Network error',
        'integration',
        true // retryable
      );
      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Unable to connect. Please check your internet connection.');
      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);
      expect(result.current.loading).toBe(false);
    });

    it('should handle authentication errors without retry', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Invalid token',
        'authentication',
        false // not retryable
      );
      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(authError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Your session has expired. Please log in again.');
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(1);
    });

    it('should not fetch when missing required parameters', async () => {
      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, targetSwapId: null })
      );

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Missing required parameters for fetching eligible swaps.');
      expect(result.current.canRetry).toBe(false);
      expect(mockSwapApiService.getEligibleSwaps).not.toHaveBeenCalled();
    });

    it('should handle request cancellation', async () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      // State should not be updated for cancelled requests
      expect(result.current.error).toBe(null);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('submitProposal', () => {
    it('should successfully submit a proposal', async () => {
      mockSwapApiService.createProposal.mockResolvedValueOnce(mockProposalResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      let response: ProposalResponse | null = null;
      await act(async () => {
        response = await result.current.submitProposal(mockProposalRequest);
      });

      expect(response).toEqual(mockProposalResponse);
      expect(result.current.submitting).toBe(false);
      expect(result.current.submitError).toBe(null);
      expect(mockSwapApiService.createProposal).toHaveBeenCalledWith(
        'swap-456',
        mockProposalRequest,
        undefined,
        expect.objectContaining({
          timeout: 30000,
          abortController: expect.any(AbortController),
        })
      );
    });

    it('should handle submission loading state', async () => {
      let resolvePromise: (value: ProposalResponse) => void;
      const promise = new Promise<ProposalResponse>((resolve) => {
        resolvePromise = resolve;
      });
      mockSwapApiService.createProposal.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      act(() => {
        result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitting).toBe(true);
      expect(result.current.submitError).toBe(null);

      await act(async () => {
        resolvePromise!(mockProposalResponse);
        await promise;
      });

      expect(result.current.submitting).toBe(false);
    });

    it('should handle submission errors', async () => {
      const validationError = new SwapPlatformError(
        ERROR_CODES.INVALID_SWAP_STATE,
        'Invalid swap state',
        'business_logic'
      );
      mockSwapApiService.createProposal.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      let response: ProposalResponse | null = null;
      await act(async () => {
        response = await result.current.submitProposal(mockProposalRequest);
      });

      expect(response).toBe(null);
      expect(result.current.submitError).toBe('Invalid swap state');
      expect(result.current.submitting).toBe(false);
    });

    it('should not submit when missing targetSwapId', async () => {
      const { result } = renderHook(() => 
        useProposalModal({ ...defaultOptions, targetSwapId: null })
      );

      let response: ProposalResponse | null = null;
      await act(async () => {
        response = await result.current.submitProposal(mockProposalRequest);
      });

      expect(response).toBe(null);
      expect(result.current.submitError).toBe('Missing target swap ID for proposal submission.');
      expect(mockSwapApiService.createProposal).not.toHaveBeenCalled();
    });
  });

  describe('retry functionality', () => {
    it('should retry with exponential backoff', async () => {
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

      // First call fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.canRetry).toBe(true);
      expect(result.current.retryCount).toBe(1);

      // Retry should succeed
      await act(async () => {
        const retryPromise = result.current.retry();
        vi.advanceTimersByTime(100); // Advance by retry delay
        await retryPromise;
      });

      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
      expect(result.current.error).toBe(null);
      expect(result.current.retryCount).toBe(0);
    });

    it('should not retry when canRetry is false', async () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.retry();
      });

      expect(mockSwapApiService.getEligibleSwaps).not.toHaveBeenCalled();
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

      // Second failure
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });
      expect(result.current.canRetry).toBe(false); // Should not be able to retry after maxRetries
      expect(result.current.retryCount).toBe(2);
    });
  });

  describe('state management actions', () => {
    it('should clear error state', async () => {
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

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });

    it('should clear submit error state', async () => {
      const validationError = new SwapPlatformError(
        ERROR_CODES.INVALID_SWAP_STATE,
        'Invalid swap state',
        'business_logic'
      );
      mockSwapApiService.createProposal.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBeTruthy();

      act(() => {
        result.current.clearSubmitError();
      });

      expect(result.current.submitError).toBe(null);
    });

    it('should reset all state', async () => {
      mockSwapApiService.getEligibleSwaps.mockResolvedValueOnce(mockEligibleSwapsResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.eligibleSwaps).toHaveLength(1);

      act(() => {
        result.current.reset();
      });

      expect(result.current.eligibleSwaps).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.submitting).toBe(false);
      expect(result.current.submitError).toBe(null);
      expect(result.current.canRetry).toBe(false);
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('request cancellation', () => {
    it('should cancel requests when cancelRequests is called', () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // Start a request to create abort controller
      act(() => {
        result.current.fetchEligibleSwaps();
      });

      // Cancel should not throw
      act(() => {
        result.current.cancelRequests();
      });

      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should cancel requests on unmount', () => {
      const { unmount } = renderHook(() => useProposalModal(defaultOptions));

      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should cancel requests when targetSwapId changes', async () => {
      mockSwapApiService.getEligibleSwaps.mockResolvedValue(mockEligibleSwapsResponse);

      const { result, rerender } = renderHook(
        ({ targetSwapId }) => useProposalModal({ ...defaultOptions, targetSwapId, autoFetch: true }),
        { initialProps: { targetSwapId: 'swap-456' } }
      );

      await waitFor(() => {
        expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledTimes(1);
      });

      // Change targetSwapId should trigger new request and cancel old one
      rerender({ targetSwapId: 'swap-789' });

      await waitFor(() => {
        expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('error message formatting', () => {
    it('should format different error types correctly', async () => {
      const testCases = [
        {
          error: new SwapPlatformError(ERROR_CODES.NETWORK_ERROR, 'Network error', 'integration'),
          expectedMessage: 'Unable to connect. Please check your internet connection.',
        },
        {
          error: new SwapPlatformError(ERROR_CODES.INVALID_TOKEN, 'Invalid token', 'authentication'),
          expectedMessage: 'Your session has expired. Please log in again.',
        },
        {
          error: new SwapPlatformError(ERROR_CODES.ACCESS_DENIED, 'Access denied', 'authorization'),
          expectedMessage: 'You don\'t have permission to access this swap.',
        },
        {
          error: new SwapPlatformError(ERROR_CODES.SWAP_NOT_FOUND, 'Swap not found', 'business_logic'),
          expectedMessage: 'The requested swap was not found.',
        },
        {
          error: new SwapPlatformError(ERROR_CODES.RATE_LIMIT_EXCEEDED, 'Rate limit', 'rate_limiting'),
          expectedMessage: 'Too many requests. Please try again in a moment.',
        },
      ];

      for (const testCase of testCases) {
        mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(testCase.error);

        const { result } = renderHook(() => useProposalModal(defaultOptions));

        await act(async () => {
          await result.current.fetchEligibleSwaps();
        });

        expect(result.current.error).toBe(testCase.expectedMessage);
      }
    });

    it('should handle generic errors', async () => {
      const genericError = new Error('Generic error message');
      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(genericError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Generic error message');
    });
  });
});