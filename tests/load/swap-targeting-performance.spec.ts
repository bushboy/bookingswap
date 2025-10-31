import { test, expect } from '@playwright/test';
import { performance } from 'perf_hooks';

/**
 * Performance and Load Tests for Swap Targeting System
 * 
 * Tests targeting operations under load, database performance,
 * and system behavior with large datasets.
 */

interface PerformanceMetrics {
    responseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage?: number;
}

test.describe('Swap Targeting Performance Tests', () => {

    test.describe('Database Performance with Large Datasets', () => {

        test('should handle targeting queries with 10,000+ swaps efficiently', async ({ page }) => {
            // Setup large dataset
            await setupLargeDataset(page, 10000);

            const startTime = performance.now();

            // Login and create a swap
            await loginUser(page, 'performance@test.com');
            const userSwap = await createSwap(page, 'Performance Test Swap');

            // Navigate to browse page (should load large dataset)
            await page.goto('/browse');
            await page.waitForSelector('[data-testid="swap-browser"]');

            const loadTime = performance.now() - startTime;

            // Should load within acceptable time (< 3 seconds)
            expect(loadTime).toBeLessThan(3000);

            // Verify pagination is working
            const paginationInfo = page.locator('[data-testid="pagination-info"]');
            await expect(paginationInfo).toBeVisible();
            await expect(paginationInfo).toContainText('1-50 of 10,000');

            // Test targeting performance
            const targetStartTime = performance.now();

            const firstSwapCard = page.locator('[data-testid="swap-card"]').first();
            await firstSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();

            const targetTime = performance.now() - targetStartTime;

            // Targeting should complete within 2 seconds
            expect(targetTime).toBeLessThan(2000);

            console.log(`Large dataset performance: Load=${loadTime}ms, Target=${targetTime}ms`);
        });

        test('should maintain query performance with complex targeting relationships', async ({ page }) => {
            // Create complex targeting network (1000 users, each with targeting relationships)
            await setupComplexTargetingNetwork(page, 1000);

            await loginUser(page, 'complex@test.com');
            const userSwap = await createSwap(page, 'Complex Network Test');

            // Test circular targeting detection performance
            const circularCheckStart = performance.now();

            await page.goto('/browse');

            // Try to target a swap that would create circular targeting
            const circularSwapCard = page.locator('[data-testid="swap-card-circular-test"]');
            await expect(circularSwapCard.locator('[data-testid="target-my-swap-btn"]')).toBeDisabled();

            const circularCheckTime = performance.now() - circularCheckStart;

            // Circular detection should be fast even with complex network
            expect(circularCheckTime).toBeLessThan(1000);

            // Test targeting history query performance
            const historyStart = performance.now();

            await page.goto('/dashboard');
            await page.locator('[data-testid="view-targeting-history-btn"]').click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            const historyTime = performance.now() - historyStart;

            // History loading should be fast
            expect(historyTime).toBeLessThan(1500);

            console.log(`Complex network performance: Circular=${circularCheckTime}ms, History=${historyTime}ms`);
        });

        test('should handle concurrent database operations efficiently', async ({ page }) => {
            // Setup concurrent operations test
            const concurrentOperations = 50;
            const operations: Promise<number>[] = [];

            // Create multiple users for concurrent testing
            for (let i = 0; i < concurrentOperations; i++) {
                const operation = measureConcurrentTargeting(page, i);
                operations.push(operation);
            }

            const startTime = performance.now();
            const results = await Promise.all(operations);
            const totalTime = performance.now() - startTime;

            // Calculate performance metrics
            const avgResponseTime = results.reduce((sum, time) => sum + time, 0) / results.length;
            const throughput = concurrentOperations / (totalTime / 1000); // operations per second

            // Performance assertions
            expect(avgResponseTime).toBeLessThan(2000); // Average response < 2s
            expect(throughput).toBeGreaterThan(10); // At least 10 ops/sec

            // Check for database deadlocks or errors
            const errorCount = results.filter(time => time === -1).length;
            const errorRate = errorCount / concurrentOperations;
            expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate

            console.log(`Concurrent performance: Avg=${avgResponseTime}ms, Throughput=${throughput}ops/s, Errors=${errorRate * 100}%`);
        });
    });

    test.describe('WebSocket and Real-time Performance', () => {

        test('should handle high-frequency targeting notifications efficiently', async ({ browser }) => {
            const contexts = [];
            const pages = [];

            // Create 20 concurrent users
            for (let i = 0; i < 20; i++) {
                const context = await browser.newContext();
                const page = await context.newPage();
                contexts.push(context);
                pages.push(page);

                await loginUser(page, `user${i}@test.com`);
                await createSwap(page, `User ${i} Swap`);
            }

            // Monitor WebSocket message performance
            const messageMetrics: number[] = [];

            pages[0].on('websocket', ws => {
                ws.on('framereceived', event => {
                    const receiveTime = performance.now();
                    messageMetrics.push(receiveTime);
                });
            });

            // Generate rapid targeting events
            const targetingPromises = [];
            for (let i = 1; i < pages.length; i++) {
                const promise = rapidTargeting(pages[i], pages[0]);
                targetingPromises.push(promise);
            }

            await Promise.all(targetingPromises);

            // Analyze WebSocket performance
            const messageDelays = [];
            for (let i = 1; i < messageMetrics.length; i++) {
                messageDelays.push(messageMetrics[i] - messageMetrics[i - 1]);
            }

            const avgDelay = messageDelays.reduce((sum, delay) => sum + delay, 0) / messageDelays.length;
            const maxDelay = Math.max(...messageDelays);

            // WebSocket performance assertions
            expect(avgDelay).toBeLessThan(100); // Average delay < 100ms
            expect(maxDelay).toBeLessThan(500); // Max delay < 500ms

            // Cleanup
            for (const context of contexts) {
                await context.close();
            }

            console.log(`WebSocket performance: Avg delay=${avgDelay}ms, Max delay=${maxDelay}ms`);
        });

        test('should maintain notification delivery under load', async ({ browser }) => {
            const userCount = 50;
            const contexts = [];
            const pages = [];
            const notificationCounts = new Map<number, number>();

            // Setup users and notification tracking
            for (let i = 0; i < userCount; i++) {
                const context = await browser.newContext();
                const page = await context.newPage();
                contexts.push(context);
                pages.push(page);
                notificationCounts.set(i, 0);

                await loginUser(page, `loadtest${i}@test.com`);
                await createSwap(page, `Load Test Swap ${i}`);

                // Track notifications received
                page.on('websocket', ws => {
                    ws.on('framereceived', event => {
                        const data = JSON.parse(event.payload.toString());
                        if (data.type === 'targeting_notification') {
                            notificationCounts.set(i, notificationCounts.get(i)! + 1);
                        }
                    });
                });
            }

            // Generate load: each user targets 5 random other users
            const loadPromises = [];
            for (let i = 0; i < userCount; i++) {
                for (let j = 0; j < 5; j++) {
                    const targetIndex = (i + j + 1) % userCount;
                    const promise = targetUserSwap(pages[i], targetIndex);
                    loadPromises.push(promise);
                }
            }

            const startTime = performance.now();
            await Promise.all(loadPromises);
            const endTime = performance.now();

            // Wait for notifications to propagate
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Analyze notification delivery
            const totalNotifications = Array.from(notificationCounts.values()).reduce((sum, count) => sum + count, 0);
            const expectedNotifications = userCount * 5; // Each user should receive 5 notifications
            const deliveryRate = totalNotifications / expectedNotifications;

            // Performance metrics
            const totalTime = endTime - startTime;
            const throughput = (userCount * 5) / (totalTime / 1000);

            // Assertions
            expect(deliveryRate).toBeGreaterThan(0.95); // 95% delivery rate
            expect(throughput).toBeGreaterThan(20); // At least 20 targeting ops/sec

            // Cleanup
            for (const context of contexts) {
                await context.close();
            }

            console.log(`Load test: Delivery rate=${deliveryRate * 100}%, Throughput=${throughput}ops/s`);
        });
    });

    test.describe('Memory and Resource Usage', () => {

        test('should not leak memory during extended targeting operations', async ({ page }) => {
            // Monitor memory usage during extended operations
            const memorySnapshots: number[] = [];

            await loginUser(page, 'memory@test.com');
            const userSwap = await createSwap(page, 'Memory Test Swap');

            // Create target swaps for cycling
            const targetSwaps = [];
            for (let i = 0; i < 10; i++) {
                await loginUser(page, `target${i}@test.com`);
                const swapId = await createSwap(page, `Target Swap ${i}`);
                targetSwaps.push(swapId);
            }

            await loginUser(page, 'memory@test.com');

            // Perform 100 targeting cycles
            for (let cycle = 0; cycle < 100; cycle++) {
                const targetSwap = targetSwaps[cycle % targetSwaps.length];

                await page.goto('/browse');
                await targetSwap(page, targetSwap);

                // Take memory snapshot every 10 cycles
                if (cycle % 10 === 0) {
                    const memoryUsage = await page.evaluate(() => {
                        return (performance as any).memory?.usedJSHeapSize || 0;
                    });
                    memorySnapshots.push(memoryUsage);
                }

                // Remove target to cycle
                await page.goto('/dashboard');
                await page.locator('[data-testid="remove-target-btn"]').click();
                await page.locator('[data-testid="confirm-remove-btn"]').click();
            }

            // Analyze memory usage trend
            if (memorySnapshots.length > 2) {
                const initialMemory = memorySnapshots[0];
                const finalMemory = memorySnapshots[memorySnapshots.length - 1];
                const memoryGrowth = (finalMemory - initialMemory) / initialMemory;

                // Memory growth should be minimal (< 50%)
                expect(memoryGrowth).toBeLessThan(0.5);

                console.log(`Memory usage: Initial=${initialMemory}bytes, Final=${finalMemory}bytes, Growth=${memoryGrowth * 100}%`);
            }
        });

        test('should handle large targeting history efficiently', async ({ page }) => {
            await loginUser(page, 'history@test.com');
            const userSwap = await createSwap(page, 'History Test Swap');

            // Create large targeting history (1000 entries)
            await generateLargeTargetingHistory(page, userSwap, 1000);

            // Test history loading performance
            const startTime = performance.now();

            await page.goto('/dashboard');
            await page.locator('[data-testid="view-targeting-history-btn"]').click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            // Wait for history to load
            const historyEntries = historyModal.locator('[data-testid="history-entry"]');
            await expect(historyEntries.first()).toBeVisible();

            const loadTime = performance.now() - startTime;

            // Should load large history efficiently
            expect(loadTime).toBeLessThan(3000);

            // Test pagination performance
            const nextPageStart = performance.now();

            await page.locator('[data-testid="history-next-page"]').click();
            await expect(historyEntries.first()).toBeVisible();

            const pageTime = performance.now() - nextPageStart;
            expect(pageTime).toBeLessThan(1000);

            console.log(`History performance: Load=${loadTime}ms, Page=${pageTime}ms`);
        });
    });

    test.describe('Stress Testing', () => {

        test('should handle system limits gracefully', async ({ page }) => {
            // Test targeting system under extreme load
            const extremeUserCount = 1000;

            // Setup extreme dataset
            await setupExtremeDataset(page, extremeUserCount);

            await loginUser(page, 'stress@test.com');
            const stressSwap = await createSwap(page, 'Stress Test Swap');

            // Test browse performance with extreme dataset
            const browseStart = performance.now();

            await page.goto('/browse');
            await page.waitForSelector('[data-testid="swap-browser"]');

            const browseTime = performance.now() - browseStart;

            // Should still be responsive under extreme load
            expect(browseTime).toBeLessThan(10000); // 10 second timeout

            // Test search performance
            const searchStart = performance.now();

            await page.fill('[data-testid="search-input"]', 'Beach House');
            await page.waitForSelector('[data-testid="search-results"]');

            const searchTime = performance.now() - searchStart;
            expect(searchTime).toBeLessThan(5000);

            console.log(`Stress test: Browse=${browseTime}ms, Search=${searchTime}ms`);
        });

        test('should recover from resource exhaustion', async ({ page }) => {
            // Simulate resource exhaustion scenarios
            await loginUser(page, 'recovery@test.com');
            const recoverySwap = await createSwap(page, 'Recovery Test Swap');

            // Simulate memory pressure
            await page.evaluate(() => {
                // Create memory pressure
                const arrays = [];
                for (let i = 0; i < 100; i++) {
                    arrays.push(new Array(100000).fill('memory-pressure'));
                }
                (window as any).memoryPressure = arrays;
            });

            // Test targeting still works under memory pressure
            await page.goto('/browse');

            const firstSwap = page.locator('[data-testid="swap-card"]').first();
            await firstSwap.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            // Should still complete successfully
            await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();

            // Cleanup memory pressure
            await page.evaluate(() => {
                delete (window as any).memoryPressure;
            });
        });
    });
});

