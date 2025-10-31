import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  SwapAuction,
  AuctionProposal,
  AuctionStatus,
  ProposalStatus,
  AuctionDashboardData,
  ProposalComparison,
} from '@booking-swap/shared';

interface AuctionState {
  // Core auction data
  auctions: SwapAuction[];
  currentAuction: SwapAuction | null;

  // Proposals management
  proposals: Record<string, AuctionProposal[]>; // auctionId -> proposals
  currentProposals: AuctionProposal[];

  // Dashboard data
  dashboardData: Record<string, AuctionDashboardData>; // auctionId -> dashboard data

  // User's auctions
  userAuctions: SwapAuction[];
  userProposals: AuctionProposal[];

  // Real-time updates
  activeConnections: string[]; // auction IDs with active WebSocket connections
  lastUpdateTime: number | null;

  // UI state
  loading: boolean;
  error: string | null;

  // Filters and search
  filters: {
    status?: AuctionStatus[];
    endingSoon?: boolean; // auctions ending within 24 hours
    hasProposals?: boolean;
    priceRange?: { min?: number; max?: number };
  };

  // Pagination
  currentPage: number;
  totalPages: number;

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 2 minutes for auction data

  // Statistics
  auctionStats: {
    totalActive: number;
    totalEnded: number;
    averageProposals: number;
    successRate: number;
  } | null;
}

const initialState: AuctionState = {
  // Core auction data
  auctions: [],
  currentAuction: null,

  // Proposals management
  proposals: {},
  currentProposals: [],

  // Dashboard data
  dashboardData: {},

  // User's auctions
  userAuctions: [],
  userProposals: [],

  // Real-time updates
  activeConnections: [],
  lastUpdateTime: null,

  // UI state
  loading: false,
  error: null,

  // Filters and search
  filters: {},

  // Pagination
  currentPage: 1,
  totalPages: 1,

  // Cache management
  lastFetchTime: null,
  cacheExpiry: 2 * 60 * 1000, // 2 minutes

  // Statistics
  auctionStats: null,
};

