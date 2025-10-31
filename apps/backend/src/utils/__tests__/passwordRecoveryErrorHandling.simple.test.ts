import { describe, it, expect } from 'vitest';
import { 
  PasswordRecoveryError,
  PasswordRecoveryErrorFactory,
  PASSWORD_RECOVERY_ERROR_CODES,
} from '../passwordRecoveryErrorHandling';

describe('PasswordRecoveryErrorHandling - Basic Tests', () => {
  describe('PASSWORD_RECOVERY_ERROR_CODES', () => {
    it('should have all required error codes', () => {
      expect(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT).toBe('INVALID_EMAIL_FORMAT');
      expect(PASSWORD_RECOVERY_ERROR_CODES.TOKEN_NOT_FOUND).toBe('TOKEN_NOT_FOUND');
      expect(PASSWORD_RECOVERY_ERROR_CODES.RATE_LIMIT_EXCEEDED).toBe('RATE_LIMIT_EXCEEDED');
      expect(PASSWORD_RECOVERY_ERROR_CODES.EMAIL_SERVICE_UNAVAILABLE).toBe('EMAIL_SERVICE_UNAVAILABLE');
      expect(PASSWORD_RECOVERY_ERROR_CODES.SERVICE_NOT_CONFIGURED).toBe('SERVICE_NOT_CONFIGURED');
    });
  });

  describe('PasswordRecoveryError', () => {
    it('should create error with basic properties', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
        'Invalid email format',
        'request_password_reset',
        'validation'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT);
      expect(error.message).toBe('Invalid email format');
      expect(error.operation).toBe('request_password_reset');
      expect(error.category).toBe('validation');
    });

    it('should create secure response', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
        'Invalid email format',
        'request_password_reset',
        'validation'
      );

      const response = error.toSecureResponse();

      expect(response.error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT);
      expect(response.error.message).toBe('Invalid email format');
      expect(response.error.category).toBe('validation');
      expect(response.error.timestamp).toBeDefined();
    });

    it('should sanitize sensitive error messages', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.EMAIL_NOT_FOUND,
        'Email not found in system',
        'request_password_reset',
        'authentication'
      );

      const response = error.toSecureResponse();

      expect(response.error.message).toBe('If an account with that email exists, a password reset link has been sent.');
    });
  });

  describe('PasswordRecoveryErrorFactory', () => {
    it('should create validation error for email', () => {
      const error = PasswordRecoveryErrorFactory.createValidationError(
        'email',
        'invalid-email',
        'request_password_reset'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT);
      expect(error.message).toBe('Please provide a valid email address.');
      expect(error.category).toBe('validation');
    });

    it('should create authentication error for token not found', () => {
      const error = PasswordRecoveryErrorFactory.createAuthenticationError(
        'token_not_found',
        'reset_password'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.TOKEN_NOT_FOUND);
      expect(error.message).toBe('Reset token not found.');
      expect(error.category).toBe('authentication');
    });

    it('should create rate limit error', () => {
      const error = PasswordRecoveryErrorFactory.createRateLimitError(
        'email',
        'request_password_reset'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.EMAIL_RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Too many password reset requests for this email address. Please try again later.');
      expect(error.category).toBe('rate_limiting');
      expect(error.retryable).toBe(true);
    });

    it('should create service error', () => {
      const originalError = new Error('Database connection failed');
      const error = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'reset_password',
        originalError
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.DATABASE_ERROR);
      expect(error.message).toBe('Database operation failed.');
      expect(error.category).toBe('server_error');
      expect(error.retryable).toBe(true);
    });
  });
});