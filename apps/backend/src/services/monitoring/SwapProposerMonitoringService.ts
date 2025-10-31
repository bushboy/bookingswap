import { logger } from '../../utils/logger';
import { HealthMonitor } from '../../utils/monitoring';

/**
 * Monitoring service for swap proposer name resolution and JOIN chain health
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export class SwapProposerMonitoringService {
    private static instance: SwapProposerMonitoringService;
    private joinChainStats: Map<string, JoinChainStats> = new Map();
    private proposerLookupStats: Map<string, ProposerLookupStats> = new Map();
    private readonly STATS_WINDOW_MS = 300000; // 5 minutes
    private readonly SUCCESS_RATE_THRESHOLD = 0.85; // 85% success rate threshold
    private readonly CRITICAL_FAILURE_THRESHOLD = 0.5; // 50% failure rate is critical

    private constructor() {
        this.initializeHealthChecks();
        this.startPeriodicReporting();
    }

    public static getInstance(): SwapProposerMonitoringService {
        if (!SwapProposerMonitoringService.instance) {
            SwapProposerMonitoringService.instance = new SwapProposerMonitoringService();
        }
        return SwapProposerMonitoringService.instance;
    }

    /**
     * Record JOIN chain failure detection and logging
     * Requirements: 3.1, 3.2
     */
    recordJoinChainFailure(
        userId: string,
        swapId: string,
        failureType: JoinChainFailureType,
        details: JoinChainFailureDetails
    ): void {
        const timestamp = Date.now();
        const statsKey = this.getStatsKey(userId, timestamp);

        // Get or create stats for this window
        let stats = this.joinChainStats.get(statsKey);
        if (!stats) {
            stats = {
                userId,
                windowStart: timestamp,
                totalQueries: 0,
                successfulJoins: 0,
                failedJoins: 0,
                failuresByType: new Map(),
                nullProposerNames: 0,
                missingUserRelationships: 0
            };
            this.joinChainStats.set(statsKey, stats);
        }

        // Update statistics
        stats.totalQueries++;
        stats.failedJoins++;

        const currentFailureCount = stats.failuresByType.get(failureType) || 0;
        stats.failuresByType.set(failureType, currentFailureCount + 1);

        if (failureType === 'null_proposer_name') {
            stats.nullProposerNames++;
        }

        if (failureType === 'missing_user_relationship') {
            stats.missingUserRelationships++;
        }

        // Log the specific failure with diagnostic information
        logger.error('JOIN chain failure detected', {
            category: 'join_chain_failure',
            userId,
            swapId,
            failureType,
            details,
            requirement: '3.1',
            timestamp: new Date(timestamp).toISOString(),
            diagnosticInfo: this.generateDiagnosticInfo(failureType, details)
        });

        // Check if failure rate is critical and alert
        this.checkCriticalFailureRate(userId, stats);
    }

    /**
     * Record successful JOIN chain completion
     * Requirements: 3.1, 3.2
     */
    recordJoinChainSuccess(userId: string, swapId: string, proposerName: string): void {
        const timestamp = Date.now();
        const statsKey = this.getStatsKey(userId, timestamp);

        // Get or create stats for this window
        let stats = this.joinChainStats.get(statsKey);
        if (!stats) {
            stats = {
                userId,
                windowStart: timestamp,
                totalQueries: 0,
                successfulJoins: 0,
                failedJoins: 0,
                failuresByType: new Map(),
                nullProposerNames: 0,
                missingUserRelationships: 0
            };
            this.joinChainStats.set(statsKey, stats);
        }

        // Update statistics
        stats.totalQueries++;
        stats.successfulJoins++;

        logger.debug('JOIN chain success recorded', {
            category: 'join_chain_success',
            userId,
            swapId,
            proposerName,
            requirement: '3.1',
            timestamp: new Date(timestamp).toISOString()
        });
    }

    /**
     * Record proposer lookup attempt and result
     * Requirements: 3.3, 3.4
     */
    recordProposerLookupAttempt(
        swapId: string,
        proposerId: string,
        lookupMethod: ProposerLookupMethod,
        success: boolean,
        proposerName?: string,
        error?: string
    ): void {
        const timestamp = Date.now();
        const statsKey = this.getStatsKey(proposerId, timestamp);

        // Get or create stats for this window
        let stats = this.proposerLookupStats.get(statsKey);
        if (!stats) {
            stats = {
                proposerId,
                windowStart: timestamp,
                totalAttempts: 0,
                successfulLookups: 0,
                failedLookups: 0,
                lookupMethodStats: new Map(),
                averageResponseTime: 0,
                lastSuccessfulLookup: null
            };
            this.proposerLookupStats.set(statsKey, stats);
        }

        // Update statistics
        stats.totalAttempts++;

        if (success) {
            stats.successfulLookups++;
            stats.lastSuccessfulLookup = timestamp;
        } else {
            stats.failedLookups++;
        }

        // Update method-specific stats
        const methodStats = stats.lookupMethodStats.get(lookupMethod) || {
            attempts: 0,
            successes: 0,
            failures: 0
        };
        methodStats.attempts++;
        if (success) {
            methodStats.successes++;
        } else {
            methodStats.failures++;
        }
        stats.lookupMethodStats.set(lookupMethod, methodStats);

        // Log the lookup attempt
        if (success) {
            logger.info('Proposer lookup successful', {
                category: 'proposer_lookup_success',
                swapId,
                proposerId,
                lookupMethod,
                proposerName,
                requirement: '3.3',
                timestamp: new Date(timestamp).toISOString()
            });
        } else {
            logger.warn('Proposer lookup failed', {
                category: 'proposer_lookup_failure',
                swapId,
                proposerId,
                lookupMethod,
                error,
                requirement: '3.4',
                timestamp: new Date(timestamp).toISOString()
            });
        }

        // Check success rate and alert if below threshold
        this.checkProposerLookupSuccessRate(proposerId, stats);
    }

    /**
     * Add diagnostic information for missing user relationships
     * Requirements: 3.2, 3.3
     */
    recordMissingUserRelationship(
        swapId: string,
        proposerId: string,
        relationshipType: 'booking_user' | 'swap_target' | 'user_record',
        diagnosticDetails: MissingRelationshipDiagnostics
    ): void {
        logger.error('Missing user relationship detected', {
            category: 'missing_user_relationship',
            swapId,
            proposerId,
            relationshipType,
            diagnosticDetails,
            requirement: '3.2',
            timestamp: new Date().toISOString(),
            actionRequired: this.generateActionRequired(relationshipType, diagnosticDetails)
        });

        // Record in JOIN chain failure stats
        this.recordJoinChainFailure(proposerId, swapId, 'missing_user_relationship', {
            relationshipType,
            diagnosticDetails
        });
    }

    /**
     * Get proposer lookup success/failure rates for monitoring
     * Requirements: 3.4
     */
    getProposerLookupSuccessRates(timeWindowMs: number = this.STATS_WINDOW_MS): ProposerLookupSummary[] {
        const cutoffTime = Date.now() - timeWindowMs;
        const summaries: ProposerLookupSummary[] = [];

        for (const [statsKey, stats] of this.proposerLookupStats.entries()) {
            if (stats.windowStart >= cutoffTime) {
                const successRate = stats.totalAttempts > 0
                    ? stats.successfulLookups / stats.totalAttempts
                    : 0;

                const methodSummaries: MethodSuccessRate[] = [];
                for (const [method, methodStats] of stats.lookupMethodStats.entries()) {
                    methodSummaries.push({
                        method,
                        attempts: methodStats.attempts,
                        successes: methodStats.successes,
                        failures: methodStats.failures,
                        successRate: methodStats.attempts > 0 ? methodStats.successes / methodStats.attempts : 0
                    });
                }

                summaries.push({
                    proposerId: stats.proposerId,
                    windowStart: stats.windowStart,
                    totalAttempts: stats.totalAttempts,
                    successfulLookups: stats.successfulLookups,
                    failedLookups: stats.failedLookups,
                    successRate,
                    methodBreakdown: methodSummaries,
                    lastSuccessfulLookup: stats.lastSuccessfulLookup
                });
            }
        }

        return summaries;
    }

    /**
     * Get JOIN chain health statistics
     * Requirements: 3.1, 3.2
     */
    getJoinChainHealthStats(timeWindowMs: number = this.STATS_WINDOW_MS): JoinChainHealthSummary[] {
        const cutoffTime = Date.now() - timeWindowMs;
        const summaries: JoinChainHealthSummary[] = [];

        for (const [statsKey, stats] of this.joinChainStats.entries()) {
            if (stats.windowStart >= cutoffTime) {
                const successRate = stats.totalQueries > 0
                    ? stats.successfulJoins / stats.totalQueries
                    : 0;

                const failureBreakdown: FailureTypeBreakdown[] = [];
                for (const [failureType, count] of stats.failuresByType.entries()) {
                    failureBreakdown.push({
                        failureType,
                        count,
                        percentage: stats.totalQueries > 0 ? (count / stats.totalQueries) * 100 : 0
                    });
                }

                summaries.push({
                    userId: stats.userId,
                    windowStart: stats.windowStart,
                    totalQueries: stats.totalQueries,
                    successfulJoins: stats.successfulJoins,
                    failedJoins: stats.failedJoins,
                    successRate,
                    nullProposerNames: stats.nullProposerNames,
                    missingUserRelationships: stats.missingUserRelationships,
                    failureBreakdown
                });
            }
        }

        return summaries;
    }

    /**
     * Generate comprehensive diagnostic report
     * Requirements: 3.1, 3.2, 3.3, 3.4
     */
    generateDiagnosticReport(): SwapProposerDiagnosticReport {
        const joinChainStats = this.getJoinChainHealthStats();
        const proposerLookupStats = this.getProposerLookupSuccessRates();

        // Calculate overall health metrics
        const overallJoinSuccessRate = this.calculateOverallSuccessRate(
            joinChainStats.map(s => ({ successes: s.successfulJoins, total: s.totalQueries }))
        );

        const overallProposerLookupSuccessRate = this.calculateOverallSuccessRate(
            proposerLookupStats.map(s => ({ successes: s.successfulLookups, total: s.totalAttempts }))
        );

        // Identify critical issues
        const criticalIssues: CriticalIssue[] = [];

        if (overallJoinSuccessRate < this.CRITICAL_FAILURE_THRESHOLD) {
            criticalIssues.push({
                type: 'critical_join_chain_failure',
                severity: 'critical',
                description: `JOIN chain success rate (${(overallJoinSuccessRate * 100).toFixed(2)}%) is below critical threshold`,
                affectedUsers: joinChainStats.filter(s => s.successRate < this.CRITICAL_FAILURE_THRESHOLD).length,
                recommendedAction: 'Investigate database schema integrity and relationship constraints'
            });
        }

        if (overallProposerLookupSuccessRate < this.CRITICAL_FAILURE_THRESHOLD) {
            criticalIssues.push({
                type: 'critical_proposer_lookup_failure',
                severity: 'critical',
                description: `Proposer lookup success rate (${(overallProposerLookupSuccessRate * 100).toFixed(2)}%) is below critical threshold`,
                affectedUsers: proposerLookupStats.filter(s => s.successRate < this.CRITICAL_FAILURE_THRESHOLD).length,
                recommendedAction: 'Check user data integrity and implement data repair procedures'
            });
        }

        return {
            timestamp: new Date().toISOString(),
            overallHealth: {
                joinChainSuccessRate: overallJoinSuccessRate,
                proposerLookupSuccessRate: overallProposerLookupSuccessRate,
                healthStatus: this.determineHealthStatus(overallJoinSuccessRate, overallProposerLookupSuccessRate)
            },
            joinChainStats,
            proposerLookupStats,
            criticalIssues,
            recommendations: this.generateRecommendations(joinChainStats, proposerLookupStats)
        };
    }

    /**
     * Private helper methods
     */
    private getStatsKey(identifier: string, timestamp: number): string {
        const windowStart = Math.floor(timestamp / this.STATS_WINDOW_MS) * this.STATS_WINDOW_MS;
        return `${identifier}_${windowStart}`;
    }

    private generateDiagnosticInfo(failureType: JoinChainFailureType, details: JoinChainFailureDetails): any {
        switch (failureType) {
            case 'missing_swap_target':
                return {
                    issue: 'swap_targets table missing active record',
                    checkQuery: 'SELECT * FROM swap_targets WHERE target_swap_id = ? AND status = \'active\'',
                    possibleCauses: ['Targeting relationship not created', 'Status incorrectly set', 'Record deleted']
                };
            case 'missing_target_booking':
                return {
                    issue: 'Target booking not found via JOIN chain',
                    checkQuery: 'SELECT * FROM bookings WHERE id = ?',
                    possibleCauses: ['Booking soft-deleted', 'Foreign key constraint violation', 'Data corruption']
                };
            case 'missing_user':
                return {
                    issue: 'User record not found',
                    checkQuery: 'SELECT * FROM users WHERE id = ?',
                    possibleCauses: ['User account deleted', 'User ID mismatch', 'Orphaned booking record']
                };
            case 'null_proposer_name':
                return {
                    issue: 'User exists but display_name is NULL',
                    checkQuery: 'SELECT id, display_name, email FROM users WHERE id = ?',
                    possibleCauses: ['Incomplete user profile', 'Data migration issue', 'User never set display name']
                };
            default:
                return { issue: 'Unknown failure type', details };
        }
    }

    private generateActionRequired(relationshipType: string, diagnostics: MissingRelationshipDiagnostics): string[] {
        const actions: string[] = [];

        switch (relationshipType) {
            case 'booking_user':
                actions.push('Verify booking.user_id foreign key constraint');
                actions.push('Check for orphaned booking records');
                break;
            case 'swap_target':
                actions.push('Verify swap_targets table integrity');
                actions.push('Check targeting relationship creation logic');
                break;
            case 'user_record':
                actions.push('Verify user account status');
                actions.push('Check user deletion/deactivation procedures');
                break;
        }

        return actions;
    }

    private checkCriticalFailureRate(userId: string, stats: JoinChainStats): void {
        const failureRate = stats.totalQueries > 0 ? stats.failedJoins / stats.totalQueries : 0;

        if (failureRate >= this.CRITICAL_FAILURE_THRESHOLD && stats.totalQueries >= 10) {
            logger.error('Critical JOIN chain failure rate detected', {
                category: 'critical_failure_rate',
                userId,
                failureRate: (failureRate * 100).toFixed(2) + '%',
                totalQueries: stats.totalQueries,
                failedJoins: stats.failedJoins,
                requirement: '3.2',
                alertLevel: 'critical'
            });
        }
    }

    private checkProposerLookupSuccessRate(proposerId: string, stats: ProposerLookupStats): void {
        const successRate = stats.totalAttempts > 0 ? stats.successfulLookups / stats.totalAttempts : 0;

        if (successRate < this.SUCCESS_RATE_THRESHOLD && stats.totalAttempts >= 5) {
            logger.warn('Low proposer lookup success rate detected', {
                category: 'low_success_rate',
                proposerId,
                successRate: (successRate * 100).toFixed(2) + '%',
                totalAttempts: stats.totalAttempts,
                successfulLookups: stats.successfulLookups,
                requirement: '3.4',
                alertLevel: 'warning'
            });
        }
    }

    private calculateOverallSuccessRate(stats: { successes: number; total: number }[]): number {
        const totalSuccesses = stats.reduce((sum, s) => sum + s.successes, 0);
        const totalAttempts = stats.reduce((sum, s) => sum + s.total, 0);
        return totalAttempts > 0 ? totalSuccesses / totalAttempts : 0;
    }

    private determineHealthStatus(joinChainRate: number, proposerLookupRate: number): 'healthy' | 'degraded' | 'critical' {
        const minRate = Math.min(joinChainRate, proposerLookupRate);

        if (minRate < this.CRITICAL_FAILURE_THRESHOLD) {
            return 'critical';
        } else if (minRate < this.SUCCESS_RATE_THRESHOLD) {
            return 'degraded';
        } else {
            return 'healthy';
        }
    }

    private generateRecommendations(
        joinChainStats: JoinChainHealthSummary[],
        proposerLookupStats: ProposerLookupSummary[]
    ): string[] {
        const recommendations: string[] = [];

        // Analyze JOIN chain issues
        const lowJoinSuccessUsers = joinChainStats.filter(s => s.successRate < this.SUCCESS_RATE_THRESHOLD);
        if (lowJoinSuccessUsers.length > 0) {
            recommendations.push('Review database schema relationships and foreign key constraints');
            recommendations.push('Implement data integrity checks for swap_targets and bookings tables');
        }

        // Analyze proposer lookup issues
        const lowLookupSuccessUsers = proposerLookupStats.filter(s => s.successRate < this.SUCCESS_RATE_THRESHOLD);
        if (lowLookupSuccessUsers.length > 0) {
            recommendations.push('Audit user profile completeness and implement data repair procedures');
            recommendations.push('Consider implementing user data validation on account creation');
        }

        return recommendations;
    }

    private initializeHealthChecks(): void {
        const healthMonitor = HealthMonitor.getInstance();

        healthMonitor.registerHealthCheck('swap_proposer_monitoring', async () => {
            const report = this.generateDiagnosticReport();
            const isHealthy = report.overallHealth.healthStatus === 'healthy';

            return {
                status: isHealthy ? 'healthy' : report.overallHealth.healthStatus === 'degraded' ? 'degraded' : 'unhealthy',
                lastCheck: new Date().toISOString(),
                responseTime: 0, // This would be measured in a real implementation
                error: isHealthy ? undefined : `JOIN chain success rate: ${(report.overallHealth.joinChainSuccessRate * 100).toFixed(2)}%, Proposer lookup success rate: ${(report.overallHealth.proposerLookupSuccessRate * 100).toFixed(2)}%`
            };
        });
    }

    private startPeriodicReporting(): void {
        // Report health statistics every 5 minutes
        setInterval(() => {
            const report = this.generateDiagnosticReport();

            logger.info('Periodic swap proposer monitoring report', {
                category: 'monitoring_report',
                overallHealth: report.overallHealth,
                criticalIssuesCount: report.criticalIssues.length,
                requirement: '3.4',
                timestamp: report.timestamp
            });

            // Clean up old statistics
            this.cleanupOldStats();
        }, this.STATS_WINDOW_MS);
    }

    private cleanupOldStats(): void {
        const cutoffTime = Date.now() - (this.STATS_WINDOW_MS * 6); // Keep 6 windows of data

        for (const [key, stats] of this.joinChainStats.entries()) {
            if (stats.windowStart < cutoffTime) {
                this.joinChainStats.delete(key);
            }
        }

        for (const [key, stats] of this.proposerLookupStats.entries()) {
            if (stats.windowStart < cutoffTime) {
                this.proposerLookupStats.delete(key);
            }
        }
    }
}

