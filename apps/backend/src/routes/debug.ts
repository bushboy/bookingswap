import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { AuthDebugUtils } from '../utils/authDebug';
import { AuthMiddleware } from '../middleware/auth';
import { enhancedLogger } from '../utils/logger';
import { ImmediateAuthDebugger } from '../debug/immediate-auth-debug';

/**
 * Debug routes for authentication troubleshooting
 * These routes should only be available in development/staging environments
 */
export function createDebugRoutes(
    authService: AuthService,
    userRepository: UserRepository
): Router {
    const router = Router();
    const debugUtils = new AuthDebugUtils(authService, userRepository);
    const authMiddleware = new AuthMiddleware(authService, userRepository);
    const immediateDebugger = new ImmediateAuthDebugger(authService, userRepository, authMiddleware);

    // Only enable debug routes in non-production environments
    if (process.env.NODE_ENV === 'production') {
        router.use((req, res) => {
            res.status(404).json({ error: 'Debug routes not available in production' });
        });
        return router;
    }

    /**
     * GET /debug/auth/health
     * Perform authentication system health check
     */
    router.get('/auth/health', async (req: Request, res: Response): Promise<void> => {
        try {
            const healthCheck = await debugUtils.performHealthCheck();

            enhancedLogger.info('Authentication health check requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/health',
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                healthCheck,
            });
        } catch (error) {
            enhancedLogger.error('Authentication health check failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Health check failed',
            });
        }
    });

    /**
     * POST /debug/auth/decode-token
     * Decode a JWT token without verification for structure analysis
     */
    router.post('/auth/decode-token', async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.body;

            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'Token is required in request body',
                });
                return;
            }

            const decoded = debugUtils.decodeTokenWithoutVerification(token);

            enhancedLogger.info('Token decode requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/decode-token',
                tokenLength: token.length,
                hasError: !!decoded.error,
                ip: req.ip,
            });

            res.json({
                success: !decoded.error,
                timestamp: new Date().toISOString(),
                decoded,
            });
        } catch (error) {
            enhancedLogger.error('Token decode failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Token decode failed',
            });
        }
    });

    /**
     * POST /debug/auth/analyze-token
     * Analyze a JWT token without verification
     */
    router.post('/auth/analyze-token', async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.body;

            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'Token is required in request body',
                });
                return;
            }

            const analysis = await debugUtils.validateTokenWithDebug(token);

            enhancedLogger.info('Token analysis requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/analyze-token',
                tokenLength: token.length,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                analysis,
            });
        } catch (error) {
            enhancedLogger.error('Token analysis failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Token analysis failed',
            });
        }
    });

    /**
     * POST /debug/auth/test-flow
     * Test the complete authentication flow with a token
     */
    router.post('/auth/test-flow', async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.body;

            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'Token is required in request body',
                });
                return;
            }

            const flowTest = await debugUtils.testAuthenticationFlow(token);

            enhancedLogger.info('Authentication flow test requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/test-flow',
                success: flowTest.success,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                flowTest,
            });
        } catch (error) {
            enhancedLogger.error('Authentication flow test failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Authentication flow test failed',
            });
        }
    });

    /**
     * GET /debug/auth/current-user
     * Test authentication with the current request's token
     */
    router.get('/auth/current-user', async (req: Request, res: Response): Promise<void> => {
        try {
            const authHeader = req.headers.authorization;

            // Perform debug analysis of the current request
            const debugInfo = authMiddleware.debugAuthentication(req);

            let tokenAnalysis;
            let flowTest;

            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                tokenAnalysis = await debugUtils.validateTokenWithDebug(token);
                flowTest = await debugUtils.testAuthenticationFlow(token);
            }

            enhancedLogger.info('Current user debug requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/current-user',
                hasAuthHeader: !!authHeader,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                request: {
                    hasAuthHeader: !!authHeader,
                    authHeaderFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Invalid') : 'None',
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                },
                debugInfo,
                tokenAnalysis,
                flowTest,
            });
        } catch (error) {
            enhancedLogger.error('Current user debug failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Current user debug failed',
            });
        }
    });

    /**
     * POST /debug/auth/verify-session
     * Verify user session and token relationship
     */
    router.post('/auth/verify-session', async (req: Request, res: Response): Promise<void> => {
        try {
            const { userId, token } = req.body;

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required in request body',
                });
                return;
            }

            const sessionVerification = await debugUtils.verifyUserSession(userId, token);

            enhancedLogger.info('User session verification requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/verify-session',
                userId,
                hasToken: !!token,
                valid: sessionVerification.relationship.valid,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                sessionVerification,
            });
        } catch (error) {
            enhancedLogger.error('User session verification failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Session verification failed',
            });
        }
    });

    /**
     * POST /debug/auth/diagnostic-report
     * Generate comprehensive diagnostic report
     */
    router.post('/auth/diagnostic-report', async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.body;

            const report = await debugUtils.generateDiagnosticReport(token);

            enhancedLogger.info('Diagnostic report requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/diagnostic-report',
                hasToken: !!token,
                recommendationsCount: report.recommendations.length,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                report,
            });
        } catch (error) {
            enhancedLogger.error('Diagnostic report generation failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Diagnostic report generation failed',
            });
        }
    });

    /**
     * POST /debug/auth/immediate-analyze
     * Immediate comprehensive token analysis for 401 debugging
     */
    router.post('/auth/immediate-analyze', async (req: Request, res: Response): Promise<void> => {
        try {
            const { token } = req.body;

            if (!token) {
                res.status(400).json({
                    success: false,
                    error: 'Token is required in request body',
                    example: { token: 'Bearer eyJ...' }
                });
                return;
            }

            const debugInfo = await immediateDebugger.debugTokenAuthentication(token);

            enhancedLogger.info('Immediate token analysis requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/immediate-analyze',
                tokenLength: token.length,
                finalResult: debugInfo.finalResult,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                debugInfo,
                recommendations: immediateDebugger['generateRecommendations'](debugInfo),
            });
        } catch (error) {
            enhancedLogger.error('Immediate token analysis failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Immediate analysis failed',
            });
        }
    });

    /**
     * POST /debug/auth/immediate-flow-test
     * Test complete authentication flow with immediate debugging
     */
    router.post('/auth/immediate-flow-test', async (req: Request, res: Response): Promise<void> => {
        try {
            const { authHeader } = req.body;

            if (!authHeader) {
                res.status(400).json({
                    success: false,
                    error: 'authHeader is required in request body',
                    example: { authHeader: 'Bearer eyJ...' }
                });
                return;
            }

            const result = await immediateDebugger.testAuthenticationFlow(authHeader);

            enhancedLogger.info('Immediate flow test requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/immediate-flow-test',
                debugResult: result.debugInfo.finalResult,
                middlewareResult: result.middlewareResult,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                ...result,
                recommendations: immediateDebugger['generateRecommendations'](result.debugInfo),
            });
        } catch (error) {
            enhancedLogger.error('Immediate flow test failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Immediate flow test failed',
            });
        }
    });

    /**
     * GET /debug/auth/immediate-state
     * Check current request authentication state with immediate debugging
     */
    router.get('/auth/immediate-state', authMiddleware.optionalAuth(), (req: Request, res: Response) => {
        try {
            const authHeader = req.headers.authorization;

            enhancedLogger.info('Immediate state check requested', {
                category: 'authentication_debug',
                endpoint: '/debug/auth/immediate-state',
                hasAuthHeader: !!authHeader,
                userAttached: !!req.user,
                ip: req.ip,
            });

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                currentState: {
                    hasAuthHeader: !!authHeader,
                    authHeaderFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'Invalid') : 'None',
                    authHeaderLength: authHeader ? authHeader.length : 0,
                    userAttached: !!req.user,
                    tokenPayloadAttached: !!req.tokenPayload,
                    userId: req.user?.id,
                    userEmail: req.user?.email,
                    userWallet: req.user?.walletAddress,
                    tokenUserId: req.tokenPayload?.userId,
                    tokenExp: req.tokenPayload?.exp ? new Date(req.tokenPayload.exp * 1000).toISOString() : undefined,
                    tokenIsExpired: req.tokenPayload?.exp ? req.tokenPayload.exp < Date.now() / 1000 : undefined,
                },
                jwtConfig: {
                    secretConfigured: authMiddleware.validateJwtSecret(),
                    secretLength: process.env.JWT_SECRET?.length || 0,
                },
                middlewareDebug: authMiddleware.debugAuthentication(req),
            });
        } catch (error) {
            enhancedLogger.error('Immediate state check failed', {
                category: 'authentication_debug',
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Immediate state check failed',
            });
        }
    });

    return router;
}