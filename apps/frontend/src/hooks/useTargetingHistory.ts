import { useState, useCallback, useEffect } from 'react';
import {
    TargetingHistoryResponse,
    TargetingHistoryFilters,
    TargetingHistorySorting,
    TargetingEvent
} from '@booking-swap/shared';
import { targetingHistoryService } from '@/services/targetingHistoryService';
import { logger } from '@/utils/logger';

export interface UseTargetingHistoryOptions {
    swapId?: string;
    autoLoad?: boolean;
    initialFilters?: TargetingHistoryFilters;
    initialSorting?: TargetingHistorySorting;
}

export interface UseTargetingHistoryReturn {
    // Data
    historyData: TargetingHistoryResponse | null;
    events: TargetingEvent[];

    // Loading states
    isLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;

    // Actions
    loadHistory: (options?: {
        filters?: TargetingHistoryFilters;
        sorting?: TargetingHistorySorting;
        resetData?: boolean;
    }) => Promise<void>;
    loadMoreEvents: () => Promise<void>;
    refreshHistory: () => Promise<void>;
    clearHistory: () => void;

    // Filters and sorting
    filters: TargetingHistoryFilters;
    setFilters: (filters: TargetingHistoryFilters) => void;
    sorting: TargetingHistorySorting;
    setSorting: (sorting: TargetingHistorySorting) => void;

    // Pagination
    hasMore: boolean;
    currentPage: number;
    totalEvents: number;

    // Statistics
    stats: {
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsBySeverity: Record<string, number>;
        recentActivity: TargetingEvent[];
    } | null;
    loadStats: () => Promise<void>;
}

/**
 * Custom hook for managing targeting history data and operations
 */
export const useTargetingHistory = (options: UseTargetingHistoryOptions = {}): UseTargetingHistoryReturn => {
    const {
        swapId,
        autoLoad = false,
        initialFilters = {},
        initialSorting = { field: 'timestamp', direction: 'desc' }
    } = options;

    // State
    const [historyData, setHistoryData] = useState<TargetingHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<TargetingHistoryFilters>(initialFilters);
    const [sorting, setSorting] = useState<TargetingHistorySorting>(initialSorting);
    const [stats, setStats] = useState<UseTargetingHistoryReturn['stats']>(null);

    // Derived state
    const events = historyData?.events || [];
    const hasMore = historyData?.hasMore || false;
    const currentPage = historyData?.pagination.page || 1;
    const totalEvents = historyData?.pagination.total || 0;

    // Load targeting history
    const loadHistory = useCallback(async (loadOptions: {
        filters?: TargetingHistoryFilters;
        sorting?: TargetingHistorySorting;
        resetData?: boolean;
    } = {}) => {
        try {
            setIsLoading(true);
            setError(null);

            const {
                filters: loadFilters = filters,
                sorting: loadSorting = sorting,
                resetData = true
            } = loadOptions;

            const requestOptions = {
                filters: loadFilters,
                sorting: loadSorting,
                pagination: {
                    page: resetData ? 1 : (historyData?.pagination.page || 1) + 1,
                    limit: 50
                }
            };

            let newHistoryData: TargetingHistoryResponse;

            if (swapId) {
                newHistoryData = await targetingHistoryService.getSwapTargetingHistory(swapId, requestOptions);
            } else {
                newHistoryData = await targetingHistoryService.getUserTargetingHistory(requestOptions);
            }

            if (resetData) {
                setHistoryData(newHistoryData);
            } else {
                // Merge with existing data for pagination
                setHistoryData(prev => prev ? {
                    ...newHistoryData,
                    events: [...prev.events, ...newHistoryData.events],
                    pagination: {
                        ...newHistoryData.pagination,
                        page: prev.pagination.page // Keep original page for UI
                    }
                } : newHistoryData);
            }

            // Update filters and sorting if they changed
            if (loadFilters !== filters) {
                setFilters(loadFilters);
            }
            if (loadSorting !== sorting) {
                setSorting(loadSorting);
            }

            logger.info('Loaded targeting history', {
                swapId,
                totalEvents: newHistoryData.pagination.total,
                returnedEvents: newHistoryData.events.length,
                resetData
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load targeting history';
            setError(errorMessage);
            logger.error('Failed to load targeting history', { error: err, swapId });
        } finally {
            setIsLoading(false);
        }
    }, [swapId, filters, sorting, historyData]);

    // Load more events for pagination
    const loadMoreEvents = useCallback(async () => {
        if (!hasMore || isLoadingMore || isLoading) {
            return;
        }

        try {
            setIsLoadingMore(true);
            setError(null);

            const nextPage = currentPage + 1;
            const requestOptions = {
                filters,
                sorting,
                pagination: {
                    page: nextPage,
                    limit: 50
                }
            };

            let newHistoryData: TargetingHistoryResponse;

            if (swapId) {
                newHistoryData = await targetingHistoryService.getSwapTargetingHistory(swapId, requestOptions);
            } else {
                newHistoryData = await targetingHistoryService.getUserTargetingHistory(requestOptions);
            }

            // Merge with existing data
            setHistoryData(prev => prev ? {
                ...newHistoryData,
                events: [...prev.events, ...newHistoryData.events],
                pagination: {
                    ...newHistoryData.pagination,
                    page: nextPage
                }
            } : newHistoryData);

            logger.info('Loaded more targeting events', {
                swapId,
                page: nextPage,
                newEvents: newHistoryData.events.length
            });

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load more events';
            setError(errorMessage);
            logger.error('Failed to load more targeting events', { error: err, swapId });
        } finally {
            setIsLoadingMore(false);
        }
    }, [swapId, hasMore, isLoadingMore, isLoading, currentPage, filters, sorting]);

    // Refresh history data
    const refreshHistory = useCallback(async () => {
        await targetingHistoryService.refreshTargetingHistory(swapId);
        await loadHistory({ resetData: true });
    }, [swapId, loadHistory]);

    // Clear history data
    const clearHistory = useCallback(() => {
        setHistoryData(null);
        setError(null);
        setStats(null);
    }, []);

    // Load statistics
    const loadStats = useCallback(async () => {
        try {
            const statsData = await targetingHistoryService.getTargetingStats(swapId);
            setStats(statsData);

            logger.info('Loaded targeting stats', {
                swapId,
                totalEvents: statsData.totalEvents,
                eventTypes: Object.keys(statsData.eventsByType).length
            });

        } catch (err) {
            logger.error('Failed to load targeting stats', { error: err, swapId });
        }
    }, [swapId]);

    // Auto-load on mount if enabled
    useEffect(() => {
        if (autoLoad) {
            loadHistory();
        }
    }, [autoLoad]); // Only run on mount

    // Update filters handler
    const handleFiltersChange = useCallback((newFilters: TargetingHistoryFilters) => {
        setFilters(newFilters);
        loadHistory({ filters: newFilters, resetData: true });
    }, [loadHistory]);

    // Update sorting handler
    const handleSortingChange = useCallback((newSorting: TargetingHistorySorting) => {
        setSorting(newSorting);
        loadHistory({ sorting: newSorting, resetData: true });
    }, [loadHistory]);

    return {
        // Data
        historyData,
        events,

        // Loading states
        isLoading,
        isLoadingMore,
        error,

        // Actions
        loadHistory,
        loadMoreEvents,
        refreshHistory,
        clearHistory,

        // Filters and sorting
        filters,
        setFilters: handleFiltersChange,
        sorting,
        setSorting: handleSortingChange,

        // Pagination
        hasMore,
        currentPage,
        totalEvents,

        // Statistics
        stats,
        loadStats
    };
};