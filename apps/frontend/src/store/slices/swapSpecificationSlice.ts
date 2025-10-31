import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  Booking,
  SwapPreferencesData,
  AcceptanceStrategyType,
} from '@booking-swap/shared';
import { SwapSpecificationData } from '@booking-swap/shared';

interface SwapSpecificationState {
  // Current booking context for swap specification
  contextBooking: Booking | null;
  
  // Swap specification form data
  swapSpecificationData: SwapSpecificationData | null;
  
  // Form state
  hasUnsavedChanges: boolean;
  validationErrors: Record<string, string>;
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Existing swap information (if editing)
  existingSwap: {
    id: string;
    paymentTypes: ('booking' | 'cash')[];
    acceptanceStrategy: AcceptanceStrategyType;
    auctionEndDate?: Date;
    minCashAmount?: number;
    maxCashAmount?: number;
    swapConditions?: string[];
    hasActiveProposals: boolean;
    activeProposalCount: number;
  } | null;
  
  // Navigation state preservation
  navigationContext: {
    returnTo?: string;
    preservedSpecificationData?: SwapSpecificationData;
    sourceBookingId?: string;
  };
  
  // Wallet connection state for cash swaps
  walletConnection: {
    isConnected: boolean;
    address?: string;
    balance?: number;
    isConnecting: boolean;
    connectionError?: string;
  };
  
  // Preview and validation state
  previewData: {
    estimatedFees?: number;
    minimumCashRequired?: number;
    auctionDuration?: number;
    potentialReach?: number;
  } | null;
}

const initialState: SwapSpecificationState = {
  // Current booking context
  contextBooking: null,
  
  // Swap specification form data
  swapSpecificationData: null,
  
  // Form state
  hasUnsavedChanges: false,
  validationErrors: {},
  
  // UI state
  loading: false,
  error: null,
  
  // Existing swap information
  existingSwap: null,
  
  // Navigation state preservation
  navigationContext: {},
  
  // Wallet connection state
  walletConnection: {
    isConnected: false,
    isConnecting: false,
  },
  
  // Preview and validation state
  previewData: null,
};

