import { HederaErrorDetails, HederaErrorType } from './HederaErrorReporter';
import { logger } from '../../utils/logger';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';

/**
 * NFT operation metrics for monitoring and alerting
 */
export interface NFTOperationMetrics {
  operationType: 'mint' | 'transfer' | 'query' | 'associate' | 'create_token';
  success: boolean;
  duration: number;
  errorType?: HederaErrorType;
  errorCode?: string;
  timestamp: Date;
  context: {
    tokenId?: string;
    accountId?: string;
    serialNumber?: number;
    bookingId?: string;
    userId?: string;
  };
}

/**
 * NFT health status for monitoring dashboards
 */
export interface NFTHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastSuccessfulOperation: Date | null;
  errorRate: number;
  averageResponseTime: number;
  recentErrors: HederaErrorDetails[];
  operationCounts: {
    total: number;
    successful: number;
    failed: number;
  };
  errorBreakdown: Record<HederaErrorType, number>;
}

/**
 * Alert configuration for NFT operations
 */
export interface NFTAlertConfig {
  errorRateThreshold: number; // Percentage (0-100)
  responseTimeThreshold: number; // Milliseconds
  consecutiveFailuresThreshold: number;
  alertCooldownPeriod: number; // Milliseconds
}

/**
 * NFT alert details
 */
export interface NFTAlert {
  id: string;
  type: 'error_rate' | 'response_time' | 'consecutive_failures' | 'service_down';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: Date;
  metrics: {
    currentValue: number;
    threshold: number;
    operationType?: string;
  };
  context: Record<string, any>;
}

/**
 * Monitoring and alerting service for Hedera NFT operations
 */
export class NFTMonitoringService {
  private static instance: NFTMonitoringService;
  private metrics: NFTOperationMetrics[] = [];
  private alerts: NFTAlert[] = [];
  private consecutiveFailures: number = 0;
  private lastSuccessfulOperation: Date | null = null;
  private alertConfig: NFTAlertConfig;
  private lastAlertTime: Map<string, Date> = new Map();
  private performanceMonitor?: PerformanceMonitor;

  private constructor() {
    this.alertConfig = {
      errorRateThreshold: 10, // 10% error rate
      responseTimeThreshold: 5000, // 5 seconds
      consecutiveFailuresThreshold: 5,
      alertCooldownPeriod: 300000, // 5 minutes
    };
    
    // Clean up old metrics every hour
    setInterval(() => this.cleanupOldMetrics(), 3600000);
  }

  public static getInstance(): NFTMonitoringService {
    if (!NFTMonitoringService.instance) {
      NFTMonitoringService.instance = new NFTMonitoringService();
    }
    return NFTMonitoringService.instance;
  }

