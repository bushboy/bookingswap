/**
 * Auction Error Monitoring Service
 * Provides comprehensive error tracking and monitoring for auction creation processes
 */

import { logger, enhancedLogger } from '../../utils/logger';
import {
    AuctionCreationError,
    ValidationError,
    DateValidationError,
    AuctionSettingsValidationError,
    AuctionErrorUtils
} from '../../utils/AuctionErrors';

export interface AuctionErrorMetrics {
    totalErrors: number;
    dateValidationErrors: number;
    blockchainErrors: number;
    validationErrors: number;
    rollbackErrors: number;
    errorsByPhase: Record<string, number>;
    errorsByType: Record<string, number>;
    recentErrors: AuctionErrorEvent[];
}

export interface AuctionErrorEvent {
    timestamp: Date;
    errorType: string;
    phase?: string;
    auctionId?: string;
    swapId?: string;
    message: string;
    metadata?: Record<string, any>;
}

export interface DateValidationFailureMetrics {
    totalFailures: number;
    failuresByField: Record<string, number>;
    failuresByType: Record<string, number>;
    commonPatterns: Array<{
        pattern: string;
        count: number;
        examples: string[];
    }>;
}

/**
 * Comprehensive error monitoring service for auction operations
 */
export class AuctionErrorMonitoringService {
    private static instance: AuctionErrorMonitoringService;
    private errorEvents: AuctionErrorEvent[] = [];
    private dateValidationFailures: Array<{
        timestamp: Date;
        field: string;
        value: any;
        type: string;
        error: string;
        context?: Record<string, any>;
    }> = [];

    private readonly MAX_STORED_EVENTS = 1000;
    private readonly MAX_STORED_DATE_FAILURES = 500;

    private constructor() {
        // Initialize monitoring
        this.setupPeriodicReporting();
    }

    public static getInstance(): AuctionErrorMonitoringService {
        if (!AuctionErrorMonitoringService.instance) {
            AuctionErrorMonitoringService.instance = new AuctionErrorMonitoringService();
        }
        return AuctionErrorMonitoringService.instance;
    }

    /**
     * Record an auction error event with comprehensive context
     */
    recordAuctionError(
        error: Error,
        context: {
            phase?: 'validation' | 'creation' | 'blockchain_recording' | 'rollback';
            auctionId?: string;
            swapId?: string;
            operation?: string;
            metadata?: Record<string, any>;
        }
    ): void {
        const errorEvent: AuctionErrorEvent = {
            timestamp: new Date(),
            errorType: error.constructor.name,
            phase: context.phase,
            auctionId: context.auctionId,
            swapId: context.swapId,
            message: error.message,
            metadata: {
                operation: context.operation,
                stack: error.stack,
                ...context.metadata
            }
        };

        // Store event
        this.errorEvents.push(errorEvent);
        if (this.errorEvents.length > this.MAX_STORED_EVENTS) {
            this.errorEvents.shift();
        }

        // Enhanced logging with structured data
        enhancedLogger.logError(error, {
            operation: context.operation || 'auction_operation',
            metadata: {
                phase: context.phase,
                auctionId: context.auctionId,
                swapId: context.swapId,
                errorCategory: 'auction_error',
                monitoringEnabled: true,
                ...context.metadata
            }
        });

        // Log specific error types with additional context
        if (error instanceof AuctionCreationError) {
            logger.error('Auction creation error recorded', {
                category: 'auction_monitoring',
                errorType: 'auction_creation',
                phase: error.phase || context.phase,
                auctionId: error.auctionId || context.auctionId,
                swapId: error.swapId || context.swapId,
                originalError: error.originalError ? {
                    name: error.originalError.name,
                    message: error.originalError.message
                } : undefined,
                timestamp: errorEvent.timestamp.toISOString()
            });
        }

        if (error instanceof DateValidationError) {
            this.recordDateValidationFailure(error, context);
        }

        // Check for error patterns that might indicate systemic issues
        this.analyzeErrorPatterns();
    }

