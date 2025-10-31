import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthTokenPayload } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { User } from '@booking-swap/shared';
import { enhancedLogger } from '../utils/logger';
import jwt from 'jsonwebtoken';

// Extend Express Request interface to include user data
declare global {
  namespace Express {
    interface Request {
      user?: User;
      tokenPayload?: AuthTokenPayload;
    }
  }
}

export interface AuthMiddlewareOptions {
  required?: boolean;
  refreshToken?: boolean;
  debug?: boolean;
}

export interface AuthMiddlewareDebugInfo {
  hasAuthHeader: boolean;
  tokenFormat: string;
  tokenLength: number;
  verificationResult: 'success' | 'failed' | 'error';
  userFound: boolean;
  errorDetails?: string;
  step: 'token_extraction' | 'token_verification' | 'user_lookup' | 'request_attachment' | 'complete';
  jwtSecretConfigured: boolean;
  tokenPayload?: Partial<AuthTokenPayload>;
}

export interface AuthErrorResponse {
  error: {
    code: string;
    message: string;
    category: 'authentication';
    timestamp: Date;
    debugInfo?: {
      step: 'token_extraction' | 'token_verification' | 'user_lookup' | 'request_attachment';
      details: string;
    };
  };
}

// Comprehensive error codes and messages for authentication
export const AUTH_ERROR_CODES = {
  MISSING_TOKEN: {
    code: 'MISSING_TOKEN',
    message: 'Authorization token is required',
    httpStatus: 401,
  },
  INVALID_TOKEN_FORMAT: {
    code: 'INVALID_TOKEN_FORMAT',
    message: 'Token format is invalid',
    httpStatus: 401,
  },
  INVALID_TOKEN: {
    code: 'INVALID_TOKEN',
    message: 'Token verification failed',
    httpStatus: 401,
  },
  TOKEN_EXPIRED: {
    code: 'TOKEN_EXPIRED',
    message: 'Token has expired',
    httpStatus: 401,
  },
  TOKEN_BLACKLISTED: {
    code: 'TOKEN_BLACKLISTED',
    message: 'Token has been revoked',
    httpStatus: 401,
  },
  USER_NOT_FOUND: {
    code: 'USER_NOT_FOUND',
    message: 'User associated with token not found',
    httpStatus: 401,
  },
  DATABASE_ERROR: {
    code: 'DATABASE_ERROR',
    message: 'Database connection error during authentication',
    httpStatus: 500,
  },
  JWT_SECRET_ERROR: {
    code: 'JWT_SECRET_ERROR',
    message: 'JWT configuration error',
    httpStatus: 500,
  },
  AUTH_ERROR: {
    code: 'AUTH_ERROR',
    message: 'Authentication error occurred',
    httpStatus: 500,
  },
  AUTHENTICATION_REQUIRED: {
    code: 'AUTHENTICATION_REQUIRED',
    message: 'Authentication required',
    httpStatus: 401,
  },
  INSUFFICIENT_VERIFICATION: {
    code: 'INSUFFICIENT_VERIFICATION',
    message: 'Insufficient verification level',
    httpStatus: 403,
  },
  INSUFFICIENT_REPUTATION: {
    code: 'INSUFFICIENT_REPUTATION',
    message: 'Insufficient reputation score',
    httpStatus: 403,
  },
  ACCESS_DENIED: {
    code: 'ACCESS_DENIED',
    message: 'Access denied',
    httpStatus: 403,
  },
} as const;

export class AuthMiddleware {
  constructor(
    private authService: AuthService,
    private userRepository: UserRepository
  ) { }

