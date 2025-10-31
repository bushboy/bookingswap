import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingState } from '../useLoadingState';

describe('useLoadingState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with not loading state', () => {
    const { result } = renderHook(() => useLoadingState());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should set loading state', () => {
    const { result } = renderHook(() => useLoadingState());

    act(() => {
      result.current.setLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should set error state and clear loading', () => {
    const { result } = renderHook(() => useLoadingState());
    const error = new Error('Test error');

    act(() => {
      result.current.setLoading(true);
    });

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useLoadingState());
    const error = new Error('Test error');

    act(() => {
      result.current.setError(error);
    });

    expect(result.current.error).toBe(error);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should execute async operation with loading state', async () => {
    const { result } = renderHook(() => useLoadingState());
    const mockOperation = vi.fn().mockResolvedValue('success');

    let operationResult: string | undefined;

    await act(async () => {
      operationResult = await result.current.executeWithLoading(mockOperation);
    });

    expect(mockOperation).toHaveBeenCalled();
    expect(operationResult).toBe('success');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle async operation errors', async () => {
    const { result } = renderHook(() => useLoadingState());
    const error = new Error('Operation failed');
    const mockOperation = vi.fn().mockRejectedValue(error);

    await act(async () => {
      try {
        await result.current.executeWithLoading(mockOperation);
      } catch (e) {
        // Expected to throw
      }
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(error);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useLoadingState());
    const error = new Error('Test error');

    act(() => {
      result.current.setLoading(true);
      result.current.setError(error);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle multiple concurrent operations', async () => {
    const { result } = renderHook(() => useLoadingState());
    const operation1 = vi.fn().mockResolvedValue('result1');
    const operation2 = vi.fn().mockResolvedValue('result2');

    const promise1 = act(async () => {
      return result.current.executeWithLoading(operation1);
    });

    const promise2 = act(async () => {
      return result.current.executeWithLoading(operation2);
    });

    const [result1, result2] = await Promise.all([promise1, promise2]);

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(result.current.isLoading).toBe(false);
  });
});
