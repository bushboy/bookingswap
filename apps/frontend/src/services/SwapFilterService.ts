import { Booking, SwapWithBookings } from '@/services/bookingService';

export interface SwapBrowsingFilters {
  // Core filtering rules (always applied)
  readonly excludeOwnSwaps: true;
  readonly excludeCancelledBookings: true;
  readonly requireActiveProposals: true;
  readonly excludeExpiredSwaps: true;

  // Additional user-configurable filters
  location?: LocationFilter;
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
  swapType?: 'booking' | 'cash' | 'both';
}

export interface LocationFilter {
  city?: string;
  country?: string;
  coordinates?: {
    lat: number;
    lng: number;
    radius: number; // km
  };
}

export interface DateRangeFilter {
  start: Date;
  end: Date;
  flexible?: boolean;
}

export interface PriceRangeFilter {
  min: number;
  max: number;
  currency?: string;
}

export interface SwapFilters {
  // User-configurable filters
  location?: LocationFilter;
  dateRange?: DateRangeFilter;
  priceRange?: PriceRangeFilter;
  swapType?: 'booking' | 'cash' | 'both';

  // Core filters (always applied, not user-configurable)
  readonly excludeOwnSwaps: true;
  readonly excludeCancelledBookings: true;
  readonly requireActiveProposals: true;
  readonly excludeExpiredSwaps: true;
}

/**
 * Service for filtering swaps and bookings for browsing
 * Implements strict filtering rules to ensure users only see relevant content
 */
export class SwapFilterService {
  /**
   * Applies core browsing restrictions that cannot be disabled
   * These rules ensure users don't see their own bookings, cancelled bookings,
   * bookings without active swap proposals, or expired swaps
   */
  applyCoreBrowsingFilters(
    swaps: SwapWithBookings[],
    currentUserId: string
  ): SwapWithBookings[] {
    return swaps.filter(swap => {
      // Rule 1: Exclude user's own swaps
      if (swap.owner?.id === currentUserId) {
        return false;
      }

      // Rule 2: Exclude cancelled bookings
      if (swap.sourceBooking?.status === 'cancelled') {
        return false;
      }

      // Rule 3: Only show swaps that have active proposals
      if (!swap.hasActiveProposals) {
        return false;
      }

      // Rule 4: Exclude expired swaps
      if (swap.expiresAt && new Date(swap.expiresAt) <= new Date()) {
        return false;
      }

      return true;
    });
  }

  /**
   * Applies core browsing restrictions to regular bookings
   * Filters out user's own bookings and cancelled bookings
   */
  applyCoreBrowsingFiltersToBookings(
    bookings: Booking[],
    currentUserId: string
  ): Booking[] {
    return bookings.filter(booking => {
      // Rule 1: Exclude user's own bookings
      if (booking.userId === currentUserId) {
        return false;
      }

      // Rule 2: Exclude cancelled bookings
      if (booking.status === 'cancelled') {
        return false;
      }

      // Rule 3: Only show bookings that have active swap proposals
      // This would need to be checked against the swaps data
      // For now, we'll assume all non-cancelled, non-own bookings are valid
      return true;
    });
  }

