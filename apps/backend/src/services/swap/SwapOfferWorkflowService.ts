import { PaymentTransaction, AuctionProposal } from '@booking-swap/shared';
import { Pool } from 'pg';
import { ForeignKeyValidationService } from '../validation/ForeignKeyValidationService';
import { EnhancedPaymentTransactionService, ValidatedPaymentTransactionRequest } from '../payment/EnhancedPaymentTransactionService';
import { EnhancedAuctionProposalService, CashProposalRequest } from '../auction/EnhancedAuctionProposalService';
import { SwapOfferErrorHandler, SwapOfferError, RollbackStep, RollbackContext } from './SwapOfferErrorHandler';
import { SwapOfferTransactionManager, TransactionContext } from './SwapOfferTransactionManager';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Core workflow types
export type OfferMode = 'auction' | 'direct';

export interface SwapOfferRequest {
    swapId: string;
    userId: string;
    offerMode: OfferMode; // User explicitly selects auction or direct
    amount?: number; // For cash offers
    currency?: string; // For cash offers
    paymentMethodId?: string; // For cash offers
    bookingId?: string; // For booking swap offers
    message?: string;
    conditions?: string[];
}

export interface SwapOfferResult {
    success: boolean;
    paymentTransaction: PaymentTransaction;
    auctionProposal?: AuctionProposal;
    offerMode: OfferMode;
    validationWarnings?: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metadata: {
        validatedAt: Date;
        validationType: string;
        scenario?: SwapScenario;
    };
}

export interface ValidationError {
    code: string;
    message: string;
    field?: string;
    constraint?: string;
    suggestedFix?: string;
}

export interface ValidationWarning {
    code: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    field?: string;
}

export interface SwapValidationResult {
    isValid: boolean;
    swap: EnhancedSwap;
    scenario: SwapScenario;
    acceptsCashOffers: boolean;
    errors: string[];
    warnings: string[];
}

export interface PaymentTransactionRequest {
    swapId: string;
    proposalId?: string | null; // Optional for first-match swaps
    payerId: string;
    recipientId: string;
    amount: number;
    currency: string;
    gatewayTransactionId: string;
    platformFee: number;
    blockchainTransactionId: string;
}

// Enhanced types from design document
export type SwapScenario = 'auction' | 'first_match';

export interface EnhancedSwap {
    id: string;
    ownerId: string;
    acceptanceStrategy: {
        type: SwapScenario;
        auctionEndDate?: Date;
        autoSelectHighest?: boolean;
    };
    paymentTypes: {
        bookingExchange: boolean;
        cashPayment: boolean;
        minimumCashAmount?: number;
    };
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

// Validation error codes
export const VALIDATION_ERROR_CODES = {
    SWAP_NOT_FOUND: 'SWAP_NOT_FOUND',
    PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    INVALID_PROPOSAL_REFERENCE: 'INVALID_PROPOSAL_REFERENCE',
    SCENARIO_MISMATCH: 'SCENARIO_MISMATCH',
    CASH_OFFERS_NOT_ACCEPTED: 'CASH_OFFERS_NOT_ACCEPTED',
    AUCTION_NOT_ACTIVE: 'AUCTION_NOT_ACTIVE',
    FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION'
} as const;

/**
 * Enhanced Swap Offer Workflow Service Interface
 * 
 * This service orchestrates the complete swap offer submission process,
 * handling both auction and direct swap scenarios while ensuring proper
 * validation and data consistency.
 */
export interface SwapOfferWorkflowService {
    /**
     * Main workflow orchestration method
     * Handles the complete swap offer submission process
     */
    submitSwapOffer(request: SwapOfferRequest): Promise<SwapOfferResult>;

    /**
     * Validation methods
     */
    validateSwapForOffer(swapId: string): Promise<SwapValidationResult>;
    validateForeignKeyReferences(request: PaymentTransactionRequest): Promise<ValidationResult>;

