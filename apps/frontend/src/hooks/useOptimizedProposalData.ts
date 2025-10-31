/**
 * Optimized Proposal Data Hook
 * 
 * Provides cached, memoized proposal data with performance optimizations
 * Implements requirements 3.1, 3.4, 4.5
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { SwapProposal, ProposalUpdate, proposalDataService } from '@/services/proposalDataService';
import { proposalCacheService, ProposalCacheKeys } from '@/services/proposalCacheService';
import { useProposalActionDebounce } from './useDebounce';
import { logger } from '@/utils/logger';

/**
 * Configuration for optimized proposal data loading
 */
interface OptimizedProposalDataConfig {
    enableCaching?: boolean;
    enableOptimisticUpdates?: boolean;
    enablePreloading?: boolean;
    cacheTimeout?: number;
    refreshInterval?: number;
    maxRetries?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<OptimizedProposalDataConfig> = {
    enableCaching: true,
    enableOptimisticUpdates: true,
    enablePreloading: true,
    cacheTimeout: 30000, // 30 seconds
    refreshInterval: 60000, // 1 minute
    maxRetries: 3,
};

/**
 * Proposal data state
 */
interface ProposalDataState {
    proposals: SwapProposal[];
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    cacheHit: boolean;
}

/**
 * Optimized proposal data hook with caching and performance features
 */
export function useOptimizedProposalData(
    userId: string | undefined,
    config: OptimizedProposalDataConfig = {}
) {
    // Memoized configuration object to prevent recreation on every render
    const finalConfig = useMemo(() => ({
        ...DEFAULT_CONFIG,
        ...config
    }), [
        config.enableCaching,
        config.enableOptimisticUpdates,
        config.enablePreloading,
        config.cacheTimeout,
        config.refreshInterval,
        config.maxRetries
    ]);

    // State management
    const [state, setState] = useState<ProposalDataState>({
        proposals: [],
        loading: false,
        error: null,
        lastUpdated: null,
        cacheHit: false,
    });

    // Refs for tracking and optimization
    const loadingRef = useRef<boolean>(false);
    const retryCountRef = useRef<number>(0);
    const refreshIntervalRef = useRef<NodeJS.Timeout>();
    const preloadTimeoutRef = useRef<NodeJS.Timeout>();

    /**
     * Stable cache key generation using useMemo
     */
    const cacheKey = useMemo(() => {
        return userId ? ProposalCacheKeys.userProposals(userId) : null;
    }, [userId]);

    // Ref to store current proposals to avoid dependency cycles
    const currentProposalsRef = useRef<SwapProposal[]>([]);

    /**
     * Load proposals with caching and optimization
     */
    const loadProposals = useCallback(async (
        forceRefresh: boolean = false,
        isRetry: boolean = false
    ): Promise<SwapProposal[]> => {
        if (!userId) {
            setState(prev => ({
                ...prev,
                proposals: [],
                loading: false,
                error: 'User ID is required',
                cacheHit: false,
            }));
            currentProposalsRef.current = [];
            return [];
        }

        // Prevent concurrent loading using ref-based tracking
        if (loadingRef.current && !forceRefresh) {
            logger.debug('Proposal loading already in progress', { userId });
            // Return current proposals from ref without triggering state update
            return currentProposalsRef.current;
        }

        loadingRef.current = true;

        try {
            // Check cache first (unless force refresh)
            if (finalConfig.enableCaching && !forceRefresh && cacheKey) {
                const cachedProposals = proposalCacheService.getCachedUserProposals(userId);
                if (cachedProposals) {
                    logger.debug('Using cached proposal data', { userId, count: cachedProposals.length });

                    // Use functional state update to avoid dependencies
                    setState(prev => ({
                        ...prev,
                        proposals: cachedProposals,
                        loading: false,
                        error: null,
                        lastUpdated: new Date(),
                        cacheHit: true,
                    }));

                    // Update ref with current proposals
                    currentProposalsRef.current = cachedProposals;
                    loadingRef.current = false;
                    retryCountRef.current = 0;
                    return cachedProposals;
                }
            }

            // Set loading state using functional update
            setState(prev => ({
                ...prev,
                loading: true,
                error: null,
                cacheHit: false,
            }));

            logger.debug('Loading proposals from API', { userId, forceRefresh, isRetry });

            // Load from API
            const proposals = await proposalDataService.getUserProposals(userId);

            // Cache the results
            if (finalConfig.enableCaching) {
                proposalCacheService.cacheUserProposals(userId, proposals);
            }

            // Update state using functional update
            setState(prev => ({
                ...prev,
                proposals,
                loading: false,
                error: null,
                lastUpdated: new Date(),
                cacheHit: false,
            }));

            // Update ref with current proposals
            currentProposalsRef.current = proposals;

            logger.info('Proposals loaded successfully', {
                userId,
                count: proposals.length,
                fromCache: false,
                isRetry
            });

            // Reset retry counter on success
            retryCountRef.current = 0;

            return proposals;

        } catch (error: any) {
            logger.error('Failed to load proposals', {
                userId,
                error: error.message,
                isRetry,
                retryCount: retryCountRef.current
            });

            // Handle retry logic
            if (!isRetry && retryCountRef.current < finalConfig.maxRetries) {
                retryCountRef.current++;
                logger.info('Retrying proposal load', {
                    userId,
                    attempt: retryCountRef.current,
                    maxRetries: finalConfig.maxRetries
                });

                // Exponential backoff
                const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));

                return loadProposals(forceRefresh, true);
            }

            // Set error state using functional update
            const errorMessage = error.message || 'Failed to load proposals';
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage,
                cacheHit: false,
            }));

            throw error;
        } finally {
            loadingRef.current = false;
        }
    }, [userId, finalConfig, cacheKey]);

    /**
     * Stable refresh action for debouncing
     */
    const refreshAction = useCallback(async () => {
        logger.debug('Executing debounced refresh', { userId });
        return loadProposals(true);
    }, [loadProposals, userId]);

    /**
     * Debounced refresh function to prevent rapid API calls
     */
    const { debouncedAction: debouncedRefresh } = useProposalActionDebounce(
        refreshAction,
        1000 // 1 second debounce
    );

    /**
     * Handle real-time proposal updates with stable dependencies
     */
    const handleRealTimeUpdate = useCallback((update: ProposalUpdate) => {
        logger.debug('Handling real-time proposal update', {
            proposalId: update.proposalId,
            status: update.status
        });

        // Update cache
        if (finalConfig.enableCaching) {
            proposalCacheService.handleRealTimeUpdate(update);
        }

        // Update local state with optimistic update using functional state update
        if (finalConfig.enableOptimisticUpdates) {
            setState(prev => {
                const updatedProposals = prev.proposals.map(proposal =>
                    proposal.id === update.proposalId
                        ? {
                            ...proposal,
                            status: update.status,
                            updatedAt: update.updatedAt,
                            respondedBy: update.respondedBy,
                            rejectionReason: update.rejectionReason,
                        }
                        : proposal
                );

                // Keep ref in sync with state
                currentProposalsRef.current = updatedProposals;

                return {
                    ...prev,
                    proposals: updatedProposals,
                    lastUpdated: new Date(),
                };
            });
        }
    }, [finalConfig.enableCaching, finalConfig.enableOptimisticUpdates]);

    /**
     * Invalidate cache when proposals are accepted or rejected with stable dependencies
     */
    const invalidateCacheForAction = useCallback((proposalId: string, action: 'accept' | 'reject') => {
        if (finalConfig.enableCaching && userId) {
            proposalCacheService.invalidateOnProposalAction(proposalId, userId, action);
        }
    }, [finalConfig.enableCaching, userId]);



    /**
     * Memoized proposal statistics
     */
    const proposalStats = useMemo(() => {
        const proposals = state.proposals;
        return {
            total: proposals.length,
            pending: proposals.filter(p => p.status === 'pending').length,
            accepted: proposals.filter(p => p.status === 'accepted').length,
            rejected: proposals.filter(p => p.status === 'rejected').length,
            expired: proposals.filter(p => p.status === 'expired').length,
            hasFinancial: proposals.some(p => p.cashOffer),
            averageAmount: proposals
                .filter(p => p.cashOffer)
                .reduce((sum, p) => sum + (p.cashOffer?.amount || 0), 0) /
                Math.max(1, proposals.filter(p => p.cashOffer).length),
        };
    }, [state.proposals]);

    /**
     * Memoized filtered proposals by status
     */
    const proposalsByStatus = useMemo(() => {
        return {
            pending: state.proposals.filter(p => p.status === 'pending'),
            accepted: state.proposals.filter(p => p.status === 'accepted'),
            rejected: state.proposals.filter(p => p.status === 'rejected'),
            expired: state.proposals.filter(p => p.status === 'expired'),
        };
    }, [state.proposals]);

    // Keep ref in sync with state proposals - no dependencies needed as this is just a sync operation
    useEffect(() => {
        currentProposalsRef.current = state.proposals;
    }, [state.proposals]);

    /**
     * Comprehensive cleanup function with stable reference
     */
    const cleanup = useCallback(() => {
        // Clear refresh interval
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = undefined;
        }

        // Clear preload timeout
        if (preloadTimeoutRef.current) {
            clearTimeout(preloadTimeoutRef.current);
            preloadTimeoutRef.current = undefined;
        }

        // Reset loading state
        loadingRef.current = false;

        // Reset retry counter
        retryCountRef.current = 0;

        logger.debug('Hook cleanup completed', { userId });
    }, [userId]);

    // Initialization effect - runs only when userId changes or on mount
    useEffect(() => {
        if (!userId) {
            // Clear data when no user
            setState(prev => ({
                ...prev,
                proposals: [],
                loading: false,
                error: null,
                lastUpdated: null,
                cacheHit: false,
            }));
            currentProposalsRef.current = [];
            return;
        }

        // Initialize data loading for new user - inline implementation to avoid dependency cycles
        const initializeData = async () => {
            try {
                // Prevent concurrent loading
                if (loadingRef.current) {
                    return;
                }

                loadingRef.current = true;

                // Check cache first if enabled
                if (finalConfig.enableCaching && cacheKey) {
                    const cachedProposals = proposalCacheService.getCachedUserProposals(userId);
                    if (cachedProposals) {
                        setState(prev => ({
                            ...prev,
                            proposals: cachedProposals,
                            loading: false,
                            error: null,
                            lastUpdated: new Date(),
                            cacheHit: true,
                        }));
                        currentProposalsRef.current = cachedProposals;
                        loadingRef.current = false;
                        return;
                    }
                }

                // Set loading state
                setState(prev => ({
                    ...prev,
                    loading: true,
                    error: null,
                    cacheHit: false,
                }));

                // Load from API
                const proposals = await proposalDataService.getUserProposals(userId);

                // Cache the results
                if (finalConfig.enableCaching) {
                    proposalCacheService.cacheUserProposals(userId, proposals);
                }

                // Update state
                setState(prev => ({
                    ...prev,
                    proposals,
                    loading: false,
                    error: null,
                    lastUpdated: new Date(),
                    cacheHit: false,
                }));

                currentProposalsRef.current = proposals;
                retryCountRef.current = 0;

            } catch (error: any) {
                logger.error('Failed to initialize proposal data', { userId, error: error.message });

                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: error.message || 'Failed to load proposals',
                    cacheHit: false,
                }));
            } finally {
                loadingRef.current = false;
            }
        };

        initializeData();
    }, [userId, finalConfig.enableCaching, cacheKey]); // Stable dependencies only

    // Store config values in refs to avoid triggering effects when they change
    const enablePreloadingRef = useRef(finalConfig.enablePreloading);
    const refreshIntervalRef_value = useRef(finalConfig.refreshInterval);

    // Update refs when config changes
    useEffect(() => {
        enablePreloadingRef.current = finalConfig.enablePreloading;
        refreshIntervalRef_value.current = finalConfig.refreshInterval;
    }, [finalConfig.enablePreloading, finalConfig.refreshInterval]);

    // Preloading effect - separate from initialization to avoid dependency issues
    useEffect(() => {
        if (userId && enablePreloadingRef.current) {
            // Clear any existing preload timeout
            if (preloadTimeoutRef.current) {
                clearTimeout(preloadTimeoutRef.current);
            }

            preloadTimeoutRef.current = setTimeout(async () => {
                try {
                    await proposalCacheService.preloadProposalData(userId, proposalDataService);
                    logger.debug('Preload completed successfully', { userId });
                } catch (error) {
                    logger.debug('Preload failed, will load normally', { userId, error });
                }
            }, 100); // Small delay to avoid blocking initial render

            // Cleanup timeout on effect cleanup
            return () => {
                if (preloadTimeoutRef.current) {
                    clearTimeout(preloadTimeoutRef.current);
                    preloadTimeoutRef.current = undefined;
                }
            };
        }
    }, [userId]); // Only userId dependency

    // Refresh interval effect - separate from initialization
    useEffect(() => {
        if (userId && refreshIntervalRef_value.current > 0) {
            // Clear any existing interval
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = undefined;
            }

            refreshIntervalRef.current = setInterval(() => {
                logger.debug('Auto-refreshing proposals', { userId });
                // Use the debounced refresh function to prevent rapid calls
                debouncedRefresh();
            }, refreshIntervalRef_value.current);

            logger.debug('Refresh interval set up', {
                userId,
                interval: refreshIntervalRef_value.current
            });
        }

        // Cleanup interval when dependencies change or on unmount
        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
                refreshIntervalRef.current = undefined;
            }
        };
    }, [userId, debouncedRefresh]); // Stable dependencies only

    // Global cleanup effect - runs on unmount
    useEffect(() => {
        return cleanup;
    }, []); // No dependencies - only runs on mount/unmount

    // Stabilize all returned functions with useCallback
    const stableRefresh = useCallback(() => {
        logger.debug('Manual refresh triggered', { userId });
        return debouncedRefresh();
    }, [debouncedRefresh, userId]);

    const stableClearCache = useCallback(() => {
        if (userId) {
            proposalCacheService.invalidateForRefresh(userId);
            logger.debug('Cache cleared for user', { userId });
        }
    }, [userId]);

    const stableGetCacheStats = useCallback(() => {
        const stats = proposalCacheService.getCacheStats();
        logger.debug('Cache stats retrieved', stats);
        return stats;
    }, []);

    // Memoize the entire return object to ensure stable reference
    return useMemo(() => ({
        // Data
        proposals: state.proposals,
        proposalStats,
        proposalsByStatus,

        // State
        loading: state.loading,
        error: state.error,
        lastUpdated: state.lastUpdated,
        cacheHit: state.cacheHit,

        // Actions - all functions have stable references
        refresh: stableRefresh,
        loadProposals,
        handleRealTimeUpdate,
        invalidateCacheForAction,

        // Cache management - stable references
        clearCache: stableClearCache,
        getCacheStats: stableGetCacheStats,
    }), [
        state.proposals,
        state.loading,
        state.error,
        state.lastUpdated,
        state.cacheHit,
        proposalStats,
        proposalsByStatus,
        stableRefresh,
        loadProposals,
        handleRealTimeUpdate,
        invalidateCacheForAction,
        stableClearCache,
        stableGetCacheStats,
    ]);
}