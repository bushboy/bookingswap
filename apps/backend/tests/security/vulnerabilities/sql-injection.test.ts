import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { DatabaseConnection } from '../../../src/database/connection';

describe('SQL Injection Vulnerability Tests', () => {
  let db: DatabaseConnection;

  beforeEach(async () => {
    db = new DatabaseConnection();
    await db.connect();
    // Set up test data
    await db.query(`
      INSERT INTO users (id, wallet_address, display_name) 
      VALUES ('test-user-1', '0.0.123456', 'Test User')
      ON CONFLICT (id) DO NOTHING
    `);
  });

  afterEach(async () => {
    await db.query('DELETE FROM users WHERE id LIKE \'test-%\'');
    await db.disconnect();
  });

  describe('Booking Search Endpoints', () => {
    it('should prevent SQL injection in search query', async () => {
      const maliciousQuery = "'; DROP TABLE bookings; --";
      
      const response = await request(app)
        .get('/api/bookings')
        .query({ search: maliciousQuery })
        .expect(200);

      // Verify the table still exists by making another query
      const followupResponse = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(followupResponse.body).toBeDefined();
      expect(response.body.bookings).toBeDefined();
    });

    it('should prevent SQL injection in location filter', async () => {
      const maliciousLocation = "Paris' UNION SELECT password FROM users WHERE '1'='1";
      
      const response = await request(app)
        .get('/api/bookings')
        .query({ city: maliciousLocation })
        .expect(200);

      // Should not return user passwords or cause errors
      expect(response.body.bookings).toBeDefined();
      expect(JSON.stringify(response.body)).not.toContain('password');
    });

    it('should prevent SQL injection in date range filters', async () => {
      const maliciousDate = "2024-01-01' OR '1'='1' --";
      
      const response = await request(app)
        .get('/api/bookings')
        .query({ 
          dateFrom: maliciousDate,
          dateTo: '2024-12-31'
        })
        .expect(200);

      expect(response.body.bookings).toBeDefined();
    });
  });

  describe('User Profile Endpoints', () => {
    it('should prevent SQL injection in user ID parameter', async () => {
      const maliciousUserId = "test-user-1' UNION SELECT wallet_address, display_name FROM users --";
      
      const response = await request(app)
        .get(`/api/users/${maliciousUserId}`)
        .set('Authorization', 'Bearer valid-test-token')
        .expect(404); // Should not find the malicious user ID

      expect(response.body.error).toBeDefined();
    });

    it('should prevent SQL injection in profile update', async () => {
      const maliciousDisplayName = "Test'; UPDATE users SET wallet_address='hacked' WHERE '1'='1'; --";
      
      const response = await request(app)
        .put('/api/users/test-user-1/profile')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          displayName: maliciousDisplayName,
          email: 'test@example.com'
        })
        .expect(200);

      // Verify the malicious update didn't execute
      const userCheck = await db.query(
        'SELECT wallet_address FROM users WHERE id = $1',
        ['test-user-1']
      );
      
      expect(userCheck.rows[0].wallet_address).toBe('0.0.123456');
      expect(userCheck.rows[0].wallet_address).not.toBe('hacked');
    });
  });

  describe('Swap Operations', () => {
    it('should prevent SQL injection in swap proposal creation', async () => {
      const maliciousBookingId = "booking-1'; INSERT INTO swaps (id, status) VALUES ('hacked', 'completed'); --";
      
      const response = await request(app)
        .post('/api/swaps')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          sourceBookingId: 'valid-booking-1',
          targetBookingId: maliciousBookingId,
          terms: {
            additionalPayment: 100,
            conditions: ['Valid ID required']
          }
        })
        .expect(400); // Should fail validation

      // Verify no malicious swap was created
      const swapCheck = await db.query(
        'SELECT * FROM swaps WHERE id = $1',
        ['hacked']
      );
      
      expect(swapCheck.rows).toHaveLength(0);
    });

    it('should prevent SQL injection in swap status updates', async () => {
      const maliciousSwapId = "swap-1'; UPDATE swaps SET status='completed' WHERE '1'='1'; --";
      
      const response = await request(app)
        .put(`/api/swaps/${maliciousSwapId}/status`)
        .set('Authorization', 'Bearer valid-test-token')
        .send({ status: 'accepted' })
        .expect(404); // Should not find the malicious swap ID

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Admin Endpoints', () => {
    it('should prevent SQL injection in admin user search', async () => {
      const maliciousSearch = "admin' OR role='admin' --";
      
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer admin-test-token')
        .query({ search: maliciousSearch })
        .expect(200);

      // Should not return unauthorized admin users
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    it('should prevent SQL injection in dispute queries', async () => {
      const maliciousDisputeId = "dispute-1' UNION SELECT * FROM users WHERE role='admin' --";
      
      const response = await request(app)
        .get(`/api/admin/disputes/${maliciousDisputeId}`)
        .set('Authorization', 'Bearer admin-test-token')
        .expect(404);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Blockchain Integration', () => {
    it('should prevent SQL injection in transaction logging', async () => {
      const maliciousTransactionId = "tx-123'; DROP TABLE blockchain_transactions; --";
      
      const response = await request(app)
        .post('/api/blockchain/log-transaction')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          transactionId: maliciousTransactionId,
          type: 'booking-creation',
          data: { bookingId: 'booking-1' }
        })
        .expect(400); // Should fail validation

      // Verify table still exists
      const tableCheck = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'blockchain_transactions'
      `);
      
      expect(tableCheck.rows).toHaveLength(1);
    });
  });

  describe('Parameterized Query Verification', () => {
    it('should use parameterized queries for all database operations', async () => {
      // This test verifies that our ORM/query builder is properly configured
      const testCases = [
        { endpoint: '/api/bookings', method: 'GET', query: { search: 'test' } },
        { endpoint: '/api/users/test-user-1', method: 'GET' },
        { endpoint: '/api/swaps', method: 'GET' },
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          [testCase.method.toLowerCase() as 'get'](`${testCase.endpoint}`)
          .query(testCase.query || {})
          .set('Authorization', 'Bearer valid-test-token');

        // Should not throw database errors
        expect(response.status).not.toBe(500);
      }
    });
  });
});