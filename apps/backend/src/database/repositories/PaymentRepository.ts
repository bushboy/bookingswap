import { Pool } from 'pg';
import {
  PaymentTransaction,
  PaymentStatus,
  EscrowAccount,
  EscrowStatus,
  PaymentMethod,
  PaymentMethodType,
  PaymentRequest,
  EscrowRequest
} from '@booking-swap/shared';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';

export interface PaymentFilters {
  status?: PaymentStatus;
  payerId?: string;
  recipientId?: string;
  swapId?: string;
  proposalId?: string;
  amountRange?: {
    min?: number;
    max?: number;
  };
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface EscrowFilters {
  status?: EscrowStatus;
  transactionId?: string;
  amountRange?: {
    min?: number;
    max?: number;
  };
  createdAfter?: Date;
  createdBefore?: Date;
}

export class PaymentRepository extends BaseRepository<PaymentTransaction> {
  constructor(pool: Pool) {
    super(pool, 'payment_transactions');
  }

  /**
   * Map database row to PaymentTransaction entity
   */
  mapRowToEntity(row: any): PaymentTransaction {
    return {
      id: row.id,
      swapId: row.swap_id,
      proposalId: row.proposal_id,
      payerId: row.payer_id,
      recipientId: row.recipient_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      escrowId: row.escrow_id,
      gatewayTransactionId: row.gateway_transaction_id,
      platformFee: parseFloat(row.platform_fee),
      netAmount: parseFloat(row.net_amount),
      completedAt: row.completed_at,
      blockchain: {
        transactionId: row.blockchain_transaction_id,
      },
      // New metadata columns
      offerMode: row.offer_mode || 'direct',
      validationMetadata: typeof row.validation_metadata === 'string'
        ? JSON.parse(row.validation_metadata)
        : (row.validation_metadata || {}),
      createdVia: row.created_via || 'direct_cash_offer',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map PaymentTransaction entity to database row
   */
  mapEntityToRow(entity: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      swap_id: entity.swapId,
      proposal_id: entity.proposalId,
      payer_id: entity.payerId,
      recipient_id: entity.recipientId,
      amount: entity.amount,
      currency: entity.currency,
      status: entity.status,
      escrow_id: entity.escrowId,
      gateway_transaction_id: entity.gatewayTransactionId,
      platform_fee: entity.platformFee,
      net_amount: entity.netAmount,
      completed_at: entity.completedAt,
      blockchain_transaction_id: entity.blockchain.transactionId,
      // New metadata columns
      offer_mode: entity.offerMode,
      validation_metadata: JSON.stringify(entity.validationMetadata),
      created_via: entity.createdVia,
    };
  }

  /**
   * Map database row to EscrowAccount entity
   */
  mapRowToEscrow(row: any): EscrowAccount {
    return {
      id: row.id,
      transactionId: row.transaction_id,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      releasedAt: row.released_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map EscrowAccount entity to database row
   */
  mapEscrowToRow(entity: Omit<EscrowAccount, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      transaction_id: entity.transactionId,
      amount: entity.amount,
      currency: entity.currency,
      status: entity.status,
      released_at: entity.releasedAt,
    };
  }

  /**
   * Map database row to PaymentMethod entity
   */
  mapRowToPaymentMethod(row: any): PaymentMethod {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      displayName: row.display_name,
      isVerified: row.is_verified,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map PaymentMethod entity to database row
   */
  mapPaymentMethodToRow(entity: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      user_id: entity.userId,
      type: entity.type,
      display_name: entity.displayName,
      is_verified: entity.isVerified,
      metadata: JSON.stringify(entity.metadata),
    };
  }

  /**
   * Create payment transaction
   */
  async createPaymentTransaction(transactionData: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentTransaction> {
    try {
      const row = this.mapEntityToRow(transactionData);
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
      logger.error('Failed to create payment transaction', { error, transactionData });
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(id: string, status: PaymentStatus, completedAt?: Date): Promise<PaymentTransaction | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.pool.query(query, [status, completedAt, id]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update payment status', { error, id, status });
      throw error;
    }
  }

  /**
   * Find payments with filters
   */
  async findPayments(filters: PaymentFilters, limit: number = 100, offset: number = 0): Promise<PaymentTransaction[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`status = $${++paramCount}`);
        values.push(filters.status);
      }

      if (filters.payerId) {
        conditions.push(`payer_id = $${++paramCount}`);
        values.push(filters.payerId);
      }

      if (filters.recipientId) {
        conditions.push(`recipient_id = $${++paramCount}`);
        values.push(filters.recipientId);
      }

      if (filters.swapId) {
        conditions.push(`swap_id = $${++paramCount}`);
        values.push(filters.swapId);
      }

      if (filters.proposalId) {
        conditions.push(`proposal_id = $${++paramCount}`);
        values.push(filters.proposalId);
      }

      if (filters.amountRange) {
        if (filters.amountRange.min !== undefined) {
          conditions.push(`amount >= $${++paramCount}`);
          values.push(filters.amountRange.min);
        }
        if (filters.amountRange.max !== undefined) {
          conditions.push(`amount <= $${++paramCount}`);
          values.push(filters.amountRange.max);
        }
      }

      if (filters.createdAfter) {
        conditions.push(`created_at >= $${++paramCount}`);
        values.push(filters.createdAfter);
      }

      if (filters.createdBefore) {
        conditions.push(`created_at <= $${++paramCount}`);
        values.push(filters.createdBefore);
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
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find payments', { error, filters });
      throw error;
    }
  }

  /**
   * Find payments by user (as payer or recipient)
   */
  async findPaymentsByUser(userId: string, limit: number = 100, offset: number = 0): Promise<PaymentTransaction[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE payer_id = $1 OR recipient_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find payments by user', { error, userId });
      throw error;
    }
  }

  /**
   * Create escrow account
   */
  async createEscrow(escrowData: Omit<EscrowAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<EscrowAccount> {
    try {
      const row = this.mapEscrowToRow(escrowData);
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO escrow_accounts (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return this.mapRowToEscrow(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create escrow account', { error, escrowData });
      throw error;
    }
  }

  /**
   * Update escrow status
   */
  async updateEscrowStatus(id: string, status: EscrowStatus, releasedAt?: Date): Promise<EscrowAccount | null> {
    try {
      const query = `
        UPDATE escrow_accounts
        SET status = $1, released_at = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.pool.query(query, [status, releasedAt, id]);
      return result.rows[0] ? this.mapRowToEscrow(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update escrow status', { error, id, status });
      throw error;
    }
  }

  /**
   * Find escrow accounts with filters
   */
  async findEscrowAccounts(filters: EscrowFilters, limit: number = 100, offset: number = 0): Promise<EscrowAccount[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`status = $${++paramCount}`);
        values.push(filters.status);
      }

      if (filters.transactionId) {
        conditions.push(`transaction_id = $${++paramCount}`);
        values.push(filters.transactionId);
      }

      if (filters.amountRange) {
        if (filters.amountRange.min !== undefined) {
          conditions.push(`amount >= $${++paramCount}`);
          values.push(filters.amountRange.min);
        }
        if (filters.amountRange.max !== undefined) {
          conditions.push(`amount <= $${++paramCount}`);
          values.push(filters.amountRange.max);
        }
      }

      if (filters.createdAfter) {
        conditions.push(`created_at >= $${++paramCount}`);
        values.push(filters.createdAfter);
      }

      if (filters.createdBefore) {
        conditions.push(`created_at <= $${++paramCount}`);
        values.push(filters.createdBefore);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT * FROM escrow_accounts
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapRowToEscrow(row));
    } catch (error) {
      logger.error('Failed to find escrow accounts', { error, filters });
      throw error;
    }
  }

  /**
   * Create payment method
   */
  async createPaymentMethod(methodData: Omit<PaymentMethod, 'id' | 'createdAt' | 'updatedAt'>): Promise<PaymentMethod> {
    try {
      const row = this.mapPaymentMethodToRow(methodData);
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO payment_methods (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return this.mapRowToPaymentMethod(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create payment method', { error, methodData });
      throw error;
    }
  }

  /**
   * Find payment methods by user
   */
  async findPaymentMethodsByUser(userId: string): Promise<PaymentMethod[]> {
    try {
      const query = `
        SELECT * FROM payment_methods
        WHERE user_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows.map(row => this.mapRowToPaymentMethod(row));
    } catch (error) {
      logger.error('Failed to find payment methods by user', { error, userId });
      throw error;
    }
  }

  /**
   * Update payment method verification status
   */
  async updatePaymentMethodVerification(id: string, isVerified: boolean): Promise<PaymentMethod | null> {
    try {
      const query = `
        UPDATE payment_methods
        SET is_verified = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [isVerified, id]);
      return result.rows[0] ? this.mapRowToPaymentMethod(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update payment method verification', { error, id, isVerified });
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStatistics(): Promise<{
    totalTransactions: number;
    totalVolume: number;
    completedTransactions: number;
    pendingTransactions: number;
    averageTransactionAmount: number;
    totalPlatformFees: number;
  }> {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_transactions,
          COALESCE(SUM(amount), 0) as total_volume,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
          COALESCE(AVG(amount), 0) as average_transaction_amount,
          COALESCE(SUM(platform_fee), 0) as total_platform_fees
        FROM ${this.tableName}
      `;

      const result = await this.pool.query(query);
      const row = result.rows[0];

      return {
        totalTransactions: parseInt(row.total_transactions) || 0,
        totalVolume: parseFloat(row.total_volume) || 0,
        completedTransactions: parseInt(row.completed_transactions) || 0,
        pendingTransactions: parseInt(row.pending_transactions) || 0,
        averageTransactionAmount: parseFloat(row.average_transaction_amount) || 0,
        totalPlatformFees: parseFloat(row.total_platform_fees) || 0,
      };
    } catch (error) {
      logger.error('Failed to get payment statistics', { error });
      throw error;
    }
  }

  /**
   * Get user payment statistics
   */
  async getUserPaymentStats(userId: string): Promise<{
    totalPaid: number;
    totalReceived: number;
    completedPayments: number;
    pendingPayments: number;
    averagePaymentAmount: number;
  }> {
    try {
      const query = `
        SELECT 
          COALESCE(SUM(CASE WHEN payer_id = $1 THEN amount ELSE 0 END), 0) as total_paid,
          COALESCE(SUM(CASE WHEN recipient_id = $1 THEN net_amount ELSE 0 END), 0) as total_received,
          COUNT(CASE WHEN (payer_id = $1 OR recipient_id = $1) AND status = 'completed' THEN 1 END) as completed_payments,
          COUNT(CASE WHEN (payer_id = $1 OR recipient_id = $1) AND status = 'pending' THEN 1 END) as pending_payments,
          COALESCE(AVG(CASE WHEN payer_id = $1 OR recipient_id = $1 THEN amount END), 0) as average_payment_amount
        FROM ${this.tableName}
        WHERE payer_id = $1 OR recipient_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      const row = result.rows[0];

      return {
        totalPaid: parseFloat(row.total_paid) || 0,
        totalReceived: parseFloat(row.total_received) || 0,
        completedPayments: parseInt(row.completed_payments) || 0,
        pendingPayments: parseInt(row.pending_payments) || 0,
        averagePaymentAmount: parseFloat(row.average_payment_amount) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user payment stats', { error, userId });
      throw error;
    }
  }

  /**
   * Find pending escrow releases (for automated processing)
   */
  async findPendingEscrowReleases(): Promise<EscrowAccount[]> {
    try {
      const query = `
        SELECT ea.* FROM escrow_accounts ea
        JOIN payment_transactions pt ON ea.transaction_id = pt.id
        WHERE ea.status = 'funded'
        AND pt.status = 'completed'
        ORDER BY ea.created_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRowToEscrow(row));
    } catch (error) {
      logger.error('Failed to find pending escrow releases', { error });
      throw error;
    }
  }
}