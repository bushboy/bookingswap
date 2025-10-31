import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PasswordResetQueryOptimizer } from '../database/optimizations/PasswordResetQueryOptimizer';
import { RateLimitCacheService } from '../services/cache/RateLimitCacheService';
import { EmailTemplateCache } from '../services/email/EmailTemplateCache';
import { PasswordRecoveryPerformanceMonitor } from '../services/monitoring/PasswordRecoveryPerformanceMonitor';

// Mock dependencies
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Password Recovery Performance Optimizations', () => {
  let mockPool: Pool;
  let queryOptimizer: PasswordResetQueryOptimizer;
  let rateLimitCache: RateLimitCacheService;
  let emailTemplateCache: EmailTemplateCache;
  let performanceMonitor: PasswordRecoveryPerformanceMonitor;

  beforeEach(() => {
    // Mock database pool
    mockPool = {
      query: vi.fn(),
    } as any;

    queryOptimizer = new PasswordResetQueryOptimizer(mockPool);
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
    performanceMonitor = PasswordRecoveryPerformanceMonitor.getInstance();
    performanceMonitor.resetMetrics();
  });

  afterEach(() => {
    vi.clearAllMocks();
    rateLimitCache.destroy();
  });

  describe('Database Query Optimization', () => {
    it('should use optimized query for finding valid tokens', async () => {
      const mockResult = {
        id: 'token-1',
        user_id: 'user-1',
        token: 'test-token',
        expires_at: new Date(Date.now() + 3600000),
        used_at: null,
        created_at: new Date(),
      };

      (mockPool.query as any).mockResolvedValue({ rows: [mockResult] });

      const result = await queryOptimizer.findValidTokenOptimized('test-token');

      expect(result).toBeDefined();
      expect(result?.token).toBe('test-token');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, user_id, token, expires_at, used_at, created_at'),
        ['test-token']
      );
    });

    it('should use batch processing for token cleanup', async () => {
      // Mock the query to return an array of results (simulating deleted rows)
      const mockResults = Array.from({ length: 100 }, (_, i) => ({ id: `token-${i}` }));
      (mockPool.query as any).mockResolvedValue({ rows: mockResults });

      const deletedCount = await queryOptimizer.cleanupExpiredTokensOptimized(1, 100);

      expect(deletedCount).toBeGreaterThanOrEqual(0);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should provide optimized token statistics', async () => {
      const mockStats = {
        total: '150',
        active: '10',
        expired: '5',
        used: '135',
        avg_token_lifetime_seconds: '1800',
      };

      (mockPool.query as any).mockResolvedValue({ rows: [mockStats] });

      const stats = await queryOptimizer.getTokenStatisticsOptimized();

      expect(stats).toEqual({
        total: 150,
        active: 10,
        expired: 5,
        used: 135,
        avgTokenLifetime: 1800,
      });
    });
  });

  describe('Rate Limit Caching', () => {
    it('should handle rate limit checks efficiently', async () => {
      const startTime = Date.now();

      // First check should create new entry
      const result1 = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(result1.exceeded).toBe(false);
      expect(result1.count).toBe(0);

      // Increment counter
      await rateLimitCache.incrementCounter('test@example.com', 'email');

      // Second check should show incremented count
      const result2 = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(result2.count).toBeGreaterThan(0);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should provide cache statistics', async () => {
      await rateLimitCache.incrementCounter('test@example.com', 'email');
      await rateLimitCache.incrementCounter('192.168.1.1', 'ip');

      const stats = await rateLimitCache.getRateLimitStats();

      expect(stats.memoryCacheSize).toBeGreaterThan(0);
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.activeWindows).toBeGreaterThan(0);
    });

    it('should reset rate limits correctly', async () => {
      await rateLimitCache.incrementCounter('test@example.com', 'email');
      
      const beforeReset = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(beforeReset.count).toBeGreaterThan(0);

      await rateLimitCache.resetRateLimit('test@example.com', 'email');
      
      const afterReset = await rateLimitCache.isRateLimitExceeded('test@example.com', 'email');
      expect(afterReset.count).toBe(0);
    });
  });

  describe('Email Template Caching', () => {
    it('should cache and render password reset templates efficiently', async () => {
      const startTime = Date.now();

      const template = await emailTemplateCache.getPasswordResetTemplate({
        userName: 'John Doe',
        resetUrl: 'https://example.com/reset?token=abc123',
        expiresAt: new Date(Date.now() + 3600000),
      });

      const duration = Date.now() - startTime;

      expect(template).toBeDefined();
      expect(template.html).toContain('John Doe');
      expect(template.html).toContain('https://example.com/reset?token=abc123');
      expect(template.text).toContain('John Doe');
      expect(template.subject).toContain('Reset Your Password');
      expect(duration).toBeLessThan(100); // Should be fast
    });

    it('should cache and render confirmation templates efficiently', async () => {
      const startTime = Date.now();

      const template = await emailTemplateCache.getPasswordResetConfirmationTemplate({
        userName: 'Jane Doe',
        resetTime: new Date(),
      });

      const duration = Date.now() - startTime;

      expect(template).toBeDefined();
      expect(template.html).toContain('Jane Doe');
      expect(template.text).toContain('Jane Doe');
      expect(template.subject).toContain('Password Reset Confirmation');
      expect(duration).toBeLessThan(100); // Should be fast
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

    it('should precompile templates successfully', async () => {
      await expect(emailTemplateCache.precompileTemplates()).resolves.not.toThrow();
      
      const stats = emailTemplateCache.getCacheStats();
      expect(stats.memoryCacheSize).toBeGreaterThan(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track general performance metrics', () => {
      performanceMonitor.logPerformanceMetric({
        operation: 'password_reset_request',
        duration: 150,
        success: true,
        cacheHit: true,
        optimizationUsed: 'query_optimization',
      });

      const stats = performanceMonitor.getPerformanceStats();
      expect(stats.general.totalOperations).toBe(1);
      expect(stats.general.successRate).toBe(100);
      expect(stats.general.avgDuration).toBe(150);
      expect(stats.general.cacheHitRate).toBe(100);
    });

    it('should track database performance metrics', () => {
      performanceMonitor.logDatabasePerformance({
        queryName: 'findValidToken',
        duration: 25,
        rowsAffected: 1,
        indexesUsed: ['idx_password_reset_tokens_token_valid'],
        optimizationApplied: true,
      });

      const stats = performanceMonitor.getPerformanceStats();
      expect(stats.database.totalQueries).toBe(1);
      expect(stats.database.avgDuration).toBe(25);
      expect(stats.database.optimizationRate).toBe(100);
      expect(stats.database.slowQueries).toBe(0);
    });

    it('should track cache performance metrics', () => {
      performanceMonitor.logCachePerformance({
        operation: 'rate_limit_check',
        cacheType: 'memory',
        hit: true,
        duration: 5,
        keySize: 20,
        valueSize: 100,
      });

      const stats = performanceMonitor.getPerformanceStats();
      expect(stats.cache.totalOperations).toBe(1);
      expect(stats.cache.hitRate).toBe(100);
      expect(stats.cache.avgDuration).toBe(5);
    });

    it('should track email performance metrics', () => {
      performanceMonitor.logEmailPerformance({
        templateType: 'password_reset',
        renderDuration: 10,
        sendDuration: 500,
        templateCached: true,
        compressionUsed: true,
        templateSize: 2048,
      });

      const stats = performanceMonitor.getPerformanceStats();
      expect(stats.email.totalEmails).toBe(1);
      expect(stats.email.avgRenderDuration).toBe(10);
      expect(stats.email.avgSendDuration).toBe(500);
      expect(stats.email.templateCacheRate).toBe(100);
      expect(stats.email.compressionRate).toBe(100);
    });

    it('should generate performance report', () => {
      // Add some sample metrics
      performanceMonitor.logPerformanceMetric({
        operation: 'password_reset_request',
        duration: 150,
        success: true,
        cacheHit: true,
      });

      performanceMonitor.logDatabasePerformance({
        queryName: 'findValidToken',
        duration: 25,
        rowsAffected: 1,
        indexesUsed: ['idx_password_reset_tokens_token_valid'],
        optimizationApplied: true,
      });

      const report = performanceMonitor.generatePerformanceReport();
      
      expect(report).toContain('Password Recovery Performance Report');
      expect(report).toContain('General Performance:');
      expect(report).toContain('Database Performance:');
      expect(report).toContain('Cache Performance:');
      expect(report).toContain('Email Performance:');
      expect(report).toContain('Recommendations:');
    });
  });

  describe('Integration Performance Tests', () => {
    it('should handle concurrent rate limit checks efficiently', async () => {
      const startTime = Date.now();
      const concurrentChecks = 50;

      const promises = Array.from({ length: concurrentChecks }, (_, i) =>
        rateLimitCache.isRateLimitExceeded(`test${i}@example.com`, 'email')
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentChecks);
      expect(results.every(r => !r.exceeded)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent template rendering efficiently', async () => {
      const startTime = Date.now();
      const concurrentRenders = 20;

      const promises = Array.from({ length: concurrentRenders }, (_, i) =>
        emailTemplateCache.getPasswordResetTemplate({
          userName: `User ${i}`,
          resetUrl: `https://example.com/reset?token=token${i}`,
          expiresAt: new Date(Date.now() + 3600000),
        })
      );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(concurrentRenders);
      expect(results.every(r => r.html && r.text && r.subject)).toBe(true);
      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});