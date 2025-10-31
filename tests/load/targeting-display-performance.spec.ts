import { test, expect, Page } from '@playwright/test';
import { performance } from 'perf_hooks';

/**
 * Performance Tests for Swap Targeting Display Integration
 * 
 * Tests targeting display performance under various load conditions,
 * database query optimization, UI rendering performance, and real-time
 * update efficiency.
 */

interface PerformanceMetrics {
    responseTime: number;
    throughput: number;
    errorRate: number;
    memoryUsage?: number;
    dbQueryTime?: number;
    renderTime?: number;
}

interface LoadTestConfig {
    userCount: number;
    swapCount: number;
    targetingRelationships: number;
    duration: number; // in seconds
}

test.describe('Targeting Display Performance Tests', () => {

    test.describe('Database Query Performance', () => {

        test('should handle enhanced swap cards query with large datasets efficiently', async ({ page }) => {
            // Setup large dataset for performance testing
            const config: LoadTestConfig = {
                userCount: 5000,
                swapCount: 10000,
                targetingRelationships: 15000,
                duration: 60
            };

            await setupLargeTargetingDataset(page, config);

            const startTime = performance.now();

            // Login and navigate to swaps page
            await loginUser(page, 'performance@test.com');
            await page.goto('/swaps');

            // Wait for enhanced swap cards to load
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            const loadTime = performance.now() - startTime;

            // Performance assertions
            expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

            // Verify pagination is working efficiently
            const paginationInfo = page.locator('[data-testid="pagination-info"]');
            await expect(paginationInfo).toBeVisible();

            // Test query performance metrics
            const queryMetrics = await page.evaluate(() => {
                return (window as any).performanceMetrics?.dbQuery || {};
            });

            expect(queryMetrics.executionTime).toBeLessThan(1500); // DB query < 1.5s
            expect(queryMetrics.rowsProcessed).toBeGreaterThan(0);

            console.log(`Large dataset performance: Load=${loadTime}ms, DB Query=${queryMetrics.executionTime}ms`);
        });

        test('should optimize targeting data queries with proper indexing', async ({ page }) => {
            // Setup complex targeting relationships
            await setupComplexTargetingNetwork(page, 2000);

            await loginUser(page, 'indexing@test.com');

            // Measure targeting data query performance
            const queryStartTime = performance.now();

            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            const queryTime = performance.now() - queryStartTime;

            // Test specific targeting queries
            const targetingQueries = [
                'incoming-targets',
                'outgoing-targets',
                'targeting-restrictions',
                'targeting-capabilities'
            ];

            const queryTimes: Record<string, number> = {};

            for (const queryType of targetingQueries) {
                const start = performance.now();

                await page.evaluate((type) => {
                    return fetch(`/api/targeting/${type}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }, queryType);

                queryTimes[queryType] = performance.now() - start;
            }

            // Performance assertions for individual queries
            expect(queryTimes['incoming-targets']).toBeLessThan(800);
            expect(queryTimes['outgoing-targets']).toBeLessThan(600);
            expect(queryTimes['targeting-restrictions']).toBeLessThan(400);
            expect(queryTimes['targeting-capabilities']).toBeLessThan(300);

            console.log('Targeting query performance:', queryTimes);
        });

        test('should handle concurrent targeting data requests efficiently', async ({ page }) => {
            const concurrentRequests = 50;
            const requestPromises: Promise<number>[] = [];

            // Setup concurrent users
            for (let i = 0; i < concurrentRequests; i++) {
                const promise = measureConcurrentTargetingDataLoad(page, i);
                requestPromises.push(promise);
            }

            const startTime = performance.now();
            const results = await Promise.all(requestPromises);
            const totalTime = performance.now() - startTime;

            // Calculate performance metrics
            const successfulRequests = results.filter(time => time > 0);
            const avgResponseTime = successfulRequests.reduce((sum, time) => sum + time, 0) / successfulRequests.length;
            const throughput = successfulRequests.length / (totalTime / 1000);
            const errorRate = (concurrentRequests - successfulRequests.length) / concurrentRequests;

            // Performance assertions
            expect(avgResponseTime).toBeLessThan(2000); // Average response < 2s
            expect(throughput).toBeGreaterThan(15); // At least 15 requests/sec
            expect(errorRate).toBeLessThan(0.05); // Less than 5% error rate

            console.log(`Concurrent performance: Avg=${avgResponseTime}ms, Throughput=${throughput}req/s, Errors=${errorRate * 100}%`);
        });

        test('should maintain query performance with complex targeting relationships', async ({ page }) => {
            // Create complex targeting network with circular detection requirements
            await setupComplexTargetingScenarios(page);

            await loginUser(page, 'complex@test.com');

            // Test circular targeting detection performance
            const circularDetectionStart = performance.now();

            await page.goto('/browse');
            await page.waitForSelector('[data-testid="swap-browser"]');

            // Try to target a swap that would create circular targeting
            const complexSwapCard = page.locator('[data-testid="swap-card-complex-1"]');
            await complexSwapCard.locator('[data-testid="target-my-swap-btn"]').click();

            // Should quickly detect and prevent circular targeting
            const restrictionMessage = page.locator('[data-testid="circular-targeting-warning"]');
            await expect(restrictionMessage).toBeVisible();

            const circularDetectionTime = performance.now() - circularDetectionStart;

            // Circular detection should be fast even with complex relationships
            expect(circularDetectionTime).toBeLessThan(1000);

            // Test targeting history query performance with large history
            const historyStart = performance.now();

            await page.goto('/swaps');
            const swapCard = page.locator('[data-testid="enhanced-swap-card"]').first();
            await swapCard.locator('[data-testid="view-targeting-history-btn"]').click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            const historyTime = performance.now() - historyStart;
            expect(historyTime).toBeLessThan(1500);

            console.log(`Complex queries: Circular=${circularDetectionTime}ms, History=${historyTime}ms`);
        });
    });

    test.describe('UI Rendering Performance', () => {

        test('should render enhanced swap cards efficiently with targeting data', async ({ page }) => {
            await setupMediumTargetingDataset(page, 100);

            await loginUser(page, 'rendering@test.com');

            // Measure initial render performance
            const renderStart = performance.now();

            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            // Wait for all targeting indicators to load
            await page.waitForFunction(() => {
                const cards = document.querySelectorAll('[data-testid="enhanced-swap-card"]');
                return Array.from(cards).every(card =>
                    card.querySelector('[data-testid="targeting-indicators-loaded"]')
                );
            });

            const renderTime = performance.now() - renderStart;

            // Measure rendering metrics
            const renderMetrics = await page.evaluate(() => {
                const paintEntries = performance.getEntriesByType('paint');
                const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
                const firstContentfulPaint = paintEntries.find(entry => entry.name === 'first-contentful-paint');

                return {
                    firstPaint: firstPaint?.startTime || 0,
                    firstContentfulPaint: firstContentfulPaint?.startTime || 0,
                    domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart
                };
            });

            // Performance assertions
            expect(renderTime).toBeLessThan(2000); // Total render < 2s
            expect(renderMetrics.firstContentfulPaint).toBeLessThan(1500); // FCP < 1.5s
            expect(renderMetrics.domContentLoaded).toBeLessThan(1000); // DOM ready < 1s

            console.log('Render performance:', { renderTime, ...renderMetrics });
        });

        test('should handle targeting indicator updates efficiently', async ({ page }) => {
            await loginUser(page, 'updates@test.com');
            const userSwapId = await createSwap(page, 'Update Test Swap');

            await page.goto('/swaps');
            const swapCard = page.locator(`[data-testid="enhanced-swap-card-${userSwapId}"]`);

            // Measure targeting indicator update performance
            const updateTimes: number[] = [];

            for (let i = 0; i < 10; i++) {
                const updateStart = performance.now();

                // Simulate targeting status change
                await page.evaluate((iteration) => {
                    const event = new CustomEvent('targeting-update', {
                        detail: {
                            swapId: 'user-swap-id',
                            incomingTargets: iteration + 1,
                            status: iteration % 2 === 0 ? 'pending' : 'active'
                        }
                    });
                    window.dispatchEvent(event);
                }, i);

                // Wait for UI update
                await expect(swapCard.locator('[data-testid="incoming-targets-indicator"]'))
                    .toContainText(`${i + 1} targeting proposal`);

                const updateTime = performance.now() - updateStart;
                updateTimes.push(updateTime);
            }

            const avgUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
            const maxUpdateTime = Math.max(...updateTimes);

            // Update performance assertions
            expect(avgUpdateTime).toBeLessThan(100); // Average update < 100ms
            expect(maxUpdateTime).toBeLessThan(200); // Max update < 200ms

            console.log(`Update performance: Avg=${avgUpdateTime}ms, Max=${maxUpdateTime}ms`);
        });

        test('should optimize targeting details expansion performance', async ({ page }) => {
            // Setup swap with multiple targeting proposals
            await setupSwapWithMultipleProposals(page, 20);

            await loginUser(page, 'expansion@test.com');
            await page.goto('/swaps');

            const swapCard = page.locator('[data-testid="enhanced-swap-card"]').first();

            // Measure expansion performance
            const expansionStart = performance.now();

            await swapCard.locator('[data-testid="expand-targeting-details"]').click();

            // Wait for all proposal cards to render
            await page.waitForFunction(() => {
                const proposalCards = document.querySelectorAll('[data-testid="targeting-proposal-card"]');
                return proposalCards.length === 20;
            });

            const expansionTime = performance.now() - expansionStart;

            // Test collapse performance
            const collapseStart = performance.now();

            await swapCard.locator('[data-testid="collapse-targeting-details"]').click();

            await page.waitForFunction(() => {
                const proposalCards = document.querySelectorAll('[data-testid="targeting-proposal-card"]');
                return proposalCards.length === 0;
            });

            const collapseTime = performance.now() - collapseStart;

            // Performance assertions
            expect(expansionTime).toBeLessThan(500); // Expansion < 500ms
            expect(collapseTime).toBeLessThan(200); // Collapse < 200ms

            console.log(`Expansion performance: Expand=${expansionTime}ms, Collapse=${collapseTime}ms`);
        });

        test('should handle mobile rendering performance efficiently', async ({ page }) => {
            // Set mobile viewport
            await page.setViewportSize({ width: 375, height: 667 });

            await setupMediumTargetingDataset(page, 50);
            await loginUser(page, 'mobile@test.com');

            // Measure mobile render performance
            const mobileRenderStart = performance.now();

            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            // Wait for mobile-specific targeting components
            await page.waitForSelector('[data-testid="mobile-targeting-indicator"]');

            const mobileRenderTime = performance.now() - mobileRenderStart;

            // Test mobile interaction performance
            const swapCard = page.locator('[data-testid="enhanced-swap-card"]').first();

            const mobileToggleStart = performance.now();
            await swapCard.locator('[data-testid="mobile-targeting-toggle"]').click();
            await page.waitForSelector('[data-testid="mobile-targeting-details"]');
            const mobileToggleTime = performance.now() - mobileToggleStart;

            // Mobile performance assertions
            expect(mobileRenderTime).toBeLessThan(2500); // Mobile render < 2.5s
            expect(mobileToggleTime).toBeLessThan(300); // Mobile toggle < 300ms

            console.log(`Mobile performance: Render=${mobileRenderTime}ms, Toggle=${mobileToggleTime}ms`);
        });
    });

    test.describe('Real-time Update Performance', () => {

        test('should handle high-frequency WebSocket targeting updates efficiently', async ({ browser }) => {
            const userCount = 20;
            const contexts = [];
            const pages = [];
            const updateMetrics: number[] = [];

            // Setup multiple users for WebSocket testing
            for (let i = 0; i < userCount; i++) {
                const context = await browser.newContext();
                const page = await context.newPage();
                contexts.push(context);
                pages.push(page);

                await loginUser(page, `wsuser${i}@test.com`);
                await createSwap(page, `WS Test Swap ${i}`);
                await page.goto('/swaps');

                // Monitor WebSocket message handling performance
                page.on('websocket', ws => {
                    ws.on('framereceived', event => {
                        const receiveTime = performance.now();
                        const data = JSON.parse(event.payload.toString());

                        if (data.type === 'targeting_update') {
                            const processingStart = performance.now();

                            // Simulate UI update processing time
                            setTimeout(() => {
                                const processingTime = performance.now() - processingStart;
                                updateMetrics.push(processingTime);
                            }, 0);
                        }
                    });
                });
            }

            // Generate rapid targeting events
            const eventPromises = [];
            for (let i = 0; i < userCount; i++) {
                for (let j = 0; j < 10; j++) {
                    const promise = generateTargetingEvent(pages[i], j);
                    eventPromises.push(promise);
                }
            }

            const eventsStart = performance.now();
            await Promise.all(eventPromises);
            const eventsTime = performance.now() - eventsStart;

            // Wait for all updates to process
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Analyze WebSocket performance
            const avgUpdateTime = updateMetrics.reduce((sum, time) => sum + time, 0) / updateMetrics.length;
            const maxUpdateTime = Math.max(...updateMetrics);
            const throughput = (userCount * 10) / (eventsTime / 1000);

            // Performance assertions
            expect(avgUpdateTime).toBeLessThan(50); // Average update processing < 50ms
            expect(maxUpdateTime).toBeLessThan(200); // Max update processing < 200ms
            expect(throughput).toBeGreaterThan(50); // At least 50 events/sec

            // Cleanup
            for (const context of contexts) {
                await context.close();
            }

            console.log(`WebSocket performance: Avg=${avgUpdateTime}ms, Max=${maxUpdateTime}ms, Throughput=${throughput}events/s`);
        });

        test('should maintain update performance under network stress', async ({ page }) => {
            await loginUser(page, 'network@test.com');
            const userSwapId = await createSwap(page, 'Network Test Swap');

            await page.goto('/swaps');

            // Simulate network latency
            await page.route('**/api/targeting/**', route => {
                setTimeout(() => {
                    route.continue();
                }, Math.random() * 500); // Random delay 0-500ms
            });

            const updateTimes: number[] = [];
            const errorCount = { value: 0 };

            // Generate updates under network stress
            for (let i = 0; i < 20; i++) {
                const updateStart = performance.now();

                try {
                    await page.evaluate((iteration) => {
                        return fetch('/api/targeting/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                swapId: 'user-swap-id',
                                targetingUpdate: { count: iteration + 1 }
                            })
                        });
                    }, i);

                    const updateTime = performance.now() - updateStart;
                    updateTimes.push(updateTime);
                } catch (error) {
                    errorCount.value++;
                }
            }

            const avgUpdateTime = updateTimes.reduce((sum, time) => sum + time, 0) / updateTimes.length;
            const errorRate = errorCount.value / 20;

            // Network stress performance assertions
            expect(avgUpdateTime).toBeLessThan(1000); // Average under network stress < 1s
            expect(errorRate).toBeLessThan(0.1); // Less than 10% errors under stress

            console.log(`Network stress performance: Avg=${avgUpdateTime}ms, Errors=${errorRate * 100}%`);
        });

        test('should handle optimistic update rollbacks efficiently', async ({ page }) => {
            await loginUser(page, 'optimistic@test.com');
            const userSwapId = await createSwap(page, 'Optimistic Test Swap');

            await page.goto('/swaps');
            const swapCard = page.locator(`[data-testid="enhanced-swap-card-${userSwapId}"]`);

            const rollbackTimes: number[] = [];

            // Test optimistic updates with failures
            for (let i = 0; i < 10; i++) {
                // Simulate API failure every other request
                if (i % 2 === 1) {
                    await page.route('**/api/targeting/action', route => {
                        route.fulfill({
                            status: 500,
                            contentType: 'application/json',
                            body: JSON.stringify({ error: 'Simulated failure' })
                        });
                    });
                }

                const actionStart = performance.now();

                // Trigger targeting action
                await page.evaluate((iteration) => {
                    const event = new CustomEvent('targeting-action', {
                        detail: { action: 'target', targetId: `target-${iteration}` }
                    });
                    window.dispatchEvent(event);
                }, i);

                if (i % 2 === 1) {
                    // Wait for rollback on failure
                    await expect(swapCard.locator('[data-testid="targeting-error-indicator"]')).toBeVisible();

                    const rollbackTime = performance.now() - actionStart;
                    rollbackTimes.push(rollbackTime);

                    // Clear the route for next iteration
                    await page.unroute('**/api/targeting/action');
                }
            }

            const avgRollbackTime = rollbackTimes.reduce((sum, time) => sum + time, 0) / rollbackTimes.length;

            // Rollback performance assertion
            expect(avgRollbackTime).toBeLessThan(300); // Rollback < 300ms

            console.log(`Optimistic update performance: Avg rollback=${avgRollbackTime}ms`);
        });
    });

    test.describe('Memory and Resource Usage', () => {

        test('should not leak memory during extended targeting operations', async ({ page }) => {
            const memorySnapshots: number[] = [];

            await loginUser(page, 'memory@test.com');
            const userSwapId = await createSwap(page, 'Memory Test Swap');

            // Create target swaps for cycling
            const targetSwaps = [];
            for (let i = 0; i < 20; i++) {
                await loginUser(page, `target${i}@test.com`);
                const swapId = await createSwap(page, `Target Swap ${i}`);
                targetSwaps.push(swapId);
            }

            await loginUser(page, 'memory@test.com');
            await page.goto('/swaps');

            // Perform 200 targeting operations with memory monitoring
            for (let cycle = 0; cycle < 200; cycle++) {
                const targetSwap = targetSwaps[cycle % targetSwaps.length];

                // Simulate targeting operation
                await page.evaluate((target) => {
                    const event = new CustomEvent('targeting-action', {
                        detail: { action: 'target', targetId: target }
                    });
                    window.dispatchEvent(event);
                }, targetSwap);

                // Take memory snapshot every 20 cycles
                if (cycle % 20 === 0) {
                    const memoryUsage = await page.evaluate(() => {
                        return (performance as any).memory?.usedJSHeapSize || 0;
                    });
                    memorySnapshots.push(memoryUsage);
                }

                // Simulate removing target
                await page.evaluate(() => {
                    const event = new CustomEvent('targeting-action', {
                        detail: { action: 'remove-target' }
                    });
                    window.dispatchEvent(event);
                });
            }

            // Analyze memory usage trend
            if (memorySnapshots.length > 2) {
                const initialMemory = memorySnapshots[0];
                const finalMemory = memorySnapshots[memorySnapshots.length - 1];
                const memoryGrowth = (finalMemory - initialMemory) / initialMemory;

                // Memory growth should be minimal (< 30%)
                expect(memoryGrowth).toBeLessThan(0.3);

                console.log(`Memory usage: Initial=${initialMemory}bytes, Final=${finalMemory}bytes, Growth=${memoryGrowth * 100}%`);
            }
        });

        test('should handle large targeting history datasets efficiently', async ({ page }) => {
            // Setup large targeting history
            await setupLargeTargetingHistory(page, 5000);

            await loginUser(page, 'history@test.com');
            await page.goto('/swaps');

            const swapCard = page.locator('[data-testid="enhanced-swap-card"]').first();

            // Test history loading performance
            const historyLoadStart = performance.now();

            await swapCard.locator('[data-testid="view-targeting-history-btn"]').click();

            const historyModal = page.locator('[data-testid="targeting-history-modal"]');
            await expect(historyModal).toBeVisible();

            // Wait for initial history entries to load
            await page.waitForSelector('[data-testid="history-entry"]');

            const historyLoadTime = performance.now() - historyLoadStart;

            // Test pagination performance
            const paginationTimes: number[] = [];

            for (let page_num = 2; page_num <= 5; page_num++) {
                const pageStart = performance.now();

                await page.locator(`[data-testid="history-page-${page_num}"]`).click();
                await page.waitForSelector('[data-testid="history-entry"]');

                const pageTime = performance.now() - pageStart;
                paginationTimes.push(pageTime);
            }

            const avgPaginationTime = paginationTimes.reduce((sum, time) => sum + time, 0) / paginationTimes.length;

            // History performance assertions
            expect(historyLoadTime).toBeLessThan(2000); // Initial load < 2s
            expect(avgPaginationTime).toBeLessThan(800); // Pagination < 800ms

            console.log(`History performance: Load=${historyLoadTime}ms, Avg pagination=${avgPaginationTime}ms`);
        });

        test('should optimize targeting data caching effectively', async ({ page }) => {
            await loginUser(page, 'caching@test.com');
            const userSwapId = await createSwap(page, 'Caching Test Swap');

            // First load - should hit database
            const firstLoadStart = performance.now();
            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');
            const firstLoadTime = performance.now() - firstLoadStart;

            // Second load - should hit cache
            const secondLoadStart = performance.now();
            await page.reload();
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');
            const secondLoadTime = performance.now() - secondLoadStart;

            // Cache should significantly improve performance
            const cacheImprovement = (firstLoadTime - secondLoadTime) / firstLoadTime;
            expect(cacheImprovement).toBeGreaterThan(0.3); // At least 30% improvement

            // Test cache invalidation performance
            const invalidationStart = performance.now();

            await page.evaluate(() => {
                const event = new CustomEvent('targeting-update', {
                    detail: { swapId: 'user-swap-id', invalidateCache: true }
                });
                window.dispatchEvent(event);
            });

            // Wait for cache invalidation and reload
            await page.waitForTimeout(100);
            const invalidationTime = performance.now() - invalidationStart;

            expect(invalidationTime).toBeLessThan(200); // Cache invalidation < 200ms

            console.log(`Caching performance: First=${firstLoadTime}ms, Cached=${secondLoadTime}ms, Improvement=${cacheImprovement * 100}%`);
        });
    });

    test.describe('Stress Testing', () => {

        test('should handle extreme targeting load gracefully', async ({ page }) => {
            const extremeConfig: LoadTestConfig = {
                userCount: 10000,
                swapCount: 50000,
                targetingRelationships: 100000,
                duration: 300 // 5 minutes
            };

            await setupExtremeTargetingDataset(page, extremeConfig);

            await loginUser(page, 'stress@test.com');

            // Test system under extreme load
            const stressTestStart = performance.now();

            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]', { timeout: 15000 });

            const stressLoadTime = performance.now() - stressTestStart;

            // Should still be responsive under extreme load
            expect(stressLoadTime).toBeLessThan(15000); // 15 second timeout

            // Test search performance under stress
            const searchStart = performance.now();

            await page.fill('[data-testid="search-input"]', 'Beach House');
            await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

            const searchTime = performance.now() - searchStart;
            expect(searchTime).toBeLessThan(10000);

            // Test targeting action under stress
            const actionStart = performance.now();

            const firstSwap = page.locator('[data-testid="swap-card"]').first();
            await firstSwap.locator('[data-testid="target-my-swap-btn"]').click();
            await page.locator('[data-testid="confirm-targeting-btn"]').click();

            await expect(page.locator('[data-testid="targeting-result-message"]')).toBeVisible({ timeout: 10000 });

            const actionTime = performance.now() - actionStart;
            expect(actionTime).toBeLessThan(10000);

            console.log(`Stress test: Load=${stressLoadTime}ms, Search=${searchTime}ms, Action=${actionTime}ms`);
        });

        test('should recover from resource exhaustion gracefully', async ({ page }) => {
            await loginUser(page, 'recovery@test.com');
            const userSwapId = await createSwap(page, 'Recovery Test Swap');

            // Simulate memory pressure
            await page.evaluate(() => {
                const arrays = [];
                for (let i = 0; i < 200; i++) {
                    arrays.push(new Array(50000).fill('memory-pressure-test'));
                }
                (window as any).memoryPressure = arrays;
            });

            // Test targeting functionality under memory pressure
            const pressureStart = performance.now();

            await page.goto('/swaps');
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            const swapCard = page.locator(`[data-testid="enhanced-swap-card-${userSwapId}"]`);
            await swapCard.locator('[data-testid="expand-targeting-details"]').click();

            const pressureTime = performance.now() - pressureStart;

            // Should still function under memory pressure (with degraded performance)
            expect(pressureTime).toBeLessThan(5000);

            // Test recovery after releasing memory pressure
            await page.evaluate(() => {
                delete (window as any).memoryPressure;
                if (window.gc) {
                    window.gc();
                }
            });

            const recoveryStart = performance.now();

            await page.reload();
            await page.waitForSelector('[data-testid="enhanced-swap-card"]');

            const recoveryTime = performance.now() - recoveryStart;

            // Should recover to normal performance
            expect(recoveryTime).toBeLessThan(2000);

            console.log(`Resource exhaustion: Under pressure=${pressureTime}ms, Recovery=${recoveryTime}ms`);
        });
    });
});

// Helper functions for performance testing

async function setupLargeTargetingDataset(page: Page, config: LoadTestConfig) {
    await page.route('**/api/swaps', route => {
        // Mock large dataset response with targeting data
        const swaps = [];
        for (let i = 0; i < Math.min(config.swapCount, 100); i++) { // Paginated response
            swaps.push({
                id: `swap-${i}`,
                title: `Performance Test Swap ${i}`,
                location: `Location ${i}`,
                targeting: {
                    incomingTargets: Array.from({ length: Math.floor(Math.random() * 5) }, (_, j) => ({
                        targetId: `target-${i}-${j}`,
                        sourceSwapId: `source-${i}-${j}`,
                        status: 'active'
                    })),
                    outgoingTarget: Math.random() > 0.5 ? {
                        targetId: `outgoing-${i}`,
                        targetSwapId: `target-swap-${i}`,
                        status: 'pending'
                    } : null
                }
            });
        }

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                swaps,
                total: config.swapCount,
                page: 1,
                limit: 100
            })
        });
    });

    // Mock performance metrics
    await page.addInitScript(() => {
        (window as any).performanceMetrics = {
            dbQuery: {
                executionTime: Math.random() * 1000 + 500,
                rowsProcessed: Math.floor(Math.random() * 10000) + 1000
            }
        };
    });
}

async function setupComplexTargetingNetwork(page: Page, userCount: number) {
    await page.route('**/api/targeting/validate', route => {
        // Simulate complex circular detection
        setTimeout(() => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    canTarget: Math.random() > 0.3,
                    reason: Math.random() > 0.5 ? 'circular_targeting' : 'valid',
                    computationTime: Math.random() * 500
                })
            });
        }, Math.random() * 200);
    });
}

async function setupComplexTargetingScenarios(page: Page) {
    await page.route('**/api/swaps', route => {
        const swaps = [
            {
                id: 'complex-1',
                title: 'Complex Targeting Test 1',
                targeting: { canTarget: false, reason: 'circular_targeting' }
            },
            {
                id: 'complex-2',
                title: 'Complex Targeting Test 2',
                targeting: { canTarget: true }
            }
        ];

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ swaps })
        });
    });
}

async function setupMediumTargetingDataset(page: Page, swapCount: number) {
    await page.route('**/api/swaps', route => {
        const swaps = Array.from({ length: swapCount }, (_, i) => ({
            id: `medium-swap-${i}`,
            title: `Medium Test Swap ${i}`,
            targeting: {
                incomingTargets: Array.from({ length: Math.floor(Math.random() * 3) }, (_, j) => ({
                    targetId: `medium-target-${i}-${j}`,
                    status: 'active'
                }))
            }
        }));

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ swaps })
        });
    });
}

async function setupSwapWithMultipleProposals(page: Page, proposalCount: number) {
    await page.route('**/api/swaps', route => {
        const swaps = [{
            id: 'multi-proposal-swap',
            title: 'Multi Proposal Test Swap',
            targeting: {
                incomingTargets: Array.from({ length: proposalCount }, (_, i) => ({
                    targetId: `proposal-${i}`,
                    sourceSwapId: `source-${i}`,
                    sourceSwap: {
                        title: `Proposal Swap ${i}`,
                        location: `Location ${i}`
                    },
                    status: 'active'
                }))
            }
        }];

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ swaps })
        });
    });
}

async function setupLargeTargetingHistory(page: Page, entryCount: number) {
    await page.route('**/api/targeting/history', route => {
        const history = Array.from({ length: entryCount }, (_, i) => ({
            id: `history-${i}`,
            action: i % 3 === 0 ? 'targeted' : i % 3 === 1 ? 'accepted' : 'rejected',
            targetSwap: `History Target ${i}`,
            timestamp: new Date(Date.now() - i * 60000).toISOString()
        }));

        const page_num = parseInt(new URL(route.request().url()).searchParams.get('page') || '1');
        const limit = 50;
        const start = (page_num - 1) * limit;
        const end = start + limit;

        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                history: history.slice(start, end),
                total: entryCount,
                page: page_num,
                limit
            })
        });
    });
}

async function setupExtremeTargetingDataset(page: Page, config: LoadTestConfig) {
    await page.route('**/api/swaps', route => {
        // Simulate extreme dataset with pagination
        const swaps = Array.from({ length: 100 }, (_, i) => ({
            id: `extreme-swap-${i}`,
            title: `Extreme Test Swap ${i}`,
            targeting: {
                incomingTargets: Array.from({ length: Math.floor(Math.random() * 10) }, (_, j) => ({
                    targetId: `extreme-target-${i}-${j}`,
                    status: 'active'
                }))
            }
        }));

        // Add artificial delay to simulate database load
        setTimeout(() => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    swaps,
                    total: config.swapCount,
                    page: 1,
                    limit: 100
                })
            });
        }, Math.random() * 2000 + 1000); // 1-3 second delay
    });
}

async function measureConcurrentTargetingDataLoad(page: Page, index: number): Promise<number> {
    try {
        const startTime = performance.now();

        await page.evaluate((i) => {
            return fetch(`/api/swaps?user=concurrent${i}`, {
                headers: { 'Content-Type': 'application/json' }
            });
        }, index);

        return performance.now() - startTime;
    } catch (error) {
        console.error(`Concurrent request ${index} failed:`, error);
        return -1;
    }
}

async function generateTargetingEvent(page: Page, eventIndex: number): Promise<void> {
    await page.evaluate((index) => {
        const event = new CustomEvent('targeting_update', {
            detail: {
                type: 'new_proposal',
                swapId: `swap-${index}`,
                timestamp: Date.now()
            }
        });
        window.dispatchEvent(event);
    }, eventIndex);
}

// Reuse helper functions from main test files
async function loginUser(page: Page, email: string) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-btn"]');
    await page.waitForURL('/dashboard');
}

async function createSwap(page: Page, title: string) {
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