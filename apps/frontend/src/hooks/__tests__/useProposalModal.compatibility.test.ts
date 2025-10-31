import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useProposalModal } from '../useProposalModal';
import { swapApiService } from '../../services/swapApiService';
import type { CompatibilityAnalysis } from '../../types/api';

// Mock the swapApiService
vi.mock('../../services/swapApiService', () => ({
  swapApiService: {
    getEligibleSwaps: vi.fn(),
    createProposal: vi.fn(),
    getSwapCompatibility: vi.fn(),
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

const mockSwapApiService = vi.mocked(swapApiService);

describe('useProposalModal - Compatibility Scoring', () => {
  const defaultOptions = {
    userId: 'user-123',
    targetSwapId: 'swap-456',
    autoFetch: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCompatibilityScore', () => {
    it('should return null when no analysis is available', () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      const score = result.current.getCompatibilityScore('swap-123');
      expect(score).toBeNull();
    });

    it('should return compatibility score from analysis when available', async () => {
      const mockAnalysis: CompatibilityAnalysis = {
        score: 85,
        reasons: ['Similar location', 'Matching dates'],
        isEligible: true,
      };

      mockSwapApiService.getSwapCompatibility.mockResolvedValueOnce(mockAnalysis);

      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      // Trigger compatibility fetch
      await result.current.refreshCompatibilityScore('swap-123');

      await waitFor(() => {
        const score = result.current.getCompatibilityScore('swap-123');
        expect(score).toEqual({
          value: 85,
          level: 'excellent',
          displayText: '85% - Excellent Match',
          styleClass: 'compatibility-excellent',
        });
      });
    });
  });

  describe('getCompatibilityAnalysis', () => {
    it('should return null when no analysis is available', () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      const analysis = result.current.getCompatibilityAnalysis('swap-123');
      expect(analysis).toBeNull();
    });

    it('should return full analysis when available', async () => {
      const mockAnalysis: CompatibilityAnalysis = {
        score: 75,
        reasons: ['Similar accommodation type', 'Overlapping dates'],
        isEligible: true,
      };

      mockSwapApiService.getSwapCompatibility.mockResolvedValueOnce(mockAnalysis);

      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      // Trigger compatibility fetch
      await result.current.refreshCompatibilityScore('swap-123');

      await waitFor(() => {
        const analysis = result.current.getCompatibilityAnalysis('swap-123');
        expect(analysis).toEqual(mockAnalysis);
      });
    });
  });

  describe('isLoadingCompatibility', () => {
    it('should return false when not loading', () => {
      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      const isLoading = result.current.isLoadingCompatibility('swap-123');
      expect(isLoading).toBe(false);
    });

    it('should return true when loading compatibility', async () => {
      let resolvePromise: (value: CompatibilityAnalysis) => void;
      const promise = new Promise<CompatibilityAnalysis>((resolve) => {
        resolvePromise = resolve;
      });
      
      mockSwapApiService.getSwapCompatibility.mockReturnValueOnce(promise);

      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      // Start compatibility fetch
      result.current.refreshCompatibilityScore('swap-123');

      // Should be loading
      expect(result.current.isLoadingCompatibility('swap-123')).toBe(true);

      // Resolve the promise
      resolvePromise!({
        score: 80,
        reasons: ['Good match'],
        isEligible: true,
      });

      await waitFor(() => {
        expect(result.current.isLoadingCompatibility('swap-123')).toBe(false);
      });
    });
  });

  describe('refreshCompatibilityScore', () => {
    it('should fetch compatibility analysis from API', async () => {
      const mockAnalysis: CompatibilityAnalysis = {
        score: 90,
        reasons: ['Perfect match'],
        isEligible: true,
      };

      mockSwapApiService.getSwapCompatibility.mockResolvedValueOnce(mockAnalysis);

      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      await result.current.refreshCompatibilityScore('swap-123');

      expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith(
        'swap-123',
        'swap-456',
        expect.objectContaining({
          timeout: 10000,
          abortController: expect.any(AbortController),
        })
      );

      await waitFor(() => {
        const analysis = result.current.getCompatibilityAnalysis('swap-123');
        expect(analysis).toEqual(mockAnalysis);
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API Error');
      mockSwapApiService.getSwapCompatibility.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useProposalModal(defaultOptions));
      
      // Should not throw
      await result.current.refreshCompatibilityScore('swap-123');

      // Should not have analysis after error
      const analysis = result.current.getCompatibilityAnalysis('swap-123');
      expect(analysis).toBeNull();
    });
  });
});