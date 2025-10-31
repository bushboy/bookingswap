import { AuthService, AuthTokenPayload } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { enhancedLogger } from './logger';
import jwt from 'jsonwebtoken';

export interface AuthHealthCheckResult {
    jwtConfiguration: {
        secretConfigured: boolean;
        secretLength: number;
        isDefaultSecret: boolean;
        expiresIn: string;
    };
    databaseConnection: {
        connected: boolean;
        error?: string;
    };
    services: {
        authServiceAvailable: boolean;
        userRepositoryAvailable: boolean;
    };
    timestamp: Date;
}

export interface TokenAnalysisResult {
    tokenStructure: {
        isValid: boolean;
        parts: number;
        header?: any;
        payload?: any;
        signature?: string;
    };
    claims: {
        userId?: string;
        email?: string;
        username?: string;
        walletAddress?: string;
        issuedAt?: Date;
        expiresAt?: Date;
        jwtId?: string;
    };
    validation: {
        isExpired: boolean;
        timeUntilExpiry?: number;
        signatureValid?: boolean;
        error?: string;
    };
    user: {
        exists?: boolean;
        lastActive?: Date;
        error?: string;
    };
}

export interface AuthFlowTestResult {
    success: boolean;
    steps: {
        tokenExtraction: { success: boolean; error?: string };
        tokenFormat: { success: boolean; error?: string };
        tokenVerification: { success: boolean; error?: string };
        userLookup: { success: boolean; error?: string };
    };
    user?: any;
    error?: string;
}

export interface DiagnosticReport {
    healthCheck: AuthHealthCheckResult;
    tokenAnalysis?: TokenAnalysisResult;
    flowTest?: AuthFlowTestResult;
    recommendations: string[];
}

/**
 * Authentication Debug Utilities
 * Provides comprehensive debugging tools for authentication issues
 */
export class AuthDebugUtils {
    constructor(
        private authService: AuthService,
        private userRepository: UserRepository
    ) { }

    /**
     * Perform comprehensive authentication health check
     */
    async performHealthCheck(): Promise<AuthHealthCheckResult> {
        const result: AuthHealthCheckResult = {
            jwtConfiguration: {
                secretConfigured: false,
                secretLength: 0,
                isDefaultSecret: false,
                expiresIn: '',
            },
            databaseConnection: {
                connected: false,
            },
            services: {
                authServiceAvailable: !!this.authService,
                userRepositoryAvailable: !!this.userRepository,
            },
            timestamp: new Date(),
        };

        try {
            // Check JWT configuration
            if (this.authService) {
                const jwtDebugInfo = this.authService.getJwtDebugInfo();
                result.jwtConfiguration = jwtDebugInfo;
            }

            // Test database connection
            try {
                // Try a simple database operation
                await this.userRepository.findById('test-connection-check');
                result.databaseConnection.connected = true;
            } catch (error) {
                result.databaseConnection.connected = false;
                result.databaseConnection.error = error instanceof Error ? error.message : 'Unknown database error';
            }

            enhancedLogger.info('Authentication health check completed', {
                category: 'authentication_debug',
                result,
            });

            return result;
        } catch (error) {
            enhancedLogger.error('Authentication health check failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            result.databaseConnection.error = error instanceof Error ? error.message : 'Health check failed';
            return result;
        }
    }

    /**
     * Decode JWT token without verification for analysis
     */
    decodeTokenWithoutVerification(token: string): {
        header?: any;
        payload?: any;
        signature?: string;
        error?: string;
    } {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) {
                return { error: `Invalid JWT structure: expected 3 parts, got ${parts.length}` };
            }

            const [headerPart, payloadPart, signaturePart] = parts;

            let header, payload;
            try {
                if (!headerPart) {
                    return { error: 'Missing JWT header part' };
                }
                header = JSON.parse(Buffer.from(headerPart, 'base64url').toString());
            } catch (error) {
                return { error: 'Could not decode JWT header' };
            }

            try {
                if (!payloadPart) {
                    return { error: 'Missing JWT payload part' };
                }
                payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString());
            } catch (error) {
                return { error: 'Could not decode JWT payload' };
            }

