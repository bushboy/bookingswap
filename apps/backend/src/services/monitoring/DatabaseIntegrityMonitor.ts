import { IntegrityReport, CleanupResult, IntegrityIssue } from '../swap/SwapOfferTransactionManager';
import { CriticalErrorAlertService } from '../alerting/CriticalErrorAlertService';
import { Pool, PoolClient } from 'pg';
import { getPool } from '../../database/config';
import { logger } from '../../utils/logger';

export interface IntegrityCheckOptions {
    tables?: string[];
    includeOrphanedRecords?: boolean;
    includeMissingReferences?: boolean;
    maxRecordsToCheck?: number;
}

export interface IntegrityCheckResult {
    overallStatus: 'healthy' | 'warning' | 'critical';
    reports: IntegrityReport[];
    summary: {
        totalTables: number;
        tablesWithIssues: number;
        totalIssues: number;
        criticalIssues: number;
    };
    recommendations: string[];
}

export interface OrphanedRecord {
    table: string;
    recordId: string;
    orphanedColumns: string[];
    createdAt?: Date;
    lastModified?: Date;
}

export interface IntegrityStatistics {
    lastCheckTime: Date;
    totalChecks: number;
    issuesFound: number;
    issuesResolved: number;
}

/**
 * Database Integrity Monitor Interface
 * 
 * This service monitors database integrity, detects orphaned records,
 * and provides cleanup capabilities for maintaining data consistency.
 */
export interface IDatabaseIntegrityMonitor {
    /**
     * Check payment transaction integrity
     */
    checkPaymentTransactionIntegrity(): Promise<IntegrityReport>;

    /**
     * Perform comprehensive integrity checks
     */
    performIntegrityCheck(options?: IntegrityCheckOptions): Promise<IntegrityCheckResult>;

    /**
     * Detect orphaned records across tables
     */
    detectOrphanedRecords(tableName: string): Promise<OrphanedRecord[]>;

    /**
     * Clean up orphaned records
     */
    cleanupOrphanedRecords(tableName: string, dryRun?: boolean): Promise<CleanupResult>;

    /**
     * Verify foreign key relationships
     */
    verifyForeignKeyIntegrity(tableNames: string[]): Promise<IntegrityReport>;

    /**
     * Get integrity monitoring statistics
     */
    getIntegrityStatistics(): Promise<IntegrityStatistics>;
}

/**
 * Database Integrity Monitor Implementation
 * 
 * Monitors database integrity, detects orphaned records, and provides cleanup
 * capabilities for maintaining data consistency, particularly for payment
 * transactions and their foreign key relationships.
 */
export class DatabaseIntegrityMonitor implements IDatabaseIntegrityMonitor {
    private pool: Pool;
    private alertService: CriticalErrorAlertService;
    private statistics: IntegrityStatistics;

    constructor(
        pool?: Pool,
        alertService?: CriticalErrorAlertService
    ) {
        this.pool = pool || getPool();
        this.alertService = alertService || new CriticalErrorAlertService(logger);
        this.statistics = {
            lastCheckTime: new Date(),
            totalChecks: 0,
            issuesFound: 0,
            issuesResolved: 0
        };
    }

