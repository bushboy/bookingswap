import { Pool } from 'pg';
import { logger } from './logger';

/**
 * Data validation utilities for swap self-exclusion fix
 * Requirements: 3.4, 3.5 - Data integrity validation and inconsistency detection
 */

export interface SelfProposalValidationResult {
    swapId: string;
    proposerId: string;
    ownerId: string;
    sourceBookingId: string;
    targetBookingId: string;
    status: string;
    createdAt: Date;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    description: string;
}

export interface DataIntegrityReport {
    totalSwaps: number;
    selfProposalsFound: number;
    nullProposerIds: number;
    nullOwnerIds: number;
    inconsistentBookingRelations: number;
    validationResults: SelfProposalValidationResult[];
    recommendations: string[];
    timestamp: Date;
}

export interface ValidationSummary {
    validationCheck: string;
    issueCount: number;
    severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    recommendation: string;
}

export class SwapDataValidationService {
    constructor(private pool: Pool) { }

    /**
     * Detect existing self-proposals in the database
     * Requirements: 3.4 - Identify data inconsistencies
     */
    async detectSelfProposals(): Promise<SelfProposalValidationResult[]> {
        try {
            const query = `
        SELECT 
          s.id as swap_id,
          s.proposer_id,
          s.owner_id,
          s.source_booking_id,
          s.target_booking_id,
          s.status,
          s.created_at,
          CASE 
            WHEN s.status = 'pending' THEN 'HIGH'
            WHEN s.status = 'accepted' THEN 'HIGH'
            ELSE 'MEDIUM'
          END as severity
        FROM swaps s
        WHERE s.proposer_id = s.owner_id
        ORDER BY s.created_at DESC
      `;

            const result = await this.pool.query(query);

            return result.rows.map(row => ({
                swapId: row.swap_id,
                proposerId: row.proposer_id,
                ownerId: row.owner_id,
                sourceBookingId: row.source_booking_id,
                targetBookingId: row.target_booking_id,
                status: row.status,
                createdAt: row.created_at,
                severity: row.severity as 'HIGH' | 'MEDIUM' | 'LOW',
                description: `Self-proposal detected: User ${row.proposer_id} proposed to their own swap ${row.swap_id} with status ${row.status}`
            }));
        } catch (error) {
            logger.error('Failed to detect self-proposals', { error });
            throw error;
        }
    }

