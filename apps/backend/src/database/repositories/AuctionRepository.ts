import { Pool } from 'pg';
import {
  SwapAuction,
  AuctionStatus,
  AuctionSettings,
  AuctionProposal,
  ProposalType,
  ProposalStatus,
  CashOffer,
  CreateAuctionRequest,
  CreateProposalRequest,
  AuctionResult
} from '@booking-swap/shared';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';

export interface AuctionFilters {
  status?: AuctionStatus;
  ownerId?: string;
  swapId?: string;
  endingBefore?: Date;
  endingAfter?: Date;
  hasProposals?: boolean;
}

export interface ProposalFilters {
  auctionId?: string;
  proposerId?: string;
  proposalType?: ProposalType;
  status?: ProposalStatus;
  submittedAfter?: Date;
  submittedBefore?: Date;
  minCashAmount?: number;
  maxCashAmount?: number;
}

export class AuctionRepository extends BaseRepository<SwapAuction> {
  constructor(pool: Pool) {
    super(pool, 'swap_auctions');
  }

  /**
   * Map database row to SwapAuction entity
   */
  mapRowToEntity(row: any): SwapAuction {
    return {
      id: row.id,
      swapId: row.swap_id,
      ownerId: row.owner_id,
      status: row.status,
      settings: typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings,
      proposals: [], // Will be populated separately
      winningProposalId: row.winning_proposal_id,
      endedAt: row.ended_at,
      blockchain: {
        creationTransactionId: row.blockchain_creation_transaction_id && row.blockchain_creation_transaction_id !== '' ? row.blockchain_creation_transaction_id : null,
        endTransactionId: row.blockchain_end_transaction_id && row.blockchain_end_transaction_id !== '' ? row.blockchain_end_transaction_id : null,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map SwapAuction entity to database row
   */
  mapEntityToRow(entity: Omit<SwapAuction, 'id' | 'createdAt' | 'updatedAt' | 'proposals'>): any {
    return {
      swap_id: entity.swapId,
      owner_id: entity.ownerId,
      status: entity.status,
      settings: JSON.stringify(entity.settings),
      winning_proposal_id: entity.winningProposalId,
      ended_at: entity.endedAt,
      blockchain_creation_transaction_id: entity.blockchain?.creationTransactionId || '',
      blockchain_end_transaction_id: entity.blockchain?.endTransactionId || '',
    };
  }

  /**
   * Map database row to AuctionProposal entity
   */
  mapRowToProposal(row: any): AuctionProposal {
    return {
      id: row.id,
      auctionId: row.auction_id,
      proposerId: row.proposer_id,
      proposalType: row.proposal_type,
      bookingId: row.booking_id,
      cashOffer: row.cash_offer ? (typeof row.cash_offer === 'string' ? JSON.parse(row.cash_offer) : row.cash_offer) : undefined,
      message: row.message,
      conditions: row.conditions || [],
      status: row.status,
      submittedAt: row.submitted_at,
      blockchain: {
        transactionId: row.blockchain_transaction_id && row.blockchain_transaction_id !== '' ? row.blockchain_transaction_id : null,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map AuctionProposal entity to database row
   */
  mapProposalToRow(entity: Omit<AuctionProposal, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      auction_id: entity.auctionId,
      proposer_id: entity.proposerId,
      proposal_type: entity.proposalType,
      booking_id: entity.bookingId,
      cash_offer: entity.cashOffer ? JSON.stringify(entity.cashOffer) : null,
      message: entity.message,
      conditions: entity.conditions,
      status: entity.status,
      submitted_at: entity.submittedAt,
      blockchain_transaction_id: entity.blockchain?.transactionId || '',
    };
  }

  /**
   * Create a new auction
   */
  async createAuction(auctionData: Omit<SwapAuction, 'id' | 'createdAt' | 'updatedAt' | 'proposals'>): Promise<SwapAuction> {
    try {
      const row = this.mapEntityToRow(auctionData);
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
      logger.error('Failed to create auction', { error, auctionData });
      throw error;
    }
  }

  /**
   * Find auction by swap ID
   */
  async findBySwapId(swapId: string): Promise<SwapAuction | null> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE swap_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [swapId]);
      if (result.rows.length === 0) return null;

      const auction = this.mapRowToEntity(result.rows[0]);
      auction.proposals = await this.getAuctionProposals(auction.id);
      return auction;
    } catch (error) {
      logger.error('Failed to find auction by swap ID', { error, swapId });
      throw error;
    }
  }

  /**
   * Find auctions with filters
   */
  async findAuctions(filters: AuctionFilters, limit: number = 100, offset: number = 0): Promise<SwapAuction[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`status = $${++paramCount}`);
        values.push(filters.status);
      }

      if (filters.ownerId) {
        conditions.push(`owner_id = $${++paramCount}`);
        values.push(filters.ownerId);
      }

      if (filters.swapId) {
        conditions.push(`swap_id = $${++paramCount}`);
        values.push(filters.swapId);
      }

      if (filters.endingBefore) {
        conditions.push(`(settings->>'endDate')::timestamp <= $${++paramCount}`);
        values.push(filters.endingBefore);
      }

      if (filters.endingAfter) {
        conditions.push(`(settings->>'endDate')::timestamp >= $${++paramCount}`);
        values.push(filters.endingAfter);
      }

      if (filters.hasProposals !== undefined) {
        if (filters.hasProposals) {
          conditions.push(`EXISTS (SELECT 1 FROM auction_proposals WHERE auction_id = ${this.tableName}.id)`);
        } else {
          conditions.push(`NOT EXISTS (SELECT 1 FROM auction_proposals WHERE auction_id = ${this.tableName}.id)`);
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      const auctions = result.rows.map(row => this.mapRowToEntity(row));

      // Load proposals for each auction
      for (const auction of auctions) {
        auction.proposals = await this.getAuctionProposals(auction.id);
      }

      return auctions;
    } catch (error) {
      logger.error('Failed to find auctions', { error, filters });
      throw error;
    }
  }

  /**
   * Update auction status
   */
  async updateStatus(id: string, status: AuctionStatus, endedAt?: Date): Promise<SwapAuction | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = $1, ended_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.pool.query(query, [status, endedAt, id]);
      if (result.rows.length === 0) return null;

      const auction = this.mapRowToEntity(result.rows[0]);
      auction.proposals = await this.getAuctionProposals(auction.id);
      return auction;
    } catch (error) {
      logger.error('Failed to update auction status', { error, id, status });
      throw error;
    }
  }

  /**
   * Select winning proposal
   */
  async selectWinningProposal(auctionId: string, proposalId: string): Promise<SwapAuction | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update auction with winning proposal
      const auctionQuery = `
        UPDATE ${this.tableName}
        SET winning_proposal_id = $1, status = 'ended', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const auctionResult = await client.query(auctionQuery, [proposalId, auctionId]);
      if (auctionResult.rows.length === 0) {
        throw new Error('Auction not found');
      }

      // Update winning proposal status
      await client.query(`
        UPDATE auction_proposals
        SET status = 'selected', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [proposalId]);

      // Update all other proposals to rejected
      await client.query(`
        UPDATE auction_proposals
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
        WHERE auction_id = $1 AND id != $2 AND status = 'pending'
      `, [auctionId, proposalId]);

      await client.query('COMMIT');

      const auction = this.mapRowToEntity(auctionResult.rows[0]);
      auction.proposals = await this.getAuctionProposals(auction.id);
      return auction;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to select winning proposal', { error, auctionId, proposalId });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all proposals for an auction
   */
  async getAuctionProposals(auctionId: string): Promise<AuctionProposal[]> {
    try {
      const query = `
        SELECT * FROM auction_proposals
        WHERE auction_id = $1
        ORDER BY submitted_at ASC
      `;

      const result = await this.pool.query(query, [auctionId]);
      return result.rows.map(row => this.mapRowToProposal(row));
    } catch (error) {
      logger.error('Failed to get auction proposals', { error, auctionId });
      throw error;
    }
  }

  /**
   * Create auction proposal
   */
  async createProposal(proposalData: Omit<AuctionProposal, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuctionProposal> {
    try {
      const row = this.mapProposalToRow(proposalData);
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO auction_proposals (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return this.mapRowToProposal(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create auction proposal', { error, proposalData });
      throw error;
    }
  }

  /**
   * Find proposals with filters
   */
  async findProposals(filters: ProposalFilters, limit: number = 100, offset: number = 0): Promise<AuctionProposal[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters.auctionId) {
        conditions.push(`auction_id = $${++paramCount}`);
        values.push(filters.auctionId);
      }

      if (filters.proposerId) {
        conditions.push(`proposer_id = $${++paramCount}`);
        values.push(filters.proposerId);
      }

      if (filters.proposalType) {
        conditions.push(`proposal_type = $${++paramCount}`);
        values.push(filters.proposalType);
      }

      if (filters.status) {
        conditions.push(`status = $${++paramCount}`);
        values.push(filters.status);
      }

      if (filters.submittedAfter) {
        conditions.push(`submitted_at >= $${++paramCount}`);
        values.push(filters.submittedAfter);
      }

      if (filters.submittedBefore) {
        conditions.push(`submitted_at <= $${++paramCount}`);
        values.push(filters.submittedBefore);
      }

      if (filters.minCashAmount !== undefined) {
        conditions.push(`proposal_type = 'cash' AND (cash_offer->>'amount')::numeric >= $${++paramCount}`);
        values.push(filters.minCashAmount);
      }

      if (filters.maxCashAmount !== undefined) {
        conditions.push(`proposal_type = 'cash' AND (cash_offer->>'amount')::numeric <= $${++paramCount}`);
        values.push(filters.maxCashAmount);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT * FROM auction_proposals
        ${whereClause}
        ORDER BY submitted_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapRowToProposal(row));
    } catch (error) {
      logger.error('Failed to find proposals', { error, filters });
      throw error;
    }
  }

  /**
   * Update proposal status
   */
  async updateProposalStatus(id: string, status: ProposalStatus): Promise<AuctionProposal | null> {
    try {
      const query = `
        UPDATE auction_proposals
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [status, id]);
      return result.rows[0] ? this.mapRowToProposal(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update proposal status', { error, id, status });
      throw error;
    }
  }

  /**
   * Find expired auctions that need to be ended
   */
  async findExpiredAuctions(): Promise<SwapAuction[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE status = 'active'
        AND (settings->>'endDate')::timestamp <= NOW()
        ORDER BY (settings->>'endDate')::timestamp ASC
      `;

      const result = await this.pool.query(query);
      const auctions = result.rows.map(row => this.mapRowToEntity(row));

      // Load proposals for each auction
      for (const auction of auctions) {
        auction.proposals = await this.getAuctionProposals(auction.id);
      }

      return auctions;
    } catch (error) {
      logger.error('Failed to find expired auctions', { error });
      throw error;
    }
  }

  /**
   * Get auction statistics
   */
  async getAuctionStatistics(): Promise<{
    totalAuctions: number;
    activeAuctions: number;
    completedAuctions: number;
    averageProposalsPerAuction: number;
    averageAuctionDuration: number; // hours
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_auctions,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_auctions,
          COUNT(CASE WHEN status = 'ended' THEN 1 END) as completed_auctions,
          AVG(proposal_count) as avg_proposals_per_auction,
          AVG(EXTRACT(EPOCH FROM (ended_at - created_at))/3600) as avg_duration_hours
        FROM (
          SELECT 
            sa.*,
            COUNT(ap.id) as proposal_count
          FROM ${this.tableName} sa
          LEFT JOIN auction_proposals ap ON sa.id = ap.auction_id
          GROUP BY sa.id
        ) auction_stats
      `;

      const result = await this.pool.query(query);
      const row = result.rows[0];

      return {
        totalAuctions: parseInt(row.total_auctions) || 0,
        activeAuctions: parseInt(row.active_auctions) || 0,
        completedAuctions: parseInt(row.completed_auctions) || 0,
        averageProposalsPerAuction: parseFloat(row.avg_proposals_per_auction) || 0,
        averageAuctionDuration: parseFloat(row.avg_duration_hours) || 0,
      };
    } catch (error) {
      logger.error('Failed to get auction statistics', { error });
      throw error;
    }
  }

  /**
   * Get user's auction activity
   */
  async getUserAuctionActivity(userId: string): Promise<{
    auctionsCreated: number;
    proposalsSubmitted: number;
    proposalsWon: number;
    activeProposals: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT sa.id) as auctions_created,
          COUNT(DISTINCT ap.id) as proposals_submitted,
          COUNT(DISTINCT CASE WHEN ap.status = 'selected' THEN ap.id END) as proposals_won,
          COUNT(DISTINCT CASE WHEN ap.status = 'pending' THEN ap.id END) as active_proposals
        FROM swap_auctions sa
        FULL OUTER JOIN auction_proposals ap ON ap.proposer_id = $1
        WHERE sa.owner_id = $1 OR ap.proposer_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      const row = result.rows[0];

      return {
        auctionsCreated: parseInt(row.auctions_created) || 0,
        proposalsSubmitted: parseInt(row.proposals_submitted) || 0,
        proposalsWon: parseInt(row.proposals_won) || 0,
        activeProposals: parseInt(row.active_proposals) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user auction activity', { error, userId });
      throw error;
    }
  }

  /**
   * Update blockchain transaction IDs for an auction
   */
  async updateBlockchainTransactionIds(
    id: string,
    updates: {
      blockchain_creation_transaction_id?: string;
      blockchain_end_transaction_id?: string;
    }
  ): Promise<SwapAuction | null> {
    try {
      const setFields: string[] = [];
      const values: any[] = [id];
      let paramCount = 1;

      if (updates.blockchain_creation_transaction_id !== undefined) {
        setFields.push(`blockchain_creation_transaction_id = $${++paramCount}`);
        values.push(updates.blockchain_creation_transaction_id);
      }

      if (updates.blockchain_end_transaction_id !== undefined) {
        setFields.push(`blockchain_end_transaction_id = $${++paramCount}`);
        values.push(updates.blockchain_end_transaction_id);
      }

      if (setFields.length === 0) {
        return this.findById(id);
      }

      const query = `
        UPDATE ${this.tableName}
        SET ${setFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      if (result.rows.length === 0) return null;

      const auction = this.mapRowToEntity(result.rows[0]);
      auction.proposals = await this.getAuctionProposals(auction.id);
      return auction;
    } catch (error) {
      logger.error('Failed to update blockchain transaction IDs', { error, id, updates });
      throw error;
    }
  }
}