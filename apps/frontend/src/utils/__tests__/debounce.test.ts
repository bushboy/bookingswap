import { debounce, throttle, debounceAsync, DebouncedMap } from '../debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should delay function execution', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('arg1');
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledWith('arg1');
  });

  it('should cancel previous calls when called multiple times', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('arg1');
    debouncedFn('arg2');
    debouncedFn('arg3');

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg3');
  });

  it('should execute immediately when immediate is true', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000, true);

    debouncedFn('arg1');
    expect(mockFn).toHaveBeenCalledWith('arg1');

    // Subsequent calls should be debounced
    debouncedFn('arg2');
    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending executions', () => {
    const mockFn = jest.fn();
    const debouncedFn = debounce(mockFn, 1000);

    debouncedFn('arg1');
    debouncedFn.cancel();

    jest.advanceTimersByTime(1000);
    expect(mockFn).not.toHaveBeenCalled();
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should limit function execution frequency', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 1000);

    throttledFn('arg1');
    throttledFn('arg2');
    throttledFn('arg3');

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1');

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenLastCalledWith('arg3');
  });

  it('should respect leading and trailing options', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 1000, { leading: false, trailing: true });

    throttledFn('arg1');
    expect(mockFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledWith('arg1');
  });

  it('should cancel pending executions', () => {
    const mockFn = jest.fn();
    const throttledFn = throttle(mockFn, 1000);

    throttledFn('arg1');
    throttledFn('arg2');
    throttledFn.cancel();

    jest.advanceTimersByTime(1000);
    expect(mockFn).toHaveBeenCalledTimes(1); // Only the first call
  });
});

describe('debounceAsync', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should debounce async function calls', async () => {
    const mockAsyncFn = jest.fn().mockResolvedValue('result');
    const debouncedFn = debounceAsync(mockAsyncFn, 1000);

    const promise1 = debouncedFn('arg1');
    const promise2 = debouncedFn('arg2');

    expect(mockAsyncFn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    await Promise.all([promise1, promise2]);

    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    expect(mockAsyncFn).toHaveBeenCalledWith('arg2', expect.any(AbortController));
  });

  it('should handle async function errors', async () => {
    const mockAsyncFn = jest.fn().mockRejectedValue(new Error('Async error'));
    const debouncedFn = debounceAsync(mockAsyncFn, 1000);

    const promise = debouncedFn('arg1');

    jest.advanceTimersByTime(1000);
    await expect(promise).rejects.toThrow('Async error');
  });

  it('should abort previous requests when abortPrevious is true', async () => {
    const mockAsyncFn = jest.fn().mockImplementation(async (arg, abortController) => {
      return new Promise((resolve, reject) => {
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
        setTimeout(() => resolve(`result-${arg}`), 500);
      });
    });

    const debouncedFn = debounceAsync(mockAsyncFn, 1000, { abortPrevious: true });

    const promise1 = debouncedFn('arg1');
    const promise2 = debouncedFn('arg2');

    jest.advanceTimersByTime(1000);

    await expect(promise1).rejects.toThrow('Aborted');
    await expect(promise2).resolves.toBe('result-arg2');
  });

  it('should respect maxWait option', async () => {
    const mockAsyncFn = jest.fn().mockResolvedValue('result');
    const debouncedFn = debounceAsync(mockAsyncFn, 1000, { maxWait: 2000 });

    debouncedFn('arg1');
    
    // Keep calling before debounce delay expires
    jest.advanceTimersByTime(500);
    debouncedFn('arg2');
    
    jest.advanceTimersByTime(500);
    debouncedFn('arg3');
    
    jest.advanceTimersByTime(500);
    debouncedFn('arg4');

    // Should execute due to maxWait even though we keep calling
    jest.advanceTimersByTime(500); // Total 2000ms

    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending async executions', async () => {
    const mockAsyncFn = jest.fn().mockResolvedValue('result');
    const debouncedFn = debounceAsync(mockAsyncFn, 1000);

    const promise = debouncedFn('arg1');
    debouncedFn.cancel();

    jest.advanceTimersByTime(1000);
    const result = await promise;

    expect(result).toBeUndefined();
    expect(mockAsyncFn).not.toHaveBeenCalled();
  });

  it('should flush pending executions', async () => {
    const mockAsyncFn = jest.fn().mockResolvedValue('result');
    const debouncedFn = debounceAsync(mockAsyncFn, 1000);

    debouncedFn('arg1');
    const result = await debouncedFn.flush();

    expect(result).toBe('result');
    expect(mockAsyncFn).toHaveBeenCalledWith('arg1', expect.any(AbortController));
  });
});

describe('DebouncedMap', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create separate debounced functions for different keys', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    const fn1 = debouncedMap.get('key1');
    const fn2 = debouncedMap.get('key2');

    fn1('arg1');
    fn2('arg2');

    jest.advanceTimersByTime(1000);

    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('arg1');
    expect(mockFn).toHaveBeenCalledWith('arg2');
  });

  it('should reuse debounced functions for the same key', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    const fn1a = debouncedMap.get('key1');
    const fn1b = debouncedMap.get('key1');

    expect(fn1a).toBe(fn1b);
  });

  it('should cancel debounced function for specific key', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    const fn1 = debouncedMap.get('key1');
    const fn2 = debouncedMap.get('key2');

    fn1('arg1');
    fn2('arg2');

    debouncedMap.cancel('key1');

    jest.advanceTimersByTime(1000);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg2');
  });

  it('should cancel all debounced functions', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    const fn1 = debouncedMap.get('key1');
    const fn2 = debouncedMap.get('key2');

    fn1('arg1');
    fn2('arg2');

    debouncedMap.cancelAll();

    jest.advanceTimersByTime(1000);

    expect(mockFn).not.toHaveBeenCalled();
  });

  it('should delete specific debounced functions', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    debouncedMap.get('key1');
    debouncedMap.get('key2');

    expect(debouncedMap.size).toBe(2);

    const deleted = debouncedMap.delete('key1');
    expect(deleted).toBe(true);
    expect(debouncedMap.size).toBe(1);

    const deletedAgain = debouncedMap.delete('key1');
    expect(deletedAgain).toBe(false);
  });

  it('should clear all debounced functions', () => {
    const mockFn = jest.fn();
    const debouncedMap = new DebouncedMap(mockFn, 1000);

    debouncedMap.get('key1');
    debouncedMap.get('key2');

    expect(debouncedMap.size).toBe(2);

    debouncedMap.clear();
    expect(debouncedMap.size).toBe(0);
  });
});