// Type definitions for monitoring data structures
export type JoinChainFailureType =
    | 'missing_swap_target'
    | 'missing_target_booking'
    | 'missing_user'
    | 'null_proposer_name'
    | 'missing_user_relationship';

export type ProposerLookupMethod =
    | 'direct'
    | 'booking_derived'
    | 'swap_target_derived'
    | 'fallback';

export interface JoinChainFailureDetails {
    relationshipType?: string;
    diagnosticDetails?: MissingRelationshipDiagnostics;
    [key: string]: any;
}

export interface MissingRelationshipDiagnostics {
    expectedTable: string;
    expectedId: string;
    actualResult: any;
    queryUsed: string;
}

export interface JoinChainStats {
    userId: string;
    windowStart: number;
    totalQueries: number;
    successfulJoins: number;
    failedJoins: number;
    failuresByType: Map<JoinChainFailureType, number>;
    nullProposerNames: number;
    missingUserRelationships: number;
}

export interface ProposerLookupStats {
    proposerId: string;
    windowStart: number;
    totalAttempts: number;
    successfulLookups: number;
    failedLookups: number;
    lookupMethodStats: Map<ProposerLookupMethod, {
        attempts: number;
        successes: number;
        failures: number;
    }>;
    averageResponseTime: number;
    lastSuccessfulLookup: number | null;
}

