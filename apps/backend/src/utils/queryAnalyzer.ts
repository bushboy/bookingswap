import { Pool } from 'pg';
import { logger } from './logger';

export interface QueryAnalysisResult {
    query: string;
    executionTime: number;
    planningTime: number;
    totalTime: number;
    rowsReturned: number;
    executionPlan?: any;
    recommendations?: string[];
}

export class QueryAnalyzer {
    constructor(private pool: Pool) { }

    /**
     * Analyze query performance with EXPLAIN ANALYZE
     */
    async analyzeQuery(
        query: string,
        params: any[] = [],
        options: { includeBuffers?: boolean; includeSettings?: boolean } = {}
    ): Promise<QueryAnalysisResult> {
        const startTime = Date.now();

        try {
            // Build EXPLAIN ANALYZE query
            let explainQuery = 'EXPLAIN (ANALYZE true, BUFFERS true, FORMAT json)';
            if (options.includeSettings) {
                explainQuery = 'EXPLAIN (ANALYZE true, BUFFERS true, SETTINGS true, FORMAT json)';
            }

            const fullQuery = `${explainQuery} ${query}`;

            // Execute the analysis
            const result = await this.pool.query(fullQuery, params);
            const executionTime = Date.now() - startTime;

            const plan = result.rows[0]['QUERY PLAN'][0];
            const planningTime = plan['Planning Time'] || 0;
            const totalExecutionTime = plan['Execution Time'] || 0;
            const rowsReturned = this.extractRowCount(plan);

            // Generate recommendations based on the plan
            const recommendations = this.generateRecommendations(plan);

            const analysisResult: QueryAnalysisResult = {
                query,
                executionTime,
                planningTime,
                totalTime: totalExecutionTime,
                rowsReturned,
                executionPlan: plan,
                recommendations
            };

            // Log performance metrics
            logger.info('Query performance analysis completed', {
                query: query.substring(0, 100) + '...',
                executionTime,
                planningTime,
                totalTime: totalExecutionTime,
                rowsReturned,
                recommendationCount: recommendations.length
            });

            return analysisResult;
        } catch (error) {
            logger.error('Failed to analyze query performance', { error, query });
            throw error;
        }
    }

    /**
     * Extract row count from execution plan
     */
    private extractRowCount(plan: any): number {
        if (plan['Actual Rows']) {
            return plan['Actual Rows'];
        }

        // For complex plans, sum up rows from all nodes
        let totalRows = 0;
        if (plan.Plans) {
            for (const subPlan of plan.Plans) {
                totalRows += this.extractRowCount(subPlan);
            }
        }

        return totalRows;
    }

    /**
     * Generate performance recommendations based on execution plan
     */
    private generateRecommendations(plan: any): string[] {
        const recommendations: string[] = [];

        // Check for sequential scans
        if (this.hasSequentialScan(plan)) {
            recommendations.push('Consider adding indexes to avoid sequential scans');
        }

        // Check for high execution time
        if (plan['Execution Time'] > 2000) {
            recommendations.push('Query execution time exceeds 2 seconds - consider optimization');
        }

        // Check for high planning time
        if (plan['Planning Time'] > 100) {
            recommendations.push('High planning time detected - consider simplifying query or updating statistics');
        }

        // Check for expensive sorts
        if (this.hasExpensiveSort(plan)) {
            recommendations.push('Expensive sort operation detected - consider adding appropriate indexes');
        }

        // Check for nested loops with high cost
        if (this.hasExpensiveNestedLoop(plan)) {
            recommendations.push('Expensive nested loop detected - consider optimizing join conditions or adding indexes');
        }

        // Check for buffer usage
        if (plan['Shared Hit Blocks'] && plan['Shared Read Blocks']) {
            const hitRatio = plan['Shared Hit Blocks'] / (plan['Shared Hit Blocks'] + plan['Shared Read Blocks']);
            if (hitRatio < 0.9) {
                recommendations.push('Low buffer cache hit ratio - consider increasing shared_buffers or optimizing query');
            }
        }

        return recommendations;
    }

    /**
     * Check if plan contains sequential scans
     */
    private hasSequentialScan(plan: any): boolean {
        if (plan['Node Type'] === 'Seq Scan') {
            return true;
        }

        if (plan.Plans) {
            return plan.Plans.some((subPlan: any) => this.hasSequentialScan(subPlan));
        }

        return false;
    }

    /**
     * Check if plan contains expensive sort operations
     */
    private hasExpensiveSort(plan: any): boolean {
        if (plan['Node Type'] === 'Sort' && plan['Total Cost'] > 1000) {
            return true;
        }

        if (plan.Plans) {
            return plan.Plans.some((subPlan: any) => this.hasExpensiveSort(subPlan));
        }

        return false;
    }

    /**
     * Check if plan contains expensive nested loop operations
     */
    private hasExpensiveNestedLoop(plan: any): boolean {
        if (plan['Node Type'] === 'Nested Loop' && plan['Total Cost'] > 10000) {
            return true;
        }

        if (plan.Plans) {
            return plan.Plans.some((subPlan: any) => this.hasExpensiveNestedLoop(subPlan));
        }

        return false;
    }

    /**
     * Analyze the specific findByUserIdWithBookingDetails query
     */
    async analyzeUserSwapsQuery(userId: string, limit: number = 100, offset: number = 0): Promise<QueryAnalysisResult> {
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
        sb.deleted_at as source_booking_deleted_at,
        sb.status as source_booking_status,
        tb.id as target_booking_id,
        tb.title as target_booking_title,
        tb.city as target_booking_city,
        tb.country as target_booking_country,
        tb.check_in_date as target_booking_check_in,
        tb.check_out_date as target_booking_check_out,
        tb.original_price as target_booking_original_price,
        tb.swap_value as target_booking_swap_value,
        tb.deleted_at as target_booking_deleted_at,
        tb.status as target_booking_status
      FROM swaps s
      LEFT JOIN bookings sb ON s.source_booking_id = sb.id
      LEFT JOIN bookings tb ON s.target_booking_id = tb.id
      WHERE s.proposer_id = $1 OR s.owner_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        return this.analyzeQuery(query, [userId, limit, offset]);
    }

    /**
     * Get current database statistics for relevant tables
     */
    async getTableStatistics(): Promise<any> {
        try {
            const query = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE tablename IN ('swaps', 'bookings')
        ORDER BY tablename;
      `;

            const result = await this.pool.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get table statistics', { error });
            throw error;
        }
    }

    /**
     * Get index usage statistics
     */
    async getIndexStatistics(): Promise<any> {
        try {
            const query = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch,
          idx_scan
        FROM pg_stat_user_indexes 
        WHERE tablename IN ('swaps', 'bookings')
        ORDER BY tablename, indexname;
      `;

            const result = await this.pool.query(query);
            return result.rows;
        } catch (error) {
            logger.error('Failed to get index statistics', { error });
            throw error;
        }
    }
}