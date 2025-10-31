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
    startTime: number;
    timeout?: number;
    retryCount: number;
    maxRetries: number;
    optimisticUpdate?: {
        status: 'accepted' | 'rejected';
        timestamp: number;
    };
}

/**
 * Error types for better error categorization
 */
type ErrorType = 'network' | 'permission' | 'validation' | 'timeout' | 'server' | 'unknown';

/**
 * Enhanced error information
 */
interface ErrorInfo {
    type: ErrorType;
    message: string;
    code?: string;
    timestamp: number;
    retryable: boolean;
    proposalId?: string;
    context?: Record<string, any>;
}

/**
 * Error recovery strategy
 */
interface ErrorRecoveryStrategy {
    retryable: boolean;
    maxRetries: number;
    retryDelay: number;
    fallbackAction?: string;
    userMessage: string;
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

    // Enhanced error tracking per proposal
    proposalErrors: Record<string, ErrorInfo>;

    // Error history for analytics
    errorHistory: ErrorInfo[];

    // Error recovery strategies
    errorRecoveryStrategies: Record<ErrorType, ErrorRecoveryStrategy>;

    // Retry attempts tracking
    retryAttempts: Record<string, {
        count: number;
        lastAttempt: number;
        errors: ErrorInfo[];
    }>;

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

    // Operation timeout configuration
    operationTimeouts: {
        defaultTimeout: number; // 30 seconds
        maxTimeout: number; // 2 minutes
        cleanupInterval: number; // 5 minutes
    };

    // Cleanup tracking
    lastCleanupTime: number;
}

