import { logger } from './logger';

/**
 * Query performance logging utilities for proposal repository
 * Requirements: 4.3, 5.5
 */

export interface QueryMetrics {
    queryId: string;
    operation: string;
    query: string;
    parameters?: any[];
    executionTime: number;
    rowCount?: number;
    planningTime?: number;
    executionTimeBreakdown?: {
        parsing?: number;
        planning?: number;
        execution?: number;
    };
    memoryUsage?: number;
    cacheHit?: boolean;
    indexesUsed?: string[];
    warnings?: string[];
}

export interface PerformanceThresholds {
    slowQueryThreshold: number; // milliseconds
    verySlowQueryThreshold: number; // milliseconds
    maxRowsWarningThreshold: number;
    memoryWarningThreshold: number; // bytes
}

export interface QueryAnalysis {
    isSlowQuery: boolean;
    isVerySlowQuery: boolean;
    hasPerformanceIssues: boolean;
    recommendations: string[];
    warnings: string[];
    severity: 'info' | 'warning' | 'error';
}

/**
 * Query performance logger for monitoring complex JOIN operations
 */
export class QueryPerformanceLogger {
    private static instance: QueryPerformanceLogger;
    private queryHistory: Map<string, QueryMetrics[]> = new Map();
    private readonly MAX_HISTORY_SIZE = 1000;

    private readonly defaultThresholds: PerformanceThresholds = {
        slowQueryThreshold: 1000, // 1 second
        verySlowQueryThreshold: 5000, // 5 seconds
        maxRowsWarningThreshold: 10000,
        memoryWarningThreshold: 100 * 1024 * 1024 // 100MB
    };

    private constructor(private thresholds: PerformanceThresholds = {}) {
        this.thresholds = { ...this.defaultThresholds, ...thresholds };
    }

    static getInstance(thresholds?: PerformanceThresholds): QueryPerformanceLogger {
        if (!QueryPerformanceLogger.instance) {
            QueryPerformanceLogger.instance = new QueryPerformanceLogger(thresholds);
        }
        return QueryPerformanceLogger.instance;
    }

    /**
     * Log query performance metrics
     */
    logQueryPerformance(metrics: QueryMetrics): QueryAnalysis {
        const analysis = this.analyzeQueryPerformance(metrics);

        // Store in history
        this.addToHistory(metrics);

        // Log based on severity
        const logData = {
            queryId: metrics.queryId,
            operation: metrics.operation,
            executionTime: metrics.executionTime,
            rowCount: metrics.rowCount,
            planningTime: metrics.planningTime,
            memoryUsage: metrics.memoryUsage,
            cacheHit: metrics.cacheHit,
            indexesUsed: metrics.indexesUsed,
            query: this.sanitizeQuery(metrics.query),
            parameters: this.sanitizeParameters(metrics.parameters),
            analysis: {
                isSlowQuery: analysis.isSlowQuery,
                isVerySlowQuery: analysis.isVerySlowQuery,
                hasPerformanceIssues: analysis.hasPerformanceIssues,
                recommendations: analysis.recommendations,
                warnings: analysis.warnings
            },
            timestamp: new Date().toISOString(),
            requirement: '4.3'
        };

        switch (analysis.severity) {
            case 'error':
                logger.error('Very slow query detected', logData);
                break;
            case 'warning':
                logger.warn('Slow query detected', logData);
                break;
            case 'info':
                logger.info('Query performance logged', logData);
                break;
        }

        return analysis;
    }