export const swapSpecificationSlice = createSlice({
  name: 'swapSpecification',
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

    // Context booking management
    setContextBooking: (state, action: PayloadAction<Booking | null>) => {
      state.contextBooking = action.payload;
      
      // Initialize swap specification data with booking context only if none exists
      if (action.payload && !state.swapSpecificationData) {
        state.swapSpecificationData = {
          bookingId: action.payload.id,
          swapPreferences: {
            paymentTypes: ['booking'], // Default to booking exchange
            acceptanceStrategy: 'first_match',
            swapConditions: [],
          },
          swapEnabled: true,
        };
      }
    },

    // Swap specification form management
    initializeSwapSpecification: (state, action: PayloadAction<{ bookingId: string; existingPreferences?: SwapPreferencesData }>) => {
      const { bookingId, existingPreferences } = action.payload;
      
      state.swapSpecificationData = {
        bookingId,
        swapPreferences: existingPreferences || {
          paymentTypes: ['booking'],
          acceptanceStrategy: 'first_match',
          swapConditions: [],
        },
        swapEnabled: true,
      };
      state.hasUnsavedChanges = false;
      state.validationErrors = {};
    },
    
    updateSwapSpecificationData: (state, action: PayloadAction<Partial<SwapSpecificationData>>) => {
      if (state.swapSpecificationData) {
        state.swapSpecificationData = { ...state.swapSpecificationData, ...action.payload };
        state.hasUnsavedChanges = true;
      }
    },
    
    updateSwapPreferences: (state, action: PayloadAction<Partial<SwapPreferencesData>>) => {
      if (state.swapSpecificationData) {
        state.swapSpecificationData.swapPreferences = {
          ...state.swapSpecificationData.swapPreferences,
          ...action.payload,
        };
        state.hasUnsavedChanges = true;
      }
    },

    // Existing swap information management
    setExistingSwap: (state, action: PayloadAction<SwapSpecificationState['existingSwap']>) => {
      state.existingSwap = action.payload;
      
      // Update swap specification data with existing swap info
      if (action.payload && state.swapSpecificationData) {
        state.swapSpecificationData.swapPreferences = {
          paymentTypes: action.payload.paymentTypes,
          acceptanceStrategy: action.payload.acceptanceStrategy,
          auctionEndDate: action.payload.auctionEndDate,
          minCashAmount: action.payload.minCashAmount,
          maxCashAmount: action.payload.maxCashAmount,
          swapConditions: action.payload.swapConditions || [],
        };
        state.hasUnsavedChanges = false;
      }
    },
    
    updateExistingSwapProposalCount: (state, action: PayloadAction<number>) => {
      if (state.existingSwap) {
        state.existingSwap.activeProposalCount = action.payload;
        state.existingSwap.hasActiveProposals = action.payload > 0;
      }
    },

    // Validation management
    setValidationErrors: (state, action: PayloadAction<Record<string, string>>) => {
      state.validationErrors = action.payload;
    },
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
    addValidationError: (state, action: PayloadAction<{ field: string; error: string }>) => {
      state.validationErrors[action.payload.field] = action.payload.error;
    },
    removeValidationError: (state, action: PayloadAction<string>) => {
      delete state.validationErrors[action.payload];
    },

    // Form state management
    markFormSaved: (state) => {
      state.hasUnsavedChanges = false;
    },
    resetForm: (state) => {
      state.swapSpecificationData = null;
      state.hasUnsavedChanges = false;
      state.validationErrors = {};
      state.existingSwap = null;
      state.previewData = null;
    },

    // Navigation state preservation
    setNavigationContext: (state, action: PayloadAction<Partial<SwapSpecificationState['navigationContext']>>) => {
      state.navigationContext = { ...state.navigationContext, ...action.payload };
    },
    preserveSpecificationData: (state) => {
      if (state.swapSpecificationData) {
        state.navigationContext.preservedSpecificationData = { ...state.swapSpecificationData };
        state.navigationContext.sourceBookingId = state.contextBooking?.id;
      }
    },
    restoreSpecificationData: (state) => {
      if (state.navigationContext.preservedSpecificationData) {
        state.swapSpecificationData = { ...state.navigationContext.preservedSpecificationData };
        state.hasUnsavedChanges = true;
      }
    },
    clearNavigationContext: (state) => {
      state.navigationContext = {};
    },

    // Wallet connection management
    setWalletConnecting: (state, action: PayloadAction<boolean>) => {
      state.walletConnection.isConnecting = action.payload;
      if (action.payload) {
        state.walletConnection.connectionError = undefined;
      }
    },
    setWalletConnected: (state, action: PayloadAction<{ address: string; balance?: number }>) => {
      state.walletConnection.isConnected = true;
      state.walletConnection.address = action.payload.address;
      state.walletConnection.balance = action.payload.balance;
      state.walletConnection.isConnecting = false;
      state.walletConnection.connectionError = undefined;
    },
    setWalletDisconnected: (state) => {
      state.walletConnection.isConnected = false;
      state.walletConnection.address = undefined;
      state.walletConnection.balance = undefined;
      state.walletConnection.isConnecting = false;
      state.walletConnection.connectionError = undefined;
    },
    setWalletConnectionError: (state, action: PayloadAction<string>) => {
      state.walletConnection.connectionError = action.payload;
      state.walletConnection.isConnecting = false;
    },
    updateWalletBalance: (state, action: PayloadAction<number>) => {
      state.walletConnection.balance = action.payload;
    },

    // Preview and validation state
    setPreviewData: (state, action: PayloadAction<SwapSpecificationState['previewData']>) => {
      state.previewData = action.payload;
    },
    updatePreviewData: (state, action: PayloadAction<Partial<NonNullable<SwapSpecificationState['previewData']>>>) => {
      if (state.previewData) {
        state.previewData = { ...state.previewData, ...action.payload };
      } else {
        state.previewData = action.payload as SwapSpecificationState['previewData'];
      }
    },
    clearPreviewData: (state) => {
      state.previewData = null;
    },

    // Reset state
    resetSwapSpecificationState: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  // Loading and error states
  setLoading,
  setError,

  // Context booking management
  setContextBooking,

  // Swap specification form management
  initializeSwapSpecification,
  updateSwapSpecificationData,
  updateSwapPreferences,

  // Existing swap information management
  setExistingSwap,
  updateExistingSwapProposalCount,

  // Validation management
  setValidationErrors,
  clearValidationErrors,
  addValidationError,
  removeValidationError,

  // Form state management
  markFormSaved,
  resetForm,

  // Navigation state preservation
  setNavigationContext,
  preserveSpecificationData,
  restoreSpecificationData,
  clearNavigationContext,

  // Wallet connection management
  setWalletConnecting,
  setWalletConnected,
  setWalletDisconnected,
  setWalletConnectionError,
  updateWalletBalance,

  // Preview and validation state
  setPreviewData,
  updatePreviewData,
  clearPreviewData,

  // Reset state
  resetSwapSpecificationState,
} = swapSpecificationSlice.actions;

// Selectors
export const selectContextBooking = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.contextBooking;
export const selectSwapSpecificationData = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.swapSpecificationData;
export const selectSwapPreferences = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.swapSpecificationData?.swapPreferences;
export const selectHasUnsavedChanges = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.hasUnsavedChanges;
export const selectValidationErrors = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.validationErrors;
export const selectSwapSpecificationLoading = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.loading;
export const selectSwapSpecificationError = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.error;
export const selectExistingSwap = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.existingSwap;
export const selectNavigationContext = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.navigationContext;
export const selectWalletConnection = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.walletConnection;
export const selectPreviewData = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.previewData;

// Computed selectors
export const selectIsEditingExistingSwap = (state: { swapSpecification: SwapSpecificationState }) =>
  state.swapSpecification.existingSwap !== null;

export const selectCanNavigateAway = (state: { swapSpecification: SwapSpecificationState }) =>
  !state.swapSpecification.hasUnsavedChanges;

export const selectRequiresWalletConnection = (state: { swapSpecification: SwapSpecificationState }) => {
  const preferences = state.swapSpecification.swapSpecificationData?.swapPreferences;
  return preferences?.paymentTypes.includes('cash') && !state.swapSpecification.walletConnection.isConnected;
};

export const selectIsFormValid = (state: { swapSpecification: SwapSpecificationState }) => {
  const errors = state.swapSpecification.validationErrors;
  return Object.keys(errors).length === 0;
};

export const selectSwapSpecificationSummary = (state: { swapSpecification: SwapSpecificationState }) => {
  const data = state.swapSpecification.swapSpecificationData;
  const booking = state.swapSpecification.contextBooking;
  
  if (!data || !booking) return null;
  
  return {
    bookingTitle: booking.title,
    paymentTypes: data.swapPreferences.paymentTypes,
    acceptanceStrategy: data.swapPreferences.acceptanceStrategy,
    minCashAmount: data.swapPreferences.minCashAmount,
    auctionEndDate: data.swapPreferences.auctionEndDate,
    conditionsCount: data.swapPreferences.swapConditions?.length || 0,
    isEnabled: data.swapEnabled,
  };
};