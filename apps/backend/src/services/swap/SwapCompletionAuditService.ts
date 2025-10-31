import { Pool, PoolClient } from 'pg';
import {
    SwapCompletionAudit,
    CompletionValidationResult,
    RelatedEntities,
    SwapCompletionErrorCodes,
    SwapCompletionError
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * SwapCompletionAuditService manages comprehensive audit trail for swap completion operations.
 * Provides audit record creation, queries, updates, and cleanup procedures.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */
export class SwapCompletionAuditService {
    constructor(private readonly pool: Pool) { }

    /**
     * Create comprehensive audit record for swap completion
     * Records all entities involved and validation results
     * 
     * Requirements: 6.1, 6.2
     */
    async createAuditRecord(
        entities: RelatedEntities,
        transactionId: string,
        affectedSwaps: string[],
        affectedBookings: string[],
        preValidationResult?: CompletionValidationResult
    ): Promise<SwapCompletionAudit> {
        const client = await this.pool.connect();

        try {
            const auditId = uuidv4();
            const completionType = entities.targetSwap ? 'booking_exchange' : 'cash_payment';
            const initiatedBy = entities.proposal.target_user_id;

            logger.info('Creating completion audit record', {
                auditId,
                proposalId: entities.proposal.id,
                completionType,
                affectedSwapsCount: affectedSwaps.length,
                affectedBookingsCount: affectedBookings.length
            });

            const query = `
                INSERT INTO swap_completion_audits (
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    status,
                    pre_validation_result,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8, $9, NOW(), NOW())
                RETURNING 
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    blockchain_transaction_id,
                    status,
                    error_details,
                    pre_validation_result,
                    post_validation_result,
                    created_at,
                    updated_at
            `;

            const values = [
                auditId,
                entities.proposal.id,
                completionType,
                initiatedBy,
                affectedSwaps,
                affectedBookings,
                transactionId,
                'initiated',
                preValidationResult ? JSON.stringify(preValidationResult) : null
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                    'Failed to create completion audit record',
                    [entities.proposal.id]
                );
            }

            const auditRecord = this.mapRowToAuditRecord(result.rows[0]);

            // Update proposal with audit ID reference
            await client.query(`
                UPDATE swap_proposals 
                SET completion_audit_id = $2,
                    updated_at = NOW()
                WHERE id = $1
            `, [entities.proposal.id, auditId]);

            logger.info('Completion audit record created successfully', {
                auditId,
                proposalId: entities.proposal.id,
                completionType
            });

            return auditRecord;

        } catch (error) {
            logger.error('Failed to create completion audit record', {
                proposalId: entities.proposal.id,
                error: error instanceof Error ? error.message : String(error)
            });

            if (error instanceof SwapCompletionError) {
                throw error;
            }

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to create audit record: ${error instanceof Error ? error.message : String(error)}`,
                [entities.proposal.id]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Update audit record status with completion details
     * Records completion status changes and validation results
     * 
     * Requirements: 6.1, 6.3
     */
    async updateAuditRecordStatus(
        proposalId: string,
        status: 'completed' | 'failed' | 'rolled_back',
        postValidationResult?: CompletionValidationResult,
        errorDetails?: string,
        blockchainTransactionId?: string
    ): Promise<SwapCompletionAudit> {
        const client = await this.pool.connect();

        try {
            logger.info('Updating completion audit record status', {
                proposalId,
                status,
                hasPostValidation: !!postValidationResult,
                hasErrorDetails: !!errorDetails,
                hasBlockchainTx: !!blockchainTransactionId
            });

            const query = `
                UPDATE swap_completion_audits 
                SET 
                    status = $2,
                    post_validation_result = $3,
                    error_details = $4,
                    blockchain_transaction_id = $5,
                    updated_at = NOW()
                WHERE proposal_id = $1
                RETURNING 
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    blockchain_transaction_id,
                    status,
                    error_details,
                    pre_validation_result,
                    post_validation_result,
                    created_at,
                    updated_at
            `;

            const values = [
                proposalId,
                status,
                postValidationResult ? JSON.stringify(postValidationResult) : null,
                errorDetails || null,
                blockchainTransactionId || null
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                    `Audit record not found for proposal: ${proposalId}`,
                    [proposalId]
                );
            }

            const auditRecord = this.mapRowToAuditRecord(result.rows[0]);

            logger.info('Completion audit record status updated successfully', {
                auditId: auditRecord.id,
                proposalId,
                status
            });

            return auditRecord;

        } catch (error) {
            logger.error('Failed to update completion audit record status', {
                proposalId,
                status,
                error: error instanceof Error ? error.message : String(error)
            });

            if (error instanceof SwapCompletionError) {
                throw error;
            }

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to update audit record: ${error instanceof Error ? error.message : String(error)}`,
                [proposalId]
            );
        } finally {
            client.release();
        }
    }

    /**
     * Get audit record by proposal ID
     * Retrieves complete audit trail for a specific completion
     * 
     * Requirements: 6.1, 6.3
     */
    async getAuditRecordByProposal(proposalId: string): Promise<SwapCompletionAudit | null> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT 
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    blockchain_transaction_id,
                    status,
                    error_details,
                    pre_validation_result,
                    post_validation_result,
                    created_at,
                    updated_at
                FROM swap_completion_audits 
                WHERE proposal_id = $1
                ORDER BY created_at DESC
                LIMIT 1
            `;

            const result = await client.query(query, [proposalId]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToAuditRecord(result.rows[0]);

        } catch (error) {
            logger.error('Failed to get audit record by proposal', {
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Get audit record by audit ID
     * Retrieves specific audit record for detailed analysis
     * 
     * Requirements: 6.1, 6.3
     */
    async getAuditRecordById(auditId: string): Promise<SwapCompletionAudit | null> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT 
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    blockchain_transaction_id,
                    status,
                    error_details,
                    pre_validation_result,
                    post_validation_result,
                    created_at,
                    updated_at
                FROM swap_completion_audits 
                WHERE id = $1
            `;

            const result = await client.query(query, [auditId]);

            if (result.rows.length === 0) {
                return null;
            }

            return this.mapRowToAuditRecord(result.rows[0]);

        } catch (error) {
            logger.error('Failed to get audit record by ID', {
                auditId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        } finally {
            client.release();
        }
    }

    /**
     * Query completion history with filtering and pagination
     * Provides comprehensive audit trail queries for completion history
     * 
     * Requirements: 6.2, 6.3
     */
    async queryCompletionHistory(options: {
        userId?: string;
        completionType?: 'booking_exchange' | 'cash_payment';
        status?: 'initiated' | 'completed' | 'failed' | 'rolled_back';
        dateFrom?: Date;
        dateTo?: Date;
        limit?: number;
        offset?: number;
        includeValidationResults?: boolean;
    } = {}): Promise<{
        records: SwapCompletionAudit[];
        totalCount: number;
        hasMore: boolean;
    }> {
        const client = await this.pool.connect();

        try {
            const {
                userId,
                completionType,
                status,
                dateFrom,
                dateTo,
                limit = 50,
                offset = 0,
                includeValidationResults = false
            } = options;

            logger.debug('Querying completion history', {
                userId,
                completionType,
                status,
                dateFrom,
                dateTo,
                limit,
                offset,
                includeValidationResults
            });

            // Build WHERE clause dynamically
            const conditions: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (userId) {
                conditions.push(`initiated_by = $${paramIndex}`);
                values.push(userId);
                paramIndex++;
            }

            if (completionType) {
                conditions.push(`completion_type = $${paramIndex}`);
                values.push(completionType);
                paramIndex++;
            }

            if (status) {
                conditions.push(`status = $${paramIndex}`);
                values.push(status);
                paramIndex++;
            }

            if (dateFrom) {
                conditions.push(`completed_at >= $${paramIndex}`);
                values.push(dateFrom);
                paramIndex++;
            }

            if (dateTo) {
                conditions.push(`completed_at <= $${paramIndex}`);
                values.push(dateTo);
                paramIndex++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM swap_completion_audits 
                ${whereClause}
            `;

            const countResult = await client.query(countQuery, values);
            const totalCount = parseInt(countResult.rows[0].total);

            // Get records with pagination
            const selectFields = includeValidationResults
                ? `id, proposal_id, completion_type, initiated_by, completed_at, affected_swaps, 
                   affected_bookings, database_transaction_id, blockchain_transaction_id, status, 
                   error_details, pre_validation_result, post_validation_result, created_at, updated_at`
                : `id, proposal_id, completion_type, initiated_by, completed_at, affected_swaps, 
                   affected_bookings, database_transaction_id, blockchain_transaction_id, status, 
                   error_details, created_at, updated_at`;

            const recordsQuery = `
                SELECT ${selectFields}
                FROM swap_completion_audits 
                ${whereClause}
                ORDER BY completed_at DESC, created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            values.push(limit, offset);

            const recordsResult = await client.query(recordsQuery, values);

            const records = recordsResult.rows.map(row => this.mapRowToAuditRecord(row, includeValidationResults));

            const hasMore = offset + limit < totalCount;

            logger.debug('Completion history query completed', {
                totalCount,
                returnedCount: records.length,
                hasMore,
                offset,
                limit
            });

            return {
                records,
                totalCount,
                hasMore
            };

        } catch (error) {
            logger.error('Failed to query completion history', {
                options,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to query completion history: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            client.release();
        }
    }

    /**
     * Get completion statistics for monitoring and reporting
     * Provides aggregated data for completion performance analysis
     * 
     * Requirements: 6.2, 6.3
     */
    async getCompletionStatistics(options: {
        dateFrom?: Date;
        dateTo?: Date;
        userId?: string;
    } = {}): Promise<{
        totalCompletions: number;
        successfulCompletions: number;
        failedCompletions: number;
        rolledBackCompletions: number;
        bookingExchanges: number;
        cashPayments: number;
        averageCompletionTime?: number;
        blockchainSuccessRate: number;
    }> {
        const client = await this.pool.connect();

        try {
            const { dateFrom, dateTo, userId } = options;

            logger.debug('Getting completion statistics', { dateFrom, dateTo, userId });

            // Build WHERE clause
            const conditions: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (dateFrom) {
                conditions.push(`completed_at >= $${paramIndex}`);
                values.push(dateFrom);
                paramIndex++;
            }

            if (dateTo) {
                conditions.push(`completed_at <= $${paramIndex}`);
                values.push(dateTo);
                paramIndex++;
            }

            if (userId) {
                conditions.push(`initiated_by = $${paramIndex}`);
                values.push(userId);
                paramIndex++;
            }

            const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

            const query = `
                SELECT 
                    COUNT(*) as total_completions,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_completions,
                    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_completions,
                    COUNT(CASE WHEN status = 'rolled_back' THEN 1 END) as rolled_back_completions,
                    COUNT(CASE WHEN completion_type = 'booking_exchange' THEN 1 END) as booking_exchanges,
                    COUNT(CASE WHEN completion_type = 'cash_payment' THEN 1 END) as cash_payments,
                    COUNT(CASE WHEN blockchain_transaction_id IS NOT NULL THEN 1 END) as blockchain_successes,
                    AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_completion_time_seconds
                FROM swap_completion_audits 
                ${whereClause}
            `;

            const result = await client.query(query, values);
            const stats = result.rows[0];

            const totalCompletions = parseInt(stats.total_completions);
            const blockchainSuccesses = parseInt(stats.blockchain_successes);
            const blockchainSuccessRate = totalCompletions > 0 ? (blockchainSuccesses / totalCompletions) * 100 : 0;

            const statistics = {
                totalCompletions,
                successfulCompletions: parseInt(stats.successful_completions),
                failedCompletions: parseInt(stats.failed_completions),
                rolledBackCompletions: parseInt(stats.rolled_back_completions),
                bookingExchanges: parseInt(stats.booking_exchanges),
                cashPayments: parseInt(stats.cash_payments),
                averageCompletionTime: stats.avg_completion_time_seconds ? parseFloat(stats.avg_completion_time_seconds) : undefined,
                blockchainSuccessRate
            };

            logger.debug('Completion statistics retrieved', statistics);

            return statistics;

        } catch (error) {
            logger.error('Failed to get completion statistics', {
                options,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to get completion statistics: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            client.release();
        }
    }

    /**
     * Clean up old completion audit records
     * Removes audit records older than specified retention period
     * 
     * Requirements: 6.4
     */
    async cleanupOldAuditRecords(options: {
        retentionDays: number;
        batchSize?: number;
        dryRun?: boolean;
    }): Promise<{
        deletedCount: number;
        oldestRetainedDate: Date;
        batchesProcessed: number;
    }> {
        const { retentionDays, batchSize = 1000, dryRun = false } = options;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        logger.info('Starting audit record cleanup', {
            retentionDays,
            cutoffDate,
            batchSize,
            dryRun
        });

        let totalDeleted = 0;
        let batchesProcessed = 0;

        try {
            while (true) {
                const client = await this.pool.connect();

                try {
                    // Get count of records to delete in this batch
                    const countQuery = `
                        SELECT COUNT(*) as count
                        FROM swap_completion_audits 
                        WHERE created_at < $1
                        LIMIT $2
                    `;

                    const countResult = await client.query(countQuery, [cutoffDate, batchSize]);
                    const batchCount = parseInt(countResult.rows[0].count);

                    if (batchCount === 0) {
                        break; // No more records to delete
                    }

                    if (dryRun) {
                        logger.info('Dry run: would delete batch', {
                            batchCount,
                            batchNumber: batchesProcessed + 1
                        });
                        totalDeleted += batchCount;
                        break; // In dry run, just count one batch
                    }

                    // Delete batch of old records
                    const deleteQuery = `
                        DELETE FROM swap_completion_audits 
                        WHERE id IN (
                            SELECT id 
                            FROM swap_completion_audits 
                            WHERE created_at < $1
                            ORDER BY created_at ASC
                            LIMIT $2
                        )
                    `;

                    const deleteResult = await client.query(deleteQuery, [cutoffDate, batchSize]);
                    const deletedInBatch = deleteResult.rowCount || 0;

                    totalDeleted += deletedInBatch;
                    batchesProcessed++;

                    logger.debug('Deleted audit record batch', {
                        batchNumber: batchesProcessed,
                        deletedInBatch,
                        totalDeleted
                    });

                    // If we deleted fewer records than the batch size, we're done
                    if (deletedInBatch < batchSize) {
                        break;
                    }

                } finally {
                    client.release();
                }

                // Small delay between batches to avoid overwhelming the database
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const result = {
                deletedCount: totalDeleted,
                oldestRetainedDate: cutoffDate,
                batchesProcessed
            };

            logger.info('Audit record cleanup completed', {
                ...result,
                dryRun
            });

            return result;

        } catch (error) {
            logger.error('Failed to cleanup old audit records', {
                retentionDays,
                cutoffDate,
                totalDeleted,
                batchesProcessed,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to cleanup audit records: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Get audit records for specific entities
     * Retrieves audit trail for swaps or bookings involved in completions
     * 
     * Requirements: 6.2, 6.3
     */
    async getAuditRecordsForEntities(options: {
        swapIds?: string[];
        bookingIds?: string[];
        limit?: number;
        offset?: number;
    }): Promise<{
        records: SwapCompletionAudit[];
        totalCount: number;
    }> {
        const { swapIds, bookingIds, limit = 50, offset = 0 } = options;

        if (!swapIds?.length && !bookingIds?.length) {
            return { records: [], totalCount: 0 };
        }

        const client = await this.pool.connect();

        try {
            logger.debug('Getting audit records for entities', {
                swapIds: swapIds?.length || 0,
                bookingIds: bookingIds?.length || 0,
                limit,
                offset
            });

            const conditions: string[] = [];
            const values: any[] = [];
            let paramIndex = 1;

            if (swapIds?.length) {
                conditions.push(`affected_swaps && $${paramIndex}`);
                values.push(swapIds);
                paramIndex++;
            }

            if (bookingIds?.length) {
                conditions.push(`affected_bookings && $${paramIndex}`);
                values.push(bookingIds);
                paramIndex++;
            }

            const whereClause = `WHERE ${conditions.join(' OR ')}`;

            // Get total count
            const countQuery = `
                SELECT COUNT(*) as total
                FROM swap_completion_audits 
                ${whereClause}
            `;

            const countResult = await client.query(countQuery, values);
            const totalCount = parseInt(countResult.rows[0].total);

            // Get records
            const recordsQuery = `
                SELECT 
                    id,
                    proposal_id,
                    completion_type,
                    initiated_by,
                    completed_at,
                    affected_swaps,
                    affected_bookings,
                    database_transaction_id,
                    blockchain_transaction_id,
                    status,
                    error_details,
                    created_at,
                    updated_at
                FROM swap_completion_audits 
                ${whereClause}
                ORDER BY completed_at DESC, created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            values.push(limit, offset);

            const recordsResult = await client.query(recordsQuery, values);
            const records = recordsResult.rows.map(row => this.mapRowToAuditRecord(row, false));

            logger.debug('Retrieved audit records for entities', {
                totalCount,
                returnedCount: records.length
            });

            return { records, totalCount };

        } catch (error) {
            logger.error('Failed to get audit records for entities', {
                options,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to get audit records for entities: ${error instanceof Error ? error.message : String(error)}`
            );
        } finally {
            client.release();
        }
    }

    /**
     * Map database row to SwapCompletionAudit interface
     * Handles JSON parsing and type conversion
     */
    private mapRowToAuditRecord(row: any, includeValidationResults: boolean = true): SwapCompletionAudit {
        return {
            id: row.id,
            proposalId: row.proposal_id,
            completionType: row.completion_type,
            initiatedBy: row.initiated_by,
            completedAt: new Date(row.completed_at),
            affectedSwaps: row.affected_swaps || [],
            affectedBookings: row.affected_bookings || [],
            databaseTransactionId: row.database_transaction_id,
            blockchainTransactionId: row.blockchain_transaction_id || undefined,
            status: row.status,
            errorDetails: row.error_details || undefined,
            preValidationResult: includeValidationResults && row.pre_validation_result
                ? JSON.parse(row.pre_validation_result)
                : undefined,
            postValidationResult: includeValidationResults && row.post_validation_result
                ? JSON.parse(row.post_validation_result)
                : undefined,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at)
        };
    }
}