    /**
     * Check payment transaction integrity
     * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
     */
    async checkPaymentTransactionIntegrity(): Promise<IntegrityReport> {
        logger.info('Starting payment transaction integrity check');

        try {
            const client = await this.pool.connect();

            try {
                // Query to find orphaned payment transactions
                const orphanedQuery = `
                    SELECT 
                        pt.id,
                        pt.proposal_id,
                        pt.swap_id,
                        pt.payer_id,
                        pt.recipient_id,
                        pt.created_at,
                        pt.updated_at,
                        CASE 
                            WHEN pt.proposal_id IS NOT NULL AND ap.id IS NULL THEN 'missing_proposal'
                            WHEN s.id IS NULL THEN 'missing_swap'
                            WHEN u1.id IS NULL THEN 'missing_payer'
                            WHEN u2.id IS NULL THEN 'missing_recipient'
                            ELSE 'unknown'
                        END as issue_type
                    FROM payment_transactions pt
                    LEFT JOIN auction_proposals ap ON pt.proposal_id = ap.id
                    LEFT JOIN swaps s ON pt.swap_id = s.id
                    LEFT JOIN users u1 ON pt.payer_id = u1.id
                    LEFT JOIN users u2 ON pt.recipient_id = u2.id
                    WHERE 
                        (pt.proposal_id IS NOT NULL AND ap.id IS NULL)
                        OR s.id IS NULL
                        OR u1.id IS NULL
                        OR u2.id IS NULL
                    ORDER BY pt.created_at DESC
                `;

                const orphanedResult = await client.query(orphanedQuery);

                // Get total payment transactions count
                const totalCountResult = await client.query('SELECT COUNT(*) as total FROM payment_transactions');
                const totalRecords = parseInt(totalCountResult.rows[0].total);

                // Process orphaned records into issues
                const issues: IntegrityIssue[] = orphanedResult.rows.map(row => ({
                    recordId: row.id,
                    issue: this.getIssueDescription(row.issue_type, row),
                    severity: this.getIssueSeverity(row.issue_type)
                }));

                const report: IntegrityReport = {
                    tableName: 'payment_transactions',
                    totalRecords,
                    orphanedRecords: orphanedResult.rows.length,
                    issues
                };

                // Update statistics
                this.statistics.lastCheckTime = new Date();
                this.statistics.totalChecks++;
                this.statistics.issuesFound += issues.length;

                // Log results
                logger.info('Payment transaction integrity check completed', {
                    totalRecords,
                    orphanedRecords: orphanedResult.rows.length,
                    issuesFound: issues.length,
                    criticalIssues: issues.filter(i => i.severity === 'critical').length
                });

                // Send alerts for critical issues
                if (issues.some(i => i.severity === 'critical')) {
                    await this.alertService.sendCriticalAlert({
                        type: 'DATA_CORRUPTION',
                        title: 'Critical Database Integrity Issues Detected',
                        message: `Found ${issues.length} integrity issues in payment_transactions table, including critical foreign key violations.`,
                        details: {
                            tableName: 'payment_transactions',
                            totalRecords,
                            orphanedRecords: orphanedResult.rows.length,
                            criticalIssues: issues.filter(i => i.severity === 'critical').length,
                            issues: issues.slice(0, 10) // Include first 10 issues
                        },
                        severity: 'critical',
                        requiresImmedateAction: true,
                        timestamp: new Date().toISOString()
                    });
                }

                return report;

            } finally {
                client.release();
            }

        } catch (error) {
            logger.error('Payment transaction integrity check failed', {
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });

            throw new Error(`Payment transaction integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Perform comprehensive integrity checks
     */
    async performIntegrityCheck(options: IntegrityCheckOptions = {}): Promise<IntegrityCheckResult> {
        const {
            tables = ['payment_transactions', 'auction_proposals', 'swaps'],
            includeOrphanedRecords = true,
            includeMissingReferences = true,
            maxRecordsToCheck = 10000
        } = options;

        logger.info('Starting comprehensive integrity check', { tables, options });

        const reports: IntegrityReport[] = [];

        try {
            // Check each specified table
            for (const tableName of tables) {
                let report: IntegrityReport;

                switch (tableName) {
                    case 'payment_transactions':
                        report = await this.checkPaymentTransactionIntegrity();
                        break;
                    default:
                        report = await this.checkGenericTableIntegrity(tableName, maxRecordsToCheck);
                        break;
                }

                reports.push(report);
            }

            // Calculate summary
            const summary = {
                totalTables: tables.length,
                tablesWithIssues: reports.filter(r => r.issues.length > 0).length,
                totalIssues: reports.reduce((sum, r) => sum + r.issues.length, 0),
                criticalIssues: reports.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0)
            };

            // Determine overall status
            let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
            if (summary.criticalIssues > 0) {
                overallStatus = 'critical';
            } else if (summary.totalIssues > 0) {
                overallStatus = 'warning';
            }

            // Generate recommendations
            const recommendations = this.generateRecommendations(reports);

            const result: IntegrityCheckResult = {
                overallStatus,
                reports,
                summary,
                recommendations
            };

            logger.info('Comprehensive integrity check completed', {
                overallStatus,
                summary,
                recommendationsCount: recommendations.length
            });

            return result;

        } catch (error) {
            logger.error('Comprehensive integrity check failed', {
                error: error instanceof Error ? error.message : String(error),
                tables
            });

            throw new Error(`Comprehensive integrity check failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Detect orphaned records across tables
     */
    async detectOrphanedRecords(tableName: string): Promise<OrphanedRecord[]> {
        logger.info('Detecting orphaned records', { tableName });

        try {
            const client = await this.pool.connect();

            try {
                let query: string;
                let orphanedRecords: OrphanedRecord[] = [];

                switch (tableName) {
                    case 'payment_transactions':
                        orphanedRecords = await this.detectOrphanedPaymentTransactions(client);
                        break;
                    case 'auction_proposals':
                        orphanedRecords = await this.detectOrphanedAuctionProposals(client);
                        break;
                    default:
                        logger.warn('Orphaned record detection not implemented for table', { tableName });
                        break;
                }

                logger.info('Orphaned record detection completed', {
                    tableName,
                    orphanedCount: orphanedRecords.length
                });

                return orphanedRecords;

            } finally {
                client.release();
            }

        } catch (error) {
            logger.error('Orphaned record detection failed', {
                tableName,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new Error(`Orphaned record detection failed for ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clean up orphaned records
     */
    async cleanupOrphanedRecords(tableName: string, dryRun: boolean = true): Promise<CleanupResult> {
        logger.info('Starting orphaned record cleanup', { tableName, dryRun });

        const result: CleanupResult = {
            recordsProcessed: 0,
            recordsFixed: 0,
            recordsRemoved: 0,
            errors: []
        };

        try {
            const orphanedRecords = await this.detectOrphanedRecords(tableName);
            result.recordsProcessed = orphanedRecords.length;

            if (orphanedRecords.length === 0) {
                logger.info('No orphaned records found for cleanup', { tableName });
                return result;
            }

            if (dryRun) {
                logger.info('Dry run - would process orphaned records', {
                    tableName,
                    recordCount: orphanedRecords.length
                });
                return result;
            }

            // Actual cleanup logic would go here
            // For now, we'll just log what would be done
            logger.warn('Actual cleanup not implemented - this would remove orphaned records', {
                tableName,
                recordCount: orphanedRecords.length,
                records: orphanedRecords.slice(0, 5) // Log first 5 for reference
            });

            this.statistics.issuesResolved += result.recordsFixed + result.recordsRemoved;

            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            result.errors.push(errorMessage);

            logger.error('Orphaned record cleanup failed', {
                tableName,
                dryRun,
                error: errorMessage
            });

            return result;
        }
    }

    /**
     * Verify foreign key relationships
     */
    async verifyForeignKeyIntegrity(tableNames: string[]): Promise<IntegrityReport> {
        logger.info('Verifying foreign key integrity', { tableNames });

        try {
            const client = await this.pool.connect();

            try {
                const allIssues: IntegrityIssue[] = [];
                let totalRecords = 0;
                let orphanedRecords = 0;

                for (const tableName of tableNames) {
                    const tableReport = await this.checkTableForeignKeys(client, tableName);
                    allIssues.push(...tableReport.issues);
                    totalRecords += tableReport.totalRecords;
                    orphanedRecords += tableReport.orphanedRecords;
                }

                const report: IntegrityReport = {
                    tableName: tableNames.join(', '),
                    totalRecords,
                    orphanedRecords,
                    issues: allIssues
                };

                logger.info('Foreign key integrity verification completed', {
                    tableNames,
                    totalRecords,
                    orphanedRecords,
                    issuesFound: allIssues.length
                });

                return report;

            } finally {
                client.release();
            }

        } catch (error) {
            logger.error('Foreign key integrity verification failed', {
                tableNames,
                error: error instanceof Error ? error.message : String(error)
            });

            throw new Error(`Foreign key integrity verification failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get integrity monitoring statistics
     */
    async getIntegrityStatistics(): Promise<IntegrityStatistics> {
        return { ...this.statistics };
    }

    // Private helper methods

    private getIssueDescription(issueType: string, row: any): string {
        switch (issueType) {
            case 'missing_proposal':
                return `Payment transaction references non-existent auction proposal: ${row.proposal_id}`;
            case 'missing_swap':
                return `Payment transaction references non-existent swap: ${row.swap_id}`;
            case 'missing_payer':
                return `Payment transaction references non-existent payer: ${row.payer_id}`;
            case 'missing_recipient':
                return `Payment transaction references non-existent recipient: ${row.recipient_id}`;
            default:
                return `Unknown integrity issue in payment transaction: ${row.id}`;
        }
    }

    private getIssueSeverity(issueType: string): 'low' | 'medium' | 'high' | 'critical' {
        switch (issueType) {
            case 'missing_proposal':
                return 'high'; // High because it can cause foreign key violations
            case 'missing_swap':
                return 'critical'; // Critical because swap is core entity
            case 'missing_payer':
            case 'missing_recipient':
                return 'critical'; // Critical because users are required
            default:
                return 'medium';
        }
    }

    private async checkGenericTableIntegrity(tableName: string, maxRecords: number): Promise<IntegrityReport> {
        const client = await this.pool.connect();

        try {
            // Get total count
            const countResult = await client.query(`SELECT COUNT(*) as total FROM ${tableName}`);
            const totalRecords = parseInt(countResult.rows[0].total);

            // For now, return empty report for generic tables
            // This could be extended to check specific constraints per table
            return {
                tableName,
                totalRecords,
                orphanedRecords: 0,
                issues: []
            };

        } finally {
            client.release();
        }
    }

    private async detectOrphanedPaymentTransactions(client: PoolClient): Promise<OrphanedRecord[]> {
        const query = `
            SELECT 
                pt.id,
                pt.created_at,
                pt.updated_at,
                ARRAY_REMOVE(ARRAY[
                    CASE WHEN pt.proposal_id IS NOT NULL AND ap.id IS NULL THEN 'proposal_id' END,
                    CASE WHEN s.id IS NULL THEN 'swap_id' END,
                    CASE WHEN u1.id IS NULL THEN 'payer_id' END,
                    CASE WHEN u2.id IS NULL THEN 'recipient_id' END
                ], NULL) as orphaned_columns
            FROM payment_transactions pt
            LEFT JOIN auction_proposals ap ON pt.proposal_id = ap.id
            LEFT JOIN swaps s ON pt.swap_id = s.id
            LEFT JOIN users u1 ON pt.payer_id = u1.id
            LEFT JOIN users u2 ON pt.recipient_id = u2.id
            WHERE 
                (pt.proposal_id IS NOT NULL AND ap.id IS NULL)
                OR s.id IS NULL
                OR u1.id IS NULL
                OR u2.id IS NULL
        `;

        const result = await client.query(query);

        return result.rows.map(row => ({
            table: 'payment_transactions',
            recordId: row.id,
            orphanedColumns: row.orphaned_columns,
            createdAt: row.created_at,
            lastModified: row.updated_at
        }));
    }

    private async detectOrphanedAuctionProposals(client: PoolClient): Promise<OrphanedRecord[]> {
        const query = `
            SELECT 
                ap.id,
                ap.created_at,
                ap.updated_at,
                ARRAY_REMOVE(ARRAY[
                    CASE WHEN s.id IS NULL THEN 'swap_id' END,
                    CASE WHEN u.id IS NULL THEN 'proposer_id' END
                ], NULL) as orphaned_columns
            FROM auction_proposals ap
            LEFT JOIN swaps s ON ap.swap_id = s.id
            LEFT JOIN users u ON ap.proposer_id = u.id
            WHERE s.id IS NULL OR u.id IS NULL
        `;

        const result = await client.query(query);

        return result.rows.map(row => ({
            table: 'auction_proposals',
            recordId: row.id,
            orphanedColumns: row.orphaned_columns,
            createdAt: row.created_at,
            lastModified: row.updated_at
        }));
    }

    private async checkTableForeignKeys(client: PoolClient, tableName: string): Promise<IntegrityReport> {
        // This is a simplified implementation
        // In a real scenario, you'd query the database schema to get foreign key constraints
        // and check each one systematically

        switch (tableName) {
            case 'payment_transactions':
                return await this.checkPaymentTransactionIntegrity();
            default:
                return {
                    tableName,
                    totalRecords: 0,
                    orphanedRecords: 0,
                    issues: []
                };
        }
    }

    private generateRecommendations(reports: IntegrityReport[]): string[] {
        const recommendations: string[] = [];

        for (const report of reports) {
            if (report.issues.length === 0) continue;

            const criticalIssues = report.issues.filter(i => i.severity === 'critical').length;
            const highIssues = report.issues.filter(i => i.severity === 'high').length;

            if (criticalIssues > 0) {
                recommendations.push(`URGENT: Fix ${criticalIssues} critical integrity issues in ${report.tableName} table immediately`);
            }

            if (highIssues > 0) {
                recommendations.push(`Address ${highIssues} high-priority integrity issues in ${report.tableName} table`);
            }

            if (report.orphanedRecords > 10) {
                recommendations.push(`Consider running cleanup for ${report.orphanedRecords} orphaned records in ${report.tableName}`);
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('Database integrity is healthy - no immediate action required');
        }

        return recommendations;
    }
}