import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { ProposalResponseAction } from '@booking-swap/shared';

// Base selectors
export const selectProposalAcceptanceState = (state: RootState) => state.proposalAcceptance;

export const selectActiveOperations = (state: RootState) =>
    state.proposalAcceptance.activeOperations;

export const selectRecentResponses = (state: RootState) =>
    state.proposalAcceptance.recentResponses;

export const selectGlobalLoading = (state: RootState) =>
    state.proposalAcceptance.globalLoading;

export const selectGlobalError = (state: RootState) =>
    state.proposalAcceptance.globalError;

export const selectOptimisticUpdates = (state: RootState) =>
    state.proposalAcceptance.optimisticUpdates;

export const selectSuccessOperations = (state: RootState) =>
    state.proposalAcceptance.successOperations;

export const selectRollbackData = (state: RootState) =>
    state.proposalAcceptance.rollbackData;

// Computed selectors
export const selectOperationByProposalId = createSelector(
    [selectActiveOperations, (_state: RootState, proposalId: string) => proposalId],
    (operations, proposalId) => operations[proposalId] || null
);

export const selectIsProposalLoading = createSelector(
    [selectActiveOperations, (_state: RootState, proposalId: string) => proposalId],
    (operations, proposalId) => operations[proposalId]?.loading || false
);

export const selectProposalOperationError = createSelector(
    [selectActiveOperations, (_state: RootState, proposalId: string) => proposalId],
    (operations, proposalId) => operations[proposalId]?.error || null
);

export const selectHasActiveOperations = createSelector(
    [selectActiveOperations],
    (operations) => Object.keys(operations).length > 0
);

export const selectActiveOperationCount = createSelector(
    [selectActiveOperations],
    (operations) => Object.keys(operations).length
);

export const selectLoadingOperations = createSelector(
    [selectActiveOperations],
    (operations) => Object.values(operations).filter((op: any) => op.loading)
);

export const selectErrorOperations = createSelector(
    [selectActiveOperations],
    (operations) => Object.values(operations).filter((op: any) => op.error)
);

export const selectOperationsByAction = createSelector(
    [selectActiveOperations, (_state: RootState, action: ProposalResponseAction) => action],
    (operations, action) => Object.values(operations).filter((op: any) => op.action === action)
);

export const selectAcceptanceOperations = createSelector(
    [selectActiveOperations],
    (operations) => Object.values(operations).filter((op: any) => op.action === 'accept')
);

export const selectRejectionOperations = createSelector(
    [selectActiveOperations],
    (operations) => Object.values(operations).filter((op: any) => op.action === 'reject')
);

// Optimistic update selectors
export const selectIsProposalOptimisticallyAccepted = createSelector(
    [selectOptimisticUpdates, (_state: RootState, proposalId: string) => proposalId],
    (optimisticUpdates, proposalId) =>
        optimisticUpdates.acceptedProposals.includes(proposalId)
);

export const selectIsProposalOptimisticallyRejected = createSelector(
    [selectOptimisticUpdates, (_state: RootState, proposalId: string) => proposalId],
    (optimisticUpdates, proposalId) =>
        optimisticUpdates.rejectedProposals.includes(proposalId)
);

export const selectHasOptimisticUpdates = createSelector(
    [selectOptimisticUpdates],
    (optimisticUpdates) =>
        optimisticUpdates.acceptedProposals.length > 0 ||
        optimisticUpdates.rejectedProposals.length > 0
);

export const selectOptimisticUpdateCount = createSelector(
    [selectOptimisticUpdates],
    (optimisticUpdates) =>
        optimisticUpdates.acceptedProposals.length + optimisticUpdates.rejectedProposals.length
);

// Success operation selectors
export const selectRecentSuccessOperations = createSelector(
    [selectSuccessOperations],
    (successOperations) => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        return successOperations.filter((op: any) => op.timestamp > fiveMinutesAgo);
    }
);

export const selectSuccessOperationsByAction = createSelector(
    [selectSuccessOperations, (_state: RootState, action: ProposalResponseAction) => action],
    (successOperations, action) => successOperations.filter((op: any) => op.action === action)
);

export const selectRecentAcceptances = createSelector(
    [selectRecentSuccessOperations],
    (recentOperations) => recentOperations.filter((op: any) => op.action === 'accept')
);

