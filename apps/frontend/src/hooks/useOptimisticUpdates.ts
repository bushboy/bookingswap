import { useCallback, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';

interface OptimisticUpdate<T = any> {
    id: string;
    type: 'proposal_accept' | 'proposal_reject' | 'swap_update';
    originalData: T;
    optimisticData: T;
    timestamp: number;
    timeout?: NodeJS.Timeout;
}

interface UseOptimisticUpdatesOptions {
    timeoutMs?: number;
    onRollback?: (update: OptimisticUpdate) => void;
    onConfirm?: (update: OptimisticUpdate) => void;
}

export const useOptimisticUpdates = (options: UseOptimisticUpdatesOptions = {}) => {
    const { timeoutMs = 10000, onRollback, onConfirm } = options;
    const dispatch = useDispatch<AppDispatch>();
    const pendingUpdates = useRef<Map<string, OptimisticUpdate>>(new Map());
    const [isProcessing, setIsProcessing] = useState<Set<string>>(new Set());

    const addOptimisticUpdate = useCallback(
        <T>(
            id: string,
            type: OptimisticUpdate['type'],
            originalData: T,
            optimisticData: T,
            reduxAction?: any
        ) => {
            // Clear any existing update for this ID
            const existingUpdate = pendingUpdates.current.get(id);
            if (existingUpdate?.timeout) {
                clearTimeout(existingUpdate.timeout);
            }

            // Apply optimistic update to Redux store
            if (reduxAction) {
                dispatch(reduxAction);
            }

            // Set up timeout for rollback
            const timeout = setTimeout(() => {
                rollbackUpdate(id);
            }, timeoutMs);

            const update: OptimisticUpdate<T> = {
                id,
                type,
                originalData,
                optimisticData,
                timestamp: Date.now(),
                timeout,
            };

            pendingUpdates.current.set(id, update);
            setIsProcessing(prev => new Set(prev).add(id));

            return update;
        },
        [dispatch, timeoutMs]
    );

    const confirmUpdate = useCallback((id: string) => {
        const update = pendingUpdates.current.get(id);
        if (update) {
            if (update.timeout) {
                clearTimeout(update.timeout);
            }
            pendingUpdates.current.delete(id);
            setIsProcessing(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            onConfirm?.(update);
        }
    }, [onConfirm]);

    const rollbackUpdate = useCallback(
        (id: string, rollbackAction?: any) => {
            const update = pendingUpdates.current.get(id);
            if (update) {
                if (update.timeout) {
                    clearTimeout(update.timeout);
                }

                // Apply rollback to Redux store
                if (rollbackAction) {
                    dispatch(rollbackAction);
                }

                pendingUpdates.current.delete(id);
                setIsProcessing(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(id);
                    return newSet;
                });
                onRollback?.(update);
            }
        },
        [dispatch, onRollback]
    );

    const hasOptimisticUpdate = useCallback((id: string) => {
        return pendingUpdates.current.has(id);
    }, []);

    const getOptimisticUpdate = useCallback((id: string) => {
        return pendingUpdates.current.get(id);
    }, []);

    const clearAllUpdates = useCallback(() => {
        pendingUpdates.current.forEach(update => {
            if (update.timeout) {
                clearTimeout(update.timeout);
            }
        });
        pendingUpdates.current.clear();
        setIsProcessing(new Set());
    }, []);

    const isUpdateProcessing = useCallback((id: string) => {
        return isProcessing.has(id);
    }, [isProcessing]);

    return {
        addOptimisticUpdate,
        confirmUpdate,
        rollbackUpdate,
        hasOptimisticUpdate,
        getOptimisticUpdate,
        clearAllUpdates,
        isUpdateProcessing,
        pendingUpdateCount: pendingUpdates.current.size,
    };
};