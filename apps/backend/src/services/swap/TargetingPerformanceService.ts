import { TargetingCacheManager } from '../../database/cache/TargetingCacheManager';
import { SwapTargetingRepository } from '../../database/repositories/SwapTargetingRepository';
import { logger as Logger } from '../../utils/logger';

export interface PaginatedTargetingResult {
    data: any[];
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
    sortBy?: 'created_at' | 'updated_at' | 'status';
    sortOrder?: 'ASC' | 'DESC';
}

/**
 * Service for handling performance-optimized targeting queries with pagination
 */
export class TargetingPerformanceService {
    private cacheManager: TargetingCacheManager;
    private repository: SwapTargetingRepository;
    private logger: Logger;

    // Performance thresholds
    private readonly MAX_UNPAGINATED_RESULTS = 50;
    private readonly DEFAULT_PAGE_SIZE = 20;
    private readonly MAX_PAGE_SIZE = 100;

    constructor(
        cacheManager: TargetingCacheManager,
        repository: SwapTargetingRepository,
        logger: Logger
    ) {
        this.cacheManager = cacheManager;
        this.repository = repository;
        this.logger = logger;
    }

    /**
     * Get paginated targeting data with performance optimizations
     */
    async getPaginatedTargetingData(
        userId: string,
        options: TargetingQueryOptions = {}
    ): Promise<PaginatedTargetingResult> {
        const startTime = Date.now();

        // Normalize options
        const normalizedOptions = this.normalizeQueryOptions(options);

        try {
            // Try cache first for simple queries
            if (this.shouldUseCache(normalizedOptions)) {
                const cachedResult = await this.getCachedPaginatedResult(userId, normalizedOptions);
                if (cachedResult) {
                    return {
                        ...cachedResult,
                        performance: {
                            queryTime: Date.now() - startTime,
                            cacheHit: true,
                            source: 'cache'
                        }
                    };
                }
            }

            // Fetch from database with pagination
            const result = await this.fetchPaginatedFromDatabase(userId, normalizedOptions);

            // Cache the result if appropriate
            if (this.shouldCacheResult(normalizedOptions, result)) {
                await this.cacheManager.setCachedTargetingData(userId, result.data);
            }

            return {
                ...result,
                performance: {
                    queryTime: Date.now() - startTime,
                    cacheHit: false,
                    source: 'database'
                }
            };
        } catch (error) {
            this.logger.error('Error in getPaginatedTargetingData:', error);
            throw error;
        }
    }

    /**
     * Get targeting counts with caching
     */
    async getTargetingCounts(userId: string): Promise<{ incoming: number; outgoing: number }> {
        try {
            // Try cache first
            const cachedCounts = await this.cacheManager.getCachedTargetingCounts(userId);
            if (cachedCounts) {
                return cachedCounts;
            }

            // Fetch from database
            const counts = await this.repository.getTargetingCounts(userId);

            // Map to service format
            const result = {
                incoming: counts.incomingCount,
                outgoing: counts.outgoingCount
            };

            // Cache the counts
            await this.cacheManager.setCachedTargetingCounts(userId, result.incoming, result.outgoing);

            return result;
        } catch (error) {
            this.logger.error('Error getting targeting counts:', error);
            return { incoming: 0, outgoing: 0 };
        }
    }

    /**
     * Batch load targeting data for multiple users (for list views)
     */
    async batchLoadTargetingData(
        userIds: string[],
        options: TargetingQueryOptions = {}
    ): Promise<Map<string, PaginatedTargetingResult>> {
        const results = new Map<string, PaginatedTargetingResult>();

        // Process in batches to avoid overwhelming the database
        const batchSize = 10;
        const batches = this.chunkArray(userIds, batchSize);

        for (const batch of batches) {
            const batchPromises = batch.map(async (userId) => {
                try {
                    const result = await this.getPaginatedTargetingData(userId, options);
                    return { userId, result };
                } catch (error) {
                    this.logger.error(`Error loading targeting data for user ${userId}:`, error);
                    return { userId, result: null };
                }
            });

            const batchResults = await Promise.all(batchPromises);

            batchResults.forEach(({ userId, result }) => {
                if (result) {
                    results.set(userId, result);
                }
            });
        }

        return results;
    }

