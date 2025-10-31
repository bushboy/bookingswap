import { SwapCompletionError, SwapCompletionErrorCodes } from '../../utils/SwapCompletionError';
import { SwapCompletionMonitoringService } from '../monitoring/SwapCompletionMonitoringService';
import { CompletionErrorLoggingService } from '../logging/CompletionErrorLoggingService';
import { enhancedLogger } from '../../utils/logger';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Alert types for completion operations
 */
export type CompletionAlertType =
    | 'high_error_rate'
    | 'high_rollback_rate'
    | 'slow_completion_times'
    | 'blockchain_failures'
    | 'critical_error_occurred'
    | 'system_degradation'
    | 'concurrent_failures'
    | 'validation_failures'
    | 'timeout_threshold_exceeded'
    | 'rollback_failure'
    | 'data_inconsistency';

/**
 * Alert configuration
 */
export interface AlertRule {
    id: string;
    type: CompletionAlertType;
    name: string;
    description: string;
    enabled: boolean;
    severity: AlertSeverity;
    threshold: number;
    evaluationWindow: number; // minutes
    cooldownPeriod: number; // minutes
    conditions: {
        metric: string;
        operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
        value: number;
        aggregation?: 'count' | 'avg' | 'max' | 'min' | 'sum' | 'rate';
    }[];
    actions: AlertAction[];
}

/**
 * Alert action configuration
 */
export interface AlertAction {
    type: 'log' | 'email' | 'webhook' | 'slack' | 'pagerduty';
    config: Record<string, any>;
    enabled: boolean;
}

/**
 * Active alert instance
 */
export interface ActiveAlert {
    id: string;
    ruleId: string;
    type: CompletionAlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    triggeredAt: Date;
    acknowledgedAt?: Date;
    acknowledgedBy?: string;
    resolvedAt?: Date;
    resolvedBy?: string;
    currentValue: number;
    threshold: number;
    metadata: Record<string, any>;
    escalationLevel: number;
    lastEscalatedAt?: Date;
}

/**
 * Alert statistics
 */
export interface AlertStatistics {
    totalAlerts: number;
    activeAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    alertsByType: Record<CompletionAlertType, number>;
    alertsBySeverity: Record<AlertSeverity, number>;
    averageResolutionTime: number; // minutes
    escalatedAlerts: number;
    falsePositives: number;
}

/**
 * Comprehensive alerting service for swap completion operations
 */
