import { Request, Response, Router } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthMiddleware } from '../middleware/auth';
import { enhancedLogger } from '../utils/logger';
import jwt from 'jsonwebtoken';

export interface ImmediateAuthDebugInfo {
    timestamp: Date;
    requestId: string;
    endpoint: string;
    authHeader: {
        present: boolean;
        format: string;
        length: number;
        startsWithBearer: boolean;
    };
    token: {
        extracted: boolean;
        length: number;
        format: 'valid_jwt' | 'invalid_jwt' | 'empty' | 'malformed';
        decodedPayload?: any;
        decodeError?: string;
    };
    jwtConfig: {
        secretConfigured: boolean;
        secretLength: number;
        secretValue: string; // Only first/last 4 chars for security
    };
    verification: {
        attempted: boolean;
        success: boolean;
        error?: string;
        payload?: any;
    };
    userLookup: {
        attempted: boolean;
        success: boolean;
        userId?: string;
        userFound: boolean;
        error?: string;
    };
    requestAttachment: {
        userAttached: boolean;
        tokenPayloadAttached: boolean;
    };
    finalResult: 'success' | 'failed' | 'error';
    errorDetails?: string;
}

export class ImmediateAuthDebugger {
    constructor(
        private authService: AuthService,
        private userRepository: UserRepository,
        private authMiddleware: AuthMiddleware
    ) { }

    /**
     * Comprehensive authentication debugging for a specific token
     */
    async debugTokenAuthentication(token: string, requestId?: string): Promise<ImmediateAuthDebugInfo> {
        const debugInfo: ImmediateAuthDebugInfo = {
            timestamp: new Date(),
            requestId: requestId || `debug-${Date.now()}`,
            endpoint: '/debug/auth',
            authHeader: {
                present: !!token,
                format: token ? (token.startsWith('Bearer ') ? 'Bearer' : 'Raw') : 'None',
                length: token ? token.length : 0,
                startsWithBearer: token ? token.startsWith('Bearer ') : false,
            },
            token: {
                extracted: false,
                length: 0,
                format: 'empty',
            },
            jwtConfig: {
                secretConfigured: false,
                secretLength: 0,
                secretValue: 'not_configured',
            },
            verification: {
                attempted: false,
                success: false,
            },
            userLookup: {
                attempted: false,
                success: false,
                userFound: false,
            },
            requestAttachment: {
                userAttached: false,
                tokenPayloadAttached: false,
            },
            finalResult: 'error',
        };

        try {
            // Step 1: JWT Configuration Check
            const jwtSecret = process.env.JWT_SECRET;
            debugInfo.jwtConfig.secretConfigured = !!(jwtSecret && jwtSecret.length > 0);
            debugInfo.jwtConfig.secretLength = jwtSecret ? jwtSecret.length : 0;
            if (jwtSecret && jwtSecret.length >= 8) {
                debugInfo.jwtConfig.secretValue = `${jwtSecret.substring(0, 4)}...${jwtSecret.substring(jwtSecret.length - 4)}`;
            }

            enhancedLogger.info('JWT Configuration Check', {
                category: 'auth_debug',
                requestId: debugInfo.requestId,
                secretConfigured: debugInfo.jwtConfig.secretConfigured,
                secretLength: debugInfo.jwtConfig.secretLength,
            });

            // Step 2: Token Extraction
            let extractedToken = token;
            if (token && token.startsWith('Bearer ')) {
                extractedToken = token.substring(7);
                debugInfo.token.extracted = true;
            } else if (token) {
                debugInfo.token.extracted = true;
            }

            debugInfo.token.length = extractedToken ? extractedToken.length : 0;

            // Step 3: Token Format Validation
            if (extractedToken) {
                try {
                    const parts = extractedToken.split('.');
                    if (parts.length === 3) {
                        debugInfo.token.format = 'valid_jwt';

                        // Try to decode without verification for debug info
                        const decoded = jwt.decode(extractedToken, { complete: true });
                        if (decoded && typeof decoded === 'object' && decoded.payload && typeof decoded.payload === 'object') {
                            const payload = decoded.payload as any;
                            debugInfo.token.decodedPayload = {
                                userId: payload.userId,
                                email: payload.email,
                                username: payload.username,
                                iat: payload.iat,
                                exp: payload.exp,
                                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'unknown',
                                isExpired: payload.exp ? payload.exp < Date.now() / 1000 : 'unknown',
                            };
                        }
                    } else {
                        debugInfo.token.format = 'invalid_jwt';
                    }
                } catch (error) {
                    debugInfo.token.format = 'malformed';
                    debugInfo.token.decodeError = error instanceof Error ? error.message : 'Unknown decode error';
                }
            }

            enhancedLogger.info('Token Extraction and Format Check', {
                category: 'auth_debug',
                requestId: debugInfo.requestId,
                tokenExtracted: debugInfo.token.extracted,
                tokenLength: debugInfo.token.length,
                tokenFormat: debugInfo.token.format,
                decodedPayload: debugInfo.token.decodedPayload,
            });

            // Step 4: Token Verification
            if (extractedToken && debugInfo.token.format === 'valid_jwt') {
                debugInfo.verification.attempted = true;

                try {
                    const payload = await this.authService.verifyToken(extractedToken);
                    debugInfo.verification.success = true;
                    debugInfo.verification.payload = {
                        userId: payload.userId,
                        email: payload.email,
                        username: payload.username,
                        iat: payload.iat,
                        exp: payload.exp,
                    };

                    enhancedLogger.info('Token Verification Successful', {
                        category: 'auth_debug',
                        requestId: debugInfo.requestId,
                        userId: payload.userId,
                        tokenExp: new Date(payload.exp * 1000).toISOString(),
                    });

                    // Step 5: User Lookup
                    debugInfo.userLookup.attempted = true;
                    debugInfo.userLookup.userId = payload.userId;

                    try {
                        const user = await this.userRepository.findById(payload.userId);
                        debugInfo.userLookup.success = true;
                        debugInfo.userLookup.userFound = !!user;

                        if (user) {
                            enhancedLogger.info('User Lookup Successful', {
                                category: 'auth_debug',
                                requestId: debugInfo.requestId,
                                userId: user.id,
                                userEmail: user.email,
                                userWallet: user.walletAddress,
                            });

                            debugInfo.requestAttachment.userAttached = true;
                            debugInfo.requestAttachment.tokenPayloadAttached = true;
                            debugInfo.finalResult = 'success';
                        } else {
                            debugInfo.userLookup.error = 'User not found in database';
                            debugInfo.finalResult = 'failed';

                            enhancedLogger.warn('User Not Found', {
                                category: 'auth_debug',
                                requestId: debugInfo.requestId,
                                userId: payload.userId,
                            });
                        }
                    } catch (userError) {
                        debugInfo.userLookup.success = false;
                        debugInfo.userLookup.error = userError instanceof Error ? userError.message : 'Unknown user lookup error';
                        debugInfo.finalResult = 'error';

                        enhancedLogger.error('User Lookup Failed', {
                            category: 'auth_debug',
                            requestId: debugInfo.requestId,
                            userId: payload.userId,
                            error: debugInfo.userLookup.error,
                        });
                    }

                } catch (verificationError) {
                    debugInfo.verification.success = false;
                    debugInfo.verification.error = verificationError instanceof Error ? verificationError.message : 'Unknown verification error';
                    debugInfo.finalResult = 'failed';

                    enhancedLogger.warn('Token Verification Failed', {
                        category: 'auth_debug',
                        requestId: debugInfo.requestId,
                        error: debugInfo.verification.error,
                        tokenLength: debugInfo.token.length,
                    });
                }
            } else {
                debugInfo.finalResult = 'failed';
                debugInfo.errorDetails = `Token format invalid: ${debugInfo.token.format}`;
            }

        } catch (error) {
            debugInfo.finalResult = 'error';
            debugInfo.errorDetails = error instanceof Error ? error.message : 'Unknown debug error';

            enhancedLogger.error('Authentication Debug Error', {
                category: 'auth_debug',
                requestId: debugInfo.requestId,
                error: debugInfo.errorDetails,
            });
        }

        return debugInfo;
    }