    /**
     * Record date validation failure with detailed context
     */
    recordDateValidationFailure(
        error: DateValidationError,
        context: {
            auctionId?: string;
            swapId?: string;
            operation?: string;
            metadata?: Record<string, any>;
        }
    ): void {
        const failure = {
            timestamp: new Date(),
            field: error.field || 'unknown',
            value: error.dateValue,
            type: error.actualType || typeof error.dateValue,
            error: error.message,
            context: {
                auctionId: context.auctionId,
                swapId: context.swapId,
                operation: context.operation,
                expectedFormat: error.expectedFormat,
                ...context.metadata
            }
        };

        this.dateValidationFailures.push(failure);
        if (this.dateValidationFailures.length > this.MAX_STORED_DATE_FAILURES) {
            this.dateValidationFailures.shift();
        }

        // Enhanced logging for date validation failures
        logger.error('Date validation failure recorded', {
            category: 'date_validation_monitoring',
            field: failure.field,
            value: failure.value,
            valueType: failure.type,
            expectedFormat: error.expectedFormat,
            auctionId: context.auctionId,
            swapId: context.swapId,
            operation: context.operation,
            timestamp: failure.timestamp.toISOString(),
            validationHelp: {
                supportedFormats: [
                    'ISO 8601 string (e.g., "2025-11-02T15:00:00.000Z")',
                    'Date object',
                    'Unix timestamp (number)'
                ]
            }
        });
    }

    /**
     * Get comprehensive error metrics
     */
    getErrorMetrics(): AuctionErrorMetrics {
        const now = new Date();
        const recentThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours

        const recentErrors = this.errorEvents.filter(event => event.timestamp >= recentThreshold);

        const errorsByPhase: Record<string, number> = {};
        const errorsByType: Record<string, number> = {};

        this.errorEvents.forEach(event => {
            if (event.phase) {
                errorsByPhase[event.phase] = (errorsByPhase[event.phase] || 0) + 1;
            }
            errorsByType[event.errorType] = (errorsByType[event.errorType] || 0) + 1;
        });

        return {
            totalErrors: this.errorEvents.length,
            dateValidationErrors: this.errorEvents.filter(e => e.errorType === 'DateValidationError').length,
            blockchainErrors: this.errorEvents.filter(e => e.phase === 'blockchain_recording').length,
            validationErrors: this.errorEvents.filter(e => e.phase === 'validation').length,
            rollbackErrors: this.errorEvents.filter(e => e.phase === 'rollback').length,
            errorsByPhase,
            errorsByType,
            recentErrors: recentErrors.slice(-10) // Last 10 recent errors
        };
    }

