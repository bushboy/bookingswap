import { DatabaseIntegrityMonitor, IntegrityCheckResult } from '../monitoring/DatabaseIntegrityMonitor';
import { CriticalErrorAlertService } from '../alerting/CriticalErrorAlertService';
import { ForeignKeyValidationOptimizer, IndexVerificationResult } from '../../database/optimizations/ForeignKeyValidationOptimizer';
import { Pool } from 'pg';
import { getPool } from '../../database/config';
import { logger } from '../../utils/logger';

export interface StartupIntegrityResult {
    success: boolean;
    integrityStatus: 'healthy' | 'warning' | 'critical';
    checksPerformed: string[];
    issues: StartupIntegrityIssue[];
    warnings: string[];
    recommendations: string[];
    indexVerification?: IndexVerificationResult;
    timestamp: Date;
}

export interface StartupIntegrityIssue {
    type: 'critical' | 'warning';
    table: string;
    description: string;
    recordCount?: number;
    requiresImmedateAction: boolean;
}

/**
 * Startup Integrity Service
 * 
 * Performs basic foreign key consistency checks on application startup
 * and logs warnings/sends alerts for detected inconsistencies.
 * Requirements: 5.1, 5.2, 5.7
 */
export class StartupIntegrityService {
    private static instance: StartupIntegrityService;
    private integrityMonitor: DatabaseIntegrityMonitor;
    private alertService: CriticalErrorAlertService;
    private validationOptimizer: ForeignKeyValidationOptimizer;
    private pool: Pool;

    private constructor(
        pool?: Pool,
        alertService?: CriticalErrorAlertService
    ) {
        this.pool = pool || getPool();
        this.alertService = alertService || new CriticalErrorAlertService(logger);
        this.integrityMonitor = new DatabaseIntegrityMonitor(this.pool, this.alertService);
        this.validationOptimizer = new ForeignKeyValidationOptimizer(this.pool);
    }

    public static getInstance(
        pool?: Pool,
        alertService?: CriticalErrorAlertService
    ): StartupIntegrityService {
        if (!StartupIntegrityService.instance) {
            StartupIntegrityService.instance = new StartupIntegrityService(pool, alertService);
        }
        return StartupIntegrityService.instance;
    }

