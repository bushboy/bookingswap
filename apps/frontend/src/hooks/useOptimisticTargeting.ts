import { useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store';
import { createTargetingActionsService, TargetingActionsService } from '@/services/targetingActionsService';

interface UseOptimisticTargetingOptions {
    enableOptimisticUpdates?: boolean;
    showLoadingStates?: boolean;
    retryOnFailure?: boolean;
    maxRetries?: number;
}

interface UseOptimisticTargetingReturn {
    createTargetingProposal: (
        sourceSwapId: string,
        targetSwapId: string
    ) => Promise<{ success: boolean; targetId?: string; error?: string }>;

    acceptTargetingProposal: (
        swapId: string,
        targetId: string,
        proposalId: string
    ) => Promise<{ success: boolean; error?: string }>;

    rejectTargetingProposal: (
        swapId: string,
        targetId: string,
        proposalId: string,
        reason?: string
    ) => Promise<{ success: boolean; error?: string }>;

    cancelTargeting: (
        swapId: string,
        targetId: string
    ) => Promise<{ success: boolean; error?: string }>;

    retargetSwap: (
        sourceSwapId: string,
        currentTargetId: string,
        newTargetSwapId: string
    ) => Promise<{ success: boolean; targetId?: string; error?: string }>;

    isActionPending: (actionType: string, targetId?: string) => boolean;
    getPendingActions: () => any[];
    clearPendingActions: () => void;
}

/**
 * Hook for performing targeting actions with optimistic updates
 * Provides immediate UI feedback while API calls are in progress
 */
export const useOptimisticTargeting = (
    options: UseOptimisticTargetingOptions = {}
): UseOptimisticTargetingReturn => {
    const dispatch = useDispatch<AppDispatch>();

    // Create targeting actions service instance
    const targetingService = useMemo(() => {
        return createTargetingActionsService(dispatch);
    }, [dispatch]);

    const defaultOptions = {
        enableOptimisticUpdates: true,
        showLoadingStates: true,
        retryOnFailure: true,
        maxRetries: 3,
        ...options,
    };

    const createTargetingProposal = useCallback(
        async (sourceSwapId: string, targetSwapId: string) => {
            return targetingService.createTargetingProposal(
                sourceSwapId,
                targetSwapId,
                defaultOptions
            );
        },
        [targetingService, defaultOptions]
    );

    const acceptTargetingProposal = useCallback(
        async (swapId: string, targetId: string, proposalId: string) => {
            return targetingService.acceptTargetingProposal(
                swapId,
                targetId,
                proposalId,
                defaultOptions
            );
        },
        [targetingService, defaultOptions]
    );

    const rejectTargetingProposal = useCallback(
        async (swapId: string, targetId: string, proposalId: string, reason?: string) => {
            return targetingService.rejectTargetingProposal(
                swapId,
                targetId,
                proposalId,
                reason,
                defaultOptions
            );
        },
        [targetingService, defaultOptions]
    );

    const cancelTargeting = useCallback(
        async (swapId: string, targetId: string) => {
            return targetingService.cancelTargeting(
                swapId,
                targetId,
                defaultOptions
            );
        },
        [targetingService, defaultOptions]
    );

    const retargetSwap = useCallback(
        async (sourceSwapId: string, currentTargetId: string, newTargetSwapId: string) => {
            // First cancel current targeting
            const cancelResult = await targetingService.cancelTargeting(
                sourceSwapId,
                currentTargetId,
                { ...defaultOptions, showLoadingStates: false }
            );

            if (!cancelResult.success) {
                return { success: false, error: cancelResult.error };
            }

            // Then create new targeting
            return targetingService.createTargetingProposal(
                sourceSwapId,
                newTargetSwapId,
                defaultOptions
            );
        },
        [targetingService, defaultOptions]
    );

    const isActionPending = useCallback(
        (actionType: string, targetId?: string) => {
            const pendingUpdates = targetingService.getPendingUpdates();
            return pendingUpdates.some(update => {
                if (targetId) {
                    return update.type === actionType && update.targetId === targetId;
                }
                return update.type === actionType;
            });
        },
        [targetingService]
    );

    const getPendingActions = useCallback(() => {
        return targetingService.getPendingUpdates();
    }, [targetingService]);

    const clearPendingActions = useCallback(() => {
        targetingService.clearPendingUpdates();
    }, [targetingService]);

    return {
        createTargetingProposal,
        acceptTargetingProposal,
        rejectTargetingProposal,
        cancelTargeting,
        retargetSwap,
        isActionPending,
        getPendingActions,
        clearPendingActions,
    };
};

/**
 * Hook for targeting actions with custom error handling
 */
export const useTargetingActionsWithErrorHandling = (
    onError?: (error: string, actionType: string) => void,
    onSuccess?: (actionType: string, data?: any) => void,
    options: UseOptimisticTargetingOptions = {}
) => {
    const targetingActions = useOptimisticTargeting(options);

    const wrapAction = useCallback(
        <T extends any[], R>(
            action: (...args: T) => Promise<{ success: boolean; error?: string;[key: string]: any }>,
            actionType: string
        ) => {
            return async (...args: T): Promise<R> => {
                try {
                    const result = await action(...args);

                    if (result.success) {
                        onSuccess?.(actionType, result);
                    } else {
                        onError?.(result.error || 'Unknown error', actionType);
                    }

                    return result as R;
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    onError?.(errorMessage, actionType);
                    return { success: false, error: errorMessage } as R;
                }
            };
        },
        [onError, onSuccess]
    );

    return {
        createTargetingProposal: wrapAction(targetingActions.createTargetingProposal, 'create_target'),
        acceptTargetingProposal: wrapAction(targetingActions.acceptTargetingProposal, 'accept_target'),
        rejectTargetingProposal: wrapAction(targetingActions.rejectTargetingProposal, 'reject_target'),
        cancelTargeting: wrapAction(targetingActions.cancelTargeting, 'cancel_target'),
        retargetSwap: wrapAction(targetingActions.retargetSwap, 'retarget'),
        isActionPending: targetingActions.isActionPending,
        getPendingActions: targetingActions.getPendingActions,
        clearPendingActions: targetingActions.clearPendingActions,
    };
};

/**
 * Hook for batch targeting actions
 */
export const useBatchTargetingActions = (
    options: UseOptimisticTargetingOptions = {}
) => {
    const targetingActions = useOptimisticTargeting(options);

    const acceptMultipleTargets = useCallback(
        async (targets: Array<{ swapId: string; targetId: string; proposalId: string }>) => {
            const results = await Promise.allSettled(
                targets.map(({ swapId, targetId, proposalId }) =>
                    targetingActions.acceptTargetingProposal(swapId, targetId, proposalId)
                )
            );

            const successful = results.filter(result =>
                result.status === 'fulfilled' && result.value.success
            ).length;

            const failed = results.length - successful;

            return {
                total: results.length,
                successful,
                failed,
                results: results.map((result, index) => ({
                    target: targets[index],
                    result: result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' },
                })),
            };
        },
        [targetingActions]
    );

    const rejectMultipleTargets = useCallback(
        async (targets: Array<{ swapId: string; targetId: string; proposalId: string; reason?: string }>) => {
            const results = await Promise.allSettled(
                targets.map(({ swapId, targetId, proposalId, reason }) =>
                    targetingActions.rejectTargetingProposal(swapId, targetId, proposalId, reason)
                )
            );

            const successful = results.filter(result =>
                result.status === 'fulfilled' && result.value.success
            ).length;

            const failed = results.length - successful;

            return {
                total: results.length,
                successful,
                failed,
                results: results.map((result, index) => ({
                    target: targets[index],
                    result: result.status === 'fulfilled' ? result.value : { success: false, error: 'Promise rejected' },
                })),
            };
        },
        [targetingActions]
    );

    return {
        ...targetingActions,
        acceptMultipleTargets,
        rejectMultipleTargets,
    };
};