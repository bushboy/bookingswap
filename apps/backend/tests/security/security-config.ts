import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface SecurityTestConfig {
  targetUrl: string;
  testTimeout: number;
  maxConcurrentRequests: number;
  vulnerabilityThreshold: 'low' | 'medium' | 'high';
}

export const defaultSecurityConfig: SecurityTestConfig = {
  targetUrl: process.env.TEST_TARGET_URL || 'http://localhost:3000',
  testTimeout: 30000,
  maxConcurrentRequests: 10,
  vulnerabilityThreshold: 'medium'
};

export class SecurityTestRunner {
  private config: SecurityTestConfig;

  constructor(config: SecurityTestConfig = defaultSecurityConfig) {
    this.config = config;
  }

  async runNmapScan(): Promise<string> {
    try {
      const { stdout } = await execAsync(`nmap -sV -sC ${this.config.targetUrl.replace('http://', '').replace('https://', '')}`);
      return stdout;
    } catch (error) {
      console.warn('Nmap not available, skipping network scan');
      return 'Nmap scan skipped - tool not available';
    }
  }

  async runSSLScan(): Promise<string> {
    if (!this.config.targetUrl.startsWith('https://')) {
      return 'SSL scan skipped - not HTTPS';
    }

    try {
      const { stdout } = await execAsync(`sslscan ${this.config.targetUrl}`);
      return stdout;
    } catch (error) {
      console.warn('SSLScan not available, skipping SSL analysis');
      return 'SSL scan skipped - tool not available';
    }
  }

  async runDirBuster(): Promise<string[]> {
    const commonPaths = [
      '/admin',
      '/api/docs',
      '/api/swagger',
      '/debug',
      '/test',
      '/.env',
      '/config',
      '/backup',
      '/logs',
      '/.git',
      '/node_modules',
      '/package.json',
      '/yarn.lock',
      '/composer.json',
      '/web.config',
      '/.htaccess',
      '/robots.txt',
      '/sitemap.xml'
    ];

    const foundPaths: string[] = [];

    for (const path of commonPaths) {
      try {
        const response = await fetch(`${this.config.targetUrl}${path}`);
        if (response.status !== 404) {
          foundPaths.push(`${path} - Status: ${response.status}`);
        }
      } catch (error) {
        // Path not accessible
      }
    }

    return foundPaths;
  }

  async testCommonVulnerabilities(): Promise<{ [key: string]: boolean }> {
    const vulnerabilities: { [key: string]: boolean } = {};

    // Test for common headers
    try {
      const response = await fetch(this.config.targetUrl);
      const headers = response.headers;

      vulnerabilities['missing_security_headers'] = !headers.get('x-content-type-options');
      vulnerabilities['server_disclosure'] = !!headers.get('server');
      vulnerabilities['x_powered_by_disclosure'] = !!headers.get('x-powered-by');
      vulnerabilities['missing_hsts'] = !headers.get('strict-transport-security');
      vulnerabilities['missing_csp'] = !headers.get('content-security-policy');
    } catch (error) {
      console.error('Failed to test headers:', error);
    }

    return vulnerabilities;
  }

  async generateSecurityReport(): Promise<string> {
    const report = {
      timestamp: new Date().toISOString(),
      target: this.config.targetUrl,
      scans: {
        nmap: await this.runNmapScan(),
        ssl: await this.runSSLScan(),
        directories: await this.runDirBuster(),
        vulnerabilities: await this.testCommonVulnerabilities()
      }
    };

    return JSON.stringify(report, null, 2);
  }
}

// Security test utilities
export const SecurityTestUtils = {
  generateMaliciousPayloads: () => ({
    xss: [
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert("XSS")',
      '<svg onload="alert(1)">',
      '"><script>alert("XSS")</script>'
    ],
    sqlInjection: [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "1' OR '1'='1' --",
      "admin'--"
    ],
    pathTraversal: [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      '....//....//....//etc/passwd'
    ],
    commandInjection: [
      '; ls -la',
      '| whoami',
      '&& cat /etc/passwd',
      '`id`',
      '$(whoami)'
    ],
    ldapInjection: [
      '*)(uid=*',
      '*)(|(uid=*))',
      '*)(&(uid=*))',
      '*))%00'
    ]
  }),

  generateFuzzingData: () => ({
    longStrings: [
      'A'.repeat(1000),
      'A'.repeat(10000),
      'A'.repeat(100000)
    ],
    specialCharacters: [
      '!@#$%^&*()_+-=[]{}|;:,.<>?',
      '\\x00\\x01\\x02\\x03\\x04\\x05',
      'üñíçødé',
      '🚀🔥💯'
    ],
    nullBytes: [
      '\\x00',
      '%00',
      '\\0'
    ],
    formatStrings: [
      '%s%s%s%s%s',
      '%x%x%x%x%x',
      '%n%n%n%n%n'
    ]
  }),

  validateSecurityHeaders: (headers: Headers) => {
    const requiredHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': /max-age=\d+/,
      'content-security-policy': /.+/
    };

    const issues: string[] = [];

    for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
      const actualValue = headers.get(header);
      
      if (!actualValue) {
        issues.push(`Missing security header: ${header}`);
        continue;
      }

      if (Array.isArray(expectedValue)) {
        if (!expectedValue.includes(actualValue)) {
          issues.push(`Invalid ${header}: ${actualValue}, expected one of: ${expectedValue.join(', ')}`);
        }
      } else if (expectedValue instanceof RegExp) {
        if (!expectedValue.test(actualValue)) {
          issues.push(`Invalid ${header}: ${actualValue}, expected pattern: ${expectedValue}`);
        }
      } else if (actualValue !== expectedValue) {
        issues.push(`Invalid ${header}: ${actualValue}, expected: ${expectedValue}`);
      }
    }

    return issues;
  },

  testRateLimiting: async (url: string, requests: number = 100, timeWindow: number = 1000) => {
    const startTime = Date.now();
    const promises = Array(requests).fill(null).map(() => fetch(url));
    
    try {
      const responses = await Promise.all(promises);
      const endTime = Date.now();
      
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const successCount = responses.filter(r => r.status < 400).length;
      
      return {
        totalRequests: requests,
        rateLimitedRequests: rateLimitedCount,
        successfulRequests: successCount,
        duration: endTime - startTime,
        rateLimitingActive: rateLimitedCount > 0
      };
    } catch (error) {
      return {
        error: 'Failed to complete rate limiting test',
        details: error
      };
    }
  }
};

// Export test configuration for use in other test files
export { defaultSecurityConfig as securityConfig };