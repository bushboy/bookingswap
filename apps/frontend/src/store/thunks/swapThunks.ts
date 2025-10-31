import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  swapService,
  CreateSwapRequest,
  SwapFilters,
  ProposalData,
  SwapWithBookings,
} from '../../services/swapService';
import {
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
  PaymentTransaction,
  EscrowAccount,
} from '@booking-swap/shared';
import {
  setLoading,
  setError,
  setSwaps,
  setCurrentSwap,
  addSwap,
  updateSwap,
  removeSwap,
  setProposals,
  addProposal,
  updateProposal,
  setSwapHistory,
  addSwapEvent,
  setUserStats,
  optimisticUpdateSwapStatus,
  invalidateCache,
  updateLastUpdateTime,
  updateSwapStatus,
  // Enhanced actions
  createEnhancedSwap,
  createEnhancedSwapSuccess,
  createEnhancedSwapFailure,
  createEnhancedProposal,
  createEnhancedProposalSuccess,
  createEnhancedProposalFailure,
  setPaymentTransaction,
  updatePaymentTransaction,
  setEscrowAccount,
  updateEscrowAccount,
  startPaymentProcessing,
  completePaymentProcessing,
  setEnhancedUserStats,
} from '../slices/swapsSlice';
import { RootState } from '../index';
import { SwapStatus } from '@booking-swap/shared';

