/**
 * Debouncing hooks for preventing duplicate API calls and rapid user actions
 * 
 * Implements performance optimization to prevent duplicate API calls
 * when users rapidly click buttons or perform actions
 */

import { useCallback, useRef, useEffect } from 'react';
import { logger } from '@/utils/logger';

/**
 * Debounce configuration options
 */
interface DebounceOptions {
  delay: number;
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Hook for debouncing function calls
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  options: Omit<DebounceOptions, 'delay'> = {}
): T {
  const {
    maxWait,
    leading = false,
    trailing = true,
  } = options;

  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const maxTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCallTimeRef = useRef<number>();
  const lastInvokeTimeRef = useRef<number>(0);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (maxTimeoutRef.current) {
        clearTimeout(maxTimeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const isInvoking = shouldInvoke(now);

    lastCallTimeRef.current = now;

    if (isInvoking) {
      if (timeoutRef.current === undefined) {
        return leadingEdge(now, args);
      }
      if (maxWait !== undefined) {
        // Handle maxWait
        return invokeFunc(now, args);
      }
    }

    if (timeoutRef.current === undefined) {
      timeoutRef.current = setTimeout(() => timerExpired(args), delay);
    }

    return undefined;

    function shouldInvoke(time: number): boolean {
      const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
      const timeSinceLastInvoke = time - lastInvokeTimeRef.current;

      return (
        lastCallTimeRef.current === undefined ||
        timeSinceLastCall >= delay ||
        timeSinceLastCall < 0 ||
        (maxWait !== undefined && timeSinceLastInvoke >= maxWait)
      );
    }

    function leadingEdge(time: number, args: Parameters<T>) {
      lastInvokeTimeRef.current = time;
      timeoutRef.current = setTimeout(() => timerExpired(args), delay);
      return leading ? invokeFunc(time, args) : undefined;
    }

    function invokeFunc(time: number, args: Parameters<T>) {
      const result = callbackRef.current(...args);
      lastInvokeTimeRef.current = time;
      return result;
    }

    function timerExpired(args: Parameters<T>) {
      const time = Date.now();
      if (shouldInvoke(time)) {
        return trailingEdge(time, args);
      }
      timeoutRef.current = setTimeout(() => timerExpired(args), remainingWait(time));
    }

    function trailingEdge(time: number, args: Parameters<T>) {
      timeoutRef.current = undefined;

      if (trailing && lastCallTimeRef.current !== undefined) {
        return invokeFunc(time, args);
      }
      lastCallTimeRef.current = undefined;
      return undefined;
    }

    function remainingWait(time: number): number {
      const timeSinceLastCall = time - (lastCallTimeRef.current || 0);
      const timeSinceLastInvoke = time - lastInvokeTimeRef.current;
      const timeWaiting = delay - timeSinceLastCall;

      return maxWait !== undefined
        ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
        : timeWaiting;
    }
  }, [delay, maxWait, leading, trailing]) as T;

  return debouncedCallback;
}

/**
 * Hook for debouncing proposal actions specifically
 * Prevents duplicate accept/reject calls
 */
export function useProposalActionDebounce<T extends (...args: any[]) => Promise<any>>(
  action: T,
  delay: number = 1000
): {
  debouncedAction: T;
  isPending: (proposalId?: string) => boolean;
  cancel: (proposalId?: string) => void;
} {
  const pendingRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const debouncedAction = useCallback(async (...args: Parameters<T>) => {
    // Extract proposalId from args (assuming it's the first argument)
    const proposalId = args[0] as string;

    if (!proposalId) {
      logger.warn('No proposalId provided to debounced action');
      return action(...args);
    }

    // Check if this proposal action is already pending
    if (pendingRef.current.has(proposalId)) {
      logger.debug('Proposal action already pending, ignoring duplicate', { proposalId });
      return Promise.resolve();
    }

    // Clear any existing timeout for this proposal
    const existingTimeout = timeoutRef.current.get(proposalId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Mark as pending
    pendingRef.current.add(proposalId);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        try {
          logger.debug('Executing debounced proposal action', { proposalId });
          const result = await action(...args);
          resolve(result);
        } catch (error) {
          logger.error('Debounced proposal action failed', { proposalId, error });
          reject(error);
        } finally {
          // Clean up
          pendingRef.current.delete(proposalId);
          timeoutRef.current.delete(proposalId);
        }
      }, delay);

      timeoutRef.current.set(proposalId, timeout);
    });
  }, [action, delay]) as T;

  const isPending = useCallback((proposalId?: string) => {
    if (proposalId) {
      return pendingRef.current.has(proposalId);
    }
    return pendingRef.current.size > 0;
  }, []);

  const cancel = useCallback((proposalId?: string) => {
    if (proposalId) {
      const timeout = timeoutRef.current.get(proposalId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutRef.current.delete(proposalId);
        pendingRef.current.delete(proposalId);
        logger.debug('Cancelled debounced proposal action', { proposalId });
      }
    } else {
      // Cancel all pending actions
      timeoutRef.current.forEach((timeout, id) => {
        clearTimeout(timeout);
        logger.debug('Cancelled debounced proposal action', { proposalId: id });
      });
      timeoutRef.current.clear();
      pendingRef.current.clear();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    debouncedAction,
    isPending,
    cancel,
  };
}

/**
 * Hook for debouncing value changes (like search inputs)
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling function calls (different from debouncing)
 * Ensures function is called at most once per interval
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const callbackRef = useRef(callback);
  const lastCallRef = useRef<number>(0);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return callbackRef.current(...args);
    }
  }, [delay]) as T;

  return throttledCallback;
}

// Fix React import
import React from 'react';