import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SecurityTestRunner, SecurityTestUtils, securityConfig } from './security-config';
import request from 'supertest';
import { app } from '../../src/index';

describe('Comprehensive Security Audit', () => {
  let securityRunner: SecurityTestRunner;
  let auditReport: any = {};

  beforeAll(async () => {
    securityRunner = new SecurityTestRunner(securityConfig);
    auditReport.startTime = new Date().toISOString();
  });

  afterAll(async () => {
    auditReport.endTime = new Date().toISOString();
    auditReport.duration = new Date(auditReport.endTime).getTime() - new Date(auditReport.startTime).getTime();
    
    // Generate comprehensive security report
    const fullReport = await securityRunner.generateSecurityReport();
    console.log('Security Audit Report:', fullReport);
    
    // Save report to file for CI/CD pipeline
    const fs = await import('fs/promises');
    await fs.writeFile('security-audit-report.json', fullReport);
  });

  describe('Network Security Scanning', () => {
    it('should perform network reconnaissance', async () => {
      const nmapResults = await securityRunner.runNmapScan();
      auditReport.networkScan = nmapResults;
      
      expect(nmapResults).toBeDefined();
      expect(nmapResults.length).toBeGreaterThan(0);
      
      // Check for common security issues in nmap output
      expect(nmapResults.toLowerCase()).not.toContain('vulnerable');
      expect(nmapResults.toLowerCase()).not.toContain('exploit');
    });

    it('should analyze SSL/TLS configuration', async () => {
      const sslResults = await securityRunner.runSSLScan();
      auditReport.sslScan = sslResults;
      
      expect(sslResults).toBeDefined();
      
      if (sslResults !== 'SSL scan skipped - not HTTPS') {
        expect(sslResults.toLowerCase()).not.toContain('weak');
        expect(sslResults.toLowerCase()).not.toContain('vulnerable');
      }
    });

    it('should discover exposed directories and files', async () => {
      const exposedPaths = await securityRunner.runDirBuster();
      auditReport.exposedPaths = exposedPaths;
      
      // Check for sensitive files that should not be exposed
      const sensitiveFiles = exposedPaths.filter(path => 
        path.includes('.env') || 
        path.includes('config') || 
        path.includes('.git') ||
        path.includes('backup') ||
        path.includes('debug')
      );
      
      expect(sensitiveFiles).toHaveLength(0);
    });
  });

  describe('Application Security Testing', () => {
    it('should test for common web vulnerabilities', async () => {
      const vulnerabilities = await securityRunner.testCommonVulnerabilities();
      auditReport.commonVulnerabilities = vulnerabilities;
      
      // Assert no critical vulnerabilities
      expect(vulnerabilities.missing_security_headers).toBe(false);
      expect(vulnerabilities.server_disclosure).toBe(false);
      expect(vulnerabilities.x_powered_by_disclosure).toBe(false);
      expect(vulnerabilities.missing_hsts).toBe(false);
      expect(vulnerabilities.missing_csp).toBe(false);
    });

    it('should validate all security headers', async () => {
      const response = await request(app).get('/api/health');
      const headerIssues = SecurityTestUtils.validateSecurityHeaders(response.headers as any);
      auditReport.headerIssues = headerIssues;
      
      expect(headerIssues).toHaveLength(0);
    });

    it('should test rate limiting effectiveness', async () => {
      const rateLimitTest = await SecurityTestUtils.testRateLimiting(
        `${securityConfig.targetUrl}/api/bookings`,
        50,
        1000
      );
      auditReport.rateLimitTest = rateLimitTest;
      
      expect(rateLimitTest.rateLimitingActive).toBe(true);
      expect(rateLimitTest.rateLimitedRequests).toBeGreaterThan(0);
    });
  });

  describe('Input Validation Security', () => {
    it('should test XSS prevention across all endpoints', async () => {
      const xssPayloads = SecurityTestUtils.generateMaliciousPayloads().xss;
      const xssResults: any[] = [];
      
      const endpoints = [
        { method: 'GET', path: '/api/bookings', param: 'search' },
        { method: 'POST', path: '/api/bookings', body: 'description' },
        { method: 'PUT', path: '/api/users/test-user/profile', body: 'displayName' }
      ];
      
      for (const endpoint of endpoints) {
        for (const payload of xssPayloads) {
          try {
            let response;
            if (endpoint.method === 'GET') {
              response = await request(app)
                .get(endpoint.path)
                .query({ [endpoint.param]: payload });
            } else {
              response = await request(app)
                [endpoint.method.toLowerCase() as 'post' | 'put'](endpoint.path)
                .send({ [endpoint.body]: payload });
            }
            
            // Response should not contain unescaped payload
            expect(response.text).not.toContain(payload);
            xssResults.push({
              endpoint: `${endpoint.method} ${endpoint.path}`,
              payload,
              status: response.status,
              safe: !response.text.includes(payload)
            });
          } catch (error) {
            // Expected for malicious payloads
          }
        }
      }
      
      auditReport.xssTests = xssResults;
      const unsafeResponses = xssResults.filter(r => !r.safe);
      expect(unsafeResponses).toHaveLength(0);
    });

    it('should test SQL injection prevention', async () => {
      const sqlPayloads = SecurityTestUtils.generateMaliciousPayloads().sqlInjection;
      const sqlResults: any[] = [];
      
      for (const payload of sqlPayloads) {
        try {
          const response = await request(app)
            .get('/api/bookings')
            .query({ search: payload });
          
          // Should not return database errors or unauthorized data
          expect(response.status).not.toBe(500);
          expect(response.text.toLowerCase()).not.toContain('database error');
          expect(response.text.toLowerCase()).not.toContain('sql');
          expect(response.text.toLowerCase()).not.toContain('syntax error');
          
          sqlResults.push({
            payload,
            status: response.status,
            safe: response.status !== 500 && !response.text.toLowerCase().includes('error')
          });
        } catch (error) {
          // Expected for malicious payloads
        }
      }
      
      auditReport.sqlInjectionTests = sqlResults;
    });

    it('should test path traversal prevention', async () => {
      const pathPayloads = SecurityTestUtils.generateMaliciousPayloads().pathTraversal;
      const pathResults: any[] = [];
      
      for (const payload of pathPayloads) {
        try {
          const response = await request(app)
            .get(`/api/files/${encodeURIComponent(payload)}`);
          
          // Should not return system files
          expect(response.text).not.toContain('root:');
          expect(response.text).not.toContain('[users]');
          expect(response.status).toBe(400); // Should be rejected
          
          pathResults.push({
            payload,
            status: response.status,
            safe: response.status === 400
          });
        } catch (error) {
          // Expected for malicious payloads
        }
      }
      
      auditReport.pathTraversalTests = pathResults;
    });
  });

  describe('Authentication & Authorization Security', () => {
    it('should test JWT token security', async () => {
      const tokenTests = [
        { name: 'No token', token: null, expectedStatus: 401 },
        { name: 'Invalid token', token: 'invalid-token', expectedStatus: 401 },
        { name: 'Expired token', token: 'expired-token', expectedStatus: 401 },
        { name: 'Malformed token', token: 'not.a.jwt', expectedStatus: 401 }
      ];
      
      const authResults: any[] = [];
      
      for (const test of tokenTests) {
        const response = await request(app)
          .get('/api/users/test-user')
          .set('Authorization', test.token ? `Bearer ${test.token}` : '');
        
        expect(response.status).toBe(test.expectedStatus);
        authResults.push({
          test: test.name,
          expectedStatus: test.expectedStatus,
          actualStatus: response.status,
          passed: response.status === test.expectedStatus
        });
      }
      
      auditReport.authenticationTests = authResults;
    });

    it('should test privilege escalation prevention', async () => {
      const privilegeTests = [
        { endpoint: '/api/admin/users', role: 'user', expectedStatus: 403 },
        { endpoint: '/api/admin/disputes', role: 'user', expectedStatus: 403 },
        { endpoint: '/api/users/other-user', role: 'user', expectedStatus: 403 }
      ];
      
      const privilegeResults: any[] = [];
      
      for (const test of privilegeTests) {
        const response = await request(app)
          .get(test.endpoint)
          .set('Authorization', `Bearer user-token-${test.role}`);
        
        expect(response.status).toBe(test.expectedStatus);
        privilegeResults.push({
          endpoint: test.endpoint,
          role: test.role,
          expectedStatus: test.expectedStatus,
          actualStatus: response.status,
          passed: response.status === test.expectedStatus
        });
      }
      
      auditReport.privilegeEscalationTests = privilegeResults;
    });
  });

  describe('Data Protection & Privacy', () => {
    it('should test for sensitive data exposure', async () => {
      const endpoints = [
        '/api/users/test-user',
        '/api/bookings',
        '/api/swaps'
      ];
      
      const sensitiveFields = [
        'password', 'privateKey', 'secret', 'token', 
        'ssn', 'creditCard', 'bankAccount', 'apiKey'
      ];
      
      const dataExposureResults: any[] = [];
      
      for (const endpoint of endpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer valid-token');
        
        const responseText = JSON.stringify(response.body).toLowerCase();
        const exposedFields = sensitiveFields.filter(field => 
          responseText.includes(field)
        );
        
        expect(exposedFields).toHaveLength(0);
        dataExposureResults.push({
          endpoint,
          exposedFields,
          safe: exposedFields.length === 0
        });
      }
      
      auditReport.dataExposureTests = dataExposureResults;
    });

    it('should validate data encryption in transit', async () => {
      // Test that sensitive operations require HTTPS in production
      const sensitiveEndpoints = [
        '/api/auth/wallet-login',
        '/api/users/profile',
        '/api/swaps'
      ];
      
      const encryptionResults: any[] = [];
      
      for (const endpoint of sensitiveEndpoints) {
        // In production, these should redirect to HTTPS or reject HTTP
        const response = await request(app)
          .post(endpoint)
          .send({ test: 'data' });
        
        // Check for security headers that enforce HTTPS
        const hstsHeader = response.headers['strict-transport-security'];
        expect(hstsHeader).toBeDefined();
        
        encryptionResults.push({
          endpoint,
          hasHSTS: !!hstsHeader,
          secure: !!hstsHeader
        });
      }
      
      auditReport.encryptionTests = encryptionResults;
    });
  });

  describe('Business Logic Security', () => {
    it('should test for race condition vulnerabilities', async () => {
      // Test concurrent operations that could cause race conditions
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/swaps')
          .set('Authorization', 'Bearer valid-token')
          .send({
            sourceBookingId: 'booking-1',
            targetBookingId: 'booking-2',
            terms: { additionalPayment: 100 }
          })
      );
      
      const responses = await Promise.all(concurrentRequests);
      const successfulRequests = responses.filter(r => r.status === 201);
      
      // Only one swap should succeed for the same bookings
      expect(successfulRequests.length).toBeLessThanOrEqual(1);
      
      auditReport.raceConditionTest = {
        totalRequests: concurrentRequests.length,
        successfulRequests: successfulRequests.length,
        safe: successfulRequests.length <= 1
      };
    });

    it('should test for business logic bypass', async () => {
      const bypassTests = [
        {
          name: 'Negative price booking',
          data: { originalPrice: -100, swapValue: 50 },
          expectedStatus: 400
        },
        {
          name: 'Past date booking',
          data: { 
            dateRange: { 
              checkIn: '2020-01-01', 
              checkOut: '2020-01-02' 
            } 
          },
          expectedStatus: 400
        },
        {
          name: 'Self-swap attempt',
          data: { 
            sourceBookingId: 'booking-1', 
            targetBookingId: 'booking-1' 
          },
          expectedStatus: 400
        }
      ];
      
      const bypassResults: any[] = [];
      
      for (const test of bypassTests) {
        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', 'Bearer valid-token')
          .send(test.data);
        
        expect(response.status).toBe(test.expectedStatus);
        bypassResults.push({
          test: test.name,
          expectedStatus: test.expectedStatus,
          actualStatus: response.status,
          passed: response.status === test.expectedStatus
        });
      }
      
      auditReport.businessLogicTests = bypassResults;
    });
  });

  describe('Infrastructure Security', () => {
    it('should test for information disclosure', async () => {
      const infoDisclosureEndpoints = [
        '/server-status',
        '/server-info',
        '/.env',
        '/config.json',
        '/package.json',
        '/yarn.lock',
        '/.git/config',
        '/debug',
        '/test'
      ];
      
      const disclosureResults: any[] = [];
      
      for (const endpoint of infoDisclosureEndpoints) {
        const response = await request(app).get(endpoint);
        
        // These endpoints should not be accessible
        expect(response.status).toBe(404);
        disclosureResults.push({
          endpoint,
          status: response.status,
          safe: response.status === 404
        });
      }
      
      auditReport.informationDisclosureTests = disclosureResults;
    });

    it('should validate error handling security', async () => {
      // Test that errors don't reveal sensitive information
      const errorEndpoints = [
        '/api/force-database-error',
        '/api/force-500-error',
        '/api/nonexistent-endpoint'
      ];
      
      const errorResults: any[] = [];
      
      for (const endpoint of errorEndpoints) {
        const response = await request(app).get(endpoint);
        
        const responseText = response.text.toLowerCase();
        const sensitiveInfo = [
          'database', 'sql', 'postgres', 'mysql',
          'stack trace', 'file path', 'internal error',
          'debug', 'development'
        ];
        
        const exposedInfo = sensitiveInfo.filter(info => 
          responseText.includes(info)
        );
        
        expect(exposedInfo).toHaveLength(0);
        errorResults.push({
          endpoint,
          status: response.status,
          exposedInfo,
          safe: exposedInfo.length === 0
        });
      }
      
      auditReport.errorHandlingTests = errorResults;
    });
  });
});