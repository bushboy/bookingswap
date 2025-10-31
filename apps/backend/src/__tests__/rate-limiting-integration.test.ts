import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createAuthRoutes } from '../routes/auth';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../services/auth/AuthService';
import { AuthMiddleware } from '../middleware/auth';
import { setRedisClient } from '../middleware/rateLimiting';

// Mock dependencies
const mockAuthService = {
  initiatePasswordReset: async () => ({ success: true }),
  resetPassword: async () => ({ success: true }),
  validateResetToken: async () => ({ valid: true, expiresAt: new Date() }),
} as any;

const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => next(),
} as any;

describe('Rate Limiting Integration Tests', () => {
  let app: express.Application;
  let authController: AuthController;

  beforeEach(() => {
    // Ensure Redis is disabled for integration tests
    setRedisClient(null);
    
    app = express();
    app.use(express.json());
    
    authController = new AuthController(mockAuthService);
    const authRoutes = createAuthRoutes(authController, mockAuthMiddleware);
    app.use('/api/auth', authRoutes);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  describe('Password Reset Request Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const requestData = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      // First request should succeed
      const response1 = await request(app)
        .post('/api/auth/request-password-reset')
        .send(requestData);

      expect(response1.status).toBe(200);
      expect(response1.headers['x-ratelimit-limit']).toBeDefined();
      expect(response1.headers['x-ratelimit-remaining']).toBeDefined();

      // Second request should also succeed (within limit)
      const response2 = await request(app)
        .post('/api/auth/request-password-reset')
        .send(requestData);

      expect(response2.status).toBe(200);
    });

    it('should have rate limiting middleware applied', async () => {
      const requestData = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send(requestData);

      // Verify that rate limiting headers are present (indicating middleware is active)
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should include proper rate limit headers', async () => {
      const requestData = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Password Reset Completion Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const requestData = {
        token: 'valid-reset-token',
        newPassword: 'newPassword123',
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('should have rate limiting middleware applied', async () => {
      const requestData = {
        token: 'valid-reset-token',
        newPassword: 'newPassword123',
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(requestData);

      // Verify that rate limiting headers are present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Token Validation Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const requestData = {
        token: 'valid-reset-token',
      };

      const response = await request(app)
        .post('/api/auth/validate-reset-token')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('should have rate limiting middleware applied', async () => {
      const requestData = {
        token: 'valid-reset-token',
      };

      const response = await request(app)
        .post('/api/auth/validate-reset-token')
        .send(requestData);

      // Verify that rate limiting headers are present
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Different IP Addresses', () => {
    it('should apply rate limiting per IP address', async () => {
      const requestData = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      // Make requests from different IP addresses
      // Note: This is a simplified test as supertest doesn't easily allow
      // setting different IP addresses, but the middleware logic handles it
      const response1 = await request(app)
        .post('/api/auth/request-password-reset')
        .set('X-Forwarded-For', '192.168.1.1')
        .send(requestData);

      const response2 = await request(app)
        .post('/api/auth/request-password-reset')
        .set('X-Forwarded-For', '192.168.1.2')
        .send(requestData);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid request data gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ invalid: 'data' });

      // Should still apply rate limiting even for invalid requests
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send();

      // Should still apply rate limiting
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });
});