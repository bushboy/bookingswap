import { logger } from '../../utils/logger';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  cacheHit?: boolean;
  optimizationUsed?: string;
  metadata?: any;
}

export interface DatabasePerformanceMetrics {
  queryName: string;
  duration: number;
  rowsAffected: number;
  indexesUsed: string[];
  optimizationApplied: boolean;
}

export interface CachePerformanceMetrics {
  operation: string;
  cacheType: 'memory' | 'redis' | 'hybrid';
  hit: boolean;
  duration: number;
  keySize?: number;
  valueSize?: number;
}

export interface EmailPerformanceMetrics {
  templateType: string;
  renderDuration: number;
  sendDuration: number;
  templateCached: boolean;
  compressionUsed: boolean;
  templateSize: number;
}

export class PasswordRecoveryPerformanceMonitor {
  private static instance: PasswordRecoveryPerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private dbMetrics: DatabasePerformanceMetrics[] = [];
  private cacheMetrics: CachePerformanceMetrics[] = [];
  private emailMetrics: EmailPerformanceMetrics[] = [];
  private maxMetricsHistory = 1000;

  private constructor() {
    // Clean up old metrics every 5 minutes
    setInterval(() => this.cleanupOldMetrics(), 5 * 60 * 1000);
  }

  static getInstance(): PasswordRecoveryPerformanceMonitor {
    if (!PasswordRecoveryPerformanceMonitor.instance) {
      PasswordRecoveryPerformanceMonitor.instance = new PasswordRecoveryPerformanceMonitor();
    }
    return PasswordRecoveryPerformanceMonitor.instance;
  }

