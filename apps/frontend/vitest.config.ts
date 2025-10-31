/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@booking-swap/shared': path.resolve(
        __dirname,
        '../../packages/shared/src'
      ),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        // Specific thresholds for critical files
        'src/services/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/store/': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95,
        },
        'src/components/': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules/', 'dist/', '.idea/', '.git/', '.cache/'],
    // Test timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    // Reporters
    reporter: ['verbose'],
    // Performance settings
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // Mock settings
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    // Watch settings
    watch: false,
    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      VITE_API_URL: 'http://localhost:3001/api',
      VITE_WS_URL: 'http://localhost:3001',
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
