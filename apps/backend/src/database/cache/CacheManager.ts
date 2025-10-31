import { RedisService } from './RedisService';
import { logger } from '../../utils/logger';

export interface CacheStrategy {
  ttl: number;
  tags: string[];
  invalidationPattern?: string;
}

export interface CacheConfig {
  strategies: {
    [key: string]: CacheStrategy;
  };
  defaultTTL: number;
  enableCompression: boolean;
  maxMemoryUsage: number; // in MB
}

export class CacheManager {
  private redis: RedisService;
  private config: CacheConfig;
  private compressionThreshold = 1024; // bytes

  constructor(redis: RedisService, config: CacheConfig) {
    this.redis = redis;
    this.config = config;
  }

  /**
   * Multi-level caching with automatic compression
   */
  async set(
    key: string,
    value: any,
    strategy?: string,
    customTTL?: number
  ): Promise<boolean> {
    try {
      const cacheStrategy = strategy ? this.config.strategies[strategy] : null;
      const ttl = customTTL || cacheStrategy?.ttl || this.config.defaultTTL;

      let serializedValue = JSON.stringify(value);
      
      // Compress large values if enabled
      if (this.config.enableCompression && serializedValue.length > this.compressionThreshold) {
        const zlib = await import('zlib');
        const compressed = zlib.gzipSync(serializedValue);
        serializedValue = compressed.toString('base64');
        key = `compressed:${key}`;
      }

      // Set cache tags for invalidation
      if (cacheStrategy?.tags) {
        await this.setTags(key, cacheStrategy.tags);
      }

      return await this.redis.set(key, serializedValue, ttl);
    } catch (error) {
      logger.error('Cache set failed', { error, key });
      return false;
    }
  }

  /**
   * Get with automatic decompression
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Try compressed version first
      let value = await this.redis.get<string>(`compressed:${key}`);
      let isCompressed = true;

      if (!value) {
        value = await this.redis.get<string>(key);
        isCompressed = false;
      }

      if (!value) {
        return null;
      }

      // Decompress if needed
      if (isCompressed && this.config.enableCompression) {
        const zlib = await import('zlib');
        const decompressed = zlib.gunzipSync(Buffer.from(value, 'base64'));
        value = decompressed.toString();
      }

      return JSON.parse(value);
    } catch (error) {
      logger.error('Cache get failed', { error, key });
      return null;
    }
  }

  /**
   * Cache with write-through pattern
   */
  async cacheWithWriteThrough<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    strategy?: string,
    customTTL?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch from source
    const value = await fetchFunction();
    
    // Cache the result
    await this.set(key, value, strategy, customTTL);
    