    /**
     * Perform startup integrity checks
     * Requirements: 5.1, 5.2, 5.7
     */
    async performStartupIntegrityChecks(): Promise<StartupIntegrityResult> {
        logger.info('Starting database integrity checks on application startup');

        const result: StartupIntegrityResult = {
            success: true,
            integrityStatus: 'healthy',
            checksPerformed: [],
            issues: [],
            warnings: [],
            recommendations: [],
            timestamp: new Date()
        };

        try {
            // Perform basic foreign key consistency checks on critical tables
            const criticalTables = [
                'payment_transactions',
                'auction_proposals',
                'swaps'
            ];

            const integrityCheckResult = await this.integrityMonitor.performIntegrityCheck({
                tables: criticalTables,
                includeOrphanedRecords: true,
                includeMissingReferences: true,
                maxRecordsToCheck: 1000 // Limit for startup performance
            });

            result.checksPerformed = criticalTables;
            result.integrityStatus = integrityCheckResult.overallStatus;
            result.recommendations = integrityCheckResult.recommendations;

            // Verify foreign key validation optimization indexes
            logger.info('Verifying foreign key validation optimization indexes');
            const indexVerification = await this.validationOptimizer.verifyOptimizationIndexes();
            result.indexVerification = indexVerification;

            // Add index-related recommendations
            if (!indexVerification.allIndexesPresent) {
                result.recommendations.push(
                    `Missing ${indexVerification.missingIndexes.length} foreign key validation optimization indexes`
                );
                result.warnings.push(
                    `Foreign key validation performance may be suboptimal - ${indexVerification.missingIndexes.length} indexes missing`
                );
            }

            if (!indexVerification.allIndexesValid) {
                result.recommendations.push(
                    `${indexVerification.invalidIndexes.length} foreign key validation indexes are invalid and need recreation`
                );
            }

            // Add optimizer recommendations
            result.recommendations.push(...indexVerification.recommendations);

            // Process integrity check results
            for (const report of integrityCheckResult.reports) {
                if (report.issues.length > 0) {
                    // Convert integrity issues to startup issues
                    for (const issue of report.issues) {
                        const startupIssue: StartupIntegrityIssue = {
                            type: issue.severity === 'critical' ? 'critical' : 'warning',
                            table: report.tableName,
                            description: issue.issue,
                            recordCount: report.orphanedRecords,
                            requiresImmedateAction: issue.severity === 'critical'
                        };
                        result.issues.push(startupIssue);
                    }

                    // Add table-level warnings
                    if (report.orphanedRecords > 0) {
                        result.warnings.push(
                            `Found ${report.orphanedRecords} orphaned records in ${report.tableName} table`
                        );
                    }
                }
            }

            // Determine overall success based on critical issues
            const criticalIssues = result.issues.filter(i => i.type === 'critical');
            if (criticalIssues.length > 0) {
                result.success = false;
                result.integrityStatus = 'critical';
            } else if (result.issues.length > 0) {
                result.integrityStatus = 'warning';
            }

            // Log startup integrity check results
            this.logStartupIntegrityResults(result);

            // Send alerts for critical issues
            if (criticalIssues.length > 0) {
                await this.sendStartupIntegrityAlerts(result, criticalIssues);
            }

            // Log warnings for non-critical issues
            if (result.warnings.length > 0) {
                logger.warn('Database integrity warnings detected during startup', {
                    warningCount: result.warnings.length,
                    warnings: result.warnings,
                    integrityStatus: result.integrityStatus
                });
            }

            return result;

        } catch (error) {
            result.success = false;
            result.integrityStatus = 'critical';

            const errorMessage = error instanceof Error ? error.message : String(error);
            result.issues.push({
                type: 'critical',
                table: 'system',
                description: `Startup integrity check failed: ${errorMessage}`,
                requiresImmedateAction: true
            });

            logger.error('Startup integrity check failed with exception', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });

            // Send critical alert for startup check failure
            await this.alertService.sendCriticalAlert({
                type: 'SYSTEM_FAILURE',
                title: 'Startup Integrity Check Failed',
                message: 'Database integrity checks failed during application startup',
                details: {
                    error: errorMessage,
                    timestamp: result.timestamp.toISOString(),
                    checksAttempted: result.checksPerformed
                },
                severity: 'critical',
                requiresImmedateAction: true,
                timestamp: new Date().toISOString()
            });

            return result;
        }
    }

    /**
     * Perform quick health check for startup readiness
     */
    async performQuickHealthCheck(): Promise<boolean> {
        try {
            logger.info('Performing quick database health check for startup readiness');

            // Test basic database connectivity
            const client = await this.pool.connect();

            try {
                // Simple query to test connection
                await client.query('SELECT 1');

                // Quick check for critical table existence
                const tableCheckQuery = `
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name IN ('payment_transactions', 'swaps', 'users', 'auction_proposals')
                `;

                const tableResult = await client.query(tableCheckQuery);
                const existingTables = tableResult.rows.map(row => row.table_name);

                const requiredTables = ['payment_transactions', 'swaps', 'users'];
                const missingTables = requiredTables.filter(table => !existingTables.includes(table));

                if (missingTables.length > 0) {
                    logger.error('Critical tables missing during startup health check', {
                        missingTables,
                        existingTables
                    });
                    return false;
                }

                logger.info('Quick database health check passed', {
                    tablesChecked: existingTables.length,
                    requiredTablesPresent: requiredTables.length
                });

                return true;

            } finally {
                client.release();
            }

        } catch (error) {
            logger.error('Quick database health check failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return false;
        }
    }

    /**
     * Verify and optionally create missing foreign key validation indexes
     * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
     */
    async verifyValidationOptimizationIndexes(): Promise<IndexVerificationResult> {
        logger.info('Verifying foreign key validation optimization indexes');

        try {
            const verification = await this.validationOptimizer.verifyOptimizationIndexes();

            if (!verification.allIndexesPresent) {
                logger.warn('Missing foreign key validation optimization indexes detected', {
                    missingCount: verification.missingIndexes.length,
                    missingIndexes: verification.missingIndexes,
                    recommendations: verification.recommendations
                });
            } else {
                logger.info('All foreign key validation optimization indexes are present', {
                    totalIndexes: verification.indexes.length,
                    validIndexes: verification.indexes.filter(i => i.isValid).length
                });
            }

            return verification;

        } catch (error) {
            logger.error('Failed to verify foreign key validation optimization indexes', {
                error: error instanceof Error ? error.message : String(error)
            });

            return {
                allIndexesPresent: false,
                allIndexesValid: false,
                indexes: [],
                missingIndexes: [],
                invalidIndexes: [],
                recommendations: ['Failed to verify indexes - check database connection'],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Analyze foreign key validation query performance
     */
    async analyzeValidationPerformance(): Promise<void> {
        try {
            logger.info('Analyzing foreign key validation query performance');

            const performanceAnalysis = await this.validationOptimizer.analyzeValidationQueryPerformance();

            if (performanceAnalysis.error) {
                logger.warn('Foreign key validation performance analysis failed', {
                    error: performanceAnalysis.error
                });
                return;
            }

            logger.info('Foreign key validation performance analysis completed', {
                executionTime: performanceAnalysis.executionTime,
                planningTime: performanceAnalysis.planningTime,
                totalCost: performanceAnalysis.totalCost,
                indexesUsed: performanceAnalysis.indexesUsed,
                recommendations: performanceAnalysis.recommendations
            });

            // Log performance warnings if needed
            if (performanceAnalysis.executionTime && performanceAnalysis.executionTime > 100) {
                logger.warn('Foreign key validation query performance is slow', {
                    executionTime: performanceAnalysis.executionTime,
                    recommendations: performanceAnalysis.recommendations
                });
            }

        } catch (error) {
            logger.error('Failed to analyze foreign key validation performance', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }

    /**
     * Get startup integrity check summary for monitoring
     */
    getStartupIntegritySummary(): object {
        return {
            lastCheck: new Date().toISOString(),
            service: 'StartupIntegrityService',
            checksEnabled: true,
            criticalTablesMonitored: [
                'payment_transactions',
                'auction_proposals',
                'swaps'
            ],
            alertingEnabled: true,
            optimizationIndexesEnabled: true,
            performanceAnalysisEnabled: true
        };
    }

    // Private helper methods

    private logStartupIntegrityResults(result: StartupIntegrityResult): void {
        const logData = {
            integrityStatus: result.integrityStatus,
            checksPerformed: result.checksPerformed.length,
            totalIssues: result.issues.length,
            criticalIssues: result.issues.filter(i => i.type === 'critical').length,
            warnings: result.warnings.length,
            recommendations: result.recommendations.length,
            timestamp: result.timestamp.toISOString()
        };

        if (result.integrityStatus === 'healthy') {
            logger.info('Startup integrity checks completed - database is healthy', logData);
        } else if (result.integrityStatus === 'warning') {
            logger.warn('Startup integrity checks completed with warnings', {
                ...logData,
                issues: result.issues.slice(0, 5), // Log first 5 issues
                warnings: result.warnings.slice(0, 5) // Log first 5 warnings
            });
        } else {
            logger.error('Startup integrity checks detected critical issues', {
                ...logData,
                criticalIssues: result.issues.filter(i => i.type === 'critical').slice(0, 10),
                recommendations: result.recommendations
            });
        }
    }

    private async sendStartupIntegrityAlerts(
        result: StartupIntegrityResult,
        criticalIssues: StartupIntegrityIssue[]
    ): Promise<void> {
        try {
            await this.alertService.sendCriticalAlert({
                type: 'DATA_CORRUPTION',
                title: 'Critical Database Integrity Issues Detected at Startup',
                message: `Application startup detected ${criticalIssues.length} critical database integrity issues that require immediate attention.`,
                details: {
                    integrityStatus: result.integrityStatus,
                    totalIssues: result.issues.length,
                    criticalIssues: criticalIssues.length,
                    affectedTables: [...new Set(criticalIssues.map(i => i.table))],
                    issues: criticalIssues.slice(0, 10), // Include first 10 critical issues
                    recommendations: result.recommendations,
                    timestamp: result.timestamp.toISOString(),
                    checksPerformed: result.checksPerformed
                },
                severity: 'critical',
                requiresImmedateAction: true,
                timestamp: new Date().toISOString()
            });

            logger.info('Startup integrity alerts sent successfully', {
                criticalIssues: criticalIssues.length,
                alertType: 'DATA_CORRUPTION'
            });

        } catch (error) {
            logger.error('Failed to send startup integrity alerts', {
                error: error instanceof Error ? error.message : String(error),
                criticalIssues: criticalIssues.length
            });
        }
    }
}