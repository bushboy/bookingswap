import { Request, Response, NextFunction } from 'express';
import { 
  SwapPlatformError, 
  ErrorResponse,
  ErrorContext,
} from '@booking-swap/shared';
import { logger } from './logger';

/**
 * Specific error codes for password recovery operations
 */
export const PASSWORD_RECOVERY_ERROR_CODES = {
  // Validation errors
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  INVALID_TOKEN_FORMAT: 'INVALID_TOKEN_FORMAT',
  INVALID_PASSWORD_FORMAT: 'INVALID_PASSWORD_FORMAT',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  MISSING_RESET_BASE_URL: 'MISSING_RESET_BASE_URL',
  INVALID_RESET_BASE_URL: 'INVALID_RESET_BASE_URL',
  
  // Authentication errors
  TOKEN_NOT_FOUND: 'TOKEN_NOT_FOUND',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_ALREADY_USED: 'TOKEN_ALREADY_USED',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',
  WALLET_ONLY_USER: 'WALLET_ONLY_USER',
  
  // Rate limiting errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  EMAIL_RATE_LIMIT_EXCEEDED: 'EMAIL_RATE_LIMIT_EXCEEDED',
  IP_RATE_LIMIT_EXCEEDED: 'IP_RATE_LIMIT_EXCEEDED',
  
  // Service errors
  EMAIL_SERVICE_UNAVAILABLE: 'EMAIL_SERVICE_UNAVAILABLE',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TOKEN_GENERATION_FAILED: 'TOKEN_GENERATION_FAILED',
  PASSWORD_HASH_FAILED: 'PASSWORD_HASH_FAILED',
  SESSION_INVALIDATION_FAILED: 'SESSION_INVALIDATION_FAILED',
  
  // Configuration errors
  SERVICE_NOT_CONFIGURED: 'SERVICE_NOT_CONFIGURED',
  MISSING_CONFIGURATION: 'MISSING_CONFIGURATION',
} as const;

export type PasswordRecoveryErrorCode = typeof PASSWORD_RECOVERY_ERROR_CODES[keyof typeof PASSWORD_RECOVERY_ERROR_CODES];

/**
 * Password recovery specific error class
 */
export class PasswordRecoveryError extends SwapPlatformError {
  public readonly operation: string;
  public readonly email?: string;
  public readonly tokenId?: string;
  public readonly userId?: string;

  constructor(
    code: PasswordRecoveryErrorCode,
    message: string,
    operation: string,
    category: 'validation' | 'authentication' | 'rate_limiting' | 'server_error' = 'server_error',
    retryable: boolean = false,
    context?: ErrorContext & {
      email?: string;
      tokenId?: string;
      userId?: string;
    }
  ) {
    super(code, message, category, retryable, context);
    this.name = 'PasswordRecoveryError';
    this.operation = operation;
    this.email = context?.email;
    this.tokenId = context?.tokenId;
    this.userId = context?.userId;
  }

  /**
   * Create a security-safe error response that doesn't leak sensitive information
   */
  toSecureResponse(): ErrorResponse {
    // For security reasons, we sanitize certain error messages
    const secureMessage = this.getSecureMessage();
    
    return {
      error: {
        code: this.code,
        message: secureMessage,
        category: this.category,
        retryable: this.retryable,
        timestamp: new Date().toISOString(),
        requestId: this.context?.requestId,
      },
    };
  }

  private getSecureMessage(): string {
    // Return generic messages for security-sensitive errors
    switch (this.code) {
      case PASSWORD_RECOVERY_ERROR_CODES.EMAIL_NOT_FOUND:
      case PASSWORD_RECOVERY_ERROR_CODES.USER_NOT_FOUND:
      case PASSWORD_RECOVERY_ERROR_CODES.WALLET_ONLY_USER:
        return 'If an account with that email exists, a password reset link has been sent.';
      
      case PASSWORD_RECOVERY_ERROR_CODES.TOKEN_NOT_FOUND:
      case PASSWORD_RECOVERY_ERROR_CODES.TOKEN_EXPIRED:
      case PASSWORD_RECOVERY_ERROR_CODES.TOKEN_ALREADY_USED:
      case PASSWORD_RECOVERY_ERROR_CODES.INVALID_RESET_TOKEN:
        return 'Invalid or expired reset token.';
      
      case PASSWORD_RECOVERY_ERROR_CODES.EMAIL_SERVICE_UNAVAILABLE:
      case PASSWORD_RECOVERY_ERROR_CODES.EMAIL_SEND_FAILED:
        return 'If an account with that email exists, a password reset link has been sent.';
      
      default:
        return this.message;
    }
  }
}

/**
 * Error factory for creating standardized password recovery errors
 */
export class PasswordRecoveryErrorFactory {
  static createValidationError(
    field: string,
    value: any,
    operation: string,
    context?: ErrorContext
  ): PasswordRecoveryError {
    let code: PasswordRecoveryErrorCode;
    let message: string;

    switch (field) {
      case 'email':
        code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT;
        message = 'Please provide a valid email address.';
        break;
      case 'token':
        code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_TOKEN_FORMAT;
        message = 'Invalid token format.';
        break;
      case 'password':
        if (typeof value === 'string' && value.length < 6) {
          code = PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_SHORT;
          message = 'Password must be at least 6 characters long.';
        } else if (typeof value === 'string' && value.length > 100) {
          code = PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_LONG;
          message = 'Password must be no more than 100 characters long.';
        } else {
          code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_PASSWORD_FORMAT;
          message = 'Password does not meet security requirements.';
        }
        break;
      case 'resetBaseUrl':
        code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_RESET_BASE_URL;
        message = 'Invalid reset URL format.';
        break;
      default:
        code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_PASSWORD_FORMAT;
        message = `Invalid ${field} format.`;
    }

    return new PasswordRecoveryError(
      code,
      message,
      operation,
      'validation',
      false,
      context
    );
  }

