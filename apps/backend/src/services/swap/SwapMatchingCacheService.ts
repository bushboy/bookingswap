import { RedisService } from '../../database/cache/RedisService';
import { CacheManager } from '../../database/cache/CacheManager';
import { EligibleSwap, CompatibilityAnalysis } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export interface SwapMatchingCacheConfig {
  eligibleSwapsTTL: number; // TTL for eligible swaps cache
  compatibilityTTL: number; // TTL for compatibility analysis cache
  userSwapsTTL: number; // TTL for user's swaps cache
  searchResultsTTL: number; // TTL for search results
  enableCompression: boolean;
  maxCacheSize: number; // Maximum cache size in MB
}

export class SwapMatchingCacheService {
  private redis: RedisService;
  private cacheManager: CacheManager;
  private config: SwapMatchingCacheConfig;

  // Cache key prefixes
  private readonly ELIGIBLE_SWAPS_PREFIX = 'eligible_swaps';
  private readonly COMPATIBILITY_PREFIX = 'compatibility';
  private readonly USER_SWAPS_PREFIX = 'user_swaps';
  private readonly SEARCH_RESULTS_PREFIX = 'search_results';
  private readonly PROPOSAL_COUNT_PREFIX = 'proposal_count';
  private readonly SWAP_STATUS_PREFIX = 'swap_status';

  constructor(redis: RedisService, config: SwapMatchingCacheConfig) {
    this.redis = redis;
    this.config = config;
    
    // Initialize cache manager with swap-specific strategies
    this.cacheManager = new CacheManager(redis, {
      strategies: {
        eligible_swaps: {
          ttl: config.eligibleSwapsTTL,
          tags: ['user_swaps', 'swap_eligibility'],
          invalidationPattern: 'eligible_swaps:*'
        },
        compatibility: {
          ttl: config.compatibilityTTL,
          tags: ['swap_compatibility'],
          invalidationPattern: 'compatibility:*'
        },
        user_swaps: {
          ttl: config.userSwapsTTL,
          tags: ['user_data', 'swap_data'],
          invalidationPattern: 'user_swaps:*'
        },
        search_results: {
          ttl: config.searchResultsTTL,
          tags: ['search_data'],
          invalidationPattern: 'search_results:*'
        }
      },
      defaultTTL: config.eligibleSwapsTTL,
      enableCompression: config.enableCompression,
      maxMemoryUsage: config.maxCacheSize
    });
  }

  // ===== ELIGIBLE SWAPS CACHING =====

  /**
   * Cache user's eligible swaps for a target swap
   */
  async cacheUserEligibleSwaps(
    userId: string, 
    targetSwapId: string, 
    eligibleSwaps: EligibleSwap[]
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateEligibleSwapsKey(userId, targetSwapId);
      const cacheData = {
        swaps: eligibleSwaps,
        cachedAt: new Date().toISOString(),
        count: eligibleSwaps.length
      };

      const success = await this.cacheManager.set(
        cacheKey, 
        cacheData, 
        'eligible_swaps'
      );

      if (success) {
        logger.debug('Cached eligible swaps', { 
          userId, 
          targetSwapId, 
          count: eligibleSwaps.length 
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache eligible swaps', { 
        error, 
        userId, 
        targetSwapId 
      });
      return false;
    }
  }

