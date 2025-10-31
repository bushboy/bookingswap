import { Request, Response, NextFunction } from 'express';
import { 
  PasswordRecoveryError,
  PasswordRecoveryErrorFactory,
  PASSWORD_RECOVERY_ERROR_CODES,
  passwordRecoveryErrorHandler,
  createPasswordRecoveryErrorResponse,
  logPasswordRecoverySecurityEvent
} from '../passwordRecoveryErrorHandling';
import { SwapPlatformError } from '@booking-swap/shared';
import { logger } from '../logger';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('PasswordRecoveryError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
        'Invalid email format',
        'request_password_reset',
        'validation',
        false,
        {
          email: 'test@example.com',
          requestId: 'req_123',
        }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT);
      expect(error.message).toBe('Invalid email format');
      expect(error.operation).toBe('request_password_reset');
      expect(error.category).toBe('validation');
      expect(error.retryable).toBe(false);
      expect(error.email).toBe('test@example.com');
    });
  });

  describe('toSecureResponse', () => {
    it('should return secure response for email not found error', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.EMAIL_NOT_FOUND,
        'Email not found in system',
        'request_password_reset',
        'authentication'
      );

      const response = error.toSecureResponse();

      expect(response.error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.EMAIL_NOT_FOUND);
      expect(response.error.message).toBe('If an account with that email exists, a password reset link has been sent.');
      expect(response.error.category).toBe('authentication');
    });

    it('should return secure response for token errors', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.TOKEN_EXPIRED,
        'Token has expired',
        'reset_password',
        'authentication'
      );

      const response = error.toSecureResponse();

      expect(response.error.message).toBe('Invalid or expired reset token.');
    });

    it('should return original message for validation errors', () => {
      const error = new PasswordRecoveryError(
        PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_SHORT,
        'Password must be at least 6 characters long',
        'reset_password',
        'validation'
      );

      const response = error.toSecureResponse();

      expect(response.error.message).toBe('Password must be at least 6 characters long');
    });
  });
});

describe('PasswordRecoveryErrorFactory', () => {
  describe('createValidationError', () => {
    it('should create email validation error', () => {
      const error = PasswordRecoveryErrorFactory.createValidationError(
        'email',
        'invalid-email',
        'request_password_reset'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT);
      expect(error.message).toBe('Please provide a valid email address.');
      expect(error.category).toBe('validation');
      expect(error.retryable).toBe(false);
    });

    it('should create password too short error', () => {
      const error = PasswordRecoveryErrorFactory.createValidationError(
        'password',
        '123',
        'reset_password'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_SHORT);
      expect(error.message).toBe('Password must be at least 6 characters long.');
    });

    it('should create password too long error', () => {
      const longPassword = 'a'.repeat(101);
      const error = PasswordRecoveryErrorFactory.createValidationError(
        'password',
        longPassword,
        'reset_password'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_LONG);
      expect(error.message).toBe('Password must be no more than 100 characters long.');
    });

    it('should create token validation error', () => {
      const error = PasswordRecoveryErrorFactory.createValidationError(
        'token',
        'invalid-token',
        'validate_token'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.INVALID_TOKEN_FORMAT);
      expect(error.message).toBe('Invalid token format.');
    });
  });

  describe('createAuthenticationError', () => {
    it('should create token not found error', () => {
      const error = PasswordRecoveryErrorFactory.createAuthenticationError(
        'token_not_found',
        'reset_password',
        { tokenId: 'token_123' }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.TOKEN_NOT_FOUND);
      expect(error.message).toBe('Reset token not found.');
      expect(error.category).toBe('authentication');
      expect(error.tokenId).toBe('token_123');
    });

    it('should create user not found error', () => {
      const error = PasswordRecoveryErrorFactory.createAuthenticationError(
        'user_not_found',
        'reset_password',
        { userId: 'user_123' }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.USER_NOT_FOUND);
      expect(error.message).toBe('User account not found.');
      expect(error.userId).toBe('user_123');
    });

    it('should create wallet only user error', () => {
      const error = PasswordRecoveryErrorFactory.createAuthenticationError(
        'wallet_only',
        'request_password_reset',
        { email: 'test@example.com' }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.WALLET_ONLY_USER);
      expect(error.message).toBe('This account uses wallet authentication only.');
      expect(error.email).toBe('test@example.com');
    });
  });

  describe('createRateLimitError', () => {
    it('should create email rate limit error', () => {
      const error = PasswordRecoveryErrorFactory.createRateLimitError(
        'email',
        'request_password_reset',
        { email: 'test@example.com' }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.EMAIL_RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Too many password reset requests for this email address. Please try again later.');
      expect(error.category).toBe('rate_limiting');
      expect(error.retryable).toBe(true);
    });

    it('should create IP rate limit error', () => {
      const error = PasswordRecoveryErrorFactory.createRateLimitError(
        'ip',
        'request_password_reset',
        { ip: '192.168.1.1' }
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.IP_RATE_LIMIT_EXCEEDED);
      expect(error.message).toBe('Too many requests from your location. Please try again later.');
    });
  });

  describe('createServiceError', () => {
    it('should create email service error', () => {
      const originalError = new Error('SMTP connection failed');
      const error = PasswordRecoveryErrorFactory.createServiceError(
        'email_service',
        'request_password_reset',
        originalError
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.EMAIL_SERVICE_UNAVAILABLE);
      expect(error.message).toBe('Email service is temporarily unavailable.');
      expect(error.category).toBe('server_error');
      expect(error.retryable).toBe(true);
    });

    it('should create database error', () => {
      const originalError = new Error('Connection timeout');
      const error = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'reset_password',
        originalError
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.DATABASE_ERROR);
      expect(error.message).toBe('Database operation failed.');
      expect(error.retryable).toBe(true);
    });

    it('should create configuration error', () => {
      const error = PasswordRecoveryErrorFactory.createServiceError(
        'configuration',
        'request_password_reset'
      );

      expect(error.code).toBe(PASSWORD_RECOVERY_ERROR_CODES.SERVICE_NOT_CONFIGURED);
      expect(error.message).toBe('Password recovery service is not properly configured.');
      expect(error.retryable).toBe(false);
    });
  });
});

