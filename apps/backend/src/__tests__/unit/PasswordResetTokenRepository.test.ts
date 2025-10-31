import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Pool } from 'pg';
import { PasswordResetTokenRepository, CreatePasswordResetTokenData } from '../../database/repositories/PasswordResetTokenRepository';

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('secure-random-token-123456789012345678901234567890123456789012345678901234567890'),
    }),
  },
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('secure-random-token-123456789012345678901234567890123456789012345678901234567890'),
  }),
}));

describe('PasswordResetTokenRepository', () => {
  let repository: PasswordResetTokenRepository;
  let mockPool: Pool;
  let mockQuery: Mock;

  const mockTokenRow = {
    id: 'token-123',
    user_id: 'user-123',
    token: 'secure-random-token-123456789012345678901234567890123456789012345678901234567890',
    expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
    used_at: null,
    created_at: new Date(),
  };

  const mockTokenEntity = {
    id: 'token-123',
    userId: 'user-123',
    token: 'secure-random-token-123456789012345678901234567890123456789012345678901234567890',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockQuery = vi.fn();
    mockPool = {
      query: mockQuery,
    } as any;

    repository = new PasswordResetTokenRepository(mockPool);
  });

  describe('createToken', () => {
    it('should create a new password reset token', async () => {
      // Arrange
      const tokenData: CreatePasswordResetTokenData = {
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockQuery.mockResolvedValue({
        rows: [mockTokenRow],
      });

      // Act
      const result = await repository.createToken(tokenData);

      // Assert
      expect(result).toEqual(mockTokenEntity);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO password_reset_tokens'),
        [
          tokenData.userId,
          expect.any(String), // Generated token
          tokenData.expiresAt,
        ]
      );
    });

    it('should generate a secure random token', async () => {
      // Arrange
      const tokenData: CreatePasswordResetTokenData = {
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockQuery.mockResolvedValue({
        rows: [mockTokenRow],
      });

      // Act
      await repository.createToken(tokenData);

      // Assert
      const crypto = await import('crypto');
      expect(crypto.default.randomBytes).toHaveBeenCalledWith(32);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        [
          tokenData.userId,
          expect.any(String), // Generated token
          tokenData.expiresAt,
        ]
      );
    });

    it('should handle database errors', async () => {
      // Arrange
      const tokenData: CreatePasswordResetTokenData = {
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      };

      mockQuery.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(repository.createToken(tokenData)).rejects.toThrow('Database connection failed');
    });
  });

  describe('findValidToken', () => {
    it('should find a valid token', async () => {
      // Arrange
      const token = 'valid-token';

      mockQuery.mockResolvedValue({
        rows: [mockTokenRow],
      });

      // Act
      const result = await repository.findValidToken(token);

      // Assert
      expect(result).toEqual(mockTokenEntity);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token = $1'),
        [token]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND used_at IS NULL'),
        [token]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND expires_at > NOW()'),
        [token]
      );
    });

    it('should return null for non-existent token', async () => {
      // Arrange
      const token = 'non-existent-token';

      mockQuery.mockResolvedValue({
        rows: [],
      });

      // Act
      const result = await repository.findValidToken(token);

      // Assert
      expect(result).toBeNull();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE token = $1'),
        [token]
      );
    });

    it('should return null for used token', async () => {
      // Arrange
      const token = 'used-token';
      const usedTokenRow = { ...mockTokenRow, used_at: new Date() };

      mockQuery.mockResolvedValue({
        rows: [], // Query filters out used tokens
      });

      // Act
      const result = await repository.findValidToken(token);

      // Assert
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Arrange
      const token = 'expired-token';

      mockQuery.mockResolvedValue({
        rows: [], // Query filters out expired tokens
      });

      // Act
      const result = await repository.findValidToken(token);

      // Assert
      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      // Arrange
      const token = 'valid-token';

      mockQuery.mockRejectedValue(new Error('Database query failed'));

      // Act & Assert
      await expect(repository.findValidToken(token)).rejects.toThrow('Database query failed');
    });
  });

  describe('markTokenAsUsed', () => {
    it('should mark token as used', async () => {
      // Arrange
      const tokenId = 'token-123';

      mockQuery.mockResolvedValue({ rowCount: 1 });

      // Act
      await repository.markTokenAsUsed(tokenId);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        [tokenId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET used_at = NOW()'),
        [tokenId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [tokenId]
      );
    });

    it('should handle non-existent token gracefully', async () => {
      // Arrange
      const tokenId = 'non-existent-token';

      mockQuery.mockResolvedValue({ rowCount: 0 });

      // Act & Assert - Should not throw
      await expect(repository.markTokenAsUsed(tokenId)).resolves.toBeUndefined();
    });

    it('should handle database errors', async () => {
      // Arrange
      const tokenId = 'token-123';

      mockQuery.mockRejectedValue(new Error('Database update failed'));

      // Act & Assert
      await expect(repository.markTokenAsUsed(tokenId)).rejects.toThrow('Database update failed');
    });
  });

  describe('invalidateUserTokens', () => {
    it('should invalidate all user tokens', async () => {
      // Arrange
      const userId = 'user-123';

      mockQuery.mockResolvedValue({ rowCount: 2 });

      // Act
      await repository.invalidateUserTokens(userId);

      // Assert
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE password_reset_tokens'),
        [userId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SET used_at = NOW()'),
        [userId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1 AND used_at IS NULL'),
        [userId]
      );
    });

    it('should handle user with no tokens gracefully', async () => {
      // Arrange
      const userId = 'user-with-no-tokens';

      mockQuery.mockResolvedValue({ rowCount: 0 });

      // Act & Assert - Should not throw
      await expect(repository.invalidateUserTokens(userId)).resolves.toBeUndefined();
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-123';

      mockQuery.mockRejectedValue(new Error('Database update failed'));

      // Act & Assert
      await expect(repository.invalidateUserTokens(userId)).rejects.toThrow('Database update failed');
    });
  });

  describe('findByUserId', () => {
    it('should find tokens by user ID (excluding used tokens by default)', async () => {
      // Arrange
      const userId = 'user-123';
      const tokens = [mockTokenRow, { ...mockTokenRow, id: 'token-456' }];

      mockQuery.mockResolvedValue({
        rows: tokens,
      });

      // Act
      const result = await repository.findByUserId(userId);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockTokenEntity);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [userId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND used_at IS NULL'),
        [userId]
      );
    });

    it('should find tokens by user ID including used tokens when requested', async () => {
      // Arrange
      const userId = 'user-123';
      const usedToken = { ...mockTokenRow, used_at: new Date() };
      const tokens = [mockTokenRow, usedToken];

      mockQuery.mockResolvedValue({
        rows: tokens,
      });

      // Act
      const result = await repository.findByUserId(userId, true);

      // Assert
      expect(result).toHaveLength(2);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        [userId]
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.not.stringContaining('AND used_at IS NULL'),
        [userId]
      );
    });

    it('should return empty array for user with no tokens', async () => {
      // Arrange
      const userId = 'user-with-no-tokens';

      mockQuery.mockResolvedValue({
        rows: [],
      });

      // Act
      const result = await repository.findByUserId(userId);

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      // Arrange
      const userId = 'user-123';

      mockQuery.mockRejectedValue(new Error('Database query failed'));

      // Act & Assert
      await expect(repository.findByUserId(userId)).rejects.toThrow('Database query failed');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should clean up expired tokens', async () => {
      // Arrange
      mockQuery.mockResolvedValue({ rowCount: 5 });

      // Act
      const result = await repository.cleanupExpiredTokens();

      // Assert
      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM password_reset_tokens')
      );
    });

    it('should return 0 when no tokens to clean up', async () => {
      // Arrange
      mockQuery.mockResolvedValue({ rowCount: 0 });

      // Act
      const result = await repository.cleanupExpiredTokens();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle null rowCount', async () => {
      // Arrange
      mockQuery.mockResolvedValue({ rowCount: null });

      // Act
      const result = await repository.cleanupExpiredTokens();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle database errors', async () => {
      // Arrange
      mockQuery.mockRejectedValue(new Error('Database delete failed'));

      // Act & Assert
      await expect(repository.cleanupExpiredTokens()).rejects.toThrow('Database delete failed');
    });
  });

  describe('getTokenStatistics', () => {
    it('should return token statistics', async () => {
      // Arrange
      const statsRow = {
        total: '10',
        active: '3',
        expired: '2',
        used: '5',
      };

      mockQuery.mockResolvedValue({
        rows: [statsRow],
      });

      // Act
      const result = await repository.getTokenStatistics();

      // Assert
      expect(result).toEqual({
        total: 10,
        active: 3,
        expired: 2,
        used: 5,
      });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total')
      );
    });

    it('should handle zero statistics', async () => {
      // Arrange
      const statsRow = {
        total: '0',
        active: '0',
        expired: '0',
        used: '0',
      };

      mockQuery.mockResolvedValue({
        rows: [statsRow],
      });

      // Act
      const result = await repository.getTokenStatistics();

      // Assert
      expect(result).toEqual({
        total: 0,
        active: 0,
        expired: 0,
        used: 0,
      });
    });

    it('should handle database errors', async () => {
      // Arrange
      mockQuery.mockRejectedValue(new Error('Database query failed'));

      // Act & Assert
      await expect(repository.getTokenStatistics()).rejects.toThrow('Database query failed');
    });
  });

  describe('mapRowToEntity', () => {
    it('should correctly map database row to entity', () => {
      // Act
      const result = repository.mapRowToEntity(mockTokenRow);

      // Assert
      expect(result).toEqual(mockTokenEntity);
    });

    it('should handle row with used_at value', () => {
      // Arrange
      const usedTokenRow = { ...mockTokenRow, used_at: new Date('2024-01-01T12:00:00Z') };

      // Act
      const result = repository.mapRowToEntity(usedTokenRow);

      // Assert
      expect(result.usedAt).toEqual(new Date('2024-01-01T12:00:00Z'));
    });
  });

  describe('mapEntityToRow', () => {
    it('should correctly map entity to database row', () => {
      // Arrange
      const entity = {
        userId: 'user-123',
        token: 'token-123',
        expiresAt: new Date('2024-01-01T13:00:00Z'),
        usedAt: new Date('2024-01-01T12:30:00Z'),
      };

      // Act
      const result = repository.mapEntityToRow(entity);

      // Assert
      expect(result).toEqual({
        user_id: 'user-123',
        token: 'token-123',
        expires_at: new Date('2024-01-01T13:00:00Z'),
        used_at: new Date('2024-01-01T12:30:00Z'),
      });
    });

    it('should handle entity without usedAt', () => {
      // Arrange
      const entity = {
        userId: 'user-123',
        token: 'token-123',
        expiresAt: new Date('2024-01-01T13:00:00Z'),
      };

      // Act
      const result = repository.mapEntityToRow(entity);

      // Assert
      expect(result).toEqual({
        user_id: 'user-123',
        token: 'token-123',
        expires_at: new Date('2024-01-01T13:00:00Z'),
        used_at: undefined,
      });
    });
  });
});