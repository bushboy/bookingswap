import { createAsyncThunk } from '@reduxjs/toolkit';
import { SwapSpecificationData, SwapPreferencesData } from '@booking-swap/shared';
import { swapSpecificationService } from '../../services/swapSpecificationService';
import {
  setLoading,
  setError,
  setContextBooking,
  initializeSwapSpecification,
  updateSwapSpecificationData,
  setExistingSwap,
  updateExistingSwapProposalCount,
  markFormSaved,
  setValidationErrors,
  clearValidationErrors,
  setWalletConnecting,
  setWalletConnected,
  setWalletDisconnected,
  setWalletConnectionError,
  updateWalletBalance,
  setPreviewData,
  updatePreviewData,
} from '../slices/swapSpecificationSlice';
import { RootState } from '../index';
import { Booking } from '@booking-swap/shared';

// Initialize swap specification for a booking
export const initializeSwapSpecificationForBooking = createAsyncThunk(
  'swapSpecification/initializeForBooking',
  async (bookingId: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));

      // Fetch booking context
      const booking = await swapSpecificationService.getBooking(bookingId);
      dispatch(setContextBooking(booking));

      // Check if swap already exists
      const existingSwap = await swapSpecificationService.getExistingSwap(bookingId);
      
      if (existingSwap) {
        dispatch(setExistingSwap({
          id: existingSwap.id,
          paymentTypes: existingSwap.paymentTypes,
          acceptanceStrategy: existingSwap.acceptanceStrategy,
          auctionEndDate: existingSwap.auctionEndDate,
          minCashAmount: existingSwap.minCashAmount,
          maxCashAmount: existingSwap.maxCashAmount,
          swapConditions: existingSwap.swapConditions,
          hasActiveProposals: existingSwap.hasActiveProposals,
          activeProposalCount: existingSwap.activeProposalCount,
        }));

        // Initialize with existing preferences
        dispatch(initializeSwapSpecification({
          bookingId,
          existingPreferences: {
            paymentTypes: existingSwap.paymentTypes,
            acceptanceStrategy: existingSwap.acceptanceStrategy,
            auctionEndDate: existingSwap.auctionEndDate,
            minCashAmount: existingSwap.minCashAmount,
            maxCashAmount: existingSwap.maxCashAmount,
            swapConditions: existingSwap.swapConditions,
          },
        }));
      } else {
        // Initialize with default preferences
        dispatch(initializeSwapSpecification({ bookingId }));
      }

      dispatch(setLoading(false));
      return { booking, existingSwap };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initialize swap specification';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create new swap specification
