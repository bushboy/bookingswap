import { SwapMatchingCacheConfig } from './SwapMatchingCacheService';

/**
 * Cache configuration for swap matching functionality
 * TTL values are in seconds
 */
export const getSwapMatchingCacheConfig = (): SwapMatchingCacheConfig => {
  return {
    // Eligible swaps cache - relatively short TTL as eligibility can change frequently
    eligibleSwapsTTL: parseInt(process.env.ELIGIBLE_SWAPS_CACHE_TTL || '900'), // 15 minutes

    // Compatibility analysis cache - longer TTL as compatibility is more stable
    compatibilityTTL: parseInt(process.env.COMPATIBILITY_CACHE_TTL || '3600'), // 1 hour

    // User swaps cache - medium TTL as user's swaps don't change very frequently
    userSwapsTTL: parseInt(process.env.USER_SWAPS_CACHE_TTL || '1800'), // 30 minutes

    // Search results cache - short TTL for fresh results
    searchResultsTTL: parseInt(process.env.SEARCH_RESULTS_CACHE_TTL || '300'), // 5 minutes

    // Enable compression for large cache entries
    enableCompression: process.env.CACHE_COMPRESSION_ENABLED !== 'false',

    // Maximum cache size in MB
    maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE_MB || '512'), // 512 MB
  };
};

/**
 * Cache warming configuration
 */
export interface CacheWarmingConfig {
  enabled: boolean;
  scheduleInterval: number; // in milliseconds
  popularUsersLimit: number;
  popularSwapsLimit: number;
  popularQueriesLimit: number;
}

export const getCacheWarmingConfig = (): CacheWarmingConfig => {
  return {
    enabled: process.env.CACHE_WARMING_ENABLED === 'true',
    scheduleInterval: parseInt(process.env.CACHE_WARMING_INTERVAL || '3600000'), // 1 hour
    popularUsersLimit: parseInt(process.env.POPULAR_USERS_LIMIT || '100'),
    popularSwapsLimit: parseInt(process.env.POPULAR_SWAPS_LIMIT || '200'),
    popularQueriesLimit: parseInt(process.env.POPULAR_QUERIES_LIMIT || '50'),
  };
};

/**
 * Cache invalidation strategies
 */
export interface CacheInvalidationConfig {
  invalidateOnSwapUpdate: boolean;
  invalidateOnUserUpdate: boolean;
  invalidateOnProposalCreate: boolean;
  invalidateOnBookingUpdate: boolean;
  batchInvalidationDelay: number; // in milliseconds
}

export const getCacheInvalidationConfig = (): CacheInvalidationConfig => {
  return {
    invalidateOnSwapUpdate: process.env.INVALIDATE_ON_SWAP_UPDATE !== 'false',
    invalidateOnUserUpdate: process.env.INVALIDATE_ON_USER_UPDATE !== 'false',
    invalidateOnProposalCreate: process.env.INVALIDATE_ON_PROPOSAL_CREATE !== 'false',
    invalidateOnBookingUpdate: process.env.INVALIDATE_ON_BOOKING_UPDATE !== 'false',
    batchInvalidationDelay: parseInt(process.env.BATCH_INVALIDATION_DELAY || '1000'), // 1 second
  };
};

/**
 * Performance thresholds for cache monitoring
 */
export interface CachePerformanceThresholds {
  minHitRate: number; // Minimum acceptable hit rate (percentage)
  maxResponseTime: number; // Maximum acceptable response time (ms)
  maxMemoryUsage: number; // Maximum memory usage (MB)
  alertThreshold: number; // Threshold for performance alerts (percentage)
}

export const getCachePerformanceThresholds = (): CachePerformanceThresholds => {
  return {
    minHitRate: parseFloat(process.env.MIN_CACHE_HIT_RATE || '70'), // 70%
    maxResponseTime: parseInt(process.env.MAX_CACHE_RESPONSE_TIME || '50'), // 50ms
    maxMemoryUsage: parseInt(process.env.MAX_CACHE_MEMORY_MB || '1024'), // 1GB
    alertThreshold: parseFloat(process.env.CACHE_ALERT_THRESHOLD || '80'), // 80%
  };
};