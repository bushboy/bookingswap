import { Request, Response, NextFunction } from 'express';
import { PasswordRecoveryMonitor } from '../services/monitoring/PasswordRecoveryMonitor';
import { RateLimitCacheService } from '../services/cache/RateLimitCacheService';
import { RedisService } from '../database/cache/RedisService';
import { logger } from '../utils/logger';

interface RateLimitStore {
  [key: string]: {
    count: number;
    windowStart: Date;
    firstAttempt: Date;
  };
}

export interface RateLimitConfig {
  emailLimit: number;
  ipLimit: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export class PasswordResetRateLimit {
  private emailStore: RateLimitStore = {};
  private ipStore: RateLimitStore = {};
  private monitor: PasswordRecoveryMonitor;
  private config: RateLimitConfig;
  private cacheService: RateLimitCacheService;

  constructor(config: RateLimitConfig, redis?: RedisService) {
    this.config = {
      emailLimit: 3,
      ipLimit: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
    this.monitor = PasswordRecoveryMonitor.getInstance();
    
    // Initialize cache service with Redis if available
    this.cacheService = new RateLimitCacheService({
      emailLimit: this.config.emailLimit,
      ipLimit: this.config.ipLimit,
      windowMs: this.config.windowMs,
      enableDistributedCache: !!redis,
    }, redis);
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Rate limiting middleware - optimized with caching
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      const email = req.body?.email;
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      try {
        // Check email-based rate limit
        if (email && !(await this.checkEmailLimit(email, ip, userAgent))) {
          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many password reset requests for this email address. Please try again later.',
              category: 'rate_limit',
            },
          });
        }

        // Check IP-based rate limit
        if (!(await this.checkIpLimit(ip, userAgent))) {
          return res.status(429).json({
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many password reset requests from this IP address. Please try again later.',
              category: 'rate_limit',
            },
          });
        }

        // Store original end function to track success/failure
        const originalEnd = res.end;
        res.end = (chunk?: any, encoding?: any) => {
          const statusCode = res.statusCode;
          
          // Update counters based on response using optimized cache
          if (!this.config.skipSuccessfulRequests && statusCode < 400) {
            this.incrementCountersOptimized(email, ip);
          } else if (!this.config.skipFailedRequests && statusCode >= 400) {
            this.incrementCountersOptimized(email, ip);
          }

          originalEnd.call(res, chunk, encoding);
        };