export const auctionSlice = createSlice({
  name: 'auctions',
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

    // Core auction management
    setAuctions: (state, action: PayloadAction<SwapAuction[]>) => {
      state.auctions = action.payload;
      state.lastFetchTime = Date.now();
      state.loading = false;
      state.error = null;
    },
    setCurrentAuction: (state, action: PayloadAction<SwapAuction | null>) => {
      state.currentAuction = action.payload;

      // Update current proposals if auction changed
      if (action.payload) {
        state.currentProposals = state.proposals[action.payload.id] || [];
      } else {
        state.currentProposals = [];
      }
    },

    // CRUD operations for auctions
    addAuction: (state, action: PayloadAction<SwapAuction>) => {
      state.auctions.unshift(action.payload);

      // Add to user auctions if user is owner
      // Note: userId would need to be passed or derived from auth state
      state.userAuctions.unshift(action.payload);
    },
    updateAuction: (state, action: PayloadAction<SwapAuction>) => {
      const auction = action.payload;
      const index = state.auctions.findIndex(a => a.id === auction.id);

      if (index !== -1) {
        state.auctions[index] = auction;

        // Update current auction if it's the same
        if (state.currentAuction?.id === auction.id) {
          state.currentAuction = auction;
        }

        // Update user auctions
        const userIndex = state.userAuctions.findIndex(
          a => a.id === auction.id
        );
        if (userIndex !== -1) {
          state.userAuctions[userIndex] = auction;
        }
      }

      state.lastUpdateTime = Date.now();
    },
    removeAuction: (state, action: PayloadAction<string>) => {
      const auctionId = action.payload;

      // Remove from all arrays
      state.auctions = state.auctions.filter(a => a.id !== auctionId);
      state.userAuctions = state.userAuctions.filter(a => a.id !== auctionId);

      // Clear current auction if it's the removed one
      if (state.currentAuction?.id === auctionId) {
        state.currentAuction = null;
        state.currentProposals = [];
      }

      // Clear related data
      delete state.proposals[auctionId];
      delete state.dashboardData[auctionId];
      state.activeConnections = state.activeConnections.filter(
        id => id !== auctionId
      );
    },

    // Proposal management
    setProposals: (
      state,
      action: PayloadAction<{ auctionId: string; proposals: AuctionProposal[] }>
    ) => {
      const { auctionId, proposals } = action.payload;
      state.proposals[auctionId] = proposals;

      // Update current proposals if viewing this auction
      if (state.currentAuction?.id === auctionId) {
        state.currentProposals = proposals;
      }
    },
    addProposal: (state, action: PayloadAction<AuctionProposal>) => {
      const proposal = action.payload;
      const auctionId = proposal.auctionId;

      if (!state.proposals[auctionId]) {
        state.proposals[auctionId] = [];
      }

      state.proposals[auctionId].push(proposal);

      // Update current proposals if viewing this auction
      if (state.currentAuction?.id === auctionId) {
        state.currentProposals.push(proposal);
      }

      // Add to user proposals if user is proposer
      // Note: userId would need to be passed or derived from auth state
      state.userProposals.push(proposal);

      state.lastUpdateTime = Date.now();
    },
    updateProposal: (state, action: PayloadAction<AuctionProposal>) => {
      const proposal = action.payload;
      const auctionId = proposal.auctionId;

      if (state.proposals[auctionId]) {
        const index = state.proposals[auctionId].findIndex(
          p => p.id === proposal.id
        );
        if (index !== -1) {
          state.proposals[auctionId][index] = proposal;
        }
      }

      // Update current proposals if viewing this auction
      if (state.currentAuction?.id === auctionId) {
        const currentIndex = state.currentProposals.findIndex(
          p => p.id === proposal.id
        );
        if (currentIndex !== -1) {
          state.currentProposals[currentIndex] = proposal;
        }
      }

      // Update user proposals
      const userIndex = state.userProposals.findIndex(
        p => p.id === proposal.id
      );
      if (userIndex !== -1) {
        state.userProposals[userIndex] = proposal;
      }

      state.lastUpdateTime = Date.now();
    },
    removeProposal: (
      state,
      action: PayloadAction<{ auctionId: string; proposalId: string }>
    ) => {
      const { auctionId, proposalId } = action.payload;

      if (state.proposals[auctionId]) {
        state.proposals[auctionId] = state.proposals[auctionId].filter(
          p => p.id !== proposalId
        );
      }

      // Update current proposals if viewing this auction
      if (state.currentAuction?.id === auctionId) {
        state.currentProposals = state.currentProposals.filter(
          p => p.id !== proposalId
        );
      }

      // Remove from user proposals
      state.userProposals = state.userProposals.filter(
        p => p.id !== proposalId
      );
    },

    // Dashboard data management
    setDashboardData: (
      state,
      action: PayloadAction<{ auctionId: string; data: AuctionDashboardData }>
    ) => {
      const { auctionId, data } = action.payload;
      state.dashboardData[auctionId] = data;
    },
    updateDashboardData: (
      state,
      action: PayloadAction<{
        auctionId: string;
        updates: Partial<AuctionDashboardData>;
      }>
    ) => {
      const { auctionId, updates } = action.payload;
      if (state.dashboardData[auctionId]) {
        state.dashboardData[auctionId] = {
          ...state.dashboardData[auctionId],
          ...updates,
        };
      }
    },

    // User-specific data
    setUserAuctions: (state, action: PayloadAction<SwapAuction[]>) => {
      state.userAuctions = action.payload;
    },
    setUserProposals: (state, action: PayloadAction<AuctionProposal[]>) => {
      state.userProposals = action.payload;
    },

    // Real-time connection management
    addActiveConnection: (state, action: PayloadAction<string>) => {
      if (!state.activeConnections.includes(action.payload)) {
        state.activeConnections.push(action.payload);
      }
    },
    removeActiveConnection: (state, action: PayloadAction<string>) => {
      state.activeConnections = state.activeConnections.filter(
        id => id !== action.payload
      );
    },
    clearActiveConnections: state => {
      state.activeConnections = [];
    },

    // Filter management
    setFilters: (
      state,
      action: PayloadAction<Partial<AuctionState['filters']>>
    ) => {
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
    setTotalPages: (state, action: PayloadAction<number>) => {
      state.totalPages = action.payload;
    },

    // Statistics
    setAuctionStats: (
      state,
      action: PayloadAction<AuctionState['auctionStats']>
    ) => {
      state.auctionStats = action.payload;
    },

    // Real-time updates
    updateLastUpdateTime: state => {
      state.lastUpdateTime = Date.now();
    },

    // Cache management
    invalidateCache: state => {
      state.lastFetchTime = null;
    },

    // Optimistic updates
    optimisticUpdateAuctionStatus: (
      state,
      action: PayloadAction<{ id: string; status: AuctionStatus }>
    ) => {
      const { id, status } = action.payload;
      const auction = state.auctions.find(a => a.id === id);
      if (auction) {
        auction.status = status;
        if (status === 'ended') {
          auction.endedAt = new Date();
        }
      }

      // Update current auction if it's the same
      if (state.currentAuction?.id === id) {
        state.currentAuction.status = status;
        if (status === 'ended') {
          state.currentAuction.endedAt = new Date();
        }
      }
    },

    optimisticUpdateProposalStatus: (
      state,
      action: PayloadAction<{
        auctionId: string;
        proposalId: string;
        status: ProposalStatus;
      }>
    ) => {
      const { auctionId, proposalId, status } = action.payload;

      if (state.proposals[auctionId]) {
        const proposal = state.proposals[auctionId].find(
          p => p.id === proposalId
        );
        if (proposal) {
          proposal.status = status;
        }
      }

      // Update current proposals
      const currentProposal = state.currentProposals.find(
        p => p.id === proposalId
      );
      if (currentProposal) {
        currentProposal.status = status;
      }

      // Update user proposals
      const userProposal = state.userProposals.find(p => p.id === proposalId);
      if (userProposal) {
        userProposal.status = status;
      }
    },

    // Batch operations
    updateMultipleAuctions: (state, action: PayloadAction<SwapAuction[]>) => {
      action.payload.forEach(auction => {
        const index = state.auctions.findIndex(a => a.id === auction.id);
        if (index !== -1) {
          state.auctions[index] = auction;
        }
      });
      state.lastUpdateTime = Date.now();
    },

    updateMultipleProposals: (
      state,
      action: PayloadAction<AuctionProposal[]>
    ) => {
      action.payload.forEach(proposal => {
        const auctionId = proposal.auctionId;
        if (state.proposals[auctionId]) {
          const index = state.proposals[auctionId].findIndex(
            p => p.id === proposal.id
          );
          if (index !== -1) {
            state.proposals[auctionId][index] = proposal;
          }
        }
      });
      state.lastUpdateTime = Date.now();
    },

    // Reset state
    resetAuctionState: state => {
      Object.assign(state, initialState);
    },

    // Real-time auction updates
    updateAuctionTimeRemaining: (
      state,
      action: PayloadAction<{ auctionId: string; timeRemaining: number }>
    ) => {
      const { auctionId, timeRemaining } = action.payload;
      if (state.dashboardData[auctionId]) {
        state.dashboardData[auctionId].timeRemaining = timeRemaining;
      }
    },

    // Auction end handling
    handleAuctionEnd: (
      state,
      action: PayloadAction<{ auctionId: string; winningProposalId?: string }>
    ) => {
      const { auctionId, winningProposalId } = action.payload;

      const auction = state.auctions.find(a => a.id === auctionId);
      if (auction) {
        auction.status = 'ended';
        auction.endedAt = new Date();
        if (winningProposalId) {
          auction.winningProposalId = winningProposalId;
        }
      }

      // Update current auction if it's the same
      if (state.currentAuction?.id === auctionId) {
        state.currentAuction.status = 'ended';
        state.currentAuction.endedAt = new Date();
        if (winningProposalId) {
          state.currentAuction.winningProposalId = winningProposalId;
        }
      }

      // Update proposals status
      if (state.proposals[auctionId] && winningProposalId) {
        state.proposals[auctionId].forEach(proposal => {
          proposal.status =
            proposal.id === winningProposalId ? 'selected' : 'rejected';
        });

        // Update current proposals
        state.currentProposals.forEach(proposal => {
          proposal.status =
            proposal.id === winningProposalId ? 'selected' : 'rejected';
        });
      }

      // Remove active connection
      state.activeConnections = state.activeConnections.filter(
        id => id !== auctionId
      );

      state.lastUpdateTime = Date.now();
    },
  },
});

