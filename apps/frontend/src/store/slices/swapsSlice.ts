import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Swap,
  SwapStatus,
  EnhancedSwap,
  PaymentTypePreference,
  AcceptanceStrategy,
  AcceptanceStrategyType,
  CashSwapConfiguration,
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
} from '@booking-swap/shared';
import {
  SwapWithBookings,
  SwapProposal,
  SwapEvent,
  SwapFilters,
} from '../../services/swapService';

// Enhanced swap interface that extends SwapWithBookings
interface EnhancedSwapWithBookings extends SwapWithBookings {
  paymentTypes?: PaymentTypePreference;
  acceptanceStrategy?: AcceptanceStrategy;
  auctionId?: string;
  cashDetails?: CashSwapConfiguration;
}

interface SwapsState {
  // Core data
  swaps: EnhancedSwapWithBookings[];
  currentSwap: EnhancedSwapWithBookings | null;

  // Proposals management
  proposals: Record<string, SwapProposal[]>; // swapId -> proposals
  currentProposals: SwapProposal[];

  // Timeline and history
  swapHistory: Record<string, SwapEvent[]>; // swapId -> events
  currentSwapHistory: SwapEvent[];

  // Categorized swaps for dashboard
  pendingSwaps: EnhancedSwapWithBookings[];
  activeSwaps: EnhancedSwapWithBookings[];
  completedSwaps: EnhancedSwapWithBookings[];

  // Enhanced swap categorization
  auctionSwaps: EnhancedSwapWithBookings[];
  firstMatchSwaps: EnhancedSwapWithBookings[];
  cashEnabledSwaps: EnhancedSwapWithBookings[];
  bookingOnlySwaps: EnhancedSwapWithBookings[];

  // UI state
  loading: boolean;
  error: string | null;

  // Filters and search
  filters: SwapFilters & {
    paymentTypes?: ('booking' | 'cash')[];
    acceptanceStrategy?: AcceptanceStrategyType[];
    priceRange?: { min?: number; max?: number };
    auctionStatus?: ('active' | 'ending_soon' | 'ended')[];
  };

  // Pagination
  currentPage: number;
  totalPages: number;

  // Real-time updates
  lastUpdateTime: number | null;

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 3 minutes for more frequent updates

  // Statistics
  userStats: {
    total: number;
    pending: number;
    completed: number;
    cancelled: number;
    successRate: number;
    // Enhanced statistics
    totalAuctions: number;
    totalCashSwaps: number;
    averageCashOffer: number;
    auctionSuccessRate: number;
  } | null;

  // Payment-related state
  paymentTransactions: Record<string, any>; // swapId -> payment transaction
  escrowAccounts: Record<string, any>; // swapId -> escrow account

  // Optimistic updates tracking
  optimisticUpdates: {
    swapCreations: string[]; // swap IDs being created
    proposalSubmissions: string[]; // proposal IDs being submitted
    paymentProcessing: string[]; // payment transaction IDs being processed
  };
}

const initialState: SwapsState = {
  // Core data
  swaps: [],
  currentSwap: null,

  // Proposals management
  proposals: {},
  currentProposals: [],

  // Timeline and history
  swapHistory: {},
  currentSwapHistory: [],

  // Categorized swaps
  pendingSwaps: [],
  activeSwaps: [],
  completedSwaps: [],

  // Enhanced swap categorization
  auctionSwaps: [],
  firstMatchSwaps: [],
  cashEnabledSwaps: [],
  bookingOnlySwaps: [],

  // UI state
  loading: false,
  error: null,

  // Filters and search
  filters: {},

  // Pagination
  currentPage: 1,
  totalPages: 1,

  // Real-time updates
  lastUpdateTime: null,

  // Cache management
  lastFetchTime: null,
  cacheExpiry: 3 * 60 * 1000, // 3 minutes

  // Statistics
  userStats: null,

  // Payment-related state
  paymentTransactions: {},
  escrowAccounts: {},

  // Optimistic updates tracking
  optimisticUpdates: {
    swapCreations: [],
    proposalSubmissions: [],
    paymentProcessing: [],
  },
};

