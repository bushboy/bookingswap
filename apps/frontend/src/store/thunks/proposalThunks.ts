import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  CreateProposalFromBrowseRequest,
  SwapProposalResult,
  EligibleSwapsResponse,
  CompatibilityResponse,
  ProposalHistoryResponse,
  ValidationResult,
  SwapProposalStatus,
  ProposalSummary,
} from '@booking-swap/shared';
import { swapApiService } from '../../services/swapApiService';
import { RootState } from '../index';
import {
  // Proposal slice actions
  setLoading as setProposalLoading,
  setError as setProposalError,
  openProposalModal,
  closeProposalModal,
  setProposalStep,
  selectSourceSwap,
  setProposalValidation,
  startProposalSubmission,
  proposalSubmissionSuccess,
  proposalSubmissionError,
  setProposalHistory,
  updateProposal,
  startProposalCreation,
  completeProposalCreation,
  startProposalUpdate,
  completeProposalUpdate,
  invalidateProposalCache,
} from '../slices/proposalSlice';
import {
  // Eligible swaps slice actions
  setError as setEligibleSwapsError,
  setCurrentTargetSwap,
  setEligibleSwaps,
  startFetchingEligibleSwaps,
  completeFetchingEligibleSwaps,
  invalidateEligibleSwapsCache,
} from '../slices/eligibleSwapsSlice';
import {
  // Compatibility slice actions
  setError as setCompatibilityError,
  setCurrentSwapPair,
  setCompatibilityAnalysis,
  startAnalyzingPair,
  completeAnalyzingPair,
  invalidateCompatibilityCache,
  startBatchAnalysis,
  updateBatchAnalysisProgress,
  completeBatchAnalysis,
  cancelBatchAnalysis,
} from '../slices/compatibilitySlice';

