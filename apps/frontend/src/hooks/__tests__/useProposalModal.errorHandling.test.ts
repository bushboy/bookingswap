import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useProposalModal } from '../useProposalModal';
import { swapApiService } from '../../services/swapApiService';
import { SwapPlatformError, ValidationError, BusinessLogicError, ERROR_CODES } from '@booking-swap/shared';
import type {
  EligibleSwapResponse,
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
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
    isAuthError: vi.fn((error) => error.code === ERROR_CODES.INVALID_TOKEN),
    isAuthorizationError: vi.fn((error) => error.code === ERROR_CODES.ACCESS_DENIED),
    getAuthErrorMessage: vi.fn((error) => {
      if (error.code === ERROR_CODES.INVALID_TOKEN) return 'Your session has expired. Please log in again.';
      if (error.code === ERROR_CODES.ACCESS_DENIED) return 'You don\'t have permission to access this swap.';
      return 'Authentication error';
    }),
  }),
}));

// Mock the error recovery service
vi.mock('../useErrorRecovery', () => ({
  useErrorRecovery: () => ({
    executeWithRecovery: vi.fn(),
    canRetry: vi.fn(() => true),
    getRetryDelay: vi.fn(() => 100),
    shouldRetry: vi.fn((error) => error.retryable),
  }),
}));

const mockSwapApiService = vi.mocked(swapApiService);

