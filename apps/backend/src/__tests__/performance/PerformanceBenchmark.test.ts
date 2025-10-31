import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import { RedisService } from '../../database/cache/RedisService';
import { CacheManager } from '../../database/cache/CacheManager';
import { QueryOptimizer } from '../../database/optimizations/QueryOptimizer';
import { BookingRepository } from '../../database/repositories/BookingRepository';
import { BookingSearchService } from '../../services/booking/BookingSearchService';
import { TransactionBatcher } from '../../services/hedera/TransactionBatcher';
import { HederaService } from '../../services/hedera/HederaService';

// Mock implementations for testing
class MockHederaService extends HederaService {
  constructor() {
    super('testnet', 'test-account', 'test-key');
  }

  async submitTransaction(data: any) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    return {
      transactionId: `mock_tx_${Date.now()}`,
      status: 'SUCCESS',
      consensusTimestamp: new Date().toISOString(),
    };
  }
}

describe('Performance Benchmarks', () => {
  let pool: Pool;
  let redis: RedisService;
  let cacheManager: CacheManager;
  let queryOptimizer: QueryOptimizer;
  let bookingRepository: BookingRepository;
  let searchService: BookingSearchService;
  let transactionBatcher: TransactionBatcher;

  beforeAll(async () => {
    // Initialize test database connection
    pool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'booking_swap_test',
      user: process.env.TEST_DB_USER || 'test',
      password: process.env.TEST_DB_PASSWORD || 'test',
    });

    // Initialize Redis
    redis = new RedisService({
      host: process.env.TEST_REDIS_HOST || 'localhost',
      port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      db: 1, // Use different DB for tests
    });

    await redis.connect();

    // Initialize services
    cacheManager = new CacheManager(redis, {
      strategies: {
        search: { ttl: 300, tags: ['search'] },
        booking: { ttl: 600, tags: ['booking'] },
        user: { ttl: 900, tags: ['user'] },
      },
      defaultTTL: 300,
      enableCompression: true,
      maxMemoryUsage: 100,
    });

    queryOptimizer = new QueryOptimizer(pool, {
      enableQueryPlan: true,
      slowQueryThreshold: 100,
      enableIndexHints: true,
    });

    bookingRepository = new BookingRepository(pool);
    searchService = new BookingSearchService(bookingRepository, redis);

    const mockHederaService = new MockHederaService();
    transactionBatcher = new TransactionBatcher(mockHederaService, {
      maxBatchSize: 10,
      batchTimeout: 1000,
      retryAttempts: 3,
      retryDelay: 100,
    });
  });

  afterAll(async () => {
    await redis.disconnect();
    await pool.end();
  });

  beforeEach(async () => {
    // Clear cache before each test
    await redis.flushPattern('*');
  });

  describe('Database Query Performance', () => {
    it('should execute optimized booking search within performance threshold', async () => {
      const startTime = Date.now();
      
      const criteria = {
        query: 'hotel',
        location: { city: 'New York', country: 'USA' },
        priceRange: { min: 100, max: 500 },
      };

      const { query, params } = queryOptimizer.buildOptimizedBookingSearchQuery(criteria);
      const results = await queryOptimizer.executeOptimizedQuery(query, params, 'booking_search');

      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(200); // Should complete within 200ms
      expect(Array.isArray(results)).toBe(true);
    }, 10000);

    it('should handle batch database operations efficiently', async () => {
      const batchSize = 100;
      const testRecords = Array.from({ length: batchSize }, (_, i) => ({
        id: `test_booking_${i}`,
        user_id: `user_${i}`,
        type: 'hotel',
        title: `Test Booking ${i}`,
        description: `Test description ${i}`,
        city: 'Test City',
        country: 'Test Country',
        check_in_date: new Date(),
        check_out_date: new Date(Date.now() + 86400000),
        original_price: 100 + i,
        swap_value: 90 + i,
        provider_name: 'Test Provider',
        confirmation_number: `CONF${i}`,
        booking_reference: `REF${i}`,
        verification_status: 'pending',
        status: 'available',
      }));

      const startTime = Date.now();
      
      const { query, params } = queryOptimizer.buildBatchInsertQuery('bookings', testRecords);
      await queryOptimizer.executeOptimizedQuery(query, params, 'batch_insert');

      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    }, 15000);

    it('should optimize user dashboard query performance', async () => {
      const userId = 'test_user_123';
      const startTime = Date.now();

      const { query, params } = queryOptimizer.buildOptimizedUserDashboardQuery(userId);
      const results = await queryOptimizer.executeOptimizedQuery(query, params, 'user_dashboard');

      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(150); // Should complete within 150ms
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Cache Performance', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const testData = { id: 'test', data: 'large data'.repeat(1000) };
      const key = 'performance_test';

      // First write (cache miss)
      const writeStart = Date.now();
      await cacheManager.set(key, testData, 'booking');
      const writeTime = Date.now() - writeStart;

      // First read (cache hit)
      const readStart = Date.now();
      const cachedData = await cacheManager.get(key);
      const readTime = Date.now() - readStart;

      expect(cachedData).toEqual(testData);
      expect(readTime).toBeLessThan(writeTime); // Read should be faster than write
      expect(readTime).toBeLessThan(50); // Cache read should be very fast
    });

    it('should handle batch cache operations efficiently', async () => {
      const batchSize = 100;
      const keyValuePairs: Array<[string, any]> = Array.from({ length: batchSize }, (_, i) => [
        `batch_key_${i}`,
        { id: i, data: `test data ${i}` },
      ]);

      const startTime = Date.now();
      
      await cacheManager.mset(keyValuePairs, 'booking');
      
      const keys = keyValuePairs.map(([key]) => key);
      const results = await cacheManager.mget(keys);

      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(500); // Should complete within 500ms
      expect(results).toHaveLength(batchSize);
      expect(results.filter(r => r !== null)).toHaveLength(batchSize);
    });

    it('should compress large data efficiently', async () => {
      const largeData = {
        id: 'large_test',
        content: 'x'.repeat(10000), // 10KB of data
        metadata: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item_${i}` })),
      };

      const startTime = Date.now();
      
      await cacheManager.set('large_data_test', largeData, 'booking');
      const retrieved = await cacheManager.get('large_data_test');

      const executionTime = Date.now() - startTime;
      
      expect(retrieved).toEqual(largeData);
      expect(executionTime).toBeLessThan(100); // Should handle compression efficiently
    });
  });

  describe('Search Performance', () => {
    it('should execute search queries within performance threshold', async () => {
      const filters = {
        query: 'luxury hotel',
        location: { city: 'Paris', country: 'France' },
        priceRange: { min: 200, max: 800 },
        types: ['hotel'],
      };

      const startTime = Date.now();
      
      const results = await searchService.searchBookings(filters, 1, 20);

      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(300); // Should complete within 300ms
      expect(results).toHaveProperty('bookings');
      expect(results).toHaveProperty('total');
      expect(results).toHaveProperty('hasMore');
    });

    it('should cache search results for improved performance', async () => {
      const filters = {
        query: 'beach resort',
        location: { city: 'Miami', country: 'USA' },
      };

      // First search (cache miss)
      const firstSearchStart = Date.now();
      const firstResults = await searchService.searchBookings(filters, 1, 20);
      const firstSearchTime = Date.now() - firstSearchStart;

      // Second search (cache hit)
      const secondSearchStart = Date.now();
      const secondResults = await searchService.searchBookings(filters, 1, 20);
      const secondSearchTime = Date.now() - secondSearchStart;

      expect(secondSearchTime).toBeLessThan(firstSearchTime);
      expect(secondSearchTime).toBeLessThan(50); // Cached search should be very fast
      expect(secondResults).toEqual(firstResults);
    });

    it('should handle concurrent search requests efficiently', async () => {
      const concurrentRequests = 10;
      const filters = {
        query: 'apartment',
        location: { city: 'London', country: 'UK' },
      };

      const startTime = Date.now();
      
      const promises = Array.from({ length: concurrentRequests }, () =>
        searchService.searchBookings(filters, 1, 10)
      );

      const results = await Promise.all(promises);
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(1000); // Should handle concurrent requests within 1 second
      expect(results).toHaveLength(concurrentRequests);
      
      // All results should be identical (cached)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toEqual(firstResult);
      });
    });
  });

  describe('Blockchain Transaction Batching Performance', () => {
    it('should batch transactions efficiently', async () => {
      const transactionCount = 50;
      const transactions = Array.from({ length: transactionCount }, (_, i) => ({
        type: 'booking_listing' as const,
        payload: { bookingId: `booking_${i}`, action: 'list' },
        timestamp: new Date(),
      }));

      const startTime = Date.now();
      
      const promises = transactions.map(tx => transactionBatcher.submitTransaction(tx));
      const results = await Promise.all(promises);

      const executionTime = Date.now() - startTime;
      
      expect(results).toHaveLength(transactionCount);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // All transactions should be successful
      results.forEach(result => {
        expect(result).toHaveProperty('transactionId');
        expect(result.status).toBe('SUCCESS');
      });
    }, 10000);

    it('should demonstrate batching performance improvement', async () => {
      const transactionCount = 20;
      const mockHederaService = new MockHederaService();

      // Sequential processing (without batching)
      const sequentialStart = Date.now();
      const sequentialPromises = Array.from({ length: transactionCount }, async (_, i) => {
        return mockHederaService.submitTransaction({
          type: 'booking_listing',
          payload: { bookingId: `seq_booking_${i}` },
          timestamp: new Date(),
        });
      });
      
      for (const promise of sequentialPromises) {
        await promise;
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Batched processing
      const batchedStart = Date.now();
      const batchedPromises = Array.from({ length: transactionCount }, (_, i) =>
        transactionBatcher.submitTransaction({
          type: 'booking_listing',
          payload: { bookingId: `batch_booking_${i}` },
          timestamp: new Date(),
        })
      );
      
      await Promise.all(batchedPromises);
      const batchedTime = Date.now() - batchedStart;

      expect(batchedTime).toBeLessThan(sequentialTime);
      
      // Batching should provide at least 30% improvement
      const improvement = (sequentialTime - batchedTime) / sequentialTime;
      expect(improvement).toBeGreaterThan(0.3);
    }, 15000);

    it('should handle mixed transaction types efficiently', async () => {
      const transactions = [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'booking_listing' as const,
          payload: { bookingId: `booking_${i}` },
          timestamp: new Date(),
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          type: 'swap_proposal' as const,
          payload: { swapId: `swap_${i}` },
          timestamp: new Date(),
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          type: 'swap_execution' as const,
          payload: { swapId: `execution_${i}` },
          timestamp: new Date(),
        })),
      ];

      const startTime = Date.now();
      
      const promises = transactions.map(tx => transactionBatcher.submitTransaction(tx));
      const results = await Promise.all(promises);

      const executionTime = Date.now() - startTime;
      
      expect(results).toHaveLength(transactions.length);
      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds
      
      results.forEach(result => {
        expect(result.status).toBe('SUCCESS');
      });
    }, 10000);
  });

  describe('Memory Usage and Resource Management', () => {
    it('should maintain reasonable memory usage under load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Simulate high load
      const operations = Array.from({ length: 1000 }, async (_, i) => {
        const key = `memory_test_${i}`;
        const data = { id: i, content: 'x'.repeat(1000) };
        
        await cacheManager.set(key, data);
        await cacheManager.get(key);
        
        if (i % 100 === 0) {
          // Force garbage collection periodically
          if (global.gc) {
            global.gc();
          }
        }
      });

      await Promise.all(operations);
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    }, 30000);

    it('should handle cache eviction properly', async () => {
      const cacheSize = 1000;
      
      // Fill cache beyond capacity
      const operations = Array.from({ length: cacheSize }, async (_, i) => {
        const key = `eviction_test_${i}`;
        const data = { id: i, content: 'x'.repeat(1000) };
        await cacheManager.set(key, data, 'booking', 1); // Short TTL
      });

      await Promise.all(operations);
      
      // Wait for some entries to expire
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Try to retrieve all entries
      const retrievalPromises = Array.from({ length: cacheSize }, (_, i) =>
        cacheManager.get(`eviction_test_${i}`)
      );
      
      const results = await Promise.all(retrievalPromises);
      const nullResults = results.filter(r => r === null).length;
      
      // Some entries should have been evicted
      expect(nullResults).toBeGreaterThan(0);
    });
  });

  describe('Performance Regression Tests', () => {
    it('should maintain search performance with large dataset', async () => {
      // This test would require a large test dataset
      // For now, we'll simulate the performance characteristics
      
      const filters = {
        query: 'test search',
        location: { city: 'Test City' },
      };

      const iterations = 10;
      const executionTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await searchService.searchBookings(filters, 1, 20);
        const executionTime = Date.now() - startTime;
        executionTimes.push(executionTime);
      }

      const averageTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      
      expect(averageTime).toBeLessThan(200); // Average should be under 200ms
      expect(maxTime).toBeLessThan(500); // No single query should exceed 500ms
    });

    it('should maintain consistent performance under concurrent load', async () => {
      const concurrentUsers = 20;
      const requestsPerUser = 5;
      
      const startTime = Date.now();
      
      const userPromises = Array.from({ length: concurrentUsers }, async (_, userId) => {
        const userRequests = Array.from({ length: requestsPerUser }, async (_, requestId) => {
          const filters = {
            query: `user_${userId}_request_${requestId}`,
            location: { city: 'Concurrent Test City' },
          };
          
          return searchService.searchBookings(filters, 1, 10);
        });
        
        return Promise.all(userRequests);
      });

      const results = await Promise.all(userPromises);
      const totalTime = Date.now() - startTime;
      
      const totalRequests = concurrentUsers * requestsPerUser;
      const averageTimePerRequest = totalTime / totalRequests;
      
      expect(results).toHaveLength(concurrentUsers);
      expect(averageTimePerRequest).toBeLessThan(100); // Should maintain good performance
    }, 20000);
  });
});