        next();
      } catch (error) {
        logger.error('Rate limiting middleware error', {
          error: error.message,
          email,
          ip,
          userAgent,
        });
        next(error);
      }
    };
  }

  /**
   * Check email-based rate limit - optimized with caching
   */
  private async checkEmailLimit(email: string, ip: string, userAgent: string): Promise<boolean> {
    const key = email.toLowerCase();

    try {
      // Use optimized cache service
      const rateLimitStatus = await this.cacheService.isRateLimitExceeded(key, 'email');

      if (rateLimitStatus.exceeded) {
        this.monitor.logRateLimit({
          email,
          ip,
          userAgent,
          limitType: 'email',
          currentCount: rateLimitStatus.count,
          limit: rateLimitStatus.limit,
          windowStart: new Date(Date.now() - this.config.windowMs + rateLimitStatus.timeRemaining),
          windowEnd: new Date(Date.now() + rateLimitStatus.timeRemaining),
        });

        // Log suspicious activity if excessive attempts
        if (rateLimitStatus.count > this.config.emailLimit * 2) {
          this.monitor.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'high',
            email,
            ip,
            userAgent,
            details: {
              reason: 'excessive_password_reset_attempts',
              attemptCount: rateLimitStatus.count,
              limit: this.config.emailLimit,
              timeRemaining: rateLimitStatus.timeRemaining,
            },
          });
        }

        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check email rate limit', { error, email });
      // Fall back to original implementation
      return this.checkEmailLimitFallback(email, ip, userAgent);
    }
  }

  /**
   * Fallback email rate limit check
   */
  private checkEmailLimitFallback(email: string, ip: string, userAgent: string): boolean {
    const now = new Date();
    const key = email.toLowerCase();
    const entry = this.emailStore[key];

    if (!entry) {
      this.emailStore[key] = {
        count: 0,
        windowStart: now,
        firstAttempt: now,
      };
      return true;
    }

    // Reset window if expired
    if (now.getTime() - entry.windowStart.getTime() > this.config.windowMs) {
      this.emailStore[key] = {
        count: 0,
        windowStart: now,
        firstAttempt: now,
      };
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= this.config.emailLimit) {
      return false;
    }

    return true;
  }

  /**
   * Check IP-based rate limit - optimized with caching
   */
  private async checkIpLimit(ip: string, userAgent: string): Promise<boolean> {
    try {
      // Use optimized cache service
      const rateLimitStatus = await this.cacheService.isRateLimitExceeded(ip, 'ip');

      if (rateLimitStatus.exceeded) {
        this.monitor.logRateLimit({
          ip,
          userAgent,
          limitType: 'ip',
          currentCount: rateLimitStatus.count,
          limit: rateLimitStatus.limit,
          windowStart: new Date(Date.now() - this.config.windowMs + rateLimitStatus.timeRemaining),
          windowEnd: new Date(Date.now() + rateLimitStatus.timeRemaining),
        });

        // Log suspicious activity if excessive attempts
        if (rateLimitStatus.count > this.config.ipLimit * 2) {
          this.monitor.logSecurityEvent({
            type: 'suspicious_activity',
            severity: 'high',
            ip,
            userAgent,
            details: {
              reason: 'excessive_password_reset_attempts_from_ip',
              attemptCount: rateLimitStatus.count,
              limit: this.config.ipLimit,
              timeRemaining: rateLimitStatus.timeRemaining,
            },
          });
        }

        return false;
      }

      return true;
    } catch (error) {
      logger.error('Failed to check IP rate limit', { error, ip });
      // Fall back to original implementation
      return this.checkIpLimitFallback(ip, userAgent);
    }
  }

  /**
   * Fallback IP rate limit check
   */
  private checkIpLimitFallback(ip: string, userAgent: string): boolean {
    const now = new Date();
    const entry = this.ipStore[ip];

    if (!entry) {
      this.ipStore[ip] = {
        count: 0,
        windowStart: now,
        firstAttempt: now,
      };
      return true;
    }

    // Reset window if expired
    if (now.getTime() - entry.windowStart.getTime() > this.config.windowMs) {
      this.ipStore[ip] = {
        count: 0,
        windowStart: now,
        firstAttempt: now,
      };
      return true;
    }

    // Check if limit exceeded
    if (entry.count >= this.config.ipLimit) {
      return false;
    }

    return true;
  }

  /**
   * Increment counters for email and IP - optimized version
   */
  private async incrementCountersOptimized(email?: string, ip?: string): Promise<void> {
    try {
      const promises: Promise<any>[] = [];

      if (email) {
        const key = email.toLowerCase();
        promises.push(this.cacheService.incrementCounter(key, 'email'));
      }

      if (ip) {
        promises.push(this.cacheService.incrementCounter(ip, 'ip'));
      }

      await Promise.all(promises);
    } catch (error) {
      logger.error('Failed to increment rate limit counters', { error, email, ip });
      // Fall back to original implementation
      this.incrementCounters(email, ip);
    }
  }

  /**
   * Increment counters for email and IP - fallback version
   */
  private incrementCounters(email?: string, ip?: string): void {
    const now = new Date();

    if (email) {
      const key = email.toLowerCase();
      if (this.emailStore[key]) {
        this.emailStore[key].count++;
      }
    }

    if (ip && this.ipStore[ip]) {
      this.ipStore[ip].count++;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    let cleanedEmail = 0;
    let cleanedIp = 0;

    // Clean email store
    for (const [key, entry] of Object.entries(this.emailStore)) {
      if (now.getTime() - entry.windowStart.getTime() > this.config.windowMs) {
        delete this.emailStore[key];
        cleanedEmail++;
      }
    }

    // Clean IP store
    for (const [key, entry] of Object.entries(this.ipStore)) {
      if (now.getTime() - entry.windowStart.getTime() > this.config.windowMs) {
        delete this.ipStore[key];
        cleanedIp++;
      }
    }

    if (cleanedEmail > 0 || cleanedIp > 0) {
      logger.debug('Rate limit store cleanup completed', {
        cleanedEmailEntries: cleanedEmail,
        cleanedIpEntries: cleanedIp,
        remainingEmailEntries: Object.keys(this.emailStore).length,
        remainingIpEntries: Object.keys(this.ipStore).length,
      });
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    emailEntries: number;
    ipEntries: number;
    config: RateLimitConfig;
  } {
    return {
      emailEntries: Object.keys(this.emailStore).length,
      ipEntries: Object.keys(this.ipStore).length,
      config: this.config,
    };
  }

  /**
   * Reset rate limit for specific email (admin function)
   */
  resetEmailLimit(email: string): void {
    const key = email.toLowerCase();
    delete this.emailStore[key];
    
    logger.info('Email rate limit reset', {
      email: key,
      category: 'password_recovery',
      event: 'rate_limit_reset',
    });
  }

  /**
   * Reset rate limit for specific IP (admin function)
   */
  resetIpLimit(ip: string): void {
    delete this.ipStore[ip];
    
    logger.info('IP rate limit reset', {
      ip,
      category: 'password_recovery',
      event: 'rate_limit_reset',
    });
  }

  /**
   * Get rate limit info for specific email
   */
  getEmailLimitInfo(email: string): {
    count: number;
    limit: number;
    windowStart: Date;
    timeRemaining: number;
  } | null {
    const key = email.toLowerCase();
    const entry = this.emailStore[key];
    
    if (!entry) {
      return null;
    }

    const now = new Date();
    const timeRemaining = Math.max(0, this.config.windowMs - (now.getTime() - entry.windowStart.getTime()));

    return {
      count: entry.count,
      limit: this.config.emailLimit,
      windowStart: entry.windowStart,
      timeRemaining,
    };
  }

  /**
   * Get rate limit info for specific IP
   */
  getIpLimitInfo(ip: string): {
    count: number;
    limit: number;
    windowStart: Date;
    timeRemaining: number;
  } | null {
    const entry = this.ipStore[ip];
    
    if (!entry) {
      return null;
    }

    const now = new Date();
    const timeRemaining = Math.max(0, this.config.windowMs - (now.getTime() - entry.windowStart.getTime()));

    return {
      count: entry.count,
      limit: this.config.ipLimit,
      windowStart: entry.windowStart,
      timeRemaining,
    };
  }
}

// Create default rate limiter instance
export const passwordResetRateLimit = new PasswordResetRateLimit({
  emailLimit: parseInt(process.env.PASSWORD_RESET_EMAIL_LIMIT || '3'),
  ipLimit: parseInt(process.env.PASSWORD_RESET_IP_LIMIT || '10'),
  windowMs: parseInt(process.env.PASSWORD_RESET_WINDOW_MS || '3600000'), // 1 hour
});