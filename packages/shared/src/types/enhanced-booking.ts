/**
 * Enhanced booking types for UI simplification feature
 * Integrates swap functionality directly into booking workflows
 */

import { Booking, BookingLocation, BookingDateRange, BookingProviderDetails, BookingType } from './booking.js';
import { SwapPreferences, PaymentTypePreference, AcceptanceStrategy } from './swap.js';

// Enhanced swap preferences for unified booking form
export interface SwapPreferencesData {
  paymentTypes: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy: 'first-match' | 'auction';
  auctionEndDate?: Date;
  swapConditions: string[];
}

// Unified booking data interface that combines booking and swap creation
export interface UnifiedBookingData {
  // Core booking fields
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;

  // Integrated swap fields
  swapEnabled: boolean;
  swapPreferences?: SwapPreferencesData;
}

// Swap information to be displayed with booking listings
export interface SwapInfo {
  swapId: string;
  paymentTypes: ('booking' | 'cash')[];
  acceptanceStrategy: 'first-match' | 'auction';
  auctionEndDate?: Date;
  minCashAmount?: number;
  maxCashAmount?: number;
  hasActiveProposals: boolean;
  activeProposalCount: number;
  userProposalStatus?: 'none' | 'pending' | 'accepted' | 'rejected';
  timeRemaining?: number; // milliseconds until auction end
  swapConditions: string[];
  hasAnySwapInitiated: boolean; // Indicates if any swap has been initiated (regardless of status)
}

// Enhanced booking interface that includes swap information for listings
export interface BookingWithSwapInfo extends Booking {
  swapInfo?: SwapInfo;
}

// Data structure for inline proposal forms
export interface InlineProposalData {
  type: 'booking' | 'cash';
  selectedBookingId?: string;
  cashAmount?: number;
  paymentMethodId?: string;
  message?: string;
  conditions?: string[];
}

// Enhanced booking filters that include swap-specific filtering options
export interface EnhancedBookingFilters {
  // Core booking filters
  type?: BookingType[];
  location?: {
    city?: string;
    country?: string;
    radius?: number; // km
  };
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  priceRange?: {
    min?: number;
    max?: number;
  };

  // Swap-specific filters
  swapAvailable?: boolean;
  acceptsCash?: boolean;
  auctionMode?: boolean;
  swapType?: 'booking' | 'cash' | 'both';
  minCashAmount?: number;
  maxCashAmount?: number;

  // Search and sorting
  query?: string;
  sortBy?: 'created_date' | 'event_date' | 'price' | 'auction_end_date' | 'swap_value';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Validation error structure for unified forms
export interface UnifiedFormValidationErrors {
  // Booking validation errors
  title?: string;
  description?: string;
  location?: string;
  dateRange?: string;
  originalPrice?: string;
  swapValue?: string;
  providerDetails?: string;

  // Swap validation errors
  paymentTypes?: string;
  minCashAmount?: string;
  maxCashAmount?: string;
  acceptanceStrategy?: string;
  auctionEndDate?: string;
  swapConditions?: string;

  // Index signature to make it compatible with Record<string, string>
  [key: string]: string | undefined;
}

// Response type for unified booking creation
export interface UnifiedBookingResponse {
  booking: Booking;
  swap?: {
    id: string;
    status: string;
    paymentTypes: ('booking' | 'cash')[];
    acceptanceStrategy: 'first-match' | 'auction';
  };
}

// Request type for updating booking with swap preferences (legacy unified approach)
export interface LegacyUpdateBookingWithSwapRequest {
  bookingData: Partial<UnifiedBookingData>;
  swapEnabled: boolean;
  swapPreferences?: SwapPreferencesData;
}

// Filter summary for display purposes
export interface FilterSummary {
  activeFilters: number;
  bookingFilters: string[];
  swapFilters: string[];
  resultCount?: number;
}

// UI state types for managing inline proposal forms
export interface InlineProposalState {
  [bookingId: string]: {
    isOpen: boolean;
    proposalType: 'booking' | 'cash';
    loading: boolean;
    error?: string;
  };
}

// Enhanced booking form state
export interface BookingFormState {
  isOpen: boolean;
  mode: 'create' | 'edit';
  bookingId?: string;
  swapEnabled: boolean;
  loading: boolean;
  error?: string;
}

// User role context for booking interactions
export type BookingUserRole = 'owner' | 'browser' | 'proposer';

// Booking action types for different user roles
export interface BookingActions {
  canEdit: boolean;
  canDelete: boolean;
  canMakeProposal: boolean;
  canManageSwap: boolean;
  canViewProposals: boolean;
}

// Enhanced booking list item for optimized rendering
export interface BookingListItem {
  id: string;
  title: string;
  location: string;
  dateRange: string;
  price: number;
  swapAvailable: boolean;
  swapBadge?: {
    type: 'cash' | 'booking' | 'both';
    urgency?: 'normal' | 'ending-soon' | 'last-chance';
  };
  userRole: BookingUserRole;
  actions: BookingActions;
}