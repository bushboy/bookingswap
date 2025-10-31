import { Request, Response } from 'express';
import { SwapCompletionOrchestrator } from '../services/swap/SwapCompletionOrchestrator';
import { CompletionValidationService } from '../services/swap/CompletionValidationService';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { logger } from '../utils/logger';
import { handleSwapError, generateRequestId, SWAP_ERROR_CODES } from '../utils/swap-error-handler';

/**
 * Controller for swap completion operations
 * Handles completion status queries and validation endpoints
 * 
 * Requirements: 1.1, 5.1, 6.1
 */
export class CompletionController {
    constructor(
        private completionOrchestrator: SwapCompletionOrchestrator,
        private completionValidationService: CompletionValidationService,
        private swapRepository: SwapRepository
    ) { }

    /**
     * Get completion status for a swap
     * GET /api/swaps/:swapId/completion-status
     */
    getSwapCompletionStatus = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-swap-completion-status');

        try {
            const { swapId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getSwapCompletionStatus',
                        requestId,
                        requestData: { swapId }
                    }
                );
                return;
            }

            // swapId is validated by middleware, so it's guaranteed to be a string
            const validatedSwapId = swapId as string;

            logger.info('Getting swap completion status', {
                requestId,
                userId,
                swapId: validatedSwapId
            });

            // Get the swap to check if user has access
            const swap = await this.swapRepository.findById(validatedSwapId);

            if (!swap) {
                const notFoundError = new Error('Swap not found');
                (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
                handleSwapError(notFoundError, res, {
                    operation: 'getSwapCompletionStatus',
                    userId,
                    requestId,
                    requestData: { swapId }
                });
                return;
            }

            // Check if user has access to this swap
            // For now, simplified access check - would need proper authorization logic
            const hasAccess = true; // Would check if user is involved in the swap

            if (!hasAccess) {
                const forbiddenError = new Error('Access denied to swap completion status');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getSwapCompletionStatus',
                    userId,
                    requestId,
                    requestData: { swapId }
                });
                return;
            }

            // Get completion status from the swap's completion data
            const completionStatus = {
                swapId: swap.id,
                status: swap.status,
                isCompleted: swap.status === 'completed',
                completedAt: swap.completion?.completedAt,
                completedBy: swap.completion?.completedBy,
                completionTransactionId: swap.completion?.completionTransactionId,
                relatedSwapCompletions: swap.completion?.relatedSwapCompletions || [],
                blockchainCompletionId: swap.completion?.blockchainCompletionId,
                timeline: swap.timeline,
                lastUpdated: swap.updatedAt
            };

            logger.info('Swap completion status retrieved successfully', {
                requestId,
                userId,
                swapId: validatedSwapId,
                isCompleted: completionStatus.isCompleted,
                status: completionStatus.status
            });

            res.status(200).json({
                success: true,
                data: completionStatus,
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getSwapCompletionStatus',
                userId: req.user?.id,
                requestId,
                requestData: { swapId: req.params.swapId }
            });
        }
    };

    /**
     * Get completion audit record
     * GET /api/completions/:completionId/audit
     */
    getCompletionAudit = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('get-completion-audit');

        try {
            const { completionId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'getCompletionAudit',
                        requestId,
                        requestData: { completionId }
                    }
                );
                return;
            }

            // completionId is validated by middleware, so it's guaranteed to be a string
            const validatedCompletionId = completionId as string;

            logger.info('Getting completion audit record', {
                requestId,
                userId,
                completionId: validatedCompletionId
            });

            // Get audit record using completion ID as proposal ID
            const auditRecord = await this.completionOrchestrator.getCompletionAuditRecord(validatedCompletionId);

            if (!auditRecord) {
                const notFoundError = new Error('Completion audit record not found');
                (notFoundError as any).code = SWAP_ERROR_CODES.BOOKING_NOT_FOUND;
                handleSwapError(notFoundError, res, {
                    operation: 'getCompletionAudit',
                    userId,
                    requestId,
                    requestData: { completionId }
                });
                return;
            }

            // Check if user has access to this audit record
            // For now, simplified access check - would need proper authorization logic
            const hasAccess = true; // Would check if user was involved in the completion

            if (!hasAccess) {
                const forbiddenError = new Error('Access denied to completion audit record');
                (forbiddenError as any).code = SWAP_ERROR_CODES.BOOKING_ACCESS_DENIED;
                handleSwapError(forbiddenError, res, {
                    operation: 'getCompletionAudit',
                    userId,
                    requestId,
                    requestData: { completionId }
                });
                return;
            }

            logger.info('Completion audit record retrieved successfully', {
                requestId,
                userId,
                completionId: validatedCompletionId,
                auditStatus: auditRecord.status,
                completionType: auditRecord.completionType
            });

            res.status(200).json({
                success: true,
                data: auditRecord,
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'getCompletionAudit',
                userId: req.user?.id,
                requestId,
                requestData: { completionId: req.params.completionId }
            });
        }
    };

    /**
     * Validate completion consistency
     * POST /api/completions/validate
     */
    validateCompletionConsistency = async (req: Request, res: Response): Promise<void> => {
        const requestId = generateRequestId('validate-completion-consistency');

        try {
            const { swapIds, bookingIds, proposalIds } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                handleSwapError(
                    new Error('User authentication required'),
                    res,
                    {
                        operation: 'validateCompletionConsistency',
                        requestId,
                        requestData: { swapIds, bookingIds, proposalIds }
                    }
                );
                return;
            }

            logger.info('Validating completion consistency', {
                requestId,
                userId,
                swapIdsCount: swapIds?.length || 0,
                bookingIdsCount: bookingIds?.length || 0,
                proposalIdsCount: proposalIds?.length || 0
            });

            // Collect entities for validation
            const entities: any = {
                swaps: [],
                bookings: [],
                proposals: []
            };

            // Get swaps if provided
            if (swapIds && swapIds.length > 0) {
                for (const swapId of swapIds) {
                    const swap = await this.swapRepository.findById(swapId);
                    if (swap) {
                        entities.swaps.push(swap);
                    }
                }
            }

            // For bookings and proposals, we would need additional repositories
            // For now, we'll validate what we have

            // Perform validation using the completion validation service
            const validationResult = await this.completionValidationService.validatePreCompletion(entities);

            logger.info('Completion consistency validation completed', {
                requestId,
                userId,
                isValid: validationResult.isValid,
                errorCount: validationResult.errors.length,
                warningCount: validationResult.warnings.length,
                inconsistentEntitiesCount: validationResult.inconsistentEntities.length
            });

            res.status(200).json({
                success: true,
                data: {
                    validation: validationResult,
                    entitiesChecked: {
                        swaps: entities.swaps.length,
                        bookings: entities.bookings.length,
                        proposals: entities.proposals.length
                    }
                },
                requestId,
                timestamp: new Date().toISOString()
            });

        } catch (error: any) {
            handleSwapError(error, res, {
                operation: 'validateCompletionConsistency',
                userId: req.user?.id,
                requestId,
                requestData: {
                    swapIdsCount: req.body.swapIds?.length || 0,
                    bookingIdsCount: req.body.bookingIds?.length || 0,
                    proposalIdsCount: req.body.proposalIds?.length || 0
                }
            });
        }
    };
}