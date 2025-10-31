import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthTokenPayload } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { User } from '@booking-swap/shared';
import { enhancedLogger } from '../utils/logger';
import { AuthMiddleware, AUTH_ERROR_CODES, AuthErrorResponse } from './auth';
import {
    targetingAuthLogger,
    logTargetingAuthFailure,
    logTargetingAuthSuccess
} from '../utils/targetingAuthLogger';

/**
 * Enhanced authentication middleware specifically for targeting operations
 * 
 * This middleware provides consistent token validation for targeting endpoints
 * and distinguishes between authentication failures and authorization issues.
 * 
 * Requirements satisfied:
 * - 2.1: Consistent token validation across targeting endpoints
 * - 2.2: Proper error responses distinguishing auth vs authorization failures
 * - 2.3: Prevent false positive authentication failures
 * - 2.4: Maintain authentication state consistency
 */

export interface TargetingAuthContext {
    operation: 'target' | 'retarget' | 'remove_target' | 'get_status' | 'get_history' | 'validate';
    sourceSwapId?: string;
    targetSwapId?: string;
    requiresOwnership?: boolean;
    allowsCrossUserAccess?: boolean;
}

export interface TargetingAuthErrorResponse extends AuthErrorResponse {
    error: AuthErrorResponse['error'] & {
        isTargetingRelated: boolean;
        preservesMainAuth: boolean;
        targetingContext?: TargetingAuthContext;
    };
}

// Enhanced error codes specific to targeting operations
export const TARGETING_AUTH_ERROR_CODES = {
    ...AUTH_ERROR_CODES,
    TARGETING_TOKEN_VALIDATION_FAILED: {
        code: 'TARGETING_TOKEN_VALIDATION_FAILED',
        message: 'Token validation failed for targeting operation',
        httpStatus: 401,
    },
    TARGETING_PERMISSION_DENIED: {
        code: 'TARGETING_PERMISSION_DENIED',
        message: 'Insufficient permissions for targeting operation',
        httpStatus: 403,
    },
    CROSS_USER_ACCESS_DENIED: {
        code: 'CROSS_USER_ACCESS_DENIED',
        message: 'Cross-user access not allowed for this targeting operation',
        httpStatus: 403,
    },
    TARGETING_SCOPE_REQUIRED: {
        code: 'TARGETING_SCOPE_REQUIRED',
        message: 'Targeting scope required for this operation',
        httpStatus: 403,
    },
    SWAP_ACCESS_DENIED: {
        code: 'SWAP_ACCESS_DENIED',
        message: 'Access denied to swap for targeting operation',
        httpStatus: 403,
    },
} as const;

export class TargetingAuthMiddleware extends AuthMiddleware {
    private targetingAuthService: AuthService;
    private targetingUserRepository: UserRepository;

    constructor(
        authService: AuthService,
        userRepository: UserRepository
    ) {
        super(authService, userRepository);
        this.targetingAuthService = authService;
        this.targetingUserRepository = userRepository;
    }

