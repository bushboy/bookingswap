import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { QueryOptimizer } from './QueryOptimizer';

export interface PasswordResetTokenQueryResult {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export class PasswordResetQueryOptimizer extends QueryOptimizer {
  constructor(pool: Pool) {
    super(pool, {
      enableQueryPlan: process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test',
      slowQueryThreshold: 100, // 100ms threshold for password reset operations
      enableIndexHints: true,
    });
  }

  /**
   * Optimized query to find valid tokens with proper indexing
   */
  async findValidTokenOptimized(token: string): Promise<PasswordResetTokenQueryResult | null> {
    const query = `
      SELECT id, user_id, token, expires_at, used_at, created_at
      FROM password_reset_tokens
      WHERE token = $1 
        AND used_at IS NULL 
        AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const results = await this.executeOptimizedQuery<PasswordResetTokenQueryResult>(
      query,
      [token],
      'findValidToken'
    );

    return results.length > 0 ? {
      id: results[0].id,
      userId: results[0].user_id,
      token: results[0].token,
      expiresAt: results[0].expires_at,
      usedAt: results[0].used_at,
      createdAt: results[0].created_at,
    } : null;
  }

  /**
   * Batch invalidate user tokens with optimized query
   */
  async invalidateUserTokensOptimized(userId: string): Promise<number> {
    const query = `
      UPDATE password_reset_tokens
      SET used_at = NOW()
      WHERE user_id = $1 
        AND used_at IS NULL
        AND expires_at > NOW()
    `;

    const results = await this.executeOptimizedQuery(
      query,
      [userId],
      'invalidateUserTokens'
    );

    return results.length;
  }

  /**
   * Optimized cleanup of expired tokens with batch processing
   */
  async cleanupExpiredTokensOptimized(
    retentionDays: number = 1,
    batchSize: number = 1000
  ): Promise<number> {
    let totalDeleted = 0;
    let hasMore = true;

    while (hasMore) {
      const query = `
        DELETE FROM password_reset_tokens
        WHERE id IN (
          SELECT id
          FROM password_reset_tokens
          WHERE expires_at < NOW() - INTERVAL '${retentionDays} days'
          ORDER BY expires_at ASC
          LIMIT $1
        )
      `;

      const results = await this.executeOptimizedQuery(
        query,
        [batchSize],
        'cleanupExpiredTokens'
      );

      const deletedCount = results?.length || 0;
      totalDeleted += deletedCount;
      hasMore = deletedCount === batchSize;

      if (deletedCount > 0) {
        logger.info('Batch cleanup completed', {
          deletedCount,
          totalDeleted,
          retentionDays,
        });
      }
    }

    return totalDeleted;
  }

  /**
   * Optimized token statistics query with aggregation
   */
  async getTokenStatisticsOptimized(): Promise<{
    total: number;
    active: number;
    expired: number;
    used: number;
    avgTokenLifetime: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN used_at IS NULL AND expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN used_at IS NULL AND expires_at <= NOW() THEN 1 END) as expired,
        COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used,
        AVG(
          CASE 
            WHEN used_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (used_at - created_at))
            ELSE NULL
          END
        ) as avg_token_lifetime_seconds
      FROM password_reset_tokens
      WHERE created_at > NOW() - INTERVAL '30 days'
    `;

    const results = await this.executeOptimizedQuery(
      query,
      [],
      'getTokenStatistics'
    );

    const row = results[0];
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      expired: parseInt(row.expired),
      used: parseInt(row.used),
      avgTokenLifetime: parseFloat(row.avg_token_lifetime_seconds) || 0,
    };
  }

  /**
   * Optimized user token history query
   */
  async getUserTokenHistoryOptimized(
    userId: string,
    limit: number = 10
  ): Promise<PasswordResetTokenQueryResult[]> {
    const query = `
      SELECT id, user_id, token, expires_at, used_at, created_at
      FROM password_reset_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const results = await this.executeOptimizedQuery<any>(
      query,
      [userId, limit],
      'getUserTokenHistory'
    );

    return results.map(row => ({
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Create optimized indexes for password reset tokens
   */
  async createOptimizedIndexes(): Promise<void> {
    const indexes = [
      // Primary lookup index for token validation
      {
        name: 'idx_password_reset_tokens_token_valid',
        query: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_token_valid
          ON password_reset_tokens (token)
          WHERE used_at IS NULL AND expires_at > NOW()
        `,
      },
      // User-based operations index
      {
        name: 'idx_password_reset_tokens_user_active',
        query: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_user_active
          ON password_reset_tokens (user_id, created_at DESC)
          WHERE used_at IS NULL
        `,
      },
      // Cleanup operations index
      {
        name: 'idx_password_reset_tokens_cleanup',
        query: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_cleanup
          ON password_reset_tokens (expires_at)
          WHERE expires_at < NOW()
        `,
      },
      // Statistics and monitoring index
      {
        name: 'idx_password_reset_tokens_stats',
        query: `
          CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_password_reset_tokens_stats
          ON password_reset_tokens (created_at, used_at, expires_at)
        `,
      },
    ];

    for (const index of indexes) {
      try {
        await this.executeOptimizedQuery(index.query, [], `createIndex_${index.name}`);
        logger.info('Index created successfully', { indexName: index.name });
      } catch (error) {
        // Index might already exist, log warning but continue
        logger.warn('Failed to create index', {
          indexName: index.name,
          error: error.message,
        });
      }
    }
  }

  /**
   * Analyze password reset token table performance
   */
  async analyzeTokenTablePerformance(): Promise<{
    tableSize: string;
    indexUsage: any[];
    slowQueries: any[];
    recommendations: string[];
  }> {
    try {
      // Get table size
      const tableSizeQuery = `
        SELECT pg_size_pretty(pg_total_relation_size('password_reset_tokens')) as table_size
      `;
      const sizeResult = await this.executeOptimizedQuery(tableSizeQuery, [], 'getTableSize');

      // Get index usage statistics
      const indexUsageQuery = `
        SELECT 
          indexrelname as index_name,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          idx_scan as scans
        FROM pg_stat_user_indexes
        WHERE relname = 'password_reset_tokens'
        ORDER BY idx_scan DESC
      `;
      const indexUsage = await this.executeOptimizedQuery(indexUsageQuery, [], 'getIndexUsage');

      const recommendations: string[] = [];

      // Analyze index usage and provide recommendations
      if (indexUsage.length === 0) {
        recommendations.push('No index usage statistics available - consider running ANALYZE');
      } else {
        const lowUsageIndexes = indexUsage.filter(idx => idx.scans < 10);
        if (lowUsageIndexes.length > 0) {
          recommendations.push('Some indexes have low usage - consider reviewing index strategy');
        }
      }

      return {
        tableSize: sizeResult[0]?.table_size || 'Unknown',
        indexUsage,
        slowQueries: [], // Would be populated from pg_stat_statements if available
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to analyze token table performance', { error });
      return {
        tableSize: 'Unknown',
        indexUsage: [],
        slowQueries: [],
        recommendations: ['Failed to analyze performance - check database permissions'],
      };
    }
  }
}