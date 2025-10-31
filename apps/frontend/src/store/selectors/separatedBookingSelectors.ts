import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { 
  selectBookings as selectBookingEditBookings,
  selectEditingBooking,
  selectEditFormData,
  selectHasUnsavedChanges as selectBookingHasUnsavedChanges,
  selectValidationErrors as selectBookingValidationErrors,
} from '../slices/bookingEditSlice';
import {
  selectContextBooking,
  selectSwapSpecificationData,
  selectExistingSwap,
  selectHasUnsavedChanges as selectSwapHasUnsavedChanges,
  selectValidationErrors as selectSwapValidationErrors,
  selectWalletConnection,
} from '../slices/swapSpecificationSlice';

// Combined selectors that work across both booking edit and swap specification slices

// Select the current booking being worked on (either editing or specifying swap)
export const selectCurrentWorkingBooking = createSelector(
  [selectEditingBooking, selectContextBooking],
  (editingBooking, contextBooking) => {
    return editingBooking || contextBooking;
  }
);

// Select if there are any unsaved changes across both interfaces
export const selectHasAnyUnsavedChanges = createSelector(
  [selectBookingHasUnsavedChanges, selectSwapHasUnsavedChanges],
  (bookingUnsaved, swapUnsaved) => {
    return bookingUnsaved || swapUnsaved;
  }
);

// Select all validation errors across both interfaces
export const selectAllValidationErrors = createSelector(
  [selectBookingValidationErrors, selectSwapValidationErrors],
  (bookingErrors, swapErrors) => {
    return {
      booking: bookingErrors,
      swap: swapErrors,
      hasAnyErrors: Object.keys(bookingErrors).length > 0 || Object.keys(swapErrors).length > 0,
    };
  }
);

// Select booking with its associated swap information
export const selectBookingWithSwapInfo = createSelector(
  [
    (state: RootState, bookingId: string) => 
      selectBookingEditBookings(state).find(b => b.id === bookingId),
    (state: RootState, bookingId: string) => {
      const contextBooking = selectContextBooking(state);
      const existingSwap = selectExistingSwap(state);
      return contextBooking?.id === bookingId ? existingSwap : null;
    }
  ],
  (booking, swapInfo) => {
    if (!booking) return null;
    
    return {
      ...booking,
      swapInfo: swapInfo ? {
        swapId: swapInfo.id,
        paymentTypes: swapInfo.paymentTypes,
        acceptanceStrategy: swapInfo.acceptanceStrategy,
        auctionEndDate: swapInfo.auctionEndDate,
        minCashAmount: swapInfo.minCashAmount,
        maxCashAmount: swapInfo.maxCashAmount,
        hasActiveProposals: swapInfo.hasActiveProposals,
        activeProposalCount: swapInfo.activeProposalCount,
        userProposalStatus: 'none' as const,
        swapConditions: swapInfo.swapConditions,
      } : undefined,
    };
  }
);

// Select if the current booking can be navigated away from
export const selectCanNavigateAwayFromBooking = createSelector(
  [selectBookingHasUnsavedChanges],
  (hasUnsavedChanges) => {
    return !hasUnsavedChanges;
  }
);

// Select if the current swap specification can be navigated away from
export const selectCanNavigateAwayFromSwap = createSelector(
  [selectSwapHasUnsavedChanges],
  (hasUnsavedChanges) => {
    return !hasUnsavedChanges;
  }
);

// Select if wallet is required and connected for current swap specification
export const selectWalletRequirementStatus = createSelector(
  [selectSwapSpecificationData, selectWalletConnection],
  (swapData, walletConnection) => {
    const requiresWallet = swapData?.swapPreferences.paymentTypes.includes('cash') || false;
    
    return {
      requiresWallet,
      isConnected: walletConnection.isConnected,
      isConnecting: walletConnection.isConnecting,
      address: walletConnection.address,
      balance: walletConnection.balance,
      connectionError: walletConnection.connectionError,
      canProceed: !requiresWallet || walletConnection.isConnected,
    };
  }
);

// Select the current editing context (booking edit, swap specification, or both)
export const selectCurrentEditingContext = createSelector(
  [selectEditingBooking, selectContextBooking, selectSwapSpecificationData],
  (editingBooking, contextBooking, swapData) => {
    const hasBookingEdit = editingBooking !== null;
    const hasSwapSpecification = contextBooking !== null && swapData !== null;
    
    return {
      hasBookingEdit,
      hasSwapSpecification,
      bookingId: editingBooking?.id || contextBooking?.id,
      context: hasBookingEdit && hasSwapSpecification ? 'both' : 
               hasBookingEdit ? 'booking' : 
               hasSwapSpecification ? 'swap' : 'none',
    };
  }
);

// Select form completion status across both interfaces
export const selectFormCompletionStatus = createSelector(
  [
    selectEditFormData,
    selectSwapSpecificationData,
    selectBookingValidationErrors,
    selectSwapValidationErrors,
  ],
  (bookingFormData, swapFormData, bookingErrors, swapErrors) => {
    const bookingComplete = bookingFormData !== null && Object.keys(bookingErrors).length === 0;
    const swapComplete = swapFormData === null || 
      (swapFormData.swapEnabled && Object.keys(swapErrors).length === 0) ||
      !swapFormData.swapEnabled;
    
    return {
      bookingComplete,
      swapComplete,
      overallComplete: bookingComplete && swapComplete,
      bookingFormData,
      swapFormData,
    };
  }
);

// Select navigation readiness (can navigate between interfaces)
export const selectNavigationReadiness = createSelector(
  [
    selectHasAnyUnsavedChanges,
    selectAllValidationErrors,
    selectWalletRequirementStatus,
  ],
  (hasUnsavedChanges, validationErrors, walletStatus) => {
    return {
      hasUnsavedChanges,
      hasValidationErrors: validationErrors.hasAnyErrors,
      walletReady: walletStatus.canProceed,
      canNavigate: !hasUnsavedChanges && !validationErrors.hasAnyErrors,
      requiresUserConfirmation: hasUnsavedChanges,
      blockingIssues: [
        ...(validationErrors.hasAnyErrors ? ['validation_errors'] : []),
        ...(!walletStatus.canProceed ? ['wallet_required'] : []),
      ],
    };
  }
);

// Select summary information for the current booking and swap work
export const selectWorkingSummary = createSelector(
  [
    selectCurrentWorkingBooking,
    selectSwapSpecificationData,
    selectExistingSwap,
    selectHasAnyUnsavedChanges,
  ],
  (workingBooking, swapData, existingSwap, hasUnsavedChanges) => {
    if (!workingBooking) return null;
    
    return {
      booking: {
        id: workingBooking.id,
        title: workingBooking.title,
        type: workingBooking.type,
        status: workingBooking.status,
      },
      swap: swapData ? {
        enabled: swapData.swapEnabled,
        paymentTypes: swapData.swapPreferences.paymentTypes,
        acceptanceStrategy: swapData.swapPreferences.acceptanceStrategy,
        hasExisting: existingSwap !== null,
        proposalCount: existingSwap?.activeProposalCount || 0,
      } : null,
      hasUnsavedChanges,
      lastModified: Date.now(), // This would ideally come from the actual last modification time
    };
  }
);