import { Request, Response } from 'express';
import { SwapCompletionOrchestrator } from '../services/swap/SwapCompletionOrchestrator';
import { SwapCompletionMonitoringService } from '../services/monitoring/SwapCompletionMonitoringService';
import { CompletionErrorLoggingService } from '../services/logging/CompletionErrorLoggingService';
import { CompletionAlertingService } from '../services/alerting/CompletionAlertingService';
import { CompletionPerformanceMonitoringService } from '../services/monitoring/CompletionPerformanceMonitoringService';
import { SwapCompletionErrorCodes } from '../utils/SwapCompletionError';
import { enhancedLogger } from '../utils/logger';
import { Pool } from 'pg';
import { HederaService } from '../services/hedera/HederaService';
import { NotificationService } from '../services/notification/NotificationService';

/**
 * Controller for completion monitoring, error handling, and performance tracking
 * Requirements: 4.1, 4.3, 4.5
 */
export class CompletionMonitoringController {
    private orchestrator: SwapCompletionOrchestrator;
    private monitoringService: SwapCompletionMonitoringService;
    private errorLoggingService: CompletionErrorLoggingService;
    private alertingService: CompletionAlertingService;
    private performanceService: CompletionPerformanceMonitoringService;

    constructor(
        pool: Pool,
        hederaService: HederaService,
        notificationService: NotificationService
    ) {
        this.orchestrator = new SwapCompletionOrchestrator(pool, hederaService, notificationService);
        this.monitoringService = SwapCompletionMonitoringService.getInstance();
        this.errorLoggingService = CompletionErrorLoggingService.getInstance();
        this.alertingService = CompletionAlertingService.getInstance();
        this.performanceService = CompletionPerformanceMonitoringService.getInstance();
    }

    /**
     * Get completion metrics
     */
    getMetrics = async (req: Request, res: Response) => {
        try {
            const metrics = this.orchestrator.getMonitoringMetrics();

            res.json({
                success: true,
                data: {
                    metrics,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get completion metrics', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve completion metrics'
            });
        }
    };

    /**
     * Get recent completion events
     */
    getRecentEvents = async (req: Request, res: Response) => {
        try {
            const limit = parseInt(req.query.limit as string) || 100;
            const events = this.monitoringService.getRecentEvents(limit);

            res.json({
                success: true,
                data: {
                    events,
                    count: events.length,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get recent events', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve recent events'
            });
        }
    };

    /**
     * Get error logs with filtering
     */
    getErrorLogs = async (req: Request, res: Response) => {
        try {
            const {
                startDate,
                endDate,
                errorCodes,
                severity,
                userId,
                completionId,
                resolved,
                limit
            } = req.query;

            const options: any = {};

            if (startDate) options.startDate = new Date(startDate as string);
            if (endDate) options.endDate = new Date(endDate as string);
            if (errorCodes) options.errorCodes = (errorCodes as string).split(',') as SwapCompletionErrorCodes[];
            if (severity) options.severity = (severity as string).split(',');
            if (userId) options.userId = userId as string;
            if (completionId) options.completionId = completionId as string;
            if (resolved !== undefined) options.resolved = resolved === 'true';
            if (limit) options.limit = parseInt(limit as string);

            const errorLogs = this.orchestrator.getErrorLogs(options);

            res.json({
                success: true,
                data: {
                    errorLogs,
                    count: errorLogs.length,
                    filters: options,
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get error logs', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve error logs'
            });
        }
    };

    /**
     * Get active alerts
     */
    getActiveAlerts = async (req: Request, res: Response) => {
        try {
            const severity = req.query.severity as 'info' | 'warning' | 'error' | 'critical' | undefined;
            const alerts = this.orchestrator.getActiveAlerts(severity);

            res.json({
                success: true,
                data: {
                    alerts,
                    count: alerts.length,
                    severity: severity || 'all',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get active alerts', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve active alerts'
            });
        }
    };

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert = async (req: Request, res: Response) => {
        try {
            const { alertId } = req.params;
            const { acknowledgedBy } = req.body;

            if (!acknowledgedBy) {
                return res.status(400).json({
                    success: false,
                    error: 'acknowledgedBy is required'
                });
            }

            const success = this.orchestrator.acknowledgeAlert(alertId || '', acknowledgedBy);

            if (success) {
                return res.json({
                    success: true,
                    message: 'Alert acknowledged successfully',
                    alertId,
                    acknowledgedBy,
                    timestamp: new Date().toISOString()
                });
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found or already acknowledged'
                });
            }
        } catch (error) {
            enhancedLogger.error('Failed to acknowledge alert', {
                alertId: req.params.alertId || 'unknown',
                error: error instanceof Error ? error.message : String(error)
            });

            return res.status(500).json({
                success: false,
                error: 'Failed to acknowledge alert'
            });
        }
    };

    /**
     * Resolve an alert
     */
    resolveAlert = async (req: Request, res: Response) => {
        try {
            const { alertId } = req.params;
            const { resolvedBy } = req.body;

            if (!resolvedBy) {
                return res.status(400).json({
                    success: false,
                    error: 'resolvedBy is required'
                });
            }

            const success = this.orchestrator.resolveAlert(alertId || '', resolvedBy);

            if (success) {
                return res.json({
                    success: true,
                    message: 'Alert resolved successfully',
                    alertId,
                    resolvedBy,
                    timestamp: new Date().toISOString()
                });
            } else {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found or already resolved'
                });
            }
        } catch (error) {
            enhancedLogger.error('Failed to resolve alert', {
                alertId: req.params.alertId || 'unknown',
                error: error instanceof Error ? error.message : String(error)
            });

            return res.status(500).json({
                success: false,
                error: 'Failed to resolve alert'
            });
        }
    };