    /**
     * Get date validation failure metrics
     */
    getDateValidationMetrics(): DateValidationFailureMetrics {
        const failuresByField: Record<string, number> = {};
        const failuresByType: Record<string, number> = {};
        const patternMap = new Map<string, { count: number; examples: string[] }>();

        this.dateValidationFailures.forEach(failure => {
            failuresByField[failure.field] = (failuresByField[failure.field] || 0) + 1;
            failuresByType[failure.type] = (failuresByType[failure.type] || 0) + 1;

            // Analyze common error patterns
            const pattern = this.extractErrorPattern(failure.error);
            if (pattern) {
                const existing = patternMap.get(pattern) || { count: 0, examples: [] };
                existing.count++;
                if (existing.examples.length < 3) {
                    existing.examples.push(String(failure.value));
                }
                patternMap.set(pattern, existing);
            }
        });

        const commonPatterns = Array.from(patternMap.entries())
            .map(([pattern, data]) => ({ pattern, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5 patterns

        return {
            totalFailures: this.dateValidationFailures.length,
            failuresByField,
            failuresByType,
            commonPatterns
        };
    }

    /**
     * Analyze error patterns to detect systemic issues
     */
    private analyzeErrorPatterns(): void {
        const recentErrors = this.errorEvents.slice(-10);

        // Check for repeated errors in the same phase
        const phaseErrors = recentErrors.reduce((acc, error) => {
            if (error.phase) {
                acc[error.phase] = (acc[error.phase] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        // Alert if too many errors in a single phase
        Object.entries(phaseErrors).forEach(([phase, count]) => {
            if (count >= 5) {
                logger.warn('High error rate detected in auction phase', {
                    category: 'auction_monitoring',
                    alertType: 'high_error_rate',
                    phase,
                    errorCount: count,
                    timeWindow: '10_recent_errors',
                    recommendation: `Investigate ${phase} phase for systemic issues`
                });
            }
        });

        // Check for date validation error spikes
        const recentDateErrors = this.dateValidationFailures.slice(-10);
        if (recentDateErrors.length >= 5) {
            const fieldCounts = recentDateErrors.reduce((acc, failure) => {
                acc[failure.field] = (acc[failure.field] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            Object.entries(fieldCounts).forEach(([field, count]) => {
                if (count >= 3) {
                    logger.warn('High date validation failure rate detected', {
                        category: 'date_validation_monitoring',
                        alertType: 'high_validation_failure_rate',
                        field,
                        failureCount: count,
                        timeWindow: '10_recent_failures',
                        recommendation: `Review date handling for field: ${field}`
                    });
                }
            });
        }
    }

    /**
     * Extract error pattern from error message
     */
    private extractErrorPattern(errorMessage: string): string | null {
        // Common patterns in date validation errors
        if (errorMessage.includes('is not a function')) {
            return 'method_not_function';
        }
        if (errorMessage.includes('not a valid date')) {
            return 'invalid_date_format';
        }
        if (errorMessage.includes('must be in the future')) {
            return 'past_date_provided';
        }
        if (errorMessage.includes('must be a Date object')) {
            return 'incorrect_type';
        }
        return null;
    }

    /**
     * Setup periodic reporting of error metrics
     */
    private setupPeriodicReporting(): void {
        // Report metrics every hour in production
        if (process.env.NODE_ENV === 'production') {
            setInterval(() => {
                const metrics = this.getErrorMetrics();
                const dateMetrics = this.getDateValidationMetrics();

                logger.info('Auction error monitoring report', {
                    category: 'auction_monitoring',
                    reportType: 'periodic_metrics',
                    metrics,
                    dateValidationMetrics: dateMetrics,
                    timestamp: new Date().toISOString()
                });
            }, 60 * 60 * 1000); // Every hour
        }
    }

    /**
     * Clear old error events (for maintenance)
     */
    clearOldEvents(olderThanDays: number = 7): void {
        const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

        const originalErrorCount = this.errorEvents.length;
        const originalDateFailureCount = this.dateValidationFailures.length;

        this.errorEvents = this.errorEvents.filter(event => event.timestamp >= cutoffDate);
        this.dateValidationFailures = this.dateValidationFailures.filter(failure => failure.timestamp >= cutoffDate);

        logger.info('Cleared old monitoring events', {
            category: 'auction_monitoring',
            operation: 'cleanup',
            originalErrorCount,
            remainingErrorCount: this.errorEvents.length,
            originalDateFailureCount,
            remainingDateFailureCount: this.dateValidationFailures.length,
            cutoffDate: cutoffDate.toISOString()
        });
    }

    /**
     * Get error summary for API responses
     */
    getErrorSummary(): {
        hasRecentErrors: boolean;
        errorCount: number;
        criticalIssues: string[];
        recommendations: string[];
    } {
        const metrics = this.getErrorMetrics();
        const dateMetrics = this.getDateValidationMetrics();

        const criticalIssues: string[] = [];
        const recommendations: string[] = [];

        // Check for critical issues
        if (metrics.recentErrors.length >= 5) {
            criticalIssues.push('High error rate in recent operations');
            recommendations.push('Review recent auction creation attempts for systemic issues');
        }

        if (dateMetrics.totalFailures >= 10) {
            criticalIssues.push('Multiple date validation failures detected');
            recommendations.push('Ensure frontend sends dates in proper ISO format');
        }

        if (metrics.blockchainErrors >= 3) {
            criticalIssues.push('Multiple blockchain recording failures');
            recommendations.push('Check blockchain service connectivity and configuration');
        }

        return {
            hasRecentErrors: metrics.recentErrors.length > 0,
            errorCount: metrics.totalErrors,
            criticalIssues,
            recommendations
        };
    }
}