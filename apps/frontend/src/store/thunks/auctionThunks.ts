import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  SwapAuction,
  AuctionProposal,
  CreateAuctionRequest,
  CreateProposalRequest,
  AuctionResult,
  ProposalResult,
  AuctionDashboardData,
  AuctionStatus,
  ProposalStatus,
} from '@booking-swap/shared';
import {
  setLoading,
  setError,
  setAuctions,
  setCurrentAuction,
  addAuction,
  updateAuction,
  removeAuction,
  setProposals,
  addProposal,
  updateProposal,
  removeProposal,
  setDashboardData,
  updateDashboardData,
  setUserAuctions,
  setUserProposals,
  setAuctionStats,
  optimisticUpdateAuctionStatus,
  optimisticUpdateProposalStatus,
  invalidateCache,
  updateLastUpdateTime,
  handleAuctionEnd,
  addActiveConnection,
  removeActiveConnection,
  updateAuctionTimeRemaining,
} from '../slices/auctionSlice';
import { RootState } from '../index';

// Mock auction service - this would be replaced with actual API service
interface AuctionService {
  getAuctions(filters?: any): Promise<SwapAuction[]>;
  getAuction(id: string): Promise<SwapAuction>;
  createAuction(request: CreateAuctionRequest): Promise<SwapAuction>;
  endAuction(id: string): Promise<AuctionResult>;
  selectWinner(auctionId: string, proposalId: string): Promise<AuctionResult>;
  getProposals(auctionId: string): Promise<AuctionProposal[]>;
  createProposal(request: CreateProposalRequest): Promise<ProposalResult>;
  getUserAuctions(userId: string): Promise<SwapAuction[]>;
  getUserProposals(userId: string): Promise<AuctionProposal[]>;
  getDashboardData(auctionId: string): Promise<AuctionDashboardData>;
  getAuctionStats(userId?: string): Promise<any>;
  validateAuctionTiming(
    eventDate: Date,
    auctionEndDate: Date
  ): Promise<boolean>;
}

// This would be imported from actual service
const auctionService: AuctionService = {} as AuctionService;

