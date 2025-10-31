import { Request, Response } from 'express';
import { TargetingDebugUtils } from '../utils/targetingDebugUtils';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { SwapProposalService } from '../services/swap/SwapProposalService';
import { logger } from '../utils/logger';
import { Pool } from 'pg';

export class TargetingDebugController {
    private debugUtils: TargetingDebugUtils;

    constructor(
        private pool: Pool,
        private swapTargetingRepository: SwapTargetingRepository,
        private swapRepository: SwapRepository,
        private swapProposalService: SwapProposalService
    ) {
        this.debugUtils = new TargetingDebugUtils(
            pool,
            swapTargetingRepository,
            swapRepository
        );
    }

    /**
     * GET /debug/targeting/snapshot/:userId
     * Create a comprehensive snapshot of targeting data for debugging
     */
    createTargetingSnapshot = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            const { userId } = req.params;
            const requestingUserId = req.user?.id;

            // Authorization: users can only debug their own data unless they're admin
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (userId !== requestingUserId && !isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied: can only debug your own targeting data'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
                return;
            }

            logger.info('Creating targeting data snapshot for debug', {
                requestId,
                userId,
                requestingUserId,
                isAdmin
            });

            const snapshot = await this.debugUtils.createTargetingDataSnapshot(userId);
            const executionTime = Date.now() - startTime;

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                data: {
                    snapshot,
                    summary: {
                        userId,
                        incomingTargetsCount: snapshot.transformedData.incomingTargets.length,
                        outgoingTargetsCount: snapshot.transformedData.outgoingTargets.length,
                        dataIntegrity: snapshot.validationResults.dataIntegrity,
                        hasInconsistencies: snapshot.validationResults.inconsistencies.length > 0,
                        performanceCategory: executionTime <= 1000 ? 'good' :
                            executionTime <= 2000 ? 'acceptable' : 'poor'
                    }
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to create targeting snapshot', {
                error: error.message,
                requestId,
                userId: req.params.userId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to create targeting data snapshot',
                details: error.message
            });
        }
    };

    /**
     * GET /debug/targeting/consistency-report
     * Generate a comprehensive data consistency report
     */
    generateConsistencyReport = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-consistency-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            // Only allow admin users for system-wide consistency reports
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (!isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied: admin privileges required for consistency reports'
                });
                return;
            }

            logger.info('Generating data consistency report', {
                requestId,
                requestingUserId: req.user?.id
            });

            const report = await this.debugUtils.generateDataConsistencyReport();
            const executionTime = Date.now() - startTime;

            const hasIssues = report.orphanedTargets.length > 0 ||
                report.missingBookings.length > 0 ||
                report.inconsistentStatuses.length > 0 ||
                report.duplicateTargets.length > 0;

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                data: {
                    report,
                    summary: {
                        totalRecords: report.swapTargetsCount + report.swapsCount + report.bookingsCount,
                        hasDataIssues: hasIssues,
                        issueCount: report.orphanedTargets.length +
                            report.missingBookings.length +
                            report.inconsistentStatuses.length +
                            report.duplicateTargets.length,
                        healthStatus: hasIssues ? 'issues_detected' : 'healthy'
                    }
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to generate consistency report', {
                error: error.message,
                requestId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to generate consistency report',
                details: error.message
            });
        }
    };

    /**
     * GET /debug/targeting/compare-display/:userId
     * Compare swap_targets table data with displayed results
     */
    compareTableWithDisplay = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-compare-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            const { userId } = req.params;
            const requestingUserId = req.user?.id;

            // Authorization: users can only debug their own data unless they're admin
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (userId !== requestingUserId && !isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied: can only debug your own targeting data'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
                return;
            }

            logger.info('Comparing table data with display data', {
                requestId,
                userId,
                requestingUserId
            });

            const comparison = await this.debugUtils.compareTableDataWithDisplay(userId);
            const executionTime = Date.now() - startTime;

            const hasDiscrepancies = comparison.missingFromDisplay.length > 0 ||
                comparison.extraInDisplay.length > 0 ||
                comparison.differences.length > 0;

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                data: {
                    comparison,
                    summary: {
                        userId,
                        tableDataCount: comparison.tableData.length,
                        displayDataCount: comparison.displayData.length,
                        missingFromDisplayCount: comparison.missingFromDisplay.length,
                        extraInDisplayCount: comparison.extraInDisplay.length,
                        differencesCount: comparison.differences.length,
                        hasDiscrepancies,
                        dataConsistency: hasDiscrepancies ? 'inconsistent' : 'consistent'
                    }
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to compare table with display data', {
                error: error.message,
                requestId,
                userId: req.params.userId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to compare table with display data',
                details: error.message
            });
        }
    };

    /**
     * POST /debug/targeting/log-transformation/:userId
     * Log detailed transformation steps for debugging
     */
    logTransformationSteps = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-transform-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            const { userId } = req.params;
            const requestingUserId = req.user?.id;

            // Authorization: users can only debug their own data unless they're admin
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (userId !== requestingUserId && !isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied: can only debug your own targeting data'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
                return;
            }

            logger.info('Logging transformation steps for debug', {
                requestId,
                userId,
                requestingUserId
            });

            // This will log detailed steps to the console/log files
            await this.debugUtils.logTransformationSteps(userId);
            const executionTime = Date.now() - startTime;

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                message: 'Transformation steps logged successfully. Check application logs for detailed output.',
                data: {
                    userId,
                    loggedToConsole: true,
                    checkLogs: 'Look for log entries with category "targeting_transformation_debug"'
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to log transformation steps', {
                error: error.message,
                requestId,
                userId: req.params.userId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to log transformation steps',
                details: error.message
            });
        }
    };

    /**
     * GET /debug/targeting/service-data/:userId
     * Get targeting data as processed by SwapProposalService for comparison
     */
    getServiceProcessedData = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-service-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            const { userId } = req.params;
            const requestingUserId = req.user?.id;

            // Authorization: users can only debug their own data unless they're admin
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (userId !== requestingUserId && !isAdmin) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied: can only debug your own targeting data'
                });
                return;
            }

            if (!userId) {
                res.status(400).json({
                    success: false,
                    error: 'User ID is required'
                });
                return;
            }

            logger.info('Getting service-processed targeting data', {
                requestId,
                userId,
                requestingUserId
            });

            // Get data as processed by the service layer
            const serviceData = await this.swapProposalService.getUserSwapsWithTargeting(userId);
            const executionTime = Date.now() - startTime;

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                data: {
                    serviceProcessedData: serviceData,
                    summary: {
                        userId,
                        swapCardsCount: serviceData.length,
                        swapsWithTargeting: serviceData.filter(card =>
                            (card as any).targeting &&
                            ((card as any).targeting.incomingCount > 0 || (card as any).targeting.outgoingTarget)
                        ).length,
                        totalIncomingTargets: serviceData.reduce((sum, card) =>
                            sum + ((card as any).targeting?.incomingCount || 0), 0
                        ),
                        swapsWithOutgoingTargets: serviceData.filter(card =>
                            (card as any).targeting?.outgoingTarget
                        ).length
                    }
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to get service-processed data', {
                error: error.message,
                requestId,
                userId: req.params.userId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to get service-processed targeting data',
                details: error.message
            });
        }
    };

    /**
     * GET /debug/targeting/health
     * Check overall health of targeting system
     */
    checkTargetingHealth = async (req: Request, res: Response): Promise<void> => {
        const requestId = `debug-health-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            // Only allow in non-production environments
            if (process.env.NODE_ENV === 'production') {
                res.status(404).json({ error: 'Debug endpoints not available in production' });
                return;
            }

            logger.info('Checking targeting system health', { requestId });

            // Perform basic health checks
            const healthChecks = {
                databaseConnection: false,
                swapTargetsTable: false,
                swapsTable: false,
                bookingsTable: false,
                repositoryMethods: false
            };

            try {
                // Test database connection
                await this.pool.query('SELECT 1');
                healthChecks.databaseConnection = true;

                // Test table access
                await this.pool.query('SELECT COUNT(*) FROM swap_targets LIMIT 1');
                healthChecks.swapTargetsTable = true;

                await this.pool.query('SELECT COUNT(*) FROM swaps LIMIT 1');
                healthChecks.swapsTable = true;

                await this.pool.query('SELECT COUNT(*) FROM bookings LIMIT 1');
                healthChecks.bookingsTable = true;

                // Test repository method
                const testData = await this.swapTargetingRepository.getTargetingDataForUserSwaps('test-user-id');
                healthChecks.repositoryMethods = true;
            } catch (error) {
                logger.warn('Some health checks failed', { error });
            }

            const executionTime = Date.now() - startTime;
            const allHealthy = Object.values(healthChecks).every(check => check);

            res.json({
                success: true,
                requestId,
                executionTime,
                timestamp: new Date().toISOString(),
                data: {
                    healthStatus: allHealthy ? 'healthy' : 'issues_detected',
                    checks: healthChecks,
                    environment: process.env.NODE_ENV || 'unknown',
                    debugEndpointsEnabled: process.env.NODE_ENV !== 'production'
                }
            });

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            logger.error('Failed to check targeting health', {
                error: error.message,
                requestId,
                executionTime,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                requestId,
                executionTime,
                error: 'Failed to check targeting system health',
                details: error.message
            });
        }
    };
}