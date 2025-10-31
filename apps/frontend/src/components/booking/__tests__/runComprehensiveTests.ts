#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Booking Swap UI Simplification
 * 
 * This script runs all test suites for the booking swap UI simplification feature
 * and generates a comprehensive test report.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
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
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
  errors?: string[];
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - UnifiedBookingForm',
    pattern: 'src/components/booking/__tests__/UnifiedBookingForm.comprehensive.test.tsx',
    description: 'Comprehensive unit tests for the unified booking form component',
    timeout: 30000,
  },
  {
    name: 'Unit Tests - InlineProposalForm',
    pattern: 'src/components/booking/__tests__/InlineProposalForm.comprehensive.test.tsx',
    description: 'Comprehensive unit tests for the inline proposal form component',
    timeout: 30000,
  },
  {
    name: 'Integration Tests - Booking-Swap Workflow',
    pattern: 'src/components/booking/__tests__/BookingSwapWorkflow.integration.test.tsx',
    description: 'Integration tests for the complete booking-swap workflow',
    timeout: 60000,
  },
  {
    name: 'Performance Tests - Large Booking Lists',
    pattern: 'src/components/booking/__tests__/BookingListPerformance.test.tsx',
    description: 'Performance tests for handling large booking lists with swap information',
    timeout: 120000,
  },
  {
    name: 'Accessibility Tests - Keyboard Navigation & Screen Readers',
    pattern: 'src/components/booking/__tests__/BookingSwapAccessibility.test.tsx',
    description: 'Accessibility tests for keyboard navigation and screen reader support',
    timeout: 45000,
  },
];