    /**
     * Validate data integrity across the swaps table
     * Requirements: 3.4 - Ensure data integrity
     */
    async validateDataIntegrity(): Promise<DataIntegrityReport> {
        try {
            const timestamp = new Date();

            // Get total swaps count
            const totalSwapsResult = await this.pool.query('SELECT COUNT(*) as count FROM swaps');
            const totalSwaps = parseInt(totalSwapsResult.rows[0].count);

            // Detect self-proposals
            const selfProposals = await this.detectSelfProposals();
            const selfProposalsFound = selfProposals.length;

            // Check for null proposer_ids
            const nullProposerResult = await this.pool.query(
                'SELECT COUNT(*) as count FROM swaps WHERE proposer_id IS NULL'
            );
            const nullProposerIds = parseInt(nullProposerResult.rows[0].count);

            // Check for null owner_ids
            const nullOwnerResult = await this.pool.query(
                'SELECT COUNT(*) as count FROM swaps WHERE owner_id IS NULL'
            );
            const nullOwnerIds = parseInt(nullOwnerResult.rows[0].count);

            // Check for inconsistent booking relations
            const inconsistentBookingResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM swaps s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN bookings tb ON s.target_booking_id = tb.id
        WHERE sb.id IS NULL OR (s.target_booking_id IS NOT NULL AND tb.id IS NULL)
      `);
            const inconsistentBookingRelations = parseInt(inconsistentBookingResult.rows[0].count);

            // Generate recommendations
            const recommendations: string[] = [];

            if (selfProposalsFound > 0) {
                recommendations.push(`Found ${selfProposalsFound} self-proposals that should be cleaned up`);
                recommendations.push('Run the cleanup procedure to remove invalid self-proposals');
            }

            if (nullProposerIds > 0) {
                recommendations.push(`Found ${nullProposerIds} swaps with null proposer_id - investigate data source`);
            }

            if (nullOwnerIds > 0) {
                recommendations.push(`Found ${nullOwnerIds} swaps with null owner_id - critical data integrity issue`);
            }

            if (inconsistentBookingRelations > 0) {
                recommendations.push(`Found ${inconsistentBookingRelations} swaps with missing booking references`);
            }

            if (recommendations.length === 0) {
                recommendations.push('Data integrity validation passed - no issues detected');
            }

            return {
                totalSwaps,
                selfProposalsFound,
                nullProposerIds,
                nullOwnerIds,
                inconsistentBookingRelations,
                validationResults: selfProposals,
                recommendations,
                timestamp
            };
        } catch (error) {
            logger.error('Failed to validate data integrity', { error });
            throw error;
        }
    }

    /**
     * Get validation summary using database function
     * Requirements: 3.4 - Report data inconsistencies
     */
    async getValidationSummary(): Promise<ValidationSummary[]> {
        try {
            const query = 'SELECT * FROM validate_self_exclusion_data()';
            const result = await this.pool.query(query);

            return result.rows.map(row => ({
                validationCheck: row.validation_check,
                issueCount: parseInt(row.issue_count),
                severity: row.severity as 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE',
                recommendation: row.recommendation
            }));
        } catch (error) {
            logger.error('Failed to get validation summary', { error });
            throw error;
        }
    }

    /**
     * Identify swaps that would be affected by self-exclusion filtering
     * Requirements: 3.4 - Identify data inconsistencies
     */
    async identifyAffectedSwaps(userId?: string): Promise<{
        userSwapsWithSelfProposals: any[];
        proposalsFromSelfToOthers: any[];
        summary: {
            totalUserSwaps: number;
            swapsWithSelfProposals: number;
            selfProposalsMade: number;
        };
    }> {
        try {
            const userFilter = userId ? 'WHERE s.owner_id = $1' : '';
            const params = userId ? [userId] : [];

            // Find user swaps that have self-proposals
            const userSwapsQuery = `
        SELECT 
          s.id as swap_id,
          s.owner_id,
          s.source_booking_id,
          s.status as swap_status,
          s.created_at as swap_created_at,
          COUNT(p.id) as self_proposal_count
        FROM swaps s
        LEFT JOIN swaps p ON s.source_booking_id = p.target_booking_id 
          AND p.proposer_id = s.owner_id  -- Self-proposals
          AND p.status = 'pending'
        ${userFilter}
        GROUP BY s.id, s.owner_id, s.source_booking_id, s.status, s.created_at
        HAVING COUNT(p.id) > 0
        ORDER BY s.created_at DESC
      `;

            const userSwapsResult = await this.pool.query(userSwapsQuery, params);

            // Find proposals made by user to their own swaps
            const selfProposalsQuery = `
        SELECT 
          p.id as proposal_id,
          p.proposer_id,
          p.source_booking_id as proposal_booking_id,
          p.target_booking_id,
          p.status as proposal_status,
          p.created_at as proposal_created_at,
          s.id as target_swap_id,
          s.owner_id as target_swap_owner
        FROM swaps p
        JOIN swaps s ON p.target_booking_id = s.source_booking_id
        WHERE p.proposer_id = s.owner_id  -- Self-proposals
        ${userId ? 'AND p.proposer_id = $1' : ''}
        ORDER BY p.created_at DESC
      `;

            const selfProposalsResult = await this.pool.query(selfProposalsQuery, params);

            // Get summary counts
            const totalUserSwapsQuery = userId
                ? 'SELECT COUNT(*) as count FROM swaps WHERE owner_id = $1'
                : 'SELECT COUNT(*) as count FROM swaps';

            const totalUserSwapsResult = await this.pool.query(totalUserSwapsQuery, params);
            const totalUserSwaps = parseInt(totalUserSwapsResult.rows[0].count);

            return {
                userSwapsWithSelfProposals: userSwapsResult.rows,
                proposalsFromSelfToOthers: selfProposalsResult.rows,
                summary: {
                    totalUserSwaps,
                    swapsWithSelfProposals: userSwapsResult.rows.length,
                    selfProposalsMade: selfProposalsResult.rows.length
                }
            };
        } catch (error) {
            logger.error('Failed to identify affected swaps', { error, userId });
            throw error;
        }
    }

    /**
     * Validate that filtering logic is working correctly
     * Requirements: 3.4 - Ensure data integrity
     */
    async validateFilteringLogic(userId: string): Promise<{
        beforeFiltering: {
            userSwaps: number;
            allProposals: number;
            selfProposals: number;
        };
        afterFiltering: {
            userSwaps: number;
            validProposals: number;
            excludedSelfProposals: number;
        };
        isFilteringWorking: boolean;
        issues: string[];
    }> {
        try {
            // Count before filtering
            const userSwapsResult = await this.pool.query(
                'SELECT COUNT(*) as count FROM swaps WHERE owner_id = $1',
                [userId]
            );
            const userSwaps = parseInt(userSwapsResult.rows[0].count);

            const allProposalsResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM swaps s1
        JOIN swaps s2 ON s2.target_booking_id = s1.source_booking_id
        WHERE s1.owner_id = $1 AND s2.status = 'pending'
      `, [userId]);
            const allProposals = parseInt(allProposalsResult.rows[0].count);

            const selfProposalsResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM swaps s1
        JOIN swaps s2 ON s2.target_booking_id = s1.source_booking_id
        WHERE s1.owner_id = $1 AND s2.proposer_id = $1 AND s2.status = 'pending'
      `, [userId]);
            const selfProposals = parseInt(selfProposalsResult.rows[0].count);

            // Count after filtering (with self-exclusion)
            const validProposalsResult = await this.pool.query(`
        SELECT COUNT(*) as count 
        FROM swaps s1
        JOIN swaps s2 ON s2.target_booking_id = s1.source_booking_id
        WHERE s1.owner_id = $1 
        AND s2.proposer_id != $1  -- Self-exclusion filter
        AND s2.status = 'pending'
      `, [userId]);
            const validProposals = parseInt(validProposalsResult.rows[0].count);

            const excludedSelfProposals = allProposals - validProposals;
            const isFilteringWorking = excludedSelfProposals === selfProposals;

            const issues: string[] = [];
            if (!isFilteringWorking) {
                issues.push(`Filtering logic inconsistency: Expected to exclude ${selfProposals} self-proposals, but excluded ${excludedSelfProposals}`);
            }

            if (selfProposals > 0) {
                issues.push(`Found ${selfProposals} self-proposals that should not exist`);
            }

            return {
                beforeFiltering: {
                    userSwaps,
                    allProposals,
                    selfProposals
                },
                afterFiltering: {
                    userSwaps,
                    validProposals,
                    excludedSelfProposals
                },
                isFilteringWorking,
                issues
            };
        } catch (error) {
            logger.error('Failed to validate filtering logic', { error, userId });
            throw error;
        }
    }

    /**
     * Generate a comprehensive data validation report
     * Requirements: 3.4, 3.5 - Report data inconsistencies and ensure data integrity
     */
    async generateValidationReport(userId?: string): Promise<{
        summary: DataIntegrityReport;
        validationSummary: ValidationSummary[];
        affectedSwaps: any;
        filteringValidation?: any;
        recommendations: string[];
    }> {
        try {
            logger.info('Generating comprehensive data validation report', { userId });

            const summary = await this.validateDataIntegrity();
            const validationSummary = await this.getValidationSummary();
            const affectedSwaps = await this.identifyAffectedSwaps(userId);

            let filteringValidation;
            if (userId) {
                filteringValidation = await this.validateFilteringLogic(userId);
            }

            // Compile comprehensive recommendations
            const recommendations = [
                ...summary.recommendations,
                ...validationSummary
                    .filter(v => v.severity !== 'NONE')
                    .map(v => v.recommendation),
            ];

            if (filteringValidation && filteringValidation.issues.length > 0) {
                recommendations.push(...filteringValidation.issues);
            }

            // Remove duplicates
            const uniqueRecommendations = [...new Set(recommendations)];

            logger.info('Data validation report generated successfully', {
                totalSwaps: summary.totalSwaps,
                selfProposalsFound: summary.selfProposalsFound,
                userId
            });

            return {
                summary,
                validationSummary,
                affectedSwaps,
                filteringValidation,
                recommendations: uniqueRecommendations
            };
        } catch (error) {
            logger.error('Failed to generate validation report', { error, userId });
            throw error;
        }
    }
}