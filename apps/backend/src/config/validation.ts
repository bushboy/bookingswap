import { logger } from '../utils/logger';

/**
 * Email service configuration interface
 */
export interface EmailConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  fromEmail: string;
  fromName: string;
  etherealUser?: string;
  etherealPass?: string;
}

/**
 * Password reset configuration interface
 */
export interface PasswordResetConfig {
  tokenExpirationHours: number;
  maxRequestsPerHour: number;
  cleanupIntervalMinutes: number;
  retentionDays: number;
}

/**
 * Swap expiration service configuration interface
 */
export interface SwapExpirationConfig {
  enabled: boolean;
  checkIntervalMinutes: number;
  startupDelayMs: number;
  shutdownTimeoutMs: number;
  enableDetailedLogging: boolean;
  enableMetrics: boolean;
}

/**
 * Application configuration interface
 */
export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  frontendUrl: string;
  email: EmailConfig;
  passwordReset: PasswordResetConfig;
  swapExpiration: SwapExpirationConfig;
}

/**
 * Configuration validation errors
 */
export class ConfigValidationError extends Error {
  constructor(message: string, public field: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Get email configuration from environment variables
 */
export function getEmailConfig(): EmailConfig {
  return {
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    fromEmail: process.env.SMTP_FROM_EMAIL || 'noreply@bookingswap.com',
    fromName: process.env.SMTP_FROM_NAME || 'Booking Swap Platform',
    etherealUser: process.env.ETHEREAL_USER,
    etherealPass: process.env.ETHEREAL_PASS,
  };
}

/**
 * Get password reset configuration from environment variables
 */
export function getPasswordResetConfig(): PasswordResetConfig {
  return {
    tokenExpirationHours: process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS
      ? parseInt(process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS)
      : 1,
    maxRequestsPerHour: process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR
      ? parseInt(process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR)
      : 3,
    cleanupIntervalMinutes: process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES
      ? parseInt(process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES)
      : 60,
    retentionDays: process.env.PASSWORD_RESET_RETENTION_DAYS
      ? parseInt(process.env.PASSWORD_RESET_RETENTION_DAYS)
      : 7,
  };
}

/**
 * Get swap expiration service configuration from environment variables
 */
export function getSwapExpirationConfigFromValidation(): SwapExpirationConfig {
  return {
    enabled: process.env.SWAP_EXPIRATION_ENABLED !== 'false',
    checkIntervalMinutes: process.env.SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES
      ? parseInt(process.env.SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES)
      : 5,
    startupDelayMs: process.env.SWAP_EXPIRATION_STARTUP_DELAY_MS
      ? parseInt(process.env.SWAP_EXPIRATION_STARTUP_DELAY_MS)
      : 10000,
    shutdownTimeoutMs: process.env.SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS
      ? parseInt(process.env.SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS)
      : 30000,
    enableDetailedLogging: process.env.SWAP_EXPIRATION_ENABLE_DETAILED_LOGGING === 'true',
    enableMetrics: process.env.SWAP_EXPIRATION_ENABLE_METRICS !== 'false',
  };
}

/**
 * Get complete application configuration
 */
export function getAppConfig(): AppConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
    email: getEmailConfig(),
    passwordReset: getPasswordResetConfig(),
    swapExpiration: getSwapExpirationConfigFromValidation(),
  };
}
/*
*
 * Validate email configuration for production environment
 */
