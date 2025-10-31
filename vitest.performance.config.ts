import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        name: 'performance',
        globals: true,
        environment: 'node',
        testTimeout: 60000, // 60 seconds for performance tests
        hookTimeout: 30000,
        include: [
            'tests/load/**/*.spec.ts',
            'apps/backend/tests/performance/**/*.test.ts'
        ],
        exclude: [
            'node_modules/',
            'dist/',
            '.idea/',
            '.git/',
            '.cache/'
        ],
        // Performance test specific settings
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: false,
                maxThreads: 8, // Use more threads for performance testing
                minThreads: 2,
            },
        },
        // Reporters for performance analysis
        reporter: [
            'verbose',
            'json',
            ['html', { outputFile: 'test-results/performance-report.html' }],
            ['junit', { outputFile: 'test-results/performance-results.xml' }]
        ],
        // Coverage settings for performance tests
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            reportsDirectory: './coverage/performance',
            include: [
                'apps/backend/src/services/SwapTargetingService.ts',
                'apps/backend/src/repositories/SwapTargetingRepository.ts',
                'apps/frontend/src/services/SwapTargetingService.ts',
                'apps/frontend/src/store/slices/targetingSlice.ts'
            ],
            thresholds: {
                global: {
                    branches: 70,
                    functions: 80,
                    lines: 80,
                    statements: 80,
                },
            },
        },
        // Environment variables for performance tests
        env: {
            NODE_ENV: 'test',
            TEST_DATABASE_URL: 'postgresql://test:test@localhost:5432/swap_targeting_perf_test',
            PERFORMANCE_TEST: 'true',
            LOG_LEVEL: 'error', // Reduce logging during performance tests
        },
        // Setup files for performance testing
        setupFiles: [
            './tests/setup/performance-setup.ts'
        ],
        // Benchmark settings
        benchmark: {
            include: ['**/*.bench.ts'],
            exclude: ['node_modules/**/*'],
            reporters: ['verbose'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './apps/backend/src'),
            '@frontend': path.resolve(__dirname, './apps/frontend/src'),
            '@booking-swap/shared': path.resolve(__dirname, './packages/shared/src'),
        },
    },
});