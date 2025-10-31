import { SwapScenario } from './SwapOfferWorkflowService';
import { ConstraintViolationLogger } from '../logging/ConstraintViolationLogger';
import { CriticalErrorAlertService } from '../alerting/CriticalErrorAlertService';

export interface SwapOfferContext {
    proposalId?: string | null;
    swapId: string;
    scenario: SwapScenario;
    userId: string;
    amount?: number;
    currency?: string;
}

export interface RollbackContext {
    transactionId: string;
    proposalId?: string | null;
    swapId: string;
    completedSteps: RollbackStep[];
    failedStep: string;
}

export interface RollbackStep {
    type: 'delete_auction_proposal' | 'delete_payment_transaction' | 'revert_swap_status';
    data: Record<string, any>;
    timestamp: Date;
}

export interface DatabaseError extends Error {
    constraint?: string;
    table?: string;
    column?: string;
    detail?: string;
}

export interface PermissionResult {
    allowed: boolean;
    reason?: string;
}

export interface PaymentMethodValidation {
    valid: boolean;
    reason?: string;
    paymentMethod?: any;
}

/**
 * Enhanced Error Handling for Swap Offers
 * 
 * This class provides comprehensive error handling for swap offer submissions,
 * including foreign key constraint violations and rollback failures.
 */
export class SwapOfferError extends Error {
    constructor(
        public code: string,
        message: string,
        public context: Record<string, any> = {}
    ) {
        super(message);
        this.name = 'SwapOfferError';
    }
}

// Error codes for swap offer operations
export const SWAP_OFFER_ERROR_CODES = {
    // Foreign key constraint violations
    INVALID_PROPOSAL_REFERENCE: 'INVALID_PROPOSAL_REFERENCE',
    INVALID_SWAP_REFERENCE: 'INVALID_SWAP_REFERENCE',
    INVALID_USER_REFERENCE: 'INVALID_USER_REFERENCE',

    // Database constraint violations
    DATABASE_CONSTRAINT_VIOLATION: 'DATABASE_CONSTRAINT_VIOLATION',
    FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',

    // Validation errors
    SWAP_NOT_FOUND: 'SWAP_NOT_FOUND',
    PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
    USER_NOT_FOUND: 'USER_NOT_FOUND',

    // Permission errors
    CANNOT_OFFER_ON_OWN_SWAP: 'CANNOT_OFFER_ON_OWN_SWAP',
    CASH_OFFERS_NOT_ACCEPTED: 'CASH_OFFERS_NOT_ACCEPTED',
    PAYMENT_METHOD_NOT_VERIFIED: 'PAYMENT_METHOD_NOT_VERIFIED',

    // Rollback errors
    ROLLBACK_FAILURE: 'ROLLBACK_FAILURE',
    CRITICAL_ROLLBACK_FAILURE: 'CRITICAL_ROLLBACK_FAILURE',

    // Workflow errors
    SCENARIO_MISMATCH: 'SCENARIO_MISMATCH',
    AUCTION_NOT_ACTIVE: 'AUCTION_NOT_ACTIVE',
    WORKFLOW_EXECUTION_FAILED: 'WORKFLOW_EXECUTION_FAILED'
} as const;

// Constraint name mappings for better error handling
export const CONSTRAINT_MAPPINGS = {
    'payment_transactions_proposal_id_fkey': {
        table: 'payment_transactions',
        referencedTable: 'auction_proposals',
        column: 'proposal_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_PROPOSAL_REFERENCE
    },
    'payment_transactions_swap_id_fkey': {
        table: 'payment_transactions',
        referencedTable: 'swaps',
        column: 'swap_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_SWAP_REFERENCE
    },
    'payment_transactions_payer_id_fkey': {
        table: 'payment_transactions',
        referencedTable: 'users',
        column: 'payer_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_USER_REFERENCE
    },
    'payment_transactions_recipient_id_fkey': {
        table: 'payment_transactions',
        referencedTable: 'users',
        column: 'recipient_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_USER_REFERENCE
    },
    'auction_proposals_auction_id_fkey': {
        table: 'auction_proposals',
        referencedTable: 'swap_auctions',
        column: 'auction_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_SWAP_REFERENCE
    },
    'auction_proposals_proposer_id_fkey': {
        table: 'auction_proposals',
        referencedTable: 'users',
        column: 'proposer_id',
        errorCode: SWAP_OFFER_ERROR_CODES.INVALID_USER_REFERENCE
    }
} as const;

/**
 * Enhanced Error Handler for Swap Offer Operations
 * 
 * Provides comprehensive error handling including:
 * - Foreign key constraint violation mapping
 * - User-friendly error messages
 * - Detailed logging and context
 * - Rollback failure handling
 * - Administrator alerting
 */
