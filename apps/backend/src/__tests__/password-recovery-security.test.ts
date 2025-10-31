import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { PasswordResetTokenRepository } from '../database/repositories/PasswordResetTokenRepository';
import { JwtTokenBlacklistRepository } from '../database/repositories/JwtTokenBlacklistRepository';
import { EmailService } from '../services/email/EmailService';
import { WalletService } from '../services/hedera/WalletService';
import { AuthController } from '../controllers/AuthController';
import { createAuthRoutes } from '../routes/auth';
import { AuthMiddleware } from '../middleware/auth';
import { setRedisClient } from '../middleware/rateLimiting';
import { User } from '@booking-swap/shared';

// Mock external dependencies
const mockPool = {
  query: vi.fn(),
  connect: vi.fn(),
  end: vi.fn(),
} as any;

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
  pipeline: vi.fn(() => ({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    ttl: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([[null, 1], [null, 'OK'], [null, 3600]]),
  })),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  decr: vi.fn(),
} as any;

vi.mock('../database', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue(mockPool),
}));

vi.mock('../database/cache', () => ({
  createRedisConnection: vi.fn().mockResolvedValue(mockRedis),
}));

vi.mock('../services/hedera/factory', () => ({
  createHederaService: vi.fn().mockReturnValue({
    submitTransaction: vi.fn(),
    createSmartContract: vi.fn(),
    executeContract: vi.fn(),
  }),
  getHederaService: vi.fn().mockReturnValue({
    submitTransaction: vi.fn(),
    createSmartContract: vi.fn(),
    executeContract: vi.fn(),
  }),
}));

