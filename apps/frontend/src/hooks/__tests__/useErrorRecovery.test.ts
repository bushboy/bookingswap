import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useErrorRecovery } from '../useErrorRecovery';
import { CircuitBreakerState } from '../../services/errorRecoveryService';

// Mock the error recovery service
vi.mock('../../services/errorRecoveryService', () => ({
  errorRecoveryService: {
    executeWithRecovery: vi.fn(),
    getCircuitBreakerStats: vi.fn(),
    resetCircuitBreaker: vi.fn(),
    createManualRetry: vi.fn(),
  },
  CircuitBreakerState: {
    CLOSED: 'closed',
    OPEN: 'open',
    HALF_OPEN: 'half_open',
  },
}));

// Mock the accessibility hook
vi.mock('../useAccessibility', () => ({
  useAnnouncements: () => ({
    announce: vi.fn(),
  }),
}));

describe('useErrorRecovery', () => {
  const mockExecuteWithRecovery = vi.fn();
  const mockGetCircuitBreakerStats = vi.fn();
  const mockResetCircuitBreaker = vi.fn();
  const mockCreateManualRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mocks
    const { errorRecoveryService } = require('../../services/errorRecoveryService');
    errorRecoveryService.executeWithRecovery = mockExecuteWithRecovery;
    errorRecoveryService.getCircuitBreakerStats = mockGetCircuitBreakerStats;
    errorRecoveryService.resetCircuitBreaker = mockResetCircuitBreaker;
    errorRecoveryService.createManualRetry = mockCreateManualRetry;

    // Default mock implementations
    mockGetCircuitBreakerStats.mockReturnValue({
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextAttemptTime: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      expect(result.current.isRetrying).toBe(false);
      expect(result.current.isManualRetrying).toBe(false);
      expect(result.current.currentAttempt).toBe(0);
      expect(result.current.maxAttempts).toBe(3);
      expect(result.current.lastError).toBeNull();
      expect(result.current.canRetry).toBe(true);
      expect(result.current.canManualRetry).toBe(true);
    });

    it('should use custom configuration', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          config: {
            maxAttempts: 5,
            baseDelay: 2000,
          },
        })
      );

      expect(result.current.maxAttempts).toBe(5);
    });
  });

  describe('executeWithRecovery', () => {
    it('should execute operation successfully', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');
      const onSuccess = vi.fn();

      mockExecuteWithRecovery.mockResolvedValue({
        success: true,
        data: 'success',
        attemptCount: 1,
        totalDelay: 0,
        circuitBreakerTriggered: false,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          onSuccess,
        })
      );

      await act(async () => {
        await result.current.executeWithRecovery(mockOperation);
      });

      expect(mockExecuteWithRecovery).toHaveBeenCalledWith(
        mockOperation,
        'test-operation',
        expect.objectContaining({
          maxAttempts: 3,
          baseDelay: 1000,
        }),
        expect.objectContaining({
          failureThreshold: 5,
          recoveryTimeout: 30000,
        })
      );

      expect(onSuccess).toHaveBeenCalledWith('success');
      expect(result.current.isRetrying).toBe(false);
    });

    it('should handle operation failure', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
      const onError = vi.fn();

      mockExecuteWithRecovery.mockResolvedValue({
        success: false,
        error: new Error('Test error'),
        attemptCount: 3,
        totalDelay: 3000,
        circuitBreakerTriggered: false,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          onError,
        })
      );

      await act(async () => {
        await result.current.executeWithRecovery(mockOperation);
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(result.current.lastError).toEqual(expect.any(Error));
      expect(result.current.canRetry).toBe(true);
    });

    it('should handle circuit breaker triggered', async () => {
      const mockOperation = vi.fn();

      mockExecuteWithRecovery.mockResolvedValue({
        success: false,
        error: new Error('Circuit breaker open'),
        attemptCount: 1,
        totalDelay: 0,
        circuitBreakerTriggered: true,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      await act(async () => {
        await result.current.executeWithRecovery(mockOperation);
      });

      expect(result.current.canRetry).toBe(false);
      expect(result.current.canManualRetry).toBe(false);
    });
  });

  describe('retry functionality', () => {
    it('should retry with delay', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success');

      mockExecuteWithRecovery.mockResolvedValue({
        success: true,
        data: 'success',
        attemptCount: 1,
        totalDelay: 0,
        circuitBreakerTriggered: false,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      // Set up state for retry
      act(() => {
        result.current.updateConfig({ maxAttempts: 3 });
      });

      // Mock that we have a retry available
      Object.defineProperty(result.current, 'canRetry', { value: true });
      Object.defineProperty(result.current, 'nextRetryTime', { value: Date.now() + 1000 });

      const retryPromise = act(async () => {
        await result.current.retry();
      });

      // Fast-forward time
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await retryPromise;

      expect(mockExecuteWithRecovery).toHaveBeenCalled();
    });

    it('should not retry when canRetry is false', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      // Mock canRetry as false
      Object.defineProperty(result.current, 'canRetry', { value: false });

      await act(async () => {
        await result.current.retry();
      });

      expect(mockExecuteWithRecovery).not.toHaveBeenCalled();
    });
  });

  describe('manual retry', () => {
    it('should perform manual retry immediately', async () => {
      const mockManualRetryFn = vi.fn().mockResolvedValue(undefined);
      mockCreateManualRetry.mockReturnValue(mockManualRetryFn);

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      // Mock that we have a manual retry available
      Object.defineProperty(result.current, 'canManualRetry', { value: true });

      await act(async () => {
        await result.current.manualRetry();
      });

      expect(mockCreateManualRetry).toHaveBeenCalled();
      expect(mockManualRetryFn).toHaveBeenCalled();
    });

    it('should not perform manual retry when not available', async () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      // Mock canManualRetry as false
      Object.defineProperty(result.current, 'canManualRetry', { value: false });

      await act(async () => {
        await result.current.manualRetry();
      });

      expect(mockCreateManualRetry).not.toHaveBeenCalled();
    });
  });

  describe('circuit breaker management', () => {
    it('should reset circuit breaker', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      act(() => {
        result.current.resetCircuitBreaker();
      });

      expect(mockResetCircuitBreaker).toHaveBeenCalledWith('test-operation');
    });

    it('should update state when circuit breaker state changes', async () => {
      const onCircuitBreakerStateChange = vi.fn();

      // Mock circuit breaker stats changing from CLOSED to OPEN
      mockGetCircuitBreakerStats
        .mockReturnValueOnce({
          state: CircuitBreakerState.CLOSED,
          failureCount: 0,
          successCount: 0,
          lastFailureTime: null,
          lastSuccessTime: null,
          nextAttemptTime: null,
        })
        .mockReturnValueOnce({
          state: CircuitBreakerState.OPEN,
          failureCount: 5,
          successCount: 0,
          lastFailureTime: Date.now(),
          lastSuccessTime: null,
          nextAttemptTime: Date.now() + 30000,
        });

      const { result, rerender } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          onCircuitBreakerStateChange,
        })
      );

      // Trigger stats update
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      rerender();

      await waitFor(() => {
        expect(result.current.canRetry).toBe(false);
        expect(result.current.canManualRetry).toBe(false);
      });
    });
  });

  describe('configuration updates', () => {
    it('should update configuration', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      act(() => {
        result.current.updateConfig({
          maxAttempts: 5,
          baseDelay: 2000,
        });
      });

      expect(result.current.maxAttempts).toBe(5);
    });
  });

  describe('error clearing', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      // Mock error state
      Object.defineProperty(result.current, 'lastError', { 
        value: new Error('Test error'),
        writable: true 
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.lastError).toBeNull();
    });
  });

  describe('callbacks', () => {
    it('should call onRetryStart and onRetryEnd callbacks', async () => {
      const onRetryStart = vi.fn();
      const onRetryEnd = vi.fn();

      mockExecuteWithRecovery.mockResolvedValue({
        success: true,
        data: 'success',
        attemptCount: 2,
        totalDelay: 1000,
        circuitBreakerTriggered: false,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          onRetryStart,
          onRetryEnd,
        })
      );

      const mockOperation = vi.fn().mockResolvedValue('success');

      await act(async () => {
        await result.current.executeWithRecovery(mockOperation);
      });

      expect(onRetryStart).toHaveBeenCalledWith(1);
      expect(onRetryEnd).toHaveBeenCalledWith(true, 2);
    });

    it('should announce errors when enabled', async () => {
      const mockAnnounce = vi.fn();
      
      // Mock the useAnnouncements hook
      vi.mocked(require('../useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce,
      });

      mockExecuteWithRecovery.mockResolvedValue({
        success: false,
        error: new Error('Test error'),
        attemptCount: 1,
        totalDelay: 0,
        circuitBreakerTriggered: false,
      });

      const { result } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
          announceErrors: true,
        })
      );

      const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));

      await act(async () => {
        await result.current.executeWithRecovery(mockOperation);
      });

      expect(mockAnnounce).toHaveBeenCalledWith(
        'Operation failed: Test error',
        'assertive'
      );
    });
  });

  describe('cleanup', () => {
    it('should cleanup intervals on unmount', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() =>
        useErrorRecovery({
          operationName: 'test-operation',
        })
      );

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});