// Fetch user's swaps
export const fetchSwaps = createAsyncThunk(
  'swaps/fetchSwaps',
  async (
    { userId, filters }: { userId?: string; filters?: SwapFilters },
    { dispatch, getState }
  ) => {
    try {
      dispatch(setLoading(true));

      const state = getState() as RootState;

      // Check cache validity if no filters provided
      if (!filters && state.swaps.lastFetchTime) {
        const cacheAge = Date.now() - state.swaps.lastFetchTime;
        if (cacheAge < state.swaps.cacheExpiry) {
          dispatch(setLoading(false));
          return state.swaps.swaps;
        }
      }

      const swaps = await swapService.getSwaps(userId, filters);
      dispatch(setSwaps(swaps));
      return swaps;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch swaps';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch a single swap
export const fetchSwap = createAsyncThunk(
  'swaps/fetchSwap',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const swap = await swapService.getSwap(id);
      dispatch(setCurrentSwap(swap));
      return swap;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create a new swap
export const createSwap = createAsyncThunk(
  'swaps/createSwap',
  async (swapData: CreateSwapRequest, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const swap = await swapService.createSwap(swapData);

      // Fetch the full swap with bookings data
      const fullSwap = await swapService.getSwap(swap.id);
      dispatch(addSwap(fullSwap));
      dispatch(setCurrentSwap(fullSwap));

      return fullSwap;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Accept a swap
export const acceptSwap = createAsyncThunk(
  'swaps/acceptSwap',
  async ({ id, message }: { id: string; message?: string }, { dispatch }) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateSwapStatus({ id, status: 'accepted' }));

      const updatedSwap = await swapService.acceptSwap(id, message);
      const fullSwap = await swapService.getSwap(id);

      dispatch(updateSwap(fullSwap));
      dispatch(updateLastUpdateTime());

      return fullSwap;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchSwap(id));

      const message =
        error instanceof Error ? error.message : 'Failed to accept swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Reject a swap
export const rejectSwap = createAsyncThunk(
  'swaps/rejectSwap',
  async ({ id, reason }: { id: string; reason?: string }, { dispatch }) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateSwapStatus({ id, status: 'rejected' }));

      const updatedSwap = await swapService.rejectSwap(id, reason);
      const fullSwap = await swapService.getSwap(id);

      dispatch(updateSwap(fullSwap));
      dispatch(updateLastUpdateTime());

      return fullSwap;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchSwap(id));

      const message =
        error instanceof Error ? error.message : 'Failed to reject swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Cancel a swap
export const cancelSwap = createAsyncThunk(
  'swaps/cancelSwap',
  async ({ id, reason }: { id: string; reason?: string }, { dispatch }) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateSwapStatus({ id, status: 'cancelled' }));

      const updatedSwap = await swapService.cancelSwap(id, reason);
      const fullSwap = await swapService.getSwap(id);

      dispatch(updateSwap(fullSwap));
      dispatch(updateLastUpdateTime());

      return fullSwap;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchSwap(id));

      const message =
        error instanceof Error ? error.message : 'Failed to cancel swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Complete a swap
export const completeSwap = createAsyncThunk(
  'swaps/completeSwap',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));

      const updatedSwap = await swapService.completeSwap(id);
      const fullSwap = await swapService.getSwap(id);

      dispatch(updateSwap(fullSwap));
      dispatch(updateLastUpdateTime());

      return fullSwap;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to complete swap';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create a proposal for a swap
export const createProposal = createAsyncThunk(
  'swaps/createProposal',
  async (
    { swapId, proposalData }: { swapId: string; proposalData: ProposalData },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      const proposal = await swapService.createProposal(swapId, proposalData);
      dispatch(addProposal(proposal));
      return proposal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create proposal';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch proposals for a swap
export const fetchProposals = createAsyncThunk(
  'swaps/fetchProposals',
  async (swapId: string, { dispatch }) => {
    try {
      const proposals = await swapService.getProposals(swapId);
      dispatch(setProposals({ swapId, proposals }));
      return proposals;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch proposals';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Accept a proposal
export const acceptProposal = createAsyncThunk(
  'swaps/acceptProposal',
  async (
    { swapId, proposalId }: { swapId: string; proposalId: string },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      const proposal = await swapService.acceptProposal(swapId, proposalId);
      dispatch(updateProposal(proposal));

      // Refresh the swap to get updated status
      dispatch(fetchSwap(swapId));

      return proposal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to accept proposal';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Reject a proposal
export const rejectProposal = createAsyncThunk(
  'swaps/rejectProposal',
  async (
    {
      swapId,
      proposalId,
      reason,
    }: { swapId: string; proposalId: string; reason?: string },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      const proposal = await swapService.rejectProposal(
        swapId,
        proposalId,
        reason
      );
      dispatch(updateProposal(proposal));
      return proposal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reject proposal';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch swap history
export const fetchSwapHistory = createAsyncThunk(
  'swaps/fetchSwapHistory',
  async (swapId: string, { dispatch }) => {
    try {
      const events = await swapService.getSwapHistory(swapId);
      dispatch(setSwapHistory({ swapId, events }));
      return events;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch swap history';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch swaps by status
export const fetchSwapsByStatus = createAsyncThunk(
  'swaps/fetchSwapsByStatus',
  async (
    { status, userId }: { status: SwapStatus; userId?: string },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      const swaps = await swapService.getSwapsByStatus(status, userId);
      return swaps;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch swaps by status';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch user swap statistics
export const fetchUserSwapStats = createAsyncThunk(
  'swaps/fetchUserSwapStats',
  async (userId: string, { dispatch }) => {
    try {
      const stats = await swapService.getUserSwapStats(userId);
      dispatch(setUserStats(stats));
      return stats;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch user stats';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Check if swap can be created
export const checkSwapEligibility = createAsyncThunk(
  'swaps/checkSwapEligibility',
  async ({
    sourceBookingId,
    targetBookingId,
  }: {
    sourceBookingId: string;
    targetBookingId: string;
  }) => {
    try {
      const result = await swapService.canCreateSwap(
        sourceBookingId,
        targetBookingId
      );
      return result;
    } catch (error) {
      throw error;
    }
  }
);

// Get swap recommendations
export const getSwapRecommendations = createAsyncThunk(
  'swaps/getSwapRecommendations',
  async (bookingId: string) => {
    try {
      const recommendations =
        await swapService.getSwapRecommendations(bookingId);
      return recommendations;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to get recommendations';
      throw error;
    }
  }
);

// Estimate swap fees
export const estimateSwapFees = createAsyncThunk(
  'swaps/estimateSwapFees',
  async ({
    sourceBookingId,
    targetBookingId,
  }: {
    sourceBookingId: string;
    targetBookingId: string;
  }) => {
    try {
      const fees = await swapService.estimateSwapFees(
        sourceBookingId,
        targetBookingId
      );
      return fees;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to estimate fees';
      throw error;
    }
  }
);

// Check swap status (for real-time updates)
export const checkSwapStatus = createAsyncThunk(
  'swaps/checkSwapStatus',
  async (swapId: string, { dispatch }) => {
    try {
      const statusInfo = await swapService.checkSwapStatus(swapId);

      // If status has changed, refresh the swap
      const state = (dispatch as any).getState() as RootState;
      const currentSwap = state.swaps.swaps.find(s => s.id === swapId);

      if (currentSwap && currentSwap.status !== statusInfo.status) {
        dispatch(fetchSwap(swapId));
      }

      return statusInfo;
    } catch (error) {
      throw error;
    }
  }
);

// Refresh swaps data
export const refreshSwaps = createAsyncThunk(
  'swaps/refreshSwaps',
  async (
    { userId, filters }: { userId?: string; filters?: SwapFilters },
    { dispatch }
  ) => {
    try {
      dispatch(invalidateCache());
      return await dispatch(fetchSwaps({ userId, filters })).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Batch fetch multiple swaps
export const fetchMultipleSwaps = createAsyncThunk(
  'swaps/fetchMultipleSwaps',
  async (swapIds: string[], { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const swaps = await swapService.getMultipleSwaps(swapIds);

      // Update each swap in the store
      swaps.forEach(swap => {
        dispatch(updateSwap(swap));
      });

      return swaps;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch multiple swaps';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch swaps with retry mechanism
export const fetchSwapsWithRetry = createAsyncThunk(
  'swaps/fetchSwapsWithRetry',
  async (
    { userId, filters }: { userId?: string; filters?: SwapFilters },
    { dispatch, rejectWithValue }
  ) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await dispatch(fetchSwaps({ userId, filters })).unwrap();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          return rejectWithValue(lastError.message);
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    return rejectWithValue(
      lastError?.message || 'Failed to fetch swaps after retries'
    );
  }
);

// Refresh single swap data
export const refreshSwap = createAsyncThunk(
  'swaps/refreshSwap',
  async (swapId: string, { dispatch }) => {
    try {
      const swap = await swapService.getSwap(swapId);
      dispatch(updateSwap(swap));
      dispatch(updateLastUpdateTime());
      return swap;
    } catch (error) {
      console.error('Failed to refresh swap:', error);
      throw error;
    }
  }
);

// Real-time swap monitoring
export const startSwapMonitoring = createAsyncThunk(
  'swaps/startSwapMonitoring',
  async (swapIds: string[], { dispatch }) => {
    const checkInterval = 30000; // 30 seconds

    const monitorSwaps = async () => {
      try {
        for (const swapId of swapIds) {
          await dispatch(checkSwapStatus(swapId));
        }
      } catch (error) {
        console.error('Error monitoring swaps:', error);
      }
    };

    // Initial check
    await monitorSwaps();

    // Set up interval
    const intervalId = setInterval(monitorSwaps, checkInterval);

    return intervalId;
  }
);

// Enhanced swap thunks
export const createEnhancedSwapThunk = createAsyncThunk(
  'swaps/createEnhanced',
  async (request: EnhancedCreateSwapRequest, { dispatch }) => {
    const swapId = `temp-${Date.now()}`; // Temporary ID for optimistic updates

    try {
      // Start optimistic update
      dispatch(createEnhancedSwap({ swapId, request }));

      // Create the enhanced swap (this would call the actual API)
      // For now, we'll simulate the API call
      const enhancedSwap = await new Promise<any>(resolve => {
        setTimeout(() => {
          resolve({
            id: `swap-${Date.now()}`,
            ...request,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
            // Add other required fields
          });
        }, 1000);
      });

      dispatch(createEnhancedSwapSuccess(enhancedSwap));
      return enhancedSwap;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create enhanced swap';
      dispatch(createEnhancedSwapFailure({ swapId, error: message }));
      throw error;
    }
  }
);

export const createEnhancedProposalThunk = createAsyncThunk(
  'swaps/createEnhancedProposal',
  async (request: CreateEnhancedProposalRequest, { dispatch }) => {
    const proposalId = `temp-proposal-${Date.now()}`; // Temporary ID for optimistic updates

    try {
      // Start optimistic update
      dispatch(createEnhancedProposal({ proposalId, request }));

      // Create the enhanced proposal (this would call the actual API)
      const proposal = await new Promise<any>(resolve => {
        setTimeout(() => {
          resolve({
            id: `proposal-${Date.now()}`,
            swapId: request.swapId,
            proposalType: request.proposalType,
            bookingId: request.bookingId,
            cashOffer: request.cashOffer,
            message: request.message,
            conditions: request.conditions,
            status: 'pending',
            submittedAt: new Date(),
          });
        }, 1000);
      });

      dispatch(createEnhancedProposalSuccess(proposal));
      return proposal;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create enhanced proposal';
      dispatch(createEnhancedProposalFailure({ proposalId, error: message }));
      throw error;
    }
  }
);

// Payment-related thunks
export const processPayment = createAsyncThunk(
  'swaps/processPayment',
  async (
    { swapId, paymentData }: { swapId: string; paymentData: any },
    { dispatch }
  ) => {
    const transactionId = `tx-${Date.now()}`;

    try {
      dispatch(startPaymentProcessing(transactionId));

      // Process payment (this would call the actual payment service)
      const transaction: PaymentTransaction = await new Promise(resolve => {
        setTimeout(() => {
          resolve({
            id: transactionId,
            swapId,
            proposalId: paymentData.proposalId,
            payerId: paymentData.payerId,
            recipientId: paymentData.recipientId,
            amount: paymentData.amount,
            currency: paymentData.currency,
            status: 'completed',
            gatewayTransactionId: `gw-${Date.now()}`,
            platformFee: paymentData.amount * 0.05, // 5% platform fee
            netAmount: paymentData.amount * 0.95,
            createdAt: new Date(),
            completedAt: new Date(),
            blockchain: {
              transactionId: `blockchain-${Date.now()}`,
            },
          } as PaymentTransaction);
        }, 2000);
      });

      dispatch(setPaymentTransaction({ swapId, transaction }));
      dispatch(completePaymentProcessing(transactionId));

      return transaction;
    } catch (error) {
      dispatch(completePaymentProcessing(transactionId));
      const message =
        error instanceof Error ? error.message : 'Failed to process payment';
      dispatch(setError(message));
      throw error;
    }
  }
);

export const createEscrowAccount = createAsyncThunk(
  'swaps/createEscrow',
  async (
    { swapId, escrowData }: { swapId: string; escrowData: any },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));

      // Create escrow account (this would call the actual escrow service)
      const escrow: EscrowAccount = await new Promise(resolve => {
        setTimeout(() => {
          resolve({
            id: `escrow-${Date.now()}`,
            transactionId: escrowData.transactionId,
            amount: escrowData.amount,
            currency: escrowData.currency,
            status: 'created',
            createdAt: new Date(),
          } as EscrowAccount);
        }, 1500);
      });

      dispatch(setEscrowAccount({ swapId, escrow }));
      dispatch(setLoading(false));

      return escrow;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create escrow account';
      dispatch(setError(message));
      throw error;
    }
  }
);

export const releaseEscrow = createAsyncThunk(
  'swaps/releaseEscrow',
  async (
    {
      swapId,
      escrowId,
      recipientId,
    }: { swapId: string; escrowId: string; recipientId: string },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));

      // Release escrow (this would call the actual escrow service)
      await new Promise(resolve => {
        setTimeout(resolve, 1000);
      });

      dispatch(
        updateEscrowAccount({
          swapId,
          updates: {
            status: 'released',
            releasedAt: new Date(),
          },
        })
      );

      dispatch(setLoading(false));
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to release escrow';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Enhanced statistics
export const fetchEnhancedUserStats = createAsyncThunk(
  'swaps/fetchEnhancedStats',
  async (userId: string, { dispatch }) => {
    try {
      // Fetch enhanced statistics (this would call the actual API)
      const stats = await new Promise<any>(resolve => {
        setTimeout(() => {
          resolve({
            total: 25,
            pending: 5,
            completed: 18,
            cancelled: 2,
            successRate: 72,
            totalAuctions: 8,
            totalCashSwaps: 12,
            averageCashOffer: 150,
            auctionSuccessRate: 87.5,
          });
        }, 1000);
      });

      dispatch(setEnhancedUserStats(stats));
      return stats;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch enhanced stats';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Validate enhanced swap creation
export const validateEnhancedSwapCreation = createAsyncThunk(
  'swaps/validateEnhancedCreation',
  async (request: EnhancedCreateSwapRequest) => {
    try {
      // Validate the enhanced swap request (this would call validation service)
      const validation = await new Promise<any>(resolve => {
        setTimeout(() => {
          const errors: string[] = [];
          const warnings: string[] = [];

          // Validate auction timing
          if (
            request.acceptanceStrategy.type === 'auction' &&
            request.auctionSettings
          ) {
            const now = new Date();
            const auctionEnd = new Date(request.auctionSettings.endDate);
            const eventDate = new Date(); // This would come from the booking

            const oneWeekBeforeEvent = new Date(
              eventDate.getTime() - 7 * 24 * 60 * 60 * 1000
            );

            if (auctionEnd > oneWeekBeforeEvent) {
              errors.push(
                'Auction must end at least one week before the event'
              );
            }

            if (auctionEnd <= now) {
              errors.push('Auction end date must be in the future');
            }
          }

          // Validate payment settings
          if (
            request.paymentTypes.cashPayment &&
            !request.paymentTypes.minimumCashAmount
          ) {
            warnings.push(
              'Consider setting a minimum cash amount for cash payments'
            );
          }

          resolve({
            isValid: errors.length === 0,
            errors,
            warnings,
          });
        }, 500);
      });

      return validation;
    } catch (error) {
      throw error;
    }
  }
);