export const selectRecentRejections = createSelector(
    [selectRecentSuccessOperations],
    (recentOperations) => recentOperations.filter((op: any) => op.action === 'reject')
);

// Rollback selectors
export const selectProposalRollbackData = createSelector(
    [selectRollbackData, (_state: RootState, proposalId: string) => proposalId],
    (rollbackData, proposalId) => rollbackData[proposalId] || null
);

export const selectHasRollbackData = createSelector(
    [selectRollbackData],
    (rollbackData) => Object.keys(rollbackData).length > 0
);

// Combined status selectors
export const selectProposalStatus = createSelector(
    [
        selectOperationByProposalId,
        selectIsProposalOptimisticallyAccepted,
        selectIsProposalOptimisticallyRejected,
        selectProposalRollbackData,
    ],
    (operation, isOptimisticallyAccepted, isOptimisticallyRejected, rollbackData) => {
        if (operation?.loading) {
            return {
                status: 'loading',
                action: operation.action,
                error: operation.error,
            };
        }

        if (operation?.error) {
            return {
                status: 'error',
                action: operation.action,
                error: operation.error,
                rollbackData,
            };
        }

        if (isOptimisticallyAccepted) {
            return {
                status: 'optimistic_accepted',
                action: 'accept' as const,
            };
        }

        if (isOptimisticallyRejected) {
            return {
                status: 'optimistic_rejected',
                action: 'reject' as const,
            };
        }

        return {
            status: 'idle',
        };
    }
);

// Statistics selectors
export const selectOperationStatistics = createSelector(
    [selectActiveOperations, selectSuccessOperations, selectOptimisticUpdates],
    (activeOperations, successOperations, optimisticUpdates) => {
        const activeCount = Object.keys(activeOperations).length;
        const loadingCount = Object.values(activeOperations).filter((op: any) => op.loading).length;
        const errorCount = Object.values(activeOperations).filter((op: any) => op.error).length;

        const recentSuccessCount = successOperations.filter(
            (op: any) => op.timestamp > Date.now() - 5 * 60 * 1000
        ).length;

        const optimisticCount = optimisticUpdates.acceptedProposals.length +
            optimisticUpdates.rejectedProposals.length;

        return {
            active: activeCount,
            loading: loadingCount,
            errors: errorCount,
            recentSuccess: recentSuccessCount,
            optimistic: optimisticCount,
        };
    }
);

// UI helper selectors
export const selectShouldShowLoadingIndicator = createSelector(
    [selectGlobalLoading, selectLoadingOperations],
    (globalLoading, loadingOperations) =>
        globalLoading || loadingOperations.length > 0
);

export const selectShouldShowErrorMessage = createSelector(
    [selectGlobalError, selectErrorOperations],
    (globalError, errorOperations) =>
        globalError || errorOperations.length > 0
);

export const selectErrorMessage = createSelector(
    [selectGlobalError, selectErrorOperations],
    (globalError, errorOperations) => {
        if (globalError) return globalError;
        if (errorOperations.length > 0) {
            return errorOperations[0].error;
        }
        return null;
    }
);

// Proposal-specific combined selectors (for use with proposal data)
export const selectProposalWithAcceptanceStatus = createSelector(
    [
        (_state: RootState, proposalId: string) => proposalId,
        selectProposalStatus,
        selectRecentResponses,
    ],
    (proposalId, status, recentResponses) => {
        const recentResponse = recentResponses.find((r: any) => r.proposalId === proposalId);

        return {
            proposalId,
            acceptanceStatus: status,
            recentResponse,
        };
    }
);

// Batch operation selectors
export const selectBatchOperationProgress = createSelector(
    [selectActiveOperations, selectSuccessOperations],
    (activeOperations, successOperations) => {
        const activeProposalIds = Object.keys(activeOperations);
        const recentSuccessIds = successOperations
            .filter((op: any) => op.timestamp > Date.now() - 60 * 1000) // Last minute
            .map((op: any) => op.proposalId);

        const totalOperations = activeProposalIds.length + recentSuccessIds.length;
        const completedOperations = recentSuccessIds.length;

        if (totalOperations === 0) {
            return { progress: 0, total: 0, completed: 0 };
        }

        return {
            progress: (completedOperations / totalOperations) * 100,
            total: totalOperations,
            completed: completedOperations,
        };
    }
);