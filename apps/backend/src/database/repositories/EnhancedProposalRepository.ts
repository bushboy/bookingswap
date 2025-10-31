import { Pool } from 'pg';
import { logger } from '../../utils/logger';
import { RepositoryErrorHandler, FallbackStrategy, RepositoryOperation } from '../../utils/repositoryErrorHandler';
import { SwapProposalMetadataRepository, ProposalMetadataEntity, CreateProposalMetadataRequest } from './SwapProposalMetadataRepository';

/**
 * Enhanced proposal repository with comprehensive error handling and validation
 * Requirements: 4.3, 2.4, 3.3
 */

export interface ProposalWithUserInfo extends ProposalMetadataEntity {
    proposerName?: string;
    proposerEmail?: string;
    targetOwnerName?: string;
    targetOwnerEmail?: string;
    sourceBookingTitle?: string;
    targetBookingTitle?: string;
}

export interface ProposalQueryFilters {
    userId?: string;
    proposerId?: string;
    targetOwnerId?: string;
    sourceSwapId?: string;
    targetSwapId?: string;
    status?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    limit?: number;
    offset?: number;
}

export interface ProposalQueryResult {
    proposals: ProposalWithUserInfo[];
    totalCount: number;
    hasMore: boolean;
}

/**
 * Enhanced proposal repository with error handling for schema issues
 */
export class EnhancedProposalRepository extends SwapProposalMetadataRepository {
    private errorHandler: RepositoryErrorHandler;

    constructor(pool: Pool) {
        super(pool);
        this.errorHandler = new RepositoryErrorHandler(pool, {
            enableColumnValidation: true,
            enablePerformanceLogging: true,
            enableFallbackStrategies: true,
            performanceThresholds: {
                slowQueryThreshold: 1000,
                verySlowQueryThreshold: 3000
            }
        });
    }

