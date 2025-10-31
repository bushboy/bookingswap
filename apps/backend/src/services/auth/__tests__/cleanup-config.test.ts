import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCleanupConfig, validateCleanupConfig, DEFAULT_CLEANUP_CONFIG } from '../cleanup-config';

describe('cleanup-config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DEFAULT_CLEANUP_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_CLEANUP_CONFIG).toEqual({
        intervalMinutes: 30,
        retentionDays: 1,
        enableStatistics: true,
        statisticsIntervalMinutes: 60,
      });
    });
  });

  describe('getCleanupConfig', () => {
    it('should return default values when no environment variables are set', () => {
      // Arrange
      delete process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES;
      delete process.env.PASSWORD_RESET_RETENTION_DAYS;
      delete process.env.PASSWORD_RESET_ENABLE_STATISTICS;
      delete process.env.PASSWORD_RESET_STATISTICS_INTERVAL_MINUTES;

      // Act
      const config = getCleanupConfig();

      // Assert
      expect(config).toEqual({
        intervalMinutes: 30,
        retentionDays: 1,
        enableStatistics: true,
        statisticsIntervalMinutes: 60,
      });
    });

    it('should use environment variables when provided', () => {
      // Arrange
      process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES = '15';
      process.env.PASSWORD_RESET_RETENTION_DAYS = '3';
      process.env.PASSWORD_RESET_ENABLE_STATISTICS = 'false';
      process.env.PASSWORD_RESET_STATISTICS_INTERVAL_MINUTES = '120';

      // Act
      const config = getCleanupConfig();

      // Assert
      expect(config).toEqual({
        intervalMinutes: 15,
        retentionDays: 3,
        enableStatistics: false,
        statisticsIntervalMinutes: 120,
      });
    });

    it('should handle invalid numeric environment variables gracefully', () => {
      // Arrange
      process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES = 'invalid';
      process.env.PASSWORD_RESET_RETENTION_DAYS = 'not-a-number';

      // Act
      const config = getCleanupConfig();

      // Assert
      expect(config.intervalMinutes).toBeNaN();
      expect(config.retentionDays).toBeNaN();
    });

    it('should treat any value other than "false" as true for statistics', () => {
      // Test various truthy values
      const truthyValues = ['true', 'yes', '1', 'enabled', ''];
      
      for (const value of truthyValues) {
        process.env.PASSWORD_RESET_ENABLE_STATISTICS = value;
        const config = getCleanupConfig();
        expect(config.enableStatistics).toBe(true);
      }

      // Test false value
      process.env.PASSWORD_RESET_ENABLE_STATISTICS = 'false';
      const config = getCleanupConfig();
      expect(config.enableStatistics).toBe(false);
    });
  });

  describe('validateCleanupConfig', () => {
    it('should pass validation for valid configuration', () => {
      // Arrange
      const validConfig = {
        intervalMinutes: 30,
        retentionDays: 1,
        enableStatistics: true,
        statisticsIntervalMinutes: 60,
      };

      // Act & Assert
      expect(() => validateCleanupConfig(validConfig)).not.toThrow();
    });

    describe('intervalMinutes validation', () => {
      it('should reject interval less than 1 minute', () => {
        // Arrange
        const config = {
          intervalMinutes: 0,
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Cleanup interval must be at least 1 minute');
      });

      it('should reject interval greater than 24 hours', () => {
        // Arrange
        const config = {
          intervalMinutes: 1441, // 24 hours + 1 minute
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Cleanup interval cannot exceed 24 hours');
      });

      it('should accept interval of exactly 24 hours', () => {
        // Arrange
        const config = {
          intervalMinutes: 1440, // Exactly 24 hours
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).not.toThrow();
      });
    });

    describe('retentionDays validation', () => {
      it('should reject negative retention days', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: -1,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Retention days cannot be negative');
      });

      it('should reject retention days greater than 30', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 31,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Retention days cannot exceed 30 days');
      });

      it('should accept retention days of exactly 30', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 30,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).not.toThrow();
      });

      it('should accept retention days of 0', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 0,
          enableStatistics: true,
          statisticsIntervalMinutes: 60,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).not.toThrow();
      });
    });

    describe('statisticsIntervalMinutes validation', () => {
      it('should reject statistics interval less than 1 minute', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 0,
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Statistics interval must be at least 1 minute');
      });

      it('should reject statistics interval greater than 24 hours', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 1441, // 24 hours + 1 minute
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).toThrow('Statistics interval cannot exceed 24 hours');
      });

      it('should accept statistics interval of exactly 24 hours', () => {
        // Arrange
        const config = {
          intervalMinutes: 30,
          retentionDays: 1,
          enableStatistics: true,
          statisticsIntervalMinutes: 1440, // Exactly 24 hours
        };

        // Act & Assert
        expect(() => validateCleanupConfig(config)).not.toThrow();
      });
    });

    it('should validate all constraints together', () => {
      // Arrange - multiple invalid values
      const config = {
        intervalMinutes: 0,        // Invalid
        retentionDays: -1,         // Invalid
        enableStatistics: true,
        statisticsIntervalMinutes: 1441, // Invalid
      };

      // Act & Assert - should throw on first validation failure
      expect(() => validateCleanupConfig(config)).toThrow('Cleanup interval must be at least 1 minute');
    });
  });
});