// API service (this would be imported from your actual API service)
// For now, we'll create mock implementations
const proposalAPI = {
  async createProposalFromBrowse(request: CreateProposalFromBrowseRequest): Promise<SwapProposalResult> {
    // Mock API call - replace with actual implementation
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          resolve({
            proposalId: `proposal-${Date.now()}`,
            swap: {
              id: request.targetSwapId,
              // Add other swap properties as needed
            } as any,
            status: 'pending_review',
            blockchainTransaction: {
              transactionId: `tx-${Date.now()}`,
              consensusTimestamp: new Date().toISOString(),
            },
            estimatedResponseTime: '2-3 business days',
            nextSteps: [
              'The swap owner will review your proposal',
              'You will receive a notification when they respond',
              'Check your proposals page for status updates',
            ],
          });
        } else {
          reject(new Error('Failed to create proposal'));
        }
      }, 1000);
    });
  },

  async getUserEligibleSwaps(userId: string, targetSwapId: string): Promise<EligibleSwapsResponse> {
    // Use the real SwapApiService with proper authentication
    return await swapApiService.getEligibleSwaps(userId, {
      targetSwapId,
      limit: 50,
      includeIneligible: false,
      minCompatibilityScore: 0,
    });
  },

  async getCompatibilityAnalysis(sourceSwapId: string, targetSwapId: string): Promise<CompatibilityResponse> {
    // Mock API call - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockAnalysis = {
          overallScore: Math.floor(Math.random() * 40) + 60, // 60-100
          factors: {
            locationCompatibility: {
              score: Math.floor(Math.random() * 30) + 70,
              weight: 0.25,
              details: 'Both locations are in similar climate zones',
              status: 'good' as const,
            },
            dateCompatibility: {
              score: Math.floor(Math.random() * 20) + 80,
              weight: 0.25,
              details: 'Date ranges have good overlap potential',
              status: 'excellent' as const,
            },
            valueCompatibility: {
              score: Math.floor(Math.random() * 25) + 65,
              weight: 0.20,
              details: 'Property values are reasonably matched',
              status: 'good' as const,
            },
            accommodationCompatibility: {
              score: Math.floor(Math.random() * 35) + 55,
              weight: 0.15,
              details: 'Similar accommodation types',
              status: 'fair' as const,
            },
            guestCompatibility: {
              score: Math.floor(Math.random() * 20) + 75,
              weight: 0.15,
              details: 'Guest capacity is well matched',
              status: 'good' as const,
            },
          },
          recommendations: [
            'Consider flexible date arrangements',
            'Discuss any additional amenities',
          ],
          potentialIssues: [
            'Minor difference in property size',
          ],
        };

        resolve({
          compatibility: mockAnalysis,
          recommendation: mockAnalysis.overallScore >= 80 ? 'highly_recommended' : 
                         mockAnalysis.overallScore >= 70 ? 'recommended' : 
                         mockAnalysis.overallScore >= 60 ? 'possible' : 'not_recommended',
        });
      }, 600);
    });
  },

  async getProposalHistory(userId: string, filters?: {
    status?: SwapProposalStatus;
    page?: number;
    limit?: number;
  }): Promise<ProposalHistoryResponse> {
    // Mock API call - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockProposals: ProposalSummary[] = Array.from({ length: 5 }, (_, i) => ({
          id: `proposal-${i + 1}`,
          sourceSwapId: `source-swap-${i + 1}`,
          targetSwapId: `target-swap-${i + 1}`,
          proposerId: userId,
          targetOwnerId: `owner-${i + 1}`,
          status: (['pending', 'accepted', 'rejected', 'expired'] as SwapProposalStatus[])[i % 4],
          message: `Proposal message ${i + 1}`,
          conditions: [`Condition ${i + 1}`],
          compatibilityScore: Math.floor(Math.random() * 40) + 60,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          blockchainTransactionId: `blockchain-tx-${i + 1}`,
          sourceSwapTitle: `My Swap ${i + 1}`,
          targetSwapTitle: `Target Swap ${i + 1}`,
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - i * 12 * 60 * 60 * 1000),
          respondedAt: i % 2 === 0 ? new Date(Date.now() - i * 6 * 60 * 60 * 1000) : undefined,
        }));

        resolve({
          proposals: mockProposals,
          pagination: {
            totalCount: mockProposals.length,
            currentPage: filters?.page || 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        });
      }, 500);
    });
  },

  async validateProposal(request: CreateProposalFromBrowseRequest): Promise<ValidationResult> {
    // Mock API call - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        const isValid = Math.random() > 0.2; // 80% success rate
        
        resolve({
          isValid,
          errors: isValid ? [] : ['Source swap is not available', 'Target swap already has a proposal from you'],
          warnings: ['Consider adding a personal message to increase acceptance chances'],
          eligibilityChecks: {
            userOwnsSourceSwap: true,
            sourceSwapAvailable: isValid,
            targetSwapAvailable: true,
            noExistingProposal: isValid,
            swapsAreCompatible: true,
          },
        });
      }, 300);
    });
  },

  async updateProposalStatus(proposalId: string, status: SwapProposalStatus): Promise<ProposalSummary> {
    // Mock API call - replace with actual implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          id: proposalId,
          sourceSwapId: 'source-swap-1',
          targetSwapId: 'target-swap-1',
          proposerId: 'user-1',
          targetOwnerId: 'owner-1',
          status,
          message: 'Updated proposal',
          conditions: [],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          blockchainTransactionId: 'blockchain-tx-1',
          sourceSwapTitle: 'My Swap',
          targetSwapTitle: 'Target Swap',
          createdAt: new Date(),
          updatedAt: new Date(),
          respondedAt: status !== 'pending' ? new Date() : undefined,
        });
      }, 400);
    });
  },
};

