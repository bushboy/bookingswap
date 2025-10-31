import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  Booking, 
  BookingStatus, 
  BookingType,
} from '@booking-swap/shared';
import { BookingEditData } from '@booking-swap/shared';
import {
  BookingFilters,
  BookingSearchResult,
} from '../../services/bookingService';

interface BookingEditState {
  // Core booking data (no swap information)
  bookings: Booking[];
  currentBooking: Booking | null;
  searchResults: BookingSearchResult | null;
  availableBookings: Booking[];

  // UI state
  loading: boolean;
  error: string | null;

  // Pure booking filters (no swap-specific options)
  filters: BookingFilters;
  searchQuery: string;

  // Pagination
  currentPage: number;
  totalPages: number;

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 5 minutes default

  // Form state for booking editing
  editingBooking: Booking | null;
  editFormData: BookingEditData | null;
  hasUnsavedChanges: boolean;
  validationErrors: Record<string, string>;

  // Navigation state preservation
  navigationContext: {
    returnTo?: string;
    preservedFormData?: BookingEditData;
    lastEditedBookingId?: string;
  };
}

const initialState: BookingEditState = {
  // Core data
  bookings: [],
  currentBooking: null,
  searchResults: null,
  availableBookings: [],

  // UI state
  loading: false,
  error: null,

  // Pure booking filters
  filters: {},
  searchQuery: '',

  // Pagination
  currentPage: 1,
  totalPages: 1,

  // Cache management
  lastFetchTime: null,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes

  // Form state
  editingBooking: null,
  editFormData: null,
  hasUnsavedChanges: false,
  validationErrors: {},

  // Navigation state preservation
  navigationContext: {},
};

export const bookingEditSlice = createSlice({
  name: 'bookingEdit',
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

    // Core data management (pure booking data)
    setBookings: (state, action: PayloadAction<Booking[]>) => {
      state.bookings = action.payload;
      state.lastFetchTime = Date.now();
      state.loading = false;
      state.error = null;
    },
    setCurrentBooking: (state, action: PayloadAction<Booking | null>) => {
      state.currentBooking = action.payload;
    },
    setSearchResults: (state, action: PayloadAction<BookingSearchResult>) => {
      state.searchResults = action.payload;
      state.currentPage = action.payload.page;
      state.totalPages = action.payload.totalPages;
      state.loading = false;
      state.error = null;
    },
    setAvailableBookings: (state, action: PayloadAction<Booking[]>) => {
      state.availableBookings = action.payload;
    },

    // CRUD operations
    addBooking: (state, action: PayloadAction<Booking>) => {
      state.bookings.unshift(action.payload); // Add to beginning
      // Also add to available bookings if status is available
      if (action.payload.status === 'available') {
        state.availableBookings.unshift(action.payload);
      }
    },
    updateBooking: (state, action: PayloadAction<Booking>) => {
      const booking = action.payload;

      // Update in main bookings array
      const index = state.bookings.findIndex(b => b.id === booking.id);
      if (index !== -1) {
        state.bookings[index] = booking;
      }

      // Update in available bookings array
      const availableIndex = state.availableBookings.findIndex(
        b => b.id === booking.id
      );
      if (booking.status === 'available') {
        if (availableIndex !== -1) {
          state.availableBookings[availableIndex] = booking;
        } else {
          state.availableBookings.push(booking);
        }
      } else if (availableIndex !== -1) {
        state.availableBookings.splice(availableIndex, 1);
      }

      // Update current booking if it's the same
      if (state.currentBooking?.id === booking.id) {
        state.currentBooking = booking;
      }

      // Update editing booking if it's the same
      if (state.editingBooking?.id === booking.id) {
        state.editingBooking = booking;
      }
    },
    removeBooking: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;

      // Remove from all arrays
      state.bookings = state.bookings.filter(b => b.id !== bookingId);
      state.availableBookings = state.availableBookings.filter(
        b => b.id !== bookingId
      );

      // Clear current booking if it's the removed one
      if (state.currentBooking?.id === bookingId) {
        state.currentBooking = null;
      }

      // Clear editing booking if it's the removed one
      if (state.editingBooking?.id === bookingId) {
        state.editingBooking = null;
        state.editFormData = null;
        state.hasUnsavedChanges = false;
      }
    },

    // Batch operations
    updateMultipleBookings: (state, action: PayloadAction<Booking[]>) => {
      action.payload.forEach(booking => {
        const index = state.bookings.findIndex(b => b.id === booking.id);
        if (index !== -1) {
          state.bookings[index] = booking;
        }
      });
    },

    // Pure booking filter and search management
    setFilters: (state, action: PayloadAction<Partial<BookingFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
      // Reset pagination when filters change
      state.currentPage = 1;
    },
    clearFilters: state => {
      state.filters = {};
      state.currentPage = 1;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
      state.currentPage = 1;
    },

    // Pagination
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },

    // Form state management
    startEditingBooking: (state, action: PayloadAction<Booking>) => {
      const booking = action.payload;
      state.editingBooking = booking;
      state.editFormData = {
        type: booking.type,
        title: booking.title,
        description: booking.description,
        location: booking.location,
        dateRange: booking.dateRange,
        originalPrice: booking.originalPrice,
        swapValue: booking.swapValue,
        providerDetails: booking.providerDetails,
      };
      state.hasUnsavedChanges = false;
      state.validationErrors = {};
    },
    updateEditFormData: (state, action: PayloadAction<Partial<BookingEditData>>) => {
      if (state.editFormData) {
        state.editFormData = { ...state.editFormData, ...action.payload };
        state.hasUnsavedChanges = true;
      }
    },
    setValidationErrors: (state, action: PayloadAction<Record<string, string>>) => {
      state.validationErrors = action.payload;
    },
    clearValidationErrors: (state) => {
      state.validationErrors = {};
    },
    markFormSaved: (state) => {
      state.hasUnsavedChanges = false;
    },
    cancelEditing: (state) => {
      state.editingBooking = null;
      state.editFormData = null;
      state.hasUnsavedChanges = false;
      state.validationErrors = {};
    },

    // Navigation state preservation
    setNavigationContext: (state, action: PayloadAction<Partial<BookingEditState['navigationContext']>>) => {
      state.navigationContext = { ...state.navigationContext, ...action.payload };
    },
    preserveFormData: (state) => {
      if (state.editFormData) {
        state.navigationContext.preservedFormData = { ...state.editFormData };
        state.navigationContext.lastEditedBookingId = state.editingBooking?.id;
      }
    },
    restoreFormData: (state) => {
      if (state.navigationContext.preservedFormData && state.navigationContext.lastEditedBookingId) {
        const booking = state.bookings.find(b => b.id === state.navigationContext.lastEditedBookingId);
        if (booking) {
          state.editingBooking = booking;
          state.editFormData = { ...state.navigationContext.preservedFormData };
          state.hasUnsavedChanges = true;
        }
      }
    },
    clearNavigationContext: (state) => {
      state.navigationContext = {};
    },

    // Cache management
    invalidateCache: state => {
      state.lastFetchTime = null;
    },

    // Reset state
    resetBookingEditState: state => {
      Object.assign(state, initialState);
    },

    // Optimistic updates for better UX
    optimisticUpdateBookingStatus: (
      state,
      action: PayloadAction<{ id: string; status: BookingStatus }>
    ) => {
      const { id, status } = action.payload;
      const booking = state.bookings.find(b => b.id === id);
      if (booking) {
        booking.status = status;
      }
    },
  },
});

