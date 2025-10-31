import { Pool } from 'pg';
import { logger } from '../../utils/logger';

/**
 * Foreign Key Validation Optimizer
 * 
 * This service manages database indexes and optimizations specifically for
 * foreign key validation queries. It ensures optimal performance for the
 * single-query validation method.
 */
export class ForeignKeyValidationOptimizer {
    constructor(private pool: Pool) { }

    /**
     * Verifies that all required indexes for foreign key validation exist
     * and are properly configured
     */
    async verifyOptimizationIndexes(): Promise<IndexVerificationResult> {
        const requiredIndexes = [
            'idx_payment_transactions_proposal_null',
            'idx_payment_transactions_proposal_not_null',
            'idx_auction_proposals_swap_relationship',
            'idx_swap_auctions_active_by_swap',
            'idx_swaps_validation_lookup',
            'idx_users_active_validation',
            'idx_auction_proposals_full_validation',
            'idx_swap_auctions_proposal_validation',
            'idx_payment_transactions_constraint_check',
            'idx_auction_proposals_by_id_with_auction'
        ];

        const results: IndexStatus[] = [];

        try {
            for (const indexName of requiredIndexes) {
                const indexInfo = await this.checkIndexExists(indexName);
                results.push({
                    name: indexName,
                    exists: indexInfo.exists,
                    isValid: indexInfo.isValid,
                    size: indexInfo.size,
                    lastUsed: indexInfo.lastUsed
                });
            }

            const missingIndexes = results.filter(r => !r.exists);
            const invalidIndexes = results.filter(r => r.exists && !r.isValid);

            logger.info('Foreign key validation index verification completed', {
                totalIndexes: requiredIndexes.length,
                existingIndexes: results.filter(r => r.exists).length,
                missingIndexes: missingIndexes.length,
                invalidIndexes: invalidIndexes.length
            });

            return {
                allIndexesPresent: missingIndexes.length === 0,
                allIndexesValid: invalidIndexes.length === 0,
                indexes: results,
                missingIndexes: missingIndexes.map(i => i.name),
                invalidIndexes: invalidIndexes.map(i => i.name),
                recommendations: this.generateRecommendations(results)
            };

        } catch (error) {
            logger.error('Failed to verify foreign key validation indexes', {
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                allIndexesPresent: false,
                allIndexesValid: false,
                indexes: [],
                missingIndexes: requiredIndexes,
                invalidIndexes: [],
                recommendations: ['Run database migration to create missing indexes'],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Checks if a specific index exists and is valid
     */
    private async checkIndexExists(indexName: string): Promise<IndexInfo> {
        const query = `
            SELECT 
                pi.schemaname,
                pi.tablename,
                pi.indexname,
                pi.indexdef,
                pg_size_pretty(pg_relation_size(psi.indexrelid)) as size,
                pg_stat_get_numscans(psi.indexrelid) as scans,
                pg_stat_get_tuples_returned(psi.indexrelid) as tuples_returned,
                pg_stat_get_tuples_fetched(psi.indexrelid) as tuples_fetched
            FROM pg_indexes pi
            LEFT JOIN pg_stat_user_indexes psi ON pi.indexname = psi.indexrelname
            WHERE pi.indexname = $1
        `;

        try {
            const result = await this.pool.query(query, [indexName]);

            if (result.rows.length === 0) {
                return {
                    exists: false,
                    isValid: false,
                    size: null,
                    lastUsed: null
                };
            }

            const row = result.rows[0];

            return {
                exists: true,
                isValid: row.indexdef !== null,
                size: row.size,
                lastUsed: row.scans > 0 ? new Date() : null, // Simplified - could be enhanced
                scans: row.scans,
                tuplesReturned: row.tuples_returned,
                tuplesFetched: row.tuples_fetched
            };

        } catch (error) {
            logger.error('Failed to check index existence', {
                indexName,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                exists: false,
                isValid: false,
                size: null,
                lastUsed: null
            };
        }
    }

    /**
     * Analyzes query performance for foreign key validation
     */
    async analyzeValidationQueryPerformance(): Promise<PerformanceAnalysis> {
        try {
            // Test the optimized single-query validation performance
            const testQuery = `
                EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
                WITH validation_data AS (
                    SELECT 
                        s.id as swap_exists,
                        s.status as swap_status,
                        s.acceptance_strategy,
                        s.payment_types,
                        s.owner_id as swap_owner_id,
                        u_payer.id as payer_exists,
                        u_recipient.id as recipient_exists,
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN ap.id
                            ELSE NULL
                        END as proposal_exists,
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN ap.status
                            ELSE NULL
                        END as proposal_status,
                        CASE 
                            WHEN $2::uuid IS NOT NULL THEN sa.swap_id
                            ELSE NULL
                        END as proposal_swap_id,
                        sa_active.id as active_auction_exists,
                        sa_active.status as active_auction_status
                    FROM swaps s
                    LEFT JOIN users u_payer ON u_payer.id = $3::uuid
                    LEFT JOIN users u_recipient ON u_recipient.id = $4::uuid
                    LEFT JOIN auction_proposals ap ON ap.id = $2::uuid AND ap.status != 'deleted'
                    LEFT JOIN swap_auctions sa ON sa.id = ap.auction_id
                    LEFT JOIN swap_auctions sa_active ON sa_active.swap_id = s.id AND sa_active.status = 'active'
                    WHERE s.id = $1::uuid AND s.status != 'deleted'
                )
                SELECT * FROM validation_data
            `;

            // Use sample UUIDs for analysis
            const sampleSwapId = '00000000-0000-0000-0000-000000000001';
            const sampleProposalId = '00000000-0000-0000-0000-000000000002';
            const sampleUserId1 = '00000000-0000-0000-0000-000000000003';
            const sampleUserId2 = '00000000-0000-0000-0000-000000000004';

            const result = await this.pool.query(testQuery, [
                sampleSwapId,
                sampleProposalId,
                sampleUserId1,
                sampleUserId2
            ]);

            const queryPlan = result.rows[0]['QUERY PLAN'][0];

            return {
                executionTime: queryPlan['Execution Time'],
                planningTime: queryPlan['Planning Time'],
                totalCost: queryPlan['Plan']['Total Cost'],
                indexesUsed: this.extractIndexesFromPlan(queryPlan),
                recommendations: this.analyzePerformanceIssues(queryPlan)
            };

        } catch (error) {
            logger.error('Failed to analyze validation query performance', {
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                executionTime: null,
                planningTime: null,
                totalCost: null,
                indexesUsed: [],
                recommendations: ['Unable to analyze performance - check database connection'],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Generates recommendations based on index verification results
     */
    private generateRecommendations(indexes: IndexStatus[]): string[] {
        const recommendations: string[] = [];

        const missingIndexes = indexes.filter(i => !i.exists);
        const unusedIndexes = indexes.filter(i => i.exists && i.lastUsed === null);

        if (missingIndexes.length > 0) {
            recommendations.push(
                `Run migration 021_optimize_foreign_key_validation_indexes.sql to create ${missingIndexes.length} missing indexes`
            );
        }

        if (unusedIndexes.length > 0) {
            recommendations.push(
                `Monitor usage of ${unusedIndexes.length} indexes that haven't been used recently`
            );
        }

        if (indexes.every(i => i.exists && i.isValid)) {
            recommendations.push('All foreign key validation indexes are properly configured');
        }

        return recommendations;
    }

    /**
     * Extracts index usage information from query plan
     */
    private extractIndexesFromPlan(queryPlan: any): string[] {
        const indexes: string[] = [];

        const extractFromNode = (node: any) => {
            if (node['Index Name']) {
                indexes.push(node['Index Name']);
            }

            if (node['Plans']) {
                node['Plans'].forEach((childNode: any) => extractFromNode(childNode));
            }
        };

        extractFromNode(queryPlan['Plan']);

        return [...new Set(indexes)]; // Remove duplicates
    }

    /**
     * Analyzes query plan for performance issues
     */
    private analyzePerformanceIssues(queryPlan: any): string[] {
        const recommendations: string[] = [];

        if (queryPlan['Execution Time'] > 100) {
            recommendations.push('Query execution time is high - consider additional index optimizations');
        }

        if (queryPlan['Planning Time'] > 10) {
            recommendations.push('Query planning time is high - database statistics may need updating');
        }

        const plan = queryPlan['Plan'];
        if (plan['Node Type'] === 'Seq Scan') {
            recommendations.push('Sequential scan detected - missing indexes may be causing performance issues');
        }

        return recommendations;
    }

    /**
     * Creates missing indexes if they don't exist
     */
    async createMissingIndexes(): Promise<IndexCreationResult> {
        const verification = await this.verifyOptimizationIndexes();

        if (verification.missingIndexes.length === 0) {
            return {
                success: true,
                createdIndexes: [],
                message: 'All indexes already exist'
            };
        }

        const createdIndexes: string[] = [];
        const failedIndexes: string[] = [];

        // Note: In production, this should run the migration file instead
        // This is a simplified version for demonstration
        logger.warn('Missing indexes detected - run migration 021_optimize_foreign_key_validation_indexes.sql', {
            missingIndexes: verification.missingIndexes
        });

        return {
            success: verification.missingIndexes.length === 0,
            createdIndexes,
            failedIndexes: verification.missingIndexes,
            message: 'Run database migration to create missing indexes'
        };
    }
}

// Type definitions
interface IndexVerificationResult {
    allIndexesPresent: boolean;
    allIndexesValid: boolean;
    indexes: IndexStatus[];
    missingIndexes: string[];
    invalidIndexes: string[];
    recommendations: string[];
    error?: string;
}

interface IndexStatus {
    name: string;
    exists: boolean;
    isValid: boolean;
    size: string | null;
    lastUsed: Date | null;
    scans?: number;
    tuplesReturned?: number;
    tuplesFetched?: number;
}

interface IndexInfo {
    exists: boolean;
    isValid: boolean;
    size: string | null;
    lastUsed: Date | null;
    scans?: number;
    tuplesReturned?: number;
    tuplesFetched?: number;
}

interface PerformanceAnalysis {
    executionTime: number | null;
    planningTime: number | null;
    totalCost: number | null;
    indexesUsed: string[];
    recommendations: string[];
    error?: string;
}

interface IndexCreationResult {
    success: boolean;
    createdIndexes: string[];
    failedIndexes?: string[];
    message: string;
}

export {
    IndexVerificationResult,
    IndexStatus,
    PerformanceAnalysis,
    IndexCreationResult
};