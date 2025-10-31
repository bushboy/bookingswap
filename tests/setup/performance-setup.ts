import { beforeAll, afterAll } from 'vitest';

/**
 * Performance Test Setup
 * 
 * Global setup and teardown for performance testing environment
 */

// Performance monitoring utilities
global.performanceMetrics = {
    startTime: 0,
    measurements: new Map(),

    start(label: string) {
        this.measurements.set(label, performance.now());
    },

    end(label: string): number {
        const startTime = this.measurements.get(label);
        if (!startTime) {
            throw new Error(`No start time found for measurement: ${label}`);
        }
        const duration = performance.now() - startTime;
        this.measurements.delete(label);
        return duration;
    },

    measure(label: string, fn: () => Promise<any>): Promise<{ result: any; duration: number }> {
        return new Promise(async (resolve, reject) => {
            try {
                const startTime = performance.now();
                const result = await fn();
                const duration = performance.now() - startTime;
                resolve({ result, duration });
            } catch (error) {
                reject(error);
            }
        });
    }
};

// Memory monitoring utilities
global.memoryMonitor = {
    baseline: null as NodeJS.MemoryUsage | null,

    setBaseline() {
        this.baseline = process.memoryUsage();
    },

    getUsage() {
        return process.memoryUsage();
    },

    getGrowth() {
        if (!this.baseline) {
            throw new Error('No baseline set for memory monitoring');
        }
        const current = process.memoryUsage();
        return {
            heapUsed: current.heapUsed - this.baseline.heapUsed,
            heapTotal: current.heapTotal - this.baseline.heapTotal,
            external: current.external - this.baseline.external,
            rss: current.rss - this.baseline.rss,
        };
    },

    getGrowthPercentage() {
        if (!this.baseline) {
            throw new Error('No baseline set for memory monitoring');
        }
        const current = process.memoryUsage();
        return {
            heapUsed: ((current.heapUsed - this.baseline.heapUsed) / this.baseline.heapUsed) * 100,
            heapTotal: ((current.heapTotal - this.baseline.heapTotal) / this.baseline.heapTotal) * 100,
            external: ((current.external - this.baseline.external) / this.baseline.external) * 100,
            rss: ((current.rss - this.baseline.rss) / this.baseline.rss) * 100,
        };
    }
};

// Database performance utilities
global.dbPerformance = {
    queryTimes: [] as number[],

    recordQuery(duration: number) {
        this.queryTimes.push(duration);
    },

    getStats() {
        if (this.queryTimes.length === 0) {
            return { avg: 0, min: 0, max: 0, count: 0 };
        }

        const sorted = [...this.queryTimes].sort((a, b) => a - b);
        return {
            avg: this.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryTimes.length,
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)],
            count: this.queryTimes.length
        };
    },

    reset() {
        this.queryTimes = [];
    }
};

// Load testing utilities
global.loadTest = {
    async runConcurrent<T>(
        operations: (() => Promise<T>)[],
        options: {
            maxConcurrency?: number;
            timeout?: number;
            retries?: number;
        } = {}
    ): Promise<{
        results: T[];
        errors: Error[];
        metrics: {
            totalTime: number;
            avgTime: number;
            throughput: number;
            successRate: number;
        };
    }> {
        const { maxConcurrency = 10, timeout = 30000, retries = 0 } = options;

        const results: T[] = [];
        const errors: Error[] = [];
        const startTime = performance.now();

        // Execute operations in batches to control concurrency
        for (let i = 0; i < operations.length; i += maxConcurrency) {
            const batch = operations.slice(i, i + maxConcurrency);

            const batchPromises = batch.map(async (operation, index) => {
                let attempts = 0;

                while (attempts <= retries) {
                    try {
                        const timeoutPromise = new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new Error('Operation timeout')), timeout);
                        });

                        const result = await Promise.race([operation(), timeoutPromise]);
                        results.push(result);
                        return;
                    } catch (error) {
                        attempts++;
                        if (attempts > retries) {
                            errors.push(error as Error);
                        }
                    }
                }
            });

            await Promise.allSettled(batchPromises);
        }

        const totalTime = performance.now() - startTime;
        const successCount = results.length;
        const totalOperations = operations.length;

        return {
            results,
            errors,
            metrics: {
                totalTime,
                avgTime: totalTime / totalOperations,
                throughput: successCount / (totalTime / 1000),
                successRate: successCount / totalOperations
            }
        };
    }
};

