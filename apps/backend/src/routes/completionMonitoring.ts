import { Router } from 'express';
import { CompletionMonitoringController } from '../controllers/CompletionMonitoringController';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { Pool } from 'pg';
import { HederaService } from '../services/hedera/HederaService';
import { NotificationService } from '../services/notification/NotificationService';

/**
 * Routes for completion monitoring, error handling, and performance tracking
 * Requirements: 4.1, 4.3, 4.5
 */
export function createCompletionMonitoringRoutes(
    pool: Pool,
    hederaService: HederaService,
    notificationService: NotificationService
): Router {
    const router = Router();
    const controller = new CompletionMonitoringController(pool, hederaService, notificationService);

    // Apply authentication to all routes
    router.use(authMiddleware);

    // Metrics endpoints
    router.get('/metrics', controller.getMetrics);
    router.get('/events', controller.getRecentEvents);
    router.get('/performance/current', controller.getCurrentPerformanceMetrics);
    router.get('/performance/trends', controller.analyzePerformanceTrends);
    router.get('/performance/bottlenecks', controller.identifyBottlenecks);
    router.get('/performance/samples', controller.getPerformanceSamples);

    // Error handling endpoints
    router.get('/errors', controller.getErrorLogs);
    router.get('/errors/export', controller.exportErrorLogs);

    // Alert management endpoints
    router.get('/alerts', controller.getActiveAlerts);
    router.get('/alerts/history', controller.getAlertHistory);
    router.get('/alerts/statistics', controller.getAlertStatistics);
    router.post('/alerts/:alertId/acknowledge', controller.acknowledgeAlert);
    router.post('/alerts/:alertId/resolve', controller.resolveAlert);

    // Report generation endpoints
    router.get('/reports/performance', controller.generatePerformanceReport);
    router.get('/reports/errors', controller.generateErrorAnalysisReport);

    // Admin endpoints (require admin authentication)
    router.post('/admin/reset-metrics', adminAuth, controller.resetMetrics);

    return router;
}