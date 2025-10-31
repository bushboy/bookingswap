import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import {
  passwordResetRateLimit,
  passwordResetCompletionRateLimit,
  tokenValidationRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  setRedisClient,
} from '../rateLimiting';

// Mock Redis
vi.mock('ioredis');
const MockedRedis = Redis as unknown as Mock;

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rate Limiting Middleware', () => {
  let mockRedis: {
    pipeline: Mock;
    incr: Mock;
    expire: Mock;
    ttl: Mock;
    decr: Mock;
    del: Mock;
    get: Mock;
    on: Mock;
  };
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let mockPipeline: {
    incr: Mock;
    expire: Mock;
    ttl: Mock;
    exec: Mock;
  };

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock pipeline
    mockPipeline = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      ttl: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 1], // incr result
        [null, 'OK'], // expire result
        [null, 3600], // ttl result
      ]),
    };

    // Mock Redis instance
    mockRedis = {
      pipeline: vi.fn().mockReturnValue(mockPipeline),
      incr: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue('OK'),
      ttl: vi.fn().mockResolvedValue(3600),
      decr: vi.fn().mockResolvedValue(0),
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue('1'),
      on: vi.fn(),
    };

    MockedRedis.mockImplementation(() => mockRedis);

    // Set the mocked Redis client for testing
    setRedisClient(mockRedis as any);

    // Mock request, response, and next
    req = {
      ip: '127.0.0.1',
      body: {},
      connection: { remoteAddress: '127.0.0.1' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    next = vi.fn();
  });

  afterEach(() => {
    // Reset Redis client
    setRedisClient(null);
    vi.resetModules();
  });

  describe('Password Reset Request Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Mock Redis to return low count
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result - first attempt
        [null, 'OK'], // expire result
        [null, 3600], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('1');

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': expect.any(String),
        })
      );
    });

    it('should block requests when IP rate limit exceeded', async () => {
      // Mock Redis to return high count for IP
      mockPipeline.exec.mockResolvedValue([
        [null, 6], // incr result - exceeds limit of 5
        [null, 'OK'], // expire result
        [null, 1800], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('6');

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.stringContaining('password reset request'),
          category: 'rate_limit',
          retryAfter: expect.any(Number),
        },
      });
    });

    it('should block requests when email rate limit exceeded', async () => {
      // Mock Redis to return acceptable IP count but high email count
      let callCount = 0;
      mockPipeline.exec.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // IP check - within limit
          return Promise.resolve([
            [null, 2], // incr result
            [null, 'OK'], // expire result
            [null, 3600], // ttl result
          ]);
        } else {
          // Email check - exceeds limit
          return Promise.resolve([
            [null, 4], // incr result - exceeds email limit of 3
            [null, 'OK'], // expire result
            [null, 3600], // ttl result
          ]);
        }
      });

      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip:')) return Promise.resolve('2');
        if (key.includes('email:')) return Promise.resolve('4');
        return Promise.resolve('0');
      });

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock Redis to throw error
      mockPipeline.exec.mockRejectedValue(new Error('Redis connection failed'));

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      // Should fail open and allow the request
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should implement exponential backoff', async () => {
      // Mock high attempt count for exponential backoff calculation
      mockPipeline.exec.mockResolvedValue([
        [null, 6], // incr result - exceeds limit
        [null, 'OK'], // expire result
        [null, 1800], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('3'); // 3rd attempt for backoff calculation

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: expect.any(String),
          category: 'rate_limit',
          retryAfter: expect.any(Number),
        },
      });

      // Verify retry-after header is set with exponential backoff value
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Retry-After': expect.any(String),
        })
      );
    });
  });

  describe('Password Reset Completion Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, 'OK'], // expire result
        [null, 900], // ttl result (15 minutes)
      ]);
      mockRedis.get.mockResolvedValue('1');

      await passwordResetCompletionRateLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests when rate limit exceeded', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 6], // incr result - exceeds limit of 5
        [null, 'OK'], // expire result
        [null, 900], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('6');

      await passwordResetCompletionRateLimit(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Token Validation Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, 'OK'], // expire result
        [null, 900], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('1');

      await tokenValidationRateLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests when rate limit exceeded', async () => {
      mockPipeline.exec.mockResolvedValue([
        [null, 11], // incr result - exceeds limit of 10
        [null, 'OK'], // expire result
        [null, 900], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('11');

      await tokenValidationRateLimit(req as Request, res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Utility Functions', () => {
    it('should reset rate limit for a key', async () => {
      await resetRateLimit('test-key', 'passwordResetRequest');

      expect(mockRedis.del).toHaveBeenCalledWith('passwordResetRequest:test-key');
    });

    it('should get rate limit status', async () => {
      mockRedis.get.mockResolvedValue('3');

      const status = await getRateLimitStatus('test-key', 'passwordResetRequest');

      expect(status).toEqual({
        count: 3,
        remaining: 2, // 5 - 3 = 2
      });
      expect(mockRedis.get).toHaveBeenCalledWith('passwordResetRequest:test-key');
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing IP address', async () => {
      req.ip = undefined;
      req.connection = {};

      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, 'OK'], // expire result
        [null, 3600], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('1');

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle missing email in request body', async () => {
      req.body = {}; // No email

      mockPipeline.exec.mockResolvedValue([
        [null, 1], // incr result
        [null, 'OK'], // expire result
        [null, 3600], // ttl result
      ]);
      mockRedis.get.mockResolvedValue('1');

      await passwordResetRateLimit(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });

    it('should handle Redis pipeline errors', async () => {
      mockPipeline.exec.mockResolvedValue([
        [new Error('Redis error'), null], // Error in pipeline
        [null, 'OK'],
        [null, 3600],
      ]);

      req.body = { email: 'test@example.com' };

      await passwordResetRateLimit(req as Request, res as Response, next);

      // Should fail open
      expect(next).toHaveBeenCalled();
    });
  });
});