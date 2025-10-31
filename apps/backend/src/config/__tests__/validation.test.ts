import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateEmailConfig,
  validatePasswordResetConfig,
  validateAppConfig,
  getEmailConfig,
  getPasswordResetConfig,
  getAppConfig,
  ConfigValidationError,
} from '../validation';

describe('Configuration Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEmailConfig', () => {
    it('should validate production email configuration successfully', () => {
      process.env.NODE_ENV = 'production';
      
      const config = {
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'noreply@example.com',
        fromName: 'Test App',
      };

      expect(() => validateEmailConfig(config)).not.toThrow();
    });

    it('should throw error for missing SMTP_HOST in production', () => {
      process.env.NODE_ENV = 'production';
      
      const config = {
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'noreply@example.com',
        fromName: 'Test App',
      };

      expect(() => validateEmailConfig(config)).toThrow(
        new ConfigValidationError('SMTP_HOST is required in production environment', 'SMTP_HOST')
      );
    });

    it('should throw error for invalid SMTP_PORT', () => {
      process.env.NODE_ENV = 'production';
      
      const config = {
        smtpHost: 'smtp.example.com',
        smtpPort: 70000,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'noreply@example.com',
        fromName: 'Test App',
      };

      expect(() => validateEmailConfig(config)).toThrow(
        new ConfigValidationError('SMTP_PORT must be a valid port number (1-65535) in production', 'SMTP_PORT')
      );
    });

    it('should throw error for invalid email format', () => {
      const config = {
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'invalid-email',
        fromName: 'Test App',
      };

      expect(() => validateEmailConfig(config)).toThrow(
        new ConfigValidationError('Invalid email format for SMTP_FROM_EMAIL: invalid-email', 'SMTP_FROM_EMAIL')
      );
    });

    it('should throw error for empty from name', () => {
      const config = {
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'noreply@example.com',
        fromName: '',
      };

      expect(() => validateEmailConfig(config)).toThrow(
        new ConfigValidationError('SMTP_FROM_NAME cannot be empty', 'SMTP_FROM_NAME')
      );
    });

    it('should allow development configuration without SMTP settings', () => {
      process.env.NODE_ENV = 'development';
      
      const config = {
        fromEmail: 'noreply@example.com',
        fromName: 'Test App',
        etherealUser: 'test@ethereal.email',
        etherealPass: 'password',
      };

      expect(() => validateEmailConfig(config)).not.toThrow();
    });
  });

  describe('validatePasswordResetConfig', () => {
    it('should validate password reset configuration successfully', () => {
      const config = {
        tokenExpirationHours: 1,
        maxRequestsPerHour: 3,
        cleanupIntervalMinutes: 60,
        retentionDays: 7,
      };

      expect(() => validatePasswordResetConfig(config)).not.toThrow();
    });

    it('should throw error for invalid token expiration', () => {
      const config = {
        tokenExpirationHours: 25,
        maxRequestsPerHour: 3,
        cleanupIntervalMinutes: 60,
        retentionDays: 7,
      };

      expect(() => validatePasswordResetConfig(config)).toThrow(
        new ConfigValidationError(
          'Password reset token expiration must be between 0.1 and 24 hours',
          'PASSWORD_RESET_TOKEN_EXPIRATION_HOURS'
        )
      );
    });

    it('should throw error for invalid max requests', () => {
      const config = {
        tokenExpirationHours: 1,
        maxRequestsPerHour: 101,
        cleanupIntervalMinutes: 60,
        retentionDays: 7,
      };

      expect(() => validatePasswordResetConfig(config)).toThrow(
        new ConfigValidationError(
          'Password reset max requests per hour must be between 1 and 100',
          'PASSWORD_RESET_MAX_REQUESTS_PER_HOUR'
        )
      );
    });

    it('should throw error for invalid cleanup interval', () => {
      const config = {
        tokenExpirationHours: 1,
        maxRequestsPerHour: 3,
        cleanupIntervalMinutes: 1500,
        retentionDays: 7,
      };

      expect(() => validatePasswordResetConfig(config)).toThrow(
        new ConfigValidationError(
          'Password reset cleanup interval must be between 1 and 1440 minutes (24 hours)',
          'PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES'
        )
      );
    });

    it('should throw error for invalid retention days', () => {
      const config = {
        tokenExpirationHours: 1,
        maxRequestsPerHour: 3,
        cleanupIntervalMinutes: 60,
        retentionDays: 31,
      };

      expect(() => validatePasswordResetConfig(config)).toThrow(
        new ConfigValidationError(
          'Password reset retention days must be between 0 and 30',
          'PASSWORD_RESET_RETENTION_DAYS'
        )
      );
    });
  });

  describe('validateAppConfig', () => {
    it('should validate complete app configuration successfully', () => {
      process.env.NODE_ENV = 'development';
      
      const config = {
        nodeEnv: 'development',
        port: 3001,
        jwtSecret: 'a-very-long-jwt-secret-that-is-at-least-32-characters-long',
        jwtExpiresIn: '24h',
        frontendUrl: 'http://localhost:3000',
        email: {
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
          etherealUser: 'test@ethereal.email',
          etherealPass: 'password',
        },
        passwordReset: {
          tokenExpirationHours: 1,
          maxRequestsPerHour: 3,
          cleanupIntervalMinutes: 60,
          retentionDays: 7,
        },
      };

      expect(() => validateAppConfig(config)).not.toThrow();
    });

    it('should throw error for invalid NODE_ENV', () => {
      const config = {
        nodeEnv: 'invalid',
        port: 3001,
        jwtSecret: 'a-very-long-jwt-secret-that-is-at-least-32-characters-long',
        jwtExpiresIn: '24h',
        frontendUrl: 'http://localhost:3000',
        email: {
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
        },
        passwordReset: {
          tokenExpirationHours: 1,
          maxRequestsPerHour: 3,
          cleanupIntervalMinutes: 60,
          retentionDays: 7,
        },
      };

      expect(() => validateAppConfig(config)).toThrow(
        new ConfigValidationError('NODE_ENV must be one of: development, test, production', 'NODE_ENV')
      );
    });

    it('should throw error for short JWT secret', () => {
      const config = {
        nodeEnv: 'development',
        port: 3001,
        jwtSecret: 'short',
        jwtExpiresIn: '24h',
        frontendUrl: 'http://localhost:3000',
        email: {
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
        },
        passwordReset: {
          tokenExpirationHours: 1,
          maxRequestsPerHour: 3,
          cleanupIntervalMinutes: 60,
          retentionDays: 7,
        },
      };

      expect(() => validateAppConfig(config)).toThrow(
        new ConfigValidationError('JWT_SECRET must be at least 32 characters long for security', 'JWT_SECRET')
      );
    });

    it('should throw error for invalid JWT expiration format', () => {
      const config = {
        nodeEnv: 'development',
        port: 3001,
        jwtSecret: 'a-very-long-jwt-secret-that-is-at-least-32-characters-long',
        jwtExpiresIn: 'invalid',
        frontendUrl: 'http://localhost:3000',
        email: {
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
        },
        passwordReset: {
          tokenExpirationHours: 1,
          maxRequestsPerHour: 3,
          cleanupIntervalMinutes: 60,
          retentionDays: 7,
        },
      };

      expect(() => validateAppConfig(config)).toThrow(
        new ConfigValidationError('JWT_EXPIRES_IN must be in format like "24h", "30m", "7d"', 'JWT_EXPIRES_IN')
      );
    });
  });

  describe('getEmailConfig', () => {
    it('should return email configuration from environment variables', () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_SECURE = 'true';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password123';
      process.env.SMTP_FROM_EMAIL = 'noreply@example.com';
      process.env.SMTP_FROM_NAME = 'Test App';

      const config = getEmailConfig();

      expect(config).toEqual({
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpSecure: true,
        smtpUser: 'user@example.com',
        smtpPass: 'password123',
        fromEmail: 'noreply@example.com',
        fromName: 'Test App',
        etherealUser: undefined,
        etherealPass: undefined,
      });
    });

    it('should return default values when environment variables are not set', () => {
      const config = getEmailConfig();

      expect(config.fromEmail).toBe('noreply@bookingswap.com');
      expect(config.fromName).toBe('Booking Swap Platform');
    });
  });

  describe('getPasswordResetConfig', () => {
    it('should return password reset configuration from environment variables', () => {
      process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS = '2';
      process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = '5';
      process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES = '120';
      process.env.PASSWORD_RESET_RETENTION_DAYS = '14';

      const config = getPasswordResetConfig();

      expect(config).toEqual({
        tokenExpirationHours: 2,
        maxRequestsPerHour: 5,
        cleanupIntervalMinutes: 120,
        retentionDays: 14,
      });
    });

    it('should return default values when environment variables are not set', () => {
      const config = getPasswordResetConfig();

      expect(config).toEqual({
        tokenExpirationHours: 1,
        maxRequestsPerHour: 3,
        cleanupIntervalMinutes: 60,
        retentionDays: 7,
      });
    });
  });
});