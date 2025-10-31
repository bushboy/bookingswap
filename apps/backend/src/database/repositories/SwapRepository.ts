import { Pool } from 'pg';
import {
  Swap,
  SwapStatus,
  SwapBlockchain,
  EnhancedSwap,
  PaymentTypePreference,
  AcceptanceStrategy,
  CashSwapConfiguration,
  EnhancedCreateSwapRequest,
  EligibleSwap,
  SwapWithBookingDetails,
  BookingDetails
} from '@booking-swap/shared';
import { BaseRepository } from './base';
import { logger } from '../../utils/logger';
import { PerformanceMonitor } from '../../services/monitoring/PerformanceMonitor';
import { SwapProposerMonitoringService } from '../../services/monitoring/SwapProposerMonitoringService';
import { detectSchemaError, handleSchemaError } from '../../utils/schemaErrorHandling';

/**
 * Database schema error for column reference issues
 */
export class DatabaseSchemaError extends Error {
  public readonly code: string;
  public readonly originalError: Error;

  constructor(message: string, originalError: Error) {
    super(message);
    this.name = 'DatabaseSchemaError';
    this.code = originalError.code || 'SCHEMA_ERROR';
    this.originalError = originalError;
  }
}

/**
 * Swap matching error for business logic issues
 */
export class SwapMatchingError extends Error {
  public readonly originalError?: Error;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = 'SwapMatchingError';
    this.originalError = originalError;
  }
}

export interface SwapFilters {
  status?: SwapStatus;
  // Note: After schema simplification (migration 027), proposerId and ownerId must be derived from booking relationships
  // These filter options are deprecated and should be replaced with userId filters that join through bookings
  proposerId?: string; // @deprecated - use userIdViaBooking instead
  ownerId?: string; // @deprecated - use userIdViaBooking instead
  excludeOwnerId?: string; // @deprecated - use excludeUserIdViaBooking instead
  // New filter for user-based queries that work with simplified schema
  userIdViaBooking?: string; // Filter swaps where booking.user_id matches
  excludeUserIdViaBooking?: string; // Filter out swaps where booking.user_id matches
  sourceBookingId?: string;
  targetBookingId?: string; // @deprecated - targeting is now tracked in swap_targets table
  createdAfter?: Date;
  createdBefore?: Date;
  paymentTypes?: ('booking' | 'cash')[];
  acceptanceStrategy?: ('first_match' | 'auction')[];
  hasActiveAuction?: boolean;
  cashAmountRange?: {
    min?: number;
    max?: number;
  };
  includeExpired?: boolean; // If true, include expired swaps in results (default: false)
}

export class SwapRepository extends BaseRepository<Swap> {
  private performanceMonitor?: PerformanceMonitor;
  private monitoringService: SwapProposerMonitoringService;

  constructor(pool: Pool, performanceMonitor?: PerformanceMonitor) {
    super(pool, 'swaps');
    this.performanceMonitor = performanceMonitor;
    this.monitoringService = SwapProposerMonitoringService.getInstance();
  }

