import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  BookingStatus,
  BookingType,
  BookingWithSwapInfo,
  EnhancedBookingFilters,
  SwapInfo,
} from '@booking-swap/shared';
import {
  BookingSearchResult,
} from '../../services/bookingService';

// Completion-related interfaces for bookings
export interface BookingSwapCompletion {
  swappedAt?: Date;
  swapTransactionId?: string;
  originalOwnerId?: string; // For tracking ownership transfers
  swapCompletionId?: string;
  relatedBookingSwaps?: string[]; // IDs of other bookings swapped in same transaction
  completionType?: 'booking_exchange' | 'cash_payment';
  proposalId?: string; // The proposal that triggered this completion
  newOwnerId?: string; // For ownership transfers
}

// Enhanced booking interface with completion tracking
interface EnhancedBookingWithSwapInfo extends BookingWithSwapInfo {
  swapCompletion?: BookingSwapCompletion;
}

interface BookingsState {
  // Core data with swap information (for backward compatibility)
  bookings: EnhancedBookingWithSwapInfo[];
  currentBooking: EnhancedBookingWithSwapInfo | null;
  searchResults: BookingSearchResult | null;
  availableBookings: EnhancedBookingWithSwapInfo[];

  // Enhanced booking data with swap integration (deprecated - use bookingEdit and swapSpecification slices)
  bookingsWithSwapInfo: EnhancedBookingWithSwapInfo[];
  swappableBookings: EnhancedBookingWithSwapInfo[];

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
  selectedBookingForSwap: EnhancedBookingWithSwapInfo | null;

  // Cache management
  lastFetchTime: number | null;
  cacheExpiry: number; // 5 minutes default

  // Swap integration state (deprecated - use swapSpecification slice)
  swapInfoCache: Record<string, SwapInfo>; // bookingId -> SwapInfo
  lastSwapInfoUpdate: number | null;

  // Completion tracking
  completionInfoCache: Record<string, BookingSwapCompletion>; // bookingId -> BookingSwapCompletion
  lastCompletionUpdate: number | null;
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

  // Completion tracking
  completionInfoCache: {},
  lastCompletionUpdate: null,
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

    // Completion tracking actions
    updateBookingCompletion: (
      state,
      action: PayloadAction<{
        bookingId: string;
        completion: BookingSwapCompletion;
      }>
    ) => {
      const { bookingId, completion } = action.payload;

      // Update in cache
      state.completionInfoCache[bookingId] = completion;

      // Update in bookings arrays
      const updateBookingCompletion = (booking: EnhancedBookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapCompletion = completion;

          // Update status if completion indicates swapped
          if (completion.swappedAt && booking.status !== 'swapped') {
            booking.status = 'swapped';
          }

          // Update ownership if there's a new owner
          if (completion.newOwnerId && completion.newOwnerId !== booking.userId) {
            booking.userId = completion.newOwnerId;
          }
        }
      };

