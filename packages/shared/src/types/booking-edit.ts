/**
 * Separated data models for booking edit operations
 * This file contains interfaces specifically for booking-only operations,
 * separated from swap-related functionality
 */

import { BookingType, BookingLocation, BookingDateRange, BookingProviderDetails } from './booking.js';

/**
 * Interface for booking edit data - contains only booking-related fields
 * Excludes swap preferences and swap-specific data
 */
export interface BookingEditData {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
}

/**
 * Interface for partial booking updates during edit operations
 */
export interface BookingEditUpdateData {
  title?: string;
  description?: string;
  location?: BookingLocation;
  dateRange?: BookingDateRange;
  originalPrice?: number;
  swapValue?: number;
  providerDetails?: BookingProviderDetails;
}

/**
 * Validation errors specific to booking edit operations
 */
export interface BookingEditErrors {
  title?: string;
  description?: string;
  location?: string;
  dateRange?: string;
  originalPrice?: string;
  swapValue?: string;
  providerDetails?: string;
  [key: string]: string | undefined;
}

/**
 * Request interface for creating bookings (booking-only data)
 */
export interface CreateBookingEditRequest {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  documents?: File[];
}

/**
 * Request interface for updating bookings (booking-only data)
 */
export interface UpdateBookingEditRequest {
  title?: string;
  description?: string;
  location?: BookingLocation;
  dateRange?: BookingDateRange;
  originalPrice?: number;
  swapValue?: number;
  providerDetails?: BookingProviderDetails;
}

/**
 * Response interface for booking edit operations
 */
export interface BookingEditResponse {
  booking: BookingEditData & {
    id: string;
    userId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  validationWarnings?: string[];
}