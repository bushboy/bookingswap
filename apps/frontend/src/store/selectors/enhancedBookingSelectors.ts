import { createSelector } from '@reduxjs/toolkit';
import { RootState } from '../index';
import {
  BookingWithSwapInfo,
  EnhancedBookingFilters,
  BookingUserRole,
} from '@booking-swap/shared';

// Base selectors
const selectBookingsState = (state: RootState) => state.bookings;
const selectUiState = (state: RootState) => state.ui;

// Enhanced booking selectors with memoization
export const selectFilteredBookingsWithSwapInfo = createSelector(
  [selectBookingsState, selectUiState],
  (bookingsState, uiState) => {
    const { bookingsWithSwapInfo, filters } = bookingsState;
    const { filters: uiFilters } = uiState;
    
    let filtered = bookingsWithSwapInfo;

    // Apply swap-specific UI filters
    if (uiFilters.showSwappableOnly) {
      filtered = filtered.filter(booking => booking.swapInfo?.hasActiveProposals);
    }

    if (uiFilters.showCashAccepting) {
      filtered = filtered.filter(booking => 
        booking.swapInfo?.paymentTypes.includes('cash')
      );
    }

    if (uiFilters.showAuctions) {
      filtered = filtered.filter(booking => 
        booking.swapInfo?.acceptanceStrategy === 'auction' &&
        booking.swapInfo?.auctionEndDate && 
        new Date(booking.swapInfo.auctionEndDate) > new Date()
      );
    }

    // Apply enhanced booking filters
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

    // Apply location filter
    if (filters.location?.city || filters.location?.country) {
      filtered = filtered.filter(booking => {
        const cityMatch = !filters.location?.city || 
                         booking.location.city.toLowerCase().includes(filters.location.city.toLowerCase());
        const countryMatch = !filters.location?.country || 
                            booking.location.country.toLowerCase().includes(filters.location.country.toLowerCase());
        
        return cityMatch && countryMatch;
      });
    }

    // Apply date range filter
    if (filters.dateRange?.start || filters.dateRange?.end) {
      filtered = filtered.filter(booking => {
        const bookingStart = new Date(booking.dateRange.checkIn);
        const bookingEnd = new Date(booking.dateRange.checkOut);
        
        const startMatch = !filters.dateRange?.start || 
                          bookingStart >= new Date(filters.dateRange.start);
        const endMatch = !filters.dateRange?.end || 
                        bookingEnd <= new Date(filters.dateRange.end);
        
        return startMatch && endMatch;
      });
    }

    return filtered;
  }
);

// Selector for bookings by user role
export const selectBookingsByUserRole = createSelector(
  [selectBookingsState, (_: RootState, userId: string, role: BookingUserRole) => ({ userId, role })],
  (bookingsState, { userId, role }) => {
    const bookings = bookingsState.bookingsWithSwapInfo;
    
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
  }
);

// Selector for bookings with active swaps
export const selectBookingsWithActiveSwaps = createSelector(
  [selectBookingsState],
  (bookingsState) => 
    bookingsState.bookingsWithSwapInfo.filter(booking => 
      booking.swapInfo?.hasActiveProposals
    )
);

// Selector for bookings accepting cash
export const selectBookingsAcceptingCash = createSelector(
  [selectBookingsState],
  (bookingsState) => 
    bookingsState.bookingsWithSwapInfo.filter(booking => 
      booking.swapInfo?.paymentTypes.includes('cash')
    )
);

// Selector for active auction bookings
export const selectActiveAuctionBookings = createSelector(
  [selectBookingsState],
  (bookingsState) => 
    bookingsState.bookingsWithSwapInfo.filter(booking => 
      booking.swapInfo?.acceptanceStrategy === 'auction' &&
      booking.swapInfo?.auctionEndDate && 
      new Date(booking.swapInfo.auctionEndDate) > new Date()
    )
);

// Selector for ending soon auction bookings
export const selectEndingSoonAuctionBookings = createSelector(
  [selectBookingsState],
  (bookingsState) => {
    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return bookingsState.bookingsWithSwapInfo.filter(booking => 
      booking.swapInfo?.acceptanceStrategy === 'auction' &&
      booking.swapInfo?.auctionEndDate && 
      new Date(booking.swapInfo.auctionEndDate) <= twentyFourHoursFromNow &&
      new Date(booking.swapInfo.auctionEndDate) > now
    );
  }
);

// Selector for bookings with cash offers in price range
export const selectBookingsInPriceRange = createSelector(
  [selectBookingsState, (_: RootState, minPrice: number, maxPrice: number) => ({ minPrice, maxPrice })],
  (bookingsState, { minPrice, maxPrice }) => 
    bookingsState.bookingsWithSwapInfo.filter(booking => {
      if (!booking.swapInfo?.minCashAmount) return false;
      
      return booking.swapInfo.minCashAmount >= minPrice && 
             booking.swapInfo.minCashAmount <= maxPrice;
    })
);