  /**
   * Log general performance metrics
   */
  logPerformanceMetric(metric: PerformanceMetrics): void {
    this.metrics.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      logger.warn('Slow password recovery operation detected', {
        operation: metric.operation,
        duration: metric.duration,
        success: metric.success,
        cacheHit: metric.cacheHit,
        optimizationUsed: metric.optimizationUsed,
      });
    }
  }

  /**
   * Log database performance metrics
   */
  logDatabasePerformance(metric: DatabasePerformanceMetrics): void {
    this.dbMetrics.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    if (this.dbMetrics.length > this.maxMetricsHistory) {
      this.dbMetrics = this.dbMetrics.slice(-this.maxMetricsHistory);
    }

    // Log slow queries
    if (metric.duration > 100) { // > 100ms
      logger.warn('Slow database query in password recovery', {
        queryName: metric.queryName,
        duration: metric.duration,
        rowsAffected: metric.rowsAffected,
        indexesUsed: metric.indexesUsed,
        optimizationApplied: metric.optimizationApplied,
      });
    }
  }

  /**
   * Log cache performance metrics
   */
  logCachePerformance(metric: CachePerformanceMetrics): void {
    this.cacheMetrics.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    if (this.cacheMetrics.length > this.maxMetricsHistory) {
      this.cacheMetrics = this.cacheMetrics.slice(-this.maxMetricsHistory);
    }

    // Log cache misses for frequently accessed data
    if (!metric.hit && metric.operation.includes('rate_limit')) {
      logger.debug('Cache miss for rate limiting', {
        operation: metric.operation,
        cacheType: metric.cacheType,
        duration: metric.duration,
      });
    }
  }

  /**
   * Log email performance metrics
   */
  logEmailPerformance(metric: EmailPerformanceMetrics): void {
    this.emailMetrics.push({
      ...metric,
      timestamp: Date.now(),
    } as any);

    if (this.emailMetrics.length > this.maxMetricsHistory) {
      this.emailMetrics = this.emailMetrics.slice(-this.maxMetricsHistory);
    }

    // Log slow email operations
    if (metric.renderDuration + metric.sendDuration > 5000) { // > 5 seconds
      logger.warn('Slow email operation in password recovery', {
        templateType: metric.templateType,
        renderDuration: metric.renderDuration,
        sendDuration: metric.sendDuration,
        templateCached: metric.templateCached,
        compressionUsed: metric.compressionUsed,
        templateSize: metric.templateSize,
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    general: any;
    database: any;
    cache: any;
    email: any;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Filter recent metrics
    const recentMetrics = this.metrics.filter((m: any) => m.timestamp > oneHourAgo);
    const recentDbMetrics = this.dbMetrics.filter((m: any) => m.timestamp > oneHourAgo);
    const recentCacheMetrics = this.cacheMetrics.filter((m: any) => m.timestamp > oneHourAgo);
    const recentEmailMetrics = this.emailMetrics.filter((m: any) => m.timestamp > oneHourAgo);

    return {
      general: {
        totalOperations: recentMetrics.length,
        successRate: recentMetrics.length > 0 
          ? (recentMetrics.filter(m => m.success).length / recentMetrics.length) * 100 
          : 0,
        avgDuration: recentMetrics.length > 0
          ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
          : 0,
        cacheHitRate: recentMetrics.filter(m => m.cacheHit !== undefined).length > 0
          ? (recentMetrics.filter(m => m.cacheHit === true).length / 
             recentMetrics.filter(m => m.cacheHit !== undefined).length) * 100
          : 0,
        optimizationsUsed: this.getOptimizationUsageStats(recentMetrics),
      },
      database: {
        totalQueries: recentDbMetrics.length,
        avgDuration: recentDbMetrics.length > 0
          ? recentDbMetrics.reduce((sum, m) => sum + m.duration, 0) / recentDbMetrics.length
          : 0,
        optimizationRate: recentDbMetrics.length > 0
          ? (recentDbMetrics.filter(m => m.optimizationApplied).length / recentDbMetrics.length) * 100
          : 0,
        slowQueries: recentDbMetrics.filter(m => m.duration > 100).length,
        indexUsage: this.getIndexUsageStats(recentDbMetrics),
      },
      cache: {
        totalOperations: recentCacheMetrics.length,
        hitRate: recentCacheMetrics.length > 0
          ? (recentCacheMetrics.filter(m => m.hit).length / recentCacheMetrics.length) * 100
          : 0,
        avgDuration: recentCacheMetrics.length > 0
          ? recentCacheMetrics.reduce((sum, m) => sum + m.duration, 0) / recentCacheMetrics.length
          : 0,
        cacheTypeDistribution: this.getCacheTypeDistribution(recentCacheMetrics),
      },
      email: {
        totalEmails: recentEmailMetrics.length,
        avgRenderDuration: recentEmailMetrics.length > 0
          ? recentEmailMetrics.reduce((sum, m) => sum + m.renderDuration, 0) / recentEmailMetrics.length
          : 0,
        avgSendDuration: recentEmailMetrics.length > 0
          ? recentEmailMetrics.reduce((sum, m) => sum + m.sendDuration, 0) / recentEmailMetrics.length
          : 0,
        templateCacheRate: recentEmailMetrics.length > 0
          ? (recentEmailMetrics.filter(m => m.templateCached).length / recentEmailMetrics.length) * 100
          : 0,
        compressionRate: recentEmailMetrics.length > 0
          ? (recentEmailMetrics.filter(m => m.compressionUsed).length / recentEmailMetrics.length) * 100
          : 0,
        avgTemplateSize: recentEmailMetrics.length > 0
          ? recentEmailMetrics.reduce((sum, m) => sum + m.templateSize, 0) / recentEmailMetrics.length
          : 0,
      },
    };
  }

  /**
   * Get optimization usage statistics
   */
  private getOptimizationUsageStats(metrics: PerformanceMetrics[]): any {
    const optimizations: { [key: string]: number } = {};
    
    metrics.forEach(m => {
      if (m.optimizationUsed) {
        optimizations[m.optimizationUsed] = (optimizations[m.optimizationUsed] || 0) + 1;
      }
    });

    return optimizations;
  }

  /**
   * Get index usage statistics
   */
  private getIndexUsageStats(metrics: DatabasePerformanceMetrics[]): any {
    const indexUsage: { [key: string]: number } = {};
    
    metrics.forEach(m => {
      m.indexesUsed.forEach(index => {
        indexUsage[index] = (indexUsage[index] || 0) + 1;
      });
    });

    return indexUsage;
  }

  /**
   * Get cache type distribution
   */
  private getCacheTypeDistribution(metrics: CachePerformanceMetrics[]): any {
    const distribution: { [key: string]: number } = {};
    
    metrics.forEach(m => {
      distribution[m.cacheType] = (distribution[m.cacheType] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const stats = this.getPerformanceStats();
    
    return `
Password Recovery Performance Report
===================================

General Performance:
- Total Operations: ${stats.general.totalOperations}
- Success Rate: ${stats.general.successRate.toFixed(2)}%
- Average Duration: ${stats.general.avgDuration.toFixed(2)}ms
- Cache Hit Rate: ${stats.general.cacheHitRate.toFixed(2)}%

Database Performance:
- Total Queries: ${stats.database.totalQueries}
- Average Duration: ${stats.database.avgDuration.toFixed(2)}ms
- Optimization Rate: ${stats.database.optimizationRate.toFixed(2)}%
- Slow Queries: ${stats.database.slowQueries}

Cache Performance:
- Total Operations: ${stats.cache.totalOperations}
- Hit Rate: ${stats.cache.hitRate.toFixed(2)}%
- Average Duration: ${stats.cache.avgDuration.toFixed(2)}ms

Email Performance:
- Total Emails: ${stats.email.totalEmails}
- Average Render Duration: ${stats.email.avgRenderDuration.toFixed(2)}ms
- Average Send Duration: ${stats.email.avgSendDuration.toFixed(2)}ms
- Template Cache Rate: ${stats.email.templateCacheRate.toFixed(2)}%
- Compression Rate: ${stats.email.compressionRate.toFixed(2)}%
- Average Template Size: ${stats.email.avgTemplateSize.toFixed(0)} bytes

Recommendations:
${this.generateRecommendations(stats)}
    `.trim();
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(stats: any): string {
    const recommendations: string[] = [];

    // General recommendations
    if (stats.general.successRate < 95) {
      recommendations.push('- Success rate is below 95%. Investigate error patterns.');
    }
    if (stats.general.avgDuration > 2000) {
      recommendations.push('- Average operation duration is high. Consider additional optimizations.');
    }
    if (stats.general.cacheHitRate < 80) {
      recommendations.push('- Cache hit rate is low. Review caching strategy.');
    }

    // Database recommendations
    if (stats.database.optimizationRate < 90) {
      recommendations.push('- Database optimization rate is low. Ensure optimized queries are being used.');
    }
    if (stats.database.slowQueries > 0) {
      recommendations.push(`- ${stats.database.slowQueries} slow queries detected. Review query performance.`);
    }

    // Cache recommendations
    if (stats.cache.hitRate < 70) {
      recommendations.push('- Cache hit rate is low. Consider adjusting cache TTL or warming strategies.');
    }

    // Email recommendations
    if (stats.email.templateCacheRate < 80) {
      recommendations.push('- Email template cache rate is low. Ensure templates are being cached properly.');
    }
    if (stats.email.avgRenderDuration > 100) {
      recommendations.push('- Email template rendering is slow. Consider template optimization.');
    }

    return recommendations.length > 0 ? recommendations.join('\n') : '- No specific recommendations at this time.';
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    this.metrics = this.metrics.filter((m: any) => m.timestamp > oneHourAgo);
    this.dbMetrics = this.dbMetrics.filter((m: any) => m.timestamp > oneHourAgo);
    this.cacheMetrics = this.cacheMetrics.filter((m: any) => m.timestamp > oneHourAgo);
    this.emailMetrics = this.emailMetrics.filter((m: any) => m.timestamp > oneHourAgo);

    logger.debug('Performance metrics cleanup completed', {
      generalMetrics: this.metrics.length,
      dbMetrics: this.dbMetrics.length,
      cacheMetrics: this.cacheMetrics.length,
      emailMetrics: this.emailMetrics.length,
    });
  }

  /**
   * Reset all metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = [];
    this.dbMetrics = [];
    this.cacheMetrics = [];
    this.emailMetrics = [];
  }
}