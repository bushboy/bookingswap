import { SwapCompletionMonitoringService } from './SwapCompletionMonitoringService';
import { enhancedLogger } from '../../utils/logger';

/**
 * Performance metrics for completion operations
 */
export interface CompletionPerformanceMetrics {
    // Throughput metrics
    completionsPerSecond: number;
    completionsPerMinute: number;
    completionsPerHour: number;
    peakThroughput: number;

    // Latency metrics
    p50CompletionTime: number; // 50th percentile
    p95CompletionTime: number; // 95th percentile
    p99CompletionTime: number; // 99th percentile
    maxCompletionTime: number;
    minCompletionTime: number;

    // Resource utilization
    averageCpuUsage: number;
    averageMemoryUsage: number;
    peakCpuUsage: number;
    peakMemoryUsage: number;

    // Database performance
    averageDbQueryTime: number;
    maxDbQueryTime: number;
    dbConnectionPoolUtilization: number;
    dbTransactionCount: number;
    dbTransactionFailureRate: number;

    // Blockchain performance
    averageBlockchainConfirmationTime: number;
    maxBlockchainConfirmationTime: number;
    blockchainTransactionCount: number;
    blockchainFailureRate: number;

    // Queue metrics
    averageQueueWaitTime: number;
    maxQueueWaitTime: number;
    queueLength: number;
    maxQueueLength: number;

    // Error metrics
    errorRate: number;
    timeoutRate: number;
    rollbackRate: number;
    retryRate: number;
}

/**
 * Performance sample for time-series analysis
 */
export interface PerformanceSample {
    timestamp: Date;
    completionId?: string;
    operationType: 'booking_exchange' | 'cash_payment';

    // Timing data
    totalDuration: number;
    validationDuration: number;
    databaseDuration: number;
    blockchainDuration: number;
    notificationDuration: number;

    // Resource usage at time of sample
    cpuUsage: number;
    memoryUsage: number;

    // Queue metrics
    queueWaitTime: number;
    queueLength: number;

    // Success/failure
    success: boolean;
    errorCode?: string;
    retryAttempt?: number;
}

/**
 * Performance trend analysis
 */
export interface PerformanceTrend {
    metric: string;
    timeRange: {
        start: Date;
        end: Date;
    };
    trend: 'improving' | 'degrading' | 'stable';
    changePercentage: number;
    samples: number;
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Performance bottleneck identification
 */
export interface PerformanceBottleneck {
    component: 'validation' | 'database' | 'blockchain' | 'notification' | 'queue' | 'system';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string;
    recommendation: string;
    affectedOperations: number;
    averageDelay: number;
    detectedAt: Date;
}

/**
 * Performance optimization recommendation
 */
export interface PerformanceRecommendation {
    id: string;
    category: 'database' | 'blockchain' | 'system' | 'architecture' | 'configuration';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
    expectedImprovement: string;
    implementationEffort: 'low' | 'medium' | 'high';
    basedOnMetrics: string[];
    generatedAt: Date;
}

/**
 * Comprehensive performance report
 */
export interface CompletionPerformanceReport {
    reportId: string;
    generatedAt: Date;
    timeRange: {
        start: Date;
        end: Date;
    };
    metrics: CompletionPerformanceMetrics;
    trends: PerformanceTrend[];
    bottlenecks: PerformanceBottleneck[];
    recommendations: PerformanceRecommendation[];
    summary: {
        overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
        keyFindings: string[];
        criticalIssues: number;
        improvementOpportunities: number;
    };
}

/**
 * Service for monitoring and analyzing completion operation performance
 */
export class CompletionPerformanceMonitoringService {
    private static instance: CompletionPerformanceMonitoringService;
    private performanceSamples: PerformanceSample[] = [];
    private monitoringService: SwapCompletionMonitoringService;
    private readonly maxSamplesToStore = 100000;
    private performanceInterval: NodeJS.Timeout | null = null;

    private constructor() {
        this.monitoringService = SwapCompletionMonitoringService.getInstance();
        this.startPerformanceMonitoring();
    }

    public static getInstance(): CompletionPerformanceMonitoringService {
        if (!CompletionPerformanceMonitoringService.instance) {
            CompletionPerformanceMonitoringService.instance = new CompletionPerformanceMonitoringService();
        }
        return CompletionPerformanceMonitoringService.instance;
    }

