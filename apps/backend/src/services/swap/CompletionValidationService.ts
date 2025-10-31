import { Pool, PoolClient } from 'pg';
import {
    RelatedEntities,
    CompletionValidationResult,
    CorrectionAttempt,
    CompletedSwapInfo,
    CompletedBookingInfo,
    SwapCompletionErrorCodes,
    SwapCompletionError
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';

/**
 * CompletionValidationService handles consistency checks and validation for swap completion workflows.
 * Ensures data integrity before and after completion operations and provides automatic correction capabilities.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */
export class CompletionValidationService {
    constructor(public readonly pool: Pool) { }

    /**
     * Validate entities before completion processing
     * Checks eligibility and consistency of all related entities
     * 
     * Requirements: 5.1, 5.2
     */
    async validatePreCompletion(entities: RelatedEntities): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        try {
            logger.debug('Starting pre-completion validation', {
                proposalId: entities.proposal.id,
                sourceSwapId: entities.sourceSwap.id,
                targetSwapId: entities.targetSwap?.id
            });

            // 1. Validate proposal eligibility
            const proposalValidation = await this.validateProposalEligibility(entities.proposal);
            errors.push(...proposalValidation.errors);
            warnings.push(...proposalValidation.warnings);
            if (!proposalValidation.isValid) {
                inconsistentEntities.push(entities.proposal.id);
            }

            // 2. Validate source swap eligibility
            const sourceSwapValidation = await this.validateSwapEligibility(entities.sourceSwap, 'source');
            errors.push(...sourceSwapValidation.errors);
            warnings.push(...sourceSwapValidation.warnings);
            if (!sourceSwapValidation.isValid) {
                inconsistentEntities.push(entities.sourceSwap.id);
            }

            // 3. Validate source booking eligibility
            const sourceBookingValidation = await this.validateBookingEligibility(entities.sourceBooking, 'source');
            errors.push(...sourceBookingValidation.errors);
            warnings.push(...sourceBookingValidation.warnings);
            if (!sourceBookingValidation.isValid) {
                inconsistentEntities.push(entities.sourceBooking.id);
            }

            // 4. Validate target entities if present (booking exchange)
            if (entities.targetSwap && entities.targetBooking) {
                const targetSwapValidation = await this.validateSwapEligibility(entities.targetSwap, 'target');
                errors.push(...targetSwapValidation.errors);
                warnings.push(...targetSwapValidation.warnings);
                if (!targetSwapValidation.isValid) {
                    inconsistentEntities.push(entities.targetSwap.id);
                }

                const targetBookingValidation = await this.validateBookingEligibility(entities.targetBooking, 'target');
                errors.push(...targetBookingValidation.errors);
                warnings.push(...targetBookingValidation.warnings);
                if (!targetBookingValidation.isValid) {
                    inconsistentEntities.push(entities.targetBooking.id);
                }

                // 5. Validate entity relationships for booking exchange
                const relationshipValidation = await this.validateEntityRelationships(entities);
                errors.push(...relationshipValidation.errors);
                warnings.push(...relationshipValidation.warnings);
                inconsistentEntities.push(...relationshipValidation.inconsistentEntities);
            }

            // 6. Validate business rules
            const businessRulesValidation = await this.validateBusinessRules(entities);
            errors.push(...businessRulesValidation.errors);
            warnings.push(...businessRulesValidation.warnings);
            inconsistentEntities.push(...businessRulesValidation.inconsistentEntities);

            const isValid = errors.length === 0;

            logger.debug('Pre-completion validation completed', {
                proposalId: entities.proposal.id,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length,
                inconsistentEntityCount: inconsistentEntities.length
            });

            return {
                isValid,
                errors,
                warnings,
                inconsistentEntities
            };

        } catch (error) {
            logger.error('Pre-completion validation failed', {
                error: error instanceof Error ? error.message : String(error),
                proposalId: entities.proposal.id
            });

            return {
                isValid: false,
                errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
                warnings,
                inconsistentEntities
            };
        }
    }

    /**
     * Validate entities after completion processing
     * Verifies consistency of all updated entities
     * 
     * Requirements: 5.2, 5.3
     */
    async validatePostCompletion(
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        proposal: any
    ): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];
        const correctionAttempts: CorrectionAttempt[] = [];

        try {
            logger.debug('Starting post-completion validation', {
                proposalId: proposal.id,
                completedSwapCount: completedSwaps.length,
                updatedBookingCount: updatedBookings.length
            });

            // 1. Validate swap completion consistency
            const swapValidation = await this.validateSwapCompletionConsistency(completedSwaps);
            errors.push(...swapValidation.errors);
            warnings.push(...swapValidation.warnings);
            inconsistentEntities.push(...swapValidation.inconsistentEntities);

            // 2. Validate booking swap consistency
            const bookingValidation = await this.validateBookingSwapConsistency(updatedBookings);
            errors.push(...bookingValidation.errors);
            warnings.push(...bookingValidation.warnings);
            inconsistentEntities.push(...bookingValidation.inconsistentEntities);

            // 3. Validate proposal acceptance consistency
            const proposalValidation = await this.validateProposalAcceptanceConsistency(proposal);
            errors.push(...proposalValidation.errors);
            warnings.push(...proposalValidation.warnings);
            if (!proposalValidation.isValid) {
                inconsistentEntities.push(proposal.id);
            }

            // 4. Validate cross-entity consistency
            const crossValidation = await this.validateCrossEntityConsistency(
                completedSwaps,
                updatedBookings,
                proposal
            );
            errors.push(...crossValidation.errors);
            warnings.push(...crossValidation.warnings);
            inconsistentEntities.push(...crossValidation.inconsistentEntities);

            // 5. Attempt automatic correction if inconsistencies found
            if (inconsistentEntities.length > 0) {
                const corrections = await this.attemptAutomaticCorrection(
                    inconsistentEntities,
                    { proposal, sourceSwap: null, sourceBooking: null } // Minimal entities for correction context
                );
                correctionAttempts.push(...corrections);

                // Remove successfully corrected entities from inconsistent list
                const successfulCorrections = corrections
                    .filter(c => c.correctionApplied)
                    .map(c => c.entityId);

                inconsistentEntities.splice(0, inconsistentEntities.length);
                inconsistentEntities.push(
                    ...inconsistentEntities.filter(id => !successfulCorrections.includes(id))
                );
            }

            const isValid = errors.length === 0 && inconsistentEntities.length === 0;

            logger.debug('Post-completion validation completed', {
                proposalId: proposal.id,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length,
                inconsistentEntityCount: inconsistentEntities.length,
                correctionAttemptCount: correctionAttempts.length
            });

            return {
                isValid,
                errors,
                warnings,
                inconsistentEntities,
                correctionAttempts
            };

        } catch (error) {
            logger.error('Post-completion validation failed', {
                error: error instanceof Error ? error.message : String(error),
                proposalId: proposal.id
            });

            return {
                isValid: false,
                errors: [`Post-completion validation failed: ${error instanceof Error ? error.message : String(error)}`],
                warnings,
                inconsistentEntities,
                correctionAttempts
            };
        }
    }

    /**
     * Validate swap completion consistency
     * Ensures all completed swaps have proper status and completion data
     * 
     * Requirements: 5.3
     */
    async validateSwapCompletionConsistency(completedSwaps: CompletedSwapInfo[]): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        const client = await this.pool.connect();

        try {
            for (const swapInfo of completedSwaps) {
                // Fetch current swap state from database
                const query = `
                    SELECT 
                        id,
                        status,
                        completed_at,
                        completion_transaction_id,
                        blockchain_completion_id,
                        related_swap_completions
                    FROM swaps 
                    WHERE id = $1
                `;

                const result = await client.query(query, [swapInfo.swapId]);

                if (result.rows.length === 0) {
                    errors.push(`Swap ${swapInfo.swapId} not found in database`);
                    inconsistentEntities.push(swapInfo.swapId);
                    continue;
                }

                const dbSwap = result.rows[0];

                // Validate status consistency
                if (dbSwap.status !== swapInfo.newStatus) {
                    errors.push(`Swap ${swapInfo.swapId} status mismatch: expected ${swapInfo.newStatus}, got ${dbSwap.status}`);
                    inconsistentEntities.push(swapInfo.swapId);
                }

                // Validate completion timestamp
                if (swapInfo.newStatus === 'completed') {
                    if (!dbSwap.completed_at) {
                        errors.push(`Completed swap ${swapInfo.swapId} missing completion timestamp`);
                        inconsistentEntities.push(swapInfo.swapId);
                    } else {
                        const dbCompletedAt = new Date(dbSwap.completed_at);
                        const expectedCompletedAt = new Date(swapInfo.completedAt);
                        const timeDiff = Math.abs(dbCompletedAt.getTime() - expectedCompletedAt.getTime());

                        // Allow 1 second tolerance for timestamp differences
                        if (timeDiff > 1000) {
                            warnings.push(`Swap ${swapInfo.swapId} completion timestamp differs by ${timeDiff}ms`);
                        }
                    }

                    // Validate completion transaction ID
                    if (!dbSwap.completion_transaction_id) {
                        errors.push(`Completed swap ${swapInfo.swapId} missing completion transaction ID`);
                        inconsistentEntities.push(swapInfo.swapId);
                    }
                }

                // Validate related swap completions for multi-swap transactions
                if (completedSwaps.length > 1) {
                    const relatedSwapIds = dbSwap.related_swap_completions || [];
                    const expectedRelatedIds = completedSwaps
                        .filter(s => s.swapId !== swapInfo.swapId)
                        .map(s => s.swapId);

                    const missingRelated = expectedRelatedIds.filter(id => !relatedSwapIds.includes(id));
                    if (missingRelated.length > 0) {
                        warnings.push(`Swap ${swapInfo.swapId} missing related completion references: ${missingRelated.join(', ')}`);
                    }
                }
            }

            const isValid = errors.length === 0;

            logger.debug('Swap completion consistency validation completed', {
                swapCount: completedSwaps.length,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length
            });

            return {
                isValid,
                errors,
                warnings,
                inconsistentEntities
            };

        } finally {
            client.release();
        }
    }

    /**
     * Validate booking swap consistency
     * Ensures all updated bookings have proper status and swap completion data
     * 
     * Requirements: 5.3
     */
    async validateBookingSwapConsistency(updatedBookings: CompletedBookingInfo[]): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        const client = await this.pool.connect();

        try {
            for (const bookingInfo of updatedBookings) {
                // Fetch current booking state from database
                const query = `
                    SELECT 
                        id,
                        user_id,
                        status,
                        swapped_at,
                        swap_transaction_id,
                        original_owner_id,
                        related_booking_swaps
                    FROM bookings 
                    WHERE id = $1
                `;

                const result = await client.query(query, [bookingInfo.bookingId]);

                if (result.rows.length === 0) {
                    errors.push(`Booking ${bookingInfo.bookingId} not found in database`);
                    inconsistentEntities.push(bookingInfo.bookingId);
                    continue;
                }

                const dbBooking = result.rows[0];

                // Validate status consistency
                if (dbBooking.status !== bookingInfo.newStatus) {
                    errors.push(`Booking ${bookingInfo.bookingId} status mismatch: expected ${bookingInfo.newStatus}, got ${dbBooking.status}`);
                    inconsistentEntities.push(bookingInfo.bookingId);
                }

                // Validate swap timestamp
                if (bookingInfo.newStatus === 'swapped') {
                    if (!dbBooking.swapped_at) {
                        errors.push(`Swapped booking ${bookingInfo.bookingId} missing swap timestamp`);
                        inconsistentEntities.push(bookingInfo.bookingId);
                    } else {
                        const dbSwappedAt = new Date(dbBooking.swapped_at);
                        const expectedSwappedAt = new Date(bookingInfo.swappedAt);
                        const timeDiff = Math.abs(dbSwappedAt.getTime() - expectedSwappedAt.getTime());

                        // Allow 1 second tolerance for timestamp differences
                        if (timeDiff > 1000) {
                            warnings.push(`Booking ${bookingInfo.bookingId} swap timestamp differs by ${timeDiff}ms`);
                        }
                    }

                    // Validate swap transaction ID
                    if (!dbBooking.swap_transaction_id) {
                        errors.push(`Swapped booking ${bookingInfo.bookingId} missing swap transaction ID`);
                        inconsistentEntities.push(bookingInfo.bookingId);
                    }
                }

                // Validate ownership transfer if applicable
                if (bookingInfo.newOwnerId && bookingInfo.newOwnerId !== dbBooking.user_id) {
                    errors.push(`Booking ${bookingInfo.bookingId} ownership not transferred: expected ${bookingInfo.newOwnerId}, got ${dbBooking.user_id}`);
                    inconsistentEntities.push(bookingInfo.bookingId);
                }

                // Validate original owner tracking for ownership transfers
                if (bookingInfo.newOwnerId && !dbBooking.original_owner_id) {
                    warnings.push(`Booking ${bookingInfo.bookingId} missing original owner tracking for ownership transfer`);
                }

                // Validate related booking swaps for multi-booking transactions
                if (updatedBookings.length > 1) {
                    const relatedBookingIds = dbBooking.related_booking_swaps || [];
                    const expectedRelatedIds = updatedBookings
                        .filter(b => b.bookingId !== bookingInfo.bookingId)
                        .map(b => b.bookingId);

                    const missingRelated = expectedRelatedIds.filter(id => !relatedBookingIds.includes(id));
                    if (missingRelated.length > 0) {
                        warnings.push(`Booking ${bookingInfo.bookingId} missing related swap references: ${missingRelated.join(', ')}`);
                    }
                }
            }

            const isValid = errors.length === 0;

            logger.debug('Booking swap consistency validation completed', {
                bookingCount: updatedBookings.length,
                isValid,
                errorCount: errors.length,
                warningCount: warnings.length
            });

            return {
                isValid,
                errors,
                warnings,
                inconsistentEntities
            };

        } finally {
            client.release();
        }
    }

    /**
     * Attempt automatic correction of inconsistent entities
     * Tries to fix common inconsistency issues automatically
     * 
     * Requirements: 5.4
     */
    async attemptAutomaticCorrection(
        inconsistentEntities: string[],
        entities: RelatedEntities
    ): Promise<CorrectionAttempt[]> {
        const correctionAttempts: CorrectionAttempt[] = [];

        if (inconsistentEntities.length === 0) {
            return correctionAttempts;
        }

        logger.info('Attempting automatic correction for inconsistent entities', {
            entityCount: inconsistentEntities.length,
            entities: inconsistentEntities
        });

        const client = await this.pool.connect();

        try {
            await client.query('BEGIN');

            for (const entityId of inconsistentEntities) {
                // Determine entity type
                const entityType = await this.determineEntityType(client, entityId);

                if (!entityType) {
                    correctionAttempts.push({
                        entityType: 'swap', // Default fallback
                        entityId,
                        expectedStatus: 'unknown',
                        actualStatus: 'unknown',
                        correctionApplied: false,
                        correctionError: 'Could not determine entity type'
                    });
                    continue;
                }

                // Attempt correction based on entity type
                let correctionAttempt: CorrectionAttempt;

                switch (entityType) {
                    case 'swap':
                        correctionAttempt = await this.correctSwapInconsistency(client, entityId, entities);
                        break;
                    case 'booking':
                        correctionAttempt = await this.correctBookingInconsistency(client, entityId, entities);
                        break;
                    case 'proposal':
                        correctionAttempt = await this.correctProposalInconsistency(client, entityId, entities);
                        break;
                    default:
                        correctionAttempt = {
                            entityType: entityType as any,
                            entityId,
                            expectedStatus: 'unknown',
                            actualStatus: 'unknown',
                            correctionApplied: false,
                            correctionError: `Unsupported entity type: ${entityType}`
                        };
                }

                correctionAttempts.push(correctionAttempt);
            }

            await client.query('COMMIT');

            const successfulCorrections = correctionAttempts.filter(c => c.correctionApplied).length;
            logger.info('Automatic correction completed', {
                totalAttempts: correctionAttempts.length,
                successfulCorrections,
                failedCorrections: correctionAttempts.length - successfulCorrections
            });

        } catch (error) {
            await client.query('ROLLBACK');
            logger.error('Automatic correction failed', {
                error: error instanceof Error ? error.message : String(error),
                inconsistentEntities
            });

            // Mark all attempts as failed
            correctionAttempts.forEach(attempt => {
                if (attempt.correctionApplied) {
                    attempt.correctionApplied = false;
                    attempt.correctionError = `Correction rolled back due to transaction failure: ${error instanceof Error ? error.message : String(error)}`;
                }
            });

        } finally {
            client.release();
        }

        return correctionAttempts;
    }

    // Private validation helper methods

    private async validateProposalEligibility(proposal: any): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check proposal status
        if (proposal.status !== 'pending') {
            errors.push(`Proposal ${proposal.id} is not in pending status (current: ${proposal.status})`);
        }

        // Check proposal expiration
        if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
            errors.push(`Proposal ${proposal.id} has expired`);
        }

        // Check required fields
        if (!proposal.sourceSwapId) {
            errors.push(`Proposal ${proposal.id} missing source swap ID`);
        }

        if (!proposal.proposerId || !proposal.targetUserId) {
            errors.push(`Proposal ${proposal.id} missing user information`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities: []
        };
    }

    private async validateSwapEligibility(swap: any, type: 'source' | 'target'): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check swap status
        if (swap.status !== 'active') {
            errors.push(`${type} swap ${swap.id} is not active (current: ${swap.status})`);
        }

        // Check required fields
        if (!swap.bookingId) {
            errors.push(`${type} swap ${swap.id} missing booking ID`);
        }

        if (!swap.userId) {
            errors.push(`${type} swap ${swap.id} missing user ID`);
        }

        // Check for existing completion
        if (swap.completedAt) {
            errors.push(`${type} swap ${swap.id} is already completed`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities: []
        };
    }

    private async validateBookingEligibility(booking: any, type: 'source' | 'target'): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check booking status
        if (booking.status !== 'confirmed') {
            errors.push(`${type} booking ${booking.id} is not confirmed (current: ${booking.status})`);
        }

        // Check required fields
        if (!booking.userId) {
            errors.push(`${type} booking ${booking.id} missing user ID`);
        }

        // Check for existing swap completion
        if (booking.swappedAt) {
            errors.push(`${type} booking ${booking.id} is already swapped`);
        }

        // Check booking dates
        if (booking.checkInDate && new Date(booking.checkInDate) < new Date()) {
            warnings.push(`${type} booking ${booking.id} check-in date is in the past`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities: []
        };
    }

    private async validateEntityRelationships(entities: RelatedEntities): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        // Validate source swap-booking relationship
        if (entities.sourceSwap.bookingId !== entities.sourceBooking.id) {
            errors.push(`Source swap ${entities.sourceSwap.id} booking ID mismatch`);
            inconsistentEntities.push(entities.sourceSwap.id, entities.sourceBooking.id);
        }

        // Validate target swap-booking relationship (if applicable)
        if (entities.targetSwap && entities.targetBooking) {
            if (entities.targetSwap.bookingId !== entities.targetBooking.id) {
                errors.push(`Target swap ${entities.targetSwap.id} booking ID mismatch`);
                inconsistentEntities.push(entities.targetSwap.id, entities.targetBooking.id);
            }
        }

        // Validate proposal-swap relationships
        if (entities.proposal.sourceSwapId !== entities.sourceSwap.id) {
            errors.push(`Proposal ${entities.proposal.id} source swap ID mismatch`);
            inconsistentEntities.push(entities.proposal.id, entities.sourceSwap.id);
        }

        if (entities.targetSwap && entities.proposal.targetSwapId !== entities.targetSwap.id) {
            errors.push(`Proposal ${entities.proposal.id} target swap ID mismatch`);
            inconsistentEntities.push(entities.proposal.id, entities.targetSwap.id);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities
        };
    }

    private async validateBusinessRules(entities: RelatedEntities): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        // Validate user ownership
        if (entities.sourceSwap.userId !== entities.sourceBooking.userId) {
            errors.push(`Source swap and booking have different owners`);
            inconsistentEntities.push(entities.sourceSwap.id, entities.sourceBooking.id);
        }

        if (entities.targetSwap && entities.targetBooking) {
            if (entities.targetSwap.userId !== entities.targetBooking.userId) {
                errors.push(`Target swap and booking have different owners`);
                inconsistentEntities.push(entities.targetSwap.id, entities.targetBooking.id);
            }
        }

        // Validate no self-proposals
        if (entities.proposal.proposerId === entities.proposal.targetUserId) {
            errors.push(`Proposal ${entities.proposal.id} is a self-proposal`);
            inconsistentEntities.push(entities.proposal.id);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities
        };
    }

    private async validateProposalAcceptanceConsistency(proposal: any): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check proposal status
        if (proposal.status !== 'accepted') {
            errors.push(`Proposal ${proposal.id} status is not accepted (current: ${proposal.status})`);
        }

        // Check response timestamp
        if (!proposal.respondedAt) {
            errors.push(`Proposal ${proposal.id} missing response timestamp`);
        }

        // Check responder
        if (!proposal.respondedBy) {
            errors.push(`Proposal ${proposal.id} missing responder information`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities: []
        };
    }

    private async validateCrossEntityConsistency(
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        proposal: any
    ): Promise<CompletionValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];
        const inconsistentEntities: string[] = [];

        // Validate completion timestamps are consistent
        const completionTimestamps = [
            ...completedSwaps.map(s => s.completedAt.getTime()),
            ...updatedBookings.map(b => b.swappedAt.getTime()),
            proposal.respondedAt ? new Date(proposal.respondedAt).getTime() : 0
        ].filter(t => t > 0);

        if (completionTimestamps.length > 1) {
            const minTime = Math.min(...completionTimestamps);
            const maxTime = Math.max(...completionTimestamps);
            const timeDiff = maxTime - minTime;

            // Allow 5 second tolerance for completion timestamp differences
            if (timeDiff > 5000) {
                warnings.push(`Completion timestamps vary by ${timeDiff}ms across entities`);
            }
        }

        // Validate entity counts match proposal type
        const isBookingExchange = completedSwaps.length === 2 && updatedBookings.length === 2;
        const isCashPayment = completedSwaps.length === 1 && updatedBookings.length === 1;

        if (!isBookingExchange && !isCashPayment) {
            errors.push(`Invalid entity counts: ${completedSwaps.length} swaps, ${updatedBookings.length} bookings`);
            inconsistentEntities.push(proposal.id);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            inconsistentEntities
        };
    }

    // Private correction helper methods

    private async determineEntityType(client: PoolClient, entityId: string): Promise<string | null> {
        // Check if it's a swap
        const swapResult = await client.query('SELECT id FROM swaps WHERE id = $1', [entityId]);
        if (swapResult.rows.length > 0) return 'swap';

        // Check if it's a booking
        const bookingResult = await client.query('SELECT id FROM bookings WHERE id = $1', [entityId]);
        if (bookingResult.rows.length > 0) return 'booking';

        // Check if it's a proposal
        const proposalResult = await client.query('SELECT id FROM swap_proposals WHERE id = $1', [entityId]);
        if (proposalResult.rows.length > 0) return 'proposal';

        return null;
    }

    private async correctSwapInconsistency(
        client: PoolClient,
        swapId: string,
        entities: RelatedEntities
    ): Promise<CorrectionAttempt> {
        try {
            // Get current swap state
            const result = await client.query(
                'SELECT id, status, completed_at FROM swaps WHERE id = $1',
                [swapId]
            );

            if (result.rows.length === 0) {
                return {
                    entityType: 'swap',
                    entityId: swapId,
                    expectedStatus: 'completed',
                    actualStatus: 'not_found',
                    correctionApplied: false,
                    correctionError: 'Swap not found'
                };
            }

            const swap = result.rows[0];
            const expectedStatus = 'completed';

            // Attempt to correct status if needed
            if (swap.status !== expectedStatus) {
                await client.query(
                    'UPDATE swaps SET status = $2, completed_at = NOW() WHERE id = $1',
                    [swapId, expectedStatus]
                );

                logger.debug('Corrected swap status', {
                    swapId,
                    previousStatus: swap.status,
                    newStatus: expectedStatus
                });

                return {
                    entityType: 'swap',
                    entityId: swapId,
                    expectedStatus,
                    actualStatus: swap.status,
                    correctionApplied: true
                };
            }

            return {
                entityType: 'swap',
                entityId: swapId,
                expectedStatus,
                actualStatus: swap.status,
                correctionApplied: false,
                correctionError: 'No correction needed'
            };

        } catch (error) {
            return {
                entityType: 'swap',
                entityId: swapId,
                expectedStatus: 'completed',
                actualStatus: 'unknown',
                correctionApplied: false,
                correctionError: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async correctBookingInconsistency(
        client: PoolClient,
        bookingId: string,
        entities: RelatedEntities
    ): Promise<CorrectionAttempt> {
        try {
            // Get current booking state
            const result = await client.query(
                'SELECT id, status, swapped_at FROM bookings WHERE id = $1',
                [bookingId]
            );

            if (result.rows.length === 0) {
                return {
                    entityType: 'booking',
                    entityId: bookingId,
                    expectedStatus: 'swapped',
                    actualStatus: 'not_found',
                    correctionApplied: false,
                    correctionError: 'Booking not found'
                };
            }

            const booking = result.rows[0];
            const expectedStatus = 'swapped';

            // Attempt to correct status if needed
            if (booking.status !== expectedStatus) {
                await client.query(
                    'UPDATE bookings SET status = $2, swapped_at = NOW() WHERE id = $1',
                    [bookingId, expectedStatus]
                );

                logger.debug('Corrected booking status', {
                    bookingId,
                    previousStatus: booking.status,
                    newStatus: expectedStatus
                });

                return {
                    entityType: 'booking',
                    entityId: bookingId,
                    expectedStatus,
                    actualStatus: booking.status,
                    correctionApplied: true
                };
            }

            return {
                entityType: 'booking',
                entityId: bookingId,
                expectedStatus,
                actualStatus: booking.status,
                correctionApplied: false,
                correctionError: 'No correction needed'
            };

        } catch (error) {
            return {
                entityType: 'booking',
                entityId: bookingId,
                expectedStatus: 'swapped',
                actualStatus: 'unknown',
                correctionApplied: false,
                correctionError: error instanceof Error ? error.message : String(error)
            };
        }
    }

    private async correctProposalInconsistency(
        client: PoolClient,
        proposalId: string,
        entities: RelatedEntities
    ): Promise<CorrectionAttempt> {
        try {
            // Get current proposal state
            const result = await client.query(
                'SELECT id, status, responded_at FROM swap_proposals WHERE id = $1',
                [proposalId]
            );

            if (result.rows.length === 0) {
                return {
                    entityType: 'proposal',
                    entityId: proposalId,
                    expectedStatus: 'accepted',
                    actualStatus: 'not_found',
                    correctionApplied: false,
                    correctionError: 'Proposal not found'
                };
            }

            const proposal = result.rows[0];
            const expectedStatus = 'accepted';

            // Attempt to correct status if needed
            if (proposal.status !== expectedStatus) {
                await client.query(
                    'UPDATE swap_proposals SET status = $2, responded_at = NOW() WHERE id = $1',
                    [proposalId, expectedStatus]
                );

                logger.debug('Corrected proposal status', {
                    proposalId,
                    previousStatus: proposal.status,
                    newStatus: expectedStatus
                });

                return {
                    entityType: 'proposal',
                    entityId: proposalId,
                    expectedStatus,
                    actualStatus: proposal.status,
                    correctionApplied: true
                };
            }

            return {
                entityType: 'proposal',
                entityId: proposalId,
                expectedStatus,
                actualStatus: proposal.status,
                correctionApplied: false,
                correctionError: 'No correction needed'
            };

        } catch (error) {
            return {
                entityType: 'proposal',
                entityId: proposalId,
                expectedStatus: 'accepted',
                actualStatus: 'unknown',
                correctionApplied: false,
                correctionError: error instanceof Error ? error.message : String(error)
            };
        }
    }
}