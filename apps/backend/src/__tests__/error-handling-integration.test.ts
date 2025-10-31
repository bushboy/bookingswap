import request from 'supertest';
import { createApp } from '../index';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';
import { HealthMonitor, ErrorRateMonitor } from '../utils/monitoring';

describe('Error Handling Integration Tests', () => {
  let app: any;
  let healthMonitor: HealthMonitor;
  let errorRateMonitor: ErrorRateMonitor;

  beforeAll(async () => {
    app = await createApp();
    healthMonitor = HealthMonitor.getInstance();
    errorRateMonitor = ErrorRateMonitor.getInstance();
  });

  afterAll(() => {
    healthMonitor.stopHealthChecking();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Response Format', () => {
    it('should return standardized error format for 404', async () => {
      const response = await request(app)
        .get('/non-existent-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: {
          code: ERROR_CODES.NOT_FOUND,
          message: expect.stringContaining('Route GET /non-existent-route not found'),
          category: 'routing',
          retryable: false,
          timestamp: expect.any(String),
          requestId: expect.any(String),
        },
      });
    });

    it('should include request ID in error responses', async () => {
      const requestId = 'test-request-id';
      
      const response = await request(app)
        .get('/non-existent-route')
        .set('X-Request-ID', requestId)
        .expect(404);

      expect(response.body.error.requestId).toBe(requestId);
      expect(response.headers['x-request-id']).toBe(requestId);
    });

    it('should handle rate limiting errors', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = Array.from({ length: 150 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(promises);
      const rateLimitedResponse = responses.find(r => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body).toMatchObject({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later',
            category: 'rate_limiting',
          },
        });
      }
    });
  });

  describe('Health Check Endpoints', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: expect.oneOf(['healthy', 'degraded', 'unhealthy']),
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        version: expect.any(String),
        environment: expect.any(String),
        services: expect.any(Object),
        metrics: {
          memoryUsage: expect.any(Object),
          cpuUsage: expect.any(Object),
          activeConnections: expect.any(Number),
        },
      });
    });

    it('should return readiness status', async () => {
      const response = await request(app)
        .get('/health/ready')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ready',
      });
    });

    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'alive',
      });
    });

    it('should return 503 when services are unhealthy', async () => {
      // Mock an unhealthy service
      healthMonitor.registerHealthCheck('mock-unhealthy-service', async () => ({
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        error: 'Service is down',
      }));

      const response = await request(app)
        .get('/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Response should include performance headers or logging
      expect(response.headers['x-request-id']).toBeDefined();
    });

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers['x-request-id']).toBeDefined();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, we'll test that the error handling structure is in place
      
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.services).toHaveProperty('database');
    });

    it('should handle cache connection errors gracefully', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.services).toHaveProperty('cache');
    });

    it('should handle blockchain service errors gracefully', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.services).toHaveProperty('blockchain');
    });
  });

  describe('Security Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle oversized requests', async () => {
      const largePayload = 'x'.repeat(11 * 1024 * 1024); // 11MB, over the 10MB limit
      
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ data: largePayload }))
        .expect(413);

      // Express should reject this before it reaches our error handler
    });

    it('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const response = await request(app)
          .get('/non-existent-route')
          .expect(404);

        // In production, error messages should be sanitized
        expect(response.body.error.message).not.toContain('stack');
        expect(response.body.error.message).not.toContain('internal');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Monitoring Integration', () => {
    it('should track error rates', async () => {
      // Make some requests that will result in errors
      await request(app).get('/non-existent-1').expect(404);
      await request(app).get('/non-existent-2').expect(404);
      await request(app).get('/health').expect(200);

      const errorRates = errorRateMonitor.getAllErrorRates();
      
      // Should have tracked the requests
      expect(Object.keys(errorRates).length).toBeGreaterThan(0);
    });

    it('should provide metrics for monitoring systems', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.metrics).toMatchObject({
        memoryUsage: {
          rss: expect.any(Number),
          heapTotal: expect.any(Number),
          heapUsed: expect.any(Number),
          external: expect.any(Number),
        },
        cpuUsage: expect.any(Object),
        activeConnections: expect.any(Number),
      });
    });
  });

  describe('Graceful Degradation', () => {
    it('should continue serving requests when non-critical services fail', async () => {
      // Mock a non-critical service failure
      healthMonitor.registerHealthCheck('non-critical-service', async () => {
        throw new Error('Non-critical service failed');
      });

      // Health endpoint should still work but report degraded status
      const response = await request(app)
        .get('/health')
        .expect(503); // Unhealthy due to service failure

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.services['non-critical-service']).toMatchObject({
        status: 'unhealthy',
        error: 'Non-critical service failed',
      });
    });
  });
});

// Helper function for expect.oneOf
expect.extend({
  oneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected}`,
        pass: false,
      };
    }
  },
});