export const swapsSlice = createSlice({
  name: 'swaps',
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

    // Core data management
    setSwaps: (state, action: PayloadAction<EnhancedSwapWithBookings[]>) => {
      state.swaps = action.payload;
      state.lastFetchTime = Date.now();
      state.loading = false;
      state.error = null;

      // Categorize swaps by status
      state.pendingSwaps = action.payload.filter(s => s.status === 'pending');
      state.activeSwaps = action.payload.filter(s => s.status === 'accepted');
      state.completedSwaps = action.payload.filter(
        s => s.status === 'completed'
      );

      // Enhanced categorization
      state.auctionSwaps = action.payload.filter(
        s => s.acceptanceStrategy?.type === 'auction'
      );
      state.firstMatchSwaps = action.payload.filter(
        s => s.acceptanceStrategy?.type === 'first_match'
      );
      state.cashEnabledSwaps = action.payload.filter(
        s => s.paymentTypes?.cashPayment === true
      );
      state.bookingOnlySwaps = action.payload.filter(
        s =>
          s.paymentTypes?.bookingExchange === true &&
          s.paymentTypes?.cashPayment !== true
      );
    },
    setCurrentSwap: (
      state,
      action: PayloadAction<EnhancedSwapWithBookings | null>
    ) => {
      state.currentSwap = action.payload;
    },

    // CRUD operations
    addSwap: (state, action: PayloadAction<EnhancedSwapWithBookings>) => {
      state.swaps.unshift(action.payload); // Add to beginning

      // Add to appropriate category by status
      if (action.payload.status === 'pending') {
        state.pendingSwaps.unshift(action.payload);
      } else if (action.payload.status === 'accepted') {
        state.activeSwaps.unshift(action.payload);
      } else if (action.payload.status === 'completed') {
        state.completedSwaps.unshift(action.payload);
      }

      // Add to enhanced categories
      if (action.payload.acceptanceStrategy?.type === 'auction') {
        state.auctionSwaps.unshift(action.payload);
      } else if (action.payload.acceptanceStrategy?.type === 'first_match') {
        state.firstMatchSwaps.unshift(action.payload);
      }

      if (action.payload.paymentTypes?.cashPayment === true) {
        state.cashEnabledSwaps.unshift(action.payload);
      } else if (
        action.payload.paymentTypes?.bookingExchange === true &&
        action.payload.paymentTypes?.cashPayment !== true
      ) {
        state.bookingOnlySwaps.unshift(action.payload);
      }
    },
    updateSwap: (state, action: PayloadAction<EnhancedSwapWithBookings>) => {
      const swap = action.payload;
      const index = state.swaps.findIndex(s => s.id === swap.id);

      if (index !== -1) {
        const oldSwap = state.swaps[index];
        state.swaps[index] = swap;

        // Update current swap if it's the same
        if (state.currentSwap?.id === swap.id) {
          state.currentSwap = swap;
        }

        // Update categorized arrays if status changed
        if (oldSwap.status !== swap.status) {
          // Remove from old category
          state.pendingSwaps = state.pendingSwaps.filter(s => s.id !== swap.id);
          state.activeSwaps = state.activeSwaps.filter(s => s.id !== swap.id);
          state.completedSwaps = state.completedSwaps.filter(
            s => s.id !== swap.id
          );

          // Add to new category
          if (swap.status === 'pending') {
            state.pendingSwaps.push(swap);
          } else if (swap.status === 'accepted') {
            state.activeSwaps.push(swap);
          } else if (swap.status === 'completed') {
            state.completedSwaps.push(swap);
          }
        } else {
          // Update in existing category
          const updateInCategory = (category: SwapWithBookings[]) => {
            const categoryIndex = category.findIndex(s => s.id === swap.id);
            if (categoryIndex !== -1) {
              category[categoryIndex] = swap;
            }
          };

          updateInCategory(state.pendingSwaps);
          updateInCategory(state.activeSwaps);
          updateInCategory(state.completedSwaps);
        }
      }

      state.lastUpdateTime = Date.now();
    },
    removeSwap: (state, action: PayloadAction<string>) => {
      const swapId = action.payload;

      // Remove from all arrays
      state.swaps = state.swaps.filter(s => s.id !== swapId);
      state.pendingSwaps = state.pendingSwaps.filter(s => s.id !== swapId);
      state.activeSwaps = state.activeSwaps.filter(s => s.id !== swapId);
      state.completedSwaps = state.completedSwaps.filter(s => s.id !== swapId);

      // Clear current swap if it's the removed one
      if (state.currentSwap?.id === swapId) {
        state.currentSwap = null;
      }

      // Clear related data
      delete state.proposals[swapId];
      delete state.swapHistory[swapId];
    },

    // Proposal management
    setProposals: (
      state,
      action: PayloadAction<{ swapId: string; proposals: SwapProposal[] }>
    ) => {
      const { swapId, proposals } = action.payload;
      state.proposals[swapId] = proposals;

      // Update current proposals if viewing this swap
      if (state.currentSwap?.id === swapId) {
        state.currentProposals = proposals;
      }
    },
    addProposal: (state, action: PayloadAction<SwapProposal>) => {
      const proposal = action.payload;
      const swapId = proposal.swapId;

      if (!state.proposals[swapId]) {
        state.proposals[swapId] = [];
      }

      state.proposals[swapId].push(proposal);

      // Update current proposals if viewing this swap
      if (state.currentSwap?.id === swapId) {
        state.currentProposals.push(proposal);
      }
    },
    updateProposal: (state, action: PayloadAction<SwapProposal>) => {
      const proposal = action.payload;
      const swapId = proposal.swapId;

      if (state.proposals[swapId]) {
        const index = state.proposals[swapId].findIndex(
          p => p.id === proposal.id
        );
        if (index !== -1) {
          state.proposals[swapId][index] = proposal;
        }
      }

      // Update current proposals if viewing this swap
      if (state.currentSwap?.id === swapId) {
        const currentIndex = state.currentProposals.findIndex(
          p => p.id === proposal.id
        );
        if (currentIndex !== -1) {
          state.currentProposals[currentIndex] = proposal;
        }
      }
    },

    // History and timeline management
    setSwapHistory: (
      state,
      action: PayloadAction<{ swapId: string; events: SwapEvent[] }>
    ) => {
      const { swapId, events } = action.payload;
      state.swapHistory[swapId] = events;

      // Update current history if viewing this swap
      if (state.currentSwap?.id === swapId) {
        state.currentSwapHistory = events;
      }
    },
    addSwapEvent: (state, action: PayloadAction<SwapEvent>) => {
      const event = action.payload;
      const swapId = event.swapId;

      if (!state.swapHistory[swapId]) {
        state.swapHistory[swapId] = [];
      }

      state.swapHistory[swapId].push(event);

      // Update current history if viewing this swap
      if (state.currentSwap?.id === swapId) {
        state.currentSwapHistory.push(event);
      }
    },

    // Filter management
    setFilters: (state, action: PayloadAction<Partial<SwapFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1;
    },
    clearFilters: state => {
      state.filters = {};
      state.currentPage = 1;
    },

    // Pagination
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },

    // Statistics
    setUserStats: (state, action: PayloadAction<SwapsState['userStats']>) => {
      state.userStats = action.payload;
    },

    // Real-time updates
    updateLastUpdateTime: state => {
      state.lastUpdateTime = Date.now();
    },

    // Cache management
    invalidateCache: state => {
      state.lastFetchTime = null;
    },

    // Reset state
    resetSwapsState: state => {
      Object.assign(state, initialState);
    },

    // Optimistic updates
    optimisticUpdateSwapStatus: (
      state,
      action: PayloadAction<{ id: string; status: SwapStatus }>
    ) => {
      const { id, status } = action.payload;
      const swap = state.swaps.find(s => s.id === id);
      if (swap) {
        swap.status = status;
        swap.timeline.respondedAt = new Date();
        if (status === 'completed') {
          swap.timeline.completedAt = new Date();
        }
      }
    },

    // Real-time swap updates
    updateSwapStatus: (
      state,
      action: PayloadAction<{
        swapId: string;
        status: SwapStatus;
        lastUpdated: Date;
      }>
    ) => {
      const { swapId, status, lastUpdated } = action.payload;
      const swap = state.swaps.find(s => s.id === swapId);
      if (swap) {
        swap.status = status;
        swap.updatedAt = lastUpdated;

        // Update timeline based on status
        if (status === 'accepted' && !swap.timeline.respondedAt) {
          swap.timeline.respondedAt = lastUpdated;
        } else if (status === 'completed' && !swap.timeline.completedAt) {
          swap.timeline.completedAt = lastUpdated;
        }

        // Update categorized lists
        state.pendingSwaps = state.swaps.filter(s => s.status === 'pending');
        state.activeSwaps = state.swaps.filter(s =>
          ['accepted'].includes(s.status)
        );
        state.completedSwaps = state.swaps.filter(s =>
          ['completed', 'cancelled', 'rejected'].includes(s.status)
        );
      }

      // Update last update time for real-time tracking
      state.lastUpdateTime = Date.now();
    },

    // Enhanced swap operations
    createEnhancedSwap: (
      state,
      action: PayloadAction<{
        swapId: string;
        request: EnhancedCreateSwapRequest;
      }>
    ) => {
      const { swapId } = action.payload;
      // Add to optimistic updates
      state.optimisticUpdates.swapCreations.push(swapId);
      state.loading = true;
    },

    createEnhancedSwapSuccess: (
      state,
      action: PayloadAction<EnhancedSwapWithBookings>
    ) => {
      const swap = action.payload;
      // Remove from optimistic updates
      state.optimisticUpdates.swapCreations =
        state.optimisticUpdates.swapCreations.filter(id => id !== swap.id);

      // Add the new swap
      state.swaps.unshift(swap);
      state.currentSwap = swap;
      state.loading = false;

      // Update categories
      if (swap.acceptanceStrategy?.type === 'auction') {
        state.auctionSwaps.unshift(swap);
      } else {
        state.firstMatchSwaps.unshift(swap);
      }

      if (swap.paymentTypes?.cashPayment) {
        state.cashEnabledSwaps.unshift(swap);
      } else {
        state.bookingOnlySwaps.unshift(swap);
      }
    },

    createEnhancedSwapFailure: (
      state,
      action: PayloadAction<{ swapId: string; error: string }>
    ) => {
      const { swapId, error } = action.payload;
      // Remove from optimistic updates
      state.optimisticUpdates.swapCreations =
        state.optimisticUpdates.swapCreations.filter(id => id !== swapId);
      state.loading = false;
      state.error = error;
    },

    // Enhanced proposal operations
    createEnhancedProposal: (
      state,
      action: PayloadAction<{
        proposalId: string;
        request: CreateEnhancedProposalRequest;
      }>
    ) => {
      const { proposalId } = action.payload;
      // Add to optimistic updates
      state.optimisticUpdates.proposalSubmissions.push(proposalId);
      state.loading = true;
    },

    createEnhancedProposalSuccess: (
      state,
      action: PayloadAction<SwapProposal>
    ) => {
      const proposal = action.payload;
      // Remove from optimistic updates
      state.optimisticUpdates.proposalSubmissions =
        state.optimisticUpdates.proposalSubmissions.filter(
          id => id !== proposal.id
        );

      // Add the proposal
      if (!state.proposals[proposal.swapId]) {
        state.proposals[proposal.swapId] = [];
      }
      state.proposals[proposal.swapId].push(proposal);

      // Update current proposals if viewing this swap
      if (state.currentSwap?.id === proposal.swapId) {
        state.currentProposals.push(proposal);
      }

      state.loading = false;
    },

    createEnhancedProposalFailure: (
      state,
      action: PayloadAction<{ proposalId: string; error: string }>
    ) => {
      const { proposalId, error } = action.payload;
      // Remove from optimistic updates
      state.optimisticUpdates.proposalSubmissions =
        state.optimisticUpdates.proposalSubmissions.filter(
          id => id !== proposalId
        );
      state.loading = false;
      state.error = error;
    },

    // Payment-related actions
    setPaymentTransaction: (
      state,
      action: PayloadAction<{ swapId: string; transaction: any }>
    ) => {
      const { swapId, transaction } = action.payload;
      state.paymentTransactions[swapId] = transaction;
    },

    updatePaymentTransaction: (
      state,
      action: PayloadAction<{ swapId: string; updates: any }>
    ) => {
      const { swapId, updates } = action.payload;
      if (state.paymentTransactions[swapId]) {
        state.paymentTransactions[swapId] = {
          ...state.paymentTransactions[swapId],
          ...updates,
        };
      }
    },

    setEscrowAccount: (
      state,
      action: PayloadAction<{ swapId: string; escrow: any }>
    ) => {
      const { swapId, escrow } = action.payload;
      state.escrowAccounts[swapId] = escrow;
    },

    updateEscrowAccount: (
      state,
      action: PayloadAction<{ swapId: string; updates: any }>
    ) => {
      const { swapId, updates } = action.payload;
      if (state.escrowAccounts[swapId]) {
        state.escrowAccounts[swapId] = {
          ...state.escrowAccounts[swapId],
          ...updates,
        };
      }
    },

    // Payment processing optimistic updates
    startPaymentProcessing: (state, action: PayloadAction<string>) => {
      const transactionId = action.payload;
      state.optimisticUpdates.paymentProcessing.push(transactionId);
    },

    completePaymentProcessing: (state, action: PayloadAction<string>) => {
      const transactionId = action.payload;
      state.optimisticUpdates.paymentProcessing =
        state.optimisticUpdates.paymentProcessing.filter(
          id => id !== transactionId
        );
    },

    // Enhanced filtering
    setEnhancedFilters: (
      state,
      action: PayloadAction<Partial<SwapsState['filters']>>
    ) => {
      state.filters = { ...state.filters, ...action.payload };
      state.currentPage = 1;
    },

    // Enhanced statistics
    setEnhancedUserStats: (
      state,
      action: PayloadAction<SwapsState['userStats']>
    ) => {
      state.userStats = action.payload;
    },

    // Batch operations
    updateMultipleSwaps: (
      state,
      action: PayloadAction<EnhancedSwapWithBookings[]>
    ) => {
      action.payload.forEach(swap => {
        const index = state.swaps.findIndex(s => s.id === swap.id);
        if (index !== -1) {
          state.swaps[index] = swap;
        }
      });

      // Recategorize swaps
      state.auctionSwaps = state.swaps.filter(
        s => s.acceptanceStrategy?.type === 'auction'
      );
      state.firstMatchSwaps = state.swaps.filter(
        s => s.acceptanceStrategy?.type === 'first_match'
      );
      state.cashEnabledSwaps = state.swaps.filter(
        s => s.paymentTypes?.cashPayment === true
      );
      state.bookingOnlySwaps = state.swaps.filter(
        s =>
          s.paymentTypes?.bookingExchange === true &&
          s.paymentTypes?.cashPayment !== true
      );
    },
  },
});

export const {
  // Loading and error states
  setLoading,
  setError,

  // Core data management
  setSwaps,
  setCurrentSwap,

  // CRUD operations
  addSwap,
  updateSwap,
  removeSwap,
  updateMultipleSwaps,

  // Enhanced swap operations
  createEnhancedSwap,
  createEnhancedSwapSuccess,
  createEnhancedSwapFailure,

  // Enhanced proposal operations
  createEnhancedProposal,
  createEnhancedProposalSuccess,
  createEnhancedProposalFailure,

  // Payment-related actions
  setPaymentTransaction,
  updatePaymentTransaction,
  setEscrowAccount,
  updateEscrowAccount,
  startPaymentProcessing,
  completePaymentProcessing,

  // Proposal management
  setProposals,
  addProposal,
  updateProposal,

  // History and timeline management
  setSwapHistory,
  addSwapEvent,

  // Filter management
  setFilters,
  clearFilters,
  setEnhancedFilters,

  // Pagination
  setCurrentPage,

  // Statistics
  setUserStats,
  setEnhancedUserStats,

  // Real-time updates
  updateLastUpdateTime,

  // Cache management
  invalidateCache,

  // Reset state
  resetSwapsState,

  // Optimistic updates
  optimisticUpdateSwapStatus,

  // Real-time updates
  updateSwapStatus,
} = swapsSlice.actions;

