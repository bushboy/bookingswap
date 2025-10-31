import { SwapCompletionError, SwapCompletionErrorCodes } from '../../utils/SwapCompletionError';
import { enhancedLogger } from '../../utils/logger';

/**
 * Error log entry for completion operations
 */
export interface CompletionErrorLogEntry {
    id: string;
    timestamp: Date;
    completionId: string;
    proposalId?: string;
    userId?: string;
    errorCode: SwapCompletionErrorCodes;
    errorMessage: string;
    errorCategory: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedEntities: string[];
    rollbackRequired: boolean;
    retryable: boolean;
    retryAttempt?: number;
    maxRetries?: number;
    stackTrace?: string;
    context: Record<string, any>;
    resolution?: {
        resolvedAt: Date;
        resolvedBy: string;
        resolutionMethod: string;
        notes: string;
    };
}

/**
 * Error pattern for analysis
 */
export interface ErrorPattern {
    errorCode: SwapCompletionErrorCodes;
    frequency: number;
    firstOccurrence: Date;
    lastOccurrence: Date;
    affectedUsers: Set<string>;
    affectedProposals: Set<string>;
    commonContext: Record<string, any>;
    trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Error analysis report
 */
export interface ErrorAnalysisReport {
    reportId: string;
    generatedAt: Date;
    timeRange: {
        start: Date;
        end: Date;
    };
    totalErrors: number;
    uniqueErrors: number;
    criticalErrors: number;
    patterns: ErrorPattern[];
    topErrorsByFrequency: Array<{
        errorCode: SwapCompletionErrorCodes;
        count: number;
        percentage: number;
    }>;
    topErrorsByImpact: Array<{
        errorCode: SwapCompletionErrorCodes;
        affectedUsers: number;
        affectedProposals: number;
    }>;
    recommendations: string[];
}

/**
 * Service for comprehensive error logging and analysis for completion operations
 */
export class CompletionErrorLoggingService {
    private static instance: CompletionErrorLoggingService;
    private errorLogs: CompletionErrorLogEntry[] = [];
    private errorPatterns: Map<SwapCompletionErrorCodes, ErrorPattern> = new Map();
    private readonly maxLogsToStore = 50000;

    private constructor() {
        this.startPeriodicAnalysis();
    }

    public static getInstance(): CompletionErrorLoggingService {
        if (!CompletionErrorLoggingService.instance) {
            CompletionErrorLoggingService.instance = new CompletionErrorLoggingService();
        }
        return CompletionErrorLoggingService.instance;
    }

    /**
     * Log a completion error with comprehensive context
     */
    logError(
        error: SwapCompletionError,
        context: {
            completionId: string;
            proposalId?: string;
            userId?: string;
            additionalContext?: Record<string, any>;
        }
    ): void {
        const logEntry: CompletionErrorLogEntry = {
            id: this.generateLogId(),
            timestamp: new Date(),
            completionId: context.completionId,
            proposalId: context.proposalId,
            userId: context.userId,
            errorCode: error.code as SwapCompletionErrorCodes,
            errorMessage: error.message,
            errorCategory: error.category,
            severity: this.determineSeverity(error.code as SwapCompletionErrorCodes),
            affectedEntities: error.affectedEntities || [],
            rollbackRequired: error.rollbackRequired,
            retryable: error.retryable,
            retryAttempt: error.retryAttempts,
            maxRetries: error.maxRetries,
            stackTrace: error.stack,
            context: {
                ...error.context?.metadata,
                ...context.additionalContext,
                originalErrorMessage: error.originalError?.message,
                originalErrorStack: error.originalError?.stack
            }
        };

        this.addLogEntry(logEntry);
        this.updateErrorPattern(logEntry);
        this.logToSystem(logEntry);

        // Immediate alerting for critical errors
        if (logEntry.severity === 'critical') {
            this.handleCriticalError(logEntry);
        }
    }

    /**
     * Log error resolution
     */
    logErrorResolution(
        errorId: string,
        resolvedBy: string,
        resolutionMethod: string,
        notes: string
    ): boolean {
        const logEntry = this.errorLogs.find(entry => entry.id === errorId);
        if (!logEntry) {
            return false;
        }

        logEntry.resolution = {
            resolvedAt: new Date(),
            resolvedBy,
            resolutionMethod,
            notes
        };

        enhancedLogger.info('Completion error resolved', {
            errorId,
            errorCode: logEntry.errorCode,
            resolvedBy,
            resolutionMethod,
            resolutionTime: new Date().toISOString()
        });

        return true;
    }