    /**
     * Scenario detection based on user choice
     * Uses user-selected offer mode instead of inferring from swap configuration
     */
    determineOfferMode(userSelectedMode: OfferMode): OfferMode;

    /**
     * Rollback methods for failed transactions
     */
    rollbackSwapOfferSubmission(transactionId: string): Promise<void>;
}

/**
 * Enhanced Swap Offer Workflow Service Implementation
 * 
 * This service orchestrates the complete swap offer submission process,
 * handling both auction and direct swap scenarios while ensuring proper
 * validation and data consistency.
 */
export class SwapOfferWorkflowServiceImpl implements SwapOfferWorkflowService {
    private foreignKeyValidationService: ForeignKeyValidationService;
    private errorHandler: SwapOfferErrorHandler;
    private transactionManager?: SwapOfferTransactionManager;

    constructor(
        private pool: Pool,
        private paymentService: EnhancedPaymentTransactionService,
        private auctionService: EnhancedAuctionProposalService,
        errorHandler?: SwapOfferErrorHandler,
        transactionManager?: SwapOfferTransactionManager
    ) {
        this.foreignKeyValidationService = new ForeignKeyValidationService(pool);
        this.errorHandler = errorHandler || new SwapOfferErrorHandlerImpl();
        this.transactionManager = transactionManager;
    }

    /**
     * Uses user-selected offer mode instead of inferring from swap configuration
     * Only create auction proposals when user explicitly selects auction mode
     * 
     * Requirements: 1.9, 2.6, 2.10
     */
    determineOfferMode(userSelectedMode: OfferMode): OfferMode {
        logger.info('Determining offer mode based on user selection', {
            userSelectedMode
        });

        // Simply return the user-selected mode - no inference from swap configuration
        // This ensures auction proposals are only created when users explicitly choose auction mode
        const determinedMode = userSelectedMode;

        logger.info('Offer mode determined', {
            userSelectedMode,
            determinedMode,
            reasoning: 'Direct user selection - no inference from swap configuration'
        });

        return determinedMode;
    }

    /**
     * Orchestrate the complete swap offer submission process
     * Handle user-selected offer mode and appropriate service calls
     * Uses enhanced transaction manager if available for better rollback tracking
     * 
     * Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2, 6.3
     */
    async submitSwapOffer(request: SwapOfferRequest): Promise<SwapOfferResult> {
        // Use enhanced transaction manager if available
        if (this.transactionManager) {
            logger.info('Using enhanced transaction manager for swap offer submission', {
                swapId: request.swapId,
                userId: request.userId,
                offerMode: request.offerMode
            });

            return this.transactionManager.executeCashOfferWorkflow(request);
        }

        // Fall back to legacy implementation
        return this.submitSwapOfferLegacy(request);
    }

