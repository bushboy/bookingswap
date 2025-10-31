import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { AuthService } from '../../services/auth/AuthService';
import { 
  PasswordRecoveryError,
  PasswordRecoveryErrorFactory,
  PASSWORD_RECOVERY_ERROR_CODES 
} from '../../utils/passwordRecoveryErrorHandling';

// Mock dependencies
jest.mock('../../services/auth/AuthService');
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('../../utils/passwordRecoveryErrorHandling', () => ({
  ...jest.requireActual('../../utils/passwordRecoveryErrorHandling'),
  logPasswordRecoverySecurityEvent: jest.fn(),
}));

describe('AuthController - Password Recovery Error Handling', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockAuthService = new AuthService({} as any, {} as any) as jest.Mocked<AuthService>;
    authController = new AuthController(mockAuthService);
    
    mockReq = {
      body: {},
      headers: {},
      ip: '192.168.1.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should handle validation errors correctly', async () => {
      mockReq.body = {
        email: 'invalid-email',
        resetBaseUrl: 'https://example.com/reset',
      };

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

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
    });

    it('should handle missing email field', async () => {
      mockReq.body = {
        resetBaseUrl: 'https://example.com/reset',
      };

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            category: 'validation',
          }),
        })
      );
    });

    it('should handle missing resetBaseUrl field', async () => {
      mockReq.body = {
        email: 'test@example.com',
      };

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            category: 'validation',
          }),
        })
      );
    });

    it('should handle invalid resetBaseUrl format', async () => {
      mockReq.body = {
        email: 'test@example.com',
        resetBaseUrl: 'not-a-valid-url',
      };

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            category: 'validation',
          }),
        })
      );
    });

    it('should return success message for non-existent email (security)', async () => {
      mockReq.body = {
        email: 'nonexistent@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      mockAuthService.initiatePasswordReset.mockResolvedValue({
        success: false,
        message: 'Email not found',
      });

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should handle service errors gracefully', async () => {
      mockReq.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      const serviceError = PasswordRecoveryErrorFactory.createServiceError(
        'email_service',
        'request_password_reset',
        new Error('SMTP connection failed')
      );

      mockAuthService.initiatePasswordReset.mockRejectedValue(serviceError);

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      // Should return success message for security even on service errors
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should include debug info in non-production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockReq.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://example.com/reset',
      };

      mockAuthService.initiatePasswordReset.mockResolvedValue({
        success: true,
        message: 'Reset email sent',
        resetToken: 'test-token-123',
        expiresAt: new Date(),
      });

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          resetToken: 'test-token-123',
          expiresAt: expect.any(Date),
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('resetPassword', () => {
    it('should handle validation errors for password', async () => {
      mockReq.body = {
        token: 'valid-token',
        newPassword: '123', // Too short
      };

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: PASSWORD_RECOVERY_ERROR_CODES.PASSWORD_TOO_SHORT,
            message: 'Password must be at least 6 characters long.',
            category: 'validation',
          }),
        })
      );
    });

    it('should handle validation errors for token', async () => {
      mockReq.body = {
        newPassword: 'validpassword123',
      };

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            category: 'validation',
          }),
        })
      );
    });

    it('should handle invalid token errors', async () => {
      mockReq.body = {
        token: 'invalid-token',
        newPassword: 'validpassword123',
      };

      mockAuthService.resetPassword.mockResolvedValue({
        success: false,
        message: 'Invalid or expired reset token.',
      });

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid or expired reset token.',
            category: 'authentication',
          }),
        })
      );
    });

    it('should handle expired token errors', async () => {
      mockReq.body = {
        token: 'expired-token',
        newPassword: 'validpassword123',
      };

      mockAuthService.resetPassword.mockResolvedValue({
        success: false,
        message: 'Token has expired.',
      });

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid or expired reset token.',
            category: 'authentication',
          }),
        })
      );
    });

    it('should handle service errors', async () => {
      mockReq.body = {
        token: 'valid-token',
        newPassword: 'validpassword123',
      };

      const serviceError = new Error('Database connection failed');
      mockAuthService.resetPassword.mockRejectedValue(serviceError);

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            category: 'server_error',
          }),
        })
      );
    });

    it('should handle successful password reset', async () => {
      mockReq.body = {
        token: 'valid-token',
        newPassword: 'validpassword123',
      };

      mockAuthService.resetPassword.mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.',
      });

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password has been reset successfully.',
      });
    });
  });

  describe('validatePasswordResetToken', () => {
    it('should handle validation errors for token', async () => {
      mockReq.body = {};

      await authController.validatePasswordResetToken(mockReq as Request, mockRes as Response);

      // Should return invalid for security, not expose validation error
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false });
    });

    it('should handle invalid token gracefully', async () => {
      mockReq.body = {
        token: 'invalid-token',
      };

      mockAuthService.validateResetToken.mockResolvedValue({
        valid: false,
      });

      await authController.validatePasswordResetToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ valid: false });
    });

    it('should handle valid token', async () => {
      mockReq.body = {
        token: 'valid-token',
      };

      const expiresAt = new Date();
      mockAuthService.validateResetToken.mockResolvedValue({
        valid: true,
        userId: 'user_123',
        expiresAt,
      });

      await authController.validatePasswordResetToken(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        valid: true,
        expiresAt,
      });
    });

    it('should handle service errors gracefully', async () => {
      mockReq.body = {
        token: 'valid-token',
      };

      const serviceError = new Error('Database connection failed');
      mockAuthService.validateResetToken.mockRejectedValue(serviceError);

      await authController.validatePasswordResetToken(mockReq as Request, mockRes as Response);

      // Should return invalid for security, not expose service error
      expect(mockRes.json).toHaveBeenCalledWith({ valid: false });
    });
  });

  describe('Request ID handling', () => {
    it('should use existing request ID from x-request-id header', async () => {
      mockReq.headers = { 'x-request-id': 'existing-request-id' };
      mockReq.body = {
        email: 'invalid-email',
        resetBaseUrl: 'https://example.com/reset',
      };

      await authController.requestPasswordReset(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: undefined, // Request ID is not included in secure responses
          }),
        })
      );
    });

    it('should use existing request ID from request-id header', async () => {
      mockReq.headers = { 'request-id': 'another-request-id' };
      mockReq.body = {
        token: 'invalid-token',
        newPassword: '123',
      };

      await authController.resetPassword(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});