import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimitCacheService } from '../services/cache/RateLimitCacheService';
import { EmailTemplateCache } from '../services/email/EmailTemplateCache';

// Mock dependencies
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Performance Optimizations - Basic Tests', () => {
  let rateLimitCache: RateLimitCacheService;
  let emailTemplateCache: EmailTemplateCache;

  beforeEach(() => {
    rateLimitCache = new RateLimitCacheService({
      emailLimit: 3,
      ipLimit: 10,
      windowMs: 3600000,
      enableDistributedCache: false,
    });
    
    emailTemplateCache = new EmailTemplateCache({
      enableCaching: true,
      cacheTTL: 3600,
      enablePrecompilation: true,
      enableMinification: true,
    });
  });

  describe('Rate Limit Caching', () => {
    it('should handle basic rate limit operations', async () => {
      // Test initial state
      const initial = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(initial.exceeded).toBe(false);
      expect(initial.count).toBe(0);

      // Test increment
      const increment = await rateLimitCache.incrementCounter('test@example.com', 'email');
      expect(increment.count).toBe(1);
      expect(increment.isNewWindow).toBe(true);

      // Test after increment
      const afterIncrement = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(afterIncrement.count).toBe(1);
      expect(afterIncrement.exceeded).toBe(false);
    });

    it('should provide cache statistics', async () => {
      await rateLimitCache.incrementCounter('test@example.com', 'email');
      const stats = await rateLimitCache.getRateLimitStats();
      
      expect(stats).toHaveProperty('memoryCacheSize');
      expect(stats).toHaveProperty('redisConnected');
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('activeWindows');
      expect(typeof stats.memoryCacheSize).toBe('number');
    });
  });

  describe('Email Template Caching', () => {
    it('should render password reset templates', async () => {
      const template = await emailTemplateCache.getPasswordResetTemplate({
        userName: 'John Doe',
        resetUrl: 'https://example.com/reset?token=abc123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(template).toBeDefined();
      expect(template.html).toContain('John Doe');
      expect(template.html).toContain('https://example.com/reset?token=abc123');
      expect(template.text).toContain('John Doe');
      expect(template.subject).toContain('Reset Your Password');
    });

    it('should render confirmation templates', async () => {
      const template = await emailTemplateCache.getPasswordResetConfirmationTemplate({
        userName: 'Jane Doe',
        resetTime: new Date(),
      });

      expect(template).toBeDefined();
      expect(template.html).toContain('Jane Doe');
      expect(template.text).toContain('Jane Doe');
      expect(template.subject).toContain('Password Reset Confirmation');
    });

    it('should provide cache statistics', () => {
      const stats = emailTemplateCache.getCacheStats();
      
      expect(stats).toHaveProperty('memoryCacheSize');
      expect(stats).toHaveProperty('compiledTemplatesSize');
      expect(stats).toHaveProperty('redisConnected');
      expect(typeof stats.memoryCacheSize).toBe('number');
      expect(typeof stats.compiledTemplatesSize).toBe('number');
      expect(typeof stats.redisConnected).toBe('boolean');
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle multiple rate limit checks efficiently', async () => {
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(rateLimitCache.isRateLimitExceeded(`test${i}@example.com`, 'email'));
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(10);
      expect(results.every(r => !r.exceeded)).toBe(true);
      expect(duration).toBeLessThan(100); // Should be very fast
    });

    it('should handle multiple template renders efficiently', async () => {
      const startTime = Date.now();
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(emailTemplateCache.getPasswordResetTemplate({
          userName: `User ${i}`,
          resetUrl: `https://example.com/reset?token=token${i}`,
          expiresAt: new Date(Date.now() + 3600000),
        }));
      }
      
      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      expect(results.every(r => r.html && r.text && r.subject)).toBe(true);
      expect(duration).toBeLessThan(200); // Should be reasonably fast
    });
  });
});