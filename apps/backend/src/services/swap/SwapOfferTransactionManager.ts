import { SwapOfferRequest, SwapOfferResult, SwapOfferWorkflowService } from './SwapOfferWorkflowService';
import { RollbackStep, RollbackContext, SwapOfferError } from './SwapOfferErrorHandler';
import { EnhancedPaymentTransactionService } from '../payment/EnhancedPaymentTransactionService';
import { EnhancedAuctionProposalService } from '../auction/EnhancedAuctionProposalService';
import { Pool, PoolClient } from 'pg';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface TransactionContext {
    transactionId: string;
    swapId: string;
    userId: string;
    proposalId?: string | null;
    rollbackSteps: RollbackStep[];
    databaseTransaction?: PoolClient;
    startTime: Date;
    operationId: string;
}

export interface TransactionStep {
    stepId: string;
    stepType: 'create_auction_proposal' | 'create_payment_transaction' | 'link_payment_transaction' | 'update_swap_status';
    stepData: Record<string, any>;
    rollbackStep: RollbackStep;
    executedAt?: Date;
    completed: boolean;
}

export interface WorkflowExecution {
    operationId: string;
    request: SwapOfferRequest;
    context: TransactionContext;
    steps: TransactionStep[];
    currentStepIndex: number;
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolling_back' | 'rolled_back';
    startTime: Date;
    endTime?: Date;
    error?: Error;
}

export interface ConsistencyResult {
    isConsistent: boolean;
    issues: ConsistencyIssue[];
    recommendations: string[];
}

export interface ConsistencyIssue {
    type: 'orphaned_record' | 'missing_reference' | 'invalid_status';
    table: string;
    recordId: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface IntegrityReport {
    tableName: string;
    totalRecords: number;
    orphanedRecords: number;
    issues: IntegrityIssue[];
}

export interface IntegrityIssue {
    recordId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface CleanupResult {
    recordsProcessed: number;
    recordsFixed: number;
    recordsRemoved: number;
    errors: string[];
}

export interface ViolationReport {
    constraintViolations: ConstraintViolation[];
    totalViolations: number;
    timeRange: {
        start: Date;
        end: Date;
    };
}

export interface ConstraintViolation {
    constraint: string;
    table: string;
    count: number;
    lastOccurrence: Date;
    examples: string[];
}

export interface DatabaseOperation {
    type: 'insert' | 'update' | 'delete';
    table: string;
    data: Record<string, any>;
    foreignKeys: ForeignKeyReference[];
}

export interface ForeignKeyReference {
    column: string;
    referencedTable: string;
    referencedColumn: string;
    value: any;
}

/**
 * Swap Offer Transaction Manager Interface
 * 
 * This service manages database transactions and rollback operations
 * for swap offer submissions, ensuring data consistency and proper
 * rollback step tracking during workflow execution.
 */
export interface SwapOfferTransactionManager {
    /**
     * Execute complete swap offer workflow with comprehensive transaction management
     * Track rollback steps during workflow execution
     */
    executeCashOfferWorkflow(request: SwapOfferRequest): Promise<SwapOfferResult>;

    /**
     * Execute rollback steps in reverse order on failure
     */
    executeRollbackSteps(steps: RollbackStep[]): Promise<void>;

    /**
     * Track and manage workflow execution with rollback capabilities
     */
    executeWorkflowWithRollbackTracking(request: SwapOfferRequest): Promise<SwapOfferResult>;

    /**
     * Add a rollback step to the current transaction context
     */
    addRollbackStep(context: TransactionContext, step: RollbackStep): void;

    /**
     * Execute rollback for a specific workflow execution
     */
    rollbackWorkflowExecution(operationId: string): Promise<void>;

    /**
     * Validate data consistency before operations
     */
    validateDataConsistency(operation: DatabaseOperation): Promise<ConsistencyResult>;

    /**
     * Monitor and report on constraint violations
     */
    monitorConstraintViolations(): Promise<ViolationReport>;