export class SwapOfferErrorHandler {
    private logger: any;
    private alertService: any;
    private constraintLogger: ConstraintViolationLogger;
    private criticalAlertService: CriticalErrorAlertService;

    constructor(logger: any, alertService?: any, metricsStore?: any, alertChannels?: any[]) {
        this.logger = logger;
        this.alertService = alertService;
        this.constraintLogger = new ConstraintViolationLogger(logger, metricsStore);
        this.criticalAlertService = new CriticalErrorAlertService(logger, alertChannels);
    }

    /**
     * Handle foreign key constraint violations with specific error messages
     */
    handleForeignKeyViolation(error: DatabaseError, context: SwapOfferContext): SwapOfferError {
        const constraintName = error.constraint;

        if (!constraintName) {
            return this.createGenericConstraintError(error, context);
        }

        const constraintMapping = CONSTRAINT_MAPPINGS[constraintName as keyof typeof CONSTRAINT_MAPPINGS];

        if (!constraintMapping) {
            return this.createUnknownConstraintError(error, context);
        }

        // Use enhanced constraint violation logging
        const logEntry = this.constraintLogger.logConstraintViolation(error, context, 'INSERT');

        // Additional high-level logging for monitoring
        this.logger.error('Foreign key constraint violation in swap offer', {
            constraintViolation: {
                constraint: constraintName,
                table: constraintMapping.table,
                referencedTable: constraintMapping.referencedTable,
                column: constraintMapping.column,
                severity: logEntry.severity
            },
            swapOfferContext: {
                swapId: context.swapId,
                proposalId: context.proposalId,
                userId: context.userId,
                scenario: context.scenario,
                amount: context.amount,
                currency: context.currency
            },
            errorDetail: error.detail || error.message,
            logEntryId: logEntry.timestamp,
            suggestedAction: logEntry.suggestedAction
        });

        return this.createSpecificConstraintError(constraintMapping, error, context);
    }

    /**
     * Create specific error based on constraint mapping
     */
    private createSpecificConstraintError(
        constraintMapping: typeof CONSTRAINT_MAPPINGS[keyof typeof CONSTRAINT_MAPPINGS],
        error: DatabaseError,
        context: SwapOfferContext
    ): SwapOfferError {
        switch (constraintMapping.errorCode) {
            case SWAP_OFFER_ERROR_CODES.INVALID_PROPOSAL_REFERENCE:
                return new SwapOfferError(
                    SWAP_OFFER_ERROR_CODES.INVALID_PROPOSAL_REFERENCE,
                    'The auction proposal reference is invalid. This may indicate a timing issue or data inconsistency.',
                    {
                        proposalId: context.proposalId,
                        swapId: context.swapId,
                        scenario: context.scenario,
                        constraint: constraintMapping,
                        suggestedAction: context.scenario === 'auction'
                            ? 'Retry the submission to create a new auction proposal'
                            : 'Submit as a direct swap offer without auction proposal reference'
                    }
                );

            case SWAP_OFFER_ERROR_CODES.INVALID_SWAP_REFERENCE:
                return new SwapOfferError(
                    SWAP_OFFER_ERROR_CODES.INVALID_SWAP_REFERENCE,
                    'The referenced swap does not exist or has been deleted.',
                    {
                        swapId: context.swapId,
                        constraint: constraintMapping,
                        suggestedAction: 'Verify the swap still exists and try again'
                    }
                );

            case SWAP_OFFER_ERROR_CODES.INVALID_USER_REFERENCE:
                return new SwapOfferError(
                    SWAP_OFFER_ERROR_CODES.INVALID_USER_REFERENCE,
                    'One or more user references are invalid.',
                    {
                        userId: context.userId,
                        column: constraintMapping.column,
                        constraint: constraintMapping,
                        suggestedAction: 'Verify user accounts exist and are active'
                    }
                );

            default:
                return new SwapOfferError(
                    SWAP_OFFER_ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION,
                    'A database constraint was violated during swap offer submission.',
                    { constraint: constraintMapping, context, originalError: error.message }
                );
        }
    }

    /**
     * Create error for unknown constraint violations
     */
    private createUnknownConstraintError(error: DatabaseError, context: SwapOfferContext): SwapOfferError {
        this.logger.warn('Unknown constraint violation encountered', {
            constraint: error.constraint,
            table: error.table,
            column: error.column,
            context,
            errorMessage: error.message,
            timestamp: new Date().toISOString()
        });

        return new SwapOfferError(
            SWAP_OFFER_ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION,
            'A database constraint was violated. Please try again or contact support if the issue persists.',
            {
                constraint: error.constraint,
                table: error.table,
                column: error.column,
                context,
                suggestedAction: 'Retry the operation or contact technical support'
            }
        );
    }