// Thunk to fetch user's eligible swaps for proposing
export const fetchUserEligibleSwaps = createAsyncThunk(
  'proposals/fetchUserEligibleSwaps',
  async (
    { userId, targetSwapId }: { userId: string; targetSwapId: string },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;
      
      // Check cache validity
      const isCacheValid = state.eligibleSwaps.lastFetchTime[targetSwapId] &&
        Date.now() - state.eligibleSwaps.lastFetchTime[targetSwapId] < state.eligibleSwaps.cacheExpiry;
      
      if (isCacheValid && state.eligibleSwaps.eligibleSwapsByTarget[targetSwapId]) {
        dispatch(setCurrentTargetSwap(targetSwapId));
        return state.eligibleSwaps.eligibleSwapsByTarget[targetSwapId];
      }

      dispatch(startFetchingEligibleSwaps(targetSwapId));
      dispatch(setCurrentTargetSwap(targetSwapId));

      const response = await proposalAPI.getUserEligibleSwaps(userId, targetSwapId);
      
      dispatch(setEligibleSwaps({
        ...response,
        targetSwapId,
      }));
      
      dispatch(completeFetchingEligibleSwaps(targetSwapId));
      
      return response.eligibleSwaps;
    } catch (error) {
      dispatch(completeFetchingEligibleSwaps(targetSwapId));
      const message = error instanceof Error ? error.message : 'Failed to fetch eligible swaps';
      dispatch(setEligibleSwapsError(message));
      throw error;
    }
  }
);

// Thunk to get compatibility analysis between two swaps
export const fetchCompatibilityAnalysis = createAsyncThunk(
  'proposals/fetchCompatibilityAnalysis',
  async (
    { sourceSwapId, targetSwapId }: { sourceSwapId: string; targetSwapId: string },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      
      // Check cache validity
      const isCacheValid = state.compatibility.lastFetchTime[pairKey] &&
        Date.now() - state.compatibility.lastFetchTime[pairKey] < state.compatibility.cacheExpiry;
      
      if (isCacheValid && state.compatibility.analysesByPair[pairKey]) {
        dispatch(setCurrentSwapPair({ sourceSwapId, targetSwapId }));
        return state.compatibility.analysesByPair[pairKey];
      }

      dispatch(startAnalyzingPair(pairKey));
      dispatch(setCurrentSwapPair({ sourceSwapId, targetSwapId }));

      const response = await proposalAPI.getCompatibilityAnalysis(sourceSwapId, targetSwapId);
      
      dispatch(setCompatibilityAnalysis({
        sourceSwapId,
        targetSwapId,
        analysis: response.compatibility,
      }));
      
      dispatch(completeAnalyzingPair(pairKey));
      
      return response.compatibility;
    } catch (error) {
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      dispatch(completeAnalyzingPair(pairKey));
      const message = error instanceof Error ? error.message : 'Failed to fetch compatibility analysis';
      dispatch(setCompatibilityError(message));
      throw error;
    }
  }
);

// Thunk to create a proposal from browse page
export const createProposalFromBrowse = createAsyncThunk(
  'proposals/createProposalFromBrowse',
  async (request: CreateProposalFromBrowseRequest, { dispatch }) => {
    const proposalId = `temp-proposal-${Date.now()}`;
    
    try {
      dispatch(startProposalCreation(proposalId));
      dispatch(startProposalSubmission());

      // Validate the proposal first
      const validation = await proposalAPI.validateProposal(request);
      dispatch(setProposalValidation(validation));
      
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      const result = await proposalAPI.createProposalFromBrowse(request);
      
      dispatch(proposalSubmissionSuccess(result));
      dispatch(completeProposalCreation(proposalId));
      
      // Invalidate relevant caches
      dispatch(invalidateEligibleSwapsCache(request.targetSwapId));
      dispatch(invalidateProposalCache());
      
      return result;
    } catch (error) {
      dispatch(completeProposalCreation(proposalId));
      const message = error instanceof Error ? error.message : 'Failed to create proposal';
      dispatch(proposalSubmissionError(message));
      throw error;
    }
  }
);

