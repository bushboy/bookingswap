import { CacheConfig, RedisService } from './RedisService';

export const getCacheConfig = (): CacheConfig => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'booking-swap:',
    ttl: parseInt(process.env.REDIS_DEFAULT_TTL || '3600'),
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
    commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  };
};

// Singleton cache instance
let cacheService: RedisService | null = null;

export const getCacheService = (): RedisService => {
  if (!cacheService) {
    const config = getCacheConfig();
    cacheService = new RedisService(config);
  }
  return cacheService;
};

export const closeCacheService = async (): Promise<void> => {
  if (cacheService) {
    await cacheService.disconnect();
    cacheService = null;
  }
};

export const initializeCache = async (): Promise<RedisService> => {
  const cache = getCacheService();
  await cache.connect();
  
  // Test the connection
  const isConnected = await cache.ping();
  if (!isConnected) {
    throw new Error('Failed to connect to Redis cache');
  }
  
  console.log('Redis cache initialized successfully');
  return cache;
};