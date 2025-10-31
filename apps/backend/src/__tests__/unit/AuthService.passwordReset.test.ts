import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthService } from '../../services/auth/AuthService';
import { UserRepository } from '../../database/repositories/UserRepository';
import { PasswordResetTokenRepository } from '../../database/repositories/PasswordResetTokenRepository';
import { JwtTokenBlacklistRepository } from '../../database/repositories/JwtTokenBlacklistRepository';
import { EmailService } from '../../services/email/EmailService';
import { WalletService } from '../../services/hedera/WalletService';
import { User } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/UserRepository');
vi.mock('../../database/repositories/PasswordResetTokenRepository');
vi.mock('../../database/repositories/JwtTokenBlacklistRepository');
vi.mock('../../services/email/EmailService');
vi.mock('../../services/hedera/WalletService');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AuthService - Password Reset Methods', () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockPasswordResetTokenRepository: PasswordResetTokenRepository;
  let mockJwtTokenBlacklistRepository: JwtTokenBlacklistRepository;
  let mockEmailService: EmailService;
  let mockWalletService: WalletService;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$2a$12$hashedpassword',
    walletAddress: '0.0.123456',
    profile: {
      email: 'test@example.com',
      displayName: 'Test User',
      preferences: { notifications: true },
    },
    verification: {
      level: 'basic',
      documents: [],
    },
    reputation: {
      score: 100,
      completedSwaps: 0,
      cancelledSwaps: 0,
      reviews: [],
    },
    lastActiveAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockResetToken = {
    id: 'token-123',
    userId: 'user-123',
    token: 'secure-reset-token-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockUserRepository = new UserRepository({} as any);
    mockPasswordResetTokenRepository = new PasswordResetTokenRepository({} as any);
    mockJwtTokenBlacklistRepository = new JwtTokenBlacklistRepository({} as any);
    mockEmailService = new EmailService();
    mockWalletService = new WalletService({} as any);

    // Create AuthService instance
    authService = new AuthService(
      mockUserRepository,
      mockWalletService,
      mockPasswordResetTokenRepository,
      mockEmailService,
      mockJwtTokenBlacklistRepository,
      'test-jwt-secret'
    );
  });

  describe('initiatePasswordReset', () => {
    it('should successfully initiate password reset for existing user', async () => {
      // Arrange
      const email = 'test@example.com';
      const resetBaseUrl = 'https://app.example.com/reset-password';

      (mockUserRepository.findByEmail as Mock).mockResolvedValue(mockUser);
      (mockPasswordResetTokenRepository.invalidateUserTokens as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.createToken as Mock).mockResolvedValue(mockResetToken);
      (mockEmailService.sendPasswordResetEmail as Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.initiatePasswordReset(email, resetBaseUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password reset link has been sent to your email address.');
      expect(result.resetToken).toBe(mockResetToken.token);
      expect(result.expiresAt).toBeInstanceOf(Date);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockPasswordResetTokenRepository.invalidateUserTokens).toHaveBeenCalledWith(mockUser.id);
      expect(mockPasswordResetTokenRepository.createToken).toHaveBeenCalledWith({
        userId: mockUser.id,
        expiresAt: expect.any(Date),
      });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith({
        userEmail: mockUser.profile.email,
        userName: mockUser.profile.displayName,
        resetToken: mockResetToken.token,
        resetUrl: `${resetBaseUrl}?token=${mockResetToken.token}`,
        expiresAt: expect.any(Date),
      });
    });

    it('should return success message for non-existent email (security)', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      const resetBaseUrl = 'https://app.example.com/reset-password';

      (mockUserRepository.findByEmail as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.initiatePasswordReset(email, resetBaseUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('If an account with that email exists, a password reset link has been sent.');
      expect(result.resetToken).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockPasswordResetTokenRepository.invalidateUserTokens).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenRepository.createToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return success message for wallet-only user (no email)', async () => {
      // Arrange
      const email = 'test@example.com';
      const resetBaseUrl = 'https://app.example.com/reset-password';
      const walletOnlyUser = { ...mockUser, profile: { ...mockUser.profile, email: undefined } };

      (mockUserRepository.findByEmail as Mock).mockResolvedValue(walletOnlyUser);

      // Act
      const result = await authService.initiatePasswordReset(email, resetBaseUrl);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('If an account with that email exists, a password reset link has been sent.');
      expect(result.resetToken).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockPasswordResetTokenRepository.invalidateUserTokens).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenRepository.createToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw error when password reset service not configured', async () => {
      // Arrange
      const authServiceWithoutReset = new AuthService(
        mockUserRepository,
        mockWalletService,
        undefined, // No password reset repository
        mockEmailService,
        mockJwtTokenBlacklistRepository,
        'test-jwt-secret'
      );

      // Act & Assert
      await expect(
        authServiceWithoutReset.initiatePasswordReset('test@example.com', 'https://app.example.com')
      ).rejects.toThrow('Failed to initiate password reset');
    });

    it('should throw error when email service fails', async () => {
      // Arrange
      const email = 'test@example.com';
      const resetBaseUrl = 'https://app.example.com/reset-password';

      (mockUserRepository.findByEmail as Mock).mockResolvedValue(mockUser);
      (mockPasswordResetTokenRepository.invalidateUserTokens as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.createToken as Mock).mockResolvedValue(mockResetToken);
      (mockEmailService.sendPasswordResetEmail as Mock).mockRejectedValue(new Error('Email service error'));

      // Act & Assert
      await expect(
        authService.initiatePasswordReset(email, resetBaseUrl)
      ).rejects.toThrow('Failed to initiate password reset');
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'newSecurePassword123';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.update as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.markTokenAsUsed as Mock).mockResolvedValue(undefined);
      (mockJwtTokenBlacklistRepository.blacklistAllUserTokens as Mock).mockResolvedValue(undefined);
      (mockEmailService.sendPasswordResetConfirmationEmail as Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.resetPassword(token, newPassword);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password has been reset successfully.');

      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockResetToken.userId);
      expect(mockUserRepository.update).toHaveBeenCalledWith(mockUser.id, {
        passwordHash: expect.any(String),
      });
      expect(mockPasswordResetTokenRepository.markTokenAsUsed).toHaveBeenCalledWith(mockResetToken.id);
      expect(mockJwtTokenBlacklistRepository.blacklistAllUserTokens).toHaveBeenCalledWith(
        mockUser.id,
        'Password reset'
      );
    });

    it('should reject password that is too short', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const shortPassword = '123';

      // Act
      const result = await authService.resetPassword(token, shortPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Password must be at least 6 characters long.');

      expect(mockPasswordResetTokenRepository.findValidToken).not.toHaveBeenCalled();
    });

    it('should reject invalid or expired token', async () => {
      // Arrange
      const token = 'invalid-token';
      const newPassword = 'newSecurePassword123';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword(token, newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired reset token.');

      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should reject when user not found', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'newSecurePassword123';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);
      (mockUserRepository.findById as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword(token, newPassword);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toBe('User not found.');

      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith(token);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockResetToken.userId);
    });

    it('should throw error when password reset service not configured', async () => {
      // Arrange
      const authServiceWithoutReset = new AuthService(
        mockUserRepository,
        mockWalletService,
        undefined, // No password reset repository
        mockEmailService,
        mockJwtTokenBlacklistRepository,
        'test-jwt-secret'
      );

      // Act & Assert
      await expect(
        authServiceWithoutReset.resetPassword('token', 'password')
      ).rejects.toThrow('Failed to reset password');
    });

    it('should continue even if confirmation email fails', async () => {
      // Arrange
      const token = 'valid-reset-token';
      const newPassword = 'newSecurePassword123';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.update as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.markTokenAsUsed as Mock).mockResolvedValue(undefined);
      (mockJwtTokenBlacklistRepository.blacklistAllUserTokens as Mock).mockResolvedValue(undefined);
      (mockEmailService.sendPasswordResetConfirmationEmail as Mock).mockRejectedValue(
        new Error('Email service error')
      );

      // Act
      const result = await authService.resetPassword(token, newPassword);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBe('Password has been reset successfully.');
    });
  });

  describe('validateResetToken', () => {
    it('should return valid for valid token', async () => {
      // Arrange
      const token = 'valid-reset-token';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);

      // Act
      const result = await authService.validateResetToken(token);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockResetToken.userId);
      expect(result.expiresAt).toEqual(mockResetToken.expiresAt);

      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith(token);
    });

    it('should return invalid for invalid token', async () => {
      // Arrange
      const token = 'invalid-token';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.validateResetToken(token);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();

      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith(token);
    });

    it('should return invalid when password reset service not configured', async () => {
      // Arrange
      const authServiceWithoutReset = new AuthService(
        mockUserRepository,
        mockWalletService,
        undefined, // No password reset repository
        mockEmailService,
        mockJwtTokenBlacklistRepository,
        'test-jwt-secret'
      );

      // Act
      const result = await authServiceWithoutReset.validateResetToken('token');

      // Assert
      expect(result.valid).toBe(false);
    });

    it('should return invalid when repository throws error', async () => {
      // Arrange
      const token = 'valid-reset-token';

      (mockPasswordResetTokenRepository.findValidToken as Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await authService.validateResetToken(token);

      // Assert
      expect(result.valid).toBe(false);
    });
  });

  describe('invalidateAllUserSessions', () => {
    it('should successfully invalidate all user sessions', async () => {
      // Arrange
      const userId = 'user-123';
      const reason = 'Password reset';

      (mockJwtTokenBlacklistRepository.blacklistAllUserTokens as Mock).mockResolvedValue(undefined);

      // Act
      await authService.invalidateAllUserSessions(userId, reason);

      // Assert
      expect(mockJwtTokenBlacklistRepository.blacklistAllUserTokens).toHaveBeenCalledWith(userId, reason);
    });

    it('should handle missing blacklist repository gracefully', async () => {
      // Arrange
      const authServiceWithoutBlacklist = new AuthService(
        mockUserRepository,
        mockWalletService,
        mockPasswordResetTokenRepository,
        mockEmailService,
        undefined, // No blacklist repository
        'test-jwt-secret'
      );

      // Act & Assert - Should not throw
      await expect(
        authServiceWithoutBlacklist.invalidateAllUserSessions('user-123', 'Test reason')
      ).resolves.toBeUndefined();
    });

    it('should throw error when blacklist operation fails', async () => {
      // Arrange
      const userId = 'user-123';
      const reason = 'Password reset';

      (mockJwtTokenBlacklistRepository.blacklistAllUserTokens as Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Act & Assert
      await expect(
        authService.invalidateAllUserSessions(userId, reason)
      ).rejects.toThrow('Failed to invalidate user sessions');
    });
  });
});