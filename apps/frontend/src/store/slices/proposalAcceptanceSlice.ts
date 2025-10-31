import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    ProposalResponse,
    ProposalResponseAction,
    ProposalResponseResult,
} from '@booking-swap/shared';

/**
 * State for individual proposal acceptance operations
 */
interface ProposalAcceptanceOperation {
    proposalId: string;
    action: ProposalResponseAction;
    loading: boolean;
    error: string | null;
    optimisticUpdate?: {
        status: 'accepted' | 'rejected';
        timestamp: number;
    };
}

/**
 * State interface for proposal acceptance functionality
 */
interface ProposalAcceptanceState {
    // Active operations by proposal ID
    activeOperations: Record<string, ProposalAcceptanceOperation>;

    // Recent responses for tracking
    recentResponses: ProposalResponse[];

    // Global loading state
    globalLoading: boolean;

    // Global error state
    globalError: string | null;

    // Optimistic updates tracking
    optimisticUpdates: {
        acceptedProposals: string[];
        rejectedProposals: string[];
    };

    // Success tracking for UI feedback
    successOperations: {
        proposalId: string;
        action: ProposalResponseAction;
        timestamp: number;
    }[];

    // Rollback data for failed operations
    rollbackData: Record<string, {
        originalStatus: string;
        timestamp: number;
    }>;
}

const initialState: ProposalAcceptanceState = {
    activeOperations: {},
    recentResponses: [],
    globalLoading: false,
    globalError: null,
    optimisticUpdates: {
        acceptedProposals: [],
        rejectedProposals: [],
    },
    successOperations: [],
    rollbackData: {},
};

