import { beforeAll, afterAll } from 'vitest';
import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(__dirname, '../../.env.test') });

// Global test setup for Hedera integration tests
beforeAll(async () => {
  // Validate required environment variables
  const requiredEnvVars = [
    'HEDERA_NETWORK',
    'HEDERA_ACCOUNT_ID', 
    'HEDERA_PRIVATE_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for Hedera integration tests: ${missingVars.join(', ')}\n` +
      'Please ensure your .env.test file contains valid Hedera testnet credentials.'
    );
  }

  // Validate account ID format
  const accountIdPattern = /^\d+\.\d+\.\d+$/;
  if (!accountIdPattern.test(process.env.HEDERA_ACCOUNT_ID!)) {
    throw new Error(
      `Invalid HEDERA_ACCOUNT_ID format: ${process.env.HEDERA_ACCOUNT_ID}\n` +
      'Expected format: 0.0.123456'
    );
  }

  // Validate network
  if (!['testnet', 'mainnet'].includes(process.env.HEDERA_NETWORK!)) {
    throw new Error(
      `Invalid HEDERA_NETWORK: ${process.env.HEDERA_NETWORK}\n` +
      'Must be either "testnet" or "mainnet"'
    );
  }

  console.log('Hedera integration test environment validated successfully');
  console.log(`Network: ${process.env.HEDERA_NETWORK}`);
  console.log(`Account: ${process.env.HEDERA_ACCOUNT_ID}`);
});

afterAll(async () => {
  // Global cleanup if needed
  console.log('Hedera integration tests completed');
});