    /**
     * Legacy swap offer submission implementation (for backward compatibility)
     */
    private async submitSwapOfferLegacy(request: SwapOfferRequest): Promise<SwapOfferResult> {
        const rollbackSteps: RollbackStep[] = [];
        let auctionProposal: AuctionProposal | undefined;
        let paymentTransaction: PaymentTransaction | undefined;

        try {
            logger.info('Starting swap offer submission workflow', {
                swapId: request.swapId,
                userId: request.userId,
                offerMode: request.offerMode,
                amount: request.amount,
                currency: request.currency
            });

            // Step 1: Determine offer mode based on user selection
            const offerMode = this.determineOfferMode(request.offerMode);

            // Step 2: Validate swap exists and accepts the type of offer being submitted
            const swapValidation = await this.validateSwapForOffer(request.swapId);
            if (!swapValidation.isValid) {
                throw new SwapOfferError(
                    VALIDATION_ERROR_CODES.SWAP_NOT_FOUND,
                    `Swap validation failed: ${swapValidation.errors.join(', ')}`,
                    {
                        swapId: request.swapId,
                        errors: swapValidation.errors,
                        warnings: swapValidation.warnings
                    }
                );
            }

            // Step 3: Validate swap supports the requested offer mode
            if (offerMode === 'auction' && swapValidation.scenario !== 'auction') {
                throw new SwapOfferError(
                    VALIDATION_ERROR_CODES.SCENARIO_MISMATCH,
                    'User selected auction mode but swap does not support auctions',
                    {
                        swapId: request.swapId,
                        userSelectedMode: offerMode,
                        swapScenario: swapValidation.scenario
                    }
                );
            }

            // Step 4: Validate cash offers are accepted if this is a cash offer
            if (request.amount && !swapValidation.acceptsCashOffers) {
                throw new SwapOfferError(
                    VALIDATION_ERROR_CODES.CASH_OFFERS_NOT_ACCEPTED,
                    'Swap does not accept cash offers',
                    {
                        swapId: request.swapId,
                        amount: request.amount,
                        currency: request.currency
                    }
                );
            }

            let proposalId: string | null = null;

            // Step 5: Create auction proposal if user explicitly selected auction mode
            if (offerMode === 'auction') {
                logger.info('Creating auction proposal for user-selected auction mode', {
                    swapId: request.swapId,
                    userId: request.userId,
                    offerMode
                });

                // Find the active auction for this swap
                const auctionQuery = `
                    SELECT id, status, end_date
                    FROM swap_auctions 
                    WHERE swap_id = $1 AND status = 'active'
                    ORDER BY created_at DESC
                    LIMIT 1
                `;

                const auctionResult = await this.pool.query(auctionQuery, [request.swapId]);
                if (auctionResult.rows.length === 0) {
                    throw new SwapOfferError(
                        VALIDATION_ERROR_CODES.AUCTION_NOT_ACTIVE,
                        'No active auction found for this swap',
                        {
                            swapId: request.swapId,
                            offerMode
                        }
                    );
                }

                const auction = auctionResult.rows[0];

                // Create auction proposal
                const proposalRequest: CashProposalRequest = {
                    auctionId: auction.id,
                    proposerId: request.userId,
                    cashOffer: {
                        amount: request.amount || 0,
                        currency: request.currency || 'USD',
                        paymentMethodId: request.paymentMethodId || '',
                        escrowRequired: true
                    },
                    message: request.message,
                    conditions: request.conditions || [],
                    blockchainTransactionId: uuidv4() // Generate temporary ID, will be updated later
                };

                auctionProposal = await this.auctionService.createCashProposal(proposalRequest);
                proposalId = auctionProposal.id;

                // Add rollback step for auction proposal
                rollbackSteps.push({
                    type: 'delete_auction_proposal',
                    data: { proposalId: auctionProposal.id },
                    timestamp: new Date()
                });

                logger.info('Auction proposal created successfully', {
                    proposalId: auctionProposal.id,
                    auctionId: auction.id,
                    swapId: request.swapId
                });
            }

            // Step 6: Create payment transaction with proper validation
            const paymentRequest: PaymentTransactionRequest = {
                swapId: request.swapId,
                proposalId: proposalId,
                payerId: request.userId,
                recipientId: swapValidation.swap.ownerId,
                amount: request.amount || 0,
                currency: request.currency || 'USD',
                gatewayTransactionId: uuidv4(), // Generate temporary ID
                platformFee: Math.round((request.amount || 0) * 0.05), // 5% platform fee
                blockchainTransactionId: uuidv4() // Generate temporary ID
            };

            // Validate payment transaction request
            const paymentValidation = await this.validateForeignKeyReferences(paymentRequest);
            if (!paymentValidation.isValid) {
                throw new SwapOfferError(
                    VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
                    `Payment transaction validation failed: ${paymentValidation.errors.map(e => e.message).join(', ')}`,
                    {
                        swapId: request.swapId,
                        proposalId,
                        validationErrors: paymentValidation.errors
                    }
                );
            }

            // Create validated payment transaction request
            const validatedRequest: ValidatedPaymentTransactionRequest = {
                ...paymentRequest,
                validationMetadata: {
                    swapExists: true,
                    proposalExists: proposalId ? true : null,
                    usersExist: true,
                    scenario: offerMode === 'auction' ? 'auction' : 'first_match',
                    validatedAt: new Date()
                }
            };

            paymentTransaction = await this.paymentService.createPaymentTransaction(validatedRequest);

            // Add rollback step for payment transaction
            rollbackSteps.push({
                type: 'delete_payment_transaction',
                data: { transactionId: paymentTransaction.id },
                timestamp: new Date()
            });

            logger.info('Payment transaction created successfully', {
                transactionId: paymentTransaction.id,
                swapId: request.swapId,
                proposalId,
                amount: request.amount,
                offerMode
            });

            // Step 7: Link payment transaction to auction proposal if applicable
            if (auctionProposal && paymentTransaction) {
                await this.auctionService.linkPaymentTransaction(
                    auctionProposal.id,
                    paymentTransaction.id
                );

                logger.info('Payment transaction linked to auction proposal', {
                    proposalId: auctionProposal.id,
                    transactionId: paymentTransaction.id
                });
            }

            // Step 8: Return successful result
            const result: SwapOfferResult = {
                success: true,
                paymentTransaction,
                auctionProposal,
                offerMode,
                validationWarnings: swapValidation.warnings
            };

            logger.info('Swap offer submission completed successfully', {
                swapId: request.swapId,
                userId: request.userId,
                offerMode,
                transactionId: paymentTransaction.id,
                proposalId: auctionProposal?.id,
                warningCount: swapValidation.warnings.length
            });

            return result;

        } catch (error) {
            logger.error('Swap offer submission failed, executing rollback', {
                swapId: request.swapId,
                userId: request.userId,
                offerMode: request.offerMode,
                error: error instanceof Error ? error.message : String(error),
                rollbackStepsCount: rollbackSteps.length
            });

            // Execute rollback steps in reverse order
            await this.executeRollbackSteps(rollbackSteps);

            // Re-throw the error
            if (error instanceof SwapOfferError) {
                throw error;
            }

            // Wrap unexpected errors
            throw new SwapOfferError(
                'SWAP_OFFER_SUBMISSION_FAILED',
                `Swap offer submission failed: ${error instanceof Error ? error.message : String(error)}`,
                {
                    swapId: request.swapId,
                    userId: request.userId,
                    offerMode: request.offerMode,
                    originalError: error instanceof Error ? error.message : String(error)
                }
            );
        }
    }

