import { Request, Response } from 'express';
import { SwapTargetingService } from '../services/swap/SwapTargetingService';
import { logger } from '../utils/logger';
import {
    TargetingResult,
    TargetingRequest,
    SwapTarget,
    TargetingHistory
} from '@booking-swap/shared';
import {
    TargetingError,
    TargetingErrorFactory,
    handleTargetingError,
    formatTargetingResponse,
    logTargetingOperation
} from '../utils/targetingErrorHandling';
import { TargetingAuthContext } from '../middleware/targetingAuth';

export class SwapTargetingController {
    constructor(
        private swapTargetingService: SwapTargetingService
    ) { }

    /**
     * Target a swap with the user's existing swap
     * Updated for simplified schema - works without proposal_id
     * POST /api/swaps/:id/target
     */
    targetSwap = async (req: Request, res: Response): Promise<void> => {
        const requestId = `target-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: targetSwapId } = req.params;
            const { sourceSwapId, message, conditions } = req.body;

            // Validate required fields
            if (!targetSwapId) {
                throw TargetingErrorFactory.createValidationError('Target swap ID is required');
            }

            if (!sourceSwapId) {
                throw TargetingErrorFactory.createValidationError('Source swap ID is required');
            }

            logTargetingOperation('target_swap_initiated', true, requestId, userId, 0, {
                sourceSwapId,
                targetSwapId,
                hasMessage: !!message,
                conditionsCount: conditions?.length || 0
            });

            const result = await this.swapTargetingService.targetSwap(
                sourceSwapId,
                targetSwapId,
                userId
            );

            const executionTime = Date.now() - startTime;

            if (result.success) {
                const responseData = {
                    targeting: {
                        id: result.targetId,
                        sourceSwapId,
                        targetSwapId,
                        // proposalId removed in simplified schema - derived from sourceSwapId
                        status: 'active' as const,
                        createdAt: new Date().toISOString(),
                        // Enhanced metadata for simplified schema
                        relationshipsSource: 'derived_from_source_swap'
                    }
                };

                logTargetingOperation('target_swap', true, requestId, userId, executionTime, {
                    sourceSwapId,
                    targetSwapId,
                    targetId: result.targetId,
                    // proposalId removed in simplified schema
                    schemaVersion: 'simplified'
                });

                const response = formatTargetingResponse(
                    true,
                    requestId,
                    executionTime,
                    responseData,
                    undefined,
                    result.warnings
                );

                // Add simplified schema metadata to response
                response.metadata = {
                    ...response.metadata,
                    schemaVersion: 'simplified',
                    relationshipsSource: 'derived_from_source_swap',
                    redundantFieldsRemoved: ['proposal_id']
                };

                res.status(201).json(response);
            } else {
                logTargetingOperation('target_swap', false, requestId, userId, executionTime, {
                    sourceSwapId,
                    targetSwapId,
                    error: result.error
                });

                const targetingError = TargetingErrorFactory.createValidationError(
                    result.error || 'Failed to target swap'
                );

                const response = formatTargetingResponse(
                    false,
                    requestId,
                    executionTime,
                    undefined,
                    targetingError
                );

                res.status(targetingError.statusCode).json(response);
            }
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'target_swap',
                req.user?.id,
                {
                    targetSwapId: req.params.id,
                    sourceSwapId: req.body.sourceSwapId
                }
            );
        }
    };

    /**
     * Retarget a swap to a different target
     * Updated for simplified schema - works without proposal_id
     * PUT /api/swaps/:id/retarget
     */
    retargetSwap = async (req: Request, res: Response): Promise<void> => {
        const requestId = `retarget-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: newTargetSwapId } = req.params;
            const { sourceSwapId } = req.body;

            if (!newTargetSwapId) {
                throw TargetingErrorFactory.createValidationError('New target swap ID is required');
            }

            if (!sourceSwapId) {
                throw TargetingErrorFactory.createValidationError('Source swap ID is required');
            }

            const result = await this.swapTargetingService.retargetSwap(
                sourceSwapId,
                newTargetSwapId,
                userId
            );

