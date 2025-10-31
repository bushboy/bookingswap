#!/usr/bin/env node

/**
 * Simple integration test for the Hedera Diagnostics CLI
 * This script tests basic CLI functionality without requiring full Hedera setup
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Hedera Diagnostics CLI...');

const cliScript = path.join(__dirname, '..', 'hedera-diagnostics.ts');
const projectRoot = path.join(__dirname, '..', '..');

/**
 * Run a CLI command and capture output
 */
function runCLICommand(args, expectSuccess = true) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Running: npx tsx ${cliScript} ${args.join(' ')}`);
    
    const child = spawn('npx', ['tsx', cliScript, ...args], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      const result = {
        code,
        stdout,
        stderr,
        success: expectSuccess ? code === 0 : code !== 0
      };

      if (result.success) {
        console.log('✅ Command completed successfully');
        if (stdout.trim()) {
          console.log('📤 Output:', stdout.trim().substring(0, 200) + (stdout.length > 200 ? '...' : ''));
        }
      } else {
        console.log(`❌ Command failed with code ${code}`);
        if (stderr.trim()) {
          console.log('📤 Error:', stderr.trim().substring(0, 200) + (stderr.length > 200 ? '...' : ''));
        }
      }

      resolve(result);
    });

    child.on('error', (error) => {
      console.log('❌ Command error:', error.message);
      reject(error);
    });
  });
}

/**
 * Main test function
 */
async function runTests() {
  const tests = [
    {
      name: 'Help Command',
      args: ['--help'],
      expectSuccess: true,
      description: 'Test basic help output'
    },
    {
      name: 'Version Command',
      args: ['--version'],
      expectSuccess: true,
      description: 'Test version output'
    },
    {
      name: 'Test Subcommand Help',
      args: ['test', '--help'],
      expectSuccess: true,
      description: 'Test subcommand help'
    },
    {
      name: 'Report Command Help',
      args: ['report', '--help'],
      expectSuccess: true,
      description: 'Test report command help'
    },
    {
      name: 'Health Check (Expected to Fail)',
      args: ['health-check'],
      expectSuccess: false,
      description: 'Test health check without proper configuration (should fail gracefully)'
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  console.log(`\n🎯 Running ${totalTests} CLI tests...\n`);

  for (const test of tests) {
    console.log(`\n🔍 Test: ${test.name}`);
    console.log(`📝 Description: ${test.description}`);

    try {
      const result = await runCLICommand(test.args, test.expectSuccess);
      
      if (result.success) {
        console.log(`✅ ${test.name} - PASSED`);
        passedTests++;
      } else {
        console.log(`❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
    }

    // Add a small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`\n📊 Test Results:`);
  console.log(`   Passed: ${passedTests}/${totalTests}`);
  console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  if (passedTests === totalTests) {
    console.log('\n🎉 All CLI tests passed!');
    console.log('💡 The CLI tool is ready for use.');
  } else {
    console.log('\n⚠️  Some CLI tests failed.');
    console.log('💡 Check the output above for details.');
  }

  console.log('\n📚 Next Steps:');
  console.log('   1. Set up your Hedera account credentials in .env');
  console.log('   2. Run: npm run hedera-diagnostics health-check');
  console.log('   3. Run: npm run hedera-diagnostics report');
  console.log('   4. Check the CLI README for detailed usage instructions');

  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests };