import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
  SwapProposalStatus,
  ProposalSummary,
  CompatibilityAnalysis,
  EligibleSwap,
} from '@booking-swap/shared';

// Base selectors
export const selectProposalState = (state: RootState) => state.proposals;
export const selectEligibleSwapsState = (state: RootState) => state.eligibleSwaps;
export const selectCompatibilityState = (state: RootState) => state.compatibility;

// Proposal creation selectors
export const selectProposalCreation = createSelector(
  [selectProposalState],
  (proposalState) => proposalState.creation
);

export const selectIsProposalModalOpen = createSelector(
  [selectProposalCreation],
  (creation) => creation.isModalOpen
);

export const selectProposalStep = createSelector(
  [selectProposalCreation],
  (creation) => creation.step
);

export const selectTargetSwapId = createSelector(
  [selectProposalCreation],
  (creation) => creation.targetSwapId
);

export const selectSelectedSourceSwapId = createSelector(
  [selectProposalCreation],
  (creation) => creation.selectedSourceSwapId
);

export const selectProposalFormData = createSelector(
  [selectProposalCreation],
  (creation) => creation.formData
);

export const selectProposalValidation = createSelector(
  [selectProposalCreation],
  (creation) => creation.validationResult
);

// Proposal history selectors
export const selectProposalHistory = createSelector(
  [selectProposalState],
  (proposalState) => proposalState.proposalHistory
);

export const selectProposalsByStatus = createSelector(
  [selectProposalState],
  (proposalState) => ({
    pending: proposalState.pendingProposals,
    accepted: proposalState.acceptedProposals,
    rejected: proposalState.rejectedProposals,
    expired: proposalState.expiredProposals,
  })
);

export const selectProposalStatistics = createSelector(
  [selectProposalState],
  (proposalState) => {
    const total = proposalState.proposalHistory.length;
    const pending = proposalState.pendingProposals.length;
    const accepted = proposalState.acceptedProposals.length;
    const rejected = proposalState.rejectedProposals.length;
    const expired = proposalState.expiredProposals.length;
    
    const successRate = total > 0 ? (accepted / total) * 100 : 0;
    const responseRate = total > 0 ? ((accepted + rejected) / total) * 100 : 0;

    return {
      total,
      pending,
      accepted,
      rejected,
      expired,
      successRate,
      responseRate,
    };
  }
);

// Eligible swaps selectors
export const selectEligibleSwaps = createSelector(
  [selectEligibleSwapsState],
  (eligibleSwapsState) => eligibleSwapsState.eligibleSwaps
);

export const selectEligibleSwapsTotalCount = createSelector(
  [selectEligibleSwapsState],
  (eligibleSwapsState) => eligibleSwapsState.totalCount
);

export const selectSelectedEligibleSwap = createSelector(
  [selectEligibleSwapsState],
  (eligibleSwapsState) => {
    if (!eligibleSwapsState.selectedSwapId) return null;
    return eligibleSwapsState.eligibleSwaps.find(
      swap => swap.id === eligibleSwapsState.selectedSwapId
    );
  }
);

export const selectEligibleSwapsFilters = createSelector(
  [selectEligibleSwapsState],
  (eligibleSwapsState) => eligibleSwapsState.filters
);

export const selectCompatibleEligibleSwaps = createSelector(
  [selectEligibleSwaps, selectEligibleSwapsFilters],
  (eligibleSwaps, filters) => {
    const threshold = filters.compatibilityThreshold || 60;
    return eligibleSwaps.filter(swap => (swap.compatibilityScore || 0) >= threshold);
  }
);

export const selectEligibleSwapsByCompatibility = createSelector(
  [selectEligibleSwaps],
  (eligibleSwaps) => {
    return [...eligibleSwaps].sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));
  }
);

// Compatibility analysis selectors
export const selectCurrentCompatibilityAnalysis = createSelector(
  [selectCompatibilityState],
  (compatibilityState) => compatibilityState.currentAnalysis
);

export const selectCurrentSwapPair = createSelector(
  [selectCompatibilityState],
  (compatibilityState) => compatibilityState.currentSwapPair
);

export const selectCompatibilitySettings = createSelector(
  [selectCompatibilityState],
  (compatibilityState) => compatibilityState.settings
);

export const selectBatchAnalysisState = createSelector(
  [selectCompatibilityState],
  (compatibilityState) => compatibilityState.batchAnalysis
);

export const selectCompatibilityStatistics = createSelector(
  [selectCompatibilityState],
  (compatibilityState) => {
    const analyses = Object.values(compatibilityState.analysesByPair);
    const total = analyses.length;
    
    if (total === 0) {
      return {
        total: 0,
        averageScore: 0,
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };
    }
    
    const { thresholds } = compatibilityState.settings;
    const excellent = analyses.filter(a => a.overallScore >= thresholds.excellent).length;
    const good = analyses.filter(a => a.overallScore >= thresholds.good && a.overallScore < thresholds.excellent).length;
    const fair = analyses.filter(a => a.overallScore >= thresholds.fair && a.overallScore < thresholds.good).length;
    const poor = analyses.filter(a => a.overallScore < thresholds.fair).length;
    
    const averageScore = analyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / total;
    
    return {
      total,
      averageScore,
      excellent,
      good,
      fair,
      poor,
    };
  }
);

// Combined selectors for proposal workflow
export const selectProposalWorkflowData = createSelector(
  [
    selectProposalCreation,
    selectEligibleSwaps,
    selectCurrentCompatibilityAnalysis,
    selectSelectedEligibleSwap,
  ],
  (creation, eligibleSwaps, compatibility, selectedSwap) => ({
    creation,
    eligibleSwaps,
    compatibility,
    selectedSwap,
    isReady: creation.targetSwapId && eligibleSwaps.length > 0,
    canProceed: creation.selectedSourceSwapId && compatibility,
  })
);

