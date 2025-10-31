import { Request, Response } from 'express';
import { SwapCompletionOrchestrator } from '../services/swap/SwapCompletionOrchestrator';
import { logger } from '../utils/logger';
import { validateUUID, validateDateRange, validatePaginationParams } from '../validation/common.js';

/**
 * SwapCompletionAuditController handles API endpoints for completion audit trail operations.
 * Provides access to completion history, statistics, and audit records.
 * 
 * Requirements: 6.1, 6.2, 6.3
 */
export class SwapCompletionAuditController {
    constructor(private readonly completionOrchestrator: SwapCompletionOrchestrator) { }

    /**
     * GET /api/completions/{completionId}/audit
     * Get completion audit record by proposal ID
     * 
     * Requirements: 6.1, 6.3
     */
    async getCompletionAudit(req: Request, res: Response): Promise<void> {
        try {
            const { proposalId } = req.params;

            // Validate proposal ID
            if (!proposalId || !validateUUID(proposalId)) {
                res.status(400).json({
                    error: 'Invalid proposal ID format',
                    code: 'INVALID_PROPOSAL_ID'
                });
                return;
            }

            logger.debug('Getting completion audit record', {
                proposalId,
                userId: req.user?.id
            });

            const auditRecord = await this.completionOrchestrator.getCompletionAuditRecord(proposalId);

            if (!auditRecord) {
                res.status(404).json({
                    error: 'Completion audit record not found',
                    code: 'AUDIT_RECORD_NOT_FOUND'
                });
                return;
            }

            // Check if user has permission to view this audit record
            // User must be either the initiator or involved in the completion
            const userId = req.user?.id;
            if (userId && auditRecord.initiatedBy !== userId) {
                // Additional permission check could be added here
                // For now, allow access if user is authenticated
            }

            res.json({
                success: true,
                data: auditRecord
            });

        } catch (error) {
            logger.error('Failed to get completion audit record', {
                proposalId: req.params.proposalId,
                userId: req.user?.id,
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                error: 'Failed to retrieve completion audit record',
                code: 'AUDIT_RETRIEVAL_FAILED'
            });
        }
    }