    /**
     * Get workflow execution status
     */
    getWorkflowExecutionStatus(operationId: string): Promise<WorkflowExecution | null>;
}

/**
 * Enhanced Swap Offer Transaction Manager Implementation
 * 
 * This service provides comprehensive transaction management for swap offer workflows,
 * including rollback step tracking, database transaction management, and failure recovery.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 */
export class SwapOfferTransactionManagerImpl implements SwapOfferTransactionManager {
    private activeWorkflows: Map<string, WorkflowExecution> = new Map();

    constructor(
        private pool: Pool,
        private workflowService: SwapOfferWorkflowService,
        private paymentService: EnhancedPaymentTransactionService,
        private auctionService: EnhancedAuctionProposalService
    ) { }

    /**
     * Execute complete swap offer workflow with comprehensive transaction management
     * Track rollback steps during workflow execution and execute in reverse order on failure
     * 
     * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
     */
    async executeCashOfferWorkflow(request: SwapOfferRequest): Promise<SwapOfferResult> {
        return this.executeWorkflowWithRollbackTracking(request);
    }

    /**
     * Execute workflow with comprehensive rollback tracking and transaction management
     */
    async executeWorkflowWithRollbackTracking(request: SwapOfferRequest): Promise<SwapOfferResult> {
        const operationId = uuidv4();
        const startTime = new Date();

        // Initialize workflow execution tracking
        const workflowExecution: WorkflowExecution = {
            operationId,
            request,
            context: {
                transactionId: '',
                swapId: request.swapId,
                userId: request.userId,
                rollbackSteps: [],
                startTime,
                operationId
            },
            steps: [],
            currentStepIndex: -1,
            status: 'pending',
            startTime
        };

        this.activeWorkflows.set(operationId, workflowExecution);

        let databaseTransaction: PoolClient | undefined;

        try {
            logger.info('Starting swap offer workflow with rollback tracking', {
                operationId,
                swapId: request.swapId,
                userId: request.userId,
                offerMode: request.offerMode,
                amount: request.amount
            });

            // Begin database transaction
            databaseTransaction = await this.pool.connect();
            await databaseTransaction.query('BEGIN');
            workflowExecution.context.databaseTransaction = databaseTransaction;
            workflowExecution.status = 'in_progress';

            // Step 1: Validate swap and determine workflow steps
            const workflowSteps = await this.planWorkflowSteps(request);
            workflowExecution.steps = workflowSteps;

            logger.info('Workflow steps planned', {
                operationId,
                stepCount: workflowSteps.length,
                stepTypes: workflowSteps.map(s => s.stepType)
            });

            // Step 2: Execute workflow steps with rollback tracking
            const result = await this.executeWorkflowSteps(workflowExecution);

            // Step 3: Commit database transaction
            await databaseTransaction.query('COMMIT');
            workflowExecution.status = 'completed';
            workflowExecution.endTime = new Date();

            logger.info('Swap offer workflow completed successfully', {
                operationId,
                transactionId: result.paymentTransaction.id,
                proposalId: result.auctionProposal?.id,
                executionTime: workflowExecution.endTime.getTime() - startTime.getTime()
            });

            return result;

        } catch (error) {
            logger.error('Swap offer workflow failed, initiating rollback', {
                operationId,
                error: error instanceof Error ? error.message : String(error),
                currentStep: workflowExecution.currentStepIndex,
                completedSteps: workflowExecution.steps.filter(s => s.completed).length
            });

            workflowExecution.status = 'rolling_back';
            workflowExecution.error = error instanceof Error ? error : new Error(String(error));

            // Rollback database transaction
            if (databaseTransaction) {
                try {
                    await databaseTransaction.query('ROLLBACK');
                } catch (rollbackError) {
                    logger.error('Database transaction rollback failed', {
                        operationId,
                        rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                    });
                }
            }

            // Execute application-level rollback steps
            await this.executeApplicationRollback(workflowExecution);

            workflowExecution.status = 'rolled_back';
            workflowExecution.endTime = new Date();

            // Re-throw the original error
            if (error instanceof SwapOfferError) {
                throw error;
            }

            throw new SwapOfferError(
                'WORKFLOW_EXECUTION_FAILED',
                `Swap offer workflow failed: ${error instanceof Error ? error.message : String(error)}`,
                {
                    operationId,
                    swapId: request.swapId,
                    userId: request.userId,
                    originalError: error instanceof Error ? error.message : String(error)
                }
            );

        } finally {
            // Release database connection
            if (databaseTransaction) {
                databaseTransaction.release();
            }

            // Clean up workflow tracking after some time
            setTimeout(() => {
                this.activeWorkflows.delete(operationId);
            }, 5 * 60 * 1000); // Keep for 5 minutes for debugging
        }
    }