export const createSwapSpecification = createAsyncThunk(
  'swapSpecification/createSwap',
  async (swapData: SwapSpecificationData, { dispatch, getState }) => {
    try {
      dispatch(setLoading(true));
      dispatch(clearValidationErrors());

      const state = getState() as RootState;
      const contextBooking = state.swapSpecification.contextBooking;

      if (!contextBooking) {
        throw new Error('No booking context available');
      }

      // Validate swap specification data
      const validationResult = await swapSpecificationService.validateSwapSpecification(swapData);
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
        throw new Error('Validation failed');
      }

      // Check wallet connection if cash payment is enabled
      if (swapData.swapPreferences.paymentTypes.includes('cash')) {
        const walletState = state.swapSpecification.walletConnection;
        if (!walletState.isConnected) {
          throw new Error('Wallet connection required for cash payments');
        }
      }

      const createdSwap = await swapSpecificationService.createSwapSpecification(swapData);
      
      dispatch(setExistingSwap({
        id: createdSwap.id,
        paymentTypes: createdSwap.paymentTypes,
        acceptanceStrategy: createdSwap.acceptanceStrategy,
        auctionEndDate: createdSwap.auctionEndDate,
        minCashAmount: createdSwap.minCashAmount,
        maxCashAmount: createdSwap.maxCashAmount,
        swapConditions: createdSwap.swapConditions,
        hasActiveProposals: true,
        activeProposalCount: 0,
      }));

      dispatch(markFormSaved());
      dispatch(setLoading(false));
      return createdSwap;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create swap specification';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Update existing swap specification
export const updateSwapSpecification = createAsyncThunk(
  'swapSpecification/updateSwap',
  async (
    { swapId, swapData }: { swapId: string; swapData: SwapSpecificationData },
    { dispatch, getState }
  ) => {
    try {
      dispatch(setLoading(true));
      dispatch(clearValidationErrors());

      const state = getState() as RootState;

      // Validate swap specification data
      const validationResult = await swapSpecificationService.validateSwapSpecification(swapData);
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
        throw new Error('Validation failed');
      }

      // Check wallet connection if cash payment is enabled
      if (swapData.swapPreferences.paymentTypes.includes('cash')) {
        const walletState = state.swapSpecification.walletConnection;
        if (!walletState.isConnected) {
          throw new Error('Wallet connection required for cash payments');
        }
      }

      const updatedSwap = await swapSpecificationService.updateSwapSpecification(swapId, swapData);
      
      dispatch(setExistingSwap({
        id: updatedSwap.id,
        paymentTypes: updatedSwap.paymentTypes,
        acceptanceStrategy: updatedSwap.acceptanceStrategy,
        auctionEndDate: updatedSwap.auctionEndDate,
        minCashAmount: updatedSwap.minCashAmount,
        maxCashAmount: updatedSwap.maxCashAmount,
        swapConditions: updatedSwap.swapConditions,
        hasActiveProposals: updatedSwap.hasActiveProposals,
        activeProposalCount: updatedSwap.activeProposalCount,
      }));

      dispatch(markFormSaved());
      dispatch(setLoading(false));
      return updatedSwap;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update swap specification';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Cancel/disable swap specification
export const cancelSwapSpecification = createAsyncThunk(
  'swapSpecification/cancelSwap',
  async (swapId: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      await swapSpecificationService.cancelSwapSpecification(swapId);
      dispatch(setExistingSwap(null));
      dispatch(setLoading(false));
      return swapId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to cancel swap specification';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Validate swap specification data without saving
export const validateSwapSpecificationData = createAsyncThunk(
  'swapSpecification/validateData',
  async (swapData: SwapSpecificationData, { dispatch }) => {
    try {
      const validationResult = await swapSpecificationService.validateSwapSpecification(swapData);
      
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
      } else {
        dispatch(clearValidationErrors());
      }
      
      return validationResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to validate swap specification';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Connect wallet for cash payments
export const connectWallet = createAsyncThunk(
  'swapSpecification/connectWallet',
  async (_, { dispatch }) => {
    try {
      dispatch(setWalletConnecting(true));
      
      const walletConnection = await swapSpecificationService.connectWallet();
      
      dispatch(setWalletConnected({
        address: walletConnection.address,
        balance: walletConnection.balance,
      }));
      
      return walletConnection;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to connect wallet';
      dispatch(setWalletConnectionError(message));
      throw error;
    }
  }
);

// Disconnect wallet
export const disconnectWallet = createAsyncThunk(
  'swapSpecification/disconnectWallet',
  async (_, { dispatch }) => {
    try {
      await swapSpecificationService.disconnectWallet();
      dispatch(setWalletDisconnected());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to disconnect wallet';
      dispatch(setWalletConnectionError(message));
      throw error;
    }
  }
);

// Refresh wallet balance
export const refreshWalletBalance = createAsyncThunk(
  'swapSpecification/refreshWalletBalance',
  async (_, { dispatch, getState }) => {
    try {
      const state = getState() as RootState;
      const walletAddress = state.swapSpecification.walletConnection.address;
      
      if (!walletAddress) {
        throw new Error('No wallet connected');
      }
      
      const balance = await swapSpecificationService.getWalletBalance(walletAddress);
      dispatch(updateWalletBalance(balance));
      return balance;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to refresh wallet balance';
      dispatch(setWalletConnectionError(message));
      throw error;
    }
  }
);

// Generate swap specification preview
export const generateSwapPreview = createAsyncThunk(
  'swapSpecification/generatePreview',
  async (swapData: SwapSpecificationData, { dispatch }) => {
    try {
      const previewData = await swapSpecificationService.generateSwapPreview(swapData);
      
      dispatch(setPreviewData({
        estimatedFees: previewData.estimatedFees,
        minimumCashRequired: previewData.minimumCashRequired,
        auctionDuration: previewData.auctionDuration,
        potentialReach: previewData.potentialReach,
      }));
      
      return previewData;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate swap preview';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Refresh swap proposal count
export const refreshSwapProposalCount = createAsyncThunk(
  'swapSpecification/refreshProposalCount',
  async (swapId: string, { dispatch }) => {
    try {
      const proposalCount = await swapSpecificationService.getSwapProposalCount(swapId);
      dispatch(updateExistingSwapProposalCount(proposalCount));
      return proposalCount;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to refresh proposal count';
      console.warn(message);
      throw error;
    }
  }
);

// Check swap specification permissions
export const checkSwapSpecificationPermissions = createAsyncThunk(
  'swapSpecification/checkPermissions',
  async ({ bookingId, userId }: { bookingId: string; userId: string }) => {
    try {
      const permissions = await swapSpecificationService.checkSwapPermissions(bookingId, userId);
      return { bookingId, permissions };
    } catch (error) {
      throw error;
    }
  }
);

// Auto-save swap specification data (for unsaved changes preservation)
export const autoSaveSwapSpecification = createAsyncThunk(
  'swapSpecification/autoSaveData',
  async (
    { swapId, swapData }: { swapId?: string; swapData: SwapSpecificationData },
    { dispatch }
  ) => {
    try {
      // This is a background operation, don't show loading state
      if (swapId) {
        const updatedSwap = await swapSpecificationService.updateSwapSpecification(swapId, swapData);
        dispatch(markFormSaved());
        return updatedSwap;
      } else {
        // Save as draft
        const draftSwap = await swapSpecificationService.saveDraftSwapSpecification(swapData);
        return draftSwap;
      }
    } catch (error) {
      // Auto-save failures should not show error to user
      console.warn('Auto-save failed:', error);
      throw error;
    }
  }
);

// Load draft swap specification
export const loadDraftSwapSpecification = createAsyncThunk(
  'swapSpecification/loadDraft',
  async (bookingId: string, { dispatch }) => {
    try {
      const draftData = await swapSpecificationService.getDraftSwapSpecification(bookingId);
      
      if (draftData) {
        dispatch(updateSwapSpecificationData(draftData));
      }
      
      return draftData;
    } catch (error) {
      // Draft loading failures should not show error to user
      console.warn('Failed to load draft:', error);
      return null;
    }
  }
);

// Clear draft swap specification
export const clearDraftSwapSpecification = createAsyncThunk(
  'swapSpecification/clearDraft',
  async (bookingId: string) => {
    try {
      await swapSpecificationService.clearDraftSwapSpecification(bookingId);
      return bookingId;
    } catch (error) {
      console.warn('Failed to clear draft:', error);
      throw error;
    }
  }
);