// Performance assertion helpers
global.expectPerformance = {
    toBeFasterThan(actualMs: number, expectedMs: number, operation?: string) {
        if (actualMs > expectedMs) {
            throw new Error(
                `Performance assertion failed${operation ? ` for ${operation}` : ''}: ` +
                `Expected ${actualMs}ms to be less than ${expectedMs}ms`
            );
        }
    },

    toHaveThroughputGreaterThan(actualOpsPerSec: number, expectedOpsPerSec: number, operation?: string) {
        if (actualOpsPerSec < expectedOpsPerSec) {
            throw new Error(
                `Throughput assertion failed${operation ? ` for ${operation}` : ''}: ` +
                `Expected ${actualOpsPerSec} ops/sec to be greater than ${expectedOpsPerSec} ops/sec`
            );
        }
    },

    toHaveSuccessRateGreaterThan(actualRate: number, expectedRate: number, operation?: string) {
        if (actualRate < expectedRate) {
            throw new Error(
                `Success rate assertion failed${operation ? ` for ${operation}` : ''}: ` +
                `Expected ${actualRate * 100}% to be greater than ${expectedRate * 100}%`
            );
        }
    },

    toHaveMemoryGrowthLessThan(actualGrowthPercent: number, maxGrowthPercent: number, operation?: string) {
        if (actualGrowthPercent > maxGrowthPercent) {
            throw new Error(
                `Memory growth assertion failed${operation ? ` for ${operation}` : ''}: ` +
                `Expected ${actualGrowthPercent}% growth to be less than ${maxGrowthPercent}%`
            );
        }
    }
};

beforeAll(async () => {
    console.log('🚀 Starting performance test suite...');

    // Set memory baseline
    global.memoryMonitor.setBaseline();

    // Enable garbage collection if available
    if (global.gc) {
        global.gc();
    }

    // Setup performance monitoring
    global.performanceMetrics.startTime = performance.now();

    // Log system information
    console.log('📊 System Information:');
    console.log(`  Node.js: ${process.version}`);
    console.log(`  Platform: ${process.platform} ${process.arch}`);
    console.log(`  Memory: ${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB heap`);
    console.log(`  CPUs: ${require('os').cpus().length}`);
});

afterAll(async () => {
    const totalTime = performance.now() - global.performanceMetrics.startTime;

    console.log('🏁 Performance test suite completed');
    console.log(`⏱️  Total execution time: ${Math.round(totalTime)}ms`);

    // Log memory usage
    const memoryGrowth = global.memoryMonitor.getGrowth();
    console.log('💾 Memory Usage:');
    console.log(`  Heap growth: ${Math.round(memoryGrowth.heapUsed / 1024 / 1024)}MB`);
    console.log(`  RSS growth: ${Math.round(memoryGrowth.rss / 1024 / 1024)}MB`);

    // Log database performance if available
    const dbStats = global.dbPerformance.getStats();
    if (dbStats.count > 0) {
        console.log('🗄️  Database Performance:');
        console.log(`  Queries executed: ${dbStats.count}`);
        console.log(`  Average query time: ${Math.round(dbStats.avg)}ms`);
        console.log(`  95th percentile: ${Math.round(dbStats.p95)}ms`);
    }

    // Final garbage collection
    if (global.gc) {
        global.gc();
    }
});

// Extend global types for TypeScript
declare global {
    var performanceMetrics: {
        startTime: number;
        measurements: Map<string, number>;
        start(label: string): void;
        end(label: string): number;
        measure<T>(label: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }>;
    };

    var memoryMonitor: {
        baseline: NodeJS.MemoryUsage | null;
        setBaseline(): void;
        getUsage(): NodeJS.MemoryUsage;
        getGrowth(): NodeJS.MemoryUsage;
        getGrowthPercentage(): NodeJS.MemoryUsage;
    };

    var dbPerformance: {
        queryTimes: number[];
        recordQuery(duration: number): void;
        getStats(): {
            avg: number;
            min: number;
            max: number;
            median: number;
            p95: number;
            p99: number;
            count: number;
        };
        reset(): void;
    };

    var loadTest: {
        runConcurrent<T>(
            operations: (() => Promise<T>)[],
            options?: {
                maxConcurrency?: number;
                timeout?: number;
                retries?: number;
            }
        ): Promise<{
            results: T[];
            errors: Error[];
            metrics: {
                totalTime: number;
                avgTime: number;
                throughput: number;
                successRate: number;
            };
        }>;
    };

    var expectPerformance: {
        toBeFasterThan(actualMs: number, expectedMs: number, operation?: string): void;
        toHaveThroughputGreaterThan(actualOpsPerSec: number, expectedOpsPerSec: number, operation?: string): void;
        toHaveSuccessRateGreaterThan(actualRate: number, expectedRate: number, operation?: string): void;
        toHaveMemoryGrowthLessThan(actualGrowthPercent: number, maxGrowthPercent: number, operation?: string): void;
    };
}