import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Pool } from 'pg';
import Redis from 'ioredis';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { TargetingCacheManager } from '../database/cache/TargetingCacheManager';
import { TargetingPerformanceService } from '../services/swap/TargetingPerformanceService';
import { Logger } from '../utils/Logger';

// Mock dependencies
jest.mock('pg');
jest.mock('ioredis');
jest.mock('../utils/Logger');

describe('Targeting Performance Optimizations', () => {
    let mockPool: jest.Mocked<Pool>;
    let mockRedis: jest.Mocked<Redis>;
    let mockLogger: jest.Mocked<Logger>;
    let cacheManager: TargetingCacheManager;
    let repository: SwapTargetingRepository;
    let performanceService: TargetingPerformanceService;

    beforeEach(() => {
        // Setup mocks
        mockPool = {
            query: jest.fn(),
            connect: jest.fn(),
            end: jest.fn(),
        } as any;

        mockRedis = {
            get: jest.fn(),
            set: jest.fn(),
            setex: jest.fn(),
            del: jest.fn(),
            status: 'ready',
        } as any;

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        } as any;

        // Initialize services
        cacheManager = new TargetingCacheManager(mockRedis, mockLogger);
        repository = new SwapTargetingRepository(mockPool, cacheManager);
        performanceService = new TargetingPerformanceService(cacheManager, repository, mockLogger);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('TargetingCacheManager', () => {
        const userId = 'test-user-123';
        const mockTargetingData = [
            {
                direction: 'incoming',
                targetId: 'target-1',
                status: 'active',
                createdAt: new Date(),
                bookingDetails: {
                    title: 'Test Booking',
                    location: 'Test Location',
                    ownerName: 'Test Owner'
                }
            }
        ];

        it('should cache and retrieve targeting data', async () => {
            // Mock Redis responses
            mockRedis.get.mockResolvedValueOnce(null); // Cache miss
            mockRedis.setex.mockResolvedValueOnce('OK');

            // Test cache miss
            const cachedData = await cacheManager.getCachedTargetingData(userId);
            expect(cachedData).toBeNull();
            expect(mockRedis.get).toHaveBeenCalledWith(`targeting:${userId}`);

            // Test cache set
            await cacheManager.setCachedTargetingData(userId, mockTargetingData);
            expect(mockRedis.setex).toHaveBeenCalledWith(
                `targeting:${userId}`,
                300, // TTL
                expect.stringContaining('"targetId":"target-1"')
            );
        });

        it('should handle cache hits correctly', async () => {
            const cachedResponse = JSON.stringify({
                userId,
                targetingData: mockTargetingData,
                lastUpdated: new Date(),
                version: 1
            });

            mockRedis.get.mockResolvedValueOnce(cachedResponse);

            const result = await cacheManager.getCachedTargetingData(userId);
            expect(result).toEqual(mockTargetingData);
            expect(mockLogger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Cache hit for targeting data')
            );
        });

        it('should invalidate cache for multiple users', async () => {
            const userIds = ['user1', 'user2', 'user3'];
            mockRedis.del.mockResolvedValueOnce(6); // 2 keys per user

            await cacheManager.invalidateMultipleUsersCache(userIds);

            expect(mockRedis.del).toHaveBeenCalledWith(
                'targeting:user1',
                'targeting_count:user1',
                'targeting:user2',
                'targeting_count:user2',
                'targeting:user3',
                'targeting_count:user3'
            );
        });

        it('should track cache statistics', async () => {
            // Simulate cache hits and misses
            mockRedis.get
                .mockResolvedValueOnce(null) // miss
                .mockResolvedValueOnce('cached-data') // hit
                .mockResolvedValueOnce(null); // miss

            await cacheManager.getCachedTargetingData('user1');
            await cacheManager.getCachedTargetingData('user2');
            await cacheManager.getCachedTargetingData('user3');

            const stats = cacheManager.getCacheStats();
            expect(stats.totalRequests).toBe(3);
            expect(stats.hits).toBe(1);
            expect(stats.misses).toBe(2);
            expect(stats.hitRate).toBeCloseTo(0.33, 2);
        });
    });

    describe('TargetingPerformanceService', () => {
        const userId = 'test-user-123';

        it('should handle paginated targeting data requests', async () => {
            const mockPaginatedResult = {
                data: [
                    {
                        targetId: 'target-1',
                        direction: 'incoming',
                        status: 'active',
                        createdAt: new Date(),
                        bookingDetails: {
                            title: 'Test Booking',
                            location: 'Test Location',
                            ownerName: 'Test Owner'
                        }
                    }
                ],
                pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                    hasNext: false,
                    hasPrevious: false
                }
            };

            // Mock repository method
            jest.spyOn(repository, 'getTargetingCount').mockResolvedValueOnce(1);
            jest.spyOn(repository, 'getPaginatedTargetingData').mockResolvedValueOnce(mockPaginatedResult.data);

            const result = await performanceService.getPaginatedTargetingData(userId, {
                page: 1,
                limit: 20
            });

            expect(result.data).toEqual(mockPaginatedResult.data);
            expect(result.pagination.total).toBe(1);
            expect(result.performance.source).toBe('database');
            expect(result.performance.queryTime).toBeGreaterThan(0);
        });

        it('should use cache for simple queries', async () => {
            const cachedData = [
                {
                    direction: 'incoming',
                    targetId: 'cached-target',
                    status: 'active',
                    created_at: new Date().toISOString()
                }
            ];

            // Mock cache hit
            jest.spyOn(cacheManager, 'getCachedTargetingData').mockResolvedValueOnce(cachedData);

            const result = await performanceService.getPaginatedTargetingData(userId, {
                page: 1,
                limit: 20,
                direction: 'both'
            });

            expect(result.performance.cacheHit).toBe(true);
            expect(result.performance.source).toBe('cache');
        });

        it('should batch load targeting data for multiple users', async () => {
            const userIds = ['user1', 'user2', 'user3'];

            // Mock individual user data fetches
            jest.spyOn(performanceService, 'getPaginatedTargetingData')
                .mockResolvedValueOnce({
                    data: [{ targetId: 'target1', direction: 'incoming' } as any],
                    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
                    performance: { queryTime: 100, cacheHit: false, source: 'database' }
                })
                .mockResolvedValueOnce({
                    data: [{ targetId: 'target2', direction: 'outgoing' } as any],
                    pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
                    performance: { queryTime: 50, cacheHit: true, source: 'cache' }
                })
                .mockResolvedValueOnce({
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
                    performance: { queryTime: 25, cacheHit: true, source: 'cache' }
                });

            const results = await performanceService.batchLoadTargetingData(userIds);

            expect(results.size).toBe(3);
            expect(results.get('user1')?.data).toHaveLength(1);
            expect(results.get('user2')?.data).toHaveLength(1);
            expect(results.get('user3')?.data).toHaveLength(0);
        });

        it('should handle targeting counts with caching', async () => {
            const mockCounts = { incoming: 5, outgoing: 3 };

            // Mock cache miss, then database fetch
            jest.spyOn(cacheManager, 'getCachedTargetingCounts').mockResolvedValueOnce(null);
            jest.spyOn(repository, 'getTargetingCounts').mockResolvedValueOnce({
                incomingCount: 5,
                outgoingCount: 3,
                totalCount: 8,
                activeCount: 7
            });
            jest.spyOn(cacheManager, 'setCachedTargetingCounts').mockResolvedValueOnce();

            const result = await performanceService.getTargetingCounts(userId);

            expect(result.incoming).toBe(5);
            expect(result.outgoing).toBe(3);
            expect(cacheManager.setCachedTargetingCounts).toHaveBeenCalledWith(userId, 5, 3);
        });
    });

    describe('SwapTargetingRepository Performance', () => {
        const userId = 'test-user-123';

        it('should execute optimized paginated queries', async () => {
            const mockQueryResult = {
                rows: [
                    {
                        target_id: 'target-1',
                        direction: 'incoming',
                        status: 'active',
                        created_at: new Date(),
                        booking_title: 'Test Booking',
                        booking_city: 'Test City',
                        booking_country: 'Test Country',
                        owner_name: 'Test Owner',
                        total: '10'
                    }
                ]
            };

            mockPool.query.mockResolvedValueOnce(mockQueryResult);

            const result = await repository.getPaginatedTargetingData(userId, {
                limit: 20,
                offset: 0,
                direction: 'both',
                status: ['active'],
                sortBy: 'created_at',
                sortOrder: 'DESC'
            });

            expect(result).toHaveLength(1);
            expect(result[0].targetId).toBe('target-1');
            expect(result[0].direction).toBe('incoming');

            // Verify query was called with correct parameters
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT $3 OFFSET $4'),
                expect.arrayContaining([userId, ['active'], 20, 0])
            );
        });

        it('should get targeting counts efficiently', async () => {
            const mockCountResult = {
                rows: [{
                    incoming_count: '5',
                    outgoing_count: '3',
                    total_count: '8',
                    active_count: '7'
                }]
            };

            mockPool.query.mockResolvedValueOnce(mockCountResult);

            const result = await repository.getTargetingCounts(userId);

            expect(result.incomingCount).toBe(5);
            expect(result.outgoingCount).toBe(3);
            expect(result.totalCount).toBe(8);
            expect(result.activeCount).toBe(7);

            // Verify optimized count query was used
            expect(mockPool.query).toHaveBeenCalledWith(
                expect.stringContaining('COUNT(CASE WHEN'),
                [userId]
            );
        });

        it('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockPool.query.mockRejectedValueOnce(dbError);

            const result = await repository.getTargetingCounts(userId);

            expect(result).toEqual({
                incomingCount: 0,
                outgoingCount: 0,
                totalCount: 0,
                activeCount: 0
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to get targeting counts',
                expect.objectContaining({
                    error: dbError.message,
                    userId
                })
            );
        });
    });

    describe('Performance Benchmarks', () => {
        it('should meet performance thresholds for cache operations', async () => {
            const startTime = Date.now();

            // Simulate fast cache operations
            mockRedis.get.mockResolvedValueOnce('cached-data');

            await cacheManager.getCachedTargetingData('test-user');

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(50); // Should be under 50ms for cache operations
        });

        it('should handle high-volume batch operations efficiently', async () => {
            const userIds = Array.from({ length: 100 }, (_, i) => `user-${i}`);

            // Mock fast responses for all users
            jest.spyOn(performanceService, 'getPaginatedTargetingData')
                .mockImplementation(async () => ({
                    data: [],
                    pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
                    performance: { queryTime: 10, cacheHit: true, source: 'cache' }
                }));

            const startTime = Date.now();
            const results = await performanceService.batchLoadTargetingData(userIds);
            const duration = Date.now() - startTime;

            expect(results.size).toBe(100);
            expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });
    });

    describe('Cache Health and Monitoring', () => {
        it('should report cache health status', async () => {
            const health = await cacheManager.getCacheHealth();

            expect(health).toHaveProperty('isHealthy');
            expect(health).toHaveProperty('redisConnected');
            expect(health).toHaveProperty('cacheStats');
            expect(health.redisConnected).toBe(true); // Mock Redis is 'ready'
        });

        it('should reset cache statistics', () => {
            // Generate some stats first
            cacheManager.getCacheStats(); // This will initialize stats

            cacheManager.resetCacheStats();

            const stats = cacheManager.getCacheStats();
            expect(stats.hits).toBe(0);
            expect(stats.misses).toBe(0);
            expect(stats.totalRequests).toBe(0);
            expect(stats.hitRate).toBe(0);
        });
    });
});