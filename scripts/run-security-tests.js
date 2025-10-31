#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

class SecurityTestRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };
  }

  async runTests() {
    console.log('🔒 Starting comprehensive security test suite...\n');

    try {
      // Run unit security tests
      await this.runUnitSecurityTests();
      
      // Run integration security tests
      await this.runIntegrationSecurityTests();
      
      // Run static analysis
      await this.runStaticAnalysis();
      
      // Run dependency vulnerability scan
      await this.runDependencyVulnerabilityScan();
      
      // Generate final report
      await this.generateReport();
      
      console.log('\n✅ Security test suite completed successfully!');
      
      if (this.results.summary.critical > 0 || this.results.summary.high > 0) {
        console.error(`❌ Critical security issues found: ${this.results.summary.critical} critical, ${this.results.summary.high} high`);
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Security test suite failed:', error.message);
      process.exit(1);
    }
  }

  async runUnitSecurityTests() {
    console.log('🧪 Running unit security tests...');
    
    const testFiles = [
      'apps/backend/tests/security/vulnerabilities/sql-injection.test.ts',
      'apps/backend/tests/security/vulnerabilities/authentication.test.ts',
      'apps/backend/tests/security/vulnerabilities/input-validation.test.ts',
      'apps/backend/tests/security/vulnerabilities/smart-contract.test.ts',
      'apps/backend/tests/security/api-security.test.ts'
    ];

    for (const testFile of testFiles) {
      try {
        const result = await this.runVitest(testFile);
        this.results.tests[testFile] = result;
        console.log(`  ✅ ${path.basename(testFile)}: ${result.passed}/${result.total} tests passed`);
      } catch (error) {
        console.error(`  ❌ ${path.basename(testFile)}: Failed to run tests`);
        this.results.tests[testFile] = { error: error.message };
      }
    }
  }

  async runIntegrationSecurityTests() {
    console.log('\n🔗 Running integration security tests...');
    
    try {
      const result = await this.runVitest('apps/backend/tests/security/security-audit.test.ts');
      this.results.tests['security-audit'] = result;
      console.log(`  ✅ Security audit: ${result.passed}/${result.total} tests passed`);
    } catch (error) {
      console.error('  ❌ Security audit: Failed to run tests');
      this.results.tests['security-audit'] = { error: error.message };
    }
  }

  async runStaticAnalysis() {
    console.log('\n🔍 Running static security analysis...');
    
    try {
      // Run ESLint security rules
      const eslintResult = await this.runCommand('npx', ['eslint', '--ext', '.ts,.js', '--config', '.eslintrc.security.json', 'apps/']);
      this.results.tests['eslint-security'] = eslintResult;
      console.log('  ✅ ESLint security analysis completed');
      
      // Run Semgrep if available
      try {
        const semgrepResult = await this.runCommand('semgrep', ['--config=auto', '--json', 'apps/']);
        this.results.tests['semgrep'] = JSON.parse(semgrepResult.stdout);
        console.log('  ✅ Semgrep security analysis completed');
      } catch (error) {
        console.log('  ⚠️  Semgrep not available, skipping advanced static analysis');
      }
      
    } catch (error) {
      console.error('  ❌ Static analysis failed:', error.message);
    }
  }

  async runDependencyVulnerabilityScan() {
    console.log('\n📦 Running dependency vulnerability scan...');
    
    try {
      // Run npm audit
      const auditResult = await this.runCommand('npm', ['audit', '--json']);
      const auditData = JSON.parse(auditResult.stdout);
      this.results.tests['npm-audit'] = auditData;
      
      const vulnerabilities = auditData.vulnerabilities || {};
      const vulnCount = Object.keys(vulnerabilities).length;
      
      if (vulnCount > 0) {
        console.log(`  ⚠️  Found ${vulnCount} dependency vulnerabilities`);
        
        // Count by severity
        Object.values(vulnerabilities).forEach(vuln => {
          const severity = vuln.severity;
          if (this.results.summary[severity] !== undefined) {
            this.results.summary[severity]++;
          }
        });
      } else {
        console.log('  ✅ No dependency vulnerabilities found');
      }
      
      // Run Snyk if available
      try {
        const snykResult = await this.runCommand('snyk', ['test', '--json']);
        this.results.tests['snyk'] = JSON.parse(snykResult.stdout);
        console.log('  ✅ Snyk vulnerability scan completed');
      } catch (error) {
        console.log('  ⚠️  Snyk not available, skipping advanced vulnerability scan');
      }
      
    } catch (error) {
      console.error('  ❌ Dependency vulnerability scan failed:', error.message);
    }
  }

  async runVitest(testFile) {
    return new Promise((resolve, reject) => {
      const vitest = spawn('npx', ['vitest', 'run', testFile, '--reporter=json'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      vitest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      vitest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      vitest.on('close', (code) => {
        try {
          const result = JSON.parse(stdout);
          resolve({
            total: result.numTotalTests || 0,
            passed: result.numPassedTests || 0,
            failed: result.numFailedTests || 0,
            success: code === 0
          });
        } catch (error) {
          reject(new Error(`Failed to parse test results: ${error.message}`));
        }
      });

      vitest.on('error', (error) => {
        reject(error);
      });
    });
  }

  async runCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        });
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async generateReport() {
    console.log('\n📊 Generating security report...');
    
    // Calculate summary statistics
    Object.values(this.results.tests).forEach(test => {
      if (test.total) {
        this.results.summary.total += test.total;
        this.results.summary.passed += test.passed;
        this.results.summary.failed += test.failed;
      }
    });

    // Generate HTML report
    const htmlReport = this.generateHTMLReport();
    await fs.writeFile('security-report.html', htmlReport);
    
    // Generate JSON report
    await fs.writeFile('security-report.json', JSON.stringify(this.results, null, 2));
    
    // Generate summary for CI/CD
    const summary = {
      status: this.results.summary.critical === 0 && this.results.summary.high === 0 ? 'PASS' : 'FAIL',
      total_tests: this.results.summary.total,
      passed_tests: this.results.summary.passed,
      failed_tests: this.results.summary.failed,
      critical_issues: this.results.summary.critical,
      high_issues: this.results.summary.high,
      medium_issues: this.results.summary.medium,
      low_issues: this.results.summary.low
    };
    
    await fs.writeFile('security-summary.json', JSON.stringify(summary, null, 2));
    
    console.log('  ✅ Security reports generated:');
    console.log('    - security-report.html (detailed HTML report)');
    console.log('    - security-report.json (machine-readable report)');
    console.log('    - security-summary.json (CI/CD summary)');
    
    // Print summary
    console.log('\n📈 Security Test Summary:');
    console.log(`  Total Tests: ${this.results.summary.total}`);
    console.log(`  Passed: ${this.results.summary.passed}`);
    console.log(`  Failed: ${this.results.summary.failed}`);
    console.log(`  Critical Issues: ${this.results.summary.critical}`);
    console.log(`  High Issues: ${this.results.summary.high}`);
    console.log(`  Medium Issues: ${this.results.summary.medium}`);
    console.log(`  Low Issues: ${this.results.summary.low}`);
  }

  generateHTMLReport() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .critical { border-left: 5px solid #dc3545; }
        .high { border-left: 5px solid #fd7e14; }
        .medium { border-left: 5px solid #ffc107; }
        .low { border-left: 5px solid #28a745; }
        .test-results { margin: 20px 0; }
        .test-item { background: #f8f9fa; margin: 10px 0; padding: 15px; border-radius: 5px; }
        .pass { border-left: 5px solid #28a745; }
        .fail { border-left: 5px solid #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 Security Test Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
        <p>Status: ${this.results.summary.critical === 0 && this.results.summary.high === 0 ? '✅ PASS' : '❌ FAIL'}</p>
    </div>
    
    <div class="summary">
        <div class="metric critical">
            <h3>${this.results.summary.critical}</h3>
            <p>Critical</p>
        </div>
        <div class="metric high">
            <h3>${this.results.summary.high}</h3>
            <p>High</p>
        </div>
        <div class="metric medium">
            <h3>${this.results.summary.medium}</h3>
            <p>Medium</p>
        </div>
        <div class="metric low">
            <h3>${this.results.summary.low}</h3>
            <p>Low</p>
        </div>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        ${Object.entries(this.results.tests).map(([name, result]) => `
            <div class="test-item ${result.success ? 'pass' : 'fail'}">
                <h3>${name}</h3>
                <p>Tests: ${result.total || 0} | Passed: ${result.passed || 0} | Failed: ${result.failed || 0}</p>
                ${result.error ? `<p style="color: red;">Error: ${result.error}</p>` : ''}
            </div>
        `).join('')}
    </div>
    
    <div class="footer">
        <p><small>Generated by Booking Swap Platform Security Test Suite</small></p>
    </div>
</body>
</html>
    `;
  }
}

// Run the security test suite
if (require.main === module) {
  const runner = new SecurityTestRunner();
  runner.runTests().catch(console.error);
}

module.exports = SecurityTestRunner;