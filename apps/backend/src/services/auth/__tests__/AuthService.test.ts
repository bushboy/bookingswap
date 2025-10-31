import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { AuthService, WalletSignatureData } from '../AuthService';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { WalletService } from '../../hedera/WalletService';
import { User } from '@booking-swap/shared';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('../../../database/repositories/UserRepository');
vi.mock('../../hedera/WalletService');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: UserRepository;
  let mockWalletService: WalletService;

  const mockUser: User = {
    id: 'user-123',
    walletAddress: '0.0.123456',
    profile: {
      displayName: 'Test User',
      email: 'test@example.com',
      preferences: {
        notifications: true,
      },
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

  const mockSignatureData: WalletSignatureData = {
    message: 'Test message',
    signature: 'test-signature',
    publicKey: 'test-public-key',
    walletAddress: '0.0.123456',
  };

  beforeEach(() => {
    mockUserRepository = {
      findByWalletAddress: vi.fn(),
      create: vi.fn(),
      updateLastActive: vi.fn(),
      findById: vi.fn(),
    } as any;

    mockWalletService = {
      verifySignature: vi.fn(),
    } as any;

    authService = new AuthService(
      mockUserRepository,
      mockWalletService,
      'test-secret',
      '24h'
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('authenticateWithWallet', () => {
    it('should authenticate existing user with valid signature', async () => {
      // Arrange
      (mockWalletService.verifySignature as Mock).mockResolvedValue(true);
      (mockUserRepository.findByWalletAddress as Mock).mockResolvedValue(mockUser);
      (mockUserRepository.updateLastActive as Mock).mockResolvedValue(undefined);

      // Act
      const result = await authService.authenticateWithWallet(mockSignatureData);

      // Assert
      expect(mockWalletService.verifySignature).toHaveBeenCalledWith(
        mockSignatureData.message,
        mockSignatureData.signature,
        mockSignatureData.publicKey
      );
      expect(mockUserRepository.findByWalletAddress).toHaveBeenCalledWith(mockSignatureData.walletAddress);
      expect(mockUserRepository.updateLastActive).toHaveBeenCalledWith(mockUser.id);
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should create new user if not exists', async () => {
      // Arrange
      (mockWalletService.verifySignature as Mock).mockResolvedValue(true);
      (mockUserRepository.findByWalletAddress as Mock).mockResolvedValue(null);
      (mockUserRepository.create as Mock).mockResolvedValue(mockUser);

      // Act
      const result = await authService.authenticateWithWallet(mockSignatureData);

      // Assert
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          walletAddress: mockSignatureData.walletAddress,
          profile: expect.objectContaining({
            preferences: { notifications: true },
          }),
          verification: expect.objectContaining({
            level: 'basic',
            documents: [],
          }),
          reputation: expect.objectContaining({
            score: 100,
            completedSwaps: 0,
            cancelledSwaps: 0,
            reviews: [],
          }),
        })
      );
      expect(result.user).toEqual(mockUser);
      expect(result.token).toBeDefined();
    });

    it('should throw error for invalid signature', async () => {
      // Arrange
      (mockWalletService.verifySignature as Mock).mockResolvedValue(false);

      // Act & Assert
      await expect(authService.authenticateWithWallet(mockSignatureData))
        .rejects.toThrow('Authentication failed');
      
      expect(mockUserRepository.findByWalletAddress).not.toHaveBeenCalled();
    });

    it('should handle wallet service errors', async () => {
      // Arrange
      (mockWalletService.verifySignature as Mock).mockRejectedValue(new Error('Wallet error'));

      // Act & Assert
      await expect(authService.authenticateWithWallet(mockSignatureData))
        .rejects.toThrow('Authentication failed');
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      // Act
      const token = authService.generateToken(mockUser);

      // Assert
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, 'test-secret') as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.walletAddress).toBe(mockUser.walletAddress);
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      // Arrange
      const token = authService.generateToken(mockUser);

      // Act
      const payload = await authService.verifyToken(token);

      // Assert
      expect(payload.userId).toBe(mockUser.id);
      expect(payload.walletAddress).toBe(mockUser.walletAddress);
    });

    it('should throw error for invalid token', async () => {
      // Act & Assert
      await expect(authService.verifyToken('invalid-token'))
        .rejects.toThrow('Invalid token');
    });

    it('should throw error for expired token', async () => {
      // Arrange
      const expiredToken = jwt.sign(
        { userId: mockUser.id, walletAddress: mockUser.walletAddress },
        'test-secret',
        { expiresIn: '-1h' }
      );

      // Act & Assert
      await expect(authService.verifyToken(expiredToken))
        .rejects.toThrow('Token expired');
    });
  });

  describe('generateChallengeMessage', () => {
    it('should generate challenge message with wallet address', () => {
      // Act
      const message = authService.generateChallengeMessage('0.0.123456');

      // Assert
      expect(message).toContain('0.0.123456');
      expect(message).toContain('Booking Swap Platform');
      expect(message).toContain('Timestamp:');
      expect(message).toContain('Nonce:');
    });

    it('should generate unique messages', () => {
      // Act
      const message1 = authService.generateChallengeMessage('0.0.123456');
      const message2 = authService.generateChallengeMessage('0.0.123456');

      // Assert
      expect(message1).not.toBe(message2);
    });
  });

  describe('refreshTokenIfNeeded', () => {
    it('should return new token if close to expiration', async () => {
      // Arrange
      const shortLivedToken = jwt.sign(
        { userId: mockUser.id, walletAddress: mockUser.walletAddress },
        'test-secret',
        { expiresIn: '30m' } // 30 minutes, less than 1 hour threshold
      );
      (mockUserRepository.findById as Mock).mockResolvedValue(mockUser);

      // Act
      const newToken = await authService.refreshTokenIfNeeded(shortLivedToken);

      // Assert
      expect(newToken).toBeDefined();
      expect(newToken).not.toBe(shortLivedToken);
    });

    it('should return null if token has plenty of time left', async () => {
      // Arrange
      const longLivedToken = jwt.sign(
        { userId: mockUser.id, walletAddress: mockUser.walletAddress },
        'test-secret',
        { expiresIn: '12h' } // 12 hours, more than 1 hour threshold
      );

      // Act
      const newToken = await authService.refreshTokenIfNeeded(longLivedToken);

      // Assert
      expect(newToken).toBeNull();
    });

    it('should return null for invalid token', async () => {
      // Act
      const newToken = await authService.refreshTokenIfNeeded('invalid-token');

      // Assert
      expect(newToken).toBeNull();
    });
  });

  describe('hashPassword', () => {
    it('should hash password', async () => {
      // Act
      const hashedPassword = await authService.hashPassword('test-password');

      // Assert
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe('test-password');
      expect(hashedPassword.length).toBeGreaterThan(50);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      // Arrange
      const password = 'test-password';
      const hashedPassword = await authService.hashPassword(password);

      // Act
      const isValid = await authService.verifyPassword(password, hashedPassword);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      // Arrange
      const hashedPassword = await authService.hashPassword('correct-password');

      // Act
      const isValid = await authService.verifyPassword('wrong-password', hashedPassword);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('Session Invalidation', () => {
    let mockJwtTokenBlacklistRepository: any;

    beforeEach(() => {
      mockJwtTokenBlacklistRepository = {
        blacklistAllUserTokens: vi.fn(),
        blacklistToken: vi.fn(),
        isTokenBlacklisted: vi.fn(),
        areUserSessionsInvalidated: vi.fn(),
      };

      authService = new AuthService(
        mockUserRepository,
        mockWalletService,
        undefined, // passwordResetTokenRepository
        undefined, // emailService
        mockJwtTokenBlacklistRepository,
        'test-secret'
      );
    });

    describe('invalidateAllUserSessions', () => {
      it('should invalidate all user sessions', async () => {
        // Arrange
        mockJwtTokenBlacklistRepository.blacklistAllUserTokens.mockResolvedValue(1);

        // Act
        await authService.invalidateAllUserSessions('user-123', 'Password reset');

        // Assert
        expect(mockJwtTokenBlacklistRepository.blacklistAllUserTokens).toHaveBeenCalledWith(
          'user-123',
          'Password reset'
        );
      });

      it('should handle missing blacklist repository gracefully', async () => {
        // Arrange
        authService = new AuthService(
          mockUserRepository,
          mockWalletService,
          undefined, // passwordResetTokenRepository
          undefined, // emailService
          undefined, // No blacklist repository
          'test-secret'
        );

        // Act & Assert - should not throw
        await expect(authService.invalidateAllUserSessions('user-123')).resolves.toBeUndefined();
      });
    });

    describe('revokeToken', () => {
      it('should revoke a specific token', async () => {
        // Arrange
        const token = authService.generateToken(mockUser);
        mockJwtTokenBlacklistRepository.blacklistToken.mockResolvedValue({});

        // Act
        await authService.revokeToken(token, 'Manual revocation');

        // Assert
        expect(mockJwtTokenBlacklistRepository.blacklistToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockUser.id,
            reason: 'Manual revocation',
          })
        );
      });

      it('should handle invalid token format', async () => {
        // Act & Assert
        await expect(authService.revokeToken('invalid-token')).rejects.toThrow('Failed to revoke token');
      });
    });

    describe('verifyToken with blacklist', () => {
      it('should reject blacklisted token', async () => {
        // Arrange
        const token = authService.generateToken(mockUser);
        mockJwtTokenBlacklistRepository.isTokenBlacklisted.mockResolvedValue(true);

        // Act & Assert
        await expect(authService.verifyToken(token)).rejects.toThrow('Token has been revoked');
      });

      it('should reject token when user sessions are invalidated', async () => {
        // Arrange
        const token = authService.generateToken(mockUser);
        mockJwtTokenBlacklistRepository.isTokenBlacklisted.mockResolvedValue(false);
        mockJwtTokenBlacklistRepository.areUserSessionsInvalidated.mockResolvedValue(true);

        // Act & Assert
        await expect(authService.verifyToken(token)).rejects.toThrow('User sessions have been invalidated');
      });

      it('should accept valid token when not blacklisted', async () => {
        // Arrange
        const token = authService.generateToken(mockUser);
        mockJwtTokenBlacklistRepository.isTokenBlacklisted.mockResolvedValue(false);
        mockJwtTokenBlacklistRepository.areUserSessionsInvalidated.mockResolvedValue(false);

        // Act
        const payload = await authService.verifyToken(token);

        // Assert
        expect(payload.userId).toBe(mockUser.id);
      });
    });

    describe('isTokenValid', () => {
      it('should return true for valid token', async () => {
        // Arrange
        const token = authService.generateToken(mockUser);
        mockJwtTokenBlacklistRepository.isTokenBlacklisted.mockResolvedValue(false);
        mockJwtTokenBlacklistRepository.areUserSessionsInvalidated.mockResolvedValue(false);

        // Act
        const isValid = await authService.isTokenValid(token);

        // Assert
        expect(isValid).toBe(true);
      });

      it('should return false for invalid token', async () => {
        // Act
        const isValid = await authService.isTokenValid('invalid-token');

        // Assert
        expect(isValid).toBe(false);
      });
    });
  });
});