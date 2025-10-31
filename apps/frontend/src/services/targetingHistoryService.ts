import {
    TargetingHistoryRequest,
    TargetingHistoryResponse,
    TargetingEvent,
    TargetingHistoryFilters,
    TargetingHistorySorting,
    TargetingHistoryPagination
} from '@booking-swap/shared';
import { apiClient } from './apiClient';
import { logger } from '@/utils/logger';

export class TargetingHistoryService {
    private static instance: TargetingHistoryService;
    private cache = new Map<string, { data: TargetingHistoryResponse; timestamp: number }>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    static getInstance(): TargetingHistoryService {
        if (!TargetingHistoryService.instance) {
            TargetingHistoryService.instance = new TargetingHistoryService();
        }
        return TargetingHistoryService.instance;
    }

    /**
     * Get targeting history for a specific swap
     */
    async getSwapTargetingHistory(
        swapId: string,
        options: {
            filters?: TargetingHistoryFilters;
            sorting?: TargetingHistorySorting;
            pagination?: Omit<TargetingHistoryPagination, 'total'>;
        } = {}
    ): Promise<TargetingHistoryResponse> {
        try {
            const {
                filters = {},
                sorting = { field: 'timestamp', direction: 'desc' },
                pagination = { page: 1, limit: 50 }
            } = options;

            // Build query parameters
            const params = new URLSearchParams();

            // Pagination
            params.append('page', pagination.page.toString());
            params.append('limit', pagination.limit.toString());

            // Sorting
            params.append('sortField', sorting.field);
            params.append('sortDirection', sorting.direction);

            // Filters
            if (filters.eventTypes && filters.eventTypes.length > 0) {
                filters.eventTypes.forEach(type => params.append('eventTypes', type));
            }

            if (filters.severity && filters.severity.length > 0) {
                filters.severity.forEach(sev => params.append('severity', sev));
            }

            if (filters.dateRange?.startDate) {
                params.append('startDate', filters.dateRange.startDate.toISOString());
            }

            if (filters.dateRange?.endDate) {
                params.append('endDate', filters.dateRange.endDate.toISOString());
            }

            if (filters.searchQuery) {
                params.append('searchQuery', filters.searchQuery);
            }

            // Check cache first
            const cacheKey = `swap-${swapId}-${params.toString()}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                logger.debug('Returning cached targeting history', { swapId, cacheKey });
                return cached.data;
            }

            logger.info('Fetching targeting history for swap', { swapId, params: params.toString() });

            const response = await apiClient.get<{
                success: boolean;
                data: TargetingHistoryResponse;
                metadata?: any;
            }>(`/api/swaps/${swapId}/targeting/history?${params.toString()}`);

            if (!response.data.success) {
                throw new Error('Failed to fetch targeting history');
            }

            const historyData = response.data.data;

            // Cache the result
            this.cache.set(cacheKey, {
                data: historyData,
                timestamp: Date.now()
            });

            // Clean up old cache entries
            this.cleanupCache();

            logger.info('Successfully fetched targeting history', {
                swapId,
                totalEvents: historyData.pagination.total,
                returnedEvents: historyData.events.length
            });

            return historyData;

        } catch (error) {
            logger.error('Failed to fetch swap targeting history', { error, swapId, options });
            throw error;
        }
    }

    /**
     * Get targeting history for the current user across all their swaps
     */
    async getUserTargetingHistory(
        options: {
            filters?: TargetingHistoryFilters;
            sorting?: TargetingHistorySorting;
            pagination?: Omit<TargetingHistoryPagination, 'total'>;
        } = {}
    ): Promise<TargetingHistoryResponse> {
        try {
            const {
                filters = {},
                sorting = { field: 'timestamp', direction: 'desc' },
                pagination = { page: 1, limit: 50 }
            } = options;

            // Build query parameters (same as above)
            const params = new URLSearchParams();

            params.append('page', pagination.page.toString());
            params.append('limit', pagination.limit.toString());
            params.append('sortField', sorting.field);
            params.append('sortDirection', sorting.direction);

            if (filters.eventTypes && filters.eventTypes.length > 0) {
                filters.eventTypes.forEach(type => params.append('eventTypes', type));
            }

            if (filters.severity && filters.severity.length > 0) {
                filters.severity.forEach(sev => params.append('severity', sev));
            }

            if (filters.dateRange?.startDate) {
                params.append('startDate', filters.dateRange.startDate.toISOString());
            }

            if (filters.dateRange?.endDate) {
                params.append('endDate', filters.dateRange.endDate.toISOString());
            }

            if (filters.searchQuery) {
                params.append('searchQuery', filters.searchQuery);
            }

            if (filters.swaps && filters.swaps.length > 0) {
                filters.swaps.forEach(swapId => params.append('swaps', swapId));
            }

            // Check cache
            const cacheKey = `user-history-${params.toString()}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
                logger.debug('Returning cached user targeting history', { cacheKey });
                return cached.data;
            }

            logger.info('Fetching user targeting history', { params: params.toString() });

            const response = await apiClient.get<{
                success: boolean;
                data: TargetingHistoryResponse;
                metadata?: any;
            }>(`/api/users/targeting/history?${params.toString()}`);

            if (!response.data.success) {
                throw new Error('Failed to fetch user targeting history');
            }

            const historyData = response.data.data;

            // Cache the result
            this.cache.set(cacheKey, {
                data: historyData,
                timestamp: Date.now()
            });

            this.cleanupCache();

            logger.info('Successfully fetched user targeting history', {
                totalEvents: historyData.pagination.total,
                returnedEvents: historyData.events.length
            });

            return historyData;

        } catch (error) {
            logger.error('Failed to fetch user targeting history', { error, options });
            throw error;
        }
    }

    /**
     * Load more events for pagination
     */
    async loadMoreEvents(
        currentResponse: TargetingHistoryResponse,
        swapId?: string
    ): Promise<TargetingHistoryResponse> {
        try {
            if (!currentResponse.hasMore) {
                return currentResponse; // No more events to load
            }

            const nextPage = currentResponse.pagination.page + 1;
            const options = {
                filters: currentResponse.filters,
                sorting: currentResponse.sorting,
                pagination: {
                    page: nextPage,
                    limit: currentResponse.pagination.limit
                }
            };

            let nextPageData: TargetingHistoryResponse;

            if (swapId) {
                nextPageData = await this.getSwapTargetingHistory(swapId, options);
            } else {
                nextPageData = await this.getUserTargetingHistory(options);
            }

            // Merge the events
            const mergedResponse: TargetingHistoryResponse = {
                ...nextPageData,
                events: [...currentResponse.events, ...nextPageData.events],
                pagination: {
                    ...nextPageData.pagination,
                    page: currentResponse.pagination.page // Keep original page for UI
                }
            };

            return mergedResponse;

        } catch (error) {
            logger.error('Failed to load more targeting events', { error, swapId });
            throw error;
        }
    }

    /**
     * Refresh targeting history data
     */
    async refreshTargetingHistory(swapId?: string): Promise<void> {
        try {
            // Clear relevant cache entries
            const keysToDelete: string[] = [];

            for (const [key] of this.cache) {
                if (swapId && key.includes(`swap-${swapId}`)) {
                    keysToDelete.push(key);
                } else if (!swapId && key.includes('user-history')) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach(key => this.cache.delete(key));

            logger.info('Refreshed targeting history cache', {
                swapId,
                clearedEntries: keysToDelete.length
            });

        } catch (error) {
            logger.error('Failed to refresh targeting history', { error, swapId });
            throw error;
        }
    }

    /**
     * Get targeting event statistics
     */
    async getTargetingStats(swapId?: string): Promise<{
        totalEvents: number;
        eventsByType: Record<string, number>;
        eventsBySeverity: Record<string, number>;
        recentActivity: TargetingEvent[];
    }> {
        try {
            // Get recent history to calculate stats
            const historyData = swapId
                ? await this.getSwapTargetingHistory(swapId, { pagination: { page: 1, limit: 100 } })
                : await this.getUserTargetingHistory({ pagination: { page: 1, limit: 100 } });

            const events = historyData.events;

            // Calculate statistics
            const eventsByType: Record<string, number> = {};
            const eventsBySeverity: Record<string, number> = {};

            events.forEach(event => {
                eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
                eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;
            });

            // Get recent activity (last 10 events)
            const recentActivity = events.slice(0, 10);

            return {
                totalEvents: historyData.pagination.total || events.length,
                eventsByType,
                eventsBySeverity,
                recentActivity
            };

        } catch (error) {
            logger.error('Failed to get targeting stats', { error, swapId });
            throw error;
        }
    }

    /**
     * Clean up old cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.CACHE_TTL) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this.cache.delete(key));

        if (keysToDelete.length > 0) {
            logger.debug('Cleaned up targeting history cache', {
                removedEntries: keysToDelete.length
            });
        }
    }

    /**
     * Clear all cached data
     */
    clearCache(): void {
        this.cache.clear();
        logger.info('Cleared all targeting history cache');
    }
}

// Export singleton instance
export const targetingHistoryService = TargetingHistoryService.getInstance();