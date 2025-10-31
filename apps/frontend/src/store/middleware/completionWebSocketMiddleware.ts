import { Middleware } from '@reduxjs/toolkit';
import { completionWebSocketService } from '../../services/completionWebSocketService';
import {
    setCompletionStatus,
    updateCompletionStatus,
    addAuditRecord,
    setValidationResult,
    removeOptimisticUpdate,
    rollbackOptimisticUpdate,
    updateLastUpdateTime,
} from '../slices/completionSlice';
import {
    updateMultipleSwapCompletions,
    rollbackOptimisticSwapCompletion,
} from '../slices/swapsSlice';
import {
    updateMultipleBookingCompletions,
    rollbackOptimisticBookingCompletion,
} from '../slices/bookingsSlice';
import {
    connectionThrottlingManager,
    connectionStateChecker
} from '../../utils/connectionThrottling';
import { getServiceConfig, isThrottlingFeatureEnabled } from '../../config/connectionThrottling';

/**
 * WebSocket middleware for handling real-time completion updates
 * Implements requirements 6.1, 8.1 from the design document
 * Enhanced with connection throttling (requirements 1.1, 3.1, 3.3)
 */
export const completionWebSocketMiddleware: Middleware = (store) => {
    let isInitialized = false;
    let currentUserId: string | null = null;

    // Service identifier for throttling
    const SERVICE_ID = 'completionWebSocketService';

    // Initialize throttling manager with service-specific config
    const throttlingConfig = getServiceConfig(SERVICE_ID);
    connectionThrottlingManager.updateConfig(throttlingConfig);

    /**
     * Throttled connection function that implements debouncing and state checking
     * Requirements: 1.1, 3.1, 3.3
     */
    const throttledConnect = async (token?: string): Promise<void> => {
        // Get token from store if not provided
        const authToken = token || store.getState()?.auth?.token || '';

        // Skip if throttling is disabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return completionWebSocketService.connect(authToken);
        }

        // Check connection state first (requirement 3.1)
        if (!connectionStateChecker.canConnect(SERVICE_ID)) {
            if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                console.log('CompletionWebSocket: Connection attempt skipped - already connected or throttled');
            }
            return;
        }

        // Use debounced connection (requirement 1.1, 3.3)
        return connectionThrottlingManager.debounceConnection(
            SERVICE_ID,
            async () => {
                try {
                    await completionWebSocketService.connect(authToken);
                    // Update connection state on successful connection
                    connectionStateChecker.setConnectionState(SERVICE_ID, true);

                    if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                        console.log('CompletionWebSocket: Connection established successfully');
                    }
                } catch (error) {
                    // Keep connection state as disconnected on failure
                    connectionStateChecker.setConnectionState(SERVICE_ID, false);
                    throw error;
                }
            }
        );
    };

    // Initialize WebSocket service and event listeners
    const initializeWebSocket = () => {
        if (isInitialized) return;

        // Connection event handlers with state tracking
        completionWebSocketService.on('connected', () => {
            console.log('Completion WebSocket connected');
            // Update connection state (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, true);
            // Reset throttling tracking on successful connection
            connectionThrottlingManager.resetConnectionTracking(SERVICE_ID);
        });

        completionWebSocketService.on('disconnected', () => {
            console.log('Completion WebSocket disconnected');
            // Update connection state (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, false);
        });

        completionWebSocketService.on('error', (error: any) => {
            console.error('Completion WebSocket error:', error);
            // Update connection state on error (requirement 3.1)
            connectionStateChecker.setConnectionState(SERVICE_ID, false);
        });

        // Completion status update handlers
        completionWebSocketService.on('completion_status_update', (statusUpdate: any) => {
            const { proposalId, status, completedAt, errorDetails } = statusUpdate;

            store.dispatch(updateCompletionStatus({
                proposalId,
                updates: {
                    status: status as any,
                    completedAt: completedAt ? new Date(completedAt) : undefined,
                    errorDetails,
                },
            }));

            store.dispatch(updateLastUpdateTime());

            // Remove optimistic update if completion is done
            if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
                store.dispatch(removeOptimisticUpdate(proposalId));
            }
        });

        // Completion success handler
        completionWebSocketService.on('completion_success', (completionData: any) => {
            const {
                proposalId,
                completionId,
                completionType,
                completedSwaps,
                updatedBookings,
                blockchainTransaction,
                completionTimestamp,
            } = completionData;

            // Update completion status
            store.dispatch(updateCompletionStatus({
                proposalId,
                updates: {
                    completionId,
                    status: 'completed',
                    completedAt: new Date(completionTimestamp),
                    blockchainTransactionId: blockchainTransaction?.transactionId,
                },
            }));

            // Update swap completions
            if (completedSwaps && completedSwaps.length > 0) {
                const swapCompletions = completedSwaps.map((swap: any) => ({
                    swapId: swap.swapId,
                    completion: {
                        completedAt: new Date(swap.completedAt),
                        completionTransactionId: completionId,
                        blockchainCompletionId: blockchainTransaction?.transactionId,
                        completionType,
                        proposalId,
                    },
                }));

                store.dispatch(updateMultipleSwapCompletions(swapCompletions));
            }

            // Update booking completions
            if (updatedBookings && updatedBookings.length > 0) {
                const bookingCompletions = updatedBookings.map((booking: any) => ({
                    bookingId: booking.bookingId,
                    completion: {
                        swappedAt: new Date(booking.swappedAt),
                        swapTransactionId: completionId,
                        swapCompletionId: completionId,
                        completionType,
                        proposalId,
                        newOwnerId: booking.newOwnerId,
                        originalOwnerId: booking.previousOwnerId,
                    },
                }));

                store.dispatch(updateMultipleBookingCompletions(bookingCompletions));
            }

            // Remove optimistic update
            store.dispatch(removeOptimisticUpdate(proposalId));
            store.dispatch(updateLastUpdateTime());
        });

        // Completion failure handler
        completionWebSocketService.on('completion_failed', (failureData: any) => {
            const { proposalId, errorDetails, affectedSwaps, affectedBookings } = failureData;

            // Update completion status to failed
            store.dispatch(updateCompletionStatus({
                proposalId,
                updates: {
                    status: 'failed',
                    errorDetails,
                },
            }));

            // Rollback optimistic updates
            store.dispatch(rollbackOptimisticUpdate({ proposalId, error: errorDetails }));

            // Rollback swap optimistic updates if available
            if (affectedSwaps) {
                affectedSwaps.forEach((swap: any) => {
                    store.dispatch(rollbackOptimisticSwapCompletion({
                        swapId: swap.swapId,
                        originalStatus: swap.originalStatus,
                    }));
                });
            }

            // Rollback booking optimistic updates if available
            if (affectedBookings) {
                affectedBookings.forEach((booking: any) => {
                    store.dispatch(rollbackOptimisticBookingCompletion({
                        bookingId: booking.bookingId,
                        originalStatus: booking.originalStatus,
                        originalOwnerId: booking.originalOwnerId,
                    }));
                });
            }

            store.dispatch(updateLastUpdateTime());
        });

        // Completion validation update handler
        completionWebSocketService.on('completion_validation_update', (validationData: any) => {
            const { proposalId, validationResult } = validationData;

            store.dispatch(setValidationResult({
                proposalId,
                result: validationResult,
            }));

            store.dispatch(updateLastUpdateTime());
        });

        // Completion audit update handler
        completionWebSocketService.on('completion_audit_update', (auditData: any) => {
            const { auditRecord } = auditData;

            store.dispatch(addAuditRecord(auditRecord));
            store.dispatch(updateLastUpdateTime());
        });

        // Blockchain completion update handler
        completionWebSocketService.on('completion_blockchain_update', (blockchainData: any) => {
            const { proposalId, blockchainTransaction } = blockchainData;

            store.dispatch(updateCompletionStatus({
                proposalId,
                updates: {
                    blockchainTransactionId: blockchainTransaction.transactionId,
                },
            }));

            store.dispatch(updateLastUpdateTime());
        });

        isInitialized = true;
    };

    // Subscribe to user completions when user changes with connection check
    const subscribeToUserCompletions = (userId: string) => {
        if (currentUserId !== userId) {
            // Note: CompletionWebSocketService doesn't have user-specific subscriptions
            // Individual completion subscriptions are handled per proposal
            currentUserId = userId;
        }
    };

    // Subscribe to specific completions with connection check
    const subscribeToCompletions = (proposalIds: string[]) => {
        if (proposalIds.length > 0) {
            // Ensure connection before subscribing (requirement 3.1)
            if (connectionStateChecker.isConnected(SERVICE_ID)) {
                proposalIds.forEach(proposalId => {
                    completionWebSocketService.subscribeToCompletion(proposalId);
                });
            } else {
                // Attempt throttled connection then subscribe
                throttledConnect().then(() => {
                    proposalIds.forEach(proposalId => {
                        completionWebSocketService.subscribeToCompletion(proposalId);
                    });
                }).catch((error) => {
                    if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                        console.error('CompletionWebSocket: Failed to connect for completion subscription:', error);
                    }
                });
            }
        }
    };

    return (next) => (action) => {
        // Initialize WebSocket service on first action
        if (!isInitialized) {
            initializeWebSocket();
        }

        // Handle auth state changes
        if (action.type === 'auth/setUser' && action.payload?.id) {
            subscribeToUserCompletions(action.payload.id);
        }

        if (action.type === 'auth/logout') {
            completionWebSocketService.disconnect();
            currentUserId = null;
        }

        // Handle completion data loading
        if (action.type === 'completion/setCompletionStatus') {
            const { proposalId } = action.payload;
            if (proposalId) {
                subscribeToCompletions([proposalId]);
            }
        }

        // Handle multiple completion statuses loading
        if (action.type === 'completion/updateMultipleCompletionStatuses') {
            const proposalIds = action.payload.map((item: any) => item.proposalId);
            subscribeToCompletions(proposalIds);
        }

        // Handle optimistic completion updates with throttling
        if (action.type === 'completion/addOptimisticUpdate') {
            const { proposalId } = action.payload;
            subscribeToCompletions([proposalId]);

            // Use throttled connection instead of direct connect (requirement 1.1, 3.3)
            throttledConnect().catch((error) => {
                if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                    console.error('CompletionWebSocket: Throttled connection failed for optimistic update:', error);
                }
            });
        }

        // Handle proposal acceptance operations that might trigger completions with throttling
        if (action.type?.startsWith('proposalAcceptance/')) {
            // Use throttled connection instead of direct connect (requirement 1.1, 3.3)
            throttledConnect().catch((error) => {
                if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                    console.error('CompletionWebSocket: Throttled connection failed for proposal acceptance:', error);
                }
            });
        }

        // Handle specific completion operations
        if (action.type === 'completion/startOptimistic') {
            const { proposalId } = action.payload;
            subscribeToCompletions([proposalId]);
        }

        // Pass action to next middleware/reducer
        const result = next(action);

        // Handle state persistence for offline support
        if (action.type?.includes('completion')) {
            const state = store.getState();

            // Store completion state using persistence utility
            import('../utils/completionStatePersistence').then(({ CompletionStatePersistence }) => {
                CompletionStatePersistence.saveCompletionState({
                    completionStatuses: state.completion.completionStatuses,
                    auditRecords: state.completion.auditRecords,
                    validationResults: state.completion.validationResults,
                    lastUpdateTime: state.completion.lastUpdateTime,
                    optimisticUpdates: state.completion.optimisticUpdates,
                });
            }).catch(error => {
                console.warn('Failed to persist completion state:', error);
            });
        }

        return result;
    };
};

