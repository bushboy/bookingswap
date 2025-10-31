import { Pool } from 'pg';
import { logger } from '../../utils/logger';

export interface QueryOptimizationConfig {
  enableQueryPlan: boolean;
  slowQueryThreshold: number; // milliseconds
  enableIndexHints: boolean;
}

export class QueryOptimizer {
  private pool: Pool;
  private config: QueryOptimizationConfig;

  constructor(pool: Pool, config: QueryOptimizationConfig) {
    this.pool = pool;
    this.config = config;
  }

  /**
   * Execute query with performance monitoring and optimization
   */
  async executeOptimizedQuery<T = any>(
    query: string,
    params: any[] = [],
    queryName?: string
  ): Promise<T[]> {
    const startTime = Date.now();
    
    try {
      // Log query plan for slow queries if enabled (skip in test environment)
      if (this.config.enableQueryPlan && process.env.NODE_ENV !== 'test') {
        try {
          const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
          const planResult = await this.pool.query(explainQuery, params);
          
          if (planResult.rows && planResult.rows[0] && planResult.rows[0]['QUERY PLAN']) {
            const executionTime = planResult.rows[0]['QUERY PLAN'][0]['Execution Time'];
            if (executionTime > this.config.slowQueryThreshold) {
              logger.warn('Slow query detected', {
                queryName,
                executionTime,
                queryPlan: planResult.rows[0]['QUERY PLAN'],
              });
            }
          }
        } catch (planError) {
          // Ignore plan analysis errors in test environment
          logger.debug('Query plan analysis failed', { error: planError, queryName });
        }
      }

      // Execute the actual query
      const result = await this.pool.query(query, params);
      const duration = Date.now() - startTime;

      // Log performance metrics
      if (duration > this.config.slowQueryThreshold) {
        logger.warn('Slow query execution', {
          queryName,
          duration,
          rowCount: result.rowCount,
        });
      }

      return result.rows;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Query execution failed', {
        error,
        queryName,
        duration,
        query: query.substring(0, 200) + '...',
      });
      throw error;
    }
  }

  /**
   * Create optimized booking search query with proper indexing
   */
  buildOptimizedBookingSearchQuery(criteria: any): { query: string; params: any[] } {
    const conditions: string[] = ['status = $1'];
    const params: any[] = ['available'];
    let paramIndex = 2;

    let selectClause = `
      SELECT 
        id, user_id, type, title, description, city, country, coordinates,
        check_in_date, check_out_date, original_price, swap_value,
        provider_name, confirmation_number, booking_reference,
        verification_status, verified_at, verification_documents,
        blockchain_transaction_id, blockchain_consensus_timestamp, blockchain_topic_id,
        status, created_at, updated_at
    `;

    let fromClause = 'FROM bookings';
    let orderClause = 'ORDER BY created_at DESC';

    // Full-text search with GIN index
    if (criteria.query) {
      selectClause += `, ts_rank(search_vector, plainto_tsquery('english', $${paramIndex})) as search_rank`;
      conditions.push(`search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(criteria.query);
      paramIndex++;
      orderClause = 'ORDER BY search_rank DESC, created_at DESC';
    }

    // Location filters with spatial index
    if (criteria.location?.city) {
      conditions.push(`city_normalized = lower($${paramIndex})`);
      params.push(criteria.location.city.toLowerCase());
      paramIndex++;
    }

    if (criteria.location?.country) {
      conditions.push(`country_normalized = lower($${paramIndex})`);
      params.push(criteria.location.country.toLowerCase());
      paramIndex++;
    }

    // Geographic proximity with PostGIS
    if (criteria.location?.coordinates && criteria.location?.radius) {
      conditions.push(`
        coordinates IS NOT NULL AND
        ST_DWithin(
          coordinates::geography,
          ST_Point($${paramIndex}, $${paramIndex + 1})::geography,
          $${paramIndex + 2}
        )
      `);
      params.push(
        criteria.location.coordinates[1], // longitude
        criteria.location.coordinates[0], // latitude
        criteria.location.radius * 1000   // convert km to meters
      );
      paramIndex += 3;
    }

    // Date range filters with composite index
    if (criteria.dateRange?.checkIn) {
      if (criteria.dateRange.flexible) {
        conditions.push(`check_out_date >= $${paramIndex}`);
      } else {
        conditions.push(`check_in_date >= $${paramIndex}`);
      }
      params.push(criteria.dateRange.checkIn);
      paramIndex++;
    }

    if (criteria.dateRange?.checkOut) {
      if (criteria.dateRange.flexible) {
        conditions.push(`check_in_date <= $${paramIndex}`);
      } else {
        conditions.push(`check_out_date <= $${paramIndex}`);
      }
      params.push(criteria.dateRange.checkOut);
      paramIndex++;
    }

    // Price range with index
    if (criteria.priceRange?.min !== undefined) {
      conditions.push(`swap_value >= $${paramIndex}`);
      params.push(criteria.priceRange.min);
      paramIndex++;
    }

    if (criteria.priceRange?.max !== undefined) {
      conditions.push(`swap_value <= $${paramIndex}`);
      params.push(criteria.priceRange.max);
      paramIndex++;
    }

    // Booking types with index
    if (criteria.types && criteria.types.length > 0) {
      const typePlaceholders = criteria.types.map(() => `$${paramIndex++}`).join(', ');
      conditions.push(`type IN (${typePlaceholders})`);
      params.push(...criteria.types);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    const query = `
      ${selectClause}
      ${fromClause}
      ${whereClause}
      ${orderClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    return { query, params };
  }

  /**
   * Create optimized user dashboard query
   */
  buildOptimizedUserDashboardQuery(userId: string): { query: string; params: any[] } {
    const query = `
      WITH user_bookings AS (
        SELECT 
          id, title, type, status, swap_value, created_at,
          check_in_date, check_out_date
        FROM bookings 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20
      ),
      user_swaps AS (
        SELECT 
          s.id, s.status, s.created_at,
          sb.title as source_title,
          tb.title as target_title
        FROM swaps s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN bookings tb ON s.target_booking_id = tb.id
        WHERE s.proposer_id = $1 OR s.owner_id = $1
        ORDER BY s.created_at DESC
        LIMIT 10
      ),
      user_stats AS (
        SELECT 
          COUNT(CASE WHEN status = 'available' THEN 1 END) as active_bookings,
          COUNT(CASE WHEN status = 'swapped' THEN 1 END) as completed_swaps,
          AVG(swap_value) as avg_booking_value
        FROM bookings
        WHERE user_id = $1
      )
      SELECT 
        'bookings' as data_type,
        json_agg(ub.*) as data
      FROM user_bookings ub
      UNION ALL
      SELECT 
        'swaps' as data_type,
        json_agg(us.*) as data
      FROM user_swaps us
      UNION ALL
      SELECT 
        'stats' as data_type,
        json_build_object(
          'activeBookings', active_bookings,
          'completedSwaps', completed_swaps,
          'avgBookingValue', avg_booking_value
        ) as data
      FROM user_stats
    `;

    return { query, params: [userId] };
  }

  /**
   * Create batch insert query for better performance
   */
  buildBatchInsertQuery(tableName: string, records: any[]): { query: string; params: any[] } {
    if (records.length === 0) {
      throw new Error('No records provided for batch insert');
    }

    const columns = Object.keys(records[0]);
    const columnNames = columns.join(', ');
    
    const valuePlaceholders = records.map((_, recordIndex) => {
      const recordPlaceholders = columns.map((_, colIndex) => 
        `$${recordIndex * columns.length + colIndex + 1}`
      ).join(', ');
      return `(${recordPlaceholders})`;
    }).join(', ');

    const params = records.flatMap(record => columns.map(col => record[col]));

    const query = `
      INSERT INTO ${tableName} (${columnNames})
      VALUES ${valuePlaceholders}
      ON CONFLICT (id) DO UPDATE SET
        ${columns.filter(col => col !== 'id').map(col => `${col} = EXCLUDED.${col}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    return { query, params };
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  async analyzeQueryPerformance(query: string, params: any[] = []): Promise<any> {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT JSON) ${query}`;
      const result = await this.pool.query(explainQuery, params);
      
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      const analysis = {
        executionTime: plan['Execution Time'],
        planningTime: plan['Planning Time'],
        totalCost: plan['Total Cost'],
        actualRows: plan['Actual Rows'],
        suggestions: this.generateOptimizationSuggestions(plan),
      };

      logger.info('Query performance analysis', analysis);
      return analysis;
    } catch (error) {
      logger.error('Failed to analyze query performance', { error });
      throw error;
    }
  }

  /**
   * Generate optimization suggestions based on query plan
   */
  private generateOptimizationSuggestions(plan: any): string[] {
    const suggestions: string[] = [];

    // Check for sequential scans
    if (this.hasSequentialScan(plan)) {
      suggestions.push('Consider adding indexes for columns used in WHERE clauses');
    }

    // Check for high cost operations
    if (plan['Total Cost'] > 1000) {
      suggestions.push('Query has high cost - consider query restructuring or additional indexes');
    }

    // Check for large row estimates vs actual
    if (plan['Plan Rows'] > plan['Actual Rows'] * 10) {
      suggestions.push('Statistics may be outdated - consider running ANALYZE on affected tables');
    }

    return suggestions;
  }

  /**
   * Check if query plan contains sequential scans
   */
  private hasSequentialScan(plan: any): boolean {
    if (plan['Node Type'] === 'Seq Scan') {
      return true;
    }

    if (plan['Plans']) {
      return plan['Plans'].some((subPlan: any) => this.hasSequentialScan(subPlan));
    }

    return false;
  }
}