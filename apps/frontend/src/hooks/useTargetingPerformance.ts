import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): T & { cancel: () => void } {
    let timeout: NodeJS.Timeout | null = null;

    const debounced = ((...args: Parameters<T>) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    }) as T & { cancel: () => void };

    debounced.cancel = () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    };

    return debounced;
}

export interface TargetingData {
    targetId: string;
    direction: 'incoming' | 'outgoing';
    status: string;
    createdAt: Date;
    bookingDetails: {
        title: string;
        location: string;
        ownerName: string;
    };
}

export interface PaginatedTargetingResult {
    data: TargetingData[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
    performance: {
        queryTime: number;
        cacheHit: boolean;
        source: 'cache' | 'database';
    };
}

export interface TargetingQueryOptions {
    page?: number;
    limit?: number;
    direction?: 'incoming' | 'outgoing' | 'both';
    status?: string[];
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

export interface UseTargetingPerformanceOptions {
    userId: string;
    initialOptions?: TargetingQueryOptions;
    enableAutoRefresh?: boolean;
    refreshInterval?: number;
    enableOptimisticUpdates?: boolean;
}

/**
 * Performance-optimized hook for managing targeting data with caching and pagination
 */
export function useTargetingPerformance({
    userId,
    initialOptions = {},
    enableAutoRefresh = false,
    refreshInterval = 30000, // 30 seconds
    enableOptimisticUpdates = true
}: UseTargetingPerformanceOptions) {
    // State management
    const [targetingData, setTargetingData] = useState<PaginatedTargetingResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [queryOptions, setQueryOptions] = useState<Required<TargetingQueryOptions>>({
        page: 1,
        limit: 20,
        direction: 'both',
        status: ['active', 'pending'],
        sortBy: 'created_at',
        sortOrder: 'DESC',
        ...initialOptions
    });

    // Performance tracking
    const [performanceMetrics, setPerformanceMetrics] = useState({
        totalQueries: 0,
        cacheHits: 0,
        averageQueryTime: 0,
        lastQueryTime: 0
    });

    // Refs for cleanup and optimization
    const abortControllerRef = useRef<AbortController | null>(null);
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastQueryRef = useRef<string>('');

    // Memoized query key for caching and deduplication
    const queryKey = useMemo(() => {
        return `${userId}-${JSON.stringify(queryOptions)}`;
    }, [userId, queryOptions]);

    // Debounced fetch function to prevent excessive API calls
    const debouncedFetch = useMemo(
        () => debounce(async (options: Required<TargetingQueryOptions>) => {
            // Cancel previous request if still pending
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            abortControllerRef.current = new AbortController();

            try {
                setLoading(true);
                setError(null);

                const startTime = Date.now();

                // Make API request with abort signal
                const response = await fetch(`/api/targeting/paginated?userId=${userId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(options),
                    signal: abortControllerRef.current.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result: PaginatedTargetingResult = await response.json();
                const queryTime = Date.now() - startTime;

                // Update performance metrics
                setPerformanceMetrics(prev => ({
                    totalQueries: prev.totalQueries + 1,
                    cacheHits: prev.cacheHits + (result.performance.cacheHit ? 1 : 0),
                    averageQueryTime: (prev.averageQueryTime * prev.totalQueries + queryTime) / (prev.totalQueries + 1),
                    lastQueryTime: queryTime
                }));

                setTargetingData(result);
                lastQueryRef.current = queryKey;
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    setError(error.message || 'Failed to fetch targeting data');
                    console.error('Error fetching targeting data:', error);
                }
            } finally {
                setLoading(false);
                abortControllerRef.current = null;
            }
        }, 300), // 300ms debounce
        [userId, queryKey]
    );

    // Fetch targeting data
    const fetchTargetingData = useCallback(async (options?: Partial<TargetingQueryOptions>) => {
        const mergedOptions = { ...queryOptions, ...options };
        setQueryOptions(mergedOptions);
        await debouncedFetch(mergedOptions);
    }, [queryOptions, debouncedFetch]);

    // Optimistic update for targeting actions
    const optimisticUpdate = useCallback((
        targetId: string,
        updates: Partial<TargetingData>
    ) => {
        if (!enableOptimisticUpdates || !targetingData) return;

        setTargetingData(prev => {
            if (!prev) return prev;

            return {
                ...prev,
                data: prev.data.map(item =>
                    item.targetId === targetId
                        ? { ...item, ...updates }
                        : item
                )
            };
        });
    }, [enableOptimisticUpdates, targetingData]);

    // Pagination helpers
    const goToPage = useCallback((page: number) => {
        fetchTargetingData({ page });
    }, [fetchTargetingData]);

    const changePageSize = useCallback((limit: number) => {
        fetchTargetingData({ limit, page: 1 });
    }, [fetchTargetingData]);

    const nextPage = useCallback(() => {
        if (targetingData?.pagination.hasNext) {
            goToPage(queryOptions.page + 1);
        }
    }, [targetingData, queryOptions.page, goToPage]);

    const previousPage = useCallback(() => {
        if (targetingData?.pagination.hasPrevious) {
            goToPage(queryOptions.page - 1);
        }
    }, [targetingData, queryOptions.page, goToPage]);

    // Filter and sort helpers
    const filterByDirection = useCallback((direction: 'incoming' | 'outgoing' | 'both') => {
        fetchTargetingData({ direction, page: 1 });
    }, [fetchTargetingData]);

    const filterByStatus = useCallback((status: string[]) => {
        fetchTargetingData({ status, page: 1 });
    }, [fetchTargetingData]);

    const sortBy = useCallback((sortBy: string, sortOrder: 'ASC' | 'DESC' = 'DESC') => {
        fetchTargetingData({ sortBy, sortOrder, page: 1 });
    }, [fetchTargetingData]);

    // Refresh data
    const refresh = useCallback(() => {
        fetchTargetingData();
    }, [fetchTargetingData]);

    // Setup auto-refresh
    useEffect(() => {
        if (enableAutoRefresh && refreshInterval > 0) {
            refreshIntervalRef.current = setInterval(refresh, refreshInterval);

            return () => {
                if (refreshIntervalRef.current) {
                    clearInterval(refreshIntervalRef.current);
                }
            };
        }
    }, [enableAutoRefresh, refreshInterval, refresh]);

    // Initial data fetch
    useEffect(() => {
        if (userId && queryKey !== lastQueryRef.current) {
            fetchTargetingData();
        }
    }, [userId, queryKey, fetchTargetingData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            debouncedFetch.cancel();
        };
    }, [debouncedFetch]);

    // Memoized return value to prevent unnecessary re-renders
    return useMemo(() => ({
        // Data
        targetingData,
        loading,
        error,
        queryOptions,
        performanceMetrics,

        // Actions
        fetchTargetingData,
        optimisticUpdate,
        refresh,

        // Pagination
        goToPage,
        changePageSize,
        nextPage,
        previousPage,

        // Filtering and sorting
        filterByDirection,
        filterByStatus,
        sortBy,

        // Computed values
        hasData: !!targetingData?.data.length,
        isEmpty: targetingData?.data.length === 0,
        isFirstPage: queryOptions.page === 1,
        isLastPage: !targetingData?.pagination.hasNext,
        totalPages: targetingData?.pagination.totalPages || 0,
        currentPage: queryOptions.page,

        // Performance indicators
        cacheHitRate: performanceMetrics.totalQueries > 0
            ? performanceMetrics.cacheHits / performanceMetrics.totalQueries
            : 0,
        isPerformant: performanceMetrics.averageQueryTime < 1000, // Under 1 second
    }), [
        targetingData,
        loading,
        error,
        queryOptions,
        performanceMetrics,
        fetchTargetingData,
        optimisticUpdate,
        refresh,
        goToPage,
        changePageSize,
        nextPage,
        previousPage,
        filterByDirection,
        filterByStatus,
        sortBy
    ]);
}

/**
 * Hook for targeting counts with caching
 */
export function useTargetingCounts(userId: string) {
    const [counts, setCounts] = useState<{
        incoming: number;
        outgoing: number;
        total: number;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCounts = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await fetch(`/api/targeting/counts?userId=${userId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            setCounts(result);
        } catch (error: any) {
            setError(error.message || 'Failed to fetch targeting counts');
            console.error('Error fetching targeting counts:', error);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts]);

    return useMemo(() => ({
        counts,
        loading,
        error,
        refresh: fetchCounts,
        hasTargeting: (counts?.total || 0) > 0
    }), [counts, loading, error, fetchCounts]);
}