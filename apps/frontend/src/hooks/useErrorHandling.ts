import { useState, useCallback, useRef } from 'react';
import {
  SwapPlatformError,
  TimingError,
  PaymentError,
  ERROR_CODES,
} from '@booking-swap/shared';
import {
  createContextualRetryHandler,
  createAuctionFallbackStrategy,
  createPaymentFallbackStrategy,
  formatErrorForUser,
} from '@/utils/errorHandling';

interface ErrorState {
  error: Error | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
  fallbackAvailable: boolean;
  fallbackMessage?: string;
}

interface UseErrorHandlingOptions {
  context: 'auction' | 'payment' | 'general';
  maxRetries?: number;
  onFallback?: (fallbackType: string) => void;
  onRetryExhausted?: (error: Error) => void;
}

export const useErrorHandling = (options: UseErrorHandlingOptions) => {
  const { context, maxRetries = 3, onFallback, onRetryExhausted } = options;

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    canRetry: false,
    fallbackAvailable: false,
  });

  const retryHandler = useRef(createContextualRetryHandler(context));

  const setError = useCallback(
    (error: Error | null) => {
      if (!error) {
        setErrorState({
          error: null,
          isRetrying: false,
          retryCount: 0,
          canRetry: false,
          fallbackAvailable: false,
        });
        return;
      }

      const canRetry =
        error instanceof SwapPlatformError ? error.retryable : true;
      let fallbackAvailable = false;
      let fallbackMessage: string | undefined;

      // Check for auction timing fallbacks
      if (
        error instanceof TimingError &&
        error.code === ERROR_CODES.LAST_MINUTE_RESTRICTION
      ) {
        fallbackAvailable = true;
        fallbackMessage =
          'Switch to first-match acceptance for immediate processing';
      }

      // Check for payment fallbacks
      if (error instanceof PaymentError) {
        const fallbackStrategy = createPaymentFallbackStrategy(error);
        fallbackAvailable = true;
        fallbackMessage = fallbackStrategy.message;
      }

      setErrorState({
        error,
        isRetrying: false,
        retryCount: 0,
        canRetry: canRetry && errorState.retryCount < maxRetries,
        fallbackAvailable,
        fallbackMessage,
      });
    },
    [maxRetries, errorState.retryCount]
  );

  const retry = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      if (!errorState.error || !errorState.canRetry) {
        throw errorState.error || new Error('No retryable error');
      }

      setErrorState(prev => ({ ...prev, isRetrying: true }));

      try {
        const result = await retryHandler.current(operation);
        setErrorState({
          error: null,
          isRetrying: false,
          retryCount: 0,
          canRetry: false,
          fallbackAvailable: false,
        });
        return result;
      } catch (error) {
        const newRetryCount = errorState.retryCount + 1;
        const canStillRetry =
          newRetryCount < maxRetries &&
          (error instanceof SwapPlatformError ? error.retryable : true);

        setErrorState(prev => ({
          ...prev,
          error: error as Error,
          isRetrying: false,
          retryCount: newRetryCount,
          canRetry: canStillRetry,
        }));

        if (!canStillRetry) {
          onRetryExhausted?.(error as Error);
        }

        throw error;
      }
    },
    [errorState, maxRetries, onRetryExhausted]
  );

  const useFallback = useCallback(
    (fallbackType: string) => {
      onFallback?.(fallbackType);
      setErrorState(prev => ({
        ...prev,
        error: null,
        fallbackAvailable: false,
      }));
    },
    [onFallback]
  );

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      canRetry: false,
      fallbackAvailable: false,
    });
  }, []);

  const handleError = useCallback(
    async <T>(
      operation: () => Promise<T>,
      fallbackOperation?: () => Promise<T>
    ): Promise<T> => {
      try {
        return await operation();
      } catch (error) {
        setError(error as Error);

        // Try fallback if available
        if (fallbackOperation && errorState.fallbackAvailable) {
          try {
            return await fallbackOperation();
          } catch (fallbackError) {
            setError(fallbackError as Error);
            throw fallbackError;
          }
        }

        throw error;
      }
    },
    [setError, errorState.fallbackAvailable]
  );

  return {
    ...errorState,
    setError,
    retry,
    useFallback,
    clearError,
    handleError,
    formatError: (error: Error) => formatErrorForUser(error),
  };
};

