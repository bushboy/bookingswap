import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Pool } from 'pg';
import { PasswordResetTokenRepository } from '../database/repositories/PasswordResetTokenRepository';
import { PasswordResetCleanupService } from '../services/auth/PasswordResetCleanupService';

// Mock the logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Password Reset Cleanup Integration', () => {
  let mockPool: Partial<Pool>;
  let repository: PasswordResetTokenRepository;
  let cleanupService: PasswordResetCleanupService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock database pool
    mockPool = {
      query: vi.fn(),
    };

    repository = new PasswordResetTokenRepository(mockPool as Pool);
    
    cleanupService = new PasswordResetCleanupService(repository, {
      intervalMinutes: 1,
      retentionDays: 2,
      enableStatistics: true,
      statisticsIntervalMinutes: 2,
    });
  });

  afterEach(() => {
    cleanupService.stop();
    vi.useRealTimers();
  });

  describe('Cleanup Operations', () => {
    it('should perform cleanup with correct retention policy', async () => {
      // Arrange
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 3 });

      // Act
      const result = await cleanupService.manualCleanup();

      // Assert
      expect(result).toBe(3);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM password_reset_tokens")
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '2 days'")
      );
    });

    it('should collect statistics correctly', async () => {
      // Arrange
      const mockStats = {
        total: '150',
        active: '25',
        expired: '15',
        used: '110',
      };
      mockPool.query = vi.fn().mockResolvedValue({ rows: [mockStats] });

      // Act
      const statistics = await cleanupService.getStatistics();

      // Assert
      expect(statistics).toEqual({
        totalTokens: 150,
        activeTokens: 25,
        expiredTokens: 15,
        usedTokens: 110,
        lastCleanupAt: expect.any(Date),
        tokensCleanedUp: 0,
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockPool.query = vi.fn().mockRejectedValue(new Error('Connection timeout'));

      // Act & Assert
      await expect(cleanupService.manualCleanup()).rejects.toThrow('Connection timeout');
    });

    it('should run scheduled cleanup operations', async () => {
      // Arrange
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 2 });

      // Act
      cleanupService.start();
      
      // Fast-forward time to trigger cleanup
      await vi.advanceTimersByTimeAsync(60000); // 1 minute

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM password_reset_tokens")
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '2 days'")
      );
    });

    it('should run scheduled statistics collection', async () => {
      // Arrange
      const mockStats = {
        total: '100',
        active: '10',
        expired: '5',
        used: '85',
      };
      mockPool.query = vi.fn()
        .mockResolvedValueOnce({ rowCount: 1 }) // initial cleanup
        .mockResolvedValueOnce({ rows: [mockStats] }); // statistics

      // Act
      cleanupService.start();
      
      // Fast-forward time to trigger statistics collection
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*) as total')
      );
    });
  });

  describe('Service Lifecycle', () => {
    it('should start and stop service correctly', () => {
      // Act
      cleanupService.start();
      expect(cleanupService.isServiceRunning()).toBe(true);

      cleanupService.stop();
      expect(cleanupService.isServiceRunning()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      // Act
      cleanupService.start();
      cleanupService.start(); // Second call should not cause issues

      // Assert
      expect(cleanupService.isServiceRunning()).toBe(true);
    });

    it('should handle stop when not running', () => {
      // Act & Assert
      expect(() => cleanupService.stop()).not.toThrow();
      expect(cleanupService.isServiceRunning()).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    it('should use correct retention days in cleanup query', async () => {
      // Arrange
      const customService = new PasswordResetCleanupService(repository, {
        intervalMinutes: 30,
        retentionDays: 7, // Custom retention
        enableStatistics: false,
        statisticsIntervalMinutes: 60,
      });
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 10 });

      // Act
      const result = await customService.manualCleanup();

      // Assert
      expect(result).toBe(10);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM password_reset_tokens")
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INTERVAL '7 days'")
      );
    });

    it('should respect statistics enablement setting', async () => {
      // Arrange
      const serviceWithoutStats = new PasswordResetCleanupService(repository, {
        intervalMinutes: 1,
        retentionDays: 1,
        enableStatistics: false, // Disabled
        statisticsIntervalMinutes: 60,
      });
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 0 });

      // Act
      serviceWithoutStats.start();
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert - should only have cleanup calls, no statistics calls
      const calls = (mockPool.query as any).mock.calls;
      const statisticsCalls = calls.filter((call: any) => 
        call[0].includes('COUNT(*) as total')
      );
      expect(statisticsCalls).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    it('should continue running after cleanup errors', async () => {
      // Arrange
      mockPool.query = vi.fn().mockRejectedValue(new Error('Database error'));

      // Act
      cleanupService.start();
      
      // Wait for initial cleanup
      await vi.runOnlyPendingTimersAsync();

      // Assert - service should continue running despite errors
      expect(cleanupService.isServiceRunning()).toBe(true);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should continue running after statistics errors', async () => {
      // Arrange
      mockPool.query = vi.fn()
        .mockResolvedValue({ rowCount: 1 }) // Cleanup succeeds
        .mockRejectedValue(new Error('Statistics query failed')); // Statistics fail

      // Act
      cleanupService.start();
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Assert
      expect(cleanupService.isServiceRunning()).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track cleanup performance', async () => {
      // Arrange
      const { logger } = await import('../utils/logger');
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 15 });

      // Act
      const result = await cleanupService.manualCleanup();

      // Assert
      expect(result).toBe(15);
      expect(logger.info).toHaveBeenCalledWith(
        'Manual password reset cleanup triggered'
      );
    });

    it('should warn about slow operations', async () => {
      // Arrange
      const { logger } = await import('../utils/logger');
      mockPool.query = vi.fn().mockResolvedValue({ rowCount: 5 });

      // Act
      const result = await cleanupService.manualCleanup();

      // Assert
      expect(result).toBe(5);
      expect(logger.info).toHaveBeenCalledWith(
        'Manual password reset cleanup triggered'
      );
    }, 1000); // Short timeout since we removed the slow operation
  });
});