describe('useProposalModal - Error Handling', () => {
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

  const mockProposalRequest: CreateProposalRequest = {
    sourceSwapId: 'source-swap-123',
    message: 'Test proposal message',
    conditions: ['Test condition'],
    agreedToTerms: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Network Error Handling', () => {
    it('should handle network errors with user-friendly messages', async () => {
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

      expect(result.current.error).toBe('Unable to connect. Please check your internet connection.');
      expect(result.current.canRetry).toBe(true);
      expect(result.current.loading).toBe(false);
      expect(result.current.eligibleSwaps).toEqual([]);
    });

    it('should handle timeout errors specifically', async () => {
      const timeoutError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'timeout of 15000ms exceeded',
        'integration',
        true
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(timeoutError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('Unable to connect. Please check your internet connection.');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle connection refused errors', async () => {
      const connectionError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'connect ECONNREFUSED',
        'integration',
        true
      );

      mockSwapApiService.getSwapCompatibility.mockRejectedValueOnce(connectionError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.refreshCompatibilityScore('swap-123');
      });

      // Should handle error gracefully without crashing
      const analysis = result.current.getCompatibilityAnalysis('swap-123');
      expect(analysis).toBeNull();
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle expired token errors', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Token expired',
        'authentication',
        false
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(authError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Your session has expired. Please log in again.');
      expect(result.current.canRetry).toBe(false); // Auth errors are not retryable
      expect(result.current.loading).toBe(false);
    });

    it('should handle invalid credentials during proposal submission', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Invalid credentials',
        'authentication',
        false
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(authError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('Your session has expired. Please log in again.');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle authentication errors during compatibility checks', async () => {
      const authError = new SwapPlatformError(
        ERROR_CODES.INVALID_TOKEN,
        'Authentication required',
        'authentication',
        false
      );

      mockSwapApiService.getSwapCompatibility.mockRejectedValueOnce(authError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.refreshCompatibilityScore('swap-123');
      });

      // Should handle error gracefully
      const analysis = result.current.getCompatibilityAnalysis('swap-123');
      expect(analysis).toBeNull();
      expect(result.current.isLoadingCompatibility('swap-123')).toBe(false);
    });
  });

  describe('Authorization Error Handling', () => {
    it('should handle access denied errors', async () => {
      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Access denied',
        'authorization',
        false
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(authzError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('You don\'t have permission to access this swap.');
      expect(result.current.canRetry).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('should handle forbidden proposal creation', async () => {
      const authzError = new SwapPlatformError(
        ERROR_CODES.ACCESS_DENIED,
        'Cannot propose to own swap',
        'authorization',
        false
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(authzError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('You don\'t have permission to access this swap.');
      expect(result.current.submitting).toBe(false);
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle client-side validation errors', async () => {
      const validationError = new ValidationError(
        'Invalid proposal data',
        {
          sourceSwapId: ['Source swap ID is required'],
          conditions: ['At least one condition is required'],
        }
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal({
          sourceSwapId: '',
          conditions: [],
          agreedToTerms: true,
        });
      });

      expect(result.current.submitError).toBe('Invalid proposal data');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle server-side validation errors', async () => {
      const validationError = new ValidationError(
        'Validation failed',
        {
          message: ['Message is too long'],
          conditions: ['Invalid condition format'],
        }
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal({
          ...mockProposalRequest,
          message: 'a'.repeat(1001),
        });
      });

      expect(result.current.submitError).toBe('Validation failed');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle validation errors for eligible swaps request', async () => {
      const validationError = new ValidationError(
        'Invalid request parameters',
        {
          targetSwapId: ['Target swap ID is invalid'],
        }
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(validationError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Invalid request parameters');
      expect(result.current.canRetry).toBe(false);
      expect(result.current.loading).toBe(false);
    });
  });

  describe('Business Logic Error Handling', () => {
    it('should handle swap not found errors', async () => {
      const notFoundError = new BusinessLogicError(
        ERROR_CODES.SWAP_NOT_FOUND,
        'Swap not found'
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(notFoundError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('The requested swap was not found.');
      expect(result.current.canRetry).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    it('should handle invalid swap state errors', async () => {
      const invalidStateError = new BusinessLogicError(
        ERROR_CODES.INVALID_SWAP_STATE,
        'Swap is no longer available'
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(invalidStateError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('Swap is no longer available');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle duplicate proposal errors', async () => {
      const duplicateError = new BusinessLogicError(
        ERROR_CODES.DUPLICATE_PROPOSAL,
        'You have already submitted a proposal for this swap'
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(duplicateError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('You have already submitted a proposal for this swap');
      expect(result.current.submitting).toBe(false);
    });
  });

  describe('Rate Limiting Error Handling', () => {
    it('should handle rate limit errors with retry capability', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Too many requests',
        'rate_limiting',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(rateLimitError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Too many requests. Please try again in a moment.');
      expect(result.current.canRetry).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('should handle rate limiting during proposal submission', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded for proposals',
        'rate_limiting',
        true
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(rateLimitError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('Too many requests. Please try again in a moment.');
      expect(result.current.submitting).toBe(false);
    });

    it('should handle rate limiting during compatibility checks', async () => {
      const rateLimitError = new SwapPlatformError(
        ERROR_CODES.RATE_LIMIT_EXCEEDED,
        'Rate limit exceeded for compatibility checks',
        'rate_limiting',
        true
      );

      mockSwapApiService.getSwapCompatibility.mockRejectedValueOnce(rateLimitError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.refreshCompatibilityScore('swap-123');
      });

      // Should handle error gracefully
      const analysis = result.current.getCompatibilityAnalysis('swap-123');
      expect(analysis).toBeNull();
    });
  });

  describe('Server Error Handling', () => {
    it('should handle internal server errors with retry capability', async () => {
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Internal server error',
        'server_error',
        true
      );

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(serverError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Something went wrong. Please try again.');
      expect(result.current.canRetry).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('should handle service unavailable errors', async () => {
      const serviceError = new SwapPlatformError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Service temporarily unavailable',
        'server_error',
        true
      );

      mockSwapApiService.createProposal.mockRejectedValueOnce(serviceError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('Something went wrong. Please try again.');
      expect(result.current.submitting).toBe(false);
    });
  });

  describe('Generic Error Handling', () => {
    it('should handle unknown errors gracefully', async () => {
      const unknownError = new Error('Unknown error occurred');

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(unknownError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe('Unknown error occurred');
      expect(result.current.loading).toBe(false);
    });

    it('should handle errors without message', async () => {
      const emptyError = new Error('');

      mockSwapApiService.createProposal.mockRejectedValueOnce(emptyError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.submitError).toBe('An unexpected error occurred');
      expect(result.current.submitting).toBe(false);
    });
  });

  describe('Error State Management', () => {
    it('should clear error state when clearError is called', async () => {
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

    it('should clear submit error state when clearSubmitError is called', async () => {
      const validationError = new ValidationError('Invalid data');

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

    it('should maintain separate error states for different operations', async () => {
      const fetchError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Fetch error',
        'integration',
        true
      );
      const submitError = new ValidationError('Submit error');

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(fetchError);
      mockSwapApiService.createProposal.mockRejectedValueOnce(submitError);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // Fetch fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.submitError).toBe(null);

      // Submit fails
      await act(async () => {
        await result.current.submitProposal(mockProposalRequest);
      });

      expect(result.current.error).toBeTruthy(); // Still has fetch error
      expect(result.current.submitError).toBeTruthy(); // Now has submit error
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from transient errors on retry', async () => {
      const transientError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Temporary network issue',
        'integration',
        true
      );

      const mockResponse: EligibleSwapResponse = {
        swaps: [mockEligibleSwap],
        totalCount: 1,
        compatibilityThreshold: 60,
      };

      mockSwapApiService.getEligibleSwaps
        .mockRejectedValueOnce(transientError)
        .mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // First attempt fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.canRetry).toBe(true);

      // Retry succeeds
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBe(null);
      expect(result.current.eligibleSwaps).toEqual([mockEligibleSwap]);
      expect(result.current.canRetry).toBe(false);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const fetchError = new SwapPlatformError(
        ERROR_CODES.NETWORK_ERROR,
        'Fetch failed',
        'integration',
        true
      );

      const mockProposalResponse: ProposalResponse = {
        proposalId: 'proposal-123',
        status: 'pending',
        estimatedResponseTime: '24 hours',
      };

      mockSwapApiService.getEligibleSwaps.mockRejectedValueOnce(fetchError);
      mockSwapApiService.createProposal.mockResolvedValueOnce(mockProposalResponse);

      const { result } = renderHook(() => useProposalModal(defaultOptions));

      // Fetch fails
      await act(async () => {
        await result.current.fetchEligibleSwaps();
      });

      expect(result.current.error).toBeTruthy();

      // But proposal submission can still succeed
      let proposalResult: ProposalResponse | null = null;
      await act(async () => {
        proposalResult = await result.current.submitProposal(mockProposalRequest);
      });

      expect(proposalResult).toEqual(mockProposalResponse);
      expect(result.current.submitError).toBe(null);
      // Fetch error should still be present
      expect(result.current.error).toBeTruthy();
    });
  });
});