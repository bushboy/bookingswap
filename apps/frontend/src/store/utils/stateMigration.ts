import { BookingWithSwapInfo } from '@booking-swap/shared';
import { BookingEditData, SwapSpecificationData } from '@booking-swap/shared';

/**
 * Utility functions to help migrate from unified booking state to separated booking edit and swap specification states
 */

// Extract pure booking data from BookingWithSwapInfo
export const extractBookingEditData = (bookingWithSwap: BookingWithSwapInfo): BookingEditData => {
  return {
    type: bookingWithSwap.type,
    title: bookingWithSwap.title,
    description: bookingWithSwap.description,
    location: bookingWithSwap.location,
    dateRange: bookingWithSwap.dateRange,
    originalPrice: bookingWithSwap.originalPrice,
    swapValue: bookingWithSwap.swapValue,
    providerDetails: bookingWithSwap.providerDetails,
  };
};

// Extract swap specification data from BookingWithSwapInfo
export const extractSwapSpecificationData = (bookingWithSwap: BookingWithSwapInfo): SwapSpecificationData | null => {
  if (!bookingWithSwap.swapInfo) {
    return null;
  }

  return {
    bookingId: bookingWithSwap.id,
    swapPreferences: {
      paymentTypes: bookingWithSwap.swapInfo.paymentTypes,
      acceptanceStrategy: bookingWithSwap.swapInfo.acceptanceStrategy,
      auctionEndDate: bookingWithSwap.swapInfo.auctionEndDate,
      minCashAmount: bookingWithSwap.swapInfo.minCashAmount,
      maxCashAmount: bookingWithSwap.swapInfo.maxCashAmount,
      swapConditions: bookingWithSwap.swapInfo.swapConditions || [],
    },
    swapEnabled: bookingWithSwap.swapInfo.hasAnySwapInitiated || false,
  };
};

// Convert array of BookingWithSwapInfo to separated arrays
export const separateBookingsAndSwaps = (bookingsWithSwap: BookingWithSwapInfo[]) => {
  const bookings = bookingsWithSwap.map(booking => ({
    id: booking.id,
    userId: booking.userId,
    type: booking.type,
    title: booking.title,
    description: booking.description,
    location: booking.location,
    dateRange: booking.dateRange,
    originalPrice: booking.originalPrice,
    swapValue: booking.swapValue,
    providerDetails: booking.providerDetails,
    status: booking.status,
    verification: booking.verification,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }));

  const swapSpecifications = bookingsWithSwap
    .filter(booking => booking.swapInfo)
    .map(booking => extractSwapSpecificationData(booking))
    .filter((spec): spec is SwapSpecificationData => spec !== null);

  return {
    bookings,
    swapSpecifications,
  };
};

// Merge booking and swap data back into BookingWithSwapInfo format (for backward compatibility)
export const mergeBookingWithSwapData = (
  booking: any,
  swapData?: SwapSpecificationData | null
): BookingWithSwapInfo => {
  const baseBooking: BookingWithSwapInfo = {
    ...booking,
    swapInfo: undefined,
  };

  if (swapData && swapData.swapEnabled) {
    baseBooking.swapInfo = {
      swapId: `swap-${booking.id}`, // This would be the actual swap ID in real implementation
      paymentTypes: swapData.swapPreferences.paymentTypes,
      acceptanceStrategy: swapData.swapPreferences.acceptanceStrategy,
      auctionEndDate: swapData.swapPreferences.auctionEndDate,
      minCashAmount: swapData.swapPreferences.minCashAmount,
      maxCashAmount: swapData.swapPreferences.maxCashAmount,
      hasActiveProposals: true, // This would be determined by actual proposal count
      activeProposalCount: 0, // This would be fetched from the swap service
      userProposalStatus: 'none',
      swapConditions: swapData.swapPreferences.swapConditions,
      hasAnySwapInitiated: true,
    };
  }

  return baseBooking;
};

// Check if a booking has swap-related changes that need to be preserved
export const hasSwapRelatedChanges = (bookingWithSwap: BookingWithSwapInfo): boolean => {
  return bookingWithSwap.swapInfo !== undefined;
};