export const proposalAcceptanceSlice = createSlice({
    name: 'proposalAcceptance',
    initialState,
    reducers: {
        // Start proposal acceptance/rejection operation
        startProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                action: ProposalResponseAction;
                optimisticStatus?: 'accepted' | 'rejected';
            }>
        ) => {
            const { proposalId, action: responseAction, optimisticStatus } = action.payload;

            state.activeOperations[proposalId] = {
                proposalId,
                action: responseAction,
                loading: true,
                error: null,
                optimisticUpdate: optimisticStatus ? {
                    status: optimisticStatus,
                    timestamp: Date.now(),
                } : undefined,
            };

            // Add to optimistic updates
            if (optimisticStatus === 'accepted') {
                if (!state.optimisticUpdates.acceptedProposals.includes(proposalId)) {
                    state.optimisticUpdates.acceptedProposals.push(proposalId);
                }
                state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                    id => id !== proposalId
                );
            } else if (optimisticStatus === 'rejected') {
                if (!state.optimisticUpdates.rejectedProposals.includes(proposalId)) {
                    state.optimisticUpdates.rejectedProposals.push(proposalId);
                }
                state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                    id => id !== proposalId
                );
            }

            state.globalError = null;
        },

        // Complete proposal operation successfully
        completeProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                result: ProposalResponseResult;
            }>
        ) => {
            const { proposalId, result } = action.payload;

            // Remove from active operations
            delete state.activeOperations[proposalId];

            // Add to recent responses
            state.recentResponses.unshift(result.response);

            // Keep only last 20 responses
            if (state.recentResponses.length > 20) {
                state.recentResponses = state.recentResponses.slice(0, 20);
            }

            // Add to success operations for UI feedback
            state.successOperations.unshift({
                proposalId,
                action: result.response.action,
                timestamp: Date.now(),
            });

            // Keep only last 10 success operations
            if (state.successOperations.length > 10) {
                state.successOperations = state.successOperations.slice(0, 10);
            }

            // Remove from rollback data if exists
            delete state.rollbackData[proposalId];

            state.globalLoading = false;
            state.globalError = null;
        },

        // Handle proposal operation failure
        failProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                error: string;
                originalStatus?: string;
            }>
        ) => {
            const { proposalId, error, originalStatus } = action.payload;

            // Update operation with error
            if (state.activeOperations[proposalId]) {
                state.activeOperations[proposalId].loading = false;
                state.activeOperations[proposalId].error = error;
            }

            // Remove from optimistic updates (rollback)
            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                id => id !== proposalId
            );
            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                id => id !== proposalId
            );

            // Store rollback data if original status provided
            if (originalStatus) {
                state.rollbackData[proposalId] = {
                    originalStatus,
                    timestamp: Date.now(),
                };
            }

            state.globalError = error;
            state.globalLoading = false;
        },

        // Clear operation error
        clearOperationError: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;

            if (state.activeOperations[proposalId]) {
                state.activeOperations[proposalId].error = null;
            }

            // Clear global error if no other operations have errors
            const hasErrors = Object.values(state.activeOperations).some(op => op.error);
            if (!hasErrors) {
                state.globalError = null;
            }
        },

        // Clear all operation errors
        clearAllOperationErrors: (state) => {
            Object.values(state.activeOperations).forEach(operation => {
                operation.error = null;
            });
            state.globalError = null;
        },

        // Remove completed operation
        removeCompletedOperation: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.activeOperations[proposalId];
        },

        // Set global loading state
        setGlobalLoading: (state, action: PayloadAction<boolean>) => {
            state.globalLoading = action.payload;
            if (action.payload) {
                state.globalError = null;
            }
        },

        // Set global error
        setGlobalError: (state, action: PayloadAction<string | null>) => {
            state.globalError = action.payload;
            if (action.payload) {
                state.globalLoading = false;
            }
        },

        // Add optimistic acceptance
        addOptimisticAcceptance: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;

            if (!state.optimisticUpdates.acceptedProposals.includes(proposalId)) {
                state.optimisticUpdates.acceptedProposals.push(proposalId);
            }

            // Remove from rejected if exists
            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                id => id !== proposalId
            );
        },

        // Add optimistic rejection
        addOptimisticRejection: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;

            if (!state.optimisticUpdates.rejectedProposals.includes(proposalId)) {
                state.optimisticUpdates.rejectedProposals.push(proposalId);
            }

            // Remove from accepted if exists
            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                id => id !== proposalId
            );
        },

        // Remove optimistic update
        removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;

            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                id => id !== proposalId
            );
            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                id => id !== proposalId
            );
        },

        // Clear optimistic updates
        clearOptimisticUpdates: (state) => {
            state.optimisticUpdates.acceptedProposals = [];
            state.optimisticUpdates.rejectedProposals = [];
        },

        // Clear success operations (for UI cleanup)
        clearSuccessOperations: (state) => {
            state.successOperations = [];
        },

        // Remove old success operations
        removeOldSuccessOperations: (state, action: PayloadAction<number>) => {
            const cutoffTime = action.payload;
            state.successOperations = state.successOperations.filter(
                op => op.timestamp > cutoffTime
            );
        },

        // Clear rollback data
        clearRollbackData: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.rollbackData[proposalId];
        },

        // Clear all rollback data
        clearAllRollbackData: (state) => {
            state.rollbackData = {};
        },

        // Reset entire state
        resetProposalAcceptanceState: (state) => {
            Object.assign(state, initialState);
        },

        // Batch operations for multiple proposals
        startBatchOperation: (
            state,
            action: PayloadAction<{
                proposalIds: string[];
                action: ProposalResponseAction;
            }>
        ) => {
            const { proposalIds, action: responseAction } = action.payload;

            proposalIds.forEach(proposalId => {
                state.activeOperations[proposalId] = {
                    proposalId,
                    action: responseAction,
                    loading: true,
                    error: null,
                };
            });

            state.globalLoading = true;
            state.globalError = null;
        },

        // Complete batch operation
        completeBatchOperation: (
            state,
            action: PayloadAction<{
                results: Array<{ proposalId: string; result?: ProposalResponseResult; error?: string }>;
            }>
        ) => {
            const { results } = action.payload;

            results.forEach(({ proposalId, result, error }) => {
                if (result) {
                    // Success case
                    delete state.activeOperations[proposalId];
                    state.recentResponses.unshift(result.response);

                    state.successOperations.unshift({
                        proposalId,
                        action: result.response.action,
                        timestamp: Date.now(),
                    });
                } else if (error) {
                    // Error case
                    if (state.activeOperations[proposalId]) {
                        state.activeOperations[proposalId].loading = false;
                        state.activeOperations[proposalId].error = error;
                    }
                }
            });

            // Trim arrays
            if (state.recentResponses.length > 20) {
                state.recentResponses = state.recentResponses.slice(0, 20);
            }

            if (state.successOperations.length > 10) {
                state.successOperations = state.successOperations.slice(0, 10);
            }

            state.globalLoading = false;
        },

        // Real-time proposal status update from WebSocket
        updateProposalStatusFromWebSocket: (
            state,
            action: PayloadAction<{
                proposalId: string;
                status: 'accepted' | 'rejected' | 'expired';
                respondedBy?: string;
                respondedAt: string;
                rejectionReason?: string;
                paymentStatus?: 'processing' | 'completed' | 'failed';
            }>
        ) => {
            const { proposalId, status, respondedBy, respondedAt, rejectionReason } = action.payload;

            // Remove from active operations if it exists
            delete state.activeOperations[proposalId];

            // Remove from optimistic updates since we have real data
            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                id => id !== proposalId
            );
            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                id => id !== proposalId
            );

            // Create a response record for the real-time update
            const response: ProposalResponse = {
                id: `ws-response-${proposalId}`,
                proposalId,
                action: status === 'accepted' ? 'accept' : 'reject',
                responderId: respondedBy || 'unknown',
                reason: rejectionReason,
                blockchainTransactionId: `tx-${proposalId}`,
                createdAt: new Date(respondedAt),
                updatedAt: new Date(respondedAt),
            };

            // Add to recent responses
            state.recentResponses.unshift(response);

            // Keep only last 20 responses
            if (state.recentResponses.length > 20) {
                state.recentResponses = state.recentResponses.slice(0, 20);
            }

            // Add to success operations for UI feedback
            state.successOperations.unshift({
                proposalId,
                action: response.action,
                timestamp: Date.now(),
            });

            // Keep only last 10 success operations
            if (state.successOperations.length > 10) {
                state.successOperations = state.successOperations.slice(0, 10);
            }

            // Remove from rollback data if exists
            delete state.rollbackData[proposalId];

            state.globalLoading = false;
            state.globalError = null;
        },

        // Handle WebSocket connection status
        setWebSocketConnectionStatus: (
            state,
            action: PayloadAction<{
                isConnected: boolean;
                error?: string;
            }>
        ) => {
            const { isConnected, error } = action.payload;

            if (!isConnected && error) {
                state.globalError = `Connection error: ${error}`;
            } else if (isConnected) {
                // Clear connection-related errors when reconnected
                if (state.globalError?.includes('Connection error')) {
                    state.globalError = null;
                }
            }
        },
    },
});

export const {
    // Operation management
    startProposalOperation,
    completeProposalOperation,
    failProposalOperation,
    clearOperationError,
    clearAllOperationErrors,
    removeCompletedOperation,

    // Global state
    setGlobalLoading,
    setGlobalError,

    // Optimistic updates
    addOptimisticAcceptance,
    addOptimisticRejection,
    removeOptimisticUpdate,
    clearOptimisticUpdates,

    // Success tracking
    clearSuccessOperations,
    removeOldSuccessOperations,

    // Rollback management
    clearRollbackData,
    clearAllRollbackData,

    // State management
    resetProposalAcceptanceState,

    // Batch operations
    startBatchOperation,
    completeBatchOperation,

    // Real-time updates
    updateProposalStatusFromWebSocket,
    setWebSocketConnectionStatus,
} = proposalAcceptanceSlice.actions;

export default proposalAcceptanceSlice.reducer;