    /**
     * Test authentication flow with a mock request
     */
    async testAuthenticationFlow(authHeader: string): Promise<{
        debugInfo: ImmediateAuthDebugInfo;
        middlewareResult: 'success' | 'failed' | 'error';
        middlewareError?: string;
    }> {
        const requestId = `flow-test-${Date.now()}`;

        // First, run our detailed debugging
        const debugInfo = await this.debugTokenAuthentication(authHeader, requestId);

        // Then test the actual middleware
        let middlewareResult: 'success' | 'failed' | 'error' = 'error';
        let middlewareError: string | undefined;

        try {
            // Create mock request and response objects
            const mockReq = {
                headers: { authorization: authHeader },
                path: '/api/swaps',
                method: 'GET',
                ip: '127.0.0.1',
            } as Request;

            const mockRes = {
                status: (code: number) => ({
                    json: (data: any) => {
                        middlewareResult = 'failed';
                        middlewareError = `HTTP ${code}: ${JSON.stringify(data)}`;
                    }
                }),
                setHeader: () => { },
                getHeader: () => undefined,
            } as any as Response;

            let nextCalled = false;
            const mockNext = () => {
                nextCalled = true;
                middlewareResult = 'success';
            };

            // Run the middleware
            const middleware = this.authMiddleware.requireAuth();
            await middleware(mockReq, mockRes, mockNext);

            if (nextCalled && mockReq.user) {
                middlewareResult = 'success';
            }

        } catch (error) {
            middlewareResult = 'error';
            middlewareError = error instanceof Error ? error.message : 'Unknown middleware error';
        }

        return {
            debugInfo,
            middlewareResult,
            middlewareError,
        };
    }

