#!/usr/bin/env tsx

/**
 * Comprehensive Test Runner for Booking-Swap Separation Functionality
 * 
 * This script runs all tests related to the separated booking edit and swap specification
 * functionality, providing detailed reporting and coverage analysis.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  timeout?: number;
}

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  coverage?: number;
  errors?: string[];
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests - BookingEditForm',
    pattern: 'src/components/booking/__tests__/BookingEditForm.separated.test.tsx',
    description: 'Tests for booking-only validation and focused interface',
    timeout: 30000,
  },
  {
    name: 'Unit Tests - BookingSwapSpecificationPage',
    pattern: 'src/pages/__tests__/BookingSwapSpecificationPage.test.tsx',
    description: 'Tests for swap-specific logic and interface',
    timeout: 30000,
  },
  {
    name: 'Integration Tests - Navigation',
    pattern: 'src/__tests__/integration/BookingSwapSeparation.integration.test.tsx',
    description: 'Tests for navigation between separated interfaces',
    timeout: 45000,
  },
  {
    name: 'Error Handling Tests',
    pattern: 'src/__tests__/error-handling/BookingSwapSeparationErrors.test.tsx',
    description: 'Tests for error handling and state preservation',
    timeout: 30000,
  },
];

const E2E_TESTS = [
  {
    name: 'E2E Tests - Booking-Swap Separation',
    pattern: 'tests/e2e/booking-swap-separation.spec.ts',
    description: 'End-to-end tests for complete user workflows',
    timeout: 120000,
  },
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  constructor(private verbose: boolean = false) {}

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Booking-Swap Separation Tests\n');
    console.log('=' .repeat(80));
    console.log('Test Suite: Booking Edit and Swap Specification Separation');
    console.log('Coverage: Unit, Integration, E2E, and Error Handling Tests');
    console.log('=' .repeat(80));
    console.log();

    // Run unit and integration tests
    for (const suite of TEST_SUITES) {
      await this.runTestSuite(suite);
    }

    // Run E2E tests if Playwright is available
    if (this.isPlaywrightAvailable()) {
      for (const suite of E2E_TESTS) {
        await this.runE2ETest(suite);
      }
    } else {
      console.log('⚠️  Playwright not available, skipping E2E tests');
    }

    this.printSummary();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`\n📋 Running: ${suite.name}`);
    console.log(`   ${suite.description}`);
    console.log(`   Pattern: ${suite.pattern}`);
    
    const startTime = Date.now();
    
    try {
      // Check if test file exists
      const testPath = path.resolve(suite.pattern);
      if (!existsSync(testPath)) {
        console.log(`   ❌ Test file not found: ${testPath}`);
        this.results.push({
          suite: suite.name,
          passed: false,
          duration: 0,
          errors: [`Test file not found: ${testPath}`],
        });
        return;
      }

      // Run the test with coverage
      const command = [
        'npx vitest run',
        `"${suite.pattern}"`,
        '--reporter=verbose',
        '--coverage',
        '--coverage.reporter=text',
        '--coverage.reporter=json-summary',
        `--testTimeout=${suite.timeout || 30000}`,
        this.verbose ? '--verbose' : '',
      ].filter(Boolean).join(' ');

      if (this.verbose) {
        console.log(`   Command: ${command}`);
      }

      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: suite.timeout || 30000,
      });

      const duration = Date.now() - startTime;
      
      // Parse coverage from output
      const coverage = this.parseCoverage(output);
      
      console.log(`   ✅ Passed in ${duration}ms`);
      if (coverage !== undefined) {
        console.log(`   📊 Coverage: ${coverage}%`);
      }

      this.results.push({
        suite: suite.name,
        passed: true,
        duration,
        coverage,
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      
      console.log(`   ❌ Failed in ${duration}ms`);
      console.log(`   Error: ${errorMessage}`);
      
      if (this.verbose && error.stdout) {
        console.log('   Output:', error.stdout);
      }

      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        errors: [errorMessage],
      });
    }
  }

  private async runE2ETest(suite: TestSuite): Promise<void> {
    console.log(`\n🎭 Running: ${suite.name}`);
    console.log(`   ${suite.description}`);
    
    const startTime = Date.now();
    
    try {
      const command = [
        'npx playwright test',
        suite.pattern,
        '--reporter=line',
        `--timeout=${suite.timeout || 120000}`,
        this.verbose ? '--verbose' : '',
      ].filter(Boolean).join(' ');

      if (this.verbose) {
        console.log(`   Command: ${command}`);
      }

      const output = execSync(command, { 
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: suite.timeout || 120000,
      });

      const duration = Date.now() - startTime;
      
      console.log(`   ✅ Passed in ${duration}ms`);

      this.results.push({
        suite: suite.name,
        passed: true,
        duration,
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMessage = error.message || 'Unknown error';
      
      console.log(`   ❌ Failed in ${duration}ms`);
      console.log(`   Error: ${errorMessage}`);

      this.results.push({
        suite: suite.name,
        passed: false,
        duration,
        errors: [errorMessage],
      });
    }
  }

  private parseCoverage(output: string): number | undefined {
    // Try to parse coverage from vitest output
    const coverageMatch = output.match(/All files\s+\|\s+(\d+(?:\.\d+)?)/);
    if (coverageMatch) {
      return parseFloat(coverageMatch[1]);
    }
    
    // Try to parse from JSON summary if available
    try {
      const jsonMatch = output.match(/coverage-summary\.json/);
      if (jsonMatch) {
        // This would require reading the actual JSON file
        // For now, return undefined
      }
    } catch {
      // Ignore JSON parsing errors
    }
    
    return undefined;
  }

  private isPlaywrightAvailable(): boolean {
    try {
      execSync('npx playwright --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed} ✅`);
    console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log();

    // Print individual results
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const coverage = result.coverage ? ` (${result.coverage}% coverage)` : '';
      console.log(`${status} ${result.suite} - ${result.duration}ms${coverage}`);
      
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          console.log(`   Error: ${error}`);
        });
      }
    });

    // Print coverage summary
    const coverageResults = this.results.filter(r => r.coverage !== undefined);
    if (coverageResults.length > 0) {
      const avgCoverage = coverageResults.reduce((sum, r) => sum + (r.coverage || 0), 0) / coverageResults.length;
      console.log(`\n📊 Average Coverage: ${avgCoverage.toFixed(1)}%`);
    }

    // Print recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    if (failed > 0) {
      console.log('• Fix failing tests before proceeding with implementation');
      console.log('• Review error messages and stack traces for debugging');
    }
    
    const lowCoverageTests = this.results.filter(r => r.coverage !== undefined && r.coverage < 80);
    if (lowCoverageTests.length > 0) {
      console.log('• Improve test coverage for the following suites:');
      lowCoverageTests.forEach(test => {
        console.log(`  - ${test.suite}: ${test.coverage}%`);
      });
    }
    
    if (passed === total) {
      console.log('• All tests passing! Ready for implementation ✨');
      console.log('• Consider adding more edge case tests');
      console.log('• Review test coverage and add missing scenarios');
    }

    console.log('\n🎯 NEXT STEPS');
    console.log('-'.repeat(40));
    console.log('1. Review test results and fix any failures');
    console.log('2. Ensure all requirements are covered by tests');
    console.log('3. Run tests regularly during implementation');
    console.log('4. Update tests as implementation evolves');
    console.log('5. Add performance benchmarks for critical paths');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log('Booking-Swap Separation Test Runner');
    console.log('');
    console.log('Usage: tsx runSeparatedTests.ts [options]');
    console.log('');
    console.log('Options:');
    console.log('  --verbose, -v    Show detailed output');
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Test Suites:');
    TEST_SUITES.forEach(suite => {
      console.log(`  • ${suite.name}: ${suite.description}`);
    });
    E2E_TESTS.forEach(suite => {
      console.log(`  • ${suite.name}: ${suite.description}`);
    });
    process.exit(0);
  }

  const runner = new TestRunner(verbose);
  await runner.runAllTests();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  });
}

export { TestRunner, TEST_SUITES, E2E_TESTS };