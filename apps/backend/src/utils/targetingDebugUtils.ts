import { Pool } from 'pg';
import { SwapTargetingRepository } from '../database/repositories/SwapTargetingRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { logger } from './logger';

export interface TargetingDataSnapshot {
    timestamp: string;
    userId: string;
    rawDatabaseData: {
        swapTargetsTable: any[];
        swapsTable: any[];
        bookingsTable: any[];
    };
    transformedData: {
        incomingTargets: any[];
        outgoingTargets: any[];
    };
    validationResults: {
        dataIntegrity: boolean;
        missingReferences: string[];
        inconsistencies: string[];
    };
    performanceMetrics: {
        queryExecutionTime: number;
        transformationTime: number;
        totalExecutionTime: number;
    };
}

export interface DataConsistencyReport {
    swapTargetsCount: number;
    swapsCount: number;
    bookingsCount: number;
    orphanedTargets: any[];
    missingBookings: any[];
    inconsistentStatuses: any[];
    duplicateTargets: any[];
}

export class TargetingDebugUtils {
    constructor(
        private pool: Pool,
        private swapTargetingRepository: SwapTargetingRepository,
        private swapRepository: SwapRepository
    ) { }

    /**
     * Create a comprehensive snapshot of targeting data for debugging
     */
    async createTargetingDataSnapshot(userId: string): Promise<TargetingDataSnapshot> {
        const startTime = Date.now();

        try {
            logger.info('Creating targeting data snapshot', { userId });

            // Step 1: Get raw database data
            const rawDataStartTime = Date.now();
            const rawData = await this.getRawDatabaseData(userId);
            const rawDataTime = Date.now() - rawDataStartTime;

            // Step 2: Get transformed data using the repository method
            const transformStartTime = Date.now();
            const transformedData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);
            const transformTime = Date.now() - transformStartTime;

            // Step 3: Validate data consistency
            const validationResults = await this.validateDataConsistency(rawData, transformedData);

            const totalTime = Date.now() - startTime;

            const snapshot: TargetingDataSnapshot = {
                timestamp: new Date().toISOString(),
                userId,
                rawDatabaseData: rawData,
                transformedData,
                validationResults,
                performanceMetrics: {
                    queryExecutionTime: rawDataTime,
                    transformationTime: transformTime,
                    totalExecutionTime: totalTime
                }
            };

            logger.info('Targeting data snapshot created', {
                userId,
                totalTime,
                incomingCount: transformedData.incomingTargets.length,
                outgoingCount: transformedData.outgoingTargets.length,
                hasInconsistencies: validationResults.inconsistencies.length > 0
            });

            return snapshot;
        } catch (error) {
            logger.error('Failed to create targeting data snapshot', { error, userId });
            throw error;
        }
    }

    /**
     * Get raw database data for comparison
     */
    private async getRawDatabaseData(userId: string): Promise<{
        swapTargetsTable: any[];
        swapsTable: any[];
        bookingsTable: any[];
    }> {
        try {
            // Get all swap_targets entries related to user
            const swapTargetsQuery = `
        SELECT st.*, 
               ss.owner_id as source_owner_id,
               ts.owner_id as target_owner_id
        FROM swap_targets st
        LEFT JOIN swaps ss ON st.source_swap_id = ss.id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        WHERE ss.owner_id = $1 OR ts.owner_id = $1
        ORDER BY st.created_at DESC
      `;

            // Get all swaps related to user
            const swapsQuery = `
        SELECT s.*, 
               sb.title as source_booking_title,
               tb.title as target_booking_title,
               u.display_name as proposer_name
        FROM swaps s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN bookings tb ON s.target_booking_id = tb.id
        LEFT JOIN users u ON s.proposer_id = u.id
        WHERE s.owner_id = $1 OR s.proposer_id = $1 OR sb.user_id = $1 OR tb.user_id = $1
        ORDER BY s.created_at DESC
      `;

            // Get all bookings related to user
            const bookingsQuery = `
        SELECT b.*, u.display_name as owner_name
        FROM bookings b
        JOIN users u ON b.user_id = u.id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC
      `;

            const [swapTargetsResult, swapsResult, bookingsResult] = await Promise.all([
                this.pool.query(swapTargetsQuery, [userId]),
                this.pool.query(swapsQuery, [userId]),
                this.pool.query(bookingsQuery, [userId])
            ]);

            return {
                swapTargetsTable: swapTargetsResult.rows,
                swapsTable: swapsResult.rows,
                bookingsTable: bookingsResult.rows
            };
        } catch (error) {
            logger.error('Failed to get raw database data', { error, userId });
            throw error;
        }
    }

    /**
     * Validate data consistency between raw and transformed data
     */
    private async validateDataConsistency(
        rawData: any,
        transformedData: any
    ): Promise<{
        dataIntegrity: boolean;
        missingReferences: string[];
        inconsistencies: string[];
    }> {
        const missingReferences: string[] = [];
        const inconsistencies: string[] = [];

        try {
            // Check if all swap_targets entries are represented in transformed data
            const transformedTargetIds = new Set([
                ...transformedData.incomingTargets.map((t: any) => t.targetId),
                ...transformedData.outgoingTargets.map((t: any) => t.targetId)
            ]);

            for (const rawTarget of rawData.swapTargetsTable) {
                if (!transformedTargetIds.has(rawTarget.id)) {
                    missingReferences.push(`swap_target ${rawTarget.id} not found in transformed data`);
                }
            }

            // Check for missing booking references
            for (const target of transformedData.incomingTargets) {
                const hasBooking = rawData.bookingsTable.some((b: any) =>
                    b.id === target.sourceSwapDetails.bookingId
                );
                if (!hasBooking) {
                    missingReferences.push(`Booking ${target.sourceSwapDetails.bookingId} not found for incoming target ${target.targetId}`);
                }
            }

            for (const target of transformedData.outgoingTargets) {
                const hasBooking = rawData.bookingsTable.some((b: any) =>
                    b.id === target.targetSwapDetails.bookingId
                );
                if (!hasBooking) {
                    missingReferences.push(`Booking ${target.targetSwapDetails.bookingId} not found for outgoing target ${target.targetId}`);
                }
            }

            // Check for status inconsistencies
            for (const rawTarget of rawData.swapTargetsTable) {
                const transformedTarget = [
                    ...transformedData.incomingTargets,
                    ...transformedData.outgoingTargets
                ].find((t: any) => t.targetId === rawTarget.id);

                if (transformedTarget && transformedTarget.status !== rawTarget.status) {
                    inconsistencies.push(`Status mismatch for target ${rawTarget.id}: raw=${rawTarget.status}, transformed=${transformedTarget.status}`);
                }
            }

            const dataIntegrity = missingReferences.length === 0 && inconsistencies.length === 0;

            return {
                dataIntegrity,
                missingReferences,
                inconsistencies
            };
        } catch (error) {
            logger.error('Failed to validate data consistency', { error });
            return {
                dataIntegrity: false,
                missingReferences: ['Validation failed due to error'],
                inconsistencies: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }

    /**
     * Generate comprehensive data consistency report
     */
    async generateDataConsistencyReport(): Promise<DataConsistencyReport> {
        try {
            logger.info('Generating data consistency report');

            // Count records in each table
            const countsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM swap_targets) as swap_targets_count,
          (SELECT COUNT(*) FROM swaps) as swaps_count,
          (SELECT COUNT(*) FROM bookings) as bookings_count
      `;

            // Find orphaned targets (targets with missing swap references)
            const orphanedTargetsQuery = `
        SELECT st.* 
        FROM swap_targets st
        LEFT JOIN swaps ss ON st.source_swap_id = ss.id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        WHERE ss.id IS NULL OR ts.id IS NULL
      `;

            // Find swaps with missing booking references
            const missingBookingsQuery = `
        SELECT s.id, s.source_booking_id, s.target_booking_id
        FROM swaps s
        LEFT JOIN bookings sb ON s.source_booking_id = sb.id
        LEFT JOIN bookings tb ON s.target_booking_id = tb.id
        WHERE sb.id IS NULL OR (s.target_booking_id IS NOT NULL AND tb.id IS NULL)
      `;

            // Find inconsistent statuses
            const inconsistentStatusesQuery = `
        SELECT st.id, st.status as target_status, s.status as swap_status
        FROM swap_targets st
        JOIN swaps s ON st.proposal_id = s.id
        WHERE st.status != CASE 
          WHEN s.status = 'pending' THEN 'active'
          ELSE s.status
        END
      `;

            // Find duplicate targets (same source targeting same target)
            const duplicateTargetsQuery = `
        SELECT source_swap_id, target_swap_id, COUNT(*) as count
        FROM swap_targets
        WHERE status = 'active'
        GROUP BY source_swap_id, target_swap_id
        HAVING COUNT(*) > 1
      `;

            const [
                countsResult,
                orphanedResult,
                missingBookingsResult,
                inconsistentStatusesResult,
                duplicateTargetsResult
            ] = await Promise.all([
                this.pool.query(countsQuery),
                this.pool.query(orphanedTargetsQuery),
                this.pool.query(missingBookingsQuery),
                this.pool.query(inconsistentStatusesQuery),
                this.pool.query(duplicateTargetsQuery)
            ]);

            const report: DataConsistencyReport = {
                swapTargetsCount: parseInt(countsResult.rows[0].swap_targets_count),
                swapsCount: parseInt(countsResult.rows[0].swaps_count),
                bookingsCount: parseInt(countsResult.rows[0].bookings_count),
                orphanedTargets: orphanedResult.rows,
                missingBookings: missingBookingsResult.rows,
                inconsistentStatuses: inconsistentStatusesResult.rows,
                duplicateTargets: duplicateTargetsResult.rows
            };

            logger.info('Data consistency report generated', {
                swapTargetsCount: report.swapTargetsCount,
                orphanedCount: report.orphanedTargets.length,
                missingBookingsCount: report.missingBookings.length,
                inconsistentStatusesCount: report.inconsistentStatuses.length,
                duplicateTargetsCount: report.duplicateTargets.length
            });

            return report;
        } catch (error) {
            logger.error('Failed to generate data consistency report', { error });
            throw error;
        }
    }

    /**
     * Compare swap_targets table data with displayed results
     */
    async compareTableDataWithDisplay(userId: string): Promise<{
        tableData: any[];
        displayData: any[];
        missingFromDisplay: any[];
        extraInDisplay: any[];
        differences: any[];
    }> {
        try {
            logger.info('Comparing table data with display data', { userId });

            // Get direct table data
            const tableQuery = `
        SELECT st.*, 
               ss.owner_id as source_owner_id,
               ts.owner_id as target_owner_id,
               sb.title as source_booking_title,
               tb.title as target_booking_title
        FROM swap_targets st
        LEFT JOIN swaps ss ON st.source_swap_id = ss.id
        LEFT JOIN swaps ts ON st.target_swap_id = ts.id
        LEFT JOIN bookings sb ON ss.source_booking_id = sb.id
        LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
        WHERE (ss.owner_id = $1 OR ts.owner_id = $1) AND st.status = 'active'
        ORDER BY st.created_at DESC
      `;

            const tableResult = await this.pool.query(tableQuery, [userId]);
            const tableData = tableResult.rows;

            // Get display data (what the user actually sees)
            const displayData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);
            const allDisplayTargets = [
                ...displayData.incomingTargets,
                ...displayData.outgoingTargets
            ];

            // Find missing from display
            const displayTargetIds = new Set(allDisplayTargets.map(t => t.targetId));
            const missingFromDisplay = tableData.filter(t => !displayTargetIds.has(t.id));

            // Find extra in display (shouldn't happen but good to check)
            const tableTargetIds = new Set(tableData.map(t => t.id));
            const extraInDisplay = allDisplayTargets.filter(t => !tableTargetIds.has(t.targetId));

            // Find differences in data
            const differences: any[] = [];
            for (const tableTarget of tableData) {
                const displayTarget = allDisplayTargets.find(t => t.targetId === tableTarget.id);
                if (displayTarget) {
                    if (displayTarget.status !== tableTarget.status) {
                        differences.push({
                            targetId: tableTarget.id,
                            field: 'status',
                            tableValue: tableTarget.status,
                            displayValue: displayTarget.status
                        });
                    }
                }
            }

            logger.info('Table vs display comparison completed', {
                userId,
                tableCount: tableData.length,
                displayCount: allDisplayTargets.length,
                missingCount: missingFromDisplay.length,
                extraCount: extraInDisplay.length,
                differencesCount: differences.length
            });

            return {
                tableData,
                displayData: allDisplayTargets,
                missingFromDisplay,
                extraInDisplay,
                differences
            };
        } catch (error) {
            logger.error('Failed to compare table data with display', { error, userId });
            throw error;
        }
    }

    /**
     * Log targeting data transformation steps for debugging
     */
    async logTransformationSteps(userId: string): Promise<void> {
        try {
            logger.info('=== TARGETING DATA TRANSFORMATION DEBUG ===', { userId });

            // Step 1: Log raw query results
            const rawData = await this.getRawDatabaseData(userId);
            logger.info('Step 1: Raw database data retrieved', {
                userId,
                swapTargetsCount: rawData.swapTargetsTable.length,
                swapsCount: rawData.swapsTable.length,
                bookingsCount: rawData.bookingsTable.length,
                swapTargets: rawData.swapTargetsTable.map(st => ({
                    id: st.id,
                    sourceSwapId: st.source_swap_id,
                    targetSwapId: st.target_swap_id,
                    status: st.status,
                    sourceOwnerId: st.source_owner_id,
                    targetOwnerId: st.target_owner_id
                }))
            });

            // Step 2: Log transformation process
            logger.info('Step 2: Starting data transformation');
            const transformedData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);

            logger.info('Step 3: Transformation completed', {
                userId,
                incomingTargetsCount: transformedData.incomingTargets.length,
                outgoingTargetsCount: transformedData.outgoingTargets.length,
                incomingTargets: transformedData.incomingTargets.map(t => ({
                    targetId: t.targetId,
                    sourceSwapId: t.sourceSwapId,
                    targetSwapId: t.targetSwapId,
                    status: t.status,
                    ownerName: t.sourceSwapDetails.ownerName
                })),
                outgoingTargets: transformedData.outgoingTargets.map(t => ({
                    targetId: t.targetId,
                    sourceSwapId: t.sourceSwapId,
                    targetSwapId: t.targetSwapId,
                    status: t.status,
                    ownerName: t.targetSwapDetails.ownerName
                }))
            });

            // Step 3: Log validation results
            const validationResults = await this.validateDataConsistency(rawData, transformedData);
            logger.info('Step 4: Data validation completed', {
                userId,
                dataIntegrity: validationResults.dataIntegrity,
                missingReferencesCount: validationResults.missingReferences.length,
                inconsistenciesCount: validationResults.inconsistencies.length,
                missingReferences: validationResults.missingReferences,
                inconsistencies: validationResults.inconsistencies
            });

            logger.info('=== TARGETING DATA TRANSFORMATION DEBUG COMPLETE ===', { userId });
        } catch (error) {
            logger.error('Failed to log transformation steps', { error, userId });
            throw error;
        }
    }
}