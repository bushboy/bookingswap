import { Pool } from 'pg';
import { logger } from './logger';
import { CleanupResult, CleanupOperation } from './swapDataCleanup';
import { DataIntegrityReport } from './swapDataValidation';

/**
 * Logging and reporting utilities for swap data cleanup operations
 * Requirements: 3.4 - Add logging and reporting for cleanup operations
 */

export interface CleanupLogEntry {
    id: string;
    operation_type: 'validation' | 'cleanup' | 'verification';
    timestamp: Date;
    user_id?: string;
    dry_run: boolean;
    records_processed: number;
    records_affected: number;
    errors_count: number;
    warnings_count: number;
    backup_created: boolean;
    backup_location?: string;
    operation_details: any;
    execution_time_ms: number;
    status: 'success' | 'partial_success' | 'failed';
}

export interface CleanupAuditLog {
    timestamp: Date;
    operation: string;
    details: any;
    result: 'success' | 'error' | 'warning';
    executionTimeMs?: number;
}

export class SwapCleanupReportingService {
    constructor(private pool: Pool) { }

    /**
     * Log cleanup operation to database
     * Requirements: 3.4 - Add logging for cleanup operations
     */
    async logCleanupOperation(
        operationType: 'validation' | 'cleanup' | 'verification',
        result: CleanupResult | DataIntegrityReport,
        options: {
            dryRun: boolean;
            userId?: string;
            executionTimeMs: number;
            status: 'success' | 'partial_success' | 'failed';
        }
    ): Promise<string> {
        try {
            // Create cleanup logs table if it doesn't exist
            await this.ensureCleanupLogsTable();

            const logEntry: Omit<CleanupLogEntry, 'id'> = {
                operation_type: operationType,
                timestamp: new Date(),
                user_id: options.userId,
                dry_run: options.dryRun,
                records_processed: this.extractRecordsProcessed(result),
                records_affected: this.extractRecordsAffected(result),
                errors_count: this.extractErrorsCount(result),
                warnings_count: this.extractWarningsCount(result),
                backup_created: this.extractBackupCreated(result),
                backup_location: this.extractBackupLocation(result),
                operation_details: result,
                execution_time_ms: options.executionTimeMs,
                status: options.status
            };

            const query = `
        INSERT INTO swap_cleanup_logs (
          operation_type, timestamp, user_id, dry_run, records_processed,
          records_affected, errors_count, warnings_count, backup_created,
          backup_location, operation_details, execution_time_ms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `;

            const values = [
                logEntry.operation_type,
                logEntry.timestamp,
                logEntry.user_id,
                logEntry.dry_run,
                logEntry.records_processed,
                logEntry.records_affected,
                logEntry.errors_count,
                logEntry.warnings_count,
                logEntry.backup_created,
                logEntry.backup_location,
                JSON.stringify(logEntry.operation_details),
                logEntry.execution_time_ms,
                logEntry.status
            ];

            const result_query = await this.pool.query(query, values);
            const logId = result_query.rows[0].id;

            logger.info('Cleanup operation logged', {
                logId,
                operationType,
                status: options.status,
                recordsAffected: logEntry.records_affected
            });

            return logId;
        } catch (error) {
            logger.error('Failed to log cleanup operation', { error, operationType });
            throw error;
        }
    }

    /**
     * Create audit log entry
     * Requirements: 3.4 - Add logging for cleanup operations
     */
    async createAuditLog(entry: CleanupAuditLog): Promise<void> {
        try {
            await this.ensureAuditLogsTable();

            const query = `
        INSERT INTO swap_cleanup_audit_logs (
          timestamp, operation, details, result, execution_time_ms
        ) VALUES ($1, $2, $3, $4, $5)
      `;

            await this.pool.query(query, [
                entry.timestamp,
                entry.operation,
                JSON.stringify(entry.details),
                entry.result,
                entry.executionTimeMs
            ]);

            logger.debug('Audit log entry created', {
                operation: entry.operation,
                result: entry.result
            });
        } catch (error) {
            logger.error('Failed to create audit log entry', { error, entry });
            // Don't throw - audit logging shouldn't break the main operation
        }
    }

