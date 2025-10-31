import { Request, Response } from 'express';
import { AuthService, WalletSignatureData } from '../services/auth/AuthService';
import { logger } from '../utils/logger';
import {
  PasswordRecoveryErrorFactory,
  logPasswordRecoverySecurityEvent
} from '../utils/passwordRecoveryErrorHandling';
import Joi from '@hapi/joi';
import bcrypt from 'bcryptjs';

const walletSignatureSchema = Joi.object({
  message: Joi.string().required(),
  signature: Joi.string().required(),
  publicKey: Joi.string().required(),
  walletAddress: Joi.string().required(),
});

const challengeRequestSchema = Joi.object({
  walletAddress: Joi.string().required(),
});

const registerSchema = Joi.object({
  username: Joi.string().min(3).max(50).required(),
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().min(6).max(100).required(),
  displayName: Joi.string().min(1).max(100).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  password: Joi.string().required(),
});

const passwordResetRequestSchema = Joi.object({
  email: Joi.string().email({ tlds: false }).required(),
  resetBaseUrl: Joi.string().uri().required(),
});

const passwordResetSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).max(100).required(),
});

const validateTokenSchema = Joi.object({
  token: Joi.string().required(),
});

export class AuthController {
  constructor(private authService: AuthService) { }

  /**
   * Generate challenge message for wallet signing
   */
  generateChallenge = async (req: Request, res: Response) => {
    try {
      const { error, value } = challengeRequestSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            category: 'validation',
          },
        });
      }

      const { walletAddress } = value;
      const challengeMessage = this.authService.generateChallengeMessage(walletAddress);

      res.json({
        message: challengeMessage,
        walletAddress,
      });
    } catch (error) {
      logger.error('Challenge generation failed', { error: error.message });
      res.status(500).json({
        error: {
          code: 'CHALLENGE_GENERATION_FAILED',
          message: 'Failed to generate challenge message',
          category: 'authentication',
        },
      });
    }
  };

  /**
   * Authenticate user with wallet signature
   */
  login = async (req: Request, res: Response) => {
    try {
      const { error, value } = walletSignatureSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.details[0].message,
            category: 'validation',
          },
        });
      }

      const signatureData: WalletSignatureData = value;
      const loginResult = await this.authService.authenticateWithWallet(signatureData);

      res.status(200).json({
        user: {
          id: loginResult.user.id,
          walletAddress: loginResult.user.walletAddress,
          profile: loginResult.user.profile,
          verification: loginResult.user.verification,
          reputation: loginResult.user.reputation,
          lastActiveAt: loginResult.user.lastActiveAt,
          createdAt: loginResult.user.createdAt,
          updatedAt: loginResult.user.updatedAt,
        },
        token: loginResult.token,
        expiresAt: loginResult.expiresAt,
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message });

      if (error.message === 'Authentication failed') {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Invalid wallet signature or authentication failed',
            category: 'authentication',
          },
        });
      }

      res.status(500).json({
        error: {
          code: 'LOGIN_ERROR',
          message: 'Login process failed',
          category: 'authentication',
        },
      });
    }
  };

  /**
   * Refresh authentication token
   */
  refreshToken = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      const newToken = this.authService.generateToken(req.user);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      res.json({
        token: newToken,
        expiresAt,
      });
    } catch (error) {
      logger.error('Token refresh failed', { error: error.message, userId: req.user?.id });
      res.status(500).json({
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: 'Failed to refresh authentication token',
          category: 'authentication',
        },
      });
    }
  };

  /**
   * Validate current token and return user info
   */
  validateToken = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired token',
            category: 'authentication',
          },
        });
      }

      res.json({
        user: {
          id: req.user.id,
          walletAddress: req.user.walletAddress,
          profile: req.user.profile,
          verification: req.user.verification,
          reputation: req.user.reputation,
          lastActiveAt: req.user.lastActiveAt,
          createdAt: req.user.createdAt,
          updatedAt: req.user.updatedAt,
        },
        tokenPayload: req.tokenPayload,
      });
    } catch (error) {
      logger.error('Token validation failed', { error: error.message });
      res.status(500).json({
        error: {
          code: 'TOKEN_VALIDATION_FAILED',
          message: 'Token validation failed',
          category: 'authentication',
        },
      });
    }
  };

  /**
   * Debug endpoint to check user wallet status
   */
  debugWalletStatus = async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            category: 'authentication',
          },
        });
      }

      // Get fresh user data from database
      const userRepository = (this.authService as any).userRepository;
      const freshUser = await userRepository.findById(req.user.id);

      res.json({
        debug: {
          requestUserId: req.user.id,
          requestUserWalletAddress: req.user.walletAddress,
          tokenPayload: req.tokenPayload,
          freshUserFromDb: freshUser ? {
            id: freshUser.id,
            walletAddress: freshUser.walletAddress,
            hasWalletAddress: !!freshUser.walletAddress,
            walletAddressLength: freshUser.walletAddress?.length || 0,
          } : null,
          walletValidationCheck: {
            hasWalletInRequest: !!req.user.walletAddress,
            hasWalletInToken: !!(req.tokenPayload as any)?.walletAddress,
            hasWalletInDb: !!(freshUser?.walletAddress),
          },
        },
      });
    } catch (error) {
      logger.error('Debug wallet status failed', { error: error.message });
      res.status(500).json({
        error: {
          code: 'DEBUG_ERROR',
          message: 'Debug endpoint failed',
          category: 'debug',
        },
      });
    }
  };

  /**
   * Request password reset
   */
  requestPasswordReset = async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { error, value } = passwordResetRequestSchema.validate(req.body);
      if (error) {
        const validationError = PasswordRecoveryErrorFactory.createValidationError(
          error.details[0].path[0] as string,
          error.details[0].value,
          'request_password_reset',
          { requestId }
        );

        logPasswordRecoverySecurityEvent('validation', {
          email: req.body.email,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: validationError.message,
        });

        return res.status(400).json(validationError.toSecureResponse());
      }

      const { email, resetBaseUrl } = value;

      // Log security event for monitoring
      logPasswordRecoverySecurityEvent('request', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
      });

      const result = await this.authService.initiatePasswordReset(email, resetBaseUrl, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          // Include token and expiry only in development
          ...(process.env.NODE_ENV !== 'production' && {
            resetToken: result.resetToken,
            expiresAt: result.expiresAt,
          }),
        });
      } else {
        // Create appropriate error based on the failure reason
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'email_not_found',
          'request_password_reset',
          { requestId, email }
        );

        // Always return success message for security, but log the actual error
        logPasswordRecoverySecurityEvent('request', {
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: result.message,
        });

        // Return generic success message to prevent email enumeration
        res.json({
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      }
    } catch (error) {
      logger.error('Password reset request failed', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
      });

      logPasswordRecoverySecurityEvent('request', {
        email: req.body.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        error: error.message,
      });

      // Always return generic success message for security
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    }
  };

  /**
   * Reset password using token
   */
  resetPassword = async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { error, value } = passwordResetSchema.validate(req.body);
      if (error) {
        const validationError = PasswordRecoveryErrorFactory.createValidationError(
          error.details[0].path[0] as string,
          error.details[0].value,
          'reset_password',
          { requestId }
        );

        logPasswordRecoverySecurityEvent('validation', {
          tokenId: req.body.token?.substring(0, 8) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: validationError.message,
        });

        return res.status(400).json(validationError.toSecureResponse());
      }

      const { token, newPassword } = value;

      // Log security event for monitoring
      logPasswordRecoverySecurityEvent('reset', {
        tokenId: token.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
      });

      const result = await this.authService.resetPassword(token, newPassword, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      if (result.success) {
        logger.info('Password reset successful', {
          tokenPrefix: token.substring(0, 8) + '...',
          ip: req.ip,
          requestId,
        });

        res.json({
          success: true,
          message: result.message,
        });
      } else {
        // Determine the specific error type based on the failure message
        let errorType: 'token_not_found' | 'token_expired' | 'token_used' | 'user_not_found' = 'token_not_found';

        if (result.message.includes('expired')) {
          errorType = 'token_expired';
        } else if (result.message.includes('used')) {
          errorType = 'token_used';
        } else if (result.message.includes('User not found')) {
          errorType = 'user_not_found';
        }

        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          errorType,
          'reset_password',
          { requestId, tokenId: token.substring(0, 8) + '...' }
        );

        logPasswordRecoverySecurityEvent('reset', {
          tokenId: token.substring(0, 8) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: result.message,
        });

        return res.status(401).json(authError.toSecureResponse());
      }
    } catch (error) {
      const serviceError = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'reset_password',
        error,
        { requestId }
      );

      logger.error('Password reset error', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
        stack: error.stack,
      });

      logPasswordRecoverySecurityEvent('reset', {
        tokenId: req.body.token?.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        error: error.message,
      });

      res.status(500).json(serviceError.toSecureResponse());
    }
  };

  /**
   * Validate password reset token
   */
  validatePasswordResetToken = async (req: Request, res: Response) => {
    const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { error, value } = validateTokenSchema.validate(req.body);
      if (error) {
        const validationError = PasswordRecoveryErrorFactory.createValidationError(
          error.details[0].path[0] as string,
          error.details[0].value,
          'validate_token',
          { requestId }
        );

        logPasswordRecoverySecurityEvent('validation', {
          tokenId: req.body.token?.substring(0, 8) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: validationError.message,
        });

        // For token validation, always return invalid to prevent information leakage
        return res.json({ valid: false });
      }

      const { token } = value;

      // Log security event for monitoring
      logPasswordRecoverySecurityEvent('validation', {
        tokenId: token.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: true,
      });

      const result = await this.authService.validateResetToken(token, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      if (!result.valid) {
        logPasswordRecoverySecurityEvent('validation', {
          tokenId: token.substring(0, 8) + '...',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          success: false,
          error: 'Invalid or expired token',
        });
      }

      res.json({
        valid: result.valid,
        ...(result.valid && {
          expiresAt: result.expiresAt,
        }),
      });
    } catch (error) {
      logger.error('Token validation error', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId,
        stack: error.stack,
      });

      logPasswordRecoverySecurityEvent('validation', {
        tokenId: req.body.token?.substring(0, 8) + '...',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        success: false,
        error: error.message,
      });

      // Return invalid for any errors to prevent information leakage
      res.json({
        valid: false,
      });
    }
  };

  /**
   * Register new user with email and password
   */
  register = async (req: Request, res: Response) => {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { username, email, password, displayName } = value;

      // Check if user already exists
      const existingUser = await (this.authService as any).userRepository.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Check if username is taken
      const existingUsername = await (this.authService as any).userRepository.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username is already taken',
        });
      }

      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const userData = {
        username,
        email,
        passwordHash: hashedPassword,
        profile: {
          displayName: displayName || username, // Use displayName if provided, otherwise fallback to username
          preferences: {
            notifications: true,
          },
        },
        verificationLevel: 'basic' as const,
      };

      const user = await (this.authService as any).userRepository.create(userData);

      // Generate JWT token
      const token = this.authService.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          verificationLevel: user.verificationLevel,
          createdAt: user.createdAt,
        },
        token,
      });
    } catch (error) {
      logger.error('Registration failed', { error: error.message });
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  /**
   * Login user with email and password
   */
  emailLogin = async (req: Request, res: Response) => {
    try {
      logger.info('AuthController.emailLogin called', { body: req.body });

      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        logger.warn('Validation error in emailLogin', { error: error.details[0].message });
        return res.status(400).json({
          success: false,
          message: error.details[0].message,
        });
      }

      const { email, password } = value;
      logger.info('Attempting email login', { email });

      // Use AuthService for email authentication
      const loginResult = await this.authService.authenticateWithEmail(email, password);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: loginResult.user.id,
          username: loginResult.user.username,
          email: loginResult.user.email,
          verificationLevel: loginResult.user.verification?.level || 'basic',
        },
        token: loginResult.token,
      });
    } catch (error) {
      logger.error('Login failed', { error: error.message });

      if (error.message === 'Invalid email or password') {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}