export interface ProposerLookupSummary {
    proposerId: string;
    windowStart: number;
    totalAttempts: number;
    successfulLookups: number;
    failedLookups: number;
    successRate: number;
    methodBreakdown: MethodSuccessRate[];
    lastSuccessfulLookup: number | null;
}

export interface MethodSuccessRate {
    method: ProposerLookupMethod;
    attempts: number;
    successes: number;
    failures: number;
    successRate: number;
}

export interface JoinChainHealthSummary {
    userId: string;
    windowStart: number;
    totalQueries: number;
    successfulJoins: number;
    failedJoins: number;
    successRate: number;
    nullProposerNames: number;
    missingUserRelationships: number;
    failureBreakdown: FailureTypeBreakdown[];
}

export interface FailureTypeBreakdown {
    failureType: JoinChainFailureType;
    count: number;
    percentage: number;
}

export interface CriticalIssue {
    type: string;
    severity: 'warning' | 'critical';
    description: string;
    affectedUsers: number;
    recommendedAction: string;
}

export interface SwapProposerDiagnosticReport {
    timestamp: string;
    overallHealth: {
        joinChainSuccessRate: number;
        proposerLookupSuccessRate: number;
        healthStatus: 'healthy' | 'degraded' | 'critical';
    };
    joinChainStats: JoinChainHealthSummary[];
    proposerLookupStats: ProposerLookupSummary[];
    criticalIssues: CriticalIssue[];
    recommendations: string[];
}