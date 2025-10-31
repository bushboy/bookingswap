import { ProposalAcceptanceError, ProposalAcceptanceErrorContext, PROPOSAL_ACCEPTANCE_ERROR_CODES } from './ProposalAcceptanceError';
import { RollbackData, RollbackResult } from './ProposalRollbackManager';
import { logger } from '../../utils/logger';

/**
 * Error metrics for monitoring and alerting
 */
export interface ErrorMetrics {
    errorCode: string;
    errorCategory: string;
    proposalId?: string;
    userId?: string;
    action?: 'accept' | 'reject' | 'rollback';
    errorSource?: string;
    rollbackRequired: boolean;
    manualInterventionRequired: boolean;
    retryable: boolean;
    operationDuration?: number;
    retryAttempt?: number;
    timestamp: Date;
}

/**
 * Alert configuration for different error types
 */
export interface AlertConfig {
    errorCode: string;
    alertLevel: 'info' | 'warning' | 'error' | 'critical';
    alertThreshold: number; // Number of occurrences within time window
    timeWindowMinutes: number;
    notificationChannels: string[];
    escalationRequired: boolean;
}

/**
 * Error trend analysis data
 */
export interface ErrorTrend {
    errorCode: string;
    occurrences: number;
    timeWindow: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Comprehensive error logging and monitoring service for proposal acceptance operations
 * Provides detailed logging, metrics collection, alerting, and trend analysis
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export class ProposalAcceptanceErrorLogger {
    private errorCounts = new Map<string, { count: number; lastOccurrence: Date }>();
    private alertConfigs = new Map<string, AlertConfig>();
    private errorHistory: ErrorMetrics[] = [];
    private readonly maxHistorySize = 10000;

    constructor() {
        this.initializeAlertConfigs();
    }

    /**
     * Log proposal acceptance error with comprehensive context and metrics
     * Requirements: 6.1, 6.4, 6.5
     */
    logError(
        error: ProposalAcceptanceError,
        operationStartTime?: Date,
        additionalContext?: Record<string, any>
    ): void {
        const operationDuration = operationStartTime
            ? Date.now() - operationStartTime.getTime()
            : undefined;

        const metrics: ErrorMetrics = {
            errorCode: error.code,
            errorCategory: error.category,
            proposalId: error.proposalId,
            userId: error.userId,
            action: error.action,
            errorSource: error.errorSource,
            rollbackRequired: error.rollbackRequired,
            manualInterventionRequired: error.manualInterventionRequired,
            retryable: error.retryable,
            operationDuration,
            retryAttempt: (error.context as ProposalAcceptanceErrorContext)?.retryAttempt,
            timestamp: new Date()
        };

        // Add to error history
        this.addToErrorHistory(metrics);

        // Update error counts for alerting
        this.updateErrorCounts(error.code);

        // Log with appropriate level based on error severity
        const logData = {
            ...metrics,
            errorMessage: error.message,
            errorStack: error.stack,
            originalError: error.originalError?.message,
            context: error.context,
            additionalContext,
            recoveryActions: error.recoveryActions
        };

        if (error.manualInterventionRequired) {
            logger.error('CRITICAL: Proposal acceptance error requiring manual intervention', logData);
            this.triggerCriticalAlert(error, metrics);
        } else if (error.rollbackRequired) {
            logger.warn('Proposal acceptance error requiring rollback', logData);
            this.checkAlertThresholds(error.code, metrics);
        } else if (error.retryable) {
            logger.info('Retryable proposal acceptance error', logData);
        } else {
            logger.warn('Non-retryable proposal acceptance error', logData);
            this.checkAlertThresholds(error.code, metrics);
        }

        // Send metrics to monitoring system
        this.sendMetricsToMonitoring(metrics, logData);
    }

    /**
     * Log rollback operation details
     * Requirements: 6.2, 6.3, 6.5
     */
    logRollbackOperation(
        rollbackData: RollbackData,
        result: RollbackResult,
        operationDuration?: number
    ): void {
        const logData = {
            rollbackId: rollbackData.rollbackId,
            proposalId: rollbackData.proposalId,
            userId: rollbackData.userId,
            action: rollbackData.action,
            rollbackStatus: rollbackData.rollbackStatus,
            stepsCompleted: rollbackData.stepsCompleted.length,
            stepsToRollback: rollbackData.stepsToRollback.length,
            stepsRolledBack: result.stepsRolledBack,
            stepsFailed: result.stepsFailed,
            rollbackSuccess: result.success,
            manualInterventionRequired: result.manualInterventionRequired,
            rollbackAttempts: rollbackData.rollbackAttempts,
            maxRollbackAttempts: rollbackData.maxRollbackAttempts,
            operationDuration,
            originalError: rollbackData.originalError.message,
            rollbackErrors: result.errors.map(err => err.message),
            rollbackStartedAt: rollbackData.rollbackStartedAt,
            rollbackCompletedAt: new Date()
        };

        if (result.manualInterventionRequired) {
            logger.error('CRITICAL: Rollback operation requires manual intervention', logData);
            this.triggerRollbackAlert(rollbackData, result, 'critical');
        } else if (!result.success) {
            logger.error('Rollback operation failed or incomplete', logData);
            this.triggerRollbackAlert(rollbackData, result, 'error');
        } else {
            logger.info('Rollback operation completed successfully', logData);
        }

        // Track rollback metrics
        const rollbackMetrics: ErrorMetrics = {
            errorCode: 'ROLLBACK_OPERATION',
            errorCategory: 'server_error',
            proposalId: rollbackData.proposalId,
            userId: rollbackData.userId,
            action: 'rollback',
            errorSource: 'system',
            rollbackRequired: false,
            manualInterventionRequired: result.manualInterventionRequired,
            retryable: !result.success && !result.manualInterventionRequired,
            operationDuration,
            timestamp: new Date()
        };

        this.addToErrorHistory(rollbackMetrics);
        this.sendMetricsToMonitoring(rollbackMetrics, logData);
    }

    /**
     * Log error recovery attempt
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
        const logData = {
            proposalId,
            userId,
            recoveryAction,
            success,
            error: error?.message,
            errorStack: error?.stack,
            context,
            timestamp: new Date()
        };

        if (success) {
            logger.info('Error recovery attempt successful', logData);
        } else {
            logger.warn('Error recovery attempt failed', logData);
        }

        // Track recovery metrics
        const recoveryMetrics: ErrorMetrics = {
            errorCode: 'RECOVERY_ATTEMPT',
            errorCategory: 'server_error',
            proposalId,
            userId,
            action: 'rollback',
            errorSource: 'system',
            rollbackRequired: false,
            manualInterventionRequired: !success,
            retryable: !success,
            timestamp: new Date()
        };

        this.addToErrorHistory(recoveryMetrics);
    }

    /**
     * Generate error trend analysis
     * Requirements: 6.5
     */
    generateErrorTrends(timeWindowHours: number = 24): ErrorTrend[] {
        const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
        const recentErrors = this.errorHistory.filter(error => error.timestamp >= cutoffTime);

        const errorGroups = new Map<string, ErrorMetrics[]>();

        // Group errors by code
        for (const error of recentErrors) {
            if (!errorGroups.has(error.errorCode)) {
                errorGroups.set(error.errorCode, []);
            }
            errorGroups.get(error.errorCode)!.push(error);
        }

        const trends: ErrorTrend[] = [];

        for (const [errorCode, errors] of errorGroups) {
            const trend = this.calculateTrend(errors, timeWindowHours);
            trends.push({
                errorCode,
                occurrences: errors.length,
                timeWindow: `${timeWindowHours}h`,
                trend: trend.direction,
                impactLevel: this.calculateImpactLevel(errors)
            });
        }

        return trends.sort((a, b) => b.occurrences - a.occurrences);
    }

    /**
     * Get error statistics for monitoring dashboard
     * Requirements: 6.5
     */
    getErrorStatistics(timeWindowHours: number = 24): {
        totalErrors: number;
        errorsByCategory: Record<string, number>;
        errorsByCode: Record<string, number>;
        rollbacksRequired: number;
        manualInterventionsRequired: number;
        averageOperationDuration: number;
        errorRate: number;
    } {
        const cutoffTime = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
        const recentErrors = this.errorHistory.filter(error => error.timestamp >= cutoffTime);

        const errorsByCategory: Record<string, number> = {};
        const errorsByCode: Record<string, number> = {};
        let rollbacksRequired = 0;
        let manualInterventionsRequired = 0;
        let totalDuration = 0;
        let durationsCount = 0;

        for (const error of recentErrors) {
            // Count by category
            errorsByCategory[error.errorCategory] = (errorsByCategory[error.errorCategory] || 0) + 1;

            // Count by code
            errorsByCode[error.errorCode] = (errorsByCode[error.errorCode] || 0) + 1;

            // Count special cases
            if (error.rollbackRequired) rollbacksRequired++;
            if (error.manualInterventionRequired) manualInterventionsRequired++;

            // Calculate average duration
            if (error.operationDuration) {
                totalDuration += error.operationDuration;
                durationsCount++;
            }
        }

        const averageOperationDuration = durationsCount > 0 ? totalDuration / durationsCount : 0;
        const errorRate = recentErrors.length / timeWindowHours; // errors per hour

        return {
            totalErrors: recentErrors.length,
            errorsByCategory,
            errorsByCode,
            rollbacksRequired,
            manualInterventionsRequired,
            averageOperationDuration,
            errorRate
        };
    }

    /**
     * Initialize alert configurations for different error types
     */
    private initializeAlertConfigs(): void {
        const configs: AlertConfig[] = [
            {
                errorCode: PROPOSAL_ACCEPTANCE_ERROR_CODES.MANUAL_INTERVENTION_REQUIRED,
                alertLevel: 'critical',
                alertThreshold: 1,
                timeWindowMinutes: 1,
                notificationChannels: ['email', 'slack', 'pagerduty'],
                escalationRequired: true
            },
            {
                errorCode: PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_ROLLBACK_FAILED,
                alertLevel: 'critical',
                alertThreshold: 1,
                timeWindowMinutes: 1,
                notificationChannels: ['email', 'slack', 'pagerduty'],
                escalationRequired: true
            },
            {
                errorCode: PROPOSAL_ACCEPTANCE_ERROR_CODES.PAYMENT_PROCESSING_FAILED,
                alertLevel: 'error',
                alertThreshold: 5,
                timeWindowMinutes: 15,
                notificationChannels: ['email', 'slack'],
                escalationRequired: false
            },
            {
                errorCode: PROPOSAL_ACCEPTANCE_ERROR_CODES.BLOCKCHAIN_RECORDING_FAILED,
                alertLevel: 'warning',
                alertThreshold: 10,
                timeWindowMinutes: 30,
                notificationChannels: ['slack'],
                escalationRequired: false
            },
            {
                errorCode: PROPOSAL_ACCEPTANCE_ERROR_CODES.DATABASE_TRANSACTION_FAILED,
                alertLevel: 'error',
                alertThreshold: 3,
                timeWindowMinutes: 10,
                notificationChannels: ['email', 'slack'],
                escalationRequired: false
            }
        ];

        for (const config of configs) {
            this.alertConfigs.set(config.errorCode, config);
        }
    }

    /**
     * Add error to history with size management
     */
    private addToErrorHistory(metrics: ErrorMetrics): void {
        this.errorHistory.push(metrics);

        // Maintain history size limit
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Update error counts for alerting
     */
    private updateErrorCounts(errorCode: string): void {
        const current = this.errorCounts.get(errorCode) || { count: 0, lastOccurrence: new Date() };
        current.count++;
        current.lastOccurrence = new Date();
        this.errorCounts.set(errorCode, current);
    }

    /**
     * Check if error thresholds are exceeded and trigger alerts
     */
    private checkAlertThresholds(errorCode: string, metrics: ErrorMetrics): void {
        const config = this.alertConfigs.get(errorCode);
        if (!config) return;

        const cutoffTime = new Date(Date.now() - config.timeWindowMinutes * 60 * 1000);
        const recentOccurrences = this.errorHistory.filter(
            error => error.errorCode === errorCode && error.timestamp >= cutoffTime
        ).length;

        if (recentOccurrences >= config.alertThreshold) {
            this.triggerAlert(config, metrics, recentOccurrences);
        }
    }

    /**
     * Trigger critical alert for immediate attention
     */
    private triggerCriticalAlert(error: ProposalAcceptanceError, metrics: ErrorMetrics): void {
        const alertData = {
            alertLevel: 'critical' as const,
            errorCode: error.code,
            errorMessage: error.message,
            proposalId: error.proposalId,
            userId: error.userId,
            action: error.action,
            rollbackRequired: error.rollbackRequired,
            manualInterventionRequired: error.manualInterventionRequired,
            recoveryActions: error.recoveryActions,
            timestamp: metrics.timestamp,
            escalationRequired: true
        };

        logger.error('CRITICAL ALERT: Immediate attention required', alertData);

        // In production, this would trigger actual alerting systems
        this.sendAlert('critical', alertData);
    }

    /**
     * Trigger rollback-specific alert
     */
    private triggerRollbackAlert(
        rollbackData: RollbackData,
        result: RollbackResult,
        level: 'warning' | 'error' | 'critical'
    ): void {
        const alertData = {
            alertLevel: level,
            alertType: 'rollback_operation',
            rollbackId: rollbackData.rollbackId,
            proposalId: rollbackData.proposalId,
            userId: rollbackData.userId,
            rollbackSuccess: result.success,
            stepsRolledBack: result.stepsRolledBack,
            stepsFailed: result.stepsFailed,
            manualInterventionRequired: result.manualInterventionRequired,
            rollbackAttempts: rollbackData.rollbackAttempts,
            originalError: rollbackData.originalError.message,
            timestamp: new Date()
        };

        logger.error(`ROLLBACK ALERT (${level.toUpperCase()}): Rollback operation attention required`, alertData);

        this.sendAlert(level, alertData);
    }

    /**
     * Trigger general alert
     */
    private triggerAlert(config: AlertConfig, metrics: ErrorMetrics, occurrences: number): void {
        const alertData = {
            alertLevel: config.alertLevel,
            errorCode: metrics.errorCode,
            errorCategory: metrics.errorCategory,
            occurrences,
            timeWindow: `${config.timeWindowMinutes} minutes`,
            threshold: config.alertThreshold,
            proposalId: metrics.proposalId,
            userId: metrics.userId,
            escalationRequired: config.escalationRequired,
            notificationChannels: config.notificationChannels,
            timestamp: metrics.timestamp
        };

        logger.warn(`THRESHOLD ALERT (${config.alertLevel.toUpperCase()}): Error threshold exceeded`, alertData);

        this.sendAlert(config.alertLevel, alertData);
    }

    /**
     * Send alert to monitoring systems
     */
    private sendAlert(level: string, alertData: any): void {
        // In production, this would integrate with actual alerting systems
        // such as PagerDuty, Slack, email notifications, etc.

        logger.info('Alert would be sent to monitoring systems', {
            alertLevel: level,
            alertData,
            timestamp: new Date()
        });
    }

    /**
     * Send metrics to monitoring system
     */
    private sendMetricsToMonitoring(metrics: ErrorMetrics, logData: any): void {
        // In production, this would send metrics to systems like:
        // - Prometheus/Grafana
        // - DataDog
        // - New Relic
        // - CloudWatch

        logger.debug('Metrics would be sent to monitoring system', {
            metrics,
            logData,
            timestamp: new Date()
        });
    }

    /**
     * Calculate error trend direction
     */
    private calculateTrend(errors: ErrorMetrics[], timeWindowHours: number): { direction: 'increasing' | 'decreasing' | 'stable' } {
        if (errors.length < 2) {
            return { direction: 'stable' };
        }

        const midpoint = new Date(Date.now() - (timeWindowHours / 2) * 60 * 60 * 1000);
        const firstHalf = errors.filter(error => error.timestamp < midpoint).length;
        const secondHalf = errors.filter(error => error.timestamp >= midpoint).length;

        const changeRatio = secondHalf / Math.max(firstHalf, 1);

        if (changeRatio > 1.5) {
            return { direction: 'increasing' };
        } else if (changeRatio < 0.5) {
            return { direction: 'decreasing' };
        } else {
            return { direction: 'stable' };
        }
    }

    /**
     * Calculate impact level based on error characteristics
     */
    private calculateImpactLevel(errors: ErrorMetrics[]): 'low' | 'medium' | 'high' | 'critical' {
        const manualInterventionCount = errors.filter(e => e.manualInterventionRequired).length;
        const rollbackCount = errors.filter(e => e.rollbackRequired).length;

        if (manualInterventionCount > 0) {
            return 'critical';
        } else if (rollbackCount > errors.length * 0.5) {
            return 'high';
        } else if (rollbackCount > 0 || errors.length > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }
}