    /**
     * Create a transaction context for rollback tracking
     * Used by the enhanced transaction manager
     */
    createTransactionContext(request: SwapOfferRequest): TransactionContext {
        return {
            transactionId: '',
            swapId: request.swapId,
            userId: request.userId,
            proposalId: null,
            rollbackSteps: [],
            startTime: new Date(),
            operationId: uuidv4()
        };
    }

    /**
     * Add rollback step to transaction context
     * Used during workflow execution to track rollback operations
     */
    addRollbackStep(context: TransactionContext, step: RollbackStep): void {
        context.rollbackSteps.push(step);

        logger.debug('Rollback step added to workflow context', {
            operationId: context.operationId,
            stepType: step.type,
            rollbackStepsCount: context.rollbackSteps.length,
            swapId: context.swapId
        });
    }

    /**
     * Validates that a swap exists and accepts the type of offer being submitted
     * Skips auction-specific validation unless user explicitly selects auction mode
     */
    async validateSwapForOffer(swapId: string): Promise<SwapValidationResult> {
        return this.foreignKeyValidationService.validateSwapForOffer(swapId);
    }

    /**
     * Validates all foreign key references before transaction creation
     */
    async validateForeignKeyReferences(request: PaymentTransactionRequest): Promise<ValidationResult> {
        return this.foreignKeyValidationService.validateForeignKeyReferences(request);
    }

