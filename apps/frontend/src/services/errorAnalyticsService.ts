import { ErrorDetails, ErrorType, ErrorSeverity, errorLoggingService } from './errorLoggingService';

/**
 * Error trend data for analytics
 */
export interface ErrorTrend {
    timestamp: Date;
    errorCount: number;
    errorType: ErrorType;
    severity: ErrorSeverity;
    component: string;
}

/**
 * Error analytics report
 */
export interface ErrorAnalyticsReport {
    timeframe: {
        start: Date;
        end: Date;
    };
    summary: {
        totalErrors: number;
        uniqueErrors: number;
        affectedComponents: number;
        averageErrorsPerHour: number;
        criticalErrors: number;
        recoveryRate: number;
    };
    trends: {
        hourlyTrends: Array<{ hour: string; count: number }>;
        componentTrends: Array<{ component: string; count: number; trend: 'up' | 'down' | 'stable' }>;
        typeTrends: Array<{ type: ErrorType; count: number; percentage: number }>;
        severityDistribution: Array<{ severity: ErrorSeverity; count: number; percentage: number }>;
    };
    insights: {
        mostProblematicComponent: string;
        mostCommonErrorType: ErrorType;
        peakErrorHour: string;
        recommendations: string[];
    };
    alerts: Array<{
        type: 'spike' | 'new_error' | 'component_failure' | 'recovery_failure';
        message: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        timestamp: Date;
    }>;
}

/**
 * Error pattern detection
 */
interface ErrorPattern {
    pattern: string;
    frequency: number;
    components: string[];
    severity: ErrorSeverity;
    recommendation: string;
}

/**
 * Comprehensive error analytics service for monitoring trends and patterns
 */
export class ErrorAnalyticsService {
    private static instance: ErrorAnalyticsService;
    private errorHistory: ErrorDetails[] = [];
    private alertThresholds = {
        errorSpike: 5, // errors per 10 minutes
        componentFailureRate: 0.8, // 80% error rate
        criticalErrorThreshold: 3, // critical errors per hour
    };

    private constructor() {
        this.setupPeriodicAnalysis();
    }

    static getInstance(): ErrorAnalyticsService {
        if (!ErrorAnalyticsService.instance) {
            ErrorAnalyticsService.instance = new ErrorAnalyticsService();
        }
        return ErrorAnalyticsService.instance;
    }

    /**
     * Generate comprehensive analytics report
     */
    generateReport(timeframeHours: number = 24): ErrorAnalyticsReport {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (timeframeHours * 60 * 60 * 1000));

        const metrics = errorLoggingService.getMetrics();
        const recentErrors = this.getErrorsInTimeframe(startTime, endTime);

