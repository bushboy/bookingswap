import { Pool } from 'pg';
import { Booking, BookingType, BookingStatus, VerificationStatus } from '@booking-swap/shared';
import { BaseRepository } from './base';

export interface BookingFilters {
  userId?: string;
  excludeUserId?: string;
  type?: BookingType;
  status?: BookingStatus;
  verificationStatus?: VerificationStatus;
  city?: string;
  country?: string;
  minPrice?: number;
  maxPrice?: number;
  checkInAfter?: Date;
  checkInBefore?: Date;
  checkOutAfter?: Date;
  checkOutBefore?: Date;
}

export interface BookingSearchCriteria {
  query?: string;
  location?: {
    city?: string;
    country?: string;
    radius?: number; // in km
    coordinates?: [number, number];
  };
  dateRange?: {
    checkIn?: Date;
    checkOut?: Date;
    flexible?: boolean;
  };
  priceRange?: {
    min?: number;
    max?: number;
  };
  types?: BookingType[];
}

export class BookingRepository extends BaseRepository<Booking> {
  constructor(pool: Pool) {
    super(pool, 'bookings');
  }

  mapRowToEntity(row: any): Booking {
    // Debug logging to see what's in the database row
    console.log('BookingRepository mapRowToEntity - raw row data:', {
      id: row.id,
      provider_name: row.provider_name,
      confirmation_number: row.confirmation_number,
      booking_reference: row.booking_reference,
    });

    const booking = {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      description: row.description,
      location: {
        city: row.city,
        country: row.country,
        coordinates: row.coordinates ? [row.coordinates.x, row.coordinates.y] : undefined,
      },
      dateRange: {
        checkIn: row.check_in_date,
        checkOut: row.check_out_date,
      },
      originalPrice: parseFloat(row.original_price),
      swapValue: parseFloat(row.swap_value),
      providerDetails: {
        provider: row.provider_name,
        confirmationNumber: row.confirmation_number,
        bookingReference: row.booking_reference,
      },
      verification: {
        status: row.verification_status,
        verifiedAt: row.verified_at,
        documents: row.verification_documents || [],
      },
      blockchain: {
        transactionId: row.blockchain_transaction_id,
        consensusTimestamp: row.blockchain_consensus_timestamp,
        topicId: row.blockchain_topic_id,
      },
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    console.log('BookingRepository mapRowToEntity - mapped booking:', {
      id: booking.id,
      providerDetails: booking.providerDetails,
    });

    return booking;
  }

  mapEntityToRow(entity: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): any {
    return {
      user_id: entity.userId,
      type: entity.type,
      title: entity.title,
      description: entity.description,
      city: entity.location.city,
      country: entity.location.country,
      coordinates: entity.location.coordinates ? `(${entity.location.coordinates[0]},${entity.location.coordinates[1]})` : null,
      check_in_date: entity.dateRange.checkIn,
      check_out_date: entity.dateRange.checkOut,
      original_price: entity.originalPrice,
      swap_value: entity.swapValue,
      provider_name: entity.providerDetails.provider,
      confirmation_number: entity.providerDetails.confirmationNumber,
      booking_reference: entity.providerDetails.bookingReference,
      verification_status: entity.verification.status,
      verified_at: entity.verification.verifiedAt,
      verification_documents: entity.verification.documents,
      blockchain_transaction_id: entity.blockchain.transactionId,
      blockchain_consensus_timestamp: entity.blockchain.consensusTimestamp,
      blockchain_topic_id: entity.blockchain.topicId,
      status: entity.status,
    };
  }

  async findByUserId(userId: string, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await this.pool.query(query, [userId, limit, offset]);
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async findByFilters(filters: BookingFilters, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      values.push(filters.userId);
    }

    if (filters.type) {
      conditions.push(`type = $${paramIndex++}`);
      values.push(filters.type);
    }

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }

    if (filters.verificationStatus) {
      conditions.push(`verification_status = $${paramIndex++}`);
      values.push(filters.verificationStatus);
    }

    if (filters.city) {
      conditions.push(`city ILIKE $${paramIndex++}`);
      values.push(`%${filters.city}%`);
    }

    if (filters.country) {
      conditions.push(`country ILIKE $${paramIndex++}`);
      values.push(`%${filters.country}%`);
    }

    if (filters.minPrice !== undefined) {
      conditions.push(`swap_value >= $${paramIndex++}`);
      values.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(`swap_value <= $${paramIndex++}`);
      values.push(filters.maxPrice);
    }

    if (filters.checkInAfter) {
      conditions.push(`check_in_date >= $${paramIndex++}`);
      values.push(filters.checkInAfter);
    }

    if (filters.checkInBefore) {
      conditions.push(`check_in_date <= $${paramIndex++}`);
      values.push(filters.checkInBefore);
    }

    if (filters.checkOutAfter) {
      conditions.push(`check_out_date >= $${paramIndex++}`);
      values.push(filters.checkOutAfter);
    }

    if (filters.checkOutBefore) {
      conditions.push(`check_out_date <= $${paramIndex++}`);
      values.push(filters.checkOutBefore);
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

  async searchBookings(criteria: BookingSearchCriteria, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    const conditions: string[] = ['status = $1']; // Only show available bookings
    const values: any[] = ['available'];
    let paramIndex = 2;

    // Full-text search using PostgreSQL's built-in search
    if (criteria.query) {
      conditions.push(`to_tsvector('english', title || ' ' || description || ' ' || city || ' ' || country) @@ plainto_tsquery('english', $${paramIndex++})`);
      values.push(criteria.query);
    }

    // Location filters
    if (criteria.location?.city) {
      conditions.push(`city ILIKE $${paramIndex++}`);
      values.push(`%${criteria.location.city}%`);
    }

    if (criteria.location?.country) {
      conditions.push(`country ILIKE $${paramIndex++}`);
      values.push(`%${criteria.location.country}%`);
    }

    // Geographic proximity search (if coordinates and radius provided)
    if (criteria.location?.coordinates && criteria.location?.radius) {
      conditions.push(`
        coordinates IS NOT NULL AND
        ST_DWithin(
          ST_GeogFromText('POINT(' || ST_X(coordinates) || ' ' || ST_Y(coordinates) || ')'),
          ST_GeogFromText('POINT($${paramIndex++} $${paramIndex++})'),
          $${paramIndex++}
        )
      `);
      values.push(criteria.location.coordinates[1], criteria.location.coordinates[0], criteria.location.radius * 1000); // Convert km to meters
    }

    // Date range filters
    if (criteria.dateRange?.checkIn) {
      if (criteria.dateRange.flexible) {
        // Flexible dates: allow some overlap
        conditions.push(`check_out_date >= $${paramIndex++}`);
        values.push(criteria.dateRange.checkIn);
      } else {
        conditions.push(`check_in_date >= $${paramIndex++}`);
        values.push(criteria.dateRange.checkIn);
      }
    }

    if (criteria.dateRange?.checkOut) {
      if (criteria.dateRange.flexible) {
        conditions.push(`check_in_date <= $${paramIndex++}`);
        values.push(criteria.dateRange.checkOut);
      } else {
        conditions.push(`check_out_date <= $${paramIndex++}`);
        values.push(criteria.dateRange.checkOut);
      }
    }

    // Price range filters
    if (criteria.priceRange?.min !== undefined) {
      conditions.push(`swap_value >= $${paramIndex++}`);
      values.push(criteria.priceRange.min);
    }

    if (criteria.priceRange?.max !== undefined) {
      conditions.push(`swap_value <= $${paramIndex++}`);
      values.push(criteria.priceRange.max);
    }

    // Booking types filter
    if (criteria.types && criteria.types.length > 0) {
      const typePlaceholders = criteria.types.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`type IN (${typePlaceholders})`);
      values.push(...criteria.types);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // Add ranking for full-text search results
    let selectClause = 'SELECT *';
    let orderClause = 'ORDER BY created_at DESC';
    
    if (criteria.query) {
      selectClause = `SELECT *, ts_rank(to_tsvector('english', title || ' ' || description || ' ' || city || ' ' || country), plainto_tsquery('english', $2)) as search_rank`;
      orderClause = 'ORDER BY search_rank DESC, created_at DESC';
    }

    const query = `
      ${selectClause} FROM ${this.tableName}
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await this.pool.query(query, values);
    
    return result.rows.map(row => this.mapRowToEntity(row));
  }

  async updateStatus(id: string, status: BookingStatus): Promise<Booking | null> {
    const query = `
      UPDATE ${this.tableName}
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [id, status]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateBooking(id: string, updateData: Partial<Booking>): Promise<Booking | null> {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    // Build dynamic update query based on provided fields
    if (updateData.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(updateData.title);
    }

    if (updateData.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(updateData.description);
    }

    if (updateData.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(updateData.type);
    }

    if (updateData.location !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      values.push(updateData.location.city);
      updates.push(`country = $${paramIndex++}`);
      values.push(updateData.location.country);
      if (updateData.location.coordinates) {
        updates.push(`coordinates = $${paramIndex++}`);
        values.push(`(${updateData.location.coordinates[0]}, ${updateData.location.coordinates[1]})`);
      }
    }

    if (updateData.dateRange !== undefined) {
      updates.push(`check_in_date = $${paramIndex++}`);
      values.push(updateData.dateRange.checkIn);
      updates.push(`check_out_date = $${paramIndex++}`);
      values.push(updateData.dateRange.checkOut);
    }

    if (updateData.originalPrice !== undefined) {
      updates.push(`original_price = $${paramIndex++}`);
      values.push(updateData.originalPrice);
    }

    if (updateData.swapValue !== undefined) {
      updates.push(`swap_value = $${paramIndex++}`);
      values.push(updateData.swapValue);
    }

    if (updateData.providerDetails !== undefined) {
      updates.push(`provider_name = $${paramIndex++}`);
      values.push(updateData.providerDetails.provider);
      updates.push(`confirmation_number = $${paramIndex++}`);
      values.push(updateData.providerDetails.confirmationNumber);
      updates.push(`booking_reference = $${paramIndex++}`);
      values.push(updateData.providerDetails.bookingReference);
    }

    if (updateData.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateVerificationStatus(id: string, status: VerificationStatus, verifiedAt?: Date): Promise<Booking | null> {
    const query = `
      UPDATE ${this.tableName}
      SET verification_status = $2, verified_at = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await this.pool.query(query, [id, status, verifiedAt || null]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  async updateBlockchainInfo(id: string, blockchainInfo: {
    transactionId?: string;
    consensusTimestamp?: string;
    topicId?: string;
  }): Promise<Booking | null> {
    const updates: string[] = [];
    const values: any[] = [id];
    let paramIndex = 2;

    if (blockchainInfo.transactionId !== undefined) {
      updates.push(`blockchain_transaction_id = $${paramIndex++}`);
      values.push(blockchainInfo.transactionId);
    }

    if (blockchainInfo.consensusTimestamp !== undefined) {
      updates.push(`blockchain_consensus_timestamp = $${paramIndex++}`);
      values.push(blockchainInfo.consensusTimestamp);
    }

    if (blockchainInfo.topicId !== undefined) {
      updates.push(`blockchain_topic_id = $${paramIndex++}`);
      values.push(blockchainInfo.topicId);
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    const query = `
      UPDATE ${this.tableName}
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.pool.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToEntity(result.rows[0]);
  }

  // Admin methods
  async getStatistics(): Promise<{
    total: number;
    available: number;
    swapped: number;
    cancelled: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'swapped' THEN 1 END) as swapped,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM ${this.tableName}
    `;
    
    const result = await this.pool.query(query);
    const row = result.rows[0];
    
    return {
      total: parseInt(row.total),
      available: parseInt(row.available),
      swapped: parseInt(row.swapped),
      cancelled: parseInt(row.cancelled)
    };
  }
}