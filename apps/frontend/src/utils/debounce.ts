/**
 * Debounce function that delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  let result: ReturnType<T>;

  const debounced = function (this: any, ...args: Parameters<T>) {
    const context = this;
    
    const later = () => {
      timeout = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };

    const callNow = immediate && !timeout;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
    
    if (callNow) {
      result = func.apply(context, args);
    }
    
    return result;
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}

/**
 * Throttle function that limits execution to at most once per wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: { leading?: boolean; trailing?: boolean } = {}
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;
  let previous = 0;
  let result: ReturnType<T>;
  
  const { leading = true, trailing = true } = options;

  const throttled = function (this: any, ...args: Parameters<T>) {
    const context = this;
    const now = Date.now();
    
    if (!previous && !leading) {
      previous = now;
    }
    
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      result = func.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = !leading ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
      }, remaining);
    }
    
    return result;
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    previous = 0;
  };

  return throttled;
}

/**
 * Create a debounced version of an async function with proper cleanup
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number,
  options: { 
    immediate?: boolean;
    maxWait?: number;
    abortPrevious?: boolean;
  } = {}
): T & { cancel: () => void; flush: () => Promise<ReturnType<T> | undefined> } {
  const { immediate = false, maxWait, abortPrevious = true } = options;
  
  let timeout: NodeJS.Timeout | null = null;
  let maxTimeout: NodeJS.Timeout | null = null;
  let lastCallTime = 0;
  let lastInvokeTime = 0;
  let currentPromise: Promise<ReturnType<T>> | null = null;
  let currentAbortController: AbortController | null = null;

  const invokeFunc = async (context: any, args: Parameters<T>): Promise<ReturnType<T>> => {
    lastInvokeTime = Date.now();
    
    // Abort previous request if configured to do so
    if (abortPrevious && currentAbortController) {
      currentAbortController.abort();
    }
    
    // Create new abort controller for this request
    currentAbortController = new AbortController();
    
    try {
      // If the function accepts an AbortController, pass it as the last argument
      const funcWithAbort = func as any;
      const result = await funcWithAbort.apply(context, [...args, currentAbortController]);
      currentAbortController = null;
      return result;
    } catch (error) {
      currentAbortController = null;
      throw error;
    }
  };

  const leadingEdge = (context: any, args: Parameters<T>): Promise<ReturnType<T>> => {
    lastInvokeTime = Date.now();
    currentPromise = invokeFunc(context, args);
    return currentPromise;
  };

  const remainingWait = (time: number): number => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;
    
    return maxWait === undefined
      ? timeWaiting
      : Math.min(timeWaiting, maxWait - timeSinceLastInvoke);
  };

  const shouldInvoke = (time: number): boolean => {
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    
    return (
      lastCallTime === 0 ||
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    );
  };

  const timerExpired = (): Promise<ReturnType<T> | undefined> => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    
    // Restart the timer
    timeout = setTimeout(timerExpired, remainingWait(time));
    return Promise.resolve(undefined);
  };

  const trailingEdge = (time: number): Promise<ReturnType<T> | undefined> => {
    timeout = null;
    
    // Only invoke if we have `lastArgs` which means `func` has been debounced at least once
    if (lastCallTime > 0) {
      return currentPromise || Promise.resolve(undefined);
    }
    
    return Promise.resolve(undefined);
  };

  const cancel = (): void => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (maxTimeout) {
      clearTimeout(maxTimeout);
      maxTimeout = null;
    }
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    
    lastInvokeTime = 0;
    lastCallTime = 0;
    currentPromise = null;
  };

  const flush = async (): Promise<ReturnType<T> | undefined> => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (maxTimeout) {
      clearTimeout(maxTimeout);
      maxTimeout = null;
    }
    
    return currentPromise || Promise.resolve(undefined);
  };

  const debounced = function (this: any, ...args: Parameters<T>): Promise<ReturnType<T> | undefined> {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    
    lastCallTime = time;
    
    if (isInvoking) {
      if (!timeout) {
        currentPromise = leadingEdge(this, args);
        if (!immediate) {
          timeout = setTimeout(timerExpired, wait);
        }
        return currentPromise;
      }
      
      if (maxWait !== undefined) {
        // Handle maxWait
        timeout = setTimeout(timerExpired, wait);
        maxTimeout = setTimeout(() => {
          currentPromise = invokeFunc(this, args);
        }, maxWait);
        return currentPromise || invokeFunc(this, args);
      }
    }
    
    if (!timeout) {
      timeout = setTimeout(timerExpired, wait);
    }
    
    return currentPromise || Promise.resolve(undefined);
  } as T & { cancel: () => void; flush: () => Promise<ReturnType<T> | undefined> };

  debounced.cancel = cancel;
  debounced.flush = flush;

  return debounced;
}

/**
 * Create a map of debounced functions keyed by a string identifier
 * Useful for debouncing multiple instances of the same operation
 */
export class DebouncedMap<T extends (...args: any[]) => any> {
  private debouncedFunctions = new Map<string, T & { cancel: () => void }>();
  private originalFunction: T;
  private wait: number;
  private immediate: boolean;

  constructor(func: T, wait: number, immediate = false) {
    this.originalFunction = func;
    this.wait = wait;
    this.immediate = immediate;
  }

  /**
   * Get or create a debounced function for the given key
   */
  get(key: string): T & { cancel: () => void } {
    if (!this.debouncedFunctions.has(key)) {
      const debouncedFunc = debounce(this.originalFunction, this.wait, this.immediate);
      this.debouncedFunctions.set(key, debouncedFunc);
    }
    
    return this.debouncedFunctions.get(key)!;
  }

  /**
   * Cancel debounced function for a specific key
   */
  cancel(key: string): void {
    const debouncedFunc = this.debouncedFunctions.get(key);
    if (debouncedFunc) {
      debouncedFunc.cancel();
    }
  }

  /**
   * Cancel all debounced functions
   */
  cancelAll(): void {
    this.debouncedFunctions.forEach(func => func.cancel());
  }

  /**
   * Remove debounced function for a specific key
   */
  delete(key: string): boolean {
    const debouncedFunc = this.debouncedFunctions.get(key);
    if (debouncedFunc) {
      debouncedFunc.cancel();
      return this.debouncedFunctions.delete(key);
    }
    return false;
  }

  /**
   * Clear all debounced functions
   */
  clear(): void {
    this.cancelAll();
    this.debouncedFunctions.clear();
  }

  /**
   * Get the number of active debounced functions
   */
  get size(): number {
    return this.debouncedFunctions.size;
  }
}