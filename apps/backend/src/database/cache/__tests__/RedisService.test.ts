import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RedisService } from '../RedisService';

// Mock ioredis
const mockRedisInstance = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  mget: vi.fn(),
  pipeline: vi.fn().mockReturnValue({
    set: vi.fn(),
    setex: vi.fn(),
    exec: vi.fn(),
  }),
  incrby: vi.fn(),
  decrby: vi.fn(),
  sadd: vi.fn(),
  srem: vi.fn(),
  smembers: vi.fn(),
  sismember: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn(),
  on: vi.fn(),
};

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => mockRedisInstance),
  };
});

describe('RedisService', () => {
  let redisService: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    redisService = new RedisService({
      host: 'localhost',
      port: 6379,
      keyPrefix: 'test:',
      ttl: 3600,
    });

    // Replace the internal client with our mock
    (redisService as any).client = mockRedisInstance;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect and disconnect', () => {
    it('should connect to Redis', async () => {
      mockRedisInstance.connect.mockResolvedValue(undefined);

      await redisService.connect();

      expect(mockRedisInstance.connect).toHaveBeenCalled();
    });

    it('should disconnect from Redis', async () => {
      mockRedisInstance.disconnect.mockResolvedValue(undefined);

      await redisService.disconnect();

      expect(mockRedisInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('get and set operations', () => {
    it('should get value from cache', async () => {
      const testData = { id: '123', name: 'Test' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(testData));

      const result = await redisService.get('test-key');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null when key does not exist', async () => {
      mockRedisInstance.get.mockResolvedValue(null);

      const result = await redisService.get('non-existent-key');

      expect(result).toBeNull();
    });

    it('should set value with TTL', async () => {
      const testData = { id: '123', name: 'Test' };
      mockRedisInstance.setex.mockResolvedValue('OK');

      const result = await redisService.set('test-key', testData, 1800);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        1800,
        JSON.stringify(testData)
      );
      expect(result).toBe(true);
    });

    it('should set value without TTL', async () => {
      const testData = { id: '123', name: 'Test' };
      mockRedisInstance.setex.mockResolvedValue('OK');

      const result = await redisService.set('test-key', testData);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'test-key',
        3600,
        JSON.stringify(testData)
      );
      expect(result).toBe(true);
    });
  });

  describe('delete and exists operations', () => {
    it('should delete key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      const result = await redisService.del('test-key');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent key', async () => {
      mockRedisInstance.del.mockResolvedValue(0);

      const result = await redisService.del('non-existent-key');

      expect(result).toBe(false);
    });

    it('should check if key exists', async () => {
      mockRedisInstance.exists.mockResolvedValue(1);

      const result = await redisService.exists('test-key');

      expect(mockRedisInstance.exists).toHaveBeenCalledWith('test-key');
      expect(result).toBe(true);
    });

    it('should return false when key does not exist', async () => {
      mockRedisInstance.exists.mockResolvedValue(0);

      const result = await redisService.exists('non-existent-key');

      expect(result).toBe(false);
    });
  });

  describe('utility operations', () => {
    it('should ping Redis', async () => {
      mockRedisInstance.ping.mockResolvedValue('PONG');

      const result = await redisService.ping();

      expect(mockRedisInstance.ping).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('cache helper methods', () => {
    it('should generate cache key', () => {
      const key = redisService.generateKey('user', '123', 'profile');

      expect(key).toBe('user:123:profile');
    });

    it('should cache user data', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK');

      const userData = { id: '123', name: 'John' };
      const result = await redisService.cacheUser('123', userData);

      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        'user:123',
        3600,
        JSON.stringify(userData)
      );
      expect(result).toBe(true);
    });

    it('should get cached user data', async () => {
      const userData = { id: '123', name: 'John' };
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(userData));

      const result = await redisService.getCachedUser('123');

      expect(mockRedisInstance.get).toHaveBeenCalledWith('user:123');
      expect(result).toEqual(userData);
    });
  });
});