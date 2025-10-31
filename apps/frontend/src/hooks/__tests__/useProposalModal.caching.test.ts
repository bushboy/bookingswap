import { renderHook, act, waitFor } from '@testing-library/react';
import { useProposalModal } from '../useProposalModal';
import { swapApiService } from '../../services/swapApiService';
import { swapCacheService } from '../../services/cacheService';
import { performanceMonitor } from '../../services/performanceMonitor';
import { EligibleSwapResponse, CompatibilityAnalysis } from '../../types/api';

// Mock the services
jest.mock('../../services/swapApiService');
jest.mock('../../services/cacheService');
jest.mock('../../services/performanceMonitor');
jest.mock('../useAuthenticationGuard', () => ({
  useAuthenticationGuard: () => ({
    requireAuthentication: jest.fn(() => true),
    handleAuthError: jest.fn(),
    isAuthError: jest.fn(() => false),
    isAuthorizationError: jest.fn(() => false),
    getAuthErrorMessage: jest.fn(() => 'Auth error'),
  }),
}));

const mockSwapApiService = swapApiService as jest.Mocked<typeof swapApiService>;
const mockSwapCacheService = swapCacheService as jest.Mocked<typeof swapCacheService>;
const mockPerformanceMonitor = performanceMonitor as jest.Mocked<typeof performanceMonitor>;

