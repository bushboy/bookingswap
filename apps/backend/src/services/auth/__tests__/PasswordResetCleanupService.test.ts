import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PasswordResetCleanupService, CleanupConfig } from '../PasswordResetCleanupService';
import { PasswordResetTokenRepository } from '../../../database/repositories/PasswordResetTokenRepository';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PasswordResetCleanupService', () => {
  let mockRepository: Partial<PasswordResetTokenRepository>;
  let cleanupService: PasswordResetCleanupService;
  let config: CleanupConfig;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock repository
    mockRepository = {
      cleanupExpiredTokens: vi.fn(),
      getTokenStatistics: vi.fn(),
    };

    // Default config
    config = {
      intervalMinutes: 1, // 1 minute for testing
      retentionDays: 1,
      enableStatistics: true,
      statisticsIntervalMinutes: 2, // 2 minutes for testing
    };

    cleanupService = new PasswordResetCleanupService(
      mockRepository as PasswordResetTokenRepository,
      config
    );
  });

  afterEach(() => {
    cleanupService.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('should start the cleanup service and perform initial cleanup', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(5);
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue({
        total: 100,
        active: 10,
        expired: 5,
        used: 85,
      });

      // Act
      cleanupService.start();

      // Wait for initial cleanup
      await vi.runOnlyPendingTimersAsync();

      // Assert
      expect(mockRepository.cleanupExpiredTokens).toHaveBeenCalledWith(1);
      expect(cleanupService.isServiceRunning()).toBe(true);
    });

    it('should not start if already running', () => {
      // Arrange
      cleanupService.start();

      // Act & Assert
      expect(() => cleanupService.start()).not.toThrow();
      expect(cleanupService.isServiceRunning()).toBe(true);
    });

    it('should schedule cleanup at configured intervals', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(3);

      // Act
      cleanupService.start();

      // Fast-forward time to trigger multiple cleanups
      await vi.advanceTimersByTimeAsync(60000); // 1 minute
      await vi.advanceTimersByTimeAsync(60000); // 2 minutes total

      // Assert
      expect(mockRepository.cleanupExpiredTokens).toHaveBeenCalledTimes(3); // Initial + 2 scheduled
    });

    it('should schedule statistics collection when enabled', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(0);
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue({
        total: 50,
        active: 5,
        expired: 2,
        used: 43,
      });

      // Act
      cleanupService.start();

      // Fast-forward time to trigger statistics collection
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert
      expect(mockRepository.getTokenStatistics).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the cleanup service', () => {
      // Arrange
      cleanupService.start();
      expect(cleanupService.isServiceRunning()).toBe(true);

      // Act
      cleanupService.stop();

      // Assert
      expect(cleanupService.isServiceRunning()).toBe(false);
    });

    it('should handle stop when not running', () => {
      // Act & Assert
      expect(() => cleanupService.stop()).not.toThrow();
      expect(cleanupService.isServiceRunning()).toBe(false);
    });
  });

  describe('manualCleanup', () => {
    it('should perform manual cleanup and return expired count', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(7);
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue({
        total: 100,
        active: 10,
        expired: 15,
        used: 75,
      });

      // Act
      const result = await cleanupService.manualCleanup();

      // Assert
      expect(mockRepository.cleanupExpiredTokens).toHaveBeenCalledWith(1);
      expect(result).toBe(15);
    });

    it('should handle cleanup errors', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(cleanupService.manualCleanup()).rejects.toThrow('Database error');
    });
  });

  describe('getStatistics', () => {
    it('should return current statistics', async () => {
      // Arrange
      const mockStats = {
        total: 200,
        active: 20,
        expired: 10,
        used: 170,
      };
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue(mockStats);

      // Act
      const result = await cleanupService.getStatistics();

      // Assert
      expect(result).toEqual({
        totalTokens: 200,
        activeTokens: 20,
        expiredTokens: 10,
        usedTokens: 170,
        lastCleanupAt: expect.any(Date),
        tokensCleanedUp: 0,
      });
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      // Act
      const result = cleanupService.getConfig();

      // Assert
      expect(result).toEqual(config);
    });

    it('should update configuration', () => {
      // Arrange
      const newConfig = { intervalMinutes: 5 };

      // Act
      cleanupService.updateConfig(newConfig);

      // Assert
      expect(cleanupService.getConfig().intervalMinutes).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      // Act
      cleanupService.start();
      await vi.runOnlyPendingTimersAsync();

      // Assert - service should continue running despite errors
      expect(cleanupService.isServiceRunning()).toBe(true);
    });

    it('should handle statistics collection errors gracefully', async () => {
      // Arrange
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(0);
      mockRepository.getTokenStatistics = vi.fn().mockRejectedValue(new Error('Statistics query failed'));

      // Act
      cleanupService.start();
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert - service should continue running despite statistics errors
      expect(cleanupService.isServiceRunning()).toBe(true);
    });
  });

  describe('statistics warnings', () => {
    it('should log warning for high expired token ratio', async () => {
      // Arrange
      const { logger } = await import('../../../utils/logger');
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(0);
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue({
        total: 100,
        active: 5,
        expired: 50, // High expired count
        used: 20,   // Low used count
      });

      // Act
      cleanupService.start();
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'High number of expired tokens detected',
        expect.objectContaining({
          expiredTokens: 50,
          usedTokens: 20,
        })
      );
    });

    it('should log warning for high active token count', async () => {
      // Arrange
      const { logger } = await import('../../../utils/logger');
      mockRepository.cleanupExpiredTokens = vi.fn().mockResolvedValue(0);
      mockRepository.getTokenStatistics = vi.fn().mockResolvedValue({
        total: 150,
        active: 120, // High active count
        expired: 10,
        used: 20,
      });

      // Act
      cleanupService.start();
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'High number of active tokens detected',
        expect.objectContaining({
          activeTokens: 120,
        })
      );
    });
  });

  describe('performance monitoring', () => {
    it('should log warning for slow cleanup operations', async () => {
      // Arrange
      const { logger } = await import('../../../utils/logger');
      mockRepository.cleanupExpiredTokens = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(5), 6000)) // 6 seconds
      );

      // Act
      cleanupService.start();
      await vi.runOnlyPendingTimersAsync();

      // Assert
      expect(logger.warn).toHaveBeenCalledWith(
        'Password reset cleanup took longer than expected',
        expect.objectContaining({
          durationMs: expect.any(Number),
          tokensRemoved: 5,
        })
      );
    });
  });
});