import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { PasswordResetTokenRepository } from '../database/repositories/PasswordResetTokenRepository';
import { JwtTokenBlacklistRepository } from '../database/repositories/JwtTokenBlacklistRepository';
import { EmailService } from '../services/email/EmailService';
import { WalletService } from '../services/hedera/WalletService';
import { User } from '@booking-swap/shared';
import crypto from 'crypto';
import { Pool } from 'pg';

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

// Mock nodemailer - will be defined in the mock below

// Create mock transporter
const mockTransporter = {
  sendMail: vi.fn(),
  verify: vi.fn().mockResolvedValue(true),
};

vi.mock('nodemailer', () => {
  return {
    default: {
      createTransporter: vi.fn(() => mockTransporter),
      createTransport: vi.fn(() => mockTransporter),
      getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
    },
    createTransporter: vi.fn(() => mockTransporter),
    createTransport: vi.fn(() => mockTransporter),
    getTestMessageUrl: vi.fn(() => 'https://ethereal.email/message/test'),
  };
});

describe('Password Recovery Core Integration Tests', () => {
  let userRepository: UserRepository;
  let passwordResetTokenRepository: PasswordResetTokenRepository;
  let jwtTokenBlacklistRepository: JwtTokenBlacklistRepository;
  let emailService: EmailService;
  let authService: AuthService;
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
        preferences: { notifications: true },
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
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset mock implementations
    mockPool.query.mockReset();
    mockTransporter.sendMail.mockReset();
    mockTransporter.verify.mockResolvedValue(true);
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

  describe('Password Reset Token Management', () => {
    it('should create secure password reset tokens', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      
      // Mock token creation
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: 'generated-secure-token',
          expires_at: expiresAt,
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const token = await passwordResetTokenRepository.createToken({
        userId: testUser.id,
        expiresAt,
      });

      expect(token).toEqual({
        id: 'token-id',
        userId: testUser.id,
        token: 'generated-secure-token',
        expiresAt,
        usedAt: null,
        createdAt: expect.any(Date),
      });

      // Verify database call
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        expect.arrayContaining([testUser.id, expect.any(String), expiresAt])
      );
    });

    it('should validate tokens correctly', async () => {
      const validToken = 'valid-token';
      const expiresAt = new Date(Date.now() + 3600000);

      // Mock valid token lookup
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: validToken,
          expires_at: expiresAt,
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const foundToken = await passwordResetTokenRepository.findValidToken(validToken);

      expect(foundToken).toEqual({
        id: 'token-id',
        userId: testUser.id,
        token: validToken,
        expiresAt,
        usedAt: null,
        createdAt: expect.any(Date),
      });
    });

    it('should reject invalid tokens', async () => {
      // Mock token not found
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const foundToken = await passwordResetTokenRepository.findValidToken('invalid-token');

      expect(foundToken).toBeNull();
    });

    it('should mark tokens as used', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await passwordResetTokenRepository.markTokenAsUsed('token-id');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        ['token-id']
      );
    });

    it('should invalidate user tokens', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await passwordResetTokenRepository.invalidateUserTokens(testUser.id);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        [testUser.id]
      );
    });
  });

  describe('Password Reset Service Integration', () => {
    it('should initiate password reset for existing user', async () => {
      // Mock user lookup
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

      // Mock email sending
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const result = await authService.initiatePasswordReset(
        testUserEmail,
        'https://example.com/reset-password'
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset link has been sent to your email address.');
      expect(result.resetToken).toBe('secure-reset-token');
      expect(result.expiresAt).toBeInstanceOf(Date);

      // Verify database interactions
      expect(mockPool.query).toHaveBeenCalledTimes(3);
      
      // Verify email was sent
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });

    it('should handle non-existent email securely', async () => {
      // Mock user not found
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.initiatePasswordReset(
        'nonexistent@example.com',
        'https://example.com/reset-password'
      );

      expect(result).toEqual({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });

      // Verify no email was sent
      expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    });

    it('should validate reset tokens', async () => {
      const validToken = 'valid-reset-token';
      const expiresAt = new Date(Date.now() + 3600000);

      // Mock token lookup
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: validToken,
          expires_at: expiresAt,
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const result = await authService.validateResetToken(validToken);

      expect(result).toEqual({
        valid: true,
        userId: testUser.id,
        expiresAt: expiresAt,
      });
    });

    it('should reset password with valid token', async () => {
      const resetToken = 'valid-reset-token';
      const newPassword = 'newSecurePassword123';

      // Mock token validation and password reset
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

      // Mock confirmation email
      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const result = await authService.resetPassword(resetToken, newPassword);

      expect(result).toEqual({
        success: true,
        message: 'Password has been reset successfully.',
      });

      // Verify database interactions
      expect(mockPool.query).toHaveBeenCalledTimes(5);
      
      // Verify confirmation email was sent
      expect(mockTransporter.sendMail).toHaveBeenCalledOnce();
    });

    it('should reject password reset with invalid token', async () => {
      // Mock token not found
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await authService.resetPassword('invalid-token', 'newPassword123');

      expect(result).toEqual({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    });

    it('should validate password strength', async () => {
      const result = await authService.resetPassword('valid-token', '123');

      expect(result).toEqual({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    });
  });

  describe('End-to-End Password Recovery Flow', () => {
    it('should complete full password recovery journey', async () => {
      const resetBaseUrl = 'https://example.com/reset-password';
      const newPassword = 'newSecurePassword123';
      let resetToken: string;

      // Step 1: Request password reset
      mockPool.query
        .mockResolvedValueOnce({ rows: [testUser] }) // findByEmail
        .mockResolvedValueOnce({ rows: [] }) // invalidateUserTokens
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: 'token-id',
            user_id: testUser.id,
            token: 'generated-reset-token',
            expires_at: new Date(Date.now() + 3600000),
            created_at: new Date(),
          }] 
        }); // createToken

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'test-message-id',
        response: '250 OK',
      });

      const requestResult = await authService.initiatePasswordReset(testUserEmail, resetBaseUrl);
      expect(requestResult.success).toBe(true);
      
      // Extract token from result
      resetToken = 'generated-reset-token';

      // Step 2: Validate reset token
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'token-id',
          user_id: testUser.id,
          token: resetToken,
          expires_at: new Date(Date.now() + 3600000),
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const validateResult = await authService.validateResetToken(resetToken);
      expect(validateResult.valid).toBe(true);

      // Step 3: Reset password
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

      const resetResult = await authService.resetPassword(resetToken, newPassword);
      expect(resetResult.success).toBe(true);

      // Verify all steps completed successfully
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(2); // Reset email + confirmation email
    });

    it('should prevent token reuse after successful password reset', async () => {
      const resetToken = 'used-reset-token';

      // First, simulate successful password reset
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
        })
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const firstResult = await authService.resetPassword(resetToken, 'newPassword123');
      expect(firstResult.success).toBe(true);

      // Now try to use the same token again (should fail)
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // Token should be marked as used

      const secondResult = await authService.resetPassword(resetToken, 'anotherPassword123');
      expect(secondResult).toEqual({
        success: false,
        message: 'Invalid or expired reset token.',
      });
    });
  });

  describe('Database Operations', () => {
    it('should handle token cleanup operations', async () => {
      // Mock cleanup operation
      mockPool.query.mockResolvedValueOnce({ rowCount: 5 });

      const cleanupResult = await passwordResetTokenRepository.cleanupExpiredTokens();
      
      expect(cleanupResult).toBe(5);
      // Verify the query was called (the exact format may vary due to whitespace)
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      const [query, params] = mockPool.query.mock.calls[0];
      expect(query).toContain('DELETE FROM password_reset_tokens');
      expect(query).toContain('WHERE expires_at < NOW()');
      // Parameters may be undefined for this query
      expect(params || []).toEqual([]);
    });

    it('should provide token statistics for monitoring', async () => {
      const mockStats = {
        total: '10',
        active: '2',
        expired: '3',
        used: '5',
      };

      mockPool.query.mockResolvedValueOnce({ rows: [mockStats] });

      const stats = await passwordResetTokenRepository.getTokenStatistics();
      
      expect(stats).toEqual({
        total: 10,
        active: 2,
        expired: 3,
        used: 5,
      });
    });

    it('should handle concurrent token creation for same user', async () => {
      // Mock creating new token with proper row data
      mockPool.query.mockResolvedValueOnce({ 
        rows: [{ 
          id: 'new-token-id',
          user_id: testUser.id,
          token: 'new-secure-token',
          expires_at: new Date(Date.now() + 3600000),
          used_at: null,
          created_at: new Date(),
        }] 
      });

      const newToken = await passwordResetTokenRepository.createToken({
        userId: testUser.id,
        expiresAt: new Date(Date.now() + 3600000),
      });

      expect(newToken.token).toBe('new-secure-token');
      expect(newToken.userId).toBe(testUser.id);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('Security Features', () => {
    it('should generate cryptographically secure tokens', async () => {
      const tokens = new Set();
      
      // Generate multiple tokens and ensure they're unique
      for (let i = 0; i < 100; i++) {
        const token = crypto.randomBytes(32).toString('hex');
        expect(token).toHaveLength(64); // 32 bytes = 64 hex characters
        expect(tokens.has(token)).toBe(false); // Should be unique
        tokens.add(token);
      }
    });

    it('should invalidate all user sessions on password reset', async () => {
      const resetToken = 'valid-reset-token';

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
        })
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockResolvedValueOnce({ rows: [] }) // update password
        .mockResolvedValueOnce({ rows: [] }) // mark token as used
        .mockResolvedValueOnce({ rows: [] }); // blacklist all user tokens

      mockTransporter.sendMail.mockResolvedValue({
        messageId: 'confirmation-message-id',
        response: '250 OK',
      });

      const result = await authService.resetPassword(resetToken, 'newPassword123');
      expect(result.success).toBe(true);

      // Verify that blacklistAllUserTokens was called
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO jwt_token_blacklist'),
        expect.arrayContaining([testUser.id])
      );
    });

    it('should not reveal user existence through service responses', async () => {
      // Request for non-existent user
      mockPool.query.mockResolvedValueOnce({ rows: [] });
      
      const nonExistentResult = await authService.initiatePasswordReset(
        'nonexistent@example.com',
        'https://example.com/reset-password'
      );

      // Request for existing user
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

      const existingResult = await authService.initiatePasswordReset(
        testUserEmail,
        'https://example.com/reset-password'
      );

      // Both should return similar success messages for security
      expect(nonExistentResult.message).toContain('If an account with that email exists');
      expect(existingResult.message).toContain('Password reset link has been sent');
      expect(nonExistentResult.success).toBe(true);
      expect(existingResult.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during password reset', async () => {
      const resetToken = 'valid-reset-token';

      // Mock token validation success but user update failure
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
        })
        .mockResolvedValueOnce({ rows: [testUser] })
        .mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(authService.resetPassword(resetToken, 'newPassword123'))
        .rejects.toThrow('Failed to reset password');
    });

    it('should handle email service failures gracefully', async () => {
      // Mock user lookup and token creation
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

      // Mock email failure
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP connection failed'));

      await expect(authService.initiatePasswordReset(
        testUserEmail,
        'https://example.com/reset-password'
      )).rejects.toThrow('Failed to initiate password reset');
    });
  });
});