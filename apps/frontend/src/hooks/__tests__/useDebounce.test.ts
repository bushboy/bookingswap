import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

// Mock timers
jest.useFakeTimers();

describe('useDebounce', () => {
  afterEach(() => {
    jest.clearAllTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    expect(result.current).toBe('initial');

    // Change the value
    rerender({ value: 'updated', delay: 500 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 250ms (less than delay)
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Value should still be the old one
    expect(result.current).toBe('initial');

    // Fast-forward time by another 250ms (total 500ms)
    act(() => {
      jest.advanceTimersByTime(250);
    });

    // Now the value should be updated
    expect(result.current).toBe('updated');
  });

  it('cancels previous timeout when value changes quickly', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    // Change value multiple times quickly
    rerender({ value: 'first', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: 'second', delay: 500 });

    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: 'final', delay: 500 });

    // Value should still be initial
    expect(result.current).toBe('initial');

    // Fast-forward by full delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should have the final value, not intermediate ones
    expect(result.current).toBe('final');
  });

  it('works with different data types', () => {
    // Test with number
    const { result: numberResult, rerender: numberRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 0, delay: 300 },
      }
    );

    numberRerender({ value: 42, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(numberResult.current).toBe(42);

    // Test with object
    const { result: objectResult, rerender: objectRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: { name: 'initial' }, delay: 300 },
      }
    );

    const newObject = { name: 'updated' };
    objectRerender({ value: newObject, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(objectResult.current).toBe(newObject);

    // Test with array
    const { result: arrayResult, rerender: arrayRerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: [1, 2, 3], delay: 300 },
      }
    );

    const newArray = [4, 5, 6];
    arrayRerender({ value: newArray, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(arrayResult.current).toBe(newArray);
  });

  it('handles delay changes', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    // Change value and delay
    rerender({ value: 'updated', delay: 1000 });

    // Fast-forward by original delay (500ms)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Value should not be updated yet (new delay is 1000ms)
    expect(result.current).toBe('initial');

    // Fast-forward by remaining time (500ms more)
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Now it should be updated
    expect(result.current).toBe('updated');
  });

  it('cleans up timeout on unmount', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    rerender({ value: 'updated', delay: 500 });

    // Unmount before timeout completes
    unmount();

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // No errors should occur and no state updates should happen
    expect(result.current).toBe('initial');
  });

  it('handles zero delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 0 },
      }
    );

    rerender({ value: 'updated', delay: 0 });

    // Even with zero delay, it should still use setTimeout
    expect(result.current).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });

  it('handles negative delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: -100 },
      }
    );

    rerender({ value: 'updated', delay: -100 });

    // Negative delay should still work (setTimeout handles it)
    act(() => {
      jest.advanceTimersByTime(0);
    });

    expect(result.current).toBe('updated');
  });

  it('handles undefined and null values', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: undefined as any, delay: 300 },
      }
    );

    expect(result.current).toBeUndefined();

    rerender({ value: null as any, delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBeNull();

    rerender({ value: 'defined', delay: 300 });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('defined');
  });
});
