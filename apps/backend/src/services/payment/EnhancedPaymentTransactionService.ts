import { PaymentTransaction } from '@booking-swap/shared';
import { ValidationResult, PaymentTransactionRequest, SwapScenario } from '../swap/SwapOfferWorkflowService';
import { ForeignKeyValidationService } from '../validation/ForeignKeyValidationService';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';
import { Pool } from 'pg';
import { logger } from '../../utils/logger';


export interface ValidatedPaymentTransactionRequest extends PaymentTransactionRequest {
    validationMetadata: {
        swapExists: boolean;
        proposalExists: boolean | null; // null when not applicable
        usersExist: boolean;
        scenario: SwapScenario;
        validatedAt: Date;
    };
}

export type PaymentTransactionStatus =
    | 'pending'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'refunded'
    | 'rolled_back';

/**
 * Enhanced Payment Transaction Service Interface
 * 
 * This service provides enhanced payment transaction functionality with
 * comprehensive validation and foreign key reference checking to prevent
 * database constraint violations.
 */
export interface EnhancedPaymentTransactionService {
    /**
     * Core transaction methods with validation
     */
    createPaymentTransaction(request: ValidatedPaymentTransactionRequest): Promise<PaymentTransaction>;
    validatePaymentTransactionRequest(request: PaymentTransactionRequest): Promise<ValidationResult>;

    /**
     * Foreign key validation methods
     */
    validateProposalReference(proposalId: string | null): Promise<boolean>;
    validateSwapReference(swapId: string): Promise<boolean>;
    validateUserReferences(payerId: string, recipientId: string): Promise<boolean>;

    /**
     * Transaction management
     */
    rollbackPaymentTransaction(transactionId: string): Promise<void>;
    getPaymentTransactionStatus(transactionId: string): Promise<PaymentTransactionStatus>;
}

/**
 * Enhanced Payment Transaction Service Implementation
 * 
 * This service implements enhanced payment transaction functionality with
 * comprehensive validation and foreign key reference checking to prevent
 * database constraint violations. It handles both auction and direct swap scenarios.
 */
export class EnhancedPaymentTransactionServiceImpl implements EnhancedPaymentTransactionService {
    private foreignKeyValidationService: ForeignKeyValidationService;

    constructor(
        private pool: Pool,
        private paymentRepository: PaymentRepository
    ) {
        this.foreignKeyValidationService = new ForeignKeyValidationService(pool);
    }

    /**
     * Creates a payment transaction with pre-flight validation
     * Handles both auction and first-match scenarios
     * 
     * Requirements: 1.1, 1.2, 1.3, 1.4
     */
    async createPaymentTransaction(request: ValidatedPaymentTransactionRequest): Promise<PaymentTransaction> {
        try {
            logger.info('Creating payment transaction with validation', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                payerId: request.payerId,
                recipientId: request.recipientId,
                amount: request.amount,
                scenario: request.validationMetadata.scenario
            });

            // Verify validation metadata is recent (within last 5 minutes)
            const validationAge = Date.now() - request.validationMetadata.validatedAt.getTime();
            if (validationAge > 5 * 60 * 1000) {
                logger.warn('Validation metadata is stale, re-validating', {
                    validationAge: validationAge / 1000,
                    swapId: request.swapId
                });

                // Re-validate if metadata is too old
                const freshValidation = await this.validatePaymentTransactionRequest(request);
                if (!freshValidation.isValid) {
                    throw new Error(`Pre-flight validation failed: ${freshValidation.errors.map(e => e.message).join(', ')}`);
                }
            }

            // Prepare transaction data based on scenario
            const proposalId = request.validationMetadata.scenario === 'auction' ? request.proposalId : null;

            // Calculate net amount if not provided
            const netAmount = request.amount - request.platformFee;

            const transactionData: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
                swapId: request.swapId,
                proposalId: proposalId || '', // PaymentTransaction interface requires string, use empty string for null
                payerId: request.payerId,
                recipientId: request.recipientId,
                amount: request.amount,
                currency: request.currency,
                status: 'pending',
                escrowId: undefined, // Optional field
                gatewayTransactionId: request.gatewayTransactionId,
                platformFee: request.platformFee,
                netAmount: netAmount,
                completedAt: undefined,
                blockchain: {
                    transactionId: request.blockchainTransactionId
                }
            };

            // Create the payment transaction
            const transaction = await this.paymentRepository.createPaymentTransaction(transactionData);

            logger.info('Payment transaction created successfully', {
                transactionId: transaction.id,
                swapId: request.swapId,
                proposalId: transaction.proposalId,
                scenario: request.validationMetadata.scenario,
                amount: request.amount
            });