// Selector for booking statistics
export const selectBookingStatistics = createSelector(
  [selectBookingsState],
  (bookingsState) => {
    const bookings = bookingsState.bookingsWithSwapInfo;
    const swappableBookings = bookings.filter(b => b.swapInfo?.hasActiveProposals);
    const cashAcceptingBookings = bookings.filter(b => b.swapInfo?.paymentTypes.includes('cash'));
    const auctionBookings = bookings.filter(b => b.swapInfo?.acceptanceStrategy === 'auction');
    
    const totalCashOffers = cashAcceptingBookings
      .map(b => b.swapInfo?.minCashAmount || 0)
      .filter(amount => amount > 0);
    
    const averageCashOffer = totalCashOffers.length > 0 
      ? totalCashOffers.reduce((sum, amount) => sum + amount, 0) / totalCashOffers.length
      : 0;

    return {
      totalBookings: bookings.length,
      swappableBookings: swappableBookings.length,
      cashAcceptingBookings: cashAcceptingBookings.length,
      auctionBookings: auctionBookings.length,
      averageCashOffer,
      swappablePercentage: bookings.length > 0 ? (swappableBookings.length / bookings.length) * 100 : 0,
    };
  }
);

// Selector for inline proposal states
export const selectInlineProposalStates = createSelector(
  [selectUiState],
  (uiState) => uiState.inlineProposals
);

// Selector for active inline proposals
export const selectActiveInlineProposals = createSelector(
  [selectUiState],
  (uiState) => 
    Object.entries(uiState.inlineProposals)
      .filter(([_, proposal]) => proposal.isOpen)
      .map(([bookingId, proposal]) => ({ bookingId, ...proposal }))
);

// Selector for bookings with pending inline proposals
export const selectBookingsWithPendingProposals = createSelector(
  [selectUiState],
  (uiState) => 
    Object.entries(uiState.inlineProposals)
      .filter(([_, proposal]) => proposal.loading)
      .map(([bookingId]) => bookingId)
);

// Selector for expanded booking cards
export const selectExpandedBookingCards = createSelector(
  [selectUiState],
  (uiState) => uiState.expandedBookingCards
);

// Selector for bookings selected for comparison
export const selectBookingsForComparison = createSelector(
  [selectBookingsState, selectUiState],
  (bookingsState, uiState) => {
    const selectedIds = uiState.selectedBookingsForComparison;
    return bookingsState.bookingsWithSwapInfo.filter(booking => 
      selectedIds.includes(booking.id)
    );
  }
);

// Selector for filter summary
export const selectFilterSummary = createSelector(
  [selectBookingsState, selectUiState],
  (bookingsState, uiState) => {
    const { filters } = bookingsState;
    const { filters: uiFilters } = uiState;
    
    const activeFilters: string[] = [];
    
    // UI filters
    if (uiFilters.showSwappableOnly) activeFilters.push('Swappable Only');
    if (uiFilters.showCashAccepting) activeFilters.push('Accepts Cash');
    if (uiFilters.showAuctions) activeFilters.push('Auctions');
    
    // Enhanced filters
    if (filters.swapAvailable) activeFilters.push('Swap Available');
    if (filters.acceptsCash) activeFilters.push('Cash Accepted');
    if (filters.auctionMode) activeFilters.push('Auction Mode');
    if (filters.swapType) activeFilters.push(`Swap Type: ${filters.swapType}`);
    
    // Location filters
    if (filters.location?.city) activeFilters.push(`City: ${filters.location.city}`);
    if (filters.location?.country) activeFilters.push(`Country: ${filters.location.country}`);
    
    // Price range filters
    if (filters.priceRange?.min || filters.priceRange?.max) {
      const min = filters.priceRange.min || 0;
      const max = filters.priceRange.max || '∞';
      activeFilters.push(`Price: $${min} - $${max}`);
    }
    
    // Date range filters
    if (filters.dateRange?.start || filters.dateRange?.end) {
      const start = filters.dateRange.start ? new Date(filters.dateRange.start).toLocaleDateString() : 'Any';
      const end = filters.dateRange.end ? new Date(filters.dateRange.end).toLocaleDateString() : 'Any';
      activeFilters.push(`Dates: ${start} - ${end}`);
    }
    
    return {
      activeFilters,
      count: activeFilters.length,
      hasActiveFilters: activeFilters.length > 0,
    };
  }
);

// Selector for booking form state
export const selectBookingFormState = createSelector(
  [selectUiState],
  (uiState) => uiState.activeBookingForm
);

// Selector to check if swap info is stale
export const selectIsSwapInfoStale = createSelector(
  [selectBookingsState],
  (bookingsState) => {
    if (!bookingsState.lastSwapInfoUpdate) return true;
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return bookingsState.lastSwapInfoUpdate < fiveMinutesAgo;
  }
);

// Selector for bookings requiring user action
export const selectBookingsRequiringAction = createSelector(
  [selectBookingsState, (_: RootState, userId: string) => userId],
  (bookingsState, userId) => 
    bookingsState.bookingsWithSwapInfo.filter(booking => {
      // User owns the booking and has pending proposals
      if (booking.userId === userId && 
          booking.swapInfo?.hasActiveProposals && 
          booking.swapInfo.activeProposalCount > 0) {
        return true;
      }
      
      // User has proposals that were accepted/rejected
      if (booking.swapInfo?.userProposalStatus === 'accepted' || 
          booking.swapInfo?.userProposalStatus === 'rejected') {
        return true;
      }
      
      return false;
    })
);