    /**
     * Generate cleanup operation report
     * Requirements: 3.4 - Add reporting for cleanup operations
     */
    async generateCleanupReport(
        startDate?: Date,
        endDate?: Date,
        operationType?: 'validation' | 'cleanup' | 'verification'
    ): Promise<{
        summary: {
            totalOperations: number;
            successfulOperations: number;
            failedOperations: number;
            totalRecordsProcessed: number;
            totalRecordsAffected: number;
            totalExecutionTimeMs: number;
            averageExecutionTimeMs: number;
        };
        operations: CleanupLogEntry[];
        trends: {
            operationsByDay: { date: string; count: number }[];
            recordsProcessedByDay: { date: string; count: number }[];
            errorRateByDay: { date: string; rate: number }[];
        };
    }> {
        try {
            await this.ensureCleanupLogsTable();

            let whereClause = 'WHERE 1=1';
            const params: any[] = [];
            let paramIndex = 1;

            if (startDate) {
                whereClause += ` AND timestamp >= $${paramIndex++}`;
                params.push(startDate);
            }

            if (endDate) {
                whereClause += ` AND timestamp <= $${paramIndex++}`;
                params.push(endDate);
            }

            if (operationType) {
                whereClause += ` AND operation_type = $${paramIndex++}`;
                params.push(operationType);
            }

            // Get all operations
            const operationsQuery = `
        SELECT * FROM swap_cleanup_logs
        ${whereClause}
        ORDER BY timestamp DESC
      `;

            const operationsResult = await this.pool.query(operationsQuery, params);
            const operations = operationsResult.rows.map(row => ({
                ...row,
                operation_details: typeof row.operation_details === 'string'
                    ? JSON.parse(row.operation_details)
                    : row.operation_details
            }));

            // Calculate summary statistics
            const totalOperations = operations.length;
            const successfulOperations = operations.filter(op => op.status === 'success').length;
            const failedOperations = operations.filter(op => op.status === 'failed').length;
            const totalRecordsProcessed = operations.reduce((sum, op) => sum + (op.records_processed || 0), 0);
            const totalRecordsAffected = operations.reduce((sum, op) => sum + (op.records_affected || 0), 0);
            const totalExecutionTimeMs = operations.reduce((sum, op) => sum + (op.execution_time_ms || 0), 0);
            const averageExecutionTimeMs = totalOperations > 0 ? totalExecutionTimeMs / totalOperations : 0;

            // Generate trends
            const trendsQuery = `
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as operation_count,
          SUM(records_processed) as records_processed,
          AVG(CASE WHEN errors_count > 0 THEN 1.0 ELSE 0.0 END) as error_rate
        FROM swap_cleanup_logs
        ${whereClause}
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp)
      `;

            const trendsResult = await this.pool.query(trendsQuery, params);
            const trends = {
                operationsByDay: trendsResult.rows.map(row => ({
                    date: row.date,
                    count: parseInt(row.operation_count)
                })),
                recordsProcessedByDay: trendsResult.rows.map(row => ({
                    date: row.date,
                    count: parseInt(row.records_processed || 0)
                })),
                errorRateByDay: trendsResult.rows.map(row => ({
                    date: row.date,
                    rate: parseFloat(row.error_rate || 0)
                }))
            };

            return {
                summary: {
                    totalOperations,
                    successfulOperations,
                    failedOperations,
                    totalRecordsProcessed,
                    totalRecordsAffected,
                    totalExecutionTimeMs,
                    averageExecutionTimeMs
                },
                operations,
                trends
            };
        } catch (error) {
            logger.error('Failed to generate cleanup report', { error });
            throw error;
        }
    }

    /**
     * Get recent cleanup operations
     * Requirements: 3.4 - Add reporting for cleanup operations
     */
    async getRecentOperations(limit: number = 10): Promise<CleanupLogEntry[]> {
        try {
            await this.ensureCleanupLogsTable();

            const query = `
        SELECT * FROM swap_cleanup_logs
        ORDER BY timestamp DESC
        LIMIT $1
      `;

            const result = await this.pool.query(query, [limit]);
            return result.rows.map(row => ({
                ...row,
                operation_details: typeof row.operation_details === 'string'
                    ? JSON.parse(row.operation_details)
                    : row.operation_details
            }));
        } catch (error) {
            logger.error('Failed to get recent operations', { error });
            throw error;
        }
    }

