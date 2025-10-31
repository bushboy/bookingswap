import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '@booking-swap/shared';
import { UserRepository } from '../../database/repositories/UserRepository';
import { PasswordResetTokenRepository } from '../../database/repositories/PasswordResetTokenRepository';
import { JwtTokenBlacklistRepository } from '../../database/repositories/JwtTokenBlacklistRepository';
import { EmailService } from '../email/EmailService';
import { WalletService } from '../hedera/WalletService';
import { logger } from '../../utils/logger';
import { PasswordRecoveryMonitor } from '../monitoring/PasswordRecoveryMonitor';
import {
  PasswordRecoveryError,
  PasswordRecoveryErrorFactory,
  logPasswordRecoverySecurityEvent
} from '../../utils/passwordRecoveryErrorHandling';

export interface AuthTokenPayload {
  userId: string;
  walletAddress?: string;
  email?: string;
  username?: string;
  jti?: string; // JWT ID for token identification
  iat: number;
  exp: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  payload?: AuthTokenPayload;
  error?: string;
  debugInfo: {
    jwtSecretLength: number;
    tokenStructure: 'valid' | 'malformed';
    isExpired: boolean;
    isBlacklisted: boolean;
    userExists: boolean;
  };
}

export interface WalletSignatureData {
  message: string;
  signature: string;
  publicKey: string;
  walletAddress: string;
}

export interface LoginResult {
  user: User;
  token: string;
  expiresAt: Date;
}

export interface PasswordResetResult {
  success: boolean;
  message: string;
  resetToken?: string;
  expiresAt?: Date;
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;
  private readonly saltRounds: number = 12;
  private readonly monitor: PasswordRecoveryMonitor;

  constructor(
    private userRepository: UserRepository,
    private walletService: WalletService,
    private passwordResetTokenRepository?: PasswordResetTokenRepository,
    private emailService?: EmailService,
    private jwtTokenBlacklistRepository?: JwtTokenBlacklistRepository,
    jwtSecret?: string,
    jwtExpiresIn: string = '24h'
  ) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.jwtExpiresIn = jwtExpiresIn;
    this.monitor = PasswordRecoveryMonitor.getInstance();