const initialState: ProposalAcceptanceState = {
    activeOperations: {},
    recentResponses: [],
    globalLoading: false,
    globalError: null,
    proposalErrors: {},
    errorHistory: [],
    errorRecoveryStrategies: {
        network: {
            retryable: true,
            maxRetries: 3,
            retryDelay: 1000,
            userMessage: "Connection issue. Click to retry.",
        },
        permission: {
            retryable: false,
            maxRetries: 0,
            retryDelay: 0,
            fallbackAction: "refresh_proposal_data",
            userMessage: "You don't have permission for this action.",
        },
        validation: {
            retryable: false,
            maxRetries: 0,
            retryDelay: 0,
            fallbackAction: "hide_buttons",
            userMessage: "This proposal is no longer valid.",
        },
        timeout: {
            retryable: true,
            maxRetries: 2,
            retryDelay: 2000,
            userMessage: "Request timed out. Click to retry.",
        },
        server: {
            retryable: true,
            maxRetries: 2,
            retryDelay: 3000,
            userMessage: "Server error occurred. Please try again.",
        },
        unknown: {
            retryable: true,
            maxRetries: 1,
            retryDelay: 1000,
            userMessage: "An unexpected error occurred. Please try again.",
        },
    },
    retryAttempts: {},
    optimisticUpdates: {
        acceptedProposals: [],
        rejectedProposals: [],
    },
    successOperations: [],
    rollbackData: {},
    operationTimeouts: {
        defaultTimeout: 30000, // 30 seconds
        maxTimeout: 120000, // 2 minutes
        cleanupInterval: 300000, // 5 minutes
    },
    lastCleanupTime: Date.now(),
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
                timeout?: number;
            }>
        ) => {
            const { proposalId, action: responseAction, optimisticStatus, timeout } = action.payload;
            const now = Date.now();

            // Cancel any existing operation for this proposal
            if (state.activeOperations[proposalId]) {
                delete state.activeOperations[proposalId];
            }

            state.activeOperations[proposalId] = {
                proposalId,
                action: responseAction,
                loading: true,
                error: null,
                startTime: now,
                timeout: timeout || state.operationTimeouts.defaultTimeout,
                retryCount: 0,
                maxRetries: 3,
                optimisticUpdate: optimisticStatus ? {
                    status: optimisticStatus,
                    timestamp: now,
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

        // Handle proposal operation failure with enhanced error tracking
        failProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                error: string;
                errorType?: ErrorType;
                errorCode?: string;
                originalStatus?: string;
                context?: Record<string, any>;
            }>
        ) => {
            const { proposalId, error, errorType = 'unknown', errorCode, originalStatus, context } = action.payload;
            const now = Date.now();

            // Create enhanced error info
            const errorInfo: ErrorInfo = {
                type: errorType,
                message: error,
                code: errorCode,
                timestamp: now,
                retryable: state.errorRecoveryStrategies[errorType].retryable,
                proposalId,
                context,
            };

            // Update operation with error
            if (state.activeOperations[proposalId]) {
                state.activeOperations[proposalId].loading = false;
                state.activeOperations[proposalId].error = error;
            }

            // Store error for this proposal
            state.proposalErrors[proposalId] = errorInfo;

            // Add to error history
            state.errorHistory.unshift(errorInfo);
            if (state.errorHistory.length > 100) {
                state.errorHistory = state.errorHistory.slice(0, 100);
            }

            // Update retry attempts tracking
            if (!state.retryAttempts[proposalId]) {
                state.retryAttempts[proposalId] = {
                    count: 0,
                    lastAttempt: now,
                    errors: [],
                };
            }
            state.retryAttempts[proposalId].errors.push(errorInfo);
            state.retryAttempts[proposalId].lastAttempt = now;

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
                    timestamp: now,
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
                const now = Date.now();
                state.activeOperations[proposalId] = {
                    proposalId,
                    action: responseAction,
                    loading: true,
                    error: null,
                    startTime: now,
                    timeout: state.operationTimeouts.defaultTimeout,
                    retryCount: 0,
                    maxRetries: 3,
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

        // Handle operation timeout
        timeoutProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                canRetry?: boolean;
            }>
        ) => {
            const { proposalId, canRetry = true } = action.payload;
            const operation = state.activeOperations[proposalId];

            if (!operation) return;

            const shouldRetry = canRetry && operation.retryCount < operation.maxRetries;

            if (shouldRetry) {
                // Increment retry count and restart operation
                operation.retryCount += 1;
                operation.startTime = Date.now();
                operation.error = null;
                operation.loading = true;
            } else {
                // Mark as failed due to timeout
                operation.loading = false;
                operation.error = `Operation timed out after ${operation.retryCount + 1} attempts`;

                // Remove from optimistic updates on timeout
                state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                    id => id !== proposalId
                );
                state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                    id => id !== proposalId
                );

                state.globalError = `Operation for proposal ${proposalId} timed out`;
            }
        },

        // Retry failed operation
        retryProposalOperation: (
            state,
            action: PayloadAction<{
                proposalId: string;
                resetRetryCount?: boolean;
            }>
        ) => {
            const { proposalId, resetRetryCount = false } = action.payload;
            const operation = state.activeOperations[proposalId];

            if (!operation) return;

            if (resetRetryCount) {
                operation.retryCount = 0;
            }

            if (operation.retryCount < operation.maxRetries) {
                operation.retryCount += 1;
                operation.startTime = Date.now();
                operation.error = null;
                operation.loading = true;
                state.globalError = null;
            }
        },

        // Clean up completed and timed out operations
        cleanupCompletedOperations: (state) => {
            const now = Date.now();
            const operationsToRemove: string[] = [];

            Object.entries(state.activeOperations).forEach(([proposalId, operation]) => {
                const isTimedOut = now - operation.startTime > (operation.timeout || state.operationTimeouts.defaultTimeout);
                const isCompleted = !operation.loading && operation.error !== null;
                const isStale = now - operation.startTime > state.operationTimeouts.maxTimeout;

                if (isTimedOut || isCompleted || isStale) {
                    operationsToRemove.push(proposalId);
                }
            });

            // Remove stale operations
            operationsToRemove.forEach(proposalId => {
                delete state.activeOperations[proposalId];

                // Clean up optimistic updates for removed operations
                state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                    id => id !== proposalId
                );
                state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                    id => id !== proposalId
                );
            });

            // Clean up old rollback data (older than 10 minutes)
            const rollbackCutoff = now - 600000; // 10 minutes
            Object.entries(state.rollbackData).forEach(([proposalId, data]) => {
                if (data.timestamp < rollbackCutoff) {
                    delete state.rollbackData[proposalId];
                }
            });

            // Clean up old success operations (older than 5 minutes)
            const successCutoff = now - 300000; // 5 minutes
            state.successOperations = state.successOperations.filter(
                op => op.timestamp > successCutoff
            );

            // Update last cleanup time
            state.lastCleanupTime = now;
        },

        // Force cleanup of specific operation
        forceCleanupOperation: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;

            delete state.activeOperations[proposalId];
            delete state.rollbackData[proposalId];

            // Remove from optimistic updates
            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                id => id !== proposalId
            );
            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                id => id !== proposalId
            );

            // Remove from success operations
            state.successOperations = state.successOperations.filter(
                op => op.proposalId !== proposalId
            );
        },

        // Update operation timeout settings
        updateOperationTimeouts: (
            state,
            action: PayloadAction<Partial<ProposalAcceptanceState['operationTimeouts']>>
        ) => {
            state.operationTimeouts = {
                ...state.operationTimeouts,
                ...action.payload,
            };
        },

        // Check and handle timed out operations
        checkTimedOutOperations: (state) => {
            const now = Date.now();

            Object.entries(state.activeOperations).forEach(([proposalId, operation]) => {
                if (operation.loading) {
                    const isTimedOut = now - operation.startTime > (operation.timeout || state.operationTimeouts.defaultTimeout);

                    if (isTimedOut) {
                        const shouldRetry = operation.retryCount < operation.maxRetries;

                        if (shouldRetry) {
                            operation.retryCount += 1;
                            operation.startTime = now;
                            operation.error = null;
                        } else {
                            operation.loading = false;
                            operation.error = `Operation timed out after ${operation.retryCount + 1} attempts`;

                            // Create timeout error info
                            const errorInfo: ErrorInfo = {
                                type: 'timeout',
                                message: operation.error,
                                timestamp: now,
                                retryable: false,
                                proposalId,
                            };

                            // Store error for this proposal
                            state.proposalErrors[proposalId] = errorInfo;

                            // Add to error history
                            state.errorHistory.unshift(errorInfo);
                            if (state.errorHistory.length > 100) {
                                state.errorHistory = state.errorHistory.slice(0, 100);
                            }

                            // Remove from optimistic updates
                            state.optimisticUpdates.acceptedProposals = state.optimisticUpdates.acceptedProposals.filter(
                                id => id !== proposalId
                            );
                            state.optimisticUpdates.rejectedProposals = state.optimisticUpdates.rejectedProposals.filter(
                                id => id !== proposalId
                            );
                        }
                    }
                }
            });
        },

        // Add specific error for proposal
        addProposalError: (
            state,
            action: PayloadAction<{
                proposalId: string;
                errorType: ErrorType;
                message: string;
                code?: string;
                context?: Record<string, any>;
            }>
        ) => {
            const { proposalId, errorType, message, code, context } = action.payload;
            const now = Date.now();

            const errorInfo: ErrorInfo = {
                type: errorType,
                message,
                code,
                timestamp: now,
                retryable: state.errorRecoveryStrategies[errorType].retryable,
                proposalId,
                context,
            };

            state.proposalErrors[proposalId] = errorInfo;
            state.errorHistory.unshift(errorInfo);

            if (state.errorHistory.length > 100) {
                state.errorHistory = state.errorHistory.slice(0, 100);
            }
        },

        // Clear specific proposal error
        clearProposalError: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.proposalErrors[proposalId];
        },

        // Clear all proposal errors
        clearAllProposalErrors: (state) => {
            state.proposalErrors = {};
        },

        // Update error recovery strategy
        updateErrorRecoveryStrategy: (
            state,
            action: PayloadAction<{
                errorType: ErrorType;
                strategy: Partial<ErrorRecoveryStrategy>;
            }>
        ) => {
            const { errorType, strategy } = action.payload;
            state.errorRecoveryStrategies[errorType] = {
                ...state.errorRecoveryStrategies[errorType],
                ...strategy,
            };
        },

        // Increment retry attempt
        incrementRetryAttempt: (
            state,
            action: PayloadAction<{
                proposalId: string;
                error?: ErrorInfo;
            }>
        ) => {
            const { proposalId, error } = action.payload;
            const now = Date.now();

            if (!state.retryAttempts[proposalId]) {
                state.retryAttempts[proposalId] = {
                    count: 0,
                    lastAttempt: now,
                    errors: [],
                };
            }

            state.retryAttempts[proposalId].count += 1;
            state.retryAttempts[proposalId].lastAttempt = now;

            if (error) {
                state.retryAttempts[proposalId].errors.push(error);
            }
        },

        // Reset retry attempts for proposal
        resetRetryAttempts: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.retryAttempts[proposalId];
        },

        // Clear old error history
        clearOldErrorHistory: (state, action: PayloadAction<number>) => {
            const cutoffTime = action.payload;
            state.errorHistory = state.errorHistory.filter(
                error => error.timestamp > cutoffTime
            );
        },

        // Categorize error by type
        categorizeError: (
            _state,
            action: PayloadAction<{
                error: string;
                statusCode?: number;
                context?: Record<string, any>;
            }>
        ) => {
            const { error, statusCode } = action.payload;

            // Categorize based on error message and status code
            // This logic can be used by middleware to determine error type
            if (error.toLowerCase().includes('network') || error.toLowerCase().includes('connection')) {
                // Network error detected
            } else if (error.toLowerCase().includes('timeout')) {
                // Timeout error detected
            } else if (error.toLowerCase().includes('permission') || statusCode === 403) {
                // Permission error detected
            } else if (error.toLowerCase().includes('validation') || statusCode === 400) {
                // Validation error detected
            } else if (statusCode && statusCode >= 500) {
                // Server error detected
            }

            // This action can be used by middleware to categorize errors
            // The result can then be used with addProposalError
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

    // Timeout and cleanup management
    timeoutProposalOperation,
    retryProposalOperation,
    cleanupCompletedOperations,
    forceCleanupOperation,
    updateOperationTimeouts,
    checkTimedOutOperations,

    // Enhanced error management
    addProposalError,
    clearProposalError,
    clearAllProposalErrors,
    updateErrorRecoveryStrategy,
    incrementRetryAttempt,
    resetRetryAttempts,
    clearOldErrorHistory,
    categorizeError,
} = proposalAcceptanceSlice.actions;

