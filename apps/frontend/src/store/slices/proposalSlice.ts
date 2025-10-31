import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  SwapProposalStatus,
  ProposalSummary,
  ProposalHistoryResponse,
  ValidationResult,
} from '@booking-swap/shared';

// Proposal creation state
interface ProposalCreationState {
  targetSwapId: string | null;
  selectedSourceSwapId: string | null;
  formData: Partial<CreateProposalFromBrowseRequest>;
  isModalOpen: boolean;
  step: 'select_swap' | 'add_details' | 'review' | 'submitting' | 'success' | 'error';
  validationResult: ValidationResult | null;
}

// Proposal state interface
interface ProposalState {
  // Proposal creation workflow
  creation: ProposalCreationState;

  // Current proposals being managed
  currentProposals: ProposalSummary[];

  // Proposal history
  proposalHistory: ProposalSummary[];

  // Proposals by status
  pendingProposals: ProposalSummary[];
  acceptedProposals: ProposalSummary[];
  rejectedProposals: ProposalSummary[];
  expiredProposals: ProposalSummary[];

  // Received proposals (proposals where current user is the target)
  receivedProposals: ProposalSummary[];

  // Sent proposals (proposals where current user is the proposer)
  sentProposals: ProposalSummary[];

  // UI state
  loading: boolean;
  error: string | null;

  // Pagination for history
  historyPagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };

  // Filters for proposal history
  filters: {
    status?: SwapProposalStatus;
    dateRange?: {
      start: Date;
      end: Date;
    };
    searchTerm?: string;
  };

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 5 minutes

  // Real-time updates
  lastUpdateTime: number | null;

  // Optimistic updates
  optimisticUpdates: {
    creatingProposals: string[]; // proposal IDs being created
    updatingProposals: string[]; // proposal IDs being updated
  };
}

const initialCreationState: ProposalCreationState = {
  targetSwapId: null,
  selectedSourceSwapId: null,
  formData: {},
  isModalOpen: false,
  step: 'select_swap',
  validationResult: null,
};

const initialState: ProposalState = {
  creation: initialCreationState,
  currentProposals: [],
  proposalHistory: [],
  pendingProposals: [],
  acceptedProposals: [],
  rejectedProposals: [],
  expiredProposals: [],
  receivedProposals: [],
  sentProposals: [],
  loading: false,
  error: null,
  historyPagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNext: false,
    hasPrevious: false,
  },
  filters: {},
  lastFetchTime: null,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
  lastUpdateTime: null,
  optimisticUpdates: {
    creatingProposals: [],
    updatingProposals: [],
  },
};

