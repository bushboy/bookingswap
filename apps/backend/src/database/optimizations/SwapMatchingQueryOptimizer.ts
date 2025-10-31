import { Pool } from 'pg';
import { logger } from '../../utils/logger';

export interface QueryPerformanceMetrics {
  queryType: string;
  executionTimeMs: number;
  resultCount: number;
  parameters?: Record<string, any>;
  userId?: string;
}

export interface OptimizationRecommendation {
  type: 'index' | 'query_rewrite' | 'cache' | 'partition';
  priority: 'high' | 'medium' | 'low';
  description: string;
  estimatedImpact: string;
  implementation: string;
}

export class SwapMatchingQueryOptimizer {
  private pool: Pool;
  private performanceThresholds = {
    eligibleSwapsQuery: 500, // ms
    compatibilityAnalysis: 200, // ms
    proposalLookup: 100, // ms
    browseQuery: 1000, // ms
  };

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Log query performance for analysis
   */
  async logQueryPerformance(metrics: QueryPerformanceMetrics): Promise<void> {
    try {
      const query = `
        SELECT log_swap_matching_query($1, $2, $3, $4, $5)
      `;

      await this.pool.query(query, [
        metrics.queryType,
        metrics.executionTimeMs,
        metrics.parameters ? JSON.stringify(metrics.parameters) : null,
        metrics.resultCount,
        metrics.userId || null
      ]);

      // Log warning if query exceeds threshold
      const threshold = this.performanceThresholds[metrics.queryType as keyof typeof this.performanceThresholds];
      if (threshold && metrics.executionTimeMs > threshold) {
        logger.warn('Slow query detected', {
          queryType: metrics.queryType,
          executionTime: metrics.executionTimeMs,
          threshold,
          parameters: metrics.parameters
        });
      }
    } catch (error) {
      logger.error('Failed to log query performance', { error, metrics });
    }
  }

  /**
   * Execute optimized eligible swaps query
   */
  async findEligibleSwapsOptimized(
    userId: string,
    targetSwapId: string,
    limit: number = 50
  ): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const query = `
        SELECT * FROM find_eligible_swaps_optimized($1, $2, $3)
      `;

      const result = await this.pool.query(query, [userId, targetSwapId, limit]);
      const executionTime = Date.now() - startTime;

      // Log performance
      await this.logQueryPerformance({
        queryType: 'eligibleSwapsQuery',
        executionTimeMs: executionTime,
        resultCount: result.rows.length,
        parameters: { userId, targetSwapId, limit },
        userId
      });