// Thunk to fetch proposal history
export const fetchProposalHistory = createAsyncThunk(
  'proposals/fetchProposalHistory',
  async (
    { 
      userId, 
      filters 
    }: { 
      userId: string; 
      filters?: { status?: SwapProposalStatus; page?: number; limit?: number } 
    },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;
      
      // Check cache validity for first page with no filters
      if (!filters?.page && !filters?.status && state.proposals.lastFetchTime) {
        const cacheAge = Date.now() - state.proposals.lastFetchTime;
        if (cacheAge < state.proposals.cacheExpiry) {
          return state.proposals.proposalHistory;
        }
      }

      dispatch(setProposalLoading(true));

      const response = await proposalAPI.getProposalHistory(userId, filters);
      
      dispatch(setProposalHistory(response));
      
      return response.proposals;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch proposal history';
      dispatch(setProposalError(message));
      throw error;
    }
  }
);

// Thunk to update proposal status (accept, reject, etc.)
export const updateProposalStatus = createAsyncThunk(
  'proposals/updateProposalStatus',
  async (
    { proposalId, status }: { proposalId: string; status: SwapProposalStatus },
    { dispatch }
  ) => {
    try {
      dispatch(startProposalUpdate(proposalId));

      const updatedProposal = await proposalAPI.updateProposalStatus(proposalId, status);
      
      dispatch(updateProposal(updatedProposal));
      dispatch(completeProposalUpdate(proposalId));
      // Update timestamp is handled by the slice automatically
      
      return updatedProposal;
    } catch (error) {
      dispatch(completeProposalUpdate(proposalId));
      const message = error instanceof Error ? error.message : 'Failed to update proposal status';
      dispatch(setProposalError(message));
      throw error;
    }
  }
);

// Thunk to validate proposal before submission
export const validateProposalBeforeSubmission = createAsyncThunk(
  'proposals/validateProposal',
  async (request: CreateProposalFromBrowseRequest, { dispatch }) => {
    try {
      dispatch(setProposalLoading(true));

      const validation = await proposalAPI.validateProposal(request);
      
      dispatch(setProposalValidation(validation));
      dispatch(setProposalLoading(false));
      
      return validation;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate proposal';
      dispatch(setProposalError(message));
      throw error;
    }
  }
);

