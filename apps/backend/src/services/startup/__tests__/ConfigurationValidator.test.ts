import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationValidator } from '../ConfigurationValidator';
import { ConfigValidationError } from '../../../config/validation';

// Mock the validation module
vi.mock('../../../config/validation', () => ({
  validateAndGetConfig: vi.fn(),
  testEmailServiceConnection: vi.fn(),
  ConfigValidationError: class extends Error {
    constructor(message: string, public field: string) {
      super(message);
      this.name = 'ConfigValidationError';
    }
  },
}));

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConfigurationValidator', () => {
  let validator: ConfigurationValidator;
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    validator = ConfigurationValidator.getInstance();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ConfigurationValidator.getInstance();
      const instance2 = ConfigurationValidator.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('validateStartupConfiguration', () => {
    it('should return success result for valid configuration', async () => {
      const mockConfig = {
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

      const { validateAndGetConfig, testEmailServiceConnection } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockReturnValue(mockConfig);
      vi.mocked(testEmailServiceConnection).mockResolvedValue(true);

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(true);
      expect(result.config).toEqual(mockConfig);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return warning when email service connection fails', async () => {
      const mockConfig = {
        nodeEnv: 'development',
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

      const { validateAndGetConfig, testEmailServiceConnection } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockReturnValue(mockConfig);
      vi.mocked(testEmailServiceConnection).mockResolvedValue(false);

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Email service connection test failed - emails may not be delivered');
    });

    it('should return error result for configuration validation failure', async () => {
      const { validateAndGetConfig } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockImplementation(() => {
        throw new ConfigValidationError('JWT_SECRET is required', 'JWT_SECRET');
      });

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('JWT_SECRET: JWT_SECRET is required');
    });

    it('should handle unexpected errors during validation', async () => {
      const { validateAndGetConfig } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unexpected validation error: Unexpected error');
    });

    it('should add production-specific warnings', async () => {
      const mockConfig = {
        nodeEnv: 'production',
        port: 3001,
        jwtSecret: 'short-jwt-secret-32-chars-long',
        jwtExpiresIn: '24h',
        frontendUrl: 'http://localhost:3000',
        email: {
          smtpHost: 'smtp.example.com',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'user@example.com',
          smtpPass: 'password123',
          fromEmail: 'noreply@example.com',
          fromName: 'Test App',
        },
        passwordReset: {
          tokenExpirationHours: 3,
          maxRequestsPerHour: 10,
          cleanupIntervalMinutes: 60,
          retentionDays: 7,
        },
      };

      const { validateAndGetConfig, testEmailServiceConnection } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockReturnValue(mockConfig);
      vi.mocked(testEmailServiceConnection).mockResolvedValue(true);

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('JWT_SECRET should be at least 64 characters in production for enhanced security');
      expect(result.warnings).toContain('FRONTEND_URL should use HTTPS in production');
      expect(result.warnings).toContain('Consider reducing PASSWORD_RESET_MAX_REQUESTS_PER_HOUR to 5 or less in production');
      expect(result.warnings).toContain('Consider reducing PASSWORD_RESET_TOKEN_EXPIRATION_HOURS to 2 or less in production');
    });

    it('should add development-specific warnings', async () => {
      process.env.JWT_SECRET = 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=';
      
      const mockConfig = {
        nodeEnv: 'development',
        port: 3001,
        jwtSecret: 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=',
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

      const { validateAndGetConfig, testEmailServiceConnection } = await import('../../../config/validation');
      vi.mocked(validateAndGetConfig).mockReturnValue(mockConfig);
      vi.mocked(testEmailServiceConnection).mockResolvedValue(true);

      const result = await validator.validateStartupConfiguration();

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Using default JWT_SECRET in development - consider using a unique secret');
      expect(result.warnings).toContain('No email configuration found - using default Ethereal credentials for development');
    });
  });

  describe('getValidationSummary', () => {
    it('should return validation summary', () => {
      process.env.NODE_ENV = 'production';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS = '2';
      process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR = '5';

      const summary = validator.getValidationSummary();

      expect(summary).toMatchObject({
        environment: 'production',
        emailProvider: 'smtp.example.com',
        passwordResetSettings: {
          tokenExpiration: '2',
          maxRequests: '5',
          cleanupInterval: '60',
          retention: '7',
        },
      });
      expect(summary).toHaveProperty('lastValidation');
    });

    it('should return ethereal as email provider for non-production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.SMTP_HOST;

      const summary = validator.getValidationSummary();

      expect(summary).toMatchObject({
        environment: 'development',
        emailProvider: 'ethereal',
      });
    });
  });
});