    /**
     * Get error logs with filtering
     */
    getErrorLogs(options: {
        startDate?: Date;
        endDate?: Date;
        errorCodes?: SwapCompletionErrorCodes[];
        severity?: string[];
        userId?: string;
        completionId?: string;
        resolved?: boolean;
        limit?: number;
    } = {}): CompletionErrorLogEntry[] {
        let filteredLogs = [...this.errorLogs];

        if (options.startDate) {
            filteredLogs = filteredLogs.filter(log => log.timestamp >= options.startDate!);
        }

        if (options.endDate) {
            filteredLogs = filteredLogs.filter(log => log.timestamp <= options.endDate!);
        }

        if (options.errorCodes && options.errorCodes.length > 0) {
            filteredLogs = filteredLogs.filter(log => options.errorCodes!.includes(log.errorCode));
        }

        if (options.severity && options.severity.length > 0) {
            filteredLogs = filteredLogs.filter(log => options.severity!.includes(log.severity));
        }

        if (options.userId) {
            filteredLogs = filteredLogs.filter(log => log.userId === options.userId);
        }

        if (options.completionId) {
            filteredLogs = filteredLogs.filter(log => log.completionId === options.completionId);
        }

        if (options.resolved !== undefined) {
            filteredLogs = filteredLogs.filter(log => !!log.resolution === options.resolved);
        }

        // Sort by timestamp (newest first)
        filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (options.limit) {
            filteredLogs = filteredLogs.slice(0, options.limit);
        }

        return filteredLogs;
    }

