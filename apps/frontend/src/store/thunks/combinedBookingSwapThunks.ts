import { createAsyncThunk } from '@reduxjs/toolkit';
import { BookingEditData, SwapSpecificationData } from '@booking-swap/shared';
import { BookingWithSwapUpdate } from '@booking-swap/shared';
import { combinedBookingSwapService } from '../../services/combinedBookingSwapService';
import { RootState } from '../index';

// Import actions from both slices
import {
  setLoading as setBookingEditLoading,
  setError as setBookingEditError,
  updateBooking,
  markFormSaved as markBookingFormSaved,
} from '../slices/bookingEditSlice';

import {
  setLoading as setSwapSpecificationLoading,
  setError as setSwapSpecificationError,
  setExistingSwap,
  markFormSaved as markSwapFormSaved,
} from '../slices/swapSpecificationSlice';

// Combined operation: Update booking and create/update swap in a single transaction
export const updateBookingWithSwapSpecification = createAsyncThunk(
  'combined/updateBookingWithSwap',
  async (
    {
      bookingId,
      bookingData,
      swapData,
      createSwapIfNotExists = true,
    }: {
      bookingId: string;
      bookingData: BookingEditData;
      swapData?: SwapSpecificationData;
      createSwapIfNotExists?: boolean;
    },
    { dispatch, getState }
  ) => {
    try {
      // Set loading state for both slices
      dispatch(setBookingEditLoading(true));
      if (swapData) {
        dispatch(setSwapSpecificationLoading(true));
      }

      const state = getState() as RootState;
      const existingSwap = state.swapSpecification.existingSwap;

      // Prepare combined update request
      const updateRequest: BookingWithSwapUpdate = {
        bookingData,
        swapData: swapData ? {
          ...swapData,
          swapId: existingSwap?.id,
          createIfNotExists: createSwapIfNotExists,
        } : undefined,
      };

      // Perform combined update
      const result = await combinedBookingSwapService.updateBookingWithSwap(
        bookingId,
        updateRequest
      );

      // Update booking state
      dispatch(updateBooking(result.booking));
      dispatch(markBookingFormSaved());

      // Update swap state if swap was involved
      if (result.swap && swapData) {
        dispatch(setExistingSwap({
          id: result.swap.id,
          paymentTypes: result.swap.paymentTypes,
          acceptanceStrategy: result.swap.acceptanceStrategy,
          auctionEndDate: result.swap.auctionEndDate,
          minCashAmount: result.swap.minCashAmount,
          maxCashAmount: result.swap.maxCashAmount,
          swapConditions: result.swap.swapConditions || [],
          hasActiveProposals: result.swap.hasActiveProposals,
          activeProposalCount: result.swap.activeProposalCount,
        }));
        dispatch(markSwapFormSaved());
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update booking and swap';
      
      dispatch(setBookingEditError(message));
      if (swapData) {
        dispatch(setSwapSpecificationError(message));
      }
      
      throw error;
    }
  }
);

// Combined operation: Create booking with optional swap specification
export const createBookingWithSwapSpecification = createAsyncThunk(
  'combined/createBookingWithSwap',
  async (
    {
      bookingData,
      swapData,
    }: {
      bookingData: BookingEditData;
      swapData?: SwapSpecificationData;
    },
    { dispatch }
  ) => {
    try {
      // Set loading state for both slices
      dispatch(setBookingEditLoading(true));
      if (swapData) {
        dispatch(setSwapSpecificationLoading(true));
      }

      // Prepare combined creation request
      const createRequest: BookingWithSwapUpdate = {
        bookingData,
        swapData,
      };

      // Perform combined creation
      const result = await combinedBookingSwapService.createBookingWithSwap(createRequest);

      // Update booking state
      dispatch(updateBooking(result.booking));
      dispatch(markBookingFormSaved());

      // Update swap state if swap was created
      if (result.swap && swapData) {
        dispatch(setExistingSwap({
          id: result.swap.id,
          paymentTypes: result.swap.paymentTypes,
          acceptanceStrategy: result.swap.acceptanceStrategy,
          auctionEndDate: result.swap.auctionEndDate,
          minCashAmount: result.swap.minCashAmount,
          maxCashAmount: result.swap.maxCashAmount,
          swapConditions: result.swap.swapConditions || [],
          hasActiveProposals: result.swap.hasActiveProposals,
          activeProposalCount: result.swap.activeProposalCount,
        }));
        dispatch(markSwapFormSaved());
      }

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create booking and swap';
      
      dispatch(setBookingEditError(message));
      if (swapData) {
        dispatch(setSwapSpecificationError(message));
      }
      
      throw error;
    }
  }
);

// Combined validation: Validate both booking and swap data together
export const validateBookingWithSwapSpecification = createAsyncThunk(
  'combined/validateBookingWithSwap',
  async (
    {
      bookingData,
      swapData,
    }: {
      bookingData: BookingEditData;
      swapData?: SwapSpecificationData;
    },
    { dispatch }
  ) => {
    try {
      const validationRequest: BookingWithSwapUpdate = {
        bookingData,
        swapData,
      };

      const validationResult = await combinedBookingSwapService.validateBookingWithSwap(
        validationRequest
      );

      // Handle validation errors for booking
      if (validationResult.bookingErrors && Object.keys(validationResult.bookingErrors).length > 0) {
        dispatch(setBookingEditError('Booking validation failed'));
      }

      // Handle validation errors for swap
      if (validationResult.swapErrors && Object.keys(validationResult.swapErrors).length > 0) {
        dispatch(setSwapSpecificationError('Swap specification validation failed'));
      }

      return validationResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to validate booking and swap';
      
      dispatch(setBookingEditError(message));
      if (swapData) {
        dispatch(setSwapSpecificationError(message));
      }
      
      throw error;
    }
  }
);

// State synchronization: Ensure booking and swap states are consistent
export const synchronizeBookingSwapState = createAsyncThunk(
  'combined/synchronizeState',
  async (bookingId: string, { dispatch }) => {
    try {
      const syncResult = await combinedBookingSwapService.synchronizeBookingSwapState(bookingId);

      // Update booking state
      if (syncResult.booking) {
        dispatch(updateBooking(syncResult.booking));
      }

      // Update swap state
      if (syncResult.swap) {
        dispatch(setExistingSwap({
          id: syncResult.swap.id,
          paymentTypes: syncResult.swap.paymentTypes,
          acceptanceStrategy: syncResult.swap.acceptanceStrategy,
          auctionEndDate: syncResult.swap.auctionEndDate,
          minCashAmount: syncResult.swap.minCashAmount,
          maxCashAmount: syncResult.swap.maxCashAmount,
          swapConditions: syncResult.swap.swapConditions || [],
          hasActiveProposals: syncResult.swap.hasActiveProposals,
          activeProposalCount: syncResult.swap.activeProposalCount,
        }));
      }

      return syncResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to synchronize booking and swap state';
      
      dispatch(setBookingEditError(message));
      dispatch(setSwapSpecificationError(message));
      
      throw error;
    }
  }
);

// Navigation state preservation: Save state when navigating between interfaces
export const preserveNavigationState = createAsyncThunk(
  'combined/preserveNavigationState',
  async (
    {
      bookingId,
      returnTo,
      preserveBookingData,
      preserveSwapData,
    }: {
      bookingId: string;
      returnTo: string;
      preserveBookingData?: boolean;
      preserveSwapData?: boolean;
    },
    { dispatch, getState }
  ) => {
    try {
      const state = getState() as RootState;

      // Preserve booking edit state if requested
      if (preserveBookingData && state.bookingEdit.hasUnsavedChanges) {
        // This would typically save to localStorage or session storage
        await combinedBookingSwapService.preserveBookingEditState(
          bookingId,
          state.bookingEdit.editFormData,
          returnTo
        );
      }

      // Preserve swap specification state if requested
      if (preserveSwapData && state.swapSpecification.hasUnsavedChanges) {
        await combinedBookingSwapService.preserveSwapSpecificationState(
          bookingId,
          state.swapSpecification.swapSpecificationData,
          returnTo
        );
      }

      return { bookingId, returnTo };
    } catch (error) {
      console.warn('Failed to preserve navigation state:', error);
      // Don't throw error as this is not critical
      return { bookingId, returnTo };
    }
  }
);

// Navigation state restoration: Restore state when returning to interfaces
export const restoreNavigationState = createAsyncThunk(
  'combined/restoreNavigationState',
  async (
    {
      bookingId,
      restoreBookingData,
      restoreSwapData,
    }: {
      bookingId: string;
      restoreBookingData?: boolean;
      restoreSwapData?: boolean;
    },
    { dispatch }
  ) => {
    try {
      let restoredBookingData = null;
      let restoredSwapData = null;

      // Restore booking edit state if requested
      if (restoreBookingData) {
        restoredBookingData = await combinedBookingSwapService.restoreBookingEditState(bookingId);
      }

      // Restore swap specification state if requested
      if (restoreSwapData) {
        restoredSwapData = await combinedBookingSwapService.restoreSwapSpecificationState(bookingId);
      }

      return {
        bookingId,
        restoredBookingData,
        restoredSwapData,
      };
    } catch (error) {
      console.warn('Failed to restore navigation state:', error);
      // Don't throw error as this is not critical
      return {
        bookingId,
        restoredBookingData: null,
        restoredSwapData: null,
      };
    }
  }
);

// Clear navigation state: Clean up preserved state
export const clearNavigationState = createAsyncThunk(
  'combined/clearNavigationState',
  async (bookingId: string) => {
    try {
      await combinedBookingSwapService.clearPreservedState(bookingId);
      return bookingId;
    } catch (error) {
      console.warn('Failed to clear navigation state:', error);
      return bookingId;
    }
  }
);