        return {
            timeframe: { start: startTime, end: endTime },
            summary: this.generateSummary(recentErrors, timeframeHours),
            trends: this.analyzeTrends(recentErrors),
            insights: this.generateInsights(recentErrors, metrics),
            alerts: this.generateAlerts(recentErrors),
        };
    }

    /**
     * Detect error patterns and anomalies
     */
    detectPatterns(): ErrorPattern[] {
        const errors = errorLoggingService.getMetrics().sessionErrors;
        const patterns: Map<string, ErrorPattern> = new Map();

        errors.forEach(error => {
            const patternKey = this.extractPattern(error);
            const existing = patterns.get(patternKey);

            if (existing) {
                existing.frequency++;
                if (!existing.components.includes(error.componentName)) {
                    existing.components.push(error.componentName);
                }
            } else {
                patterns.set(patternKey, {
                    pattern: patternKey,
                    frequency: 1,
                    components: [error.componentName],
                    severity: error.severity,
                    recommendation: this.generatePatternRecommendation(error),
                });
            }
        });

        return Array.from(patterns.values())
            .filter(pattern => pattern.frequency > 1)
            .sort((a, b) => b.frequency - a.frequency);
    }

    /**
     * Get error trends for specific component
     */
    getComponentTrends(componentName: string, hours: number = 24): {
        errorCount: number;
        errorRate: number;
        trend: 'improving' | 'worsening' | 'stable';
        commonErrors: string[];
    } {
        const endTime = new Date();
        const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
        const errors = this.getErrorsInTimeframe(startTime, endTime)
            .filter(error => error.componentName === componentName);

        const midpoint = new Date(startTime.getTime() + (hours * 30 * 60 * 1000));
        const firstHalf = errors.filter(error => error.timestamp < midpoint);
        const secondHalf = errors.filter(error => error.timestamp >= midpoint);

        let trend: 'improving' | 'worsening' | 'stable' = 'stable';
        if (secondHalf.length > firstHalf.length * 1.2) {
            trend = 'worsening';
        } else if (firstHalf.length > secondHalf.length * 1.2) {
            trend = 'improving';
        }

        const commonErrors = this.getCommonErrorMessages(errors);

        return {
            errorCount: errors.length,
            errorRate: errors.length / hours,
            trend,
            commonErrors,
        };
    }

    /**
     * Export analytics data for external systems
     */
    exportAnalytics(format: 'json' | 'csv' = 'json'): string {
        const report = this.generateReport();

        if (format === 'csv') {
            return this.convertToCSV(report);
        }

        return JSON.stringify(report, null, 2);
    }

    /**
     * Set up periodic analysis and alerting
     */
    private setupPeriodicAnalysis(): void {
        // Run analysis every 10 minutes
        setInterval(() => {
            this.runPeriodicAnalysis();
        }, 10 * 60 * 1000);

        // Initial analysis
        setTimeout(() => this.runPeriodicAnalysis(), 1000);
    }

    /**
     * Run periodic analysis and generate alerts
     */
    private runPeriodicAnalysis(): void {
        const recentErrors = this.getErrorsInTimeframe(
            new Date(Date.now() - 10 * 60 * 1000), // Last 10 minutes
            new Date()
        );

        // Check for error spikes
        if (recentErrors.length >= this.alertThresholds.errorSpike) {
            this.triggerAlert('spike', `Error spike detected: ${recentErrors.length} errors in 10 minutes`, 'high');
        }

        // Check for critical errors
        const criticalErrors = recentErrors.filter(error => error.severity === ErrorSeverity.CRITICAL);
        if (criticalErrors.length >= this.alertThresholds.criticalErrorThreshold) {
            this.triggerAlert('component_failure', `Critical errors detected: ${criticalErrors.length} critical errors`, 'critical');
        }

        // Check for new error types
        this.checkForNewErrorTypes(recentErrors);
    }

    /**
     * Generate summary statistics
     */
    private generateSummary(errors: ErrorDetails[], timeframeHours: number) {
        const uniqueErrors = new Set(errors.map(e => e.errorMessage)).size;
        const affectedComponents = new Set(errors.map(e => e.componentName)).size;
        const criticalErrors = errors.filter(e => e.severity === ErrorSeverity.CRITICAL).length;
        const recoveredErrors = errors.filter(e => (e.recoveryAttempts || 0) > 0).length;

        return {
            totalErrors: errors.length,
            uniqueErrors,
            affectedComponents,
            averageErrorsPerHour: errors.length / timeframeHours,
            criticalErrors,
            recoveryRate: errors.length > 0 ? recoveredErrors / errors.length : 0,
        };
    }

    /**
     * Analyze error trends
     */
    private analyzeTrends(errors: ErrorDetails[]) {
        // Hourly trends
        const hourlyTrends = this.generateHourlyTrends(errors);

        // Component trends
        const componentCounts = this.groupBy(errors, 'componentName');
        const componentTrends = Object.entries(componentCounts).map(([component, componentErrors]) => ({
            component,
            count: componentErrors.length,
            trend: this.calculateTrend(componentErrors) as 'up' | 'down' | 'stable',
        }));

        // Type trends
        const typeCounts = this.groupBy(errors, 'errorType');
        const typeTrends = Object.entries(typeCounts).map(([type, typeErrors]) => ({
            type: type as ErrorType,
            count: typeErrors.length,
            percentage: (typeErrors.length / errors.length) * 100,
        }));

        // Severity distribution
        const severityCounts = this.groupBy(errors, 'severity');
        const severityDistribution = Object.entries(severityCounts).map(([severity, severityErrors]) => ({
            severity: severity as ErrorSeverity,
            count: severityErrors.length,
            percentage: (severityErrors.length / errors.length) * 100,
        }));

        return {
            hourlyTrends,
            componentTrends,
            typeTrends,
            severityDistribution,
        };
    }

    /**
     * Generate insights and recommendations
     */
    private generateInsights(errors: ErrorDetails[], metrics: any) {
        const componentCounts = this.groupBy(errors, 'componentName');
        const mostProblematicComponent = Object.entries(componentCounts)
            .sort(([, a], [, b]) => b.length - a.length)[0]?.[0] || 'None';

        const typeCounts = this.groupBy(errors, 'errorType');
        const mostCommonErrorType = Object.entries(typeCounts)
            .sort(([, a], [, b]) => b.length - a.length)[0]?.[0] as ErrorType || ErrorType.UNKNOWN;

        const hourlyDistribution = this.generateHourlyTrends(errors);
        const peakErrorHour = hourlyDistribution
            .sort((a, b) => b.count - a.count)[0]?.hour || 'Unknown';

        const recommendations = this.generateRecommendations(errors, metrics);

        return {
            mostProblematicComponent,
            mostCommonErrorType,
            peakErrorHour,
            recommendations,
        };
    }

    /**
     * Generate alerts based on error patterns
     */
    private generateAlerts(errors: ErrorDetails[]) {
        const alerts: ErrorAnalyticsReport['alerts'] = [];

        // Check for component failures
        const componentCounts = this.groupBy(errors, 'componentName');
        Object.entries(componentCounts).forEach(([component, componentErrors]) => {
            if (componentErrors.length > 10) {
                alerts.push({
                    type: 'component_failure',
                    message: `High error rate in ${component}: ${componentErrors.length} errors`,
                    severity: 'high',
                    timestamp: new Date(),
                });
            }
        });

        // Check for new error types
        const recentNewErrors = errors.filter(error =>
            !this.errorHistory.some(historical =>
                historical.errorMessage === error.errorMessage
            )
        );

        recentNewErrors.forEach(error => {
            alerts.push({
                type: 'new_error',
                message: `New error detected in ${error.componentName}: ${error.errorMessage}`,
                severity: error.severity === ErrorSeverity.CRITICAL ? 'critical' : 'medium',
                timestamp: error.timestamp,
            });
        });

        return alerts;
    }

    /**
     * Get errors within a specific timeframe
     */
    private getErrorsInTimeframe(start: Date, end: Date): ErrorDetails[] {
        return errorLoggingService.getMetrics().sessionErrors.filter(
            error => error.timestamp >= start && error.timestamp <= end
        );
    }

    /**
     * Generate hourly error trends
     */
    private generateHourlyTrends(errors: ErrorDetails[]) {
        const hourlyMap = new Map<string, number>();

        errors.forEach(error => {
            const hour = error.timestamp.toISOString().slice(0, 13);
            hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        });

        return Array.from(hourlyMap.entries())
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => a.hour.localeCompare(b.hour));
    }

    /**
     * Group errors by a specific property
     */
    private groupBy<T extends ErrorDetails>(errors: T[], key: keyof T): Record<string, T[]> {
        return errors.reduce((groups, error) => {
            const groupKey = String(error[key]);
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(error);
            return groups;
        }, {} as Record<string, T[]>);
    }

    /**
     * Calculate trend direction for a set of errors
     */
    private calculateTrend(errors: ErrorDetails[]): 'up' | 'down' | 'stable' {
        if (errors.length < 2) return 'stable';

        const midpoint = errors.length / 2;
        const firstHalf = errors.slice(0, Math.floor(midpoint));
        const secondHalf = errors.slice(Math.ceil(midpoint));

        if (secondHalf.length > firstHalf.length * 1.2) return 'up';
        if (firstHalf.length > secondHalf.length * 1.2) return 'down';
        return 'stable';
    }

    /**
     * Extract error pattern for pattern detection
     */
    private extractPattern(error: ErrorDetails): string {
        // Create a pattern based on error type, component, and message keywords
        const messageWords = error.errorMessage.toLowerCase()
            .split(/\s+/)
            .filter(word => word.length > 3)
            .slice(0, 3)
            .join('_');

        return `${error.errorType}_${error.componentName}_${messageWords}`;
    }

    /**
     * Generate recommendation for error pattern
     */
    private generatePatternRecommendation(error: ErrorDetails): string {
        switch (error.errorType) {
            case ErrorType.DESIGN_TOKEN:
                return 'Review design token definitions and add missing tokens';
            case ErrorType.PROP_VALIDATION:
                return 'Add prop validation and default values to component';
            case ErrorType.COMPONENT_RENDER:
                return 'Add error boundary around component and implement fallback UI';
            case ErrorType.STATE_MANAGEMENT:
                return 'Review state management logic and add error handling';
            case ErrorType.NETWORK:
                return 'Implement retry logic and offline handling';
            default:
                return 'Review error logs and implement appropriate error handling';
        }
    }

    /**
     * Get common error messages from a set of errors
     */
    private getCommonErrorMessages(errors: ErrorDetails[]): string[] {
        const messageCounts = new Map<string, number>();

        errors.forEach(error => {
            messageCounts.set(error.errorMessage, (messageCounts.get(error.errorMessage) || 0) + 1);
        });

        return Array.from(messageCounts.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([message]) => message);
    }

    /**
     * Generate recommendations based on error analysis
     */
    private generateRecommendations(errors: ErrorDetails[], metrics: any): string[] {
        const recommendations: string[] = [];

        // Component-specific recommendations
        const componentCounts = this.groupBy(errors, 'componentName');
        const topComponent = Object.entries(componentCounts)
            .sort(([, a], [, b]) => b.length - a.length)[0];

        if (topComponent && topComponent[1].length > 5) {
            recommendations.push(`Focus on fixing errors in ${topComponent[0]} component (${topComponent[1].length} errors)`);
        }

        // Type-specific recommendations
        const typeCounts = this.groupBy(errors, 'errorType');
        Object.entries(typeCounts).forEach(([type, typeErrors]) => {
            if (typeErrors.length > 3) {
                recommendations.push(this.generatePatternRecommendation(typeErrors[0]));
            }
        });

        // Recovery rate recommendations
        if (metrics.recoverySuccessRate < 0.5) {
            recommendations.push('Improve error recovery mechanisms - current recovery rate is low');
        }

        return [...new Set(recommendations)]; // Remove duplicates
    }

    /**
     * Check for new error types
     */
    private checkForNewErrorTypes(recentErrors: ErrorDetails[]): void {
        recentErrors.forEach(error => {
            const isNewError = !this.errorHistory.some(historical =>
                historical.errorMessage === error.errorMessage &&
                historical.componentName === error.componentName
            );

            if (isNewError) {
                this.triggerAlert('new_error', `New error in ${error.componentName}: ${error.errorMessage}`, 'medium');
            }
        });

        // Update error history
        this.errorHistory = [...this.errorHistory, ...recentErrors].slice(-1000); // Keep last 1000 errors
    }

    /**
     * Trigger an alert
     */
    private triggerAlert(type: string, message: string, severity: string): void {
        console.warn(`[Error Analytics Alert] ${type.toUpperCase()}: ${message}`);

        // In production, this would integrate with alerting systems
        if (import.meta.env.DEV) {
            // Show desktop notification in development
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Error Analytics Alert', {
                    body: message,
                    icon: '/favicon.ico',
                });
            }
        }
    }

    /**
     * Convert analytics report to CSV format
     */
    private convertToCSV(report: ErrorAnalyticsReport): string {
        const headers = ['Timestamp', 'Component', 'Error Type', 'Severity', 'Message'];
        const rows = errorLoggingService.getMetrics().sessionErrors.map(error => [
            error.timestamp.toISOString(),
            error.componentName,
            error.errorType,
            error.severity,
            error.errorMessage.replace(/,/g, ';'), // Escape commas
        ]);

        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
}

// Export singleton instance
export const errorAnalyticsService = ErrorAnalyticsService.getInstance();
export default errorAnalyticsService;