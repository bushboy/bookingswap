#!/usr/bin/env node

/**
 * Simple validation script to check if the integration test file compiles
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Validating Hedera integration test compilation...');

const testFile = 'src/services/hedera/__tests__/hedera-nft-debugging.integration.test.ts';

// Try to compile the test file with TypeScript
const tscProcess = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck', testFile], {
  stdio: 'inherit',
  cwd: __dirname
});

tscProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Integration test file compiles successfully!');
    
    // Now try to run a dry-run of the test
    console.log('🧪 Running test dry-run...');
    
    const vitestProcess = spawn('npx', ['vitest', 'run', '--reporter=verbose', '--dry-run', testFile], {
      stdio: 'inherit',
      cwd: __dirname
    });
    
    vitestProcess.on('close', (vitestCode) => {
      if (vitestCode === 0) {
        console.log('✅ Integration test structure is valid!');
        process.exit(0);
      } else {
        console.log('❌ Integration test structure has issues');
        process.exit(1);
      }
    });
    
  } else {
    console.log('❌ Integration test file has compilation errors');
    process.exit(1);
  }
});

tscProcess.on('error', (error) => {
  console.error('❌ Failed to run TypeScript compiler:', error.message);
  process.exit(1);
});