  /**
   * Set performance monitor for integration
   */
  setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
  }

  /**
   * Update alert configuration
   */
  updateAlertConfig(config: Partial<NFTAlertConfig>): void {
    this.alertConfig = { ...this.alertConfig, ...config };
    logger.info('NFT alert configuration updated', { config: this.alertConfig });
  }

  /**
   * Record NFT operation metrics
   */
  recordOperation(
    operationType: NFTOperationMetrics['operationType'],
    success: boolean,
    duration: number,
    context: NFTOperationMetrics['context'],
    error?: HederaErrorDetails
  ): void {
    const metric: NFTOperationMetrics = {
      operationType,
      success,
      duration,
      errorType: error?.errorType,
      errorCode: error?.errorCode,
      timestamp: new Date(),
      context,
    };

    this.metrics.push(metric);

    // Update consecutive failures counter
    if (success) {
      this.consecutiveFailures = 0;
      this.lastSuccessfulOperation = new Date();
    } else {
      this.consecutiveFailures++;
    }

    // Record metrics in performance monitor if available
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMetric(
        `nft_${operationType}_duration`,
        duration,
        'ms',
        {
          success,
          errorType: error?.errorType,
          tokenId: context.tokenId,
          accountId: context.accountId,
        }
      );

      this.performanceMonitor.recordMetric(
        `nft_${operationType}_success_rate`,
        success ? 1 : 0,
        'boolean',
        context
      );
    }

    // Check for alert conditions
    this.checkAlertConditions(metric, error);

    // Log structured metrics for external monitoring systems
    this.logMetricsForExport(metric, error);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  /**
   * Get current NFT health status
   */
  getHealthStatus(): NFTHealthStatus {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    
    // Filter metrics from last hour
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);
    
    const totalOperations = recentMetrics.length;
    const successfulOperations = recentMetrics.filter(m => m.success).length;
    const failedOperations = totalOperations - successfulOperations;
    
    const errorRate = totalOperations > 0 ? (failedOperations / totalOperations) * 100 : 0;
    
    const averageResponseTime = totalOperations > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;

    // Get recent errors
    const recentErrors = this.metrics
      .filter(m => !m.success && m.timestamp >= oneHourAgo)
      .slice(-10)
      .map(m => ({
        errorCode: m.errorCode || 'UNKNOWN',
        errorMessage: `NFT ${m.operationType} operation failed`,
        errorType: m.errorType || HederaErrorType.UNKNOWN,
        timestamp: m.timestamp,
        operation: m.operationType,
        context: m.context,
        retryable: false,
      } as HederaErrorDetails));

    // Error breakdown by type
    const errorBreakdown: Record<HederaErrorType, number> = {} as Record<HederaErrorType, number>;
    recentMetrics
      .filter(m => !m.success && m.errorType)
      .forEach(m => {
        const errorType = m.errorType!;
        errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
      });

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errorRate > this.alertConfig.errorRateThreshold * 2 || this.consecutiveFailures >= this.alertConfig.consecutiveFailuresThreshold) {
      status = 'unhealthy';
    } else if (errorRate > this.alertConfig.errorRateThreshold || averageResponseTime > this.alertConfig.responseTimeThreshold) {
      status = 'degraded';
    }

    return {
      status,
      lastSuccessfulOperation: this.lastSuccessfulOperation,
      errorRate,
      averageResponseTime,
      recentErrors,
      operationCounts: {
        total: totalOperations,
        successful: successfulOperations,
        failed: failedOperations,
      },
      errorBreakdown,
    };
  }

  /**
   * Get operation metrics for dashboard
   */
  getOperationMetrics(timeRange: 'hour' | 'day' | 'week' = 'hour'): {
    successRate: number;
    averageResponseTime: number;
    operationCounts: Record<string, { total: number; successful: number; failed: number }>;
    errorTrends: Array<{ timestamp: Date; errorCount: number; totalCount: number }>;
  } {
    const now = new Date();
    let startTime: Date;
    
    switch (timeRange) {
      case 'day':
        startTime = new Date(now.getTime() - 24 * 3600000);
        break;
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 3600000);
        break;
      default:
        startTime = new Date(now.getTime() - 3600000);
    }

    const relevantMetrics = this.metrics.filter(m => m.timestamp >= startTime);
    
    const totalOperations = relevantMetrics.length;
    const successfulOperations = relevantMetrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0;
    
    const averageResponseTime = totalOperations > 0 
      ? relevantMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;

    // Operation counts by type
    const operationCounts: Record<string, { total: number; successful: number; failed: number }> = {};
    relevantMetrics.forEach(m => {
      if (!operationCounts[m.operationType]) {
        operationCounts[m.operationType] = { total: 0, successful: 0, failed: 0 };
      }
      operationCounts[m.operationType].total++;
      if (m.success) {
        operationCounts[m.operationType].successful++;
      } else {
        operationCounts[m.operationType].failed++;
      }
    });

    // Error trends (hourly buckets)
    const errorTrends: Array<{ timestamp: Date; errorCount: number; totalCount: number }> = [];
    const bucketSize = timeRange === 'week' ? 24 * 3600000 : 3600000; // 1 day for week, 1 hour otherwise
    
    for (let time = startTime.getTime(); time <= now.getTime(); time += bucketSize) {
      const bucketStart = new Date(time);
      const bucketEnd = new Date(time + bucketSize);
      
      const bucketMetrics = relevantMetrics.filter(m => 
        m.timestamp >= bucketStart && m.timestamp < bucketEnd
      );
      
      errorTrends.push({
        timestamp: bucketStart,
        errorCount: bucketMetrics.filter(m => !m.success).length,
        totalCount: bucketMetrics.length,
      });
    }

    return {
      successRate,
      averageResponseTime,
      operationCounts,
      errorTrends,
    };
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): NFTAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const healthStatus = this.getHealthStatus();
    const operationMetrics = this.getOperationMetrics();
    
    let metrics = '';
    
    // NFT operation success rate
    metrics += `# HELP nft_operation_success_rate Success rate of NFT operations (percentage)\n`;
    metrics += `# TYPE nft_operation_success_rate gauge\n`;
    metrics += `nft_operation_success_rate ${operationMetrics.successRate}\n\n`;
    
    // NFT operation response time
    metrics += `# HELP nft_operation_response_time_ms Average response time of NFT operations in milliseconds\n`;
    metrics += `# TYPE nft_operation_response_time_ms gauge\n`;
    metrics += `nft_operation_response_time_ms ${operationMetrics.averageResponseTime}\n\n`;
    
    // NFT operation counts by type
    metrics += `# HELP nft_operations_total Total number of NFT operations by type\n`;
    metrics += `# TYPE nft_operations_total counter\n`;
    Object.entries(operationMetrics.operationCounts).forEach(([type, counts]) => {
      metrics += `nft_operations_total{operation_type="${type}",status="success"} ${counts.successful}\n`;
      metrics += `nft_operations_total{operation_type="${type}",status="failure"} ${counts.failed}\n`;
    });
    metrics += '\n';
    
    // NFT error counts by type
    metrics += `# HELP nft_errors_total Total number of NFT errors by error type\n`;
    metrics += `# TYPE nft_errors_total counter\n`;
    Object.entries(healthStatus.errorBreakdown).forEach(([errorType, count]) => {
      metrics += `nft_errors_total{error_type="${errorType}"} ${count}\n`;
    });
    metrics += '\n';
    
    // NFT service health status
    metrics += `# HELP nft_service_health Health status of NFT service (1=healthy, 0.5=degraded, 0=unhealthy)\n`;
    metrics += `# TYPE nft_service_health gauge\n`;
    const healthValue = healthStatus.status === 'healthy' ? 1 : healthStatus.status === 'degraded' ? 0.5 : 0;
    metrics += `nft_service_health ${healthValue}\n\n`;
    
    // Consecutive failures
    metrics += `# HELP nft_consecutive_failures Number of consecutive NFT operation failures\n`;
    metrics += `# TYPE nft_consecutive_failures gauge\n`;
    metrics += `nft_consecutive_failures ${this.consecutiveFailures}\n\n`;
    
    return metrics;
  }

  /**
   * Check alert conditions and trigger alerts if necessary
   */
  private checkAlertConditions(metric: NFTOperationMetrics, error?: HederaErrorDetails): void {
    const now = new Date();
    
    // Check error rate threshold
    const healthStatus = this.getHealthStatus();
    if (healthStatus.errorRate > this.alertConfig.errorRateThreshold) {
      this.triggerAlert(
        'error_rate',
        healthStatus.errorRate > this.alertConfig.errorRateThreshold * 2 ? 'critical' : 'warning',
        `NFT error rate (${healthStatus.errorRate.toFixed(1)}%) exceeds threshold (${this.alertConfig.errorRateThreshold}%)`,
        {
          currentValue: healthStatus.errorRate,
          threshold: this.alertConfig.errorRateThreshold,
        },
        { operationType: metric.operationType }
      );
    }
    
    // Check response time threshold
    if (metric.duration > this.alertConfig.responseTimeThreshold) {
      this.triggerAlert(
        'response_time',
        metric.duration > this.alertConfig.responseTimeThreshold * 2 ? 'critical' : 'warning',
        `NFT operation response time (${metric.duration}ms) exceeds threshold (${this.alertConfig.responseTimeThreshold}ms)`,
        {
          currentValue: metric.duration,
          threshold: this.alertConfig.responseTimeThreshold,
          operationType: metric.operationType,
        },
        metric.context
      );
    }
    
    // Check consecutive failures
    if (this.consecutiveFailures >= this.alertConfig.consecutiveFailuresThreshold) {
      this.triggerAlert(
        'consecutive_failures',
        'critical',
        `${this.consecutiveFailures} consecutive NFT operation failures detected`,
        {
          currentValue: this.consecutiveFailures,
          threshold: this.alertConfig.consecutiveFailuresThreshold,
        },
        { lastError: error?.errorType }
      );
    }
  }

  /**
   * Trigger an alert if not in cooldown period
   */
  private triggerAlert(
    type: NFTAlert['type'],
    severity: NFTAlert['severity'],
    message: string,
    metrics: NFTAlert['metrics'],
    context: Record<string, any>
  ): void {
    const alertKey = `${type}_${severity}`;
    const lastAlert = this.lastAlertTime.get(alertKey);
    const now = new Date();
    
    // Check cooldown period
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.alertConfig.alertCooldownPeriod) {
      return;
    }
    
    const alert: NFTAlert = {
      id: `nft_${type}_${Date.now()}`,
      type,
      severity,
      message,
      timestamp: now,
      metrics,
      context,
    };
    
    this.alerts.push(alert);
    this.lastAlertTime.set(alertKey, now);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
    
    // Log alert
    logger.warn('NFT monitoring alert triggered', {
      alert,
      category: 'nft_monitoring',
    });
    
    // Emit alert event for external systems
    this.emitAlertEvent(alert);
  }

  /**
   * Emit alert event for external monitoring systems
   */
  private emitAlertEvent(alert: NFTAlert): void {
    // This could integrate with external alerting systems like:
    // - Slack webhooks
    // - PagerDuty
    // - Email notifications
    // - Custom webhook endpoints
    
    logger.info('NFT alert event emitted', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * Log metrics in structured format for external monitoring systems
   */
  private logMetricsForExport(metric: NFTOperationMetrics, error?: HederaErrorDetails): void {
    logger.info('NFT operation metric', {
      category: 'nft_metrics',
      operationType: metric.operationType,
      success: metric.success,
      duration: metric.duration,
      errorType: error?.errorType,
      errorCode: error?.errorCode,
      timestamp: metric.timestamp.toISOString(),
      context: metric.context,
    });
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600000);
    const initialCount = this.metrics.length;
    
    this.metrics = this.metrics.filter(m => m.timestamp >= oneWeekAgo);
    
    const removedCount = initialCount - this.metrics.length;
    if (removedCount > 0) {
      logger.debug('Cleaned up old NFT metrics', { removedCount, remainingCount: this.metrics.length });
    }
  }
}