    /**
     * Create error for generic constraint violations
     */
    private createGenericConstraintError(error: DatabaseError, context: SwapOfferContext): SwapOfferError {
        this.logger.error('Database constraint violation without constraint name', {
            error: error.message,
            context,
            timestamp: new Date().toISOString()
        });

        return new SwapOfferError(
            SWAP_OFFER_ERROR_CODES.DATABASE_CONSTRAINT_VIOLATION,
            'A database error occurred during swap offer submission.',
            {
                context,
                originalError: error.message,
                suggestedAction: 'Please try again or contact support'
            }
        );
    }

    /**
     * Handle rollback failures with critical error alerting
     */
    async handleRollbackFailure(error: Error, context: RollbackContext): Promise<void> {
        // Log critical error with full context
        this.logger.critical('Swap offer rollback failed - immediate intervention required', {
            rollbackFailure: {
                transactionId: context.transactionId,
                proposalId: context.proposalId,
                swapId: context.swapId,
                failedStep: context.failedStep,
                completedStepsCount: context.completedSteps.length,
                errorMessage: error.message,
                errorStack: error.stack
            },
            completedSteps: context.completedSteps.map(step => ({
                type: step.type,
                timestamp: step.timestamp,
                data: step.data
            })),
            systemContext: {
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                memoryUsage: process.memoryUsage()
            }
        });

        // Send critical alert using enhanced alerting service
        try {
            const alertResults = await this.criticalAlertService.sendRollbackFailureAlert(
                context.transactionId,
                context.swapId,
                context.proposalId || null,
                context.failedStep,
                context.completedSteps,
                error,
                {
                    userId: context.completedSteps.find(step => step.data?.userId)?.data?.userId,
                    scenario: context.completedSteps.find(step => step.data?.scenario)?.data?.scenario
                }
            );

            this.logger.info('Critical rollback failure alert sent', {
                transactionId: context.transactionId,
                alertResults: alertResults.map(r => ({
                    channel: r.channel,
                    success: r.success,
                    error: r.error
                }))
            });

        } catch (alertError) {
            // If alerting fails, log the failure but don't throw
            const alertErrorMessage = alertError instanceof Error ? alertError.message : String(alertError);
            this.logger.error('Failed to send critical rollback failure alert', {
                transactionId: context.transactionId,
                alertError: alertErrorMessage,
                originalError: error.message
            });
        }

        // Send legacy alert if old alert service is still configured
        if (this.alertService && typeof this.alertService.sendCriticalAlert === 'function') {
            try {
                await this.alertService.sendCriticalAlert({
                    type: 'ROLLBACK_FAILURE',
                    title: 'Critical: Swap Offer Rollback Failed',
                    message: `Rollback failed for swap offer submission. Manual intervention required.`,
                    details: {
                        transactionId: context.transactionId,
                        swapId: context.swapId,
                        proposalId: context.proposalId,
                        failedStep: context.failedStep,
                        completedSteps: context.completedSteps.length,
                        errorMessage: error.message
                    },
                    severity: 'critical',
                    requiresImmedateAction: true,
                    timestamp: new Date().toISOString()
                });
            } catch (legacyAlertError) {
                const legacyErrorMessage = legacyAlertError instanceof Error ? legacyAlertError.message : String(legacyAlertError);
                this.logger.warn('Legacy alert service also failed', {
                    error: legacyErrorMessage
                });
            }
        }

        // Log detailed rollback step analysis for debugging
        this.logRollbackStepAnalysis(context, error);
    }

    /**
     * Log detailed analysis of rollback steps for debugging
     */
    private logRollbackStepAnalysis(context: RollbackContext, error: Error): void {
        const stepAnalysis = context.completedSteps.map((step, index) => ({
            stepNumber: index + 1,
            type: step.type,
            timestamp: step.timestamp,
            data: step.data,
            timeSinceStart: index > 0 && context.completedSteps[0]
                ? new Date(step.timestamp).getTime() - new Date(context.completedSteps[0].timestamp).getTime()
                : 0
        }));

        this.logger.error('Detailed rollback step analysis', {
            transactionId: context.transactionId,
            failedStep: context.failedStep,
            totalSteps: context.completedSteps.length,
            stepAnalysis,
            errorAnalysis: {
                message: error.message,
                name: error.name,
                stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack trace
            },
            recommendations: this.generateRollbackFailureRecommendations(context, error)
        });
    }

