import { Pool, PoolClient } from 'pg';
import {
    SwapCompletionRequest,
    SwapCompletionResult,
    RelatedEntities,
    CompletedSwapInfo,
    CompletedBookingInfo,
    CompletionTransactionData,
    CompletionValidationResult,
    SwapCompletionErrorCodes
} from '@booking-swap/shared';
import { SwapCompletionError } from '../../utils/SwapCompletionError';
import { CompletionTransactionManager } from './CompletionTransactionManager';
import { CompletionValidationService } from './CompletionValidationService';
import { CompletionRollbackManager } from './CompletionRollbackManager';
import { SwapCompletionAuditService } from './SwapCompletionAuditService';
import { SwapCompletionMonitoringService } from '../monitoring/SwapCompletionMonitoringService';
import { CompletionErrorLoggingService } from '../logging/CompletionErrorLoggingService';
import { CompletionAlertingService } from '../alerting/CompletionAlertingService';
import { CompletionPerformanceMonitoringService, PerformanceSample } from '../monitoring/CompletionPerformanceMonitoringService';
import { HederaService } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * SwapCompletionOrchestrator manages the complete swap completion workflow.
 * Coordinates atomic updates across all related entities when a swap proposal is accepted.
 * Integrates comprehensive monitoring, error handling, and performance tracking.
 * 
 * Requirements: 1.1, 2.1, 3.1, 6.1, 4.1, 4.3, 4.5
 */
export class SwapCompletionOrchestrator {
    private transactionManager: CompletionTransactionManager;
    private validationService: CompletionValidationService;
    private rollbackManager: CompletionRollbackManager;
    private auditService: SwapCompletionAuditService;
    private monitoringService: SwapCompletionMonitoringService;
    private errorLoggingService: CompletionErrorLoggingService;
    private alertingService: CompletionAlertingService;
    private performanceMonitoringService: CompletionPerformanceMonitoringService;

    constructor(
        private readonly pool: Pool,
        private readonly hederaService: HederaService,
        private readonly notificationService: NotificationService
    ) {
        this.transactionManager = new CompletionTransactionManager(pool);
        this.validationService = new CompletionValidationService(pool);
        this.rollbackManager = new CompletionRollbackManager(pool);
        this.auditService = new SwapCompletionAuditService(pool);
        this.monitoringService = SwapCompletionMonitoringService.getInstance();
        this.errorLoggingService = CompletionErrorLoggingService.getInstance();
        this.alertingService = CompletionAlertingService.getInstance();
        this.performanceMonitoringService = CompletionPerformanceMonitoringService.getInstance();
    }

    /**
     * Complete a booking exchange swap proposal
     * Handles atomic updates for both source and target swaps/bookings
     * 
     * Requirements: 1.1, 2.1, 6.1, 4.1, 4.3, 4.5
     */
    async completeSwapExchange(request: SwapCompletionRequest): Promise<SwapCompletionResult> {
        const operationId = uuidv4();
        const startTime = Date.now();

        logger.info('Starting booking exchange completion', {
            operationId,
            proposalId: request.proposalId,
            sourceSwapId: request.sourceSwapId,
            targetSwapId: request.targetSwapId,
            acceptingUserId: request.acceptingUserId
        });

        // Record completion start for monitoring
        this.monitoringService.recordCompletionStart(
            operationId,
            request.proposalId,
            request.acceptingUserId,
            'booking_exchange',
            [request.sourceSwapId, request.targetSwapId || ''].filter(Boolean)
        );

        try {
            // Step 1: Identify and validate all related entities
            const entities = await this.identifyRelatedEntities(request.proposalId);

            if (!entities.targetSwap || !entities.targetBooking) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES,
                    'Booking exchange requires both source and target entities',
                    [request.proposalId]
                );
            }

