import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { RecoveryResult } from '../services/errorRecoveryService';
import { useAriaLiveRegion } from './useAccessibility';

/**
 * Configuration for error recovery behavior
 */
export interface ErrorRecoveryConfig {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  failureThreshold?: number;
  recoveryTimeout?: number;
  monitoringPeriod?: number;
  successThreshold?: number;
}

/**
 * Error recovery state
 */
export interface ErrorRecoveryState {
  isRetrying: boolean;
  isManualRetrying: boolean;
  currentAttempt: number;
  maxAttempts: number;
  lastError: Error | null;
  lastRecoveryResult: RecoveryResult | null;
  retryCount: number;
  nextRetryTime: number | null;
  canRetry: boolean;
  canManualRetry: boolean;
}

/**
 * Error recovery actions
 */
export interface ErrorRecoveryActions {
  executeWithRecovery: <T>(operation: () => Promise<T>) => Promise<RecoveryResult>;
  retry: () => Promise<void>;
  manualRetry: () => Promise<void>;
  resetRetries: () => void;
  clearError: () => void;
  updateConfig: (config: Partial<ErrorRecoveryConfig>) => void;
}

/**
 * Options for the error recovery hook
 */
export interface UseErrorRecoveryOptions {
  operationName: string;
  config?: ErrorRecoveryConfig;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  onRetryStart?: (attempt: number) => void;
  onRetryEnd?: (success: boolean, attempt: number) => void;
  onRetryCountChange?: (count: number) => void;
  announceErrors?: boolean;
}

/**
 * Default error recovery configuration
 */
const DEFAULT_CONFIG: Required<ErrorRecoveryConfig> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  jitter: true,
  failureThreshold: 5,
  recoveryTimeout: 30000,
  monitoringPeriod: 60000,
  successThreshold: 2,
};

/**
 * Custom hook for comprehensive error recovery with exponential backoff and circuit breaker
 */
