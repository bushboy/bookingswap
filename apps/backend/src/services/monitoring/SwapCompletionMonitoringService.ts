import { SwapCompletionError, SwapCompletionErrorCodes } from '../../utils/SwapCompletionError';
import { enhancedLogger } from '../../utils/logger';

/**
 * Metrics for swap completion operations
 */
export interface SwapCompletionMetrics {
    // Completion counts
    totalCompletions: number;
    successfulCompletions: number;
    failedCompletions: number;
    rolledBackCompletions: number;

    // Completion types
    bookingExchangeCompletions: number;
    cashPaymentCompletions: number;

    // Performance metrics
    averageCompletionTimeMs: number;
    medianCompletionTimeMs: number;
    maxCompletionTimeMs: number;
    minCompletionTimeMs: number;

    // Error metrics
    validationFailures: number;
    databaseTransactionFailures: number;
    blockchainRecordingFailures: number;
    rollbackFailures: number;
    timeoutFailures: number;
    concurrencyConflicts: number;

    // Retry metrics
    totalRetryAttempts: number;
    successfulRetries: number;
    failedRetries: number;

    // Blockchain metrics
    blockchainTransactionCount: number;
    blockchainSuccessRate: number;
    averageBlockchainConfirmationTimeMs: number;

    // System health
    activeCompletions: number;
    queuedCompletions: number;
    lastSuccessfulCompletion?: Date;
    lastFailedCompletion?: Date;
}

/**
 * Completion event for monitoring
 */
export interface CompletionEvent {
    id: string;
    type: 'completion_started' | 'completion_success' | 'completion_failed' | 'rollback_started' | 'rollback_success' | 'rollback_failed';
    timestamp: Date;
    completionId: string;
    proposalId: string;
    userId: string;
    completionType: 'booking_exchange' | 'cash_payment';
    affectedEntities: string[];
    durationMs?: number;
    errorCode?: SwapCompletionErrorCodes;
    errorMessage?: string;
    retryAttempt?: number;
    blockchainTransactionId?: string;
    success: boolean;
    metadata?: Record<string, any>;
}

/**
 * Alert configuration for completion monitoring
 */
export interface CompletionAlert {
    id: string;
    type: 'error_rate' | 'completion_time' | 'rollback_rate' | 'blockchain_failure' | 'system_health';
    severity: 'low' | 'medium' | 'high' | 'critical';
    threshold: number;
    currentValue: number;
    message: string;
    timestamp: Date;
    acknowledged: boolean;
    metadata?: Record<string, any>;
}

/**
 * Performance report for completion operations
 */
export interface CompletionPerformanceReport {
    reportId: string;
    generatedAt: Date;
    timeRange: {
        start: Date;
        end: Date;
    };
    metrics: SwapCompletionMetrics;
    trends: {
        completionRate: number; // completions per hour
        errorRate: number; // percentage
        averageResponseTime: number; // milliseconds
        rollbackRate: number; // percentage
    };
    topErrors: Array<{
        errorCode: SwapCompletionErrorCodes;
        count: number;
        percentage: number;
        lastOccurrence: Date;
    }>;
    recommendations: string[];
    alerts: CompletionAlert[];
}

/**
 * Monitoring service for swap completion operations
 */
export class SwapCompletionMonitoringService {
    private static instance: SwapCompletionMonitoringService;
    private metrics: SwapCompletionMetrics;
    private events: CompletionEvent[] = [];
    private alerts: CompletionAlert[] = [];
    private completionTimes: number[] = [];
    private errorCounts: Map<SwapCompletionErrorCodes, number> = new Map();
    private readonly maxEventsToStore = 10000;
    private readonly maxCompletionTimesToStore = 1000;

    private constructor() {
        this.metrics = this.initializeMetrics();
        this.startPeriodicReporting();
    }

    public static getInstance(): SwapCompletionMonitoringService {
        if (!SwapCompletionMonitoringService.instance) {
            SwapCompletionMonitoringService.instance = new SwapCompletionMonitoringService();
        }
        return SwapCompletionMonitoringService.instance;
    }