    /**
     * Invalidate cache when targeting relationships change
     */
    async invalidateTargetingCache(sourceUserId: string, targetUserId: string): Promise<void> {
        await this.cacheManager.invalidateTargetingRelationship(sourceUserId, targetUserId);
    }

    /**
     * Warm cache for active users
     */
    async warmCacheForUser(userId: string): Promise<void> {
        await this.cacheManager.warmCache(userId, async () => {
            const result = await this.fetchPaginatedFromDatabase(userId, {
                page: 1,
                limit: this.DEFAULT_PAGE_SIZE,
                direction: 'both'
            });
            return result.data;
        });
    }

    private normalizeQueryOptions(options: TargetingQueryOptions): Required<TargetingQueryOptions> {
        return {
            page: Math.max(1, options.page || 1),
            limit: Math.min(this.MAX_PAGE_SIZE, Math.max(1, options.limit || this.DEFAULT_PAGE_SIZE)),
            direction: options.direction || 'both',
            status: options.status || ['active', 'pending'],
            sortBy: options.sortBy || 'created_at',
            sortOrder: options.sortOrder || 'DESC'
        };
    }

    private shouldUseCache(options: Required<TargetingQueryOptions>): boolean {
        // Use cache for simple, common queries
        return (
            options.page === 1 &&
            options.limit <= this.DEFAULT_PAGE_SIZE &&
            options.direction === 'both' &&
            options.sortBy === 'created_at' &&
            options.sortOrder === 'DESC'
        );
    }

    private shouldCacheResult(
        options: Required<TargetingQueryOptions>,
        result: PaginatedTargetingResult
    ): boolean {
        // Cache first page results that aren't too large
        return (
            options.page === 1 &&
            result.data.length <= this.MAX_UNPAGINATED_RESULTS
        );
    }

    private async getCachedPaginatedResult(
        userId: string,
        options: Required<TargetingQueryOptions>
    ): Promise<Omit<PaginatedTargetingResult, 'performance'> | null> {
        const cachedData = await this.cacheManager.getCachedTargetingData(userId);

        if (!cachedData) {
            return null;
        }

        // Apply filtering and pagination to cached data
        let filteredData = cachedData;

        // Filter by direction
        if (options.direction !== 'both') {
            filteredData = filteredData.filter(item => item.direction === options.direction);
        }

        // Filter by status
        if (options.status.length > 0) {
            filteredData = filteredData.filter(item => options.status.includes(item.status));
        }

        // Sort data
        filteredData.sort((a, b) => {
            const aValue = a[options.sortBy];
            const bValue = b[options.sortBy];

            if (options.sortOrder === 'ASC') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        // Apply pagination
        const total = filteredData.length;
        const totalPages = Math.ceil(total / options.limit);
        const startIndex = (options.page - 1) * options.limit;
        const endIndex = startIndex + options.limit;
        const paginatedData = filteredData.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            pagination: {
                page: options.page,
                limit: options.limit,
                total,
                totalPages,
                hasNext: options.page < totalPages,
                hasPrevious: options.page > 1
            }
        };
    }

    private async fetchPaginatedFromDatabase(
        userId: string,
        options: Required<TargetingQueryOptions>
    ): Promise<Omit<PaginatedTargetingResult, 'performance'>> {
        // Calculate offset
        const offset = (options.page - 1) * options.limit;

        // Get total count for pagination
        const totalCount = await this.repository.getTargetingCount(userId, {
            direction: options.direction,
            status: options.status
        });

        // Fetch paginated data
        const data = await this.repository.getPaginatedTargetingData(userId, {
            limit: options.limit,
            offset,
            direction: options.direction,
            status: options.status,
            sortBy: options.sortBy,
            sortOrder: options.sortOrder
        });

        const totalPages = Math.ceil(totalCount / options.limit);

        return {
            data,
            pagination: {
                page: options.page,
                limit: options.limit,
                total: totalCount,
                totalPages,
                hasNext: options.page < totalPages,
                hasPrevious: options.page > 1
            }
        };
    }

    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}