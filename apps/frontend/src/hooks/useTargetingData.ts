/**
 * Custom hook for isolated targeting data loading
 * 
 * This hook provides isolated targeting data loading that doesn't affect
 * the main authentication state when targeting operations fail.
 * 
 * Requirements satisfied:
 * - 3.1: Separate targeting data loading from main swap data loading
 * - 3.1: Add independent error states for targeting operations
 * - 3.1: Implement targeting-specific retry logic that doesn't affect main auth state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { swapTargetingService } from '@/services/swapTargetingService';
import { executeTargetingOperation } from '@/services/authErrorHandler';
import { AuthErrorType } from '@/types/authError';
import {
    generateTargetingAuthFeedback,
    generateTargetingSuccessFeedback,
    generateRetryFeedback,
    TargetingFeedbackMessage
} from '@/services/targetingFeedbackService';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface TargetingData {
    swapId: string;
    hasOutgoingTarget: boolean;
    outgoingTarget?: {
        id: string;
        targetSwapId: string;
        status: 'pending' | 'accepted' | 'rejected';
        createdAt: Date;
    };
    incomingTargets: Array<{
        id: string;
        sourceSwapId: string;
        sourceUserId: string;
        status: 'pending' | 'accepted' | 'rejected';
        createdAt: Date;
    }>;
    targetingHistory: Array<{
        id: string;
        action: 'target' | 'retarget' | 'remove_target' | 'accept' | 'reject';
        timestamp: Date;
        details: Record<string, any>;
    }>;
}

export interface TargetingState {
    isLoading: boolean;
    error: string | null;
    authError: boolean;
    retryCount: number;
    lastUpdated: Date | null;
    data: Record<string, TargetingData>; // keyed by swapId
}

export interface TargetingError {
    type: AuthErrorType;
    message: string;
    isAuthError: boolean;
    shouldRetry: boolean;
    preservesMainAuth: boolean;
    feedbackMessage?: TargetingFeedbackMessage;
}

export interface UseTargetingDataOptions {
    autoLoad?: boolean;
    retryOnError?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    onError?: (error: TargetingError) => void;
    onSuccess?: (data: TargetingData) => void;
}

export interface UseTargetingDataReturn {
    targetingState: TargetingState;
    loadTargetingData: (swapId: string) => Promise<void>;
    loadMultipleTargetingData: (swapIds: string[]) => Promise<void>;
    refreshTargetingData: (swapId: string) => Promise<void>;
    clearTargetingData: (swapId?: string) => void;
    retryTargetingOperation: (swapId: string) => Promise<void>;
    getTargetingData: (swapId: string) => TargetingData | null;
    hasTargetingData: (swapId: string) => boolean;
    isTargetingLoading: (swapId?: string) => boolean;
    getTargetingError: () => string | null;
}

// ============================================================================
// Custom Hook Implementation
// ============================================================================

export function useTargetingData(options: UseTargetingDataOptions = {}): UseTargetingDataReturn {
    const {
        autoLoad = false,
        retryOnError = true,
        maxRetries = 2,
        retryDelay = 1500,
        onError,
        onSuccess
    } = options;

    // State management
    const [targetingState, setTargetingState] = useState<TargetingState>({
        isLoading: false,
        error: null,
        authError: false,
        retryCount: 0,
        lastUpdated: null,
        data: {}
    });

    // Refs for cleanup and retry management
    const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const abortControllers = useRef<Map<string, AbortController>>(new Map());

    // ============================================================================
    // Core Loading Functions
    // ============================================================================

    /**
     * Load targeting data for a specific swap with error isolation
     */
    const loadTargetingData = useCallback(async (swapId: string): Promise<void> => {
        if (!swapId) {
            console.warn('useTargetingData: No swapId provided for targeting data load');
            return;
        }

        // Cancel any existing request for this swap
        const existingController = abortControllers.current.get(swapId);
        if (existingController) {
            existingController.abort();
        }

        // Create new abort controller
        const abortController = new AbortController();
        abortControllers.current.set(swapId, abortController);

        // Update loading state
        setTargetingState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
            authError: false
        }));

        try {
            console.log(`useTargetingData: Loading targeting data for swap ${swapId}`);

            // Load targeting data using isolated error handling
            const targetingResult = await executeTargetingOperation(
                async () => {
                    // Check if request was aborted
                    if (abortController.signal.aborted) {
                        throw new Error('Request aborted');
                    }

                    // Load all targeting-related data for this swap
                    const [swapTarget, targetingHistory, swapsTargetingThis] = await Promise.all([
                        swapTargetingService.getSwapTarget(swapId),
                        swapTargetingService.getTargetingHistory(swapId).catch(() => []), // Non-critical
                        swapTargetingService.getSwapsTargetedBy(swapId).catch(() => []) // Non-critical
                    ]);

                    return {
                        swapTarget,
                        targetingHistory,
                        swapsTargetingThis
                    };
                },
                `/swaps/${swapId}/targeting-data`,
                swapId
            );

            // Check if request was aborted
            if (abortController.signal.aborted) {
                return;
            }

            if (targetingResult.success && targetingResult.data) {
                const { swapTarget, targetingHistory, swapsTargetingThis } = targetingResult.data;

                // Transform to our targeting data format
                const targetingData: TargetingData = {
                    swapId,
                    hasOutgoingTarget: !!swapTarget,
                    outgoingTarget: swapTarget ? {
                        id: swapTarget.id,
                        targetSwapId: swapTarget.targetSwapId,
                        status: swapTarget.status as 'pending' | 'accepted' | 'rejected',
                        createdAt: new Date(swapTarget.createdAt)
                    } : undefined,
                    incomingTargets: swapsTargetingThis.map(target => ({
                        id: target.id,
                        sourceSwapId: target.sourceSwapId,
                        sourceUserId: target.sourceSwapId, // Use sourceSwapId as fallback
                        status: target.status as 'pending' | 'accepted' | 'rejected',
                        createdAt: new Date(target.createdAt)
                    })),
                    targetingHistory: targetingHistory.map(history => ({
                        id: history.id,
                        action: history.action as any,
                        timestamp: new Date(history.timestamp),
                        details: history.metadata || {}
                    }))
                };

                // Update state with successful data
                setTargetingState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: null,
                    authError: false,
                    retryCount: 0,
                    lastUpdated: new Date(),
                    data: {
                        ...prev.data,
                        [swapId]: targetingData
                    }
                }));

                // Generate success feedback message (optional, for debugging)
                if (import.meta.env.DEV) {
                    const successFeedback = generateTargetingSuccessFeedback(
                        'get_status',
                        { swapId, operation: 'get_status' },
                        { showTechnicalDetails: true }
                    );
                    console.log('useTargetingData: Success feedback:', successFeedback);
                }

                // Call success callback
                if (onSuccess) {
                    onSuccess(targetingData);
                }

                console.log(`useTargetingData: Successfully loaded targeting data for swap ${swapId}`);
            } else {
                // Handle targeting operation failure
                const error = targetingResult.error;
                const errorType = error?.type || AuthErrorType.TARGETING_AUTH_FAILURE;

                // Generate user-friendly feedback message
                const feedbackMessage = generateTargetingAuthFeedback(
                    errorType,
                    {
                        operation: 'get_status',
                        swapId,
                        endpoint: `/swaps/${swapId}/targeting-data`,
                        errorCode: errorType,
                        isRetry: targetingState.retryCount > 0,
                        retryCount: targetingState.retryCount
                    },
                    {
                        showTechnicalDetails: import.meta.env.DEV,
                        includeRetryOption: true,
                        customRetryText: 'Retry Targeting Data'
                    }
                );

                const targetingError: TargetingError = {
                    type: errorType,
                    message: error?.message || 'Failed to load targeting data',
                    isAuthError: error?.isTargetingError || false,
                    shouldRetry: !error?.shouldTriggerLogout,
                    preservesMainAuth: targetingResult.preservedAuthState,
                    feedbackMessage
                };

                console.warn(`useTargetingData: Targeting operation failed for swap ${swapId}:`, targetingError);

                // Update state with error
                setTargetingState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: targetingError.message,
                    authError: targetingError.isAuthError,
                    retryCount: prev.retryCount + 1
                }));

                // Call error callback
                if (onError) {
                    onError(targetingError);
                }

                // Retry if enabled and appropriate
                if (retryOnError && targetingError.shouldRetry && targetingState.retryCount < maxRetries) {
                    console.log(`useTargetingData: Scheduling retry for swap ${swapId} in ${retryDelay}ms`);

                    // Generate retry feedback
                    const retryFeedback = generateRetryFeedback(
                        'get_status',
                        targetingState.retryCount,
                        maxRetries,
                        { swapId, operation: 'get_status' }
                    );

                    console.log('useTargetingData: Retry feedback:', retryFeedback);

                    const timeoutId = setTimeout(() => {
                        retryTargetingOperation(swapId);
                    }, retryDelay);

                    retryTimeouts.current.set(swapId, timeoutId);
                }
            }
        } catch (error) {
            // Handle unexpected errors
            console.error(`useTargetingData: Unexpected error loading targeting data for swap ${swapId}:`, error);

            // Generate feedback for unexpected errors
            const feedbackMessage = generateTargetingAuthFeedback(
                AuthErrorType.UNKNOWN_ERROR,
                {
                    operation: 'get_status',
                    swapId,
                    endpoint: `/swaps/${swapId}/targeting-data`,
                    errorCode: 'UNKNOWN_ERROR',
                    isRetry: targetingState.retryCount > 0,
                    retryCount: targetingState.retryCount
                },
                {
                    showTechnicalDetails: import.meta.env.DEV,
                    includeRetryOption: true,
                    customRetryText: 'Retry Loading'
                }
            );

            const targetingError: TargetingError = {
                type: AuthErrorType.UNKNOWN_ERROR,
                message: error instanceof Error ? error.message : 'Unknown error loading targeting data',
                isAuthError: false,
                shouldRetry: true,
                preservesMainAuth: true,
                feedbackMessage
            };

            setTargetingState(prev => ({
                ...prev,
                isLoading: false,
                error: targetingError.message,
                authError: false,
                retryCount: prev.retryCount + 1
            }));

            if (onError) {
                onError(targetingError);
            }
        } finally {
            // Clean up abort controller
            abortControllers.current.delete(swapId);
        }
    }, [retryOnError, maxRetries, retryDelay, onError, onSuccess, targetingState.retryCount]);

    /**
     * Load targeting data for multiple swaps concurrently
     */
    const loadMultipleTargetingData = useCallback(async (swapIds: string[]): Promise<void> => {
        if (!swapIds.length) {
            return;
        }

        console.log(`useTargetingData: Loading targeting data for ${swapIds.length} swaps`);

        // Load all swaps concurrently but handle errors independently
        const loadPromises = swapIds.map(swapId =>
            loadTargetingData(swapId).catch(error => {
                console.warn(`useTargetingData: Failed to load targeting data for swap ${swapId}:`, error);
                // Don't throw - let other loads continue
            })
        );

        await Promise.allSettled(loadPromises);
    }, [loadTargetingData]);

    /**
     * Refresh targeting data for a specific swap
     */
    const refreshTargetingData = useCallback(async (swapId: string): Promise<void> => {
        // Clear existing data and reload
        setTargetingState(prev => ({
            ...prev,
            data: {
                ...prev.data,
                [swapId]: undefined as any
            }
        }));

        await loadTargetingData(swapId);
    }, [loadTargetingData]);

    /**
     * Clear targeting data from state
     */
    const clearTargetingData = useCallback((swapId?: string): void => {
        if (swapId) {
            // Clear specific swap data
            setTargetingState(prev => {
                const newData = { ...prev.data };
                delete newData[swapId];
                return {
                    ...prev,
                    data: newData
                };
            });

            // Cancel any pending operations for this swap
            const timeout = retryTimeouts.current.get(swapId);
            if (timeout) {
                clearTimeout(timeout);
                retryTimeouts.current.delete(swapId);
            }

            const controller = abortControllers.current.get(swapId);
            if (controller) {
                controller.abort();
                abortControllers.current.delete(swapId);
            }
        } else {
            // Clear all data
            setTargetingState(prev => ({
                ...prev,
                data: {},
                error: null,
                authError: false,
                retryCount: 0
            }));

            // Cancel all pending operations
            retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
            retryTimeouts.current.clear();

            abortControllers.current.forEach(controller => controller.abort());
            abortControllers.current.clear();
        }
    }, []);

    /**
     * Retry targeting operation for a specific swap
     */
    const retryTargetingOperation = useCallback(async (swapId: string): Promise<void> => {
        console.log(`useTargetingData: Retrying targeting operation for swap ${swapId}`);

        // Clear any existing retry timeout
        const timeout = retryTimeouts.current.get(swapId);
        if (timeout) {
            clearTimeout(timeout);
            retryTimeouts.current.delete(swapId);
        }

        await loadTargetingData(swapId);
    }, [loadTargetingData]);

    // ============================================================================
    // Utility Functions
    // ============================================================================

    /**
     * Get targeting data for a specific swap
     */
    const getTargetingData = useCallback((swapId: string): TargetingData | null => {
        return targetingState.data[swapId] || null;
    }, [targetingState.data]);

    /**
     * Check if targeting data exists for a swap
     */
    const hasTargetingData = useCallback((swapId: string): boolean => {
        return !!targetingState.data[swapId];
    }, [targetingState.data]);

    /**
     * Check if targeting data is currently loading
     */
    const isTargetingLoading = useCallback((swapId?: string): boolean => {
        if (swapId) {
            // Check if specific swap is loading (we don't track per-swap loading state currently)
            // For now, return global loading state
            return targetingState.isLoading;
        }
        return targetingState.isLoading;
    }, [targetingState.isLoading]);

    /**
     * Get current targeting error
     */
    const getTargetingError = useCallback((): string | null => {
        return targetingState.error;
    }, [targetingState.error]);

    // ============================================================================
    // Cleanup Effect
    // ============================================================================

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
            retryTimeouts.current.clear();

            abortControllers.current.forEach(controller => controller.abort());
            abortControllers.current.clear();
        };
    }, []);

    // ============================================================================
    // Return Hook Interface
    // ============================================================================

    return {
        targetingState,
        loadTargetingData,
        loadMultipleTargetingData,
        refreshTargetingData,
        clearTargetingData,
        retryTargetingOperation,
        getTargetingData,
        hasTargetingData,
        isTargetingLoading,
        getTargetingError
    };
}

export default useTargetingData;