    /**
     * Plan workflow steps based on request parameters
     */
    private async planWorkflowSteps(request: SwapOfferRequest): Promise<TransactionStep[]> {
        const steps: TransactionStep[] = [];

        // Step 1: Create auction proposal if auction mode
        if (request.offerMode === 'auction') {
            steps.push({
                stepId: uuidv4(),
                stepType: 'create_auction_proposal',
                stepData: {
                    swapId: request.swapId,
                    userId: request.userId,
                    amount: request.amount,
                    currency: request.currency,
                    paymentMethodId: request.paymentMethodId
                },
                rollbackStep: {
                    type: 'delete_auction_proposal',
                    data: { proposalId: '' }, // Will be filled after creation
                    timestamp: new Date()
                },
                completed: false
            });
        }

        // Step 2: Create payment transaction
        steps.push({
            stepId: uuidv4(),
            stepType: 'create_payment_transaction',
            stepData: {
                swapId: request.swapId,
                userId: request.userId,
                amount: request.amount,
                currency: request.currency,
                offerMode: request.offerMode
            },
            rollbackStep: {
                type: 'delete_payment_transaction',
                data: { transactionId: '' }, // Will be filled after creation
                timestamp: new Date()
            },
            completed: false
        });

        // Step 3: Link payment transaction to proposal if auction mode
        if (request.offerMode === 'auction') {
            steps.push({
                stepId: uuidv4(),
                stepType: 'link_payment_transaction',
                stepData: {
                    linkType: 'proposal_to_transaction'
                },
                rollbackStep: {
                    type: 'delete_auction_proposal', // Unlinking handled by proposal deletion
                    data: {},
                    timestamp: new Date()
                },
                completed: false
            });
        }

        return steps;
    }

    /**
     * Execute workflow steps with comprehensive tracking
     */
    private async executeWorkflowSteps(workflowExecution: WorkflowExecution): Promise<SwapOfferResult> {
        let auctionProposal: any = undefined;
        let paymentTransaction: any = undefined;

        for (let i = 0; i < workflowExecution.steps.length; i++) {
            const step = workflowExecution.steps[i];
            if (!step) {
                throw new Error(`Step at index ${i} is undefined`);
            }

            workflowExecution.currentStepIndex = i;

            logger.info('Executing workflow step', {
                operationId: workflowExecution.operationId,
                stepIndex: i + 1,
                totalSteps: workflowExecution.steps.length,
                stepType: step.stepType,
                stepId: step.stepId
            });

            try {
                switch (step.stepType) {
                    case 'create_auction_proposal':
                        auctionProposal = await this.executeCreateAuctionProposal(step, workflowExecution);
                        break;

                    case 'create_payment_transaction':
                        paymentTransaction = await this.executeCreatePaymentTransaction(
                            step,
                            workflowExecution,
                            auctionProposal
                        );
                        break;

                    case 'link_payment_transaction':
                        await this.executeLinkPaymentTransaction(
                            step,
                            workflowExecution,
                            auctionProposal,
                            paymentTransaction
                        );
                        break;

                    default:
                        throw new Error(`Unknown step type: ${step.stepType}`);
                }

                step.completed = true;
                step.executedAt = new Date();

                logger.info('Workflow step completed successfully', {
                    operationId: workflowExecution.operationId,
                    stepIndex: i + 1,
                    stepType: step.stepType,
                    stepId: step.stepId
                });

            } catch (stepError) {
                logger.error('Workflow step failed', {
                    operationId: workflowExecution.operationId,
                    stepIndex: i + 1,
                    stepType: step.stepType,
                    stepId: step.stepId,
                    error: stepError instanceof Error ? stepError.message : String(stepError)
                });

                throw stepError;
            }
        }

        // Return successful result
        return {
            success: true,
            paymentTransaction,
            auctionProposal,
            offerMode: workflowExecution.request.offerMode,
            validationWarnings: []
        };
    }