    /**
     * Get proposal by ID with enhanced error handling and user information
     * Requirements: 1.1, 1.3, 2.1, 4.3
     */
    async getProposalByIdWithUserInfo(proposalId: string): Promise<ProposalWithUserInfo | null> {
        const primaryQuery = `
      SELECT 
        p.*,
        proposer_user.display_name as proposer_name,
        proposer_user.email as proposer_email,
        target_user.display_name as target_owner_name,
        target_user.email as target_owner_email,
        source_booking.title as source_booking_title,
        target_booking.title as target_booking_title
      FROM ${this.tableName} p
      LEFT JOIN swaps source_swap ON p.source_swap_id = source_swap.id
      LEFT JOIN bookings source_booking ON source_swap.source_booking_id = source_booking.id
      LEFT JOIN users proposer_user ON source_booking.user_id = proposer_user.id
      LEFT JOIN swaps target_swap ON p.target_swap_id = target_swap.id
      LEFT JOIN bookings target_booking ON target_swap.source_booking_id = target_booking.id
      LEFT JOIN users target_user ON target_booking.user_id = target_user.id
      WHERE p.proposal_id = $1
    `;

        // Create fallback strategy for deprecated column queries
        const fallbackQuery = `
      SELECT 
        p.*,
        NULL as proposer_name,
        NULL as proposer_email,
        NULL as target_owner_name,
        NULL as target_owner_email,
        NULL as source_booking_title,
        NULL as target_booking_title
      FROM ${this.tableName} p
      WHERE p.proposal_id = $1
    `;

        const fallbackStrategies: FallbackStrategy<ProposalWithUserInfo | null>[] = [
            RepositoryErrorHandler.createDeprecatedColumnFallback(
                fallbackQuery,
                [proposalId],
                async (query, params) => {
                    const result = await this.pool.query(query, params);
                    if (result.rows.length === 0) return null;

                    const proposal = this.mapRowToEntity(result.rows[0]);
                    return {
                        ...proposal,
                        proposerName: undefined,
                        proposerEmail: undefined,
                        targetOwnerName: undefined,
                        targetOwnerEmail: undefined,
                        sourceBookingTitle: undefined,
                        targetBookingTitle: undefined
                    };
                }
            ),
            RepositoryErrorHandler.createMissingDataFallback(null)
        ];

        const operation: RepositoryOperation<ProposalWithUserInfo | null> = {
            name: 'getProposalByIdWithUserInfo',
            query: primaryQuery,
            parameters: [proposalId],
            executor: async () => {
                const result = await this.pool.query(primaryQuery, [proposalId]);
                if (result.rows.length === 0) return null;

                const row = result.rows[0];
                const proposal = this.mapRowToEntity(row);

                return {
                    ...proposal,
                    proposerName: row.proposer_name,
                    proposerEmail: row.proposer_email,
                    targetOwnerName: row.target_owner_name,
                    targetOwnerEmail: row.target_owner_email,
                    sourceBookingTitle: row.source_booking_title,
                    targetBookingTitle: row.target_booking_title
                };
            },
            fallbackStrategies,
            context: { proposalId }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'getProposalByIdWithUserInfo',
                additionalContext: { proposalId }
            });
        } catch (error: any) {
            // Enhanced error handling with debugging information
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'getProposalByIdWithUserInfo', { proposalId });

                logger.error('Column reference error in getProposalByIdWithUserInfo - schema mismatch detected', {
                    proposalId,
                    error: error.message,
                    suggestion: 'Check if JOIN tables and columns exist in current schema',
                    requirement: '4.3'
                });

                // Return null as graceful fallback for missing columns
                return null;
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { proposalId }
                );
            }

            logger.error('Failed to get proposal by ID with user info', {
                proposalId,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Get proposals with user information and filtering
     * Requirements: 2.1, 2.2, 3.1, 4.3
     */
    async getProposalsWithUserInfo(filters: ProposalQueryFilters = {}): Promise<ProposalQueryResult> {
        const {
            userId,
            proposerId,
            targetOwnerId,
            sourceSwapId,
            targetSwapId,
            createdAfter,
            createdBefore,
            limit = 50,
            offset = 0
        } = filters;

        // Build WHERE conditions dynamically
        const conditions: string[] = [];
        const parameters: any[] = [];
        let paramIndex = 1;

        if (sourceSwapId) {
            conditions.push(`p.source_swap_id = $${paramIndex++}`);
            parameters.push(sourceSwapId);
        }

        if (targetSwapId) {
            conditions.push(`p.target_swap_id = $${paramIndex++}`);
            parameters.push(targetSwapId);
        }

        if (userId) {
            // User can be either proposer or target owner through booking relationships
            conditions.push(`(source_booking.user_id = $${paramIndex} OR target_booking.user_id = $${paramIndex})`);
            parameters.push(userId);
            paramIndex++;
        }

        if (proposerId) {
            conditions.push(`source_booking.user_id = $${paramIndex++}`);
            parameters.push(proposerId);
        }

        if (targetOwnerId) {
            conditions.push(`target_booking.user_id = $${paramIndex++}`);
            parameters.push(targetOwnerId);
        }

        if (createdAfter) {
            conditions.push(`p.created_at >= $${paramIndex++}`);
            parameters.push(createdAfter);
        }

        if (createdBefore) {
            conditions.push(`p.created_at <= $${paramIndex++}`);
            parameters.push(createdBefore);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        const primaryQuery = `
      SELECT 
        p.*,
        proposer_user.display_name as proposer_name,
        proposer_user.email as proposer_email,
        target_user.display_name as target_owner_name,
        target_user.email as target_owner_email,
        source_booking.title as source_booking_title,
        target_booking.title as target_booking_title,
        COUNT(*) OVER() as total_count
      FROM ${this.tableName} p
      LEFT JOIN swaps source_swap ON p.source_swap_id = source_swap.id
      LEFT JOIN bookings source_booking ON source_swap.source_booking_id = source_booking.id
      LEFT JOIN users proposer_user ON source_booking.user_id = proposer_user.id
      LEFT JOIN swaps target_swap ON p.target_swap_id = target_swap.id
      LEFT JOIN bookings target_booking ON target_swap.source_booking_id = target_booking.id
      LEFT JOIN users target_user ON target_booking.user_id = target_user.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

        parameters.push(limit, offset);

        // Fallback strategy for deprecated column queries
        const fallbackQuery = `
      SELECT 
        p.*,
        NULL as proposer_name,
        NULL as proposer_email,
        NULL as target_owner_name,
        NULL as target_owner_email,
        NULL as source_booking_title,
        NULL as target_booking_title,
        COUNT(*) OVER() as total_count
      FROM ${this.tableName} p
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex - 2} OFFSET $${paramIndex - 1}
    `;

        const fallbackStrategies: FallbackStrategy<ProposalQueryResult>[] = [
            RepositoryErrorHandler.createDeprecatedColumnFallback(
                fallbackQuery,
                parameters,
                async (query, params) => {
                    const result = await this.pool.query(query, params);
                    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

                    const proposals: ProposalWithUserInfo[] = result.rows.map(row => {
                        const proposal = this.mapRowToEntity(row);
                        return {
                            ...proposal,
                            proposerName: undefined,
                            proposerEmail: undefined,
                            targetOwnerName: undefined,
                            targetOwnerEmail: undefined,
                            sourceBookingTitle: undefined,
                            targetBookingTitle: undefined
                        };
                    });

                    return {
                        proposals,
                        totalCount,
                        hasMore: offset + limit < totalCount
                    };
                }
            ),
            RepositoryErrorHandler.createMissingDataFallback({
                proposals: [],
                totalCount: 0,
                hasMore: false
            })
        ];

        const operation: RepositoryOperation<ProposalQueryResult> = {
            name: 'getProposalsWithUserInfo',
            query: primaryQuery,
            parameters,
            executor: async () => {
                const result = await this.pool.query(primaryQuery, parameters);
                const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;

                const proposals: ProposalWithUserInfo[] = result.rows.map(row => {
                    const proposal = this.mapRowToEntity(row);
                    return {
                        ...proposal,
                        proposerName: row.proposer_name,
                        proposerEmail: row.proposer_email,
                        targetOwnerName: row.target_owner_name,
                        targetOwnerEmail: row.target_owner_email,
                        sourceBookingTitle: row.source_booking_title,
                        targetBookingTitle: row.target_booking_title
                    };
                });

                return {
                    proposals,
                    totalCount,
                    hasMore: offset + limit < totalCount
                };
            },
            fallbackStrategies,
            context: { filters }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'getProposalsWithUserInfo',
                additionalContext: { filters }
            });
        } catch (error: any) {
            // Enhanced error handling with debugging information
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'getProposalsWithUserInfo', { filters });

                logger.error('Column reference error in getProposalsWithUserInfo - schema mismatch detected', {
                    filters,
                    error: error.message,
                    suggestion: 'Check if JOIN tables and columns exist in current schema',
                    requirement: '4.3'
                });

                // Return empty result as graceful fallback for missing columns
                return {
                    proposals: [],
                    totalCount: 0,
                    hasMore: false
                };
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { filters }
                );
            }

            logger.error('Failed to get proposals with user info', {
                filters,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Override base repository methods with enhanced error handling
     * Requirements: 4.3, 2.4, 3.3
     */

    /**
     * Enhanced findByProposalId with error handling
     */
    async findByProposalId(proposalId: string): Promise<ProposalMetadataEntity | null> {
        const operation: RepositoryOperation<ProposalMetadataEntity | null> = {
            name: 'findByProposalId',
            query: `SELECT * FROM ${this.tableName} WHERE proposal_id = $1`,
            parameters: [proposalId],
            executor: () => super.findByProposalId(proposalId),
            fallbackStrategies: [
                RepositoryErrorHandler.createMissingDataFallback(null)
            ],
            context: { proposalId }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'findByProposalId',
                additionalContext: { proposalId }
            });
        } catch (error: any) {
            // Enhanced error handling with specific error types
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'findByProposalId', { proposalId });

                logger.error('Column reference error in findByProposalId - schema mismatch detected', {
                    proposalId,
                    error: error.message,
                    suggestion: 'Check if proposal_id column exists or use correct column name',
                    requirement: '4.3'
                });

                // Return null as graceful fallback for missing columns
                return null;
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { proposalId }
                );
            }

            logger.error('Failed to find proposal by ID', {
                proposalId,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced findProposalsByProposerId with error handling
     */
    async findProposalsByProposerId(proposerId: string, limit: number = 50, offset: number = 0): Promise<ProposalMetadataEntity[]> {
        // Primary query using current schema (should work if proposer_id column exists)
        const primaryQuery = `
      SELECT * FROM ${this.tableName}
      WHERE proposer_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

        // Fallback query using JOIN to derive proposer through booking relationships
        const fallbackQuery = `
      SELECT p.* FROM ${this.tableName} p
      LEFT JOIN swaps source_swap ON p.source_swap_id = source_swap.id
      LEFT JOIN bookings source_booking ON source_swap.source_booking_id = source_booking.id
      WHERE source_booking.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        const fallbackStrategies: FallbackStrategy<ProposalMetadataEntity[]>[] = [
            RepositoryErrorHandler.createDeprecatedColumnFallback(
                fallbackQuery,
                [proposerId, limit, offset],
                async (query, params) => {
                    try {
                        const result = await this.pool.query(query, params);
                        return result.rows.map(row => this.mapRowToEntity(row));
                    } catch (fallbackError: any) {
                        logger.warn('Fallback query failed for findProposalsByProposerId', {
                            proposerId,
                            fallbackError: fallbackError.message,
                            requirement: '2.4'
                        });
                        return [];
                    }
                }
            ),
            RepositoryErrorHandler.createMissingDataFallback([])
        ];

        const operation: RepositoryOperation<ProposalMetadataEntity[]> = {
            name: 'findProposalsByProposerId',
            query: primaryQuery,
            parameters: [proposerId, limit, offset],
            executor: () => super.findProposalsByProposerId(proposerId, limit, offset),
            fallbackStrategies,
            context: { proposerId, limit, offset }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'findProposalsByProposerId',
                additionalContext: { proposerId, limit, offset }
            });
        } catch (error: any) {
            // Enhanced error handling with specific error types
            if (this.isColumnNotFoundError(error)) {
                logger.error('Column reference error in findProposalsByProposerId - schema mismatch detected', {
                    proposerId,
                    limit,
                    offset,
                    error: error.message,
                    suggestion: 'Update query to use JOIN operations for user relationships',
                    requirement: '4.3'
                });

                // Return empty array as graceful fallback for missing columns
                return [];
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { proposerId, limit, offset }
                );
            }

            logger.error('Failed to find proposals by proposer ID', {
                proposerId,
                limit,
                offset,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced findProposalsReceivedByUserId with error handling
     */
    async findProposalsReceivedByUserId(targetOwnerId: string, limit: number = 50, offset: number = 0): Promise<ProposalMetadataEntity[]> {
        // Primary query using current schema (should work if target_owner_id column exists)
        const primaryQuery = `
      SELECT * FROM ${this.tableName}
      WHERE target_owner_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

        // Fallback query using JOIN to derive target owner through booking relationships
        const fallbackQuery = `
      SELECT p.* FROM ${this.tableName} p
      LEFT JOIN swaps target_swap ON p.target_swap_id = target_swap.id
      LEFT JOIN bookings target_booking ON target_swap.source_booking_id = target_booking.id
      WHERE target_booking.user_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;

        const fallbackStrategies: FallbackStrategy<ProposalMetadataEntity[]>[] = [
            RepositoryErrorHandler.createDeprecatedColumnFallback(
                fallbackQuery,
                [targetOwnerId, limit, offset],
                async (query, params) => {
                    try {
                        const result = await this.pool.query(query, params);
                        return result.rows.map(row => this.mapRowToEntity(row));
                    } catch (fallbackError: any) {
                        logger.warn('Fallback query failed for findProposalsReceivedByUserId', {
                            targetOwnerId,
                            fallbackError: fallbackError.message,
                            requirement: '2.4'
                        });
                        return [];
                    }
                }
            ),
            RepositoryErrorHandler.createMissingDataFallback([])
        ];

        const operation: RepositoryOperation<ProposalMetadataEntity[]> = {
            name: 'findProposalsReceivedByUserId',
            query: primaryQuery,
            parameters: [targetOwnerId, limit, offset],
            executor: () => super.findProposalsReceivedByUserId(targetOwnerId, limit, offset),
            fallbackStrategies,
            context: { targetOwnerId, limit, offset }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'findProposalsReceivedByUserId',
                additionalContext: { targetOwnerId, limit, offset }
            });
        } catch (error: any) {
            // Enhanced error handling with specific error types
            if (this.isColumnNotFoundError(error)) {
                logger.error('Column reference error in findProposalsReceivedByUserId - schema mismatch detected', {
                    targetOwnerId,
                    limit,
                    offset,
                    error: error.message,
                    suggestion: 'Update query to use JOIN operations for user relationships',
                    requirement: '4.3'
                });

                // Return empty array as graceful fallback for missing columns
                return [];
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { targetOwnerId, limit, offset }
                );
            }

            logger.error('Failed to find proposals received by user ID', {
                targetOwnerId,
                limit,
                offset,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced createProposalMetadata with error handling
     */
    async createProposalMetadata(data: CreateProposalMetadataRequest): Promise<ProposalMetadataEntity> {
        const operation: RepositoryOperation<ProposalMetadataEntity> = {
            name: 'createProposalMetadata',
            query: `INSERT INTO ${this.tableName} (...) VALUES (...) RETURNING *`,
            parameters: Object.values(data),
            executor: () => super.createProposalMetadata(data),
            context: { data }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'createProposalMetadata',
                additionalContext: { data }
            });
        } catch (error: any) {
            // Enhanced error handling for creation operations
            if (this.isConstraintViolationError(error)) {
                logger.error('Constraint violation in createProposalMetadata', {
                    data,
                    error: error.message,
                    constraint: this.extractConstraintName(error),
                    requirement: '4.3'
                });

                throw this.createUserFriendlyError(
                    'Unable to create proposal due to data validation error.',
                    'DataValidationError',
                    error,
                    { data }
                );
            }

            if (this.isColumnNotFoundError(error)) {
                logger.error('Column reference error in createProposalMetadata - schema mismatch detected', {
                    data,
                    error: error.message,
                    suggestion: 'Check if all required columns exist in the current schema',
                    requirement: '4.3'
                });

                throw this.createUserFriendlyError(
                    'Database schema mismatch. Please contact support.',
                    'DatabaseSchemaError',
                    error,
                    { data }
                );
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { data }
                );
            }

            logger.error('Failed to create proposal metadata', {
                data,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced getUserProposalStats with error handling
     */
    async getUserProposalStats(userId: string): Promise<{
        totalProposed: number;
        totalReceived: number;
        browseProposals: number;
        directProposals: number;
        auctionProposals: number;
        averageCompatibilityScore: number;
    }> {
        // Primary query using current schema (should work if proposer_id and target_owner_id columns exist)
        const primaryQuery = `
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

        // Fallback query using JOINs to derive user relationships
        const fallbackQuery = `
      SELECT 
        COUNT(CASE WHEN source_booking.user_id = $1 THEN 1 END) as total_proposed,
        COUNT(CASE WHEN target_booking.user_id = $1 THEN 1 END) as total_received,
        COUNT(CASE WHEN source_booking.user_id = $1 AND p.proposal_source = 'browse' THEN 1 END) as browse_proposals,
        COUNT(CASE WHEN source_booking.user_id = $1 AND p.proposal_source = 'direct' THEN 1 END) as direct_proposals,
        COUNT(CASE WHEN source_booking.user_id = $1 AND p.proposal_source = 'auction' THEN 1 END) as auction_proposals,
        AVG(CASE WHEN source_booking.user_id = $1 AND p.compatibility_score IS NOT NULL THEN p.compatibility_score END) as avg_compatibility_score
      FROM ${this.tableName} p
      LEFT JOIN swaps source_swap ON p.source_swap_id = source_swap.id
      LEFT JOIN bookings source_booking ON source_swap.source_booking_id = source_booking.id
      LEFT JOIN swaps target_swap ON p.target_swap_id = target_swap.id
      LEFT JOIN bookings target_booking ON target_swap.source_booking_id = target_booking.id
      WHERE source_booking.user_id = $1 OR target_booking.user_id = $1
    `;

        const fallbackStrategies: FallbackStrategy<any>[] = [
            RepositoryErrorHandler.createDeprecatedColumnFallback(
                fallbackQuery,
                [userId],
                async (query, params) => {
                    const result = await this.pool.query(query, params);
                    const row = result.rows[0];

                    return {
                        totalProposed: parseInt(row.total_proposed) || 0,
                        totalReceived: parseInt(row.total_received) || 0,
                        browseProposals: parseInt(row.browse_proposals) || 0,
                        directProposals: parseInt(row.direct_proposals) || 0,
                        auctionProposals: parseInt(row.auction_proposals) || 0,
                        averageCompatibilityScore: parseFloat(row.avg_compatibility_score) || 0,
                    };
                }
            ),
            RepositoryErrorHandler.createMissingDataFallback({
                totalProposed: 0,
                totalReceived: 0,
                browseProposals: 0,
                directProposals: 0,
                auctionProposals: 0,
                averageCompatibilityScore: 0,
            })
        ];

        const operation: RepositoryOperation<any> = {
            name: 'getUserProposalStats',
            query: primaryQuery,
            parameters: [userId],
            executor: () => super.getUserProposalStats(userId),
            fallbackStrategies,
            context: { userId }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'getUserProposalStats',
                additionalContext: { userId }
            });
        } catch (error: any) {
            // Enhanced error handling with debugging information
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'getUserProposalStats', { userId });

                logger.error('Column reference error in getUserProposalStats - schema mismatch detected', {
                    userId,
                    error: error.message,
                    suggestion: 'Update query to use JOIN operations for user relationships',
                    requirement: '4.3'
                });

                // Return default stats as graceful fallback
                return {
                    totalProposed: 0,
                    totalReceived: 0,
                    browseProposals: 0,
                    directProposals: 0,
                    auctionProposals: 0,
                    averageCompatibilityScore: 0,
                };
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { userId }
                );
            }

            logger.error('Failed to get user proposal stats', {
                userId,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Get error handler statistics for monitoring
     * Requirements: 5.5
     */
    getErrorHandlerStats(): {
        columnValidationEnabled: boolean;
        performanceLoggingEnabled: boolean;
        fallbackStrategiesEnabled: boolean;
        performanceStats: any;
    } {
        return this.errorHandler.getStats();
    }

    /**
     * Reset error handler state for testing
     * Requirements: 5.5
     */
    resetErrorHandler(): void {
        this.errorHandler.reset();
    }

    /**
     * Enhanced findProposalsBySourceSwapId with error handling
     * Requirements: 2.1, 2.2, 4.3
     */
    async findProposalsBySourceSwapId(sourceSwapId: string): Promise<ProposalMetadataEntity[]> {
        const operation: RepositoryOperation<ProposalMetadataEntity[]> = {
            name: 'findProposalsBySourceSwapId',
            query: `SELECT * FROM ${this.tableName} WHERE source_swap_id = $1 ORDER BY created_at DESC`,
            parameters: [sourceSwapId],
            executor: () => super.findProposalsBySourceSwapId(sourceSwapId),
            fallbackStrategies: [
                RepositoryErrorHandler.createMissingDataFallback([])
            ],
            context: { sourceSwapId }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'findProposalsBySourceSwapId',
                additionalContext: { sourceSwapId }
            });
        } catch (error: any) {
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'findProposalsBySourceSwapId', { sourceSwapId });
                return [];
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { sourceSwapId }
                );
            }

            logger.error('Failed to find proposals by source swap ID', {
                sourceSwapId,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced findProposalsByTargetSwapId with error handling
     * Requirements: 2.1, 2.2, 4.3
     */
    async findProposalsByTargetSwapId(targetSwapId: string): Promise<ProposalMetadataEntity[]> {
        const operation: RepositoryOperation<ProposalMetadataEntity[]> = {
            name: 'findProposalsByTargetSwapId',
            query: `SELECT * FROM ${this.tableName} WHERE target_swap_id = $1 ORDER BY created_at DESC`,
            parameters: [targetSwapId],
            executor: () => super.findProposalsByTargetSwapId(targetSwapId),
            fallbackStrategies: [
                RepositoryErrorHandler.createMissingDataFallback([])
            ],
            context: { targetSwapId }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'findProposalsByTargetSwapId',
                additionalContext: { targetSwapId }
            });
        } catch (error: any) {
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'findProposalsByTargetSwapId', { targetSwapId });
                return [];
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { targetSwapId }
                );
            }

            logger.error('Failed to find proposals by target swap ID', {
                targetSwapId,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Enhanced updateCompatibilityScore with error handling
     * Requirements: 4.3, 3.3
     */
    async updateCompatibilityScore(proposalId: string, compatibilityScore: number): Promise<ProposalMetadataEntity | null> {
        const operation: RepositoryOperation<ProposalMetadataEntity | null> = {
            name: 'updateCompatibilityScore',
            query: `UPDATE ${this.tableName} SET compatibility_score = $1, updated_at = CURRENT_TIMESTAMP WHERE proposal_id = $2 RETURNING *`,
            parameters: [compatibilityScore, proposalId],
            executor: () => super.updateCompatibilityScore(proposalId, compatibilityScore),
            fallbackStrategies: [
                RepositoryErrorHandler.createMissingDataFallback(null)
            ],
            context: { proposalId, compatibilityScore }
        };

        try {
            return await this.errorHandler.executeWithErrorHandling(operation, {
                operation: 'updateCompatibilityScore',
                additionalContext: { proposalId, compatibilityScore }
            });
        } catch (error: any) {
            if (this.isColumnNotFoundError(error)) {
                this.logSchemaDebugInfo(error, 'updateCompatibilityScore', { proposalId, compatibilityScore });

                logger.error('Column reference error in updateCompatibilityScore - schema mismatch detected', {
                    proposalId,
                    compatibilityScore,
                    error: error.message,
                    suggestion: 'Check if compatibility_score column exists in current schema',
                    requirement: '4.3'
                });

                return null;
            }

            if (this.isConstraintViolationError(error)) {
                throw this.createUserFriendlyError(
                    'Invalid compatibility score value.',
                    'DataValidationError',
                    error,
                    { proposalId, compatibilityScore }
                );
            }

            if (this.isConnectionError(error)) {
                throw this.createUserFriendlyError(
                    'Database temporarily unavailable. Please try again.',
                    'DatabaseConnectionError',
                    error,
                    { proposalId, compatibilityScore }
                );
            }

            logger.error('Failed to update compatibility score', {
                proposalId,
                compatibilityScore,
                error: error.message,
                errorType: error.name,
                requirement: '4.3'
            });
            throw error;
        }
    }

    /**
     * Check if error is a column not found error (PostgreSQL 42703)
     * Requirements: 4.3, 2.4
     */
    private isColumnNotFoundError(error: any): boolean {
        return error.code === '42703' ||
            (error.message && error.message.includes('column') && error.message.includes('does not exist'));
    }

    /**
     * Check if error is a database connection error
     * Requirements: 4.3, 3.3
     */
    private isConnectionError(error: any): boolean {
        return error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.code === '08000' || // PostgreSQL connection exception
            error.code === '08003' || // PostgreSQL connection does not exist
            error.code === '08006' || // PostgreSQL connection failure
            (error.message && (
                error.message.includes('connection') ||
                error.message.includes('timeout') ||
                error.message.includes('ECONNREFUSED')
            ));
    }

    /**
     * Check if error is a constraint violation error
     * Requirements: 4.3, 3.3
     */
    private isConstraintViolationError(error: any): boolean {
        return error.code === '23505' || // unique_violation
            error.code === '23503' || // foreign_key_violation
            error.code === '23502' || // not_null_violation
            error.code === '23514' || // check_violation
            (error.message && (
                error.message.includes('constraint') ||
                error.message.includes('duplicate key') ||
                error.message.includes('violates')
            ));
    }

    /**
     * Extract constraint name from PostgreSQL error
     * Requirements: 4.3, 3.3
     */
    private extractConstraintName(error: any): string | null {
        if (error.constraint) {
            return error.constraint;
        }

        const constraintMatch = error.message?.match(/constraint "([^"]+)"/);
        return constraintMatch ? constraintMatch[1] : null;
    }

    /**
     * Create user-friendly error with enhanced context
     * Requirements: 4.3, 3.3
     */
    private createUserFriendlyError(
        userMessage: string,
        errorType: string,
        originalError: Error,
        context: Record<string, any>
    ): Error {
        const enhancedError = new Error(userMessage);
        enhancedError.name = errorType;
        (enhancedError as any).originalError = originalError;
        (enhancedError as any).context = context;
        (enhancedError as any).timestamp = new Date().toISOString();
        (enhancedError as any).requirement = '4.3';

        return enhancedError;
    }

    /**
     * Log comprehensive error information for debugging
     * Requirements: 4.3, 5.5
     */
    private logSchemaDebugInfo(error: any, operation: string, context: Record<string, any>): void {
        logger.error('Schema debugging information', {
            operation,
            error: {
                message: error.message,
                code: error.code,
                detail: error.detail,
                hint: error.hint,
                position: error.position,
                constraint: error.constraint
            },
            context,
            schemaInfo: {
                tableName: this.tableName,
                expectedColumns: [
                    'id', 'proposal_id', 'source_swap_id', 'target_swap_id',
                    'message', 'compatibility_score', 'created_from_browse',
                    'proposal_source', 'created_at', 'updated_at'
                ],
                deprecatedColumns: ['proposer_id', 'target_owner_id', 'owner_id'],
                relationshipDerivation: {
                    proposer: 'source_swap_id -> swaps.source_booking_id -> bookings.user_id',
                    targetOwner: 'target_swap_id -> swaps.source_booking_id -> bookings.user_id'
                }
            },
            timestamp: new Date().toISOString(),
            requirement: '5.5'
        });
    }
}