    /**
     * Rollback swap offer submission by cleaning up created records
     * Implement rollback logic for failed auction proposals and payment transactions
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.4
     */
    async rollbackSwapOfferSubmission(transactionId: string): Promise<void> {
        const rollbackSteps: RollbackStep[] = [];
        let rollbackContext: RollbackContext;

        try {
            logger.info('Starting comprehensive swap offer submission rollback', { transactionId });

            // Get payment transaction details to find related records
            const paymentTransaction = await this.getPaymentTransactionDetails(transactionId);

            if (!paymentTransaction) {
                logger.warn('Payment transaction not found for rollback', { transactionId });
                return;
            }

            // Initialize rollback context
            rollbackContext = {
                transactionId,
                proposalId: paymentTransaction.proposalId || null,
                swapId: paymentTransaction.swapId,
                completedSteps: [],
                failedStep: ''
            };

            if (paymentTransaction.status === 'completed') {
                logger.warn('Cannot rollback completed payment transaction', {
                    transactionId,
                    status: paymentTransaction.status
                });
                return;
            }

            // Step 1: Prepare rollback steps based on what exists
            if (paymentTransaction.proposalId) {
                // Check if auction proposal exists and needs rollback
                const proposalExists = await this.auctionService.getProposalById(paymentTransaction.proposalId);
                if (proposalExists) {
                    rollbackSteps.push({
                        type: 'delete_auction_proposal',
                        data: {
                            proposalId: paymentTransaction.proposalId,
                            auctionId: proposalExists.auctionId || 'unknown'
                        },
                        timestamp: new Date()
                    });
                }
            }

            // Step 2: Add payment transaction rollback
            rollbackSteps.push({
                type: 'delete_payment_transaction',
                data: {
                    transactionId,
                    swapId: paymentTransaction.swapId,
                    amount: paymentTransaction.amount
                },
                timestamp: new Date()
            });

            // Step 3: Execute rollback steps in reverse order
            await this.executeRollbackStepsWithTracking(rollbackSteps, rollbackContext);

            logger.info('Comprehensive swap offer submission rollback completed successfully', {
                transactionId,
                rollbackStepsExecuted: rollbackSteps.length,
                swapId: paymentTransaction.swapId,
                proposalId: paymentTransaction.proposalId
            });

        } catch (error) {
            logger.error('Comprehensive swap offer submission rollback failed', {
                transactionId,
                error: error instanceof Error ? error.message : String(error),
                rollbackStepsAttempted: rollbackSteps.length
            });

            // Update rollback context with failure information
            if (rollbackContext!) {
                rollbackContext.failedStep = 'comprehensive_rollback';
            } else {
                rollbackContext = {
                    transactionId,
                    swapId: 'unknown',
                    completedSteps: [],
                    failedStep: 'comprehensive_rollback_initialization'
                };
            }

            // Handle rollback failure
            this.errorHandler.handleRollbackFailure(
                error instanceof Error ? error : new Error(String(error)),
                rollbackContext
            );

            throw error;
        }
    }

