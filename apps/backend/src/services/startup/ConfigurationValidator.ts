import { logger } from '../../utils/logger';
import { 
  validateAndGetConfig, 
  testEmailServiceConnection, 
  ConfigValidationError,
  AppConfig 
} from '../../config/validation';

/**
 * Startup validation results
 */
export interface ValidationResult {
  success: boolean;
  config?: AppConfig;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration validator service for application startup
 */
export class ConfigurationValidator {
  private static instance: ConfigurationValidator;

  private constructor() {}

  public static getInstance(): ConfigurationValidator {
    if (!ConfigurationValidator.instance) {
      ConfigurationValidator.instance = new ConfigurationValidator();
    }
    return ConfigurationValidator.instance;
  }

  /**
   * Validate all configuration on application startup
   */
  async validateStartupConfiguration(): Promise<ValidationResult> {
    const result: ValidationResult = {
      success: true,
      errors: [],
      warnings: [],
    };

    logger.info('Starting configuration validation...');

    try {
      // Validate and get configuration
      const config = validateAndGetConfig();
      result.config = config;

      // Test email service connection
      const emailConnectionValid = await this.validateEmailService(config);
      if (!emailConnectionValid) {
        result.warnings.push('Email service connection test failed - emails may not be delivered');
      }

      // Validate environment-specific requirements
      this.validateEnvironmentRequirements(config, result);

      // Log validation summary
      if (result.errors.length === 0) {
        logger.info('Configuration validation completed successfully', {
          warnings: result.warnings.length,
          environment: config.nodeEnv,
        });
      } else {
        result.success = false;
        logger.error('Configuration validation failed', {
          errors: result.errors.length,
          warnings: result.warnings.length,
        });
      }

    } catch (error) {
      result.success = false;
      
      if (error instanceof ConfigValidationError) {
        result.errors.push(`${error.field}: ${error.message}`);
      } else {
        result.errors.push(`Unexpected validation error: ${(error as Error).message}`);
      }

      logger.error('Configuration validation failed with exception', {
        error: (error as Error).message,
      });
    }

    return result;
  }

  /**
   * Validate email service connection
   */
  private async validateEmailService(config: AppConfig): Promise<boolean> {
    try {
      logger.info('Testing email service connection...');
      const isValid = await testEmailServiceConnection(config.email);
      
      if (isValid) {
        logger.info('Email service connection validated successfully');
      } else {
        logger.warn('Email service connection validation failed');
      }
      
      return isValid;
    } catch (error) {
      logger.error('Email service validation error', { error: (error as Error).message });
      return false;
    }
  }

  /**
   * Validate environment-specific requirements
   */
  private validateEnvironmentRequirements(config: AppConfig, result: ValidationResult): void {
    if (config.nodeEnv === 'production') {
      this.validateProductionRequirements(config, result);
    } else if (config.nodeEnv === 'development') {
      this.validateDevelopmentRequirements(config, result);
    }
  }

  /**
   * Validate production-specific requirements
   */
  private validateProductionRequirements(config: AppConfig, result: ValidationResult): void {
    // Check for secure JWT secret
    if (config.jwtSecret.length < 64) {
      result.warnings.push('JWT_SECRET should be at least 64 characters in production for enhanced security');
    }

    // Check for HTTPS frontend URL
    if (!config.frontendUrl.startsWith('https://')) {
      result.warnings.push('FRONTEND_URL should use HTTPS in production');
    }

    // Check for secure SMTP configuration
    if (!config.email.smtpSecure && config.email.smtpPort !== 587) {
      result.warnings.push('Consider using secure SMTP (port 465) or STARTTLS (port 587) in production');
    }

    // Validate password reset security settings
    if (config.passwordReset.maxRequestsPerHour > 5) {
      result.warnings.push('Consider reducing PASSWORD_RESET_MAX_REQUESTS_PER_HOUR to 5 or less in production');
    }

    if (config.passwordReset.tokenExpirationHours > 2) {
      result.warnings.push('Consider reducing PASSWORD_RESET_TOKEN_EXPIRATION_HOURS to 2 or less in production');
    }

    logger.info('Production configuration requirements validated');
  }

  /**
   * Validate development-specific requirements
   */
  private validateDevelopmentRequirements(config: AppConfig, result: ValidationResult): void {
    // Check if using default values
    if (config.jwtSecret === 'E4p+9jdS5T82WGwa00WI8fZoMTQXQuXbkclBLrxCe64=') {
      result.warnings.push('Using default JWT_SECRET in development - consider using a unique secret');
    }

    // Check for Ethereal email configuration
    if (!config.email.etherealUser && !config.email.smtpHost) {
      result.warnings.push('No email configuration found - using default Ethereal credentials for development');
    }

    logger.info('Development configuration requirements validated');
  }

  /**
   * Get configuration validation summary for monitoring
   */
  getValidationSummary(): object {
    return {
      lastValidation: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      emailProvider: process.env.NODE_ENV === 'production' 
        ? process.env.SMTP_HOST || 'not-configured'
        : 'ethereal',
      passwordResetSettings: {
        tokenExpiration: process.env.PASSWORD_RESET_TOKEN_EXPIRATION_HOURS || '1',
        maxRequests: process.env.PASSWORD_RESET_MAX_REQUESTS_PER_HOUR || '3',
        cleanupInterval: process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES || '60',
        retention: process.env.PASSWORD_RESET_RETENTION_DAYS || '7',
      },
    };
  }
}