export const {
  // Loading and error states
  setLoading,
  setError,

  // Core auction management
  setAuctions,
  setCurrentAuction,

  // CRUD operations
  addAuction,
  updateAuction,
  removeAuction,
  updateMultipleAuctions,

  // Proposal management
  setProposals,
  addProposal,
  updateProposal,
  removeProposal,
  updateMultipleProposals,

  // Dashboard data management
  setDashboardData,
  updateDashboardData,

  // User-specific data
  setUserAuctions,
  setUserProposals,

  // Real-time connection management
  addActiveConnection,
  removeActiveConnection,
  clearActiveConnections,

  // Filter management
  setFilters,
  clearFilters,

  // Pagination
  setCurrentPage,
  setTotalPages,

  // Statistics
  setAuctionStats,

  // Real-time updates
  updateLastUpdateTime,

  // Cache management
  invalidateCache,

  // Optimistic updates
  optimisticUpdateAuctionStatus,
  optimisticUpdateProposalStatus,

  // Reset state
  resetAuctionState,

  // Real-time auction updates
  updateAuctionTimeRemaining,

  // Auction end handling
  handleAuctionEnd,
} = auctionSlice.actions;

// Basic selectors
export const selectAuctions = (state: { auctions: AuctionState }) =>
  state.auctions.auctions;
export const selectCurrentAuction = (state: { auctions: AuctionState }) =>
  state.auctions.currentAuction;