  /**
   * Debug utility to validate token format without verification
   */
  validateTokenFormat(authHeader: string): boolean {
    if (!authHeader) return false;
    if (!authHeader.startsWith('Bearer ')) return false;

    const token = authHeader.substring(7);
    if (!token || token.length < 10) return false;

    // Check if it looks like a JWT (three parts separated by dots)
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Debug utility to decode token without verification
   */
  debugDecodeToken(token: string): { valid: boolean; payload?: any; error?: string } {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded) {
        return { valid: false, error: 'Token could not be decoded' };
      }
      return { valid: true, payload: decoded.payload };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown decode error' };
    }
  }

  /**
   * Debug utility to validate JWT configuration
   */
  validateJwtSecret(): boolean {
    const secret = process.env.JWT_SECRET;
    return !!(secret && secret.length > 0 && secret !== 'default-secret-change-in-production');
  }

  /**
   * Get HTTP status code for error code
   */
  getHttpStatusForError(code: string): number {
    const errorConfig = Object.values(AUTH_ERROR_CODES).find(config => config.code === code);
    return errorConfig?.httpStatus || 500;
  }

  /**
   * Enhanced error response with debug information
   */
  createAuthErrorResponse(
    code: string,
    message: string,
    step: 'token_extraction' | 'token_verification' | 'user_lookup' | 'request_attachment',
    details?: string
  ): AuthErrorResponse {
    return {
      error: {
        code,
        message,
        category: 'authentication',
        timestamp: new Date(),
        debugInfo: process.env.NODE_ENV === 'development' ? {
          step,
          details: details || 'No additional details available'
        } : undefined,
      },
    };
  }

  /**
   * Debug authentication flow - comprehensive logging and analysis
   */
  debugAuthentication(req: Request, authHeader?: string): AuthMiddlewareDebugInfo {
    const header = authHeader || req.headers.authorization;
    const debugInfo: AuthMiddlewareDebugInfo = {
      hasAuthHeader: !!header,
      tokenFormat: header ? (header.startsWith('Bearer ') ? 'Bearer' : 'Invalid') : 'None',
      tokenLength: header ? header.length : 0,
      verificationResult: 'error',
      userFound: false,
      step: 'token_extraction',
      jwtSecretConfigured: this.validateJwtSecret(),
    };

    if (header && header.startsWith('Bearer ')) {
      const token = header.substring(7);
      debugInfo.tokenLength = token.length;

      // Try to decode token for debug info
      const decodeResult = this.debugDecodeToken(token);
      if (decodeResult.valid && decodeResult.payload) {
        debugInfo.tokenPayload = {
          userId: decodeResult.payload.userId,
          email: decodeResult.payload.email,
          username: decodeResult.payload.username,
          iat: decodeResult.payload.iat,
          exp: decodeResult.payload.exp,
        };
      } else {
        debugInfo.errorDetails = decodeResult.error;
      }
    }

    return debugInfo;
  }

  /**
   * JWT Authentication middleware
   */
  authenticate(options: AuthMiddlewareOptions = { required: true, refreshToken: true }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = (Array.isArray(req.headers['x-request-id'])
        ? req.headers['x-request-id'][0]
        : req.headers['x-request-id']) || `auth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      // Initialize debug info
      let debugInfo = this.debugAuthentication(req);

      try {
        // Log authentication attempt
        enhancedLogger.info('Authentication attempt started', {
          category: 'authentication',
          requestId,
          endpoint: req.path,
          method: req.method,
          hasAuthHeader: debugInfo.hasAuthHeader,
          tokenFormat: debugInfo.tokenFormat,
          jwtSecretConfigured: debugInfo.jwtSecretConfigured,
        });

        const authHeader = req.headers.authorization;

        // Step 1: Token Extraction
        debugInfo.step = 'token_extraction';

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          const errorResponse = this.createAuthErrorResponse(
            AUTH_ERROR_CODES.MISSING_TOKEN.code,
            AUTH_ERROR_CODES.MISSING_TOKEN.message,
            'token_extraction',
            `Expected format: "Authorization: Bearer <token>", received: "${authHeader || 'none'}"`
          );

          enhancedLogger.logSecurityEvent(
            'authentication_failed_missing_token',
            'medium',
            undefined,
            req.ip,
            {
              requestId,
              endpoint: req.path,
              authHeader: authHeader ? 'present_invalid_format' : 'missing',
              debugInfo,
            }
          );

          if (options.required) {
            return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
          }
          return next();
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Validate token format
        if (!this.validateTokenFormat(authHeader)) {
          const errorResponse = this.createAuthErrorResponse(
            AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT.code,
            AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT.message,
            'token_extraction',
            'Token should be a valid JWT structure with three parts separated by dots'
          );

          enhancedLogger.logSecurityEvent(
            'authentication_failed_invalid_format',
            'medium',
            undefined,
            req.ip,
            {
              requestId,
              endpoint: req.path,
              tokenLength: token.length,
              debugInfo,
            }
          );

          if (options.required) {
            return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
          }
          return next();
        }

        // Step 2: Token Verification
        debugInfo.step = 'token_verification';
        let tokenPayload: AuthTokenPayload;

        try {
          enhancedLogger.debug('Starting token verification', {
            category: 'authentication',
            requestId,
            tokenLength: token.length,
            jwtSecretConfigured: debugInfo.jwtSecretConfigured,
          });

          tokenPayload = await this.authService.verifyToken(token);
          debugInfo.verificationResult = 'success';
          debugInfo.tokenPayload = {
            userId: tokenPayload.userId,
            email: tokenPayload.email,
            username: tokenPayload.username,
            iat: tokenPayload.iat,
            exp: tokenPayload.exp,
          };

          enhancedLogger.debug('Token verification successful', {
            category: 'authentication',
            requestId,
            userId: tokenPayload.userId,
            tokenExp: new Date(tokenPayload.exp * 1000).toISOString(),
          });

        } catch (error) {
          debugInfo.verificationResult = 'failed';
          debugInfo.errorDetails = error instanceof Error ? error.message : 'Unknown verification error';

          // Determine specific error type based on error message
          let errorCode: string = AUTH_ERROR_CODES.INVALID_TOKEN.code;
          let errorMessage: string = AUTH_ERROR_CODES.INVALID_TOKEN.message;

          if (debugInfo.errorDetails.includes('expired')) {
            errorCode = AUTH_ERROR_CODES.TOKEN_EXPIRED.code;
            errorMessage = AUTH_ERROR_CODES.TOKEN_EXPIRED.message;
          } else if (debugInfo.errorDetails.includes('blacklisted') || debugInfo.errorDetails.includes('revoked')) {
            errorCode = AUTH_ERROR_CODES.TOKEN_BLACKLISTED.code;
            errorMessage = AUTH_ERROR_CODES.TOKEN_BLACKLISTED.message;
          } else if (debugInfo.errorDetails.includes('secret') || debugInfo.errorDetails.includes('signature')) {
            errorCode = AUTH_ERROR_CODES.JWT_SECRET_ERROR.code;
            errorMessage = AUTH_ERROR_CODES.JWT_SECRET_ERROR.message;
          }

          const errorResponse = this.createAuthErrorResponse(
            errorCode,
            errorMessage,
            'token_verification',
            `JWT verification failed: ${debugInfo.errorDetails}`
          );

          enhancedLogger.logSecurityEvent(
            'authentication_failed_token_verification',
            'high',
            debugInfo.tokenPayload?.userId,
            req.ip,
            {
              requestId,
              endpoint: req.path,
              error: debugInfo.errorDetails,
              jwtSecretConfigured: debugInfo.jwtSecretConfigured,
              debugInfo,
            }
          );

          if (options.required) {
            return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
          }
          return next();
        }

        // Step 3: User Lookup
        debugInfo.step = 'user_lookup';

        enhancedLogger.debug('Starting user lookup', {
          category: 'authentication',
          requestId,
          userId: tokenPayload.userId,
        });

        let user;
        try {
          user = await this.userRepository.findById(tokenPayload.userId);
          debugInfo.userFound = !!user;
        } catch (error) {
          debugInfo.userFound = false;
          debugInfo.errorDetails = error instanceof Error ? error.message : 'Database connection error';

          const errorResponse = this.createAuthErrorResponse(
            AUTH_ERROR_CODES.DATABASE_ERROR.code,
            AUTH_ERROR_CODES.DATABASE_ERROR.message,
            'user_lookup',
            `Failed to lookup user: ${debugInfo.errorDetails}`
          );

          enhancedLogger.logError(error instanceof Error ? error : new Error('Database error during user lookup'), {
            operation: 'user_lookup_authentication',
            requestId,
            metadata: {
              userId: tokenPayload.userId,
              endpoint: req.path,
              debugInfo,
            },
          });

          if (options.required) {
            return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
          }
          return next();
        }

        if (!user) {
          const errorResponse = this.createAuthErrorResponse(
            AUTH_ERROR_CODES.USER_NOT_FOUND.code,
            AUTH_ERROR_CODES.USER_NOT_FOUND.message,
            'user_lookup',
            `User ID ${tokenPayload.userId} from token not found in database`
          );

          enhancedLogger.logSecurityEvent(
            'authentication_failed_user_not_found',
            'high',
            tokenPayload.userId,
            req.ip,
            {
              requestId,
              endpoint: req.path,
              userId: tokenPayload.userId,
              debugInfo,
            }
          );

          if (options.required) {
            return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
          }
          return next();
        }

        enhancedLogger.debug('User lookup successful', {
          category: 'authentication',
          requestId,
          userId: user.id,
          userEmail: user.email,
          userWallet: user.walletAddress,
        });

        // Step 4: Request Attachment
        debugInfo.step = 'request_attachment';

        // Update last active time
        try {
          await this.userRepository.updateLastActive(user.id);
        } catch (error) {
          enhancedLogger.warn('Failed to update user last active time', {
            category: 'authentication',
            requestId,
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Attach user and token payload to request
        req.user = user;
        req.tokenPayload = tokenPayload;

        // Check if token needs refresh and add to response headers
        if (options.refreshToken) {
          try {
            const newToken = await this.authService.refreshTokenIfNeeded(token);
            if (newToken) {
              res.setHeader('X-New-Token', newToken);
              enhancedLogger.debug('Token refreshed', {
                category: 'authentication',
                requestId,
                userId: user.id,
              });
            }
          } catch (error) {
            enhancedLogger.warn('Token refresh failed', {
              category: 'authentication',
              requestId,
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        debugInfo.step = 'complete';
        const duration = Date.now() - startTime;

        // Log successful authentication
        enhancedLogger.logPerformanceMetric(
          'authentication_success',
          duration,
          true,
          {
            requestId,
            userId: user.id,
            endpoint: req.path,
            tokenRefreshed: !!res.getHeader('X-New-Token'),
            debugInfo,
          }
        );

        next();
      } catch (error) {
        const duration = Date.now() - startTime;
        debugInfo.verificationResult = 'error';
        debugInfo.errorDetails = error instanceof Error ? error.message : 'Unknown middleware error';

        enhancedLogger.logError(error instanceof Error ? error : new Error('Unknown authentication error'), {
          operation: 'authentication_middleware',
          requestId,
          metadata: {
            endpoint: req.path,
            method: req.method,
            duration,
            debugInfo,
          },
        });

        const errorResponse = this.createAuthErrorResponse(
          AUTH_ERROR_CODES.AUTH_ERROR.code,
          AUTH_ERROR_CODES.AUTH_ERROR.message,
          debugInfo.step === 'complete' ? 'request_attachment' : debugInfo.step,
          debugInfo.errorDetails
        );

        if (options.required) {
          return res.status(this.getHttpStatusForError(errorResponse.error.code)).json(errorResponse);
        }

        next();
      }
    };
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return this.authenticate({ required: false, refreshToken: true });
  }

  /**
   * Required authentication middleware
   */
  requireAuth() {
    return this.authenticate({ required: true, refreshToken: true });
  }

  /**
   * Middleware to check if user has specific verification level
   */
  requireVerificationLevel(minLevel: 'basic' | 'verified' | 'premium') {
    const levelHierarchy = { basic: 0, verified: 1, premium: 2 };

    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.code,
            message: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.message,
            category: 'authentication',
          },
        });
      }

      const userLevel = levelHierarchy[req.user.verification.level];
      const requiredLevel = levelHierarchy[minLevel];

      if (userLevel < requiredLevel) {
        return res.status(AUTH_ERROR_CODES.INSUFFICIENT_VERIFICATION.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.INSUFFICIENT_VERIFICATION.code,
            message: `${AUTH_ERROR_CODES.INSUFFICIENT_VERIFICATION.message}: '${minLevel}' or higher required`,
            category: 'authorization',
          },
        });
      }

      return next();
    };
  }

  /**
   * Middleware to check if user has minimum reputation score
   */
  requireMinimumReputation(minScore: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.code,
            message: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.message,
            category: 'authentication',
          },
        });
      }

      if (req.user.reputation.score < minScore) {
        return res.status(AUTH_ERROR_CODES.INSUFFICIENT_REPUTATION.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.INSUFFICIENT_REPUTATION.code,
            message: `${AUTH_ERROR_CODES.INSUFFICIENT_REPUTATION.message}: minimum ${minScore} required`,
            category: 'authorization',
          },
        });
      }

      return next();
    };
  }

  /**
   * Middleware to ensure user can only access their own resources
   */
  requireOwnership(userIdParam: string = 'userId') {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.user) {
        return res.status(AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.code,
            message: AUTH_ERROR_CODES.AUTHENTICATION_REQUIRED.message,
            category: 'authentication',
          },
        });
      }

      const requestedUserId = req.params[userIdParam];
      if (requestedUserId && requestedUserId !== req.user.id) {
        return res.status(AUTH_ERROR_CODES.ACCESS_DENIED.httpStatus).json({
          error: {
            code: AUTH_ERROR_CODES.ACCESS_DENIED.code,
            message: `${AUTH_ERROR_CODES.ACCESS_DENIED.message}: can only access own resources`,
            category: 'authorization',
          },
        });
      }

      return next();
    };
  }
}

// Create a default auth middleware instance for convenience
// This will be initialized when the app starts
let defaultAuthMiddleware: AuthMiddleware;

export const initializeAuthMiddleware = (authService: AuthService, userRepository: UserRepository) => {
  defaultAuthMiddleware = new AuthMiddleware(authService, userRepository);
};

// Export convenience functions that use the default instance
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!defaultAuthMiddleware) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return defaultAuthMiddleware.requireAuth()(req, res, next);
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!defaultAuthMiddleware) {
    throw new Error('Auth middleware not initialized. Call initializeAuthMiddleware first.');
  }
  return defaultAuthMiddleware.optionalAuth()(req, res, next);
};

// AuthMiddleware is already exported as a class above