// Specialized hook for auction timing errors
export const useAuctionTimingErrorHandling = (eventDate: Date) => {
  const [timingRestriction, setTimingRestriction] = useState<{
    isLastMinute: boolean;
    allowAuctions: boolean;
    fallbackMessage?: string;
    maxAuctionEndDate?: Date;
  } | null>(null);

  const checkTimingRestrictions = useCallback(() => {
    const fallbackStrategy = createAuctionFallbackStrategy(eventDate);
    setTimingRestriction({
      isLastMinute: fallbackStrategy.isLastMinute,
      allowAuctions: fallbackStrategy.allowAuctions,
      fallbackMessage: fallbackStrategy.fallbackStrategy.message || undefined,
      maxAuctionEndDate: fallbackStrategy.maxAuctionEndDate || undefined,
    });
    return fallbackStrategy;
  }, [eventDate]);

  const errorHandling = useErrorHandling({
    context: 'auction',
    onFallback: fallbackType => {
      if (fallbackType === 'first_match') {
        // Handle switch to first-match mode
        console.log('Switching to first-match mode due to timing restrictions');
      }
    },
  });

  return {
    ...errorHandling,
    timingRestriction,
    checkTimingRestrictions,
    isLastMinute: timingRestriction?.isLastMinute || false,
    allowAuctions: timingRestriction?.allowAuctions !== false,
  };
};

// Specialized hook for payment error handling
export const usePaymentErrorHandling = () => {
  const [paymentFallback, setPaymentFallback] = useState<{
    available: boolean;
    type: string;
    message: string;
  } | null>(null);

  const errorHandling = useErrorHandling({
    context: 'payment',
    onFallback: fallbackType => {
      if (fallbackType === 'booking_only') {
        // Handle fallback to booking-only mode
        console.log('Falling back to booking-only mode due to payment issues');
      }
    },
  });

  const handlePaymentError = useCallback(
    (error: PaymentError) => {
      const fallbackStrategy = createPaymentFallbackStrategy(error);
      setPaymentFallback({
        available: true,
        type: fallbackStrategy.fallback,
        message: fallbackStrategy.message,
      });
      errorHandling.setError(error);
    },
    [errorHandling]
  );

  return {
    ...errorHandling,
    paymentFallback,
    handlePaymentError,
    clearPaymentFallback: () => setPaymentFallback(null),
  };
};

// Hook for form validation error handling
export const useValidationErrorHandling = () => {
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string[]>
  >({});
  const [validationWarnings, setValidationWarnings] = useState<
    Record<string, string[]>
  >({});

  const addFieldError = useCallback((field: string, error: string) => {
    setValidationErrors(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), error],
    }));
  }, []);

  const addFieldWarning = useCallback((field: string, warning: string) => {
    setValidationWarnings(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), warning],
    }));
  }, []);

  const clearFieldErrors = useCallback((field: string) => {
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearFieldWarnings = useCallback((field: string) => {
    setValidationWarnings(prev => {
      const newWarnings = { ...prev };
      delete newWarnings[field];
      return newWarnings;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setValidationErrors({});
    setValidationWarnings({});
  }, []);

  const hasErrors = Object.keys(validationErrors).some(
    field => validationErrors[field].length > 0
  );
  const hasWarnings = Object.keys(validationWarnings).some(
    field => validationWarnings[field].length > 0
  );

  return {
    validationErrors,
    validationWarnings,
    hasErrors,
    hasWarnings,
    addFieldError,
    addFieldWarning,
    clearFieldErrors,
    clearFieldWarnings,
    clearAllErrors,
    setValidationErrors,
    setValidationWarnings,
  };
};
