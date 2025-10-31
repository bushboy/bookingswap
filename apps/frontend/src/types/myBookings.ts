/**
 * Type definitions for My Bookings page simplified filtering system
 * 
 * This module provides type-safe interfaces for the simplified filtering approach
 * used in personal booking management, replacing complex browse-style filtering
 * with status-based filtering appropriate for "My Bookings" use case.
 * 
 * REPLACED COMPLEX TYPES:
 * - EnhancedBookingFilters: Removed complex search, location, price range filters
 * - IntegratedFilterPanel types: Replaced with simple status-based filtering
 * - Browse-style filter interfaces: Not needed for personal booking management
 * 
 * Requirements satisfied:
 * - 5.1: Basic filter options for status (all, active, with_swaps, completed, expired)
 * - 5.2: Clear status indicators for each booking
 * - 8.4: Type safety throughout the refactored filtering system
 */

import { MyBookingsStatus } from '@/components/booking/MyBookingsFilterBar';

/**
 * Simple filter interface for personal booking management
 * Replaces complex EnhancedBookingFilters with status-only filtering
 */
export interface MyBookingsFilters {
  status: MyBookingsStatus;
}

/**
 * Type for booking counts used in filter bar badges
 * Provides count for each status category to display in filter tabs
 */
export type BookingCounts = Record<MyBookingsStatus, number>;

/**
 * Helper type for booking status determination
 * Used internally for categorizing bookings into status groups
 */
export type BookingStatus = 'active' | 'with_swaps' | 'completed' | 'expired';

/**
 * Type guard for validating booking objects
 * Ensures booking data integrity for filtering operations
 */
export interface BookingValidation {
  isValid: boolean;
  errors?: string[];
}

/**
 * Filter statistics for debugging and monitoring
 * Provides insights into filtering performance and data quality
 */
export interface FilterStatistics {
  total: number;
  counts: BookingCounts;
  currentFilter: MyBookingsStatus;
  filteredCount: number;
  validBookings: number;
}