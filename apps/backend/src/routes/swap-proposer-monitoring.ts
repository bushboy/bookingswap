import { Router, Request, Response } from 'express';
import { SwapProposerMonitoringService } from '../services/monitoring/SwapProposerMonitoringService';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/authorization';
import { logger } from '../utils/logger';

const router = Router();
const monitoringService = SwapProposerMonitoringService.getInstance();

/**
 * Get proposer lookup success/failure rates
 * Requirements: 3.4
 */
router.get('/proposer-lookup-rates', authenticateToken, requireRole(['admin', 'support']), async (req: Request, res: Response) => {
    try {
        const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000; // Default 5 minutes
        const successRates = monitoringService.getProposerLookupSuccessRates(timeWindowMs);

        logger.info('Proposer lookup success rates requested', {
            requestedBy: req.user?.id,
            timeWindowMs,
            resultCount: successRates.length,
            requirement: '3.4'
        });

        res.json({
            success: true,
            data: {
                timeWindowMs,
                successRates,
                summary: {
                    totalUsers: successRates.length,
                    averageSuccessRate: successRates.length > 0
                        ? successRates.reduce((sum, rate) => sum + rate.successRate, 0) / successRates.length
                        : 0,
                    usersWithLowSuccessRate: successRates.filter(rate => rate.successRate < 0.85).length
                }
            }
        });
    } catch (error) {
        logger.error('Failed to get proposer lookup success rates', {
            error: error instanceof Error ? error.message : error,
            requestedBy: req.user?.id,
            requirement: '3.4'
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve proposer lookup success rates'
        });
    }
});

/**
 * Get JOIN chain health statistics
 * Requirements: 3.1, 3.2
 */
router.get('/join-chain-health', authenticateToken, requireRole(['admin', 'support']), async (req: Request, res: Response) => {
    try {
        const timeWindowMs = parseInt(req.query.timeWindow as string) || 300000; // Default 5 minutes
        const healthStats = monitoringService.getJoinChainHealthStats(timeWindowMs);

        logger.info('JOIN chain health statistics requested', {
            requestedBy: req.user?.id,
            timeWindowMs,
            resultCount: healthStats.length,
            requirement: '3.1'
        });

        res.json({
            success: true,
            data: {
                timeWindowMs,
                healthStats,
                summary: {
                    totalUsers: healthStats.length,
                    averageSuccessRate: healthStats.length > 0
                        ? healthStats.reduce((sum, stat) => sum + stat.successRate, 0) / healthStats.length
                        : 0,
                    usersWithCriticalIssues: healthStats.filter(stat => stat.successRate < 0.5).length,
                    totalNullProposerNames: healthStats.reduce((sum, stat) => sum + stat.nullProposerNames, 0),
                    totalMissingRelationships: healthStats.reduce((sum, stat) => sum + stat.missingUserRelationships, 0)
                }
            }
        });
    } catch (error) {
        logger.error('Failed to get JOIN chain health statistics', {
            error: error instanceof Error ? error.message : error,
            requestedBy: req.user?.id,
            requirement: '3.2'
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve JOIN chain health statistics'
        });
    }
});

/**
 * Generate comprehensive diagnostic report
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
router.get('/diagnostic-report', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
        const report = monitoringService.generateDiagnosticReport();

        logger.info('Comprehensive diagnostic report generated', {
            requestedBy: req.user?.id,
            overallHealth: report.overallHealth.healthStatus,
            criticalIssuesCount: report.criticalIssues.length,
            requirement: '3.4'
        });

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        logger.error('Failed to generate diagnostic report', {
            error: error instanceof Error ? error.message : error,
            requestedBy: req.user?.id,
            requirement: '3.4'
        });

        res.status(500).json({
            success: false,
            error: 'Failed to generate diagnostic report'
        });
    }
});

/**
 * Get monitoring service health status
 * Requirements: 3.4
 */
router.get('/health', async (req: Request, res: Response) => {
    try {
        const report = monitoringService.generateDiagnosticReport();
        const isHealthy = report.overallHealth.healthStatus === 'healthy';

        res.status(isHealthy ? 200 : 503).json({
            success: true,
            data: {
                status: report.overallHealth.healthStatus,
                joinChainSuccessRate: report.overallHealth.joinChainSuccessRate,
                proposerLookupSuccessRate: report.overallHealth.proposerLookupSuccessRate,
                criticalIssuesCount: report.criticalIssues.length,
                timestamp: report.timestamp
            }
        });
    } catch (error) {
        logger.error('Failed to get monitoring service health status', {
            error: error instanceof Error ? error.message : error,
            requirement: '3.4'
        });

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve monitoring service health status'
        });
    }
});

/**
 * Record manual diagnostic information for missing user relationships
 * Requirements: 3.2, 3.3
 */
router.post('/record-missing-relationship', authenticateToken, requireRole(['admin', 'support']), async (req: Request, res: Response) => {
    try {
        const { swapId, proposerId, relationshipType, diagnosticDetails } = req.body;

        if (!swapId || !proposerId || !relationshipType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: swapId, proposerId, relationshipType'
            });
        }

        monitoringService.recordMissingUserRelationship(
            swapId,
            proposerId,
            relationshipType,
            diagnosticDetails || {}
        );

        logger.info('Manual missing relationship diagnostic recorded', {
            swapId,
            proposerId,
            relationshipType,
            recordedBy: req.user?.id,
            requirement: '3.2'
        });

        res.json({
            success: true,
            message: 'Missing relationship diagnostic information recorded'
        });
    } catch (error) {
        logger.error('Failed to record missing relationship diagnostic', {
            error: error instanceof Error ? error.message : error,
            requestedBy: req.user?.id,
            requirement: '3.3'
        });

        res.status(500).json({
            success: false,
            error: 'Failed to record diagnostic information'
        });
    }
});

export default router;