            const executionTime = Date.now() - startTime;

            if (result.success) {
                const responseData = {
                    targeting: {
                        id: result.targetId,
                        sourceSwapId,
                        targetSwapId: newTargetSwapId,
                        // proposalId removed in simplified schema - derived from sourceSwapId
                        status: 'active' as const,
                        updatedAt: new Date().toISOString(),
                        // Enhanced metadata for simplified schema
                        relationshipsSource: 'derived_from_source_swap'
                    }
                };

                const response = formatTargetingResponse(
                    true,
                    requestId,
                    executionTime,
                    responseData,
                    undefined,
                    result.warnings
                );

                // Add simplified schema metadata to response
                response.metadata = {
                    ...response.metadata,
                    schemaVersion: 'simplified',
                    relationshipsSource: 'derived_from_source_swap',
                    redundantFieldsRemoved: ['proposal_id']
                };

                res.json(response);
            } else {
                const targetingError = TargetingErrorFactory.createValidationError(
                    result.error || 'Failed to retarget swap'
                );

                const response = formatTargetingResponse(
                    false,
                    requestId,
                    executionTime,
                    undefined,
                    targetingError
                );

                res.status(targetingError.statusCode).json(response);
            }
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'retarget_swap',
                req.user?.id,
                {
                    newTargetSwapId: req.params.id,
                    sourceSwapId: req.body.sourceSwapId
                }
            );
        }
    };

    /**
     * Remove targeting from a swap
     * Updated for simplified schema - works without proposal_id
     * DELETE /api/swaps/:id/target
     */
    removeTarget = async (req: Request, res: Response): Promise<void> => {
        const requestId = `remove-target-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { sourceSwapId } = req.body;

            if (!sourceSwapId) {
                throw TargetingErrorFactory.createValidationError('Source swap ID is required');
            }

            await this.swapTargetingService.removeTarget(sourceSwapId, userId);

            const executionTime = Date.now() - startTime;

            const responseData = {
                message: 'Targeting removed successfully',
                // Enhanced metadata for simplified schema
                schemaVersion: 'simplified',
                relationshipsSource: 'derived_from_source_swap'
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            // Add simplified schema metadata to response
            response.metadata = {
                ...response.metadata,
                schemaVersion: 'simplified',
                relationshipsSource: 'derived_from_source_swap',
                redundantFieldsRemoved: ['proposal_id']
            };

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'remove_target',
                req.user?.id,
                {
                    sourceSwapId: req.body.sourceSwapId
                }
            );
        }
    };

    /**
     * Get current targeting status for a swap
     * GET /api/swaps/:id/targeting-status
     */
    getTargetingStatus = async (req: Request, res: Response): Promise<void> => {
        const requestId = `targeting-status-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: swapId } = req.params;

            if (!swapId) {
                throw TargetingErrorFactory.createValidationError('Swap ID is required');
            }

            const targetingStatus = await this.swapTargetingService.getSwapTarget(swapId);

            const executionTime = Date.now() - startTime;

            const responseData = {
                targeting: targetingStatus,
                hasActiveTargeting: !!targetingStatus && targetingStatus.status === 'active'
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'get_targeting_status',
                req.user?.id,
                {
                    swapId: req.params.id
                }
            );
        }
    };

    /**
     * Check if a swap can be targeted by the user
     * GET /api/swaps/:id/can-target
     */
    canTargetSwap = async (req: Request, res: Response): Promise<void> => {
        const requestId = `can-target-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: targetSwapId } = req.params;

            if (!targetSwapId) {
                throw TargetingErrorFactory.createValidationError('Target swap ID is required');
            }

            const canTarget = await this.swapTargetingService.canTargetSwap(targetSwapId, userId);

            const executionTime = Date.now() - startTime;

            const responseData = {
                canTarget,
                targetSwapId,
                userId
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'can_target_check',
                req.user?.id,
                {
                    targetSwapId: req.params.id
                }
            );
        }
    };

    /**
     * Get targeting history for a swap
     * GET /api/swaps/:id/targeting-history
     */
    getTargetingHistory = async (req: Request, res: Response): Promise<void> => {
        const requestId = `targeting-history-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: swapId } = req.params;
            const { limit = '50', offset = '0' } = req.query;

            if (!swapId) {
                throw TargetingErrorFactory.createValidationError('Swap ID is required');
            }

            const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
            const parsedOffset = parseInt(offset as string) || 0;

            const history = await this.swapTargetingService.getTargetingHistory(swapId);

            // Apply pagination to the history
            const paginatedHistory = history.slice(parsedOffset, parsedOffset + parsedLimit);

            const executionTime = Date.now() - startTime;

            const responseData = {
                history: paginatedHistory,
                pagination: {
                    limit: parsedLimit,
                    offset: parsedOffset,
                    total: history.length,
                    hasMore: parsedOffset + parsedLimit < history.length
                }
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'get_targeting_history',
                req.user?.id,
                {
                    swapId: req.params.id
                }
            );
        }
    };

    /**
     * Get user's targeting activity
     * GET /api/users/:id/targeting-activity
     */
    getUserTargetingActivity = async (req: Request, res: Response): Promise<void> => {
        const requestId = `user-targeting-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: requestedUserId } = req.params;
            const { limit = '50', offset = '0' } = req.query;

            // Users can only view their own targeting activity unless they're admin
            const isAdmin = (req.user as any)?.isAdmin || false;
            if (requestedUserId !== userId && !isAdmin) {
                throw TargetingErrorFactory.createForbiddenError('Cannot access other users targeting activity');
            }

            const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
            const parsedOffset = parseInt(offset as string) || 0;

            const activity = await this.swapTargetingService.getSwapsTargetingMe(requestedUserId!);

            // Apply pagination
            const paginatedActivity = activity.slice(parsedOffset, parsedOffset + parsedLimit);

            const executionTime = Date.now() - startTime;

            const responseData = {
                targetingActivity: paginatedActivity,
                pagination: {
                    limit: parsedLimit,
                    offset: parsedOffset,
                    total: activity.length,
                    hasMore: parsedOffset + parsedLimit < activity.length
                }
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'get_user_targeting_activity',
                req.user?.id,
                {
                    requestedUserId: req.params.id
                }
            );
        }
    };

    /**
     * Get swaps that are targeting the current swap
     * GET /api/swaps/:id/targeted-by
     */
    getSwapsTargetingMe = async (req: Request, res: Response): Promise<void> => {
        const requestId = `targeted-by-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const startTime = Date.now();

        try {
            const userId = req.user?.id;
            if (!userId) {
                throw TargetingErrorFactory.createUnauthorizedError();
            }

            const { id: swapId } = req.params;
            const { limit = '50', offset = '0' } = req.query;

            if (!swapId) {
                throw TargetingErrorFactory.createValidationError('Swap ID is required');
            }

            const parsedLimit = Math.min(parseInt(limit as string) || 50, 100);
            const parsedOffset = parseInt(offset as string) || 0;

            // Get all swaps targeting this swap
            const targetingSwaps = await this.swapTargetingService.getSwapsTargetingMe(userId);

            // Filter for the specific swap and apply pagination
            const swapTargets = targetingSwaps.filter((target: SwapTarget) => target.targetSwapId === swapId);
            const paginatedTargets = swapTargets.slice(parsedOffset, parsedOffset + parsedLimit);

            const executionTime = Date.now() - startTime;

            const responseData = {
                targetingSwaps: paginatedTargets,
                pagination: {
                    limit: parsedLimit,
                    offset: parsedOffset,
                    total: swapTargets.length,
                    hasMore: parsedOffset + parsedLimit < swapTargets.length
                }
            };

            const response = formatTargetingResponse(
                true,
                requestId,
                executionTime,
                responseData
            );

            res.json(response);
        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            handleTargetingError(
                error,
                res,
                requestId,
                executionTime,
                'get_swaps_targeting_me',
                req.user?.id,
                {
                    swapId: req.params.id
                }
            );
        }
    };
}