      return result.rows;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Optimized eligible swaps query failed', {
        error,
        userId,
        targetSwapId,
        executionTime
      });
      throw error;
    }
  }

  /**
   * Execute optimized proposal existence check
   */
  async hasExistingProposalOptimized(
    sourceSwapId: string,
    targetSwapId: string
  ): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      const query = `
        SELECT has_existing_proposal_optimized($1, $2) as exists
      `;

      const result = await this.pool.query(query, [sourceSwapId, targetSwapId]);
      const executionTime = Date.now() - startTime;

      // Log performance
      await this.logQueryPerformance({
        queryType: 'proposalLookup',
        executionTimeMs: executionTime,
        resultCount: 1,
        parameters: { sourceSwapId, targetSwapId }
      });

      return result.rows[0]?.exists || false;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Optimized proposal existence check failed', {
        error,
        sourceSwapId,
        targetSwapId,
        executionTime
      });
      throw error;
    }
  }

  /**
   * Execute batch compatibility analysis
   */
  async batchAnalyzeCompatibility(
    swapPairs: Array<{ sourceSwapId: string; targetSwapId: string }>
  ): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      const query = `
        SELECT * FROM batch_analyze_compatibility($1)
      `;

      const result = await this.pool.query(query, [JSON.stringify(swapPairs)]);
      const executionTime = Date.now() - startTime;

      // Log performance
      await this.logQueryPerformance({
        queryType: 'compatibilityAnalysis',
        executionTimeMs: executionTime,
        resultCount: result.rows.length,
        parameters: { pairCount: swapPairs.length }
      });

      return result.rows;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Batch compatibility analysis failed', {
        error,
        pairCount: swapPairs.length,
        executionTime
      });
      throw error;
    }
  }

  /**
   * Get compatibility factors for analysis
   */
  async getCompatibilityFactors(
    sourceBookingId: string,
    targetBookingId: string
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const query = `
        SELECT * FROM get_compatibility_factors($1, $2)
      `;

      const result = await this.pool.query(query, [sourceBookingId, targetBookingId]);
      const executionTime = Date.now() - startTime;

      // Log performance
      await this.logQueryPerformance({
        queryType: 'compatibilityAnalysis',
        executionTimeMs: executionTime,
        resultCount: result.rows.length,
        parameters: { sourceBookingId, targetBookingId }
      });

      return result.rows[0] || null;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Get compatibility factors failed', {
        error,
        sourceBookingId,
        targetBookingId,
        executionTime
      });
      throw error;
    }
  }

  /**
   * Analyze query performance and provide recommendations
   */
  async analyzeQueryPerformance(
    queryType?: string,
    timeRangeHours: number = 24
  ): Promise<{
    metrics: any[];
    recommendations: OptimizationRecommendation[];
  }> {
    try {
      // Get performance metrics
      const metricsQuery = `
        SELECT 
          query_type,
          COUNT(*) as execution_count,
          AVG(execution_time_ms) as avg_execution_time,
          MAX(execution_time_ms) as max_execution_time,
          MIN(execution_time_ms) as min_execution_time,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) as p95_execution_time,
          AVG(result_count) as avg_result_count
        FROM swap_matching_query_log
        WHERE created_at > NOW() - INTERVAL '${timeRangeHours} hours'
        ${queryType ? 'AND query_type = $1' : ''}
        GROUP BY query_type
        ORDER BY avg_execution_time DESC
      `;

      const params = queryType ? [queryType] : [];
      const result = await this.pool.query(metricsQuery, params);
      const metrics = result.rows;

      // Generate recommendations based on metrics
      const recommendations = this.generateOptimizationRecommendations(metrics);

      return { metrics, recommendations };
    } catch (error) {
      logger.error('Failed to analyze query performance', { error, queryType });
      throw error;
    }
  }

  /**
   * Generate optimization recommendations based on performance metrics
   */
  private generateOptimizationRecommendations(metrics: any[]): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    for (const metric of metrics) {
      const queryType = metric.query_type;
      const avgTime = parseFloat(metric.avg_execution_time);
      const maxTime = parseFloat(metric.max_execution_time);
      const p95Time = parseFloat(metric.p95_execution_time);
      const threshold = this.performanceThresholds[queryType as keyof typeof this.performanceThresholds];

      if (threshold && avgTime > threshold) {
        // Query is consistently slow
        if (queryType === 'eligibleSwapsQuery') {
          recommendations.push({
            type: 'index',
            priority: 'high',
            description: `Eligible swaps query averaging ${avgTime.toFixed(0)}ms (threshold: ${threshold}ms)`,
            estimatedImpact: 'Reduce query time by 40-60%',
            implementation: 'Add composite index on (owner_id, status, created_at) for swaps table'
          });
        } else if (queryType === 'compatibilityAnalysis') {
          recommendations.push({
            type: 'cache',
            priority: 'medium',
            description: `Compatibility analysis averaging ${avgTime.toFixed(0)}ms (threshold: ${threshold}ms)`,
            estimatedImpact: 'Reduce repeated calculations by 80%',
            implementation: 'Implement Redis caching for compatibility results with 1-hour TTL'
          });
        } else if (queryType === 'proposalLookup') {
          recommendations.push({
            type: 'index',
            priority: 'medium',
            description: `Proposal lookup averaging ${avgTime.toFixed(0)}ms (threshold: ${threshold}ms)`,
            estimatedImpact: 'Reduce lookup time by 50-70%',
            implementation: 'Add index on (source_booking_id, target_booking_id, status) for swaps table'
          });
        }
      }

      if (maxTime > avgTime * 3) {
        // Query has high variance, suggesting optimization opportunities
        recommendations.push({
          type: 'query_rewrite',
          priority: 'medium',
          description: `${queryType} has high execution time variance (max: ${maxTime.toFixed(0)}ms, avg: ${avgTime.toFixed(0)}ms)`,
          estimatedImpact: 'Reduce worst-case performance by 30-50%',
          implementation: 'Rewrite query to use more selective WHERE clauses and avoid table scans'
        });
      }

      if (metric.execution_count > 1000 && avgTime > 100) {
        // High-frequency query that could benefit from caching
        recommendations.push({
          type: 'cache',
          priority: 'high',
          description: `${queryType} executed ${metric.execution_count} times with ${avgTime.toFixed(0)}ms average`,
          estimatedImpact: 'Reduce database load by 70-90%',
          implementation: 'Implement application-level caching with appropriate TTL'
        });
      }
    }

    return recommendations;
  }

  /**
   * Get database performance statistics
   */
  async getDatabaseStats(): Promise<{
    tableStats: any[];
    indexStats: any[];
    cacheStats: any;
  }> {
    try {
      // Get table statistics
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          seq_scan,
          seq_tup_read,
          idx_scan,
          idx_tup_fetch,
          CASE 
            WHEN seq_scan + idx_scan > 0 
            THEN ROUND((idx_scan::numeric / (seq_scan + idx_scan)) * 100, 2)
            ELSE 0 
          END as index_usage_pct
        FROM pg_stat_user_tables
        WHERE tablename IN ('swaps', 'bookings', 'swap_compatibility_cache', 'eligible_swaps_cache')
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `;

      // Get index statistics
      const indexStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as size,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE tablename IN ('swaps', 'bookings', 'swap_compatibility_cache', 'eligible_swaps_cache')
        ORDER BY idx_scan DESC
      `;

      // Get cache statistics
      const cacheStatsQuery = `
        SELECT * FROM get_swap_matching_cache_stats()
      `;

      const [tableResult, indexResult, cacheResult] = await Promise.all([
        this.pool.query(tableStatsQuery),
        this.pool.query(indexStatsQuery),
        this.pool.query(cacheStatsQuery)
      ]);

      return {
        tableStats: tableResult.rows,
        indexStats: indexResult.rows,
        cacheStats: cacheResult.rows[0] || {}
      };
    } catch (error) {
      logger.error('Failed to get database stats', { error });
      throw error;
    }
  }

  /**
   * Optimize database tables and indexes
   */
  async optimizeTables(): Promise<string> {
    try {
      const query = `SELECT optimize_swap_matching_tables() as result`;
      const result = await this.pool.query(query);
      
      const optimizationResult = result.rows[0]?.result || 'Optimization completed';
      logger.info('Database optimization completed', { result: optimizationResult });
      
      return optimizationResult;
    } catch (error) {
      logger.error('Failed to optimize tables', { error });
      throw error;
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanCache(): Promise<{ compatibilityDeleted: number; eligibleSwapsDeleted: number }> {
    try {
      const query = `SELECT * FROM clean_swap_matching_cache()`;
      const result = await this.pool.query(query);
      
      const stats = {
        compatibilityDeleted: result.rows[0]?.compatibility_deleted || 0,
        eligibleSwapsDeleted: result.rows[0]?.eligible_swaps_deleted || 0
      };

      logger.info('Cache cleanup completed', stats);
      return stats;
    } catch (error) {
      logger.error('Failed to clean cache', { error });
      throw error;
    }
  }

  /**
   * Get performance metrics for monitoring
   */
  async getPerformanceMetrics(): Promise<any[]> {
    try {
      const query = `SELECT * FROM swap_matching_performance`;
      const result = await this.pool.query(query);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get performance metrics', { error });
      throw error;
    }
  }

  /**
   * Monitor query performance in real-time
   */
  async monitorQueryPerformance(callback: (metrics: QueryPerformanceMetrics) => void): Promise<void> {
    // This would typically use database triggers or log monitoring
    // For now, we'll implement a polling mechanism
    
    const checkInterval = 30000; // 30 seconds
    
    const monitor = async () => {
      try {
        const query = `
          SELECT 
            query_type,
            execution_time_ms,
            result_count,
            parameters,
            user_id,
            created_at
          FROM swap_matching_query_log
          WHERE created_at > NOW() - INTERVAL '1 minute'
          ORDER BY execution_time_ms DESC
          LIMIT 10
        `;

        const result = await this.pool.query(query);
        
        for (const row of result.rows) {
          const metrics: QueryPerformanceMetrics = {
            queryType: row.query_type,
            executionTimeMs: parseFloat(row.execution_time_ms),
            resultCount: row.result_count,
            parameters: row.parameters,
            userId: row.user_id
          };

          callback(metrics);
        }
      } catch (error) {
        logger.error('Query performance monitoring failed', { error });
      }
    };

    // Start monitoring
    setInterval(monitor, checkInterval);
    logger.info('Query performance monitoring started', { checkInterval });
  }

  /**
   * Generate performance report
   */
  async generatePerformanceReport(timeRangeHours: number = 24): Promise<{
    summary: any;
    slowQueries: any[];
    recommendations: OptimizationRecommendation[];
    databaseStats: any;
  }> {
    try {
      const [performanceAnalysis, databaseStats] = await Promise.all([
        this.analyzeQueryPerformance(undefined, timeRangeHours),
        this.getDatabaseStats()
      ]);

      // Get slow queries
      const slowQueriesQuery = `
        SELECT 
          query_type,
          execution_time_ms,
          result_count,
          parameters,
          created_at
        FROM swap_matching_query_log
        WHERE created_at > NOW() - INTERVAL '${timeRangeHours} hours'
        AND execution_time_ms > 1000
        ORDER BY execution_time_ms DESC
        LIMIT 20
      `;

      const slowQueriesResult = await this.pool.query(slowQueriesQuery);

      // Generate summary
      const summary = {
        timeRange: `${timeRangeHours} hours`,
        totalQueries: performanceAnalysis.metrics.reduce((sum, m) => sum + parseInt(m.execution_count), 0),
        avgExecutionTime: performanceAnalysis.metrics.reduce((sum, m) => sum + parseFloat(m.avg_execution_time), 0) / performanceAnalysis.metrics.length,
        slowQueriesCount: slowQueriesResult.rows.length,
        recommendationsCount: performanceAnalysis.recommendations.length
      };

      return {
        summary,
        slowQueries: slowQueriesResult.rows,
        recommendations: performanceAnalysis.recommendations,
        databaseStats
      };
    } catch (error) {
      logger.error('Failed to generate performance report', { error });
      throw error;
    }
  }
}