    /**
     * Generate error analysis report
     */
    generateErrorAnalysisReport(
        startDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        endDate: Date = new Date()
    ): ErrorAnalysisReport {
        const logsInRange = this.getErrorLogs({ startDate, endDate });

        const errorCounts = new Map<SwapCompletionErrorCodes, number>();
        const errorImpact = new Map<SwapCompletionErrorCodes, { users: Set<string>; proposals: Set<string> }>();

        let criticalErrors = 0;

        logsInRange.forEach(log => {
            // Count errors
            const count = errorCounts.get(log.errorCode) || 0;
            errorCounts.set(log.errorCode, count + 1);

            // Track impact
            if (!errorImpact.has(log.errorCode)) {
                errorImpact.set(log.errorCode, { users: new Set(), proposals: new Set() });
            }
            const impact = errorImpact.get(log.errorCode)!;
            if (log.userId) impact.users.add(log.userId);
            if (log.proposalId) impact.proposals.add(log.proposalId);

            // Count critical errors
            if (log.severity === 'critical') {
                criticalErrors++;
            }
        });

        const totalErrors = logsInRange.length;
        const uniqueErrors = errorCounts.size;

        // Top errors by frequency
        const topErrorsByFrequency = Array.from(errorCounts.entries())
            .map(([errorCode, count]) => ({
                errorCode,
                count,
                percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Top errors by impact
        const topErrorsByImpact = Array.from(errorImpact.entries())
            .map(([errorCode, impact]) => ({
                errorCode,
                affectedUsers: impact.users.size,
                affectedProposals: impact.proposals.size
            }))
            .sort((a, b) => (b.affectedUsers + b.affectedProposals) - (a.affectedUsers + a.affectedProposals))
            .slice(0, 10);

        // Get current patterns
        const patterns = Array.from(this.errorPatterns.values())
            .filter(pattern =>
                pattern.lastOccurrence >= startDate && pattern.firstOccurrence <= endDate
            );

        const recommendations = this.generateRecommendations(
            topErrorsByFrequency,
            topErrorsByImpact,
            criticalErrors,
            totalErrors
        );

        return {
            reportId: this.generateLogId(),
            generatedAt: new Date(),
            timeRange: { start: startDate, end: endDate },
            totalErrors,
            uniqueErrors,
            criticalErrors,
            patterns,
            topErrorsByFrequency,
            topErrorsByImpact,
            recommendations
        };
    }

    /**
     * Get error patterns for specific error code
     */
    getErrorPattern(errorCode: SwapCompletionErrorCodes): ErrorPattern | undefined {
        return this.errorPatterns.get(errorCode);
    }

    /**
     * Get all error patterns
     */
    getAllErrorPatterns(): ErrorPattern[] {
        return Array.from(this.errorPatterns.values());
    }

    /**
     * Clear old logs (for maintenance)
     */
    clearOldLogs(olderThan: Date): number {
        const initialCount = this.errorLogs.length;
        this.errorLogs = this.errorLogs.filter(log => log.timestamp >= olderThan);
        const clearedCount = initialCount - this.errorLogs.length;

        enhancedLogger.info('Old error logs cleared', {
            clearedCount,
            remainingCount: this.errorLogs.length,
            cutoffDate: olderThan.toISOString()
        });

        return clearedCount;
    }

    /**
     * Export error logs for external analysis
     */
    exportErrorLogs(
        format: 'json' | 'csv' = 'json',
        options: {
            startDate?: Date;
            endDate?: Date;
            errorCodes?: SwapCompletionErrorCodes[];
        } = {}
    ): string {
        const logs = this.getErrorLogs(options);

        if (format === 'csv') {
            return this.convertLogsToCSV(logs);
        }

        return JSON.stringify(logs, null, 2);
    }

    /**
     * Determine error severity based on error code
     */
    private determineSeverity(errorCode: SwapCompletionErrorCodes): 'low' | 'medium' | 'high' | 'critical' {
        switch (errorCode) {
            case SwapCompletionErrorCodes.ROLLBACK_FAILED:
            case SwapCompletionErrorCodes.INCONSISTENT_ENTITY_STATES:
                return 'critical';

            case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
            case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
            case SwapCompletionErrorCodes.AUTOMATIC_CORRECTION_FAILED:
                return 'high';

            case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
            case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
            case SwapCompletionErrorCodes.CONCURRENT_COMPLETION_CONFLICT:
                return 'medium';

            default:
                return 'low';
        }
    }

    /**
     * Add log entry to storage
     */
    private addLogEntry(logEntry: CompletionErrorLogEntry): void {
        this.errorLogs.push(logEntry);

        // Maintain storage limit
        if (this.errorLogs.length > this.maxLogsToStore) {
            this.errorLogs.shift();
        }
    }

    /**
     * Update error pattern tracking
     */
    private updateErrorPattern(logEntry: CompletionErrorLogEntry): void {
        const errorCode = logEntry.errorCode;
        let pattern = this.errorPatterns.get(errorCode);

        if (!pattern) {
            pattern = {
                errorCode,
                frequency: 0,
                firstOccurrence: logEntry.timestamp,
                lastOccurrence: logEntry.timestamp,
                affectedUsers: new Set(),
                affectedProposals: new Set(),
                commonContext: {},
                trend: 'stable'
            };
            this.errorPatterns.set(errorCode, pattern);
        }

        // Update pattern
        pattern.frequency++;
        pattern.lastOccurrence = logEntry.timestamp;

        if (logEntry.userId) {
            pattern.affectedUsers.add(logEntry.userId);
        }

        if (logEntry.proposalId) {
            pattern.affectedProposals.add(logEntry.proposalId);
        }

        // Update trend (simplified calculation)
        const hoursSinceFirst = (logEntry.timestamp.getTime() - pattern.firstOccurrence.getTime()) / (1000 * 60 * 60);
        if (hoursSinceFirst > 1) {
            const recentFrequency = this.errorLogs
                .filter(log =>
                    log.errorCode === errorCode &&
                    log.timestamp.getTime() > Date.now() - 60 * 60 * 1000 // Last hour
                ).length;

            const historicalRate = pattern.frequency / hoursSinceFirst;

            if (recentFrequency > historicalRate * 1.5) {
                pattern.trend = 'increasing';
            } else if (recentFrequency < historicalRate * 0.5) {
                pattern.trend = 'decreasing';
            } else {
                pattern.trend = 'stable';
            }
        }
    }

    /**
     * Log to system logger
     */
    private logToSystem(logEntry: CompletionErrorLogEntry): void {
        const logData = {
            errorId: logEntry.id,
            completionId: logEntry.completionId,
            proposalId: logEntry.proposalId,
            userId: logEntry.userId,
            errorCode: logEntry.errorCode,
            errorMessage: logEntry.errorMessage,
            severity: logEntry.severity,
            affectedEntities: logEntry.affectedEntities,
            rollbackRequired: logEntry.rollbackRequired,
            retryable: logEntry.retryable,
            retryAttempt: logEntry.retryAttempt,
            context: logEntry.context
        };

        switch (logEntry.severity) {
            case 'critical':
                enhancedLogger.error('Critical completion error', logData);
                break;
            case 'high':
                enhancedLogger.error('High severity completion error', logData);
                break;
            case 'medium':
                enhancedLogger.warn('Medium severity completion error', logData);
                break;
            default:
                enhancedLogger.info('Completion error logged', logData);
        }
    }

    /**
     * Handle critical errors with immediate alerting
     */
    private handleCriticalError(logEntry: CompletionErrorLogEntry): void {
        enhancedLogger.error('CRITICAL COMPLETION ERROR - IMMEDIATE ATTENTION REQUIRED', {
            errorId: logEntry.id,
            errorCode: logEntry.errorCode,
            completionId: logEntry.completionId,
            affectedEntities: logEntry.affectedEntities,
            rollbackRequired: logEntry.rollbackRequired,
            timestamp: logEntry.timestamp.toISOString()
        });

        // In a production environment, this would trigger:
        // - PagerDuty/OpsGenie alerts
        // - Slack/Teams notifications
        // - Email alerts to on-call engineers
        // - Automatic incident creation
    }

    /**
     * Generate recommendations based on error analysis
     */
    private generateRecommendations(
        topErrorsByFrequency: Array<{ errorCode: SwapCompletionErrorCodes; count: number; percentage: number }>,
        topErrorsByImpact: Array<{ errorCode: SwapCompletionErrorCodes; affectedUsers: number; affectedProposals: number }>,
        criticalErrors: number,
        totalErrors: number
    ): string[] {
        const recommendations: string[] = [];

        if (criticalErrors > 0) {
            recommendations.push(`URGENT: ${criticalErrors} critical errors detected. Immediate investigation required.`);
        }

        if (totalErrors > 100) {
            recommendations.push('High error volume detected. Consider implementing circuit breakers or rate limiting.');
        }

        // Check for specific error patterns
        topErrorsByFrequency.forEach(error => {
            if (error.percentage > 30) {
                switch (error.errorCode) {
                    case SwapCompletionErrorCodes.DATABASE_TRANSACTION_FAILED:
                        recommendations.push('High database transaction failure rate. Check database performance and connection pool settings.');
                        break;
                    case SwapCompletionErrorCodes.BLOCKCHAIN_RECORDING_FAILED:
                        recommendations.push('High blockchain failure rate. Verify network connectivity and consider implementing better retry logic.');
                        break;
                    case SwapCompletionErrorCodes.COMPLETION_VALIDATION_FAILED:
                        recommendations.push('High validation failure rate. Review validation logic and input data quality.');
                        break;
                    case SwapCompletionErrorCodes.COMPLETION_TIMEOUT:
                        recommendations.push('High timeout rate. Consider optimizing completion workflow performance.');
                        break;
                }
            }
        });

        // Check for impact patterns
        topErrorsByImpact.forEach(error => {
            if (error.affectedUsers > 10) {
                recommendations.push(`Error ${error.errorCode} is affecting many users (${error.affectedUsers}). Prioritize resolution.`);
            }
        });

        if (recommendations.length === 0) {
            recommendations.push('Error patterns are within acceptable ranges. Continue monitoring.');
        }

        return recommendations;
    }

    /**
     * Convert logs to CSV format
     */
    private convertLogsToCSV(logs: CompletionErrorLogEntry[]): string {
        const headers = [
            'ID', 'Timestamp', 'CompletionID', 'ProposalID', 'UserID', 'ErrorCode',
            'ErrorMessage', 'Severity', 'AffectedEntities', 'RollbackRequired',
            'Retryable', 'RetryAttempt', 'Resolved'
        ];

        const rows = logs.map(log => [
            log.id,
            log.timestamp.toISOString(),
            log.completionId,
            log.proposalId || '',
            log.userId || '',
            log.errorCode,
            `"${log.errorMessage.replace(/"/g, '""')}"`,
            log.severity,
            log.affectedEntities.join(';'),
            log.rollbackRequired,
            log.retryable,
            log.retryAttempt || '',
            !!log.resolution
        ]);

        return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    }

    /**
     * Start periodic analysis
     */
    private startPeriodicAnalysis(): void {
        // Generate daily error analysis reports
        setInterval(() => {
            const report = this.generateErrorAnalysisReport(
                new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
                new Date()
            );

            enhancedLogger.info('Daily error analysis report generated', {
                reportId: report.reportId,
                totalErrors: report.totalErrors,
                uniqueErrors: report.uniqueErrors,
                criticalErrors: report.criticalErrors,
                topError: report.topErrorsByFrequency[0]?.errorCode
            });

            // Clean up old logs (keep 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            this.clearOldLogs(thirtyDaysAgo);
        }, 24 * 60 * 60 * 1000); // Every 24 hours
    }

    /**
     * Generate unique log ID
     */
    private generateLogId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}