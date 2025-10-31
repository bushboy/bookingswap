import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Completion-related interfaces
export interface CompletionStatus {
    completionId: string;
    proposalId: string;
    status: 'initiated' | 'completed' | 'failed' | 'rolled_back';
    completionType: 'booking_exchange' | 'cash_payment';
    initiatedBy: string;
    completedAt?: Date;
    errorDetails?: string;

    // Entities involved
    affectedSwaps: string[];
    affectedBookings: string[];

    // Transaction details
    databaseTransactionId?: string;
    blockchainTransactionId?: string;

    // Validation results
    preValidationResult?: CompletionValidationResult;
    postValidationResult?: CompletionValidationResult;
}

export interface CompletionValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    inconsistentEntities: string[];
    correctionAttempts?: CorrectionAttempt[];
}

export interface CorrectionAttempt {
    entityType: 'swap' | 'booking' | 'proposal';
    entityId: string;
    expectedStatus: string;
    actualStatus: string;
    correctionApplied: boolean;
    correctionError?: string;
}

export interface CompletionAuditRecord {
    completionId: string;
    proposalId: string;
    completionType: 'booking_exchange' | 'cash_payment';
    initiatedBy: string;
    completedAt: Date;

    // Entities involved
    affectedSwaps: string[];
    affectedBookings: string[];

    // Transaction details
    databaseTransactionId: string;
    blockchainTransactionId?: string;

    // Status tracking
    status: 'initiated' | 'completed' | 'failed' | 'rolled_back';
    errorDetails?: string;

    // Validation results
    preValidationResult?: CompletionValidationResult;
    postValidationResult?: CompletionValidationResult;
}

export interface OptimisticCompletionUpdate {
    proposalId: string;
    completionType: 'booking_exchange' | 'cash_payment';
    expectedSwapUpdates: Array<{
        swapId: string;
        expectedStatus: string;
    }>;
    expectedBookingUpdates: Array<{
        bookingId: string;
        expectedStatus: string;
    }>;
    timestamp: Date;
}

interface CompletionState {
    // Completion status tracking
    completionStatuses: Record<string, CompletionStatus>; // proposalId -> CompletionStatus

    // Audit trail
    auditRecords: CompletionAuditRecord[];
    currentAuditRecord: CompletionAuditRecord | null;

    // Validation results
    validationResults: Record<string, CompletionValidationResult>; // proposalId -> ValidationResult

    // Optimistic updates
    optimisticUpdates: Record<string, OptimisticCompletionUpdate>; // proposalId -> OptimisticUpdate

    // UI state
    loading: boolean;
    error: string | null;

    // Real-time updates
    lastUpdateTime: number | null;

    // Cache management
    lastFetchTime: number | null;
    cacheExpiry: number; // 2 minutes for completion data

    // Statistics
    completionStats: {
        totalCompletions: number;
        successfulCompletions: number;
        failedCompletions: number;
        rolledBackCompletions: number;
        averageCompletionTime: number;
        successRate: number;
    } | null;
}

const initialState: CompletionState = {
    // Completion status tracking
    completionStatuses: {},

    // Audit trail
    auditRecords: [],
    currentAuditRecord: null,

    // Validation results
    validationResults: {},

    // Optimistic updates
    optimisticUpdates: {},

    // UI state
    loading: false,
    error: null,

    // Real-time updates
    lastUpdateTime: null,

    // Cache management
    lastFetchTime: null,
    cacheExpiry: 2 * 60 * 1000, // 2 minutes

    // Statistics
    completionStats: null,
};