export const proposalSlice = createSlice({
  name: 'proposals',
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

    // Proposal creation workflow
    openProposalModal: (state, action: PayloadAction<{ targetSwapId: string }>) => {
      state.creation.targetSwapId = action.payload.targetSwapId;
      state.creation.isModalOpen = true;
      state.creation.step = 'select_swap';
      state.creation.formData = {};
      state.creation.selectedSourceSwapId = null;
      state.creation.validationResult = null;
    },
    closeProposalModal: (state) => {
      state.creation = initialCreationState;
    },
    setProposalStep: (state, action: PayloadAction<ProposalCreationState['step']>) => {
      state.creation.step = action.payload;
    },
    selectSourceSwap: (state, action: PayloadAction<string>) => {
      state.creation.selectedSourceSwapId = action.payload;
      state.creation.step = 'add_details';
    },
    updateProposalFormData: (state, action: PayloadAction<Partial<CreateProposalFromBrowseRequest>>) => {
      state.creation.formData = {
        ...state.creation.formData,
        ...action.payload,
      };
    },
    setProposalValidation: (state, action: PayloadAction<ValidationResult>) => {
      state.creation.validationResult = action.payload;
    },
    startProposalSubmission: (state) => {
      state.creation.step = 'submitting';
      state.loading = true;
    },
    proposalSubmissionSuccess: (state, action: PayloadAction<SwapProposalResult>) => {
      state.creation.step = 'success';
      state.loading = false;

      // Add to current proposals
      const newProposal: ProposalSummary = {
        id: action.payload.proposalId,
        sourceSwapId: state.creation.selectedSourceSwapId!,
        targetSwapId: state.creation.targetSwapId!,
        proposerId: state.creation.formData.proposerId!,
        targetOwnerId: '', // Will be filled by the API response
        status: 'pending',
        message: state.creation.formData.message,
        conditions: state.creation.formData.conditions || [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        blockchainTransactionId: action.payload.blockchainTransaction.transactionId,
        sourceSwapTitle: '', // Will be filled by the API response
        targetSwapTitle: '', // Will be filled by the API response
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      state.currentProposals.unshift(newProposal);
      state.pendingProposals.unshift(newProposal);
      state.proposalHistory.unshift(newProposal);
    },
    proposalSubmissionError: (state, action: PayloadAction<string>) => {
      state.creation.step = 'error';
      state.loading = false;
      state.error = action.payload;
    },

    // Proposal data management
    setProposalHistory: (state, action: PayloadAction<ProposalHistoryResponse>) => {
      const { proposals, pagination } = action.payload;
      state.proposalHistory = proposals;
      state.historyPagination = pagination;
      state.lastFetchTime = Date.now();
      state.loading = false;
      state.error = null;

      // Categorize proposals by status
      state.pendingProposals = proposals.filter(p => p.status === 'pending');
      state.acceptedProposals = proposals.filter(p => p.status === 'accepted');
      state.rejectedProposals = proposals.filter(p => p.status === 'rejected');
      state.expiredProposals = proposals.filter(p => p.status === 'expired');
    },
    addProposal: (state, action: PayloadAction<ProposalSummary>) => {
      const proposal = action.payload;

      // Add to history if not already present
      const existingIndex = state.proposalHistory.findIndex(p => p.id === proposal.id);
      if (existingIndex === -1) {
        state.proposalHistory.unshift(proposal);
      } else {
        state.proposalHistory[existingIndex] = proposal;
      }

      // Add to appropriate status category
      if (proposal.status === 'pending') {
        const pendingIndex = state.pendingProposals.findIndex(p => p.id === proposal.id);
        if (pendingIndex === -1) {
          state.pendingProposals.unshift(proposal);
        } else {
          state.pendingProposals[pendingIndex] = proposal;
        }
      } else if (proposal.status === 'accepted') {
        const acceptedIndex = state.acceptedProposals.findIndex(p => p.id === proposal.id);
        if (acceptedIndex === -1) {
          state.acceptedProposals.unshift(proposal);
        } else {
          state.acceptedProposals[acceptedIndex] = proposal;
        }
      } else if (proposal.status === 'rejected') {
        const rejectedIndex = state.rejectedProposals.findIndex(p => p.id === proposal.id);
        if (rejectedIndex === -1) {
          state.rejectedProposals.unshift(proposal);
        } else {
          state.rejectedProposals[rejectedIndex] = proposal;
        }
      } else if (proposal.status === 'expired') {
        const expiredIndex = state.expiredProposals.findIndex(p => p.id === proposal.id);
        if (expiredIndex === -1) {
          state.expiredProposals.unshift(proposal);
        } else {
          state.expiredProposals[expiredIndex] = proposal;
        }
      }
    },
    updateProposal: (state, action: PayloadAction<ProposalSummary>) => {
      const proposal = action.payload;

      // Update in history
      const historyIndex = state.proposalHistory.findIndex(p => p.id === proposal.id);
      if (historyIndex !== -1) {
        const oldProposal = state.proposalHistory[historyIndex];
        state.proposalHistory[historyIndex] = proposal;

        // If status changed, move between categories
        if (oldProposal.status !== proposal.status) {
          // Remove from old category
          state.pendingProposals = state.pendingProposals.filter(p => p.id !== proposal.id);
          state.acceptedProposals = state.acceptedProposals.filter(p => p.id !== proposal.id);
          state.rejectedProposals = state.rejectedProposals.filter(p => p.id !== proposal.id);
          state.expiredProposals = state.expiredProposals.filter(p => p.id !== proposal.id);

          // Add to new category
          if (proposal.status === 'pending') {
            state.pendingProposals.unshift(proposal);
          } else if (proposal.status === 'accepted') {
            state.acceptedProposals.unshift(proposal);
          } else if (proposal.status === 'rejected') {
            state.rejectedProposals.unshift(proposal);
          } else if (proposal.status === 'expired') {
            state.expiredProposals.unshift(proposal);
          }
        } else {
          // Update in existing category
          const updateInCategory = (category: ProposalSummary[]) => {
            const categoryIndex = category.findIndex(p => p.id === proposal.id);
            if (categoryIndex !== -1) {
              category[categoryIndex] = proposal;
            }
          };

          updateInCategory(state.pendingProposals);
          updateInCategory(state.acceptedProposals);
          updateInCategory(state.rejectedProposals);
          updateInCategory(state.expiredProposals);
        }
      }

      state.lastUpdateTime = Date.now();
    },
    removeProposal: (state, action: PayloadAction<string>) => {
      const proposalId = action.payload;

      // Remove from all arrays
      state.proposalHistory = state.proposalHistory.filter(p => p.id !== proposalId);
      state.currentProposals = state.currentProposals.filter(p => p.id !== proposalId);
      state.pendingProposals = state.pendingProposals.filter(p => p.id !== proposalId);
      state.acceptedProposals = state.acceptedProposals.filter(p => p.id !== proposalId);
      state.rejectedProposals = state.rejectedProposals.filter(p => p.id !== proposalId);
      state.expiredProposals = state.expiredProposals.filter(p => p.id !== proposalId);
    },

    // Filter management
    setProposalFilters: (state, action: PayloadAction<Partial<ProposalState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.historyPagination.currentPage = 1;
    },
    clearProposalFilters: (state) => {
      state.filters = {};
      state.historyPagination.currentPage = 1;
    },

    // Pagination
    setProposalHistoryPage: (state, action: PayloadAction<number>) => {
      state.historyPagination.currentPage = action.payload;
    },

    // Cache management
    invalidateProposalCache: (state) => {
      state.lastFetchTime = null;
    },

    // Real-time updates
    updateLastUpdateTime: (state) => {
      state.lastUpdateTime = Date.now();
    },

    // Optimistic updates
    startProposalCreation: (state, action: PayloadAction<string>) => {
      const proposalId = action.payload;
      state.optimisticUpdates.creatingProposals.push(proposalId);
    },
    completeProposalCreation: (state, action: PayloadAction<string>) => {
      const proposalId = action.payload;
      state.optimisticUpdates.creatingProposals = state.optimisticUpdates.creatingProposals.filter(
        id => id !== proposalId
      );
    },
    startProposalUpdate: (state, action: PayloadAction<string>) => {
      const proposalId = action.payload;
      state.optimisticUpdates.updatingProposals.push(proposalId);
    },
    completeProposalUpdate: (state, action: PayloadAction<string>) => {
      const proposalId = action.payload;
      state.optimisticUpdates.updatingProposals = state.optimisticUpdates.updatingProposals.filter(
        id => id !== proposalId
      );
    },

    // Reset state
    resetProposalState: (state) => {
      Object.assign(state, initialState);
    },

    // Batch operations
    updateMultipleProposals: (state, action: PayloadAction<ProposalSummary[]>) => {
      action.payload.forEach(proposal => {
        const index = state.proposalHistory.findIndex(p => p.id === proposal.id);
        if (index !== -1) {
          state.proposalHistory[index] = proposal;
        }
      });

      // Recategorize proposals
      state.pendingProposals = state.proposalHistory.filter(p => p.status === 'pending');
      state.acceptedProposals = state.proposalHistory.filter(p => p.status === 'accepted');
      state.rejectedProposals = state.proposalHistory.filter(p => p.status === 'rejected');
      state.expiredProposals = state.proposalHistory.filter(p => p.status === 'expired');
    },

    // Proposal acceptance/rejection state management
    setReceivedProposals: (state, action: PayloadAction<ProposalSummary[]>) => {
      state.receivedProposals = action.payload;
    },

    setSentProposals: (state, action: PayloadAction<ProposalSummary[]>) => {
      state.sentProposals = action.payload;
    },

    updateProposalWithAcceptanceStatus: (
      state,
      action: PayloadAction<{
        proposalId: string;
        status: 'accepted' | 'rejected';
        respondedBy?: string;
        respondedAt?: Date;
        rejectionReason?: string;
      }>
    ) => {
      const { proposalId, status, respondedBy, respondedAt, rejectionReason } = action.payload;

      // Update in history
      const historyIndex = state.proposalHistory.findIndex(p => p.id === proposalId);
      if (historyIndex !== -1) {
        const proposal = state.proposalHistory[historyIndex];
        state.proposalHistory[historyIndex] = {
          ...proposal,
          status,
          respondedAt,
          rejectionReason,
          updatedAt: new Date(),
        };
      }

      // Update in received proposals if applicable
      const receivedIndex = state.receivedProposals.findIndex(p => p.id === proposalId);
      if (receivedIndex !== -1) {
        const proposal = state.receivedProposals[receivedIndex];
        state.receivedProposals[receivedIndex] = {
          ...proposal,
          status,
          respondedAt,
          rejectionReason,
          updatedAt: new Date(),
        };
      }

      // Update in sent proposals if applicable
      const sentIndex = state.sentProposals.findIndex(p => p.id === proposalId);
      if (sentIndex !== -1) {
        const proposal = state.sentProposals[sentIndex];
        state.sentProposals[sentIndex] = {
          ...proposal,
          status,
          respondedAt,
          rejectionReason,
          updatedAt: new Date(),
        };
      }

      // Recategorize by status
      state.pendingProposals = state.proposalHistory.filter(p => p.status === 'pending');
      state.acceptedProposals = state.proposalHistory.filter(p => p.status === 'accepted');
      state.rejectedProposals = state.proposalHistory.filter(p => p.status === 'rejected');
      state.expiredProposals = state.proposalHistory.filter(p => p.status === 'expired');

      state.lastUpdateTime = Date.now();
    },

    // Filter proposals by user role
    categorizeProposalsByUserRole: (
      state,
      action: PayloadAction<{ userId: string }>
    ) => {
      const { userId } = action.payload;

      state.receivedProposals = state.proposalHistory.filter(
        p => p.targetOwnerId === userId
      );

      state.sentProposals = state.proposalHistory.filter(
        p => p.proposerId === userId
      );
    },

    // Handle real-time proposal status updates
    handleRealtimeProposalUpdate: (
      state,
      action: PayloadAction<{
        proposalId: string;
        status: SwapProposalStatus;
        respondedBy?: string;
        respondedAt?: string;
        rejectionReason?: string;
        paymentStatus?: string;
      }>
    ) => {
      const { proposalId, status, respondedBy, respondedAt, rejectionReason, paymentStatus } = action.payload;

      // Find and update the proposal
      const updateProposalInArray = (proposals: ProposalSummary[]) => {
        const index = proposals.findIndex(p => p.id === proposalId);
        if (index !== -1) {
          proposals[index] = {
            ...proposals[index],
            status,
            respondedAt: respondedAt ? new Date(respondedAt) : undefined,
            rejectionReason,
            updatedAt: new Date(),
          };
          return true;
        }
        return false;
      };

      // Update in all relevant arrays
      updateProposalInArray(state.proposalHistory);
      updateProposalInArray(state.receivedProposals);
      updateProposalInArray(state.sentProposals);

      // Recategorize by status
      state.pendingProposals = state.proposalHistory.filter(p => p.status === 'pending');
      state.acceptedProposals = state.proposalHistory.filter(p => p.status === 'accepted');
      state.rejectedProposals = state.proposalHistory.filter(p => p.status === 'rejected');
      state.expiredProposals = state.proposalHistory.filter(p => p.status === 'expired');

      state.lastUpdateTime = Date.now();
    },

    // Mark proposals as read/unread for notification purposes
    markProposalsAsRead: (state, action: PayloadAction<string[]>) => {
      const proposalIds = action.payload;

      proposalIds.forEach(proposalId => {
        const updateReadStatus = (proposals: ProposalSummary[]) => {
          const index = proposals.findIndex(p => p.id === proposalId);
          if (index !== -1) {
            proposals[index] = {
              ...proposals[index],
              isRead: true,
              updatedAt: new Date(),
            };
          }
        };

        updateReadStatus(state.proposalHistory);
        updateReadStatus(state.receivedProposals);
        updateReadStatus(state.sentProposals);
      });
    },
  },
});

export const {
  // Loading and error states
  setLoading,
  setError,

  // Proposal creation workflow
  openProposalModal,
  closeProposalModal,
  setProposalStep,
  selectSourceSwap,
  updateProposalFormData,
  setProposalValidation,
  startProposalSubmission,
  proposalSubmissionSuccess,
  proposalSubmissionError,

  // Proposal data management
  setProposalHistory,
  addProposal,
  updateProposal,
  removeProposal,
  updateMultipleProposals,

  // Filter management
  setProposalFilters,
  clearProposalFilters,

  // Pagination
  setProposalHistoryPage,

  // Cache management
  invalidateProposalCache,

  // Real-time updates
  updateLastUpdateTime,

  // Optimistic updates
  startProposalCreation,
  completeProposalCreation,
  startProposalUpdate,
  completeProposalUpdate,

  // Reset state
  resetProposalState,

  // Proposal acceptance/rejection state management
  setReceivedProposals,
  setSentProposals,
  updateProposalWithAcceptanceStatus,
  categorizeProposalsByUserRole,
  handleRealtimeProposalUpdate,
  markProposalsAsRead,
} = proposalSlice.actions;

// Selectors
export const selectProposalCreation = (state: { proposals: ProposalState }) =>
  state.proposals.creation;
export const selectProposalHistory = (state: { proposals: ProposalState }) =>
  state.proposals.proposalHistory;
export const selectPendingProposals = (state: { proposals: ProposalState }) =>
  state.proposals.pendingProposals;
export const selectAcceptedProposals = (state: { proposals: ProposalState }) =>
  state.proposals.acceptedProposals;
export const selectRejectedProposals = (state: { proposals: ProposalState }) =>
  state.proposals.rejectedProposals;
export const selectExpiredProposals = (state: { proposals: ProposalState }) =>
  state.proposals.expiredProposals;
export const selectProposalsLoading = (state: { proposals: ProposalState }) =>
  state.proposals.loading;
export const selectProposalsError = (state: { proposals: ProposalState }) =>
  state.proposals.error;
export const selectProposalFilters = (state: { proposals: ProposalState }) =>
  state.proposals.filters;
export const selectProposalHistoryPagination = (state: { proposals: ProposalState }) =>
  state.proposals.historyPagination;
export const selectProposalOptimisticUpdates = (state: { proposals: ProposalState }) =>
  state.proposals.optimisticUpdates;

// Computed selectors
export const selectProposalById = (state: { proposals: ProposalState }, id: string) =>
  state.proposals.proposalHistory.find(proposal => proposal.id === id);

export const selectProposalsByStatus = (
  state: { proposals: ProposalState },
  status: SwapProposalStatus
) => state.proposals.proposalHistory.filter(proposal => proposal.status === status);

export const selectUserProposals = (state: { proposals: ProposalState }, userId: string) =>
  state.proposals.proposalHistory.filter(proposal => proposal.proposerId === userId);

export const selectProposalsForSwap = (state: { proposals: ProposalState }, swapId: string) =>
  state.proposals.proposalHistory.filter(
    proposal => proposal.sourceSwapId === swapId || proposal.targetSwapId === swapId
  );

export const selectIsProposalCacheValid = (state: { proposals: ProposalState }) => {
  if (!state.proposals.lastFetchTime) return false;
  return Date.now() - state.proposals.lastFetchTime < state.proposals.cacheExpiry;
};

export const selectFilteredProposals = (state: { proposals: ProposalState }) => {
  const { proposalHistory, filters } = state.proposals;
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
};

export const selectProposalStatistics = (state: { proposals: ProposalState }) => {
  const proposals = state.proposals.proposalHistory;
  const total = proposals.length;
  const pending = state.proposals.pendingProposals.length;
  const accepted = state.proposals.acceptedProposals.length;
  const rejected = state.proposals.rejectedProposals.length;
  const expired = state.proposals.expiredProposals.length;

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
};

export const selectIsProposalCreationPending = (
  state: { proposals: ProposalState },
  proposalId: string
) => state.proposals.optimisticUpdates.creatingProposals.includes(proposalId);

export const selectIsProposalUpdatePending = (
  state: { proposals: ProposalState },
  proposalId: string
) => state.proposals.optimisticUpdates.updatingProposals.includes(proposalId);

// New selectors for acceptance/rejection functionality
export const selectReceivedProposals = (state: { proposals: ProposalState }) =>
  state.proposals.receivedProposals;

export const selectSentProposals = (state: { proposals: ProposalState }) =>
  state.proposals.sentProposals;

export const selectPendingReceivedProposals = (state: { proposals: ProposalState }) =>
  state.proposals.receivedProposals.filter(p => p.status === 'pending');

export const selectPendingSentProposals = (state: { proposals: ProposalState }) =>
  state.proposals.sentProposals.filter(p => p.status === 'pending');

export const selectUnreadReceivedProposals = (state: { proposals: ProposalState }) =>
  state.proposals.receivedProposals.filter(p => !p.isRead);

export const selectProposalsByUserRole = (
  state: { proposals: ProposalState },
  userId: string
) => ({
  received: state.proposals.proposalHistory.filter(p => p.targetOwnerId === userId),
  sent: state.proposals.proposalHistory.filter(p => p.proposerId === userId),
});

export const selectProposalAcceptanceStatistics = (
  state: { proposals: ProposalState },
  userId: string
) => {
  const received = state.proposals.receivedProposals;
  const sent = state.proposals.sentProposals;

  const receivedStats = {
    total: received.length,
    pending: received.filter(p => p.status === 'pending').length,
    accepted: received.filter(p => p.status === 'accepted').length,
    rejected: received.filter(p => p.status === 'rejected').length,
  };

  const sentStats = {
    total: sent.length,
    pending: sent.filter(p => p.status === 'pending').length,
    accepted: sent.filter(p => p.status === 'accepted').length,
    rejected: sent.filter(p => p.status === 'rejected').length,
  };

  return { received: receivedStats, sent: sentStats };
};