import { Pool } from 'pg';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';

export interface SwapProposalHistoryEvent {
  proposalId: string;
  eventType: 'proposal_created' | 'proposal_viewed' | 'proposal_accepted' | 
            'proposal_rejected' | 'proposal_expired' | 'proposal_withdrawn' |
            'compatibility_analyzed' | 'notification_sent';
  eventData: any;
  userId?: string;
}



export interface ProposalHistoryEntity {
  id: string;
  proposalId: string;
  eventType: string;
  eventData: any;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SwapProposalHistoryRepository extends BaseRepository<ProposalHistoryEntity> {
  constructor(pool: Pool) {
    super(pool, 'swap_proposal_history');
  }

  /**
   * Map database row to ProposalHistoryEntity
   */
  mapRowToEntity(row: any): ProposalHistoryEntity {
    return {
      id: row.id,
      proposalId: row.proposal_id,
      eventType: row.event_type,
      eventData: typeof row.event_data === 'string' ? JSON.parse(row.event_data) : row.event_data,
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at || row.created_at),
    };
  }

  /**
   * Map ProposalHistoryEntity to database row
   */
  mapEntityToRow(entity: Omit<ProposalHistoryEntity, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      proposal_id: entity.proposalId,
      event_type: entity.eventType,
      event_data: JSON.stringify(entity.eventData),
      user_id: entity.userId || null,
    };
  }

  /**
   * Record a proposal history event
   */
  async recordEvent(event: SwapProposalHistoryEvent): Promise<ProposalHistoryEntity> {
    try {
      const row = {
        proposal_id: event.proposalId,
        event_type: event.eventType,
        event_data: JSON.stringify(event.eventData),
        user_id: event.userId || null,
      };

      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error('Failed to record proposal history event', { error, event });
      throw error;
    }
  }

  /**
   * Get proposal history by proposal ID
   */
  async getProposalHistory(proposalId: string): Promise<ProposalHistoryEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE proposal_id = $1
        ORDER BY created_at ASC
      `;

      const result = await this.pool.query(query, [proposalId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to get proposal history', { error, proposalId });
      throw error;
    }
  }

  /**
   * Get recent proposal events for a user
   */
  async getRecentEventsForUser(userId: string, limit: number = 50): Promise<ProposalHistoryEntity[]> {
    try {
      const query = `
        SELECT h.* FROM ${this.tableName} h
        JOIN swap_proposal_metadata m ON h.proposal_id = m.proposal_id
        WHERE m.proposer_id = $1 OR m.target_owner_id = $1
        ORDER BY h.created_at DESC
        LIMIT $2
      `;

      const result = await this.pool.query(query, [userId, limit]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to get recent events for user', { error, userId });
      throw error;
    }
  }

  /**
   * Get events by type for a proposal
   */
  async getEventsByType(proposalId: string, eventType: string): Promise<ProposalHistoryEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE proposal_id = $1 AND event_type = $2
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [proposalId, eventType]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to get events by type', { error, proposalId, eventType });
      throw error;
    }
  }

  /**
   * Get proposal activity statistics
   */
  async getActivityStats(startDate?: Date, endDate?: Date): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    dailyActivity: Array<{ date: string; count: number }>;
  }> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (startDate) {
        conditions.push(`created_at >= $${++paramCount}`);
        values.push(startDate);
      }

      if (endDate) {
        conditions.push(`created_at <= $${++paramCount}`);
        values.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total events and events by type
      const statsQuery = `
        SELECT 
          COUNT(*) as total_events,
          event_type,
          COUNT(*) as event_count
        FROM ${this.tableName}
        ${whereClause}
        GROUP BY event_type
      `;

      const statsResult = await this.pool.query(statsQuery, values);

      // Get daily activity
      const dailyQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count
        FROM ${this.tableName}
        ${whereClause}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;

      const dailyResult = await this.pool.query(dailyQuery, values);

      const eventsByType: Record<string, number> = {};
      let totalEvents = 0;

      statsResult.rows.forEach(row => {
        eventsByType[row.event_type] = parseInt(row.event_count);
        totalEvents += parseInt(row.event_count);
      });

      const dailyActivity = dailyResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count),
      }));

      return {
        totalEvents,
        eventsByType,
        dailyActivity,
      };
    } catch (error) {
      logger.error('Failed to get activity stats', { error, startDate, endDate });
      throw error;
    }
  }

  /**
   * Clean up old history events (older than specified days)
   */
  async cleanupOldEvents(olderThanDays: number = 365): Promise<number> {
    try {
      const query = `
        DELETE FROM ${this.tableName}
        WHERE created_at < NOW() - INTERVAL '${olderThanDays} days'
      `;

      const result = await this.pool.query(query);
      const deletedCount = result.rowCount || 0;

      logger.info('Cleaned up old proposal history events', { 
        deletedCount, 
        olderThanDays 
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup old events', { error, olderThanDays });
      throw error;
    }
  }
}