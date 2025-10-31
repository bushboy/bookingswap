import { SwapMatchingQueryOptimizer } from '../../database/optimizations/SwapMatchingQueryOptimizer';
import { SwapMatchingCacheService } from './SwapMatchingCacheService';
import { getCachePerformanceThresholds, CachePerformanceThresholds } from './cache-config';
import { logger } from '../../utils/logger';

export interface PerformanceAlert {
  type: 'slow_query' | 'low_cache_hit_rate' | 'high_memory_usage' | 'database_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
}

export interface PerformanceMetrics {
  queryPerformance: {
    avgExecutionTime: number;
    slowQueriesCount: number;
    totalQueries: number;
  };
  cachePerformance: {
    hitRate: number;
    memoryUsage: number;
    keyCount: number;
  };
  databasePerformance: {
    connectionCount: number;
    indexUsage: number;
    tableSize: string;
  };
}

export class SwapMatchingPerformanceMonitor {
  private queryOptimizer: SwapMatchingQueryOptimizer;
  private cacheService: SwapMatchingCacheService;
  private thresholds: CachePerformanceThresholds;
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor(
    queryOptimizer: SwapMatchingQueryOptimizer,
    cacheService: SwapMatchingCacheService
  ) {
    this.queryOptimizer = queryOptimizer;
    this.cacheService = cacheService;
    this.thresholds = getCachePerformanceThresholds();
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(intervalMinutes: number = 5): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const intervalMs = intervalMinutes * 60 * 1000;

    logger.info('Starting swap matching performance monitoring', { intervalMinutes });

    // Initial performance check
    await this.performHealthCheck();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Performance monitoring check failed', { error });
      }
    }, intervalMs);

    // Set up query performance monitoring
    this.queryOptimizer.monitorQueryPerformance((metrics) => {
      this.handleQueryPerformanceMetrics(metrics);
    });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    this.isMonitoring = false;
    logger.info('Stopped swap matching performance monitoring');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: PerformanceMetrics;
    alerts: PerformanceAlert[];
  }> {
    try {
      logger.debug('Performing swap matching health check');

      // Get performance metrics
      const [queryAnalysis, cacheStats, databaseStats] = await Promise.all([
        this.queryOptimizer.analyzeQueryPerformance(undefined, 1), // Last hour
        this.cacheService.getCacheStats(),
        this.queryOptimizer.getDatabaseStats()
      ]);

      // Calculate overall metrics
      const metrics: PerformanceMetrics = {
        queryPerformance: {
          avgExecutionTime: queryAnalysis.metrics.reduce((sum, m) => sum + parseFloat(m.avg_execution_time), 0) / Math.max(queryAnalysis.metrics.length, 1),
          slowQueriesCount: queryAnalysis.metrics.filter(m => parseFloat(m.avg_execution_time) > 1000).length,
          totalQueries: queryAnalysis.metrics.reduce((sum, m) => sum + parseInt(m.execution_count), 0)
        },
        cachePerformance: {
          hitRate: cacheStats.hitRate,
          memoryUsage: 0, // Would need to be implemented in cache service
          keyCount: 0 // Would need to be implemented in cache service
        },
        databasePerformance: {
          connectionCount: 0, // Would need to be implemented
          indexUsage: this.calculateIndexUsage(databaseStats.indexStats),
          tableSize: databaseStats.tableStats.find(t => t.tablename === 'swaps')?.size || '0'
        }
      };

      // Check for performance issues and generate alerts
      const newAlerts = this.analyzePerformanceMetrics(metrics, queryAnalysis.recommendations);
      
      // Add new alerts
      for (const alert of newAlerts) {
        this.addAlert(alert);
      }

      // Determine overall status
      const criticalAlerts = this.alerts.filter(a => !a.resolved && a.severity === 'critical');
      const highAlerts = this.alerts.filter(a => !a.resolved && a.severity === 'high');
      
      let status: 'healthy' | 'warning' | 'critical';
      if (criticalAlerts.length > 0) {
        status = 'critical';
      } else if (highAlerts.length > 0) {
        status = 'critical';
      } else if (this.alerts.filter(a => !a.resolved).length > 0) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      logger.info('Health check completed', {
        status,
        totalAlerts: this.alerts.filter(a => !a.resolved).length,
        avgQueryTime: metrics.queryPerformance.avgExecutionTime,
        cacheHitRate: metrics.cachePerformance.hitRate
      });

      return {
        status,
        metrics,
        alerts: this.alerts.filter(a => !a.resolved)
      };
    } catch (error) {
      logger.error('Health check failed', { error });
      
      // Create critical alert for health check failure
      this.addAlert({
        type: 'database_issue',
        severity: 'critical',
        message: 'Health check failed',
        details: { error: error.message },
        timestamp: new Date(),
        resolved: false
      });

      throw error;
    }
  }

  /**
   * Handle query performance metrics from real-time monitoring
   */
  private handleQueryPerformanceMetrics(metrics: any): void {
    // Check for slow queries
    if (metrics.executionTimeMs > this.thresholds.maxResponseTime) {
      this.addAlert({
        type: 'slow_query',
        severity: metrics.executionTimeMs > this.thresholds.maxResponseTime * 2 ? 'high' : 'medium',
        message: `Slow ${metrics.queryType} query detected`,
        details: {
          executionTime: metrics.executionTimeMs,
          threshold: this.thresholds.maxResponseTime,
          parameters: metrics.parameters,
          userId: metrics.userId
        },
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  /**
   * Analyze performance metrics and generate alerts
   */
  private analyzePerformanceMetrics(
    metrics: PerformanceMetrics,
    recommendations: any[]
  ): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];

    // Check query performance
    if (metrics.queryPerformance.avgExecutionTime > this.thresholds.maxResponseTime) {
      alerts.push({
        type: 'slow_query',
        severity: metrics.queryPerformance.avgExecutionTime > this.thresholds.maxResponseTime * 2 ? 'high' : 'medium',
        message: `Average query execution time is ${metrics.queryPerformance.avgExecutionTime.toFixed(0)}ms`,
        details: {
          avgExecutionTime: metrics.queryPerformance.avgExecutionTime,
          threshold: this.thresholds.maxResponseTime,
          slowQueriesCount: metrics.queryPerformance.slowQueriesCount
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check cache performance
    if (metrics.cachePerformance.hitRate < this.thresholds.minHitRate) {
      alerts.push({
        type: 'low_cache_hit_rate',
        severity: metrics.cachePerformance.hitRate < this.thresholds.minHitRate * 0.5 ? 'high' : 'medium',
        message: `Cache hit rate is ${metrics.cachePerformance.hitRate.toFixed(1)}%`,
        details: {
          hitRate: metrics.cachePerformance.hitRate,
          threshold: this.thresholds.minHitRate,
          memoryUsage: metrics.cachePerformance.memoryUsage
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check memory usage
    if (metrics.cachePerformance.memoryUsage > this.thresholds.maxMemoryUsage * 1024 * 1024) {
      alerts.push({
        type: 'high_memory_usage',
        severity: metrics.cachePerformance.memoryUsage > this.thresholds.maxMemoryUsage * 1024 * 1024 * 1.5 ? 'high' : 'medium',
        message: `High cache memory usage: ${(metrics.cachePerformance.memoryUsage / 1024 / 1024).toFixed(0)}MB`,
        details: {
          memoryUsage: metrics.cachePerformance.memoryUsage,
          threshold: this.thresholds.maxMemoryUsage * 1024 * 1024,
          keyCount: metrics.cachePerformance.keyCount
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    // Check database performance
    if (metrics.databasePerformance.indexUsage < 80) {
      alerts.push({
        type: 'database_issue',
        severity: metrics.databasePerformance.indexUsage < 50 ? 'high' : 'medium',
        message: `Low index usage: ${metrics.databasePerformance.indexUsage.toFixed(1)}%`,
        details: {
          indexUsage: metrics.databasePerformance.indexUsage,
          tableSize: metrics.databasePerformance.tableSize,
          connectionCount: metrics.databasePerformance.connectionCount
        },
        timestamp: new Date(),
        resolved: false
      });
    }

    return alerts;
  }

  /**
   * Calculate index usage percentage from database stats
   */
  private calculateIndexUsage(indexStats: any[]): number {
    if (!indexStats || indexStats.length === 0) {
      return 0;
    }

    const totalScans = indexStats.reduce((sum, stat) => sum + (stat.idx_scan || 0), 0);
    const totalReads = indexStats.reduce((sum, stat) => sum + (stat.seq_scan || 0) + (stat.idx_scan || 0), 0);

    return totalReads > 0 ? (totalScans / totalReads) * 100 : 0;
  }

  /**
   * Add a new alert
   */
  private addAlert(alert: PerformanceAlert): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(a => 
      !a.resolved && 
      a.type === alert.type && 
      a.message === alert.message
    );

    if (!existingAlert) {
      this.alerts.push(alert);
      logger.warn('Performance alert generated', {
        type: alert.type,
        severity: alert.severity,
        message: alert.message
      });
    }
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertIndex: number): void {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      this.alerts[alertIndex].resolved = true;
      logger.info('Performance alert resolved', {
        type: this.alerts[alertIndex].type,
        message: this.alerts[alertIndex].message
      });
    }
  }

  /**
   * Get current alerts
   */
  getAlerts(includeResolved: boolean = false): PerformanceAlert[] {
    return includeResolved ? this.alerts : this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<{
    status: string;
    uptime: number;
    activeAlerts: number;
    lastHealthCheck: Date | null;
    recommendations: string[];
  }> {
    try {
      const healthCheck = await this.performHealthCheck();
      
      return {
        status: healthCheck.status,
        uptime: this.isMonitoring ? Date.now() : 0,
        activeAlerts: healthCheck.alerts.length,
        lastHealthCheck: new Date(),
        recommendations: [
          'Monitor query performance regularly',
          'Optimize slow queries with proper indexing',
          'Maintain cache hit rate above 70%',
          'Clean expired cache entries periodically'
        ]
      };
    } catch (error) {
      logger.error('Failed to get performance summary', { error });
      return {
        status: 'error',
        uptime: 0,
        activeAlerts: this.alerts.filter(a => !a.resolved).length,
        lastHealthCheck: null,
        recommendations: ['Fix monitoring system issues']
      };
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(timeRangeHours: number = 24): Promise<{
    summary: any;
    queryAnalysis: any;
    cacheAnalysis: any;
    alerts: PerformanceAlert[];
    recommendations: string[];
  }> {
    try {
      const [queryReport, cacheStats] = await Promise.all([
        this.queryOptimizer.generatePerformanceReport(timeRangeHours),
        this.cacheService.getCacheStats()
      ]);

      const summary = {
        timeRange: `${timeRangeHours} hours`,
        monitoringStatus: this.isMonitoring ? 'active' : 'inactive',
        totalAlerts: this.alerts.length,
        resolvedAlerts: this.alerts.filter(a => a.resolved).length,
        activeAlerts: this.alerts.filter(a => !a.resolved).length
      };

      const recommendations = [
        ...queryReport.recommendations.map(r => r.description),
        'Implement automated cache warming for frequently accessed data',
        'Set up alerting for performance degradation',
        'Regular database maintenance and optimization'
      ];

      return {
        summary,
        queryAnalysis: queryReport,
        cacheAnalysis: cacheStats,
        alerts: this.alerts,
        recommendations
      };
    } catch (error) {
      logger.error('Failed to generate performance report', { error });
      throw error;
    }
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<{
    optimizationsApplied: string[];
    results: any;
  }> {
    try {
      logger.info('Starting performance optimization');

      const optimizationsApplied: string[] = [];
      const results: any = {};

      // Clean expired cache entries
      const cacheCleanup = await this.cacheService.cleanup();
      optimizationsApplied.push('Cleaned expired cache entries');
      results.cacheCleanup = cacheCleanup;

      // Optimize database tables
      const dbOptimization = await this.queryOptimizer.optimizeTables();
      optimizationsApplied.push('Optimized database tables and indexes');
      results.databaseOptimization = dbOptimization;

      // Clean query optimizer cache
      const queryCleanup = await this.queryOptimizer.cleanCache();
      optimizationsApplied.push('Cleaned query optimizer cache');
      results.queryCleanup = queryCleanup;

      logger.info('Performance optimization completed', {
        optimizationsApplied,
        results
      });

      return {
        optimizationsApplied,
        results
      };
    } catch (error) {
      logger.error('Performance optimization failed', { error });
      throw error;
    }
  }

  /**
   * Check if monitoring is active
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats(): {
    isActive: boolean;
    totalAlerts: number;
    activeAlerts: number;
    alertsByType: Record<string, number>;
    alertsBySeverity: Record<string, number>;
  } {
    const alertsByType = this.alerts.reduce((acc, alert) => {
      acc[alert.type] = (acc[alert.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const alertsBySeverity = this.alerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      isActive: this.isMonitoring,
      totalAlerts: this.alerts.length,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      alertsByType,
      alertsBySeverity
    };
  }
}