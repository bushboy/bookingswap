import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Request, Response } from 'express';
import { AuthController } from '../../controllers/AuthController';
import { AuthService } from '../../services/auth/AuthService';

// Mock dependencies
vi.mock('../../services/auth/AuthService');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AuthController - Password Reset Endpoints', () => {
  let authController: AuthController;
  let mockAuthService: AuthService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: Mock;
  let mockStatus: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock AuthService
    mockAuthService = {
      initiatePasswordReset: vi.fn(),
      resetPassword: vi.fn(),
      validateResetToken: vi.fn(),
    } as any;

    // Create AuthController instance
    authController = new AuthController(mockAuthService);

    // Create mock response
    mockJson = vi.fn().mockReturnThis();
    mockStatus = vi.fn().mockReturnThis();
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    // Create mock request
    mockRequest = {
      body: {},
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent'),
    };
  });

  describe('requestPasswordReset', () => {
    it('should successfully request password reset', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: true,
        message: 'Password reset link has been sent to your email address.',
        resetToken: 'test-token',
        expiresAt: new Date(),
      });

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.initiatePasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        'https://app.example.com/reset-password'
      );
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Password reset link has been sent to your email address.',
        })
      );
    });

    it('should include token and expiry in development environment', async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      const mockResult = {
        success: true,
        message: 'Password reset link has been sent to your email address.',
        resetToken: 'test-token',
        expiresAt: new Date('2024-01-01T13:00:00Z'),
      };

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue(mockResult);

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Password reset link has been sent to your email address.',
        resetToken: 'test-token',
        expiresAt: new Date('2024-01-01T13:00:00Z'),
      });

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });

    it('should return validation error for missing email', async () => {
      // Arrange
      mockRequest.body = {
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('email'),
          category: 'validation',
        },
      });
      expect(mockAuthService.initiatePasswordReset).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid email format', async () => {
      // Arrange
      mockRequest.body = {
        email: 'invalid-email',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('email'),
          category: 'validation',
        },
      });
      expect(mockAuthService.initiatePasswordReset).not.toHaveBeenCalled();
    });

    it('should return validation error for missing resetBaseUrl', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
      };

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('resetBaseUrl'),
          category: 'validation',
        },
      });
      expect(mockAuthService.initiatePasswordReset).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid resetBaseUrl', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'not-a-valid-url',
      };

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('resetBaseUrl'),
          category: 'validation',
        },
      });
      expect(mockAuthService.initiatePasswordReset).not.toHaveBeenCalled();
    });

    it('should return generic success message when service fails', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      (mockAuthService.initiatePasswordReset as Mock).mockRejectedValue(
        new Error('Service error')
      );

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should return error when service returns failure', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: false,
        message: 'Service error occurred',
      });

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: 'Service error occurred',
          category: 'authentication',
        },
      });
    });

    it('should log security events', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: true,
        message: 'Password reset link has been sent to your email address.',
      });

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Password reset requested',
        expect.objectContaining({
          email: 'te***@example.com', // Partially masked email
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
        })
      );
    });
  });

  describe('resetPassword', () => {
    it('should successfully reset password', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: 'newSecurePassword123',
      };

      (mockAuthService.resetPassword as Mock).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.',
      });

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'newSecurePassword123'
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Password has been reset successfully.',
      });
    });

    it('should return validation error for missing token', async () => {
      // Arrange
      mockRequest.body = {
        newPassword: 'newSecurePassword123',
      };

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('token'),
          category: 'validation',
        },
      });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return validation error for missing password', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
      };

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('newPassword'),
          category: 'validation',
        },
      });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return validation error for short password', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: '123',
      };

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('6'),
          category: 'validation',
        },
      });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return validation error for long password', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: 'a'.repeat(101), // 101 characters
      };

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('100'),
          category: 'validation',
        },
      });
      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
    });

    it('should return error when service returns failure', async () => {
      // Arrange
      mockRequest.body = {
        token: 'invalid-token',
        newPassword: 'newSecurePassword123',
      };

      (mockAuthService.resetPassword as Mock).mockResolvedValue({
        success: false,
        message: 'Invalid or expired reset token.',
      });

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'PASSWORD_RESET_FAILED',
          message: 'Invalid or expired reset token.',
          category: 'authentication',
        },
      });
    });

    it('should return error when service throws exception', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: 'newSecurePassword123',
      };

      (mockAuthService.resetPassword as Mock).mockRejectedValue(
        new Error('Service error')
      );

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'PASSWORD_RESET_ERROR',
          message: 'Failed to reset password',
          category: 'authentication',
        },
      });
    });

    it('should log security events for successful reset', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
        newPassword: 'newSecurePassword123',
      };

      (mockAuthService.resetPassword as Mock).mockResolvedValue({
        success: true,
        message: 'Password has been reset successfully.',
      });

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Password reset attempted',
        expect.objectContaining({
          tokenPrefix: 'valid-re...',
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Password reset successful',
        expect.objectContaining({
          tokenPrefix: 'valid-re...',
          ip: '127.0.0.1',
        })
      );
    });

    it('should log security events for failed reset', async () => {
      // Arrange
      mockRequest.body = {
        token: 'invalid-token',
        newPassword: 'newSecurePassword123',
      };

      (mockAuthService.resetPassword as Mock).mockResolvedValue({
        success: false,
        message: 'Invalid or expired reset token.',
      });

      // Act
      await authController.resetPassword(mockRequest as Request, mockResponse as Response);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'Password reset failed',
        expect.objectContaining({
          tokenPrefix: 'invalid-...',
          reason: 'Invalid or expired reset token.',
          ip: '127.0.0.1',
        })
      );
    });
  });

  describe('validatePasswordResetToken', () => {
    it('should successfully validate token', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
      };

      (mockAuthService.validateResetToken as Mock).mockResolvedValue({
        valid: true,
        userId: 'user-123',
        expiresAt: new Date('2024-01-01T13:00:00Z'),
      });

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.validateResetToken).toHaveBeenCalledWith('valid-reset-token');
      expect(mockJson).toHaveBeenCalledWith({
        valid: true,
        expiresAt: new Date('2024-01-01T13:00:00Z'),
      });
    });

    it('should return invalid for invalid token', async () => {
      // Arrange
      mockRequest.body = {
        token: 'invalid-token',
      };

      (mockAuthService.validateResetToken as Mock).mockResolvedValue({
        valid: false,
      });

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.validateResetToken).toHaveBeenCalledWith('invalid-token');
      expect(mockJson).toHaveBeenCalledWith({
        valid: false,
      });
    });

    it('should return validation error for missing token', async () => {
      // Arrange
      mockRequest.body = {};

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('token'),
          category: 'validation',
        },
      });
      expect(mockAuthService.validateResetToken).not.toHaveBeenCalled();
    });

    it('should return invalid when service throws exception', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
      };

      (mockAuthService.validateResetToken as Mock).mockRejectedValue(
        new Error('Service error')
      );

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockJson).toHaveBeenCalledWith({
        valid: false,
      });
    });

    it('should log security events for token validation', async () => {
      // Arrange
      mockRequest.body = {
        token: 'valid-reset-token',
      };

      (mockAuthService.validateResetToken as Mock).mockResolvedValue({
        valid: true,
        expiresAt: new Date(),
      });

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.info).toHaveBeenCalledWith(
        'Token validation attempted',
        expect.objectContaining({
          tokenPrefix: 'valid-re...',
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
        })
      );
    });

    it('should log warning for invalid token validation', async () => {
      // Arrange
      mockRequest.body = {
        token: 'invalid-token',
      };

      (mockAuthService.validateResetToken as Mock).mockResolvedValue({
        valid: false,
      });

      // Act
      await authController.validatePasswordResetToken(mockRequest as Request, mockResponse as Response);

      // Assert
      const { logger } = await import('../../utils/logger');
      expect(logger.warn).toHaveBeenCalledWith(
        'Invalid token validation attempt',
        expect.objectContaining({
          tokenPrefix: 'invalid-...',
          ip: '127.0.0.1',
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON in request body', async () => {
      // Arrange
      mockRequest.body = 'invalid-json';

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
          category: 'validation',
        },
      });
    });

    it('should handle missing request body', async () => {
      // Arrange
      mockRequest.body = undefined;

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: true,
        message: 'Password reset link has been sent to your email address.',
      });

      // Act
      await authController.requestPasswordReset(mockRequest as Request, mockResponse as Response);

      // Assert - Should return generic success message for security
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    });

    it('should handle missing IP address gracefully', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };
      mockRequest.ip = undefined;

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: true,
        message: 'Password reset link has been sent to your email address.',
      });

      // Act & Assert - Should not throw
      await expect(
        authController.requestPasswordReset(mockRequest as Request, mockResponse as Response)
      ).resolves.toBeUndefined();
    });

    it('should handle missing User-Agent gracefully', async () => {
      // Arrange
      mockRequest.body = {
        email: 'test@example.com',
        resetBaseUrl: 'https://app.example.com/reset-password',
      };
      (mockRequest.get as Mock).mockReturnValue(undefined);

      (mockAuthService.initiatePasswordReset as Mock).mockResolvedValue({
        success: true,
        message: 'Password reset link has been sent to your email address.',
      });

      // Act & Assert - Should not throw
      await expect(
        authController.requestPasswordReset(mockRequest as Request, mockResponse as Response)
      ).resolves.toBeUndefined();
    });
  });
});