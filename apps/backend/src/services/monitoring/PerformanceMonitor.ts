import { Pool } from 'pg';
import { RedisService } from '../../database/cache/RedisService';
import { logger } from '../../utils/logger';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  database: {
    connectionCount: number;
    queryCount: number;
    slowQueryCount: number;
    averageQueryTime: number;
    tableSize: Record<string, number>;
  };
  cache: {
    hitRate: number;
    memoryUsage: number;
    keyCount: number;
    evictionCount: number;
  };
  application: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    uptime: number;
    requestCount: number;
    errorCount: number;
  };
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  timestamp: Date;
}

export class PerformanceMonitor {
  private pool: Pool;
  private redis: RedisService;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private alerts: PerformanceAlert[] = [];
  private thresholds: Map<string, { warning: number; critical: number }> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor(pool: Pool, redis: RedisService) {
    this.pool = pool;
    this.redis = redis;
    this.setupDefaultThresholds();
  }

  /**
   * Start performance monitoring
   */
  startMonitoring(intervalMs: number = 60000): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
        await this.checkThresholds();
      } catch (error) {
        logger.error('Performance monitoring failed', { error });
      }
    }, intervalMs);

    logger.info('Performance monitoring started', { intervalMs });
  }

  /**
   * Stop performance monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    logger.info('Performance monitoring stopped');
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, unit: string = 'ms', metadata?: Record<string, any>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata,
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 1000 metrics per type
    if (metricHistory.length > 1000) {
      metricHistory.shift();
    }

    // Log to database for persistence
    this.persistMetric(metric).catch(error => {
      logger.warn('Failed to persist metric', { error, metric });
    });
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const [databaseMetrics, cacheMetrics, applicationMetrics] = await Promise.all([
      this.getDatabaseMetrics(),
      this.getCacheMetrics(),
      this.getApplicationMetrics(),
    ]);

    return {
      database: databaseMetrics,
      cache: cacheMetrics,
      application: applicationMetrics,
    };
  }

  /**
   * Get metric history
   */
  getMetricHistory(name: string, limit: number = 100): PerformanceMetric[] {
    const history = this.metrics.get(name) || [];
    return history.slice(-limit);
  }

  /**
   * Get performance alerts
   */
  getAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Set performance threshold
   */
  setThreshold(metric: string, warning: number, critical: number): void {
    this.thresholds.set(metric, { warning, critical });
    logger.info('Performance threshold set', { metric, warning, critical });
  }

  /**
   * Analyze query performance
   */
  async analyzeQueryPerformance(query: string, params: any[] = []): Promise<{
    executionTime: number;
    planningTime: number;
    totalCost: number;
    suggestions: string[];
  }> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await this.pool.query(explainQuery, params);
      
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      const analysis = {
        executionTime: plan['Execution Time'],
        planningTime: plan['Planning Time'],
        totalCost: plan['Total Cost'],
        suggestions: this.generateOptimizationSuggestions(plan),
      };

      // Record the metric
      this.recordMetric('query_execution_time', analysis.executionTime, 'ms', {
        query: query.substring(0, 100),
        totalCost: analysis.totalCost,
      });

      return analysis;
    } catch (error) {
      logger.error('Query analysis failed', { error });
      throw error;
    }
  }

  /**
   * Get database performance statistics
   */
  async getDatabaseStats(): Promise<{
    tableStats: any[];
    indexStats: any[];
    slowQueries: any[];
  }> {
    try {
      const [tableStats, indexStats, slowQueries] = await Promise.all([
        this.getTableStats(),
        this.getIndexStats(),
        this.getSlowQueries(),
      ]);

      return {
        tableStats,
        indexStats,
        slowQueries,
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      throw error;
    }
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(): Promise<{
    summary: {
      averageResponseTime: number;
      errorRate: number;
      cacheHitRate: number;
      databaseConnections: number;
    };
    trends: {
      responseTimeTrend: 'improving' | 'degrading' | 'stable';
      errorRateTrend: 'improving' | 'degrading' | 'stable';
      cachePerformanceTrend: 'improving' | 'degrading' | 'stable';
    };
    recommendations: string[];
    alerts: PerformanceAlert[];
  }> {
    try {
      const systemMetrics = await this.getSystemMetrics();
      const responseTimeHistory = this.getMetricHistory('response_time', 100);
      const errorHistory = this.getMetricHistory('error_count', 100);

      const summary = {
        averageResponseTime: this.calculateAverage(responseTimeHistory),
        errorRate: this.calculateErrorRate(),
        cacheHitRate: systemMetrics.cache.hitRate,
        databaseConnections: systemMetrics.database.connectionCount,
      };

      const trends = {
        responseTimeTrend: this.analyzeTrend(responseTimeHistory),
        errorRateTrend: this.analyzeTrend(errorHistory),
        cachePerformanceTrend: this.analyzeCacheTrend(),
      };

      const recommendations = this.generateRecommendations(systemMetrics, trends);

      return {
        summary,
        trends,
        recommendations,
        alerts: this.getAlerts(10),
      };
    } catch (error) {
      logger.error('Failed to generate performance report', { error });
      throw error;
    }
  }

  /**
   * Collect system metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      const systemMetrics = await this.getSystemMetrics();

      // Record database metrics
      this.recordMetric('db_connection_count', systemMetrics.database.connectionCount, 'count');
      this.recordMetric('db_query_count', systemMetrics.database.queryCount, 'count');
      this.recordMetric('db_avg_query_time', systemMetrics.database.averageQueryTime, 'ms');

      // Record cache metrics
      this.recordMetric('cache_hit_rate', systemMetrics.cache.hitRate, 'percentage');
      this.recordMetric('cache_memory_usage', systemMetrics.cache.memoryUsage, 'bytes');
      this.recordMetric('cache_key_count', systemMetrics.cache.keyCount, 'count');

      // Record application metrics
      this.recordMetric('app_memory_usage', systemMetrics.application.memoryUsage.heapUsed, 'bytes');
      this.recordMetric('app_uptime', systemMetrics.application.uptime, 'seconds');

      logger.debug('System metrics collected');
    } catch (error) {
      logger.error('Failed to collect metrics', { error });
    }
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private async checkThresholds(): Promise<void> {
    for (const [metricName, history] of this.metrics.entries()) {
      if (history.length === 0) continue;

      const threshold = this.thresholds.get(metricName);
      if (!threshold) continue;

      const latestMetric = history[history.length - 1];
      const currentValue = latestMetric.value;

      if (currentValue >= threshold.critical) {
        this.addAlert('critical', metricName, threshold.critical, currentValue);
      } else if (currentValue >= threshold.warning) {
        this.addAlert('warning', metricName, threshold.warning, currentValue);
      }
    }
  }

  /**
   * Add performance alert
   */
  private addAlert(type: 'warning' | 'critical', metric: string, threshold: number, currentValue: number): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      threshold,
      currentValue,
      message: `${metric} ${type}: ${currentValue} exceeds threshold of ${threshold}`,
      timestamp: new Date(),
    };

    this.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    logger.warn('Performance alert generated', alert);
  }

  /**
   * Setup default performance thresholds
   */
  private setupDefaultThresholds(): void {
    this.setThreshold('response_time', 500, 1000); // ms
    this.setThreshold('db_avg_query_time', 100, 500); // ms
    this.setThreshold('cache_hit_rate', 80, 60); // percentage (lower is worse)
    this.setThreshold('app_memory_usage', 500 * 1024 * 1024, 1024 * 1024 * 1024); // bytes
    this.setThreshold('error_rate', 5, 10); // percentage
  }

  /**
   * Get database metrics
   */
  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    try {
      const connectionQuery = `
        SELECT count(*) as connection_count
        FROM pg_stat_activity
        WHERE state = 'active'
      `;

      const statsQuery = `
        SELECT 
          sum(calls) as query_count,
          avg(mean_exec_time) as avg_query_time,
          count(CASE WHEN mean_exec_time > 1000 THEN 1 END) as slow_query_count
        FROM pg_stat_statements
        WHERE calls > 0
      `;

      const tableSizeQuery = `
        SELECT 
          schemaname,
          tablename,
          pg_total_relation_size(schemaname||'.'||tablename) as size
        FROM pg_tables
        WHERE schemaname = 'public'
      `;

      const [connectionResult, statsResult, tableSizeResult] = await Promise.all([
        this.pool.query(connectionQuery).catch(() => ({ rows: [{ connection_count: 0 }] })),
        this.pool.query(statsQuery).catch(() => ({ rows: [{ query_count: 0, avg_query_time: 0, slow_query_count: 0 }] })),
        this.pool.query(tableSizeQuery).catch(() => ({ rows: [] })),
      ]);

      const tableSize: Record<string, number> = {};
      tableSizeResult.rows.forEach(row => {
        tableSize[row.tablename] = parseInt(row.size);
      });

      return {
        connectionCount: parseInt(connectionResult.rows[0].connection_count),
        queryCount: parseInt(statsResult.rows[0].query_count || '0'),
        slowQueryCount: parseInt(statsResult.rows[0].slow_query_count || '0'),
        averageQueryTime: parseFloat(statsResult.rows[0].avg_query_time || '0'),
        tableSize,
      };
    } catch (error) {
      logger.error('Failed to get database metrics', { error });
      return {
        connectionCount: 0,
        queryCount: 0,
        slowQueryCount: 0,
        averageQueryTime: 0,
        tableSize: {},
      };
    }
  }

  /**
   * Get cache metrics
   */
  private async getCacheMetrics(): Promise<SystemMetrics['cache']> {
    try {
      // This would require implementing cache statistics in RedisService
      // For now, return mock data
      return {
        hitRate: 85,
        memoryUsage: 50 * 1024 * 1024, // 50MB
        keyCount: 1000,
        evictionCount: 10,
      };
    } catch (error) {
      logger.error('Failed to get cache metrics', { error });
      return {
        hitRate: 0,
        memoryUsage: 0,
        keyCount: 0,
        evictionCount: 0,
      };
    }
  }

  /**
   * Get application metrics
   */
  private getApplicationMetrics(): SystemMetrics['application'] {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
      uptime: process.uptime(),
      requestCount: 0, // Would need to be tracked separately
      errorCount: 0, // Would need to be tracked separately
    };
  }

  /**
   * Persist metric to database
   */
  private async persistMetric(metric: PerformanceMetric): Promise<void> {
    try {
      const query = `
        INSERT INTO performance_stats (metric_name, metric_value, metadata, recorded_at)
        VALUES ($1, $2, $3, $4)
      `;
      
      await this.pool.query(query, [
        metric.name,
        metric.value,
        JSON.stringify(metric.metadata || {}),
        metric.timestamp,
      ]);
    } catch (error) {
      // Don't throw error to avoid affecting main application
      logger.debug('Failed to persist metric', { error, metric: metric.name });
    }
  }

  /**
   * Generate optimization suggestions based on query plan
   */
  private generateOptimizationSuggestions(plan: any): string[] {
    const suggestions: string[] = [];

    if (this.hasSequentialScan(plan)) {
      suggestions.push('Consider adding indexes for columns used in WHERE clauses');
    }

    if (plan['Total Cost'] > 1000) {
      suggestions.push('Query has high cost - consider query restructuring or additional indexes');
    }

    if (plan['Plan Rows'] > plan['Actual Rows'] * 10) {
      suggestions.push('Statistics may be outdated - consider running ANALYZE on affected tables');
    }

    return suggestions;
  }

  /**
   * Check if query plan contains sequential scans
   */
  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }

    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasSequentialScan(subPlan));
    }

    return false;
  }

  /**
   * Calculate average from metric history
   */
  private calculateAverage(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    // This would need to be implemented based on actual error tracking
    return 0;
  }

  /**
   * Analyze trend from metric history
   */
  private analyzeTrend(metrics: PerformanceMetric[]): 'improving' | 'degrading' | 'stable' {
    if (metrics.length < 10) return 'stable';

    const recent = metrics.slice(-5);
    const older = metrics.slice(-10, -5);

    const recentAvg = this.calculateAverage(recent);
    const olderAvg = this.calculateAverage(older);

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'degrading';
    if (change < -0.1) return 'improving';
    return 'stable';
  }

  /**
   * Analyze cache performance trend
   */
  private analyzeCacheTrend(): 'improving' | 'degrading' | 'stable' {
    const hitRateHistory = this.getMetricHistory('cache_hit_rate', 10);
    return this.analyzeTrend(hitRateHistory);
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: SystemMetrics, trends: any): string[] {
    const recommendations: string[] = [];

    if (metrics.cache.hitRate < 80) {
      recommendations.push('Cache hit rate is low - consider increasing cache TTL or warming strategies');
    }

    if (metrics.database.averageQueryTime > 100) {
      recommendations.push('Average query time is high - consider adding indexes or optimizing queries');
    }

    if (trends.responseTimeTrend === 'degrading') {
      recommendations.push('Response times are degrading - investigate recent changes and optimize bottlenecks');
    }

    if (metrics.application.memoryUsage.heapUsed > 500 * 1024 * 1024) {
      recommendations.push('Memory usage is high - consider implementing memory optimization strategies');
    }

    return recommendations;
  }

  /**
   * Get table statistics
   */
  private async getTableStats(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch
        FROM pg_stat_user_tables
        ORDER BY seq_scan DESC
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get table stats', { error });
      return [];
    }
  }

  /**
   * Get index statistics
   */
  private async getIndexStats(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        ORDER BY schemaname, tablename
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get index stats', { error });
      return [];
    }
  }

  /**
   * Get slow queries
   */
  private async getSlowQueries(): Promise<any[]> {
    try {
      const query = `
        SELECT 
          query,
          calls,
          total_exec_time,
          mean_exec_time,
          max_exec_time,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > 100
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;

      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get slow queries', { error });
      return [];
    }
  }
}