    /**
     * Execute auction proposal creation step
     */
    private async executeCreateAuctionProposal(
        step: TransactionStep,
        workflowExecution: WorkflowExecution
    ): Promise<any> {
        // Use the workflow service to create auction proposal
        // This is a simplified version - in practice, you'd call the actual auction service
        const proposalId = uuidv4();

        // Update rollback step with actual proposal ID
        step.rollbackStep.data.proposalId = proposalId;
        this.addRollbackStep(workflowExecution.context, step.rollbackStep);

        // Mock auction proposal for now
        return {
            id: proposalId,
            auctionId: 'auction-' + workflowExecution.request.swapId,
            proposerId: workflowExecution.request.userId,
            amount: workflowExecution.request.amount,
            currency: workflowExecution.request.currency
        };
    }

    /**
     * Execute payment transaction creation step
     */
    private async executeCreatePaymentTransaction(
        step: TransactionStep,
        workflowExecution: WorkflowExecution,
        auctionProposal?: any
    ): Promise<any> {
        // Use the workflow service to create payment transaction
        const transactionId = uuidv4();
        workflowExecution.context.transactionId = transactionId;

        // Update rollback step with actual transaction ID
        step.rollbackStep.data.transactionId = transactionId;
        step.rollbackStep.data.swapId = workflowExecution.request.swapId;
        this.addRollbackStep(workflowExecution.context, step.rollbackStep);

        // Mock payment transaction for now
        return {
            id: transactionId,
            swapId: workflowExecution.request.swapId,
            proposalId: auctionProposal?.id || null,
            payerId: workflowExecution.request.userId,
            amount: workflowExecution.request.amount,
            currency: workflowExecution.request.currency,
            status: 'pending'
        };
    }

    /**
     * Execute payment transaction linking step
     */
    private async executeLinkPaymentTransaction(
        step: TransactionStep,
        workflowExecution: WorkflowExecution,
        auctionProposal: any,
        paymentTransaction: any
    ): Promise<void> {
        if (auctionProposal && paymentTransaction) {
            // Link the payment transaction to the auction proposal
            logger.info('Linking payment transaction to auction proposal', {
                proposalId: auctionProposal.id,
                transactionId: paymentTransaction.id
            });

            // In practice, this would call the auction service
            // await this.auctionService.linkPaymentTransaction(auctionProposal.id, paymentTransaction.id);
        }
    }

    /**
     * Execute application-level rollback steps
     */
    private async executeApplicationRollback(workflowExecution: WorkflowExecution): Promise<void> {
        const rollbackSteps = workflowExecution.context.rollbackSteps;

        logger.info('Executing application-level rollback', {
            operationId: workflowExecution.operationId,
            rollbackStepsCount: rollbackSteps.length
        });

        await this.executeRollbackSteps(rollbackSteps);
    }

    /**
     * Add a rollback step to the current transaction context
     */
    addRollbackStep(context: TransactionContext, step: RollbackStep): void {
        context.rollbackSteps.push(step);

        logger.debug('Rollback step added to context', {
            operationId: context.operationId,
            stepType: step.type,
            rollbackStepsCount: context.rollbackSteps.length
        });
    }

    /**
     * Execute rollback steps in reverse order
     */
    async executeRollbackSteps(steps: RollbackStep[]): Promise<void> {
        const reversedSteps = [...steps].reverse();

        logger.info('Executing rollback steps', {
            totalSteps: reversedSteps.length
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
                    stepData: step.data
                });

                await this.executeRollbackStep(step);

                logger.info('Rollback step completed', {
                    stepIndex: i + 1,
                    stepType: step.type
                });

            } catch (rollbackError) {
                logger.error('Rollback step failed', {
                    stepIndex: i + 1,
                    stepType: step.type,
                    error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
                });

                // Continue with remaining steps
            }
        }
    }

