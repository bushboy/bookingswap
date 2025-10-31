import { EligibleSwapResponse, CompatibilityAnalysis } from '../types/api';

/**
 * Cache entry interface with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Cache configuration options
 */
interface CacheConfig {
  defaultTTL: number; // Time to live in milliseconds
  maxSize: number; // Maximum number of entries
  cleanupInterval: number; // Cleanup interval in milliseconds
}

/**
 * Cache service for API responses with TTL and size limits
 * Provides short-term caching to reduce API calls and improve performance
 */
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      defaultTTL: 5 * 60 * 1000, // 5 minutes default
      maxSize: 100, // Maximum 100 entries
      cleanupInterval: 60 * 1000, // Cleanup every minute
      ...config,
    };

    this.startCleanupTimer();
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const timeToLive = ttl || this.config.defaultTTL;
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      expiresAt: now + timeToLive,
    };

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, entry);
  }

  /**
   * Check if a key exists and hasn't expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; timestamp: number; expiresAt: number }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      timestamp: entry.timestamp,
      expiresAt: entry.expiresAt,
    }));

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: 0, // TODO: Implement hit rate tracking
      entries,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Stop cleanup timer (for cleanup)
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

/**
 * Specialized cache service for swap-related data
 */
export class SwapCacheService extends CacheService {
  constructor() {
    super({
      defaultTTL: 3 * 60 * 1000, // 3 minutes for swap data
      maxSize: 50, // Smaller cache for swap-specific data
      cleanupInterval: 30 * 1000, // Cleanup every 30 seconds
    });
  }

  /**
   * Generate cache key for eligible swaps
   */
  private getEligibleSwapsKey(userId: string, targetSwapId: string): string {
    return `eligible_swaps:${userId}:${targetSwapId}`;
  }

  /**
   * Generate cache key for compatibility analysis
   */
  private getCompatibilityKey(sourceSwapId: string, targetSwapId: string): string {
    return `compatibility:${sourceSwapId}:${targetSwapId}`;
  }

  /**
   * Cache eligible swaps response
   */
  setEligibleSwaps(userId: string, targetSwapId: string, data: EligibleSwapResponse): void {
    const key = this.getEligibleSwapsKey(userId, targetSwapId);
    this.set(key, data, 2 * 60 * 1000); // 2 minutes TTL for eligible swaps
  }

  /**
   * Get cached eligible swaps response
   */
  getEligibleSwaps(userId: string, targetSwapId: string): EligibleSwapResponse | null {
    const key = this.getEligibleSwapsKey(userId, targetSwapId);
    return this.get<EligibleSwapResponse>(key);
  }

  /**
   * Cache compatibility analysis
   */
  setCompatibilityAnalysis(sourceSwapId: string, targetSwapId: string, data: CompatibilityAnalysis): void {
    const key = this.getCompatibilityKey(sourceSwapId, targetSwapId);
    this.set(key, data, 5 * 60 * 1000); // 5 minutes TTL for compatibility analysis
  }

  /**
   * Get cached compatibility analysis
   */
  getCompatibilityAnalysis(sourceSwapId: string, targetSwapId: string): CompatibilityAnalysis | null {
    const key = this.getCompatibilityKey(sourceSwapId, targetSwapId);
    return this.get<CompatibilityAnalysis>(key);
  }

  /**
   * Invalidate eligible swaps cache for a user
   */
  invalidateEligibleSwaps(userId: string, targetSwapId?: string): void {
    if (targetSwapId) {
      const key = this.getEligibleSwapsKey(userId, targetSwapId);
      this.delete(key);
    } else {
      // Invalidate all eligible swaps for the user
      const prefix = `eligible_swaps:${userId}:`;
      const keysToDelete = Array.from(this.cache.keys()).filter(key => key.startsWith(prefix));
      keysToDelete.forEach(key => this.delete(key));
    }
  }

  /**
   * Invalidate compatibility cache for specific swaps
   */
  invalidateCompatibility(sourceSwapId?: string, targetSwapId?: string): void {
    if (sourceSwapId && targetSwapId) {
      const key = this.getCompatibilityKey(sourceSwapId, targetSwapId);
      this.delete(key);
    } else if (sourceSwapId || targetSwapId) {
      // Invalidate all compatibility entries involving the swap
      const swapId = sourceSwapId || targetSwapId;
      const keysToDelete = Array.from(this.cache.keys()).filter(key => 
        key.startsWith('compatibility:') && key.includes(swapId!)
      );
      keysToDelete.forEach(key => this.delete(key));
    }
  }
}

// Export singleton instance
export const swapCacheService = new SwapCacheService();