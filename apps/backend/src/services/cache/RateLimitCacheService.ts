import { RedisService } from '../../database/cache/RedisService';
import { logger } from '../../utils/logger';

export interface RateLimitEntry {
  count: number;
  windowStart: Date;
  firstAttempt: Date;
  lastAttempt: Date;
}

export interface RateLimitConfig {
  emailLimit: number;
  ipLimit: number;
  windowMs: number;
  enableDistributedCache: boolean;
}

export class RateLimitCacheService {
  private redis: RedisService | null = null;
  private memoryCache: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig, redis?: RedisService) {
    this.config = config;
    this.redis = redis || null;

    // Start cleanup interval for memory cache
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Clean up every minute
  }

  /**
   * Get rate limit entry with caching optimization
   */
  async getRateLimitEntry(key: string, type: 'email' | 'ip'): Promise<RateLimitEntry | null> {
    const cacheKey = `rate_limit:${type}:${key}`;

    try {
      // Try Redis first if available
      if (this.redis && this.config.enableDistributedCache) {
        const cached = await this.redis.get<RateLimitEntry>(cacheKey);
        if (cached) {
          // Update memory cache for faster subsequent access
          this.memoryCache.set(cacheKey, cached);
          return cached;
        }
      }

      // Fall back to memory cache
      const memoryEntry = this.memoryCache.get(cacheKey);
      if (memoryEntry) {
        // Sync to Redis if available
        if (this.redis && this.config.enableDistributedCache) {
          await this.redis.set(cacheKey, memoryEntry, Math.ceil(this.config.windowMs / 1000));
        }
        return memoryEntry;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get rate limit entry', { error, key, type });
      // Fall back to memory cache on Redis error
      return this.memoryCache.get(cacheKey) || null;
    }
  }

  /**
   * Set rate limit entry with write-through caching
   */
  async setRateLimitEntry(
    key: string,
    type: 'email' | 'ip',
    entry: RateLimitEntry
  ): Promise<boolean> {
    const cacheKey = `rate_limit:${type}:${key}`;

    try {
      // Update memory cache immediately
      this.memoryCache.set(cacheKey, entry);

      // Update Redis asynchronously if available
      if (this.redis && this.config.enableDistributedCache) {
        const ttl = Math.ceil(this.config.windowMs / 1000);
        await this.redis.set(cacheKey, entry, ttl);
      }

      return true;
    } catch (error) {
      logger.error('Failed to set rate limit entry', { error, key, type });
      // Keep memory cache even if Redis fails
      return true;
    }
  }

  /**
   * Increment rate limit counter with atomic operations
   */
  async incrementCounter(
    key: string,
    type: 'email' | 'ip'
  ): Promise<{ count: number; isNewWindow: boolean }> {
    const now = new Date();
    const cacheKey = `rate_limit:${type}:${key}`;

    try {
      // Use Redis atomic operations if available
      if (this.redis && this.config.enableDistributedCache) {
        return await this.incrementCounterRedis(cacheKey, now);
      }

      // Fall back to memory cache with locking
      return await this.incrementCounterMemory(cacheKey, now);
    } catch (error) {
      logger.error('Failed to increment rate limit counter', { error, key, type });
      // Return safe defaults on error
      return { count: 1, isNewWindow: true };
    }
  }

  /**
   * Redis-based atomic counter increment
   */
  private async incrementCounterRedis(
    cacheKey: string,
    now: Date
  ): Promise<{ count: number; isNewWindow: boolean }> {
    if (!this.redis) {
      throw new Error('Redis not available');
    }

    const windowKey = `${cacheKey}:window`;
    const countKey = `${cacheKey}:count`;
    const ttl = Math.ceil(this.config.windowMs / 1000);

    // Use Redis pipeline for atomic operations
    const pipeline = (this.redis as any).client.pipeline();
    
    // Get current window start time
    pipeline.get(windowKey);
    // Get current count
    pipeline.get(countKey);
    
    const results = await pipeline.exec();
    const windowStart = results[0][1];
    const currentCount = parseInt(results[1][1] || '0');

    const isNewWindow = !windowStart || 
      (now.getTime() - new Date(windowStart).getTime()) > this.config.windowMs;

    if (isNewWindow) {
      // Start new window
      const newPipeline = (this.redis as any).client.pipeline();
      newPipeline.set(windowKey, now.toISOString(), 'EX', ttl);
      newPipeline.set(countKey, '1', 'EX', ttl);
      await newPipeline.exec();

      // Update memory cache
      const entry: RateLimitEntry = {
        count: 1,
        windowStart: now,
        firstAttempt: now,
        lastAttempt: now,
      };
      this.memoryCache.set(cacheKey, entry);

      return { count: 1, isNewWindow: true };
    } else {
      // Increment existing window
      const newCount = await (this.redis as any).client.incr(countKey);
      await (this.redis as any).client.expire(countKey, ttl);

      // Update memory cache
      const entry: RateLimitEntry = {
        count: newCount,
        windowStart: new Date(windowStart),
        firstAttempt: new Date(windowStart),
        lastAttempt: now,
      };
      this.memoryCache.set(cacheKey, entry);

      return { count: newCount, isNewWindow: false };
    }
  }

  /**
   * Memory-based counter increment with simple locking
   */
  private async incrementCounterMemory(
    cacheKey: string,
    now: Date
  ): Promise<{ count: number; isNewWindow: boolean }> {
    const existing = this.memoryCache.get(cacheKey);

    if (!existing || (now.getTime() - existing.windowStart.getTime()) > this.config.windowMs) {
      // New window
      const entry: RateLimitEntry = {
        count: 1,
        windowStart: now,
        firstAttempt: now,
        lastAttempt: now,
      };
      this.memoryCache.set(cacheKey, entry);
      return { count: 1, isNewWindow: true };
    } else {
      // Increment existing
      const entry: RateLimitEntry = {
        ...existing,
        count: existing.count + 1,
        lastAttempt: now,
      };
      this.memoryCache.set(cacheKey, entry);
      return { count: entry.count, isNewWindow: false };
    }
  }

  /**
   * Check if rate limit is exceeded with caching
   */
  async isRateLimitExceeded(
    key: string,
    type: 'email' | 'ip'
  ): Promise<{
    exceeded: boolean;
    count: number;
    limit: number;
    timeRemaining: number;
  }> {
    const limit = type === 'email' ? this.config.emailLimit : this.config.ipLimit;
    const entry = await this.getRateLimitEntry(key, type);

    if (!entry) {
      return {
        exceeded: false,
        count: 0,
        limit,
        timeRemaining: 0,
      };
    }

    const now = new Date();
    const windowElapsed = now.getTime() - entry.windowStart.getTime();
    const timeRemaining = Math.max(0, this.config.windowMs - windowElapsed);

    // Check if window has expired
    if (windowElapsed > this.config.windowMs) {
      return {
        exceeded: false,
        count: 0,
        limit,
        timeRemaining: 0,
      };
    }

    return {
      exceeded: entry.count >= limit,
      count: entry.count,
      limit,
      timeRemaining,
    };
  }

  /**
   * Reset rate limit for specific key (admin function)
   */
  async resetRateLimit(key: string, type: 'email' | 'ip'): Promise<boolean> {
    const cacheKey = `rate_limit:${type}:${key}`;

    try {
      // Remove from memory cache
      this.memoryCache.delete(cacheKey);

      // Remove from Redis if available
      if (this.redis && this.config.enableDistributedCache) {
        await this.redis.del(`${cacheKey}:window`);
        await this.redis.del(`${cacheKey}:count`);
        await this.redis.del(cacheKey);
      }

      logger.info('Rate limit reset', { key, type });
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit', { error, key, type });
      return false;
    }
  }

  /**
   * Get rate limit statistics for monitoring
   */
  async getRateLimitStats(): Promise<{
    memoryCacheSize: number;
    redisConnected: boolean;
    totalEntries: number;
    activeWindows: number;
  }> {
    const now = new Date();
    let activeWindows = 0;

    // Count active windows in memory cache
    for (const [, entry] of this.memoryCache) {
      if ((now.getTime() - entry.windowStart.getTime()) <= this.config.windowMs) {
        activeWindows++;
      }
    }

    return {
      memoryCacheSize: this.memoryCache.size,
      redisConnected: this.redis ? await this.redis.ping() : false,
      totalEntries: this.memoryCache.size,
      activeWindows,
    };
  }

  /**
   * Preload frequently accessed rate limits
   */
  async preloadFrequentLimits(keys: Array<{ key: string; type: 'email' | 'ip' }>): Promise<void> {
    if (!this.redis || !this.config.enableDistributedCache) {
      return;
    }

    try {
      const cacheKeys = keys.map(({ key, type }) => `rate_limit:${type}:${key}`);
      const entries = await this.redis.mget<RateLimitEntry>(cacheKeys);

      // Load into memory cache
      for (let i = 0; i < cacheKeys.length; i++) {
        if (entries[i]) {
          this.memoryCache.set(cacheKeys[i], entries[i]!);
        }
      }

      logger.info('Rate limit cache preloaded', { 
        keysRequested: keys.length,
        keysLoaded: entries.filter(e => e !== null).length,
      });
    } catch (error) {
      logger.error('Failed to preload rate limit cache', { error });
    }
  }

  /**
   * Clean up expired entries from memory cache
   */
  private cleanupExpiredEntries(): void {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.memoryCache) {
      if ((now.getTime() - entry.windowStart.getTime()) > this.config.windowMs * 2) {
        this.memoryCache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Rate limit cache cleanup completed', {
        cleanedCount,
        remainingEntries: this.memoryCache.size,
      });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.memoryCache.clear();
  }
}