            return transaction;

        } catch (error) {
            logger.error('Payment transaction creation failed', {
                error: error instanceof Error ? error.message : String(error),
                swapId: request.swapId,
                proposalId: request.proposalId,
                scenario: request.validationMetadata?.scenario
            });

            // Re-throw with more context
            if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
                throw new Error(`Foreign key constraint violation during payment transaction creation: ${error.message}`);
            }

            throw error;
        }
    }

    /**
     * Validates all foreign key references before transaction creation
     * Returns detailed validation results with specific error codes
     * 
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    async validatePaymentTransactionRequest(request: PaymentTransactionRequest): Promise<ValidationResult> {
        try {
            logger.info('Validating payment transaction request', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                payerId: request.payerId,
                recipientId: request.recipientId
            });

            // Use the foreign key validation service for comprehensive validation
            const validationResult = await this.foreignKeyValidationService.validateForeignKeyReferences(request);

            logger.info('Payment transaction request validation completed', {
                swapId: request.swapId,
                proposalId: request.proposalId,
                isValid: validationResult.isValid,
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length
            });

            return validationResult;

        } catch (error) {
            logger.error('Payment transaction request validation failed', {
                error: error instanceof Error ? error.message : String(error),
                swapId: request.swapId,
                proposalId: request.proposalId
            });

            // Return a failed validation result
            return {
                isValid: false,
                errors: [{
                    code: 'VALIDATION_SYSTEM_ERROR',
                    message: 'System error during validation - please try again',
                    suggestedFix: 'Retry the request or contact support if the issue persists'
                }],
                warnings: [],
                metadata: {
                    validatedAt: new Date(),
                    validationType: 'payment_transaction_validation'
                }
            };
        }
    }

    /**
     * Validates that a proposal reference exists (for auction scenarios)
     * Returns false for null proposal_id in direct swap scenarios
     */
    async validateProposalReference(proposalId: string | null): Promise<boolean> {
        if (proposalId === null || proposalId === undefined) {
            return true; // Null is valid for direct swaps
        }

        try {
            const query = `
                SELECT id 
                FROM auction_proposals 
                WHERE id = $1 AND status != 'deleted'
            `;

            const result = await this.pool.query(query, [proposalId]);
            return result.rows.length > 0;

        } catch (error) {
            logger.error('Proposal reference validation failed', {
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Validates that a swap reference exists
     */
    async validateSwapReference(swapId: string): Promise<boolean> {
        try {
            const query = `
                SELECT id 
                FROM swaps 
                WHERE id = $1 AND status != 'deleted'
            `;

            const result = await this.pool.query(query, [swapId]);
            return result.rows.length > 0;

        } catch (error) {
            logger.error('Swap reference validation failed', {
                swapId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Validates that both user references exist
     */
    async validateUserReferences(payerId: string, recipientId: string): Promise<boolean> {
        try {
            const query = `
                SELECT 
                    (SELECT COUNT(*) FROM users WHERE id = $1) as payer_count,
                    (SELECT COUNT(*) FROM users WHERE id = $2) as recipient_count
            `;

            const result = await this.pool.query(query, [payerId, recipientId]);
            const row = result.rows[0];

            return row.payer_count > 0 && row.recipient_count > 0;

        } catch (error) {
            logger.error('User references validation failed', {
                payerId,
                recipientId,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Rolls back a payment transaction by updating its status
     */
    async rollbackPaymentTransaction(transactionId: string): Promise<void> {
        try {
            logger.info('Rolling back payment transaction', { transactionId });

            const updatedTransaction = await this.paymentRepository.updatePaymentStatus(
                transactionId,
                'failed', // Use 'failed' status instead of 'rolled_back' since it's not in PaymentStatus enum
                new Date()
            );

            if (!updatedTransaction) {
                throw new Error(`Failed to rollback payment transaction: ${transactionId}`);
            }

            logger.info('Payment transaction rolled back successfully', { transactionId });

        } catch (error) {
            logger.error('Payment transaction rollback failed', {
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Gets the current status of a payment transaction
     */
    async getPaymentTransactionStatus(transactionId: string): Promise<PaymentTransactionStatus> {
        try {
            const transaction = await this.paymentRepository.findById(transactionId);

            if (!transaction) {
                throw new Error(`Payment transaction not found: ${transactionId}`);
            }

            return transaction.status as PaymentTransactionStatus;

        } catch (error) {
            logger.error('Failed to get payment transaction status', {
                transactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}