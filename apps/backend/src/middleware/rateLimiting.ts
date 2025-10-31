import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

// Redis client for distributed rate limiting
let redisClient: Redis | null = null;

// Initialize Redis client if available (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(redisUrl, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redisClient.on('error', (err) => {
      logger.warn('Redis connection error for rate limiting:', err);
      redisClient = null; // Fall back to memory store
    });
  } catch (error) {
    logger.warn('Failed to initialize Redis for rate limiting, using memory store:', error);
    redisClient = null;
  }
}

/**
 * Configuration for rate limiting
 */
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  maxEmailRequests?: number;
  exponentialBackoff?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Default configurations for different endpoints
 */
const RATE_LIMIT_CONFIGS = {
  passwordResetRequest: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // per IP
    maxEmailRequests: 3, // per email
    exponentialBackoff: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  passwordResetCompletion: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // per IP
    exponentialBackoff: true,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  tokenValidation: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // per IP
    exponentialBackoff: true,
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
};

/**
 * Custom store for Redis-based rate limiting with exponential backoff
 */
class RedisRateLimitStore {
  private redis: Redis;
  private prefix: string;

  constructor(redis: Redis, prefix = 'rl:') {
    this.redis = redis;
    this.prefix = prefix;
  }

  async increment(key: string, windowMs: number): Promise<{ totalHits: number; timeToExpire: number }> {
    const redisKey = `${this.prefix}${key}`;
    const pipeline = this.redis.pipeline();
    
    pipeline.incr(redisKey);
    pipeline.expire(redisKey, Math.ceil(windowMs / 1000));
    pipeline.ttl(redisKey);
    
    const results = await pipeline.exec();
    
    if (!results || results.some(([err]) => err)) {
      throw new Error('Redis operation failed');
    }
    
    const totalHits = results[0][1] as number;
    const ttl = results[2][1] as number;
    const timeToExpire = ttl > 0 ? ttl * 1000 : windowMs;
    
    return { totalHits, timeToExpire };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    await this.redis.decr(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    const redisKey = `${this.prefix}${key}`;
    await this.redis.del(redisKey);
  }

  async getAttemptCount(key: string): Promise<number> {
    const redisKey = `${this.prefix}${key}`;
    const count = await this.redis.get(redisKey);
    return count ? parseInt(count, 10) : 0;
  }
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attemptCount: number, baseDelayMs = 1000): number {
  const maxDelay = 60 * 60 * 1000; // 1 hour max
  const delay = Math.min(baseDelayMs * Math.pow(2, attemptCount - 1), maxDelay);
  return delay;
}

/**
 * Enhanced rate limiting middleware with exponential backoff
 */
function createEnhancedRateLimit(config: RateLimitConfig, endpointName: string) {
  const store = redisClient ? new RedisRateLimitStore(redisClient, `${endpointName}:`) : undefined;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const email = req.body?.email;
      const now = Date.now();
      
      // Check IP-based rate limiting
      const ipKey = `ip:${ip}`;
      let ipBlocked = false;
      let ipRetryAfter = 0;
      
      if (store) {
        const ipResult = await store.increment(ipKey, config.windowMs);
        const ipAttemptCount = await store.getAttemptCount(ipKey);
        
        if (ipResult.totalHits > config.maxRequests) {
          ipBlocked = true;
          if (config.exponentialBackoff) {
            ipRetryAfter = calculateBackoffDelay(ipAttemptCount);
          } else {
            ipRetryAfter = ipResult.timeToExpire;
          }
        }
      }
      
      // Check email-based rate limiting (if email provided and configured)
      let emailBlocked = false;
      let emailRetryAfter = 0;
      
      if (email && config.maxEmailRequests && store) {
        const emailKey = `email:${email}`;
        const emailResult = await store.increment(emailKey, config.windowMs);
        const emailAttemptCount = await store.getAttemptCount(emailKey);
        
        if (emailResult.totalHits > config.maxEmailRequests) {
          emailBlocked = true;
          if (config.exponentialBackoff) {
            emailRetryAfter = calculateBackoffDelay(emailAttemptCount);
          } else {
            emailRetryAfter = emailResult.timeToExpire;
          }
        }
      }
      
      // If either IP or email is blocked, return rate limit error
      if (ipBlocked || emailBlocked) {
        const retryAfter = Math.max(ipRetryAfter, emailRetryAfter);
        const retryAfterSeconds = Math.ceil(retryAfter / 1000);
        
        // Log security event
        logger.warn('Rate limit exceeded', {
          endpoint: endpointName,
          ip,
          email: email ? '[REDACTED]' : undefined,
          ipBlocked,
          emailBlocked,
          retryAfterSeconds,
        });
        
        res.set({
          'Retry-After': retryAfterSeconds.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(now + retryAfter).toISOString(),
        });
        
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many ${endpointName.replace(/([A-Z])/g, ' $1').toLowerCase()} requests. Please try again later.`,
            category: 'rate_limit',
            retryAfter: retryAfterSeconds,
          },
        });
      }
      
      // Set rate limit headers for successful requests
      const remaining = Math.max(0, config.maxRequests - (store ? await store.getAttemptCount(ipKey) : 0));
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(now + config.windowMs).toISOString(),
      });
      
      next();
    } catch (error) {
      logger.error('Rate limiting error:', error);
      // On error, allow the request to proceed (fail open)
      next();
    }
  };
}

/**
 * Fallback to express-rate-limit if Redis is not available
 */
function createFallbackRateLimit(config: RateLimitConfig, endpointName: string) {
  const limiter = rateLimit({
    windowMs: config.windowMs,
    max: config.maxRequests,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many ${endpointName.replace(/([A-Z])/g, ' $1').toLowerCase()} requests. Please try again later.`,
        category: 'rate_limit',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const email = req.body?.email;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      // For email endpoints, prioritize email-based limiting
      if (email && config.maxEmailRequests) {
        return `email:${email}`;
      }
      return `ip:${ip}`;
    },
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    // Custom handler to ensure consistent headers
    handler: (req: Request, res: Response) => {
      const retryAfter = Math.ceil(config.windowMs / 1000);
      
      res.set({
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
      });
      
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many ${endpointName.replace(/([A-Z])/g, ' $1').toLowerCase()} requests. Please try again later.`,
          category: 'rate_limit',
          retryAfter,
        },
      });
    },
  });

  // Wrap the limiter to ensure headers are always set
  return (req: Request, res: Response, next: NextFunction) => {
    // Set headers before calling the limiter
    const originalSend = res.send;
    const originalJson = res.json;
    
    let headersSent = false;
    
    const setHeaders = () => {
      if (!headersSent) {
        headersSent = true;
        res.set({
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, config.maxRequests - 1).toString(),
          'X-RateLimit-Reset': new Date(Date.now() + config.windowMs).toISOString(),
        });
      }
    };
    
    res.send = function(body) {
      setHeaders();
      return originalSend.call(this, body);
    };
    
    res.json = function(obj) {
      setHeaders();
      return originalJson.call(this, obj);
    };
    
    return limiter(req, res, next);
  };
}

/**
 * Rate limiting middleware for password reset requests
 * Implements per-email and per-IP rate limiting with exponential backoff
 */
export const passwordResetRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const middleware = redisClient
    ? createEnhancedRateLimit(RATE_LIMIT_CONFIGS.passwordResetRequest, 'passwordResetRequest')
    : createFallbackRateLimit(RATE_LIMIT_CONFIGS.passwordResetRequest, 'passwordResetRequest');
  
  if (typeof middleware === 'function') {
    return middleware(req, res, next);
  } else {
    return await middleware(req, res, next);
  }
};

/**
 * Rate limiting middleware for password reset completion
 * More restrictive to prevent brute force attacks
 */
export const passwordResetCompletionRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const middleware = redisClient
    ? createEnhancedRateLimit(RATE_LIMIT_CONFIGS.passwordResetCompletion, 'passwordResetCompletion')
    : createFallbackRateLimit(RATE_LIMIT_CONFIGS.passwordResetCompletion, 'passwordResetCompletion');
  
  if (typeof middleware === 'function') {
    return middleware(req, res, next);
  } else {
    return await middleware(req, res, next);
  }
};

/**
 * Rate limiting middleware for token validation
 * Prevent token enumeration attacks
 */
export const tokenValidationRateLimit = async (req: Request, res: Response, next: NextFunction) => {
  const middleware = redisClient
    ? createEnhancedRateLimit(RATE_LIMIT_CONFIGS.tokenValidation, 'tokenValidation')
    : createFallbackRateLimit(RATE_LIMIT_CONFIGS.tokenValidation, 'tokenValidation');
  
  if (typeof middleware === 'function') {
    return middleware(req, res, next);
  } else {
    return await middleware(req, res, next);
  }
};

/**
 * Utility function to manually reset rate limits (for testing or admin purposes)
 */
export async function resetRateLimit(key: string, endpointName: string): Promise<void> {
  if (redisClient) {
    const store = new RedisRateLimitStore(redisClient, `${endpointName}:`);
    await store.resetKey(key);
  }
}

/**
 * Utility function to get current rate limit status
 */
export async function getRateLimitStatus(key: string, endpointName: string): Promise<{ count: number; remaining: number }> {
  if (redisClient) {
    const store = new RedisRateLimitStore(redisClient, `${endpointName}:`);
    const count = await store.getAttemptCount(key);
    const config = RATE_LIMIT_CONFIGS[endpointName as keyof typeof RATE_LIMIT_CONFIGS];
    const remaining = Math.max(0, config.maxRequests - count);
    return { count, remaining };
  }
  return { count: 0, remaining: 0 };
}

/**
 * Set Redis client for testing purposes
 */
export function setRedisClient(client: Redis | null): void {
  redisClient = client;
}

/**
 * Get current Redis client (for testing)
 */
export function getRedisClient(): Redis | null {
  return redisClient;
}