// Fetch all auctions with optional filters
export const fetchAuctions = createAsyncThunk(
  'auctions/fetchAuctions',
  async (filters?: any, { dispatch, getState }) => {
    try {
      dispatch(setLoading(true));

      const state = getState() as RootState;

      // Check cache validity if no filters provided
      if (!filters && state.auctions.lastFetchTime) {
        const cacheAge = Date.now() - state.auctions.lastFetchTime;
        if (cacheAge < state.auctions.cacheExpiry) {
          dispatch(setLoading(false));
          return state.auctions.auctions;
        }
      }

      const auctions = await auctionService.getAuctions(filters);
      dispatch(setAuctions(auctions));
      return auctions;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch auctions';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch a single auction
export const fetchAuction = createAsyncThunk(
  'auctions/fetchAuction',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const auction = await auctionService.getAuction(id);
      dispatch(setCurrentAuction(auction));
      return auction;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch auction';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create a new auction
export const createAuction = createAsyncThunk(
  'auctions/createAuction',
  async (request: CreateAuctionRequest, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const auction = await auctionService.createAuction(request);
      dispatch(addAuction(auction));
      dispatch(setCurrentAuction(auction));
      return auction;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create auction';
      dispatch(setError(message));
      throw error;
    }
  }
);

// End an auction
export const endAuction = createAsyncThunk(
  'auctions/endAuction',
  async (id: string, { dispatch }) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateAuctionStatus({ id, status: 'ended' }));

      const result = await auctionService.endAuction(id);

      // Update auction with actual result
      const auction = await auctionService.getAuction(id);
      dispatch(updateAuction(auction));
      dispatch(updateLastUpdateTime());

      return result;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchAuction(id));

      const message =
        error instanceof Error ? error.message : 'Failed to end auction';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Select auction winner
export const selectAuctionWinner = createAsyncThunk(
  'auctions/selectWinner',
  async (
    { auctionId, proposalId }: { auctionId: string; proposalId: string },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));

      // Optimistic updates
      dispatch(
        optimisticUpdateProposalStatus({
          auctionId,
          proposalId,
          status: 'selected',
        })
      );
      dispatch(handleAuctionEnd({ auctionId, winningProposalId: proposalId }));

      const result = await auctionService.selectWinner(auctionId, proposalId);

      // Refresh auction and proposals data
      const auction = await auctionService.getAuction(auctionId);
      const proposals = await auctionService.getProposals(auctionId);

      dispatch(updateAuction(auction));
      dispatch(setProposals({ auctionId, proposals }));
      dispatch(updateLastUpdateTime());

      return result;
    } catch (error) {
      // Revert optimistic updates by refetching
      dispatch(fetchAuction(auctionId));
      dispatch(fetchProposals(auctionId));

      const message =
        error instanceof Error ? error.message : 'Failed to select winner';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch proposals for an auction
export const fetchProposals = createAsyncThunk(
  'auctions/fetchProposals',
  async (auctionId: string, { dispatch }) => {
    try {
      const proposals = await auctionService.getProposals(auctionId);
      dispatch(setProposals({ auctionId, proposals }));
      return proposals;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch proposals';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create a proposal for an auction
export const createAuctionProposal = createAsyncThunk(
  'auctions/createProposal',
  async (request: CreateProposalRequest, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const result = await auctionService.createProposal(request);

      // Fetch the full proposal data
      const proposals = await auctionService.getProposals(request.swapId);
      const newProposal = proposals.find(p => p.id === result.proposalId);

      if (newProposal) {
        dispatch(addProposal(newProposal));
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create proposal';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch user's auctions
export const fetchUserAuctions = createAsyncThunk(
  'auctions/fetchUserAuctions',
  async (userId: string, { dispatch }) => {
    try {
      const auctions = await auctionService.getUserAuctions(userId);
      dispatch(setUserAuctions(auctions));
      return auctions;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch user auctions';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch user's proposals
export const fetchUserProposals = createAsyncThunk(
  'auctions/fetchUserProposals',
  async (userId: string, { dispatch }) => {
    try {
      const proposals = await auctionService.getUserProposals(userId);
      dispatch(setUserProposals(proposals));
      return proposals;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch user proposals';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch auction dashboard data
export const fetchAuctionDashboard = createAsyncThunk(
  'auctions/fetchDashboard',
  async (auctionId: string, { dispatch }) => {
    try {
      const data = await auctionService.getDashboardData(auctionId);
      dispatch(setDashboardData({ auctionId, data }));
      return data;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch dashboard data';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch auction statistics
export const fetchAuctionStats = createAsyncThunk(
  'auctions/fetchStats',
  async (userId?: string, { dispatch }) => {
    try {
      const stats = await auctionService.getAuctionStats(userId);
      dispatch(setAuctionStats(stats));
      return stats;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch auction stats';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Validate auction timing
export const validateAuctionTiming = createAsyncThunk(
  'auctions/validateTiming',
  async ({
    eventDate,
    auctionEndDate,
  }: {
    eventDate: Date;
    auctionEndDate: Date;
  }) => {
    try {
      const isValid = await auctionService.validateAuctionTiming(
        eventDate,
        auctionEndDate
      );
      return { isValid, eventDate, auctionEndDate };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to validate timing';
      throw error;
    }
  }
);

// Refresh auctions data
export const refreshAuctions = createAsyncThunk(
  'auctions/refreshAuctions',
  async (filters?: any, { dispatch }) => {
    try {
      dispatch(invalidateCache());
      return await dispatch(fetchAuctions(filters)).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Refresh single auction data
export const refreshAuction = createAsyncThunk(
  'auctions/refreshAuction',
  async (auctionId: string, { dispatch }) => {
    try {
      const auction = await auctionService.getAuction(auctionId);
      dispatch(updateAuction(auction));
      dispatch(updateLastUpdateTime());
      return auction;
    } catch (error) {
      console.error('Failed to refresh auction:', error);
      throw error;
    }
  }
);

// Monitor auction time remaining (for real-time updates)
export const monitorAuctionTime = createAsyncThunk(
  'auctions/monitorTime',
  async (auctionId: string, { dispatch, getState }) => {
    const state = getState() as RootState;
    const auction = state.auctions.auctions.find(a => a.id === auctionId);

    if (!auction || auction.status !== 'active') {
      return;
    }

    const updateTimeRemaining = () => {
      const endTime = new Date(auction.settings.endDate).getTime();
      const now = Date.now();
      const timeRemaining = Math.max(0, endTime - now);

      dispatch(updateAuctionTimeRemaining({ auctionId, timeRemaining }));

      // If auction has ended, handle it
      if (timeRemaining === 0) {
        dispatch(handleAuctionEnd({ auctionId }));
        return false; // Stop monitoring
      }

      return true; // Continue monitoring
    };

    // Initial update
    if (!updateTimeRemaining()) {
      return;
    }

    // Set up interval for updates
    const intervalId = setInterval(() => {
      if (!updateTimeRemaining()) {
        clearInterval(intervalId);
      }
    }, 1000); // Update every second

    return intervalId;
  }
);

// WebSocket connection management for real-time updates
export const connectToAuctionUpdates = createAsyncThunk(
  'auctions/connectWebSocket',
  async (auctionId: string, { dispatch }) => {
    try {
      // This would establish a WebSocket connection to the auction
      // For now, we'll simulate it with a mock implementation

      dispatch(addActiveConnection(auctionId));

      // Mock WebSocket connection
      const mockWebSocket = {
        onmessage: (event: any) => {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'auction_updated':
              dispatch(updateAuction(data.auction));
              break;
            case 'proposal_added':
              dispatch(addProposal(data.proposal));
              break;
            case 'proposal_updated':
              dispatch(updateProposal(data.proposal));
              break;
            case 'auction_ended':
              dispatch(
                handleAuctionEnd({
                  auctionId: data.auctionId,
                  winningProposalId: data.winningProposalId,
                })
              );
              break;
            case 'time_update':
              dispatch(
                updateAuctionTimeRemaining({
                  auctionId: data.auctionId,
                  timeRemaining: data.timeRemaining,
                })
              );
              break;
          }
        },
        onclose: () => {
          dispatch(removeActiveConnection(auctionId));
        },
        onerror: (error: any) => {
          console.error('WebSocket error:', error);
          dispatch(removeActiveConnection(auctionId));
        },
      };

      return mockWebSocket;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to connect to auction updates';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Disconnect from auction updates
export const disconnectFromAuctionUpdates = createAsyncThunk(
  'auctions/disconnectWebSocket',
  async (auctionId: string, { dispatch }) => {
    try {
      // Close WebSocket connection
      // This would close the actual WebSocket connection

      dispatch(removeActiveConnection(auctionId));
      return true;
    } catch (error) {
      console.error('Failed to disconnect from auction updates:', error);
      throw error;
    }
  }
);

// Batch fetch multiple auctions
export const fetchMultipleAuctions = createAsyncThunk(
  'auctions/fetchMultiple',
  async (auctionIds: string[], { dispatch }) => {
    try {
      dispatch(setLoading(true));

      // Fetch all auctions in parallel
      const auctionPromises = auctionIds.map(id =>
        auctionService.getAuction(id)
      );
      const auctions = await Promise.all(auctionPromises);

      // Update each auction in the store
      auctions.forEach(auction => {
        dispatch(updateAuction(auction));
      });

      return auctions;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch multiple auctions';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Auto-refresh active auctions
export const startAuctionMonitoring = createAsyncThunk(
  'auctions/startMonitoring',
  async (auctionIds: string[], { dispatch }) => {
    const checkInterval = 30000; // 30 seconds

    const monitorAuctions = async () => {
      try {
        for (const auctionId of auctionIds) {
          await dispatch(refreshAuction(auctionId));
          await dispatch(monitorAuctionTime(auctionId));
        }
      } catch (error) {
        console.error('Error monitoring auctions:', error);
      }
    };

    // Initial check
    await monitorAuctions();

    // Set up interval
    const intervalId = setInterval(monitorAuctions, checkInterval);

    return intervalId;
  }
);

// Handle auction timeout (when owner doesn't select winner)
export const handleAuctionTimeout = createAsyncThunk(
  'auctions/handleTimeout',
  async (auctionId: string, { dispatch, getState }) => {
    try {
      const state = getState() as RootState;
      const proposals = state.auctions.proposals[auctionId] || [];

      if (proposals.length === 0) {
        // No proposals, just end the auction
        dispatch(handleAuctionEnd({ auctionId }));
        return;
      }

      // Auto-select highest cash offer or first booking proposal
      const cashProposals = proposals.filter(
        p => p.proposalType === 'cash' && p.cashOffer
      );
      let winningProposalId: string | undefined;

      if (cashProposals.length > 0) {
        // Select highest cash offer
        const highestCashProposal = cashProposals.reduce((highest, current) => {
          if (!current.cashOffer || !highest.cashOffer) return current;
          return current.cashOffer.amount > highest.cashOffer.amount
            ? current
            : highest;
        });
        winningProposalId = highestCashProposal.id;
      } else {
        // Select first booking proposal
        const bookingProposals = proposals.filter(
          p => p.proposalType === 'booking'
        );
        if (bookingProposals.length > 0) {
          winningProposalId = bookingProposals[0].id;
        }
      }

      if (winningProposalId) {
        await dispatch(
          selectAuctionWinner({ auctionId, proposalId: winningProposalId })
        );
      } else {
        dispatch(handleAuctionEnd({ auctionId }));
      }
    } catch (error) {
      console.error('Failed to handle auction timeout:', error);
      dispatch(handleAuctionEnd({ auctionId }));
    }
  }
);