  /**
   * Get cached eligible swaps for a user and target swap
   */
  async getCachedEligibleSwaps(
    userId: string, 
    targetSwapId: string
  ): Promise<EligibleSwap[] | null> {
    try {
      const cacheKey = this.generateEligibleSwapsKey(userId, targetSwapId);
      const cached = await this.cacheManager.get<{
        swaps: EligibleSwap[];
        cachedAt: string;
        count: number;
      }>(cacheKey);

      if (cached) {
        logger.debug('Retrieved cached eligible swaps', { 
          userId, 
          targetSwapId, 
          count: cached.count,
          cachedAt: cached.cachedAt
        });
        return cached.swaps;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached eligible swaps', { 
        error, 
        userId, 
        targetSwapId 
      });
      return null;
    }
  }

  // ===== COMPATIBILITY ANALYSIS CACHING =====

  /**
   * Cache compatibility analysis between two swaps
   */
  async cacheCompatibilityAnalysis(
    sourceSwapId: string,
    targetSwapId: string,
    analysis: CompatibilityAnalysis
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateCompatibilityKey(sourceSwapId, targetSwapId);
      const cacheData = {
        analysis,
        cachedAt: new Date().toISOString(),
        swapPair: { sourceSwapId, targetSwapId }
      };

      const success = await this.cacheManager.set(
        cacheKey,
        cacheData,
        'compatibility'
      );

      if (success) {
        logger.debug('Cached compatibility analysis', {
          sourceSwapId,
          targetSwapId,
          overallScore: analysis.overallScore
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache compatibility analysis', {
        error,
        sourceSwapId,
        targetSwapId
      });
      return false;
    }
  }

  /**
   * Get cached compatibility analysis
   */
  async getCachedCompatibilityAnalysis(
    sourceSwapId: string,
    targetSwapId: string
  ): Promise<CompatibilityAnalysis | null> {
    try {
      const cacheKey = this.generateCompatibilityKey(sourceSwapId, targetSwapId);
      const cached = await this.cacheManager.get<{
        analysis: CompatibilityAnalysis;
        cachedAt: string;
        swapPair: { sourceSwapId: string; targetSwapId: string };
      }>(cacheKey);

      if (cached) {
        logger.debug('Retrieved cached compatibility analysis', {
          sourceSwapId,
          targetSwapId,
          overallScore: cached.analysis.overallScore,
          cachedAt: cached.cachedAt
        });
        return cached.analysis;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached compatibility analysis', {
        error,
        sourceSwapId,
        targetSwapId
      });
      return null;
    }
  }

  /**
   * Batch cache multiple compatibility analyses
   */
  async batchCacheCompatibilityAnalyses(
    analyses: Array<{
      sourceSwapId: string;
      targetSwapId: string;
      analysis: CompatibilityAnalysis;
    }>
  ): Promise<boolean> {
    try {
      const keyValuePairs: Array<[string, any]> = analyses.map(({ sourceSwapId, targetSwapId, analysis }) => {
        const cacheKey = this.generateCompatibilityKey(sourceSwapId, targetSwapId);
        const cacheData = {
          analysis,
          cachedAt: new Date().toISOString(),
          swapPair: { sourceSwapId, targetSwapId }
        };
        return [cacheKey, cacheData];
      });

      const success = await this.cacheManager.mset(keyValuePairs, 'compatibility');

      if (success) {
        logger.debug('Batch cached compatibility analyses', { count: analyses.length });
      }

      return success;
    } catch (error) {
      logger.error('Failed to batch cache compatibility analyses', { error });
      return false;
    }
  }

  // ===== USER SWAPS CACHING =====

  /**
   * Cache user's active swaps
   */
  async cacheUserActiveSwaps(userId: string, swaps: any[]): Promise<boolean> {
    try {
      const cacheKey = this.generateUserSwapsKey(userId);
      const cacheData = {
        swaps,
        cachedAt: new Date().toISOString(),
        count: swaps.length
      };

      const success = await this.cacheManager.set(
        cacheKey,
        cacheData,
        'user_swaps'
      );

      if (success) {
        logger.debug('Cached user active swaps', { userId, count: swaps.length });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache user active swaps', { error, userId });
      return false;
    }
  }

  /**
   * Get cached user's active swaps
   */
  async getCachedUserActiveSwaps(userId: string): Promise<any[] | null> {
    try {
      const cacheKey = this.generateUserSwapsKey(userId);
      const cached = await this.cacheManager.get<{
        swaps: any[];
        cachedAt: string;
        count: number;
      }>(cacheKey);

      if (cached) {
        logger.debug('Retrieved cached user active swaps', {
          userId,
          count: cached.count,
          cachedAt: cached.cachedAt
        });
        return cached.swaps;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached user active swaps', { error, userId });
      return null;
    }
  }

  // ===== SEARCH RESULTS CACHING =====

  /**
   * Cache search results for browse page
   */
  async cacheSearchResults(
    searchParams: Record<string, any>,
    results: any[],
    totalCount: number
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateSearchResultsKey(searchParams);
      const cacheData = {
        results,
        totalCount,
        searchParams,
        cachedAt: new Date().toISOString()
      };

      const success = await this.cacheManager.set(
        cacheKey,
        cacheData,
        'search_results'
      );

      if (success) {
        logger.debug('Cached search results', {
          searchParams,
          resultCount: results.length,
          totalCount
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache search results', { error, searchParams });
      return false;
    }
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(searchParams: Record<string, any>): Promise<{
    results: any[];
    totalCount: number;
  } | null> {
    try {
      const cacheKey = this.generateSearchResultsKey(searchParams);
      const cached = await this.cacheManager.get<{
        results: any[];
        totalCount: number;
        searchParams: Record<string, any>;
        cachedAt: string;
      }>(cacheKey);

      if (cached) {
        logger.debug('Retrieved cached search results', {
          searchParams,
          resultCount: cached.results.length,
          totalCount: cached.totalCount,
          cachedAt: cached.cachedAt
        });
        return {
          results: cached.results,
          totalCount: cached.totalCount
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get cached search results', { error, searchParams });
      return null;
    }
  }

  // ===== CACHE INVALIDATION =====

  /**
   * Invalidate all cache entries related to a specific user
   */
  async invalidateUserCache(userId: string): Promise<number> {
    try {
      const patterns = [
        `${this.ELIGIBLE_SWAPS_PREFIX}:${userId}:*`,
        `${this.USER_SWAPS_PREFIX}:${userId}`,
        `${this.PROPOSAL_COUNT_PREFIX}:${userId}:*`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await this.cacheManager.invalidateByPattern(pattern);
        totalDeleted += deleted;
      }

      logger.info('Invalidated user cache', { userId, deletedKeys: totalDeleted });
      return totalDeleted;
    } catch (error) {
      logger.error('Failed to invalidate user cache', { error, userId });
      return 0;
    }
  }

  /**
   * Invalidate all cache entries related to a specific swap
   */
  async invalidateSwapCache(swapId: string): Promise<number> {
    try {
      const patterns = [
        `${this.ELIGIBLE_SWAPS_PREFIX}:*:${swapId}`,
        `${this.COMPATIBILITY_PREFIX}:${swapId}:*`,
        `${this.COMPATIBILITY_PREFIX}:*:${swapId}`,
        `${this.SWAP_STATUS_PREFIX}:${swapId}`
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await this.cacheManager.invalidateByPattern(pattern);
        totalDeleted += deleted;
      }

      // Also invalidate search results as they might contain this swap
      const searchDeleted = await this.cacheManager.invalidateByTag('search_data');
      totalDeleted += searchDeleted;

      logger.info('Invalidated swap cache', { swapId, deletedKeys: totalDeleted });
      return totalDeleted;
    } catch (error) {
      logger.error('Failed to invalidate swap cache', { error, swapId });
      return 0;
    }
  }

  /**
   * Invalidate compatibility cache for a specific swap pair
   */
  async invalidateCompatibilityCache(sourceSwapId: string, targetSwapId: string): Promise<boolean> {
    try {
      const key1 = this.generateCompatibilityKey(sourceSwapId, targetSwapId);
      const key2 = this.generateCompatibilityKey(targetSwapId, sourceSwapId);
      
      const deleted1 = await this.redis.del(key1);
      const deleted2 = await this.redis.del(key2);

      const success = deleted1 || deleted2;
      if (success) {
        logger.debug('Invalidated compatibility cache', { sourceSwapId, targetSwapId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to invalidate compatibility cache', {
        error,
        sourceSwapId,
        targetSwapId
      });
      return false;
    }
  }

  // ===== CACHE WARMING =====

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmingConfig: {
    popularUsers?: string[];
    popularSwaps?: string[];
    popularSearchQueries?: Array<Record<string, any>>;
  }): Promise<void> {
    try {
      logger.info('Starting cache warming', {
        userCount: warmingConfig.popularUsers?.length || 0,
        swapCount: warmingConfig.popularSwaps?.length || 0,
        queryCount: warmingConfig.popularSearchQueries?.length || 0
      });

      const warmingPromises: Promise<void>[] = [];

      // Warm user swaps cache
      if (warmingConfig.popularUsers) {
        for (const userId of warmingConfig.popularUsers) {
          warmingPromises.push(this.warmUserSwapsCache(userId));
        }
      }

      // Warm compatibility cache for popular swap pairs
      if (warmingConfig.popularSwaps && warmingConfig.popularSwaps.length > 1) {
        for (let i = 0; i < warmingConfig.popularSwaps.length; i++) {
          for (let j = i + 1; j < warmingConfig.popularSwaps.length; j++) {
            warmingPromises.push(
              this.warmCompatibilityCache(
                warmingConfig.popularSwaps[i],
                warmingConfig.popularSwaps[j]
              )
            );
          }
        }
      }

      // Warm search results cache
      if (warmingConfig.popularSearchQueries) {
        for (const query of warmingConfig.popularSearchQueries) {
          warmingPromises.push(this.warmSearchResultsCache(query));
        }
      }

      await Promise.allSettled(warmingPromises);
      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', { error });
    }
  }

  /**
   * Warm user swaps cache
   */
  private async warmUserSwapsCache(userId: string): Promise<void> {
    try {
      // This would typically fetch from database and cache
      // For now, we'll just log the warming attempt
      logger.debug('Warming user swaps cache', { userId });
    } catch (error) {
      logger.warn('Failed to warm user swaps cache', { error, userId });
    }
  }

  /**
   * Warm compatibility cache
   */
  private async warmCompatibilityCache(sourceSwapId: string, targetSwapId: string): Promise<void> {
    try {
      // This would typically calculate and cache compatibility
      // For now, we'll just log the warming attempt
      logger.debug('Warming compatibility cache', { sourceSwapId, targetSwapId });
    } catch (error) {
      logger.warn('Failed to warm compatibility cache', { error, sourceSwapId, targetSwapId });
    }
  }

  /**
   * Warm search results cache
   */
  private async warmSearchResultsCache(searchParams: Record<string, any>): Promise<void> {
    try {
      // This would typically execute search and cache results
      // For now, we'll just log the warming attempt
      logger.debug('Warming search results cache', { searchParams });
    } catch (error) {
      logger.warn('Failed to warm search results cache', { error, searchParams });
    }
  }

  // ===== CACHE STATISTICS =====

  /**
   * Get cache statistics for monitoring
   */
  async getCacheStats(): Promise<{
    eligibleSwapsHits: number;
    compatibilityHits: number;
    userSwapsHits: number;
    searchResultsHits: number;
    totalHits: number;
    hitRate: number;
  }> {
    try {
      // This would require implementing hit/miss counters
      // For now, return basic stats from cache manager
      const stats = await this.cacheManager.getStats();
      
      return {
        eligibleSwapsHits: 0, // Would be tracked separately
        compatibilityHits: 0, // Would be tracked separately
        userSwapsHits: 0, // Would be tracked separately
        searchResultsHits: 0, // Would be tracked separately
        totalHits: stats.hits,
        hitRate: stats.hitRate
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return {
        eligibleSwapsHits: 0,
        compatibilityHits: 0,
        userSwapsHits: 0,
        searchResultsHits: 0,
        totalHits: 0,
        hitRate: 0
      };
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Generate cache key for eligible swaps
   */
  private generateEligibleSwapsKey(userId: string, targetSwapId: string): string {
    return `${this.ELIGIBLE_SWAPS_PREFIX}:${userId}:${targetSwapId}`;
  }

  /**
   * Generate cache key for compatibility analysis
   */
  private generateCompatibilityKey(sourceSwapId: string, targetSwapId: string): string {
    // Ensure consistent key ordering for bidirectional compatibility
    const [id1, id2] = [sourceSwapId, targetSwapId].sort();
    return `${this.COMPATIBILITY_PREFIX}:${id1}:${id2}`;
  }

  /**
   * Generate cache key for user's swaps
   */
  private generateUserSwapsKey(userId: string): string {
    return `${this.USER_SWAPS_PREFIX}:${userId}`;
  }

  /**
   * Generate cache key for search results
   */
  private generateSearchResultsKey(searchParams: Record<string, any>): string {
    // Create a consistent hash of search parameters
    const sortedParams = Object.keys(searchParams)
      .sort()
      .reduce((result, key) => {
        result[key] = searchParams[key];
        return result;
      }, {} as Record<string, any>);
    
    const paramString = JSON.stringify(sortedParams);
    const hash = Buffer.from(paramString).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    
    return `${this.SEARCH_RESULTS_PREFIX}:${hash}`;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<void> {
    try {
      await this.cacheManager.cleanup();
      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup failed', { error });
    }
  }
}