// Thunk to refresh eligible swaps for a target
export const refreshEligibleSwaps = createAsyncThunk(
  'proposals/refreshEligibleSwaps',
  async (
    { userId, targetSwapId }: { userId: string; targetSwapId: string },
    { dispatch }
  ) => {
    try {
      dispatch(invalidateEligibleSwapsCache(targetSwapId));
      return await dispatch(fetchUserEligibleSwaps({ userId, targetSwapId })).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Thunk to refresh compatibility analysis
export const refreshCompatibilityAnalysis = createAsyncThunk(
  'proposals/refreshCompatibilityAnalysis',
  async (
    { sourceSwapId, targetSwapId }: { sourceSwapId: string; targetSwapId: string },
    { dispatch }
  ) => {
    try {
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      dispatch(invalidateCompatibilityCache(pairKey));
      return await dispatch(fetchCompatibilityAnalysis({ sourceSwapId, targetSwapId })).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Thunk to batch analyze compatibility for multiple swap pairs
export const batchAnalyzeCompatibility = createAsyncThunk(
  'proposals/batchAnalyzeCompatibility',
  async (
    swapPairs: Array<{ sourceSwapId: string; targetSwapId: string }>,
    { dispatch }
  ) => {
    try {
      dispatch(startBatchAnalysis({ total: swapPairs.length }));
      
      const results: Record<string, any> = {};
      let completed = 0;
      
      for (const { sourceSwapId, targetSwapId } of swapPairs) {
        try {
          const pairKey = `${sourceSwapId}-${targetSwapId}`;
          const response = await proposalAPI.getCompatibilityAnalysis(sourceSwapId, targetSwapId);
          
          results[pairKey] = response.compatibility;
          completed++;
          
          dispatch(updateBatchAnalysisProgress({
            completed,
            pairKey,
            analysis: response.compatibility,
          }));
          
          // Store individual analysis
          dispatch(setCompatibilityAnalysis({
            sourceSwapId,
            targetSwapId,
            analysis: response.compatibility,
          }));
          
        } catch (error) {
          completed++;
          const pairKey = `${sourceSwapId}-${targetSwapId}`;
          const errorMessage = error instanceof Error ? error.message : 'Analysis failed';
          
          dispatch(updateBatchAnalysisProgress({
            completed,
            pairKey,
            error: errorMessage,
          }));
        }
      }
      
      dispatch(completeBatchAnalysis());
      
      return results;
    } catch (error) {
      dispatch(cancelBatchAnalysis());
      throw error;
    }
  }
);

// Thunk to refresh proposal data
export const refreshProposalData = createAsyncThunk(
  'proposals/refreshProposalData',
  async (userId: string, { dispatch }) => {
    try {
      dispatch(invalidateProposalCache());
      return await dispatch(fetchProposalHistory({ userId })).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Thunk to handle proposal workflow (open modal, fetch data, etc.)
export const initiateProposalWorkflow = createAsyncThunk(
  'proposals/initiateProposalWorkflow',
  async (
    { userId, targetSwapId }: { userId: string; targetSwapId: string },
    { dispatch }
  ) => {
    try {
      // Open the proposal modal
      dispatch(openProposalModal({ targetSwapId }));
      
      // Fetch eligible swaps
      const eligibleSwaps = await dispatch(fetchUserEligibleSwaps({ userId, targetSwapId })).unwrap();
      
      // If no eligible swaps, show appropriate message
      if (eligibleSwaps.length === 0) {
        dispatch(setProposalStep('error'));
        dispatch(setProposalError('You have no eligible swaps to propose for this listing.'));
        return;
      }
      
      // Set step to select swap
      dispatch(setProposalStep('select_swap'));
      
      return eligibleSwaps;
    } catch (error) {
      dispatch(setProposalStep('error'));
      const message = error instanceof Error ? error.message : 'Failed to initiate proposal workflow';
      dispatch(setProposalError(message));
      throw error;
    }
  }
);

// Thunk to handle swap selection in proposal workflow
export const selectSwapForProposal = createAsyncThunk(
  'proposals/selectSwapForProposal',
  async (
    { sourceSwapId, targetSwapId }: { sourceSwapId: string; targetSwapId: string },
    { dispatch }
  ) => {
    try {
      // Select the source swap
      dispatch(selectSourceSwap(sourceSwapId));
      
      // Fetch compatibility analysis
      const compatibility = await dispatch(fetchCompatibilityAnalysis({ sourceSwapId, targetSwapId })).unwrap();
      
      // Move to next step
      dispatch(setProposalStep('add_details'));
      
      return compatibility;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to analyze swap compatibility';
      dispatch(setProposalError(message));
      throw error;
    }
  }
);

// Thunk to monitor proposal status changes (for real-time updates)
export const monitorProposalStatus = createAsyncThunk(
  'proposals/monitorProposalStatus',
  async (proposalIds: string[], { dispatch }) => {
    const checkInterval = 30000; // 30 seconds
    
    const checkProposalStatuses = async () => {
      try {
        for (const proposalId of proposalIds) {
          // This would typically call a status check API
          // For now, we'll simulate random status changes
          if (Math.random() > 0.95) { // 5% chance of status change
            const newStatus = (['accepted', 'rejected'] as SwapProposalStatus[])[Math.floor(Math.random() * 2)];
            await dispatch(updateProposalStatus({ proposalId, status: newStatus }));
          }
        }
      } catch (error) {
        console.error('Error monitoring proposal statuses:', error);
      }
    };
    
    // Initial check
    await checkProposalStatuses();
    
    // Set up interval
    const intervalId = setInterval(checkProposalStatuses, checkInterval);
    
    return intervalId;
  }
);

// Thunk to cleanup proposal workflow
export const cleanupProposalWorkflow = createAsyncThunk(
  'proposals/cleanupProposalWorkflow',
  async (_, { dispatch }) => {
    dispatch(closeProposalModal());
    dispatch(setCurrentTargetSwap(null));
    dispatch(setCurrentSwapPair(null));
    return true;
  }
);