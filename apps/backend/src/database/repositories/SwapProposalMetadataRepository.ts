import { Pool } from 'pg';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';
import { ProposalMetadata } from '@booking-swap/shared';

export interface CreateProposalMetadataRequest {
  proposalId: string;
  sourceSwapId: string;
  targetSwapId: string;
  proposerId: string;
  targetOwnerId: string;
  message?: string;
  compatibilityScore?: number;
  createdFromBrowse?: boolean;
  proposalSource?: 'browse' | 'direct' | 'auction';
  blockchainTransactionId: string;
}

export interface ProposalHistoryEvent {
  proposalId: string;
  eventType: 'proposal_created' | 'proposal_viewed' | 'proposal_accepted' | 
            'proposal_rejected' | 'proposal_expired' | 'proposal_withdrawn' |
            'compatibility_analyzed' | 'notification_sent';
  eventData: any;
  userId?: string;
}

export interface ProposalMetadataEntity extends ProposalMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SwapProposalMetadataRepository extends BaseRepository<ProposalMetadataEntity> {
  constructor(pool: Pool) {
    super(pool, 'swap_proposal_metadata');
  }

  /**
   * Map database row to ProposalMetadataEntity
   */
  mapRowToEntity(row: any): ProposalMetadataEntity {
    return {
      id: row.id,
      proposalId: row.proposal_id,
      sourceSwapId: row.source_swap_id,
      targetSwapId: row.target_swap_id,
      message: row.message,
      compatibilityScore: row.compatibility_score ? parseFloat(row.compatibility_score) : 0,
      createdFromBrowse: row.created_from_browse,
      proposalSource: row.proposal_source,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Map ProposalMetadataEntity to database row
   */
  mapEntityToRow(entity: Omit<ProposalMetadataEntity, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      proposal_id: entity.proposalId,
      source_swap_id: entity.sourceSwapId,
      target_swap_id: entity.targetSwapId,
      proposer_id: (entity as any).proposerId || null,
      target_owner_id: (entity as any).targetOwnerId || null,
      message: entity.message || null,
      compatibility_score: entity.compatibilityScore || null,
      created_from_browse: entity.createdFromBrowse !== undefined ? entity.createdFromBrowse : true,
      proposal_source: entity.proposalSource || 'browse',
      blockchain_transaction_id: (entity as any).blockchainTransactionId || '',
    };
  }

  /**
   * Create proposal metadata record
   */
  async createProposalMetadata(data: CreateProposalMetadataRequest): Promise<ProposalMetadataEntity> {
    try {
      const row = {
        proposal_id: data.proposalId,
        source_swap_id: data.sourceSwapId,
        target_swap_id: data.targetSwapId,
        proposer_id: data.proposerId,
        target_owner_id: data.targetOwnerId,
        message: data.message || null,
        compatibility_score: data.compatibilityScore || null,
        created_from_browse: data.createdFromBrowse !== undefined ? data.createdFromBrowse : true,
        proposal_source: data.proposalSource || 'browse',
        blockchain_transaction_id: data.blockchainTransactionId,
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
      logger.error('Failed to create proposal metadata', { error, data });
      throw error;
    }
  }

  /**
   * Find proposal metadata by proposal ID
   */
  async findByProposalId(proposalId: string): Promise<ProposalMetadataEntity | null> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE proposal_id = $1
      `;

      const result = await this.pool.query(query, [proposalId]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find proposal metadata by proposal ID', { error, proposalId });
      throw error;
    }
  }

  /**
   * Find proposals by user ID (as proposer)
   */
  async findProposalsByProposerId(proposerId: string, limit: number = 50, offset: number = 0): Promise<ProposalMetadataEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE proposer_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [proposerId, limit, offset]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find proposals by proposer ID', { error, proposerId });
      throw error;
    }
  }

  /**
   * Find proposals received by user ID (as target owner)
   */
  async findProposalsReceivedByUserId(targetOwnerId: string, limit: number = 50, offset: number = 0): Promise<ProposalMetadataEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE target_owner_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [targetOwnerId, limit, offset]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find proposals received by user ID', { error, targetOwnerId });
      throw error;
    }
  }

  /**
   * Find proposals by source swap ID
   */
  async findProposalsBySourceSwapId(sourceSwapId: string): Promise<ProposalMetadataEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE source_swap_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [sourceSwapId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find proposals by source swap ID', { error, sourceSwapId });
      throw error;
    }
  }

  /**
   * Find proposals by target swap ID
   */
  async findProposalsByTargetSwapId(targetSwapId: string): Promise<ProposalMetadataEntity[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE target_swap_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [targetSwapId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find proposals by target swap ID', { error, targetSwapId });
      throw error;
    }
  }

  /**
   * Update compatibility score for a proposal
   */
  async updateCompatibilityScore(proposalId: string, compatibilityScore: number): Promise<ProposalMetadataEntity | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET compatibility_score = $1, updated_at = CURRENT_TIMESTAMP
        WHERE proposal_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [compatibilityScore, proposalId]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update compatibility score', { error, proposalId, compatibilityScore });
      throw error;
    }
  }

  /**
   * Get proposal statistics for a user
   */
  async getUserProposalStats(userId: string): Promise<{
    totalProposed: number;
    totalReceived: number;
    browseProposals: number;
    directProposals: number;
    auctionProposals: number;
    averageCompatibilityScore: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(CASE WHEN proposer_id = $1 THEN 1 END) as total_proposed,
          COUNT(CASE WHEN target_owner_id = $1 THEN 1 END) as total_received,
          COUNT(CASE WHEN proposer_id = $1 AND proposal_source = 'browse' THEN 1 END) as browse_proposals,
          COUNT(CASE WHEN proposer_id = $1 AND proposal_source = 'direct' THEN 1 END) as direct_proposals,
          COUNT(CASE WHEN proposer_id = $1 AND proposal_source = 'auction' THEN 1 END) as auction_proposals,
          AVG(CASE WHEN proposer_id = $1 AND compatibility_score IS NOT NULL THEN compatibility_score END) as avg_compatibility_score
        FROM ${this.tableName}
        WHERE proposer_id = $1 OR target_owner_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      const row = result.rows[0];

      return {
        totalProposed: parseInt(row.total_proposed) || 0,
        totalReceived: parseInt(row.total_received) || 0,
        browseProposals: parseInt(row.browse_proposals) || 0,
        directProposals: parseInt(row.direct_proposals) || 0,
        auctionProposals: parseInt(row.auction_proposals) || 0,
        averageCompatibilityScore: parseFloat(row.avg_compatibility_score) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user proposal stats', { error, userId });
      throw error;
    }
  }
}