export const selectCurrentProposals = (state: { auctions: AuctionState }) =>
  state.auctions.currentProposals;
export const selectUserAuctions = (state: { auctions: AuctionState }) =>
  state.auctions.userAuctions;
export const selectUserProposals = (state: { auctions: AuctionState }) =>
  state.auctions.userProposals;
export const selectAuctionsLoading = (state: { auctions: AuctionState }) =>
  state.auctions.loading;
export const selectAuctionsError = (state: { auctions: AuctionState }) =>
  state.auctions.error;
export const selectAuctionFilters = (state: { auctions: AuctionState }) =>
  state.auctions.filters;
export const selectAuctionStats = (state: { auctions: AuctionState }) =>
  state.auctions.auctionStats;
export const selectActiveConnections = (state: { auctions: AuctionState }) =>
  state.auctions.activeConnections;
export const selectLastUpdateTime = (state: { auctions: AuctionState }) =>
  state.auctions.lastUpdateTime;

// Computed selectors
export const selectAuctionById = (
  state: { auctions: AuctionState },
  id: string
) => state.auctions.auctions.find(auction => auction.id === id);

export const selectAuctionsByStatus = (
  state: { auctions: AuctionState },
  status: AuctionStatus
) => state.auctions.auctions.filter(auction => auction.status === status);

export const selectActiveAuctions = (state: { auctions: AuctionState }) =>
  state.auctions.auctions.filter(auction => auction.status === 'active');

export const selectEndedAuctions = (state: { auctions: AuctionState }) =>
  state.auctions.auctions.filter(auction => auction.status === 'ended');

export const selectProposalsForAuction = (
  state: { auctions: AuctionState },
  auctionId: string
) => state.auctions.proposals[auctionId] || [];

export const selectDashboardDataForAuction = (
  state: { auctions: AuctionState },
  auctionId: string
) => state.auctions.dashboardData[auctionId];

export const selectUserAuctionsByStatus = (
  state: { auctions: AuctionState },
  status: AuctionStatus
) => state.auctions.userAuctions.filter(auction => auction.status === status);

export const selectUserProposalsByStatus = (
  state: { auctions: AuctionState },
  status: ProposalStatus
) =>
  state.auctions.userProposals.filter(proposal => proposal.status === status);

export const selectEndingSoonAuctions = (state: { auctions: AuctionState }) => {
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return state.auctions.auctions.filter(
    auction =>
      auction.status === 'active' &&
      new Date(auction.settings.endDate) <= twentyFourHoursFromNow
  );
};

export const selectAuctionsRequiringAction = (
  state: { auctions: AuctionState },
  userId: string
) =>
  state.auctions.auctions.filter(
    auction =>
      auction.status === 'ended' &&
      auction.ownerId === userId &&
      !auction.winningProposalId
  );

export const selectProposalComparison = (
  state: { auctions: AuctionState },
  auctionId: string
): ProposalComparison | null => {
  const proposals = state.auctions.proposals[auctionId];
  if (!proposals || proposals.length === 0) return null;

  const bookingProposals = proposals.filter(p => p.proposalType === 'booking');
  const cashProposals = proposals.filter(p => p.proposalType === 'cash');

  const highestCashOffer = cashProposals.reduce((highest, proposal) => {
    if (!proposal.cashOffer) return highest;
    if (!highest || proposal.cashOffer.amount > highest.amount) {
      return proposal.cashOffer;
    }
    return highest;
  }, null as any);

  // Simple recommendation logic - highest cash offer or first booking proposal
  let recommendedProposal: string | undefined;
  if (highestCashOffer) {
    const highestCashProposal = cashProposals.find(
      p => p.cashOffer?.amount === highestCashOffer.amount
    );
    recommendedProposal = highestCashProposal?.id;
  } else if (bookingProposals.length > 0) {
    recommendedProposal = bookingProposals[0].id;
  }

  return {
    bookingProposals,
    cashProposals,
    highestCashOffer,
    recommendedProposal,
  };
};

export const selectIsCacheValid = (state: { auctions: AuctionState }) => {
  if (!state.auctions.lastFetchTime) return false;
  return Date.now() - state.auctions.lastFetchTime < state.auctions.cacheExpiry;
};

export const selectHasActiveConnection = (
  state: { auctions: AuctionState },
  auctionId: string
) => state.auctions.activeConnections.includes(auctionId);

export const selectAuctionTimeRemaining = (
  state: { auctions: AuctionState },
  auctionId: string
) => {
  const auction = state.auctions.auctions.find(a => a.id === auctionId);
  if (!auction || auction.status !== 'active') return 0;

  const endTime = new Date(auction.settings.endDate).getTime();
  const now = Date.now();
  return Math.max(0, endTime - now);
};
