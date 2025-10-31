import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { SwapTargetingService } from '../../src/services/SwapTargetingService';
import { SwapTargetingRepository } from '../../src/repositories/SwapTargetingRepository';
import { SwapRepository } from '../../src/repositories/SwapRepository';
import { DatabaseConnection } from '../../src/database/connection';

/**
 * Backend Performance Tests for Swap Targeting System
 * 
 * Tests database performance, service layer efficiency,
 * and system behavior under load conditions.
 */

describe('Swap Targeting Backend Performance', () => {
    let targetingService: SwapTargetingService;
    let targetingRepository: SwapTargetingRepository;
    let swapRepository: SwapRepository;
    let db: DatabaseConnection;

    beforeAll(async () => {
        // Setup test database and services
        db = new DatabaseConnection(process.env.TEST_DATABASE_URL);
        await db.connect();

        swapRepository = new SwapRepository(db);
        targetingRepository = new SwapTargetingRepository(db);
        targetingService = new SwapTargetingService(targetingRepository, swapRepository);
    });

    afterAll(async () => {
        await db.disconnect();
    });

    beforeEach(async () => {
        // Clean database before each test
        await db.query('TRUNCATE TABLE swap_targeting_history, swap_targets, swap_proposals, swaps CASCADE');
    });

    describe('Database Query Performance', () => {

        it('should handle targeting queries efficiently with large datasets', async () => {
            // Create large dataset (10,000 swaps)
            const swapCount = 10000;
            const swaps = await createLargeSwapDataset(swapCount);

            // Measure targeting validation query performance
            const startTime = performance.now();

            const canTarget = await targetingService.canTargetSwap(swaps[0].id, 'user-1');

            const queryTime = performance.now() - startTime;

            expect(canTarget).toBe(true);
            expect(queryTime).toBeLessThan(100); // Should complete within 100ms

            console.log(`Large dataset targeting validation: ${queryTime}ms`);
        });

        it('should maintain circular targeting detection performance', async () => {
            // Create complex targeting chain (A->B->C->D->E)
            const chainLength = 1000;
            const swaps = await createTargetingChain(chainLength);

            // Test circular detection at the end of long chain
            const startTime = performance.now();

            const wouldCreateCircular = await targetingRepository.findCircularTargeting(
                swaps[chainLength - 1].id,
                swaps[0].id
            );

            const detectionTime = performance.now() - startTime;

            expect(wouldCreateCircular).toBe(true);
            expect(detectionTime).toBeLessThan(500); // Should detect within 500ms

            console.log(`Circular targeting detection (${chainLength} chain): ${detectionTime}ms`);
        });

        it('should handle concurrent targeting operations without deadlocks', async () => {
            const concurrentOperations = 100;
            const swaps = await createLargeSwapDataset(concurrentOperations * 2);

            // Create concurrent targeting operations
            const operations = [];
            for (let i = 0; i < concurrentOperations; i++) {
                const operation = targetingService.targetSwap(
                    swaps[i].id,
                    swaps[i + concurrentOperations].id,
                    `user-${i}`
                );
                operations.push(operation);
            }

            const startTime = performance.now();
            const results = await Promise.allSettled(operations);
            const totalTime = performance.now() - startTime;

            // Analyze results
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;

            const successRate = successful / concurrentOperations;
            const throughput = successful / (totalTime / 1000);

            expect(successRate).toBeGreaterThan(0.9); // 90% success rate
            expect(throughput).toBeGreaterThan(50); // At least 50 ops/sec
            expect(failed).toBeLessThan(concurrentOperations * 0.1); // Less than 10% failures

            console.log(`Concurrent targeting: ${successful}/${concurrentOperations} successful, ${throughput} ops/sec`);
        });

        it('should optimize targeting history queries', async () => {
            const swapId = 'test-swap-1';
            const historyEntries = 10000;

            // Create large targeting history
            await createLargeTargetingHistory(swapId, historyEntries);

            // Test paginated history query performance
            const startTime = performance.now();

            const history = await targetingRepository.getTargetingHistory(swapId, {
                page: 1,
                limit: 50,
                sortBy: 'timestamp',
                sortOrder: 'DESC'
            });

            const queryTime = performance.now() - startTime;

            expect(history.length).toBe(50);
            expect(queryTime).toBeLessThan(200); // Should complete within 200ms

            // Test different page performance
            const page10Start = performance.now();

            const page10History = await targetingRepository.getTargetingHistory(swapId, {
                page: 10,
                limit: 50,
                sortBy: 'timestamp',
                sortOrder: 'DESC'
            });

            const page10Time = performance.now() - page10Start;

            expect(page10History.length).toBe(50);
            expect(page10Time).toBeLessThan(300); // Later pages should still be fast

            console.log(`History query performance: Page 1=${queryTime}ms, Page 10=${page10Time}ms`);
        });
    });

    describe('Service Layer Performance', () => {

        it('should handle rapid targeting/retargeting efficiently', async () => {
            const swaps = await createLargeSwapDataset(100);
            const userId = 'rapid-user';

            // Measure rapid retargeting performance
            const retargetingTimes = [];

            for (let i = 0; i < 50; i++) {
                const startTime = performance.now();

                if (i === 0) {
                    // Initial targeting
                    await targetingService.targetSwap(swaps[0].id, swaps[i + 1].id, userId);
                } else {
                    // Retargeting
                    await targetingService.retargetSwap(swaps[0].id, swaps[i + 1].id, userId);
                }

                const operationTime = performance.now() - startTime;
                retargetingTimes.push(operationTime);
            }

            const avgTime = retargetingTimes.reduce((sum, time) => sum + time, 0) / retargetingTimes.length;
            const maxTime = Math.max(...retargetingTimes);

            expect(avgTime).toBeLessThan(100); // Average < 100ms
            expect(maxTime).toBeLessThan(500); // Max < 500ms

            console.log(`Rapid retargeting: Avg=${avgTime}ms, Max=${maxTime}ms`);
        });

        it('should validate targeting eligibility efficiently', async () => {
            const swaps = await createLargeSwapDataset(1000);
            const validationTimes = [];

            // Test validation performance across different scenarios
            for (let i = 0; i < 100; i++) {
                const startTime = performance.now();

                const validation = await targetingService.validateTargeting(
                    swaps[i].id,
                    swaps[i + 100].id
                );

                const validationTime = performance.now() - startTime;
                validationTimes.push(validationTime);

                expect(validation.isValid).toBeDefined();
            }

            const avgValidationTime = validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length;
            const maxValidationTime = Math.max(...validationTimes);

            expect(avgValidationTime).toBeLessThan(50); // Average < 50ms
            expect(maxValidationTime).toBeLessThan(200); // Max < 200ms

            console.log(`Validation performance: Avg=${avgValidationTime}ms, Max=${maxValidationTime}ms`);
        });

        it('should handle auction mode validation efficiently', async () => {
            // Create auction mode swaps
            const auctionSwaps = await createAuctionSwaps(100);
            const validationTimes = [];

            for (const auctionSwap of auctionSwaps) {
                const startTime = performance.now();

                const eligibility = await targetingService.checkAuctionEligibility(auctionSwap.id);

                const validationTime = performance.now() - startTime;
                validationTimes.push(validationTime);

                expect(eligibility.canTarget).toBeDefined();
                expect(eligibility.auctionActive).toBeDefined();
            }

            const avgTime = validationTimes.reduce((sum, time) => sum + time, 0) / validationTimes.length;

            expect(avgTime).toBeLessThan(30); // Should be very fast

            console.log(`Auction validation performance: Avg=${avgTime}ms`);
        });
    });

    describe('Memory and Resource Usage', () => {

        it('should not leak memory during extended operations', async () => {
            const initialMemory = process.memoryUsage();
            const swaps = await createLargeSwapDataset(1000);

            // Perform 1000 targeting operations
            for (let i = 0; i < 1000; i++) {
                const sourceIndex = i % 100;
                const targetIndex = (i + 1) % 100;

                await targetingService.targetSwap(
                    swaps[sourceIndex].id,
                    swaps[targetIndex].id,
                    `user-${sourceIndex}`
                );

                // Remove target to prevent conflicts
                await targetingService.removeTarget(swaps[sourceIndex].id, `user-${sourceIndex}`);

                // Force garbage collection every 100 operations
                if (i % 100 === 0 && global.gc) {
                    global.gc();
                }
            }

            const finalMemory = process.memoryUsage();
            const memoryGrowth = (finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapUsed;

            // Memory growth should be reasonable (< 100%)
            expect(memoryGrowth).toBeLessThan(1.0);

            console.log(`Memory usage: Initial=${initialMemory.heapUsed}, Final=${finalMemory.heapUsed}, Growth=${memoryGrowth * 100}%`);
        });

        it('should handle database connection pooling efficiently', async () => {
            const connectionCount = 50;
            const operationsPerConnection = 20;

            // Create concurrent database operations
            const connectionPromises = [];

            for (let i = 0; i < connectionCount; i++) {
                const promise = performDatabaseOperations(operationsPerConnection, i);
                connectionPromises.push(promise);
            }

            const startTime = performance.now();
            const results = await Promise.all(connectionPromises);
            const totalTime = performance.now() - startTime;

            const totalOperations = connectionCount * operationsPerConnection;
            const throughput = totalOperations / (totalTime / 1000);

            expect(throughput).toBeGreaterThan(100); // At least 100 ops/sec

            // Check for connection errors
            const errors = results.filter(result => result.errors > 0);
            expect(errors.length).toBe(0);

            console.log(`Connection pooling: ${totalOperations} operations, ${throughput} ops/sec`);
        });
    });

    describe('Index and Query Optimization', () => {

        it('should use indexes effectively for targeting queries', async () => {
            const swaps = await createLargeSwapDataset(50000);

            // Test index usage for common queries
            const queries = [
                () => targetingRepository.findBySourceSwap(swaps[0].id),
                () => targetingRepository.findByTargetSwap(swaps[1000].id),
                () => targetingRepository.findActiveTargets('user-1'),
                () => targetingRepository.countTargetsForSwap(swaps[2000].id)
            ];

            for (const query of queries) {
                const startTime = performance.now();
                await query();
                const queryTime = performance.now() - startTime;

                // All indexed queries should be fast
                expect(queryTime).toBeLessThan(50);
            }
        });

        it('should optimize complex targeting relationship queries', async () => {
            // Create complex targeting network
            await createComplexTargetingNetwork(1000);

            const complexQueries = [
                () => targetingRepository.findCircularTargeting('swap-1', 'swap-500'),
                () => targetingRepository.getTargetingChain('swap-1', 10),
                () => targetingRepository.findMutualTargeting('user-1', 'user-500'),
                () => targetingRepository.getTargetingStatistics('user-1')
            ];

            for (const query of complexQueries) {
                const startTime = performance.now();
                await query();
                const queryTime = performance.now() - startTime;

                // Complex queries should still be reasonably fast
                expect(queryTime).toBeLessThan(1000);
            }
        });
    });

    // Helper functions for performance testing

    async function createLargeSwapDataset(count: number) {
        const swaps = [];
        const batchSize = 1000;

        for (let i = 0; i < count; i += batchSize) {
            const batch = [];
            const currentBatchSize = Math.min(batchSize, count - i);

            for (let j = 0; j < currentBatchSize; j++) {
                batch.push({
                    id: `swap-${i + j}`,
                    userId: `user-${i + j}`,
                    title: `Test Swap ${i + j}`,
                    location: `Location ${i + j}`,
                    dates: '2025-07-01 to 2025-07-07',
                    guests: 4,
                    mode: 'one-for-one',
                    status: 'available'
                });
            }

            await swapRepository.createBatch(batch);
            swaps.push(...batch);
        }

        return swaps;
    }

    async function createTargetingChain(length: number) {
        const swaps = await createLargeSwapDataset(length);

        // Create chain: swap-0 -> swap-1 -> swap-2 -> ... -> swap-(length-1)
        for (let i = 0; i < length - 1; i++) {
            await targetingService.targetSwap(swaps[i].id, swaps[i + 1].id, `user-${i}`);
        }

        return swaps;
    }

    async function createLargeTargetingHistory(swapId: string, entryCount: number) {
        const batchSize = 1000;

        for (let i = 0; i < entryCount; i += batchSize) {
            const batch = [];
            const currentBatchSize = Math.min(batchSize, entryCount - i);

            for (let j = 0; j < currentBatchSize; j++) {
                batch.push({
                    sourceSwapId: swapId,
                    targetSwapId: `target-${i + j}`,
                    action: j % 2 === 0 ? 'targeted' : 'retargeted',
                    timestamp: new Date(Date.now() - (i + j) * 60000),
                    metadata: { test: true }
                });
            }

            await targetingRepository.createHistoryBatch(batch);
        }
    }

    async function createAuctionSwaps(count: number) {
        const swaps = [];

        for (let i = 0; i < count; i++) {
            const swap = {
                id: `auction-swap-${i}`,
                userId: `auction-user-${i}`,
                title: `Auction Swap ${i}`,
                location: `Auction Location ${i}`,
                dates: '2025-07-01 to 2025-07-07',
                guests: 4,
                mode: 'auction',
                auctionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
                status: 'available'
            };

            await swapRepository.create(swap);
            swaps.push(swap);
        }

        return swaps;
    }

    async function performDatabaseOperations(operationCount: number, connectionId: number) {
        let errors = 0;

        try {
            for (let i = 0; i < operationCount; i++) {
                const swapId = `conn-${connectionId}-swap-${i}`;
                const targetId = `conn-${connectionId}-target-${i}`;

                // Create swap
                await swapRepository.create({
                    id: swapId,
                    userId: `conn-user-${connectionId}`,
                    title: `Connection Test Swap ${connectionId}-${i}`,
                    location: 'Test Location',
                    dates: '2025-07-01 to 2025-07-07',
                    guests: 4,
                    mode: 'one-for-one',
                    status: 'available'
                });

                // Create target swap
                await swapRepository.create({
                    id: targetId,
                    userId: `conn-target-user-${connectionId}`,
                    title: `Connection Target Swap ${connectionId}-${i}`,
                    location: 'Test Location',
                    dates: '2025-07-01 to 2025-07-07',
                    guests: 4,
                    mode: 'one-for-one',
                    status: 'available'
                });

                // Perform targeting operation
                await targetingService.targetSwap(swapId, targetId, `conn-user-${connectionId}`);
            }
        } catch (error) {
            errors++;
            console.error(`Connection ${connectionId} error:`, error);
        }

        return { connectionId, errors };
    }

    async function createComplexTargetingNetwork(nodeCount: number) {
        const swaps = await createLargeSwapDataset(nodeCount);

        // Create complex network with multiple targeting relationships
        for (let i = 0; i < nodeCount; i++) {
            const targetCount = Math.min(3, nodeCount - i - 1); // Each node targets up to 3 others

            for (let j = 1; j <= targetCount; j++) {
                const targetIndex = (i + j) % nodeCount;
                if (targetIndex !== i) {
                    try {
                        await targetingService.targetSwap(swaps[i].id, swaps[targetIndex].id, `user-${i}`);
                    } catch (error) {
                        // Ignore conflicts in complex network creation
                    }
                }
            }
        }
    }
});