    /**
     * GET /api/completions/history
     * Query completion history with filtering and pagination
     * 
     * Requirements: 6.2, 6.3
     */
    async getCompletionHistory(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const {
                completionType,
                status,
                dateFrom,
                dateTo,
                limit = '50',
                offset = '0',
                includeValidationResults = 'false'
            } = req.query;

            // Validate query parameters
            const paginationValidation = validatePaginationParams(
                parseInt(limit as string),
                parseInt(offset as string)
            );

            if (!paginationValidation.isValid) {
                res.status(400).json({
                    error: paginationValidation.error,
                    code: 'INVALID_PAGINATION'
                });
                return;
            }

            // Validate date range if provided
            let parsedDateFrom: Date | undefined;
            let parsedDateTo: Date | undefined;

            if (dateFrom || dateTo) {
                const dateValidation = validateDateRange(
                    dateFrom as string,
                    dateTo as string
                );

                if (!dateValidation.isValid) {
                    res.status(400).json({
                        error: dateValidation.error,
                        code: 'INVALID_DATE_RANGE'
                    });
                    return;
                }

                parsedDateFrom = dateValidation.dateFrom;
                parsedDateTo = dateValidation.dateTo;
            }

            // Validate completion type
            if (completionType && !['booking_exchange', 'cash_payment'].includes(completionType as string)) {
                res.status(400).json({
                    error: 'Invalid completion type. Must be "booking_exchange" or "cash_payment"',
                    code: 'INVALID_COMPLETION_TYPE'
                });
                return;
            }

            // Validate status
            if (status && !['initiated', 'completed', 'failed', 'rolled_back'].includes(status as string)) {
                res.status(400).json({
                    error: 'Invalid status. Must be one of: initiated, completed, failed, rolled_back',
                    code: 'INVALID_STATUS'
                });
                return;
            }

            logger.debug('Querying completion history', {
                userId,
                completionType,
                status,
                dateFrom: parsedDateFrom,
                dateTo: parsedDateTo,
                limit: paginationValidation.limit,
                offset: paginationValidation.offset
            });

            const historyResult = await this.completionOrchestrator.queryCompletionHistory({
                userId,
                completionType: completionType as 'booking_exchange' | 'cash_payment' | undefined,
                status: status as 'initiated' | 'completed' | 'failed' | 'rolled_back' | undefined,
                dateFrom: parsedDateFrom,
                dateTo: parsedDateTo,
                limit: paginationValidation.limit,
                offset: paginationValidation.offset,
                includeValidationResults: includeValidationResults === 'true'
            });

            res.json({
                success: true,
                data: {
                    records: historyResult.records,
                    pagination: {
                        totalCount: historyResult.totalCount,
                        limit: paginationValidation.limit,
                        offset: paginationValidation.offset,
                        hasMore: historyResult.hasMore
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to query completion history', {
                userId: req.user?.id,
                query: req.query,
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                error: 'Failed to retrieve completion history',
                code: 'HISTORY_QUERY_FAILED'
            });
        }
    }

    /**
     * GET /api/completions/statistics
     * Get completion statistics for monitoring and reporting
     * 
     * Requirements: 6.2, 6.3
     */
    async getCompletionStatistics(req: Request, res: Response): Promise<void> {
        try {
            const userId = req.user?.id;
            const { dateFrom, dateTo, includeUserStats = 'false' } = req.query;

            // Validate date range if provided
            let parsedDateFrom: Date | undefined;
            let parsedDateTo: Date | undefined;

            if (dateFrom || dateTo) {
                const dateValidation = validateDateRange(
                    dateFrom as string,
                    dateTo as string
                );

                if (!dateValidation.isValid) {
                    res.status(400).json({
                        error: dateValidation.error,
                        code: 'INVALID_DATE_RANGE'
                    });
                    return;
                }

                parsedDateFrom = dateValidation.dateFrom;
                parsedDateTo = dateValidation.dateTo;
            }

            logger.debug('Getting completion statistics', {
                userId,
                dateFrom: parsedDateFrom,
                dateTo: parsedDateTo,
                includeUserStats: includeUserStats === 'true'
            });

            // Get overall statistics
            const overallStats = await this.completionOrchestrator.getCompletionStatistics({
                dateFrom: parsedDateFrom,
                dateTo: parsedDateTo
            });

            let userStats;
            if (includeUserStats === 'true' && userId) {
                // Get user-specific statistics
                userStats = await this.completionOrchestrator.getCompletionStatistics({
                    dateFrom: parsedDateFrom,
                    dateTo: parsedDateTo,
                    userId
                });
            }

            res.json({
                success: true,
                data: {
                    overall: overallStats,
                    user: userStats || null
                }
            });

        } catch (error) {
            logger.error('Failed to get completion statistics', {
                userId: req.user?.id,
                query: req.query,
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                error: 'Failed to retrieve completion statistics',
                code: 'STATISTICS_RETRIEVAL_FAILED'
            });
        }
    }

    /**
     * POST /api/completions/validate
     * Validate completion consistency for specific entities
     * 
     * Requirements: 6.1, 6.3
     */
    async validateCompletionConsistency(req: Request, res: Response): Promise<void> {
        try {
            const { swapIds, bookingIds, proposalIds } = req.body;

            // Validate input
            if (!swapIds && !bookingIds && !proposalIds) {
                res.status(400).json({
                    error: 'At least one of swapIds, bookingIds, or proposalIds must be provided',
                    code: 'MISSING_ENTITY_IDS'
                });
                return;
            }

            // Validate UUIDs
            const allIds = [
                ...(swapIds || []),
                ...(bookingIds || []),
                ...(proposalIds || [])
            ];

            for (const id of allIds) {
                if (!validateUUID(id)) {
                    res.status(400).json({
                        error: `Invalid UUID format: ${id}`,
                        code: 'INVALID_UUID_FORMAT'
                    });
                    return;
                }
            }

            logger.debug('Validating completion consistency', {
                userId: req.user?.id,
                swapIds: swapIds?.length || 0,
                bookingIds: bookingIds?.length || 0,
                proposalIds: proposalIds?.length || 0
            });

            // Get audit records for the specified entities
            const auditResult = await this.completionOrchestrator.getAuditRecordsForEntities({
                swapIds: swapIds as string[] | undefined,
                bookingIds: bookingIds as string[] | undefined,
                limit: 100 // Reasonable limit for validation
            });

            // For proposal IDs, get individual audit records
            let proposalAuditRecords = [];
            if (proposalIds && Array.isArray(proposalIds) && proposalIds.length > 0) {
                for (const proposalId of proposalIds as string[]) {
                    if (proposalId && validateUUID(proposalId)) {
                        const auditRecord = await this.completionOrchestrator.getCompletionAuditRecord(proposalId);
                        if (auditRecord) {
                            proposalAuditRecords.push(auditRecord);
                        }
                    }
                }
            }

            // Analyze consistency
            const allAuditRecords = [...auditResult.records, ...proposalAuditRecords];
            const consistencyAnalysis = this.analyzeCompletionConsistency(allAuditRecords);

            res.json({
                success: true,
                data: {
                    auditRecords: allAuditRecords,
                    consistencyAnalysis,
                    totalRecordsFound: allAuditRecords.length
                }
            });

        } catch (error) {
            logger.error('Failed to validate completion consistency', {
                userId: req.user?.id,
                body: req.body,
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                error: 'Failed to validate completion consistency',
                code: 'CONSISTENCY_VALIDATION_FAILED'
            });
        }
    }

    /**
     * GET /api/completions/entities/{entityType}/{entityId}/audit
     * Get audit records for a specific entity (swap or booking)
     * 
     * Requirements: 6.2, 6.3
     */
    async getEntityAuditRecords(req: Request, res: Response): Promise<void> {
        try {
            const { entityType, entityId } = req.params;
            const { limit = '10', offset = '0' } = req.query;

            // Validate entity type
            if (!entityType || !['swap', 'booking'].includes(entityType)) {
                res.status(400).json({
                    error: 'Invalid entity type. Must be "swap" or "booking"',
                    code: 'INVALID_ENTITY_TYPE'
                });
                return;
            }

            // Validate entity ID
            if (!entityId || !validateUUID(entityId)) {
                res.status(400).json({
                    error: 'Invalid entity ID format',
                    code: 'INVALID_ENTITY_ID'
                });
                return;
            }

            // Validate pagination
            const paginationValidation = validatePaginationParams(
                parseInt(limit as string),
                parseInt(offset as string)
            );

            if (!paginationValidation.isValid) {
                res.status(400).json({
                    error: paginationValidation.error,
                    code: 'INVALID_PAGINATION'
                });
                return;
            }

            logger.debug('Getting entity audit records', {
                entityType,
                entityId,
                userId: req.user?.id,
                limit: paginationValidation.limit,
                offset: paginationValidation.offset
            });

            const auditResult = await this.completionOrchestrator.getAuditRecordsForEntities({
                swapIds: entityType === 'swap' ? [entityId] : undefined,
                bookingIds: entityType === 'booking' ? [entityId] : undefined,
                limit: paginationValidation.limit,
                offset: paginationValidation.offset
            });

            res.json({
                success: true,
                data: {
                    records: auditResult.records,
                    pagination: {
                        totalCount: auditResult.totalCount,
                        limit: paginationValidation.limit,
                        offset: paginationValidation.offset,
                        hasMore: paginationValidation.offset + paginationValidation.limit < auditResult.totalCount
                    }
                }
            });

        } catch (error) {
            logger.error('Failed to get entity audit records', {
                entityType: req.params.entityType,
                entityId: req.params.entityId,
                userId: req.user?.id,
                error: error instanceof Error ? error.message : String(error)
            });

            res.status(500).json({
                error: 'Failed to retrieve entity audit records',
                code: 'ENTITY_AUDIT_RETRIEVAL_FAILED'
            });
        }
    }

    /**
     * Analyze completion consistency across multiple audit records
     * Identifies potential issues and inconsistencies
     */
    private analyzeCompletionConsistency(auditRecords: any[]): {
        isConsistent: boolean;
        issues: string[];
        warnings: string[];
        summary: {
            totalRecords: number;
            completedRecords: number;
            failedRecords: number;
            rolledBackRecords: number;
            recordsWithBlockchain: number;
            recordsWithValidationIssues: number;
        };
    } {
        const issues: string[] = [];
        const warnings: string[] = [];

        let completedRecords = 0;
        let failedRecords = 0;
        let rolledBackRecords = 0;
        let recordsWithBlockchain = 0;
        let recordsWithValidationIssues = 0;

        for (const record of auditRecords) {
            // Count record types
            switch (record.status) {
                case 'completed':
                    completedRecords++;
                    break;
                case 'failed':
                    failedRecords++;
                    break;
                case 'rolled_back':
                    rolledBackRecords++;
                    break;
            }

            // Check blockchain consistency
            if (record.blockchainTransactionId) {
                recordsWithBlockchain++;
            } else if (record.status === 'completed') {
                warnings.push(`Completed record ${record.id} missing blockchain transaction ID`);
            }

            // Check validation results
            if (record.postValidationResult && !record.postValidationResult.isValid) {
                recordsWithValidationIssues++;
                issues.push(`Record ${record.id} has post-validation issues: ${record.postValidationResult.errors?.join(', ')}`);
            }

            // Check for error details in completed records
            if (record.status === 'completed' && record.errorDetails) {
                warnings.push(`Completed record ${record.id} has error details: ${record.errorDetails}`);
            }

            // Check for missing error details in failed records
            if (record.status === 'failed' && !record.errorDetails) {
                warnings.push(`Failed record ${record.id} missing error details`);
            }
        }

        const isConsistent = issues.length === 0;

        return {
            isConsistent,
            issues,
            warnings,
            summary: {
                totalRecords: auditRecords.length,
                completedRecords,
                failedRecords,
                rolledBackRecords,
                recordsWithBlockchain,
                recordsWithValidationIssues
            }
        };
    }
}