    /**
     * Analyze query performance and provide recommendations
     */
    private analyzeQueryPerformance(metrics: QueryMetrics): QueryAnalysis {
        const analysis: QueryAnalysis = {
            isSlowQuery: false,
            isVerySlowQuery: false,
            hasPerformanceIssues: false,
            recommendations: [],
            warnings: [],
            severity: 'info'
        };

        // Check execution time thresholds
        if (metrics.executionTime >= this.thresholds.verySlowQueryThreshold) {
            analysis.isVerySlowQuery = true;
            analysis.isSlowQuery = true;
            analysis.hasPerformanceIssues = true;
            analysis.severity = 'error';
            analysis.warnings.push(`Query execution time (${metrics.executionTime}ms) exceeds very slow threshold`);
            analysis.recommendations.push('Consider query optimization, indexing, or result set limitation');
        } else if (metrics.executionTime >= this.thresholds.slowQueryThreshold) {
            analysis.isSlowQuery = true;
            analysis.hasPerformanceIssues = true;
            analysis.severity = 'warning';
            analysis.warnings.push(`Query execution time (${metrics.executionTime}ms) exceeds slow threshold`);
            analysis.recommendations.push('Review query performance and consider optimization');
        }

        // Check row count
        if (metrics.rowCount && metrics.rowCount > this.thresholds.maxRowsWarningThreshold) {
            analysis.hasPerformanceIssues = true;
            analysis.warnings.push(`Large result set: ${metrics.rowCount} rows returned`);
            analysis.recommendations.push('Consider adding LIMIT clause or pagination');
        }

        // Check memory usage
        if (metrics.memoryUsage && metrics.memoryUsage > this.thresholds.memoryWarningThreshold) {
            analysis.hasPerformanceIssues = true;
            analysis.warnings.push(`High memory usage: ${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`);
            analysis.recommendations.push('Consider reducing result set size or optimizing query');
        }

        // Check cache performance
        if (metrics.cacheHit === false && metrics.executionTime > 500) {
            analysis.recommendations.push('Query not using cache - consider query optimization for better cache utilization');
        }

        // Analyze JOIN operations
        if (this.hasComplexJoins(metrics.query)) {
            analysis.recommendations.push('Complex JOIN detected - ensure proper indexing on join columns');

            if (!metrics.indexesUsed || metrics.indexesUsed.length === 0) {
                analysis.hasPerformanceIssues = true;
                analysis.warnings.push('Complex JOIN without index usage detected');
                analysis.recommendations.push('Add indexes on JOIN columns for better performance');
            }
        }

        // Check for proposal repository specific patterns
        if (this.isProposalRepositoryQuery(metrics.query)) {
            const proposalAnalysis = this.analyzeProposalQuery(metrics);
            analysis.recommendations.push(...proposalAnalysis.recommendations);
            analysis.warnings.push(...proposalAnalysis.warnings);
        }

        return analysis;
    }

    /**
     * Analyze proposal repository specific query patterns
     */
    private analyzeProposalQuery(metrics: QueryMetrics): { recommendations: string[]; warnings: string[] } {
        const recommendations: string[] = [];
        const warnings: string[] = [];
        const query = metrics.query.toLowerCase();

        // Check for deprecated column usage
        const deprecatedColumns = ['owner_id', 'proposer_id', 'target_booking_id'];
        for (const column of deprecatedColumns) {
            if (query.includes(column)) {
                warnings.push(`Deprecated column "${column}" detected in query`);
                recommendations.push('Update query to use booking relationships instead of deprecated columns');
            }
        }

        // Check for proper JOIN usage in proposal queries
        if (query.includes('proposals') || query.includes('swap_proposal')) {
            if (!query.includes('join') && !query.includes('left join')) {
                recommendations.push('Consider using JOINs to derive user information from booking relationships');
            }
        }

        // Check for missing WHERE clauses that could cause full table scans
        if (query.includes('select') && !query.includes('where') && !query.includes('limit')) {
            warnings.push('Query without WHERE clause or LIMIT detected');
            recommendations.push('Add appropriate WHERE clauses to limit result set');
        }

        // Check for N+1 query patterns
        if (metrics.operation.includes('getProposal') && metrics.rowCount === 1 && metrics.executionTime > 100) {
            recommendations.push('Single row query taking longer than expected - check for N+1 query pattern');
        }

        return { recommendations, warnings };
    }

    /**
     * Check if query has complex JOINs
     */
    private hasComplexJoins(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        const joinCount = (lowerQuery.match(/join/g) || []).length;
        return joinCount >= 2 || lowerQuery.includes('left join') || lowerQuery.includes('right join');
    }

    /**
     * Check if query is from proposal repository
     */
    private isProposalRepositoryQuery(query: string): boolean {
        const lowerQuery = query.toLowerCase();
        return lowerQuery.includes('proposals') ||
            lowerQuery.includes('swap_proposal') ||
            lowerQuery.includes('proposal_id');
    }