export const {
  // Loading and error states
  setLoading,
  setError,

  // Core data management
  setBookings,
  setCurrentBooking,
  setSearchResults,
  setAvailableBookings,

  // CRUD operations
  addBooking,
  updateBooking,
  removeBooking,
  updateMultipleBookings,

  // Pure booking filter and search management
  setFilters,
  clearFilters,
  setSearchQuery,

  // Pagination
  setCurrentPage,

  // Form state management
  startEditingBooking,
  updateEditFormData,
  setValidationErrors,
  clearValidationErrors,
  markFormSaved,
  cancelEditing,

  // Navigation state preservation
  setNavigationContext,
  preserveFormData,
  restoreFormData,
  clearNavigationContext,

  // Cache management
  invalidateCache,

  // Reset state
  resetBookingEditState,

  // Optimistic updates
  optimisticUpdateBookingStatus,
} = bookingEditSlice.actions;

// Selectors
export const selectBookings = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.bookings;
export const selectCurrentBooking = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.currentBooking;
export const selectSearchResults = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.searchResults;
export const selectAvailableBookings = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.availableBookings;
export const selectBookingEditLoading = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.loading;
export const selectBookingEditError = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.error;
export const selectBookingEditFilters = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.filters;
export const selectSearchQuery = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.searchQuery;
export const selectCurrentPage = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.currentPage;
export const selectTotalPages = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.totalPages;

// Form state selectors
export const selectEditingBooking = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.editingBooking;
export const selectEditFormData = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.editFormData;
export const selectHasUnsavedChanges = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.hasUnsavedChanges;
export const selectValidationErrors = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.validationErrors;

// Navigation state selectors
export const selectNavigationContext = (state: { bookingEdit: BookingEditState }) =>
  state.bookingEdit.navigationContext;

// Computed selectors
export const selectBookingById = (
  state: { bookingEdit: BookingEditState },
  id: string
) => state.bookingEdit.bookings.find(booking => booking.id === id);

export const selectBookingsByStatus = (
  state: { bookingEdit: BookingEditState },
  status: BookingStatus
) => state.bookingEdit.bookings.filter(booking => booking.status === status);

export const selectBookingsByType = (
  state: { bookingEdit: BookingEditState },
  type: BookingType
) => state.bookingEdit.bookings.filter(booking => booking.type === type);

export const selectUserBookings = (
  state: { bookingEdit: BookingEditState },
  userId: string
) => state.bookingEdit.bookings.filter(booking => booking.userId === userId);

export const selectIsCacheValid = (state: { bookingEdit: BookingEditState }) => {
  if (!state.bookingEdit.lastFetchTime) return false;
  return Date.now() - state.bookingEdit.lastFetchTime < state.bookingEdit.cacheExpiry;
};

export const selectCanNavigateAway = (state: { bookingEdit: BookingEditState }) => {
  return !state.bookingEdit.hasUnsavedChanges;
};