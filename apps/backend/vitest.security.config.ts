import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000, // Longer timeout for security tests
    hookTimeout: 30000,
    include: ['tests/security/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@booking-swap/shared': path.resolve(
        __dirname,
        '../../packages/shared/src'
      ),
    },
  },
});