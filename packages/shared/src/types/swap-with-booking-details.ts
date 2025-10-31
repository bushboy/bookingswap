import { Swap } from './swap.js';

/**
 * Simplified booking details interface for swap display purposes
 * Contains only the essential information needed to display booking details in swap lists
 */
export interface BookingDetails {
    id: string;
    title: string;
    location: {
        city: string;
        country: string;
    };
    dateRange: {
        checkIn: Date;
        checkOut: Date;
    };
    originalPrice: number | null;
    swapValue: number | null;
}

/**
 * Enhanced swap interface that includes complete booking details
 * for both source and target bookings, eliminating the need for
 * separate booking detail fetches on the frontend
 */
export interface SwapWithBookingDetails extends Swap {
    sourceBooking: BookingDetails | null;
    targetBooking: BookingDetails | null;
}

/**
 * Metadata about data completeness for swap responses
 * Provides information about the quality and availability of booking data
 */
export interface SwapDataCompletenessMetadata {
    totalSwaps: number;
    sourceBookingCompleteness: number; // Percentage (0-100)
    targetBookingCompleteness: number; // Percentage (0-100)
    swapsWithMissingData: number;
    hasPartialData: boolean;
    fallbackUsed: boolean;
    errorDetails?: string;
}

/**
 * Enhanced response interface that includes swap data with completeness metadata
 * Used for API responses that need to communicate data quality to the frontend
 */
export interface SwapWithBookingDetailsResponse {
    swaps: SwapWithBookingDetails[];
    metadata: SwapDataCompletenessMetadata;
    pagination: {
        limit: number;
        offset: number;
        total: number;
    };
}