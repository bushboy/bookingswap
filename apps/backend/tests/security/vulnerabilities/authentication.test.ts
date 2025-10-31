import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../../src/index';
import { DatabaseConnection } from '../../../src/database/connection';

describe('Authentication & Authorization Security Tests', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = new DatabaseConnection();
    await db.connect();
    
    // Set up test users with different roles
    await db.query(`
      INSERT INTO users (id, wallet_address, display_name, role) 
      VALUES 
        ('test-user-1', '0.0.123456', 'Regular User', 'user'),
        ('test-admin-1', '0.0.789012', 'Admin User', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterEach(async () => {
    await db.query('DELETE FROM users WHERE id LIKE \'test-%\'');
    await db.disconnect();
  });

  describe('JWT Token Security', () => {
    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user-1', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject malformed JWT tokens', async () => {
      const malformedToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${malformedToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject JWT tokens with invalid signature', async () => {
      const invalidToken = jwt.sign(
        { userId: 'test-user-1' },
        'wrong-secret'
      );

      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject JWT tokens with missing required claims', async () => {
      const incompleteToken = jwt.sign(
        { exp: Math.floor(Date.now() / 1000) + 3600 }, // Missing userId
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_TOKEN_CLAIMS');
    });
  });

  describe('Wallet Signature Verification', () => {
    it('should reject invalid wallet signatures', async () => {
      const response = await request(app)
        .post('/api/auth/wallet-login')
        .send({
          walletAddress: '0.0.123456',
          signature: 'invalid-signature',
          message: 'Login message'
        })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_SIGNATURE');
    });

    it('should reject wallet login with mismatched address', async () => {
      const response = await request(app)
        .post('/api/auth/wallet-login')
        .send({
          walletAddress: '0.0.999999', // Different from signature
          signature: 'valid-signature-for-different-address',
          message: 'Login message'
        })
        .expect(401);

      expect(response.body.error.code).toBe('ADDRESS_MISMATCH');
    });

    it('should reject replay attacks with old signatures', async () => {
      const oldTimestamp = Date.now() - 600000; // 10 minutes ago
      const response = await request(app)
        .post('/api/auth/wallet-login')
        .send({
          walletAddress: '0.0.123456',
          signature: 'valid-but-old-signature',
          message: `Login message ${oldTimestamp}`,
          timestamp: oldTimestamp
        })
        .expect(401);

      expect(response.body.error.code).toBe('SIGNATURE_EXPIRED');
    });
  });

  describe('Authorization Bypass Attempts', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const userToken = jwt.sign(
        { userId: 'test-user-1', role: 'user' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access another user's data
      const response = await request(app)
        .get('/api/users/test-admin-1')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should prevent vertical privilege escalation', async () => {
      const userToken = jwt.sign(
        { userId: 'test-user-1', role: 'user' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Try to access admin endpoints
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_REQUIRED');
    });

    it('should prevent role manipulation in token', async () => {
      const manipulatedToken = jwt.sign(
        { userId: 'test-user-1', role: 'admin' }, // User trying to claim admin role
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ROLE_VERIFICATION_FAILED');
    });
  });

  describe('Session Management', () => {
    it('should invalidate tokens on logout', async () => {
      const token = jwt.sign(
        { userId: 'test-user-1', role: 'user' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Try to use the same token
      const response = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(response.body.error.code).toBe('TOKEN_BLACKLISTED');
    });

    it('should prevent concurrent session abuse', async () => {
      const responses = await Promise.all([
        request(app)
          .post('/api/auth/wallet-login')
          .send({
            walletAddress: '0.0.123456',
            signature: 'valid-signature-1',
            message: 'Login message 1'
          }),
        request(app)
          .post('/api/auth/wallet-login')
          .send({
            walletAddress: '0.0.123456',
            signature: 'valid-signature-2',
            message: 'Login message 2'
          })
      ]);

      // Both should succeed, but previous sessions should be invalidated
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      
      const oldToken = responses[0].body.token;
      const newToken = responses[1].body.token;

      // Old token should be invalidated
      const oldTokenResponse = await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${oldToken}`)
        .expect(401);

      expect(oldTokenResponse.body.error.code).toBe('SESSION_SUPERSEDED');

      // New token should work
      await request(app)
        .get('/api/users/test-user-1')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);
    });
  });

  describe('Rate Limiting & Brute Force Protection', () => {
    it('should rate limit authentication attempts', async () => {
      const attempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/wallet-login')
          .send({
            walletAddress: '0.0.123456',
            signature: 'invalid-signature',
            message: 'Login message'
          })
      );

      const responses = await Promise.all(attempts);
      
      // First few should return 401, later ones should return 429 (rate limited)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should implement progressive delays for failed attempts', async () => {
      const startTime = Date.now();
      
      // Make multiple failed attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/auth/wallet-login')
          .send({
            walletAddress: '0.0.123456',
            signature: 'invalid-signature',
            message: 'Login message'
          });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should take progressively longer due to delays
      expect(totalTime).toBeGreaterThan(1000); // At least 1 second of delays
    });
  });

  describe('Admin Authentication Security', () => {
    it('should require additional verification for admin actions', async () => {
      const adminToken = jwt.sign(
        { userId: 'test-admin-1', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      // Admin actions should require additional verification
      const response = await request(app)
        .delete('/api/admin/users/test-user-1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);

      expect(response.body.error.code).toBe('ADMIN_VERIFICATION_REQUIRED');
    });

    it('should log all admin actions for audit', async () => {
      const adminToken = jwt.sign(
        { userId: 'test-admin-1', role: 'admin' },
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('X-Admin-Verification', 'verified')
        .expect(200);

      // Check audit log
      const auditLog = await db.query(
        'SELECT * FROM audit_logs WHERE user_id = $1 AND action = $2',
        ['test-admin-1', 'admin_users_list']
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
    });
  });
});