/**
 * Initialize WebSocket connection and restore state from localStorage
 */
export const initializeCompletionWebSocket = async (store: any) => {
    // Restore state from localStorage using persistence utility
    try {
        const { CompletionStatePersistence } = await import('../utils/completionStatePersistence');

        // Validate and repair data if necessary
        CompletionStatePersistence.repairData();

        const storedState = CompletionStatePersistence.loadCompletionState();
        if (storedState) {
            // Dispatch actions to restore state
            if (storedState.completionStatuses && Object.keys(storedState.completionStatuses).length > 0) {
                Object.entries(storedState.completionStatuses).forEach(([proposalId, status]) => {
                    store.dispatch(setCompletionStatus({ proposalId, status: status as any }));
                });
            }

            // Restore audit records
            if (storedState.auditRecords?.length > 0) {
                storedState.auditRecords.forEach((record: any) => {
                    store.dispatch(addAuditRecord(record));
                });
            }

            // Restore validation results
            if (storedState.validationResults && Object.keys(storedState.validationResults).length > 0) {
                Object.entries(storedState.validationResults).forEach(([proposalId, result]) => {
                    store.dispatch(setValidationResult({ proposalId, result: result as any }));
                });
            }

            // Restore optimistic updates
            if (storedState.optimisticUpdates && Object.keys(storedState.optimisticUpdates).length > 0) {
                Object.values(storedState.optimisticUpdates).forEach((update: any) => {
                    store.dispatch({ type: 'completion/addOptimisticUpdate', payload: update });
                });
            }
        }
    } catch (error) {
        console.warn('Failed to restore completion state from localStorage:', error);
    }

    // Connect to WebSocket using throttled connection
    const throttledConnect = async (): Promise<void> => {
        // Get token from store
        const authToken = store.getState()?.auth?.token || '';

        // Skip if throttling is disabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return completionWebSocketService.connect(authToken);
        }

        // Check connection state first
        if (!connectionStateChecker.canConnect('completionWebSocketService')) {
            if (isThrottlingFeatureEnabled('ENABLE_THROTTLING_DEBUG_LOGS')) {
                console.log('CompletionWebSocket: Initial connection attempt skipped - already connected or throttled');
            }
            return;
        }

        // Use debounced connection
        return connectionThrottlingManager.debounceConnection(
            'completionWebSocketService',
            async () => {
                try {
                    // Get token from store
                    const authToken = store.getState()?.auth?.token || '';
                    await completionWebSocketService.connect(authToken);
                    connectionStateChecker.setConnectionState('completionWebSocketService', true);
                } catch (error) {
                    connectionStateChecker.setConnectionState('completionWebSocketService', false);
                    throw error;
                }
            }
        );
    };

    throttledConnect().catch(console.error);
};

/**
 * Cleanup WebSocket connections
 */
export const cleanupCompletionWebSocket = () => {
    const SERVICE_ID = 'completionWebSocketService';

    // Clear any pending throttled connections
    connectionThrottlingManager.clearDebounce(SERVICE_ID);

    // Reset connection state
    connectionStateChecker.resetConnectionState(SERVICE_ID);

    // Cleanup WebSocket service
    completionWebSocketService.disconnect();
};

export default completionWebSocketMiddleware;