  /**
   * Applies user-configurable filters on top of core restrictions
   */
  applyUserFilters(
    swaps: SwapWithBookings[],
    filters: SwapFilters
  ): SwapWithBookings[] {
    return swaps.filter(swap => {
      // Apply location filters
      if (
        filters.location &&
        !this.matchesLocationFilter(swap.sourceBooking, filters.location)
      ) {
        return false;
      }

      // Apply date range filters
      if (
        filters.dateRange &&
        !this.matchesDateFilter(swap.sourceBooking, filters.dateRange)
      ) {
        return false;
      }

      // Apply price range filters
      if (
        filters.priceRange &&
        !this.matchesPriceFilter(swap, filters.priceRange)
      ) {
        return false;
      }

      // Apply swap type filters
      if (
        filters.swapType &&
        filters.swapType !== 'both' &&
        swap.swapType !== filters.swapType
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Applies user-configurable filters to regular bookings
   */
  applyUserFiltersToBookings(
    bookings: Booking[],
    filters: Partial<SwapFilters>
  ): Booking[] {
    return bookings.filter(booking => {
      // Apply location filters
      if (
        filters.location &&
        !this.matchesLocationFilterForBooking(booking, filters.location)
      ) {
        return false;
      }

      // Apply date range filters
      if (
        filters.dateRange &&
        !this.matchesDateFilterForBooking(booking, filters.dateRange)
      ) {
        return false;
      }

      // Apply price range filters
      if (
        filters.priceRange &&
        !this.matchesPriceFilterForBooking(booking, filters.priceRange)
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * Combines core and user filters for complete filtering
   */
  applyAllFilters(
    swaps: SwapWithBookings[],
    currentUserId: string,
    filters: SwapFilters
  ): SwapWithBookings[] {
    // First apply core restrictions
    const coreFiltered = this.applyCoreBrowsingFilters(swaps, currentUserId);

    // Then apply user filters
    return this.applyUserFilters(coreFiltered, filters);
  }

  /**
   * Combines core and user filters for bookings
   */
  applyAllFiltersToBookings(
    bookings: Booking[],
    currentUserId: string,
    filters: Partial<SwapFilters> = {}
  ): Booking[] {
    // First apply core restrictions
    const coreFiltered = this.applyCoreBrowsingFiltersToBookings(
      bookings,
      currentUserId
    );

    // Then apply user filters
    return this.applyUserFiltersToBookings(coreFiltered, filters);
  }

  /**
   * Check if a booking matches location filter criteria
   */
  private matchesLocationFilter(
    booking: Booking,
    locationFilter: LocationFilter
  ): boolean {
    if (locationFilter.city) {
      const bookingCity = booking.location?.city || booking.city || '';
      if (
        !bookingCity.toLowerCase().includes(locationFilter.city.toLowerCase())
      ) {
        return false;
      }
    }

    if (locationFilter.country) {
      const bookingCountry = booking.location?.country || booking.country || '';
      if (
        !bookingCountry
          .toLowerCase()
          .includes(locationFilter.country.toLowerCase())
      ) {
        return false;
      }
    }

    if (locationFilter.coordinates) {
      // TODO: Implement coordinate-based filtering with radius
      // This would require booking coordinates to be available
      console.warn('Coordinate-based filtering not yet implemented');
    }

    return true;
  }

  /**
   * Check if a regular booking matches location filter criteria
   */
  private matchesLocationFilterForBooking(
    booking: Booking,
    locationFilter: LocationFilter
  ): boolean {
    return this.matchesLocationFilter(booking, locationFilter);
  }

  /**
   * Check if a booking matches date range filter criteria
   */
  private matchesDateFilter(
    booking: Booking,
    dateFilter: DateRangeFilter
  ): boolean {
    const checkIn = new Date(booking.dateRange?.checkIn || booking.checkInDate);
    const checkOut = new Date(
      booking.dateRange?.checkOut || booking.checkOutDate
    );
    const filterStart = dateFilter.start;
    const filterEnd = dateFilter.end;

    if (dateFilter.flexible) {
      // Flexible dates: any overlap
      return checkIn <= filterEnd && checkOut >= filterStart;
    } else {
      // Exact dates: booking must be within filter range
      return checkIn >= filterStart && checkOut <= filterEnd;
    }
  }

  /**
   * Check if a regular booking matches date range filter criteria
   */
  private matchesDateFilterForBooking(
    booking: Booking,
    dateFilter: DateRangeFilter
  ): boolean {
    return this.matchesDateFilter(booking, dateFilter);
  }

  /**
   * Check if a swap matches price range filter criteria
   */
  private matchesPriceFilter(
    swap: SwapWithBookings,
    priceFilter: PriceRangeFilter
  ): boolean {
    let price: number;

    // For cash swaps, use the cash amount range
    if (swap.swapType === 'cash' && swap.cashDetails) {
      // Use the average of min and max for filtering, or preferred amount if available
      price = swap.cashDetails.preferredAmount ||
        (swap.cashDetails.minAmount + swap.cashDetails.maxAmount) / 2;
    } else {
      // For booking swaps, use the booking value
      price = swap.sourceBooking?.swapValue || swap.sourceBooking?.originalPrice || 0;
    }

    if (priceFilter.min !== undefined && price < priceFilter.min) {
      return false;
    }

    if (priceFilter.max !== undefined && price > priceFilter.max) {
      return false;
    }

    return true;
  }

  /**
   * Check if a regular booking matches price range filter criteria
   */
  private matchesPriceFilterForBooking(
    booking: Booking,
    priceFilter: PriceRangeFilter
  ): boolean {
    const price = booking.swapValue || booking.originalPrice || 0;

    if (priceFilter.min !== undefined && price < priceFilter.min) {
      return false;
    }

    if (priceFilter.max !== undefined && price > priceFilter.max) {
      return false;
    }

    return true;
  }

  /**
   * Get a summary of applied filters for display purposes
   */
  getFilterSummary(filters: SwapFilters, currentUserId: string): string {
    const parts: string[] = [];

    // Core filters are always applied
    parts.push('excluding your own bookings');
    parts.push('excluding cancelled bookings');
    parts.push('excluding expired swaps');
    parts.push('only showing bookings with active swap proposals');

    if (filters.location?.city) {
      parts.push(`in ${filters.location.city}`);
    }

    if (filters.location?.country) {
      parts.push(`in ${filters.location.country}`);
    }

    if (filters.dateRange) {
      const start = filters.dateRange.start.toLocaleDateString();
      const end = filters.dateRange.end.toLocaleDateString();
      parts.push(`from ${start} to ${end}`);
    }

    if (filters.priceRange) {
      const min = filters.priceRange.min;
      const max = filters.priceRange.max;
      if (min !== undefined && max !== undefined) {
        parts.push(`priced between $${min} - $${max}`);
      } else if (min !== undefined) {
        parts.push(`priced above $${min}`);
      } else if (max !== undefined) {
        parts.push(`priced below $${max}`);
      }
    }

    if (filters.swapType && filters.swapType !== 'both') {
      parts.push(`${filters.swapType} swaps only`);
    }

    return parts.join(', ');
  }

  /**
   * Validate filter parameters
   */
  validateFilters(filters: SwapFilters): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (filters.dateRange) {
      if (filters.dateRange.start >= filters.dateRange.end) {
        errors.push('Start date must be before end date');
      }
    }

    if (filters.priceRange) {
      if (filters.priceRange.min !== undefined && filters.priceRange.min < 0) {
        errors.push('Minimum price cannot be negative');
      }

      if (filters.priceRange.max !== undefined && filters.priceRange.max < 0) {
        errors.push('Maximum price cannot be negative');
      }

      if (
        filters.priceRange.min !== undefined &&
        filters.priceRange.max !== undefined &&
        filters.priceRange.min > filters.priceRange.max
      ) {
        errors.push('Minimum price cannot be greater than maximum price');
      }
    }

    if (filters.location?.coordinates) {
      if (filters.location.coordinates.radius <= 0) {
        errors.push('Search radius must be greater than 0');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const swapFilterService = new SwapFilterService();