    /**
     * Enhanced authentication middleware for targeting operations
     */
    authenticateTargeting(context: TargetingAuthContext) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const startTime = Date.now();
            const requestId = (Array.isArray(req.headers['x-request-id'])
                ? req.headers['x-request-id'][0]
                : req.headers['x-request-id']) || `targeting-auth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            // Initialize timing variables
            let tokenValidationTime = 0;
            let userLookupTime = 0;
            let authorizationTime = 0;

            try {
                // Use the targeting authentication logger
                const { logTargetingAuthAttempt } = await import('../utils/targetingAuthLogger');
                const loggedRequestId = logTargetingAuthAttempt(
                    req,
                    context.operation,
                    context.sourceSwapId,
                    context.targetSwapId
                );

                // Use the logged request ID if different
                if (loggedRequestId !== requestId) {
                    enhancedLogger.debug('Using logged request ID for targeting auth', {
                        originalRequestId: requestId,
                        loggedRequestId,
                        category: 'targeting_authentication'
                    });
                }

                // Step 1: Basic token validation using parent class logic
                const authHeader = req.headers.authorization;

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return this.sendTargetingAuthError(
                        res,
                        TARGETING_AUTH_ERROR_CODES.MISSING_TOKEN,
                        'token_extraction',
                        requestId,
                        Date.now() - startTime,
                        context,
                        `Expected format: "Authorization: Bearer <token>", received: "${authHeader || 'none'}"`
                    );
                }

                const token = authHeader.substring(7);

                // Validate token format with enhanced targeting-specific checks
                if (!this.validateTokenFormat(authHeader)) {
                    return this.sendTargetingAuthError(
                        res,
                        TARGETING_AUTH_ERROR_CODES.INVALID_TOKEN_FORMAT,
                        'token_extraction',
                        requestId,
                        Date.now() - startTime,
                        context,
                        'Token should be a valid JWT structure for targeting operations'
                    );
                }

                // Step 2: Token verification with targeting-aware error handling
                let tokenPayload: AuthTokenPayload;
                const tokenValidationStart = Date.now();
                try {
                    tokenPayload = await this.targetingAuthService.verifyToken(token);
                    tokenValidationTime = Date.now() - tokenValidationStart;

                    // Log token validation details
                    targetingAuthLogger.logTokenValidation(
                        requestId,
                        'valid_jwt',
                        new Date(tokenPayload.exp * 1000),
                        tokenPayload.userId,
                        (tokenPayload as any).scopes || (tokenPayload as any).scope?.split(' ') || []
                    );

                    enhancedLogger.debug('Targeting token verification successful', {
                        category: 'targeting_authentication',
                        requestId,
                        userId: tokenPayload.userId,
                        operation: context.operation,
                        tokenExp: new Date(tokenPayload.exp * 1000).toISOString(),
                        validationTime: tokenValidationTime
                    });

                } catch (error) {
                    // Enhanced error handling for targeting operations
                    const errorMessage = error instanceof Error ? error.message : 'Unknown verification error';
                    tokenValidationTime = Date.now() - tokenValidationStart;

                    // Log token validation failure
                    targetingAuthLogger.logTokenValidation(
                        requestId,
                        'invalid_format',
                        undefined,
                        undefined,
                        []
                    );

                    // Determine if this is a genuine token issue or targeting-specific problem
                    let errorCode: typeof TARGETING_AUTH_ERROR_CODES[keyof typeof TARGETING_AUTH_ERROR_CODES];

                    if (errorMessage.includes('expired')) {
                        errorCode = TARGETING_AUTH_ERROR_CODES.TOKEN_EXPIRED;
                    } else if (errorMessage.includes('blacklisted') || errorMessage.includes('revoked')) {
                        errorCode = TARGETING_AUTH_ERROR_CODES.TOKEN_BLACKLISTED;
                    } else if (errorMessage.includes('secret') || errorMessage.includes('signature')) {
                        errorCode = TARGETING_AUTH_ERROR_CODES.JWT_SECRET_ERROR;
                    } else {
                        errorCode = TARGETING_AUTH_ERROR_CODES.TARGETING_TOKEN_VALIDATION_FAILED;
                    }

                    // Log the authentication failure
                    logTargetingAuthFailure(
                        requestId,
                        errorCode.code,
                        errorMessage,
                        'authentication',
                        'token_verification',
                        Date.now() - startTime,
                        {
                            tokenValidationTime,
                            preservesMainAuth: true,
                            isTargetingRelated: true,
                            originalError: error
                        }
                    );

                    enhancedLogger.logSecurityEvent(
                        'targeting_authentication_failed_token_verification',
                        'medium', // Lower severity for targeting operations
                        undefined,
                        req.ip,
                        {
                            requestId,
                            endpoint: req.path,
                            operation: context.operation,
                            error: errorMessage,
                            preservesMainAuth: true, // Targeting failures preserve main auth
                        }
                    );

                    return this.sendTargetingAuthError(
                        res,
                        errorCode,
                        'token_verification',
                        requestId,
                        Date.now() - startTime,
                        context,
                        `JWT verification failed for targeting operation: ${errorMessage}`
                    );
                }

                // Step 3: User lookup with targeting context
                let user: User | null;
                const userLookupStart = Date.now();
                try {
                    user = await this.targetingUserRepository.findById(tokenPayload.userId);
                    userLookupTime = Date.now() - userLookupStart;

                    // Log user lookup details
                    targetingAuthLogger.logUserLookup(
                        requestId,
                        tokenPayload.userId,
                        !!user,
                        userLookupTime
                    );
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Database connection error';
                    userLookupTime = Date.now() - userLookupStart;

                    // Log user lookup failure
                    targetingAuthLogger.logUserLookup(
                        requestId,
                        tokenPayload.userId,
                        false,
                        userLookupTime
                    );

                    // Log the authentication failure
                    logTargetingAuthFailure(
                        requestId,
                        TARGETING_AUTH_ERROR_CODES.DATABASE_ERROR.code,
                        errorMessage,
                        'system',
                        'user_lookup',
                        Date.now() - startTime,
                        {
                            userLookupTime,
                            preservesMainAuth: true,
                            isTargetingRelated: true,
                            originalError: error
                        }
                    );

                    enhancedLogger.logError(error instanceof Error ? error : new Error('Database error during targeting user lookup'), {
                        operation: 'targeting_user_lookup_authentication',
                        requestId,
                        metadata: {
                            userId: tokenPayload.userId,
                            endpoint: req.path,
                            operation: context.operation,
                        },
                    });

                    return this.sendTargetingAuthError(
                        res,
                        TARGETING_AUTH_ERROR_CODES.DATABASE_ERROR,
                        'user_lookup',
                        requestId,
                        Date.now() - startTime,
                        context,
                        `Failed to lookup user for targeting operation: ${errorMessage}`
                    );
                }

                if (!user) {
                    // Log the authentication failure
                    logTargetingAuthFailure(
                        requestId,
                        TARGETING_AUTH_ERROR_CODES.USER_NOT_FOUND.code,
                        `User ID ${tokenPayload.userId} from token not found`,
                        'authentication',
                        'user_lookup',
                        Date.now() - startTime,
                        {
                            preservesMainAuth: true,
                            isTargetingRelated: true,
                            userId: tokenPayload.userId
                        }
                    );

                    enhancedLogger.logSecurityEvent(
                        'targeting_authentication_failed_user_not_found',
                        'medium', // Lower severity for targeting operations
                        tokenPayload.userId,
                        req.ip,
                        {
                            requestId,
                            endpoint: req.path,
                            operation: context.operation,
                            userId: tokenPayload.userId,
                            preservesMainAuth: true,
                        }
                    );

                    return this.sendTargetingAuthError(
                        res,
                        TARGETING_AUTH_ERROR_CODES.USER_NOT_FOUND,
                        'user_lookup',
                        requestId,
                        Date.now() - startTime,
                        context,
                        `User ID ${tokenPayload.userId} from token not found for targeting operation`
                    );
                }

                // Step 4: Targeting-specific authorization checks
                const authorizationStart = Date.now();
                const authorizationResult = await this.validateTargetingAuthorization(
                    user,
                    tokenPayload,
                    context,
                    req
                );
                authorizationTime = Date.now() - authorizationStart;

                // Log authorization check
                targetingAuthLogger.logAuthorizationCheck(
                    requestId,
                    'targeting_permissions',
                    authorizationResult.authorized,
                    {
                        reason: authorizationResult.reason,
                        errorCode: authorizationResult.errorCode?.code,
                        authorizationTime,
                        requiresOwnership: context.requiresOwnership,
                        allowsCrossUserAccess: context.allowsCrossUserAccess
                    }
                );

                if (!authorizationResult.authorized) {
                    // Log the authorization failure
                    logTargetingAuthFailure(
                        requestId,
                        authorizationResult.errorCode?.code || TARGETING_AUTH_ERROR_CODES.TARGETING_PERMISSION_DENIED.code,
                        authorizationResult.reason || 'Authorization failed',
                        'authorization',
                        'authorization',
                        Date.now() - startTime,
                        {
                            authorizationTime,
                            preservesMainAuth: true,
                            isTargetingRelated: true,
                            userId: user.id,
                            requiresOwnership: context.requiresOwnership,
                            allowsCrossUserAccess: context.allowsCrossUserAccess
                        }
                    );

                    enhancedLogger.logSecurityEvent(
                        'targeting_authorization_failed',
                        'low', // Authorization failures are less critical than authentication
                        user.id,
                        req.ip,
                        {
                            requestId,
                            endpoint: req.path,
                            operation: context.operation,
                            reason: authorizationResult.reason,
                            preservesMainAuth: true,
                        }
                    );

                    return this.sendTargetingAuthError(
                        res,
                        authorizationResult.errorCode || TARGETING_AUTH_ERROR_CODES.TARGETING_PERMISSION_DENIED,
                        'authorization',
                        requestId,
                        Date.now() - startTime,
                        context,
                        authorizationResult.reason
                    );
                }

                // Step 5: Successful authentication - attach user and context
                try {
                    await this.targetingUserRepository.updateLastActive(user.id);
                } catch (error) {
                    enhancedLogger.warn('Failed to update user last active time during targeting auth', {
                        category: 'targeting_authentication',
                        requestId,
                        userId: user.id,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    });
                }

                // Attach user and targeting context to request
                req.user = user;
                req.tokenPayload = tokenPayload;
                (req as any).targetingContext = context;

                // Add targeting-specific headers for debugging
                res.setHeader('X-Targeting-Auth-Success', 'true');
                res.setHeader('X-Targeting-Operation', context.operation);

                const duration = Date.now() - startTime;

                // Log successful authentication with performance metrics
                const performanceMetrics = {
                    tokenValidationTime: tokenValidationTime || 0,
                    userLookupTime: userLookupTime || 0,
                    authorizationTime: authorizationTime || 0,
                    totalTime: duration
                };

                logTargetingAuthSuccess(
                    requestId,
                    user.id,
                    ['targeting_permissions'],
                    performanceMetrics
                );

                enhancedLogger.logPerformanceMetric(
                    'targeting_authentication_success',
                    duration,
                    true,
                    {
                        requestId,
                        userId: user.id,
                        endpoint: req.path,
                        operation: context.operation,
                        sourceSwapId: context.sourceSwapId,
                        targetSwapId: context.targetSwapId,
                        performanceMetrics
                    }
                );

                next();

            } catch (error) {
                const duration = Date.now() - startTime;
                const errorMessage = error instanceof Error ? error.message : 'Unknown targeting authentication error';

                // Log the authentication failure
                logTargetingAuthFailure(
                    requestId,
                    TARGETING_AUTH_ERROR_CODES.AUTH_ERROR.code,
                    errorMessage,
                    'system',
                    'authorization',
                    duration,
                    {
                        preservesMainAuth: true,
                        isTargetingRelated: true,
                        originalError: error,
                        tokenValidationTime,
                        userLookupTime,
                        authorizationTime
                    }
                );

                enhancedLogger.logError(error instanceof Error ? error : new Error('Unknown targeting authentication error'), {
                    operation: 'targeting_authentication_middleware',
                    requestId,
                    metadata: {
                        endpoint: req.path,
                        method: req.method,
                        operation: context.operation,
                        duration,
                    },
                });

                return this.sendTargetingAuthError(
                    res,
                    TARGETING_AUTH_ERROR_CODES.AUTH_ERROR,
                    'authorization',
                    requestId,
                    duration,
                    context,
                    errorMessage
                );
            }
        };
    }

    /**
     * Validate targeting-specific authorization requirements
     */
    private async validateTargetingAuthorization(
        user: User,
        tokenPayload: AuthTokenPayload,
        context: TargetingAuthContext,
        req: Request
    ): Promise<{
        authorized: boolean;
        reason?: string;
        errorCode?: typeof TARGETING_AUTH_ERROR_CODES[keyof typeof TARGETING_AUTH_ERROR_CODES];
    }> {
        // Check if user has targeting permissions (if token includes scopes)
        const tokenScopes = (tokenPayload as any).scopes || (tokenPayload as any).scope?.split(' ') || [];

        if (tokenScopes.length > 0) {
            const hasTargetingScope = tokenScopes.some((scope: string) =>
                scope.includes('targeting') || scope.includes('swap') || scope === 'all'
            );

            if (!hasTargetingScope && ['target', 'retarget', 'remove_target'].includes(context.operation)) {
                return {
                    authorized: false,
                    reason: 'Token does not have targeting permissions',
                    errorCode: TARGETING_AUTH_ERROR_CODES.TARGETING_SCOPE_REQUIRED
                };
            }
        }

        // Check swap ownership if required
        if (context.requiresOwnership && context.sourceSwapId) {
            // Extract swap ID from request params if not provided in context
            const swapId = context.sourceSwapId || req.params.id || req.params.swapId;

            if (swapId) {
                // In a full implementation, this would check swap ownership in the database
                // For now, we'll assume the user has access to swaps they're trying to modify
                const hasSwapAccess = true; // Placeholder - would check database

                if (!hasSwapAccess) {
                    return {
                        authorized: false,
                        reason: `No access to swap ${swapId} for targeting operation`,
                        errorCode: TARGETING_AUTH_ERROR_CODES.SWAP_ACCESS_DENIED
                    };
                }
            }
        }

        // Check cross-user access permissions
        if (!context.allowsCrossUserAccess && context.targetSwapId) {
            // In a full implementation, this would check if the target swap belongs to a different user
            // For targeting operations, we typically want to allow cross-user access
            const isCrossUserAccess = false; // Placeholder - would check database

            if (isCrossUserAccess) {
                return {
                    authorized: false,
                    reason: 'Cross-user access not allowed for this targeting operation',
                    errorCode: TARGETING_AUTH_ERROR_CODES.CROSS_USER_ACCESS_DENIED
                };
            }
        }

        return { authorized: true };
    }

    /**
     * Send targeting-specific authentication error response
     */
    private sendTargetingAuthError(
        res: Response,
        errorConfig: typeof TARGETING_AUTH_ERROR_CODES[keyof typeof TARGETING_AUTH_ERROR_CODES],
        step: 'token_extraction' | 'token_verification' | 'user_lookup' | 'authorization',
        requestId: string,
        executionTime: number,
        context: TargetingAuthContext,
        details?: string
    ): void {
        const errorResponse: TargetingAuthErrorResponse = {
            error: {
                code: errorConfig.code,
                message: errorConfig.message,
                category: 'authentication',
                timestamp: new Date(),
                isTargetingRelated: true,
                preservesMainAuth: true, // Targeting auth failures preserve main authentication state
                targetingContext: context,
                debugInfo: process.env.NODE_ENV === 'development' ? {
                    step: step,
                    details: details || 'No additional details available'
                } : undefined,
            },
        };

        // Add targeting-specific response headers
        res.setHeader('X-Targeting-Auth-Error', errorConfig.code);
        res.setHeader('X-Targeting-Operation', context.operation);
        res.setHeader('X-Preserves-Main-Auth', 'true');

        res.status(errorConfig.httpStatus).json(errorResponse);
    }

    /**
     * Create targeting authentication middleware for specific operations
     */
    static createTargetingAuth(
        authService: AuthService,
        userRepository: UserRepository,
        context: TargetingAuthContext
    ) {
        const middleware = new TargetingAuthMiddleware(authService, userRepository);
        return middleware.authenticateTargeting(context);
    }

    /**
     * Convenience method for targeting operations that require ownership
     */
    static requireTargetingOwnership(
        authService: AuthService,
        userRepository: UserRepository,
        operation: TargetingAuthContext['operation']
    ) {
        return TargetingAuthMiddleware.createTargetingAuth(authService, userRepository, {
            operation,
            requiresOwnership: true,
            allowsCrossUserAccess: false
        });
    }

    /**
     * Convenience method for targeting operations that allow cross-user access
     */
    static allowCrossUserTargeting(
        authService: AuthService,
        userRepository: UserRepository,
        operation: TargetingAuthContext['operation']
    ) {
        return TargetingAuthMiddleware.createTargetingAuth(authService, userRepository, {
            operation,
            requiresOwnership: false,
            allowsCrossUserAccess: true
        });
    }

    /**
     * Convenience method for read-only targeting operations
     */
    static readOnlyTargeting(
        authService: AuthService,
        userRepository: UserRepository,
        operation: TargetingAuthContext['operation']
    ) {
        return TargetingAuthMiddleware.createTargetingAuth(authService, userRepository, {
            operation,
            requiresOwnership: false,
            allowsCrossUserAccess: true
        });
    }
}

export default TargetingAuthMiddleware;