    /**
     * Record the start of a completion operation
     */
    recordCompletionStart(
        completionId: string,
        proposalId: string,
        userId: string,
        completionType: 'booking_exchange' | 'cash_payment',
        affectedEntities: string[]
    ): void {
        const event: CompletionEvent = {
            id: this.generateEventId(),
            type: 'completion_started',
            timestamp: new Date(),
            completionId,
            proposalId,
            userId,
            completionType,
            affectedEntities,
            success: true // Start events are always successful
        };

        this.addEvent(event);
        this.metrics.activeCompletions++;

        enhancedLogger.info('Completion operation started', {
            completionId,
            proposalId,
            userId,
            completionType,
            affectedEntitiesCount: affectedEntities.length
        });
    }

    /**
     * Record successful completion
     */
    recordCompletionSuccess(
        completionId: string,
        proposalId: string,
        userId: string,
        completionType: 'booking_exchange' | 'cash_payment',
        affectedEntities: string[],
        durationMs: number,
        blockchainTransactionId?: string
    ): void {
        const event: CompletionEvent = {
            id: this.generateEventId(),
            type: 'completion_success',
            timestamp: new Date(),
            completionId,
            proposalId,
            userId,
            completionType,
            affectedEntities,
            durationMs,
            blockchainTransactionId,
            success: true
        };

        this.addEvent(event);
        this.updateSuccessMetrics(completionType, durationMs);

        enhancedLogger.info('Completion operation succeeded', {
            completionId,
            proposalId,
            durationMs,
            blockchainTransactionId,
            affectedEntitiesCount: affectedEntities.length
        });
    }

    /**
     * Record completion failure
     */
    recordCompletionFailure(
        completionId: string,
        proposalId: string,
        userId: string,
        completionType: 'booking_exchange' | 'cash_payment',
        affectedEntities: string[],
        error: SwapCompletionError,
        durationMs?: number,
        retryAttempt?: number
    ): void {
        const event: CompletionEvent = {
            id: this.generateEventId(),
            type: 'completion_failed',
            timestamp: new Date(),
            completionId,
            proposalId,
            userId,
            completionType,
            affectedEntities,
            durationMs,
            errorCode: error.code as SwapCompletionErrorCodes,
            errorMessage: error.message,
            retryAttempt,
            success: false,
            metadata: {
                rollbackRequired: error.rollbackRequired,
                retryable: error.retryable
            }
        };

        this.addEvent(event);
        this.updateFailureMetrics(error.code as SwapCompletionErrorCodes, retryAttempt);

        enhancedLogger.error('Completion operation failed', {
            completionId,
            proposalId,
            errorCode: error.code,
            errorMessage: error.message,
            rollbackRequired: error.rollbackRequired,
            retryAttempt,
            durationMs
        });

        // Check for alert conditions
        this.checkAlertConditions();
    }

    /**
     * Record rollback operation
     */
    recordRollback(
        completionId: string,
        success: boolean,
        durationMs: number,
        error?: SwapCompletionError
    ): void {
        const event: CompletionEvent = {
            id: this.generateEventId(),
            type: success ? 'rollback_success' : 'rollback_failed',
            timestamp: new Date(),
            completionId,
            proposalId: '', // May not be available during rollback
            userId: '', // May not be available during rollback
            completionType: 'booking_exchange', // Default, may not be accurate
            affectedEntities: [],
            durationMs,
            errorCode: error?.code as SwapCompletionErrorCodes,
            errorMessage: error?.message,
            success
        };

        this.addEvent(event);

        if (success) {
            this.metrics.rolledBackCompletions++;
        } else {
            this.metrics.rollbackFailures++;
        }

        enhancedLogger.info('Rollback operation completed', {
            completionId,
            success,
            durationMs,
            errorCode: error?.code
        });
    }

    /**
     * Record blockchain transaction metrics
     */
    recordBlockchainTransaction(
        completionId: string,
        transactionId: string,
        success: boolean,
        confirmationTimeMs: number
    ): void {
        this.metrics.blockchainTransactionCount++;

        if (success) {
            // Update blockchain success rate
            const totalTransactions = this.metrics.blockchainTransactionCount;
            const currentSuccessRate = this.metrics.blockchainSuccessRate;
            const successfulTransactions = Math.round(currentSuccessRate * (totalTransactions - 1));
            this.metrics.blockchainSuccessRate = (successfulTransactions + 1) / totalTransactions;

            // Update average confirmation time
            const currentAverage = this.metrics.averageBlockchainConfirmationTimeMs;
            this.metrics.averageBlockchainConfirmationTimeMs =
                ((currentAverage * (totalTransactions - 1)) + confirmationTimeMs) / totalTransactions;
        } else {
            // Update blockchain success rate for failure
            const totalTransactions = this.metrics.blockchainTransactionCount;
            const currentSuccessRate = this.metrics.blockchainSuccessRate;
            const successfulTransactions = Math.round(currentSuccessRate * (totalTransactions - 1));
            this.metrics.blockchainSuccessRate = successfulTransactions / totalTransactions;
        }

        enhancedLogger.info('Blockchain transaction recorded', {
            completionId,
            transactionId,
            success,
            confirmationTimeMs,
            successRate: this.metrics.blockchainSuccessRate
        });
    }

