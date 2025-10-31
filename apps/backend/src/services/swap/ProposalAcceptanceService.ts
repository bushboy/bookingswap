import {
    SwapProposal,
    PaymentTransaction,
    PaymentRequest,
    EscrowReleaseRequest,
    PaymentProcessingResult,
    PaymentSecurityContext,
    PaymentStatus,
    Swap,
    SwapStatus
} from '@booking-swap/shared';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { HederaService, TransactionData } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapProposalMetadataRepository, ProposalMetadataEntity } from '../../database/repositories/SwapProposalMetadataRepository';
import { EnhancedProposalRepository } from '../../database/repositories/EnhancedProposalRepository';
import { BookingService } from '../booking/BookingService';
import { ProposalAcceptanceError, PROPOSAL_ACCEPTANCE_ERROR_CODES, ProposalAcceptanceErrorContext } from './ProposalAcceptanceError';
import { ProposalRollbackManager, RollbackStep } from './ProposalRollbackManager';
import { ProposalAcceptanceErrorLogger } from './ProposalAcceptanceErrorLogger';
import { ProposalTransactionManager } from './ProposalTransactionManager';
import { SwapCompletionOrchestrator } from './SwapCompletionOrchestrator';
import { SwapCompletionRequest, SwapCompletionResult, SwapCompletionError, SwapCompletionErrorCodes } from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface ProposalAcceptanceRequest {
    proposalId: string;
    userId: string;
    action: 'accept' | 'reject';
    rejectionReason?: string;
    swapTargetId?: string; // Target swap ID for booking proposals - should be used as primary lookup ID
}

export interface ProposalAcceptanceResult {
    proposal: SwapProposal;
    swap?: any; // Will be typed properly when Swap interface is available
    paymentTransaction?: PaymentTransaction;
    blockchainTransaction: {
        transactionId: string;
        consensusTimestamp?: string;
    };
}

export interface ProposalAcceptanceWithCompletionResult extends ProposalAcceptanceResult {
    completion?: SwapCompletionResult;
}

export interface FinancialTransferRequest {
    proposal: SwapProposal;
    securityContext?: PaymentSecurityContext;
}

export interface FinancialTransferResult {
    paymentTransaction: PaymentTransaction;
    escrowReleased: boolean;
    transferAmount: number;
    fees: {
        platformFee: number;
        processingFee: number;
        totalFees: number;
        netAmount: number;
    };
}

export class ProposalAcceptanceService {
    private rollbackManager: ProposalRollbackManager;
    private errorLogger: ProposalAcceptanceErrorLogger;
    private completionOrchestrator: SwapCompletionOrchestrator;

    constructor(
        private paymentService: PaymentProcessingService,
        private hederaService: HederaService,
        private notificationService: NotificationService,
        private swapRepository: SwapRepository,
        private bookingService: BookingService,
        private transactionManager: ProposalTransactionManager,
        private enhancedProposalRepository: EnhancedProposalRepository,
        private proposalMetadataRepository?: SwapProposalMetadataRepository
    ) {
        this.rollbackManager = new ProposalRollbackManager(
            transactionManager.pool,
            transactionManager,
            paymentService,
            hederaService,
            notificationService
        );
        this.errorLogger = new ProposalAcceptanceErrorLogger();
        this.completionOrchestrator = new SwapCompletionOrchestrator(
            transactionManager.pool,
            hederaService,
            notificationService
        );
    }

    /**
     * Accept a proposal with validation, coordination, and financial transfer processing
     * Enhanced with comprehensive error handling and rollback capabilities
     * Now uses completion workflow for atomic entity updates
     * Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 6.4, 6.5
     */
    async acceptProposal(request: ProposalAcceptanceRequest): Promise<ProposalAcceptanceResult> {
        logger.info('Accepting proposal using completion workflow', {
            proposalId: request.proposalId,
            userId: request.userId
        });

        try {
            // Use the new completion workflow for all proposal acceptances
            const result = await this.acceptProposalWithCompletion(request);

            // Return the standard result format for backward compatibility
            return {
                proposal: result.proposal,
                swap: result.completion?.completedSwaps?.[0] ? {
                    id: result.completion.completedSwaps[0].swapId,
                    status: result.completion.completedSwaps[0].newStatus
                } : undefined,
                paymentTransaction: result.paymentTransaction,
                blockchainTransaction: result.blockchainTransaction
            };

        } catch (error) {
            logger.error('Proposal acceptance failed with completion workflow', {
                proposalId: request.proposalId,
                error: error instanceof Error ? error.message : String(error)
            });

            // If completion workflow fails, fall back to legacy acceptance method
            logger.info('Falling back to legacy acceptance method', {
                proposalId: request.proposalId
            });

            return this.acceptProposalLegacy(request);
        }
    }

