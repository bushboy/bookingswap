import { useState, useCallback } from 'react';
import { TargetingAction } from '../components/swap/targeting/TargetingDetails';
import { targetingActionService, TargetingActionResult } from '../services/targetingActionService';

export interface UseTargetingActionsOptions {
    onSuccess?: (action: TargetingAction, result: TargetingActionResult) => void;
    onError?: (action: TargetingAction, error: string) => void;
    requireConfirmation?: boolean;
}

export interface UseTargetingActionsReturn {
    executeAction: (action: TargetingAction) => Promise<void>;
    isLoading: boolean;
    error: string | null;
    pendingAction: TargetingAction | null;
    confirmAction: () => Promise<void>;
    cancelAction: () => void;
    clearError: () => void;
}

/**
 * Hook for managing targeting actions with confirmation dialogs
 * Handles action execution, loading states, and error management
 * Requirements: 5.5, 5.6, 5.7
 */
export const useTargetingActions = (options: UseTargetingActionsOptions = {}): UseTargetingActionsReturn => {
    const {
        onSuccess,
        onError,
        requireConfirmation = true
    } = options;

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<TargetingAction | null>(null);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const cancelAction = useCallback(() => {
        setPendingAction(null);
        setError(null);
    }, []);

    const executeActionInternal = useCallback(async (action: TargetingAction): Promise<void> => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await targetingActionService.executeAction(action);

            if (result.success) {
                onSuccess?.(action, result);

                // Handle special cases
                if (action.type === 'retarget' && result.data?.action === 'browse_targets') {
                    // Trigger browse targets flow
                    // This would typically open a target selection modal or navigate to browse page
                    console.log('Opening target browser for swap:', result.data.sourceSwapId);
                }
            } else {
                const errorMessage = result.error || 'Action failed';
                setError(errorMessage);
                onError?.(action, errorMessage);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            setError(errorMessage);
            onError?.(action, errorMessage);
        } finally {
            setIsLoading(false);
            setPendingAction(null);
        }
    }, [onSuccess, onError]);

    const executeAction = useCallback(async (action: TargetingAction): Promise<void> => {
        // Clear any previous errors
        setError(null);

        // Check if confirmation is required for this action type
        const needsConfirmation = requireConfirmation && (
            action.type === 'accept_target' ||
            action.type === 'reject_target' ||
            action.type === 'cancel_targeting' ||
            action.type === 'retarget'
        );

        if (needsConfirmation) {
            // Set pending action for confirmation dialog
            setPendingAction(action);
        } else {
            // Execute immediately
            await executeActionInternal(action);
        }
    }, [requireConfirmation, executeActionInternal]);

    const confirmAction = useCallback(async (): Promise<void> => {
        if (!pendingAction) {
            return;
        }

        await executeActionInternal(pendingAction);
    }, [pendingAction, executeActionInternal]);

    return {
        executeAction,
        isLoading,
        error,
        pendingAction,
        confirmAction,
        cancelAction,
        clearError
    };
};

export default useTargetingActions;