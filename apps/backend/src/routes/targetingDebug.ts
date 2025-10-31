import { Router } from 'express';
import { Pool } from 'pg';
import { TargetingDebugController } from '../controllers/TargetingDebugController';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { SwapProposalService } from '../services/swap/SwapProposalService';
import { AuthMiddleware } from '../middleware/auth';
import { AuthService } from '../services/auth/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { TargetingProductionLogger } from '../utils/targetingProductionLogger';
import { logger } from '../utils/logger';

/**
 * Debug routes for targeting data inspection and troubleshooting
 * These routes provide comprehensive debugging capabilities for the targeting system
 */
export function createTargetingDebugRoutes(
    pool: Pool,
    swapTargetingRepository: SwapTargetingRepository,
    swapRepository: SwapRepository,
    swapProposalService: SwapProposalService,
    authService: AuthService,
    userRepository: UserRepository
): Router {
    const router = Router();
    const authMiddleware = new AuthMiddleware(authService, userRepository);

    const targetingDebugController = new TargetingDebugController(
        pool,
        swapTargetingRepository,
        swapRepository,
        swapProposalService
    );

    // Only enable debug routes in non-production environments
    if (process.env.NODE_ENV === 'production') {
        router.use((req, res) => {
            res.status(404).json({ error: 'Targeting debug routes not available in production' });
        });
        return router;
    }

    // Apply authentication middleware to all targeting debug routes
    router.use(authMiddleware.authenticate);

    /**
     * GET /debug/targeting/health
     * Check overall health of targeting system
     */
    router.get('/health', targetingDebugController.checkTargetingHealth);

    /**
     * GET /debug/targeting/snapshot/:userId
     * Create a comprehensive snapshot of targeting data for debugging
     */
    router.get('/snapshot/:userId', targetingDebugController.createTargetingSnapshot);

    /**
     * GET /debug/targeting/consistency-report
     * Generate a comprehensive data consistency report (admin only)
     */
    router.get('/consistency-report', targetingDebugController.generateConsistencyReport);

    /**
     * GET /debug/targeting/compare-display/:userId
     * Compare swap_targets table data with displayed results
     */
    router.get('/compare-display/:userId', targetingDebugController.compareTableWithDisplay);

    /**
     * POST /debug/targeting/log-transformation/:userId
     * Log detailed transformation steps for debugging
     */
    router.post('/log-transformation/:userId', targetingDebugController.logTransformationSteps);

    /**
     * GET /debug/targeting/service-data/:userId
     * Get targeting data as processed by SwapProposalService for comparison
     */
    router.get('/service-data/:userId', targetingDebugController.getServiceProcessedData);

    /**
     * POST /debug/targeting/enable-logging
     * Enable production-safe targeting debug logging
     */
    router.post('/enable-logging', (req, res) => {
        try {
            TargetingProductionLogger.enableLogging();

            logger.info('Targeting debug logging enabled via API', {
                requestingUserId: req.user?.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Targeting debug logging enabled',
                config: TargetingProductionLogger.getLoggingConfig(),
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            logger.error('Failed to enable targeting debug logging', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to enable targeting debug logging',
                details: error.message
            });
        }
    });

    /**
     * POST /debug/targeting/disable-logging
     * Disable production-safe targeting debug logging
     */
    router.post('/disable-logging', (req, res) => {
        try {
            TargetingProductionLogger.disableLogging();

            logger.info('Targeting debug logging disabled via API', {
                requestingUserId: req.user?.id,
                timestamp: new Date().toISOString()
            });

            res.json({
                success: true,
                message: 'Targeting debug logging disabled',
                config: TargetingProductionLogger.getLoggingConfig(),
                timestamp: new Date().toISOString()
            });
        } catch (error: any) {
            logger.error('Failed to disable targeting debug logging', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to disable targeting debug logging',
                details: error.message
            });
        }
    });

    /**
     * GET /debug/targeting/logging-config
     * Get current targeting debug logging configuration
     */
    router.get('/logging-config', (req, res) => {
        try {
            const config = TargetingProductionLogger.getLoggingConfig();

            res.json({
                success: true,
                config,
                timestamp: new Date().toISOString(),
                instructions: {
                    enableLogging: 'POST /debug/targeting/enable-logging',
                    disableLogging: 'POST /debug/targeting/disable-logging',
                    environmentVariable: 'Set TARGETING_DEBUG_LOGGING=true to enable logging'
                }
            });
        } catch (error: any) {
            logger.error('Failed to get targeting debug logging config', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Failed to get logging configuration',
                details: error.message
            });
        }
    });

    /**
     * GET /debug/targeting/endpoints
     * List all available targeting debug endpoints
     */
    router.get('/endpoints', (req, res) => {
        const endpoints = [
            {
                method: 'GET',
                path: '/debug/targeting/health',
                description: 'Check overall health of targeting system',
                auth: 'required'
            },
            {
                method: 'GET',
                path: '/debug/targeting/snapshot/:userId',
                description: 'Create comprehensive targeting data snapshot',
                auth: 'required (own data or admin)'
            },
            {
                method: 'GET',
                path: '/debug/targeting/consistency-report',
                description: 'Generate system-wide data consistency report',
                auth: 'admin only'
            },
            {
                method: 'GET',
                path: '/debug/targeting/compare-display/:userId',
                description: 'Compare database data with display results',
                auth: 'required (own data or admin)'
            },
            {
                method: 'POST',
                path: '/debug/targeting/log-transformation/:userId',
                description: 'Log detailed transformation steps to console',
                auth: 'required (own data or admin)'
            },
            {
                method: 'GET',
                path: '/debug/targeting/service-data/:userId',
                description: 'Get data as processed by SwapProposalService',
                auth: 'required (own data or admin)'
            },
            {
                method: 'POST',
                path: '/debug/targeting/enable-logging',
                description: 'Enable production-safe debug logging',
                auth: 'required'
            },
            {
                method: 'POST',
                path: '/debug/targeting/disable-logging',
                description: 'Disable production-safe debug logging',
                auth: 'required'
            },
            {
                method: 'GET',
                path: '/debug/targeting/logging-config',
                description: 'Get current logging configuration',
                auth: 'required'
            }
        ];

        res.json({
            success: true,
            endpoints,
            totalEndpoints: endpoints.length,
            environment: process.env.NODE_ENV || 'unknown',
            available: process.env.NODE_ENV !== 'production',
            timestamp: new Date().toISOString()
        });
    });

    return router;
}