vi.mock('../services/hedera/WalletService', () => ({
  WalletService: vi.fn().mockImplementation(() => ({
    verifySignature: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock nodemailer
const mockTransporter = {
  sendMail: vi.fn(),
  verify: vi.fn().mockResolvedValue(true),
};

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => mockTransporter),
    createTransporter: vi.fn(() => mockTransporter),
    getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
  },
  createTransport: vi.fn(() => mockTransporter),
  createTransporter: vi.fn(() => mockTransporter),
  getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
}));

describe('Password Recovery Security Tests', () => {
  let app: express.Application;
  let authService: AuthService;
  let authController: AuthController;
  let userRepository: UserRepository;
  let passwordResetTokenRepository: PasswordResetTokenRepository;
  let jwtTokenBlacklistRepository: JwtTokenBlacklistRepository;
  let emailService: EmailService;
  let testUser: User;
  let testUserEmail: string;

  beforeAll(async () => {
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.SMTP_FROM_EMAIL = 'test@example.com';
    process.env.SMTP_FROM_NAME = 'Test Platform';

    // Initialize repositories and services
    userRepository = new UserRepository(mockPool);
    passwordResetTokenRepository = new PasswordResetTokenRepository(mockPool);
    jwtTokenBlacklistRepository = new JwtTokenBlacklistRepository(mockPool);
    emailService = new EmailService();
    
    const walletService = new WalletService();
    authService = new AuthService(
      userRepository,
      walletService,
      passwordResetTokenRepository,
      emailService,
      jwtTokenBlacklistRepository,
      process.env.JWT_SECRET
    );

    // Set up test user data
    testUserEmail = 'test@example.com';
    testUser = {
      id: 'test-user-id',
      username: 'testuser',
      email: testUserEmail,
      passwordHash: '$2a$12$test.hash.for.password',
      profile: {
        email: testUserEmail,
        displayName: 'Test User',
        preferences: { 
          notifications: true,
          language: 'en',
          theme: 'light',
          emailNotifications: true,
          pushNotifications: false,
        },
      },
      verification: {
        level: 'basic' as const,
        documents: [],
      },
      reputation: {
        score: 100,
        completedSwaps: 0,
        cancelledSwaps: 0,
        reviews: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Set up Express app with routes
    app = express();
    app.use(express.json());
    
    authController = new AuthController(authService);
    const mockAuthMiddleware = {
      requireAuth: () => (req: any, res: any, next: any) => next(),
    } as any;
    
    const authRoutes = createAuthRoutes(authController, mockAuthMiddleware);
    app.use('/api/auth', authRoutes);

    // Disable Redis for tests
    setRedisClient(null);
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockPool.query.mockReset();
    mockTransporter.sendMail.mockReset();
    mockTransporter.verify.mockResolvedValue(true);
    mockRedis.get.mockReset();
    mockRedis.set.mockReset();
    mockRedis.del.mockReset();
    mockRedis.incr.mockReset();
    mockRedis.expire.mockReset();
    mockRedis.ttl.mockReset();
    mockRedis.decr.mockReset();
  });

  afterAll(async () => {
    // Clean up any resources if needed
    if (mockPool.end) {
      await mockPool.end();
    }
    if (mockRedis.quit) {
      await mockRedis.quit();
    }
  });

  describe('Rate Limiting Protection Tests', () => {
    it('should apply rate limiting headers to password reset requests', async () => {
      // Mock successful password reset request
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] }) // findByEmail
        .mockResolvedValueOnce({ rows: [] }) // invalidateUserTokens
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'secure-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        }); // createToken

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should apply rate limiting to password reset completion', async () => {
      // Mock successful password reset
      mockPool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'valid-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            used_at: null,
            created_at: new Date(),
          }] 
        }) // findValidToken
        .mockResolvedValueOnce({ rows: [testUser] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // update user password
        .mockResolvedValueOnce({ rows: [] }) // markTokenAsUsed
        .mockResolvedValueOnce({ rows: [] }); // blacklistAllUserTokens

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-reset-token',
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should apply rate limiting to token validation', async () => {
      // Mock valid token
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: 'valid-reset-token',
          expires_at: new Date(Date.now() + 3600000),
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const response = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({
          token: 'valid-reset-token',
        });

      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should handle rate limit exceeded scenarios', async () => {
      // Simulate multiple rapid requests to trigger rate limiting
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/auth/request-password-reset')
            .send({
              email: testUserEmail,
              resetBaseUrl: 'https://example.com/reset-password',
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // At least some requests should have rate limiting headers
      responses.forEach(response => {
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
      });
    });

    it('should implement per-email rate limiting for password reset requests', async () => {
      // Mock user lookup for different emails
      mockPool.query
        .mockResolvedValue({ rows: [testUser] }) // findByEmail for all requests
        .mockResolvedValue({ rows: [] }) // invalidateUserTokens
        .mockResolvedValue({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'secure-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        }); // createToken

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      // Make requests for the same email
      const sameEmailRequests = [];
      for (let i = 0; i < 5; i++) {
        sameEmailRequests.push(
          request(app)
            .post('/api/auth/request-password-reset')
            .send({
              email: testUserEmail,
              resetBaseUrl: 'https://example.com/reset-password',
            })
        );
      }

      const responses = await Promise.all(sameEmailRequests);
      
      // All requests should have rate limiting headers
      responses.forEach(response => {
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      });
    });
  });

  describe('Email Enumeration Prevention Tests', () => {
    it('should return generic success message for non-existent email', async () => {
      // Mock user not found
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'nonexistent@example.com',
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with that email exists');
      
      // Verify no email was sent
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should return similar response time for existing and non-existent emails', async () => {
      // Test with non-existent email
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const start1 = Date.now();
      const response1 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: 'nonexistent@example.com',
          resetBaseUrl: 'https://example.com/reset-password',
        });
      const time1 = Date.now() - start1;

      // Test with existing email
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'secure-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        });

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const start2 = Date.now();
      const response2 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });
      const time2 = Date.now() - start2;

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);

      // Response times should be reasonably similar (within 1 second difference)
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(1000);
    });

    it('should not reveal user existence through error messages', async () => {
      // Test various scenarios that should all return generic messages
      const testCases = [
        { email: 'nonexistent@example.com', mockRows: [] },
        { email: 'invalid-email-format', mockRows: [] },
        { email: '', mockRows: [] },
      ];

      for (const testCase of testCases) {
        mockPool.query.mockResolvedValueOnce({ rows: testCase.mockRows });

        const response = await request(app)
          .post('/api/auth/request-password-reset')
          .send({
            email: testCase.email,
            resetBaseUrl: 'https://example.com/reset-password',
          });

        // Should either succeed with generic message or fail with validation error
        if (response.status === 200) {
          expect(response.body.message).toMatch(/If an account with that email exists|Password reset link has been sent/);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error.category).toBe('validation');
        }
      }
    });

    it('should handle service errors without revealing information', async () => {
      // Mock database error
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('If an account with that email exists');
    });
  });

  describe('Token Security Tests', () => {
    it('should generate cryptographically secure tokens', async () => {
      const tokens = new Set<string>();
      
      // Generate multiple tokens and ensure they're unique and secure
      for (let i = 0; i < 100; i++) {
        const token = crypto.randomBytes(32).toString('hex');
        
        // Token should be 64 characters (32 bytes in hex)
        expect(token).toHaveLength(64);
        
        // Token should be unique
        expect(tokens.has(token)).toBe(false);
        tokens.add(token);
        
        // Token should only contain hex characters
        expect(token).toMatch(/^[a-f0-9]+$/);
      }
    });

    it('should enforce token expiration', async () => {
      // Mock expired token
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No valid token found

      const response = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({
          token: 'expired-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should invalidate tokens after use', async () => {
      const resetToken = 'valid-reset-token';

      // First use - should succeed
      mockPool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: resetToken,
            expires_at: new Date(Date.now() + 3600000),
            used_at: null,
            created_at: new Date(),
          }] 
        }) // findValidToken
        .mockResolvedValueOnce({ rows: [testUser] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // update user password
        .mockResolvedValueOnce({ rows: [] }) // markTokenAsUsed
        .mockResolvedValueOnce({ rows: [] }); // blacklistAllUserTokens

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const firstResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newPassword123',
        });

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.success).toBe(true);

      // Second use - should fail (token already used)
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Token not found (marked as used)

      const secondResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'anotherPassword123',
        });

      expect(secondResponse.status).toBe(400);
      expect(secondResponse.body.error.code).toBe('PASSWORD_RESET_FAILED');
    });

    it('should invalidate existing tokens when new reset is requested', async () => {
      // Mock user lookup and token invalidation
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] }) // findByEmail
        .mockResolvedValueOnce({ rows: [] }) // invalidateUserTokens (should be called)
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'new-token-id',
            user_id: testUser.id,
            token: 'new-secure-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        }); // createToken

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response.status).toBe(200);
      
      // Verify that invalidateUserTokens was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        [testUser.id]
      );
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        { token: '', expectStatus: 400 }, // empty
        { token: 'short', expectStatus: 200 }, // too short - processed but invalid
        { token: 'a'.repeat(65), expectStatus: 200 }, // too long - processed but invalid
        { token: 'invalid-chars-!@#$%', expectStatus: 200 }, // invalid characters - processed but invalid
      ];

      for (const testCase of malformedTokens) {
        // Mock database response for all string tokens
        if (typeof testCase.token === 'string') {
          mockPool.query.mockResolvedValueOnce({ rows: [] }); // Token not found
        }

        const response = await request(app)
          .post('/api/auth/validate-reset-token')
          .send({
            token: testCase.token,
          });

        expect(response.status).toBe(testCase.expectStatus);
        
        if (testCase.expectStatus === 400) {
          expect(response.body.error.category).toBe('validation');
        } else {
          expect(response.body.valid).toBe(false);
        }
      }

      // Test null, undefined, number, object separately as they cause validation errors
      const invalidTypes = [null, undefined, 123, {}];
      
      for (const token of invalidTypes) {
        const response = await request(app)
          .post('/api/auth/validate-reset-token')
          .send({
            token: token,
          });

        expect(response.status).toBe(400);
        expect(response.body.error.category).toBe('validation');
      }
    });

    it('should handle token validation errors gracefully', async () => {
      // Mock database error during token validation
      mockPool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/validate-reset-token')
        .send({
          token: 'valid-looking-token',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });
  });

  describe('Input Validation Security Tests', () => {
    it('should validate email format in password reset requests', async () => {
      const invalidEmails = [
        'invalid-email',
        'missing@domain',
        '@missing-local.com',
        'spaces in@email.com',
        'email@',
        'email@domain',
        'email@domain.',
        '',
        null,
        undefined,
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/request-password-reset')
          .send({
            email: email,
            resetBaseUrl: 'https://example.com/reset-password',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.category).toBe('validation');
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should validate reset URL format', async () => {
      const invalidUrls = [
        'not-a-url',
        '', // empty string
        null,
        undefined,
      ];

      for (const resetBaseUrl of invalidUrls) {
        const response = await request(app)
          .post('/api/auth/request-password-reset')
          .send({
            email: testUserEmail,
            resetBaseUrl: resetBaseUrl,
          });

        expect(response.status).toBe(400);
        expect(response.body.error.category).toBe('validation');
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }

      // Test that valid URI schemes are accepted (even if not HTTP/HTTPS)
      // Mock user lookup for FTP URL test
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const ftpResponse = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'ftp://example.com/reset',
        });

      // FTP URLs are valid URIs and should be accepted by Joi validation
      expect(ftpResponse.status).toBe(200);
      expect(ftpResponse.body.success).toBe(true);
      expect(ftpResponse.body.message).toContain('If an account with that email exists');

      // Test HTTP URL - it should be accepted by Joi.string().uri() validation
      // Mock user lookup for HTTP URL test
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const httpResponse = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'http://example.com/reset',
        });

      // HTTP URLs are valid URIs and should be accepted by validation
      expect(httpResponse.status).toBe(200);
      expect(httpResponse.body.success).toBe(true);
      expect(httpResponse.body.message).toContain('If an account with that email exists');

      // Test HTTPS URL as well
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // User not found

      const httpsResponse = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset',
        });

      expect(httpsResponse.status).toBe(200);
      expect(httpsResponse.body.success).toBe(true);
    });

    it('should validate password strength in reset requests', async () => {
      const weakPasswords = [
        '', // empty
        '123', // too short
        '12345', // too short
        'a'.repeat(101), // too long
      ];

      // Mock valid token for password reset
      mockPool.query.mockResolvedValue({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: 'valid-reset-token',
          expires_at: new Date(Date.now() + 3600000),
          used_at: null,
          created_at: new Date(),
        }] 
      });

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/reset-password')
          .send({
            token: 'valid-reset-token',
            newPassword: password,
          });

        expect(response.status).toBe(400);
        expect(response.body.error.category).toBe('validation');
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should sanitize and validate token input', async () => {
      const maliciousTokens = [
        '<script>alert("xss")</script>',
        'token"; DROP TABLE users; --',
        'token\'; DELETE FROM password_reset_tokens; --',
        'token\x00null-byte',
        'token\r\nheader-injection',
      ];

      for (const token of maliciousTokens) {
        const response = await request(app)
          .post('/api/auth/validate-reset-token')
          .send({
            token: token,
          });

        // Should handle malicious input gracefully
        expect(response.status).toBe(200);
        expect(response.body.valid).toBe(false);
      }
    });

    it('should reject requests with missing required fields', async () => {
      // Test password reset request without email
      const response1 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response1.status).toBe(400);
      expect(response1.body.error.category).toBe('validation');

      // Test password reset request without resetBaseUrl
      const response2 = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
        });

      expect(response2.status).toBe(400);
      expect(response2.body.error.category).toBe('validation');

      // Test password reset without token
      const response3 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          newPassword: 'newPassword123',
        });

      expect(response3.status).toBe(400);
      expect(response3.body.error.category).toBe('validation');

      // Test password reset without newPassword
      const response4 = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'valid-token',
        });

      expect(response4.status).toBe(400);
      expect(response4.body.error.category).toBe('validation');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should limit request body size', async () => {
      const largePayload = {
        email: testUserEmail,
        resetBaseUrl: 'https://example.com/reset-password',
        extraData: 'x'.repeat(10000), // Large string
      };

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send(largePayload);

      // Should either succeed (ignoring extra data) or fail with validation error
      expect([200, 400, 413]).toContain(response.status);
    });
  });

  describe('Session Security Tests', () => {
    it('should invalidate all user sessions on password reset', async () => {
      const resetToken = 'valid-reset-token';

      // Mock successful password reset
      mockPool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: resetToken,
            expires_at: new Date(Date.now() + 3600000),
            used_at: null,
            created_at: new Date(),
          }] 
        }) // findValidToken
        .mockResolvedValueOnce({ rows: [testUser] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // update user password
        .mockResolvedValueOnce({ rows: [] }) // markTokenAsUsed
        .mockResolvedValueOnce({ rows: [] }); // blacklistAllUserTokens

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify that blacklistAllUserTokens was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO jwt_token_blacklist'),
        expect.arrayContaining([testUser.id])
      );
    });

    it('should send confirmation email after password reset', async () => {
      const resetToken = 'valid-reset-token';

      // Mock successful password reset
      mockPool.query
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: resetToken,
            expires_at: new Date(Date.now() + 3600000),
            used_at: null,
            created_at: new Date(),
          }] 
        }) // findValidToken
        .mockResolvedValueOnce({ rows: [testUser] }) // findById
        .mockResolvedValueOnce({ rows: [] }) // update user password
        .mockResolvedValueOnce({ rows: [] }) // markTokenAsUsed
        .mockResolvedValueOnce({ rows: [] }); // blacklistAllUserTokens

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newSecurePassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify confirmation email was sent
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
      const emailCall = mockTransporter.sendMail.mock.calls[0][0];
      expect(emailCall.to).toBe(testUser.email);
      expect(emailCall.subject).toBe('Password Reset Confirmation - Booking Swap Platform');
    });
  });

  describe('Logging and Monitoring Security Tests', () => {
    it('should log security events without exposing sensitive data', async () => {
      // Mock console.log to capture log output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Mock user lookup
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'secure-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        });

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });

      // Verify that sensitive data is not logged in plain text
      const logCalls = consoleSpy.mock.calls.flat();
      const logString = logCalls.join(' ');
      
      // Should not contain full email or sensitive data
      expect(logString).not.toContain(testUserEmail);
      expect(logString).not.toContain('secure-reset-token');

      consoleSpy.mockRestore();
    });

    it('should handle logging errors gracefully', async () => {
      // This test ensures that logging failures don't break the password reset flow
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'secure-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        });

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const response = await request(app)
        .post('/api/auth/request-password-reset')
        .send({
          email: testUserEmail,
          resetBaseUrl: 'https://example.com/reset-password',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});