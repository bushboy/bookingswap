import { useState, useEffect, useCallback, useRef } from 'react';
import { SwapCardData } from '@booking-swap/shared';
import { unifiedSwapDataService } from '../services/unifiedSwapDataService';

/**
 * Hook for unified swap data management
 * 
 * This hook ensures all components using swap data stay synchronized
 * and display consistent information across all UI elements.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

interface UseUnifiedSwapDataOptions {
    includeTargeting?: boolean;
    includeProposals?: boolean;
    validateConsistency?: boolean;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

interface UseUnifiedSwapDataReturn {
    data: SwapCardData | null;
    loading: boolean;
    error: string | null;
    consistencyReport: any;
    refresh: () => Promise<void>;
    synchronize: () => Promise<void>;
    isConsistent: boolean;
}

export function useUnifiedSwapData(
    swapId: string,
    options: UseUnifiedSwapDataOptions = {}
): UseUnifiedSwapDataReturn {
    const {
        includeTargeting = true,
        includeProposals = true,
        validateConsistency = true,
        autoRefresh = false,
        refreshInterval = 30000 // 30 seconds
    } = options;

    const [data, setData] = useState<SwapCardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [consistencyReport, setConsistencyReport] = useState<any>(null);

    const unregisterRef = useRef<(() => void) | null>(null);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Fetch data function
    const fetchData = useCallback(async (forceRefresh = false) => {
        if (!swapId) return;

        try {
            setLoading(true);
            setError(null);

            const swapData = await unifiedSwapDataService.getUnifiedSwapData(swapId, {
                includeTargeting,
                includeProposals,
                validateConsistency,
                forceRefresh
            });

            setData(swapData);

            // Get consistency report if validation was requested
            if (validateConsistency) {
                const report = unifiedSwapDataService.getConsistencyReport(swapId);
                setConsistencyReport(report);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch swap data';
            setError(errorMessage);
            console.error(`Error fetching unified swap data for ${swapId}:`, err);
        } finally {
            setLoading(false);
        }
    }, [swapId, includeTargeting, includeProposals, validateConsistency]);

    // Refresh function (force refresh)
    const refresh = useCallback(async () => {
        await fetchData(true);
    }, [fetchData]);

    // Synchronize function (sync with other components)
    const synchronize = useCallback(async () => {
        try {
            await unifiedSwapDataService.synchronizeSwapData(swapId);
        } catch (err) {
            console.error(`Error synchronizing swap data for ${swapId}:`, err);
        }
    }, [swapId]);

    // Sync callback for real-time updates
    const handleDataSync = useCallback((syncedData: SwapCardData) => {
        setData(syncedData);

        // Update consistency report if validation is enabled
        if (validateConsistency) {
            const report = unifiedSwapDataService.getConsistencyReport(swapId);
            setConsistencyReport(report);
        }
    }, [swapId, validateConsistency]);

    // Initial data fetch and sync registration
    useEffect(() => {
        if (!swapId) return;

        // Register for sync updates
        unregisterRef.current = unifiedSwapDataService.registerSyncCallback(
            swapId,
            handleDataSync
        );

        // Initial fetch
        fetchData();

        // Cleanup function
        return () => {
            if (unregisterRef.current) {
                unregisterRef.current();
                unregisterRef.current = null;
            }
        };
    }, [swapId, fetchData, handleDataSync]);

    // Auto-refresh setup
    useEffect(() => {
        if (!autoRefresh || !swapId) return;

        const setupAutoRefresh = () => {
            refreshTimeoutRef.current = setTimeout(() => {
                fetchData(true).then(() => {
                    setupAutoRefresh(); // Schedule next refresh
                });
            }, refreshInterval);
        };

        setupAutoRefresh();

        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
                refreshTimeoutRef.current = null;
            }
        };
    }, [autoRefresh, refreshInterval, swapId, fetchData]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (unregisterRef.current) {
                unregisterRef.current();
            }
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, []);

    const isConsistent = consistencyReport ? consistencyReport.isConsistent : true;

    return {
        data,
        loading,
        error,
        consistencyReport,
        refresh,
        synchronize,
        isConsistent
    };
}

/**
 * Hook for managing multiple swap data entries with synchronization
 */
export function useMultipleUnifiedSwapData(
    swapIds: string[],
    options: UseUnifiedSwapDataOptions = {}
): {
    data: SwapCardData[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    synchronizeAll: () => Promise<void>;
} {
    const [data, setData] = useState<SwapCardData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMultipleData = useCallback(async (forceRefresh = false) => {
        if (swapIds.length === 0) {
            setData([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const swapDataArray = await unifiedSwapDataService.getMultipleUnifiedSwapData(
                swapIds,
                { ...options, forceRefresh }
            );

            setData(swapDataArray);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch multiple swap data';
            setError(errorMessage);
            console.error('Error fetching multiple unified swap data:', err);
        } finally {
            setLoading(false);
        }
    }, [swapIds, options]);

    const refresh = useCallback(async () => {
        await fetchMultipleData(true);
    }, [fetchMultipleData]);

    const synchronizeAll = useCallback(async () => {
        try {
            await Promise.all(
                swapIds.map(id => unifiedSwapDataService.synchronizeSwapData(id))
            );
            await fetchMultipleData(true);
        } catch (err) {
            console.error('Error synchronizing multiple swap data:', err);
        }
    }, [swapIds, fetchMultipleData]);

    useEffect(() => {
        fetchMultipleData();
    }, [fetchMultipleData]);

    return {
        data,
        loading,
        error,
        refresh,
        synchronizeAll
    };
}

/**
 * Hook for data consistency monitoring across the application
 */
export function useDataConsistencyMonitor() {
    const [inconsistentSwaps, setInconsistentSwaps] = useState<string[]>([]);
    const [totalChecked, setTotalChecked] = useState(0);

    const checkConsistency = useCallback(async (swapIds: string[]) => {
        const inconsistent: string[] = [];

        for (const swapId of swapIds) {
            const report = unifiedSwapDataService.getConsistencyReport(swapId);
            if (report && !report.isConsistent) {
                inconsistent.push(swapId);
            }
        }

        setInconsistentSwaps(inconsistent);
        setTotalChecked(swapIds.length);
    }, []);

    const clearInconsistencies = useCallback(() => {
        setInconsistentSwaps([]);
        setTotalChecked(0);
    }, []);

    return {
        inconsistentSwaps,
        totalChecked,
        checkConsistency,
        clearInconsistencies,
        hasInconsistencies: inconsistentSwaps.length > 0
    };
}