    if (!jwtSecret && !process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET not provided, using default secret. This is insecure for production!');
    }
  }

  /**
   * Authenticate user with wallet signature
   */
  async authenticateWithWallet(signatureData: WalletSignatureData): Promise<LoginResult> {
    try {
      // Verify the wallet signature
      const isValidSignature = await this.walletService.verifySignature(
        signatureData.message,
        signatureData.signature,
        signatureData.publicKey
      );

      if (!isValidSignature) {
        throw new Error('Invalid wallet signature');
      }

      // Find or create user
      let user = await this.userRepository.findByWalletAddress(signatureData.walletAddress);

      if (!user) {
        // Create new user with basic profile
        const newUserData = {
          walletAddress: signatureData.walletAddress,
          profile: {
            preferences: {
              notifications: true,
            },
          },
          verification: {
            level: 'basic' as const,
            documents: [],
          },
          reputation: {
            score: 100, // Starting reputation score
            completedSwaps: 0,
            cancelledSwaps: 0,
            reviews: [],
          },
          lastActiveAt: new Date(),
        };

        user = await this.userRepository.create(newUserData);
        logger.info('New user created', { userId: user.id, walletAddress: user.walletAddress });
      } else {
        // Update last active time
        await this.userRepository.updateLastActive(user.id);
      }

      // Generate JWT token
      const token = this.generateToken(user);
      const expiresAt = this.getTokenExpirationDate();

      logger.info('User authenticated successfully', {
        userId: user.id,
        walletAddress: user.walletAddress
      });

      return {
        user,
        token,
        expiresAt,
      };
    } catch (error) {
      logger.error('Authentication failed', { error: error.message, walletAddress: signatureData.walletAddress });
      throw new Error('Authentication failed');
    }
  }

  /**
   * Generate JWT token for user
   */
  generateToken(user: User | { id: string; username?: string; email?: string }): string {
    // Generate a unique JWT ID for token identification
    const jti = require('crypto').randomBytes(16).toString('hex');

    const payload: any = {
      userId: user.id,
      jti, // JWT ID for token identification and blacklisting
    };

    // Add walletAddress if it exists (for wallet-based auth)
    if ('walletAddress' in user && user.walletAddress) {
      payload.walletAddress = user.walletAddress;
    }

    // Add email/username for email-based auth
    if ('email' in user && user.email) {
      payload.email = user.email;
    }
    if ('username' in user && user.username) {
      payload.username = user.username;
    }

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;

      // Check if token is blacklisted (if blacklist repository is available)
      if (this.jwtTokenBlacklistRepository && payload.jti) {
        const isBlacklisted = await this.jwtTokenBlacklistRepository.isTokenBlacklisted(payload.jti);
        if (isBlacklisted) {
          throw new Error('Token has been revoked');
        }

        // Check if user sessions have been invalidated after this token was issued
        const tokenIssuedAt = new Date(payload.iat * 1000);
        const areSessionsInvalidated = await this.jwtTokenBlacklistRepository.areUserSessionsInvalidated(
          payload.userId,
          tokenIssuedAt
        );
        if (areSessionsInvalidated) {
          throw new Error('User sessions have been invalidated');
        }
      }

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else if (error instanceof Error && (
        error.message === 'Token has been revoked' ||
        error.message === 'User sessions have been invalidated'
      )) {
        throw error;
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Debug version of token verification with detailed information
   */
  async debugVerifyToken(token: string): Promise<TokenValidationResult> {
    const debugInfo = {
      jwtSecretLength: this.jwtSecret.length,
      tokenStructure: 'malformed' as 'valid' | 'malformed',
      isExpired: false,
      isBlacklisted: false,
      userExists: false,
    };

    try {
      // Check token structure
      const parts = token.split('.');
      if (parts.length === 3) {
        debugInfo.tokenStructure = 'valid';
      }

      // Try to decode without verification first
      let decodedPayload: any;
      try {
        decodedPayload = jwt.decode(token) as AuthTokenPayload;
        if (decodedPayload && decodedPayload.exp) {
          debugInfo.isExpired = Date.now() >= decodedPayload.exp * 1000;
        }
      } catch (decodeError) {
        return {
          isValid: false,
          error: 'Token could not be decoded',
          debugInfo,
        };
      }

      // Now try full verification
      const payload = jwt.verify(token, this.jwtSecret) as AuthTokenPayload;

      // Check if token is blacklisted
      if (this.jwtTokenBlacklistRepository && payload.jti) {
        debugInfo.isBlacklisted = await this.jwtTokenBlacklistRepository.isTokenBlacklisted(payload.jti);
        if (debugInfo.isBlacklisted) {
          return {
            isValid: false,
            payload,
            error: 'Token has been revoked',
            debugInfo,
          };
        }

        // Check if user sessions have been invalidated
        const tokenIssuedAt = new Date(payload.iat * 1000);
        const areSessionsInvalidated = await this.jwtTokenBlacklistRepository.areUserSessionsInvalidated(
          payload.userId,
          tokenIssuedAt
        );
        if (areSessionsInvalidated) {
          return {
            isValid: false,
            payload,
            error: 'User sessions have been invalidated',
            debugInfo,
          };
        }
      }

      // Check if user exists
      try {
        const user = await this.userRepository.findById(payload.userId);
        debugInfo.userExists = !!user;
      } catch (error) {
        debugInfo.userExists = false;
      }

      return {
        isValid: true,
        payload,
        debugInfo,
      };
    } catch (error) {
      let errorMessage = 'Token verification failed';

      if (error instanceof jwt.TokenExpiredError) {
        errorMessage = 'Token expired';
        debugInfo.isExpired = true;
      } else if (error instanceof jwt.JsonWebTokenError) {
        errorMessage = 'Invalid token signature or format';
      }

      return {
        isValid: false,
        error: errorMessage,
        debugInfo,
      };
    }
  }

  /**
   * Validate JWT secret configuration
   */
  validateJwtSecret(): boolean {
    return !!(this.jwtSecret &&
      this.jwtSecret.length > 0 &&
      this.jwtSecret !== 'default-secret-change-in-production');
  }

  /**
   * Get JWT configuration debug information
   */
  getJwtDebugInfo(): {
    secretConfigured: boolean;
    secretLength: number;
    expiresIn: string;
    isDefaultSecret: boolean;
  } {
    return {
      secretConfigured: !!this.jwtSecret,
      secretLength: this.jwtSecret ? this.jwtSecret.length : 0,
      expiresIn: this.jwtExpiresIn,
      isDefaultSecret: this.jwtSecret === 'default-secret-change-in-production',
    };
  }

  /**
   * Generate a challenge message for wallet signing
   */
  generateChallengeMessage(walletAddress: string): string {
    const timestamp = Date.now();
    const nonce = Math.random().toString(36).substring(2, 15);

    return `Sign this message to authenticate with Booking Swap Platform:
Wallet: ${walletAddress}
Timestamp: ${timestamp}
Nonce: ${nonce}

This request will not trigger any blockchain transaction or cost any fees.`;
  }

  /**
   * Hash password (for future use if needed)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Verify password (for future use if needed)
   */
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Get token expiration date
   */
  private getTokenExpirationDate(): Date {
    const expiresIn = this.jwtExpiresIn;
    let milliseconds = 0;

    if (expiresIn.endsWith('h')) {
      milliseconds = parseInt(expiresIn.slice(0, -1)) * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('d')) {
      milliseconds = parseInt(expiresIn.slice(0, -1)) * 24 * 60 * 60 * 1000;
    } else if (expiresIn.endsWith('m')) {
      milliseconds = parseInt(expiresIn.slice(0, -1)) * 60 * 1000;
    } else {
      // Default to seconds
      milliseconds = parseInt(expiresIn) * 1000;
    }

    return new Date(Date.now() + milliseconds);
  }

  /**
   * Refresh token if it's close to expiration
   */
  async refreshTokenIfNeeded(token: string): Promise<string | null> {
    try {
      const payload = await this.verifyToken(token);
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;

      // Refresh if token expires in less than 1 hour
      if (timeUntilExpiry < 3600) {
        const user = await this.userRepository.findById(payload.userId);
        if (user) {
          return this.generateToken(user);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Initiate password reset process
   */
  async initiatePasswordReset(email: string, resetBaseUrl: string, requestContext?: { ip?: string; userAgent?: string }): Promise<PasswordResetResult> {
    const startTime = Date.now();

    try {
      if (!this.passwordResetTokenRepository || !this.emailService) {
        const error = PasswordRecoveryErrorFactory.createServiceError(
          'configuration',
          'initiate_password_reset',
          new Error('Password reset service not configured'),
          {
            metadata: {
              hasTokenRepository: !!this.passwordResetTokenRepository,
              hasEmailService: !!this.emailService
            }
          }
        );

        this.monitor.logPasswordResetRequest({
          email,
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        throw error;
      }

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'email_not_found',
          'initiate_password_reset',
          { email }
        );

        logger.info('Password reset requested for non-existent email', { email });

        // Log the request but mark as successful to prevent enumeration
        this.monitor.logPasswordResetRequest({
          email,
          success: true, // Mark as successful to prevent enumeration
          duration: Date.now() - startTime,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        // Return success message for security (don't throw the error)
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }

      // Check if user has a password (wallet-only users can't reset password)
      if (!user.email) {
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'wallet_only',
          'initiate_password_reset',
          { userId: user.id, email }
        );

        logger.warn('Password reset requested for wallet-only user', { userId: user.id });

        // Log the request but mark as successful to prevent enumeration
        this.monitor.logPasswordResetRequest({
          email,
          userId: user.id,
          success: true, // Mark as successful to prevent enumeration
          duration: Date.now() - startTime,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        // Return success message for security (don't throw the error)
        return {
          success: true,
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }

      // Invalidate any existing tokens for this user
      await this.passwordResetTokenRepository.invalidateUserTokens(user.id);

      // Create new reset token (expires in 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      const resetToken = await this.passwordResetTokenRepository.createToken({
        userId: user.id,
        expiresAt,
      });

      // Log token generation
      this.monitor.logTokenGeneration({
        userId: user.id,
        tokenId: resetToken.id,
        email: user.email,
        expiresAt,
        success: true,
      });

      // Generate reset URL
      const resetUrl = `${resetBaseUrl}?token=${resetToken.token}`;

      // Send reset email
      await this.emailService.sendPasswordResetEmail({
        userEmail: user.email,
        userName: user.username || user.profile?.displayName || 'User',
        resetToken: resetToken.token,
        resetUrl,
        expiresAt,
      });

      // Log successful request
      this.monitor.logPasswordResetRequest({
        email,
        userId: user.id,
        success: true,
        duration: Date.now() - startTime,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      logger.info('Password reset email sent', {
        userId: user.id,
        email: user.email,
        tokenId: resetToken.id,
      });

      return {
        success: true,
        message: 'Password reset link has been sent to your email address.',
        resetToken: resetToken.token, // Only for testing/development
        expiresAt,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // If it's already a PasswordRecoveryError, re-throw it
      if (error instanceof PasswordRecoveryError) {
        this.monitor.logPasswordResetRequest({
          email,
          success: false,
          error: error.message,
          duration,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });
        throw error;
      }

      // Create a service error for unexpected errors
      const serviceError = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'initiate_password_reset',
        error,
        { email }
      );

      // Log failed request
      this.monitor.logPasswordResetRequest({
        email,
        success: false,
        error: serviceError.message,
        duration,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      logger.error('Password reset initiation failed', {
        error: error.message,
        email,
        duration,
        stack: error.stack,
      });

      throw serviceError;
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string, requestContext?: { ip?: string; userAgent?: string }): Promise<PasswordResetResult> {
    const startTime = Date.now();

    try {
      if (!this.passwordResetTokenRepository) {
        const error = PasswordRecoveryErrorFactory.createServiceError(
          'configuration',
          'reset_password',
          new Error('Password reset service not configured'),
          { metadata: { hasTokenRepository: !!this.passwordResetTokenRepository } }
        );

        this.monitor.logPasswordReset({
          userId: 'unknown',
          tokenId: 'unknown',
          success: false,
          error: error.message,
          duration: Date.now() - startTime,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        throw error;
      }

      // Validate password strength
      if (newPassword.length < 6) {
        const validationError = PasswordRecoveryErrorFactory.createValidationError(
          'password',
          newPassword,
          'reset_password'
        );

        return {
          success: false,
          message: validationError.message,
        };
      }

      if (newPassword.length > 100) {
        const validationError = PasswordRecoveryErrorFactory.createValidationError(
          'password',
          newPassword,
          'reset_password'
        );

        return {
          success: false,
          message: validationError.message,
        };
      }

      // Find and validate token
      const resetToken = await this.passwordResetTokenRepository.findValidToken(token);
      if (!resetToken) {
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'token_not_found',
          'reset_password',
          { tokenId: token.substring(0, 8) + '...' }
        );

        // Log token validation failure
        this.monitor.logTokenValidation({
          tokenId: token.substring(0, 8) + '...',
          success: false,
          error: authError.message,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        return {
          success: false,
          message: 'Invalid or expired reset token.',
        };
      }

      // Get user
      const user = await this.userRepository.findById(resetToken.userId);
      if (!user) {
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'user_not_found',
          'reset_password',
          { userId: resetToken.userId, tokenId: resetToken.id }
        );

        this.monitor.logPasswordReset({
          userId: resetToken.userId,
          tokenId: resetToken.id,
          success: false,
          error: authError.message,
          duration: Date.now() - startTime,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        return {
          success: false,
          message: 'Invalid or expired reset token.',
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(newPassword);

      // Update user password
      await this.userRepository.update(user.id, {
        passwordHash: hashedPassword,
      });

      // Mark token as used
      await this.passwordResetTokenRepository.markTokenAsUsed(resetToken.id);

      // Invalidate all existing sessions for this user
      const sessionsInvalidated = await this.invalidateAllUserSessions(user.id, 'Password reset');

      // Log successful password reset
      this.monitor.logPasswordReset({
        userId: user.id,
        tokenId: resetToken.id,
        email: user.email,
        success: true,
        duration: Date.now() - startTime,
        sessionsInvalidated: typeof sessionsInvalidated === 'number' ? sessionsInvalidated : undefined,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      logger.info('Password reset completed - all user sessions invalidated', {
        userId: user.id,
        tokenId: resetToken.id,
      });

      // Send confirmation email if email service is available
      if (this.emailService && user.email) {
        try {
          await this.emailService.sendPasswordResetConfirmationEmail({
            userEmail: user.email,
            userName: user.username || user.profile?.displayName || 'User',
            resetTime: new Date(),
          });
        } catch (emailError) {
          // Don't fail the password reset if email fails
          logger.warn('Failed to send password reset confirmation email', {
            userId: user.id,
            error: emailError.message,
          });
        }
      }

      return {
        success: true,
        message: 'Password has been reset successfully.',
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // If it's already a PasswordRecoveryError, re-throw it
      if (error instanceof PasswordRecoveryError) {
        this.monitor.logPasswordReset({
          userId: error.userId || 'unknown',
          tokenId: error.tokenId || token.substring(0, 8) + '...',
          success: false,
          error: error.message,
          duration,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });
        throw error;
      }

      // Create a service error for unexpected errors
      const serviceError = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'reset_password',
        error,
        { tokenId: token.substring(0, 8) + '...' }
      );

      // Log failed password reset
      this.monitor.logPasswordReset({
        userId: 'unknown',
        tokenId: token.substring(0, 8) + '...',
        success: false,
        error: serviceError.message,
        duration,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      logger.error('Password reset failed', {
        error: error.message,
        token: token.substring(0, 8) + '...',
        duration,
        stack: error.stack,
      });

      throw serviceError;
    }
  }

  /**
   * Validate password reset token
   */
  async validateResetToken(token: string, requestContext?: { ip?: string; userAgent?: string }): Promise<{ valid: boolean; userId?: string; expiresAt?: Date }> {
    try {
      if (!this.passwordResetTokenRepository) {
        const error = PasswordRecoveryErrorFactory.createServiceError(
          'configuration',
          'validate_reset_token',
          new Error('Password reset service not configured'),
          { tokenId: token.substring(0, 8) + '...' }
        );

        this.monitor.logTokenValidation({
          tokenId: token.substring(0, 8) + '...',
          success: false,
          error: error.message,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        return { valid: false };
      }

      const resetToken = await this.passwordResetTokenRepository.findValidToken(token);
      if (!resetToken) {
        const authError = PasswordRecoveryErrorFactory.createAuthenticationError(
          'token_not_found',
          'validate_reset_token',
          { tokenId: token.substring(0, 8) + '...' }
        );

        this.monitor.logTokenValidation({
          tokenId: token.substring(0, 8) + '...',
          success: false,
          error: authError.message,
          isExpired: true,
          ip: requestContext?.ip,
          userAgent: requestContext?.userAgent,
        });

        return { valid: false };
      }

      // Log successful token validation
      this.monitor.logTokenValidation({
        tokenId: resetToken.id,
        userId: resetToken.userId,
        success: true,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      return {
        valid: true,
        userId: resetToken.userId,
        expiresAt: resetToken.expiresAt,
      };
    } catch (error) {
      const serviceError = PasswordRecoveryErrorFactory.createServiceError(
        'database',
        'validate_reset_token',
        error,
        { tokenId: token.substring(0, 8) + '...' }
      );

      this.monitor.logTokenValidation({
        tokenId: token.substring(0, 8) + '...',
        success: false,
        error: error.message,
        ip: requestContext?.ip,
        userAgent: requestContext?.userAgent,
      });

      logger.error('Token validation failed', { error: error.message });
      return { valid: false };
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateWithEmail(email: string, password: string): Promise<LoginResult> {
    try {
      logger.info('AuthService.authenticateWithEmail called', { email });

      // Find user by email
      const user = await this.userRepository.findByEmail(email);
      logger.info('User lookup result', { found: !!user, hasPasswordHash: !!(user?.passwordHash) });

      if (!user || !user.passwordHash) {
        logger.warn('User not found or no password hash', { email, userFound: !!user });
        throw new Error('Invalid email or password');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      logger.info('Password verification result', { email, isValid: isValidPassword });

      if (!isValidPassword) {
        logger.warn('Password verification failed', { email });
        throw new Error('Invalid email or password');
      }

      // Generate JWT token
      const token = this.generateToken({
        id: user.id,
        username: user.username,
        email: user.email,
      });

      const expiresAt = this.getTokenExpirationDate();

      return {
        user,
        token,
        expiresAt,
      };
    } catch (error) {
      logger.error('Email authentication failed', { error: error.message, email });
      throw error;
    }
  }

  /**
   * Invalidate all user sessions (revoke all JWT tokens)
   */
  async invalidateAllUserSessions(userId: string, reason: string = 'Password reset'): Promise<void> {
    try {
      if (!this.jwtTokenBlacklistRepository) {
        logger.warn('JWT token blacklist repository not configured - cannot invalidate sessions', { userId });
        return;
      }

      // Create a session invalidation record
      await this.jwtTokenBlacklistRepository.blacklistAllUserTokens(userId, reason);

      logger.info('All user sessions invalidated', {
        userId,
        reason,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to invalidate user sessions', {
        userId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to invalidate user sessions');
    }
  }

  /**
   * Revoke a specific JWT token
   */
  async revokeToken(token: string, reason: string = 'Manual revocation'): Promise<void> {
    try {
      if (!this.jwtTokenBlacklistRepository) {
        logger.warn('JWT token blacklist repository not configured - cannot revoke token');
        return;
      }

      // Decode token to get payload (without verification since we're revoking it)
      const payload = jwt.decode(token) as AuthTokenPayload;
      if (!payload || !payload.jti || !payload.userId) {
        throw new Error('Invalid token format');
      }

      // Add token to blacklist
      const expiresAt = new Date(payload.exp * 1000);
      await this.jwtTokenBlacklistRepository.blacklistToken({
        userId: payload.userId,
        tokenId: payload.jti,
        expiresAt,
        reason,
      });

      logger.info('JWT token revoked', {
        userId: payload.userId,
        tokenId: payload.jti,
        reason,
      });
    } catch (error) {
      logger.error('Failed to revoke token', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reason,
      });
      throw new Error('Failed to revoke token');
    }
  }

  /**
   * Check if a token is valid (not blacklisted and not expired)
   */
  async isTokenValid(token: string): Promise<boolean> {
    try {
      await this.verifyToken(token);
      return true;
    } catch (error) {
      return false;
    }
  }
}