// Basic selectors
export const selectSwaps = (state: { swaps: SwapsState }) => state.swaps.swaps;
export const selectCurrentSwap = (state: { swaps: SwapsState }) =>
  state.swaps.currentSwap;
export const selectPendingSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.pendingSwaps;
export const selectActiveSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.activeSwaps;
export const selectCompletedSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.completedSwaps;
export const selectSwapsLoading = (state: { swaps: SwapsState }) =>
  state.swaps.loading;
export const selectSwapsError = (state: { swaps: SwapsState }) =>
  state.swaps.error;
export const selectSwapsFilters = (state: { swaps: SwapsState }) =>
  state.swaps.filters;
export const selectCurrentProposals = (state: { swaps: SwapsState }) =>
  state.swaps.currentProposals;
export const selectCurrentSwapHistory = (state: { swaps: SwapsState }) =>
  state.swaps.currentSwapHistory;
export const selectUserStats = (state: { swaps: SwapsState }) =>
  state.swaps.userStats;
export const selectLastUpdateTime = (state: { swaps: SwapsState }) =>
  state.swaps.lastUpdateTime;

// Enhanced selectors
export const selectAuctionSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.auctionSwaps;
export const selectFirstMatchSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.firstMatchSwaps;
export const selectCashEnabledSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.cashEnabledSwaps;
export const selectBookingOnlySwaps = (state: { swaps: SwapsState }) =>
  state.swaps.bookingOnlySwaps;