export class CompletionAlertingService {
    private static instance: CompletionAlertingService;
    private alertRules: Map<string, AlertRule> = new Map();
    private activeAlerts: Map<string, ActiveAlert> = new Map();
    private alertHistory: ActiveAlert[] = [];
    private lastEvaluationTime: Map<string, Date> = new Map();
    private monitoringService: SwapCompletionMonitoringService;
    private loggingService: CompletionErrorLoggingService;
    private evaluationInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.monitoringService = SwapCompletionMonitoringService.getInstance();
        this.loggingService = CompletionErrorLoggingService.getInstance();
        this.initializeDefaultRules();
        this.startAlertEvaluation();
    }

    public static getInstance(): CompletionAlertingService {
        if (!CompletionAlertingService.instance) {
            CompletionAlertingService.instance = new CompletionAlertingService();
        }
        return CompletionAlertingService.instance;
    }

    /**
     * Add or update an alert rule
     */
    addAlertRule(rule: AlertRule): void {
        this.alertRules.set(rule.id, rule);
        enhancedLogger.info('Alert rule added/updated', {
            ruleId: rule.id,
            type: rule.type,
            severity: rule.severity,
            enabled: rule.enabled
        });
    }

    /**
     * Remove an alert rule
     */
    removeAlertRule(ruleId: string): boolean {
        const removed = this.alertRules.delete(ruleId);
        if (removed) {
            enhancedLogger.info('Alert rule removed', { ruleId });
        }
        return removed;
    }

    /**
     * Enable or disable an alert rule
     */
    toggleAlertRule(ruleId: string, enabled: boolean): boolean {
        const rule = this.alertRules.get(ruleId);
        if (rule) {
            rule.enabled = enabled;
            enhancedLogger.info('Alert rule toggled', { ruleId, enabled });
            return true;
        }
        return false;
    }

    /**
     * Trigger immediate alert for critical errors
     */
    triggerImmediateAlert(
        error: SwapCompletionError,
        context: {
            completionId: string;
            proposalId?: string;
            userId?: string;
        }
    ): void {
        const severity = this.getErrorSeverity(error.code as SwapCompletionErrorCodes);

        if (severity === 'critical' || severity === 'error') {
            const alert: ActiveAlert = {
                id: this.generateAlertId(),
                ruleId: 'immediate_critical_error',
                type: 'critical_error_occurred',
                severity,
                title: `Critical Completion Error: ${error.code}`,
                message: `Critical error in completion ${context.completionId}: ${error.message}`,
                triggeredAt: new Date(),
                currentValue: 1,
                threshold: 1,
                metadata: {
                    errorCode: error.code,
                    completionId: context.completionId,
                    proposalId: context.proposalId,
                    userId: context.userId,
                    affectedEntities: error.affectedEntities,
                    rollbackRequired: error.rollbackRequired
                },
                escalationLevel: severity === 'critical' ? 2 : 1
            };

            this.activateAlert(alert);
        }
    }

    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
        const alert = this.activeAlerts.get(alertId);
        if (alert && !alert.acknowledgedAt) {
            alert.acknowledgedAt = new Date();
            alert.acknowledgedBy = acknowledgedBy;

            enhancedLogger.info('Alert acknowledged', {
                alertId,
                acknowledgedBy,
                alertType: alert.type,
                severity: alert.severity
            });

            this.executeAlertActions(alert, 'acknowledged');
            return true;
        }
        return false;
    }

    /**
     * Resolve an alert
     */
    resolveAlert(alertId: string, resolvedBy: string): boolean {
        const alert = this.activeAlerts.get(alertId);
        if (alert && !alert.resolvedAt) {
            alert.resolvedAt = new Date();
            alert.resolvedBy = resolvedBy;

            // Move to history
            this.alertHistory.push(alert);
            this.activeAlerts.delete(alertId);

            enhancedLogger.info('Alert resolved', {
                alertId,
                resolvedBy,
                alertType: alert.type,
                severity: alert.severity,
                durationMinutes: (alert.resolvedAt.getTime() - alert.triggeredAt.getTime()) / (1000 * 60)
            });

            this.executeAlertActions(alert, 'resolved');
            return true;
        }
        return false;
    }

    /**
     * Get active alerts
     */
    getActiveAlerts(severity?: AlertSeverity): ActiveAlert[] {
        const alerts = Array.from(this.activeAlerts.values());
        return severity ? alerts.filter(alert => alert.severity === severity) : alerts;
    }

    /**
     * Get alert history
     */
    getAlertHistory(
        startDate?: Date,
        endDate?: Date,
        type?: CompletionAlertType,
        limit: number = 100
    ): ActiveAlert[] {
        let history = [...this.alertHistory];

        if (startDate) {
            history = history.filter(alert => alert.triggeredAt >= startDate);
        }

        if (endDate) {
            history = history.filter(alert => alert.triggeredAt <= endDate);
        }

        if (type) {
            history = history.filter(alert => alert.type === type);
        }

        return history
            .sort((a, b) => b.triggeredAt.getTime() - a.triggeredAt.getTime())
            .slice(0, limit);
    }

    /**
     * Get alert statistics
     */
    getAlertStatistics(
        startDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        endDate: Date = new Date()
    ): AlertStatistics {
        const alertsInRange = this.alertHistory.filter(
            alert => alert.triggeredAt >= startDate && alert.triggeredAt <= endDate
        );

        const totalAlerts = alertsInRange.length;
        const activeAlerts = this.activeAlerts.size;
        const acknowledgedAlerts = alertsInRange.filter(alert => alert.acknowledgedAt).length;
        const resolvedAlerts = alertsInRange.filter(alert => alert.resolvedAt).length;

        const alertsByType: Record<CompletionAlertType, number> = {} as any;
        const alertsBySeverity: Record<AlertSeverity, number> = {} as any;

        alertsInRange.forEach(alert => {
            alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
            alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
        });

        const resolvedAlertsWithTime = alertsInRange.filter(
            alert => alert.resolvedAt && alert.triggeredAt
        );

        const averageResolutionTime = resolvedAlertsWithTime.length > 0
            ? resolvedAlertsWithTime.reduce((sum, alert) => {
                return sum + (alert.resolvedAt!.getTime() - alert.triggeredAt.getTime());
            }, 0) / (resolvedAlertsWithTime.length * 1000 * 60) // Convert to minutes
            : 0;

        const escalatedAlerts = alertsInRange.filter(alert => alert.escalationLevel > 1).length;

        return {
            totalAlerts,
            activeAlerts,
            acknowledgedAlerts,
            resolvedAlerts,
            alertsByType,
            alertsBySeverity,
            averageResolutionTime,
            escalatedAlerts,
            falsePositives: 0 // Would need additional tracking to determine this
        };
    }

    /**
     * Get all alert rules
     */
    getAlertRules(): AlertRule[] {
        return Array.from(this.alertRules.values());
    }

    /**
     * Test alert rule (dry run)
     */
    testAlertRule(ruleId: string): {
        wouldTrigger: boolean;
        currentValue: number;
        threshold: number;
        message: string;
    } {
        const rule = this.alertRules.get(ruleId);
        if (!rule) {
            return {
                wouldTrigger: false,
                currentValue: 0,
                threshold: 0,
                message: 'Rule not found'
            };
        }

        const evaluation = this.evaluateRule(rule, true);
        return {
            wouldTrigger: evaluation.shouldTrigger,
            currentValue: evaluation.currentValue,
            threshold: rule.threshold,
            message: evaluation.shouldTrigger ? 'Rule would trigger alert' : 'Rule conditions not met'
        };
    }

    /**
     * Initialize default alert rules
     */
    private initializeDefaultRules(): void {
        const defaultRules: AlertRule[] = [
            {
                id: 'high_error_rate',
                type: 'high_error_rate',
                name: 'High Error Rate',
                description: 'Triggers when completion error rate exceeds threshold',
                enabled: true,
                severity: 'error',
                threshold: 25, // 25% error rate
                evaluationWindow: 15, // 15 minutes
                cooldownPeriod: 30, // 30 minutes
                conditions: [
                    {
                        metric: 'error_rate',
                        operator: 'gt',
                        value: 25,
                        aggregation: 'rate'
                    }
                ],
                actions: [
                    { type: 'log', config: {}, enabled: true },
                    { type: 'email', config: { recipients: ['ops@company.com'] }, enabled: false }
                ]
            },
            {
                id: 'high_rollback_rate',
                type: 'high_rollback_rate',
                name: 'High Rollback Rate',
                description: 'Triggers when rollback rate exceeds threshold',
                enabled: true,
                severity: 'warning',
                threshold: 15, // 15% rollback rate
                evaluationWindow: 30,
                cooldownPeriod: 60,
                conditions: [
                    {
                        metric: 'rollback_rate',
                        operator: 'gt',
                        value: 15,
                        aggregation: 'rate'
                    }
                ],
                actions: [
                    { type: 'log', config: {}, enabled: true }
                ]
            },
            {
                id: 'slow_completion_times',
                type: 'slow_completion_times',
                name: 'Slow Completion Times',
                description: 'Triggers when average completion time exceeds threshold',
                enabled: true,
                severity: 'warning',
                threshold: 30000, // 30 seconds
                evaluationWindow: 10,
                cooldownPeriod: 20,
                conditions: [
                    {
                        metric: 'average_completion_time',
                        operator: 'gt',
                        value: 30000,
                        aggregation: 'avg'
                    }
                ],
                actions: [
                    { type: 'log', config: {}, enabled: true }
                ]
            },
            {
                id: 'blockchain_failures',
                type: 'blockchain_failures',
                name: 'Blockchain Failures',
                description: 'Triggers when blockchain success rate drops below threshold',
                enabled: true,
                severity: 'error',
                threshold: 0.9, // 90% success rate
                evaluationWindow: 20,
                cooldownPeriod: 40,
                conditions: [
                    {
                        metric: 'blockchain_success_rate',
                        operator: 'lt',
                        value: 0.9
                    }
                ],
                actions: [
                    { type: 'log', config: {}, enabled: true }
                ]
            },
            {
                id: 'rollback_failure',
                type: 'rollback_failure',
                name: 'Rollback Failure',
                description: 'Triggers immediately when rollback operations fail',
                enabled: true,
                severity: 'critical',
                threshold: 1,
                evaluationWindow: 1,
                cooldownPeriod: 5,
                conditions: [
                    {
                        metric: 'rollback_failures',
                        operator: 'gte',
                        value: 1,
                        aggregation: 'count'
                    }
                ],
                actions: [
                    { type: 'log', config: {}, enabled: true }
                ]
            }
        ];

        defaultRules.forEach(rule => this.addAlertRule(rule));
    }

    /**
     * Start periodic alert evaluation
     */
    private startAlertEvaluation(): void {
        this.evaluationInterval = setInterval(() => {
            this.evaluateAllRules();
            this.checkEscalations();
        }, 60 * 1000); // Every minute
    }

    /**
     * Evaluate all enabled alert rules
     */
    private evaluateAllRules(): void {
        for (const rule of this.alertRules.values()) {
            if (!rule.enabled) continue;

            // Check cooldown period
            const lastEvaluation = this.lastEvaluationTime.get(rule.id);
            if (lastEvaluation) {
                const timeSinceLastEvaluation = Date.now() - lastEvaluation.getTime();
                if (timeSinceLastEvaluation < rule.cooldownPeriod * 60 * 1000) {
                    continue;
                }
            }

            const evaluation = this.evaluateRule(rule);
            if (evaluation.shouldTrigger) {
                this.triggerAlert(rule, evaluation.currentValue);
                this.lastEvaluationTime.set(rule.id, new Date());
            }
        }
    }

    /**
     * Evaluate a single alert rule
     */
    private evaluateRule(rule: AlertRule, dryRun: boolean = false): {
        shouldTrigger: boolean;
        currentValue: number;
    } {
        const metrics = this.monitoringService.getMetrics();
        const windowStart = new Date(Date.now() - rule.evaluationWindow * 60 * 1000);

        let currentValue = 0;
        let shouldTrigger = false;

        // Evaluate each condition
        for (const condition of rule.conditions) {
            switch (condition.metric) {
                case 'error_rate':
                    const totalCompletions = metrics.totalCompletions;
                    const failedCompletions = metrics.failedCompletions;
                    currentValue = totalCompletions > 0 ? (failedCompletions / totalCompletions) * 100 : 0;
                    break;

                case 'rollback_rate':
                    const totalOps = metrics.totalCompletions;
                    const rollbacks = metrics.rolledBackCompletions;
                    currentValue = totalOps > 0 ? (rollbacks / totalOps) * 100 : 0;
                    break;

                case 'average_completion_time':
                    currentValue = metrics.averageCompletionTimeMs;
                    break;

                case 'blockchain_success_rate':
                    currentValue = metrics.blockchainSuccessRate;
                    break;

                case 'rollback_failures':
                    currentValue = metrics.rollbackFailures;
                    break;

                default:
                    continue;
            }

            // Check condition
            switch (condition.operator) {
                case 'gt':
                    shouldTrigger = currentValue > condition.value;
                    break;
                case 'gte':
                    shouldTrigger = currentValue >= condition.value;
                    break;
                case 'lt':
                    shouldTrigger = currentValue < condition.value;
                    break;
                case 'lte':
                    shouldTrigger = currentValue <= condition.value;
                    break;
                case 'eq':
                    shouldTrigger = currentValue === condition.value;
                    break;
            }

            // If any condition fails, don't trigger (AND logic)
            if (!shouldTrigger) break;
        }

        return { shouldTrigger, currentValue };
    }

    /**
     * Trigger an alert
     */
    private triggerAlert(rule: AlertRule, currentValue: number): void {
        // Check if similar alert is already active
        const existingAlert = Array.from(this.activeAlerts.values()).find(
            alert => alert.ruleId === rule.id && !alert.resolvedAt
        );

        if (existingAlert) {
            // Update existing alert
            existingAlert.currentValue = currentValue;
            return;
        }

        const alert: ActiveAlert = {
            id: this.generateAlertId(),
            ruleId: rule.id,
            type: rule.type,
            severity: rule.severity,
            title: rule.name,
            message: this.generateAlertMessage(rule, currentValue),
            triggeredAt: new Date(),
            currentValue,
            threshold: rule.threshold,
            metadata: {
                evaluationWindow: rule.evaluationWindow,
                conditions: rule.conditions
            },
            escalationLevel: 1
        };

        this.activateAlert(alert);
    }

    /**
     * Activate an alert
     */
    private activateAlert(alert: ActiveAlert): void {
        this.activeAlerts.set(alert.id, alert);

        enhancedLogger.warn('Alert triggered', {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            currentValue: alert.currentValue,
            threshold: alert.threshold,
            message: alert.message
        });

        this.executeAlertActions(alert, 'triggered');
    }

    /**
     * Execute alert actions
     */
    private executeAlertActions(alert: ActiveAlert, event: 'triggered' | 'acknowledged' | 'resolved'): void {
        const rule = this.alertRules.get(alert.ruleId);
        if (!rule) return;

        rule.actions.forEach(action => {
            if (!action.enabled) return;

            try {
                switch (action.type) {
                    case 'log':
                        this.executeLogAction(alert, event);
                        break;
                    case 'email':
                        this.executeEmailAction(alert, event, action.config);
                        break;
                    case 'webhook':
                        this.executeWebhookAction(alert, event, action.config);
                        break;
                    case 'slack':
                        this.executeSlackAction(alert, event, action.config);
                        break;
                    case 'pagerduty':
                        this.executePagerDutyAction(alert, event, action.config);
                        break;
                }
            } catch (error) {
                enhancedLogger.error('Failed to execute alert action', {
                    alertId: alert.id,
                    actionType: action.type,
                    error: error.message
                });
            }
        });
    }

    /**
     * Execute log action
     */
    private executeLogAction(alert: ActiveAlert, event: string): void {
        const logLevel = alert.severity === 'critical' ? 'error' :
            alert.severity === 'error' ? 'error' :
                alert.severity === 'warning' ? 'warn' : 'info';

        enhancedLogger[logLevel](`Alert ${event}: ${alert.title}`, {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            currentValue: alert.currentValue,
            threshold: alert.threshold,
            metadata: alert.metadata
        });
    }

    /**
     * Execute email action (placeholder)
     */
    private executeEmailAction(alert: ActiveAlert, event: string, config: any): void {
        // In production, integrate with email service
        enhancedLogger.info('Email alert action executed', {
            alertId: alert.id,
            event,
            recipients: config.recipients
        });
    }

    /**
     * Execute webhook action (placeholder)
     */
    private executeWebhookAction(alert: ActiveAlert, event: string, config: any): void {
        // In production, make HTTP request to webhook URL
        enhancedLogger.info('Webhook alert action executed', {
            alertId: alert.id,
            event,
            webhookUrl: config.url
        });
    }

    /**
     * Execute Slack action (placeholder)
     */
    private executeSlackAction(alert: ActiveAlert, event: string, config: any): void {
        // In production, send to Slack webhook
        enhancedLogger.info('Slack alert action executed', {
            alertId: alert.id,
            event,
            channel: config.channel
        });
    }

    /**
     * Execute PagerDuty action (placeholder)
     */
    private executePagerDutyAction(alert: ActiveAlert, event: string, config: any): void {
        // In production, integrate with PagerDuty API
        enhancedLogger.info('PagerDuty alert action executed', {
            alertId: alert.id,
            event,
            serviceKey: config.serviceKey
        });
    }

    /**
     * Check for alert escalations
     */
    private checkEscalations(): void {
        const now = new Date();

        for (const alert of this.activeAlerts.values()) {
            if (alert.acknowledgedAt || alert.resolvedAt) continue;

            const timeSinceTriggered = now.getTime() - alert.triggeredAt.getTime();
            const timeSinceLastEscalation = alert.lastEscalatedAt
                ? now.getTime() - alert.lastEscalatedAt.getTime()
                : timeSinceTriggered;

            // Escalate after 30 minutes for critical, 60 minutes for others
            const escalationThreshold = alert.severity === 'critical' ? 30 * 60 * 1000 : 60 * 60 * 1000;

            if (timeSinceLastEscalation > escalationThreshold) {
                this.escalateAlert(alert);
            }
        }
    }

    /**
     * Escalate an alert
     */
    private escalateAlert(alert: ActiveAlert): void {
        alert.escalationLevel++;
        alert.lastEscalatedAt = new Date();

        enhancedLogger.error('Alert escalated', {
            alertId: alert.id,
            type: alert.type,
            severity: alert.severity,
            escalationLevel: alert.escalationLevel,
            timeSinceTriggered: (alert.lastEscalatedAt.getTime() - alert.triggeredAt.getTime()) / (1000 * 60)
        });

        // Execute escalation actions (e.g., page on-call engineer)
        this.executeAlertActions(alert, 'triggered');
    }

    /**
     * Generate alert message
     */
    private generateAlertMessage(rule: AlertRule, currentValue: number): string {
        switch (rule.type) {
            case 'high_error_rate':
                return `Completion error rate is ${currentValue.toFixed(1)}%, exceeding threshold of ${rule.threshold}%`;
            case 'high_rollback_rate':
                return `Rollback rate is ${currentValue.toFixed(1)}%, exceeding threshold of ${rule.threshold}%`;
            case 'slow_completion_times':
                return `Average completion time is ${(currentValue / 1000).toFixed(1)}s, exceeding threshold of ${(rule.threshold / 1000).toFixed(1)}s`;
            case 'blockchain_failures':
                return `Blockchain success rate is ${(currentValue * 100).toFixed(1)}%, below threshold of ${(rule.threshold * 100).toFixed(1)}%`;
            case 'rollback_failure':
                return `Rollback operation failed - immediate attention required`;
            default:
                return `Alert condition met: ${rule.description}`;
        }
    }

    /**
     * Get error severity for immediate alerts
     */
    private getErrorSeverity(errorCode: SwapCompletionErrorCodes): AlertSeverity {
        switch (errorCode) {
            case SwapCompletionErrorCodes.ROLLBACK_FAILED:
            case SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES:
                return 'critical';

            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
            case SwapCompletionErrorCodes.AUTOMATIC_CORRECTION_FAILED:
                return 'error';

            case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
            case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
                return 'warning';

            default:
                return 'info';
        }
    }

    /**
     * Generate unique alert ID
     */
    private generateAlertId(): string {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleanup method
     */
    destroy(): void {
        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
            this.evaluationInterval = null;
        }
    }
}