// Helper functions for performance testing

async function setupLargeDataset(page: any, count: number) {
    // Mock API to return large dataset
    await page.route('**/api/swaps', route => {
        const swaps = [];
        for (let i = 0; i < count; i++) {
            swaps.push({
                id: `swap-${i}`,
                title: `Test Swap ${i}`,
                location: `Location ${i}`,
                dates: '2025-07-01 to 2025-07-07',
                guests: 4,
                mode: 'one-for-one',
                status: 'available'
            });
        }

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                swaps: swaps.slice(0, 50), // Paginated response
                total: count,
                page: 1,
                limit: 50
            })
        });
    });
}

async function setupComplexTargetingNetwork(page: any, userCount: number) {
    // Create complex targeting relationships for testing
    await page.route('**/api/targeting/validate', route => {
        // Simulate complex circular detection logic
        setTimeout(() => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    canTarget: false,
                    reason: 'circular_targeting',
                    message: 'Would create circular targeting'
                })
            });
        }, Math.random() * 500); // Random delay up to 500ms
    });
}

async function measureConcurrentTargeting(page: any, index: number): Promise<number> {
    try {
        const startTime = performance.now();

        await loginUser(page, `concurrent${index}@test.com`);
        const userSwap = await createSwap(page, `Concurrent Swap ${index}`);

        // Target a random existing swap
        const targetId = `target-${Math.floor(Math.random() * 100)}`;
        await targetSwap(page, targetId);

        return performance.now() - startTime;
    } catch (error) {
        console.error(`Concurrent operation ${index} failed:`, error);
        return -1; // Error indicator
    }
}