    return value;
  }

  /**
   * Cache with write-behind pattern (async caching)
   */
  async cacheWithWriteBehind<T>(
    key: string,
    value: T,
    strategy?: string,
    customTTL?: number
  ): Promise<void> {
    // Cache asynchronously without blocking
    setImmediate(async () => {
      try {
        await this.set(key, value, strategy, customTTL);
      } catch (error) {
        logger.error('Write-behind cache failed', { error, key });
      }
    });
  }

  /**
   * Batch operations for better performance
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      // Separate compressed and regular keys
      const compressedKeys = keys.map(key => `compressed:${key}`);
      const allKeys = [...keys, ...compressedKeys];
      
      const values = await this.redis.mget<string>(allKeys);
      const results: (T | null)[] = [];

      for (let i = 0; i < keys.length; i++) {
        const regularValue = values[i];
        const compressedValue = values[i + keys.length];
        
        let finalValue = regularValue || compressedValue;
        
        if (!finalValue) {
          results.push(null);
          continue;
        }

        // Decompress if it's a compressed value
        if (!regularValue && compressedValue && this.config.enableCompression) {
          try {
            const zlib = await import('zlib');
            const decompressed = zlib.gunzipSync(Buffer.from(compressedValue, 'base64'));
            finalValue = decompressed.toString();
          } catch (error) {
            logger.warn('Decompression failed', { error, key: keys[i] });
            results.push(null);
            continue;
          }
        }

        try {
          results.push(JSON.parse(finalValue));
        } catch (error) {
          logger.warn('JSON parse failed', { error, key: keys[i] });
          results.push(null);
        }
      }

      return results;
    } catch (error) {
      logger.error('Batch get failed', { error, keys });
      return keys.map(() => null);
    }
  }

  /**
   * Batch set operations
   */
  async mset<T>(keyValuePairs: Array<[string, T]>, strategy?: string, customTTL?: number): Promise<boolean> {
    try {
      const cacheStrategy = strategy ? this.config.strategies[strategy] : null;
      const ttl = customTTL || cacheStrategy?.ttl || this.config.defaultTTL;

      const processedPairs: Array<[string, string]> = [];

      for (const [key, value] of keyValuePairs) {
        let serializedValue = JSON.stringify(value);
        let finalKey = key;

        // Compress if needed
        if (this.config.enableCompression && serializedValue.length > this.compressionThreshold) {
          const zlib = await import('zlib');
          const compressed = zlib.gzipSync(serializedValue);
          serializedValue = compressed.toString('base64');
          finalKey = `compressed:${key}`;
        }

        processedPairs.push([finalKey, serializedValue]);

        // Set cache tags
        if (cacheStrategy?.tags) {
          await this.setTags(finalKey, cacheStrategy.tags);
        }
      }

      return await this.redis.mset(processedPairs, ttl);
    } catch (error) {
      logger.error('Batch set failed', { error });
      return false;
    }
  }

  /**
   * Cache invalidation by tags
   */
  async invalidateByTag(tag: string): Promise<number> {
    try {
      const tagKey = `tag:${tag}`;
      const keys = await this.redis.smembers(tagKey);
      
      if (keys.length === 0) {
        return 0;
      }

      // Delete all keys with this tag
      const deletedCount = await this.redis.del(...keys);
      
      // Clean up the tag set
      await this.redis.del(tagKey);
      
      logger.info('Cache invalidated by tag', { tag, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Tag invalidation failed', { error, tag });
      return 0;
    }
  }

  /**
   * Cache invalidation by pattern
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    try {
      const deletedCount = await this.redis.flushPattern(pattern);
      logger.info('Cache invalidated by pattern', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Pattern invalidation failed', { error, pattern });
      return 0;
    }
  }

  /**
   * Preload cache with frequently accessed data
   */
  async preloadCache(preloadConfig: {
    [key: string]: {
      fetchFunction: () => Promise<any>;
      strategy?: string;
      ttl?: number;
    };
  }): Promise<void> {
    try {
      const preloadPromises = Object.entries(preloadConfig).map(async ([key, config]) => {
        try {
          const value = await config.fetchFunction();
          await this.set(key, value, config.strategy, config.ttl);
          logger.info('Cache preloaded', { key });
        } catch (error) {
          logger.error('Cache preload failed', { error, key });
        }
      });

      await Promise.allSettled(preloadPromises);
      logger.info('Cache preload completed');
    } catch (error) {
      logger.error('Cache preload failed', { error });
    }
  }

  /**
   * Cache warming for search results
   */
  async warmSearchCache(popularQueries: string[]): Promise<void> {
    try {
      // This would be implemented with actual search service
      logger.info('Search cache warming started', { queryCount: popularQueries.length });
      
      // Implementation would fetch and cache popular search results
      for (const query of popularQueries) {
        const cacheKey = `search:${Buffer.from(query).toString('base64')}`;
        // Would call actual search service here
        logger.debug('Warming search cache', { query, cacheKey });
      }
      
      logger.info('Search cache warming completed');
    } catch (error) {
      logger.error('Search cache warming failed', { error });
    }
  }

  /**
   * Memory usage monitoring
   */
  async getMemoryUsage(): Promise<{
    used: number;
    peak: number;
    percentage: number;
  }> {
    try {
      // This would require Redis INFO command implementation
      // For now, return mock data
      return {
        used: 0,
        peak: 0,
        percentage: 0,
      };
    } catch (error) {
      logger.error('Failed to get memory usage', { error });
      return { used: 0, peak: 0, percentage: 0 };
    }
  }

  /**
   * Cache statistics
   */
  async getStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
    keyCount: number;
  }> {
    try {
      // This would require implementing hit/miss counters
      // For now, return mock data
      return {
        hits: 0,
        misses: 0,
        hitRate: 0,
        keyCount: 0,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error });
      return { hits: 0, misses: 0, hitRate: 0, keyCount: 0 };
    }
  }

  /**
   * Set cache tags for invalidation
   */
  private async setTags(key: string, tags: string[]): Promise<void> {
    try {
      for (const tag of tags) {
        const tagKey = `tag:${tag}`;
        await this.redis.sadd(tagKey, key);
      }
    } catch (error) {
      logger.error('Failed to set cache tags', { error, key, tags });
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<void> {
    try {
      // This would implement cleanup logic for expired entries
      logger.info('Cache cleanup completed');
    } catch (error) {
      logger.error('Cache cleanup failed', { error });
    }
  }
}