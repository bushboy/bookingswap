import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../src/index';
import { DatabaseConnection } from '../../src/database/connection';

describe('API Security Tests', () => {
  let db: DatabaseConnection;
  let validToken: string;

  beforeEach(async () => {
    db = new DatabaseConnection();
    await db.connect();
    
    await db.query(`
      INSERT INTO users (id, wallet_address, display_name, role) 
      VALUES 
        ('test-user-1', '0.0.123456', 'Test User', 'user'),
        ('test-admin-1', '0.0.789012', 'Admin User', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);

    validToken = 'Bearer valid-test-token';
  });

  afterEach(async () => {
    await db.query('DELETE FROM users WHERE id LIKE \'test-%\'');
    await db.disconnect();
  });

  describe('HTTP Security Headers', () => {
    it('should set security headers on all responses', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toContain('max-age=');
    });

    it('should prevent information disclosure in error responses', async () => {
      const response = await request(app)
        .get('/api/nonexistent-endpoint')
        .expect(404);

      expect(response.headers['server']).toBeUndefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.body.error?.stack).toBeUndefined();
    });
  });

  describe('Request Size Limits', () => {
    it('should reject oversized JSON payloads', async () => {
      const largePayload = {
        data: 'A'.repeat(1024 * 1024) // 1MB
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send(largePayload)
        .expect(413);

      expect(response.body.error?.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent directory traversal in file paths', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam'
      ];

      for (const path of maliciousPaths) {
        const response = await request(app)
          .get(`/api/files/${encodeURIComponent(path)}`)
          .set('Authorization', validToken)
          .expect(400);

        expect(response.body.error?.code).toBe('INVALID_FILE_PATH');
      }
    });
  });

  describe('Information Disclosure Prevention', () => {
    it('should not expose sensitive data in API responses', async () => {
      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', validToken)
        .expect(200);

      expect(response.body.user?.password).toBeUndefined();
      expect(response.body.user?.privateKey).toBeUndefined();
    });
  });

  describe('Timing Attack Prevention', () => {
    it('should have consistent response times for authentication', async () => {
      const validCredentials = {
        walletAddress: '0.0.123456',
        signature: 'valid-signature',
        message: 'Login message'
      };

      const invalidCredentials = {
        walletAddress: '0.0.999999',
        signature: 'invalid-signature',
        message: 'Login message'
      };

      const validStart = Date.now();
      await request(app)
        .post('/api/auth/wallet-login')
        .send(validCredentials);
      const validTime = Date.now() - validStart;

      const invalidStart = Date.now();
      await request(app)
        .post('/api/auth/wallet-login')
        .send(invalidCredentials);
      const invalidTime = Date.now() - invalidStart;

      const timeDifference = Math.abs(validTime - invalidTime);
      expect(timeDifference).toBeLessThan(100);
    });
  });
});