    /**
     * Record performance sample for a completion operation
     */
    recordPerformanceSample(sample: PerformanceSample): void {
        this.performanceSamples.push(sample);

        // Maintain storage limit
        if (this.performanceSamples.length > this.maxSamplesToStore) {
            this.performanceSamples.shift();
        }

        // Log slow operations
        if (sample.totalDuration > 30000) { // 30 seconds
            enhancedLogger.warn('Slow completion operation detected', {
                completionId: sample.completionId,
                operationType: sample.operationType,
                totalDuration: sample.totalDuration,
                validationDuration: sample.validationDuration,
                databaseDuration: sample.databaseDuration,
                blockchainDuration: sample.blockchainDuration,
                success: sample.success
            });
        }

        // Detect immediate performance issues
        this.detectImmediateIssues(sample);
    }

    /**
     * Get current performance metrics
     */
    getCurrentPerformanceMetrics(
        timeWindow: number = 60 * 60 * 1000 // Last hour
    ): CompletionPerformanceMetrics {
        const now = new Date();
        const windowStart = new Date(now.getTime() - timeWindow);

        const recentSamples = this.performanceSamples.filter(
            sample => sample.timestamp >= windowStart
        );

        if (recentSamples.length === 0) {
            return this.getEmptyMetrics();
        }

        const successfulSamples = recentSamples.filter(sample => sample.success);
        const completionTimes = successfulSamples.map(sample => sample.totalDuration);
        const dbTimes = recentSamples.map(sample => sample.databaseDuration);
        const blockchainTimes = recentSamples
            .filter(sample => sample.blockchainDuration > 0)
            .map(sample => sample.blockchainDuration);

        // Calculate throughput
        const timeWindowHours = timeWindow / (1000 * 60 * 60);
        const completionsPerHour = recentSamples.length / timeWindowHours;
        const completionsPerMinute = completionsPerHour / 60;
        const completionsPerSecond = completionsPerMinute / 60;

        // Calculate percentiles
        const sortedTimes = [...completionTimes].sort((a, b) => a - b);
        const p50 = this.getPercentile(sortedTimes, 50);
        const p95 = this.getPercentile(sortedTimes, 95);
        const p99 = this.getPercentile(sortedTimes, 99);

        // Calculate resource usage
        const cpuUsages = recentSamples.map(sample => sample.cpuUsage);
        const memoryUsages = recentSamples.map(sample => sample.memoryUsage);

        // Calculate queue metrics
        const queueWaitTimes = recentSamples.map(sample => sample.queueWaitTime);
        const queueLengths = recentSamples.map(sample => sample.queueLength);

        return {
            completionsPerSecond,
            completionsPerMinute,
            completionsPerHour,
            peakThroughput: this.calculatePeakThroughput(recentSamples),

            p50CompletionTime: p50,
            p95CompletionTime: p95,
            p99CompletionTime: p99,
            maxCompletionTime: Math.max(...completionTimes, 0),
            minCompletionTime: Math.min(...completionTimes, 0),

            averageCpuUsage: this.average(cpuUsages),
            averageMemoryUsage: this.average(memoryUsages),
            peakCpuUsage: Math.max(...cpuUsages, 0),
            peakMemoryUsage: Math.max(...memoryUsages, 0),

            averageDbQueryTime: this.average(dbTimes),
            maxDbQueryTime: Math.max(...dbTimes, 0),
            dbConnectionPoolUtilization: this.calculateDbPoolUtilization(),
            dbTransactionCount: recentSamples.length,
            dbTransactionFailureRate: this.calculateFailureRate(recentSamples, 'database'),

            averageBlockchainConfirmationTime: this.average(blockchainTimes),
            maxBlockchainConfirmationTime: Math.max(...blockchainTimes, 0),
            blockchainTransactionCount: blockchainTimes.length,
            blockchainFailureRate: this.calculateFailureRate(recentSamples, 'blockchain'),

            averageQueueWaitTime: this.average(queueWaitTimes),
            maxQueueWaitTime: Math.max(...queueWaitTimes, 0),
            queueLength: queueLengths.length > 0 ? queueLengths[queueLengths.length - 1] : 0,
            maxQueueLength: Math.max(...queueLengths, 0),

            errorRate: recentSamples.length > 0 ? ((recentSamples.length - successfulSamples.length) / recentSamples.length) * 100 : 0,
            timeoutRate: this.calculateTimeoutRate(recentSamples),
            rollbackRate: this.calculateRollbackRate(recentSamples),
            retryRate: this.calculateRetryRate(recentSamples)
        };
    }