export const selectPaymentTransactions = (state: { swaps: SwapsState }) =>
  state.swaps.paymentTransactions;
export const selectEscrowAccounts = (state: { swaps: SwapsState }) =>
  state.swaps.escrowAccounts;
export const selectOptimisticUpdates = (state: { swaps: SwapsState }) =>
  state.swaps.optimisticUpdates;

// Computed selectors
export const selectSwapById = (state: { swaps: SwapsState }, id: string) =>
  state.swaps.swaps.find(swap => swap.id === id);

export const selectSwapsByStatus = (
  state: { swaps: SwapsState },
  status: SwapStatus
) => state.swaps.swaps.filter(swap => swap.status === status);

export const selectUserSwaps = (state: { swaps: SwapsState }, userId: string) =>
  state.swaps.swaps.filter(
    swap => swap.proposerId === userId || swap.ownerId === userId
  );

export const selectProposalsForSwap = (
  state: { swaps: SwapsState },
  swapId: string
) => state.swaps.proposals[swapId] || [];

export const selectHistoryForSwap = (
  state: { swaps: SwapsState },
  swapId: string
) => state.swaps.swapHistory[swapId] || [];

export const selectSwapsRequiringAction = (
  state: { swaps: SwapsState },
  userId: string
) =>
  state.swaps.swaps.filter(
    swap =>
      swap.status === 'pending' &&
      swap.ownerId === userId &&
      swap.proposerId !== userId
  );

