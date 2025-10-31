import { Pool } from 'pg';
import { BaseRepository } from './base';

export interface JwtTokenBlacklist {
  id: string;
  userId: string;
  tokenId: string; // JWT 'jti' claim or token hash
  expiresAt: Date;
  createdAt: Date;
  reason?: string;
}

export interface CreateJwtTokenBlacklistData {
  userId: string;
  tokenId: string;
  expiresAt: Date;
  reason?: string;
}

export class JwtTokenBlacklistRepository extends BaseRepository<JwtTokenBlacklist> {
  constructor(pool: Pool) {
    super(pool, 'jwt_token_blacklist');
  }

  mapRowToEntity(row: any): JwtTokenBlacklist {
    return {
      id: row.id,
      userId: row.user_id,
      tokenId: row.token_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      reason: row.reason,
    };
  }

  mapEntityToRow(entity: Omit<JwtTokenBlacklist, 'id' | 'createdAt'>): any {
    return {
      user_id: entity.userId,
      token_id: entity.tokenId,
      expires_at: entity.expiresAt,
      reason: entity.reason,
    };
  }

  /**
   * Add a token to the blacklist
   */
  async blacklistToken(data: CreateJwtTokenBlacklistData): Promise<JwtTokenBlacklist> {
    const query = `
      INSERT INTO ${this.tableName} (user_id, token_id, expires_at, reason, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      data.userId,
      data.tokenId,
      data.expiresAt,
      data.reason,
    ]);
    
    return this.mapRowToEntity(result.rows[0]);
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM ${this.tableName}
      WHERE token_id = $1 AND expires_at > NOW()
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [tokenId]);
    return result.rows.length > 0;
  }

  /**
   * Blacklist all tokens for a user (for session invalidation)
   */
  async blacklistAllUserTokens(userId: string, reason: string = 'Password reset'): Promise<number> {
    // Since we can't enumerate all existing JWT tokens, we'll use a different approach
    // We'll create a "user session invalidation" record with a special token pattern
    const sessionInvalidationTokenId = `user_session_invalidation_${userId}_${Date.now()}`;
    
    const query = `
      INSERT INTO ${this.tableName} (user_id, token_id, expires_at, reason, created_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, NOW())
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      userId,
      sessionInvalidationTokenId,
      reason,
    ]);
    
    return result.rowCount || 0;
  }

  /**
   * Check if all user sessions have been invalidated after a certain time
   */
  async areUserSessionsInvalidated(userId: string, tokenIssuedAt: Date): Promise<boolean> {
    const query = `
      SELECT 1 FROM ${this.tableName}
      WHERE user_id = $1 
        AND token_id LIKE 'user_session_invalidation_%'
        AND created_at > $2
        AND expires_at > NOW()
      LIMIT 1
    `;
    
    const result = await this.pool.query(query, [userId, tokenIssuedAt]);
    return result.rows.length > 0;
  }

  /**
   * Clean up expired blacklist entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE expires_at < NOW()
    `;
    
    const result = await this.pool.query(query);
    return result.rowCount || 0;
  }

  /**
   * Get blacklist statistics for monitoring
   */
  async getBlacklistStatistics(): Promise<{
    total: number;
    active: number;
    expired: number;
    userSessionInvalidations: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active,
        COUNT(CASE WHEN expires_at <= NOW() THEN 1 END) as expired,
        COUNT(CASE WHEN token_id LIKE 'user_session_invalidation_%' AND expires_at > NOW() THEN 1 END) as user_session_invalidations
      FROM ${this.tableName}
      WHERE created_at > NOW() - INTERVAL '30 days'
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      expired: parseInt(row.expired),
      userSessionInvalidations: parseInt(row.user_session_invalidations),
    };
  }
}