export default proposalAcceptanceSlice.reducer;

// Selectors for active operations state management
export const selectActiveOperations = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.activeOperations;

export const selectActiveOperationById = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.activeOperations[proposalId];

export const selectIsOperationActive = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => !!state.proposalAcceptance.activeOperations[proposalId]?.loading;

export const selectOperationError = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.activeOperations[proposalId]?.error;

export const selectOperationRetryCount = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.activeOperations[proposalId]?.retryCount || 0;

export const selectCanRetryOperation = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const operation = state.proposalAcceptance.activeOperations[proposalId];
    return operation ? operation.retryCount < operation.maxRetries : false;
};

export const selectTimedOutOperations = (state: { proposalAcceptance: ProposalAcceptanceState }) => {
    const now = Date.now();
    const { activeOperations, operationTimeouts } = state.proposalAcceptance;

    return Object.entries(activeOperations)
        .filter(([_, operation]) => {
            const timeout = operation.timeout || operationTimeouts.defaultTimeout;
            return operation.loading && (now - operation.startTime > timeout);
        })
        .map(([proposalId, operation]) => ({ proposalId, operation }));
};

export const selectOperationDuration = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const operation = state.proposalAcceptance.activeOperations[proposalId];
    return operation ? Date.now() - operation.startTime : 0;
};

