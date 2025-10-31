import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  Booking, 
  BookingStatus, 
  BookingType,
  BookingWithSwapInfo,
  EnhancedBookingFilters,
  SwapInfo,
  UnifiedBookingData
} from '@booking-swap/shared';
import {
  BookingFilters,
  BookingSearchResult,
} from '../../services/bookingService';

interface BookingsState {
  // Core data with swap information (for backward compatibility)
  bookings: BookingWithSwapInfo[];
  currentBooking: BookingWithSwapInfo | null;
  searchResults: BookingSearchResult | null;
  availableBookings: BookingWithSwapInfo[];

  // Enhanced booking data with swap integration (deprecated - use bookingEdit and swapSpecification slices)
  bookingsWithSwapInfo: BookingWithSwapInfo[];
  swappableBookings: BookingWithSwapInfo[];
  
  // UI state
  loading: boolean;
  error: string | null;

  // Enhanced filters with swap-specific options (deprecated - use bookingEdit slice for pure booking filters)
  filters: EnhancedBookingFilters;
  searchQuery: string;

  // Pagination
  currentPage: number;
  totalPages: number;

  // Selection state for swap creation (deprecated - use swapSpecification slice)
  selectedBookingForSwap: BookingWithSwapInfo | null;

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 5 minutes default

  // Swap integration state (deprecated - use swapSpecification slice)
  swapInfoCache: Record<string, SwapInfo>; // bookingId -> SwapInfo
  lastSwapInfoUpdate: number | null;
}

const initialState: BookingsState = {
  // Core data
  bookings: [],
  currentBooking: null,
  searchResults: null,
  availableBookings: [],

  // Enhanced booking data
  bookingsWithSwapInfo: [],
  swappableBookings: [],

  // UI state
  loading: false,
  error: null,

  // Enhanced filters
  filters: {},
  searchQuery: '',

  // Pagination
  currentPage: 1,
  totalPages: 1,

  // Selection state
  selectedBookingForSwap: null,

  // Cache management
  lastFetchTime: null,
  cacheExpiry: 5 * 60 * 1000, // 5 minutes

  // Swap integration state
  swapInfoCache: {},
  lastSwapInfoUpdate: null,
};