export function validateEmailConfig(config: EmailConfig): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // Production requires full SMTP configuration
    if (!config.smtpHost) {
      throw new ConfigValidationError(
        'SMTP_HOST is required in production environment',
        'SMTP_HOST'
      );
    }

    if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
      throw new ConfigValidationError(
        'SMTP_PORT must be a valid port number (1-65535) in production',
        'SMTP_PORT'
      );
    }

    if (!config.smtpUser) {
      throw new ConfigValidationError(
        'SMTP_USER is required in production environment',
        'SMTP_USER'
      );
    }

    if (!config.smtpPass) {
      throw new ConfigValidationError(
        'SMTP_PASS is required in production environment',
        'SMTP_PASS'
      );
    }
  } else {
    // Development can use Ethereal Email, but needs credentials
    if (!config.etherealUser && !config.smtpHost) {
      logger.warn('No SMTP or Ethereal credentials configured for development. Using default Ethereal credentials.');
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(config.fromEmail)) {
    throw new ConfigValidationError(
      `Invalid email format for SMTP_FROM_EMAIL: ${config.fromEmail}`,
      'SMTP_FROM_EMAIL'
    );
  }

  // Validate from name
  if (!config.fromName || config.fromName.trim().length === 0) {
    throw new ConfigValidationError(
      'SMTP_FROM_NAME cannot be empty',
      'SMTP_FROM_NAME'
    );
  }

  if (config.fromName.length > 100) {
    throw new ConfigValidationError(
      'SMTP_FROM_NAME cannot exceed 100 characters',
      'SMTP_FROM_NAME'
    );
  }
}

/**
 * Validate password reset configuration
 */
export function validatePasswordResetConfig(config: PasswordResetConfig): void {
  // Validate token expiration
  if (config.tokenExpirationHours < 0.1 || config.tokenExpirationHours > 24) {
    throw new ConfigValidationError(
      'Password reset token expiration must be between 0.1 and 24 hours',
      'PASSWORD_RESET_TOKEN_EXPIRATION_HOURS'
    );
  }

  // Validate max requests per hour
  if (config.maxRequestsPerHour < 1 || config.maxRequestsPerHour > 100) {
    throw new ConfigValidationError(
      'Password reset max requests per hour must be between 1 and 100',
      'PASSWORD_RESET_MAX_REQUESTS_PER_HOUR'
    );
  }

  // Validate cleanup interval
  if (config.cleanupIntervalMinutes < 1 || config.cleanupIntervalMinutes > 1440) {
    throw new ConfigValidationError(
      'Password reset cleanup interval must be between 1 and 1440 minutes (24 hours)',
      'PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES'
    );
  }

  // Validate retention days
  if (config.retentionDays < 0 || config.retentionDays > 30) {
    throw new ConfigValidationError(
      'Password reset retention days must be between 0 and 30',
      'PASSWORD_RESET_RETENTION_DAYS'
    );
  }
}

/**
 * Validate swap expiration service configuration
 */
export function validateSwapExpirationConfig(config: SwapExpirationConfig): void {
  // Validate check interval
  if (config.checkIntervalMinutes < 1) {
    throw new ConfigValidationError(
      'Swap expiration check interval must be at least 1 minute',
      'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES'
    );
  }

  if (config.checkIntervalMinutes > 1440) { // 24 hours
    throw new ConfigValidationError(
      'Swap expiration check interval cannot exceed 24 hours (1440 minutes)',
      'SWAP_EXPIRATION_CHECK_INTERVAL_MINUTES'
    );
  }

  // Validate startup delay
  if (config.startupDelayMs < 0) {
    throw new ConfigValidationError(
      'Swap expiration startup delay cannot be negative',
      'SWAP_EXPIRATION_STARTUP_DELAY_MS'
    );
  }

  if (config.startupDelayMs > 300000) { // 5 minutes
    throw new ConfigValidationError(
      'Swap expiration startup delay cannot exceed 5 minutes (300000ms)',
      'SWAP_EXPIRATION_STARTUP_DELAY_MS'
    );
  }

  // Validate shutdown timeout
  if (config.shutdownTimeoutMs < 1000) { // 1 second minimum
    throw new ConfigValidationError(
      'Swap expiration shutdown timeout must be at least 1 second (1000ms)',
      'SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS'
    );
  }

  if (config.shutdownTimeoutMs > 300000) { // 5 minutes maximum
    throw new ConfigValidationError(
      'Swap expiration shutdown timeout cannot exceed 5 minutes (300000ms)',
      'SWAP_EXPIRATION_SHUTDOWN_TIMEOUT_MS'
    );
  }
}