      state.bookings.forEach(updateBookingCompletion);
      state.bookingsWithSwapInfo.forEach(updateBookingCompletion);
      state.availableBookings.forEach(updateBookingCompletion);

      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        updateBookingCompletion(state.currentBooking);
      }

      state.lastCompletionUpdate = Date.now();
    },

    updateMultipleBookingCompletions: (
      state,
      action: PayloadAction<Array<{
        bookingId: string;
        completion: BookingSwapCompletion;
      }>>
    ) => {
      action.payload.forEach(({ bookingId, completion }) => {
        // Update in cache
        state.completionInfoCache[bookingId] = completion;

        // Update in bookings arrays
        const updateBookingCompletion = (booking: EnhancedBookingWithSwapInfo) => {
          if (booking.id === bookingId) {
            booking.swapCompletion = completion;

            // Update status if completion indicates swapped
            if (completion.swappedAt && booking.status !== 'swapped') {
              booking.status = 'swapped';
            }

            // Update ownership if there's a new owner
            if (completion.newOwnerId && completion.newOwnerId !== booking.userId) {
              booking.userId = completion.newOwnerId;
            }
          }
        };

        state.bookings.forEach(updateBookingCompletion);
        state.bookingsWithSwapInfo.forEach(updateBookingCompletion);
        state.availableBookings.forEach(updateBookingCompletion);
      });

      state.lastCompletionUpdate = Date.now();
    },

    removeBookingCompletion: (state, action: PayloadAction<string>) => {
      const bookingId = action.payload;

      // Remove from cache
      delete state.completionInfoCache[bookingId];

      // Remove from bookings arrays
      const removeBookingCompletion = (booking: EnhancedBookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapCompletion = undefined;
        }
      };

      state.bookings.forEach(removeBookingCompletion);
      state.bookingsWithSwapInfo.forEach(removeBookingCompletion);
      state.availableBookings.forEach(removeBookingCompletion);

      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        state.currentBooking.swapCompletion = undefined;
      }

      state.lastCompletionUpdate = Date.now();
    },

    // Optimistic completion updates
    optimisticBookingCompletion: (
      state,
      action: PayloadAction<{
        bookingId: string;
        proposalId: string;
        completionType: 'booking_exchange' | 'cash_payment';
        newOwnerId?: string;
      }>
    ) => {
      const { bookingId, proposalId, completionType, newOwnerId } = action.payload;

      const completion: BookingSwapCompletion = {
        swappedAt: new Date(),
        completionType,
        proposalId,
        swapTransactionId: `optimistic-${Date.now()}`,
        newOwnerId,
      };

      // Update in cache
      state.completionInfoCache[bookingId] = completion;

      // Update in bookings arrays
      const updateBookingCompletion = (booking: EnhancedBookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapCompletion = completion;

          // Optimistically update status
          booking.status = 'swapped';

          // Update ownership if there's a new owner
          if (newOwnerId && newOwnerId !== booking.userId) {
            completion.originalOwnerId = booking.userId;
            booking.userId = newOwnerId;
          }
        }
      };

      state.bookings.forEach(updateBookingCompletion);
      state.bookingsWithSwapInfo.forEach(updateBookingCompletion);
      state.availableBookings.forEach(updateBookingCompletion);

      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        updateBookingCompletion(state.currentBooking);
      }

      state.lastCompletionUpdate = Date.now();
    },

    rollbackOptimisticBookingCompletion: (
      state,
      action: PayloadAction<{
        bookingId: string;
        originalStatus: BookingStatus;
        originalOwnerId?: string;
      }>
    ) => {
      const { bookingId, originalStatus, originalOwnerId } = action.payload;

      // Remove from cache
      delete state.completionInfoCache[bookingId];

      // Rollback in bookings arrays
      const rollbackBookingCompletion = (booking: EnhancedBookingWithSwapInfo) => {
        if (booking.id === bookingId) {
          booking.swapCompletion = undefined;

          // Restore original status
          booking.status = originalStatus;

          // Restore original ownership if needed
          if (originalOwnerId && originalOwnerId !== booking.userId) {
            booking.userId = originalOwnerId;
          }
        }
      };

      state.bookings.forEach(rollbackBookingCompletion);
      state.bookingsWithSwapInfo.forEach(rollbackBookingCompletion);
      state.availableBookings.forEach(rollbackBookingCompletion);

      // Update current booking if it matches
      if (state.currentBooking?.id === bookingId) {
        rollbackBookingCompletion(state.currentBooking);
      }

      state.lastCompletionUpdate = Date.now();
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

  // Completion tracking actions
  updateBookingCompletion,
  updateMultipleBookingCompletions,
  removeBookingCompletion,
  optimisticBookingCompletion,
  rollbackOptimisticBookingCompletion,
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
// Completion-related selectors
export const selectBookingCompletion = (
  state: { bookings: BookingsState },
  bookingId: string
) => {
  const booking = state.bookings.bookings.find(b => b.id === bookingId);
  return booking?.swapCompletion || state.bookings.completionInfoCache[bookingId];
};

export const selectBookingsWithCompletion = (state: { bookings: BookingsState }) =>
  state.bookings.bookings.filter(booking => booking.swapCompletion);

export const selectBookingsByCompletionType = (
  state: { bookings: BookingsState },
  completionType: 'booking_exchange' | 'cash_payment'
) => state.bookings.bookings.filter(
  booking => booking.swapCompletion?.completionType === completionType
);

export const selectBookingsByProposal = (
  state: { bookings: BookingsState },
  proposalId: string
) => state.bookings.bookings.filter(
  booking => booking.swapCompletion?.proposalId === proposalId
);

export const selectRelatedCompletedBookings = (
  state: { bookings: BookingsState },
  bookingId: string
) => {
  const booking = state.bookings.bookings.find(b => b.id === bookingId);
  if (!booking?.swapCompletion?.relatedBookingSwaps) return [];

  return state.bookings.bookings.filter(b =>
    booking.swapCompletion!.relatedBookingSwaps!.includes(b.id)
  );
};

export const selectRecentlySwappedBookings = (state: { bookings: BookingsState }) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  return state.bookings.bookings.filter(booking => {
    if (!booking.swapCompletion?.swappedAt) return false;
    return new Date(booking.swapCompletion.swappedAt) > twentyFourHoursAgo;
  });
};

export const selectBookingsWithOwnershipTransfer = (state: { bookings: BookingsState }) =>
  state.bookings.bookings.filter(booking =>
    booking.swapCompletion?.originalOwnerId &&
    booking.swapCompletion?.newOwnerId
  );

export const selectBookingsByOriginalOwner = (
  state: { bookings: BookingsState },
  originalOwnerId: string
) => state.bookings.bookings.filter(
  booking => booking.swapCompletion?.originalOwnerId === originalOwnerId
);

export const selectBookingsByNewOwner = (
  state: { bookings: BookingsState },
  newOwnerId: string
) => state.bookings.bookings.filter(
  booking => booking.swapCompletion?.newOwnerId === newOwnerId
);

export const selectCompletionInfoCache = (state: { bookings: BookingsState }) =>
  state.bookings.completionInfoCache;

export const selectLastCompletionUpdate = (state: { bookings: BookingsState }) =>
  state.bookings.lastCompletionUpdate;