export const completionSlice = createSlice({
    name: 'completion',
    initialState,
    reducers: {
        // Loading and error states
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
            if (action.payload) {
                state.error = null;
            }
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        },

        // Completion status management
        setCompletionStatus: (
            state,
            action: PayloadAction<{ proposalId: string; status: CompletionStatus }>
        ) => {
            const { proposalId, status } = action.payload;
            state.completionStatuses[proposalId] = status;
            state.lastUpdateTime = Date.now();
        },

        updateCompletionStatus: (
            state,
            action: PayloadAction<{
                proposalId: string;
                updates: Partial<CompletionStatus>;
            }>
        ) => {
            const { proposalId, updates } = action.payload;
            if (state.completionStatuses[proposalId]) {
                state.completionStatuses[proposalId] = {
                    ...state.completionStatuses[proposalId],
                    ...updates,
                };
                state.lastUpdateTime = Date.now();
            }
        },

        removeCompletionStatus: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.completionStatuses[proposalId];
        },

        // Audit trail management
        setAuditRecords: (state, action: PayloadAction<CompletionAuditRecord[]>) => {
            state.auditRecords = action.payload;
            state.lastFetchTime = Date.now();
            state.loading = false;
            state.error = null;
        },

        addAuditRecord: (state, action: PayloadAction<CompletionAuditRecord>) => {
            state.auditRecords.unshift(action.payload); // Add to beginning
        },

        updateAuditRecord: (state, action: PayloadAction<CompletionAuditRecord>) => {
            const record = action.payload;
            const index = state.auditRecords.findIndex(r => r.completionId === record.completionId);
            if (index !== -1) {
                state.auditRecords[index] = record;
            }

            // Update current audit record if it's the same
            if (state.currentAuditRecord?.completionId === record.completionId) {
                state.currentAuditRecord = record;
            }
        },

        setCurrentAuditRecord: (
            state,
            action: PayloadAction<CompletionAuditRecord | null>
        ) => {
            state.currentAuditRecord = action.payload;
        },

        // Validation results management
        setValidationResult: (
            state,
            action: PayloadAction<{
                proposalId: string;
                result: CompletionValidationResult;
            }>
        ) => {
            const { proposalId, result } = action.payload;
            state.validationResults[proposalId] = result;
        },

        removeValidationResult: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.validationResults[proposalId];
        },

        // Optimistic updates management
        addOptimisticUpdate: (
            state,
            action: PayloadAction<OptimisticCompletionUpdate>
        ) => {
            const update = action.payload;
            state.optimisticUpdates[update.proposalId] = update;
        },

        removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
            const proposalId = action.payload;
            delete state.optimisticUpdates[proposalId];
        },

        updateOptimisticUpdate: (
            state,
            action: PayloadAction<{
                proposalId: string;
                updates: Partial<OptimisticCompletionUpdate>;
            }>
        ) => {
            const { proposalId, updates } = action.payload;
            if (state.optimisticUpdates[proposalId]) {
                state.optimisticUpdates[proposalId] = {
                    ...state.optimisticUpdates[proposalId],
                    ...updates,
                };
            }
        },

        // Real-time updates
        updateLastUpdateTime: (state) => {
            state.lastUpdateTime = Date.now();
        },

        // Cache management
        invalidateCache: (state) => {
            state.lastFetchTime = null;
        },

        // Statistics
        setCompletionStats: (
            state,
            action: PayloadAction<CompletionState['completionStats']>
        ) => {
            state.completionStats = action.payload;
        },

        // Reset state
        resetCompletionState: (state) => {
            Object.assign(state, initialState);
        },

        // Batch operations
        updateMultipleCompletionStatuses: (
            state,
            action: PayloadAction<Array<{ proposalId: string; status: CompletionStatus }>>
        ) => {
            action.payload.forEach(({ proposalId, status }) => {
                state.completionStatuses[proposalId] = status;
            });
            state.lastUpdateTime = Date.now();
        },

        // Error rollback handling
        rollbackOptimisticUpdate: (
            state,
            action: PayloadAction<{ proposalId: string; error: string }>
        ) => {
            const { proposalId, error } = action.payload;

            // Remove optimistic update
            delete state.optimisticUpdates[proposalId];

            // Update completion status to failed
            if (state.completionStatuses[proposalId]) {
                state.completionStatuses[proposalId] = {
                    ...state.completionStatuses[proposalId],
                    status: 'failed',
                    errorDetails: error,
                };
            }

            state.error = error;
            state.loading = false;
        },
    },
});

export const {
    // Loading and error states
    setLoading,
    setError,

    // Completion status management
    setCompletionStatus,
    updateCompletionStatus,
    removeCompletionStatus,
    updateMultipleCompletionStatuses,

    // Audit trail management
    setAuditRecords,
    addAuditRecord,
    updateAuditRecord,
    setCurrentAuditRecord,

    // Validation results management
    setValidationResult,
    removeValidationResult,

    // Optimistic updates management
    addOptimisticUpdate,
    removeOptimisticUpdate,
    updateOptimisticUpdate,
    rollbackOptimisticUpdate,

    // Real-time updates
    updateLastUpdateTime,

    // Cache management
    invalidateCache,

    // Statistics
    setCompletionStats,

    // Reset state
    resetCompletionState,
} = completionSlice.actions;