describe('passwordRecoveryErrorHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      path: '/api/auth/request-password-reset',
      method: 'POST',
      ip: '192.168.1.1',
      get: vi.fn().mockReturnValue('Mozilla/5.0'),
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should handle PasswordRecoveryError correctly', () => {
    const error = new PasswordRecoveryError(
      PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
      'Invalid email format',
      'request_password_reset',
      'validation'
    );

    passwordRecoveryErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
          message: 'Please provide a valid email address.',
          category: 'validation',
        }),
      })
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle SwapPlatformError correctly', () => {
    const error = new SwapPlatformError(
      'SOME_ERROR',
      'Some error message',
      'server_error'
    );

    passwordRecoveryErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(error.toJSON());
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle unexpected errors with generic response', () => {
    const error = new Error('Unexpected error');

    passwordRecoveryErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
          category: 'server_error',
          retryable: true,
        }),
      })
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should generate request ID when not provided', () => {
    const error = new Error('Test error');

    passwordRecoveryErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: expect.stringMatching(/^req_\d+_[a-z0-9]+$/),
        }),
      })
    );
  });

  it('should use existing request ID when provided', () => {
    mockReq.headers = { 'x-request-id': 'existing-request-id' };
    const error = new Error('Test error');

    passwordRecoveryErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          requestId: 'existing-request-id',
        }),
      })
    );
  });
});

describe('createPasswordRecoveryErrorResponse', () => {
  it('should create response without details in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new PasswordRecoveryError(
      PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
      'Invalid email format',
      'request_password_reset',
      'validation'
    );

    const response = createPasswordRecoveryErrorResponse(error, true);

    expect(response.error.details).toBeUndefined();

    process.env.NODE_ENV = originalEnv;
  });

  it('should include details in non-production when requested', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new PasswordRecoveryError(
      PASSWORD_RECOVERY_ERROR_CODES.INVALID_EMAIL_FORMAT,
      'Invalid email format',
      'request_password_reset',
      'validation'
    );

    const response = createPasswordRecoveryErrorResponse(error, true);

    expect(response.error.details).toEqual({
      operation: 'request_password_reset',
      originalMessage: 'Invalid email format',
      stack: expect.any(String),
    });

    process.env.NODE_ENV = originalEnv;
  });
});

describe('logPasswordRecoverySecurityEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log security event with masked email', () => {
    logPasswordRecoverySecurityEvent('request', {
      email: 'test@example.com',
      userId: 'user_123',
      ip: '192.168.1.1',
      success: true,
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Password recovery security event: request',
      expect.objectContaining({
        event: 'request',
        success: true,
        email: 'te***@example.com',
        userId: 'user_123',
        ip: '192.168.1.1',
        timestamp: expect.any(String),
      })
    );
  });

  it('should log security event without email when not provided', () => {
    logPasswordRecoverySecurityEvent('validation', {
      tokenId: 'token_123',
      success: false,
      error: 'Invalid token',
    });

    expect(logger.info).toHaveBeenCalledWith(
      'Password recovery security event: validation',
      expect.objectContaining({
        event: 'validation',
        success: false,
        email: undefined,
        tokenId: 'token_123',
        error: 'Invalid token',
      })
    );
  });
});