    /**
     * Analyze performance trends
     */
    analyzePerformanceTrends(
        timeRange: number = 24 * 60 * 60 * 1000 // Last 24 hours
    ): PerformanceTrend[] {
        const now = new Date();
        const start = new Date(now.getTime() - timeRange);

        const samples = this.performanceSamples.filter(
            sample => sample.timestamp >= start
        );

        if (samples.length < 10) {
            return []; // Not enough data for trend analysis
        }

        const trends: PerformanceTrend[] = [];

        // Analyze completion time trend
        trends.push(this.analyzeTrend('completion_time', samples, start, now,
            sample => sample.totalDuration));

        // Analyze throughput trend
        trends.push(this.analyzeThroughputTrend(samples, start, now));

        // Analyze error rate trend
        trends.push(this.analyzeErrorRateTrend(samples, start, now));

        // Analyze resource usage trends
        trends.push(this.analyzeTrend('cpu_usage', samples, start, now,
            sample => sample.cpuUsage));

        trends.push(this.analyzeTrend('memory_usage', samples, start, now,
            sample => sample.memoryUsage));

        return trends;
    }

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks(
        timeWindow: number = 60 * 60 * 1000 // Last hour
    ): PerformanceBottleneck[] {
        const now = new Date();
        const windowStart = new Date(now.getTime() - timeWindow);

        const recentSamples = this.performanceSamples.filter(
            sample => sample.timestamp >= windowStart
        );

        const bottlenecks: PerformanceBottleneck[] = [];

        // Check database bottlenecks
        const avgDbTime = this.average(recentSamples.map(s => s.databaseDuration));
        if (avgDbTime > 5000) { // 5 seconds
            bottlenecks.push({
                component: 'database',
                severity: avgDbTime > 15000 ? 'critical' : avgDbTime > 10000 ? 'high' : 'medium',
                description: `Database operations are taking an average of ${(avgDbTime / 1000).toFixed(1)} seconds`,
                impact: 'Slow completion times and potential timeouts',
                recommendation: 'Optimize database queries, check indexes, consider connection pool tuning',
                affectedOperations: recentSamples.length,
                averageDelay: avgDbTime,
                detectedAt: now
            });
        }

        // Check blockchain bottlenecks
        const blockchainSamples = recentSamples.filter(s => s.blockchainDuration > 0);
        if (blockchainSamples.length > 0) {
            const avgBlockchainTime = this.average(blockchainSamples.map(s => s.blockchainDuration));
            if (avgBlockchainTime > 10000) { // 10 seconds
                bottlenecks.push({
                    component: 'blockchain',
                    severity: avgBlockchainTime > 30000 ? 'critical' : avgBlockchainTime > 20000 ? 'high' : 'medium',
                    description: `Blockchain operations are taking an average of ${(avgBlockchainTime / 1000).toFixed(1)} seconds`,
                    impact: 'Delayed completion confirmations and potential rollbacks',
                    recommendation: 'Check blockchain network status, implement better retry logic, consider transaction batching',
                    affectedOperations: blockchainSamples.length,
                    averageDelay: avgBlockchainTime,
                    detectedAt: now
                });
            }
        }

        // Check queue bottlenecks
        const avgQueueWait = this.average(recentSamples.map(s => s.queueWaitTime));
        if (avgQueueWait > 2000) { // 2 seconds
            bottlenecks.push({
                component: 'queue',
                severity: avgQueueWait > 10000 ? 'critical' : avgQueueWait > 5000 ? 'high' : 'medium',
                description: `Operations are waiting an average of ${(avgQueueWait / 1000).toFixed(1)} seconds in queue`,
                impact: 'Increased completion times and user wait times',
                recommendation: 'Scale processing capacity, optimize queue processing, implement priority queuing',
                affectedOperations: recentSamples.length,
                averageDelay: avgQueueWait,
                detectedAt: now
            });
        }

        // Check system resource bottlenecks
        const avgCpuUsage = this.average(recentSamples.map(s => s.cpuUsage));
        if (avgCpuUsage > 80) {
            bottlenecks.push({
                component: 'system',
                severity: avgCpuUsage > 95 ? 'critical' : avgCpuUsage > 90 ? 'high' : 'medium',
                description: `High CPU usage averaging ${avgCpuUsage.toFixed(1)}%`,
                impact: 'Slow processing and potential system instability',
                recommendation: 'Scale compute resources, optimize algorithms, implement load balancing',
                affectedOperations: recentSamples.length,
                averageDelay: 0,
                detectedAt: now
            });
        }

        const avgMemoryUsage = this.average(recentSamples.map(s => s.memoryUsage));
        if (avgMemoryUsage > 85) {
            bottlenecks.push({
                component: 'system',
                severity: avgMemoryUsage > 95 ? 'critical' : avgMemoryUsage > 90 ? 'high' : 'medium',
                description: `High memory usage averaging ${avgMemoryUsage.toFixed(1)}%`,
                impact: 'Potential memory leaks and system instability',
                recommendation: 'Investigate memory leaks, optimize data structures, increase available memory',
                affectedOperations: recentSamples.length,
                averageDelay: 0,
                detectedAt: now
            });
        }

        return bottlenecks;
    }