export const useErrorRecovery = (
  options: UseErrorRecoveryOptions
): ErrorRecoveryState & ErrorRecoveryActions => {
  const {
    operationName: _operationName,
    config: userConfig = {},
    onSuccess,
    onError,
    onRetryStart,
    onRetryEnd,
    onRetryCountChange,
    announceErrors = true,
  } = options;

  const { announce } = useAriaLiveRegion();
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig]);

  // State
  const [state, setState] = useState<ErrorRecoveryState>({
    isRetrying: false,
    isManualRetrying: false,
    currentAttempt: 0,
    maxAttempts: config.maxAttempts,
    lastError: null,
    lastRecoveryResult: null,
    retryCount: 0,
    nextRetryTime: null,
    canRetry: false,
    canManualRetry: false,
  });

  // Refs for tracking
  const lastOperationRef = useRef<(() => Promise<any>) | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track previous retry count for change detection
  const previousRetryCountRef = useRef<number>(0);

  // Update retry tracking
  const updateRetryTracking = useCallback((success: boolean, attemptCount: number = 0) => {
    const newRetryCount = success ? 0 : attemptCount;
    const previousCount = previousRetryCountRef.current;

    setState(prev => ({
      ...prev,
      retryCount: newRetryCount,
      canRetry: newRetryCount < config.maxAttempts,
      canManualRetry: true,
    }));

    // Update the ref with current count
    previousRetryCountRef.current = newRetryCount;

    // Notify about retry count changes
    if (newRetryCount !== previousCount) {
      onRetryCountChange?.(newRetryCount);

      if (announceErrors && newRetryCount > 0) {
        announce(`Retry attempt ${newRetryCount} of ${config.maxAttempts}`, 'polite');
      }
    }
  }, [config.maxAttempts, onRetryCountChange, announceErrors, announce]);

  // Calculate next retry time
  const calculateNextRetryTime = useCallback((attempt: number): number => {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
    delay = Math.min(delay, config.maxDelay);

    if (config.jitter) {
      const jitterAmount = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterAmount;
    }

    return Date.now() + Math.max(delay, 0);
  }, [config]);

  // Execute operation with simple recovery
  const executeWithRecovery = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<RecoveryResult> => {
    lastOperationRef.current = operation;

    setState(prev => ({
      ...prev,
      isRetrying: true,
      currentAttempt: 0,
      lastError: null,
      nextRetryTime: null,
    }));

    onRetryStart?.(1);

    let attemptCount = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      attemptCount = attempt;

      try {
        const result = await operation();

        // Success
        const recoveryResult: RecoveryResult = {
          success: true,
          strategyUsed: 'direct_execution',
          message: 'Operation completed successfully',
          timestamp: new Date(),
          recoveryTime: 0,
        };

        setState(prev => ({
          ...prev,
          isRetrying: false,
          currentAttempt: attemptCount,
          lastRecoveryResult: recoveryResult,
          lastError: null,
        }));

        updateRetryTracking(true, 0);

        onSuccess?.(result);
        if (announceErrors) {
          announce('Operation completed successfully', 'polite');
        }

        onRetryEnd?.(true, attemptCount);
        return recoveryResult;

      } catch (error) {
        lastError = error as Error;

        if (attempt < config.maxAttempts) {
          // Wait before next attempt
          const nextRetryTime = calculateNextRetryTime(attempt - 1);
          const delay = nextRetryTime - Date.now();

          setState(prev => ({
            ...prev,
            currentAttempt: attempt,
            nextRetryTime,
          }));

          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
    }

    // All attempts failed
    const recoveryResult: RecoveryResult = {
      success: false,
      strategyUsed: 'retry_attempts',
      message: `Operation failed after ${attemptCount} attempts: ${lastError?.message}`,
      timestamp: new Date(),
      recoveryTime: 0,
    };

    setState(prev => ({
      ...prev,
      isRetrying: false,
      currentAttempt: attemptCount,
      lastRecoveryResult: recoveryResult,
      lastError,
      canRetry: false,
      canManualRetry: true,
      nextRetryTime: calculateNextRetryTime(attemptCount),
    }));

    updateRetryTracking(false, attemptCount);

    onError?.(lastError!);
    onRetryEnd?.(false, attemptCount);

    if (announceErrors) {
      announce(`Operation failed: ${lastError?.message}`, 'assertive');
    }

    return recoveryResult;
  }, [
    config,
    calculateNextRetryTime,
    updateRetryTracking,
    onSuccess,
    onError,
    onRetryStart,
    onRetryEnd,
    announceErrors,
    announce,
  ]);

  // Retry with exponential backoff
  const retry = useCallback(async (): Promise<void> => {
    if (!state.canRetry || !lastOperationRef.current || state.isRetrying) {
      return;
    }

    // Clear any existing retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const nextRetryTime = state.nextRetryTime || Date.now();
    const delay = Math.max(0, nextRetryTime - Date.now());

    if (delay > 0) {
      setState(prev => ({ ...prev, nextRetryTime }));

      if (announceErrors) {
        announce(`Retrying in ${Math.ceil(delay / 1000)} seconds`, 'polite');
      }

      return new Promise((resolve) => {
        retryTimeoutRef.current = setTimeout(async () => {
          await executeWithRecovery(lastOperationRef.current!);
          resolve();
        }, delay);
      });
    } else {
      await executeWithRecovery(lastOperationRef.current);
    }
  }, [state.canRetry, state.isRetrying, state.nextRetryTime, executeWithRecovery, announceErrors, announce]);

  // Manual retry (immediate)
  const manualRetry = useCallback(async (): Promise<void> => {
    if (!state.canManualRetry || !lastOperationRef.current || state.isManualRetrying) {
      return;
    }

    setState(prev => ({ ...prev, isManualRetrying: true }));

    try {
      const result = await lastOperationRef.current();

      setState(prev => ({
        ...prev,
        lastError: null,
        canRetry: false,
        canManualRetry: false,
      }));

      updateRetryTracking(true, 0);

      onSuccess?.(result);
      if (announceErrors) {
        announce('Manual retry completed successfully', 'polite');
      }
    } catch (error) {
      const err = error as Error;

      setState(prev => ({
        ...prev,
        lastError: err,
      }));

      updateRetryTracking(false, state.retryCount + 1);

      onError?.(err);
      if (announceErrors) {
        announce(`Manual retry failed: ${err.message}`, 'assertive');
      }
    } finally {
      setState(prev => ({ ...prev, isManualRetrying: false }));
    }
  }, [
    state.canManualRetry,
    state.isManualRetrying,
    state.retryCount,
    updateRetryTracking,
    onSuccess,
    onError,
    announceErrors,
    announce,
  ]);

  // Reset retry attempts
  const resetRetries = useCallback(() => {
    setState(prev => ({
      ...prev,
      retryCount: 0,
      currentAttempt: 0,
      canRetry: true,
      canManualRetry: true,
      nextRetryTime: null,
    }));

    updateRetryTracking(true, 0);

    if (announceErrors) {
      announce('Retry attempts reset', 'polite');
    }
  }, [updateRetryTracking, announceErrors, announce]);

  // Clear error state
  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastError: null,
      lastRecoveryResult: null,
      canRetry: false,
      canManualRetry: false,
      nextRetryTime: null,
    }));
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<ErrorRecoveryConfig>) => {
    Object.assign(config, newConfig);
    setState(prev => ({
      ...prev,
      maxAttempts: config.maxAttempts,
    }));
  }, [config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,

    // Actions
    executeWithRecovery,
    retry,
    manualRetry,
    resetRetries,
    clearError,
    updateConfig,
  };
};