// Basic selectors
export const selectCompletionStatuses = (state: { completion: CompletionState }) =>
    state.completion.completionStatuses;

export const selectAuditRecords = (state: { completion: CompletionState }) =>
    state.completion.auditRecords;

export const selectCurrentAuditRecord = (state: { completion: CompletionState }) =>
    state.completion.currentAuditRecord;

export const selectValidationResults = (state: { completion: CompletionState }) =>
    state.completion.validationResults;

export const selectOptimisticUpdates = (state: { completion: CompletionState }) =>
    state.completion.optimisticUpdates;

export const selectCompletionLoading = (state: { completion: CompletionState }) =>
    state.completion.loading;

export const selectCompletionError = (state: { completion: CompletionState }) =>
    state.completion.error;

export const selectLastUpdateTime = (state: { completion: CompletionState }) =>
    state.completion.lastUpdateTime;

export const selectCompletionStats = (state: { completion: CompletionState }) =>
    state.completion.completionStats;

// Computed selectors
export const selectCompletionStatusByProposal = (
    state: { completion: CompletionState },
    proposalId: string
) => state.completion.completionStatuses[proposalId];

export const selectValidationResultByProposal = (
    state: { completion: CompletionState },
    proposalId: string
) => state.completion.validationResults[proposalId];

export const selectOptimisticUpdateByProposal = (
    state: { completion: CompletionState },
    proposalId: string
) => state.completion.optimisticUpdates[proposalId];

export const selectAuditRecordByCompletion = (
    state: { completion: CompletionState },
    completionId: string
) => state.completion.auditRecords.find(record => record.completionId === completionId);

export const selectAuditRecordsByProposal = (
    state: { completion: CompletionState },
    proposalId: string
) => state.completion.auditRecords.filter(record => record.proposalId === proposalId);

export const selectCompletionsByStatus = (
    state: { completion: CompletionState },
    status: CompletionStatus['status']
) => Object.values(state.completion.completionStatuses).filter(
    completion => completion.status === status
);

export const selectCompletionsByType = (
    state: { completion: CompletionState },
    type: CompletionStatus['completionType']
) => Object.values(state.completion.completionStatuses).filter(
    completion => completion.completionType === type
);

export const selectActiveCompletions = (state: { completion: CompletionState }) =>
    Object.values(state.completion.completionStatuses).filter(
        completion => completion.status === 'initiated'
    );

export const selectFailedCompletions = (state: { completion: CompletionState }) =>
    Object.values(state.completion.completionStatuses).filter(
        completion => completion.status === 'failed'
    );

export const selectCompletionsRequiringAttention = (state: { completion: CompletionState }) =>
    Object.values(state.completion.completionStatuses).filter(
        completion =>
            completion.status === 'failed' ||
            (completion.postValidationResult?.errors && completion.postValidationResult.errors.length > 0)
    );

export const selectIsCacheValid = (state: { completion: CompletionState }) => {
    if (!state.completion.lastFetchTime) return false;
    return Date.now() - state.completion.lastFetchTime < state.completion.cacheExpiry;
};

export const selectHasOptimisticUpdate = (
    state: { completion: CompletionState },
    proposalId: string
) => !!state.completion.optimisticUpdates[proposalId];

export const selectCompletionStatistics = (state: { completion: CompletionState }) => {
    const completions = Object.values(state.completion.completionStatuses);
    const total = completions.length;
    const successful = completions.filter(c => c.status === 'completed').length;
    const failed = completions.filter(c => c.status === 'failed').length;
    const rolledBack = completions.filter(c => c.status === 'rolled_back').length;

    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Calculate average completion time for successful completions
    const successfulWithTimes = completions.filter(
        c => c.status === 'completed' && c.completedAt
    );

    const averageCompletionTime = successfulWithTimes.length > 0
        ? successfulWithTimes.reduce((sum) => {
            // Assuming completion takes some time, we'd need to track initiation time
            // For now, using a placeholder calculation
            return sum + 1000; // 1 second average placeholder
        }, 0) / successfulWithTimes.length
        : 0;

    return {
        totalCompletions: total,
        successfulCompletions: successful,
        failedCompletions: failed,
        rolledBackCompletions: rolledBack,
        averageCompletionTime,
        successRate,
    };
};

export default completionSlice.reducer;