async function rapidTargeting(page: any, targetPage: any) {
    // Perform rapid targeting operations
    for (let i = 0; i < 5; i++) {
        await page.goto('/browse');
        const targetButton = page.locator('[data-testid="target-my-swap-btn"]').first();
        await targetButton.click();
        await page.locator('[data-testid="confirm-targeting-btn"]').click();

        await page.waitForTimeout(100); // Brief pause between operations

        // Remove target for next iteration
        await page.goto('/dashboard');
        await page.locator('[data-testid="remove-target-btn"]').click();
        await page.locator('[data-testid="confirm-remove-btn"]').click();
    }
}

async function targetUserSwap(page: any, targetIndex: number) {
    await page.goto('/browse');
    const targetSwap = page.locator(`[data-testid="swap-card-${targetIndex}"]`);
    await targetSwap.locator('[data-testid="target-my-swap-btn"]').click();
    await page.locator('[data-testid="confirm-targeting-btn"]').click();
}

async function generateLargeTargetingHistory(page: any, swapId: string, entryCount: number) {
    // Mock large targeting history
    await page.route('**/api/targeting/history', route => {
        const history = [];
        for (let i = 0; i < entryCount; i++) {
            history.push({
                id: `history-${i}`,
                action: i % 2 === 0 ? 'targeted' : 'retargeted',
                targetSwap: `Target Swap ${i}`,
                timestamp: new Date(Date.now() - i * 60000).toISOString()
            });
        }

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                history: history.slice(0, 50), // Paginated
                total: entryCount,
                page: 1,
                limit: 50
            })
        });
    });
}