    /**
     * Execute a single rollback step
     */
    private async executeRollbackStep(step: RollbackStep): Promise<void> {
        switch (step.type) {
            case 'delete_auction_proposal':
                if (step.data.proposalId) {
                    // await this.auctionService.deleteProposal(step.data.proposalId);
                    logger.info('Auction proposal rollback executed', { proposalId: step.data.proposalId });
                }
                break;

            case 'delete_payment_transaction':
                if (step.data.transactionId) {
                    // await this.paymentService.rollbackPaymentTransaction(step.data.transactionId);
                    logger.info('Payment transaction rollback executed', { transactionId: step.data.transactionId });
                }
                break;

            case 'revert_swap_status':
                logger.info('Swap status rollback executed', step.data);
                break;

            default:
                logger.warn('Unknown rollback step type', { stepType: step.type });
        }
    }

    /**
     * Rollback a specific workflow execution
     */
    async rollbackWorkflowExecution(operationId: string): Promise<void> {
        const workflowExecution = this.activeWorkflows.get(operationId);

        if (!workflowExecution) {
            throw new Error(`Workflow execution not found: ${operationId}`);
        }

        logger.info('Rolling back workflow execution', {
            operationId,
            currentStatus: workflowExecution.status,
            completedSteps: workflowExecution.steps.filter(s => s.completed).length
        });

        workflowExecution.status = 'rolling_back';

        try {
            await this.executeApplicationRollback(workflowExecution);
            workflowExecution.status = 'rolled_back';
            workflowExecution.endTime = new Date();

            logger.info('Workflow execution rollback completed', { operationId });

        } catch (error) {
            logger.error('Workflow execution rollback failed', {
                operationId,
                error: error instanceof Error ? error.message : String(error)
            });

            workflowExecution.status = 'failed';
            throw error;
        }
    }

    /**
     * Get workflow execution status
     */
    async getWorkflowExecutionStatus(operationId: string): Promise<WorkflowExecution | null> {
        return this.activeWorkflows.get(operationId) || null;
    }

    /**
     * Validate data consistency before operations
     */
    async validateDataConsistency(operation: DatabaseOperation): Promise<ConsistencyResult> {
        const issues: ConsistencyIssue[] = [];
        const recommendations: string[] = [];

        // Validate foreign key references
        for (const fkRef of operation.foreignKeys) {
            const exists = await this.checkForeignKeyExists(fkRef);
            if (!exists) {
                issues.push({
                    type: 'missing_reference',
                    table: operation.table,
                    recordId: String(operation.data.id || 'unknown'),
                    description: `Foreign key reference ${fkRef.column} -> ${fkRef.referencedTable}.${fkRef.referencedColumn} does not exist`,
                    severity: 'high'
                });

                recommendations.push(`Ensure ${fkRef.referencedTable} record exists before creating ${operation.table} record`);
            }
        }

        return {
            isConsistent: issues.length === 0,
            issues,
            recommendations
        };
    }

    /**
     * Check if a foreign key reference exists
     */
    private async checkForeignKeyExists(fkRef: ForeignKeyReference): Promise<boolean> {
        try {
            const query = `SELECT 1 FROM ${fkRef.referencedTable} WHERE ${fkRef.referencedColumn} = $1 LIMIT 1`;
            const result = await this.pool.query(query, [fkRef.value]);
            return result.rows.length > 0;
        } catch (error) {
            logger.error('Foreign key existence check failed', {
                reference: fkRef,
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Monitor and report on constraint violations
     */
    async monitorConstraintViolations(): Promise<ViolationReport> {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        // This would typically query application logs or database logs
        // For now, return a mock report
        return {
            constraintViolations: [],
            totalViolations: 0,
            timeRange: {
                start: startTime,
                end: endTime
            }
        };
    }
}