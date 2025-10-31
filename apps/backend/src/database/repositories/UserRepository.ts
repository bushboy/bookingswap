import { Pool } from 'pg';
import { User, UserVerificationLevel } from '@booking-swap/shared';
import { BaseRepository } from './base';

export interface UserFilters {
  walletAddress?: string;
  verificationLevel?: UserVerificationLevel;
  isActive?: boolean;
}

export class UserRepository extends BaseRepository<User> {
  constructor(pool: Pool) {
    super(pool, 'users');
  }



  mapRowToEntity(row: any): User {
    return {
      id: row.id,
      walletAddress: row.wallet_address,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      profile: {
        displayName: row.display_name,
        email: row.email,
        phone: row.phone,
        preferences: {
          notifications: row.notifications_enabled,
          autoAcceptCriteria: {
            maxAdditionalPayment: row.auto_accept_max_payment ? parseFloat(row.auto_accept_max_payment) : undefined,
            preferredLocations: row.auto_accept_locations || [],
            bookingTypes: row.auto_accept_booking_types || [],
          },
        },
      },
      verification: {
        level: row.verification_level,
        documents: row.verification_documents || [],
        verifiedAt: row.verified_at,
      },
      reputation: {
        score: parseFloat(row.reputation_score || 0),
        completedSwaps: parseInt(row.completed_swaps || 0),
        cancelledSwaps: parseInt(row.cancelled_swaps || 0),
        reviews: [], // Reviews will be loaded separately
      },
      lastActiveAt: row.last_active_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  mapEntityToRow(entity: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      wallet_address: entity.walletAddress,
      username: entity.username,
      email: entity.email || entity.profile.email,
      password_hash: entity.passwordHash,
      display_name: entity.profile.displayName,
      phone: entity.profile.phone,
      notifications_enabled: entity.profile.preferences.notifications,
      auto_accept_max_payment: entity.profile.preferences.autoAcceptCriteria?.maxAdditionalPayment,
      auto_accept_locations: entity.profile.preferences.autoAcceptCriteria?.preferredLocations || [],
      auto_accept_booking_types: entity.profile.preferences.autoAcceptCriteria?.bookingTypes || [],
      verification_level: entity.verification.level,
      verification_documents: entity.verification.documents,
      verified_at: entity.verification.verifiedAt,
      reputation_score: entity.reputation.score,
      completed_swaps: entity.reputation.completedSwaps,
      cancelled_swaps: entity.reputation.cancelledSwaps,
      last_active_at: entity.lastActiveAt,
    };
  }

  async findByWalletAddress(walletAddress: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE wallet_address = $1`;
    const result = await this.pool.query(query, [walletAddress]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;
    const result = await this.pool.query(query, [email]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByUsername(username: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE username = $1`;
    const result = await this.pool.query(query, [username]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async create(userData: {
    username?: string;
    email?: string;
    passwordHash?: string;
    verificationLevel?: string;
    walletAddress?: string;
    profile?: any;
    verification?: any;
    reputation?: any;
    lastActiveAt?: Date;
  }): Promise<User> {
    // Handle wallet-based user creation
    if (userData.walletAddress && !userData.username && !userData.email) {
      const walletData = this.mapEntityToRow({
        walletAddress: userData.walletAddress,
        profile: userData.profile || {
          preferences: {
            notifications: true,
          },
        },
        verification: userData.verification || {
          level: 'basic' as const,
          documents: [],
        },
        reputation: userData.reputation || {
          score: 100,
          completedSwaps: 0,
          cancelledSwaps: 0,
          reviews: [],
        },
        lastActiveAt: userData.lastActiveAt || new Date(),
      });

      const query = `
        INSERT INTO ${this.tableName} (
          wallet_address, display_name, email, phone, notifications_enabled, 
          auto_accept_max_payment, auto_accept_locations, auto_accept_booking_types,
          verification_level, verification_documents, verified_at, reputation_score, 
          completed_swaps, cancelled_swaps, last_active_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        walletData.wallet_address,
        walletData.display_name,
        walletData.email,
        walletData.phone,
        walletData.notifications_enabled,
        walletData.auto_accept_max_payment,
        walletData.auto_accept_locations,
        walletData.auto_accept_booking_types,
        walletData.verification_level,
        walletData.verification_documents,
        walletData.verified_at,
        walletData.reputation_score,
        walletData.completed_swaps,
        walletData.cancelled_swaps,
        walletData.last_active_at,
      ]);
      
      return this.mapRowToEntity(result.rows[0]);
    }

    // Handle traditional email/username-based user creation
    const query = `
      INSERT INTO ${this.tableName} (
        username, email, password_hash, verification_level, 
        notifications_enabled, reputation_score, completed_swaps, 
        cancelled_swaps, last_active_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    
    const result = await this.pool.query(query, [
      userData.username,
      userData.email,
      userData.passwordHash,
      userData.verificationLevel || 'basic',
      true, // notifications_enabled
      100, // reputation_score (starting score)
      0, // completed_swaps
      0, // cancelled_swaps
      userData.lastActiveAt || new Date(),
    ]);
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async findByFilters(filters: UserFilters, limit: number = 100, offset: number = 0): Promise<User[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.walletAddress) {
      conditions.push(`wallet_address = $${paramIndex++}`);
      values.push(filters.walletAddress);
    }

    if (filters.verificationLevel) {
      conditions.push(`verification_level = $${paramIndex++}`);
      values.push(filters.verificationLevel);
    }

    if (filters.isActive !== undefined) {
      const activeThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
      if (filters.isActive) {
        conditions.push(`last_active_at > $${paramIndex++}`);
        values.push(activeThreshold);
      } else {
        conditions.push(`last_active_at <= $${paramIndex++}`);
        values.push(activeThreshold);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.pool.query(query, values);
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateLastActive(id: string): Promise<void> {
    const query = `UPDATE ${this.tableName} SET last_active_at = NOW() WHERE id = $1`;
    await this.pool.query(query, [id]);
  }

  async update(id: string, updates: Partial<{
    passwordHash: string;
    displayName: string;
    email: string;
    phone: string;
    notificationsEnabled: boolean;
    verificationLevel: string;
  }>): Promise<User | null> {
    const updateFields: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (updates.passwordHash !== undefined) {
      updateFields.push(`password_hash = $${paramIndex++}`);
      values.push(updates.passwordHash);
    }

    if (updates.displayName !== undefined) {
      updateFields.push(`display_name = $${paramIndex++}`);
      values.push(updates.displayName);
    }

    if (updates.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }

    if (updates.phone !== undefined) {
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(updates.phone);
    }

    if (updates.notificationsEnabled !== undefined) {
      updateFields.push(`notifications_enabled = $${paramIndex++}`);
      values.push(updates.notificationsEnabled);
    }

    if (updates.verificationLevel !== undefined) {
      updateFields.push(`verification_level = $${paramIndex++}`);
      values.push(updates.verificationLevel);
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE ${this.tableName}
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateReputation(id: string, reputationUpdate: {
    scoreChange?: number;
    completedSwapsChange?: number;
    cancelledSwapsChange?: number;
  }): Promise<User | null> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const updates: string[] = [];
      const values: any[] = [id];
      let paramIndex = 2;

      if (reputationUpdate.scoreChange !== undefined) {
        updates.push(`reputation_score = reputation_score + $${paramIndex++}`);
        values.push(reputationUpdate.scoreChange);
      }

      if (reputationUpdate.completedSwapsChange !== undefined) {
        updates.push(`completed_swaps = completed_swaps + $${paramIndex++}`);
        values.push(reputationUpdate.completedSwapsChange);
      }

      if (reputationUpdate.cancelledSwapsChange !== undefined) {
        updates.push(`cancelled_swaps = cancelled_swaps + $${paramIndex++}`);
        values.push(reputationUpdate.cancelledSwapsChange);
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK');
        return this.findById(id);
      }

      const query = `
        UPDATE ${this.tableName}
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Admin methods
  async getStatistics(): Promise<{
    total: number;
    active: number;
    verified: number;
    flagged: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN last_active_at > NOW() - INTERVAL '30 days' THEN 1 END) as active,
        COUNT(CASE WHEN verification_level != 'basic' THEN 1 END) as verified,
        COUNT(CASE WHEN is_flagged = true THEN 1 END) as flagged
      FROM ${this.tableName}
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      active: parseInt(row.active),
      verified: parseInt(row.verified),
      flagged: parseInt(row.flagged)
    };
  }

  async flagUser(userId: string, flag: {
    reason: string;
    flaggedBy: string;
    flaggedAt: Date;
    severity: 'warning' | 'suspension' | 'ban';
    expiresAt?: Date;
  }): Promise<void> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        is_flagged = true,
        flag_reason = $2,
        flagged_by = $3,
        flagged_at = $4,
        flag_severity = $5,
        flag_expires_at = $6,
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.pool.query(query, [
      userId,
      flag.reason,
      flag.flaggedBy,
      flag.flaggedAt,
      flag.severity,
      flag.expiresAt
    ]);
  }

  async unflagUser(userId: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName} 
      SET 
        is_flagged = false,
        flag_reason = NULL,
        flagged_by = NULL,
        flagged_at = NULL,
        flag_severity = NULL,
        flag_expires_at = NULL,
        updated_at = NOW()
      WHERE id = $1
    `;
    
    await this.pool.query(query, [userId]);
  }

  /**
   * Find users interested in auction based on their preferences and search history
   */
  async findInterestedUsers(criteria: {
    location?: {
      city?: string;
      country?: string;
      radius?: number;
    };
    dateRange?: {
      start: Date;
      end: Date;
    };
    swapValue?: {
      min?: number;
      max?: number;
    };
    paymentTypes?: string[];
  }): Promise<string[]> {
    try {
      // This is a simplified implementation. In a real system, you would:
      // 1. Check user search history and preferences
      // 2. Use geolocation queries for location matching
      // 3. Check user's saved searches and alerts
      // 4. Consider user's past swap patterns
      
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      // Only include active users who have notifications enabled
      conditions.push(`last_active_at > NOW() - INTERVAL '90 days'`);
      conditions.push(`notifications_enabled = true`);
      conditions.push(`is_flagged = false OR is_flagged IS NULL`);

      // For now, we'll return users who match basic criteria
      // In a real implementation, this would be much more sophisticated
      if (criteria.location?.country) {
        // This would typically join with user preferences or search history
        conditions.push(`(
          auto_accept_locations IS NOT NULL AND 
          $${paramIndex++} = ANY(auto_accept_locations)
        )`);
        values.push(criteria.location.country);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT id FROM ${this.tableName}
        ${whereClause}
        ORDER BY last_active_at DESC
        LIMIT 50
      `;

      const result = await this.pool.query(query, values);
      return result.rows.map(row => row.id);
    } catch (error) {
      console.error('Error finding interested users:', error);
      return [];
    }
  }
}