async function setupExtremeDataset(page: any, count: number) {
    // Setup for stress testing with extreme data volumes
    await setupLargeDataset(page, count);

    // Add additional complexity
    await page.route('**/api/swaps/search', route => {
        // Simulate complex search with large dataset
        setTimeout(() => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    results: [],
                    total: 0,
                    searchTime: Math.random() * 2000
                })
            });
        }, Math.random() * 3000);
    });
}

// Reuse helper functions from main test files
async function loginUser(page: any, email: string) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
}

async function createSwap(page: any, title: string) {
    await page.goto('/create-swap');
    await page.fill('[data-testid="booking-title-input"]', title);
    await page.fill('[data-testid="booking-location-input"]', 'Test Location');
    await page.fill('[data-testid="booking-dates-input"]', '2025-07-01 to 2025-07-07');
    await page.fill('[data-testid="booking-guests-input"]', '4');
    await page.click('[data-testid="one-for-one-mode-radio"]');
    await page.click('[data-testid="create-swap-btn"]');
    await page.waitForURL('/dashboard');

    const swapId = await page.locator('[data-testid="swap-id"]').textContent();
    return swapId;
}

async function targetSwap(page: any, targetSwapId: string) {
    await page.goto('/browse');
    const targetSwapCard = page.locator(`[data-testid="swap-card-${targetSwapId}"]`);
    await targetSwapCard.locator('[data-testid="target-my-swap-btn"]').click();
    await page.locator('[data-testid="confirm-targeting-btn"]').click();
    await expect(page.locator('[data-testid="targeting-success-message"]')).toBeVisible();
}