            return {
                header,
                payload,
                signature: signaturePart,
            };
        } catch (error) {
            return { error: error instanceof Error ? error.message : 'Token decode failed' };
        }
    }

    /**
     * Analyze a JWT token without verification
     */
    analyzeToken(token: string): TokenAnalysisResult {
        const result: TokenAnalysisResult = {
            tokenStructure: {
                isValid: false,
                parts: 0,
            },
            claims: {},
            validation: {
                isExpired: false,
            },
            user: {},
        };

        try {
            // Decode token structure
            const decoded = this.decodeTokenWithoutVerification(token);

            if (decoded.error) {
                result.validation.error = decoded.error;
                return result;
            }

            // Check token structure
            const parts = token.split('.');
            result.tokenStructure.parts = parts.length;
            result.tokenStructure.isValid = parts.length === 3;
            result.tokenStructure.header = decoded.header;
            result.tokenStructure.payload = decoded.payload;
            result.tokenStructure.signature = decoded.signature;

            // Extract claims from payload
            if (decoded.payload) {
                result.claims = {
                    userId: decoded.payload.userId,
                    email: decoded.payload.email,
                    username: decoded.payload.username,
                    walletAddress: decoded.payload.walletAddress,
                    issuedAt: decoded.payload.iat ? new Date(decoded.payload.iat * 1000) : undefined,
                    expiresAt: decoded.payload.exp ? new Date(decoded.payload.exp * 1000) : undefined,
                    jwtId: decoded.payload.jti,
                };

                // Check expiration
                if (decoded.payload.exp) {
                    const now = Date.now();
                    const expiry = decoded.payload.exp * 1000;
                    result.validation.isExpired = now >= expiry;
                    result.validation.timeUntilExpiry = expiry - now;
                }
            }

            enhancedLogger.debug('Token analysis completed', {
                category: 'authentication_debug',
                tokenLength: token.length,
                structure: result.tokenStructure,
                claims: result.claims,
            });

            return result;
        } catch (error) {
            result.validation.error = error instanceof Error ? error.message : 'Token analysis failed';

            enhancedLogger.error('Token analysis failed', {
                category: 'authentication_debug',
                error: result.validation.error,
            });

            return result;
        }
    }

    /**
     * Validate token with comprehensive debugging
     */
    async validateTokenWithDebug(token: string): Promise<TokenAnalysisResult> {
        const result = this.analyzeToken(token);

        try {
            // Try to verify the token
            if (this.authService) {
                const debugResult = await this.authService.debugVerifyToken(token);
                result.validation.signatureValid = debugResult.isValid;

                if (!debugResult.isValid) {
                    result.validation.error = debugResult.error;
                }

                // Check if user exists
                if (debugResult.payload?.userId) {
                    try {
                        const user = await this.userRepository.findById(debugResult.payload.userId);
                        result.user.exists = !!user;
                        if (user) {
                            result.user.lastActive = user.lastActiveAt;
                        }
                    } catch (error) {
                        result.user.exists = false;
                        result.user.error = error instanceof Error ? error.message : 'User lookup failed';
                    }
                }
            }

            enhancedLogger.info('Token validation with debug completed', {
                category: 'authentication_debug',
                userId: result.claims.userId,
                isValid: result.validation.signatureValid,
                userExists: result.user.exists,
            });

            return result;
        } catch (error) {
            result.validation.error = error instanceof Error ? error.message : 'Token validation failed';

            enhancedLogger.error('Token validation with debug failed', {
                category: 'authentication_debug',
                error: result.validation.error,
            });

            return result;
        }
    }

    /**
     * Test authentication flow with a specific token
     */
    async testAuthenticationFlow(token: string): Promise<AuthFlowTestResult> {
        const result: AuthFlowTestResult = {
            success: false,
            steps: {
                tokenExtraction: { success: false },
                tokenFormat: { success: false },
                tokenVerification: { success: false },
                userLookup: { success: false },
            },
        };

        try {
            // Step 1: Token extraction (simulated)
            if (token && token.length > 0) {
                result.steps.tokenExtraction.success = true;
            } else {
                result.steps.tokenExtraction.error = 'Token is empty or missing';
                return result;
            }

            // Step 2: Token format validation
            const parts = token.split('.');
            if (parts.length === 3) {
                result.steps.tokenFormat.success = true;
            } else {
                result.steps.tokenFormat.error = `Invalid JWT format: expected 3 parts, got ${parts.length}`;
                return result;
            }

            // Step 3: Token verification
            try {
                const payload = await this.authService.verifyToken(token);
                result.steps.tokenVerification.success = true;

                // Step 4: User lookup
                try {
                    const user = await this.userRepository.findById(payload.userId);
                    if (user) {
                        result.steps.userLookup.success = true;
                        result.user = {
                            id: user.id,
                            email: user.email,
                            username: user.username,
                            walletAddress: user.walletAddress,
                            lastActive: user.lastActiveAt,
                        };
                        result.success = true;
                    } else {
                        result.steps.userLookup.error = 'User not found in database';
                    }
                } catch (error) {
                    result.steps.userLookup.error = error instanceof Error ? error.message : 'User lookup failed';
                }
            } catch (error) {
                result.steps.tokenVerification.error = error instanceof Error ? error.message : 'Token verification failed';
            }

            enhancedLogger.info('Authentication flow test completed', {
                category: 'authentication_debug',
                success: result.success,
                steps: result.steps,
                userId: result.user?.id,
            });

            return result;
        } catch (error) {
            result.error = error instanceof Error ? error.message : 'Authentication flow test failed';

            enhancedLogger.error('Authentication flow test failed', {
                category: 'authentication_debug',
                error: result.error,
            });

            return result;
        }
    }

    /**
     * Verify user session and token relationship
     */
    async verifyUserSession(userId: string, token?: string): Promise<{
        user: {
            exists: boolean;
            id?: string;
            email?: string;
            username?: string;
            walletAddress?: string;
            lastActive?: Date;
            isActive?: boolean;
        };
        token?: {
            isValid: boolean;
            belongsToUser: boolean;
            error?: string;
        };
        relationship: {
            valid: boolean;
            issues: string[];
        };
    }> {
        const result: {
            user: {
                exists: boolean;
                id?: string;
                email?: string;
                username?: string;
                walletAddress?: string;
                lastActive?: Date;
                isActive?: boolean;
            };
            token?: {
                isValid: boolean;
                belongsToUser: boolean;
                error?: string;
            };
            relationship: {
                valid: boolean;
                issues: string[];
            };
        } = {
            user: {
                exists: false,
            },
            token: undefined,
            relationship: {
                valid: false,
                issues: [],
            },
        };

        try {
            // Check if user exists
            const user = await this.userRepository.findById(userId);
            if (user) {
                result.user = {
                    exists: true,
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    walletAddress: user.walletAddress,
                    lastActive: user.lastActiveAt,
                    isActive: user.lastActiveAt ? (Date.now() - user.lastActiveAt.getTime()) < 30 * 24 * 60 * 60 * 1000 : false, // Active within 30 days
                };
            } else {
                result.relationship.issues.push('User not found in database');
            }

            // If token provided, verify it belongs to the user
            if (token) {
                try {
                    const tokenValidation = await this.authService.debugVerifyToken(token);
                    result.token = {
                        isValid: tokenValidation.isValid,
                        belongsToUser: tokenValidation.payload?.userId === userId,
                        error: tokenValidation.error,
                    };

                    if (!tokenValidation.isValid) {
                        result.relationship.issues.push(`Token validation failed: ${tokenValidation.error}`);
                    } else if (tokenValidation.payload?.userId !== userId) {
                        result.relationship.issues.push('Token belongs to different user');
                    }
                } catch (error) {
                    result.token = {
                        isValid: false,
                        belongsToUser: false,
                        error: error instanceof Error ? error.message : 'Token verification failed',
                    };
                    result.relationship.issues.push(`Token verification error: ${result.token.error}`);
                }
            }

            // Determine overall relationship validity
            result.relationship.valid = result.user.exists &&
                (token ? Boolean(result.token?.isValid && result.token?.belongsToUser) : true);

            enhancedLogger.info('User session verification completed', {
                category: 'authentication_debug',
                userId,
                userExists: result.user.exists,
                tokenProvided: !!token,
                tokenValid: result.token?.isValid,
                relationshipValid: result.relationship.valid,
                issuesCount: result.relationship.issues.length,
            });

            return result;
        } catch (error) {
            result.relationship.issues.push(error instanceof Error ? error.message : 'Session verification failed');

            enhancedLogger.error('User session verification failed', {
                category: 'authentication_debug',
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return result;
        }
    }

    /**
     * Generate authentication diagnostic report
     */
    async generateDiagnosticReport(token?: string): Promise<DiagnosticReport> {
        const report: DiagnosticReport = {
            healthCheck: await this.performHealthCheck(),
            recommendations: [],
        };

        // Add token analysis if token provided
        if (token) {
            report.tokenAnalysis = await this.validateTokenWithDebug(token);
            report.flowTest = await this.testAuthenticationFlow(token);
        }

        // Generate recommendations based on findings
        if (!report.healthCheck.jwtConfiguration.secretConfigured) {
            report.recommendations.push('JWT secret is not configured. Set JWT_SECRET environment variable.');
        }

        if (report.healthCheck.jwtConfiguration.isDefaultSecret) {
            report.recommendations.push('Using default JWT secret. Change to a secure secret for production.');
        }

        if (!report.healthCheck.databaseConnection.connected) {
            report.recommendations.push('Database connection failed. Check database configuration and connectivity.');
        }

        if (report.tokenAnalysis?.validation.isExpired) {
            report.recommendations.push('Token has expired. User needs to re-authenticate.');
        }

        if (report.tokenAnalysis?.user.exists === false) {
            report.recommendations.push('User associated with token not found. Token may be invalid or user deleted.');
        }

        enhancedLogger.info('Authentication diagnostic report generated', {
            category: 'authentication_debug',
            hasToken: !!token,
            recommendationsCount: report.recommendations.length,
        });

        return report;
    }
}

/**
 * Create a singleton instance for easy access
 */
let authDebugUtils: AuthDebugUtils | null = null;

export const initializeAuthDebugUtils = (authService: AuthService, userRepository: UserRepository) => {
    authDebugUtils = new AuthDebugUtils(authService, userRepository);
};

export const getAuthDebugUtils = (): AuthDebugUtils => {
    if (!authDebugUtils) {
        throw new Error('AuthDebugUtils not initialized. Call initializeAuthDebugUtils first.');
    }
    return authDebugUtils;
};