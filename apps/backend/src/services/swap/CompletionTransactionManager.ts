import { Pool, PoolClient } from 'pg';
import {
    RelatedEntities,
    CompletionTransactionData,
    SwapCompletionErrorCodes,
    SwapCompletionError
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface CompletionTransactionResult {
    updatedSwaps: any[]; // Will be typed as Swap[] when available
    updatedBookings: any[]; // Will be typed as Booking[] when available
    updatedProposal: any; // Will be typed as SwapProposal when available
}

/**
 * CompletionTransactionManager handles atomic database operations for swap completion workflows.
 * Ensures data integrity through proper transaction management and rollback capabilities.
 * 
 * Requirements: 1.1, 1.2, 4.1, 4.2
 */
export class CompletionTransactionManager {
    constructor(public readonly pool: Pool) { }

    /**
     * Execute completion transaction with atomic updates to all related entities
     * Updates swaps, bookings, and proposal status in a single transaction
     * 
     * Requirements: 1.1, 1.2, 4.1, 4.2
     */
    async executeCompletionTransaction(
        entities: RelatedEntities,
        transactionData: CompletionTransactionData
    ): Promise<CompletionTransactionResult> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                const transactionId = uuidv4();
                logger.info('Starting completion transaction', {
                    transactionId,
                    proposalId: entities.proposal.id,
                    swapCount: transactionData.swapUpdates.length,
                    bookingCount: transactionData.bookingUpdates.length
                });

                // Step 1: Update swap statuses atomically
                const updatedSwaps = await this.updateSwapStatuses(
                    client,
                    transactionData.swapUpdates,
                    transactionId
                );

                // Step 2: Update booking statuses atomically
                const updatedBookings = await this.updateBookingStatuses(
                    client,
                    transactionData.bookingUpdates,
                    transactionId
                );

                // Step 3: Update proposal status
                const updatedProposal = await this.updateProposalStatus(
                    client,
                    transactionData.proposalUpdate
                );

                // Note: Audit record creation is now handled by SwapCompletionAuditService
                // in the SwapCompletionOrchestrator before transaction execution

                logger.info('Completion transaction completed successfully', {
                    transactionId,
                    proposalId: entities.proposal.id,
                    updatedSwaps: updatedSwaps.length,
                    updatedBookings: updatedBookings.length
                });

                return {
                    updatedSwaps,
                    updatedBookings,
                    updatedProposal
                };
            } catch (error) {
                logger.error('Completion transaction failed', {
                    error: error instanceof Error ? error.message : String(error),
                    proposalId: entities.proposal.id
                });
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                    `Completion transaction failed: ${error instanceof Error ? error.message : String(error)}`,
                    [entities.proposal.id]
                );
            }
        });
    }

    /**
     * Update swap statuses atomically with completion tracking
     * 
     * Requirements: 1.1, 4.1
     */
    async updateSwapStatuses(
        client: PoolClient,
        swapUpdates: CompletionTransactionData['swapUpdates'],
        transactionId: string
    ): Promise<any[]> {
        const updatedSwaps: any[] = [];

        for (const update of swapUpdates) {
            const query = `
                UPDATE swaps 
                SET 
                    status = $2,
                    completed_at = $3,
                    completion_transaction_id = $4,
                    blockchain_completion_id = $5,
                    related_swap_completions = $6,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING 
                    id,
                    user_id,
                    booking_id,
                    status,
                    swap_type,
                    cash_offer_amount,
                    cash_offer_currency,
                    completed_at,
                    completion_transaction_id,
                    blockchain_completion_id,
                    related_swap_completions,
                    created_at,
                    updated_at
            `;

            // Get related swap IDs for this transaction (excluding current swap)
            const relatedSwapIds = swapUpdates
                .filter(s => s.swapId !== update.swapId)
                .map(s => s.swapId);

            const values = [
                update.swapId,
                update.status,
                update.completedAt,
                transactionId,
                update.blockchainTransactionId || null,
                relatedSwapIds
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                    `Failed to update swap: ${update.swapId}`,
                    [update.swapId]
                );
            }

            updatedSwaps.push(result.rows[0]);
        }

        logger.debug('Updated swap statuses', {
            count: updatedSwaps.length,
            transactionId,
            swapIds: updatedSwaps.map(s => s.id)
        });

        return updatedSwaps;
    }

    /**
     * Update booking statuses atomically with swap completion tracking
     * 
     * Requirements: 1.1, 4.1
     */
    async updateBookingStatuses(
        client: PoolClient,
        bookingUpdates: CompletionTransactionData['bookingUpdates'],
        transactionId: string
    ): Promise<any[]> {
        const updatedBookings: any[] = [];

        for (const update of bookingUpdates) {
            // Store original owner before potential ownership transfer
            const originalOwnerQuery = `
                SELECT user_id FROM bookings WHERE id = $1
            `;
            const originalOwnerResult = await client.query(originalOwnerQuery, [update.bookingId]);
            const originalOwnerId = originalOwnerResult.rows[0]?.user_id;

            const query = `
                UPDATE bookings 
                SET 
                    status = $2,
                    swapped_at = $3,
                    swap_transaction_id = $4,
                    original_owner_id = $5,
                    user_id = $6,
                    related_booking_swaps = $7,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING 
                    id,
                    user_id,
                    property_id,
                    check_in_date,
                    check_out_date,
                    status,
                    swapped_at,
                    swap_transaction_id,
                    original_owner_id,
                    related_booking_swaps,
                    created_at,
                    updated_at
            `;

            // Get related booking IDs for this transaction (excluding current booking)
            const relatedBookingIds = bookingUpdates
                .filter(b => b.bookingId !== update.bookingId)
                .map(b => b.bookingId);

            const values = [
                update.bookingId,
                update.status,
                update.swappedAt,
                transactionId,
                originalOwnerId, // Store original owner
                update.newOwnerId || originalOwnerId, // Use new owner if provided, otherwise keep original
                relatedBookingIds
            ];

            const result = await client.query(query, values);

            if (result.rows.length === 0) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                    `Failed to update booking: ${update.bookingId}`,
                    [update.bookingId]
                );
            }

            updatedBookings.push(result.rows[0]);
        }

        logger.debug('Updated booking statuses', {
            count: updatedBookings.length,
            transactionId,
            bookingIds: updatedBookings.map(b => b.id)
        });

        return updatedBookings;
    }

    /**
     * Update proposal status to accepted with completion tracking
     * 
     * Requirements: 1.1, 4.1
     */
    async updateProposalStatus(
        client: PoolClient,
        proposalUpdate: CompletionTransactionData['proposalUpdate']
    ): Promise<any> {
        const query = `
            UPDATE swap_proposals 
            SET 
                status = $2,
                responded_at = $3,
                responded_by = $4,
                updated_at = NOW()
            WHERE id = $1
            RETURNING 
                id,
                source_swap_id,
                target_swap_id,
                proposer_id,
                target_user_id,
                proposal_type,
                status,
                cash_offer_amount,
                cash_offer_currency,
                responded_at,
                responded_by,
                rejection_reason,
                blockchain_proposal_transaction_id,
                blockchain_response_transaction_id,
                message,
                conditions,
                expires_at,
                completion_audit_id,
                created_at,
                updated_at
        `;

        const values = [
            proposalUpdate.proposalId,
            proposalUpdate.status,
            proposalUpdate.respondedAt,
            proposalUpdate.respondedBy
        ];

        const result = await client.query(query, values);

        if (result.rows.length === 0) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Failed to update proposal: ${proposalUpdate.proposalId}`,
                [proposalUpdate.proposalId]
            );
        }

        logger.debug('Updated proposal status', {
            proposalId: proposalUpdate.proposalId,
            status: proposalUpdate.status
        });

        return result.rows[0];
    }

    /**
     * Rollback completion transaction in case of failure
     * Reverts all entity states to their original values
     * 
     * Requirements: 4.1, 4.2
     */
    async rollbackCompletionTransaction(
        transactionId: string,
        originalStates: RelatedEntities
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            try {
                logger.info('Starting completion rollback', {
                    transactionId,
                    proposalId: originalStates.proposal.id
                });

                // Step 1: Revert swap statuses
                await this.revertSwapStatuses(client, originalStates, transactionId);

                // Step 2: Revert booking statuses
                await this.revertBookingStatuses(client, originalStates, transactionId);

                // Step 3: Revert proposal status
                await this.revertProposalStatus(client, originalStates.proposal);

                // Step 4: Update audit record to rolled_back status
                await this.updateAuditRecordStatus(
                    client,
                    originalStates.proposal.id,
                    'rolled_back',
                    'Transaction rolled back due to failure'
                );

                logger.info('Completion rollback completed successfully', {
                    transactionId,
                    proposalId: originalStates.proposal.id
                });
            } catch (error) {
                logger.error('Completion rollback failed', {
                    error: error instanceof Error ? error.message : String(error),
                    transactionId,
                    proposalId: originalStates.proposal.id
                });
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.ROLLBACK_FAILED,
                    `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
                    [originalStates.proposal.id]
                );
            }
        });
    }

    /**
     * Validate completion transaction data before execution
     * Ensures all required data is present and valid
     * 
     * Requirements: 4.1
     */
    validateCompletionTransactionData(
        entities: RelatedEntities,
        transactionData: CompletionTransactionData
    ): void {
        // Validate entities
        if (!entities.proposal || !entities.sourceSwap || !entities.sourceBooking) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES,
                'Missing required entities for completion transaction',
                [entities.proposal?.id].filter(Boolean)
            );
        }

        // Validate transaction data
        if (!transactionData.swapUpdates || transactionData.swapUpdates.length === 0) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                'No swap updates provided for completion transaction',
                [entities.proposal.id]
            );
        }

        if (!transactionData.bookingUpdates || transactionData.bookingUpdates.length === 0) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                'No booking updates provided for completion transaction',
                [entities.proposal.id]
            );
        }

        if (!transactionData.proposalUpdate) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                'No proposal update provided for completion transaction',
                [entities.proposal.id]
            );
        }

        // Validate proposal type consistency
        const isBookingExchange = entities.targetSwap && entities.targetBooking;
        const expectedSwapCount = isBookingExchange ? 2 : 1;
        const expectedBookingCount = isBookingExchange ? 2 : 1;

        if (transactionData.swapUpdates.length !== expectedSwapCount) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                `Expected ${expectedSwapCount} swap updates, got ${transactionData.swapUpdates.length}`,
                [entities.proposal.id]
            );
        }

        if (transactionData.bookingUpdates.length !== expectedBookingCount) {
            throw new SwapCompletionError(
                SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                `Expected ${expectedBookingCount} booking updates, got ${transactionData.bookingUpdates.length}`,
                [entities.proposal.id]
            );
        }

        logger.debug('Completion transaction data validation passed', {
            proposalId: entities.proposal.id,
            swapUpdates: transactionData.swapUpdates.length,
            bookingUpdates: transactionData.bookingUpdates.length,
            isBookingExchange
        });
    }

    /**
     * Get completion audit record by proposal ID
     * Used for tracking completion status and debugging
     * 
     * Requirements: 4.1
     */
    async getCompletionAuditRecord(proposalId: string): Promise<any | null> {
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

            return result.rows[0];
        } finally {
            client.release();
        }
    }

    /**
     * Update blockchain transaction ID in completion audit record
     * Called after blockchain transaction is successfully recorded
     * 
     * Requirements: 4.1, 7.4
     */
    async updateCompletionBlockchainTransaction(
        proposalId: string,
        blockchainTransactionId: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            // Update audit record
            await client.query(`
                UPDATE swap_completion_audits 
                SET blockchain_transaction_id = $2,
                    updated_at = NOW()
                WHERE proposal_id = $1
            `, [proposalId, blockchainTransactionId]);

            // Update related swaps with blockchain completion ID
            await client.query(`
                UPDATE swaps 
                SET blockchain_completion_id = $2,
                    updated_at = NOW()
                WHERE id IN (
                    SELECT UNNEST(affected_swaps) 
                    FROM swap_completion_audits 
                    WHERE proposal_id = $1
                )
            `, [proposalId, blockchainTransactionId]);

            logger.debug('Updated completion blockchain transaction ID', {
                proposalId,
                blockchainTransactionId
            });
        });
    }

    /**
     * Update completion audit record with blockchain failure details
     * Called when blockchain recording fails after all retries
     * 
     * Requirements: 7.3, 7.4
     */
    async updateCompletionBlockchainFailure(
        proposalId: string,
        errorMessage: string
    ): Promise<void> {
        return await this.executeInTransaction(async (client: PoolClient) => {
            // Update audit record with failure details
            await client.query(`
                UPDATE swap_completion_audits 
                SET 
                    status = 'completed',
                    error_details = $2,
                    updated_at = NOW()
                WHERE proposal_id = $1
            `, [proposalId, `Blockchain recording failed: ${errorMessage}`]);

            logger.debug('Updated completion audit with blockchain failure', {
                proposalId,
                errorMessage
            });
        });
    }

    // Private helper methods
    private async executeInTransaction<T>(
        operation: (client: PoolClient) => Promise<T>
    ): Promise<T> {
        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');

            const result = await operation(client);

            await client.query('COMMIT');
            logger.debug('Transaction committed successfully');
            return result;

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Transaction rolled back due to error', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;

        } finally {
            client.release();
        }
    }



    private async revertSwapStatuses(
        client: PoolClient,
        originalStates: RelatedEntities,
        transactionId: string
    ): Promise<void> {
        const swapsToRevert = [originalStates.sourceSwap];
        if (originalStates.targetSwap) {
            swapsToRevert.push(originalStates.targetSwap);
        }

        for (const swap of swapsToRevert) {
            const query = `
                UPDATE swaps 
                SET 
                    status = $2,
                    completed_at = NULL,
                    completion_transaction_id = NULL,
                    blockchain_completion_id = NULL,
                    related_swap_completions = '{}',
                    updated_at = NOW()
                WHERE id = $1
            `;

            await client.query(query, [swap.id, swap.status]);
        }

        logger.debug('Reverted swap statuses', {
            transactionId,
            swapIds: swapsToRevert.map(s => s.id)
        });
    }

    private async revertBookingStatuses(
        client: PoolClient,
        originalStates: RelatedEntities,
        transactionId: string
    ): Promise<void> {
        const bookingsToRevert = [originalStates.sourceBooking];
        if (originalStates.targetBooking) {
            bookingsToRevert.push(originalStates.targetBooking);
        }

        for (const booking of bookingsToRevert) {
            const query = `
                UPDATE bookings 
                SET 
                    status = $2,
                    swapped_at = NULL,
                    swap_transaction_id = NULL,
                    original_owner_id = NULL,
                    user_id = $3,
                    related_booking_swaps = '{}',
                    updated_at = NOW()
                WHERE id = $1
            `;

            await client.query(query, [booking.id, booking.status, booking.userId]);
        }

        logger.debug('Reverted booking statuses', {
            transactionId,
            bookingIds: bookingsToRevert.map(b => b.id)
        });
    }

    private async revertProposalStatus(
        client: PoolClient,
        originalProposal: any
    ): Promise<void> {
        const query = `
            UPDATE swap_proposals 
            SET 
                status = $2,
                responded_at = NULL,
                responded_by = NULL,
                completion_audit_id = NULL,
                updated_at = NOW()
            WHERE id = $1
        `;

        await client.query(query, [originalProposal.id, originalProposal.status]);

        logger.debug('Reverted proposal status', {
            proposalId: originalProposal.id,
            originalStatus: originalProposal.status
        });
    }

    private async updateAuditRecordStatus(
        client: PoolClient,
        proposalId: string,
        status: 'failed' | 'rolled_back',
        errorDetails?: string
    ): Promise<void> {
        const query = `
            UPDATE swap_completion_audits 
            SET 
                status = $2,
                error_details = $3,
                updated_at = NOW()
            WHERE proposal_id = $1
        `;

        await client.query(query, [proposalId, status, errorDetails || null]);

        logger.debug('Updated audit record status', {
            proposalId,
            status,
            hasErrorDetails: !!errorDetails
        });
    }
}