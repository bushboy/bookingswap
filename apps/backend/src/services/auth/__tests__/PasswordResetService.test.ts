import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthService, PasswordResetResult } from '../AuthService';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { PasswordResetTokenRepository } from '../../../database/repositories/PasswordResetTokenRepository';
import { JwtTokenBlacklistRepository } from '../../../database/repositories/JwtTokenBlacklistRepository';
import { EmailService } from '../../email/EmailService';
import { WalletService } from '../../hedera/WalletService';
import { User } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/UserRepository');
vi.mock('../../../database/repositories/PasswordResetTokenRepository');
vi.mock('../../../database/repositories/JwtTokenBlacklistRepository');
vi.mock('../../email/EmailService');
vi.mock('../../hedera/WalletService');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('AuthService - Password Reset', () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockPasswordResetTokenRepository: PasswordResetTokenRepository;
  let mockJwtTokenBlacklistRepository: JwtTokenBlacklistRepository;
  let mockEmailService: EmailService;
  let mockWalletService: WalletService;

  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0.0.123456',
    profile: {
      displayName: 'John Doe',
      email: 'john@example.com',
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
    token: 'reset-token-hash',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = new UserRepository({} as any);
    mockPasswordResetTokenRepository = new PasswordResetTokenRepository({} as any);
    mockJwtTokenBlacklistRepository = new JwtTokenBlacklistRepository({} as any);
    mockEmailService = new EmailService();
    mockWalletService = new WalletService({} as any);

    authService = new AuthService(
      mockUserRepository,
      mockWalletService,
      mockPasswordResetTokenRepository,
      mockEmailService,
      mockJwtTokenBlacklistRepository,
      'test-secret'
    );

    vi.clearAllMocks();
  });

  describe('initiatePasswordReset', () => {
    it('should successfully initiate password reset for valid email', async () => {
      // Arrange
      (mockUserRepository.findByEmail as Mock).mockResolvedValue(mockUser);
      (mockPasswordResetTokenRepository.invalidateUserTokens as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.createToken as Mock).mockResolvedValue(mockResetToken);
      (mockEmailService.sendPasswordResetEmail as Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.initiatePasswordReset(
        'john@example.com',
        'http://localhost:3000/reset-password'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password reset link has been sent');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(mockPasswordResetTokenRepository.invalidateUserTokens).toHaveBeenCalledWith('user-123');
      expect(mockPasswordResetTokenRepository.createToken).toHaveBeenCalledWith({
        userId: 'user-123',
        expiresAt: expect.any(Date),
      });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledWith({
        userEmail: 'john@example.com',
        userName: 'John Doe',
        resetToken: 'reset-token-hash',
        resetUrl: expect.stringContaining('reset-token-hash'),
        expiresAt: expect.any(Date),
      });
    });

    it('should return success message for non-existent email (security)', async () => {
      // Arrange
      (mockUserRepository.findByEmail as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.initiatePasswordReset(
        'nonexistent@example.com',
        'http://localhost:3000/reset-password'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account with that email exists');
      expect(mockPasswordResetTokenRepository.createToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should return success message for wallet-only user (security)', async () => {
      // Arrange
      const walletOnlyUser = { ...mockUser, profile: { ...mockUser.profile, email: undefined } };
      (mockUserRepository.findByEmail as Mock).mockResolvedValue(walletOnlyUser);

      // Act
      const result = await authService.initiatePasswordReset(
        'john@example.com',
        'http://localhost:3000/reset-password'
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('If an account with that email exists');
      expect(mockPasswordResetTokenRepository.createToken).not.toHaveBeenCalled();
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should handle email service errors', async () => {
      // Arrange
      (mockUserRepository.findByEmail as Mock).mockResolvedValue(mockUser);
      (mockPasswordResetTokenRepository.invalidateUserTokens as Mock).mockResolvedValue(undefined);
      (mockPasswordResetTokenRepository.createToken as Mock).mockResolvedValue(mockResetToken);
      (mockEmailService.sendPasswordResetEmail as Mock).mockRejectedValue(new Error('Email failed'));

      // Act & Assert
      await expect(
        authService.initiatePasswordReset('john@example.com', 'http://localhost:3000/reset-password')
      ).rejects.toThrow('Failed to initiate password reset');
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password with valid token', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.update as Mock).mockResolvedValue(mockUser);
      (mockPasswordResetTokenRepository.markTokenAsUsed as Mock).mockResolvedValue(undefined);
      (mockJwtTokenBlacklistRepository.blacklistAllUserTokens as Mock).mockResolvedValue(1);

      // Act
      const result = await authService.resetPassword('reset-token-hash', 'NewPassword123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain('Password has been reset successfully');
      expect(mockPasswordResetTokenRepository.findValidToken).toHaveBeenCalledWith('reset-token-hash');
      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        passwordHash: expect.any(String),
      });
      expect(mockPasswordResetTokenRepository.markTokenAsUsed).toHaveBeenCalledWith('token-123');
    });

    it('should reject password reset with invalid token', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword('invalid-token', 'NewPassword123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or expired reset token');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenRepository.markTokenAsUsed).not.toHaveBeenCalled();
    });

    it('should reject weak passwords', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);

      // Act
      const result = await authService.resetPassword('reset-token-hash', '123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Password must be at least 6 characters');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenRepository.markTokenAsUsed).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);
      (mockUserRepository.findById as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.resetPassword('reset-token-hash', 'NewPassword123');

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('User not found');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockPasswordResetTokenRepository.markTokenAsUsed).not.toHaveBeenCalled();
    });
  });

  describe('validateResetToken', () => {
    it('should validate valid token', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(mockResetToken);

      // Act
      const result = await authService.validateResetToken('reset-token-hash');

      // Assert
      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.expiresAt).toEqual(mockResetToken.expiresAt);
    });

    it('should invalidate invalid token', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockResolvedValue(null);

      // Act
      const result = await authService.validateResetToken('invalid-token');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      (mockPasswordResetTokenRepository.findValidToken as Mock).mockRejectedValue(
        new Error('Database error')
      );

      // Act
      const result = await authService.validateResetToken('reset-token-hash');

      // Assert
      expect(result.valid).toBe(false);
    });
  });
});