  /**
   * Override findById to include booking join for owner_id
   * After schema simplification, owner_id must be derived from booking.user_id
   */
  async findById(id: string): Promise<Swap | null> {
    try {
      const query = `
        SELECT 
          s.*,
          b.user_id as owner_id,
          b.user_id as proposer_id
        FROM ${this.tableName} s
        LEFT JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToEntity(result.rows[0]);
    } catch (error) {
      logger.error('Failed to find swap by ID', { error, id });
      throw error;
    }
  }

  /**
   * Map database row to Swap entity
   * Note: After schema simplification (migration 027), proposerId, ownerId, and targetBookingId
   * are no longer stored in the swaps table and must be derived from booking relationships
   */
  mapRowToEntity(row: any): Swap {
    return {
      id: row.id,
      sourceBookingId: row.source_booking_id,
      // These fields are derived from booking relationships (see comment above)
      targetBookingId: row.target_booking_id || undefined,
      proposerId: row.proposer_id || undefined,
      ownerId: row.owner_id || undefined,
      status: row.status,
      terms: {
        additionalPayment: row.additional_payment,
        conditions: row.conditions || [],
        expiresAt: row.expires_at,
      },
      blockchain: {
        proposalTransactionId: row.blockchain_proposal_transaction_id,
        executionTransactionId: row.blockchain_execution_transaction_id,
        escrowContractId: row.blockchain_escrow_contract_id,
      },
      timeline: {
        proposedAt: row.proposed_at,
        respondedAt: row.responded_at,
        completedAt: row.completed_at,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Map database row to EnhancedSwap entity
   */
  mapRowToEnhancedEntity(row: any): EnhancedSwap {
    const baseSwap = this.mapRowToEntity(row);
    return {
      ...baseSwap,
      paymentTypes: typeof row.payment_types === 'string' ? JSON.parse(row.payment_types) : row.payment_types,
      acceptanceStrategy: typeof row.acceptance_strategy === 'string' ? JSON.parse(row.acceptance_strategy) : row.acceptance_strategy,
      auctionId: row.auction_id,
      cashDetails: row.cash_details ? (typeof row.cash_details === 'string' ? JSON.parse(row.cash_details) : row.cash_details) : undefined,
    };
  }

  /**
   * Map Swap entity to database row
   * Note: After schema simplification (migration 027), proposerId, ownerId, and targetBookingId
   * are no longer stored in the swaps table - these are derived from booking relationships
   */
  mapEntityToRow(entity: Omit<Swap, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      source_booking_id: entity.sourceBookingId,
      status: entity.status,
      additional_payment: entity.terms?.additionalPayment || null,
      conditions: entity.terms?.conditions || [],
      expires_at: entity.terms?.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      blockchain_proposal_transaction_id: entity.blockchain?.proposalTransactionId || '',
      blockchain_execution_transaction_id: entity.blockchain?.executionTransactionId || null,
      blockchain_escrow_contract_id: entity.blockchain?.escrowContractId || null,
      proposed_at: entity.timeline?.proposedAt || new Date(),
      responded_at: entity.timeline?.respondedAt || null,
      completed_at: entity.timeline?.completedAt || null,
    };
  }

  /**
   * Map EnhancedSwap entity to database row
   */
  mapEnhancedEntityToRow(entity: Omit<EnhancedSwap, 'id' | 'createdAt' | 'updatedAt'>): any {
    const baseRow = this.mapEntityToRow(entity);
    return {
      ...baseRow,
      payment_types: JSON.stringify(entity.paymentTypes),
      acceptance_strategy: JSON.stringify(entity.acceptanceStrategy),
      cash_details: entity.cashDetails ? JSON.stringify(entity.cashDetails) : null,
    };
  }

  /**
   * Map database row with joined booking details to SwapWithBookingDetails entity
   * Enhanced with comprehensive error handling for missing or corrupted booking data
   */
  mapRowToSwapWithBookingDetails(row: any): SwapWithBookingDetails {
    const baseSwap = this.mapRowToEntity(row);

    // Helper function to safely parse dates
    const safeParseDate = (dateValue: any, fallbackDate?: Date): Date => {
      if (!dateValue) return fallbackDate || new Date();

      try {
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
          logger.warn('Invalid date value encountered', { dateValue });
          return fallbackDate || new Date();
        }
        return parsed;
      } catch (error) {
        logger.warn('Failed to parse date', { dateValue, error });
        return fallbackDate || new Date();
      }
    };

    // Helper function to safely parse numeric values
    const safeParseFloat = (value: any, fallback: number = 0): number => {
      if (value === null || value === undefined) return fallback;

      try {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? fallback : parsed;
      } catch (error) {
        logger.warn('Failed to parse numeric value', { value, error });
        return fallback;
      }
    };

    // Map source booking details with enhanced error handling
    const sourceBooking: BookingDetails | null = (() => {
      // Check if source booking ID exists
      if (!row.source_booking_id) return null;

      // Check if booking has invalid status
      if (row.source_booking_status && ['cancelled', 'deleted'].includes(row.source_booking_status)) {
        logger.warn('Source booking has invalid status', {
          swapId: baseSwap.id,
          sourceBookingId: row.source_booking_id,
          status: row.source_booking_status
        });
        return null;
      }

      // Check if essential booking data is missing
      if (!row.source_booking_title && !row.source_booking_city && !row.source_booking_country) {
        logger.warn('Source booking data is incomplete', {
          swapId: baseSwap.id,
          sourceBookingId: row.source_booking_id
        });
        return null;
      }

      try {
        return {
          id: row.source_booking_id,
          title: row.source_booking_title || 'Untitled Booking',
          location: {
            city: row.source_booking_city || 'Unknown City',
            country: row.source_booking_country || 'Unknown Country'
          },
          dateRange: {
            checkIn: safeParseDate(row.source_booking_check_in),
            checkOut: safeParseDate(row.source_booking_check_out)
          },
          originalPrice: safeParseFloat(row.source_booking_original_price),
          swapValue: safeParseFloat(row.source_booking_swap_value)
        };
      } catch (error) {
        logger.warn('Failed to map source booking details', {
          swapId: baseSwap.id,
          sourceBookingId: row.source_booking_id,
          error
        });
        return null;
      }
    })();

    // Map target booking details with enhanced error handling
    const targetBooking: BookingDetails | null = (() => {
      // Check if target booking ID exists
      if (!row.target_booking_id) return null;

      // Check if booking has invalid status
      if (row.target_booking_status && ['cancelled', 'deleted'].includes(row.target_booking_status)) {
        logger.warn('Target booking has invalid status', {
          swapId: baseSwap.id,
          targetBookingId: row.target_booking_id,
          status: row.target_booking_status
        });
        return null;
      }

      // Check if essential booking data is missing
      if (!row.target_booking_title && !row.target_booking_city && !row.target_booking_country) {
        logger.warn('Target booking data is incomplete', {
          swapId: baseSwap.id,
          targetBookingId: row.target_booking_id
        });
        return null;
      }

      try {
        return {
          id: row.target_booking_id,
          title: row.target_booking_title || 'Untitled Booking',
          location: {
            city: row.target_booking_city || 'Unknown City',
            country: row.target_booking_country || 'Unknown Country'
          },
          dateRange: {
            checkIn: safeParseDate(row.target_booking_check_in),
            checkOut: safeParseDate(row.target_booking_check_out)
          },
          originalPrice: safeParseFloat(row.target_booking_original_price),
          swapValue: safeParseFloat(row.target_booking_swap_value)
        };
      } catch (error) {
        logger.warn('Failed to map target booking details', {
          swapId: baseSwap.id,
          targetBookingId: row.target_booking_id,
          error
        });
        return null;
      }
    })();

    return {
      ...baseSwap,
      sourceBooking,
      targetBooking
    };
  }



  /**
   * Create enhanced swap with payment preferences and acceptance strategy
   */
  async createEnhancedSwap(swapData: Omit<EnhancedSwap, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnhancedSwap> {
    try {
      const row = this.mapEnhancedEntityToRow(swapData);
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return this.mapRowToEnhancedEntity(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create enhanced swap', { error, swapData });
      throw error;
    }
  }

  /**
   * Find enhanced swap by ID
   */
  async findEnhancedById(id: string): Promise<EnhancedSwap | null> {
    try {
      const query = `
        SELECT s.*, sa.id as auction_id
        FROM ${this.tableName} s
        LEFT JOIN swap_auctions sa ON s.id = sa.swap_id AND sa.status = 'active'
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [id]);
      return result.rows[0] ? this.mapRowToEnhancedEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find enhanced swap by ID', { error, id });
      throw error;
    }
  }

  /**
   * Find enhanced swaps with payment and auction filters
   */
  async findEnhancedSwaps(filters: SwapFilters, limit: number = 100, offset: number = 0): Promise<EnhancedSwap[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Base filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          // Support filtering by multiple statuses
          const placeholders: string[] = [];
          for (const status of filters.status) {
            placeholders.push(`$${++paramCount}`);
            values.push(status);
          }
          conditions.push(`s.status IN (${placeholders.join(', ')})`);
        } else {
          conditions.push(`s.status = $${++paramCount}`);
          values.push(filters.status);
        }
      }

      // Handle user-based filters with simplified schema (derive from bookings)
      if (filters.userIdViaBooking || filters.proposerId) {
        const userId = filters.userIdViaBooking || filters.proposerId;
        conditions.push(`sb.user_id = $${++paramCount}`);
        values.push(userId);
      }

      if (filters.ownerId) {
        // Owner filter: In simplified schema, owner is derived from source booking user
        // This assumes the swap owner is the user who owns the source booking
        conditions.push(`sb.user_id = $${++paramCount}`);
        values.push(filters.ownerId);
      }

      if (filters.excludeUserIdViaBooking || filters.excludeOwnerId) {
        const excludeUserId = filters.excludeUserIdViaBooking || filters.excludeOwnerId;
        conditions.push(`sb.user_id != $${++paramCount}`);
        values.push(excludeUserId);
      }

      // Note: Self-proposal filtering is handled at the service layer
      // Here we only filter based on explicit user ID exclusions

      if (filters.sourceBookingId) {
        conditions.push(`s.source_booking_id = $${++paramCount}`);
        values.push(filters.sourceBookingId);
      }

      if (filters.targetBookingId) {
        // Note: After schema simplification, targetBookingId is deprecated
        // Targeting relationships are tracked in swap_targets table
        logger.warn('targetBookingId filter is deprecated after schema simplification', {
          targetBookingId: filters.targetBookingId
        });
        // To find proposals targeting a specific booking:
        // 1. Find swaps that have this booking as source_booking_id (these are the "listing" swaps)
        // 2. Find swap_targets where target_swap_id is one of those swaps
        // 3. Return the source swaps (proposals)
        conditions.push(`s.id IN (
          SELECT st.source_swap_id 
          FROM swap_targets st 
          JOIN swaps target_swap ON st.target_swap_id = target_swap.id 
          WHERE target_swap.source_booking_id = $${++paramCount}
          AND st.status = 'active'
        )`);
        values.push(filters.targetBookingId);
      }

      // Enhanced filters
      if (filters.paymentTypes && filters.paymentTypes.length > 0) {
        const paymentConditions: string[] = [];
        filters.paymentTypes.forEach(type => {
          if (type === 'booking') {
            paymentConditions.push(`s.payment_types->>'bookingExchange' = 'true'`);
          } else if (type === 'cash') {
            paymentConditions.push(`s.payment_types->>'cashPayment' = 'true'`);
          }
        });
        if (paymentConditions.length > 0) {
          conditions.push(`(${paymentConditions.join(' OR ')})`);
        }
      }

      if (filters.acceptanceStrategy && filters.acceptanceStrategy.length > 0) {
        const strategyConditions = filters.acceptanceStrategy.map(strategy => {
          return `s.acceptance_strategy->>'type' = '${strategy}'`;
        });
        conditions.push(`(${strategyConditions.join(' OR ')})`);
      }

      if (filters.hasActiveAuction !== undefined) {
        if (filters.hasActiveAuction) {
          conditions.push(`sa.id IS NOT NULL`);
        } else {
          conditions.push(`sa.id IS NULL`);
        }
      }

      if (filters.cashAmountRange) {
        if (filters.cashAmountRange.min !== undefined) {
          conditions.push(`(s.payment_types->>'minimumCashAmount')::numeric >= $${++paramCount}`);
          values.push(filters.cashAmountRange.min);
        }
        if (filters.cashAmountRange.max !== undefined) {
          conditions.push(`(s.payment_types->>'minimumCashAmount')::numeric <= $${++paramCount}`);
          values.push(filters.cashAmountRange.max);
        }
      }

      if (filters.createdAfter) {
        conditions.push(`s.created_at >= $${++paramCount}`);
        values.push(filters.createdAfter);
      }

      if (filters.createdBefore) {
        conditions.push(`s.created_at <= $${++paramCount}`);
        values.push(filters.createdBefore);
      }

      // Always filter out expired swaps (except if explicitly requested)
      if (filters.includeExpired !== true) {
        conditions.push(`s.expires_at > CURRENT_TIMESTAMP`);
      }

      // Exclude swaps with accepted targets (either as source or target)
      // This prevents "committed" swaps from appearing in browse results
      conditions.push(`
        NOT EXISTS (
          SELECT 1 FROM swap_targets st
          WHERE (st.source_swap_id = s.id OR st.target_swap_id = s.id)
          AND st.status = 'accepted'
        )
      `);

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT s.*, sa.id as auction_id
        FROM ${this.tableName} s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_auctions sa ON s.id = sa.swap_id AND sa.status = 'active'
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapRowToEnhancedEntity(row));
    } catch (error) {
      logger.error('Failed to find enhanced swaps', { error, filters });
      throw error;
    }
  }

  /**
   * Find swaps accepting cash payments
   */
  async findCashEnabledSwaps(limit: number = 100, offset: number = 0): Promise<EnhancedSwap[]> {
    try {
      const query = `
        SELECT s.*, sa.id as auction_id
        FROM ${this.tableName} s
        LEFT JOIN swap_auctions sa ON s.id = sa.swap_id AND sa.status = 'active'
        WHERE s.payment_types->>'cashPayment' = 'true'
        AND s.status = 'pending'
        AND s.expires_at > CURRENT_TIMESTAMP
        ORDER BY s.created_at DESC
        LIMIT $1 OFFSET $2
      `;

      const result = await this.pool.query(query, [limit, offset]);
      return result.rows.map(row => this.mapRowToEnhancedEntity(row));
    } catch (error) {
      logger.error('Failed to find cash-enabled swaps', { error });
      throw error;
    }
  }

  /**
   * Find active auction swaps
   */
  async findActiveAuctionSwaps(limit: number = 100, offset: number = 0): Promise<EnhancedSwap[]> {
    try {
      const query = `
        SELECT s.*, sa.id as auction_id
        FROM ${this.tableName} s
        INNER JOIN swap_auctions sa ON s.id = sa.swap_id
        WHERE sa.status = 'active'
        AND s.status = 'pending'
        AND s.expires_at > CURRENT_TIMESTAMP
        ORDER BY (sa.settings->>'endDate')::timestamp ASC
        LIMIT $1 OFFSET $2
      `;

      const result = await this.pool.query(query, [limit, offset]);
      return result.rows.map(row => this.mapRowToEnhancedEntity(row));
    } catch (error) {
      logger.error('Failed to find active auction swaps', { error });
      throw error;
    }
  }

  /**
   * Find auctions ending soon (within 24 hours)
   */
  async findAuctionsEndingSoon(): Promise<EnhancedSwap[]> {
    try {
      const query = `
        SELECT s.*, sa.id as auction_id
        FROM ${this.tableName} s
        INNER JOIN swap_auctions sa ON s.id = sa.swap_id
        WHERE sa.status = 'active'
        AND (sa.settings->>'endDate')::timestamp <= NOW() + INTERVAL '24 hours'
        AND (sa.settings->>'endDate')::timestamp > NOW()
        AND s.expires_at > CURRENT_TIMESTAMP
        ORDER BY (sa.settings->>'endDate')::timestamp ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRowToEnhancedEntity(row));
    } catch (error) {
      logger.error('Failed to find auctions ending soon', { error });
      throw error;
    }
  }

  /**
   * Update payment preferences for a swap
   */
  async updatePaymentPreferences(id: string, paymentTypes: PaymentTypePreference): Promise<EnhancedSwap | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET payment_types = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [JSON.stringify(paymentTypes), id]);
      return result.rows[0] ? this.mapRowToEnhancedEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update payment preferences', { error, id, paymentTypes });
      throw error;
    }
  }

  /**
   * Update acceptance strategy for a swap
   */
  async updateAcceptanceStrategy(id: string, acceptanceStrategy: AcceptanceStrategy): Promise<EnhancedSwap | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET acceptance_strategy = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [JSON.stringify(acceptanceStrategy), id]);
      return result.rows[0] ? this.mapRowToEnhancedEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update acceptance strategy', { error, id, acceptanceStrategy });
      throw error;
    }
  }

  /**
   * Update cash details for a swap
   */
  async updateCashDetails(id: string, cashDetails: CashSwapConfiguration): Promise<EnhancedSwap | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET cash_details = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [JSON.stringify(cashDetails), id]);
      return result.rows[0] ? this.mapRowToEnhancedEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update cash details', { error, id, cashDetails });
      throw error;
    }
  }

  /**
   * Validate auction timing against event date
   */
  async validateAuctionTiming(swapId: string, auctionEndDate: Date): Promise<{ isValid: boolean; eventDate?: Date; minimumEndDate?: Date; errors: string[] }> {
    try {
      const query = `
        SELECT b.event_date
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [swapId]);

      if (result.rows.length === 0) {
        return { isValid: false, errors: ['Swap not found'] };
      }

      const eventDate = new Date(result.rows[0].event_date);
      const minimumEndDate = new Date(eventDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 1 week before event
      const isValid = auctionEndDate <= minimumEndDate;

      const errors: string[] = [];
      if (!isValid) {
        errors.push('Auction must end at least one week before the event date');
      }

      return {
        isValid,
        eventDate,
        minimumEndDate,
        errors
      };
    } catch (error) {
      logger.error('Failed to validate auction timing', { error, swapId, auctionEndDate });
      throw error;
    }
  }

  /**
   * Check if booking is last-minute (less than one week to event)
   */
  async isLastMinuteBooking(swapId: string): Promise<boolean> {
    try {
      const query = `
        SELECT b.event_date
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [swapId]);

      if (result.rows.length === 0) {
        return false;
      }

      const eventDate = new Date(result.rows[0].event_date);
      const oneWeekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      return eventDate <= oneWeekFromNow;
    } catch (error) {
      logger.error('Failed to check if booking is last-minute', { error, swapId });
      throw error;
    }
  }

  /**
   * Update swap status
   */
  async updateStatus(id: string, status: SwapStatus): Promise<Swap | null> {
    try {
      const query = `
        UPDATE ${this.tableName}
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [status, id]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      // Handle constraint violation for expired swaps being cancelled
      if (error.code === '23514' && error.constraint === 'check_expires_future') {
        logger.warn('Constraint violation when updating expired swap status - attempting workaround', {
          error: error.message,
          id,
          status,
          constraint: error.constraint
        });

        // Workaround: Update both status and expires_at to a future date for cancelled swaps
        // This is a temporary fix until the database constraint is properly updated
        if (status === 'cancelled') {
          try {
            const workaroundQuery = `
              UPDATE ${this.tableName}
              SET status = $1, expires_at = NOW() + INTERVAL '1 day', updated_at = CURRENT_TIMESTAMP
              WHERE id = $2
              RETURNING *
            `;

            logger.info('Applying workaround for expired swap cancellation', { id, status });
            const workaroundResult = await this.pool.query(workaroundQuery, [status, id]);

            if (workaroundResult.rows[0]) {
              logger.info('Workaround successful - expired swap cancelled with future expires_at', { id });
              return this.mapRowToEntity(workaroundResult.rows[0]);
            }
          } catch (workaroundError) {
            logger.error('Workaround also failed', { workaroundError, id, status });
            throw workaroundError;
          }
        }
      }

      logger.error('Failed to update swap status', { error, id, status });
      throw error;
    }
  }

  /**
   * Update blockchain information
   */
  async updateBlockchainInfo(id: string, blockchainInfo: Partial<SwapBlockchain>): Promise<Swap | null> {
    try {
      // First get current blockchain data
      const currentSwap = await this.findById(id);
      if (!currentSwap) {
        throw new Error('Swap not found');
      }

      const updatedBlockchain = {
        ...currentSwap.blockchain,
        ...blockchainInfo,
      };

      // Build dynamic update query for individual blockchain columns
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updatedBlockchain.proposalTransactionId !== undefined) {
        updates.push(`blockchain_proposal_transaction_id = $${paramIndex++}`);
        values.push(updatedBlockchain.proposalTransactionId);
      }

      if (updatedBlockchain.executionTransactionId !== undefined) {
        updates.push(`blockchain_execution_transaction_id = $${paramIndex++}`);
        values.push(updatedBlockchain.executionTransactionId);
      }

      if (updatedBlockchain.escrowContractId !== undefined) {
        updates.push(`blockchain_escrow_contract_id = $${paramIndex++}`);
        values.push(updatedBlockchain.escrowContractId);
      }

      if (updates.length === 0) {
        // No blockchain updates to make
        return currentSwap;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `
        UPDATE ${this.tableName}
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.pool.query(query, values);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update swap blockchain info', { error, id, blockchainInfo });
      throw error;
    }
  }

  /**
   * Update swap timeline
   */
  async updateTimeline(id: string, timelineUpdate: Partial<Swap['timeline']>): Promise<Swap | null> {
    try {
      // First get current timeline data
      const currentSwap = await this.findById(id);
      if (!currentSwap) {
        throw new Error('Swap not found');
      }

      const updatedTimeline = {
        ...currentSwap.timeline,
        ...timelineUpdate,
      };

      const query = `
        UPDATE ${this.tableName}
        SET timeline = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [JSON.stringify(updatedTimeline), id]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to update swap timeline', { error, id, timelineUpdate });
      throw error;
    }
  }

  /**
   * Find swaps by user ID (as proposer derived from booking relationship)
   * Updated for simplified schema - derives proposer from booking.user_id
   */
  async findByUserId(userId: string, limit: number = 100, offset: number = 0): Promise<Swap[]> {
    try {
      const query = `
        SELECT s.*, b.user_id as proposer_id, u.display_name as proposer_name
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        LEFT JOIN users u ON b.user_id = u.id
        WHERE b.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => {
        // Handle missing booking relationships with proper error handling
        if (!row.proposer_id) {
          logger.warn('Missing proposer relationship for swap', {
            swapId: row.id,
            sourceBookingId: row.source_booking_id,
            userId
          });
          throw new Error(`Cannot derive proposer for swap ${row.id} - missing booking relationship`);
        }
        return this.mapRowToEntity(row);
      });
    } catch (error) {
      logger.error('Failed to find swaps by user ID with derived proposer', { error, userId });
      throw error;
    }
  }

  /**
   * Find all swaps by source booking ID
   * Used to check if a booking already has active swaps before creating a new one
   */
  async findBySourceBookingId(sourceBookingId: string): Promise<Swap[]> {
    try {
      const query = `
        SELECT s.*, b.user_id as proposer_id, b.user_id as owner_id
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.source_booking_id = $1
        ORDER BY s.created_at DESC
      `;

      const result = await this.pool.query(query, [sourceBookingId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find swaps by source booking ID', { error, sourceBookingId });
      throw error;
    }
  }

  /**
   * Find swap by source booking ID and user ID
   * Requirements: 3.3, 4.1, 4.2, 4.3
   */
  async findBySourceBookingAndUserId(sourceBookingId: string, userId: string): Promise<Swap | null> {
    try {
      const query = `
        SELECT s.*, b.user_id as proposer_id
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.source_booking_id = $1 AND b.user_id = $2
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [sourceBookingId, userId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Handle missing booking relationships with proper error handling
      if (!row.proposer_id) {
        logger.warn('Missing proposer relationship for swap', {
          swapId: row.id,
          sourceBookingId: row.source_booking_id,
          userId
        });
        throw new Error(`Cannot derive proposer for swap ${row.id} - missing booking relationship`);
      }

      return this.mapRowToEntity(row);
    } catch (error) {
      logger.error('Failed to find swap by source booking and user ID', {
        error,
        sourceBookingId,
        userId
      });
      throw error;
    }
  }

  /**
   * Find proposals for user's swaps (excluding self-proposals)
   * This method returns proposals made by other users for the current user's swaps
   * Requirements: 3.1, 3.4
   */
  async findProposalsForUserSwaps(userId: string, swapIds: string[], limit: number = 100, offset: number = 0): Promise<Swap[]> {
    try {
      if (swapIds.length === 0) {
        return [];
      }

      // Find proposals targeting the user's swaps via swap_targets table
      const query = `
        SELECT p.*
        FROM swap_targets st
        JOIN ${this.tableName} p ON st.source_swap_id = p.id
        JOIN ${this.tableName} s ON st.target_swap_id = s.id
        JOIN bookings sb ON s.source_booking_id = sb.id
        JOIN bookings pb ON p.source_booking_id = pb.id
        WHERE st.target_swap_id = ANY($1)
        AND sb.user_id = $2
        AND pb.user_id != $2  -- Critical filter: exclude self-proposals
        AND st.status = 'active'
        AND p.status = 'pending'
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      const result = await this.pool.query(query, [swapIds, userId, limit, offset]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find proposals for user swaps', { error, userId, swapIds });
      throw error;
    }
  }

  /**
   * Find user's own swaps (where user is the owner)
   * Requirements: 3.1, 3.2
   */
  async findUserOwnSwaps(userId: string, limit: number = 100, offset: number = 0): Promise<Swap[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE owner_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find user own swaps', { error, userId });
      throw error;
    }
  }

  /**
   * Get optimized swap cards data with proposals (excluding self-proposals)
   * Uses swap_targets table for targeting relationships
   * Enhanced with comprehensive JOIN chain validation and diagnostic logging
   * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4
   */
  async findSwapCardsWithProposals(userId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    const startTime = Date.now();

    try {
      logger.info('Starting findSwapCardsWithProposals with comprehensive monitoring', {
        userId,
        limit,
        offset,
        requirement: '3.1'
      });

      const query = `
        SELECT 
          s.id as swap_id,
          sb.user_id as owner_id,
          tb.user_id as proposer_id,
          s.source_booking_id as user_booking_id,
          s.status as swap_status,
          s.created_at as swap_created_at,
          s.expires_at as swap_expires_at,
          s.additional_payment as proposal_additional_payment,
          s.conditions as proposal_conditions,
          
          sb.id as user_booking_id_full,
          sb.title as user_booking_title,
          sb.city as user_booking_city,
          sb.country as user_booking_country,
          sb.check_in_date as user_booking_check_in,
          sb.check_out_date as user_booking_check_out,
          sb.original_price as user_booking_original_price,
          sb.swap_value as user_booking_swap_value,
          
          -- Proposer booking details (from swap_targets)
          tb.id as proposer_booking_id_full,
          tb.title as proposer_booking_title,
          tb.city as proposer_booking_city,
          tb.country as proposer_booking_country,
          tb.check_in_date as proposer_booking_check_in,
          tb.check_out_date as proposer_booking_check_out,
          tb.original_price as proposer_booking_original_price,
          tb.swap_value as proposer_booking_swap_value,
          
          u.display_name as proposer_name,
          u.email as proposer_email,
          
          -- JOIN chain validation fields
          CASE 
            WHEN st.id IS NULL THEN 'no_swap_target'
            WHEN ts.id IS NULL THEN 'missing_target_swap'
            WHEN tb.id IS NULL THEN 'missing_target_booking'
            WHEN u.id IS NULL THEN 'missing_user'
            ELSE 'complete'
          END as join_chain_status,
          
          -- Diagnostic information for JOIN failures
          st.id as swap_target_id,
          ts.id as target_swap_id,
          tb.user_id as proposer_user_id,
          u.id as user_record_id

        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
        LEFT JOIN ${this.tableName} ts ON st.source_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id

        WHERE sb.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      const queryTime = Date.now() - startTime;

      logger.info('Query execution completed with comprehensive monitoring', {
        userId,
        resultCount: result.rows.length,
        queryTime,
        requirement: '3.1'
      });

      // Comprehensive JOIN chain failure detection and logging (Requirements: 3.1, 3.2)
      this.detectAndLogJoinChainFailures(result.rows, userId);

      // Enrich results with missing proposer data using monitored fallback lookups (Requirements: 3.3, 3.4)
      const enrichedRows = await this.enrichSwapCardsWithProposerDataMonitored(result.rows);

      const totalTime = Date.now() - startTime;
      logger.info('findSwapCardsWithProposals completed with comprehensive monitoring', {
        userId,
        totalRows: enrichedRows.length,
        totalTime,
        queryTime,
        enrichmentTime: totalTime - queryTime,
        requirement: '3.4'
      });

      return enrichedRows;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      logger.error('Failed to find swap cards with proposals - comprehensive error logging', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        totalTime,
        requirement: '3.2'
      });
      throw error;
    }
  }

  /**
   * Validate JOIN chain results and log diagnostic information
   * Requirements: 2.2, 2.3
   */
  private validateAndLogJoinChainResults(rows: any[], userId: string): void {
    const joinChainStats = {
      total: rows.length,
      complete: 0,
      no_swap_target: 0,
      missing_target_swap: 0,
      missing_target_booking: 0,
      missing_user: 0,
      null_proposer_names: 0
    };

    const failedJoins: Array<{
      swapId: string;
      failurePoint: string;
      diagnosticInfo: any;
    }> = [];

    rows.forEach(row => {
      const status = row.join_chain_status;
      joinChainStats[status as keyof typeof joinChainStats]++;

      // Track NULL proposer names
      if (!row.proposer_name) {
        joinChainStats.null_proposer_names++;
      }

      // Log detailed information for failed JOINs
      if (status !== 'complete') {
        const diagnosticInfo = {
          swapId: row.swap_id,
          sourceBookingId: row.user_booking_id,
          swapTargetId: row.swap_target_id,
          targetSwapId: row.target_swap_id,
          proposerUserId: row.proposer_user_id,
          userRecordId: row.user_record_id,
          proposerName: row.proposer_name
        };

        failedJoins.push({
          swapId: row.swap_id,
          failurePoint: status,
          diagnosticInfo
        });

        // Log specific failure points for debugging
        switch (status) {
          case 'no_swap_target':
            logger.warn('JOIN chain failure: No active swap_targets record found', {
              swapId: row.swap_id,
              userId,
              requirement: '2.1'
            });
            break;
          case 'missing_target_swap':
            logger.warn('JOIN chain failure: Target swap not found', {
              swapId: row.swap_id,
              swapTargetId: row.swap_target_id,
              userId,
              requirement: '2.2'
            });
            break;
          case 'missing_target_booking':
            logger.warn('JOIN chain failure: Target booking not found', {
              swapId: row.swap_id,
              targetSwapId: row.target_swap_id,
              userId,
              requirement: '2.2'
            });
            break;
          case 'missing_user':
            logger.warn('JOIN chain failure: User record not found', {
              swapId: row.swap_id,
              proposerUserId: row.proposer_user_id,
              userId,
              requirement: '2.3'
            });
            break;
        }
      }
    });

    // Log overall JOIN chain statistics
    const successRate = joinChainStats.total > 0
      ? ((joinChainStats.complete / joinChainStats.total) * 100).toFixed(2)
      : '100.00';

    logger.info('JOIN chain validation results', {
      userId,
      stats: joinChainStats,
      successRate: `${successRate}%`,
      failedJoinCount: failedJoins.length,
      requirement: '2.2'
    });

    // Log detailed failure information if there are significant issues
    if (joinChainStats.null_proposer_names > 0) {
      logger.warn('Proposer names are NULL in query results', {
        userId,
        nullProposerCount: joinChainStats.null_proposer_names,
        totalRows: joinChainStats.total,
        nullRate: `${((joinChainStats.null_proposer_names / joinChainStats.total) * 100).toFixed(2)}%`,
        requirement: '2.1'
      });
    }

    // Log critical issues that need immediate attention
    if (failedJoins.length > 0) {
      logger.error('Critical JOIN chain failures detected', {
        userId,
        failureCount: failedJoins.length,
        failures: failedJoins.slice(0, 5), // Log first 5 failures to avoid log spam
        requirement: '2.3'
      });
    }
  }

  /**
   * Get proposer details for a specific swap using multiple lookup strategies
   * Requirements: 1.3, 2.1, 2.4
   */
  async getProposerDetails(swapId: string): Promise<{
    userId: string | null;
    displayName: string | null;
    email: string | null;
    lookupMethod: 'direct' | 'booking_derived' | 'swap_target_derived' | 'fallback';
    isValid: boolean;
  }> {
    try {
      // Strategy 1: Direct lookup via source booking
      const directQuery = `
        SELECT u.id as user_id, u.display_name, u.email
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE s.id = $1
      `;

      let result = await this.pool.query(directQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].display_name) {
        logger.debug('Proposer details found via direct lookup', {
          swapId,
          userId: result.rows[0].user_id,
          method: 'direct'
        });

        return {
          userId: result.rows[0].user_id,
          displayName: result.rows[0].display_name,
          email: result.rows[0].email,
          lookupMethod: 'direct',
          isValid: true
        };
      }

      // Strategy 2: Lookup via swap_targets relationship (for proposals)
      const swapTargetQuery = `
        SELECT u.id as user_id, u.display_name, u.email
        FROM swap_targets st
        JOIN ${this.tableName} s ON st.source_swap_id = s.id
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE st.source_swap_id = $1 AND st.status = 'active'
      `;

      result = await this.pool.query(swapTargetQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].display_name) {
        logger.debug('Proposer details found via swap_targets lookup', {
          swapId,
          userId: result.rows[0].user_id,
          method: 'swap_target_derived'
        });

        return {
          userId: result.rows[0].user_id,
          displayName: result.rows[0].display_name,
          email: result.rows[0].email,
          lookupMethod: 'swap_target_derived',
          isValid: true
        };
      }

      // Strategy 3: Fallback - get user ID and try direct user lookup
      const userIdQuery = `
        SELECT b.user_id
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.id = $1
      `;

      result = await this.pool.query(userIdQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].user_id) {
        const userId = result.rows[0].user_id;

        const userQuery = `
          SELECT id as user_id, display_name, email
          FROM users
          WHERE id = $1
        `;

        const userResult = await this.pool.query(userQuery, [userId]);

        if (userResult.rows.length > 0) {
          logger.warn('Proposer details found via fallback user lookup', {
            swapId,
            userId,
            method: 'fallback',
            hasDisplayName: !!userResult.rows[0].display_name
          });

          return {
            userId: userResult.rows[0].user_id,
            displayName: userResult.rows[0].display_name,
            email: userResult.rows[0].email,
            lookupMethod: 'fallback',
            isValid: !!userResult.rows[0].display_name
          };
        }
      }

      // No user data found
      logger.error('No proposer details found for swap', {
        swapId,
        requirement: '2.4'
      });

      return {
        userId: null,
        displayName: null,
        email: null,
        lookupMethod: 'fallback',
        isValid: false
      };

    } catch (error) {
      logger.error('Failed to get proposer details', {
        error,
        swapId,
        requirement: '2.4'
      });

      return {
        userId: null,
        displayName: null,
        email: null,
        lookupMethod: 'fallback',
        isValid: false
      };
    }
  }

  /**
   * Comprehensive JOIN chain failure detection and logging
   * Requirements: 3.1, 3.2
   */
  private detectAndLogJoinChainFailures(rows: any[], userId: string): void {
    const joinChainStats = {
      total: rows.length,
      complete: 0,
      null_proposer_names: 0,
      missing_swap_targets: 0,
      missing_target_bookings: 0,
      missing_users: 0
    };

    const failedJoins: any[] = [];

    rows.forEach(row => {
      let joinChainComplete = true;
      let failureType: string | null = null;

      // Check for NULL proposer names (Requirement 3.1)
      if (!row.proposer_name || row.proposer_name === 'Unknown User') {
        joinChainStats.null_proposer_names++;
        joinChainComplete = false;
        failureType = 'null_proposer_name';

        this.monitoringService.recordJoinChainFailure(
          userId,
          row.swap_id,
          'null_proposer_name',
          {
            proposerId: row.proposer_user_id,
            proposerName: row.proposer_name,
            joinChainStatus: row.join_chain_status
          }
        );
      }

      // Check for missing swap_targets relationships (Requirement 3.2)
      if (row.join_chain_status === 'no_swap_target' || (!row.target_swap_id && row.swap_status === 'pending')) {
        joinChainStats.missing_swap_targets++;
        joinChainComplete = false;
        failureType = 'missing_swap_target';

        this.monitoringService.recordJoinChainFailure(
          userId,
          row.swap_id,
          'missing_swap_target',
          {
            expectedTargetSwapId: row.target_swap_id,
            swapStatus: row.swap_status,
            joinChainStatus: row.join_chain_status
          }
        );
      }

      // Check for missing target booking relationships (Requirement 3.2)
      if (row.target_swap_id && !row.target_booking_id) {
        joinChainStats.missing_target_bookings++;
        joinChainComplete = false;
        failureType = 'missing_target_booking';

        this.monitoringService.recordJoinChainFailure(
          userId,
          row.swap_id,
          'missing_target_booking',
          {
            targetSwapId: row.target_swap_id,
            expectedBookingId: row.target_booking_id
          }
        );
      }

      // Check for missing user records (Requirement 3.2)
      if (row.proposer_user_id && !row.proposer_name && !row.proposer_email) {
        joinChainStats.missing_users++;
        joinChainComplete = false;
        failureType = 'missing_user';

        this.monitoringService.recordJoinChainFailure(
          userId,
          row.swap_id,
          'missing_user',
          {
            proposerUserId: row.proposer_user_id,
            userLookupAttempted: true
          }
        );

        // Record missing user relationship diagnostic information (Requirement 3.2)
        this.monitoringService.recordMissingUserRelationship(
          row.swap_id,
          row.proposer_user_id,
          'user_record',
          {
            expectedTable: 'users',
            expectedId: row.proposer_user_id,
            actualResult: null,
            queryUsed: 'LEFT JOIN users u ON tb.user_id = u.id'
          }
        );
      }

      if (joinChainComplete) {
        joinChainStats.complete++;
        // Record successful JOIN chain completion
        this.monitoringService.recordJoinChainSuccess(userId, row.swap_id, row.proposer_name);
      } else {
        failedJoins.push({
          swap_id: row.swap_id,
          failure_type: failureType,
          proposer_id: row.proposer_user_id,
          details: row
        });
      }
    });

    // Log comprehensive JOIN chain statistics (Requirement 3.1, 3.2)
    const successRate = joinChainStats.total > 0
      ? ((joinChainStats.complete / joinChainStats.total) * 100).toFixed(2)
      : '100.00';

    logger.info('JOIN chain validation results with comprehensive monitoring', {
      userId,
      stats: joinChainStats,
      successRate: `${successRate}%`,
      failedJoinCount: failedJoins.length,
      requirement: '3.1',
      monitoringEnabled: true
    });

    // Log detailed failure information for diagnostic purposes (Requirement 3.2)
    if (joinChainStats.null_proposer_names > 0) {
      logger.warn('Proposer names are NULL in query results - diagnostic logging enabled', {
        userId,
        nullProposerCount: joinChainStats.null_proposer_names,
        totalRows: joinChainStats.total,
        nullRate: `${((joinChainStats.null_proposer_names / joinChainStats.total) * 100).toFixed(2)}%`,
        requirement: '3.1',
        diagnosticAction: 'Investigating user data integrity'
      });
    }

    // Log critical issues that need immediate attention (Requirement 3.2)
    if (failedJoins.length > 0) {
      logger.error('Critical JOIN chain failures detected with enhanced diagnostics', {
        userId,
        failureCount: failedJoins.length,
        failures: failedJoins.slice(0, 5), // Log first 5 failures to avoid log spam
        requirement: '3.2',
        diagnosticInfo: {
          missingSwapTargets: joinChainStats.missing_swap_targets,
          missingTargetBookings: joinChainStats.missing_target_bookings,
          missingUsers: joinChainStats.missing_users,
          nullProposerNames: joinChainStats.null_proposer_names
        }
      });
    }
  }

  /**
   * Enhanced proposer lookup with comprehensive monitoring
   * Requirements: 3.3, 3.4
   */
  async getProposerDetailsWithMonitoring(swapId: string): Promise<{
    userId: string | null;
    displayName: string | null;
    email: string | null;
    lookupMethod: 'direct' | 'booking_derived' | 'swap_target_derived' | 'fallback';
    isValid: boolean;
  }> {
    const startTime = Date.now();
    let lookupMethod: 'direct' | 'booking_derived' | 'swap_target_derived' | 'fallback' = 'direct';
    let success = false;
    let proposerName: string | null = null;
    let proposerId: string | null = null;
    let error: string | undefined;

    try {
      // Strategy 1: Direct lookup via source booking
      const directQuery = `
        SELECT u.id as user_id, u.display_name, u.email
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE s.id = $1
      `;

      let result = await this.pool.query(directQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].display_name) {
        success = true;
        proposerId = result.rows[0].user_id;
        proposerName = result.rows[0].display_name;
        lookupMethod = 'direct';

        logger.debug('Proposer details found via direct lookup with monitoring', {
          swapId,
          userId: result.rows[0].user_id,
          method: 'direct',
          responseTime: Date.now() - startTime,
          requirement: '3.3'
        });

        // Record successful lookup
        this.monitoringService.recordProposerLookupAttempt(
          swapId,
          proposerId,
          'direct',
          true,
          proposerName
        );

        return {
          userId: result.rows[0].user_id,
          displayName: result.rows[0].display_name,
          email: result.rows[0].email,
          lookupMethod: 'direct',
          isValid: true
        };
      }

      // Strategy 2: Lookup via swap_targets relationship (for proposals)
      lookupMethod = 'swap_target_derived';
      const swapTargetQuery = `
        SELECT u.id as user_id, u.display_name, u.email
        FROM swap_targets st
        JOIN ${this.tableName} s ON st.source_swap_id = s.id
        JOIN bookings b ON s.source_booking_id = b.id
        JOIN users u ON b.user_id = u.id
        WHERE st.source_swap_id = $1 AND st.status = 'active'
      `;

      result = await this.pool.query(swapTargetQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].display_name) {
        success = true;
        proposerId = result.rows[0].user_id;
        proposerName = result.rows[0].display_name;

        logger.debug('Proposer details found via swap_targets lookup with monitoring', {
          swapId,
          userId: result.rows[0].user_id,
          method: 'swap_target_derived',
          responseTime: Date.now() - startTime,
          requirement: '3.3'
        });

        // Record successful lookup
        this.monitoringService.recordProposerLookupAttempt(
          swapId,
          proposerId,
          'swap_target_derived',
          true,
          proposerName
        );

        return {
          userId: result.rows[0].user_id,
          displayName: result.rows[0].display_name,
          email: result.rows[0].email,
          lookupMethod: 'swap_target_derived',
          isValid: true
        };
      }

      // Strategy 3: Fallback - get user ID and try direct user lookup
      lookupMethod = 'fallback';
      const userIdQuery = `
        SELECT b.user_id
        FROM ${this.tableName} s
        JOIN bookings b ON s.source_booking_id = b.id
        WHERE s.id = $1
      `;

      result = await this.pool.query(userIdQuery, [swapId]);

      if (result.rows.length > 0 && result.rows[0].user_id) {
        const userId = result.rows[0].user_id;
        proposerId = userId;

        const userQuery = `
          SELECT id as user_id, display_name, email
          FROM users
          WHERE id = $1
        `;

        const userResult = await this.pool.query(userQuery, [userId]);

        if (userResult.rows.length > 0) {
          success = !!userResult.rows[0].display_name;
          proposerName = userResult.rows[0].display_name;

          logger.warn('Proposer details found via fallback user lookup with monitoring', {
            swapId,
            userId,
            method: 'fallback',
            hasDisplayName: !!userResult.rows[0].display_name,
            responseTime: Date.now() - startTime,
            requirement: '3.4'
          });

          // Record lookup attempt (success depends on display_name presence)
          this.monitoringService.recordProposerLookupAttempt(
            swapId,
            proposerId,
            'fallback',
            success,
            proposerName,
            success ? undefined : 'User found but display_name is null'
          );

          return {
            userId: userResult.rows[0].user_id,
            displayName: userResult.rows[0].display_name,
            email: userResult.rows[0].email,
            lookupMethod: 'fallback',
            isValid: success
          };
        }
      }

      // No user data found - record failure
      error = 'No proposer details found through any lookup method';
      logger.error('No proposer details found for swap with comprehensive monitoring', {
        swapId,
        lookupMethod,
        responseTime: Date.now() - startTime,
        requirement: '3.4'
      });

      // Record failed lookup
      if (proposerId) {
        this.monitoringService.recordProposerLookupAttempt(
          swapId,
          proposerId,
          lookupMethod,
          false,
          undefined,
          error
        );
      }

      return {
        userId: null,
        displayName: null,
        email: null,
        lookupMethod: 'fallback',
        isValid: false
      };

    } catch (lookupError) {
      error = lookupError instanceof Error ? lookupError.message : 'Unknown error';

      logger.error('Failed to get proposer details with monitoring', {
        error,
        swapId,
        lookupMethod,
        responseTime: Date.now() - startTime,
        requirement: '3.4'
      });

      // Record failed lookup
      if (proposerId) {
        this.monitoringService.recordProposerLookupAttempt(
          swapId,
          proposerId,
          lookupMethod,
          false,
          undefined,
          error
        );
      }

      return {
        userId: null,
        displayName: null,
        email: null,
        lookupMethod: 'fallback',
        isValid: false
      };
    }
  }

  /**
   * Enrich query results with missing proposer data using fallback lookups
   * Requirements: 1.3, 2.4
   */
  async enrichSwapCardsWithProposerData(rows: any[]): Promise<any[]> {
    const enrichedRows = [...rows];
    const missingProposerRows = rows.filter(row => !row.proposer_name && row.join_chain_status !== 'no_swap_target');

    if (missingProposerRows.length === 0) {
      return enrichedRows;
    }

    logger.info('Enriching swap cards with missing proposer data', {
      totalRows: rows.length,
      missingProposerCount: missingProposerRows.length,
      requirement: '2.4'
    });

    // Batch lookup for missing proposer data
    for (const row of missingProposerRows) {
      try {
        const proposerDetails = await this.getProposerDetails(row.swap_id);

        if (proposerDetails.isValid) {
          // Find and update the corresponding row
          const rowIndex = enrichedRows.findIndex(r => r.swap_id === row.swap_id);
          if (rowIndex !== -1) {
            enrichedRows[rowIndex] = {
              ...enrichedRows[rowIndex],
              proposer_name: proposerDetails.displayName,
              proposer_email: proposerDetails.email,
              proposer_user_id: proposerDetails.userId,
              join_chain_status: 'enriched_' + proposerDetails.lookupMethod
            };

            logger.debug('Successfully enriched proposer data', {
              swapId: row.swap_id,
              lookupMethod: proposerDetails.lookupMethod,
              proposerName: proposerDetails.displayName,
              requirement: '2.4'
            });
          }
        } else {
          logger.warn('Failed to enrich proposer data for swap', {
            swapId: row.swap_id,
            lookupMethod: proposerDetails.lookupMethod,
            requirement: '2.4'
          });
        }
      } catch (error) {
        logger.error('Error during proposer data enrichment', {
          swapId: row.swap_id,
          error,
          requirement: '2.4'
        });
      }
    }

    const successfulEnrichments = enrichedRows.filter(row =>
      row.join_chain_status?.startsWith('enriched_')
    ).length;

    logger.info('Proposer data enrichment completed', {
      totalAttempts: missingProposerRows.length,
      successfulEnrichments,
      successRate: `${((successfulEnrichments / missingProposerRows.length) * 100).toFixed(2)}%`,
      requirement: '2.4'
    });

    return enrichedRows;
  }

  /**
   * Enrich query results with missing proposer data using monitored fallback lookups
   * Requirements: 1.3, 2.4, 3.3, 3.4
   */
  async enrichSwapCardsWithProposerDataMonitored(rows: any[]): Promise<any[]> {
    const enrichedRows = [...rows];
    const missingProposerRows = rows.filter(row => !row.proposer_name && row.join_chain_status !== 'no_swap_target');

    if (missingProposerRows.length === 0) {
      return enrichedRows;
    }

    logger.info('Enriching swap cards with missing proposer data - monitored version', {
      totalRows: rows.length,
      missingProposerCount: missingProposerRows.length,
      requirement: '3.3'
    });

    // Batch lookup for missing proposer data with comprehensive monitoring
    for (const row of missingProposerRows) {
      try {
        const proposerDetails = await this.getProposerDetailsWithMonitoring(row.swap_id);

        if (proposerDetails.isValid) {
          // Find and update the corresponding row
          const rowIndex = enrichedRows.findIndex(r => r.swap_id === row.swap_id);
          if (rowIndex !== -1) {
            enrichedRows[rowIndex] = {
              ...enrichedRows[rowIndex],
              proposer_name: proposerDetails.displayName,
              proposer_email: proposerDetails.email,
              proposer_user_id: proposerDetails.userId,
              join_chain_status: 'enriched_' + proposerDetails.lookupMethod
            };

            logger.debug('Successfully enriched proposer data with monitoring', {
              swapId: row.swap_id,
              lookupMethod: proposerDetails.lookupMethod,
              proposerName: proposerDetails.displayName,
              requirement: '3.3'
            });
          }
        } else {
          logger.warn('Failed to enrich proposer data for swap - comprehensive monitoring', {
            swapId: row.swap_id,
            lookupMethod: proposerDetails.lookupMethod,
            requirement: '3.4'
          });
        }
      } catch (error) {
        logger.error('Error during monitored proposer data enrichment', {
          swapId: row.swap_id,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          requirement: '3.4'
        });
      }
    }

    const successfulEnrichments = enrichedRows.filter(row =>
      row.join_chain_status?.startsWith('enriched_')
    ).length;

    logger.info('Monitored proposer data enrichment completed', {
      totalAttempts: missingProposerRows.length,
      successfulEnrichments,
      successRate: `${((successfulEnrichments / missingProposerRows.length) * 100).toFixed(2)}%`,
      requirement: '3.4'
    });

    return enrichedRows;
  }

  /**
   * Enhanced swap cards query with targeting data
   * Single optimized query that fetches swap cards with all targeting relationships
   * Requirements: 3.1, 3.2, 7.1, 7.2
   */
  async findSwapCardsWithTargetingData(userId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const query = `
        WITH user_swaps AS (
          SELECT s.id, s.source_booking_id, s.status, s.created_at, s.expires_at,
                 s.acceptance_strategy, s.additional_payment, s.conditions,
                 sb.user_id as owner_id
          FROM swaps s
          JOIN bookings sb ON s.source_booking_id = sb.id
          WHERE sb.user_id = $1 
            AND s.status IN ('pending', 'accepted', 'completed')
          ORDER BY s.created_at DESC
          LIMIT $2 OFFSET $3
        ),
        swap_proposals AS (
          SELECT sp.id, st.source_swap_id, ts.source_booking_id as target_booking_id,
                 sb.user_id as proposer_id, sp.status as proposal_status, sp.created_at as proposal_created_at,
                 u.display_name as proposer_name, u.email as proposer_email
          FROM swap_targets st
          JOIN swaps sp ON st.source_swap_id = sp.id
          JOIN swaps ts ON st.target_swap_id = ts.id
          JOIN bookings sb ON sp.source_booking_id = sb.id
          JOIN users u ON sb.user_id = u.id
          WHERE st.target_swap_id IN (SELECT id FROM user_swaps)
            AND st.status = 'active'
            AND sb.user_id != $1  -- Exclude self-proposals
            AND sp.status IN ('pending', 'accepted')
        ),
        incoming_targets AS (
          SELECT st.id as target_id, st.target_swap_id, st.source_swap_id,
                 st.status as target_status, st.created_at as target_created_at,
                 s.source_booking_id as source_booking_id,
                 sb.user_id as source_owner_id, u.display_name as source_owner_name, u.email as source_owner_email
          FROM swap_targets st
          JOIN swaps s ON st.source_swap_id = s.id
          JOIN bookings sb ON s.source_booking_id = sb.id
          JOIN users u ON sb.user_id = u.id
          WHERE st.target_swap_id IN (SELECT id FROM user_swaps)
            AND st.status = 'active'
        ),
        outgoing_targets AS (
          SELECT st.id as target_id, st.source_swap_id, st.target_swap_id,
                 st.status as target_status, st.created_at as target_created_at,
                 s.source_booking_id as target_booking_id,
                 tb.user_id as target_owner_id, u.display_name as target_owner_name, u.email as target_owner_email,
                 s.acceptance_strategy as target_acceptance_strategy
          FROM swap_targets st
          JOIN swaps s ON st.target_swap_id = s.id
          JOIN bookings tb ON s.source_booking_id = tb.id
          JOIN users u ON tb.user_id = u.id
          WHERE st.source_swap_id IN (SELECT id FROM user_swaps)
            AND st.status = 'active'
        )
        SELECT 
          -- User swap data
          us.id as swap_id,
          us.source_booking_id,
          us.status as swap_status,
          us.created_at as swap_created_at,
          us.expires_at as swap_expires_at,
          us.acceptance_strategy,
          us.owner_id as proposer_id,
          us.additional_payment,
          us.conditions,
          
          -- User booking details
          ub.id as user_booking_id_full,
          ub.title as user_booking_title,
          ub.city as user_booking_city,
          ub.country as user_booking_country,
          ub.check_in_date as user_booking_check_in,
          ub.check_out_date as user_booking_check_out,
          ub.original_price as user_booking_original_price,
          ub.swap_value as user_booking_swap_value,
          
          -- Proposal data (existing)
          sp.proposer_id as proposal_proposer_id,
          sp.proposer_name,
          sp.proposer_email,
          sp.proposal_status,
          sp.proposal_created_at,
          
          -- Proposal booking details
          pb.id as proposal_booking_id_full,
          pb.title as proposal_booking_title,
          pb.city as proposal_booking_city,
          pb.country as proposal_booking_country,
          pb.check_in_date as proposal_booking_check_in,
          pb.check_out_date as proposal_booking_check_out,
          pb.original_price as proposal_booking_original_price,
          pb.swap_value as proposal_booking_swap_value,
          
          -- Incoming targeting data
          it.target_id as incoming_target_id,
          it.source_swap_id as incoming_source_swap_id,
          it.target_status as incoming_target_status,
          it.target_created_at as incoming_target_created_at,
          it.source_owner_id as incoming_proposer_id,
          it.source_owner_name as incoming_proposer_name,
          it.source_owner_email as incoming_proposer_email,
          isb.id as incoming_source_booking_id,
          isb.title as incoming_source_booking_title,
          isb.city as incoming_source_booking_city,
          isb.country as incoming_source_booking_country,
          isb.check_in_date as incoming_source_booking_check_in,
          isb.check_out_date as incoming_source_booking_check_out,
          isb.original_price as incoming_source_booking_original_price,
          isb.swap_value as incoming_source_booking_swap_value,
          
          -- Outgoing targeting data
          ot.target_id as outgoing_target_id,
          ot.target_swap_id as outgoing_target_swap_id,
          ot.target_status as outgoing_target_status,
          ot.target_created_at as outgoing_target_created_at,
          ot.target_owner_id as outgoing_target_owner_id,
          ot.target_owner_name as outgoing_target_owner_name,
          ot.target_owner_email as outgoing_target_owner_email,
          ot.target_acceptance_strategy as outgoing_target_acceptance_strategy,
          otb.id as outgoing_target_booking_id,
          otb.title as outgoing_target_booking_title,
          otb.city as outgoing_target_booking_city,
          otb.country as outgoing_target_booking_country,
          otb.check_in_date as outgoing_target_booking_check_in,
          otb.check_out_date as outgoing_target_booking_check_out,
          otb.original_price as outgoing_target_booking_original_price,
          otb.swap_value as outgoing_target_booking_swap_value

        FROM user_swaps us
        LEFT JOIN bookings ub ON us.source_booking_id = ub.id
        LEFT JOIN swap_proposals sp ON us.id = sp.source_swap_id
        LEFT JOIN bookings pb ON sp.target_booking_id = pb.id
        LEFT JOIN incoming_targets it ON us.id = it.target_swap_id
        LEFT JOIN bookings isb ON it.source_booking_id = isb.id
        LEFT JOIN outgoing_targets ot ON us.id = ot.source_swap_id
        LEFT JOIN swaps ots ON ot.target_swap_id = ots.id
        LEFT JOIN bookings otb ON ots.source_booking_id = otb.id

        ORDER BY us.created_at DESC, sp.proposal_created_at DESC, it.target_created_at DESC
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to find swap cards with targeting data', { error, userId });
      throw error;
    }
  }

  /**
   * Find swaps by user ID with complete booking details
   * Uses LEFT JOINs to include booking information for both source and target bookings
   * Enhanced with comprehensive error handling for missing or soft-deleted bookings
   * Includes performance monitoring and optimization
   */
  async findByUserIdWithBookingDetails(userId: string, limit: number = 100, offset: number = 0): Promise<SwapWithBookingDetails[]> {
    const startTime = Date.now();

    try {
      const query = `
        SELECT 
          s.*,
          sb.id as source_booking_id,
          sb.title as source_booking_title,
          sb.city as source_booking_city,
          sb.country as source_booking_country,
          sb.check_in_date as source_booking_check_in,
          sb.check_out_date as source_booking_check_out,
          sb.original_price as source_booking_original_price,
          sb.swap_value as source_booking_swap_value,
          sb.status as source_booking_status,
          tb.id as target_booking_id,
          tb.title as target_booking_title,
          tb.city as target_booking_city,
          tb.country as target_booking_country,
          tb.check_in_date as target_booking_check_in,
          tb.check_out_date as target_booking_check_out,
          tb.original_price as target_booking_original_price,
          tb.swap_value as target_booking_swap_value,
          tb.status as target_booking_status
        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN swap_targets st ON s.id = st.source_swap_id AND st.status = 'active'
        LEFT JOIN ${this.tableName} ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        WHERE sb.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      const executionTime = Date.now() - startTime;

      // Record query performance metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('swap_query_execution_time', executionTime, 'ms', {
          operation: 'findByUserIdWithBookingDetails',
          userId,
          resultCount: result.rows.length,
          limit,
          offset,
          queryType: 'join_with_bookings'
        });
      }

      // Process results with enhanced error handling
      const processedRows = result.rows.map(row => {
        try {
          return this.mapRowToSwapWithBookingDetails(row);
        } catch (mappingError: any) {
          // Log mapping errors but don't fail the entire request
          logger.warn('Failed to map swap row with booking details', {
            swapId: row.id,
            sourceBookingId: row.source_booking_id,
            targetBookingId: row.target_booking_id,
            error: mappingError.message || mappingError,
            userId
          });

          // Return swap with null booking details as fallback
          const baseSwap = this.mapRowToEntity(row);
          return {
            ...baseSwap,
            sourceBooking: null,
            targetBooking: null
          } as SwapWithBookingDetails;
        }
      });

      // Log warnings for missing booking data
      const missingSourceBookings = processedRows.filter(swap =>
        swap.sourceBookingId && !swap.sourceBooking
      ).length;

      const missingTargetBookings = processedRows.filter(swap =>
        swap.targetBookingId && !swap.targetBooking
      ).length;

      // Performance monitoring and logging
      const performanceMetrics = {
        userId,
        executionTime,
        totalSwaps: processedRows.length,
        missingSourceBookings,
        missingTargetBookings,
        limit,
        offset,
        queryComplexity: 'high', // JOIN with two tables
        meetsPerformanceTarget: executionTime <= 2000
      };

      // Log performance metrics
      if (executionTime > 2000) {
        logger.warn('Query execution time exceeds 2-second target', performanceMetrics);
      } else if (executionTime > 1000) {
        logger.info('Query execution time approaching target threshold', performanceMetrics);
      } else {
        logger.debug('Query performance within acceptable range', performanceMetrics);
      }

      // Log booking data completeness warnings
      if (missingSourceBookings > 0 || missingTargetBookings > 0) {
        logger.warn('Some booking details are missing from swap results', performanceMetrics);
      }

      // Calculate and record booking detail retrieval success rates
      const totalBookingReferences = processedRows.reduce((count, swap) => {
        return count + (swap.sourceBookingId ? 1 : 0) + (swap.targetBookingId ? 1 : 0);
      }, 0);

      const successfulBookingRetrievals = processedRows.reduce((count, swap) => {
        return count + (swap.sourceBooking ? 1 : 0) + (swap.targetBooking ? 1 : 0);
      }, 0);

      const bookingRetrievalSuccessRate = totalBookingReferences > 0
        ? (successfulBookingRetrievals / totalBookingReferences) * 100
        : 100; // 100% if no bookings to retrieve

      // Record booking detail retrieval success rate metrics
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMetric('booking_detail_retrieval_success_rate', bookingRetrievalSuccessRate, 'percentage', {
          operation: 'findByUserIdWithBookingDetails',
          userId,
          totalBookingReferences,
          successfulRetrievals: successfulBookingRetrievals,
          missingSourceBookings,
          missingTargetBookings,
          swapCount: processedRows.length
        });

        // Record data quality metrics
        this.performanceMonitor.recordMetric('swap_data_completeness',
          processedRows.length > 0 ? ((processedRows.length - missingSourceBookings - missingTargetBookings) / processedRows.length) * 100 : 100,
          'percentage', {
          operation: 'findByUserIdWithBookingDetails',
          userId,
          totalSwaps: processedRows.length,
          completeSwaps: processedRows.length - missingSourceBookings - missingTargetBookings
        }
        );
      }

      // Log success rate metrics for monitoring
      const bookingRetrievalSuccessRateForLogging = processedRows.length > 0
        ? ((processedRows.length - missingSourceBookings - missingTargetBookings) / (processedRows.length * 2)) * 100
        : 100;

      logger.info('Swap booking details retrieval completed', {
        ...performanceMetrics,
        bookingRetrievalSuccessRate: Math.round(bookingRetrievalSuccessRate * 100) / 100
      });

      return processedRows;
    } catch (error: any) {
      logger.error('Failed to find swaps by user ID with booking details', {
        error: error.message || error,
        stack: error.stack,
        userId,
        limit,
        offset
      });

      // Don't throw immediately - let service layer handle fallback
      throw error;
    }
  }

  /**
   * Find pending proposals for a specific booking (excluding self-proposals)
   * Requirements: 3.1, 3.4
   */
  async findPendingProposalsForBooking(bookingId: string): Promise<Swap[]> {
    try {
      // Find swaps where the booking is the source, OR where it's the target via swap_targets
      const query = `
        SELECT DISTINCT s.*
        FROM ${this.tableName} s
        LEFT JOIN swap_targets st_source ON s.id = st_source.source_swap_id AND st_source.status = 'active'
        LEFT JOIN ${this.tableName} target_swap ON st_source.target_swap_id = target_swap.id
        LEFT JOIN swap_targets st_target ON s.id = st_target.target_swap_id AND st_target.status = 'active'
        JOIN bookings sb ON s.source_booking_id = sb.id
        WHERE (
          s.source_booking_id = $1 
          OR target_swap.source_booking_id = $1
          OR (st_target.target_swap_id = s.id AND s.source_booking_id = $1)
        )
        AND s.status = 'pending'
        ORDER BY s.created_at DESC
      `;

      const result = await this.pool.query(query, [bookingId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find pending proposals for booking', { error, bookingId });
      throw error;
    }
  }

  /**
   * Find pending proposal between two specific bookings (excluding self-proposals)
   * Requirements: 3.1, 3.4
   */
  async findPendingProposalBetweenBookings(sourceBookingId: string, targetBookingId: string): Promise<Swap | null> {
    try {
      // Find swap where source booking targets another swap with target booking
      const query = `
        SELECT s.*
        FROM ${this.tableName} s
        JOIN swap_targets st ON s.id = st.source_swap_id
        JOIN ${this.tableName} ts ON st.target_swap_id = ts.id
        WHERE s.source_booking_id = $1 
        AND ts.source_booking_id = $2
        AND s.status = 'pending'
        AND st.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [sourceBookingId, targetBookingId]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find pending proposal between bookings', {
        error,
        sourceBookingId,
        targetBookingId
      });
      throw error;
    }
  }

  /**
   * Find counterpart pending proposal between two specific bookings (reversed order)
   */
  async findCounterpartPendingProposalBetweenBookings(sourceBookingId: string, targetBookingId: string): Promise<Swap | null> {
    try {
      // Find swap in reverse direction (target booking's swap targeting source booking's swap)
      const query = `
        SELECT s.*
        FROM ${this.tableName} s
        JOIN swap_targets st ON s.id = st.source_swap_id
        JOIN ${this.tableName} ts ON st.target_swap_id = ts.id
        WHERE s.source_booking_id = $1
        AND ts.source_booking_id = $2
        AND s.status = 'pending'
        AND st.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [targetBookingId, sourceBookingId]);
      return result.rows[0] ? this.mapRowToEntity(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find counterpart pending proposal between bookings', {
        error,
        sourceBookingId,
        targetBookingId
      });
      throw error;
    }
  }

  /**
   * Find expired proposals
   */
  async findExpiredProposals(): Promise<Swap[]> {
    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE status = 'pending'
        AND expires_at < CURRENT_TIMESTAMP
        ORDER BY created_at ASC
      `;

      const result = await this.pool.query(query);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find expired proposals', { error });
      throw error;
    }
  }

  /**
   * Find swaps with filters
   */
  async findByFilters(filters: SwapFilters, limit: number = 100, offset: number = 0): Promise<Swap[]> {
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      if (filters.status) {
        conditions.push(`s.status = $${++paramCount}`);
        values.push(filters.status);
      }

      // Handle deprecated proposerId filter - derive from booking relationship
      if (filters.proposerId) {
        logger.warn('proposerId filter is deprecated after schema simplification, using userIdViaBooking instead', {
          proposerId: filters.proposerId
        });
        conditions.push(`sb.user_id = $${++paramCount}`);
        values.push(filters.proposerId);
      }

      // Handle deprecated ownerId filter - derive from booking relationship
      if (filters.ownerId) {
        logger.warn('ownerId filter is deprecated after schema simplification, using userIdViaBooking instead', {
          ownerId: filters.ownerId
        });
        conditions.push(`sb.user_id = $${++paramCount}`);
        values.push(filters.ownerId);
      }

      // New filter for user-based queries that work with simplified schema
      if (filters.userIdViaBooking) {
        conditions.push(`sb.user_id = $${++paramCount}`);
        values.push(filters.userIdViaBooking);
      }

      if (filters.excludeUserIdViaBooking || filters.excludeOwnerId) {
        const excludeUserId = filters.excludeUserIdViaBooking || filters.excludeOwnerId;
        conditions.push(`sb.user_id != $${++paramCount}`);
        values.push(excludeUserId);
      }

      // Note: Self-proposal filtering is handled at the service layer
      // Here we only filter based on explicit user ID exclusions

      if (filters.sourceBookingId) {
        conditions.push(`s.source_booking_id = $${++paramCount}`);
        values.push(filters.sourceBookingId);
      }

      // Note: targetBookingId filter is deprecated - targeting is now in swap_targets table
      // To filter by target booking, query swap_targets table directly
      if (filters.targetBookingId) {
        logger.warn('targetBookingId filter is deprecated and not supported after schema simplification', {
          targetBookingId: filters.targetBookingId
        });
        // This filter is no longer supported - targeting relationships are in swap_targets table
      }

      if (filters.createdAfter) {
        conditions.push(`s.created_at >= $${++paramCount}`);
        values.push(filters.createdAfter);
      }

      if (filters.createdBefore) {
        conditions.push(`s.created_at <= $${++paramCount}`);
        values.push(filters.createdBefore);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Updated query to use simplified schema with booking join for user relationships
      const query = `
        SELECT s.* FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      values.push(limit, offset);

      const result = await this.pool.query(query, values);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find swaps by filters', { error, filters });
      throw error;
    }
  }

  /**
   * Get swap statistics for a user
   */
  async getUserSwapStats(userId: string): Promise<{
    totalProposed: number;
    totalReceived: number;
    completedSwaps: number;
    cancelledSwaps: number;
    pendingProposals: number;
  }> {
    try {
      // Updated query for simplified schema - derive relationships from bookings
      const query = `
        SELECT 
          COUNT(CASE WHEN sb.user_id = $1 THEN 1 END) as total_proposed,
          -- For received swaps, we need to check swap_targets table for incoming proposals
          (SELECT COUNT(*) FROM swap_targets st 
           JOIN ${this.tableName} ts ON st.target_swap_id = ts.id 
           JOIN bookings tb ON ts.source_booking_id = tb.id 
           WHERE tb.user_id = $1 AND st.status = 'active') as total_received,
          COUNT(CASE WHEN sb.user_id = $1 AND s.status = 'completed' THEN 1 END) as completed_swaps,
          COUNT(CASE WHEN sb.user_id = $1 AND s.status = 'cancelled' THEN 1 END) as cancelled_swaps,
          COUNT(CASE WHEN sb.user_id = $1 AND s.status = 'pending' THEN 1 END) as pending_proposals
        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        WHERE sb.user_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      const row = result.rows[0];

      return {
        totalProposed: parseInt(row.total_proposed) || 0,
        totalReceived: parseInt(row.total_received) || 0,
        completedSwaps: parseInt(row.completed_swaps) || 0,
        cancelledSwaps: parseInt(row.cancelled_swaps) || 0,
        pendingProposals: parseInt(row.pending_proposals) || 0,
      };
    } catch (error) {
      logger.error('Failed to get user swap stats', { error, userId });
      throw error;
    }
  }

  /**
   * Find active swaps by user ID excluding a specific swap
   * Used for finding eligible swaps for proposal creation
   */
  async findActiveSwapsByUserIdExcluding(userId: string, excludeSwapId: string): Promise<Swap[]> {
    try {
      // Updated query for simplified schema - derive relationships from bookings
      const query = `
        SELECT s.* FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        WHERE sb.user_id = $1
        AND s.status = 'active'
        AND s.id != $2
        ORDER BY s.created_at DESC
      `;

      const result = await this.pool.query(query, [userId, excludeSwapId]);
      return result.rows.map(row => this.mapRowToEntity(row));
    } catch (error) {
      logger.error('Failed to find active swaps by user ID excluding specific swap', {
        error,
        userId,
        excludeSwapId
      });
      throw error;
    }
  }

  /**
   * Check for existing proposals between two swaps
   * Returns true if a proposal already exists between the source and target swaps
   * Uses optimized database function for better performance
   */
  async hasExistingProposalBetweenSwaps(sourceSwapId: string, targetSwapId: string): Promise<boolean> {
    try {
      const startTime = Date.now();

      // Use optimized database function
      const query = `
        SELECT has_existing_proposal_optimized($1, $2) as exists
      `;

      const result = await this.pool.query(query, [sourceSwapId, targetSwapId]);
      const executionTime = Date.now() - startTime;

      // Log performance if it's slow
      if (executionTime > 100) {
        logger.warn('Slow proposal existence check', {
          sourceSwapId,
          targetSwapId,
          executionTime
        });
      }

      return result.rows[0]?.exists || false;
    } catch (error) {
      logger.error('Failed to check for existing proposals between swaps', {
        error,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Find eligible swaps with booking details for proposal creation
   * Returns swaps that can be used to make proposals, including booking information
   * Uses optimized database function for better performance
   * Requirements: 3.1, 3.2, 3.3
   */
  async findEligibleSwapsWithBookingDetails(userId: string, targetSwapId: string): Promise<EligibleSwap[]> {
    try {
      const startTime = Date.now();

      // Use optimized database function
      const query = `
        SELECT * FROM find_eligible_swaps_optimized($1, $2, $3)
      `;

      const result = await this.pool.query(query, [userId, targetSwapId, 50]);
      const executionTime = Date.now() - startTime;

      // Log performance if it's slow
      if (executionTime > 500) {
        logger.warn('Slow eligible swaps query', {
          userId,
          targetSwapId,
          executionTime,
          resultCount: result.rows.length
        });
      }

      // Validate that the function returns expected data structure
      if (result.rows.length > 0) {
        const firstRow = result.rows[0];
        const requiredFields = ['swap_id', 'source_booking_id', 'booking_title', 'swap_status', 'created_at'];
        const missingFields = requiredFields.filter(field => !(field in firstRow));

        if (missingFields.length > 0) {
          logger.warn('Database function returned incomplete data structure', {
            userId,
            targetSwapId,
            missingFields,
            availableFields: Object.keys(firstRow),
            requirement: '3.3'
          });
        }
      }

      return result.rows.map(row => ({
        id: row.swap_id,
        sourceBookingId: row.source_booking_id,
        title: row.booking_title || 'Untitled Booking',
        description: row.booking_description || '',
        bookingDetails: {
          location: row.city && row.country ? `${row.city}, ${row.country}` : row.location || '',
          dateRange: {
            checkIn: new Date(row.check_in_date),
            checkOut: new Date(row.check_out_date)
          },
          accommodationType: row.booking_type || row.accommodation_type || '',
          guests: row.guests || 1,
          estimatedValue: parseFloat(row.estimated_value) || 0
        },
        status: row.swap_status as SwapStatus,
        createdAt: new Date(row.created_at),
        isCompatible: false, // Will be calculated separately
        compatibilityScore: undefined // Will be calculated separately
      }));
    } catch (error: any) {
      // Use the schema error detection utility (Requirements: 3.1, 3.2)
      const schemaError = detectSchemaError(error);

      if (schemaError) {
        logger.error('Database schema error in findEligibleSwapsWithBookingDetails', {
          error: schemaError.message,
          errorCode: schemaError.code,
          category: schemaError.category,
          userId,
          targetSwapId,
          requirement: '3.1',
          resolution: schemaError.resolution
        });

        throw new DatabaseSchemaError(schemaError.userMessage, error);
      }

      // Handle other database errors
      logger.error('Failed to find eligible swaps with booking details', {
        error: error.message,
        errorCode: error.code,
        stack: error.stack,
        userId,
        targetSwapId,
        requirement: '3.2'
      });

      throw new SwapMatchingError('Failed to get eligible swaps', error);
    }
  }

  /**
   * Get compatibility factors for two bookings
   * Used for compatibility analysis
   */
  async getCompatibilityFactors(sourceBookingId: string, targetBookingId: string): Promise<any> {
    try {
      const query = `
        SELECT * FROM get_compatibility_factors($1, $2)
      `;

      const result = await this.pool.query(query, [sourceBookingId, targetBookingId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get compatibility factors', {
        error,
        sourceBookingId,
        targetBookingId
      });
      throw error;
    }
  }

  /**
   * Batch analyze compatibility for multiple swap pairs
   */
  async batchAnalyzeCompatibility(
    swapPairs: Array<{ sourceSwapId: string; targetSwapId: string }>
  ): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM batch_analyze_compatibility($1)
      `;

      const result = await this.pool.query(query, [JSON.stringify(swapPairs)]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to batch analyze compatibility', {
        error,
        pairCount: swapPairs.length
      });
      throw error;
    }
  }

  /**
   * Store compatibility analysis in cache
   */
  async storeCompatibilityCache(
    sourceSwapId: string,
    targetSwapId: string,
    score: number,
    analysis: any,
    ttlHours: number = 1
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO swap_compatibility_cache (
          source_swap_id,
          target_swap_id,
          compatibility_score,
          analysis_data,
          expires_at
        ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '${ttlHours} hours')
        ON CONFLICT (source_swap_id, target_swap_id)
        DO UPDATE SET
          compatibility_score = EXCLUDED.compatibility_score,
          analysis_data = EXCLUDED.analysis_data,
          expires_at = EXCLUDED.expires_at,
          created_at = CURRENT_TIMESTAMP
      `;

      await this.pool.query(query, [
        sourceSwapId,
        targetSwapId,
        score,
        JSON.stringify(analysis)
      ]);
    } catch (error) {
      logger.error('Failed to store compatibility cache', {
        error,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Get compatibility analysis from cache
   */
  async getCompatibilityCache(
    sourceSwapId: string,
    targetSwapId: string
  ): Promise<{ score: number; analysis: any } | null> {
    try {
      const query = `
        SELECT compatibility_score, analysis_data
        FROM swap_compatibility_cache
        WHERE (
          (source_swap_id = $1 AND target_swap_id = $2)
          OR
          (source_swap_id = $2 AND target_swap_id = $1)
        )
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [sourceSwapId, targetSwapId]);

      if (result.rows.length > 0) {
        return {
          score: parseFloat(result.rows[0].compatibility_score),
          analysis: result.rows[0].analysis_data
        };
      }

      return null;
    } catch (error) {
      logger.error('Failed to get compatibility cache', {
        error,
        sourceSwapId,
        targetSwapId
      });
      return null;
    }
  }

  /**
   * Store eligible swaps in cache
   */
  async storeEligibleSwapsCache(
    userId: string,
    targetSwapId: string,
    eligibleSwapIds: string[],
    ttlMinutes: number = 15
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO eligible_swaps_cache (
          user_id,
          target_swap_id,
          eligible_swap_ids,
          expires_at
        ) VALUES ($1, $2, $3, NOW() + INTERVAL '${ttlMinutes} minutes')
        ON CONFLICT (user_id, target_swap_id)
        DO UPDATE SET
          eligible_swap_ids = EXCLUDED.eligible_swap_ids,
          expires_at = EXCLUDED.expires_at,
          created_at = CURRENT_TIMESTAMP
      `;

      await this.pool.query(query, [userId, targetSwapId, eligibleSwapIds]);
    } catch (error) {
      logger.error('Failed to store eligible swaps cache', {
        error,
        userId,
        targetSwapId
      });
      throw error;
    }
  }

  /**
   * Get eligible swaps from cache
   */
  async getEligibleSwapsCache(
    userId: string,
    targetSwapId: string
  ): Promise<string[] | null> {
    try {
      const query = `
        SELECT eligible_swap_ids
        FROM eligible_swaps_cache
        WHERE user_id = $1 AND target_swap_id = $2
        AND expires_at > CURRENT_TIMESTAMP
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId, targetSwapId]);

      if (result.rows.length > 0) {
        return result.rows[0].eligible_swap_ids;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get eligible swaps cache', {
        error,
        userId,
        targetSwapId
      });
      return null;
    }
  }

  /**
   * Store proposal metadata for browse-initiated proposals
   */
  async storeProposalMetadata(metadata: {
    proposalId: string;
    sourceSwapId: string;
    targetSwapId: string;
    compatibilityScore?: number;
    message?: string;
  }): Promise<void> {
    try {
      const query = `
        INSERT INTO swap_proposal_metadata (
          proposal_id,
          source_swap_id,
          target_swap_id,
          compatibility_score,
          message
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (proposal_id)
        DO UPDATE SET
          compatibility_score = EXCLUDED.compatibility_score,
          message = EXCLUDED.message
      `;

      await this.pool.query(query, [
        metadata.proposalId,
        metadata.sourceSwapId,
        metadata.targetSwapId,
        metadata.compatibilityScore || null,
        metadata.message || null
      ]);
    } catch (error) {
      logger.error('Failed to store proposal metadata', {
        error,
        metadata
      });
      throw error;
    }
  }

  /**
   * Get proposal metadata
   */
  async getProposalMetadata(proposalId: string): Promise<any | null> {
    try {
      const query = `
        SELECT *
        FROM swap_proposal_metadata
        WHERE proposal_id = $1
      `;

      const result = await this.pool.query(query, [proposalId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get proposal metadata', {
        error,
        proposalId
      });
      return null;
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<{ compatibilityDeleted: number; eligibleSwapsDeleted: number }> {
    try {
      const query = `SELECT * FROM clean_swap_matching_cache()`;
      const result = await this.pool.query(query);

      return {
        compatibilityDeleted: result.rows[0]?.compatibility_deleted || 0,
        eligibleSwapsDeleted: result.rows[0]?.eligible_swaps_deleted || 0
      };
    } catch (error) {
      logger.error('Failed to clean expired cache', { error });
      throw error;
    }
  }

  /**
   * Store compatibility score for a swap pair
   * Used to cache compatibility analysis results
   */
  async storeCompatibilityScore(sourceSwapId: string, targetSwapId: string, score: number, analysis: any): Promise<void> {
    try {
      const query = `
        INSERT INTO swap_compatibility_scores (source_swap_id, target_swap_id, score, analysis, created_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (source_swap_id, target_swap_id) 
        DO UPDATE SET 
          score = EXCLUDED.score,
          analysis = EXCLUDED.analysis,
          updated_at = CURRENT_TIMESTAMP
      `;

      await this.pool.query(query, [sourceSwapId, targetSwapId, score, JSON.stringify(analysis)]);
    } catch (error) {
      logger.error('Failed to store compatibility score', {
        error,
        sourceSwapId,
        targetSwapId,
        score
      });
      throw error;
    }
  }

  /**
   * Retrieve compatibility score for a swap pair
   * Returns cached compatibility analysis if available
   */
  async getCompatibilityScore(sourceSwapId: string, targetSwapId: string): Promise<{ score: number; analysis: any } | null> {
    try {
      const query = `
        SELECT score, analysis FROM swap_compatibility_scores
        WHERE (source_swap_id = $1 AND target_swap_id = $2)
        OR (source_swap_id = $2 AND target_swap_id = $1)
        ORDER BY updated_at DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [sourceSwapId, targetSwapId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        score: row.score,
        analysis: typeof row.analysis === 'string' ? JSON.parse(row.analysis) : row.analysis
      };
    } catch (error) {
      logger.error('Failed to get compatibility score', {
        error,
        sourceSwapId,
        targetSwapId
      });
      throw error;
    }
  }

  // Admin methods
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    completed: number;
    rejected: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM ${this.tableName}
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      completed: parseInt(row.completed),
      rejected: parseInt(row.rejected)
    };
  }

  async getRecentActivity(limit: number = 50): Promise<any[]> {
    const query = `
      SELECT 
        s.*,
        sb.title as source_booking_title,
        tb.title as target_booking_title,
        u1.display_name as proposer_name,
        u2.display_name as owner_name
      FROM ${this.tableName} s
      LEFT JOIN bookings sb ON s.source_booking_id = sb.id
      LEFT JOIN bookings tb ON s.target_booking_id = tb.id
      LEFT JOIN users u1 ON s.proposer_id = u1.id
      LEFT JOIN users u2 ON s.owner_id = u2.id
      ORDER BY s.updated_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);

    return result.rows.map(row => ({
      id: row.id,
      type: 'swap',
      status: row.status,
      sourceBooking: {
        id: row.source_booking_id,
        title: row.source_booking_title
      },
      targetBooking: {
        id: row.target_booking_id,
        title: row.target_booking_title
      },
      proposer: {
        id: row.proposer_id,
        name: row.proposer_name
      },
      owner: {
        id: row.owner_id,
        name: row.owner_name
      },
      updatedAt: row.updated_at
    }));
  }

  /**
   * Helper method to log query performance metrics
   */
  private logQueryPerformance(
    operation: string,
    executionTime: number,
    resultCount: number,
    metadata?: Record<string, any>
  ): void {
    if (this.performanceMonitor) {
      this.performanceMonitor.recordMetric('database_query_execution_time', executionTime, 'ms', {
        operation,
        resultCount,
        table: this.tableName,
        ...metadata
      });

      // Log slow query warning
      if (executionTime > 1000) {
        logger.warn('Slow database query detected', {
          operation,
          executionTime,
          resultCount,
          table: this.tableName,
          ...metadata
        });
      }
    }

    // Always log performance metrics to standard logger
    const performanceLevel = executionTime > 2000 ? 'warn' :
      executionTime > 1000 ? 'info' : 'debug';

    logger[performanceLevel]('Database query performance', {
      operation,
      executionTime,
      resultCount,
      table: this.tableName,
      meetsTarget: executionTime <= 2000,
      ...metadata
    });
  }

  /**
   * Unified query to fetch complete swap data with targeting information
   * Requirements: 2.1, 2.2, 5.1, 5.2, 6.1 - Single comprehensive query for all swap card data
   */
  async findCompleteSwapDataWithTargeting(userId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    try {
      const query = `
        WITH user_swaps AS (
          -- Get user's swaps with basic information
          -- Note: owner_id is derived from source_booking_id -> booking.user_id after schema simplification
          SELECT 
            s.id,
            s.source_booking_id,
            s.status,
            s.additional_payment,
            s.conditions,
            s.created_at,
            s.updated_at,
            s.expires_at,
            -- Derived owner information from booking relationship
            sb.user_id as owner_id,
            -- Source booking details (user's booking)
            sb.title as source_title,
            sb.city as source_city,
            sb.country as source_country,
            sb.check_in_date as source_check_in,
            sb.check_out_date as source_check_out,
            sb.original_price as source_original_price,
            sb.swap_value as source_swap_value,
            -- Owner information (use display_name, fallback to username or email)
            COALESCE(u_owner.display_name, u_owner.username, u_owner.email, 'Unknown User') as owner_name,
            u_owner.email as owner_email
          FROM swaps s
          LEFT JOIN bookings sb ON s.source_booking_id = sb.id
          LEFT JOIN users u_owner ON sb.user_id = u_owner.id
          WHERE sb.user_id = $1 
            -- Removed status filter to show ALL swaps (filtering will be done at controller level)
          ORDER BY s.created_at DESC
          LIMIT $2 OFFSET $3
        ),
        incoming_proposals AS (
          -- Get incoming proposals (others targeting user's swaps via swap_targets table)
          -- This uses the swap_targets table which tracks targeting relationships
          SELECT 
            st.id,  -- FIXED: Use swap_targets.id as the proposal ID (primary key)
            proposer_swap.id as proposer_swap_id,
            proposer_booking.user_id as proposer_id,
            proposer_swap.status as proposal_status,
            proposer_swap.additional_payment as proposal_additional_payment,
            proposer_swap.conditions as proposal_conditions,
            proposer_swap.created_at as proposal_created_at,
            -- Proposer information (use display_name, fallback to username or email)
            COALESCE(u_proposer.display_name, u_proposer.username, u_proposer.email, 'Unknown User') as proposer_name,
            u_proposer.email as proposer_email,
            -- Proposer's booking details
            proposer_booking.id as proposer_booking_id,
            proposer_booking.title as proposer_booking_title,
            proposer_booking.city as proposer_booking_city,
            proposer_booking.country as proposer_booking_country,
            proposer_booking.check_in_date as proposer_booking_check_in,
            proposer_booking.check_out_date as proposer_booking_check_out,
            proposer_booking.original_price as proposer_booking_original_price,
            proposer_booking.swap_value as proposer_booking_swap_value,
            -- Link to user's swap via swap_targets
            st.target_swap_id
          FROM swap_targets st
          JOIN user_swaps us ON st.target_swap_id = us.id
          JOIN swaps proposer_swap ON st.source_swap_id = proposer_swap.id
          JOIN bookings proposer_booking ON proposer_swap.source_booking_id = proposer_booking.id
          JOIN users u_proposer ON proposer_booking.user_id = u_proposer.id
          WHERE proposer_booking.user_id != $1  -- Exclude self-proposals
            -- Removed status filter to show ALL proposals (active, accepted, rejected, cancelled)
            -- Filtering will be done at controller level if needed
        ),
        outgoing_targets AS (
          -- Get outgoing targets (user targeting others)
          SELECT 
            st.id as target_id,
            st.source_swap_id,
            st.target_swap_id,
            st.status as target_status,
            st.created_at as target_created_at,
            -- Target swap details
            ts.source_booking_id as target_booking_id,
            tb.title as target_booking_title,
            tb.city as target_booking_city,
            tb.country as target_booking_country,
            tb.check_in_date as target_booking_check_in,
            tb.check_out_date as target_booking_check_out,
            tb.original_price as target_booking_original_price,
            tb.swap_value as target_booking_swap_value,
            -- Target owner information (use display_name, fallback to username or email)
            COALESCE(u_target.display_name, u_target.username, u_target.email, 'Unknown User') as target_owner_name,
            u_target.email as target_owner_email
          FROM swap_targets st
          JOIN swaps ts ON st.target_swap_id = ts.id
          LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
          LEFT JOIN users u_target ON tb.user_id = u_target.id
          JOIN user_swaps us ON st.source_swap_id = us.id
          -- Removed status filter to show ALL outgoing targets (active, accepted, rejected, cancelled)
        )
        SELECT 
          -- User swap information
          us.id,
          us.source_booking_id,
          us.owner_id,
          us.status,
          us.additional_payment,
          us.conditions,
          us.created_at,
          us.updated_at,
          us.expires_at,
          us.source_title as title,
          us.source_title as description,
          us.owner_name,
          us.owner_email,
          -- Source booking location and dates
          us.source_city,
          us.source_country,
          us.source_check_in,
          us.source_check_out,
          -- Source booking pricing information
          us.source_original_price as price_amount,
          'EUR' as price_currency,
          -- Incoming proposals aggregated as JSON
          COALESCE(
            JSON_AGG(
              DISTINCT JSONB_BUILD_OBJECT(
                'id', ip.id,
                'proposerId', ip.proposer_id,
                'proposerName', ip.proposer_name,
                'proposerSwapId', ip.proposer_swap_id,
                'proposerSwapTitle', ip.proposer_booking_title,
                'proposerSwapDescription', COALESCE(ip.proposer_booking_title, ''),
                'proposerBookingCity', ip.proposer_booking_city,
                'proposerBookingCountry', ip.proposer_booking_country,
                'proposerBookingCheckIn', ip.proposer_booking_check_in,
                'proposerBookingCheckOut', ip.proposer_booking_check_out,
                'proposedTerms', JSONB_BUILD_OBJECT(
                  'pricing', JSONB_BUILD_OBJECT(
                    'amount', ip.proposal_additional_payment,
                    'currency', 'EUR'
                  ),
                  'message', CASE 
                    WHEN ip.proposal_conditions IS NOT NULL AND array_length(ip.proposal_conditions, 1) > 0 
                    THEN ip.proposal_conditions[1] 
                    ELSE NULL 
                  END
                ),
                'status', ip.proposal_status,
                'createdAt', ip.proposal_created_at
              )
            ) FILTER (WHERE ip.id IS NOT NULL),
            '[]'::json
          ) as incoming_proposals,
          -- Outgoing target information
          CASE 
            WHEN ot.target_id IS NOT NULL THEN
              JSON_BUILD_OBJECT(
                'id', ot.target_id,
                'targetSwapId', ot.target_swap_id,
                'targetOwnerName', ot.target_owner_name,
                'targetSwapTitle', ot.target_booking_title,
                'targetBookingCity', ot.target_booking_city,
                'targetBookingCountry', ot.target_booking_country,
                'targetBookingCheckIn', ot.target_booking_check_in,
                'targetBookingCheckOut', ot.target_booking_check_out,
                'status', ot.target_status,
                'createdAt', ot.target_created_at
              )
            ELSE NULL
          END as outgoing_target
        FROM user_swaps us
        LEFT JOIN incoming_proposals ip ON ip.target_swap_id = us.id
        LEFT JOIN outgoing_targets ot ON ot.source_swap_id = us.id
        GROUP BY 
          us.id, us.source_booking_id, us.owner_id,
          us.status, us.additional_payment, us.conditions, us.created_at, us.updated_at, us.expires_at,
          us.source_title, us.owner_name, us.owner_email, 
          us.source_city, us.source_country, us.source_check_in, us.source_check_out,
          us.source_original_price,
          ot.target_id, ot.target_swap_id, ot.target_owner_name, ot.target_booking_title,
          ot.target_booking_city, ot.target_booking_country, ot.target_booking_check_in, ot.target_booking_check_out,
          ot.target_status, ot.target_created_at
        ORDER BY us.created_at DESC;
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);

      // Debug: Log first row's incoming_proposals to see actual structure
      if (result.rows.length > 0 && result.rows[0].incoming_proposals) {
        logger.debug('[SwapRepository] Raw incoming_proposals from database:', {
          userId,
          firstProposal: Array.isArray(result.rows[0].incoming_proposals) && result.rows[0].incoming_proposals.length > 0
            ? result.rows[0].incoming_proposals[0]
            : 'No proposals',
          hasProposerBookingCity: Array.isArray(result.rows[0].incoming_proposals) && result.rows[0].incoming_proposals.length > 0
            ? !!result.rows[0].incoming_proposals[0].proposerBookingCity
            : false,
        });
      }

      // Transform the result to match CompleteSwapData structure
      return result.rows.map(row => ({
        id: row.id,
        title: row.title || 'Untitled Swap',
        description: row.description || '',
        ownerId: row.owner_id,
        ownerName: row.owner_name || 'Unknown User',
        status: row.status,
        pricing: {
          amount: row.price_amount,
          currency: row.price_currency || 'EUR'
        },
        targeting: {
          incomingProposals: Array.isArray(row.incoming_proposals) ? row.incoming_proposals : [],
          outgoingTarget: row.outgoing_target,
          totalIncomingCount: Array.isArray(row.incoming_proposals) ? row.incoming_proposals.length : 0
        },
        location: {
          city: row.source_city,
          country: row.source_country
        },
        dateRange: {
          checkIn: row.source_check_in,
          checkOut: row.source_check_out
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        expiresAt: row.expires_at
      }));

    } catch (error) {
      logger.error('Failed to find complete swap data with targeting', { error, userId });
      throw error;
    }
  }

  /**
   * Get swap with all derived relationships
   * Efficiently derives proposer, target booking, and owner information through JOINs
   * Requirements: 1.2, 4.1, 4.3
   */
  async getSwapWithRelationships(swapId: string): Promise<SwapWithBookingDetails | null> {
    try {
      const query = `
        SELECT 
          s.*,
          -- Source booking and proposer details
          sb.id as source_booking_id,
          sb.title as source_booking_title,
          sb.city as source_booking_city,
          sb.country as source_booking_country,
          sb.check_in_date as source_booking_check_in,
          sb.check_out_date as source_booking_check_out,
          sb.original_price as source_booking_original_price,
          sb.swap_value as source_booking_swap_value,
          sb.status as source_booking_status,
          sb.user_id as proposer_id,
          u_proposer.display_name as proposer_name,
          u_proposer.email as proposer_email,
          
          -- Target booking and owner details (if targeting)
          tb.id as target_booking_id,
          tb.title as target_booking_title,
          tb.city as target_booking_city,
          tb.country as target_booking_country,
          tb.check_in_date as target_booking_check_in,
          tb.check_out_date as target_booking_check_out,
          tb.original_price as target_booking_original_price,
          tb.swap_value as target_booking_swap_value,
          tb.status as target_booking_status,
          tb.user_id as target_owner_id,
          u_target.display_name as target_owner_name,
          u_target.email as target_owner_email
          
        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        JOIN users u_proposer ON sb.user_id = u_proposer.id
        LEFT JOIN swap_targets st ON s.id = st.source_swap_id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u_target ON tb.user_id = u_target.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [swapId]);
      return result.rows[0] ? this.mapRowToSwapWithBookingDetails(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to get swap with relationships', { error, swapId });
      throw error;
    }
  }

  /**
   * Get target booking and owner information for a swap
   * Helper method that derives target information through targeting relationships
   * Requirements: 1.2, 4.1, 4.3
   */
  async getTargetBookingInfo(swapId: string): Promise<{ targetBookingId?: string; targetOwnerId?: string; targetOwnerName?: string } | null> {
    try {
      const query = `
        SELECT 
          tb.id as target_booking_id,
          tb.user_id as target_owner_id,
          u.display_name as target_owner_name
        FROM ${this.tableName} s
        LEFT JOIN swap_targets st ON s.id = st.source_swap_id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u ON tb.user_id = u.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [swapId]);
      const row = result.rows[0];

      if (!row || !row.target_booking_id) {
        return null;
      }

      return {
        targetBookingId: row.target_booking_id,
        targetOwnerId: row.target_owner_id,
        targetOwnerName: row.target_owner_name
      };
    } catch (error) {
      logger.error('Failed to get target booking info', { error, swapId });
      throw error;
    }
  }

  /**
   * Get proposer information derived from booking relationship
   * Helper method that efficiently gets proposer details through booking JOIN
   * Requirements: 1.1, 1.2, 4.1
   */
  async getProposerInfo(swapId: string): Promise<{ proposerId: string; proposerName?: string } | null> {
    try {
      const query = `
        SELECT 
          sb.user_id as proposer_id,
          u.display_name as proposer_name
        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN users u ON sb.user_id = u.id
        WHERE s.id = $1
      `;

      const result = await this.pool.query(query, [swapId]);
      const row = result.rows[0];

      if (!row || !row.proposer_id) {
        logger.warn('Cannot derive proposer for swap', { swapId });
        return null;
      }

      return {
        proposerId: row.proposer_id,
        proposerName: row.proposer_name
      };
    } catch (error) {
      logger.error('Failed to get proposer info', { error, swapId });
      throw error;
    }
  }

  /**
   * Find swaps with derived relationships for a user
   * Efficient query that gets all swaps with proposer and target information derived
   * Requirements: 1.1, 1.2, 4.1, 4.3
   */
  async findSwapsWithDerivedRelationships(userId: string, limit: number = 100, offset: number = 0): Promise<SwapWithBookingDetails[]> {
    try {
      const query = `
        SELECT 
          s.*,
          -- Source booking and proposer details
          sb.id as source_booking_id,
          sb.title as source_booking_title,
          sb.city as source_booking_city,
          sb.country as source_booking_country,
          sb.check_in_date as source_booking_check_in,
          sb.check_out_date as source_booking_check_out,
          sb.original_price as source_booking_original_price,
          sb.swap_value as source_booking_swap_value,
          sb.status as source_booking_status,
          sb.user_id as proposer_id,
          u_proposer.display_name as proposer_name,
          
          -- Target booking and owner details (if targeting)
          tb.id as target_booking_id,
          tb.title as target_booking_title,
          tb.city as target_booking_city,
          tb.country as target_booking_country,
          tb.check_in_date as target_booking_check_in,
          tb.check_out_date as target_booking_check_out,
          tb.original_price as target_booking_original_price,
          tb.swap_value as target_booking_swap_value,
          tb.status as target_booking_status,
          tb.user_id as target_owner_id,
          u_target.display_name as target_owner_name
          
        FROM ${this.tableName} s
        JOIN bookings sb ON s.source_booking_id = sb.id
        JOIN users u_proposer ON sb.user_id = u_proposer.id
        LEFT JOIN swap_targets st ON s.id = st.source_swap_id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        LEFT JOIN users u_target ON tb.user_id = u_target.id
        WHERE sb.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await this.pool.query(query, [userId, limit, offset]);
      return result.rows.map(row => this.mapRowToSwapWithBookingDetails(row));
    } catch (error) {
      logger.error('Failed to find swaps with derived relationships', { error, userId });
      throw error;
    }
  }
  /**
   * Create an enhanced swap with payment preferences and auction support
   */
  async createEnhancedSwap(swapData: Omit<EnhancedSwap, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnhancedSwap> {
    try {
      logger.info('Creating enhanced swap in repository', {
        sourceBookingId: swapData.sourceBookingId,
        paymentTypes: swapData.paymentTypes,
        acceptanceStrategy: swapData.acceptanceStrategy
      });

      // Validate required fields
      if (!swapData.sourceBookingId || swapData.sourceBookingId.trim() === '') {
        throw new Error('Source booking ID is required for enhanced swap creation');
      }

      const row = this.mapEnhancedEntityToRow(swapData);
      const columns = Object.keys(row).join(', ');
      const placeholders = Object.keys(row).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(row);

      const query = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES (${placeholders})
        RETURNING *
      `;

      logger.debug('Executing enhanced swap creation query', {
        query,
        columns,
        valueCount: values.length,
        sourceBookingId: swapData.sourceBookingId
      });

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Enhanced swap creation failed - no rows returned');
      }

      const createdSwap = this.mapRowToEnhancedEntity(result.rows[0]);

      // Validate the created swap has a valid ID
      if (!createdSwap.id || createdSwap.id.trim() === '') {
        logger.error('Enhanced swap created but has invalid ID', {
          createdSwap,
          sourceBookingId: swapData.sourceBookingId
        });
        throw new Error('Enhanced swap creation failed - invalid ID returned');
      }

      logger.info('Enhanced swap created successfully', {
        swapId: createdSwap.id,
        sourceBookingId: createdSwap.sourceBookingId,
        status: createdSwap.status,
        paymentTypes: createdSwap.paymentTypes
      });

      return createdSwap;
    } catch (error) {
      logger.error('Failed to create enhanced swap', {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        swapData: {
          sourceBookingId: swapData.sourceBookingId,
          paymentTypes: swapData.paymentTypes,
          acceptanceStrategy: swapData.acceptanceStrategy
        }
      });
      throw error;
    }
  }
}