// Validate that separated data is consistent with original unified data
export const validateSeparatedData = (
  original: BookingWithSwapInfo,
  bookingData: BookingEditData,
  swapData?: SwapSpecificationData | null
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Validate booking data consistency
  if (original.type !== bookingData.type) {
    errors.push('Booking type mismatch');
  }
  if (original.title !== bookingData.title) {
    errors.push('Booking title mismatch');
  }
  if (original.originalPrice !== bookingData.originalPrice) {
    errors.push('Booking price mismatch');
  }

  // Validate swap data consistency
  if (original.swapInfo && !swapData) {
    errors.push('Original had swap info but separated data does not');
  }
  if (!original.swapInfo && swapData?.swapEnabled) {
    errors.push('Original had no swap info but separated data indicates swap is enabled');
  }

  if (original.swapInfo && swapData?.swapEnabled) {
    if (JSON.stringify(original.swapInfo.paymentTypes.sort()) !== 
        JSON.stringify(swapData.swapPreferences.paymentTypes.sort())) {
      errors.push('Payment types mismatch');
    }
    if (original.swapInfo.acceptanceStrategy !== swapData.swapPreferences.acceptanceStrategy) {
      errors.push('Acceptance strategy mismatch');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// Create default swap specification data for a booking
export const createDefaultSwapSpecification = (bookingId: string): SwapSpecificationData => {
  return {
    bookingId,
    swapPreferences: {
      paymentTypes: ['booking'],
      acceptanceStrategy: 'first_match',
      swapConditions: [],
    },
    swapEnabled: false,
  };
};

// Migration helper: Convert legacy unified booking filters to separated filters
export const migrateBookingFilters = (unifiedFilters: any) => {
  // Extract pure booking filters
  const bookingFilters = {
    type: unifiedFilters.type,
    location: unifiedFilters.location,
    dateRange: unifiedFilters.dateRange,
    status: unifiedFilters.status,
    priceRange: unifiedFilters.priceRange,
  };

  // Extract swap-specific filters
  const swapFilters = {
    swapAvailable: unifiedFilters.swapAvailable,
    acceptsCash: unifiedFilters.acceptsCash,
    auctionMode: unifiedFilters.auctionMode,
    swapType: unifiedFilters.swapType,
  };

  return {
    bookingFilters,
    swapFilters,
  };
};

// State migration helper: Migrate from old unified state to new separated state
export const migrateUnifiedStateToSeparated = (unifiedState: any) => {
  const { bookings, swapSpecifications } = separateBookingsAndSwaps(unifiedState.bookings || []);
  
  return {
    bookingEdit: {
      bookings,
      currentBooking: unifiedState.currentBooking ? {
        id: unifiedState.currentBooking.id,
        userId: unifiedState.currentBooking.userId,
        type: unifiedState.currentBooking.type,
        title: unifiedState.currentBooking.title,
        description: unifiedState.currentBooking.description,
        location: unifiedState.currentBooking.location,
        dateRange: unifiedState.currentBooking.dateRange,
        originalPrice: unifiedState.currentBooking.originalPrice,
        swapValue: unifiedState.currentBooking.swapValue,
        providerDetails: unifiedState.currentBooking.providerDetails,
        status: unifiedState.currentBooking.status,
        verification: unifiedState.currentBooking.verification,
        createdAt: unifiedState.currentBooking.createdAt,
        updatedAt: unifiedState.currentBooking.updatedAt,
      } : null,
      searchResults: unifiedState.searchResults,
      availableBookings: bookings.filter(b => b.status === 'available'),
      loading: unifiedState.loading || false,
      error: unifiedState.error || null,
      filters: migrateBookingFilters(unifiedState.filters || {}).bookingFilters,
      searchQuery: unifiedState.searchQuery || '',
      currentPage: unifiedState.currentPage || 1,
      totalPages: unifiedState.totalPages || 1,
      lastFetchTime: unifiedState.lastFetchTime || null,
      cacheExpiry: unifiedState.cacheExpiry || 5 * 60 * 1000,
      editingBooking: null,
      editFormData: null,
      hasUnsavedChanges: false,
      validationErrors: {},
      navigationContext: {},
    },
    swapSpecification: {
      contextBooking: null,
      swapSpecificationData: null,
      hasUnsavedChanges: false,
      validationErrors: {},
      loading: false,
      error: null,
      existingSwap: null,
      navigationContext: {},
      walletConnection: {
        isConnected: false,
        isConnecting: false,
      },
      previewData: null,
    },
  };
};