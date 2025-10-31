import { Pool, PoolClient } from 'pg';
import {
    RelatedEntities,
    RollbackResult,
    SwapCompletionResult,
    SwapCompletionErrorCodes,
    SwapCompletionError
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * CompletionRollbackManager handles failure recovery for swap completion workflows.
 * Provides comprehensive rollback capabilities for database changes, blockchain transactions,
 * and entity state restoration when completion operations fail.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.5
 */
export class CompletionRollbackManager {
    constructor(private readonly pool: Pool) { }

    /**
     * Rollback complete completion workflow including database and blockchain changes
     * Coordinates all rollback operations and ensures system consistency
     * 
     * Requirements: 4.1, 4.2, 4.3, 4.5
     */
    async rollbackCompletionWorkflow(
        auditId: string,
        originalStates: RelatedEntities,
        partialResults?: Partial<SwapCompletionResult>
    ): Promise<RollbackResult> {
        const rollbackId = uuidv4();
        const restoredEntities: string[] = [];
        const failedRestorations: string[] = [];
        let requiresManualIntervention = false;
        let errorDetails: string | undefined;

        logger.info('Starting completion workflow rollback', {
            rollbackId,
            auditId,
            proposalId: originalStates.proposal.id,
            hasPartialResults: !!partialResults
        });

        try {
            // Step 1: Rollback database changes
            const databaseRollbackResult = await this.rollbackDatabaseChanges(
                rollbackId,
                originalStates
            );

            restoredEntities.push(...databaseRollbackResult.restoredEntities);
            failedRestorations.push(...databaseRollbackResult.failedRestorations);

            if (!databaseRollbackResult.success) {
                requiresManualIntervention = true;
                errorDetails = `Database rollback failed: ${databaseRollbackResult.errorDetails}`;
            }

            // Step 2: Handle blockchain transaction rollback if applicable
            if (partialResults?.blockchainTransaction?.transactionId) {
                const blockchainRollbackResult = await this.rollbackBlockchainTransaction(
                    partialResults.blockchainTransaction.transactionId
                );

                if (!blockchainRollbackResult.success) {
                    requiresManualIntervention = true;
                    const blockchainError = `Blockchain rollback failed: ${blockchainRollbackResult.errorDetails}`;
                    errorDetails = errorDetails ? `${errorDetails}; ${blockchainError}` : blockchainError;
                } else {
                    restoredEntities.push(`blockchain:${partialResults.blockchainTransaction.transactionId}`);
                }
            }

            // Step 3: Restore entity states to ensure consistency
            const entityRestoreResult = await this.restoreEntityStates(originalStates);

            restoredEntities.push(...entityRestoreResult.restoredEntities);
            failedRestorations.push(...entityRestoreResult.failedRestorations);

            if (!entityRestoreResult.success) {
                requiresManualIntervention = true;
                const entityError = `Entity restoration failed: ${entityRestoreResult.errorDetails}`;
                errorDetails = errorDetails ? `${errorDetails}; ${entityError}` : entityError;
            }

            // Step 4: Update audit record with rollback status
            await this.updateAuditRecordRollbackStatus(
                auditId,
                rollbackId,
                restoredEntities,
                failedRestorations,
                requiresManualIntervention,
                errorDetails
            );

            const success = failedRestorations.length === 0 && !requiresManualIntervention;

            logger.info('Completion workflow rollback completed', {
                rollbackId,
                auditId,
                success,
                restoredEntitiesCount: restoredEntities.length,
                failedRestorationsCount: failedRestorations.length,
                requiresManualIntervention
            });

            return {
                success,
                restoredEntities,
                failedRestorations,
                requiresManualIntervention,
                errorDetails
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Completion workflow rollback failed', {
                rollbackId,
                auditId,
                error: errorMessage
            });

            // Try to update audit record with failure status
            try {
                await this.updateAuditRecordRollbackStatus(
                    auditId,
                    rollbackId,
                    restoredEntities,
                    failedRestorations,
                    true,
                    `Rollback process failed: ${errorMessage}`
                );
            } catch (auditError) {
                logger.error('Failed to update audit record after rollback failure', {
                    rollbackId,
                    auditId,
                    auditError: auditError instanceof Error ? auditError.message : String(auditError)
                });
            }

            return {
                success: false,
                restoredEntities,
                failedRestorations: [...failedRestorations, ...Object.keys(originalStates).filter(key => key !== 'proposal')],
                requiresManualIntervention: true,
                errorDetails: `Rollback process failed: ${errorMessage}`
            };
        }
    }

    /**
     * Rollback database changes by restoring original entity states
     * Handles atomic restoration of swaps, bookings, and proposals
     * 
     * Requirements: 4.1, 4.2
     */
    async rollbackDatabaseChanges(
        rollbackId: string,
        originalStates: RelatedEntities
    ): Promise<RollbackResult> {
        const restoredEntities: string[] = [];
        const failedRestorations: string[] = [];

        logger.info('Starting database rollback', {
            rollbackId,
            proposalId: originalStates.proposal.id
        });

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');
            await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');

            // Step 1: Restore swap statuses
            const swapRollbackResult = await this.rollbackSwapStatuses(
                client,
                originalStates,
                rollbackId
            );
            restoredEntities.push(...swapRollbackResult.restoredEntities);
            failedRestorations.push(...swapRollbackResult.failedRestorations);

            // Step 2: Restore booking statuses
            const bookingRollbackResult = await this.rollbackBookingStatuses(
                client,
                originalStates,
                rollbackId
            );
            restoredEntities.push(...bookingRollbackResult.restoredEntities);
            failedRestorations.push(...bookingRollbackResult.failedRestorations);

            // Step 3: Restore proposal status
            const proposalRollbackResult = await this.rollbackProposalStatus(
                client,
                originalStates.proposal,
                rollbackId
            );
            restoredEntities.push(...proposalRollbackResult.restoredEntities);
            failedRestorations.push(...proposalRollbackResult.failedRestorations);

            // Step 4: Clean up completion audit records
            await this.cleanupCompletionAuditRecords(client, originalStates.proposal.id);

            await client.query('COMMIT');

            const success = failedRestorations.length === 0;

            logger.info('Database rollback completed', {
                rollbackId,
                success,
                restoredEntitiesCount: restoredEntities.length,
                failedRestorationsCount: failedRestorations.length
            });

            return {
                success,
                restoredEntities,
                failedRestorations,
                requiresManualIntervention: !success,
                errorDetails: failedRestorations.length > 0 ? `Failed to restore: ${failedRestorations.join(', ')}` : undefined
            };

        } catch (error) {
            await client.query('ROLLBACK');
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error('Database rollback failed', {
                rollbackId,
                error: errorMessage
            });

            // Mark all entities as failed restoration
            const allEntityIds = [
                originalStates.sourceSwap.id,
                originalStates.sourceBooking.id,
                originalStates.proposal.id
            ];

            if (originalStates.targetSwap) {
                allEntityIds.push(originalStates.targetSwap.id);
            }
            if (originalStates.targetBooking) {
                allEntityIds.push(originalStates.targetBooking.id);
            }

            return {
                success: false,
                restoredEntities,
                failedRestorations: allEntityIds,
                requiresManualIntervention: true,
                errorDetails: `Database rollback transaction failed: ${errorMessage}`
            };

        } finally {
            client.release();
        }
    }

    /**
     * Handle blockchain transaction rollback
     * Note: Blockchain transactions are immutable, so this logs the rollback intent
     * and marks the transaction as rolled back in our system
     * 
     * Requirements: 4.3
     */
    async rollbackBlockchainTransaction(
        blockchainTransactionId: string
    ): Promise<RollbackResult> {
        logger.info('Starting blockchain transaction rollback', {
            blockchainTransactionId
        });

        try {
            // Since blockchain transactions are immutable, we can't actually reverse them
            // Instead, we record a rollback transaction that indicates the original was rolled back
            const rollbackTransactionData = {
                type: 'COMPLETION_ROLLBACK',
                originalTransactionId: blockchainTransactionId,
                rollbackTimestamp: new Date().toISOString(),
                reason: 'Completion workflow rollback'
            };

            // Log the rollback intent (in a real implementation, this might submit a rollback record to blockchain)
            logger.info('Blockchain rollback recorded', {
                blockchainTransactionId,
                rollbackData: rollbackTransactionData
            });

            // Update our database to mark the blockchain transaction as rolled back
            const client = await this.pool.connect();
            try {
                await client.query(`
                    UPDATE swap_completion_audits 
                    SET 
                        blockchain_transaction_id = NULL,
                        error_details = COALESCE(error_details, '') || '; Blockchain transaction rolled back: ' || $2,
                        updated_at = NOW()
                    WHERE blockchain_transaction_id = $1
                `, [blockchainTransactionId, JSON.stringify(rollbackTransactionData)]);

                // Also clear blockchain completion IDs from swaps
                await client.query(`
                    UPDATE swaps 
                    SET 
                        blockchain_completion_id = NULL,
                        updated_at = NOW()
                    WHERE blockchain_completion_id = $1
                `, [blockchainTransactionId]);

            } finally {
                client.release();
            }

            return {
                success: true,
                restoredEntities: [`blockchain:${blockchainTransactionId}`],
                failedRestorations: [],
                requiresManualIntervention: false
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Blockchain rollback failed', {
                blockchainTransactionId,
                error: errorMessage
            });

            return {
                success: false,
                restoredEntities: [],
                failedRestorations: [`blockchain:${blockchainTransactionId}`],
                requiresManualIntervention: true,
                errorDetails: `Blockchain rollback failed: ${errorMessage}`
            };
        }
    }

    /**
     * Restore entity states to their original values
     * Ensures all entities are returned to pre-completion state
     * 
     * Requirements: 4.2, 4.5
     */
    async restoreEntityStates(originalStates: RelatedEntities): Promise<RollbackResult> {
        const restoredEntities: string[] = [];
        const failedRestorations: string[] = [];

        logger.info('Starting entity state restoration', {
            proposalId: originalStates.proposal.id
        });

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            // Step 1: Verify and restore source swap state
            const sourceSwapResult = await this.restoreSwapState(
                client,
                originalStates.sourceSwap
            );
            if (sourceSwapResult.success) {
                restoredEntities.push(originalStates.sourceSwap.id);
            } else {
                failedRestorations.push(originalStates.sourceSwap.id);
            }

            // Step 2: Verify and restore source booking state
            const sourceBookingResult = await this.restoreBookingState(
                client,
                originalStates.sourceBooking
            );
            if (sourceBookingResult.success) {
                restoredEntities.push(originalStates.sourceBooking.id);
            } else {
                failedRestorations.push(originalStates.sourceBooking.id);
            }

            // Step 3: Restore target entities if present
            if (originalStates.targetSwap) {
                const targetSwapResult = await this.restoreSwapState(
                    client,
                    originalStates.targetSwap
                );
                if (targetSwapResult.success) {
                    restoredEntities.push(originalStates.targetSwap.id);
                } else {
                    failedRestorations.push(originalStates.targetSwap.id);
                }
            }

            if (originalStates.targetBooking) {
                const targetBookingResult = await this.restoreBookingState(
                    client,
                    originalStates.targetBooking
                );
                if (targetBookingResult.success) {
                    restoredEntities.push(originalStates.targetBooking.id);
                } else {
                    failedRestorations.push(originalStates.targetBooking.id);
                }
            }

            // Step 4: Restore proposal state
            const proposalResult = await this.restoreProposalState(
                client,
                originalStates.proposal
            );
            if (proposalResult.success) {
                restoredEntities.push(originalStates.proposal.id);
            } else {
                failedRestorations.push(originalStates.proposal.id);
            }

            await client.query('COMMIT');

            const success = failedRestorations.length === 0;

            logger.info('Entity state restoration completed', {
                success,
                restoredEntitiesCount: restoredEntities.length,
                failedRestorationsCount: failedRestorations.length
            });

            return {
                success,
                restoredEntities,
                failedRestorations,
                requiresManualIntervention: !success,
                errorDetails: failedRestorations.length > 0 ? `Failed to restore entities: ${failedRestorations.join(', ')}` : undefined
            };

        } catch (error) {
            await client.query('ROLLBACK');
            const errorMessage = error instanceof Error ? error.message : String(error);

            logger.error('Entity state restoration failed', {
                error: errorMessage
            });

            return {
                success: false,
                restoredEntities,
                failedRestorations: [
                    originalStates.sourceSwap.id,
                    originalStates.sourceBooking.id,
                    originalStates.proposal.id,
                    ...(originalStates.targetSwap ? [originalStates.targetSwap.id] : []),
                    ...(originalStates.targetBooking ? [originalStates.targetBooking.id] : [])
                ],
                requiresManualIntervention: true,
                errorDetails: `Entity restoration transaction failed: ${errorMessage}`
            };

        } finally {
            client.release();
        }
    }

    // Private helper methods

    /**
     * Rollback swap statuses to their original states
     */
    private async rollbackSwapStatuses(
        client: PoolClient,
        originalStates: RelatedEntities,
        rollbackId: string
    ): Promise<RollbackResult> {
        const restoredEntities: string[] = [];
        const failedRestorations: string[] = [];

        const swapsToRestore = [originalStates.sourceSwap];
        if (originalStates.targetSwap) {
            swapsToRestore.push(originalStates.targetSwap);
        }

        for (const originalSwap of swapsToRestore) {
            try {
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
                    RETURNING id
                `;

                const result = await client.query(query, [originalSwap.id, originalSwap.status]);

                if (result.rows.length > 0) {
                    restoredEntities.push(originalSwap.id);
                    logger.debug('Restored swap status', {
                        rollbackId,
                        swapId: originalSwap.id,
                        restoredStatus: originalSwap.status
                    });
                } else {
                    failedRestorations.push(originalSwap.id);
                    logger.warn('Failed to restore swap status - no rows affected', {
                        rollbackId,
                        swapId: originalSwap.id
                    });
                }

            } catch (error) {
                failedRestorations.push(originalSwap.id);
                logger.error('Failed to restore swap status', {
                    rollbackId,
                    swapId: originalSwap.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return {
            success: failedRestorations.length === 0,
            restoredEntities,
            failedRestorations,
            requiresManualIntervention: failedRestorations.length > 0
        };
    }

    /**
     * Rollback booking statuses to their original states
     */
    private async rollbackBookingStatuses(
        client: PoolClient,
        originalStates: RelatedEntities,
        rollbackId: string
    ): Promise<RollbackResult> {
        const restoredEntities: string[] = [];
        const failedRestorations: string[] = [];

        const bookingsToRestore = [originalStates.sourceBooking];
        if (originalStates.targetBooking) {
            bookingsToRestore.push(originalStates.targetBooking);
        }

        for (const originalBooking of bookingsToRestore) {
            try {
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
                    RETURNING id
                `;

                const result = await client.query(query, [
                    originalBooking.id,
                    originalBooking.status,
                    originalBooking.user_id
                ]);

                if (result.rows.length > 0) {
                    restoredEntities.push(originalBooking.id);
                    logger.debug('Restored booking status', {
                        rollbackId,
                        bookingId: originalBooking.id,
                        restoredStatus: originalBooking.status,
                        restoredOwnerId: originalBooking.user_id
                    });
                } else {
                    failedRestorations.push(originalBooking.id);
                    logger.warn('Failed to restore booking status - no rows affected', {
                        rollbackId,
                        bookingId: originalBooking.id
                    });
                }

            } catch (error) {
                failedRestorations.push(originalBooking.id);
                logger.error('Failed to restore booking status', {
                    rollbackId,
                    bookingId: originalBooking.id,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return {
            success: failedRestorations.length === 0,
            restoredEntities,
            failedRestorations,
            requiresManualIntervention: failedRestorations.length > 0
        };
    }

    /**
     * Rollback proposal status to its original state
     */
    private async rollbackProposalStatus(
        client: PoolClient,
        originalProposal: any,
        rollbackId: string
    ): Promise<RollbackResult> {
        try {
            const query = `
                UPDATE swap_proposals 
                SET 
                    status = $2,
                    responded_at = NULL,
                    responded_by = NULL,
                    completion_audit_id = NULL,
                    updated_at = NOW()
                WHERE id = $1
                RETURNING id
            `;

            const result = await client.query(query, [originalProposal.id, originalProposal.status]);

            if (result.rows.length > 0) {
                logger.debug('Restored proposal status', {
                    rollbackId,
                    proposalId: originalProposal.id,
                    restoredStatus: originalProposal.status
                });

                return {
                    success: true,
                    restoredEntities: [originalProposal.id],
                    failedRestorations: [],
                    requiresManualIntervention: false
                };
            } else {
                logger.warn('Failed to restore proposal status - no rows affected', {
                    rollbackId,
                    proposalId: originalProposal.id
                });

                return {
                    success: false,
                    restoredEntities: [],
                    failedRestorations: [originalProposal.id],
                    requiresManualIntervention: true,
                    errorDetails: 'No rows affected during proposal status restoration'
                };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to restore proposal status', {
                rollbackId,
                proposalId: originalProposal.id,
                error: errorMessage
            });

            return {
                success: false,
                restoredEntities: [],
                failedRestorations: [originalProposal.id],
                requiresManualIntervention: true,
                errorDetails: `Proposal status restoration failed: ${errorMessage}`
            };
        }
    }

    /**
     * Restore individual swap state
     */
    private async restoreSwapState(client: PoolClient, originalSwap: any): Promise<{ success: boolean }> {
        try {
            // Verify current state and restore if needed
            const currentStateQuery = `
                SELECT status, completed_at, completion_transaction_id 
                FROM swaps 
                WHERE id = $1
            `;

            const currentResult = await client.query(currentStateQuery, [originalSwap.id]);

            if (currentResult.rows.length === 0) {
                logger.warn('Swap not found during state restoration', { swapId: originalSwap.id });
                return { success: false };
            }

            const currentState = currentResult.rows[0];

            // Only restore if state has been modified
            if (currentState.status !== originalSwap.status ||
                currentState.completed_at !== null ||
                currentState.completion_transaction_id !== null) {

                const restoreQuery = `
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

                await client.query(restoreQuery, [originalSwap.id, originalSwap.status]);

                logger.debug('Swap state restored', {
                    swapId: originalSwap.id,
                    originalStatus: originalSwap.status,
                    previousStatus: currentState.status
                });
            }

            return { success: true };

        } catch (error) {
            logger.error('Failed to restore swap state', {
                swapId: originalSwap.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return { success: false };
        }
    }

    /**
     * Restore individual booking state
     */
    private async restoreBookingState(client: PoolClient, originalBooking: any): Promise<{ success: boolean }> {
        try {
            // Verify current state and restore if needed
            const currentStateQuery = `
                SELECT status, swapped_at, swap_transaction_id, user_id 
                FROM bookings 
                WHERE id = $1
            `;

            const currentResult = await client.query(currentStateQuery, [originalBooking.id]);

            if (currentResult.rows.length === 0) {
                logger.warn('Booking not found during state restoration', { bookingId: originalBooking.id });
                return { success: false };
            }

            const currentState = currentResult.rows[0];

            // Only restore if state has been modified
            if (currentState.status !== originalBooking.status ||
                currentState.swapped_at !== null ||
                currentState.swap_transaction_id !== null ||
                currentState.user_id !== originalBooking.user_id) {

                const restoreQuery = `
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

                await client.query(restoreQuery, [
                    originalBooking.id,
                    originalBooking.status,
                    originalBooking.user_id
                ]);

                logger.debug('Booking state restored', {
                    bookingId: originalBooking.id,
                    originalStatus: originalBooking.status,
                    originalOwnerId: originalBooking.user_id,
                    previousStatus: currentState.status,
                    previousOwnerId: currentState.user_id
                });
            }

            return { success: true };

        } catch (error) {
            logger.error('Failed to restore booking state', {
                bookingId: originalBooking.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return { success: false };
        }
    }

    /**
     * Restore individual proposal state
     */
    private async restoreProposalState(client: PoolClient, originalProposal: any): Promise<{ success: boolean }> {
        try {
            // Verify current state and restore if needed
            const currentStateQuery = `
                SELECT status, responded_at, responded_by 
                FROM swap_proposals 
                WHERE id = $1
            `;

            const currentResult = await client.query(currentStateQuery, [originalProposal.id]);

            if (currentResult.rows.length === 0) {
                logger.warn('Proposal not found during state restoration', { proposalId: originalProposal.id });
                return { success: false };
            }

            const currentState = currentResult.rows[0];

            // Only restore if state has been modified
            if (currentState.status !== originalProposal.status ||
                currentState.responded_at !== null ||
                currentState.responded_by !== null) {

                const restoreQuery = `
                    UPDATE swap_proposals 
                    SET 
                        status = $2,
                        responded_at = NULL,
                        responded_by = NULL,
                        completion_audit_id = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                `;

                await client.query(restoreQuery, [originalProposal.id, originalProposal.status]);

                logger.debug('Proposal state restored', {
                    proposalId: originalProposal.id,
                    originalStatus: originalProposal.status,
                    previousStatus: currentState.status
                });
            }

            return { success: true };

        } catch (error) {
            logger.error('Failed to restore proposal state', {
                proposalId: originalProposal.id,
                error: error instanceof Error ? error.message : String(error)
            });
            return { success: false };
        }
    }

    /**
     * Clean up completion audit records
     */
    private async cleanupCompletionAuditRecords(client: PoolClient, proposalId: string): Promise<void> {
        try {
            // Mark audit records as rolled back instead of deleting them for audit trail
            await client.query(`
                UPDATE swap_completion_audits 
                SET 
                    status = 'rolled_back',
                    error_details = COALESCE(error_details, '') || '; Completion rolled back',
                    updated_at = NOW()
                WHERE proposal_id = $1 
                AND status IN ('initiated', 'completed', 'failed')
            `, [proposalId]);

            logger.debug('Cleaned up completion audit records', { proposalId });

        } catch (error) {
            logger.error('Failed to cleanup completion audit records', {
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - this is cleanup and shouldn't fail the rollback
        }
    }

    /**
     * Update audit record with rollback status and details
     */
    private async updateAuditRecordRollbackStatus(
        auditId: string,
        rollbackId: string,
        restoredEntities: string[],
        failedRestorations: string[],
        requiresManualIntervention: boolean,
        errorDetails?: string
    ): Promise<void> {
        const client = await this.pool.connect();

        try {
            const rollbackDetails = {
                rollbackId,
                restoredEntities,
                failedRestorations,
                requiresManualIntervention,
                rollbackTimestamp: new Date().toISOString()
            };

            await client.query(`
                UPDATE swap_completion_audits 
                SET 
                    status = 'rolled_back',
                    error_details = COALESCE(error_details, '') || $2,
                    updated_at = NOW()
                WHERE id = $1
            `, [
                auditId,
                `; Rollback completed: ${JSON.stringify(rollbackDetails)}${errorDetails ? `; Error: ${errorDetails}` : ''}`
            ]);

            logger.debug('Updated audit record with rollback status', {
                auditId,
                rollbackId,
                requiresManualIntervention
            });

        } catch (error) {
            logger.error('Failed to update audit record rollback status', {
                auditId,
                rollbackId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw - this is audit update and shouldn't fail the rollback
        } finally {
            client.release();
        }
    }
}