const e2eTestSuites: TestSuite[] = [
  {
    name: 'E2E Tests - Complete User Journeys',
    pattern: 'tests/e2e/booking-swap-ui-simplification.spec.ts',
    description: 'End-to-end tests for complete user journeys',
    timeout: 300000,
  },
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private endTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Comprehensive Test Suite for Booking Swap UI Simplification\n');
    
    this.startTime = Date.now();

    // Run unit and integration tests
    console.log('📋 Running Unit and Integration Tests...\n');
    for (const suite of testSuites) {
      await this.runTestSuite(suite, 'vitest');
    }

    // Run E2E tests
    console.log('\n🎭 Running End-to-End Tests...\n');
    for (const suite of e2eTestSuites) {
      await this.runTestSuite(suite, 'playwright');
    }

    this.endTime = Date.now();

    // Generate reports
    this.generateReport();
    this.generateCoverageReport();
    this.generatePerformanceReport();
  }

  private async runTestSuite(suite: TestSuite, runner: 'vitest' | 'playwright'): Promise<void> {
    console.log(`\n📝 Running: ${suite.name}`);
    console.log(`   ${suite.description}`);
    console.log(`   Pattern: ${suite.pattern}`);

    const startTime = Date.now();
    let passed = false;
    const errors: string[] = [];

    try {
      if (runner === 'vitest') {
        await this.runVitestSuite(suite);
      } else {
        await this.runPlaywrightSuite(suite);
      }
      passed = true;
      console.log(`   ✅ PASSED`);
    } catch (error) {
      console.log(`   ❌ FAILED`);
      errors.push(error instanceof Error ? error.message : String(error));
      console.log(`   Error: ${errors[0]}`);
    }

    const duration = Date.now() - startTime;
    
    this.results.push({
      suite: suite.name,
      passed,
      duration,
      errors,
    });

    console.log(`   ⏱️  Duration: ${duration}ms`);
  }

  private async runVitestSuite(suite: TestSuite): Promise<void> {
    const command = [
      'npx vitest run',
      `--testTimeout=${suite.timeout || 30000}`,
      '--coverage',
      '--reporter=json',
      '--reporter=verbose',
      `"${suite.pattern}"`,
    ].join(' ');

    execSync(command, {
      stdio: 'pipe',
      cwd: process.cwd(),
      timeout: suite.timeout || 30000,
    });
  }

  private async runPlaywrightSuite(suite: TestSuite): Promise<void> {
    const command = [
      'npx playwright test',
      `--timeout=${suite.timeout || 30000}`,
      '--reporter=json',
      `"${suite.pattern}"`,
    ].join(' ');

    execSync(command, {
      stdio: 'pipe',
      cwd: process.cwd(),
      timeout: suite.timeout || 30000,
    });
  }

  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.endTime - this.startTime;

    const report = {
      summary: {
        totalTests,
        passedTests,
        failedTests,
        successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
        totalDuration: `${totalDuration}ms`,
        timestamp: new Date().toISOString(),
      },
      results: this.results,
      testSuites: [
        ...testSuites.map(suite => ({
          ...suite,
          type: 'unit/integration',
        })),
        ...e2eTestSuites.map(suite => ({
          ...suite,
          type: 'e2e',
        })),
      ],
    };

    // Ensure test-results directory exists
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true });
    }

    // Write JSON report
    writeFileSync(
      path.join(resultsDir, 'comprehensive-test-report.json'),
      JSON.stringify(report, null, 2)
    );

    // Write HTML report
    const htmlReport = this.generateHtmlReport(report);
    writeFileSync(
      path.join(resultsDir, 'comprehensive-test-report.html'),
      htmlReport
    );

    // Console summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST REPORT');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ${failedTests > 0 ? '❌' : '✅'}`);
    console.log(`Success Rate: ${report.summary.successRate}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log('='.repeat(80));

    if (failedTests > 0) {
      console.log('\n❌ FAILED TESTS:');
      this.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   • ${result.suite}`);
          result.errors?.forEach(error => {
            console.log(`     Error: ${error}`);
          });
        });
    }

    console.log(`\n📄 Detailed reports saved to: ${resultsDir}`);
  }

  private generateHtmlReport(report: any): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Swap UI Simplification - Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { padding: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #1e40af; }
        .metric-label { color: #64748b; margin-top: 5px; }
        .test-suite { margin-bottom: 20px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .suite-header { background: #f1f5f9; padding: 15px; border-bottom: 1px solid #e2e8f0; }
        .suite-name { font-weight: bold; color: #1e293b; }
        .suite-description { color: #64748b; margin-top: 5px; }
        .suite-status { float: right; padding: 4px 12px; border-radius: 20px; font-size: 0.875em; font-weight: bold; }
        .status-passed { background: #dcfce7; color: #166534; }
        .status-failed { background: #fecaca; color: #dc2626; }
        .suite-details { padding: 15px; }
        .error { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 10px; margin-top: 10px; color: #dc2626; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Booking Swap UI Simplification</h1>
            <h2>Comprehensive Test Report</h2>
            <p>Generated on ${new Date(report.summary.timestamp).toLocaleString()}</p>
        </div>
        
        <div class="content">
            <div class="summary">
                <div class="metric">
                    <div class="metric-value">${report.summary.totalTests}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #059669">${report.summary.passedTests}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #dc2626">${report.summary.totalTests - report.summary.passedTests}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.summary.successRate}</div>
                    <div class="metric-label">Success Rate</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.summary.totalDuration}</div>
                    <div class="metric-label">Total Duration</div>
                </div>
            </div>

            <h3>Test Suites</h3>
            ${report.results.map((result: TestResult) => `
                <div class="test-suite">
                    <div class="suite-header">
                        <span class="suite-status ${result.passed ? 'status-passed' : 'status-failed'}">
                            ${result.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        <div class="suite-name">${result.suite}</div>
                        <div class="suite-description">
                            ${testSuites.concat(e2eTestSuites).find(s => s.name === result.suite)?.description || ''}
                        </div>
                    </div>
                    <div class="suite-details">
                        <p><strong>Duration:</strong> ${result.duration}ms</p>
                        ${result.errors && result.errors.length > 0 ? `
                            <div class="error">
                                <strong>Errors:</strong>
                                <ul>
                                    ${result.errors.map(error => `<li>${error}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;
  }

  private generateCoverageReport(): void {
    console.log('\n📈 Generating Coverage Report...');
    
    try {
      // Run coverage analysis
      execSync('npx vitest run --coverage --reporter=json', {
        stdio: 'pipe',
        cwd: process.cwd(),
      });
      
      console.log('   ✅ Coverage report generated');
    } catch (error) {
      console.log('   ⚠️  Coverage report generation failed');
    }
  }

  private generatePerformanceReport(): void {
    console.log('\n⚡ Generating Performance Report...');
    
    const performanceResults = this.results.filter(r => 
      r.suite.includes('Performance') || r.suite.includes('E2E')
    );

    const performanceReport = {
      timestamp: new Date().toISOString(),
      results: performanceResults,
      benchmarks: {
        unitTestMaxDuration: 30000,
        integrationTestMaxDuration: 60000,
        e2eTestMaxDuration: 300000,
        performanceTestMaxDuration: 120000,
      },
      recommendations: this.generatePerformanceRecommendations(performanceResults),
    };

    const resultsDir = path.join(process.cwd(), 'test-results');
    writeFileSync(
      path.join(resultsDir, 'performance-report.json'),
      JSON.stringify(performanceReport, null, 2)
    );

    console.log('   ✅ Performance report generated');
  }

  private generatePerformanceRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    results.forEach(result => {
      if (result.duration > 60000) {
        recommendations.push(
          `Consider optimizing ${result.suite} - duration exceeded 60 seconds (${result.duration}ms)`
        );
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('All tests completed within acceptable time limits');
    }

    return recommendations;
  }
}

// Run the comprehensive test suite
async function main() {
  const runner = new TestRunner();
  
  try {
    await runner.runAllTests();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { TestRunner, testSuites, e2eTestSuites };