    /**
     * Legacy proposal acceptance method (fallback)
     * Maintains original acceptance logic for backward compatibility
     * Requirements: 1.1, 1.2, 6.1, 6.2, 6.3, 6.4, 6.5
     */
    private async acceptProposalLegacy(request: ProposalAcceptanceRequest): Promise<ProposalAcceptanceResult> {
        const operationStartTime = new Date();
        const completedSteps: RollbackStep[] = [];
        let currentStep: string = 'initialization';

        const errorContext: ProposalAcceptanceErrorContext = {
            proposalId: request.proposalId,
            userId: request.userId,
            action: 'accept',
            operationStartTime,
            errorSource: 'validation'
        };

        try {
            logger.info('Processing proposal acceptance with comprehensive error handling', {
                proposalId: request.proposalId,
                userId: request.userId,
                swapTargetId: request.swapTargetId,
                usingSwapTargetId: !!request.swapTargetId
            });

            // Step 1: Validate and authorize the proposal acceptance
            currentStep = 'validation';
            errorContext.errorSource = 'validation';

            logger.info('Starting proposal validation', {
                proposalId: request.proposalId,
                userId: request.userId,
                action: 'accept'
            });

            const proposal = await this.validateAndAuthorizeProposal(request.proposalId, request.userId, 'accept');

            logger.info('Proposal fetched successfully', {
                proposalId: proposal.id,
                status: proposal.status,
                proposerId: proposal.proposerId,
                targetUserId: proposal.targetUserId,
                proposalType: proposal.proposalType
            });

            completedSteps.push({
                stepId: uuidv4(),
                stepName: 'proposal_validation',
                stepType: 'database',
                executedAt: new Date(),
                rollbackRequired: false,
                rollbackCompleted: false
            });

            // Step 2: Validate proposal can be accepted
            if (proposal.status !== 'pending') {
                throw ProposalAcceptanceError.proposalNotFound(request.proposalId, {
                    ...errorContext,
                    metadata: { currentStatus: proposal.status, expectedStatus: 'pending' }
                });
            }

            // Step 3: Check if proposal has expired
            if (proposal.expiresAt && new Date() > proposal.expiresAt) {
                throw new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.PROPOSAL_EXPIRED,
                    'Proposal has expired and cannot be accepted',
                    { ...errorContext, metadata: { expiresAt: proposal.expiresAt } }
                );
            }

            // Step 4: Validate user authorization to accept this proposal
            await this.validateAcceptanceAuthorization(proposal, request.userId);

            // Step 5: Process financial transfer if this is a cash proposal
            currentStep = 'payment_processing';
            errorContext.errorSource = 'payment';

            let paymentTransaction: PaymentTransaction | undefined;
            if (this.isFinancialProposal(proposal)) {
                try {
                    const transferResult = await this.processFinancialTransfer({
                        proposal,
                        securityContext: this.createSecurityContext(request.userId)
                    });
                    paymentTransaction = transferResult.paymentTransaction;

                    completedSteps.push({
                        stepId: uuidv4(),
                        stepName: 'payment_processing',
                        stepType: 'payment',
                        executedAt: new Date(),
                        rollbackRequired: true,
                        rollbackCompleted: false,
                        rollbackData: { paymentTransactionId: paymentTransaction.id }
                    });
                } catch (error) {
                    throw ProposalAcceptanceError.paymentProcessingFailed(
                        request.proposalId,
                        undefined,
                        error instanceof Error ? error : new Error(String(error)),
                        errorContext
                    );
                }
            }

            // Step 6: Create swap if this is a booking proposal
            currentStep = 'swap_creation';
            errorContext.errorSource = 'database';

            let swap: Swap | undefined;
            if (proposal.proposalType === 'booking' && proposal.targetSwapId) {
                try {
                    swap = await this.createSwapFromAcceptedProposal(proposal, request.userId);

                    completedSteps.push({
                        stepId: uuidv4(),
                        stepName: 'swap_creation',
                        stepType: 'database',
                        executedAt: new Date(),
                        rollbackRequired: true,
                        rollbackCompleted: false,
                        rollbackData: { swapId: swap.id }
                    });
                } catch (error) {
                    throw new ProposalAcceptanceError(
                        PROPOSAL_ACCEPTANCE_ERROR_CODES.SWAP_CREATION_FAILED,
                        'Failed to create swap from accepted proposal',
                        { ...errorContext, metadata: { targetSwapId: proposal.targetSwapId } },
                        error instanceof Error ? error : new Error(String(error))
                    );
                }
            }

            // Step 7: Record acceptance on blockchain
            currentStep = 'blockchain_recording';
            errorContext.errorSource = 'blockchain';

            let blockchainTransaction: { transactionId: string; consensusTimestamp?: string };
            try {
                blockchainTransaction = await this.recordBlockchainTransaction('accept', proposal);

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'blockchain_recording',
                    stepType: 'blockchain',
                    executedAt: new Date(),
                    rollbackRequired: true,
                    rollbackCompleted: false,
                    rollbackData: { blockchainTransactionId: blockchainTransaction.transactionId }
                });
            } catch (error) {
                throw new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED,
                    'Failed to record acceptance on blockchain',
                    errorContext,
                    error instanceof Error ? error : new Error(String(error))
                );
            }

            // Step 8: Update proposal status in database
            currentStep = 'database_update';
            errorContext.errorSource = 'database';

            try {
                await this.updateProposalStatus(proposal.id, 'accepted', request.userId);

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'proposal_status_update',
                    stepType: 'database',
                    executedAt: new Date(),
                    rollbackRequired: true,
                    rollbackCompleted: false
                });
            } catch (error) {
                throw ProposalAcceptanceError.databaseTransactionFailed(
                    request.proposalId,
                    'proposal_status_update',
                    error instanceof Error ? error : new Error(String(error)),
                    errorContext
                );
            }

            // Step 9: Send notifications
            currentStep = 'notification';
            errorContext.errorSource = 'notification';

            try {
                await this.sendAcceptanceNotifications(proposal, paymentTransaction, swap);

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'notification_sending',
                    stepType: 'notification',
                    executedAt: new Date(),
                    rollbackRequired: false,
                    rollbackCompleted: false
                });
            } catch (error) {
                // Notification failures are non-critical, log but don't fail the operation
                logger.warn('Notification sending failed but operation continues', {
                    proposalId: request.proposalId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            logger.info('Proposal accepted successfully with comprehensive error handling', {
                proposalId: request.proposalId,
                hasPayment: !!paymentTransaction,
                hasSwap: !!swap,
                blockchainTxId: blockchainTransaction.transactionId,
                operationDuration: Date.now() - operationStartTime.getTime()
            });

            return {
                proposal: { ...proposal, status: 'accepted', respondedAt: new Date(), respondedBy: request.userId },
                swap,
                paymentTransaction,
                blockchainTransaction
            };

        } catch (error) {
            const proposalError = error instanceof ProposalAcceptanceError
                ? error
                : new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.OPERATION_TIMEOUT,
                    `Proposal acceptance failed at step: ${currentStep}`,
                    { ...errorContext, metadata: { failedStep: currentStep } },
                    error instanceof Error ? error : new Error(String(error))
                );

            // Log the error with comprehensive context
            this.errorLogger.logError(proposalError, operationStartTime, { currentStep, completedSteps: completedSteps.length });

            // Attempt rollback if required
            if (proposalError.rollbackRequired && completedSteps.length > 0) {
                try {
                    logger.info('Initiating rollback for failed proposal acceptance', {
                        proposalId: request.proposalId,
                        completedSteps: completedSteps.length,
                        errorCode: proposalError.code
                    });

                    const rollbackResult = await this.rollbackManager.rollbackAcceptance(
                        request.proposalId,
                        request.userId,
                        proposalError,
                        completedSteps,
                        errorContext
                    );

                    this.errorLogger.logRollbackOperation(
                        rollbackResult.rollbackData,
                        rollbackResult,
                        Date.now() - operationStartTime.getTime()
                    );

                    if (!rollbackResult.success) {
                        logger.error('Rollback failed or incomplete', {
                            proposalId: request.proposalId,
                            rollbackId: rollbackResult.rollbackId,
                            stepsRolledBack: rollbackResult.stepsRolledBack,
                            stepsFailed: rollbackResult.stepsFailed,
                            manualInterventionRequired: rollbackResult.manualInterventionRequired
                        });
                    }
                } catch (rollbackError) {
                    logger.error('Rollback operation failed', {
                        proposalId: request.proposalId,
                        originalError: proposalError.message,
                        rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                    });
                }
            }

            throw proposalError;
        }
    }

    /**
     * Accept a proposal with comprehensive completion workflow
     * Integrates with SwapCompletionOrchestrator for atomic entity updates
     * Requirements: 1.1, 1.5, 4.1, 4.4
     */
    async acceptProposalWithCompletion(request: ProposalAcceptanceRequest): Promise<ProposalAcceptanceWithCompletionResult> {
        const operationStartTime = new Date();
        let currentStep: string = 'initialization';

        const errorContext: ProposalAcceptanceErrorContext = {
            proposalId: request.proposalId,
            userId: request.userId,
            action: 'accept',
            operationStartTime,
            errorSource: 'validation'
        };

        try {
            logger.info('Processing proposal acceptance with completion workflow', {
                proposalId: request.proposalId,
                userId: request.userId,
                swapTargetId: request.swapTargetId,
                useCompletionWorkflow: true
            });

            // Step 1: Validate and authorize the proposal acceptance
            currentStep = 'validation';
            errorContext.errorSource = 'validation';

            const proposal = await this.validateAndAuthorizeProposal(request.proposalId, request.userId, 'accept');

            logger.info('Proposal validated for completion workflow', {
                proposalId: proposal.id,
                status: proposal.status,
                proposalType: proposal.proposalType
            });

            // Step 2: Process financial transfer if this is a cash proposal
            currentStep = 'payment_processing';
            errorContext.errorSource = 'payment';

            let paymentTransaction: PaymentTransaction | undefined;
            if (this.isFinancialProposal(proposal)) {
                try {
                    const transferResult = await this.processFinancialTransfer({
                        proposal,
                        securityContext: this.createSecurityContext(request.userId)
                    });
                    paymentTransaction = transferResult.paymentTransaction;

                    logger.info('Payment processed for completion workflow', {
                        proposalId: proposal.id,
                        transactionId: paymentTransaction.id,
                        amount: paymentTransaction.amount
                    });
                } catch (error) {
                    throw ProposalAcceptanceError.paymentProcessingFailed(
                        request.proposalId,
                        undefined,
                        error instanceof Error ? error : new Error(String(error)),
                        errorContext
                    );
                }
            }

            // Step 3: Orchestrate swap completion workflow
            currentStep = 'completion_orchestration';
            errorContext.errorSource = 'database';

            let completionResult: SwapCompletionResult | undefined;
            try {
                completionResult = await this.orchestrateSwapCompletion(proposal, request.userId);

                logger.info('Swap completion orchestrated successfully', {
                    proposalId: proposal.id,
                    completedSwaps: completionResult.completedSwaps.length,
                    updatedBookings: completionResult.updatedBookings.length
                });
            } catch (error) {
                await this.handleCompletionFailure(proposal, error, paymentTransaction);
                throw error;
            }

            // Step 4: Record acceptance on blockchain (if not already done by completion workflow)
            currentStep = 'blockchain_recording';
            errorContext.errorSource = 'blockchain';

            let blockchainTransaction = completionResult.blockchainTransaction;

            // If completion workflow didn't record blockchain transaction, do it now
            if (!blockchainTransaction || blockchainTransaction.transactionId.startsWith('failed_')) {
                try {
                    blockchainTransaction = await this.recordBlockchainTransaction('accept', proposal);
                } catch (error) {
                    throw new ProposalAcceptanceError(
                        PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED,
                        'Failed to record acceptance on blockchain',
                        errorContext,
                        error instanceof Error ? error : new Error(String(error))
                    );
                }
            }

            logger.info('Proposal accepted successfully with completion workflow', {
                proposalId: request.proposalId,
                hasPayment: !!paymentTransaction,
                hasCompletion: !!completionResult,
                blockchainTxId: blockchainTransaction.transactionId,
                operationDuration: Date.now() - operationStartTime.getTime()
            });

            return {
                proposal: completionResult.proposal,
                paymentTransaction,
                blockchainTransaction,
                completion: completionResult
            };

        } catch (error) {
            const proposalError = error instanceof ProposalAcceptanceError
                ? error
                : new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.OPERATION_TIMEOUT,
                    `Proposal acceptance with completion failed at step: ${currentStep}`,
                    { ...errorContext, metadata: { failedStep: currentStep } },
                    error instanceof Error ? error : new Error(String(error))
                );

            // Log the error with comprehensive context
            this.errorLogger.logError(proposalError, operationStartTime, { currentStep, useCompletionWorkflow: true });

            throw proposalError;
        }
    }

    /**
     * Orchestrate swap completion workflow
     * Coordinates with SwapCompletionOrchestrator for atomic entity updates
     * Requirements: 1.1, 4.1, 4.4
     */
    private async orchestrateSwapCompletion(
        proposal: SwapProposal,
        acceptingUserId: string
    ): Promise<SwapCompletionResult> {
        try {
            logger.info('Orchestrating swap completion', {
                proposalId: proposal.id,
                proposalType: proposal.proposalType,
                acceptingUserId
            });

            // Prepare completion request
            const completionRequest: SwapCompletionRequest = {
                proposalId: proposal.id,
                acceptingUserId,
                proposalType: proposal.proposalType === 'cash' ? 'cash' : 'booking',
                sourceSwapId: proposal.sourceSwapId,
                targetSwapId: proposal.targetSwapId,
                paymentTransactionId: undefined // Will be set if payment was processed
            };

            // Execute appropriate completion workflow based on proposal type
            let completionResult: SwapCompletionResult;

            if (proposal.proposalType === 'booking' && proposal.targetSwapId) {
                // Booking exchange completion
                completionResult = await this.completionOrchestrator.completeSwapExchange(completionRequest);
            } else if (proposal.proposalType === 'cash') {
                // Cash payment completion
                completionResult = await this.completionOrchestrator.completeCashSwap(completionRequest);
            } else {
                throw new SwapCompletionError(
                    SwapCompletionErrorCodes.INVALID_PROPOSAL_STATE,
                    `Invalid proposal type for completion: ${proposal.proposalType}`,
                    [proposal.id]
                );
            }

            logger.info('Swap completion orchestration successful', {
                proposalId: proposal.id,
                completionType: proposal.proposalType,
                completedSwaps: completionResult.completedSwaps.length,
                updatedBookings: completionResult.updatedBookings.length
            });

            return completionResult;

        } catch (error) {
            logger.error('Swap completion orchestration failed', {
                proposalId: proposal.id,
                acceptingUserId,
                error: error instanceof Error ? error.message : String(error)
            });

            if (error instanceof SwapCompletionError) {
                throw error;
            }

            throw new SwapCompletionError(
                SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED,
                `Completion orchestration failed: ${error instanceof Error ? error.message : String(error)}`,
                [proposal.id]
            );
        }
    }

    /**
     * Handle completion workflow failures with proper error recovery
     * Requirements: 4.1, 4.4
     */
    private async handleCompletionFailure(
        proposal: SwapProposal,
        error: any,
        paymentTransaction?: PaymentTransaction
    ): Promise<void> {
        try {
            logger.info('Handling completion workflow failure', {
                proposalId: proposal.id,
                error: error instanceof Error ? error.message : String(error),
                hasPaymentTransaction: !!paymentTransaction
            });

            // Step 1: Log the completion failure for monitoring
            this.errorLogger.logRecoveryAttempt(
                proposal.id,
                proposal.targetUserId,
                'completion_failure_recovery',
                false,
                error instanceof Error ? error : new Error(String(error)),
                {
                    proposalType: proposal.proposalType,
                    hasPayment: !!paymentTransaction,
                    errorType: error instanceof SwapCompletionError ? error.code : 'unknown'
                }
            );

            // Step 2: Handle payment rollback if payment was processed
            if (paymentTransaction && this.isFinancialProposal(proposal)) {
                try {
                    await this.handlePaymentFailure(proposal, error);
                    logger.info('Payment rollback completed for completion failure', {
                        proposalId: proposal.id,
                        transactionId: paymentTransaction.id
                    });
                } catch (paymentRollbackError) {
                    logger.error('Payment rollback failed during completion failure recovery', {
                        proposalId: proposal.id,
                        paymentTransactionId: paymentTransaction.id,
                        rollbackError: paymentRollbackError instanceof Error ? paymentRollbackError.message : String(paymentRollbackError)
                    });
                }
            }

            // Step 3: Send failure notification to users
            try {
                await this.sendCompletionFailureNotification(proposal, error);
            } catch (notificationError) {
                logger.warn('Failed to send completion failure notification', {
                    proposalId: proposal.id,
                    notificationError: notificationError instanceof Error ? notificationError.message : String(notificationError)
                });
            }

            // Step 4: Record failure on blockchain for audit trail
            try {
                await this.recordBlockchainTransaction('rollback', proposal, {
                    reason: 'completion_failure',
                    originalError: error instanceof Error ? error.message : String(error),
                    rolledBackAt: new Date(),
                    hadPayment: !!paymentTransaction
                });
            } catch (blockchainError) {
                logger.warn('Failed to record completion failure on blockchain', {
                    proposalId: proposal.id,
                    blockchainError: blockchainError instanceof Error ? blockchainError.message : String(blockchainError)
                });
            }

            logger.info('Completion failure handling completed', {
                proposalId: proposal.id,
                recoveryActions: ['payment_rollback', 'failure_notification', 'blockchain_audit']
            });

        } catch (recoveryError) {
            logger.error('Completion failure recovery failed', {
                proposalId: proposal.id,
                originalError: error instanceof Error ? error.message : String(error),
                recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
            });

            // Don't throw recovery errors as they would mask the original completion error
        }
    }

    /**
     * Send completion failure notification to involved users
     * Requirements: 8.1, 8.5
     */
    private async sendCompletionFailureNotification(
        proposal: SwapProposal,
        error: any
    ): Promise<void> {
        try {
            const errorMessage = error instanceof SwapCompletionError
                ? error.message
                : 'An unexpected error occurred during swap completion';

            const errorCode = error instanceof SwapCompletionError ? error.code : 'UNKNOWN_ERROR';
            const rollbackSuccessful = true; // Assume rollback was successful if we reach this point
            const requiresManualIntervention = error instanceof SwapCompletionError &&
                [SwapCompletionErrorCodes.ROLLBACK_FAILED, SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES].includes(error.code);

            // Send comprehensive failure notification to the user who accepted the proposal
            await this.notificationService.sendSwapCompletionFailureNotification({
                proposalId: proposal.id,
                userId: proposal.targetUserId,
                errorMessage,
                errorCode,
                affectedEntities: error instanceof SwapCompletionError ? error.affectedEntities : undefined,
                rollbackSuccessful,
                requiresManualIntervention
            });

            // Send comprehensive failure notification to the proposal creator
            await this.notificationService.sendSwapCompletionFailureNotification({
                proposalId: proposal.id,
                userId: proposal.proposerId,
                errorMessage,
                errorCode,
                affectedEntities: error instanceof SwapCompletionError ? error.affectedEntities : undefined,
                rollbackSuccessful,
                requiresManualIntervention
            });

            // Send real-time WebSocket updates if available
            if (this.notificationService.webSocketService) {
                await this.notificationService.webSocketService.sendCompletionStatusUpdate({
                    proposalId: proposal.id,
                    status: 'failed',
                    completionType: proposal.proposalType === 'cash' ? 'cash_payment' : 'booking_exchange',
                    proposerId: proposal.proposerId,
                    targetUserId: proposal.targetUserId,
                    errorDetails: errorMessage
                });
            }

            logger.info('Comprehensive completion failure notifications sent', {
                proposalId: proposal.id,
                notifiedUsers: [proposal.targetUserId, proposal.proposerId],
                errorCode,
                requiresManualIntervention
            });

        } catch (notificationError) {
            logger.error('Failed to send completion failure notifications', {
                proposalId: proposal.id,
                error: notificationError instanceof Error ? notificationError.message : String(notificationError)
            });

            // Fallback to basic notification if comprehensive notification fails
            try {
                await this.notificationService.sendNotification(
                    'swap_completion_failed',
                    proposal.targetUserId,
                    {
                        title: 'Swap Completion Failed',
                        message: `Your swap acceptance could not be completed. Please check your dashboard for details.`,
                        proposalId: proposal.id,
                        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                    }
                );

                await this.notificationService.sendNotification(
                    'swap_completion_failed',
                    proposal.proposerId,
                    {
                        title: 'Swap Completion Failed',
                        message: `The acceptance of your swap proposal could not be completed. Please check your dashboard for details.`,
                        proposalId: proposal.id,
                        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                    }
                );
            } catch (fallbackError) {
                logger.error('Fallback completion failure notification also failed', {
                    proposalId: proposal.id,
                    fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                });
            }
        }
    }

    /**
     * Reject a proposal with reason tracking and validation
     * Enhanced with comprehensive error handling and rollback capabilities
     * Requirements: 2.1, 2.2, 6.1, 6.2, 6.3, 6.4, 6.5
     */
    async rejectProposal(request: ProposalAcceptanceRequest): Promise<ProposalAcceptanceResult> {
        const operationStartTime = new Date();
        const completedSteps: RollbackStep[] = [];
        let currentStep: string = 'initialization';

        const errorContext: ProposalAcceptanceErrorContext = {
            proposalId: request.proposalId,
            userId: request.userId,
            action: 'reject',
            operationStartTime,
            errorSource: 'validation'
        };

        try {
            logger.info('Processing proposal rejection with comprehensive error handling', {
                proposalId: request.proposalId,
                userId: request.userId,
                reason: request.rejectionReason,
                swapTargetId: request.swapTargetId,
                usingSwapTargetId: !!request.swapTargetId
            });

            // Step 1: Validate and authorize the proposal rejection
            currentStep = 'validation';
            errorContext.errorSource = 'validation';

            const proposal = await this.validateAndAuthorizeProposal(request.proposalId, request.userId, 'reject');

            completedSteps.push({
                stepId: uuidv4(),
                stepName: 'proposal_validation',
                stepType: 'database',
                executedAt: new Date(),
                rollbackRequired: false,
                rollbackCompleted: false
            });

            // Step 2: Validate proposal can be rejected
            if (proposal.status !== 'pending') {
                throw new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.INVALID_PROPOSAL_STATUS,
                    `Cannot reject proposal with status: ${proposal.status}`,
                    { ...errorContext, metadata: { currentStatus: proposal.status, expectedStatus: 'pending' } }
                );
            }

            // Step 3: Validate user authorization to reject this proposal
            await this.validateRejectionAuthorization(proposal, request.userId);

            // Step 4: Record rejection on blockchain
            currentStep = 'blockchain_recording';
            errorContext.errorSource = 'blockchain';

            let blockchainTransaction: { transactionId: string; consensusTimestamp?: string };
            try {
                blockchainTransaction = await this.recordBlockchainTransaction('reject', proposal, {
                    rejectionReason: request.rejectionReason
                });

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'blockchain_recording',
                    stepType: 'blockchain',
                    executedAt: new Date(),
                    rollbackRequired: true,
                    rollbackCompleted: false,
                    rollbackData: { blockchainTransactionId: blockchainTransaction.transactionId }
                });
            } catch (error) {
                throw new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED,
                    'Failed to record rejection on blockchain',
                    errorContext,
                    error instanceof Error ? error : new Error(String(error))
                );
            }

            // Step 5: Update proposal status in database
            currentStep = 'database_update';
            errorContext.errorSource = 'database';

            try {
                await this.updateProposalStatus(proposal.id, 'rejected', request.userId, request.rejectionReason);

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'proposal_status_update',
                    stepType: 'database',
                    executedAt: new Date(),
                    rollbackRequired: true,
                    rollbackCompleted: false
                });
            } catch (error) {
                throw ProposalAcceptanceError.databaseTransactionFailed(
                    request.proposalId,
                    'proposal_status_update',
                    error instanceof Error ? error : new Error(String(error)),
                    errorContext
                );
            }

            // Step 6: Send rejection notifications
            currentStep = 'notification';
            errorContext.errorSource = 'notification';

            try {
                await this.sendRejectionNotifications(proposal, request.rejectionReason);

                completedSteps.push({
                    stepId: uuidv4(),
                    stepName: 'notification_sending',
                    stepType: 'notification',
                    executedAt: new Date(),
                    rollbackRequired: false,
                    rollbackCompleted: false
                });
            } catch (error) {
                // Notification failures are non-critical, log but don't fail the operation
                logger.warn('Notification sending failed but operation continues', {
                    proposalId: request.proposalId,
                    error: error instanceof Error ? error.message : String(error)
                });
            }

            logger.info('Proposal rejected successfully with comprehensive error handling', {
                proposalId: request.proposalId,
                blockchainTxId: blockchainTransaction.transactionId,
                hasReason: !!request.rejectionReason,
                operationDuration: Date.now() - operationStartTime.getTime()
            });

            return {
                proposal: {
                    ...proposal,
                    status: 'rejected',
                    respondedAt: new Date(),
                    respondedBy: request.userId,
                    rejectionReason: request.rejectionReason
                },
                blockchainTransaction
            };

        } catch (error) {
            const proposalError = error instanceof ProposalAcceptanceError
                ? error
                : new ProposalAcceptanceError(
                    PROPOSAL_ACCEPTANCE_ERROR_CODES.OPERATION_TIMEOUT,
                    `Proposal rejection failed at step: ${currentStep}`,
                    { ...errorContext, metadata: { failedStep: currentStep } },
                    error instanceof Error ? error : new Error(String(error))
                );

            // Log the error with comprehensive context
            this.errorLogger.logError(proposalError, operationStartTime, { currentStep, completedSteps: completedSteps.length });

            // Attempt rollback if required
            if (proposalError.rollbackRequired && completedSteps.length > 0) {
                try {
                    logger.info('Initiating rollback for failed proposal rejection', {
                        proposalId: request.proposalId,
                        completedSteps: completedSteps.length,
                        errorCode: proposalError.code
                    });

                    const rollbackResult = await this.rollbackManager.rollbackRejection(
                        request.proposalId,
                        request.userId,
                        proposalError,
                        completedSteps,
                        errorContext
                    );

                    this.errorLogger.logRollbackOperation(
                        rollbackResult.rollbackData,
                        rollbackResult,
                        Date.now() - operationStartTime.getTime()
                    );

                    if (!rollbackResult.success) {
                        logger.error('Rollback failed or incomplete', {
                            proposalId: request.proposalId,
                            rollbackId: rollbackResult.rollbackId,
                            stepsRolledBack: rollbackResult.stepsRolledBack,
                            stepsFailed: rollbackResult.stepsFailed,
                            manualInterventionRequired: rollbackResult.manualInterventionRequired
                        });
                    }
                } catch (rollbackError) {
                    logger.error('Rollback operation failed', {
                        proposalId: request.proposalId,
                        originalError: proposalError.message,
                        rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                    });
                }
            }

            throw proposalError;
        }
    }

    /**
     * Process financial transfer for cash proposals
     */
    async processFinancialTransfer(request: FinancialTransferRequest): Promise<FinancialTransferResult> {
        try {
            logger.info('Processing financial transfer', {
                proposalId: request.proposal.id,
                amount: request.proposal.cashOffer?.amount,
                currency: request.proposal.cashOffer?.currency
            });

            if (!this.isFinancialProposal(request.proposal)) {
                throw new Error('Proposal is not a financial proposal');
            }

            const cashOffer = request.proposal.cashOffer!;

            // Step 1: Validate escrow account and identify transfer details
            const escrowValidation = await this.validateEscrowAccount(request.proposal);
            if (!escrowValidation.isValid) {
                throw new Error(`Escrow validation failed: ${escrowValidation.errors.join(', ')}`);
            }

            // Step 2: Calculate transfer amount from proposal terms
            const transferAmount = this.calculateTransferAmount(request.proposal);

            // Step 3: Process escrow release to recipient
            let paymentTransaction: PaymentTransaction;
            let escrowReleased = false;

            if (cashOffer.escrowAccountId) {
                // Release funds from escrow
                const escrowReleaseRequest: EscrowReleaseRequest = {
                    escrowId: cashOffer.escrowAccountId,
                    recipientId: request.proposal.targetUserId,
                    amount: transferAmount,
                    reason: 'Proposal accepted - releasing escrow funds'
                };

                paymentTransaction = await this.paymentService.releaseEscrow(escrowReleaseRequest);
                escrowReleased = true;

                logger.info('Escrow funds released successfully', {
                    proposalId: request.proposal.id,
                    escrowId: cashOffer.escrowAccountId,
                    amount: transferAmount,
                    transactionId: paymentTransaction.id
                });
            } else {
                // Process direct payment
                const paymentRequest: PaymentRequest = {
                    amount: transferAmount,
                    currency: cashOffer.currency,
                    payerId: request.proposal.proposerId,
                    recipientId: request.proposal.targetUserId,
                    paymentMethodId: cashOffer.paymentMethodId,
                    swapId: request.proposal.sourceSwapId,
                    proposalId: request.proposal.id,
                    escrowRequired: false
                };

                const paymentResult = await this.paymentService.processPayment(
                    paymentRequest,
                    request.securityContext
                );

                // Get the completed transaction
                paymentTransaction = await this.getPaymentTransaction(paymentResult.transactionId);

                logger.info('Direct payment processed successfully', {
                    proposalId: request.proposal.id,
                    amount: transferAmount,
                    transactionId: paymentTransaction.id
                });
            }

            // Step 4: Calculate fees from the payment transaction
            const fees = {
                platformFee: paymentTransaction.platformFee,
                processingFee: 0, // Included in platform fee
                totalFees: paymentTransaction.platformFee,
                netAmount: paymentTransaction.netAmount
            };

            // Step 5: Send payment completion notification
            await this.sendPaymentNotification(request.proposal, paymentTransaction, 'completed');

            logger.info('Financial transfer completed successfully', {
                proposalId: request.proposal.id,
                transactionId: paymentTransaction.id,
                escrowReleased,
                netAmount: fees.netAmount
            });

            return {
                paymentTransaction,
                escrowReleased,
                transferAmount,
                fees
            };
        } catch (error) {
            logger.error('Financial transfer failed', { error, proposalId: request.proposal.id });

            // Handle payment processing failures with proper rollback
            await this.handlePaymentFailure(request.proposal, error);
            throw error;
        }
    }

    /**
     * Validate escrow account identification and status
     */
    private async validateEscrowAccount(proposal: SwapProposal): Promise<{
        isValid: boolean;
        errors: string[];
        escrowStatus?: string;
    }> {
        try {
            const errors: string[] = [];

            if (!proposal.cashOffer?.escrowAccountId) {
                // No escrow account - this is valid for direct payments
                return { isValid: true, errors: [] };
            }

            // Check escrow account status
            const escrowStatus = await this.getEscrowStatus(proposal.cashOffer.escrowAccountId);

            if (!escrowStatus) {
                errors.push('Escrow account not found');
            } else if (escrowStatus !== 'funded' && escrowStatus !== 'active') {
                errors.push(`Escrow account is not ready for release (status: ${escrowStatus})`);
            }

            // Validate escrow amount matches proposal
            if (escrowStatus && proposal.cashOffer.amount) {
                const escrowAmount = await this.getEscrowAmount(proposal.cashOffer.escrowAccountId);
                if (escrowAmount !== proposal.cashOffer.amount) {
                    errors.push(`Escrow amount (${escrowAmount}) does not match proposal amount (${proposal.cashOffer.amount})`);
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                escrowStatus: escrowStatus || undefined
            };
        } catch (error) {
            logger.error('Escrow validation failed', { error, proposalId: proposal.id });
            return {
                isValid: false,
                errors: [`Escrow validation error: ${(error as Error).message}`]
            };
        }
    }

    /**
     * Calculate fund transfer amount from proposal terms
     */
    private calculateTransferAmount(proposal: SwapProposal): number {
        if (!proposal.cashOffer) {
            throw new Error('No cash offer found in proposal');
        }

        // For now, return the full cash offer amount
        // In a real implementation, this might include calculations for:
        // - Platform fees
        // - Partial payments
        // - Currency conversions
        // - Additional terms or conditions

        const baseAmount = proposal.cashOffer.amount;

        // Validate amount is positive and reasonable
        if (baseAmount <= 0) {
            throw new Error('Invalid transfer amount: must be positive');
        }

        if (baseAmount > 50000) { // Example maximum
            throw new Error('Transfer amount exceeds maximum allowed limit');
        }

        logger.info('Transfer amount calculated', {
            proposalId: proposal.id,
            baseAmount,
            currency: proposal.cashOffer.currency
        });

        return baseAmount;
    }

    /**
     * Handle payment processing failures with proper rollback
     */
    private async handlePaymentFailure(proposal: SwapProposal, error: any): Promise<void> {
        try {
            logger.info('Handling payment failure with rollback', {
                proposalId: proposal.id,
                error: error.message
            });

            // Step 1: Revert proposal status if it was changed
            if (proposal.status === 'accepted') {
                proposal.status = 'pending';
                proposal.respondedAt = undefined;
                proposal.respondedBy = undefined;

                logger.info('Reverted proposal status to pending', { proposalId: proposal.id });
            }

            // Step 2: Handle escrow-specific rollback
            if (proposal.cashOffer?.escrowAccountId) {
                try {
                    // Check if escrow was partially released and needs to be restored
                    const escrowStatus = await this.getEscrowStatus(proposal.cashOffer.escrowAccountId);
                    if (escrowStatus === 'released') {
                        logger.warn('Escrow was released but payment failed - manual intervention required', {
                            proposalId: proposal.id,
                            escrowId: proposal.cashOffer.escrowAccountId
                        });

                        // In a real implementation, this might trigger an alert or create a support ticket
                        logger.error('Manual intervention required for escrow rollback', {
                            type: 'payment_rollback_required',
                            proposalId: proposal.id,
                            escrowId: proposal.cashOffer.escrowAccountId,
                            error: error.message
                        });
                    }
                } catch (escrowError) {
                    logger.error('Failed to check escrow status during rollback', {
                        error: escrowError,
                        proposalId: proposal.id
                    });
                }
            }

            // Step 3: Send failure notification
            await this.sendPaymentNotification(proposal, undefined, 'failed', error.message);

            // Step 4: Record rollback on blockchain for transparency
            await this.recordBlockchainTransaction('rollback', proposal, {
                reason: 'payment_failure',
                originalError: error.message,
                rolledBackAt: new Date()
            });

            logger.info('Payment failure rollback completed', { proposalId: proposal.id });
        } catch (rollbackError) {
            logger.error('Failed to handle payment failure rollback', {
                error: rollbackError,
                originalError: error.message,
                proposalId: proposal.id
            });

            // Don't throw rollback errors as they would mask the original payment error
        }
    }

    /**
     * Record blockchain transaction for proposal actions with retry logic and exponential backoff
     * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
     */
    private async recordBlockchainTransaction(
        action: 'accept' | 'reject' | 'rollback',
        proposal: SwapProposal,
        additionalData?: Record<string, any>
    ): Promise<{ transactionId: string; consensusTimestamp?: string }> {
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info('Recording blockchain transaction', {
                    action,
                    proposalId: proposal.id,
                    attempt,
                    maxRetries
                });

                // Use specific HederaService methods for proposal acceptance/rejection transaction types
                let result: { transactionId: string; consensusTimestamp?: string };

                if (action === 'accept') {
                    // Use dedicated proposal acceptance method with proper transaction type
                    const transactionId = await this.hederaService.recordProposalAcceptance(
                        proposal.id,
                        proposal.targetUserId,
                        new Date()
                    );
                    result = { transactionId };
                } else if (action === 'reject') {
                    // Use dedicated proposal rejection method with proper transaction type
                    const transactionId = await this.hederaService.recordProposalRejection(
                        proposal.id,
                        proposal.targetUserId,
                        new Date(),
                        additionalData?.rejectionReason
                    );
                    result = { transactionId };
                } else {
                    // For rollback, use general transaction submission
                    const transactionData: TransactionData = {
                        type: 'swap_proposal_cancelled',
                        payload: {
                            proposalId: proposal.id,
                            swapId: proposal.sourceSwapId,
                            proposerId: proposal.proposerId,
                            targetUserId: proposal.targetUserId,
                            action,
                            timestamp: new Date(),
                            proposalType: proposal.proposalType,
                            ...(proposal.cashOffer && {
                                cashAmount: proposal.cashOffer.amount,
                                currency: proposal.cashOffer.currency
                            }),
                            ...additionalData
                        },
                        timestamp: new Date()
                    };

                    const submitResult = await this.hederaService.submitTransaction(transactionData);
                    result = {
                        transactionId: submitResult.transactionId,
                        consensusTimestamp: submitResult.consensusTimestamp
                    };
                }

                // Store blockchain transaction hash in database for reference
                await this.storeBlockchainTransactionHash(proposal.id, action, result.transactionId);

                logger.info('Blockchain transaction recorded successfully', {
                    action,
                    proposalId: proposal.id,
                    transactionId: result.transactionId,
                    consensusTimestamp: result.consensusTimestamp,
                    attempt
                });

                return result;

            } catch (error) {
                lastError = error as Error;

                logger.warn('Blockchain transaction attempt failed', {
                    action,
                    proposalId: proposal.id,
                    attempt,
                    maxRetries,
                    error: lastError.message
                });

                // If this is the last attempt, don't wait
                if (attempt === maxRetries) {
                    break;
                }

                // Exponential backoff: wait 2^attempt seconds (2s, 4s, 8s)
                const backoffMs = Math.pow(2, attempt) * 1000;
                logger.info('Retrying blockchain transaction with exponential backoff', {
                    proposalId: proposal.id,
                    attempt,
                    nextAttemptIn: `${backoffMs}ms`
                });

                await this.sleep(backoffMs);
            }
        }

        // All retries failed
        logger.error('Failed to record blockchain transaction after all retries', {
            action,
            proposalId: proposal.id,
            maxRetries,
            finalError: lastError?.message
        });

        throw new Error(`Blockchain transaction failed after ${maxRetries} attempts: ${lastError?.message}`);
    }

    /**
     * Store blockchain transaction hash in database for reference
     * Requirements: 5.5
     */
    private async storeBlockchainTransactionHash(
        proposalId: string,
        action: 'accept' | 'reject' | 'rollback',
        transactionId: string
    ): Promise<void> {
        try {
            // Update the proposal's blockchain tracking with the transaction hash
            if (action === 'accept' || action === 'reject') {
                // Store the response transaction ID in the proposal's blockchain field
                await this.updateProposalBlockchainData(proposalId, {
                    responseTransactionId: transactionId,
                    responseAction: action,
                    responseTimestamp: new Date()
                });
            }

            // If we have a proposal metadata repository, log the blockchain transaction for reference
            if (this.proposalMetadataRepository) {
                try {
                    const metadata = await this.proposalMetadataRepository.findByProposalId(proposalId);
                    if (metadata) {
                        logger.info('Blockchain transaction recorded for proposal with metadata', {
                            proposalId,
                            action,
                            transactionId,
                            metadataId: metadata.id,
                            originalBlockchainTxId: metadata.blockchainTransactionId
                        });
                    }
                } catch (metadataError) {
                    // Don't fail the main operation if metadata lookup fails
                    logger.warn('Failed to lookup proposal metadata for blockchain logging', {
                        error: metadataError,
                        proposalId,
                        action,
                        transactionId
                    });
                }
            }

            logger.debug('Blockchain transaction hash stored successfully', {
                proposalId,
                action,
                transactionId
            });
        } catch (error) {
            logger.error('Failed to store blockchain transaction hash', {
                error,
                proposalId,
                action,
                transactionId
            });
            // Don't throw - this is a secondary operation that shouldn't block the main flow
        }
    }

    /**
     * Update proposal blockchain data in the database
     */
    private async updateProposalBlockchainData(
        proposalId: string,
        blockchainData: {
            responseTransactionId: string;
            responseAction: string;
            responseTimestamp: Date;
        }
    ): Promise<void> {
        try {
            // Check if proposal exists in swap_proposals table
            const checkProposalQuery = `SELECT id FROM swap_proposals WHERE id = $1`;
            const proposalCheck = await this.transactionManager.pool.query(checkProposalQuery, [proposalId]);

            if (proposalCheck.rows.length > 0) {
                // Update swap_proposals table with blockchain response transaction ID
                const query = `
                    UPDATE swap_proposals
                    SET 
                        blockchain_response_transaction_id = $1,
                        updated_at = NOW()
                    WHERE id = $2
                `;

                await this.transactionManager.pool.query(query, [
                    blockchainData.responseTransactionId,
                    proposalId
                ]);

                logger.debug('Proposal blockchain data updated in swap_proposals', {
                    proposalId,
                    transactionId: blockchainData.responseTransactionId,
                    action: blockchainData.responseAction
                });
            } else {
                // Check if it's in swap_targets using proposalId as swap_targets.id
                const checkTargetQuery = `
                    SELECT st.id, st.source_swap_id 
                    FROM swap_targets st
                    WHERE st.id = $1
                    LIMIT 1
                `;
                const targetCheck = await this.transactionManager.pool.query(checkTargetQuery, [proposalId]);

                if (targetCheck.rows.length > 0) {
                    const sourceSwapId = targetCheck.rows[0].source_swap_id;

                    // Update the source swap's blockchain data using SwapRepository
                    await this.swapRepository.updateBlockchainInfo(sourceSwapId, {
                        executionTransactionId: blockchainData.responseTransactionId
                    });

                    logger.debug('Proposal blockchain data updated via swap_targets', {
                        proposalId,
                        targetId: targetCheck.rows[0].id,
                        sourceSwapId,
                        transactionId: blockchainData.responseTransactionId,
                        action: blockchainData.responseAction
                    });
                } else {
                    logger.warn('Proposal not found for blockchain update', { proposalId });
                }
            }
        } catch (error) {
            logger.error('Failed to update proposal blockchain data', {
                error,
                proposalId,
                blockchainData
            });
            throw error;
        }
    }

    /**
     * Sleep utility for exponential backoff
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send payment-related notifications
     * Requirements: 7.3, 7.4, 7.5
     */
    private async sendPaymentNotification(
        proposal: SwapProposal,
        paymentTransaction?: PaymentTransaction,
        status: 'completed' | 'failed' = 'completed',
        errorMessage?: string
    ): Promise<void> {
        try {
            if (status === 'completed' && paymentTransaction) {
                // Send enhanced payment completion notification
                await this.notificationService.sendProposalPaymentNotification({
                    proposalId: proposal.id,
                    transactionId: paymentTransaction.id,
                    amount: paymentTransaction.amount,
                    currency: paymentTransaction.currency,
                    status: 'completed',
                    recipientUserId: proposal.targetUserId,
                    payerUserId: proposal.proposerId,
                    swapId: proposal.sourceSwapId
                });

                // Send real-time WebSocket payment update
                if (this.notificationService.webSocketService) {
                    await this.notificationService.webSocketService.sendProposalPaymentUpdate({
                        proposalId: proposal.id,
                        transactionId: paymentTransaction.id,
                        status: 'completed',
                        amount: paymentTransaction.amount,
                        currency: paymentTransaction.currency,
                        recipientUserId: proposal.targetUserId,
                        payerUserId: proposal.proposerId
                    });
                }
            } else if (status === 'failed') {
                // Send enhanced payment failure notification
                await this.notificationService.sendProposalPaymentNotification({
                    proposalId: proposal.id,
                    transactionId: 'failed-' + proposal.id,
                    amount: proposal.cashOffer?.amount || 0,
                    currency: proposal.cashOffer?.currency || 'USD',
                    status: 'failed',
                    recipientUserId: proposal.targetUserId,
                    payerUserId: proposal.proposerId,
                    swapId: proposal.sourceSwapId,
                    errorMessage
                });

                // Send real-time WebSocket payment failure update
                if (this.notificationService.webSocketService) {
                    await this.notificationService.webSocketService.sendProposalPaymentUpdate({
                        proposalId: proposal.id,
                        transactionId: 'failed-' + proposal.id,
                        status: 'failed',
                        amount: proposal.cashOffer?.amount || 0,
                        currency: proposal.cashOffer?.currency || 'USD',
                        recipientUserId: proposal.targetUserId,
                        payerUserId: proposal.proposerId,
                        errorMessage
                    });
                }
            }

            logger.info('Enhanced payment notification sent', {
                proposalId: proposal.id,
                status,
                hasTransaction: !!paymentTransaction,
                hasWebSocket: !!this.notificationService.webSocketService
            });
        } catch (error) {
            logger.warn('Failed to send payment notification', {
                error,
                proposalId: proposal.id,
                status
            });
            // Don't throw notification errors as they shouldn't block the main flow
        }
    }

    /**
     * Check if proposal is a financial proposal requiring payment processing
     */
    private isFinancialProposal(proposal: SwapProposal): boolean {
        return proposal.proposalType === 'cash' && !!proposal.cashOffer;
    }

    /**
     * Create security context for payment processing
     */
    private createSecurityContext(userId: string): PaymentSecurityContext {
        return {
            userId,
            ipAddress: '0.0.0.0', // Would be provided by request context in real implementation
            deviceFingerprint: undefined,
            previousTransactions: 0, // Would be calculated from user history
            accountAge: 30 // Would be calculated from user creation date
        };
    }

    /**
     * Validate and authorize proposal access for acceptance/rejection
     * Integrates with SwapRepository for proposal lookup
     * Requirements: Add proposal validation and authorization checks
     */
    private async validateAndAuthorizeProposal(
        proposalId: string,
        userId: string,
        action: 'accept' | 'reject'
    ): Promise<SwapProposal> {
        logger.info('Fetching proposal from database', { proposalId });

        // Step 1: Fetch proposal using SwapRepository integration
        const proposal = await this.getProposal(proposalId);

        if (!proposal) {
            logger.error('Proposal not found in database', { proposalId });
            throw new Error('Proposal not found');
        }

        logger.info('Proposal fetched from database', {
            proposalId: proposal.id,
            status: proposal.status,
            targetUserId: proposal.targetUserId,
            proposerId: proposal.proposerId
        });

        // Step 2: Validate proposal exists and is accessible
        if (!proposal.id) {
            logger.error('Invalid proposal data - missing ID', { proposal });
            throw new Error('Invalid proposal data');
        }

        // Step 3: Enhanced authorization checks using SwapRepository
        logger.info('Validating proposal ownership', { proposalId, userId, targetUserId: proposal.targetUserId });
        await this.validateProposalOwnership(proposal, userId, action);
        logger.info('Proposal ownership validation passed', { proposalId, userId });

        // Step 4: Validate proposal is in correct state for the action
        if (proposal.status !== 'pending') {
            logger.error('Invalid proposal status', {
                proposalId,
                currentStatus: proposal.status,
                expectedStatus: 'pending',
                action
            });
            throw new Error(`Cannot ${action} proposal with status: ${proposal.status}`);
        }

        // Step 5: Check if proposal has expired
        if (proposal.expiresAt && new Date() > proposal.expiresAt) {
            logger.error('Proposal has expired', {
                proposalId,
                expiresAt: proposal.expiresAt,
                currentTime: new Date()
            });
            throw new Error(`Proposal has expired and cannot be ${action}ed`);
        }

        // Step 6: Additional validation for proposal integrity
        logger.info('Validating proposal integrity', { proposalId });
        await this.validateProposalIntegrity(proposal);
        logger.info('Proposal integrity validation passed', { proposalId });

        logger.info('Proposal validation and authorization passed', {
            proposalId,
            userId,
            action,
            proposalType: proposal.proposalType,
            status: proposal.status
        });

        return proposal;
    }

    /**
     * Validate proposal ownership and authorization using SwapRepository
     * Requirements: Add proposal validation and authorization checks
     */
    private async validateProposalOwnership(
        proposal: SwapProposal,
        userId: string,
        action: 'accept' | 'reject'
    ): Promise<void> {
        try {
            // For acceptance/rejection, user must be the target of the proposal
            if (proposal.targetUserId !== userId) {
                // Double-check by looking up the target swap and its booking
                if (proposal.targetSwapId) {
                    const targetSwap = await this.swapRepository.findById(proposal.targetSwapId);
                    if (targetSwap) {
                        const targetBooking = await this.bookingService.getBookingById(targetSwap.sourceBookingId);
                        if (targetBooking && targetBooking.userId === userId) {
                            // User owns the target booking, authorization granted
                            return;
                        }
                    }
                }

                throw new Error(`User ${userId} is not authorized to ${action} this proposal`);
            }

            logger.debug('Proposal ownership validation passed', {
                proposalId: proposal.id,
                userId,
                action,
                targetUserId: proposal.targetUserId
            });
        } catch (error) {
            logger.error('Proposal ownership validation failed', {
                error,
                proposalId: proposal.id,
                userId,
                action
            });
            throw error;
        }
    }

    /**
     * Validate proposal integrity and consistency
     * Requirements: Add proposal validation and authorization checks
     */
    private async validateProposalIntegrity(proposal: SwapProposal): Promise<void> {
        try {
            // Validate source swap exists
            const sourceSwap = await this.swapRepository.findById(proposal.sourceSwapId);
            if (!sourceSwap) {
                throw new Error('Source swap not found for proposal');
            }

            // Validate target swap exists (for booking proposals)
            if (proposal.targetSwapId) {
                const targetSwap = await this.swapRepository.findById(proposal.targetSwapId);
                if (!targetSwap) {
                    throw new Error('Target swap not found for proposal');
                }

                // Ensure target swap is still available
                if (targetSwap.status !== 'pending') {
                    throw new Error(`Target swap is no longer available (status: ${targetSwap.status})`);
                }
            }

            // Validate cash offer integrity (for financial proposals)
            if (proposal.proposalType === 'cash' && proposal.cashOffer) {
                if (proposal.cashOffer.amount <= 0) {
                    throw new Error('Invalid cash offer amount');
                }

                if (!proposal.cashOffer.currency) {
                    throw new Error('Cash offer currency is required');
                }
            }

            // Validate proposal hasn't been processed already
            if (proposal.respondedAt) {
                throw new Error('Proposal has already been responded to');
            }

            logger.debug('Proposal integrity validation passed', {
                proposalId: proposal.id,
                proposalType: proposal.proposalType,
                hasTargetSwap: !!proposal.targetSwapId,
                hasCashOffer: !!proposal.cashOffer
            });
        } catch (error) {
            logger.error('Proposal integrity validation failed', {
                error,
                proposalId: proposal.id
            });
            throw error;
        }
    }

    /**
     * Validate user authorization to accept a proposal
     */
    private async validateAcceptanceAuthorization(proposal: SwapProposal, userId: string): Promise<void> {
        // Verify user owns the target swap/booking
        if (proposal.targetSwapId) {
            const targetSwap = await this.swapRepository.findById(proposal.targetSwapId);
            if (!targetSwap) {
                throw new Error('Target swap not found');
            }

            // Get the booking associated with the target swap to verify ownership
            const targetBooking = await this.bookingService.getBookingById(targetSwap.sourceBookingId);
            if (!targetBooking || targetBooking.userId !== userId) {
                throw new Error('User does not own the target booking');
            }

            // Validate target booking is still available
            if (targetBooking.status !== 'available') {
                throw new Error(`Target booking is not available (status: ${targetBooking.status})`);
            }
        }

        // For cash proposals, verify user can receive payments
        if (proposal.proposalType === 'cash') {
            // Additional validation for cash proposals could be added here
            logger.info('Cash proposal acceptance authorized', {
                proposalId: proposal.id,
                userId,
                amount: proposal.cashOffer?.amount
            });
        }
    }

    /**
     * Validate user authorization to reject a proposal
     */
    private async validateRejectionAuthorization(proposal: SwapProposal, userId: string): Promise<void> {
        // Similar validation as acceptance, but less strict
        if (proposal.targetUserId !== userId) {
            throw new Error('User is not authorized to reject this proposal');
        }

        logger.info('Proposal rejection authorized', {
            proposalId: proposal.id,
            userId,
            proposalType: proposal.proposalType
        });
    }

    /**
     * Create a swap from an accepted booking proposal
     */
    private async createSwapFromAcceptedProposal(proposal: SwapProposal, userId: string): Promise<Swap> {
        if (!proposal.targetSwapId) {
            throw new Error('Cannot create swap: no target swap specified');
        }

        // Get source and target swaps
        const sourceSwap = await this.swapRepository.findById(proposal.sourceSwapId);
        const targetSwap = await this.swapRepository.findById(proposal.targetSwapId);

        if (!sourceSwap || !targetSwap) {
            throw new Error('Source or target swap not found');
        }

        // Create new swap representing the accepted exchange
        const swapData: Omit<Swap, 'id' | 'createdAt' | 'updatedAt'> = {
            sourceBookingId: sourceSwap.sourceBookingId,
            status: 'accepted' as SwapStatus,
            terms: {
                additionalPayment: proposal.cashOffer?.amount || 0,
                conditions: proposal.conditions || [],
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            },
            blockchain: {
                proposalTransactionId: proposal.blockchain?.proposalTransactionId || ''
            },
            timeline: {
                proposedAt: proposal.createdAt,
                respondedAt: new Date()
            }
        };

        const swap = await this.swapRepository.create(swapData);

        logger.info('Swap created from accepted proposal', {
            proposalId: proposal.id,
            swapId: swap.id,
            sourceBookingId: swap.sourceBookingId
        });

        return swap;
    }

    /**
     * Update proposal status in database
     * Updates either swap_proposals or swap_targets depending on where it's stored
     */
    private async updateProposalStatus(
        proposalId: string,
        status: 'accepted' | 'rejected',
        userId: string,
        rejectionReason?: string
    ): Promise<void> {
        try {
            logger.info('Updating proposal status', { proposalId, status });

            // Check if proposal exists in swap_proposals table
            const checkProposalQuery = `SELECT id FROM swap_proposals WHERE id = $1`;
            const proposalCheck = await this.transactionManager.pool.query(checkProposalQuery, [proposalId]);

            if (proposalCheck.rows.length > 0) {
                // Update swap_proposals table
                logger.info('Updating status in swap_proposals table', { proposalId, status });

                const updateQuery = `
                    UPDATE swap_proposals
                    SET 
                        status = $1,
                        responded_at = $2,
                        responded_by = $3,
                        rejection_reason = $4,
                        updated_at = NOW()
                    WHERE id = $5
                `;

                await this.transactionManager.pool.query(updateQuery, [
                    status,
                    new Date(),
                    userId,
                    rejectionReason || null,
                    proposalId
                ]);

                logger.info('swap_proposals updated successfully', { proposalId, status });
            } else {
                // Check if it's in swap_targets using the proposalId as swap_targets.id
                logger.info('Not in swap_proposals, checking swap_targets by ID', { proposalId });

                const checkTargetQuery = `
                    SELECT st.id, st.source_swap_id, st.target_swap_id
                    FROM swap_targets st
                    WHERE st.id = $1
                `;
                const targetCheck = await this.transactionManager.pool.query(checkTargetQuery, [proposalId]);

                if (targetCheck.rows.length > 0) {
                    // Update swap_targets table
                    const targetRow = targetCheck.rows[0];
                    const targetStatus = status === 'accepted' ? 'accepted' : 'rejected';

                    logger.info('Updating status in swap_targets table', {
                        proposalId,
                        status: targetStatus,
                        targetId: targetRow.id,
                        sourceSwapId: targetRow.source_swap_id
                    });

                    const updateTargetQuery = `
                        UPDATE swap_targets
                        SET 
                            status = $1,
                            updated_at = NOW()
                        WHERE id = $2
                    `;

                    await this.transactionManager.pool.query(updateTargetQuery, [
                        targetStatus,
                        targetRow.id
                    ]);

                    // Also update the source swap's status and timeline
                    await this.swapRepository.updateStatus(targetRow.source_swap_id, status);
                    await this.swapRepository.updateTimeline(targetRow.source_swap_id, {
                        respondedAt: new Date()
                    });

                    logger.info('swap_targets and source swap updated successfully', {
                        proposalId,
                        targetId: targetRow.id,
                        status,
                        sourceSwapId: targetRow.source_swap_id
                    });
                } else {
                    logger.error('Proposal not found in either table', { proposalId });
                    throw new Error(`Proposal ${proposalId} not found in swap_proposals or swap_targets`);
                }
            }

            // If we have a proposal metadata repository, update it as well
            if (this.proposalMetadataRepository) {
                try {
                    const metadata = await this.proposalMetadataRepository.findByProposalId(proposalId);
                    if (metadata) {
                        logger.debug('Proposal metadata found and could be updated', {
                            proposalId,
                            metadataId: metadata.id
                        });
                    }
                } catch (metadataError) {
                    logger.warn('Failed to update proposal metadata', {
                        error: metadataError,
                        proposalId
                    });
                }
            }

            logger.info('Proposal status updated successfully', {
                proposalId,
                status,
                userId,
                rejectionReason
            });
        } catch (error) {
            logger.error('Failed to update proposal status', {
                error,
                proposalId,
                status,
                userId
            });
            throw error;
        }
    }

    /**
     * Send acceptance notifications to relevant parties
     * Requirements: 7.1, 7.2, 7.5
     */
    private async sendAcceptanceNotifications(
        proposal: SwapProposal,
        paymentTransaction?: PaymentTransaction,
        swap?: Swap
    ): Promise<void> {
        try {
            // Get booking details for notifications
            const sourceBooking = await this.getBookingForNotification(proposal.sourceSwapId);
            const targetBooking = proposal.targetSwapId ? await this.getBookingForNotification(proposal.targetSwapId) : null;

            if (sourceBooking) {
                // Prepare notification data
                const notificationData = {
                    proposalId: proposal.id,
                    sourceSwapId: proposal.sourceSwapId,
                    targetSwapId: proposal.targetSwapId,
                    proposerId: proposal.proposerId,
                    targetUserId: proposal.targetUserId,
                    proposalType: proposal.proposalType,
                    sourceSwapDetails: {
                        title: sourceBooking.title,
                        location: `${sourceBooking.location.city}, ${sourceBooking.location.country}`,
                        dates: `${sourceBooking.dateRange.checkIn.toDateString()} - ${sourceBooking.dateRange.checkOut.toDateString()}`,
                        value: sourceBooking.swapValue,
                        accommodationType: sourceBooking.accommodationType,
                        guests: sourceBooking.guests
                    },
                    targetSwapDetails: targetBooking ? {
                        title: targetBooking.title,
                        location: `${targetBooking.location.city}, ${targetBooking.location.country}`,
                        dates: `${targetBooking.dateRange.checkIn.toDateString()} - ${targetBooking.dateRange.checkOut.toDateString()}`,
                        value: targetBooking.swapValue,
                        accommodationType: targetBooking.accommodationType,
                        guests: targetBooking.guests
                    } : undefined,
                    cashOffer: proposal.cashOffer ? {
                        amount: proposal.cashOffer.amount,
                        currency: proposal.cashOffer.currency,
                        escrowRequired: !!proposal.cashOffer.escrowAccountId
                    } : undefined,
                    swapId: swap?.id
                };

                // Send enhanced proposal acceptance notifications
                await this.notificationService.sendProposalAcceptanceNotification(notificationData);

                // Send real-time WebSocket update
                if (this.notificationService.webSocketService) {
                    await this.notificationService.webSocketService.sendProposalStatusUpdate({
                        proposalId: proposal.id,
                        status: 'accepted',
                        proposerId: proposal.proposerId,
                        targetUserId: proposal.targetUserId,
                        respondedBy: proposal.targetUserId,
                        respondedAt: new Date(),
                        paymentStatus: paymentTransaction ? 'completed' : undefined,
                        swapId: swap?.id
                    });
                }

                // Send payment completion notification if applicable
                if (paymentTransaction && proposal.proposalType === 'cash') {
                    await this.notificationService.sendProposalPaymentNotification({
                        proposalId: proposal.id,
                        transactionId: paymentTransaction.id,
                        amount: paymentTransaction.amount,
                        currency: paymentTransaction.currency,
                        status: 'completed',
                        recipientUserId: proposal.targetUserId,
                        payerUserId: proposal.proposerId,
                        swapId: swap?.id
                    });

                    // Send real-time payment update
                    if (this.notificationService.webSocketService) {
                        await this.notificationService.webSocketService.sendProposalPaymentUpdate({
                            proposalId: proposal.id,
                            transactionId: paymentTransaction.id,
                            status: 'completed',
                            amount: paymentTransaction.amount,
                            currency: paymentTransaction.currency,
                            recipientUserId: proposal.targetUserId,
                            payerUserId: proposal.proposerId
                        });
                    }
                }
            }

            logger.info('Enhanced acceptance notifications sent', {
                proposalId: proposal.id,
                hasPayment: !!paymentTransaction,
                hasSwap: !!swap,
                hasWebSocket: !!this.notificationService.webSocketService
            });
        } catch (error) {
            logger.error('Failed to send acceptance notifications', {
                error,
                proposalId: proposal.id
            });
            // Don't throw - notifications are non-critical
        }
    }

    /**
     * Send rejection notifications to relevant parties
     * Requirements: 7.1, 7.2, 7.3, 7.5
     */
    private async sendRejectionNotifications(proposal: SwapProposal, rejectionReason?: string): Promise<void> {
        try {
            // Get booking details for notifications
            const sourceBooking = await this.getBookingForNotification(proposal.sourceSwapId);
            const targetBooking = proposal.targetSwapId ? await this.getBookingForNotification(proposal.targetSwapId) : null;

            if (sourceBooking) {
                // Prepare notification data
                const notificationData = {
                    proposalId: proposal.id,
                    sourceSwapId: proposal.sourceSwapId,
                    targetSwapId: proposal.targetSwapId,
                    proposerId: proposal.proposerId,
                    targetUserId: proposal.targetUserId,
                    proposalType: proposal.proposalType,
                    rejectionReason,
                    sourceSwapDetails: {
                        title: sourceBooking.title,
                        location: `${sourceBooking.location.city}, ${sourceBooking.location.country}`,
                        dates: `${sourceBooking.dateRange.checkIn.toDateString()} - ${sourceBooking.dateRange.checkOut.toDateString()}`,
                        value: sourceBooking.swapValue,
                        accommodationType: sourceBooking.accommodationType,
                        guests: sourceBooking.guests
                    },
                    targetSwapDetails: targetBooking ? {
                        title: targetBooking.title,
                        location: `${targetBooking.location.city}, ${targetBooking.location.country}`,
                        dates: `${targetBooking.dateRange.checkIn.toDateString()} - ${targetBooking.dateRange.checkOut.toDateString()}`,
                        value: targetBooking.swapValue,
                        accommodationType: targetBooking.accommodationType,
                        guests: targetBooking.guests
                    } : undefined,
                    cashOffer: proposal.cashOffer ? {
                        amount: proposal.cashOffer.amount,
                        currency: proposal.cashOffer.currency
                    } : undefined
                };

                // Send enhanced proposal rejection notifications
                await this.notificationService.sendProposalRejectionNotification(notificationData);

                // Send real-time WebSocket update
                if (this.notificationService.webSocketService) {
                    await this.notificationService.webSocketService.sendProposalStatusUpdate({
                        proposalId: proposal.id,
                        status: 'rejected',
                        proposerId: proposal.proposerId,
                        targetUserId: proposal.targetUserId,
                        respondedBy: proposal.targetUserId,
                        respondedAt: new Date(),
                        rejectionReason
                    });
                }
            }

            logger.info('Enhanced rejection notifications sent', {
                proposalId: proposal.id,
                hasReason: !!rejectionReason,
                hasWebSocket: !!this.notificationService.webSocketService
            });
        } catch (error) {
            logger.error('Failed to send rejection notifications', {
                error,
                proposalId: proposal.id
            });
            // Don't throw - notifications are non-critical
        }
    }

    /**
     * Get booking details for notifications
     */
    private async getBookingForNotification(swapId: string): Promise<any> {
        try {
            const swap = await this.swapRepository.findById(swapId);
            if (!swap) {
                return null;
            }
            return await this.bookingService.getBookingById(swap.sourceBookingId);
        } catch (error) {
            logger.error('Failed to get booking for notification', { error, swapId });
            return null;
        }
    }

    /**
     * Get proposal from EnhancedProposalRepository with enhanced error handling
     * Requirements: 5.1 - Use EnhancedProposalRepository instead of direct database queries
     */
    private async getProposal(proposalId: string): Promise<SwapProposal | null> {
        try {
            logger.info('Fetching proposal from swap_proposals or swap_targets table', { proposalId });

            // First, try to find in swap_proposals table (cash proposals)
            const cashProposalQuery = `
                SELECT 
                    sp.id,
                    sp.source_swap_id,
                    sp.target_swap_id,
                    sp.proposer_id,
                    sp.target_user_id,
                    sp.proposal_type,
                    sp.status,
                    sp.cash_offer_amount,
                    sp.cash_offer_currency,
                    sp.message,
                    sp.conditions,
                    sp.expires_at,
                    sp.created_at,
                    sp.updated_at,
                    sp.responded_at,
                    'cash' as source_table
                FROM swap_proposals sp
                WHERE sp.id = $1
            `;

            const cashResult = await this.transactionManager.pool.query(cashProposalQuery, [proposalId]);

            if (cashResult.rows.length > 0) {
                const row = cashResult.rows[0];
                logger.info('Found cash proposal in swap_proposals table', {
                    proposalId,
                    sourceSwapId: row.source_swap_id,
                    targetSwapId: row.target_swap_id,
                    status: row.status
                });

                return {
                    id: row.id,
                    sourceSwapId: row.source_swap_id,
                    targetSwapId: row.target_swap_id,
                    proposerId: row.proposer_id,
                    targetUserId: row.target_user_id,
                    proposalType: 'cash',
                    status: row.status as any, // Already uses 'pending' status
                    cashOffer: row.cash_offer_amount ? {
                        amount: parseFloat(row.cash_offer_amount),
                        currency: row.cash_offer_currency || 'USD',
                        paymentMethodId: 'default', // Default payment method
                        escrowAccountId: undefined
                    } : undefined,
                    conditions: row.conditions || [],
                    message: row.message,
                    expiresAt: row.expires_at ? new Date(row.expires_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
                    respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
                    respondedBy: undefined,
                    rejectionReason: undefined,
                    blockchain: {
                        proposalTransactionId: '',
                        responseTransactionId: undefined
                    },
                    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
                    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
                };
            }

            // Not found in swap_proposals, try swap_targets table (booking proposals)
            const bookingProposalQuery = `
                SELECT 
                    st.id,
                    st.source_swap_id,
                    st.target_swap_id,
                    st.status,
                    st.created_at,
                    st.updated_at,
                    sb.user_id as proposer_id,
                    tb.user_id as target_user_id,
                    'booking' as source_table
                FROM swap_targets st
                JOIN swaps ss ON st.source_swap_id = ss.id
                JOIN bookings sb ON ss.source_booking_id = sb.id
                JOIN swaps ts ON st.target_swap_id = ts.id
                JOIN bookings tb ON ts.source_booking_id = tb.id
                WHERE st.id = $1
            `;

            const bookingResult = await this.transactionManager.pool.query(bookingProposalQuery, [proposalId]);

            if (bookingResult.rows.length > 0) {
                const row = bookingResult.rows[0];
                logger.info('Found booking proposal in swap_targets table', {
                    proposalId,
                    sourceSwapId: row.source_swap_id,
                    targetSwapId: row.target_swap_id,
                    status: row.status
                });

                // Normalize status: swap_targets uses 'active' to mean pending
                const normalizedStatus = row.status === 'active' ? 'pending' : row.status;

                return {
                    id: row.id,
                    sourceSwapId: row.source_swap_id,
                    targetSwapId: row.target_swap_id,
                    proposerId: row.proposer_id,
                    targetUserId: row.target_user_id,
                    proposalType: 'booking',
                    status: normalizedStatus as any, // Normalized: active → pending
                    cashOffer: undefined,
                    conditions: [],
                    message: undefined,
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Default to 30 days from now
                    respondedAt: undefined,
                    respondedBy: undefined,
                    rejectionReason: undefined,
                    blockchain: {
                        proposalTransactionId: '',
                        responseTransactionId: undefined
                    },
                    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
                    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date()
                };
            }

            logger.info('Proposal not found in either swap_proposals or swap_targets table', { proposalId });
            return null;
        } catch (error) {
            logger.error('Failed to get proposal from database', {
                error: error instanceof Error ? error.message : String(error),
                proposalId,
                requirement: '5.1'
            });

            // Enhanced error handling - if repository fails, provide meaningful error context
            if (error instanceof Error && error.message.includes('column') && error.message.includes('does not exist')) {
                logger.error('Database schema mismatch detected in proposal lookup', {
                    proposalId,
                    error: error.message,
                    suggestion: 'EnhancedProposalRepository should handle schema issues with fallback strategies',
                    requirement: '5.1'
                });
            }

            throw error;
        }
    }

    /**
     * Determine proposal type from metadata
     */
    private determineProposalType(metadata: ProposalMetadataEntity): 'booking' | 'cash' {
        // For now, default to booking type since metadata doesn't contain cash offer information
        // In a future enhancement, this could query the related swap data to determine if there's a cash component
        return 'booking';
    }

    /**
     * Extract cash offer information from metadata
     */
    private extractCashOfferFromMetadata(metadata: ProposalMetadataEntity): SwapProposal['cashOffer'] {
        // Metadata doesn't contain cash offer information
        // In a future enhancement, this could query the related swap data to get cash offer details
        return undefined;
    }



    /**
     * Map swap_targets status to proposal status
     */
    private mapSwapTargetStatusToProposalStatus(status: string): 'pending' | 'accepted' | 'rejected' | 'expired' {
        switch (status) {
            case 'active':
                return 'pending';
            case 'accepted':
                return 'accepted';
            case 'rejected':
                return 'rejected';
            case 'cancelled':
                return 'rejected';
            default:
                return 'pending';
        }
    }

    /**
     * Map SwapStatus to ProposalStatus for compatibility
     */
    private mapSwapStatusToProposalStatus(swapStatus: SwapStatus): 'pending' | 'accepted' | 'rejected' | 'expired' {
        switch (swapStatus) {
            case 'pending':
                return 'pending';
            case 'accepted':
            case 'completed':
                return 'accepted';
            case 'rejected':
            case 'cancelled':
                return 'rejected';
            default:
                return 'pending';
        }
    }

    private async getEscrowStatus(escrowId: string): Promise<string | null> {
        // Mock implementation - would check escrow status
        return 'funded';
    }

    private async getEscrowAmount(escrowId: string): Promise<number> {
        // Mock implementation - would get escrow amount
        return 100;
    }

    private async getPaymentTransaction(transactionId: string): Promise<PaymentTransaction> {
        // Mock implementation - would fetch from database
        return {
            id: transactionId,
            swapId: 'swap-123',
            proposalId: 'proposal-123',
            payerId: 'user-123',
            recipientId: 'user-456',
            amount: 100,
            currency: 'USD',
            status: 'completed',
            gatewayTransactionId: 'gw-123',
            platformFee: 5,
            netAmount: 95,
            completedAt: new Date(),
            blockchain: { transactionId: 'blockchain-123' },
            createdAt: new Date(),
            updatedAt: new Date()
        } as PaymentTransaction;
    }

    /**
     * Get error statistics for monitoring and alerting
     * Requirements: 6.5
     */
    getErrorStatistics(timeWindowHours: number = 24) {
        return this.errorLogger.getErrorStatistics(timeWindowHours);
    }

    /**
     * Get error trends for analysis
     * Requirements: 6.5
     */
    getErrorTrends(timeWindowHours: number = 24) {
        return this.errorLogger.generateErrorTrends(timeWindowHours);
    }

    /**
     * Get rollback operation status
     * Requirements: 6.2, 6.3
     */
    getRollbackStatus(rollbackId: string) {
        return this.rollbackManager.getRollbackStatus(rollbackId);
    }

    /**
     * Get all active rollback operations
     * Requirements: 6.2, 6.3
     */
    getActiveRollbacks() {
        return this.rollbackManager.getActiveRollbacks();
    }

    /**
     * Retry failed rollback operation
     * Requirements: 6.2, 6.3
     */
    async retryRollback(rollbackId: string) {
        return await this.rollbackManager.retryRollback(rollbackId);
    }

    /**
     * Log recovery attempt for monitoring
     * Requirements: 6.4, 6.5
     */
    logRecoveryAttempt(
        proposalId: string,
        userId: string,
        recoveryAction: string,
        success: boolean,
        error?: Error,
        context?: Record<string, any>
    ): void {
        this.errorLogger.logRecoveryAttempt(proposalId, userId, recoveryAction, success, error, context);
    }
}