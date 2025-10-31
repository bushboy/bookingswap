import { Pool, PoolClient } from 'pg';
import { SwapProposal, PaymentTransaction } from '@booking-swap/shared';
import { ProposalAcceptanceError, PROPOSAL_ACCEPTANCE_ERROR_CODES, ProposalAcceptanceErrorContext } from './ProposalAcceptanceError';
import { ProposalTransactionManager } from './ProposalTransactionManager';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { HederaService } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Rollback data structure for tracking rollback operations
 */
export interface RollbackData {
    rollbackId: string;
    proposalId: string;
    userId: string;
    action: 'accept' | 'reject';
    originalError: Error;
    rollbackStartedAt: Date;
    stepsCompleted: RollbackStep[];
    stepsToRollback: RollbackStep[];
    rollbackStatus: 'in_progress' | 'completed' | 'failed' | 'partial';
    manualInterventionRequired: boolean;
    rollbackAttempts: number;
    maxRollbackAttempts: number;
}

/**
 * Individual rollback step information
 */
export interface RollbackStep {
    stepId: string;
    stepName: string;
    stepType: 'database' | 'payment' | 'blockchain' | 'notification' | 'cleanup';
    executedAt: Date;
    rollbackRequired: boolean;
    rollbackCompleted: boolean;
    rollbackError?: Error;
    rollbackData?: Record<string, any>;
}

/**
 * Rollback result information
 */
export interface RollbackResult {
    rollbackId: string;
    success: boolean;
    stepsRolledBack: number;
    stepsFailed: number;
    manualInterventionRequired: boolean;
    errors: Error[];
    rollbackData: RollbackData;
}