    /**
     * Create debug routes for immediate testing
     */
    createDebugRoutes(): Router {
        const router = Router();

        // Debug endpoint to analyze current user's token
        router.post('/analyze-token', async (req: Request, res: Response): Promise<void> => {
            try {
                const { token } = req.body;

                if (!token) {
                    res.status(400).json({
                        error: 'Token is required in request body',
                        example: { token: 'Bearer eyJ...' }
                    });
                    return;
                }

                const debugInfo = await this.debugTokenAuthentication(token);

                res.json({
                    success: true,
                    debugInfo,
                    recommendations: this.generateRecommendations(debugInfo),
                });

            } catch (error) {
                res.status(500).json({
                    error: 'Debug analysis failed',
                    details: error instanceof Error ? error.message : 'Unknown error',
                });
                return;
            }
        });

        // Debug endpoint to test full authentication flow
        router.post('/test-auth-flow', async (req: Request, res: Response): Promise<void> => {
            try {
                const { authHeader } = req.body;

                if (!authHeader) {
                    res.status(400).json({
                        error: 'authHeader is required in request body',
                        example: { authHeader: 'Bearer eyJ...' }
                    });
                    return;
                }

                const result = await this.testAuthenticationFlow(authHeader);

                res.json({
                    success: true,
                    ...result,
                    recommendations: this.generateRecommendations(result.debugInfo),
                });

            } catch (error) {
                res.status(500).json({
                    error: 'Authentication flow test failed',
                    details: error instanceof Error ? error.message : 'Unknown error',
                });
                return;
            }
        });

        // Debug endpoint to check current request authentication
        router.get('/current-auth-state', this.authMiddleware.optionalAuth(), (req: Request, res: Response) => {
            const authHeader = req.headers.authorization;

            res.json({
                success: true,
                currentState: {
                    hasAuthHeader: !!authHeader,
                    authHeaderFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Invalid') : 'None',
                    userAttached: !!req.user,
                    tokenPayloadAttached: !!req.tokenPayload,
                    userId: req.user?.id,
                    userEmail: req.user?.email,
                    tokenUserId: req.tokenPayload?.userId,
                    tokenExp: req.tokenPayload?.exp ? new Date(req.tokenPayload.exp * 1000).toISOString() : undefined,
                },
                jwtConfig: {
                    secretConfigured: this.authMiddleware.validateJwtSecret(),
                    secretLength: process.env.JWT_SECRET?.length || 0,
                },
            });
        });

        return router;
    }

    /**
     * Generate actionable recommendations based on debug results
     */
    private generateRecommendations(debugInfo: ImmediateAuthDebugInfo): string[] {
        const recommendations: string[] = [];

        if (!debugInfo.jwtConfig.secretConfigured) {
            recommendations.push('JWT_SECRET environment variable is not properly configured');
        }

        if (!debugInfo.authHeader.present) {
            recommendations.push('Authorization header is missing from the request');
        } else if (!debugInfo.authHeader.startsWithBearer) {
            recommendations.push('Authorization header should start with "Bearer "');
        }

        if (debugInfo.token.format === 'invalid_jwt') {
            recommendations.push('Token is not a valid JWT format (should have 3 parts separated by dots)');
        } else if (debugInfo.token.format === 'malformed') {
            recommendations.push('Token is malformed and cannot be decoded');
        }

        if (debugInfo.token.decodedPayload?.isExpired === true) {
            recommendations.push('Token has expired - user needs to login again');
        }

        if (debugInfo.verification.attempted && !debugInfo.verification.success) {
            if (debugInfo.verification.error?.includes('signature')) {
                recommendations.push('JWT signature verification failed - check JWT_SECRET configuration');
            } else if (debugInfo.verification.error?.includes('expired')) {
                recommendations.push('Token has expired - user needs to login again');
            } else if (debugInfo.verification.error?.includes('blacklisted')) {
                recommendations.push('Token has been blacklisted/revoked - user needs to login again');
            } else {
                recommendations.push(`Token verification failed: ${debugInfo.verification.error}`);
            }
        }

        if (debugInfo.userLookup.attempted && !debugInfo.userLookup.userFound) {
            recommendations.push('User associated with token not found in database - user may have been deleted');
        }

        if (debugInfo.userLookup.error?.includes('database') || debugInfo.userLookup.error?.includes('connection')) {
            recommendations.push('Database connection issue during user lookup - check database connectivity');
        }

        if (recommendations.length === 0 && debugInfo.finalResult === 'success') {
            recommendations.push('Authentication should be working correctly - check middleware registration and route configuration');
        }

        return recommendations;
    }
}