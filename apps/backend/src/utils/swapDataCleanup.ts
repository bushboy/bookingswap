import { Pool } from 'pg';
import { logger } from './logger';
import { SwapDataValidationService, SelfProposalValidationResult } from './swapDataValidation';

/**
 * Data cleanup procedures for swap self-exclusion fix
 * Requirements: 3.4 - Safe cleanup procedures for invalid data
 */

export interface CleanupOperation {
    operationType: 'DELETE' | 'UPDATE' | 'ARCHIVE';
    tableName: string;
    recordId: string;
    reason: string;
    backupData?: any;
    timestamp: Date;
}

export interface CleanupResult {
    operationsPerformed: CleanupOperation[];
    recordsAffected: number;
    backupCreated: boolean;
    backupLocation?: string;
    errors: string[];
    warnings: string[];
    summary: {
        selfProposalsRemoved: number;
        invalidDataFixed: number;
        totalOperations: number;
    };
}

export interface CleanupOptions {
    dryRun: boolean;
    createBackup: boolean;
    batchSize: number;
    maxRecordsToProcess?: number;
    skipConfirmation?: boolean;
}

export class SwapDataCleanupService {
    private validationService: SwapDataValidationService;

    constructor(private pool: Pool) {
        this.validationService = new SwapDataValidationService(pool);
    }

    /**
     * Create backup of data before cleanup
     * Requirements: 3.4 - Safe cleanup procedures
     */
    private async createDataBackup(tableName: string = 'swaps'): Promise<string> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupTableName = `${tableName}_backup_${timestamp}`;

            // Create backup table with all self-proposals
            const backupQuery = `
        CREATE TABLE ${backupTableName} AS
        SELECT s.*, 'self_proposal_backup' as backup_reason, NOW() as backup_created_at
        FROM ${tableName} s
        WHERE s.proposer_id = s.owner_id
      `;

            await this.pool.query(backupQuery);

            // Add comment to backup table
            await this.pool.query(`
        COMMENT ON TABLE ${backupTableName} IS 
        'Backup of self-proposals before cleanup operation on ${timestamp}'
      `);

            logger.info('Data backup created successfully', {
                backupTableName,
                originalTable: tableName
            });