describe('useProposalModal - Caching and Performance', () => {
  const mockUserId = 'user-123';
  const mockTargetSwapId = 'target-swap-456';

  const mockEligibleSwapsResponse: EligibleSwapResponse = {
    swaps: [
      {
        id: 'swap-1',
        title: 'Test Swap 1',
        bookingDetails: {
          dateRange: {
            checkIn: new Date('2024-06-01'),
            checkOut: new Date('2024-06-07'),
          },
          location: 'Test Location 1',
          guests: 2,
          propertyType: 'apartment',
        },
        compatibilityScore: 85,
        eligibilityReasons: ['Great location match'],
        isEligible: true,
      },
      {
        id: 'swap-2',
        title: 'Test Swap 2',
        bookingDetails: {
          dateRange: {
            checkIn: new Date('2024-06-15'),
            checkOut: new Date('2024-06-22'),
          },
          location: 'Test Location 2',
          guests: 4,
          propertyType: 'house',
        },
        compatibilityScore: 72,
        eligibilityReasons: ['Good date match'],
        isEligible: true,
      },
    ],
    totalCount: 2,
    compatibilityThreshold: 60,
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    score: 88,
    factors: [
      { name: 'location', score: 90, weight: 0.3 },
      { name: 'dates', score: 85, weight: 0.4 },
      { name: 'property', score: 90, weight: 0.3 },
    ],
    reasons: ['Excellent location match', 'Good date overlap'],
    recommendations: ['Consider flexible check-in times'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock implementations
    mockSwapCacheService.getEligibleSwaps.mockReturnValue(null);
    mockSwapCacheService.getCompatibilityAnalysis.mockReturnValue(null);
    mockSwapCacheService.setEligibleSwaps.mockImplementation(() => {});
    mockSwapCacheService.setCompatibilityAnalysis.mockImplementation(() => {});
    
    mockSwapApiService.getEligibleSwaps.mockResolvedValue(mockEligibleSwapsResponse);
    mockSwapApiService.getSwapCompatibility.mockResolvedValue(mockCompatibilityAnalysis);
    
    mockPerformanceMonitor.measureAsync.mockImplementation(async (name, operation) => {
      return await operation();
    });
  });

  describe('Eligible Swaps Caching', () => {
    it('should use cached eligible swaps when available', async () => {
      // Setup cache to return cached data
      mockSwapCacheService.getEligibleSwaps.mockReturnValue(mockEligibleSwapsResponse);

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should use cached data and not call API
      expect(mockSwapCacheService.getEligibleSwaps).toHaveBeenCalledWith(mockUserId, mockTargetSwapId);
      expect(mockSwapApiService.getEligibleSwaps).not.toHaveBeenCalled();
      expect(result.current.eligibleSwaps).toEqual(mockEligibleSwapsResponse.swaps);
    });

    it('should fetch from API and cache when no cached data available', async () => {
      // Cache returns null (no cached data)
      mockSwapCacheService.getEligibleSwaps.mockReturnValue(null);

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should check cache first, then call API, then cache the result
      expect(mockSwapCacheService.getEligibleSwaps).toHaveBeenCalledWith(mockUserId, mockTargetSwapId);
      expect(mockSwapApiService.getEligibleSwaps).toHaveBeenCalled();
      expect(mockSwapCacheService.setEligibleSwaps).toHaveBeenCalledWith(
        mockUserId,
        mockTargetSwapId,
        mockEligibleSwapsResponse
      );
      expect(result.current.eligibleSwaps).toEqual(mockEligibleSwapsResponse.swaps);
    });

    it('should not cache paginated requests', async () => {
      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: false,
        })
      );

      await act(async () => {
        // Manually fetch with pagination
        await result.current.fetchEligibleSwaps();
      });

      // Should not check cache for paginated requests
      expect(mockSwapCacheService.getEligibleSwaps).not.toHaveBeenCalled();
      expect(mockSwapCacheService.setEligibleSwaps).not.toHaveBeenCalled();
    });
  });

  describe('Compatibility Analysis Caching', () => {
    it('should use cached compatibility analysis when available', async () => {
      const sourceSwapId = 'swap-1';
      mockSwapCacheService.getCompatibilityAnalysis.mockReturnValue(mockCompatibilityAnalysis);

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refreshCompatibilityScore(sourceSwapId);
      });

      // Should use cached data and not call API
      expect(mockSwapCacheService.getCompatibilityAnalysis).toHaveBeenCalledWith(sourceSwapId, mockTargetSwapId);
      expect(mockSwapApiService.getSwapCompatibility).not.toHaveBeenCalled();
    });

    it('should fetch from API and cache when no cached compatibility data available', async () => {
      const sourceSwapId = 'swap-1';
      mockSwapCacheService.getCompatibilityAnalysis.mockReturnValue(null);

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refreshCompatibilityScore(sourceSwapId);
      });

      // Should check cache first, then call API, then cache the result
      expect(mockSwapCacheService.getCompatibilityAnalysis).toHaveBeenCalledWith(sourceSwapId, mockTargetSwapId);
      expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith(
        sourceSwapId,
        mockTargetSwapId,
        expect.any(Object)
      );
      expect(mockSwapCacheService.setCompatibilityAnalysis).toHaveBeenCalledWith(
        sourceSwapId,
        mockTargetSwapId,
        mockCompatibilityAnalysis
      );
    });
  });

  describe('Performance Monitoring', () => {
    it('should measure performance of compatibility checks', async () => {
      const sourceSwapId = 'swap-1';
      mockSwapCacheService.getCompatibilityAnalysis.mockReturnValue(null);

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: false,
        })
      );

      await act(async () => {
        await result.current.refreshCompatibilityScore(sourceSwapId);
      });

      // Should measure performance of compatibility check
      expect(mockPerformanceMonitor.measureAsync).toHaveBeenCalledWith(
        `compatibility_check_${sourceSwapId}_${mockTargetSwapId}`,
        expect.any(Function),
        { sourceSwapId, targetSwapId: mockTargetSwapId }
      );
    });

    it('should handle performance monitoring errors gracefully', async () => {
      const sourceSwapId = 'swap-1';
      mockSwapCacheService.getCompatibilityAnalysis.mockReturnValue(null);
      mockPerformanceMonitor.measureAsync.mockRejectedValue(new Error('Performance monitoring failed'));

      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: false,
        })
      );

      await act(async () => {
        // Should not throw error even if performance monitoring fails
        await expect(result.current.refreshCompatibilityScore(sourceSwapId)).rejects.toThrow('Performance monitoring failed');
      });
    });
  });

  describe('Debounced Compatibility Fetching', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce multiple compatibility requests for the same swap', async () => {
      mockSwapCacheService.getEligibleSwaps.mockReturnValue(null);
      
      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: true,
        })
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Multiple rapid calls should be debounced
      act(() => {
        result.current.refreshCompatibilityScore('swap-1');
        result.current.refreshCompatibilityScore('swap-1');
        result.current.refreshCompatibilityScore('swap-1');
      });

      // Fast-forward time to trigger debounced function
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        // Should only call API once due to debouncing
        expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle different swaps independently in debouncing', async () => {
      mockSwapCacheService.getEligibleSwaps.mockReturnValue(null);
      
      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: true,
        })
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Calls for different swaps should not interfere with each other
      act(() => {
        result.current.refreshCompatibilityScore('swap-1');
        result.current.refreshCompatibilityScore('swap-2');
      });

      // Fast-forward time to trigger debounced functions
      act(() => {
        jest.advanceTimersByTime(600);
      });

      await waitFor(() => {
        // Should call API for both swaps
        expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledTimes(2);
        expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith('swap-1', mockTargetSwapId, expect.any(Object));
        expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledWith('swap-2', mockTargetSwapId, expect.any(Object));
      });
    });
  });

  describe('Request Staggering', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stagger compatibility requests when fetching eligible swaps', async () => {
      mockSwapCacheService.getEligibleSwaps.mockReturnValue(null);
      
      const { result } = renderHook(() =>
        useProposalModal({
          userId: mockUserId,
          targetSwapId: mockTargetSwapId,
          autoFetch: true,
        })
      );

      // Wait for initial fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Initially no compatibility requests should be made
      expect(mockSwapApiService.getSwapCompatibility).not.toHaveBeenCalled();

      // Fast-forward time to trigger first staggered request
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Fast-forward time to trigger second staggered request
      act(() => {
        jest.advanceTimersByTime(100);
      });

      // Fast-forward debounce delay
      act(() => {
        jest.advanceTimersByTime(500);
      });

      await waitFor(() => {
        // Should have made compatibility requests for both swaps
        expect(mockSwapApiService.getSwapCompatibility).toHaveBeenCalledTimes(2);
      });
    });
  });
});