export const selectExpiredSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.swaps.filter(
    swap =>
      swap.status === 'pending' && new Date(swap.terms.expiresAt) < new Date()
  );

export const selectIsCacheValid = (state: { swaps: SwapsState }) => {
  if (!state.swaps.lastFetchTime) return false;
  return Date.now() - state.swaps.lastFetchTime < state.swaps.cacheExpiry;
};

// Enhanced computed selectors
export const selectSwapsByPaymentType = (
  state: { swaps: SwapsState },
  paymentType: 'booking' | 'cash' | 'both'
) => {
  switch (paymentType) {
    case 'booking':
      return state.swaps.swaps.filter(
        swap =>
          swap.paymentTypes?.bookingExchange === true &&
          swap.paymentTypes?.cashPayment !== true
      );
    case 'cash':
      return state.swaps.swaps.filter(
        swap => swap.paymentTypes?.cashPayment === true
      );
    case 'both':
      return state.swaps.swaps.filter(
        swap =>
          swap.paymentTypes?.bookingExchange === true &&
          swap.paymentTypes?.cashPayment === true
      );
    default:
      return [];
  }
};

export const selectSwapsByAcceptanceStrategy = (
  state: { swaps: SwapsState },
  strategy: AcceptanceStrategyType
) =>
  state.swaps.swaps.filter(swap => swap.acceptanceStrategy?.type === strategy);

export const selectActiveAuctionSwaps = (state: { swaps: SwapsState }) =>
  state.swaps.swaps.filter(
    swap =>
      swap.acceptanceStrategy?.type === 'auction' &&
      swap.status === 'pending' &&
      swap.auctionId
  );

export const selectEndingSoonAuctionSwaps = (state: { swaps: SwapsState }) => {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return state.swaps.swaps.filter(
    swap =>
      swap.acceptanceStrategy?.type === 'auction' &&
      swap.status === 'pending' &&
      swap.acceptanceStrategy.auctionEndDate &&
      new Date(swap.acceptanceStrategy.auctionEndDate) <= twentyFourHoursFromNow
  );
};

export const selectSwapsWithCashOffers = (state: { swaps: SwapsState }) =>
  state.swaps.swaps.filter(
    swap =>
      swap.paymentTypes?.cashPayment === true && swap.cashDetails?.minimumAmount
  );