  static createAuthenticationError(
    type: 'token_not_found' | 'token_expired' | 'token_used' | 'user_not_found' | 'email_not_found' | 'wallet_only',
    operation: string,
    context?: ErrorContext & { email?: string; tokenId?: string; userId?: string }
  ): PasswordRecoveryError {
    let code: PasswordRecoveryErrorCode;
    let message: string;

    switch (type) {
      case 'token_not_found':
        code = PASSWORD_RECOVERY_ERROR_CODES.TOKEN_NOT_FOUND;
        message = 'Reset token not found.';
        break;
      case 'token_expired':
        code = PASSWORD_RECOVERY_ERROR_CODES.TOKEN_EXPIRED;
        message = 'Reset token has expired.';
        break;
      case 'token_used':
        code = PASSWORD_RECOVERY_ERROR_CODES.TOKEN_ALREADY_USED;
        message = 'Reset token has already been used.';
        break;
      case 'user_not_found':
        code = PASSWORD_RECOVERY_ERROR_CODES.USER_NOT_FOUND;
        message = 'User account not found.';
        break;
      case 'email_not_found':
        code = PASSWORD_RECOVERY_ERROR_CODES.EMAIL_NOT_FOUND;
        message = 'Email address not found.';
        break;
      case 'wallet_only':
        code = PASSWORD_RECOVERY_ERROR_CODES.WALLET_ONLY_USER;
        message = 'This account uses wallet authentication only.';
        break;
      default:
        code = PASSWORD_RECOVERY_ERROR_CODES.INVALID_RESET_TOKEN;
        message = 'Authentication failed.';
    }

    return new PasswordRecoveryError(
      code,
      message,
      operation,
      'authentication',
      false,
      context
    );
  }

  static createRateLimitError(
    type: 'email' | 'ip' | 'general',
    operation: string,
    context?: ErrorContext & { email?: string; ip?: string }
  ): PasswordRecoveryError {
    let code: PasswordRecoveryErrorCode;
    let message: string;

    switch (type) {
      case 'email':
        code = PASSWORD_RECOVERY_ERROR_CODES.EMAIL_RATE_LIMIT_EXCEEDED;
        message = 'Too many password reset requests for this email address. Please try again later.';
        break;
      case 'ip':
        code = PASSWORD_RECOVERY_ERROR_CODES.IP_RATE_LIMIT_EXCEEDED;
        message = 'Too many requests from your location. Please try again later.';
        break;
      default:
        code = PASSWORD_RECOVERY_ERROR_CODES.RATE_LIMIT_EXCEEDED;
        message = 'Too many requests. Please try again later.';
    }

    return new PasswordRecoveryError(
      code,
      message,
      operation,
      'rate_limiting',
      true, // Rate limit errors are retryable after waiting
      context
    );
  }

  static createServiceError(
    type: 'email_service' | 'database' | 'token_generation' | 'password_hash' | 'session_invalidation' | 'configuration',
    operation: string,
    originalError?: Error,
    context?: ErrorContext
  ): PasswordRecoveryError {
    let code: PasswordRecoveryErrorCode;
    let message: string;
    let retryable = false;

    switch (type) {
      case 'email_service':
        code = PASSWORD_RECOVERY_ERROR_CODES.EMAIL_SERVICE_UNAVAILABLE;
        message = 'Email service is temporarily unavailable.';
        retryable = true;
        break;
      case 'database':
        code = PASSWORD_RECOVERY_ERROR_CODES.DATABASE_ERROR;
        message = 'Database operation failed.';
        retryable = true;
        break;
      case 'token_generation':
        code = PASSWORD_RECOVERY_ERROR_CODES.TOKEN_GENERATION_FAILED;
        message = 'Failed to generate reset token.';
        retryable = true;
        break;
      case 'password_hash':
        code = PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_HASH_FAILED;
        message = 'Failed to process password.';
        retryable = true;
        break;
      case 'session_invalidation':
        code = PASSWORD_RECOVERY_ERROR_CODES.SESSION_INVALIDATION_FAILED;
        message = 'Failed to invalidate existing sessions.';
        retryable = false; // Password was reset, but sessions might still be active
        break;
      case 'configuration':
        code = PASSWORD_RECOVERY_ERROR_CODES.SERVICE_NOT_CONFIGURED;
        message = 'Password recovery service is not properly configured.';
        retryable = false;
        break;
      default:
        code = PASSWORD_RECOVERY_ERROR_CODES.DATABASE_ERROR;
        message = 'Service error occurred.';
        retryable = true;
    }

    return new PasswordRecoveryError(
      code,
      message,
      operation,
      'server_error',
      retryable,
      {
        ...context,
        metadata: {
          ...context?.metadata,
          originalError: originalError?.message,
          originalStack: originalError?.stack,
        },
      }
    );
  }
}

/**
 * Utility function to log security events
 */
export const logPasswordRecoverySecurityEvent = (
  event: 'request' | 'validation' | 'reset' | 'rate_limit' | 'suspicious',
  details: {
    email?: string;
    userId?: string;
    tokenId?: string;
    ip?: string;
    userAgent?: string;
    success: boolean;
    error?: string;
    metadata?: Record<string, any>;
  }
): void => {
  logger.info(`Password recovery security event: ${event}`, {
    event,
    success: details.success,
    email: details.email ? details.email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
    userId: details.userId,
    tokenId: details.tokenId,
    ip: details.ip,
    userAgent: details.userAgent,
    error: details.error,
    metadata: details.metadata,
    timestamp: new Date().toISOString(),
  });
};