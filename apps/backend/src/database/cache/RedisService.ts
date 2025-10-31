import Redis, { RedisOptions } from 'ioredis';

export interface CacheConfig extends RedisOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number; // Default TTL in seconds
}

export class RedisService {
  private client: Redis;
  private defaultTTL: number;

  constructor(config: CacheConfig) {
    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'booking-swap:',
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      ...config,
    });

    this.defaultTTL = config.ttl || 3600; // 1 hour default

    this.client.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value);
    } catch (error) {
      console.error(`Error getting key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      
      if (expiry > 0) {
        await this.client.setex(key, expiry, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error(`Error deleting key ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`Error checking existence of key ${key}:`, error);
      return false;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttl);
      return result === 1;
    } catch (error) {
      console.error(`Error setting expiry for key ${key}:`, error);
      return false;
    }
  }

  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys);
      return values.map(value => {
        if (value === null) {
          return null;
        }
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error(`Error getting multiple keys:`, error);
      return keys.map(() => null);
    }
  }

  async mset<T>(keyValuePairs: Array<[string, T]>, ttl?: number): Promise<boolean> {
    try {
      const pipeline = this.client.pipeline();
      const expiry = ttl || this.defaultTTL;

      for (const [key, value] of keyValuePairs) {
        const serialized = JSON.stringify(value);
        if (expiry > 0) {
          pipeline.setex(key, expiry, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      }

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error(`Error setting multiple keys:`, error);
      return false;
    }
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (error) {
      console.error(`Error incrementing key ${key}:`, error);
      throw error;
    }
  }

  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      return await this.client.decrby(key, amount);
    } catch (error) {
      console.error(`Error decrementing key ${key}:`, error);
      throw error;
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      console.error(`Error adding to set ${key}:`, error);
      throw error;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      console.error(`Error removing from set ${key}:`, error);
      throw error;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      console.error(`Error getting set members ${key}:`, error);
      return [];
    }
  }

  async sismember(key: string, member: string): Promise<boolean> {
    try {
      const result = await this.client.sismember(key, member);
      return result === 1;
    } catch (error) {
      console.error(`Error checking set membership ${key}:`, error);
      return false;
    }
  }

  async flushPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      return await this.client.del(...keys);
    } catch (error) {
      console.error(`Error flushing pattern ${pattern}:`, error);
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  }

  // Cache-specific helper methods
  generateKey(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`;
  }

  // Common cache patterns
  async cacheUser(userId: string, userData: any, ttl?: number): Promise<boolean> {
    const key = this.generateKey('user', userId);
    return this.set(key, userData, ttl);
  }

  async getCachedUser(userId: string): Promise<any | null> {
    const key = this.generateKey('user', userId);
    return this.get(key);
  }

  async cacheBooking(bookingId: string, bookingData: any, ttl?: number): Promise<boolean> {
    const key = this.generateKey('booking', bookingId);
    return this.set(key, bookingData, ttl);
  }

  async getCachedBooking(bookingId: string): Promise<any | null> {
    const key = this.generateKey('booking', bookingId);
    return this.get(key);
  }

  async cacheSwap(swapId: string, swapData: any, ttl?: number): Promise<boolean> {
    const key = this.generateKey('swap', swapId);
    return this.set(key, swapData, ttl);
  }

  async getCachedSwap(swapId: string): Promise<any | null> {
    const key = this.generateKey('swap', swapId);
    return this.get(key);
  }

  async cacheSearchResults(searchKey: string, results: any[], ttl: number = 300): Promise<boolean> {
    const key = this.generateKey('search', searchKey);
    return this.set(key, results, ttl);
  }

  async getCachedSearchResults(searchKey: string): Promise<any[] | null> {
    const key = this.generateKey('search', searchKey);
    return this.get(key);
  }

  async invalidateUserCache(userId: string): Promise<boolean> {
    const pattern = this.generateKey('user', userId) + '*';
    const deletedCount = await this.flushPattern(pattern);
    return deletedCount > 0;
  }

  async invalidateBookingCache(bookingId: string): Promise<boolean> {
    const pattern = this.generateKey('booking', bookingId) + '*';
    const deletedCount = await this.flushPattern(pattern);
    return deletedCount > 0;
  }

  async invalidateSwapCache(swapId: string): Promise<boolean> {
    const pattern = this.generateKey('swap', swapId) + '*';
    const deletedCount = await this.flushPattern(pattern);
    return deletedCount > 0;
  }
}