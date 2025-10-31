import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'hedera-integration',
    include: ['**/*hedera*integration.test.ts'],
    globals: true,
    environment: 'node',
    testTimeout: 300000, // 5 minutes for complex Hedera operations
    hookTimeout: 60000,  // 1 minute for setup/teardown
    // setupFiles: ['./src/test-setup/hedera-integration.setup.ts'],
    env: {
      NODE_ENV: 'test',
      HEDERA_NETWORK: 'testnet'
    },
    pool: 'forks', // Use separate processes for isolation
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially to avoid Hedera rate limits
      }
    },
    retry: 1, // Retry failed tests once due to network issues
    bail: 5,  // Stop after 5 failures to avoid excessive API calls
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