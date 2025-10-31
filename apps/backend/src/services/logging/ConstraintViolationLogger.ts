import { SwapOfferContext, DatabaseError, CONSTRAINT_MAPPINGS } from '../swap/SwapOfferErrorHandler';

export interface ConstraintViolationLogEntry {
    timestamp: string;
    constraintName: string;
    table: string;
    referencedTable?: string;
    column: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    context: {
        userId?: string;
        swapId?: string;
        proposalId?: string | null;
        transactionId?: string;
        scenario?: string;
        [key: string]: any;
    };
    errorDetail: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    suggestedAction?: string;
}

export interface ConstraintViolationMetrics {
    totalViolations: number;
    violationsByConstraint: Record<string, number>;
    violationsByTable: Record<string, number>;
    violationsByUser: Record<string, number>;
    recentViolations: ConstraintViolationLogEntry[];
    timeRange: {
        start: string;
        end: string;
    };
}

/**
 * Enhanced Logging Service for Database Constraint Violations
 * 
 * Provides comprehensive logging and monitoring of constraint violations
 * with detailed context and metrics for debugging and analysis.
 */
export class ConstraintViolationLogger {
    private logger: any;
    private metricsStore: any;

    constructor(logger: any, metricsStore?: any) {
        this.logger = logger;
        this.metricsStore = metricsStore;
    }

    /**
     * Log constraint violation with full context and analysis
     */
    logConstraintViolation(
        error: DatabaseError,
        context: SwapOfferContext,
        operation: 'INSERT' | 'UPDATE' | 'DELETE' = 'INSERT'
    ): ConstraintViolationLogEntry {
        const constraintName = error.constraint || 'unknown_constraint';
        const constraintMapping = CONSTRAINT_MAPPINGS[constraintName as keyof typeof CONSTRAINT_MAPPINGS];

        const logEntry: ConstraintViolationLogEntry = {
            timestamp: new Date().toISOString(),
            constraintName,
            table: constraintMapping?.table || error.table || 'unknown_table',
            referencedTable: constraintMapping?.referencedTable,
            column: constraintMapping?.column || error.column || 'unknown_column',
            operation,
            context: {
                userId: context.userId,
                swapId: context.swapId,
                proposalId: context.proposalId,
                scenario: context.scenario,
                amount: context.amount,
                currency: context.currency
            },
            errorDetail: error.detail || error.message || 'No error detail available',
            severity: this.determineSeverity(constraintName, context),
            suggestedAction: this.getSuggestedAction(constraintName, context)
        };

        // Log with appropriate level based on severity
        this.logWithSeverity(logEntry);

        // Store metrics if metrics store is available
        if (this.metricsStore) {
            this.updateMetrics(logEntry);
        }

        // Log additional context for debugging
        this.logDebuggingContext(logEntry, error);

        return logEntry;
    }

    /**
     * Log constraint violation with appropriate severity level
     */
    private logWithSeverity(entry: ConstraintViolationLogEntry): void {
        const logData = {
            constraintViolation: {
                constraint: entry.constraintName,
                table: entry.table,
                referencedTable: entry.referencedTable,
                column: entry.column,
                operation: entry.operation
            },
            context: entry.context,
            errorDetail: entry.errorDetail,
            suggestedAction: entry.suggestedAction,
            timestamp: entry.timestamp
        };

        switch (entry.severity) {
            case 'critical':
                this.logger.critical('Critical constraint violation detected', logData);
                break;
            case 'high':
                this.logger.error('High severity constraint violation', logData);
                break;
            case 'medium':
                this.logger.warn('Medium severity constraint violation', logData);
                break;
            case 'low':
                this.logger.info('Low severity constraint violation', logData);
                break;
        }
    }

    /**
     * Determine severity based on constraint type and context
     */
    private determineSeverity(constraintName: string, context: SwapOfferContext): 'low' | 'medium' | 'high' | 'critical' {
        // Critical: Core foreign key violations that indicate data corruption
        if (constraintName.includes('payment_transactions_swap_id_fkey') ||
            constraintName.includes('payment_transactions_payer_id_fkey') ||
            constraintName.includes('payment_transactions_recipient_id_fkey')) {
            return 'critical';
        }

        // High: Proposal reference violations in auction scenarios
        if (constraintName.includes('payment_transactions_proposal_id_fkey') &&
            context.scenario === 'auction') {
            return 'high';
        }

        // Medium: Proposal reference violations in non-auction scenarios (expected)
        if (constraintName.includes('payment_transactions_proposal_id_fkey') &&
            context.scenario !== 'auction') {
            return 'medium';
        }

        // Medium: Auction proposal violations
        if (constraintName.includes('auction_proposals_')) {
            return 'medium';
        }

        // Low: Other constraint violations
        return 'low';
    }

    /**
     * Get suggested action based on constraint violation
     */
    private getSuggestedAction(constraintName: string, context: SwapOfferContext): string {
        if (constraintName.includes('payment_transactions_proposal_id_fkey')) {
            if (context.scenario === 'auction') {
                return 'Ensure auction proposal is created before payment transaction';
            } else {
                return 'Use NULL for proposal_id in direct swap scenarios';
            }
        }

        if (constraintName.includes('payment_transactions_swap_id_fkey')) {
            return 'Verify swap exists and is active before creating payment transaction';
        }

        if (constraintName.includes('payment_transactions_payer_id_fkey') ||
            constraintName.includes('payment_transactions_recipient_id_fkey')) {
            return 'Verify user accounts exist and are active';
        }

        if (constraintName.includes('auction_proposals_auction_id_fkey')) {
            return 'Ensure auction exists and is active before creating proposals';
        }

        return 'Review data integrity and retry operation';
    }