export const selectProposalCreationProgress = createSelector(
  [selectProposalCreation],
  (creation) => {
    const steps = ['select_swap', 'add_details', 'review', 'submitting', 'success', 'error'];
    const currentStepIndex = steps.indexOf(creation.step);
    const totalSteps = 4; // Excluding success and error states
    
    return {
      currentStep: currentStepIndex + 1,
      totalSteps,
      progress: Math.min((currentStepIndex / (totalSteps - 1)) * 100, 100),
      isComplete: creation.step === 'success',
      hasError: creation.step === 'error',
    };
  }
);

// Loading and error state selectors
export const selectProposalLoadingStates = createSelector(
  [selectProposalState, selectEligibleSwapsState, selectCompatibilityState],
  (proposalState, eligibleSwapsState, compatibilityState) => ({
    proposals: proposalState.loading,
    eligibleSwaps: eligibleSwapsState.loading,
    compatibility: compatibilityState.loading,
    anyLoading: proposalState.loading || eligibleSwapsState.loading || compatibilityState.loading,
  })
);

export const selectProposalErrorStates = createSelector(
  [selectProposalState, selectEligibleSwapsState, selectCompatibilityState],
  (proposalState, eligibleSwapsState, compatibilityState) => ({
    proposals: proposalState.error,
    eligibleSwaps: eligibleSwapsState.error,
    compatibility: compatibilityState.error,
    hasAnyError: !!(proposalState.error || eligibleSwapsState.error || compatibilityState.error),
  })
);

// Optimistic updates selectors
export const selectOptimisticUpdates = createSelector(
  [selectProposalState, selectEligibleSwapsState, selectCompatibilityState],
  (proposalState, eligibleSwapsState, compatibilityState) => ({
    proposals: proposalState.optimisticUpdates,
    eligibleSwaps: eligibleSwapsState.optimisticUpdates,
    compatibility: compatibilityState.optimisticUpdates,
  })
);

// Cache validity selectors
export const selectCacheValidityStates = createSelector(
  [selectProposalState, selectEligibleSwapsState, selectCompatibilityState],
  (proposalState, eligibleSwapsState, compatibilityState) => ({
    proposalsValid: proposalState.lastFetchTime && 
      Date.now() - proposalState.lastFetchTime < proposalState.cacheExpiry,
    eligibleSwapsValid: (targetSwapId: string) => {
      const lastFetch = eligibleSwapsState.lastFetchTime[targetSwapId];
      return lastFetch && Date.now() - lastFetch < eligibleSwapsState.cacheExpiry;
    },
    compatibilityValid: (pairKey: string) => {
      const lastFetch = compatibilityState.lastFetchTime[pairKey];
      return lastFetch && Date.now() - lastFetch < compatibilityState.cacheExpiry;
    },
  })
);

// Filtered data selectors
export const selectFilteredProposals = createSelector(
  [selectProposalState],
  (proposalState) => {
    const { proposalHistory, filters } = proposalState;
    let filtered = proposalHistory;

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(proposal => proposal.status === filters.status);
    }

    // Apply date range filter
    if (filters.dateRange) {
      filtered = filtered.filter(proposal => {
        const proposalDate = new Date(proposal.createdAt);
        return proposalDate >= filters.dateRange!.start && proposalDate <= filters.dateRange!.end;
      });
    }

    // Apply search term filter
    if (filters.searchTerm) {
      const searchTerm = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(proposal =>
        proposal.sourceSwapTitle.toLowerCase().includes(searchTerm) ||
        proposal.targetSwapTitle.toLowerCase().includes(searchTerm) ||
        proposal.message?.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }
);

// Utility selectors for specific use cases
export const selectProposalById = (proposalId: string) =>
  createSelector(
    [selectProposalHistory],
    (proposals) => proposals.find(p => p.id === proposalId)
  );

export const selectEligibleSwapById = (swapId: string) =>
  createSelector(
    [selectEligibleSwaps],
    (eligibleSwaps) => eligibleSwaps.find(s => s.id === swapId)
  );

export const selectCompatibilityForPair = (sourceSwapId: string, targetSwapId: string) =>
  createSelector(
    [selectCompatibilityState],
    (compatibilityState) => {
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      return compatibilityState.analysesByPair[pairKey] || null;
    }
  );

export const selectProposalsForSwap = (swapId: string) =>
  createSelector(
    [selectProposalHistory],
    (proposals) => proposals.filter(
      p => p.sourceSwapId === swapId || p.targetSwapId === swapId
    )
  );

export const selectRecentProposals = (limit: number = 5) =>
  createSelector(
    [selectProposalHistory],
    (proposals) => proposals.slice(0, limit)
  );

export const selectPendingProposalsRequiringAction = (userId: string) =>
  createSelector(
    [selectProposalsByStatus],
    (proposalsByStatus) => proposalsByStatus.pending.filter(
      p => p.targetOwnerId === userId && p.proposerId !== userId
    )
  );

export const selectUserProposalActivity = (userId: string) =>
  createSelector(
    [selectProposalHistory],
    (proposals) => {
      const userProposals = proposals.filter(p => p.proposerId === userId);
      const receivedProposals = proposals.filter(p => p.targetOwnerId === userId);
      
      return {
        sent: userProposals,
        received: receivedProposals,
        totalSent: userProposals.length,
        totalReceived: receivedProposals.length,
        pendingSent: userProposals.filter(p => p.status === 'pending').length,
        pendingReceived: receivedProposals.filter(p => p.status === 'pending').length,
      };
    }
  );