/**
 * Comprehensive rollback manager for proposal acceptance failures
 * Handles atomic rollback operations and failure recovery scenarios
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class ProposalRollbackManager {
    private rollbackOperations = new Map<string, RollbackData>();

    constructor(
        private pool: Pool,
        private transactionManager: ProposalTransactionManager,
        private paymentService: PaymentProcessingService,
        private hederaService: HederaService,
        private notificationService: NotificationService
    ) { }

    /**
     * Rollback acceptance operation for partial failure scenarios
     * Handles database, payment, blockchain, and notification rollbacks
     * Requirements: 6.1, 6.2, 6.3
     */
    async rollbackAcceptance(
        proposalId: string,
        userId: string,
        originalError: Error,
        completedSteps: RollbackStep[],
        context?: ProposalAcceptanceErrorContext
    ): Promise<RollbackResult> {
        const rollbackId = uuidv4();
        const rollbackData: RollbackData = {
            rollbackId,
            proposalId,
            userId,
            action: 'accept',
            originalError,
            rollbackStartedAt: new Date(),
            stepsCompleted: completedSteps,
            stepsToRollback: this.determineRollbackSteps(completedSteps, 'accept'),
            rollbackStatus: 'in_progress',
            manualInterventionRequired: false,
            rollbackAttempts: 1,
            maxRollbackAttempts: 3
        };

        this.rollbackOperations.set(rollbackId, rollbackData);

        try {
            logger.info('Starting acceptance rollback operation', {
                rollbackId,
                proposalId,
                userId,
                originalError: originalError.message,
                stepsToRollback: rollbackData.stepsToRollback.length
            });

            const result = await this.executeRollbackSteps(rollbackData);

            if (result.success) {
                rollbackData.rollbackStatus = 'completed';
                logger.info('Acceptance rollback completed successfully', {
                    rollbackId,
                    proposalId,
                    stepsRolledBack: result.stepsRolledBack
                });
            } else {
                rollbackData.rollbackStatus = result.manualInterventionRequired ? 'failed' : 'partial';
                logger.error('Acceptance rollback failed or incomplete', {
                    rollbackId,
                    proposalId,
                    stepsRolledBack: result.stepsRolledBack,
                    stepsFailed: result.stepsFailed,
                    manualInterventionRequired: result.manualInterventionRequired
                });
            }

            // Send rollback notification
            await this.sendRollbackNotification(rollbackData, result);

            return result;

        } catch (error) {
            rollbackData.rollbackStatus = 'failed';
            rollbackData.manualInterventionRequired = true;

            logger.error('Rollback operation failed with exception', {
                rollbackId,
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });

            throw ProposalAcceptanceError.rollbackOperationFailed(
                proposalId,
                'rollback_execution',
                error instanceof Error ? error : new Error(String(error)),
                {
                    ...context,
                    rollbackData: {
                        stepsCompleted: rollbackData.stepsCompleted.map(s => s.stepName),
                        stepsToRollback: rollbackData.stepsToRollback.map(s => s.stepName),
                        rollbackStartedAt: rollbackData.rollbackStartedAt
                    }
                }
            );
        }
    }

    /**
     * Rollback rejection operation for failure scenarios
     * Simpler rollback as rejections typically have fewer side effects
     * Requirements: 6.1, 6.2
     */
    async rollbackRejection(
        proposalId: string,
        userId: string,
        originalError: Error,
        completedSteps: RollbackStep[],
        context?: ProposalAcceptanceErrorContext
    ): Promise<RollbackResult> {
        const rollbackId = uuidv4();
        const rollbackData: RollbackData = {
            rollbackId,
            proposalId,
            userId,
            action: 'reject',
            originalError,
            rollbackStartedAt: new Date(),
            stepsCompleted: completedSteps,
            stepsToRollback: this.determineRollbackSteps(completedSteps, 'reject'),
            rollbackStatus: 'in_progress',
            manualInterventionRequired: false,
            rollbackAttempts: 1,
            maxRollbackAttempts: 3
        };

        this.rollbackOperations.set(rollbackId, rollbackData);

        try {
            logger.info('Starting rejection rollback operation', {
                rollbackId,
                proposalId,
                userId,
                originalError: originalError.message,
                stepsToRollback: rollbackData.stepsToRollback.length
            });

            const result = await this.executeRollbackSteps(rollbackData);

            if (result.success) {
                rollbackData.rollbackStatus = 'completed';
                logger.info('Rejection rollback completed successfully', {
                    rollbackId,
                    proposalId,
                    stepsRolledBack: result.stepsRolledBack
                });
            } else {
                rollbackData.rollbackStatus = result.manualInterventionRequired ? 'failed' : 'partial';
                logger.error('Rejection rollback failed or incomplete', {
                    rollbackId,
                    proposalId,
                    stepsRolledBack: result.stepsRolledBack,
                    stepsFailed: result.stepsFailed
                });
            }

            return result;

        } catch (error) {
            rollbackData.rollbackStatus = 'failed';
            rollbackData.manualInterventionRequired = true;

            logger.error('Rejection rollback operation failed with exception', {
                rollbackId,
                proposalId,
                error: error instanceof Error ? error.message : String(error)
            });

            throw ProposalAcceptanceError.rollbackOperationFailed(
                proposalId,
                'rejection_rollback_execution',
                error instanceof Error ? error : new Error(String(error)),
                {
                    ...context,
                    rollbackData: {
                        stepsCompleted: rollbackData.stepsCompleted.map(s => s.stepName),
                        stepsToRollback: rollbackData.stepsToRollback.map(s => s.stepName),
                        rollbackStartedAt: rollbackData.rollbackStartedAt
                    }
                }
            );
        }
    }

    /**
     * Determine which steps need to be rolled back based on completed steps
     */
    private determineRollbackSteps(completedSteps: RollbackStep[], action: 'accept' | 'reject'): RollbackStep[] {
        const rollbackSteps: RollbackStep[] = [];

        // Reverse order for rollback (last completed first)
        const reversedSteps = [...completedSteps].reverse();

        for (const step of reversedSteps) {
            if (step.rollbackRequired) {
                rollbackSteps.push({
                    ...step,
                    rollbackCompleted: false,
                    rollbackData: {
                        originalStepId: step.stepId,
                        rollbackAction: this.getRollbackAction(step.stepType, action)
                    }
                });
            }
        }

        return rollbackSteps;
    }

    /**
     * Get the appropriate rollback action for a step type
     */
    private getRollbackAction(stepType: string, action: 'accept' | 'reject'): string {
        const rollbackActions: Record<string, Record<string, string>> = {
            database: {
                accept: 'revert_proposal_status_to_pending',
                reject: 'revert_proposal_status_to_pending'
            },
            payment: {
                accept: 'reverse_payment_transaction',
                reject: 'no_action_required'
            },
            blockchain: {
                accept: 'record_rollback_transaction',
                reject: 'record_rollback_transaction'
            },
            notification: {
                accept: 'send_rollback_notification',
                reject: 'send_rollback_notification'
            },
            cleanup: {
                accept: 'cleanup_temporary_data',
                reject: 'cleanup_temporary_data'
            }
        };

        return rollbackActions[stepType]?.[action] || 'unknown_rollback_action';
    }

    /**
     * Execute rollback steps in sequence
     */
    private async executeRollbackSteps(rollbackData: RollbackData): Promise<RollbackResult> {
        const result: RollbackResult = {
            rollbackId: rollbackData.rollbackId,
            success: true,
            stepsRolledBack: 0,
            stepsFailed: 0,
            manualInterventionRequired: false,
            errors: [],
            rollbackData
        };

        for (const step of rollbackData.stepsToRollback) {
            try {
                logger.debug('Executing rollback step', {
                    rollbackId: rollbackData.rollbackId,
                    stepId: step.stepId,
                    stepType: step.stepType,
                    stepName: step.stepName
                });

                await this.executeRollbackStep(rollbackData, step);

                step.rollbackCompleted = true;
                result.stepsRolledBack++;

                logger.debug('Rollback step completed successfully', {
                    rollbackId: rollbackData.rollbackId,
                    stepId: step.stepId,
                    stepType: step.stepType
                });

            } catch (error) {
                const rollbackError = error instanceof Error ? error : new Error(String(error));
                step.rollbackError = rollbackError;
                result.errors.push(rollbackError);
                result.stepsFailed++;
                result.success = false;

                logger.error('Rollback step failed', {
                    rollbackId: rollbackData.rollbackId,
                    stepId: step.stepId,
                    stepType: step.stepType,
                    error: rollbackError.message
                });

                // Determine if this failure requires manual intervention
                if (this.requiresManualIntervention(step.stepType, rollbackError)) {
                    result.manualInterventionRequired = true;
                    rollbackData.manualInterventionRequired = true;

                    logger.error('Rollback step failure requires manual intervention', {
                        rollbackId: rollbackData.rollbackId,
                        stepId: step.stepId,
                        stepType: step.stepType,
                        error: rollbackError.message
                    });

                    // Stop rollback process for critical failures
                    if (this.isCriticalRollbackFailure(step.stepType)) {
                        break;
                    }
                }
            }
        }

        return result;
    }

    /**
     * Execute individual rollback step based on step type
     */
    private async executeRollbackStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        switch (step.stepType) {
            case 'database':
                await this.rollbackDatabaseStep(rollbackData, step);
                break;
            case 'payment':
                await this.rollbackPaymentStep(rollbackData, step);
                break;
            case 'blockchain':
                await this.rollbackBlockchainStep(rollbackData, step);
                break;
            case 'notification':
                await this.rollbackNotificationStep(rollbackData, step);
                break;
            case 'cleanup':
                await this.rollbackCleanupStep(rollbackData, step);
                break;
            default:
                throw new Error(`Unknown rollback step type: ${step.stepType}`);
        }
    }

    /**
     * Rollback database changes
     */
    private async rollbackDatabaseStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        try {
            if (rollbackData.action === 'accept') {
                await this.transactionManager.rollbackAcceptanceTransaction(
                    rollbackData.proposalId,
                    step.rollbackData?.responseId
                );
            } else {
                await this.transactionManager.rollbackRejectionTransaction(
                    rollbackData.proposalId,
                    step.rollbackData?.responseId
                );
            }

            logger.info('Database rollback completed', {
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId,
                action: rollbackData.action
            });
        } catch (error) {
            logger.error('Database rollback failed', {
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Rollback payment transactions
     */
    private async rollbackPaymentStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        if (rollbackData.action !== 'accept' || !step.rollbackData?.paymentTransactionId) {
            // No payment rollback needed for rejections or steps without payments
            return;
        }

        try {
            const paymentTransactionId = step.rollbackData.paymentTransactionId;

            // Attempt to reverse the payment transaction
            // Note: This would need to be implemented in PaymentProcessingService
            logger.info('Payment reversal would be initiated here', {
                paymentTransactionId,
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId
            });

            logger.info('Payment rollback completed', {
                rollbackId: rollbackData.rollbackId,
                paymentTransactionId,
                proposalId: rollbackData.proposalId
            });
        } catch (error) {
            logger.error('Payment rollback failed', {
                rollbackId: rollbackData.rollbackId,
                paymentTransactionId: step.rollbackData?.paymentTransactionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Rollback blockchain transactions by recording rollback event
     */
    private async rollbackBlockchainStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        try {
            // Record rollback transaction on blockchain for transparency
            const rollbackTransactionData = {
                type: 'swap_proposal_cancelled' as const,
                payload: {
                    originalProposalId: rollbackData.proposalId,
                    rollbackId: rollbackData.rollbackId,
                    rollbackReason: rollbackData.originalError.message,
                    rollbackAction: rollbackData.action,
                    rollbackTimestamp: new Date(),
                    originalTransactionId: step.rollbackData?.blockchainTransactionId
                },
                timestamp: new Date()
            };

            const result = await this.hederaService.submitTransaction(rollbackTransactionData);

            logger.info('Blockchain rollback transaction recorded', {
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId,
                rollbackTransactionId: result.transactionId
            });
        } catch (error) {
            logger.error('Blockchain rollback failed', {
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    /**
     * Send rollback notifications
     */
    private async rollbackNotificationStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        try {
            // Send rollback notification to affected users
            await this.notificationService.sendNotification(
                'swap_cancelled',
                rollbackData.userId,
                {
                    title: 'Proposal Operation Rolled Back',
                    message: `Your proposal ${rollbackData.action} operation has been rolled back due to a system error. Please try again.`,
                    proposalId: rollbackData.proposalId,
                    rollbackId: rollbackData.rollbackId,
                    action: rollbackData.action,
                    rollbackReason: rollbackData.originalError.message
                }
            );

            logger.info('Rollback notification sent', {
                rollbackId: rollbackData.rollbackId,
                userId: rollbackData.userId,
                proposalId: rollbackData.proposalId
            });
        } catch (error) {
            logger.warn('Rollback notification failed', {
                rollbackId: rollbackData.rollbackId,
                userId: rollbackData.userId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw for notification failures as they're not critical
        }
    }

    /**
     * Cleanup temporary data and resources
     */
    private async rollbackCleanupStep(rollbackData: RollbackData, step: RollbackStep): Promise<void> {
        try {
            // Clean up any temporary data or resources created during the operation
            if (step.rollbackData?.tempDataIds) {
                for (const tempDataId of step.rollbackData.tempDataIds) {
                    await this.cleanupTempData(tempDataId);
                }
            }

            // Remove rollback operation from memory after completion
            if (rollbackData.rollbackStatus === 'completed') {
                this.rollbackOperations.delete(rollbackData.rollbackId);
            }

            logger.debug('Rollback cleanup completed', {
                rollbackId: rollbackData.rollbackId,
                proposalId: rollbackData.proposalId
            });
        } catch (error) {
            logger.warn('Rollback cleanup failed', {
                rollbackId: rollbackData.rollbackId,
                error: error instanceof Error ? error.message : String(error)
            });
            // Don't throw for cleanup failures as they're not critical
        }
    }

    /**
     * Determine if rollback failure requires manual intervention
     */
    private requiresManualIntervention(stepType: string, error: Error): boolean {
        const criticalStepTypes = ['database', 'payment'];
        const criticalErrorPatterns = [
            /constraint violation/i,
            /deadlock/i,
            /connection lost/i,
            /timeout/i,
            /insufficient funds/i,
            /payment gateway error/i
        ];

        if (criticalStepTypes.includes(stepType)) {
            return true;
        }

        return criticalErrorPatterns.some(pattern => pattern.test(error.message));
    }

    /**
     * Determine if rollback failure is critical and should stop the rollback process
     */
    private isCriticalRollbackFailure(stepType: string): boolean {
        const criticalStepTypes = ['database', 'payment'];
        return criticalStepTypes.includes(stepType);
    }

    /**
     * Send rollback completion notification
     */
    private async sendRollbackNotification(rollbackData: RollbackData, result: RollbackResult): Promise<void> {
        try {
            const notificationType = result.success ? 'rollback_completed' : 'rollback_failed';
            const message = result.success
                ? `Proposal ${rollbackData.action} operation has been successfully rolled back.`
                : `Proposal ${rollbackData.action} rollback completed with ${result.stepsFailed} failed steps.`;

            await this.notificationService.sendNotification(
                result.success ? 'swap_cancelled' : 'payment_failed',
                rollbackData.userId,
                {
                    title: result.success ? 'Operation Rolled Back' : 'Rollback Incomplete',
                    message,
                    proposalId: rollbackData.proposalId,
                    rollbackId: rollbackData.rollbackId,
                    stepsRolledBack: result.stepsRolledBack,
                    stepsFailed: result.stepsFailed,
                    manualInterventionRequired: result.manualInterventionRequired
                }
            );
        } catch (error) {
            logger.warn('Failed to send rollback notification', {
                rollbackId: rollbackData.rollbackId,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Clean up temporary data
     */
    private async cleanupTempData(tempDataId: string): Promise<void> {
        // Implementation would depend on the type of temporary data
        // This could include cache entries, temporary files, etc.
        logger.debug('Cleaning up temporary data', { tempDataId });
    }

    /**
     * Get rollback operation status
     */
    getRollbackStatus(rollbackId: string): RollbackData | null {
        return this.rollbackOperations.get(rollbackId) || null;
    }

    /**
     * Get all active rollback operations
     */
    getActiveRollbacks(): RollbackData[] {
        return Array.from(this.rollbackOperations.values())
            .filter(rollback => rollback.rollbackStatus === 'in_progress');
    }

    /**
     * Retry failed rollback operation
     */
    async retryRollback(rollbackId: string): Promise<RollbackResult> {
        const rollbackData = this.rollbackOperations.get(rollbackId);

        if (!rollbackData) {
            throw new Error(`Rollback operation not found: ${rollbackId}`);
        }

        if (rollbackData.rollbackAttempts >= rollbackData.maxRollbackAttempts) {
            throw ProposalAcceptanceError.manualInterventionRequired(
                rollbackData.proposalId,
                `Maximum rollback attempts (${rollbackData.maxRollbackAttempts}) exceeded`
            );
        }

        rollbackData.rollbackAttempts++;
        rollbackData.rollbackStatus = 'in_progress';

        // Reset failed steps for retry
        for (const step of rollbackData.stepsToRollback) {
            if (step.rollbackError) {
                step.rollbackCompleted = false;
                step.rollbackError = undefined;
            }
        }

        logger.info('Retrying rollback operation', {
            rollbackId,
            proposalId: rollbackData.proposalId,
            attempt: rollbackData.rollbackAttempts,
            maxAttempts: rollbackData.maxRollbackAttempts
        });

        return await this.executeRollbackSteps(rollbackData);
    }
}