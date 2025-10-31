import { Redis } from 'ioredis';
import { logger as Logger } from '../../utils/logger';

export interface TargetingCacheData {
    userId: string;
    targetingData: any[];
    lastUpdated: Date;
    version: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
}

/**
 * Manages caching for targeting data to improve performance
 * Implements intelligent cache invalidation and warming strategies
 */
export class TargetingCacheManager {
    private redis: Redis;
    private logger: Logger;
    private stats: CacheStats;

    // Cache configuration
    private readonly TARGETING_CACHE_TTL = 300; // 5 minutes
    private readonly TARGETING_CACHE_PREFIX = 'targeting:';
    private readonly TARGETING_COUNT_CACHE_PREFIX = 'targeting_count:';
    private readonly CACHE_VERSION = 1;

    constructor(redis: Redis, logger: Logger) {
        this.redis = redis;
        this.logger = logger;
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalRequests: 0
        };
    }

    /**
     * Get cached targeting data for a user
     */
    async getCachedTargetingData(userId: string): Promise<any[] | null> {
        try {
            this.stats.totalRequests++;

            const cacheKey = this.getTargetingCacheKey(userId);
            const cached = await this.redis.get(cacheKey);

            if (cached) {
                this.stats.hits++;
                this.updateHitRate();

                const parsedData: TargetingCacheData = JSON.parse(cached);

                // Validate cache version
                if (parsedData.version !== this.CACHE_VERSION) {
                    await this.invalidateUserTargetingCache(userId);
                    this.stats.misses++;
                    return null;
                }

                this.logger.debug(`Cache hit for targeting data: ${userId}`);
                return parsedData.targetingData;
            }

            this.stats.misses++;
            this.updateHitRate();
            this.logger.debug(`Cache miss for targeting data: ${userId}`);
            return null;
        } catch (error) {
            this.logger.error('Error getting cached targeting data:', error);
            return null;
        }
    }

    /**
     * Cache targeting data for a user
     */
    async setCachedTargetingData(userId: string, targetingData: any[]): Promise<void> {
        try {
            const cacheKey = this.getTargetingCacheKey(userId);
            const cacheData: TargetingCacheData = {
                userId,
                targetingData,
                lastUpdated: new Date(),
                version: this.CACHE_VERSION
            };

            await this.redis.setex(
                cacheKey,
                this.TARGETING_CACHE_TTL,
                JSON.stringify(cacheData)
            );

            // Also cache targeting counts for quick access
            const incomingCount = targetingData.filter(t => t.direction === 'incoming').length;
            const outgoingCount = targetingData.filter(t => t.direction === 'outgoing').length;

            await this.setCachedTargetingCounts(userId, incomingCount, outgoingCount);

            this.logger.debug(`Cached targeting data for user: ${userId}`);
        } catch (error) {
            this.logger.error('Error caching targeting data:', error);
        }
    }

    /**
     * Get cached targeting counts for quick display
     */
    async getCachedTargetingCounts(userId: string): Promise<{ incoming: number; outgoing: number } | null> {
        try {
            const cacheKey = this.getTargetingCountCacheKey(userId);
            const cached = await this.redis.get(cacheKey);

            if (cached) {
                return JSON.parse(cached);
            }

            return null;
        } catch (error) {
            this.logger.error('Error getting cached targeting counts:', error);
            return null;
        }
    }

    /**
     * Cache targeting counts separately for quick access
     */
    async setCachedTargetingCounts(userId: string, incoming: number, outgoing: number): Promise<void> {
        try {
            const cacheKey = this.getTargetingCountCacheKey(userId);
            const countData = { incoming, outgoing };

            await this.redis.setex(
                cacheKey,
                this.TARGETING_CACHE_TTL,
                JSON.stringify(countData)
            );
        } catch (error) {
            this.logger.error('Error caching targeting counts:', error);
        }
    }

    /**
     * Invalidate targeting cache for a specific user
     */
    async invalidateUserTargetingCache(userId: string): Promise<void> {
        try {
            const targetingKey = this.getTargetingCacheKey(userId);
            const countKey = this.getTargetingCountCacheKey(userId);

            await Promise.all([
                this.redis.del(targetingKey),
                this.redis.del(countKey)
            ]);

            this.logger.debug(`Invalidated targeting cache for user: ${userId}`);
        } catch (error) {
            this.logger.error('Error invalidating targeting cache:', error);
        }
    }

    /**
     * Invalidate targeting cache for multiple users (when relationships change)
     */
    async invalidateMultipleUsersCache(userIds: string[]): Promise<void> {
        try {
            const keys = userIds.flatMap(userId => [
                this.getTargetingCacheKey(userId),
                this.getTargetingCountCacheKey(userId)
            ]);

            if (keys.length > 0) {
                await this.redis.del(...keys);
                this.logger.debug(`Invalidated targeting cache for ${userIds.length} users`);
            }
        } catch (error) {
            this.logger.error('Error invalidating multiple users cache:', error);
        }
    }

    /**
     * Warm cache for frequently accessed users
     */
    async warmCache(userId: string, targetingDataFetcher: () => Promise<any[]>): Promise<void> {
        try {
            const cached = await this.getCachedTargetingData(userId);

            if (!cached) {
                const targetingData = await targetingDataFetcher();
                await this.setCachedTargetingData(userId, targetingData);
                this.logger.debug(`Warmed targeting cache for user: ${userId}`);
            }
        } catch (error) {
            this.logger.error('Error warming targeting cache:', error);
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Reset cache statistics
     */
    resetCacheStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            hitRate: 0,
            totalRequests: 0
        };
    }

    /**
     * Get cache health information
     */
    async getCacheHealth(): Promise<{
        isHealthy: boolean;
        redisConnected: boolean;
        cacheStats: CacheStats;
    }> {
        try {
            const redisConnected = this.redis.status === 'ready';
            const isHealthy = redisConnected && this.stats.hitRate > 0.5; // 50% hit rate threshold

            return {
                isHealthy,
                redisConnected,
                cacheStats: this.getCacheStats()
            };
        } catch (error) {
            return {
                isHealthy: false,
                redisConnected: false,
                cacheStats: this.getCacheStats()
            };
        }
    }

    /**
     * Batch invalidation for targeting relationship changes
     */
    async invalidateTargetingRelationship(sourceUserId: string, targetUserId: string): Promise<void> {
        await this.invalidateMultipleUsersCache([sourceUserId, targetUserId]);
    }

    private getTargetingCacheKey(userId: string): string {
        return `${this.TARGETING_CACHE_PREFIX}${userId}`;
    }

    private getTargetingCountCacheKey(userId: string): string {
        return `${this.TARGETING_COUNT_CACHE_PREFIX}${userId}`;
    }

    private updateHitRate(): void {
        if (this.stats.totalRequests > 0) {
            this.stats.hitRate = this.stats.hits / this.stats.totalRequests;
        }
    }
}