export const selectPaymentTransactionForSwap = (
  state: { swaps: SwapsState },
  swapId: string
) => state.swaps.paymentTransactions[swapId];

export const selectEscrowAccountForSwap = (
  state: { swaps: SwapsState },
  swapId: string
) => state.swaps.escrowAccounts[swapId];

export const selectIsSwapCreationPending = (
  state: { swaps: SwapsState },
  swapId: string
) => state.swaps.optimisticUpdates.swapCreations.includes(swapId);

export const selectIsProposalSubmissionPending = (
  state: { swaps: SwapsState },
  proposalId: string
) => state.swaps.optimisticUpdates.proposalSubmissions.includes(proposalId);

export const selectIsPaymentProcessing = (
  state: { swaps: SwapsState },
  transactionId: string
) => state.swaps.optimisticUpdates.paymentProcessing.includes(transactionId);

export const selectSwapStatistics = (state: { swaps: SwapsState }) => {
  const swaps = state.swaps.swaps;
  const auctionSwaps = swaps.filter(
    s => s.acceptanceStrategy?.type === 'auction'
  );
  const cashSwaps = swaps.filter(s => s.paymentTypes?.cashPayment === true);

  const completedAuctions = auctionSwaps.filter(s => s.status === 'completed');
  const completedCashSwaps = cashSwaps.filter(s => s.status === 'completed');

  const cashOffers = cashSwaps
    .map(s => s.cashDetails?.minimumAmount || 0)
    .filter(amount => amount > 0);

  const averageCashOffer =
    cashOffers.length > 0
      ? cashOffers.reduce((sum, amount) => sum + amount, 0) / cashOffers.length
      : 0;

  const auctionSuccessRate =
    auctionSwaps.length > 0
      ? (completedAuctions.length / auctionSwaps.length) * 100
      : 0;

  return {
    totalSwaps: swaps.length,
    totalAuctions: auctionSwaps.length,
    totalCashSwaps: cashSwaps.length,
    completedAuctions: completedAuctions.length,
    completedCashSwaps: completedCashSwaps.length,
    averageCashOffer,
    auctionSuccessRate,
  };
};

export const selectFilteredEnhancedSwaps = (state: { swaps: SwapsState }) => {
  const { swaps, filters } = state.swaps;
  let filtered = swaps;

  // Apply payment type filters
  if (filters.paymentTypes && filters.paymentTypes.length > 0) {
    filtered = filtered.filter(swap => {
      return filters.paymentTypes!.some(type => {
        if (type === 'booking') {
          return swap.paymentTypes?.bookingExchange === true;
        } else if (type === 'cash') {
          return swap.paymentTypes?.cashPayment === true;
        }
        return false;
      });
    });
  }

  // Apply acceptance strategy filters
  if (filters.acceptanceStrategy && filters.acceptanceStrategy.length > 0) {
    filtered = filtered.filter(swap =>
      filters.acceptanceStrategy!.includes(
        swap.acceptanceStrategy?.type as AcceptanceStrategyType
      )
    );
  }

  // Apply price range filters
  if (filters.priceRange) {
    const { min, max } = filters.priceRange;
    filtered = filtered.filter(swap => {
      if (!swap.cashDetails?.minimumAmount) return true;

      const amount = swap.cashDetails.minimumAmount;
      if (min !== undefined && amount < min) return false;
      if (max !== undefined && amount > max) return false;

      return true;
    });
  }

  // Apply auction status filters
  if (filters.auctionStatus && filters.auctionStatus.length > 0) {
    filtered = filtered.filter(swap => {
      if (swap.acceptanceStrategy?.type !== 'auction') return false;

      return filters.auctionStatus!.some(status => {
        switch (status) {
          case 'active':
            return swap.status === 'pending' && swap.auctionId;
          case 'ending_soon':
            if (
              swap.status !== 'pending' ||
              !swap.acceptanceStrategy?.auctionEndDate
            )
              return false;
            const now = new Date();
            const twentyFourHoursFromNow = new Date(
              now.getTime() + 24 * 60 * 60 * 1000
            );
            return (
              new Date(swap.acceptanceStrategy.auctionEndDate) <=
              twentyFourHoursFromNow
            );
          case 'ended':
            return swap.status === 'completed' || swap.status === 'cancelled';
          default:
            return false;
        }
      });
    });
  }

  return filtered;
};