    /**
     * Get current metrics
     */
    getMetrics(): SwapCompletionMetrics {
        return { ...this.metrics };
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit: number = 100): CompletionEvent[] {
        return this.events
            .slice(-limit)
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(): CompletionAlert[] {
        return this.alerts.filter(alert => !alert.acknowledged);
    }

    /**
     * Generate performance report
     */
    generatePerformanceReport(
        startDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        endDate: Date = new Date()
    ): CompletionPerformanceReport {
        const eventsInRange = this.events.filter(
            event => event.timestamp >= startDate && event.timestamp <= endDate
        );

        const completionEvents = eventsInRange.filter(
            event => event.type === 'completion_success' || event.type === 'completion_failed'
        );

        const successfulCompletions = completionEvents.filter(event => event.success).length;
        const totalCompletions = completionEvents.length;
        const errorRate = totalCompletions > 0 ? ((totalCompletions - successfulCompletions) / totalCompletions) * 100 : 0;

        const rollbackEvents = eventsInRange.filter(
            event => event.type === 'rollback_success' || event.type === 'rollback_failed'
        );
        const rollbackRate = totalCompletions > 0 ? (rollbackEvents.length / totalCompletions) * 100 : 0;

        const completionTimes = completionEvents
            .filter(event => event.durationMs)
            .map(event => event.durationMs!);

        const averageResponseTime = completionTimes.length > 0
            ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
            : 0;

        const timeRangeHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        const completionRate = timeRangeHours > 0 ? totalCompletions / timeRangeHours : 0;

        // Calculate top errors
        const errorCounts = new Map<SwapCompletionErrorCodes, number>();
        eventsInRange
            .filter(event => event.errorCode)
            .forEach(event => {
                const count = errorCounts.get(event.errorCode!) || 0;
                errorCounts.set(event.errorCode!, count + 1);
            });

        const topErrors = Array.from(errorCounts.entries())
            .map(([errorCode, count]) => ({
                errorCode,
                count,
                percentage: totalCompletions > 0 ? (count / totalCompletions) * 100 : 0,
                lastOccurrence: eventsInRange
                    .filter(event => event.errorCode === errorCode)
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp || new Date()
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const recommendations = this.generateRecommendations(errorRate, rollbackRate, averageResponseTime);

        return {
            reportId: this.generateEventId(),
            generatedAt: new Date(),
            timeRange: { start: startDate, end: endDate },
            metrics: this.getMetrics(),
            trends: {
                completionRate,
                errorRate,
                averageResponseTime,
                rollbackRate
            },
            topErrors,
            recommendations,
            alerts: this.getActiveAlerts()
        };
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string): boolean {
        const alert = this.alerts.find(a => a.id === alertId);
        if (alert) {
            alert.acknowledged = true;
            enhancedLogger.info('Alert acknowledged', { alertId, alertType: alert.type });
            return true;
        }
        return false;
    }

    /**
     * Reset metrics (for testing or maintenance)
     */
    resetMetrics(): void {
        this.metrics = this.initializeMetrics();
        this.events = [];
        this.alerts = [];
        this.completionTimes = [];
        this.errorCounts.clear();

        enhancedLogger.info('Completion monitoring metrics reset');
    }

    /**
     * Initialize metrics with default values
     */
    private initializeMetrics(): SwapCompletionMetrics {
        return {
            totalCompletions: 0,
            successfulCompletions: 0,
            failedCompletions: 0,
            rolledBackCompletions: 0,
            bookingExchangeCompletions: 0,
            cashPaymentCompletions: 0,
            averageCompletionTimeMs: 0,
            medianCompletionTimeMs: 0,
            maxCompletionTimeMs: 0,
            minCompletionTimeMs: 0,
            validationFailures: 0,
            databaseTransactionFailures: 0,
            blockchainRecordingFailures: 0,
            rollbackFailures: 0,
            timeoutFailures: 0,
            concurrencyConflicts: 0,
            totalRetryAttempts: 0,
            successfulRetries: 0,
            failedRetries: 0,
            blockchainTransactionCount: 0,
            blockchainSuccessRate: 1.0,
            averageBlockchainConfirmationTimeMs: 0,
            activeCompletions: 0,
            queuedCompletions: 0
        };
    }

    /**
     * Update metrics for successful completion
     */
    private updateSuccessMetrics(
        completionType: 'booking_exchange' | 'cash_payment',
        durationMs: number
    ): void {
        this.metrics.totalCompletions++;
        this.metrics.successfulCompletions++;
        this.metrics.activeCompletions = Math.max(0, this.metrics.activeCompletions - 1);
        this.metrics.lastSuccessfulCompletion = new Date();

        if (completionType === 'booking_exchange') {
            this.metrics.bookingExchangeCompletions++;
        } else {
            this.metrics.cashPaymentCompletions++;
        }

        // Update completion time metrics
        this.completionTimes.push(durationMs);
        if (this.completionTimes.length > this.maxCompletionTimesToStore) {
            this.completionTimes.shift();
        }

        this.updateCompletionTimeMetrics();
    }

    /**
     * Update metrics for failed completion
     */
    private updateFailureMetrics(
        errorCode: SwapCompletionErrorCodes,
        retryAttempt?: number
    ): void {
        this.metrics.totalCompletions++;
        this.metrics.failedCompletions++;
        this.metrics.activeCompletions = Math.max(0, this.metrics.activeCompletions - 1);
        this.metrics.lastFailedCompletion = new Date();

        // Update error-specific counters
        switch (errorCode) {
            case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
                this.metrics.validationFailures++;
                break;
            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                this.metrics.databaseTransactionFailures++;
                break;
            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                this.metrics.blockchainRecordingFailures++;
                break;
            case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
                this.metrics.timeoutFailures++;
                break;
            case SwapCompletionErrorCodes.CONCURRENT_COMPLETION_CONFLICT:
                this.metrics.concurrencyConflicts++;
                break;
        }

        // Update retry metrics
        if (retryAttempt !== undefined) {
            this.metrics.totalRetryAttempts++;
            if (retryAttempt > 1) {
                this.metrics.failedRetries++;
            }
        }

        // Update error counts
        const currentCount = this.errorCounts.get(errorCode) || 0;
        this.errorCounts.set(errorCode, currentCount + 1);
    }

    /**
     * Update completion time statistics
     */
    private updateCompletionTimeMetrics(): void {
        if (this.completionTimes.length === 0) return;

        const sortedTimes = [...this.completionTimes].sort((a, b) => a - b);

        this.metrics.averageCompletionTimeMs = this.completionTimes.length > 0 ?
            this.completionTimes.reduce((sum, time) => sum + time, 0) / this.completionTimes.length : 0;

        this.metrics.medianCompletionTimeMs = sortedTimes.length > 0 ? (sortedTimes[Math.floor(sortedTimes.length / 2)] || 0) : 0;
        this.metrics.maxCompletionTimeMs = sortedTimes.length > 0 ? Math.max(...sortedTimes) : 0;
        this.metrics.minCompletionTimeMs = sortedTimes.length > 0 ? Math.min(...sortedTimes) : 0;
    }

    /**
     * Add event to the events list
     */
    private addEvent(event: CompletionEvent): void {
        this.events.push(event);
        if (this.events.length > this.maxEventsToStore) {
            this.events.shift();
        }
    }

    /**
     * Check for alert conditions and create alerts
     */
    private checkAlertConditions(): void {
        const now = new Date();
        const recentEvents = this.events.filter(
            event => event.timestamp.getTime() > now.getTime() - 60 * 60 * 1000 // Last hour
        );

        // Check error rate
        const totalRecent = recentEvents.filter(
            event => event.type === 'completion_success' || event.type === 'completion_failed'
        ).length;

        const failedRecent = recentEvents.filter(
            event => event.type === 'completion_failed'
        ).length;

        if (totalRecent >= 10) { // Only alert if we have enough data
            const errorRate = (failedRecent / totalRecent) * 100;

            if (errorRate > 50) {
                this.createAlert('error_rate', 'critical', 50, errorRate,
                    `Critical error rate: ${errorRate.toFixed(1)}% of completions failing`);
            } else if (errorRate > 25) {
                this.createAlert('error_rate', 'high', 25, errorRate,
                    `High error rate: ${errorRate.toFixed(1)}% of completions failing`);
            } else if (errorRate > 10) {
                this.createAlert('error_rate', 'medium', 10, errorRate,
                    `Elevated error rate: ${errorRate.toFixed(1)}% of completions failing`);
            }
        }

        // Check completion time
        if (this.metrics.averageCompletionTimeMs > 30000) { // 30 seconds
            this.createAlert('completion_time', 'high', 30000, this.metrics.averageCompletionTimeMs,
                `Slow completion times: average ${(this.metrics.averageCompletionTimeMs / 1000).toFixed(1)}s`);
        }

        // Check rollback rate
        const rollbackEvents = recentEvents.filter(
            event => event.type === 'rollback_success' || event.type === 'rollback_failed'
        ).length;

        if (totalRecent > 0) {
            const rollbackRate = (rollbackEvents / totalRecent) * 100;
            if (rollbackRate > 20) {
                this.createAlert('rollback_rate', 'high', 20, rollbackRate,
                    `High rollback rate: ${rollbackRate.toFixed(1)}% of operations require rollback`);
            }
        }

        // Check blockchain failure rate
        if (this.metrics.blockchainSuccessRate < 0.9) {
            this.createAlert('blockchain_failure', 'high', 0.9, this.metrics.blockchainSuccessRate,
                `Low blockchain success rate: ${(this.metrics.blockchainSuccessRate * 100).toFixed(1)}%`);
        }
    }

    /**
     * Create an alert
     */
    private createAlert(
        type: CompletionAlert['type'],
        severity: CompletionAlert['severity'],
        threshold: number,
        currentValue: number,
        message: string
    ): void {
        // Check if similar alert already exists and is not acknowledged
        const existingAlert = this.alerts.find(
            alert => alert.type === type && !alert.acknowledged &&
                alert.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Within last hour
        );

        if (existingAlert) {
            // Update existing alert
            existingAlert.currentValue = currentValue;
            existingAlert.timestamp = new Date();
            return;
        }

        const alert: CompletionAlert = {
            id: this.generateEventId(),
            type,
            severity,
            threshold,
            currentValue,
            message,
            timestamp: new Date(),
            acknowledged: false
        };

        this.alerts.push(alert);

        enhancedLogger.warn('Completion monitoring alert created', {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            currentValue: alert.currentValue,
            threshold: alert.threshold
        });
    }

    /**
     * Generate recommendations based on metrics
     */
    private generateRecommendations(
        errorRate: number,
        rollbackRate: number,
        averageResponseTime: number
    ): string[] {
        const recommendations: string[] = [];

        if (errorRate > 10) {
            recommendations.push('High error rate detected. Review error logs and consider implementing additional validation.');
        }

        if (rollbackRate > 15) {
            recommendations.push('High rollback rate indicates system instability. Review transaction logic and database constraints.');
        }

        if (averageResponseTime > 10000) {
            recommendations.push('Slow completion times detected. Consider optimizing database queries and blockchain interactions.');
        }

        if (this.metrics.blockchainSuccessRate < 0.95) {
            recommendations.push('Low blockchain success rate. Check network connectivity and consider implementing better retry logic.');
        }

        if (this.metrics.concurrencyConflicts > 5) {
            recommendations.push('Multiple concurrency conflicts detected. Review locking mechanisms and consider queue-based processing.');
        }

        if (recommendations.length === 0) {
            recommendations.push('System performance is within acceptable parameters. Continue monitoring.');
        }

        return recommendations;
    }

    /**
     * Start periodic reporting
     */
    private startPeriodicReporting(): void {
        // Generate hourly reports
        setInterval(() => {
            const report = this.generatePerformanceReport(
                new Date(Date.now() - 60 * 60 * 1000), // Last hour
                new Date()
            );

            enhancedLogger.info('Hourly completion performance report', {
                reportId: report.reportId,
                totalCompletions: report.metrics.totalCompletions,
                errorRate: report.trends.errorRate,
                averageResponseTime: report.trends.averageResponseTime,
                activeAlerts: report.alerts.length
            });
        }, 60 * 60 * 1000); // Every hour
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}