/**
 * Validate core application configuration
 */
export function validateAppConfig(config: AppConfig): void {
  // Validate Node environment
  const validEnvironments = ['development', 'test', 'production'];
  if (!validEnvironments.includes(config.nodeEnv)) {
    throw new ConfigValidationError(
      `NODE_ENV must be one of: ${validEnvironments.join(', ')}`,
      'NODE_ENV'
    );
  }

  // Validate port
  if (config.port < 1 || config.port > 65535) {
    throw new ConfigValidationError(
      'PORT must be a valid port number (1-65535)',
      'PORT'
    );
  }

  // Validate JWT secret
  if (!config.jwtSecret) {
    throw new ConfigValidationError(
      'JWT_SECRET is required',
      'JWT_SECRET'
    );
  }

  if (config.jwtSecret.length < 32) {
    throw new ConfigValidationError(
      'JWT_SECRET must be at least 32 characters long for security',
      'JWT_SECRET'
    );
  }

  // Validate JWT expiration format
  const jwtExpirationRegex = /^\d+[smhd]$/;
  if (!jwtExpirationRegex.test(config.jwtExpiresIn)) {
    throw new ConfigValidationError(
      'JWT_EXPIRES_IN must be in format like "24h", "30m", "7d"',
      'JWT_EXPIRES_IN'
    );
  }

  // Validate frontend URL
  try {
    new URL(config.frontendUrl);
  } catch {
    throw new ConfigValidationError(
      `Invalid URL format for FRONTEND_URL: ${config.frontendUrl}`,
      'FRONTEND_URL'
    );
  }

  // Validate nested configurations
  validateEmailConfig(config.email);
  validatePasswordResetConfig(config.passwordReset);
  validateSwapExpirationConfig(config.swapExpiration);
}

/**
 * Validate all configuration and return validated config
 */
export function validateAndGetConfig(): AppConfig {
  try {
    const config = getAppConfig();
    validateAppConfig(config);

    logger.info('Configuration validation successful', {
      nodeEnv: config.nodeEnv,
      port: config.port,
      emailProvider: config.nodeEnv === 'production' ? config.email.smtpHost : 'ethereal',
      passwordResetSettings: {
        tokenExpirationHours: config.passwordReset.tokenExpirationHours,
        maxRequestsPerHour: config.passwordReset.maxRequestsPerHour,
        cleanupIntervalMinutes: config.passwordReset.cleanupIntervalMinutes,
        retentionDays: config.passwordReset.retentionDays,
      },
      swapExpirationSettings: {
        enabled: config.swapExpiration.enabled,
        checkIntervalMinutes: config.swapExpiration.checkIntervalMinutes,
        startupDelayMs: config.swapExpiration.startupDelayMs,
        shutdownTimeoutMs: config.swapExpiration.shutdownTimeoutMs,
        enableDetailedLogging: config.swapExpiration.enableDetailedLogging,
        enableMetrics: config.swapExpiration.enableMetrics,
      },
    });

    return config;
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      logger.error('Configuration validation failed', {
        field: error.field,
        message: error.message,
      });
    } else {
      logger.error('Unexpected error during configuration validation', {
        error: (error as Error).message,
      });
    }
    throw error;
  }
}

/**
 * Test email service connection with current configuration
 */
export async function testEmailServiceConnection(config: EmailConfig): Promise<boolean> {
  try {
    const nodemailer = await import('nodemailer');

    let transporter;
    if (process.env.NODE_ENV === 'production') {
      transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort || 587,
        secure: config.smtpSecure || false,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: config.etherealUser || 'ethereal.user@ethereal.email',
          pass: config.etherealPass || 'ethereal.pass',
        },
      });
    }

    await transporter.verify();
    logger.info('Email service connection test successful');
    return true;
  } catch (error) {
    logger.error('Email service connection test failed', {
      error: (error as Error).message,
      provider: process.env.NODE_ENV === 'production' ? config.smtpHost : 'ethereal',
    });
    return false;
  }
}