            // Step 2: Validate completion eligibility
            const eligibilityResult = await this.validateCompletionEligibility(entities);
            if (!eligibilityResult.isValid) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                    `Completion eligibility validation failed: ${eligibilityResult.errors.join(', ')}`,
                    [request.proposalId],
                    { validationErrors: eligibilityResult.errors }
                );
            }

            // Step 3: Execute completion workflow
            const result = await this.executeCompletionWorkflow(entities, request);

            const duration = Date.now() - startTime;

            // Record successful completion
            this.monitoringService.recordCompletionSuccess(
                operationId,
                request.proposalId,
                request.acceptingUserId,
                'booking_exchange',
                [request.sourceSwapId, request.targetSwapId || ''].filter(Boolean),
                duration,
                result.blockchainTransaction.transactionId
            );

            // Record performance sample
            this.recordPerformanceSample(operationId, 'booking_exchange', duration, true);

            logger.info('Booking exchange completion successful', {
                operationId,
                proposalId: request.proposalId,
                completedSwaps: result.completedSwaps.length,
                updatedBookings: result.updatedBookings.length,
                duration
            });

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const completionError = this.handleCompletionError(error, operationId, request, duration);

            logger.error('Booking exchange completion failed', {
                operationId,
                proposalId: request.proposalId,
                error: completionError.message,
                duration
            });

            throw completionError;
        }
    }

    /**
     * Complete a cash payment swap proposal
     * Handles atomic updates for source swap/booking only
     * 
     * Requirements: 1.1, 3.1, 6.1, 4.1, 4.3, 4.5
     */
    async completeCashSwap(request: SwapCompletionRequest): Promise<SwapCompletionResult> {
        const operationId = uuidv4();
        const startTime = Date.now();

        logger.info('Starting cash payment completion', {
            operationId,
            proposalId: request.proposalId,
            sourceSwapId: request.sourceSwapId,
            acceptingUserId: request.acceptingUserId,
            paymentTransactionId: request.paymentTransactionId
        });

        // Record completion start for monitoring
        this.monitoringService.recordCompletionStart(
            operationId,
            request.proposalId,
            request.acceptingUserId,
            'cash_payment',
            [request.sourceSwapId]
        );

        try {
            // Step 1: Identify and validate all related entities
            const entities = await this.identifyRelatedEntities(request.proposalId);

            // Step 2: Validate completion eligibility
            const eligibilityResult = await this.validateCompletionEligibility(entities);
            if (!eligibilityResult.isValid) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED,
                    `Completion eligibility validation failed: ${eligibilityResult.errors.join(', ')}`,
                    [request.proposalId],
                    { validationErrors: eligibilityResult.errors }
                );
            }

            // Step 3: Execute completion workflow
            const result = await this.executeCompletionWorkflow(entities, request);

            const duration = Date.now() - startTime;

            // Record successful completion
            this.monitoringService.recordCompletionSuccess(
                operationId,
                request.proposalId,
                request.acceptingUserId,
                'cash_payment',
                [request.sourceSwapId],
                duration,
                result.blockchainTransaction.transactionId
            );

            // Record performance sample
            this.recordPerformanceSample(operationId, 'cash_payment', duration, true);

            logger.info('Cash payment completion successful', {
                operationId,
                proposalId: request.proposalId,
                completedSwaps: result.completedSwaps.length,
                updatedBookings: result.updatedBookings.length,
                duration
            });

            return result;

        } catch (error) {
            const duration = Date.now() - startTime;
            const completionError = this.handleCompletionError(error, operationId, request, duration);

            logger.error('Cash payment completion failed', {
                operationId,
                proposalId: request.proposalId,
                error: completionError.message,
                duration
            });

            throw completionError;
        }
    }

    /**
     * Identify all related entities for a proposal
     * Fetches proposal, swaps, bookings, and payment transactions
     * 
     * Requirements: 1.1, 2.1
     */
    async identifyRelatedEntities(proposalId: string): Promise<RelatedEntities> {
        const client = await this.pool.connect();

        try {
            logger.debug('Identifying related entities', { proposalId });

            // Step 1: Fetch the proposal
            const proposalQuery = `
                SELECT 
                    id,
                    source_swap_id,
                    target_swap_id,
                    proposer_id,
                    target_user_id,
                    proposal_type,
                    status,
                    cash_offer_amount,
                    cash_offer_currency,
                    message,
                    conditions,
                    expires_at,
                    created_at,
                    updated_at
                FROM swap_proposals 
                WHERE id = $1
            `;

            const proposalResult = await client.query(proposalQuery, [proposalId]);

            if (proposalResult.rows.length === 0) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES,
                    `Proposal not found: ${proposalId}`,
                    [proposalId]
                );
            }

            const proposal = proposalResult.rows[0];

            // Step 2: Fetch source swap and booking
            const sourceSwap = await this.fetchSwapWithBooking(client, proposal.source_swap_id);
            if (!sourceSwap.swap || !sourceSwap.booking) {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES,
                    `Source swap or booking not found for proposal: ${proposalId}`,
                    [proposalId, proposal.source_swap_id]
                );
            }

            const entities: RelatedEntities = {
                proposal,
                sourceSwap: sourceSwap.swap,
                sourceBooking: sourceSwap.booking
            };

            // Step 3: Fetch target swap and booking if this is a booking exchange
            if (proposal.target_swap_id) {
                const targetSwap = await this.fetchSwapWithBooking(client, proposal.target_swap_id);
                if (!targetSwap.swap || !targetSwap.booking) {
                    throw new SwapCompletionError(
                        SwapCompletionErrorCodes.MISSING_RELATED_ENTITIES,
                        `Target swap or booking not found for proposal: ${proposalId}`,
                        [proposalId, proposal.target_swap_id]
                    );
                }

                entities.targetSwap = targetSwap.swap;
                entities.targetBooking = targetSwap.booking;
            }

            // Step 4: Fetch payment transaction if this is a cash proposal
            if (proposal.proposal_type === 'cash' && proposal.cash_offer_amount) {
                const paymentTransaction = await this.fetchPaymentTransaction(client, proposalId);
                if (paymentTransaction) {
                    entities.paymentTransaction = paymentTransaction;
                }
            }

            logger.debug('Related entities identified successfully', {
                proposalId,
                hasSourceSwap: !!entities.sourceSwap,
                hasSourceBooking: !!entities.sourceBooking,
                hasTargetSwap: !!entities.targetSwap,
                hasTargetBooking: !!entities.targetBooking,
                hasPaymentTransaction: !!entities.paymentTransaction
            });

            return entities;

        } finally {
            client.release();
        }
    }

    /**
     * Validate completion eligibility for all related entities
     * Ensures entities are in proper state for completion
     * 
     * Requirements: 1.1, 2.1, 3.1
     */
    async validateCompletionEligibility(entities: RelatedEntities): Promise<CompletionValidationResult> {
        logger.debug('Validating completion eligibility', {
            proposalId: entities.proposal.id,
            proposalType: entities.proposal.proposal_type
        });

        try {
            // Use the validation service for comprehensive pre-completion validation
            const validationResult = await this.validationService.validatePreCompletion(entities);

            logger.debug('Completion eligibility validation completed', {
                proposalId: entities.proposal.id,
                isValid: validationResult.isValid,
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length
            });

            return validationResult;

        } catch (error) {
            logger.error('Completion eligibility validation failed', {
                proposalId: entities.proposal.id,
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                isValid: false,
                errors: [`Validation failed: ${error instanceof Error ? error.message : String(error)}`],
                warnings: [],
                inconsistentEntities: []
            };
        }
    }

    /**
     * Execute the complete completion workflow
     * Orchestrates database updates, blockchain recording, and notifications
     * 
     * Requirements: 1.1, 2.1, 3.1, 6.1
     */
    async executeCompletionWorkflow(
        entities: RelatedEntities,
        request: SwapCompletionRequest
    ): Promise<SwapCompletionResult> {
        const completionTimestamp = new Date();
        const operationId = uuidv4();

        logger.info('Executing completion workflow', {
            operationId,
            proposalId: entities.proposal.id,
            proposalType: entities.proposal.proposal_type
        });

        try {
            // Step 1: Validate completion eligibility and create audit record
            const preValidationResult = await this.validationService.validatePreCompletion(entities);

            // Step 2: Create initial audit record
            const auditRecord = await this.auditService.createAuditRecord(
                entities,
                operationId,
                [entities.sourceSwap.id, ...(entities.targetSwap ? [entities.targetSwap.id] : [])],
                [entities.sourceBooking.id, ...(entities.targetBooking ? [entities.targetBooking.id] : [])],
                preValidationResult
            );

            // Step 3: Prepare transaction data
            const transactionData = this.prepareCompletionTransactionData(
                entities,
                request,
                completionTimestamp
            );

            // Step 4: Validate transaction data
            this.transactionManager.validateCompletionTransactionData(entities, transactionData);

            // Step 5: Execute atomic database transaction
            const transactionResult = await this.transactionManager.executeCompletionTransaction(
                entities,
                transactionData
            );

            // Step 6: Prepare completion result
            const completedSwaps: CompletedSwapInfo[] = transactionResult.updatedSwaps.map(swap => ({
                swapId: swap.id,
                previousStatus: entities.sourceSwap.id === swap.id ? entities.sourceSwap.status : entities.targetSwap?.status || 'unknown',
                newStatus: swap.status,
                completedAt: new Date(swap.completed_at)
            }));

            const updatedBookings: CompletedBookingInfo[] = transactionResult.updatedBookings.map(booking => ({
                bookingId: booking.id,
                previousStatus: entities.sourceBooking.id === booking.id ? entities.sourceBooking.status : entities.targetBooking?.status || 'unknown',
                newStatus: booking.status,
                swappedAt: new Date(booking.swapped_at),
                newOwnerId: booking.user_id !== booking.original_owner_id ? booking.user_id : undefined
            }));

            // Step 7: Record blockchain transaction with retry logic
            let blockchainTransaction: { transactionId: string; consensusTimestamp?: string };

            try {
                blockchainTransaction = await this.recordCompletionTransaction(
                    entities,
                    completedSwaps,
                    updatedBookings,
                    operationId
                );

                // Update swap records with blockchain completion ID
                await this.updateSwapBlockchainCompletionIds(
                    completedSwaps,
                    blockchainTransaction.transactionId
                );

                logger.info('Blockchain completion transaction recorded and stored', {
                    operationId,
                    proposalId: entities.proposal.id,
                    blockchainTransactionId: blockchainTransaction.transactionId,
                    consensusTimestamp: blockchainTransaction.consensusTimestamp
                });

            } catch (blockchainError) {
                logger.error('Blockchain recording failed after all retries', {
                    operationId,
                    proposalId: entities.proposal.id,
                    error: blockchainError instanceof Error ? blockchainError.message : String(blockchainError)
                });

                // Check if this is a critical failure that should rollback the entire completion
                if (blockchainError instanceof SwapCompletionError &&
                    blockchainError.code === SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED) {

                    // For critical blockchain failures, we might want to rollback
                    // For now, we'll continue but mark the completion as having blockchain issues
                    blockchainTransaction = {
                        transactionId: `failed_${operationId}`,
                        consensusTimestamp: undefined
                    };

                    // Store the failure in completion audit
                    await this.auditService.updateAuditRecordStatus(
                        entities.proposal.id,
                        'completed',
                        undefined,
                        `Blockchain recording failed: ${blockchainError.message}`
                    );
                } else {
                    // Re-throw unexpected errors
                    throw blockchainError;
                }
            }

            // Step 8: Post-completion validation
            const postValidationResult = await this.validationService.validatePostCompletion(
                completedSwaps,
                updatedBookings,
                transactionResult.updatedProposal
            );

            if (!postValidationResult.isValid) {
                logger.warn('Post-completion validation failed', {
                    operationId,
                    proposalId: entities.proposal.id,
                    errors: postValidationResult.errors,
                    inconsistentEntities: postValidationResult.inconsistentEntities
                });

                // Log validation issues but don't fail the completion
                // The automatic correction attempts should have been made
            }

            // Step 9: Update audit record with final status and validation results
            await this.auditService.updateAuditRecordStatus(
                entities.proposal.id,
                'completed',
                postValidationResult,
                undefined,
                blockchainTransaction.transactionId.startsWith('failed_') ? undefined : blockchainTransaction.transactionId
            );

            // Step 10: Send notifications
            await this.sendCompletionNotifications(
                entities,
                completedSwaps,
                updatedBookings,
                transactionResult.updatedProposal,
                blockchainTransaction
            );

            const result: SwapCompletionResult = {
                completedSwaps,
                updatedBookings,
                proposal: transactionResult.updatedProposal,
                blockchainTransaction,
                completionTimestamp
            };

            logger.info('Completion workflow executed successfully', {
                operationId,
                proposalId: entities.proposal.id,
                completedSwaps: completedSwaps.length,
                updatedBookings: updatedBookings.length,
                blockchainRecorded: !blockchainTransaction.transactionId.startsWith('failed_')
            });

            return result;

        } catch (error) {
            logger.error('Completion workflow execution failed', {
                operationId,
                proposalId: entities.proposal.id,
                error: error instanceof Error ? error.message : String(error)
            });

            // Update audit record with failure status
            try {
                await this.auditService.updateAuditRecordStatus(
                    entities.proposal.id,
                    'failed',
                    undefined,
                    error instanceof Error ? error.message : String(error)
                );
            } catch (auditError) {
                logger.error('Failed to update audit record with failure status', {
                    operationId,
                    proposalId: entities.proposal.id,
                    auditError: auditError instanceof Error ? auditError.message : String(auditError)
                });
            }

            // Attempt comprehensive rollback using CompletionRollbackManager
            try {
                // Get audit ID for rollback tracking
                const auditRecord = await this.auditService.getAuditRecordByProposal(entities.proposal.id);
                const auditId = auditRecord?.id || operationId;

                // Create partial results object if any blockchain transaction was attempted
                const partialResults: Partial<SwapCompletionResult> = {};

                const rollbackResult = await this.rollbackManager.rollbackCompletionWorkflow(
                    auditId,
                    entities,
                    partialResults
                );

                if (!rollbackResult.success) {
                    logger.error('Comprehensive rollback failed', {
                        operationId,
                        proposalId: entities.proposal.id,
                        rollbackResult,
                        requiresManualIntervention: rollbackResult.requiresManualIntervention
                    });

                    // Update audit record with rollback failure
                    await this.auditService.updateAuditRecordStatus(
                        entities.proposal.id,
                        'failed',
                        undefined,
                        `Rollback failed: ${rollbackResult.errorDetails || 'Unknown rollback error'}`
                    );
                } else {
                    logger.info('Comprehensive rollback completed successfully', {
                        operationId,
                        proposalId: entities.proposal.id,
                        restoredEntitiesCount: rollbackResult.restoredEntities.length
                    });

                    // Update audit record with rollback success
                    await this.auditService.updateAuditRecordStatus(
                        entities.proposal.id,
                        'rolled_back',
                        undefined,
                        'Completion workflow rolled back successfully'
                    );
                }
            } catch (rollbackError) {
                logger.error('Rollback failed after completion workflow failure', {
                    operationId,
                    proposalId: entities.proposal.id,
                    rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                });

                // Update audit record with rollback failure
                try {
                    await this.auditService.updateAuditRecordStatus(
                        entities.proposal.id,
                        'failed',
                        undefined,
                        `Rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
                    );
                } catch (auditError) {
                    logger.error('Failed to update audit record with rollback failure', {
                        operationId,
                        proposalId: entities.proposal.id,
                        auditError: auditError instanceof Error ? auditError.message : String(auditError)
                    });
                }
            }

            throw error;
        }
    }

    // Private helper methods

    /**
     * Fetch swap and its associated booking
     */
    private async fetchSwapWithBooking(
        client: PoolClient,
        swapId: string
    ): Promise<{ swap: any | null; booking: any | null }> {
        // Fetch swap
        const swapQuery = `
            SELECT 
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
            FROM swaps 
            WHERE id = $1
        `;

        const swapResult = await client.query(swapQuery, [swapId]);

        if (swapResult.rows.length === 0) {
            return { swap: null, booking: null };
        }

        const swap = swapResult.rows[0];

        // Fetch associated booking
        const bookingQuery = `
            SELECT 
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
            FROM bookings 
            WHERE id = $1
        `;

        const bookingResult = await client.query(bookingQuery, [swap.booking_id]);

        const booking = bookingResult.rows.length > 0 ? bookingResult.rows[0] : null;

        return { swap, booking };
    }

    /**
     * Fetch payment transaction for a proposal
     */
    private async fetchPaymentTransaction(
        client: PoolClient,
        proposalId: string
    ): Promise<any | null> {
        const query = `
            SELECT 
                id,
                user_id,
                amount,
                currency,
                status,
                transaction_type,
                reference_id,
                created_at,
                updated_at
            FROM payment_transactions 
            WHERE reference_id = $1 
            AND transaction_type = 'swap_payment'
            ORDER BY created_at DESC
            LIMIT 1
        `;

        const result = await client.query(query, [proposalId]);

        return result.rows.length > 0 ? result.rows[0] : null;
    }

    /**
     * Prepare transaction data for atomic completion
     */
    private prepareCompletionTransactionData(
        entities: RelatedEntities,
        request: SwapCompletionRequest,
        completionTimestamp: Date
    ): CompletionTransactionData {
        const swapUpdates = [
            {
                swapId: entities.sourceSwap.id,
                status: 'completed',
                completedAt: completionTimestamp,
                blockchainTransactionId: undefined // Will be set after blockchain recording
            }
        ];

        const bookingUpdates = [
            {
                bookingId: entities.sourceBooking.id,
                status: 'swapped',
                swappedAt: completionTimestamp,
                newOwnerId: undefined // No ownership change for source booking in most cases
            }
        ];

        // Add target entities for booking exchange
        if (entities.targetSwap && entities.targetBooking) {
            swapUpdates.push({
                swapId: entities.targetSwap.id,
                status: 'completed',
                completedAt: completionTimestamp,
                blockchainTransactionId: undefined
            });

            bookingUpdates.push({
                bookingId: entities.targetBooking.id,
                status: 'swapped',
                swappedAt: completionTimestamp,
                newOwnerId: entities.sourceBooking.user_id // Transfer ownership to source user
            });

            // Update source booking ownership to target user
            const targetBooking = entities.targetBooking;
            if (targetBooking && bookingUpdates.length > 0) {
                const sourceBookingUpdate = bookingUpdates[0];
                if (sourceBookingUpdate) {
                    sourceBookingUpdate.newOwnerId = targetBooking.user_id;
                }
            }
        }

        const proposalUpdate = {
            proposalId: entities.proposal.id,
            status: 'accepted' as const,
            respondedAt: completionTimestamp,
            respondedBy: request.acceptingUserId
        };

        return {
            swapUpdates,
            bookingUpdates,
            proposalUpdate
        };
    }

    /**
     * Record completion transaction on blockchain with retry logic
     * Implements completion-specific blockchain transaction types
     * 
     * Requirements: 7.1, 7.2, 7.3, 7.4, 4.1, 4.3, 4.5
     */
    async recordCompletionTransaction(
        entities: RelatedEntities,
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        operationId: string
    ): Promise<{ transactionId: string; consensusTimestamp?: string }> {
        const maxRetries = 3;
        let lastError: Error | null = null;
        const blockchainStartTime = Date.now();

        logger.info('Starting blockchain completion recording', {
            operationId,
            proposalId: entities.proposal.id,
            completedSwapsCount: completedSwaps.length,
            updatedBookingsCount: updatedBookings.length,
            maxRetries
        });

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const attemptStartTime = Date.now();

            try {
                logger.debug(`Blockchain recording attempt ${attempt}/${maxRetries}`, {
                    operationId,
                    proposalId: entities.proposal.id
                });

                const result = await this.submitCompletionToBlockchain(
                    entities,
                    completedSwaps,
                    updatedBookings,
                    operationId,
                    attempt
                );

                const confirmationTime = Date.now() - attemptStartTime;

                // Record successful blockchain transaction
                this.recordBlockchainMetrics(
                    operationId,
                    result.transactionId,
                    true,
                    confirmationTime
                );

                logger.info('Blockchain completion recording successful', {
                    operationId,
                    proposalId: entities.proposal.id,
                    transactionId: result.transactionId,
                    consensusTimestamp: result.consensusTimestamp,
                    attempt,
                    confirmationTime
                });

                return result;

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const attemptDuration = Date.now() - attemptStartTime;

                // Record failed blockchain transaction
                this.recordBlockchainMetrics(
                    operationId,
                    `failed_attempt_${attempt}`,
                    false,
                    attemptDuration
                );

                logger.warn(`Blockchain recording attempt ${attempt}/${maxRetries} failed`, {
                    operationId,
                    proposalId: entities.proposal.id,
                    attempt,
                    error: lastError.message,
                    attemptDuration,
                    willRetry: attempt < maxRetries
                });

                // Wait before retry (exponential backoff)
                if (attempt < maxRetries) {
                    const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
        }

        // All retries failed
        const totalBlockchainDuration = Date.now() - blockchainStartTime;

        logger.error('Blockchain completion recording failed after all retries', {
            operationId,
            proposalId: entities.proposal.id,
            maxRetries,
            totalDuration: totalBlockchainDuration,
            finalError: lastError?.message
        });

        const blockchainError = SwapCompletionError.blockchainError(
            `Blockchain recording failed after ${maxRetries} attempts: ${lastError?.message}`,
            operationId,
            maxRetries,
            maxRetries
        );

        // Log the blockchain error
        this.errorLoggingService.logError(blockchainError, {
            completionId: operationId,
            proposalId: entities.proposal.id,
            additionalContext: {
                maxRetries,
                totalDuration: totalBlockchainDuration,
                lastError: lastError?.message
            }
        });

        throw blockchainError;
    }

    /**
     * Submit completion transaction to blockchain
     * Creates completion-specific transaction payload
     * 
     * Requirements: 7.1, 7.2
     */
    private async submitCompletionToBlockchain(
        entities: RelatedEntities,
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        operationId: string,
        attempt: number
    ): Promise<{ transactionId: string; consensusTimestamp?: string }> {
        // Create completion-specific transaction data
        const completionTransactionData = this.createCompletionTransactionData(
            entities,
            completedSwaps,
            updatedBookings,
            operationId
        );

        logger.debug('Submitting completion transaction to blockchain', {
            operationId,
            proposalId: entities.proposal.id,
            transactionType: completionTransactionData.type,
            payloadSize: JSON.stringify(completionTransactionData.payload).length,
            attempt
        });

        // Submit to Hedera Consensus Service
        const result = await this.hederaService.submitTransaction(completionTransactionData);

        // Validate the result
        if (!result.transactionId) {
            throw new Error('Blockchain transaction submission returned no transaction ID');
        }

        if (result.status !== 'SUCCESS') {
            throw new Error(`Blockchain transaction failed with status: ${result.status}`);
        }

        return {
            transactionId: result.transactionId,
            consensusTimestamp: result.consensusTimestamp
        };
    }

    /**
     * Create completion-specific blockchain transaction data
     * Implements different transaction types for booking exchange vs cash payment
     * 
     * Requirements: 7.1, 7.2
     */
    private createCompletionTransactionData(
        entities: RelatedEntities,
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        operationId: string
    ): {
        type: 'swap_execution';
        payload: Record<string, any>;
        timestamp: Date;
    } {
        const timestamp = new Date();
        const completionType = entities.targetSwap ? 'booking_exchange' : 'cash_payment';

        // Base completion payload
        const basePayload = {
            operationType: 'swap_completion',
            completionType,
            proposalId: entities.proposal.id,
            operationId,
            timestamp: timestamp.toISOString(),
            initiatedBy: entities.proposal.target_user_id,

            // Completion summary
            completionSummary: {
                totalSwapsCompleted: completedSwaps.length,
                totalBookingsUpdated: updatedBookings.length,
                ownershipTransfersCount: updatedBookings.filter(b => b.newOwnerId).length
            }
        };

        // Add completion-specific data based on type
        if (completionType === 'booking_exchange') {
            return {
                type: 'swap_execution',
                payload: {
                    ...basePayload,
                    bookingExchange: {
                        sourceSwap: {
                            swapId: entities.sourceSwap.id,
                            bookingId: entities.sourceBooking.id,
                            originalOwner: entities.sourceBooking.user_id,
                            newOwner: entities.targetBooking?.user_id,
                            previousStatus: completedSwaps.find(s => s.swapId === entities.sourceSwap.id)?.previousStatus,
                            newStatus: completedSwaps.find(s => s.swapId === entities.sourceSwap.id)?.newStatus
                        },
                        targetSwap: {
                            swapId: entities.targetSwap?.id,
                            bookingId: entities.targetBooking?.id,
                            originalOwner: entities.targetBooking?.user_id,
                            newOwner: entities.sourceBooking.user_id,
                            previousStatus: completedSwaps.find(s => s.swapId === entities.targetSwap?.id)?.previousStatus,
                            newStatus: completedSwaps.find(s => s.swapId === entities.targetSwap?.id)?.newStatus
                        },
                        exchangeDetails: {
                            proposalAcceptedAt: timestamp.toISOString(),
                            ownershipTransferred: true,
                            mutualExchange: true
                        }
                    },
                    completedSwaps: completedSwaps.map(swap => ({
                        swapId: swap.swapId,
                        previousStatus: swap.previousStatus,
                        newStatus: swap.newStatus,
                        completedAt: swap.completedAt.toISOString()
                    })),
                    updatedBookings: updatedBookings.map(booking => ({
                        bookingId: booking.bookingId,
                        previousStatus: booking.previousStatus,
                        newStatus: booking.newStatus,
                        swappedAt: booking.swappedAt.toISOString(),
                        ownershipTransferred: !!booking.newOwnerId,
                        newOwnerId: booking.newOwnerId
                    }))
                },
                timestamp
            };
        } else {
            // Cash payment completion
            return {
                type: 'swap_execution',
                payload: {
                    ...basePayload,
                    cashPayment: {
                        sourceSwap: {
                            swapId: entities.sourceSwap.id,
                            bookingId: entities.sourceBooking.id,
                            owner: entities.sourceBooking.user_id,
                            previousStatus: completedSwaps.find(s => s.swapId === entities.sourceSwap.id)?.previousStatus,
                            newStatus: completedSwaps.find(s => s.swapId === entities.sourceSwap.id)?.newStatus
                        },
                        paymentDetails: {
                            amount: entities.proposal.cash_offer_amount,
                            currency: entities.proposal.cash_offer_currency,
                            paymentTransactionId: entities.paymentTransaction?.id,
                            proposalAcceptedAt: timestamp.toISOString(),
                            ownershipTransferred: false,
                            cashTransaction: true
                        }
                    },
                    completedSwaps: completedSwaps.map(swap => ({
                        swapId: swap.swapId,
                        previousStatus: swap.previousStatus,
                        newStatus: swap.newStatus,
                        completedAt: swap.completedAt.toISOString()
                    })),
                    updatedBookings: updatedBookings.map(booking => ({
                        bookingId: booking.bookingId,
                        previousStatus: booking.previousStatus,
                        newStatus: booking.newStatus,
                        swappedAt: booking.swappedAt.toISOString(),
                        ownershipTransferred: false
                    }))
                },
                timestamp
            };
        }
    }

    /**
     * Update swap records with blockchain completion IDs
     * Stores blockchain transaction hashes in completion audit records
     * 
     * Requirements: 7.4
     */
    private async updateSwapBlockchainCompletionIds(
        completedSwaps: CompletedSwapInfo[],
        blockchainTransactionId: string
    ): Promise<void> {
        const client = await this.pool.connect();

        try {
            logger.debug('Updating swap records with blockchain completion IDs', {
                swapCount: completedSwaps.length,
                blockchainTransactionId
            });

            // Update each completed swap with the blockchain completion ID
            for (const completedSwap of completedSwaps) {
                const updateQuery = `
                    UPDATE swaps 
                    SET 
                        blockchain_completion_id = $1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $2
                `;

                await client.query(updateQuery, [blockchainTransactionId, completedSwap.swapId]);

                logger.debug('Updated swap with blockchain completion ID', {
                    swapId: completedSwap.swapId,
                    blockchainTransactionId
                });
            }

            logger.info('All swap records updated with blockchain completion IDs', {
                swapCount: completedSwaps.length,
                blockchainTransactionId
            });

        } catch (error) {
            logger.error('Failed to update swap records with blockchain completion IDs', {
                swapCount: completedSwaps.length,
                blockchainTransactionId,
                error: error instanceof Error ? error.message : String(error)
            });

            // Don't throw here as the main completion has already succeeded
            // This is just updating the blockchain reference
        } finally {
            client.release();
        }
    }

    /**
     * Send completion notifications to all involved users
     * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
     */
    private async sendCompletionNotifications(
        entities: RelatedEntities,
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        proposal: any,
        blockchainTransaction?: { transactionId: string; consensusTimestamp?: string }
    ): Promise<void> {
        try {
            logger.info('Sending comprehensive completion notifications', {
                proposalId: entities.proposal.id,
                completionType: entities.targetSwap ? 'booking_exchange' : 'cash_payment',
                completedSwapsCount: completedSwaps.length,
                updatedBookingsCount: updatedBookings.length,
                hasOwnershipTransfers: updatedBookings.some(b => b.newOwnerId)
            });

            // Prepare swap details for notifications
            const sourceSwapDetails = await this.getSwapDetailsForNotification(entities.sourceSwap.id);
            const targetSwapDetails = entities.targetSwap
                ? await this.getSwapDetailsForNotification(entities.targetSwap.id)
                : undefined;

            // Send main completion success notifications
            await this.notificationService.sendSwapCompletionSuccessNotification({
                proposalId: entities.proposal.id,
                completionType: entities.targetSwap ? 'booking_exchange' : 'cash_payment',
                completedSwaps,
                updatedBookings,
                blockchainTransaction,
                completionTimestamp: new Date(),
                proposerId: entities.proposal.proposer_id,
                targetUserId: entities.proposal.target_user_id,
                sourceSwapDetails,
                targetSwapDetails,
                cashOffer: entities.proposal.cash_offer_amount ? {
                    amount: entities.proposal.cash_offer_amount,
                    currency: entities.proposal.cash_offer_currency || 'USD'
                } : undefined
            });

            // Send ownership transfer notifications for booking exchanges
            if (entities.targetSwap && entities.targetBooking) {
                const ownershipTransfers = updatedBookings.filter(b => b.newOwnerId);

                for (const transfer of ownershipTransfers) {
                    const bookingDetails = await this.getBookingDetailsForNotification(transfer.bookingId);
                    const exchangePartnerDetails = await this.getExchangePartnerDetails(
                        transfer.bookingId,
                        entities
                    );

                    await this.notificationService.sendBookingOwnershipTransferNotification({
                        proposalId: entities.proposal.id,
                        bookingId: transfer.bookingId,
                        previousOwnerId: transfer.bookingId === entities.sourceBooking.id
                            ? entities.sourceBooking.user_id
                            : entities.targetBooking.user_id,
                        newOwnerId: transfer.newOwnerId!,
                        transferredAt: transfer.swappedAt,
                        bookingDetails,
                        exchangePartnerDetails
                    });
                }
            }

            // Send real-time WebSocket updates
            await this.sendCompletionWebSocketUpdates(
                entities,
                completedSwaps,
                updatedBookings,
                blockchainTransaction
            );

            logger.info('All completion notifications sent successfully', {
                proposalId: entities.proposal.id,
                notifiedUsers: [entities.proposal.target_user_id, entities.proposal.proposer_id],
                ownershipTransferNotifications: updatedBookings.filter(b => b.newOwnerId).length
            });

        } catch (error) {
            logger.error('Failed to send completion notifications', {
                proposalId: entities.proposal.id,
                error: error instanceof Error ? error.message : String(error)
            });

            // Don't fail the completion for notification errors
            // But send a failure notification to users
            try {
                await this.sendNotificationFailureAlert(entities, error);
            } catch (alertError) {
                logger.error('Failed to send notification failure alert', {
                    proposalId: entities.proposal.id,
                    alertError: alertError instanceof Error ? alertError.message : String(alertError)
                });
            }
        }
    }

    /**
     * Send real-time WebSocket events for completion status updates
     * Requirements: 8.5
     */
    private async sendCompletionWebSocketUpdates(
        entities: RelatedEntities,
        completedSwaps: CompletedSwapInfo[],
        updatedBookings: CompletedBookingInfo[],
        blockchainTransaction?: { transactionId: string; consensusTimestamp?: string }
    ): Promise<void> {
        try {
            if (!this.notificationService.webSocketService) {
                logger.warn('WebSocket service not available for completion updates');
                return;
            }

            const completionUpdate = {
                type: 'swap_completion_update',
                proposalId: entities.proposal.id,
                status: 'completed',
                completionType: entities.targetSwap ? 'booking_exchange' : 'cash_payment',
                completedSwaps: completedSwaps.map(swap => ({
                    swapId: swap.swapId,
                    newStatus: swap.newStatus,
                    completedAt: swap.completedAt
                })),
                updatedBookings: updatedBookings.map(booking => ({
                    bookingId: booking.bookingId,
                    newStatus: booking.newStatus,
                    swappedAt: booking.swappedAt,
                    ownershipTransferred: !!booking.newOwnerId
                })),
                blockchainTransaction,
                timestamp: new Date()
            };

            // Send to both users involved in the completion
            const userIds = [entities.proposal.proposer_id, entities.proposal.target_user_id];

            for (const userId of userIds) {
                await this.notificationService.webSocketService.sendNotification({
                    userId,
                    notification: {
                        id: `completion_${entities.proposal.id}`,
                        userId,
                        type: 'swap_completion_success',
                        title: 'Swap Completed',
                        message: 'Your swap has been completed successfully',
                        data: completionUpdate,
                        channel: 'in_app',
                        status: 'delivered',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    } as any
                });
            }

            // Send to proposal-specific room if users are subscribed
            if (this.notificationService.webSocketService.getIOInstance) {
                this.notificationService.webSocketService.getIOInstance()
                    .to(`proposal:${entities.proposal.id}`)
                    .emit('completion:status_update', completionUpdate);
            }

            logger.debug('WebSocket completion updates sent successfully', {
                proposalId: entities.proposal.id,
                notifiedUsers: userIds.length
            });

        } catch (error) {
            logger.error('Failed to send WebSocket completion updates', {
                proposalId: entities.proposal.id,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Send notification failure alert to users
     */
    private async sendNotificationFailureAlert(
        entities: RelatedEntities,
        originalError: Error | unknown
    ): Promise<void> {
        try {
            const errorMessage = originalError instanceof Error ? originalError.message : String(originalError);

            // Send basic notification about completion success but notification failure
            const userIds = [entities.proposal.proposer_id, entities.proposal.target_user_id];

            for (const userId of userIds) {
                await this.notificationService.sendNotification(
                    'swap_completion_success',
                    userId,
                    {
                        proposalId: entities.proposal.id,
                        title: 'Swap Completed (Notification Issue)',
                        message: 'Your swap was completed successfully, but there was an issue sending detailed notifications. Please check your dashboard for complete details.',
                        notificationError: errorMessage,
                        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                    }
                );
            }
        } catch (alertError) {
            logger.error('Failed to send notification failure alert', {
                proposalId: entities.proposal.id,
                alertError: alertError instanceof Error ? alertError.message : String(alertError)
            });
        }
    }

    /**
     * Get swap details formatted for notifications
     */
    private async getSwapDetailsForNotification(swapId: string): Promise<{
        title: string;
        location: string;
        dates: string;
        value: number;
        accommodationType: string;
        guests: number;
    }> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT 
                    s.id,
                    b.title,
                    b.location_city,
                    b.location_country,
                    b.check_in_date,
                    b.check_out_date,
                    b.swap_value,
                    b.accommodation_type,
                    b.guest_count
                FROM swaps s
                JOIN bookings b ON s.booking_id = b.id
                WHERE s.id = $1
            `;

            const result = await client.query(query, [swapId]);

            if (result.rows.length === 0) {
                throw new Error(`Swap not found: ${swapId}`);
            }

            const row = result.rows[0];

            return {
                title: row.title || 'Untitled Booking',
                location: `${row.location_city}, ${row.location_country}`,
                dates: `${new Date(row.check_in_date).toDateString()} - ${new Date(row.check_out_date).toDateString()}`,
                value: row.swap_value || 0,
                accommodationType: row.accommodation_type || 'Unknown',
                guests: row.guest_count || 1
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get booking details formatted for notifications
     */
    private async getBookingDetailsForNotification(bookingId: string): Promise<{
        title: string;
        location: string;
        dates: string;
        value: number;
        accommodationType: string;
        guests: number;
    }> {
        const client = await this.pool.connect();

        try {
            const query = `
                SELECT 
                    title,
                    location_city,
                    location_country,
                    check_in_date,
                    check_out_date,
                    swap_value,
                    accommodation_type,
                    guest_count
                FROM bookings
                WHERE id = $1
            `;

            const result = await client.query(query, [bookingId]);

            if (result.rows.length === 0) {
                throw new Error(`Booking not found: ${bookingId}`);
            }

            const row = result.rows[0];

            return {
                title: row.title || 'Untitled Booking',
                location: `${row.location_city}, ${row.location_country}`,
                dates: `${new Date(row.check_in_date).toDateString()} - ${new Date(row.check_out_date).toDateString()}`,
                value: row.swap_value || 0,
                accommodationType: row.accommodation_type || 'Unknown',
                guests: row.guest_count || 1
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get exchange partner details for ownership transfer notifications
     */
    private async getExchangePartnerDetails(
        bookingId: string,
        entities: RelatedEntities
    ): Promise<{
        name: string;
        bookingTitle: string;
        bookingLocation: string;
        bookingDates: string;
    }> {
        const client = await this.pool.connect();

        try {
            // Determine which is the partner booking
            const isSourceBooking = bookingId === entities.sourceBooking.id;
            const partnerBookingId = isSourceBooking ? entities.targetBooking?.id : entities.sourceBooking.id;
            const partnerUserId = isSourceBooking ? entities.targetBooking?.user_id : entities.sourceBooking.user_id;

            if (!partnerBookingId || !partnerUserId) {
                throw new Error('Partner booking or user not found');
            }

            // Get partner user details
            const userQuery = `
                SELECT display_name, first_name, last_name
                FROM users
                WHERE id = $1
            `;

            const userResult = await client.query(userQuery, [partnerUserId]);
            const userName = userResult.rows[0]?.display_name ||
                `${userResult.rows[0]?.first_name} ${userResult.rows[0]?.last_name}` ||
                'Unknown User';

            // Get partner booking details
            const bookingQuery = `
                SELECT 
                    title,
                    location_city,
                    location_country,
                    check_in_date,
                    check_out_date
                FROM bookings
                WHERE id = $1
            `;

            const bookingResult = await client.query(bookingQuery, [partnerBookingId]);
            const booking = bookingResult.rows[0];

            return {
                name: userName,
                bookingTitle: booking?.title || 'Untitled Booking',
                bookingLocation: `${booking?.location_city}, ${booking?.location_country}`,
                bookingDates: `${new Date(booking?.check_in_date).toDateString()} - ${new Date(booking?.check_out_date).toDateString()}`
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get completion audit record by proposal ID
     * Provides access to audit trail for completion operations
     * 
     * Requirements: 6.1, 6.3
     */
    async getCompletionAuditRecord(proposalId: string) {
        return await this.auditService.getAuditRecordByProposal(proposalId);
    }

    /**
     * Query completion history with filtering options
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
    } = {}) {
        return await this.auditService.queryCompletionHistory(options);
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
    } = {}) {
        return await this.auditService.getCompletionStatistics(options);
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
    }) {
        return await this.auditService.getAuditRecordsForEntities(options);
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
    }) {
        return await this.auditService.cleanupOldAuditRecords(options);
    }

    /**
     * Handle completion errors with comprehensive logging and monitoring
     * Requirements: 4.1, 4.3, 4.5
     */
    private handleCompletionError(
        error: unknown,
        operationId: string,
        request: SwapCompletionRequest,
        duration: number,
        retryAttempt?: number
    ): SwapCompletionError {
        let completionError: SwapCompletionError;

        // Convert to SwapCompletionError if needed
        if (error instanceof SwapCompletionError) {
            completionError = error;
        } else {
            const errorMessage = error instanceof Error ? error.message : String(error);
            completionError = SwapCompletionError.databaseError(
                `Completion failed: ${errorMessage}`,
                operationId,
                error instanceof Error ? error : undefined
            );
        }

        // Record failure in monitoring
        this.monitoringService.recordCompletionFailure(
            operationId,
            request.proposalId,
            request.acceptingUserId,
            request.proposalType === 'booking' ? 'booking_exchange' : 'cash_payment',
            [request.sourceSwapId, request.targetSwapId || ''].filter(Boolean),
            completionError,
            duration,
            retryAttempt
        );

        // Log error with comprehensive context
        this.errorLoggingService.logError(completionError, {
            completionId: operationId,
            proposalId: request.proposalId,
            userId: request.acceptingUserId,
            additionalContext: {
                sourceSwapId: request.sourceSwapId,
                targetSwapId: request.targetSwapId,
                proposalType: request.proposalType,
                paymentTransactionId: request.paymentTransactionId,
                duration,
                retryAttempt
            }
        });

        // Trigger immediate alert for critical errors
        this.alertingService.triggerImmediateAlert(completionError, {
            completionId: operationId,
            proposalId: request.proposalId,
            userId: request.acceptingUserId
        });

        // Record performance sample for failure
        this.recordPerformanceSample(
            operationId,
            request.proposalType === 'booking' ? 'booking_exchange' : 'cash_payment',
            duration,
            false,
            completionError.code
        );

        return completionError;
    }

    /**
     * Record performance sample for monitoring
     * Requirements: 4.1, 4.3, 4.5
     */
    private recordPerformanceSample(
        completionId: string,
        operationType: 'booking_exchange' | 'cash_payment',
        totalDuration: number,
        success: boolean,
        errorCode?: string,
        timingBreakdown?: {
            validationDuration?: number;
            databaseDuration?: number;
            blockchainDuration?: number;
            notificationDuration?: number;
        }
    ): void {
        try {
            const memUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            const sample: PerformanceSample = {
                timestamp: new Date(),
                completionId,
                operationType,
                totalDuration,
                validationDuration: timingBreakdown?.validationDuration || 0,
                databaseDuration: timingBreakdown?.databaseDuration || 0,
                blockchainDuration: timingBreakdown?.blockchainDuration || 0,
                notificationDuration: timingBreakdown?.notificationDuration || 0,
                cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage approximation
                memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
                queueWaitTime: 0, // Would be populated by queue system
                queueLength: 0, // Would be populated by queue system
                success,
                errorCode
            };

            this.performanceMonitoringService.recordPerformanceSample(sample);
        } catch (error) {
            logger.warn('Failed to record performance sample', {
                completionId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Record blockchain transaction metrics
     * Requirements: 4.1, 4.3, 4.5
     */
    private recordBlockchainMetrics(
        completionId: string,
        transactionId: string,
        success: boolean,
        confirmationTimeMs: number
    ): void {
        try {
            this.monitoringService.recordBlockchainTransaction(
                completionId,
                transactionId,
                success,
                confirmationTimeMs
            );
        } catch (error) {
            logger.warn('Failed to record blockchain metrics', {
                completionId,
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Record rollback operation for monitoring
     * Requirements: 4.1, 4.3, 4.5
     */
    private recordRollbackOperation(
        completionId: string,
        success: boolean,
        durationMs: number,
        error?: SwapCompletionError
    ): void {
        try {
            this.monitoringService.recordRollback(
                completionId,
                success,
                durationMs,
                error
            );
        } catch (monitoringError) {
            logger.warn('Failed to record rollback metrics', {
                completionId,
                error: monitoringError instanceof Error ? monitoringError.message : String(monitoringError)
            });
        }
    }

    /**
     * Get completion monitoring metrics
     * Requirements: 4.1, 4.3, 4.5
     */
    getMonitoringMetrics() {
        return this.monitoringService.getMetrics();
    }

    /**
     * Get completion error logs
     * Requirements: 4.1, 4.3, 4.5
     */
    getErrorLogs(options: {
        startDate?: Date;
        endDate?: Date;
        errorCodes?: string[];
        severity?: string[];
        userId?: string;
        completionId?: string;
        resolved?: boolean;
        limit?: number;
    } = {}) {
        return this.errorLoggingService.getErrorLogs(options);
    }

    /**
     * Get active alerts
     * Requirements: 4.1, 4.3, 4.5
     */
    getActiveAlerts(severity?: 'info' | 'warning' | 'error' | 'critical') {
        return this.alertingService.getActiveAlerts(severity);
    }

    /**
     * Generate performance report
     * Requirements: 4.1, 4.3, 4.5
     */
    generatePerformanceReport(timeRange?: number) {
        return this.performanceMonitoringService.generatePerformanceReport(timeRange);
    }

    /**
     * Generate error analysis report
     * Requirements: 4.1, 4.3, 4.5
     */
    generateErrorAnalysisReport(startDate?: Date, endDate?: Date) {
        return this.errorLoggingService.generateErrorAnalysisReport(startDate, endDate);
    }

    /**
     * Acknowledge an alert
     * Requirements: 4.1, 4.3, 4.5
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
        return this.alertingService.acknowledgeAlert(alertId, acknowledgedBy);
    }

    /**
     * Resolve an alert
     * Requirements: 4.1, 4.3, 4.5
     */
    resolveAlert(alertId: string, resolvedBy: string): boolean {
        return this.alertingService.resolveAlert(alertId, resolvedBy);
    }
}