            return backupTableName;
        } catch (error) {
            logger.error('Failed to create data backup', { error, tableName });
            throw error;
        }
    }

    /**
     * Identify self-proposals to be cleaned up
     * Requirements: 3.4 - Identify existing self-proposals
     */
    async identifySelfProposalsForCleanup(): Promise<SelfProposalValidationResult[]> {
        try {
            const selfProposals = await this.validationService.detectSelfProposals();

            logger.info('Identified self-proposals for cleanup', {
                count: selfProposals.length
            });

            return selfProposals;
        } catch (error) {
            logger.error('Failed to identify self-proposals for cleanup', { error });
            throw error;
        }
    }

    /**
     * Remove self-proposals from the database
     * Requirements: 3.4 - Safe cleanup procedures for invalid data
     */
    async removeSelfProposals(options: CleanupOptions): Promise<CleanupResult> {
        const operations: CleanupOperation[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        let backupLocation: string | undefined;

        try {
            logger.info('Starting self-proposal cleanup', { options });

            // Validate before cleanup
            const selfProposals = await this.identifySelfProposalsForCleanup();

            if (selfProposals.length === 0) {
                logger.info('No self-proposals found to clean up');
                return {
                    operationsPerformed: [],
                    recordsAffected: 0,
                    backupCreated: false,
                    errors: [],
                    warnings: ['No self-proposals found to clean up'],
                    summary: {
                        selfProposalsRemoved: 0,
                        invalidDataFixed: 0,
                        totalOperations: 0
                    }
                };
            }

            // Limit records if specified
            const recordsToProcess = options.maxRecordsToProcess
                ? selfProposals.slice(0, options.maxRecordsToProcess)
                : selfProposals;

            if (recordsToProcess.length < selfProposals.length) {
                warnings.push(`Processing ${recordsToProcess.length} of ${selfProposals.length} self-proposals due to maxRecordsToProcess limit`);
            }

            // Create backup if requested
            if (options.createBackup && !options.dryRun) {
                try {
                    backupLocation = await this.createDataBackup();
                } catch (backupError) {
                    errors.push(`Failed to create backup: ${backupError}`);
                    if (!options.skipConfirmation) {
                        throw new Error('Backup creation failed. Aborting cleanup for safety.');
                    }
                }
            }

            // Process in batches
            const batchSize = options.batchSize || 50;
            let totalRemoved = 0;

            for (let i = 0; i < recordsToProcess.length; i += batchSize) {
                const batch = recordsToProcess.slice(i, i + batchSize);
                const batchIds = batch.map(sp => sp.swapId);

                if (options.dryRun) {
                    // Dry run - just log what would be done
                    batch.forEach(selfProposal => {
                        operations.push({
                            operationType: 'DELETE',
                            tableName: 'swaps',
                            recordId: selfProposal.swapId,
                            reason: `Self-proposal cleanup: ${selfProposal.description}`,
                            backupData: selfProposal,
                            timestamp: new Date()
                        });
                    });

                    logger.info(`[DRY RUN] Would remove batch of ${batch.length} self-proposals`, {
                        batchNumber: Math.floor(i / batchSize) + 1,
                        swapIds: batchIds
                    });
                } else {
                    // Actual cleanup
                    try {
                        const deleteQuery = `
              DELETE FROM swaps 
              WHERE id = ANY($1) 
              AND proposer_id = owner_id
              RETURNING id, proposer_id, owner_id
            `;

                        const result = await this.pool.query(deleteQuery, [batchIds]);
                        const deletedCount = result.rows.length;
                        totalRemoved += deletedCount;

                        // Record operations
                        result.rows.forEach((row: any) => {
                            operations.push({
                                operationType: 'DELETE',
                                tableName: 'swaps',
                                recordId: row.id,
                                reason: `Self-proposal removed: proposer_id ${row.proposer_id} equals owner_id ${row.owner_id}`,
                                timestamp: new Date()
                            });
                        });

                        logger.info(`Removed batch of ${deletedCount} self-proposals`, {
                            batchNumber: Math.floor(i / batchSize) + 1,
                            deletedIds: result.rows.map((r: any) => r.id)
                        });

                        // Verify deletion
                        const verifyQuery = `
              SELECT COUNT(*) as remaining_count
              FROM swaps 
              WHERE id = ANY($1) AND proposer_id = owner_id
            `;
                        const verifyResult = await this.pool.query(verifyQuery, [batchIds]);
                        const remainingCount = parseInt(verifyResult.rows[0].remaining_count);

                        if (remainingCount > 0) {
                            warnings.push(`${remainingCount} self-proposals from batch ${Math.floor(i / batchSize) + 1} were not deleted`);
                        }

                    } catch (batchError) {
                        const errorMsg = `Failed to process batch ${Math.floor(i / batchSize) + 1}: ${batchError}`;
                        errors.push(errorMsg);
                        logger.error('Batch cleanup failed', {
                            error: batchError,
                            batchNumber: Math.floor(i / batchSize) + 1,
                            batchIds
                        });
                    }
                }
            }

            const summary = {
                selfProposalsRemoved: options.dryRun ? 0 : totalRemoved,
                invalidDataFixed: options.dryRun ? 0 : totalRemoved,
                totalOperations: operations.length
            };

            logger.info('Self-proposal cleanup completed', {
                dryRun: options.dryRun,
                summary,
                errorsCount: errors.length,
                warningsCount: warnings.length
            });

            return {
                operationsPerformed: operations,
                recordsAffected: options.dryRun ? recordsToProcess.length : totalRemoved,
                backupCreated: !!backupLocation,
                backupLocation,
                errors,
                warnings,
                summary
            };

        } catch (error) {
            logger.error('Self-proposal cleanup failed', { error, options });
            errors.push(`Cleanup operation failed: ${error}`);

            return {
                operationsPerformed: operations,
                recordsAffected: 0,
                backupCreated: !!backupLocation,
                backupLocation,
                errors,
                warnings,
                summary: {
                    selfProposalsRemoved: 0,
                    invalidDataFixed: 0,
                    totalOperations: operations.length
                }
            };
        }
    }

    /**
     * Fix null proposer_id or owner_id issues
     * Requirements: 3.4 - Safe cleanup procedures for invalid data
     */
    async fixNullUserIds(options: CleanupOptions): Promise<CleanupResult> {
        const operations: CleanupOperation[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            logger.info('Starting null user ID cleanup', { options });

            // Find swaps with null proposer_id
            const nullProposerQuery = `
        SELECT id, proposer_id, owner_id, source_booking_id, target_booking_id, status
        FROM swaps 
        WHERE proposer_id IS NULL
        ORDER BY created_at DESC
        ${options.maxRecordsToProcess ? `LIMIT ${options.maxRecordsToProcess}` : ''}
      `;

            const nullProposerResult = await this.pool.query(nullProposerQuery);

            // Find swaps with null owner_id
            const nullOwnerQuery = `
        SELECT id, proposer_id, owner_id, source_booking_id, target_booking_id, status
        FROM swaps 
        WHERE owner_id IS NULL
        ORDER BY created_at DESC
        ${options.maxRecordsToProcess ? `LIMIT ${options.maxRecordsToProcess}` : ''}
      `;

            const nullOwnerResult = await this.pool.query(nullOwnerQuery);

            const totalRecords = nullProposerResult.rows.length + nullOwnerResult.rows.length;

            if (totalRecords === 0) {
                return {
                    operationsPerformed: [],
                    recordsAffected: 0,
                    backupCreated: false,
                    errors: [],
                    warnings: ['No null user ID issues found'],
                    summary: {
                        selfProposalsRemoved: 0,
                        invalidDataFixed: 0,
                        totalOperations: 0
                    }
                };
            }

            let fixedCount = 0;

            // Process null proposer_ids
            for (const row of nullProposerResult.rows) {
                if (options.dryRun) {
                    operations.push({
                        operationType: 'DELETE',
                        tableName: 'swaps',
                        recordId: row.id,
                        reason: 'Null proposer_id - invalid swap record',
                        backupData: row,
                        timestamp: new Date()
                    });
                } else {
                    try {
                        // Delete swaps with null proposer_id as they are invalid
                        await this.pool.query('DELETE FROM swaps WHERE id = $1', [row.id]);

                        operations.push({
                            operationType: 'DELETE',
                            tableName: 'swaps',
                            recordId: row.id,
                            reason: 'Removed swap with null proposer_id',
                            timestamp: new Date()
                        });

                        fixedCount++;
                    } catch (error) {
                        errors.push(`Failed to fix null proposer_id for swap ${row.id}: ${error}`);
                    }
                }
            }

            // Process null owner_ids
            for (const row of nullOwnerResult.rows) {
                if (options.dryRun) {
                    operations.push({
                        operationType: 'DELETE',
                        tableName: 'swaps',
                        recordId: row.id,
                        reason: 'Null owner_id - invalid swap record',
                        backupData: row,
                        timestamp: new Date()
                    });
                } else {
                    try {
                        // Delete swaps with null owner_id as they are invalid
                        await this.pool.query('DELETE FROM swaps WHERE id = $1', [row.id]);

                        operations.push({
                            operationType: 'DELETE',
                            tableName: 'swaps',
                            recordId: row.id,
                            reason: 'Removed swap with null owner_id',
                            timestamp: new Date()
                        });

                        fixedCount++;
                    } catch (error) {
                        errors.push(`Failed to fix null owner_id for swap ${row.id}: ${error}`);
                    }
                }
            }

            const summary = {
                selfProposalsRemoved: 0,
                invalidDataFixed: options.dryRun ? 0 : fixedCount,
                totalOperations: operations.length
            };

            logger.info('Null user ID cleanup completed', {
                dryRun: options.dryRun,
                summary
            });

            return {
                operationsPerformed: operations,
                recordsAffected: options.dryRun ? totalRecords : fixedCount,
                backupCreated: false,
                errors,
                warnings,
                summary
            };

        } catch (error) {
            logger.error('Null user ID cleanup failed', { error });
            errors.push(`Null user ID cleanup failed: ${error}`);

            return {
                operationsPerformed: operations,
                recordsAffected: 0,
                backupCreated: false,
                errors,
                warnings,
                summary: {
                    selfProposalsRemoved: 0,
                    invalidDataFixed: 0,
                    totalOperations: operations.length
                }
            };
        }
    }

    /**
     * Comprehensive cleanup operation
     * Requirements: 3.4 - Safe cleanup procedures for invalid data
     */
    async performComprehensiveCleanup(options: CleanupOptions): Promise<{
        selfProposalCleanup: CleanupResult;
        nullUserIdCleanup: CleanupResult;
        overallSummary: {
            totalRecordsProcessed: number;
            totalRecordsFixed: number;
            totalOperations: number;
            totalErrors: number;
            totalWarnings: number;
        };
    }> {
        try {
            logger.info('Starting comprehensive data cleanup', { options });

            // Perform self-proposal cleanup
            const selfProposalCleanup = await this.removeSelfProposals(options);

            // Perform null user ID cleanup
            const nullUserIdCleanup = await this.fixNullUserIds(options);

            // Calculate overall summary
            const overallSummary = {
                totalRecordsProcessed: selfProposalCleanup.recordsAffected + nullUserIdCleanup.recordsAffected,
                totalRecordsFixed: selfProposalCleanup.summary.invalidDataFixed + nullUserIdCleanup.summary.invalidDataFixed,
                totalOperations: selfProposalCleanup.summary.totalOperations + nullUserIdCleanup.summary.totalOperations,
                totalErrors: selfProposalCleanup.errors.length + nullUserIdCleanup.errors.length,
                totalWarnings: selfProposalCleanup.warnings.length + nullUserIdCleanup.warnings.length
            };

            logger.info('Comprehensive cleanup completed', {
                dryRun: options.dryRun,
                overallSummary
            });

            return {
                selfProposalCleanup,
                nullUserIdCleanup,
                overallSummary
            };

        } catch (error) {
            logger.error('Comprehensive cleanup failed', { error, options });
            throw error;
        }
    }

    /**
     * Verify cleanup results
     * Requirements: 3.4 - Ensure data integrity after cleanup
     */
    async verifyCleanupResults(): Promise<{
        remainingSelfProposals: number;
        remainingNullUserIds: number;
        dataIntegrityStatus: 'CLEAN' | 'ISSUES_REMAIN';
        issues: string[];
    }> {
        try {
            // Check for remaining self-proposals
            const selfProposalResult = await this.pool.query(
                'SELECT COUNT(*) as count FROM swaps WHERE proposer_id = owner_id'
            );
            const remainingSelfProposals = parseInt(selfProposalResult.rows[0].count);

            // Check for remaining null user IDs
            const nullUserIdResult = await this.pool.query(
                'SELECT COUNT(*) as count FROM swaps WHERE proposer_id IS NULL OR owner_id IS NULL'
            );
            const remainingNullUserIds = parseInt(nullUserIdResult.rows[0].count);

            const issues: string[] = [];

            if (remainingSelfProposals > 0) {
                issues.push(`${remainingSelfProposals} self-proposals still exist in the database`);
            }

            if (remainingNullUserIds > 0) {
                issues.push(`${remainingNullUserIds} swaps with null user IDs still exist`);
            }

            const dataIntegrityStatus = issues.length === 0 ? 'CLEAN' : 'ISSUES_REMAIN';

            logger.info('Cleanup verification completed', {
                remainingSelfProposals,
                remainingNullUserIds,
                dataIntegrityStatus,
                issuesCount: issues.length
            });

            return {
                remainingSelfProposals,
                remainingNullUserIds,
                dataIntegrityStatus,
                issues
            };

        } catch (error) {
            logger.error('Failed to verify cleanup results', { error });
            throw error;
        }
    }
}