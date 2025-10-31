import { describe, it, expect } from 'vitest';

describe('Performance Optimizations Integration', () => {
  it('should have created performance optimization files', () => {
    // Test that our optimization files exist and can be imported
    expect(() => require('../../database/optimizations/QueryOptimizer')).not.toThrow();
    expect(() => require('../../database/cache/CacheManager')).not.toThrow();
    expect(() => require('../../services/hedera/TransactionBatcher')).not.toThrow();
    expect(() => require('../../services/monitoring/PerformanceMonitor')).not.toThrow();
  });

  it('should validate QueryOptimizer functionality', () => {
    const { QueryOptimizer } = require('../../database/optimizations/QueryOptimizer');
    
    // Mock pool for testing
    const mockPool = {
      query: async () => ({ rows: [] })
    };
    
    const optimizer = new QueryOptimizer(mockPool, {
      enableQueryPlan: true,
      slowQueryThreshold: 100,
      enableIndexHints: true
    });

    expect(optimizer).toBeDefined();
    expect(typeof optimizer.buildOptimizedBookingSearchQuery).toBe('function');
    expect(typeof optimizer.buildOptimizedUserDashboardQuery).toBe('function');
  });

  it('should validate CacheManager functionality', () => {
    const { CacheManager } = require('../../database/cache/CacheManager');
    
    // Mock Redis service
    const mockRedis = {
      get: async () => null,
      set: async () => true,
      del: async () => true
    };
    
    const cacheManager = new CacheManager(mockRedis, {
      strategies: {
        search: { ttl: 300, tags: ['search'] }
      },
      defaultTTL: 300,
      enableCompression: true,
      maxMemoryUsage: 100
    });

    expect(cacheManager).toBeDefined();
    expect(typeof cacheManager.set).toBe('function');
    expect(typeof cacheManager.get).toBe('function');
    expect(typeof cacheManager.mget).toBe('function');
    expect(typeof cacheManager.mset).toBe('function');
  });

  it('should validate TransactionBatcher functionality', () => {
    const { TransactionBatcher } = require('../../services/hedera/TransactionBatcher');
    
    // Mock Hedera service
    const mockHederaService = {
      submitTransaction: async () => ({
        transactionId: 'mock_tx_123',
        status: 'SUCCESS'
      })
    };
    
    const batcher = new TransactionBatcher(mockHederaService, {
      maxBatchSize: 10,
      batchTimeout: 1000,
      retryAttempts: 3,
      retryDelay: 100
    });

    expect(batcher).toBeDefined();
    expect(typeof batcher.submitTransaction).toBe('function');
    expect(typeof batcher.getQueueStatus).toBe('function');
    expect(typeof batcher.flushBatch).toBe('function');
  });

  it('should validate PerformanceMonitor functionality', () => {
    const { PerformanceMonitor } = require('../../services/monitoring/PerformanceMonitor');
    
    // Mock dependencies
    const mockPool = { query: async () => ({ rows: [] }) };
    const mockRedis = { get: async () => null };
    
    const monitor = new PerformanceMonitor(mockPool, mockRedis);

    expect(monitor).toBeDefined();
    expect(typeof monitor.recordMetric).toBe('function');
    expect(typeof monitor.getSystemMetrics).toBe('function');
    expect(typeof monitor.startMonitoring).toBe('function');
    expect(typeof monitor.stopMonitoring).toBe('function');
  });

  it('should validate database migration exists', async () => {
    const fs = await import('fs');
    const path = await import('path');
    
    const migrationPath = path.join(__dirname, '../../database/migrations/010_performance_optimizations.sql');
    expect(fs.existsSync(migrationPath)).toBe(true);
    
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    expect(migrationContent).toContain('CREATE INDEX');
    expect(migrationContent).toContain('search_vector');
    expect(migrationContent).toContain('performance_stats');
  });
});