    /**
     * Get payment transaction details for rollback purposes
     */
    private async getPaymentTransactionDetails(transactionId: string): Promise<any | null> {
        try {
            const query = `
                SELECT 
                    id,
                    swap_id,
                    proposal_id,
                    payer_id,
                    recipient_id,
                    amount,
                    currency,
                    status,
                    created_at
                FROM payment_transactions 
                WHERE id = $1
            `;

            const result = await this.pool.query(query, [transactionId]);

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];
            return {
                id: row.id,
                swapId: row.swap_id,
                proposalId: row.proposal_id,
                payerId: row.payer_id,
                recipientId: row.recipient_id,
                amount: row.amount,
                currency: row.currency,
                status: row.status,
                createdAt: row.created_at
            };

        } catch (error) {
            logger.error('Failed to get payment transaction details for rollback', {
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            return null;
        }
    }

    /**
     * Execute rollback steps in reverse order (legacy method for backward compatibility)
     */
    private async executeRollbackSteps(steps: RollbackStep[]): Promise<void> {
        const rollbackContext: RollbackContext = {
            transactionId: 'unknown',
            swapId: 'unknown',
            completedSteps: [],
            failedStep: ''
        };

        await this.executeRollbackStepsWithTracking(steps, rollbackContext);
    }

    /**
     * Execute rollback steps in reverse order with comprehensive tracking
     * Track rollback steps during workflow execution and execute in reverse order on failure
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
     */
    private async executeRollbackStepsWithTracking(
        steps: RollbackStep[],
        rollbackContext: RollbackContext
    ): Promise<void> {
        const reversedSteps = [...steps].reverse();
        const completedSteps: RollbackStep[] = [];

        logger.info('Starting rollback execution with tracking', {
            totalSteps: reversedSteps.length,
            transactionId: rollbackContext.transactionId,
            swapId: rollbackContext.swapId,
            proposalId: rollbackContext.proposalId
        });

        for (let i = 0; i < reversedSteps.length; i++) {
            const step = reversedSteps[i];
            if (!step) {
                logger.warn('Rollback step is undefined', { stepIndex: i });
                continue;
            }

            try {
                logger.info('Executing rollback step', {
                    stepIndex: i + 1,
                    totalSteps: reversedSteps.length,
                    stepType: step.type,
                    stepData: step.data,
                    timestamp: step.timestamp,
                    transactionId: rollbackContext.transactionId
                });

                // Execute the rollback step based on type
                await this.executeRollbackStep(step);

                // Track completed step
                completedSteps.push(step);
                rollbackContext.completedSteps = completedSteps;

                logger.info('Rollback step executed successfully', {
                    stepIndex: i + 1,
                    stepType: step.type,
                    stepData: step.data,
                    completedStepsCount: completedSteps.length
                });

            } catch (rollbackError) {
                logger.error('Rollback step failed', {
                    stepIndex: i + 1,
                    stepType: step.type,
                    stepData: step.data,
                    error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
                    completedStepsCount: completedSteps.length,
                    remainingStepsCount: reversedSteps.length - i - 1
                });

                // Update rollback context with failure information
                rollbackContext.completedSteps = completedSteps;
                rollbackContext.failedStep = step.type;

                // Handle rollback failure but continue with remaining steps
                this.errorHandler.handleRollbackFailure(
                    rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)),
                    rollbackContext
                );

                // Continue with remaining steps to attempt maximum cleanup
                logger.info('Continuing with remaining rollback steps despite failure', {
                    failedStep: step.type,
                    remainingSteps: reversedSteps.length - i - 1
                });
            }
        }

        logger.info('Rollback execution completed', {
            totalSteps: reversedSteps.length,
            completedSteps: completedSteps.length,
            failedSteps: reversedSteps.length - completedSteps.length,
            transactionId: rollbackContext.transactionId
        });
    }

    /**
     * Execute a single rollback step with enhanced error handling
     */
    private async executeRollbackStep(step: RollbackStep): Promise<void> {
        switch (step.type) {
            case 'delete_auction_proposal':
                await this.rollbackAuctionProposal(step.data);
                break;

            case 'delete_payment_transaction':
                await this.rollbackPaymentTransaction(step.data);
                break;

            case 'revert_swap_status':
                await this.rollbackSwapStatus(step.data);
                break;

            default:
                logger.warn('Unknown rollback step type encountered', {
                    stepType: step.type,
                    stepData: step.data
                });
                throw new Error(`Unknown rollback step type: ${step.type}`);
        }
    }