    /**
     * Sanitize query for logging (remove sensitive data)
     */
    private sanitizeQuery(query: string): string {
        // Remove potential sensitive data patterns
        return query
            .replace(/('[^']*')/g, "'***'") // Replace string literals
            .replace(/(\$\d+)/g, '$***') // Replace parameter placeholders
            .substring(0, 1000); // Limit length
    }

    /**
     * Sanitize parameters for logging
     */
    private sanitizeParameters(parameters?: any[]): any[] | undefined {
        if (!parameters) return undefined;

        return parameters.map(param => {
            if (typeof param === 'string' && param.length > 50) {
                return param.substring(0, 50) + '...';
            }
            return param;
        });
    }

    /**
     * Add metrics to history
     */
    private addToHistory(metrics: QueryMetrics): void {
        const operation = metrics.operation;

        if (!this.queryHistory.has(operation)) {
            this.queryHistory.set(operation, []);
        }

        const history = this.queryHistory.get(operation)!;
        history.push(metrics);

        // Keep only recent entries
        if (history.length > this.MAX_HISTORY_SIZE) {
            history.shift();
        }
    }

    /**
     * Get performance statistics for an operation
     */
    getOperationStats(operation: string): {
        totalQueries: number;
        averageExecutionTime: number;
        slowQueries: number;
        verySlowQueries: number;
        recentTrend: 'improving' | 'degrading' | 'stable';
    } | null {
        const history = this.queryHistory.get(operation);
        if (!history || history.length === 0) {
            return null;
        }

        const totalQueries = history.length;
        const averageExecutionTime = history.reduce((sum, m) => sum + m.executionTime, 0) / totalQueries;
        const slowQueries = history.filter(m => m.executionTime >= this.thresholds.slowQueryThreshold).length;
        const verySlowQueries = history.filter(m => m.executionTime >= this.thresholds.verySlowQueryThreshold).length;

        // Calculate trend (compare recent 10% with previous 10%)
        const recentCount = Math.max(1, Math.floor(totalQueries * 0.1));
        const recent = history.slice(-recentCount);
        const previous = history.slice(-recentCount * 2, -recentCount);

        let recentTrend: 'improving' | 'degrading' | 'stable' = 'stable';
        if (previous.length > 0) {
            const recentAvg = recent.reduce((sum, m) => sum + m.executionTime, 0) / recent.length;
            const previousAvg = previous.reduce((sum, m) => sum + m.executionTime, 0) / previous.length;

            const changePercent = ((recentAvg - previousAvg) / previousAvg) * 100;
            if (changePercent > 10) {
                recentTrend = 'degrading';
            } else if (changePercent < -10) {
                recentTrend = 'improving';
            }
        }

        return {
            totalQueries,
            averageExecutionTime,
            slowQueries,
            verySlowQueries,
            recentTrend
        };
    }

    /**
     * Get overall performance summary
     */
    getPerformanceSummary(): {
        totalOperations: number;
        totalQueries: number;
        overallAverageTime: number;
        slowestOperations: Array<{ operation: string; averageTime: number }>;
        recommendations: string[];
    } {
        const operations = Array.from(this.queryHistory.keys());
        const totalQueries = Array.from(this.queryHistory.values()).reduce((sum, history) => sum + history.length, 0);

        let totalTime = 0;
        const operationStats: Array<{ operation: string; averageTime: number }> = [];

        for (const operation of operations) {
            const stats = this.getOperationStats(operation);
            if (stats) {
                totalTime += stats.averageExecutionTime * stats.totalQueries;
                operationStats.push({
                    operation,
                    averageTime: stats.averageExecutionTime
                });
            }
        }

        const overallAverageTime = totalQueries > 0 ? totalTime / totalQueries : 0;
        const slowestOperations = operationStats
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, 5);

        const recommendations: string[] = [];
        if (overallAverageTime > this.thresholds.slowQueryThreshold) {
            recommendations.push('Overall query performance is below optimal - consider database optimization');
        }

        if (slowestOperations.length > 0 && slowestOperations[0].averageTime > this.thresholds.verySlowQueryThreshold) {
            recommendations.push(`Focus optimization efforts on: ${slowestOperations[0].operation}`);
        }

        return {
            totalOperations: operations.length,
            totalQueries,
            overallAverageTime,
            slowestOperations,
            recommendations
        };
    }

    /**
     * Clear performance history
     */
    clearHistory(): void {
        this.queryHistory.clear();
    }

    /**
     * Update performance thresholds
     */
    updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
        this.thresholds = { ...this.thresholds, ...newThresholds };
    }
}

/**
 * Utility function to measure and log query performance
 */
export async function measureQueryPerformance<T>(
    operation: string,
    query: string,
    parameters: any[] | undefined,
    queryExecutor: () => Promise<T>,
    additionalMetrics?: Partial<QueryMetrics>
): Promise<{ result: T; metrics: QueryMetrics }> {
    const queryId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
        const result = await queryExecutor();
        const endTime = Date.now();
        const endMemory = process.memoryUsage().heapUsed;

        const metrics: QueryMetrics = {
            queryId,
            operation,
            query,
            parameters,
            executionTime: endTime - startTime,
            memoryUsage: endMemory - startMemory,
            ...additionalMetrics
        };

        // Log performance
        const performanceLogger = QueryPerformanceLogger.getInstance();
        performanceLogger.logQueryPerformance(metrics);

        return { result, metrics };
    } catch (error) {
        const endTime = Date.now();

        const metrics: QueryMetrics = {
            queryId,
            operation,
            query,
            parameters,
            executionTime: endTime - startTime,
            warnings: [`Query failed: ${error.message}`],
            ...additionalMetrics
        };

        // Log failed query performance
        const performanceLogger = QueryPerformanceLogger.getInstance();
        performanceLogger.logQueryPerformance(metrics);

        throw error;
    }
}