export const selectOperationTimeRemaining = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const operation = state.proposalAcceptance.activeOperations[proposalId];
    if (!operation) return 0;

    const timeout = operation.timeout || state.proposalAcceptance.operationTimeouts.defaultTimeout;
    const elapsed = Date.now() - operation.startTime;
    return Math.max(0, timeout - elapsed);
};

export const selectNeedsCleanup = (state: { proposalAcceptance: ProposalAcceptanceState }) => {
    const now = Date.now();
    const { lastCleanupTime, operationTimeouts } = state.proposalAcceptance;
    return now - lastCleanupTime > operationTimeouts.cleanupInterval;
};

export const selectOperationStatistics = (state: { proposalAcceptance: ProposalAcceptanceState }) => {
    const operations = Object.values(state.proposalAcceptance.activeOperations);
    const now = Date.now();

    return {
        total: operations.length,
        loading: operations.filter(op => op.loading).length,
        failed: operations.filter(op => op.error !== null).length,
        timedOut: operations.filter(op => {
            const timeout = op.timeout || state.proposalAcceptance.operationTimeouts.defaultTimeout;
            return op.loading && (now - op.startTime > timeout);
        }).length,
        retrying: operations.filter(op => op.retryCount > 0).length,
    };
};

export const selectOptimisticUpdates = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.optimisticUpdates;

