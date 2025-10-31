import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../src/index';
import { DatabaseConnection } from '../../../src/database/connection';

describe('Input Validation & XSS Prevention Tests', () => {
  let db: DatabaseConnection;
  let validToken: string;

  beforeEach(async () => {
    db = new DatabaseConnection();
    await db.connect();
    
    await db.query(`
      INSERT INTO users (id, wallet_address, display_name) 
      VALUES ('test-user-1', '0.0.123456', 'Test User')
      ON CONFLICT (id) DO NOTHING
    `);

    validToken = 'Bearer valid-test-token';
  });

  afterEach(async () => {
    await db.query('DELETE FROM users WHERE id LIKE \'test-%\'');
    await db.disconnect();
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML in booking descriptions', async () => {
      const maliciousDescription = '<script>alert("XSS")</script><img src="x" onerror="alert(1)">Luxury hotel';
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send({
          type: 'hotel',
          title: 'Test Hotel',
          description: maliciousDescription,
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: '2024-06-01',
            checkOut: '2024-06-03'
          },
          originalPrice: 200,
          swapValue: 180
        })
        .expect(201);

      expect(response.body.booking.description).not.toContain('<script>');
      expect(response.body.booking.description).not.toContain('onerror');
      expect(response.body.booking.description).toContain('Luxury hotel');
    });

    it('should sanitize HTML in user display names', async () => {
      const maliciousName = '<script>document.cookie="stolen"</script>Hacker';
      
      const response = await request(app)
        .put('/api/users/test-user-1/profile')
        .set('Authorization', validToken)
        .send({
          displayName: maliciousName,
          email: 'test@example.com'
        })
        .expect(200);

      expect(response.body.user.displayName).not.toContain('<script>');
      expect(response.body.user.displayName).not.toContain('document.cookie');
      expect(response.body.user.displayName).toContain('Hacker');
    });

    it('should prevent XSS in search queries', async () => {
      const maliciousQuery = '<script>fetch("/api/admin/users").then(r=>r.json()).then(console.log)</script>';
      
      const response = await request(app)
        .get('/api/bookings')
        .query({ search: maliciousQuery })
        .expect(200);

      // Response should not contain the script
      expect(JSON.stringify(response.body)).not.toContain('<script>');
      expect(JSON.stringify(response.body)).not.toContain('fetch(');
    });

    it('should sanitize swap proposal terms', async () => {
      const maliciousTerms = [
        'Valid ID required',
        '<script>window.location="http://evil.com"</script>',
        'No smoking'
      ];
      
      const response = await request(app)
        .post('/api/swaps')
        .set('Authorization', validToken)
        .send({
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          terms: {
            additionalPayment: 50,
            conditions: maliciousTerms
          }
        })
        .expect(201);

      const sanitizedTerms = response.body.swap.terms.conditions;
      expect(sanitizedTerms).toContain('Valid ID required');
      expect(sanitizedTerms).toContain('No smoking');
      expect(sanitizedTerms.join(' ')).not.toContain('<script>');
      expect(sanitizedTerms.join(' ')).not.toContain('window.location');
    });
  });

  describe('Input Length Validation', () => {
    it('should reject excessively long booking titles', async () => {
      const longTitle = 'A'.repeat(1001); // Assuming 1000 char limit
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send({
          type: 'hotel',
          title: longTitle,
          description: 'Valid description',
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: '2024-06-01',
            checkOut: '2024-06-03'
          },
          originalPrice: 200,
          swapValue: 180
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('title');
    });

    it('should reject excessively long descriptions', async () => {
      const longDescription = 'A'.repeat(5001); // Assuming 5000 char limit
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send({
          type: 'hotel',
          title: 'Valid Title',
          description: longDescription,
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: '2024-06-01',
            checkOut: '2024-06-03'
          },
          originalPrice: 200,
          swapValue: 180
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('description');
    });

    it('should reject too many swap conditions', async () => {
      const tooManyConditions = Array(101).fill('Valid condition'); // Assuming 100 limit
      
      const response = await request(app)
        .post('/api/swaps')
        .set('Authorization', validToken)
        .send({
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          terms: {
            additionalPayment: 50,
            conditions: tooManyConditions
          }
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toContain('conditions');
    });
  });

  describe('Data Type Validation', () => {
    it('should reject invalid email formats', async () => {
      const invalidEmails = [
        'not-an-email',
        '@domain.com',
        'user@',
        'user@domain',
        'user..double.dot@domain.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .put('/api/users/test-user-1/profile')
          .set('Authorization', validToken)
          .send({
            displayName: 'Test User',
            email: email
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContain('email');
      }
    });

    it('should reject invalid date formats', async () => {
      const invalidDates = [
        'not-a-date',
        '2024-13-01', // Invalid month
        '2024-02-30', // Invalid day
        '2024/06/01', // Wrong format
        '24-06-01'    // Wrong format
      ];

      for (const date of invalidDates) {
        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', validToken)
          .send({
            type: 'hotel',
            title: 'Test Hotel',
            description: 'Valid description',
            location: { city: 'Paris', country: 'France' },
            dateRange: {
              checkIn: date,
              checkOut: '2024-06-03'
            },
            originalPrice: 200,
            swapValue: 180
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContain('checkIn');
      }
    });

    it('should reject invalid price values', async () => {
      const invalidPrices = [-100, 0, 'not-a-number', 1000000000];

      for (const price of invalidPrices) {
        const response = await request(app)
          .post('/api/bookings')
          .set('Authorization', validToken)
          .send({
            type: 'hotel',
            title: 'Test Hotel',
            description: 'Valid description',
            location: { city: 'Paris', country: 'France' },
            dateRange: {
              checkIn: '2024-06-01',
              checkOut: '2024-06-03'
            },
            originalPrice: price,
            swapValue: 180
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContain('originalPrice');
      }
    });

    it('should reject invalid wallet addresses', async () => {
      const invalidAddresses = [
        'not-a-wallet',
        '0.0.abc',
        '1.2.3.4.5',
        '',
        '0.0.'
      ];

      for (const address of invalidAddresses) {
        const response = await request(app)
          .post('/api/auth/wallet-login')
          .send({
            walletAddress: address,
            signature: 'valid-signature',
            message: 'Login message'
          })
          .expect(400);

        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details).toContain('walletAddress');
      }
    });
  });

  describe('Business Logic Validation', () => {
    it('should reject bookings with check-out before check-in', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send({
          type: 'hotel',
          title: 'Test Hotel',
          description: 'Valid description',
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: '2024-06-03',
            checkOut: '2024-06-01' // Before check-in
          },
          originalPrice: 200,
          swapValue: 180
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DATE_RANGE');
    });

    it('should reject bookings in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', validToken)
        .send({
          type: 'hotel',
          title: 'Test Hotel',
          description: 'Valid description',
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: pastDate.toISOString().split('T')[0],
            checkOut: '2024-06-03'
          },
          originalPrice: 200,
          swapValue: 180
        })
        .expect(400);

      expect(response.body.error.code).toBe('PAST_DATE_NOT_ALLOWED');
    });

    it('should reject swap proposals with same source and target', async () => {
      const response = await request(app)
        .post('/api/swaps')
        .set('Authorization', validToken)
        .send({
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-1', // Same as source
          terms: {
            additionalPayment: 50,
            conditions: ['Valid ID required']
          }
        })
        .expect(400);

      expect(response.body.error.code).toBe('SELF_SWAP_NOT_ALLOWED');
    });

    it('should validate swap value reasonableness', async () => {
      const response = await request(app)
        .post('/api/swaps')
        .set('Authorization', validToken)
        .send({
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          terms: {
            additionalPayment: 999999999, // Unreasonably high
            conditions: ['Valid ID required']
          }
        })
        .expect(400);

      expect(response.body.error.code).toBe('UNREASONABLE_PAYMENT_AMOUNT');
    });
  });

  describe('File Upload Validation', () => {
    it('should reject non-image files for booking photos', async () => {
      const response = await request(app)
        .post('/api/bookings/booking-1/photos')
        .set('Authorization', validToken)
        .attach('photo', Buffer.from('<?php echo "hack"; ?>'), {
          filename: 'hack.php',
          contentType: 'application/x-php'
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_FILE_TYPE');
    });

    it('should reject oversized files', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      
      const response = await request(app)
        .post('/api/bookings/booking-1/photos')
        .set('Authorization', validToken)
        .attach('photo', largeBuffer, {
          filename: 'large.jpg',
          contentType: 'image/jpeg'
        })
        .expect(400);

      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
    });

    it('should scan uploaded files for malware signatures', async () => {
      // Simulate a file with malware signature
      const maliciousBuffer = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
      
      const response = await request(app)
        .post('/api/bookings/booking-1/documents')
        .set('Authorization', validToken)
        .attach('document', maliciousBuffer, {
          filename: 'document.pdf',
          contentType: 'application/pdf'
        })
        .expect(400);

      expect(response.body.error.code).toBe('MALWARE_DETECTED');
    });
  });

  describe('API Rate Limiting', () => {
    it('should rate limit booking creation', async () => {
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .post('/api/bookings')
          .set('Authorization', validToken)
          .send({
            type: 'hotel',
            title: 'Test Hotel',
            description: 'Valid description',
            location: { city: 'Paris', country: 'France' },
            dateRange: {
              checkIn: '2024-06-01',
              checkOut: '2024-06-03'
            },
            originalPrice: 200,
            swapValue: 180
          })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should rate limit search requests', async () => {
      const requests = Array(100).fill(null).map(() =>
        request(app)
          .get('/api/bookings')
          .query({ search: 'hotel' })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Content Security Policy', () => {
    it('should set proper CSP headers', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
      expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    });

    it('should prevent inline script execution', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });
  });
});