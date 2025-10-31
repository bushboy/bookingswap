import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { NFTMonitoringService } from '../services/hedera/NFTMonitoringService';
import { NFTTestSuite } from '../services/hedera/NFTTestSuite';
import { AccountPermissionValidator } from '../services/hedera/AccountPermissionValidator';
import { DiagnosticReporter } from '../services/hedera/DiagnosticReporter';
import { PasswordResetCleanupService } from '../services/auth/PasswordResetCleanupService';
import { ConfigurationValidator } from '../services/startup/ConfigurationValidator';
import { ServiceHealthMonitor } from '../services/monitoring/ServiceHealthMonitor';
import { logger } from '../utils/logger';

/**
 * Create monitoring and health check routes
 */
export async function createMonitoringRoutes(passwordResetCleanupService?: PasswordResetCleanupService, performanceMonitor?: any): Promise<Router> {
  const router = Router();
  const nftMonitoring = NFTMonitoringService.getInstance();

  /**
   * NFT service health check
   */
  router.get('/health/nft', asyncHandler(async (req, res) => {
    const healthStatus = nftMonitoring.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 :
      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      service: 'nft',
      ...healthStatus,
    });
  }));

  /**
   * Comprehensive NFT operations health check
   */
  router.get('/health/nft/comprehensive', asyncHandler(async (req, res) => {
    const startTime = Date.now();

    try {
      // Run basic health checks
      const healthStatus = nftMonitoring.getHealthStatus();

      // Test basic NFT operations if requested
      const runTests = req.query.runTests === 'true';
      let testResults = null;

      if (runTests) {
        const nftTestSuite = new NFTTestSuite();
        testResults = await nftTestSuite.runBasicHealthChecks();
      }

      // Check account permissions
      const accountId = process.env.HEDERA_ACCOUNT_ID;
      let accountStatus = null;

      if (accountId) {
        const validator = new AccountPermissionValidator();
        accountStatus = await validator.validateAccount(accountId);
      }

      const responseTime = Date.now() - startTime;
      const overallHealthy = healthStatus.status === 'healthy' &&
        (!testResults || testResults.every(r => r.success)) &&
        (!accountStatus || accountStatus.canMintNFTs);

      res.status(overallHealthy ? 200 : 503).json({
        service: 'nft_comprehensive',
        status: overallHealthy ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        checks: {
          monitoring: healthStatus,
          tests: testResults,
          account: accountStatus,
        },
      });
    } catch (error) {
      logger.error('Comprehensive NFT health check failed', { error: error.message });
      res.status(503).json({
        service: 'nft_comprehensive',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }));

  /**
   * NFT operation metrics for dashboards
   */
  router.get('/metrics/nft', asyncHandler(async (req, res) => {
    const timeRange = req.query.timeRange as 'hour' | 'day' | 'week' || 'hour';
    const metrics = nftMonitoring.getOperationMetrics(timeRange);

    res.json({
      timeRange,
      timestamp: new Date().toISOString(),
      ...metrics,
    });
  }));

  /**
   * NFT alerts endpoint
   */
  router.get('/alerts/nft', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = nftMonitoring.getRecentAlerts(limit);

    res.json({
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Prometheus metrics export for NFT operations
   */
  router.get('/metrics/prometheus/nft', asyncHandler(async (req, res) => {
    const metrics = nftMonitoring.exportPrometheusMetrics();

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  }));

  /**
   * NFT diagnostic report
   */
  router.get('/diagnostics/nft', asyncHandler(async (req, res) => {
    const format = req.query.format as 'json' | 'markdown' || 'json';

    try {
      const diagnosticReporter = new DiagnosticReporter();
      const report = await diagnosticReporter.generateReport();

      if (format === 'markdown') {
        const markdownReport = await diagnosticReporter.exportReport('markdown');
        res.set('Content-Type', 'text/markdown');
        res.send(markdownReport);
      } else {
        res.json(report);
      }
    } catch (error) {
      logger.error('Failed to generate NFT diagnostic report', { error: error.message });
      res.status(500).json({
        error: 'Failed to generate diagnostic report',
        message: error.message,
      });
    }
  }));

  /**
   * Test specific NFT operation
   */
  router.post('/test/nft/:operation', asyncHandler(async (req, res) => {
    const operation = req.params.operation;
    const { tokenId, accountId, serialNumber } = req.body;

    try {
      const nftTestSuite = new NFTTestSuite();
      let result;

      switch (operation) {
        case 'mint':
          if (!tokenId) {
            return res.status(400).json({ error: 'tokenId is required for mint operation' });
          }
          result = await nftTestSuite.testNFTMinting(tokenId);
          break;

        case 'transfer':
          if (!tokenId || !serialNumber || !accountId) {
            return res.status(400).json({
              error: 'tokenId, serialNumber, and accountId are required for transfer operation'
            });
          }
          result = await nftTestSuite.testNFTTransfer(tokenId, serialNumber, accountId);
          break;

        case 'query':
          if (!tokenId || !serialNumber) {
            return res.status(400).json({
              error: 'tokenId and serialNumber are required for query operation'
            });
          }
          result = await nftTestSuite.testNFTQuery(tokenId, serialNumber);
          break;

        case 'create':
          result = await nftTestSuite.testTokenCreation();
          break;

        default:
          return res.status(400).json({ error: `Unknown operation: ${operation}` });
      }

      res.json({
        operation,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`NFT ${operation} test failed`, { error: error.message, operation });
      res.status(500).json({
        operation,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Update NFT monitoring alert configuration
   */
  router.put('/config/nft/alerts', asyncHandler(async (req, res) => {
    const {
      errorRateThreshold,
      responseTimeThreshold,
      consecutiveFailuresThreshold,
      alertCooldownPeriod,
    } = req.body;

    try {
      nftMonitoring.updateAlertConfig({
        errorRateThreshold,
        responseTimeThreshold,
        consecutiveFailuresThreshold,
        alertCooldownPeriod,
      });

      res.json({
        message: 'NFT alert configuration updated successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to update NFT alert configuration', { error: error.message });
      res.status(500).json({
        error: 'Failed to update alert configuration',
        message: error.message,
      });
    }
  }));

  /**
   * Get current NFT monitoring configuration
   */
  router.get('/config/nft', asyncHandler(async (req, res) => {
    // This would return current configuration
    // For now, return basic info
    res.json({
      service: 'nft_monitoring',
      version: '1.0.0',
      features: [
        'health_checks',
        'metrics_export',
        'alerting',
        'prometheus_integration',
        'diagnostic_reports',
      ],
      timestamp: new Date().toISOString(),
    });
  }));

  // Password Reset Cleanup Monitoring Endpoints
  if (passwordResetCleanupService) {
    /**
     * Password reset cleanup service health check
     */
    router.get('/health/password-reset-cleanup', asyncHandler(async (req, res) => {
      const isRunning = passwordResetCleanupService.isServiceRunning();
      const config = passwordResetCleanupService.getConfig();

      res.status(isRunning ? 200 : 503).json({
        service: 'password_reset_cleanup',
        status: isRunning ? 'healthy' : 'unhealthy',
        running: isRunning,
        config,
        timestamp: new Date().toISOString(),
      });
    }));

    /**
     * Password reset cleanup statistics
     */
    router.get('/metrics/password-reset-cleanup', asyncHandler(async (req, res) => {
      try {
        const statistics = await passwordResetCleanupService.getStatistics();

        res.json({
          service: 'password_reset_cleanup',
          statistics,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to get password reset cleanup statistics', { error: error.message });
        res.status(500).json({
          service: 'password_reset_cleanup',
          error: 'Failed to retrieve statistics',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Trigger manual password reset cleanup
     */
    router.post('/cleanup/password-reset-tokens', asyncHandler(async (req, res) => {
      try {
        const tokensRemoved = await passwordResetCleanupService.manualCleanup();

        res.json({
          service: 'password_reset_cleanup',
          action: 'manual_cleanup',
          tokensRemoved,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Manual password reset cleanup failed', { error: error.message });
        res.status(500).json({
          service: 'password_reset_cleanup',
          action: 'manual_cleanup',
          error: 'Cleanup operation failed',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Update password reset cleanup configuration
     */
    router.put('/config/password-reset-cleanup', asyncHandler(async (req, res) => {
      try {
        const {
          intervalMinutes,
          retentionDays,
          enableStatistics,
          statisticsIntervalMinutes,
        } = req.body;

        // Validate the new configuration
        const { validateCleanupConfig } = await import('../services/auth/cleanup-config');
        const newConfig = {
          intervalMinutes: intervalMinutes ?? passwordResetCleanupService.getConfig().intervalMinutes,
          retentionDays: retentionDays ?? passwordResetCleanupService.getConfig().retentionDays,
          enableStatistics: enableStatistics ?? passwordResetCleanupService.getConfig().enableStatistics,
          statisticsIntervalMinutes: statisticsIntervalMinutes ?? passwordResetCleanupService.getConfig().statisticsIntervalMinutes,
        };

        validateCleanupConfig(newConfig);
        passwordResetCleanupService.updateConfig(newConfig);

        res.json({
          service: 'password_reset_cleanup',
          action: 'config_update',
          message: 'Configuration updated successfully. Restart service to apply changes.',
          newConfig,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to update password reset cleanup configuration', { error: error.message });
        res.status(400).json({
          service: 'password_reset_cleanup',
          action: 'config_update',
          error: 'Configuration update failed',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Get password reset cleanup configuration
     */
    router.get('/config/password-reset-cleanup', asyncHandler(async (req, res) => {
      const config = passwordResetCleanupService.getConfig();
      const isRunning = passwordResetCleanupService.isServiceRunning();

      res.json({
        service: 'password_reset_cleanup',
        config,
        running: isRunning,
        features: [
          'automated_cleanup',
          'configurable_retention',
          'statistics_collection',
          'manual_cleanup',
          'performance_monitoring',
        ],
        timestamp: new Date().toISOString(),
      });
    }));
  }

  /**
   * Configuration validation summary
   */
  router.get('/config-summary', asyncHandler(async (req, res) => {
    const configValidator = ConfigurationValidator.getInstance();
    const summary = configValidator.getValidationSummary();

    res.json({
      success: true,
      data: summary,
    });
  }));

  // Performance Monitoring Endpoints
  if (performanceMonitor) {
    /**
     * Get current system performance metrics
     */
    router.get('/performance/system', asyncHandler(async (req, res) => {
      try {
        const systemMetrics = await performanceMonitor.getSystemMetrics();

        res.json({
          service: 'performance_monitoring',
          metrics: systemMetrics,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('Failed to get system performance metrics', { error: error.message });
        res.status(500).json({
          service: 'performance_monitoring',
          error: 'Failed to retrieve system metrics',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Get performance metric history
     */
    router.get('/performance/metrics/:metricName', asyncHandler(async (req, res) => {
      try {
        const { metricName } = req.params;
        const limit = parseInt(req.query.limit as string) || 100;

        const metricHistory = performanceMonitor.getMetricHistory(metricName, limit);

        res.json({
          service: 'performance_monitoring',
          metric: metricName,
          history: metricHistory,
          count: metricHistory.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to get performance metric history', {
          error: error.message,
          metricName: req.params.metricName
        });
        res.status(500).json({
          service: 'performance_monitoring',
          error: 'Failed to retrieve metric history',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Get performance alerts
     */
    router.get('/performance/alerts', asyncHandler(async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 50;
        const alerts = performanceMonitor.getAlerts(limit);

        res.json({
          service: 'performance_monitoring',
          alerts,
          count: alerts.length,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to get performance alerts', { error: error.message });
        res.status(500).json({
          service: 'performance_monitoring',
          error: 'Failed to retrieve alerts',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Get comprehensive performance report
     */
    router.get('/performance/report', asyncHandler(async (req, res) => {
      try {
        const report = await performanceMonitor.generatePerformanceReport();

        res.json({
          service: 'performance_monitoring',
          report,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Failed to generate performance report', { error: error.message });
        res.status(500).json({
          service: 'performance_monitoring',
          error: 'Failed to generate performance report',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));

    /**
     * Export performance metrics in Prometheus format
     */
    router.get('/performance/metrics/prometheus', asyncHandler(async (req, res) => {
      try {
        // Generate Prometheus-compatible metrics
        const systemMetrics = await performanceMonitor.getSystemMetrics();
        const alerts = performanceMonitor.getAlerts(10);

        let prometheusMetrics = '';

        // Database metrics
        prometheusMetrics += `# HELP database_connections_active Number of active database connections\n`;
        prometheusMetrics += `# TYPE database_connections_active gauge\n`;
        prometheusMetrics += `database_connections_active ${systemMetrics.database.connectionCount}\n\n`;

        prometheusMetrics += `# HELP database_query_time_avg Average database query time in milliseconds\n`;
        prometheusMetrics += `# TYPE database_query_time_avg gauge\n`;
        prometheusMetrics += `database_query_time_avg ${systemMetrics.database.averageQueryTime}\n\n`;

        prometheusMetrics += `# HELP database_slow_queries_total Number of slow database queries\n`;
        prometheusMetrics += `# TYPE database_slow_queries_total counter\n`;
        prometheusMetrics += `database_slow_queries_total ${systemMetrics.database.slowQueryCount}\n\n`;

        // Cache metrics
        prometheusMetrics += `# HELP cache_hit_rate Cache hit rate percentage\n`;
        prometheusMetrics += `# TYPE cache_hit_rate gauge\n`;
        prometheusMetrics += `cache_hit_rate ${systemMetrics.cache.hitRate}\n\n`;

        // Application metrics
        prometheusMetrics += `# HELP app_memory_heap_used_bytes Application heap memory usage in bytes\n`;
        prometheusMetrics += `# TYPE app_memory_heap_used_bytes gauge\n`;
        prometheusMetrics += `app_memory_heap_used_bytes ${systemMetrics.application.memoryUsage.heapUsed}\n\n`;

        prometheusMetrics += `# HELP app_uptime_seconds Application uptime in seconds\n`;
        prometheusMetrics += `# TYPE app_uptime_seconds counter\n`;
        prometheusMetrics += `app_uptime_seconds ${systemMetrics.application.uptime}\n\n`;

        // Alert metrics
        prometheusMetrics += `# HELP performance_alerts_total Number of performance alerts\n`;
        prometheusMetrics += `# TYPE performance_alerts_total counter\n`;
        prometheusMetrics += `performance_alerts_total ${alerts.length}\n\n`;

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(prometheusMetrics);
      } catch (error) {
        logger.error('Failed to export Prometheus metrics', { error: error.message });
        res.status(500).json({
          service: 'performance_monitoring',
          error: 'Failed to export metrics',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }));
  }

  // Service Health Monitoring Endpoints
  const serviceHealthMonitor = ServiceHealthMonitor.getInstance();

  /**
   * Get overall service health summary
   */
  router.get('/health/services', asyncHandler(async (req, res) => {
    const healthSummary = serviceHealthMonitor.getHealthSummary();
    const statusCode = healthSummary.overallStatus === 'healthy' ? 200 :
      healthSummary.overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      service: 'service_health_monitoring',
      ...healthSummary,
    });
  }));

  /**
   * Get detailed health status for all services
   */
  router.get('/health/services/detailed', asyncHandler(async (req, res) => {
    const allStatuses = serviceHealthMonitor.getAllServiceStatuses();
    const healthSummary = serviceHealthMonitor.getHealthSummary();

    res.json({
      service: 'service_health_monitoring',
      summary: healthSummary,
      services: allStatuses,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get health status for a specific service
   */
  router.get('/health/services/:serviceName', asyncHandler(async (req, res) => {
    const { serviceName } = req.params;
    const serviceStatus = serviceHealthMonitor.getServiceStatus(serviceName);

    if (!serviceStatus) {
      return res.status(404).json({
        error: 'Service not found',
        serviceName,
        timestamp: new Date().toISOString(),
      });
    }

    const statusCode = serviceStatus.status === 'healthy' ? 200 :
      serviceStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      service: 'service_health_monitoring',
      serviceName,
      ...serviceStatus,
    });
  }));

  /**
   * Trigger manual health check for all services
   */
  router.post('/health/services/check', asyncHandler(async (req, res) => {
    try {
      await serviceHealthMonitor.performHealthCheck();
      const healthSummary = serviceHealthMonitor.getHealthSummary();

      res.json({
        service: 'service_health_monitoring',
        action: 'manual_health_check',
        result: healthSummary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Manual service health check failed', { error: error.message });
      res.status(500).json({
        service: 'service_health_monitoring',
        action: 'manual_health_check',
        error: 'Health check failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Trigger manual health check for a specific service
   */
  router.post('/health/services/:serviceName/check', asyncHandler(async (req, res) => {
    const { serviceName } = req.params;

    try {
      const serviceStatus = await serviceHealthMonitor.checkServiceHealth(serviceName);

      const statusCode = serviceStatus.status === 'healthy' ? 200 :
        serviceStatus.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        service: 'service_health_monitoring',
        action: 'manual_service_check',
        serviceName,
        result: serviceStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Manual health check failed for service ${serviceName}`, { error: error.message });
      res.status(500).json({
        service: 'service_health_monitoring',
        action: 'manual_service_check',
        serviceName,
        error: 'Service health check failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Get service health alerts
   */
  router.get('/alerts/services', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const alerts = serviceHealthMonitor.getRecentAlerts(limit);

    res.json({
      service: 'service_health_monitoring',
      alerts,
      count: alerts.length,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get performance metrics for a service
   */
  router.get('/metrics/services/:serviceName', asyncHandler(async (req, res) => {
    const { serviceName } = req.params;
    const methodName = req.query.method as string;
    const metrics = serviceHealthMonitor.getPerformanceMetrics(serviceName, methodName);

    res.json({
      service: 'service_health_monitoring',
      serviceName,
      methodName: methodName || 'all',
      metrics,
      count: metrics.length,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get service monitoring status
   */
  router.get('/status/service-monitoring', asyncHandler(async (req, res) => {
    const monitoringStatus = serviceHealthMonitor.getMonitoringStatus();

    res.json({
      service: 'service_health_monitoring',
      ...monitoringStatus,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Start service health monitoring
   */
  router.post('/monitoring/services/start', asyncHandler(async (req, res) => {
    const intervalMs = parseInt(req.body.intervalMs) || 60000;

    try {
      serviceHealthMonitor.startMonitoring(intervalMs);

      res.json({
        service: 'service_health_monitoring',
        action: 'start_monitoring',
        intervalMs,
        message: 'Service health monitoring started',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to start service health monitoring', { error: error.message });
      res.status(500).json({
        service: 'service_health_monitoring',
        action: 'start_monitoring',
        error: 'Failed to start monitoring',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Stop service health monitoring
   */
  router.post('/monitoring/services/stop', asyncHandler(async (req, res) => {
    try {
      serviceHealthMonitor.stopMonitoring();

      res.json({
        service: 'service_health_monitoring',
        action: 'stop_monitoring',
        message: 'Service health monitoring stopped',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to stop service health monitoring', { error: error.message });
      res.status(500).json({
        service: 'service_health_monitoring',
        action: 'stop_monitoring',
        error: 'Failed to stop monitoring',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Export service health metrics in Prometheus format
   */
  router.get('/metrics/prometheus/services', asyncHandler(async (req, res) => {
    try {
      const healthSummary = serviceHealthMonitor.getHealthSummary();
      const allStatuses = serviceHealthMonitor.getAllServiceStatuses();

      let prometheusMetrics = '';

      // Service health summary metrics
      prometheusMetrics += `# HELP services_total Total number of monitored services\n`;
      prometheusMetrics += `# TYPE services_total gauge\n`;
      prometheusMetrics += `services_total ${healthSummary.totalServices}\n\n`;

      prometheusMetrics += `# HELP services_healthy Number of healthy services\n`;
      prometheusMetrics += `# TYPE services_healthy gauge\n`;
      prometheusMetrics += `services_healthy ${healthSummary.healthyServices}\n\n`;

      prometheusMetrics += `# HELP services_degraded Number of degraded services\n`;
      prometheusMetrics += `# TYPE services_degraded gauge\n`;
      prometheusMetrics += `services_degraded ${healthSummary.degradedServices}\n\n`;

      prometheusMetrics += `# HELP services_unhealthy Number of unhealthy services\n`;
      prometheusMetrics += `# TYPE services_unhealthy gauge\n`;
      prometheusMetrics += `services_unhealthy ${healthSummary.unhealthyServices}\n\n`;

      // Individual service metrics
      for (const status of allStatuses) {
        const serviceName = status.serviceName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

        prometheusMetrics += `# HELP service_health_status Service health status (1=healthy, 0.5=degraded, 0=unhealthy)\n`;
        prometheusMetrics += `# TYPE service_health_status gauge\n`;
        const healthValue = status.status === 'healthy' ? 1 : status.status === 'degraded' ? 0.5 : 0;
        prometheusMetrics += `service_health_status{service="${status.serviceName}"} ${healthValue}\n\n`;

        if (status.responseTime) {
          prometheusMetrics += `# HELP service_response_time_ms Service response time in milliseconds\n`;
          prometheusMetrics += `# TYPE service_response_time_ms gauge\n`;
          prometheusMetrics += `service_response_time_ms{service="${status.serviceName}"} ${status.responseTime}\n\n`;
        }

        prometheusMetrics += `# HELP service_error_count Total number of service errors\n`;
        prometheusMetrics += `# TYPE service_error_count counter\n`;
        prometheusMetrics += `service_error_count{service="${status.serviceName}"} ${status.errorCount}\n\n`;

        prometheusMetrics += `# HELP service_success_count Total number of successful service operations\n`;
        prometheusMetrics += `# TYPE service_success_count counter\n`;
        prometheusMetrics += `service_success_count{service="${status.serviceName}"} ${status.successCount}\n\n`;

        prometheusMetrics += `# HELP service_uptime_percent Service uptime percentage\n`;
        prometheusMetrics += `# TYPE service_uptime_percent gauge\n`;
        prometheusMetrics += `service_uptime_percent{service="${status.serviceName}"} ${status.uptime}\n\n`;
      }

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);
    } catch (error) {
      logger.error('Failed to export service health Prometheus metrics', { error: error.message });
      res.status(500).json({
        service: 'service_health_monitoring',
        error: 'Failed to export metrics',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  // Service Recovery Endpoints
  const { serviceRecoveryManager } = await import('../services/recovery/ServiceRecoveryManager');

  /**
   * Get service recovery status
   */
  router.get('/recovery/status', asyncHandler(async (req, res) => {
    const recoveryStatus = serviceRecoveryManager.getRecoveryStatus();

    res.json({
      service: 'service_recovery',
      ...recoveryStatus,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get recent recovery actions
   */
  router.get('/recovery/actions', asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const actions = serviceRecoveryManager.getRecoveryActions(limit);

    res.json({
      service: 'service_recovery',
      actions,
      count: actions.length,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Get circuit breaker states
   */
  router.get('/recovery/circuit-breakers', asyncHandler(async (req, res) => {
    const circuitBreakers = serviceRecoveryManager.getCircuitBreakerStates();

    res.json({
      service: 'service_recovery',
      circuitBreakers,
      count: circuitBreakers.length,
      timestamp: new Date().toISOString(),
    });
  }));

  /**
   * Start service recovery monitoring
   */
  router.post('/recovery/start', asyncHandler(async (req, res) => {
    const intervalMs = parseInt(req.body.intervalMs) || 30000;

    try {
      serviceRecoveryManager.startRecovery(intervalMs);

      res.json({
        service: 'service_recovery',
        action: 'start_recovery',
        intervalMs,
        message: 'Service recovery monitoring started',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to start service recovery', { error: error.message });
      res.status(500).json({
        service: 'service_recovery',
        action: 'start_recovery',
        error: 'Failed to start recovery monitoring',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Stop service recovery monitoring
   */
  router.post('/recovery/stop', asyncHandler(async (req, res) => {
    try {
      serviceRecoveryManager.stopRecovery();

      res.json({
        service: 'service_recovery',
        action: 'stop_recovery',
        message: 'Service recovery monitoring stopped',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to stop service recovery', { error: error.message });
      res.status(500).json({
        service: 'service_recovery',
        action: 'stop_recovery',
        error: 'Failed to stop recovery monitoring',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Trigger manual recovery for a specific service
   */
  router.post('/recovery/services/:serviceName/recover', asyncHandler(async (req, res) => {
    const { serviceName } = req.params;

    try {
      await serviceRecoveryManager.performRecoveryCheck();

      res.json({
        service: 'service_recovery',
        action: 'manual_recovery',
        serviceName,
        message: 'Manual recovery triggered',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Manual recovery failed for service ${serviceName}`, { error: error.message });
      res.status(500).json({
        service: 'service_recovery',
        action: 'manual_recovery',
        serviceName,
        error: 'Manual recovery failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Update recovery configuration
   */
  router.put('/recovery/config', asyncHandler(async (req, res) => {
    try {
      const {
        maxFailureThreshold,
        circuitBreakerTimeout,
        retryAttempts,
        retryDelay,
        enableAutoRestart,
        enableFallbackServices,
        enableCircuitBreaker,
      } = req.body;

      serviceRecoveryManager.updateConfig({
        maxFailureThreshold,
        circuitBreakerTimeout,
        retryAttempts,
        retryDelay,
        enableAutoRestart,
        enableFallbackServices,
        enableCircuitBreaker,
      });

      res.json({
        service: 'service_recovery',
        action: 'config_update',
        message: 'Recovery configuration updated successfully',
        newConfig: serviceRecoveryManager.getConfig(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to update recovery configuration', { error: error.message });
      res.status(400).json({
        service: 'service_recovery',
        action: 'config_update',
        error: 'Configuration update failed',
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }));

  /**
   * Get recovery configuration
   */
  router.get('/recovery/config', asyncHandler(async (req, res) => {
    const config = serviceRecoveryManager.getConfig();

    res.json({
      service: 'service_recovery',
      config,
      features: [
        'automated_restart',
        'fallback_services',
        'circuit_breaker',
        'validation_retry',
        'recovery_monitoring',
      ],
      timestamp: new Date().toISOString(),
    });
  }));

  return router;
}