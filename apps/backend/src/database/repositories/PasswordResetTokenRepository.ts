import { Pool } from 'pg';
import { BaseRepository } from './base';
import crypto from 'crypto';
import { PasswordResetQueryOptimizer } from '../optimizations/PasswordResetQueryOptimizer';

export interface PasswordResetToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

export interface CreatePasswordResetTokenData {
  userId: string;
  expiresAt: Date;
}

export class PasswordResetTokenRepository extends BaseRepository<PasswordResetToken> {
  private queryOptimizer: PasswordResetQueryOptimizer;

  constructor(pool: Pool) {
    super(pool, 'password_reset_tokens');
    this.queryOptimizer = new PasswordResetQueryOptimizer(pool);
  }

  mapRowToEntity(row: any): PasswordResetToken {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: row.expires_at,
      usedAt: row.used_at,
      createdAt: row.created_at,
    };
  }

  mapEntityToRow(entity: Omit<PasswordResetToken, 'id' | 'createdAt'>): any {
    return {
      user_id: entity.userId,
      token: entity.token,
      expires_at: entity.expiresAt,
      used_at: entity.usedAt,
    };
  }

  /**
   * Create a new password reset token
   */
  async createToken(data: CreatePasswordResetTokenData): Promise<PasswordResetToken> {
    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    
    const query = `
      INSERT INTO ${this.tableName} (user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      data.userId,
      token,
      data.expiresAt,
    ]);
    
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Find a valid (unused and not expired) token - optimized version
   */
  async findValidToken(token: string): Promise<PasswordResetToken | null> {
    try {
      // Use optimized query with proper indexing
      const result = await this.queryOptimizer.findValidTokenOptimized(token);
      return result;
    } catch (error) {
      // Fallback to original query if optimization fails
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE token = $1 
          AND used_at IS NULL 
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await this.pool.query(query, [token]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEntity(result.rows[0]);
    }
  }

  /**
   * Mark a token as used
   */
  async markTokenAsUsed(tokenId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET used_at = NOW()
      WHERE id = $1
    `;
    
    await this.pool.query(query, [tokenId]);
  }

  /**
   * Invalidate all existing tokens for a user (when creating a new one) - optimized version
   */
  async invalidateUserTokens(userId: string): Promise<void> {
    try {
      // Use optimized batch invalidation
      await this.queryOptimizer.invalidateUserTokensOptimized(userId);
    } catch (error) {
      // Fallback to original query
      const query = `
        UPDATE ${this.tableName}
        SET used_at = NOW()
        WHERE user_id = $1 AND used_at IS NULL
      `;
      
      await this.pool.query(query, [userId]);
    }
  }

  /**
   * Find tokens by user ID
   */
  async findByUserId(userId: string, includeUsed: boolean = false): Promise<PasswordResetToken[]> {
    let query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
    `;
    
    if (!includeUsed) {
      query += ' AND used_at IS NULL';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await this.pool.query(query, [userId]);
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  /**
   * Clean up expired tokens - optimized version with batch processing
   */
  async cleanupExpiredTokens(retentionDays: number = 1): Promise<number> {
    try {
      // Use optimized batch cleanup
      return await this.queryOptimizer.cleanupExpiredTokensOptimized(retentionDays);
    } catch (error) {
      // Fallback to original query
      const query = `
        DELETE FROM ${this.tableName}
        WHERE expires_at < NOW() - INTERVAL '${retentionDays} days'
      `;
      
      const result = await this.pool.query(query);
      return result.rowCount || 0;
    }
  }

  /**
   * Get token statistics for monitoring - optimized version
   */
  async getTokenStatistics(): Promise<{
    total: number;
    active: number;
    expired: number;
    used: number;
    avgTokenLifetime?: number;
  }> {
    try {
      // Use optimized statistics query
      return await this.queryOptimizer.getTokenStatisticsOptimized();
    } catch (error) {
      // Fallback to original query
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN used_at IS NULL AND expires_at > NOW() THEN 1 END) as active,
          COUNT(CASE WHEN used_at IS NULL AND expires_at <= NOW() THEN 1 END) as expired,
          COUNT(CASE WHEN used_at IS NOT NULL THEN 1 END) as used
        FROM ${this.tableName}
        WHERE created_at > NOW() - INTERVAL '30 days'
      `;
      
      const result = await this.pool.query(query);
      const row = result.rows[0];
      
      return {
        total: parseInt(row.total),
        active: parseInt(row.active),
        expired: parseInt(row.expired),
        used: parseInt(row.used),
      };
    }
  }

  /**
   * Initialize optimized database indexes for better performance
   */
  async initializeOptimizedIndexes(): Promise<void> {
    try {
      await this.queryOptimizer.createOptimizedIndexes();
    } catch (error) {
      // Log error but don't fail - indexes might already exist
      console.warn('Failed to create optimized indexes:', error.message);
    }
  }

  /**
   * Get performance analysis for the token table
   */
  async getPerformanceAnalysis(): Promise<any> {
    try {
      return await this.queryOptimizer.analyzeTokenTablePerformance();
    } catch (error) {
      console.error('Failed to analyze token table performance:', error);
      return null;
    }
  }
}