    /**
     * Generate performance report
     */
    generatePerformanceReport = async (req: Request, res: Response) => {
        try {
            const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
            const report = this.orchestrator.generatePerformanceReport(timeRange);

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            enhancedLogger.error('Failed to generate performance report', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to generate performance report'
            });
        }
    };

    /**
     * Generate error analysis report
     */
    generateErrorAnalysisReport = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.query;

            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;

            const report = this.orchestrator.generateErrorAnalysisReport(start, end);

            res.json({
                success: true,
                data: report
            });
        } catch (error) {
            enhancedLogger.error('Failed to generate error analysis report', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to generate error analysis report'
            });
        }
    };

    /**
     * Get alert statistics
     */
    getAlertStatistics = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate } = req.query;

            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;

            const statistics = this.alertingService.getAlertStatistics(start, end);

            res.json({
                success: true,
                data: {
                    statistics,
                    timeRange: {
                        start: start?.toISOString(),
                        end: end?.toISOString()
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get alert statistics', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve alert statistics'
            });
        }
    };

    /**
     * Get alert history
     */
    getAlertHistory = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate, type, limit } = req.query;

            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;
            const alertType = type as any;
            const limitNum = limit ? parseInt(limit as string) : undefined;

            const history = this.alertingService.getAlertHistory(start, end, alertType, limitNum);

            res.json({
                success: true,
                data: {
                    history,
                    count: history.length,
                    filters: {
                        startDate: start?.toISOString(),
                        endDate: end?.toISOString(),
                        type: alertType,
                        limit: limitNum
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get alert history', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve alert history'
            });
        }
    };

    /**
     * Get performance samples
     */
    getPerformanceSamples = async (req: Request, res: Response) => {
        try {
            const { startDate, endDate, operationType, limit } = req.query;

            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;
            const opType = operationType as 'booking_exchange' | 'cash_payment' | undefined;
            const limitNum = limit ? parseInt(limit as string) : undefined;

            const samples = this.performanceService.getPerformanceSamples(start, end, opType, limitNum);

            res.json({
                success: true,
                data: {
                    samples,
                    count: samples.length,
                    filters: {
                        startDate: start?.toISOString(),
                        endDate: end?.toISOString(),
                        operationType: opType,
                        limit: limitNum
                    },
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get performance samples', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve performance samples'
            });
        }
    };

    /**
     * Get current performance metrics
     */
    getCurrentPerformanceMetrics = async (req: Request, res: Response) => {
        try {
            const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
            const metrics = this.performanceService.getCurrentPerformanceMetrics(timeWindow);

            res.json({
                success: true,
                data: {
                    metrics,
                    timeWindow: timeWindow || 3600000, // Default 1 hour
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to get current performance metrics', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to retrieve current performance metrics'
            });
        }
    };

    /**
     * Analyze performance trends
     */
    analyzePerformanceTrends = async (req: Request, res: Response) => {
        try {
            const timeRange = req.query.timeRange ? parseInt(req.query.timeRange as string) : undefined;
            const trends = this.performanceService.analyzePerformanceTrends(timeRange);

            res.json({
                success: true,
                data: {
                    trends,
                    timeRange: timeRange || 86400000, // Default 24 hours
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to analyze performance trends', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to analyze performance trends'
            });
        }
    };

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks = async (req: Request, res: Response) => {
        try {
            const timeWindow = req.query.timeWindow ? parseInt(req.query.timeWindow as string) : undefined;
            const bottlenecks = this.performanceService.identifyBottlenecks(timeWindow);

            res.json({
                success: true,
                data: {
                    bottlenecks,
                    count: bottlenecks.length,
                    timeWindow: timeWindow || 3600000, // Default 1 hour
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            enhancedLogger.error('Failed to identify bottlenecks', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to identify performance bottlenecks'
            });
        }
    };

    /**
     * Export error logs
     */
    exportErrorLogs = async (req: Request, res: Response) => {
        try {
            const { format = 'json', startDate, endDate, errorCodes } = req.query;

            const options: any = {};
            if (startDate) options.startDate = new Date(startDate as string);
            if (endDate) options.endDate = new Date(endDate as string);
            if (errorCodes) options.errorCodes = (errorCodes as string).split(',');

            const exportData = this.errorLoggingService.exportErrorLogs(format as 'json' | 'csv', options);

            const filename = `completion_errors_${new Date().toISOString().split('T')[0]}.${format}`;
            const contentType = format === 'csv' ? 'text/csv' : 'application/json';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(exportData);
        } catch (error) {
            enhancedLogger.error('Failed to export error logs', {
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                success: false,
                error: 'Failed to export error logs'
            });
        }
    };

    /**
     * Reset monitoring metrics (admin only)
     */
    resetMetrics = async (req: Request, res: Response) => {
        try {
            // In production, add proper admin authentication
            if (!req.user || !this.isAdmin(req.user)) {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }

            this.monitoringService.resetMetrics();

            enhancedLogger.info('Completion monitoring metrics reset by admin', {
                adminUserId: req.user.id,
                timestamp: new Date().toISOString()
            });

            return res.json({
                success: true,
                message: 'Completion monitoring metrics have been reset',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            enhancedLogger.error('Failed to reset monitoring metrics', {
                error: error instanceof Error ? error.message : String(error)
            });

            return res.status(500).json({
                success: false,
                error: 'Failed to reset monitoring metrics'
            });
        }
    };

    /**
     * Check if user is admin (placeholder implementation)
     */
    private isAdmin(user: any): boolean {
        // In a real application, implement proper admin role checking
        return user.role === 'admin' || user.isAdmin === true;
    }
}