    /**
     * Generate performance recommendations
     */
    generateRecommendations(
        metrics: CompletionPerformanceMetrics,
        bottlenecks: PerformanceBottleneck[]
    ): PerformanceRecommendation[] {
        const recommendations: PerformanceRecommendation[] = [];

        // Database optimization recommendations
        if (metrics.averageDbQueryTime > 3000) {
            recommendations.push({
                id: this.generateId(),
                category: 'database',
                priority: metrics.averageDbQueryTime > 10000 ? 'critical' : 'high',
                title: 'Optimize Database Performance',
                description: 'Database queries are taking longer than optimal. Consider query optimization, indexing, and connection pool tuning.',
                expectedImprovement: 'Reduce completion times by 20-40%',
                implementationEffort: 'medium',
                basedOnMetrics: ['averageDbQueryTime', 'dbTransactionFailureRate'],
                generatedAt: new Date()
            });
        }

        // Blockchain optimization recommendations
        if (metrics.blockchainFailureRate > 5) {
            recommendations.push({
                id: this.generateId(),
                category: 'blockchain',
                priority: 'high',
                title: 'Improve Blockchain Reliability',
                description: 'High blockchain failure rate detected. Implement better retry logic and error handling.',
                expectedImprovement: 'Reduce rollback rate by 30-50%',
                implementationEffort: 'medium',
                basedOnMetrics: ['blockchainFailureRate', 'rollbackRate'],
                generatedAt: new Date()
            });
        }

        // Throughput optimization recommendations
        if (metrics.completionsPerSecond < 1 && metrics.queueLength > 10) {
            recommendations.push({
                id: this.generateId(),
                category: 'architecture',
                priority: 'high',
                title: 'Scale Processing Capacity',
                description: 'Low throughput with high queue length indicates need for horizontal scaling.',
                expectedImprovement: 'Increase throughput by 2-5x',
                implementationEffort: 'high',
                basedOnMetrics: ['completionsPerSecond', 'queueLength', 'averageQueueWaitTime'],
                generatedAt: new Date()
            });
        }

        // System resource recommendations
        if (metrics.peakCpuUsage > 90 || metrics.peakMemoryUsage > 90) {
            recommendations.push({
                id: this.generateId(),
                category: 'system',
                priority: 'medium',
                title: 'Optimize Resource Usage',
                description: 'High resource utilization detected. Consider code optimization and resource scaling.',
                expectedImprovement: 'Improve system stability and response times',
                implementationEffort: 'medium',
                basedOnMetrics: ['peakCpuUsage', 'peakMemoryUsage'],
                generatedAt: new Date()
            });
        }

        // Configuration recommendations
        if (metrics.p95CompletionTime > 20000) { // 20 seconds
            recommendations.push({
                id: this.generateId(),
                category: 'configuration',
                priority: 'medium',
                title: 'Tune Timeout Settings',
                description: 'Long completion times suggest timeout settings may need adjustment.',
                expectedImprovement: 'Reduce timeout-related failures',
                implementationEffort: 'low',
                basedOnMetrics: ['p95CompletionTime', 'timeoutRate'],
                generatedAt: new Date()
            });
        }

        return recommendations;
    }

