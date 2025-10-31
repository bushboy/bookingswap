/**
 * Combined interface for operations that need both booking and swap data
 * This file contains interfaces for scenarios where both booking and swap
 * operations need to be performed together
 */

import { BookingEditData, BookingEditUpdateData } from './booking-edit.js';
import { SwapSpecificationData, SwapSpecificationUpdateData } from './swap-specification.js';

/**
 * Interface for combined booking and swap operations
 * Used when both booking data and swap preferences need to be updated together
 */
export interface BookingWithSwapUpdate {
  bookingData: BookingEditData;
  swapData?: SwapSpecificationData;
}

/**
 * Interface for partial updates that may affect both booking and swap data
 */
export interface BookingWithSwapPartialUpdate {
  bookingData?: BookingEditUpdateData;
  swapData?: SwapSpecificationUpdateData;
}

/**
 * Request interface for creating a booking with immediate swap specification
 */
export interface CreateBookingWithSwapRequest {
  bookingData: BookingEditData;
  swapData?: SwapSpecificationData;
  documents?: File[];
}

/**
 * Request interface for updating both booking and swap data
 */
export interface UpdateBookingWithSwapRequest {
  bookingData?: BookingEditUpdateData;
  swapData?: SwapSpecificationUpdateData;
  swapEnabled: boolean;
}

/**
 * Response interface for combined booking and swap operations
 */
export interface BookingWithSwapResponse {
  booking: BookingEditData & {
    id: string;
    userId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  swap?: SwapSpecificationData & {
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  nftInfo?: {
    tokenId: string;
    serialNumber: number;
    transactionId: string;
  };
  validationWarnings?: string[];
}

/**
 * Interface for validation errors that may span both booking and swap data
 */
export interface CombinedValidationErrors {
  bookingErrors?: Record<string, string | undefined>;
  swapErrors?: Record<string, string | undefined>;
  generalErrors?: string[];
}

/**
 * Interface for atomic operations that ensure data consistency
 * between booking and swap operations
 */
export interface AtomicBookingSwapOperation {
  operation: 'create' | 'update' | 'delete';
  bookingChanges?: BookingEditUpdateData;
  swapChanges?: SwapSpecificationUpdateData;
  rollbackStrategy: 'booking_first' | 'swap_first' | 'transaction';
}