    /**
     * Log additional debugging context
     */
    private logDebuggingContext(entry: ConstraintViolationLogEntry, error: DatabaseError): void {
        this.logger.debug('Constraint violation debugging context', {
            constraintViolation: entry.constraintName,
            databaseError: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                constraint: error.constraint,
                table: error.table,
                column: error.column,
                detail: error.detail
            },
            systemContext: {
                nodeVersion: process.version,
                platform: process.platform,
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            },
            timestamp: entry.timestamp
        });
    }

    /**
     * Update metrics for constraint violations
     */
    private updateMetrics(entry: ConstraintViolationLogEntry): void {
        if (!this.metricsStore) return;

        try {
            // Increment total violations counter
            this.metricsStore.increment('constraint_violations.total');

            // Increment by constraint name
            this.metricsStore.increment(`constraint_violations.by_constraint.${entry.constraintName}`);

            // Increment by table
            this.metricsStore.increment(`constraint_violations.by_table.${entry.table}`);

            // Increment by severity
            this.metricsStore.increment(`constraint_violations.by_severity.${entry.severity}`);

            // Increment by user (if available)
            if (entry.context.userId) {
                this.metricsStore.increment(`constraint_violations.by_user.${entry.context.userId}`);
            }

            // Store recent violation for analysis
            this.metricsStore.addToList('constraint_violations.recent', entry, 100); // Keep last 100

        } catch (metricsError) {
            const errorMessage = metricsError instanceof Error ? metricsError.message : String(metricsError);
            this.logger.warn('Failed to update constraint violation metrics', {
                error: errorMessage,
                entry: entry.constraintName
            });
        }
    }

    /**
     * Get constraint violation metrics for analysis
     */
    async getConstraintViolationMetrics(timeRange?: { start: Date; end: Date }): Promise<ConstraintViolationMetrics> {
        if (!this.metricsStore) {
            throw new Error('Metrics store not available');
        }

        const start = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
        const end = timeRange?.end || new Date();

        try {
            const [
                totalViolations,
                violationsByConstraint,
                violationsByTable,
                violationsByUser,
                recentViolations
            ] = await Promise.all([
                this.metricsStore.getCounter('constraint_violations.total'),
                this.metricsStore.getCountersByPrefix('constraint_violations.by_constraint'),
                this.metricsStore.getCountersByPrefix('constraint_violations.by_table'),
                this.metricsStore.getCountersByPrefix('constraint_violations.by_user'),
                this.metricsStore.getList('constraint_violations.recent', 50)
            ]);

            return {
                totalViolations: totalViolations || 0,
                violationsByConstraint: violationsByConstraint || {},
                violationsByTable: violationsByTable || {},
                violationsByUser: violationsByUser || {},
                recentViolations: recentViolations || [],
                timeRange: {
                    start: start.toISOString(),
                    end: end.toISOString()
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error('Failed to retrieve constraint violation metrics', {
                error: errorMessage,
                timeRange: { start: start.toISOString(), end: end.toISOString() }
            });
            throw error;
        }
    }

    /**
     * Log constraint violation patterns for analysis
     */
    logConstraintViolationPattern(
        constraintName: string,
        occurrences: number,
        timeWindow: string,
        context: Record<string, any>
    ): void {
        this.logger.warn('Constraint violation pattern detected', {
            pattern: {
                constraint: constraintName,
                occurrences,
                timeWindow,
                threshold: 'exceeded'
            },
            context,
            analysis: {
                possibleCauses: this.getPossibleCauses(constraintName),
                recommendedActions: this.getRecommendedActions(constraintName, occurrences)
            },
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get possible causes for constraint violation patterns
     */
    private getPossibleCauses(constraintName: string): string[] {
        const causes = {
            'payment_transactions_proposal_id_fkey': [
                'Race condition between proposal creation and payment transaction',
                'Incorrect scenario detection (auction vs direct)',
                'Proposal deletion before payment transaction creation'
            ],
            'payment_transactions_swap_id_fkey': [
                'Swap deleted while offer submission in progress',
                'Invalid swap ID in request',
                'Database synchronization issues'
            ],
            'payment_transactions_payer_id_fkey': [
                'User account deleted or deactivated',
                'Invalid user ID in request',
                'Authentication token issues'
            ]
        };

        return causes[constraintName as keyof typeof causes] || ['Unknown constraint violation cause'];
    }

    /**
     * Get recommended actions for constraint violation patterns
     */
    private getRecommendedActions(constraintName: string, occurrences: number): string[] {
        const baseActions = [
            'Review recent code changes',
            'Check database integrity',
            'Analyze user behavior patterns'
        ];

        if (occurrences > 10) {
            baseActions.push('Consider implementing circuit breaker');
            baseActions.push('Review system load and performance');
        }

        if (constraintName.includes('proposal_id_fkey')) {
            baseActions.push('Review auction proposal creation timing');
            baseActions.push('Implement stronger transaction isolation');
        }

        return baseActions;
    }
}