    /**
     * Generate comprehensive performance report
     */
    generatePerformanceReport(
        timeRange: number = 24 * 60 * 60 * 1000 // Last 24 hours
    ): CompletionPerformanceReport {
        const now = new Date();
        const start = new Date(now.getTime() - timeRange);

        const metrics = this.getCurrentPerformanceMetrics(timeRange);
        const trends = this.analyzePerformanceTrends(timeRange);
        const bottlenecks = this.identifyBottlenecks(timeRange);
        const recommendations = this.generateRecommendations(metrics, bottlenecks);

        // Determine overall health
        const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
        const highBottlenecks = bottlenecks.filter(b => b.severity === 'high').length;

        let overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
        if (criticalBottlenecks > 0) {
            overallHealth = 'poor';
        } else if (highBottlenecks > 2 || metrics.errorRate > 10) {
            overallHealth = 'fair';
        } else if (highBottlenecks > 0 || metrics.errorRate > 5) {
            overallHealth = 'good';
        } else {
            overallHealth = 'excellent';
        }

        // Generate key findings
        const keyFindings: string[] = [];
        if (metrics.completionsPerHour > 0) {
            keyFindings.push(`Processing ${metrics.completionsPerHour.toFixed(0)} completions per hour`);
        }
        if (metrics.p95CompletionTime > 0) {
            keyFindings.push(`95th percentile completion time: ${(metrics.p95CompletionTime / 1000).toFixed(1)}s`);
        }
        if (metrics.errorRate > 0) {
            keyFindings.push(`Error rate: ${metrics.errorRate.toFixed(1)}%`);
        }
        if (bottlenecks.length > 0) {
            keyFindings.push(`${bottlenecks.length} performance bottleneck(s) identified`);
        }

        return {
            reportId: this.generateId(),
            generatedAt: now,
            timeRange: { start, end: now },
            metrics,
            trends,
            bottlenecks,
            recommendations,
            summary: {
                overallHealth,
                keyFindings,
                criticalIssues: criticalBottlenecks,
                improvementOpportunities: recommendations.length
            }
        };
    }

    /**
     * Get performance samples for analysis
     */
    getPerformanceSamples(
        startDate?: Date,
        endDate?: Date,
        operationType?: 'booking_exchange' | 'cash_payment',
        limit: number = 1000
    ): PerformanceSample[] {
        let samples = [...this.performanceSamples];

        if (startDate) {
            samples = samples.filter(sample => sample.timestamp >= startDate);
        }

        if (endDate) {
            samples = samples.filter(sample => sample.timestamp <= endDate);
        }

        if (operationType) {
            samples = samples.filter(sample => sample.operationType === operationType);
        }

        return samples
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, limit);
    }

    /**
     * Clear old performance samples
     */
    clearOldSamples(olderThan: Date): number {
        const initialCount = this.performanceSamples.length;
        this.performanceSamples = this.performanceSamples.filter(
            sample => sample.timestamp >= olderThan
        );
        const clearedCount = initialCount - this.performanceSamples.length;

        enhancedLogger.info('Old performance samples cleared', {
            clearedCount,
            remainingCount: this.performanceSamples.length,
            cutoffDate: olderThan.toISOString()
        });

        return clearedCount;
    }

    /**
     * Start performance monitoring
     */
    private startPerformanceMonitoring(): void {
        // Collect system metrics every 30 seconds
        this.performanceInterval = setInterval(() => {
            this.collectSystemMetrics();

            // Clean up old samples (keep 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            this.clearOldSamples(sevenDaysAgo);
        }, 30 * 1000);
    }

    /**
     * Collect system metrics
     */
    private collectSystemMetrics(): void {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        // Create a system health sample
        const sample: PerformanceSample = {
            timestamp: new Date(),
            operationType: 'booking_exchange', // Default
            totalDuration: 0,
            validationDuration: 0,
            databaseDuration: 0,
            blockchainDuration: 0,
            notificationDuration: 0,
            cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage approximation
            memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
            queueWaitTime: 0,
            queueLength: 0,
            success: true
        };

        // Don't store system samples in main array, just use for monitoring
        this.detectSystemIssues(sample);
    }