    /**
     * Export cleanup logs to JSON
     * Requirements: 3.4 - Add reporting for cleanup operations
     */
    async exportCleanupLogs(
        startDate?: Date,
        endDate?: Date,
        format: 'json' | 'csv' = 'json'
    ): Promise<string> {
        try {
            const report = await this.generateCleanupReport(startDate, endDate);

            if (format === 'json') {
                return JSON.stringify(report, null, 2);
            } else {
                // Convert to CSV format
                const csvHeaders = [
                    'timestamp', 'operation_type', 'dry_run', 'records_processed',
                    'records_affected', 'errors_count', 'warnings_count', 'status',
                    'execution_time_ms', 'backup_created'
                ];

                const csvRows = report.operations.map(op => [
                    op.timestamp.toISOString(),
                    op.operation_type,
                    op.dry_run.toString(),
                    op.records_processed.toString(),
                    op.records_affected.toString(),
                    op.errors_count.toString(),
                    op.warnings_count.toString(),
                    op.status,
                    op.execution_time_ms.toString(),
                    op.backup_created.toString()
                ]);

                return [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');
            }
        } catch (error) {
            logger.error('Failed to export cleanup logs', { error });
            throw error;
        }
    }

    /**
     * Ensure cleanup logs table exists
     */
    private async ensureCleanupLogsTable(): Promise<void> {
        const query = `
      CREATE TABLE IF NOT EXISTS swap_cleanup_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        operation_type VARCHAR(20) NOT NULL CHECK (operation_type IN ('validation', 'cleanup', 'verification')),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        user_id UUID,
        dry_run BOOLEAN NOT NULL DEFAULT false,
        records_processed INTEGER NOT NULL DEFAULT 0,
        records_affected INTEGER NOT NULL DEFAULT 0,
        errors_count INTEGER NOT NULL DEFAULT 0,
        warnings_count INTEGER NOT NULL DEFAULT 0,
        backup_created BOOLEAN NOT NULL DEFAULT false,
        backup_location TEXT,
        operation_details JSONB,
        execution_time_ms INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'partial_success', 'failed')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_logs_timestamp ON swap_cleanup_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_logs_operation_type ON swap_cleanup_logs(operation_type);
      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_logs_status ON swap_cleanup_logs(status);
      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_logs_user_id ON swap_cleanup_logs(user_id);
    `;

        await this.pool.query(query);
    }

    /**
     * Ensure audit logs table exists
     */
    private async ensureAuditLogsTable(): Promise<void> {
        const query = `
      CREATE TABLE IF NOT EXISTS swap_cleanup_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        operation TEXT NOT NULL,
        details JSONB,
        result VARCHAR(10) NOT NULL CHECK (result IN ('success', 'error', 'warning')),
        execution_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_audit_logs_timestamp ON swap_cleanup_audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_audit_logs_operation ON swap_cleanup_audit_logs(operation);
      CREATE INDEX IF NOT EXISTS idx_swap_cleanup_audit_logs_result ON swap_cleanup_audit_logs(result);
    `;

        await this.pool.query(query);
    }

    // Helper methods to extract data from different result types
    private extractRecordsProcessed(result: CleanupResult | DataIntegrityReport): number {
        if ('recordsAffected' in result) {
            return result.recordsAffected;
        }
        if ('totalSwaps' in result) {
            return result.totalSwaps;
        }
        return 0;
    }

    private extractRecordsAffected(result: CleanupResult | DataIntegrityReport): number {
        if ('recordsAffected' in result) {
            return result.recordsAffected;
        }
        if ('selfProposalsFound' in result) {
            return result.selfProposalsFound + result.nullProposerIds + result.nullOwnerIds;
        }
        return 0;
    }

    private extractErrorsCount(result: CleanupResult | DataIntegrityReport): number {
        if ('errors' in result) {
            return result.errors.length;
        }
        return 0;
    }

    private extractWarningsCount(result: CleanupResult | DataIntegrityReport): number {
        if ('warnings' in result) {
            return result.warnings.length;
        }
        return 0;
    }

    private extractBackupCreated(result: CleanupResult | DataIntegrityReport): boolean {
        if ('backupCreated' in result) {
            return result.backupCreated;
        }
        return false;
    }

    private extractBackupLocation(result: CleanupResult | DataIntegrityReport): string | undefined {
        if ('backupLocation' in result) {
            return result.backupLocation;
        }
        return undefined;
    }
}