export const selectIsOptimisticallyAccepted = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.optimisticUpdates.acceptedProposals.includes(proposalId);

export const selectIsOptimisticallyRejected = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.optimisticUpdates.rejectedProposals.includes(proposalId);

export const selectRecentResponses = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.recentResponses;

export const selectSuccessOperations = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.successOperations;

export const selectRollbackData = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.rollbackData;

export const selectOperationTimeouts = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.operationTimeouts;

// Enhanced error management selectors
export const selectProposalErrors = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.proposalErrors;

export const selectProposalErrorById = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.proposalErrors[proposalId];

export const selectErrorHistory = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.errorHistory;

export const selectErrorRecoveryStrategies = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.errorRecoveryStrategies;

export const selectErrorRecoveryStrategy = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    errorType: ErrorType
) => state.proposalAcceptance.errorRecoveryStrategies[errorType];

export const selectRetryAttempts = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    state.proposalAcceptance.retryAttempts;

export const selectRetryAttemptsById = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => state.proposalAcceptance.retryAttempts[proposalId];

export const selectCanRetryProposal = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const error = state.proposalAcceptance.proposalErrors[proposalId];
    const retryData = state.proposalAcceptance.retryAttempts[proposalId];

    if (!error) return false;

    const strategy = state.proposalAcceptance.errorRecoveryStrategies[error.type];
    const currentRetries = retryData?.count || 0;

    return strategy.retryable && currentRetries < strategy.maxRetries;
};

export const selectErrorsByType = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    errorType: ErrorType
) => state.proposalAcceptance.errorHistory.filter(error => error.type === errorType);

export const selectRecentErrors = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    timeWindow: number = 300000 // 5 minutes
) => {
    const cutoff = Date.now() - timeWindow;
    return state.proposalAcceptance.errorHistory.filter(error => error.timestamp > cutoff);
};

export const selectErrorStatistics = (state: { proposalAcceptance: ProposalAcceptanceState }) => {
    const errors = state.proposalAcceptance.errorHistory;
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const recentErrors = errors.filter(error => now - error.timestamp < oneHour);

    const errorsByType = recentErrors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
    }, {} as Record<ErrorType, number>);

    return {
        total: errors.length,
        recent: recentErrors.length,
        byType: errorsByType,
        retryableErrors: recentErrors.filter(error => error.retryable).length,
        nonRetryableErrors: recentErrors.filter(error => !error.retryable).length,
    };
};

export const selectProposalsWithErrors = (state: { proposalAcceptance: ProposalAcceptanceState }) =>
    Object.keys(state.proposalAcceptance.proposalErrors);

export const selectHasProposalError = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => !!state.proposalAcceptance.proposalErrors[proposalId];

export const selectIsRetryableError = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const error = state.proposalAcceptance.proposalErrors[proposalId];
    return error ? error.retryable : false;
};

export const selectNextRetryDelay = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const error = state.proposalAcceptance.proposalErrors[proposalId];
    if (!error) return 0;

    const strategy = state.proposalAcceptance.errorRecoveryStrategies[error.type];
    const retryData = state.proposalAcceptance.retryAttempts[proposalId];
    const retryCount = retryData?.count || 0;

    // Exponential backoff: base delay * (2 ^ retry count)
    return strategy.retryDelay * Math.pow(2, retryCount);
};

export const selectErrorContext = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const error = state.proposalAcceptance.proposalErrors[proposalId];
    return error?.context || {};
};

export const selectUserFriendlyErrorMessage = (
    state: { proposalAcceptance: ProposalAcceptanceState },
    proposalId: string
) => {
    const error = state.proposalAcceptance.proposalErrors[proposalId];
    if (!error) return null;

    const strategy = state.proposalAcceptance.errorRecoveryStrategies[error.type];
    return strategy.userMessage;
};