    /**
     * Detect immediate performance issues
     */
    private detectImmediateIssues(sample: PerformanceSample): void {
        // Detect slow operations
        if (sample.totalDuration > 60000) { // 1 minute
            enhancedLogger.error('Extremely slow completion operation', {
                completionId: sample.completionId,
                totalDuration: sample.totalDuration,
                operationType: sample.operationType
            });
        }

        // Detect database issues
        if (sample.databaseDuration > 30000) { // 30 seconds
            enhancedLogger.warn('Slow database operation detected', {
                completionId: sample.completionId,
                databaseDuration: sample.databaseDuration
            });
        }

        // Detect blockchain issues
        if (sample.blockchainDuration > 45000) { // 45 seconds
            enhancedLogger.warn('Slow blockchain operation detected', {
                completionId: sample.completionId,
                blockchainDuration: sample.blockchainDuration
            });
        }
    }

    /**
     * Detect system-level issues
     */
    private detectSystemIssues(sample: PerformanceSample): void {
        if (sample.cpuUsage > 95) {
            enhancedLogger.error('Critical CPU usage detected', {
                cpuUsage: sample.cpuUsage
            });
        }

        if (sample.memoryUsage > 95) {
            enhancedLogger.error('Critical memory usage detected', {
                memoryUsage: sample.memoryUsage
            });
        }
    }

    // Utility methods

    private getEmptyMetrics(): CompletionPerformanceMetrics {
        return {
            completionsPerSecond: 0,
            completionsPerMinute: 0,
            completionsPerHour: 0,
            peakThroughput: 0,
            p50CompletionTime: 0,
            p95CompletionTime: 0,
            p99CompletionTime: 0,
            maxCompletionTime: 0,
            minCompletionTime: 0,
            averageCpuUsage: 0,
            averageMemoryUsage: 0,
            peakCpuUsage: 0,
            peakMemoryUsage: 0,
            averageDbQueryTime: 0,
            maxDbQueryTime: 0,
            dbConnectionPoolUtilization: 0,
            dbTransactionCount: 0,
            dbTransactionFailureRate: 0,
            averageBlockchainConfirmationTime: 0,
            maxBlockchainConfirmationTime: 0,
            blockchainTransactionCount: 0,
            blockchainFailureRate: 0,
            averageQueueWaitTime: 0,
            maxQueueWaitTime: 0,
            queueLength: 0,
            maxQueueLength: 0,
            errorRate: 0,
            timeoutRate: 0,
            rollbackRate: 0,
            retryRate: 0
        };
    }

    private getPercentile(sortedArray: number[], percentile: number): number {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }

    private average(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    private calculatePeakThroughput(samples: PerformanceSample[]): number {
        // Calculate peak throughput in 5-minute windows
        const windowSize = 5 * 60 * 1000; // 5 minutes
        let maxThroughput = 0;

        for (let i = 0; i < samples.length; i++) {
            const windowStart = samples[i].timestamp.getTime();
            const windowEnd = windowStart + windowSize;

            const windowSamples = samples.filter(
                sample => sample.timestamp.getTime() >= windowStart &&
                    sample.timestamp.getTime() < windowEnd
            );

            const throughput = windowSamples.length / (windowSize / (1000 * 60 * 60)); // per hour
            maxThroughput = Math.max(maxThroughput, throughput);
        }

        return maxThroughput;
    }

    private calculateDbPoolUtilization(): number {
        // This would integrate with actual database connection pool metrics
        // For now, return a placeholder
        return 0;
    }

    private calculateFailureRate(samples: PerformanceSample[], component: string): number {
        const failures = samples.filter(sample =>
            !sample.success && sample.errorCode?.includes(component)
        ).length;
        return samples.length > 0 ? (failures / samples.length) * 100 : 0;
    }

    private calculateTimeoutRate(samples: PerformanceSample[]): number {
        const timeouts = samples.filter(sample =>
            sample.errorCode?.includes('TIMEOUT')
        ).length;
        return samples.length > 0 ? (timeouts / samples.length) * 100 : 0;
    }

    private calculateRollbackRate(samples: PerformanceSample[]): number {
        const rollbacks = samples.filter(sample =>
            sample.errorCode?.includes('ROLLBACK')
        ).length;
        return samples.length > 0 ? (rollbacks / samples.length) * 100 : 0;
    }

    private calculateRetryRate(samples: PerformanceSample[]): number {
        const retries = samples.filter(sample =>
            sample.retryAttempt && sample.retryAttempt > 1
        ).length;
        return samples.length > 0 ? (retries / samples.length) * 100 : 0;
    }

    private analyzeTrend(
        metricName: string,
        samples: PerformanceSample[],
        start: Date,
        end: Date,
        valueExtractor: (sample: PerformanceSample) => number
    ): PerformanceTrend {
        const values = samples.map(valueExtractor);
        const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;

        const firstHalf = samples.filter(s => s.timestamp.getTime() < midpoint);
        const secondHalf = samples.filter(s => s.timestamp.getTime() >= midpoint);

        const firstHalfAvg = this.average(firstHalf.map(valueExtractor));
        const secondHalfAvg = this.average(secondHalf.map(valueExtractor));

        const changePercentage = firstHalfAvg > 0
            ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
            : 0;

        let trend: 'improving' | 'degrading' | 'stable';
        if (Math.abs(changePercentage) < 5) {
            trend = 'stable';
        } else if (metricName.includes('time') || metricName.includes('usage')) {
            // For time and usage metrics, lower is better
            trend = changePercentage < 0 ? 'improving' : 'degrading';
        } else {
            // For throughput metrics, higher is better
            trend = changePercentage > 0 ? 'improving' : 'degrading';
        }

        return {
            metric: metricName,
            timeRange: { start, end },
            trend,
            changePercentage: Math.abs(changePercentage),
            samples: samples.length,
            confidence: samples.length > 100 ? 'high' : samples.length > 50 ? 'medium' : 'low'
        };
    }

    private analyzeThroughputTrend(
        samples: PerformanceSample[],
        start: Date,
        end: Date
    ): PerformanceTrend {
        // Analyze throughput trend by comparing first and second half
        const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;

        const firstHalf = samples.filter(s => s.timestamp.getTime() < midpoint);
        const secondHalf = samples.filter(s => s.timestamp.getTime() >= midpoint);

        const firstHalfThroughput = firstHalf.length / ((midpoint - start.getTime()) / (1000 * 60 * 60));
        const secondHalfThroughput = secondHalf.length / ((end.getTime() - midpoint) / (1000 * 60 * 60));

        const changePercentage = firstHalfThroughput > 0
            ? ((secondHalfThroughput - firstHalfThroughput) / firstHalfThroughput) * 100
            : 0;

        return {
            metric: 'throughput',
            timeRange: { start, end },
            trend: Math.abs(changePercentage) < 5 ? 'stable' :
                changePercentage > 0 ? 'improving' : 'degrading',
            changePercentage: Math.abs(changePercentage),
            samples: samples.length,
            confidence: samples.length > 100 ? 'high' : samples.length > 50 ? 'medium' : 'low'
        };
    }

    private analyzeErrorRateTrend(
        samples: PerformanceSample[],
        start: Date,
        end: Date
    ): PerformanceTrend {
        const midpoint = start.getTime() + (end.getTime() - start.getTime()) / 2;

        const firstHalf = samples.filter(s => s.timestamp.getTime() < midpoint);
        const secondHalf = samples.filter(s => s.timestamp.getTime() >= midpoint);

        const firstHalfErrorRate = firstHalf.length > 0
            ? (firstHalf.filter(s => !s.success).length / firstHalf.length) * 100
            : 0;
        const secondHalfErrorRate = secondHalf.length > 0
            ? (secondHalf.filter(s => !s.success).length / secondHalf.length) * 100
            : 0;

        const changePercentage = firstHalfErrorRate > 0
            ? ((secondHalfErrorRate - firstHalfErrorRate) / firstHalfErrorRate) * 100
            : 0;

        return {
            metric: 'error_rate',
            timeRange: { start, end },
            trend: Math.abs(changePercentage) < 5 ? 'stable' :
                changePercentage < 0 ? 'improving' : 'degrading',
            changePercentage: Math.abs(changePercentage),
            samples: samples.length,
            confidence: samples.length > 100 ? 'high' : samples.length > 50 ? 'medium' : 'low'
        };
    }

    private generateId(): string {
        return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cleanup method
     */
    destroy(): void {
        if (this.performanceInterval) {
            clearInterval(this.performanceInterval);
            this.performanceInterval = null;
        }
    }
}