export const bookingsSlice = createSlice({
  name: 'bookings',
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
    setBookings: (state, action: PayloadAction<BookingWithSwapInfo[]>) => {
      state.bookings = action.payload;
      state.lastFetchTime = Date.now();
      state.loading = false;
      state.error = null;
    },
    
    // Enhanced booking management with swap integration
    setBookingsWithSwapInfo: (state, action: PayloadAction<BookingWithSwapInfo[]>) => {
      state.bookingsWithSwapInfo = action.payload;
      state.bookings = action.payload; // Keep backwards compatibility
      
      // Update swappable bookings
      state.swappableBookings = action.payload.filter(booking => 
        booking.swapInfo?.hasActiveProposals
      );
      
      // Update swap info cache
      action.payload.forEach(booking => {
        if (booking.swapInfo) {
          state.swapInfoCache[booking.id] = booking.swapInfo;
        }
      });
      
      state.lastFetchTime = Date.now();
      state.lastSwapInfoUpdate = Date.now();
      state.loading = false;
      state.error = null;
    },
    setCurrentBooking: (state, action: PayloadAction<BookingWithSwapInfo | null>) => {
      state.currentBooking = action.payload;
    },
    setSearchResults: (state, action: PayloadAction<BookingSearchResult>) => {
      state.searchResults = action.payload;
      state.currentPage = action.payload.page;
      state.totalPages = action.payload.totalPages;
      state.loading = false;
      state.error = null;
    },
    setAvailableBookings: (state, action: PayloadAction<BookingWithSwapInfo[]>) => {
      state.availableBookings = action.payload;
    },

    // Swap information management
    updateSwapInfo: (state, action: PayloadAction<{ bookingId: string; swapInfo: SwapInfo }>) => {
      const { bookingId, swapInfo } = action.payload;
      
      // Update in cache
      state.swapInfoCache[bookingId] = swapInfo;
      
      // Update in bookings arrays
      const updateBookingSwapInfo = (booking: BookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapInfo = swapInfo;
        }
      };
      
      state.bookings.forEach(updateBookingSwapInfo);
      state.bookingsWithSwapInfo.forEach(updateBookingSwapInfo);
      state.availableBookings.forEach(updateBookingSwapInfo);
      
      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        state.currentBooking.swapInfo = swapInfo;
      }
      
      // Update swappable bookings
      state.swappableBookings = state.bookings.filter(booking => 
        booking.swapInfo?.hasActiveProposals
      );
      
      state.lastSwapInfoUpdate = Date.now();
    },
    
    removeSwapInfo: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;
      
      // Remove from cache
      delete state.swapInfoCache[bookingId];
      
      // Remove from bookings arrays
      const removeBookingSwapInfo = (booking: BookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapInfo = undefined;
        }
      };
      
      state.bookings.forEach(removeBookingSwapInfo);
      state.bookingsWithSwapInfo.forEach(removeBookingSwapInfo);
      state.availableBookings.forEach(removeBookingSwapInfo);
      
      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        state.currentBooking.swapInfo = undefined;
      }
      
      // Update swappable bookings
      state.swappableBookings = state.bookings.filter(booking => 
        booking.swapInfo?.hasActiveProposals
      );
      
      state.lastSwapInfoUpdate = Date.now();
    },

    // CRUD operations
    addBooking: (state, action: PayloadAction<BookingWithSwapInfo>) => {
      state.bookings.unshift(action.payload); // Add to beginning
      // Also add to available bookings if status is available
      if (action.payload.status === 'available') {
        state.availableBookings.unshift(action.payload);
      }
    },
    updateBooking: (state, action: PayloadAction<BookingWithSwapInfo>) => {
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

      // Update selected booking for swap if it's the same
      if (state.selectedBookingForSwap?.id === booking.id) {
        state.selectedBookingForSwap = booking;
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

      // Clear selected booking if it's the removed one
      if (state.selectedBookingForSwap?.id === bookingId) {
        state.selectedBookingForSwap = null;
      }
    },

    // Batch operations
    updateMultipleBookings: (state, action: PayloadAction<BookingWithSwapInfo[]>) => {
      action.payload.forEach(booking => {
        const index = state.bookings.findIndex(b => b.id === booking.id);
        if (index !== -1) {
          state.bookings[index] = booking;
        }
      });
    },

    // Enhanced filter and search management
    setFilters: (state, action: PayloadAction<Partial<EnhancedBookingFilters>>) => {
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

    // Selection for swap creation
    setSelectedBookingForSwap: (
      state,
      action: PayloadAction<BookingWithSwapInfo | null>
    ) => {
      state.selectedBookingForSwap = action.payload;
    },

    // Cache management
    invalidateCache: state => {
      state.lastFetchTime = null;
    },

    // Reset state
    resetBookingsState: state => {
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

  // Enhanced booking management with swap integration
  setBookingsWithSwapInfo,

  // Swap information management
  updateSwapInfo,
  removeSwapInfo,

  // CRUD operations
  addBooking,
  updateBooking,
  removeBooking,
  updateMultipleBookings,

  // Enhanced filter and search management
  setFilters,
  clearFilters,
  setSearchQuery,

  // Pagination
  setCurrentPage,

  // Selection for swap creation
  setSelectedBookingForSwap,

  // Cache management
  invalidateCache,

  // Reset state
  resetBookingsState,

  // Optimistic updates
  optimisticUpdateBookingStatus,
} = bookingsSlice.actions;

// Selectors
export const selectBookings = (state: { bookings: BookingsState }) =>
  state.bookings.bookings;
export const selectCurrentBooking = (state: { bookings: BookingsState }) =>
  state.bookings.currentBooking;
export const selectSearchResults = (state: { bookings: BookingsState }) =>
  state.bookings.searchResults;
export const selectCachedAvailableBookings = (state: { bookings: BookingsState }) =>
  state.bookings.availableBookings;
export const selectBookingsLoading = (state: { bookings: BookingsState }) =>
  state.bookings.loading;
export const selectBookingsError = (state: { bookings: BookingsState }) =>
  state.bookings.error;
export const selectBookingsFilters = (state: { bookings: BookingsState }) =>
  state.bookings.filters;
export const selectSearchQuery = (state: { bookings: BookingsState }) =>
  state.bookings.searchQuery;
export const selectCurrentPage = (state: { bookings: BookingsState }) =>
  state.bookings.currentPage;
export const selectTotalPages = (state: { bookings: BookingsState }) =>
  state.bookings.totalPages;
export const selectSelectedBookingForSwap = (state: {
  bookings: BookingsState;
}) => state.bookings.selectedBookingForSwap;

// Computed selectors
export const selectBookingById = (
  state: { bookings: BookingsState },
  id: string
) => state.bookings.bookings.find(booking => booking.id === id);

export const selectBookingsByStatus = (
  state: { bookings: BookingsState },
  status: BookingStatus
) => state.bookings.bookings.filter(booking => booking.status === status);

export const selectBookingsByType = (
  state: { bookings: BookingsState },
  type: BookingType
) => state.bookings.bookings.filter(booking => booking.type === type);

export const selectUserBookings = (
  state: { bookings: BookingsState },
  userId: string
) => state.bookings.bookings.filter(booking => booking.userId === userId);

export const selectAvailableBookings = (state: { bookings: BookingsState }) =>
  state.bookings.bookings.filter(
    booking =>
      booking.status === 'available' &&
      booking.verification.status === 'verified'
  );

export const selectIsCacheValid = (state: { bookings: BookingsState }) => {
  if (!state.bookings.lastFetchTime) return false;
  return Date.now() - state.bookings.lastFetchTime < state.bookings.cacheExpiry;
};

// Enhanced selectors for swap integration
export const selectBookingsWithSwapInfo = (state: { bookings: BookingsState }) =>
  state.bookings.bookingsWithSwapInfo;

export const selectSwappableBookings = (state: { bookings: BookingsState }) =>
  state.bookings.swappableBookings;

export const selectSwapInfoCache = (state: { bookings: BookingsState }) =>
  state.bookings.swapInfoCache;

export const selectSwapInfoForBooking = (
  state: { bookings: BookingsState },
  bookingId: string
) => state.bookings.swapInfoCache[bookingId];

export const selectLastSwapInfoUpdate = (state: { bookings: BookingsState }) =>
  state.bookings.lastSwapInfoUpdate;

// Enhanced computed selectors
export const selectFilteredBookingsWithSwapInfo = (state: { bookings: BookingsState }) => {
  const { bookingsWithSwapInfo, filters } = state.bookings;
  let filtered = bookingsWithSwapInfo;

  // Apply swap-specific filters
  if (filters.swapAvailable) {
    filtered = filtered.filter(booking => booking.swapInfo?.hasActiveProposals);
  }

  if (filters.acceptsCash) {
    filtered = filtered.filter(booking => 
      booking.swapInfo?.paymentTypes.includes('cash')
    );
  }

  if (filters.auctionMode) {
    filtered = filtered.filter(booking => 
      booking.swapInfo?.acceptanceStrategy === 'auction' &&
      booking.swapInfo?.auctionEndDate && 
      new Date(booking.swapInfo.auctionEndDate) > new Date()
    );
  }

  if (filters.swapType) {
    filtered = filtered.filter(booking => {
      if (!booking.swapInfo) return false;
      
      switch (filters.swapType) {
        case 'booking':
          return booking.swapInfo.paymentTypes.includes('booking') && 
                 !booking.swapInfo.paymentTypes.includes('cash');
        case 'cash':
          return booking.swapInfo.paymentTypes.includes('cash');
        case 'both':
          return booking.swapInfo.paymentTypes.includes('booking') && 
                 booking.swapInfo.paymentTypes.includes('cash');
        default:
          return true;
      }
    });
  }

  // Apply price range filter for cash swaps
  if (filters.priceRange?.min || filters.priceRange?.max) {
    filtered = filtered.filter(booking => {
      if (!booking.swapInfo?.minCashAmount) return true;
      
      const minMatch = !filters.priceRange?.min || 
                      booking.swapInfo.minCashAmount >= filters.priceRange.min;
      const maxMatch = !filters.priceRange?.max || 
                      booking.swapInfo.minCashAmount <= filters.priceRange.max;
      
      return minMatch && maxMatch;
    });
  }

  return filtered;
};

export const selectBookingsWithActiveSwaps = (state: { bookings: BookingsState }) =>
  state.bookings.bookingsWithSwapInfo.filter(booking => 
    booking.swapInfo?.hasActiveProposals
  );

export const selectBookingsAcceptingCash = (state: { bookings: BookingsState }) =>
  state.bookings.bookingsWithSwapInfo.filter(booking => 
    booking.swapInfo?.paymentTypes.includes('cash')
  );

export const selectActiveAuctionBookings = (state: { bookings: BookingsState }) =>
  state.bookings.bookingsWithSwapInfo.filter(booking => 
    booking.swapInfo?.acceptanceStrategy === 'auction' &&
    booking.swapInfo?.auctionEndDate && 
    new Date(booking.swapInfo.auctionEndDate) > new Date()
  );

export const selectBookingsByUserRole = (
  state: { bookings: BookingsState },
  userId: string,
  role: 'owner' | 'browser' | 'proposer'
) => {
  const bookings = state.bookings.bookingsWithSwapInfo;
  
  switch (role) {
    case 'owner':
      return bookings.filter(booking => booking.userId === userId);
    case 'browser':
      return bookings.filter(booking => 
        booking.userId !== userId && 
        booking.swapInfo?.hasActiveProposals
      );
    case 'proposer':
      return bookings.filter(booking => 
        booking.swapInfo?.userProposalStatus && 
        booking.swapInfo.userProposalStatus !== 'none'
      );
    default:
      return bookings;
  }
};
