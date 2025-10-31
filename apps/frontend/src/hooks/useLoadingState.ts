import { useState, useCallback, useRef, useEffect } from 'react';

export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
  progress?: number;
  message?: string;
}

export interface LoadingOptions {
  initialLoading?: boolean;
  timeout?: number;
  onTimeout?: () => void;
  progressCallback?: (progress: number) => void;
}

export interface AsyncOperationResult<T> {
  data?: T;
  error?: Error;
  isLoading: boolean;
}

/**
 * Hook for managing loading states with progress tracking and timeout handling
 */
export function useLoadingState(options: LoadingOptions = {}) {
  const {
    initialLoading = false,
    timeout,
    onTimeout,
    progressCallback,
  } = options;

  const [state, setState] = useState<LoadingState>({
    isLoading: initialLoading,
    error: null,
    progress: 0,
    message: '',
  });

  const timeoutRef = useRef<NodeJS.Timeout>();
  const progressRef = useRef<number>(0);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const startLoading = useCallback(
    (message?: string) => {
      setState(prev => ({
        ...prev,
        isLoading: true,
        error: null,
        progress: 0,
        message: message || '',
      }));

      progressRef.current = 0;

      // Set timeout if specified
      if (timeout) {
        timeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: new Error('Operation timed out'),
          }));

          if (onTimeout) {
            onTimeout();
          }
        }, timeout);
      }
    },
    [timeout, onTimeout]
  );

  const stopLoading = useCallback((error?: Error) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      error: error || null,
      progress: error ? prev.progress : 100,
    }));
  }, []);

  const setProgress = useCallback(
    (progress: number, message?: string) => {
      const clampedProgress = Math.max(0, Math.min(100, progress));
      progressRef.current = clampedProgress;

      setState(prev => ({
        ...prev,
        progress: clampedProgress,
        message: message || prev.message,
      }));

      if (progressCallback) {
        progressCallback(clampedProgress);
      }
    },
    [progressCallback]
  );

  const setMessage = useCallback((message: string) => {
    setState(prev => ({
      ...prev,
      message,
    }));
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }

    setState({
      isLoading: false,
      error: null,
      progress: 0,
      message: '',
    });
  }, []);

  return {
    ...state,
    startLoading,
    stopLoading,
    setProgress,
    setMessage,
    reset,
  };
}

/**
 * Hook for managing async operations with automatic loading state
 */
export function useAsyncOperation<T = any>(
  operation: (...args: any[]) => Promise<T>,
  options: LoadingOptions = {}
) {
  const loadingState = useLoadingState(options);
  const [data, setData] = useState<T | undefined>();

  const execute = useCallback(
    async (...args: any[]): Promise<AsyncOperationResult<T>> => {
      try {
        loadingState.startLoading('Starting operation...');

        const result = await operation(...args);

        setData(result);
        loadingState.stopLoading();

        return {
          data: result,
          isLoading: false,
        };
      } catch (error) {
        const err = error as Error;
        loadingState.stopLoading(err);

        return {
          error: err,
          isLoading: false,
        };
      }
    },
    [operation, loadingState]
  );

  const retry = useCallback(() => {
    return execute();
  }, [execute]);

  return {
    ...loadingState,
    data,
    execute,
    retry,
  };
}

/**
 * Hook for managing multiple concurrent operations
 */
export function useMultipleOperations() {
  const [operations, setOperations] = useState<Map<string, LoadingState>>(
    new Map()
  );

  const startOperation = useCallback((id: string, message?: string) => {
    setOperations(prev =>
      new Map(prev).set(id, {
        isLoading: true,
        error: null,
        progress: 0,
        message: message || '',
      })
    );
  }, []);

  const updateOperation = useCallback(
    (id: string, updates: Partial<LoadingState>) => {
      setOperations(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(id);
        if (current) {
          newMap.set(id, { ...current, ...updates });
        }
        return newMap;
      });
    },
    []
  );

  const finishOperation = useCallback((id: string, error?: Error) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(id);
      if (current) {
        newMap.set(id, {
          ...current,
          isLoading: false,
          error: error || null,
          progress: error ? current.progress : 100,
        });
      }
      return newMap;
    });
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const getOperation = useCallback(
    (id: string) => {
      return operations.get(id);
    },
    [operations]
  );

  const isAnyLoading = Array.from(operations.values()).some(op => op.isLoading);
  const hasAnyErrors = Array.from(operations.values()).some(op => op.error);

  return {
    operations: Object.fromEntries(operations),
    startOperation,
    updateOperation,
    finishOperation,
    removeOperation,
    getOperation,
    isAnyLoading,
    hasAnyErrors,
  };
}

/**
 * Hook for managing form submission states
 */
export function useFormSubmission<T = any>() {
  const [state, setState] = useState({
    isSubmitting: false,
    isSubmitted: false,
    error: null as Error | null,
    data: undefined as T | undefined,
  });

  const submit = useCallback(async (submitFn: () => Promise<T>) => {
    setState(prev => ({
      ...prev,
      isSubmitting: true,
      error: null,
    }));

    try {
      const result = await submitFn();

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        isSubmitted: true,
        data: result,
      }));

      return { success: true, data: result };
    } catch (error) {
      const err = error as Error;

      setState(prev => ({
        ...prev,
        isSubmitting: false,
        error: err,
      }));

      return { success: false, error: err };
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isSubmitting: false,
      isSubmitted: false,
      error: null,
      data: undefined,
    });
  }, []);

  return {
    ...state,
    submit,
    reset,
  };
}

/**
 * Hook for managing pagination with loading states
 */
export function usePaginatedLoading<T = any>(
  fetchFn: (
    page: number,
    pageSize: number
  ) => Promise<{ items: T[]; total: number; hasMore: boolean }>,
  initialPageSize = 20
) {
  const [state, setState] = useState({
    items: [] as T[],
    currentPage: 1,
    pageSize: initialPageSize,
    total: 0,
    hasMore: false,
    isLoading: false,
    isLoadingMore: false,
    error: null as Error | null,
  });

  const loadPage = useCallback(
    async (page: number, append = false) => {
      setState(prev => ({
        ...prev,
        isLoading: !append,
        isLoadingMore: append,
        error: null,
      }));

      try {
        const result = await fetchFn(page, state.pageSize);

        setState(prev => ({
          ...prev,
          items: append ? [...prev.items, ...result.items] : result.items,
          currentPage: page,
          total: result.total,
          hasMore: result.hasMore,
          isLoading: false,
          isLoadingMore: false,
        }));

        return result;
      } catch (error) {
        const err = error as Error;

        setState(prev => ({
          ...prev,
          isLoading: false,
          isLoadingMore: false,
          error: err,
        }));

        throw err;
      }
    },
    [fetchFn, state.pageSize]
  );

  const loadMore = useCallback(() => {
    if (state.hasMore && !state.isLoadingMore) {
      return loadPage(state.currentPage + 1, true);
    }
  }, [loadPage, state.hasMore, state.isLoadingMore, state.currentPage]);

  const refresh = useCallback(() => {
    return loadPage(1, false);
  }, [loadPage]);

  const reset = useCallback(() => {
    setState(prev => ({
      ...prev,
      items: [],
      currentPage: 1,
      total: 0,
      hasMore: false,
      error: null,
    }));
  }, []);

  return {
    ...state,
    loadPage,
    loadMore,
    refresh,
    reset,
  };
}