    /**
     * Rollback auction proposal with enhanced validation
     */
    private async rollbackAuctionProposal(stepData: Record<string, any>): Promise<void> {
        const { proposalId, auctionId } = stepData;

        if (!proposalId) {
            throw new Error('Missing proposalId for auction proposal rollback');
        }

        logger.info('Rolling back auction proposal', { proposalId, auctionId });

        // Check if proposal still exists before attempting deletion
        const proposal = await this.auctionService.getProposalById(proposalId);
        if (!proposal) {
            logger.info('Auction proposal already deleted or does not exist', { proposalId });
            return;
        }

        // Check if proposal has any linked payment transactions
        const linkedTransactions = await this.checkLinkedPaymentTransactions(proposalId);
        if (linkedTransactions.length > 0) {
            logger.warn('Auction proposal has linked payment transactions', {
                proposalId,
                linkedTransactionCount: linkedTransactions.length,
                linkedTransactionIds: linkedTransactions
            });
        }

        // Delete the auction proposal
        await this.auctionService.deleteProposal(proposalId);

        logger.info('Auction proposal rollback completed', { proposalId, auctionId });
    }

    /**
     * Rollback payment transaction with enhanced validation
     */
    private async rollbackPaymentTransaction(stepData: Record<string, any>): Promise<void> {
        const { transactionId, swapId, amount } = stepData;

        if (!transactionId) {
            throw new Error('Missing transactionId for payment transaction rollback');
        }

        logger.info('Rolling back payment transaction', { transactionId, swapId, amount });

        // Check current transaction status
        const currentStatus = await this.paymentService.getPaymentTransactionStatus(transactionId);

        if (currentStatus === 'completed') {
            logger.warn('Cannot rollback completed payment transaction', {
                transactionId,
                currentStatus
            });
            throw new Error(`Cannot rollback completed payment transaction: ${transactionId}`);
        }

        if (currentStatus === 'failed') {
            logger.info('Payment transaction already in failed state', { transactionId });
            return;
        }

        // Execute the rollback
        await this.paymentService.rollbackPaymentTransaction(transactionId);

        logger.info('Payment transaction rollback completed', { transactionId, swapId });
    }

    /**
     * Rollback swap status changes (placeholder for future implementation)
     */
    private async rollbackSwapStatus(stepData: Record<string, any>): Promise<void> {
        const { swapId, previousStatus, currentStatus } = stepData;

        logger.info('Rolling back swap status', { swapId, previousStatus, currentStatus });

        // TODO: Implement swap status rollback when swap status management is available
        // This would involve reverting any status changes made during the swap offer process

        logger.info('Swap status rollback completed (placeholder)', { swapId });
    }

    /**
     * Check for linked payment transactions to an auction proposal
     */
    private async checkLinkedPaymentTransactions(proposalId: string): Promise<string[]> {
        try {
            const query = `
                SELECT id 
                FROM payment_transactions 
                WHERE proposal_id = $1 AND status != 'failed'
            `;

            const result = await this.pool.query(query, [proposalId]);
            return result.rows.map(row => row.id);

        } catch (error) {
            logger.error('Failed to check linked payment transactions', {
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            return [];
        }
    }
}

/**
 * Default implementation of SwapOfferErrorHandler
 */
class SwapOfferErrorHandlerImpl implements SwapOfferErrorHandler {
    handleForeignKeyViolation(error: any, context: any): SwapOfferError {
        return new SwapOfferError(
            VALIDATION_ERROR_CODES.FOREIGN_KEY_VIOLATION,
            'Foreign key constraint violation occurred',
            { error: error.message, context }
        );
    }

    handleRollbackFailure(error: Error, context: RollbackContext): void {
        logger.error('Rollback failure occurred', {
            error: error.message,
            context,
            severity: 'critical'
        });
    }

    createSwapOfferError(code: string, message: string, context?: Record<string, any>): SwapOfferError {
        return new SwapOfferError(code, message, context);
    }
}