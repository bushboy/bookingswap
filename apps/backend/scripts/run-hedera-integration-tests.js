#!/usr/bin/env node

/**
 * Hedera Integration Test Runner
 * 
 * This script runs the comprehensive Hedera NFT debugging integration tests
 * with proper environment validation and error handling.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateEnvironment() {
  log('🔍 Validating test environment...', 'cyan');
  
  const envFile = path.join(__dirname, '../.env.test');
  if (!fs.existsSync(envFile)) {
    log('❌ .env.test file not found', 'red');
    log('Please create .env.test with your Hedera testnet credentials', 'yellow');
    return false;
  }

  // Load environment variables
  require('dotenv').config({ path: envFile });

  const requiredVars = [
    'HEDERA_NETWORK',
    'HEDERA_ACCOUNT_ID',
    'HEDERA_PRIVATE_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    log('❌ Missing required environment variables:', 'red');
    missingVars.forEach(varName => {
      log(`   - ${varName}`, 'red');
    });
    return false;
  }

  // Validate account ID format
  const accountIdPattern = /^\d+\.\d+\.\d+$/;
  if (!accountIdPattern.test(process.env.HEDERA_ACCOUNT_ID)) {
    log(`❌ Invalid HEDERA_ACCOUNT_ID format: ${process.env.HEDERA_ACCOUNT_ID}`, 'red');
    log('Expected format: 0.0.123456', 'yellow');
    return false;
  }

  // Validate network
  if (process.env.HEDERA_NETWORK !== 'testnet') {
    log(`❌ Invalid HEDERA_NETWORK: ${process.env.HEDERA_NETWORK}`, 'red');
    log('Integration tests only run on testnet', 'yellow');
    return false;
  }

  log('✅ Environment validation passed', 'green');
  log(`   Network: ${process.env.HEDERA_NETWORK}`, 'blue');
  log(`   Account: ${process.env.HEDERA_ACCOUNT_ID}`, 'blue');
  
  return true;
}

function runTests(testPattern = null) {
  return new Promise((resolve, reject) => {
    log('🚀 Starting Hedera integration tests...', 'cyan');
    
    const args = [
      'run',
      '--config',
      'vitest.hedera-integration.config.ts'
    ];

    if (testPattern) {
      args.push('-t', testPattern);
    }

    const testProcess = spawn('npx', ['vitest', ...args], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ All tests completed successfully!', 'green');
        resolve(code);
      } else {
        log(`❌ Tests failed with exit code ${code}`, 'red');
        reject(new Error(`Tests failed with exit code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      log(`❌ Failed to start test process: ${error.message}`, 'red');
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const testPattern = args[1];

  log('🧪 Hedera NFT Debugging Integration Test Runner', 'bright');
  log('================================================', 'bright');

  try {
    switch (command) {
      case 'validate':
        if (validateEnvironment()) {
          log('✅ Environment is ready for testing', 'green');
          process.exit(0);
        } else {
          log('❌ Environment validation failed', 'red');
          process.exit(1);
        }
        break;

      case 'run':
        if (!validateEnvironment()) {
          process.exit(1);
        }
        await runTests(testPattern);
        break;

      case 'help':
      case '--help':
      case '-h':
        log('Usage:', 'bright');
        log('  node run-hedera-integration-tests.js validate', 'cyan');
        log('    Validate environment setup without running tests', 'yellow');
        log('');
        log('  node run-hedera-integration-tests.js run [pattern]', 'cyan');
        log('    Run integration tests (optionally filter by pattern)', 'yellow');
        log('');
        log('Examples:', 'bright');
        log('  node run-hedera-integration-tests.js run', 'cyan');
        log('  node run-hedera-integration-tests.js run "Error Scenarios"', 'cyan');
        log('  node run-hedera-integration-tests.js run "NFT Lifecycle"', 'cyan');
        break;

      default:
        // Default behavior: validate and run tests
        if (!validateEnvironment()) {
          process.exit(1);
        }
        await runTests();
        break;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\n🛑 Test execution interrupted', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n🛑 Test execution terminated', 'yellow');
  process.exit(143);
});

// Run the main function
main().catch((error) => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});