    /**
     * Generate recommendations for rollback failure resolution
     */
    private generateRollbackFailureRecommendations(context: RollbackContext, error: Error): string[] {
        const recommendations = [
            'Check database connection and transaction status',
            'Verify all referenced entities still exist',
            'Review application logs for concurrent operations'
        ];

        // Add specific recommendations based on failed step
        if (context.failedStep.includes('auction_proposal')) {
            recommendations.push('Check auction_proposals table for orphaned records');
            recommendations.push('Verify auction status and constraints');
        }

        if (context.failedStep.includes('payment_transaction')) {
            recommendations.push('Check payment_transactions table for partial records');
            recommendations.push('Verify payment gateway transaction status');
        }

        // Add recommendations based on error type
        if (error.message.includes('constraint')) {
            recommendations.push('Review foreign key constraints and referential integrity');
        }

        if (error.message.includes('timeout')) {
            recommendations.push('Check database performance and connection pool');
        }

        return recommendations;
    }

    /**
     * Create standardized swap offer error
     */
    createSwapOfferError(code: string, message: string, context?: Record<string, any>): SwapOfferError {
        return new SwapOfferError(code, message, context || {});
    }

    /**
     * Handle validation errors with appropriate logging
     */
    handleValidationError(validationErrors: any[], context: SwapOfferContext): SwapOfferError {
        this.logger.warn('Swap offer validation failed', {
            errors: validationErrors,
            context: {
                swapId: context.swapId,
                userId: context.userId,
                scenario: context.scenario,
                timestamp: new Date().toISOString()
            }
        });

        const primaryError = validationErrors[0];
        return new SwapOfferError(
            primaryError.code || SWAP_OFFER_ERROR_CODES.WORKFLOW_EXECUTION_FAILED,
            primaryError.message || 'Validation failed for swap offer submission',
            {
                validationErrors,
                context,
                suggestedAction: 'Please check the provided data and try again'
            }
        );
    }

    /**
     * Handle permission errors
     */
    handlePermissionError(reason: string, context: SwapOfferContext): SwapOfferError {
        this.logger.warn('Swap offer permission denied', {
            reason,
            context: {
                swapId: context.swapId,
                userId: context.userId,
                timestamp: new Date().toISOString()
            }
        });

        const errorMessages = {
            'CANNOT_OFFER_ON_OWN_SWAP': 'You cannot submit an offer on your own swap',
            'CASH_OFFERS_NOT_ACCEPTED': 'This swap does not accept cash offers',
            'PAYMENT_METHOD_NOT_VERIFIED': 'Your payment method must be verified before submitting offers'
        };

        const message = errorMessages[reason as keyof typeof errorMessages] || 'Permission denied for swap offer submission';

        return new SwapOfferError(
            reason,
            message,
            {
                context,
                suggestedAction: this.getPermissionSuggestedAction(reason)
            }
        );
    }

    /**
     * Get suggested action for permission errors
     */
    private getPermissionSuggestedAction(reason: string): string {
        const suggestions = {
            'CANNOT_OFFER_ON_OWN_SWAP': 'Browse other available swaps to make offers',
            'CASH_OFFERS_NOT_ACCEPTED': 'Look for swaps that accept cash offers or submit a booking swap',
            'PAYMENT_METHOD_NOT_VERIFIED': 'Verify your payment method in account settings'
        };

        return suggestions[reason as keyof typeof suggestions] || 'Please check the requirements and try again';
    }

    /**
     * Handle critical data integrity issues
     */
    async handleCriticalDataIntegrityIssue(
        issue: string,
        context: SwapOfferContext,
        additionalDetails?: Record<string, any>
    ): Promise<void> {
        const criticalDetails = {
            issue,
            swapId: context.swapId,
            proposalId: context.proposalId,
            userId: context.userId,
            scenario: context.scenario,
            timestamp: new Date().toISOString(),
            ...additionalDetails
        };

        // Log critical data integrity issue
        this.logger.critical('Critical data integrity issue detected', {
            dataIntegrityIssue: criticalDetails,
            systemState: {
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            }
        });

        // Send critical alert
        try {
            await this.criticalAlertService.sendCriticalAlert({
                type: 'DATA_CORRUPTION',
                title: 'Critical: Data Integrity Issue Detected',
                message: `Data integrity issue detected in swap offer system: ${issue}`,
                details: criticalDetails,
                severity: 'critical',
                requiresImmedateAction: true,
                timestamp: new Date().toISOString()
            });
        } catch (alertError) {
            const alertErrorMessage = alertError instanceof Error ? alertError.message : String(alertError);
            this.logger.error('Failed to send data integrity alert', {
                alertError: alertErrorMessage,
                originalIssue: issue
            });
        }
    }

    /**
     * Get error handler metrics and statistics
     */
    getErrorHandlerMetrics(): Record<string, any> {
        return {
            alertHistory: this.criticalAlertService.getAlertHistory(10),
            constraintViolationMetrics: 'Available via ConstraintViolationLogger.getConstraintViolationMetrics()',
            handlerStatus: {
                alertServiceConfigured: !!this.alertService,
                criticalAlertServiceConfigured: !!this.criticalAlertService,
                constraintLoggerConfigured: !!this.constraintLogger
            }
        };
    }
}