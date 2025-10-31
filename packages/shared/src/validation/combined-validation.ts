/**
 * Validation utilities for combined booking and swap operations
 * Provides validation for operations that involve both booking and swap data
 */

import { BookingWithSwapUpdate, BookingWithSwapPartialUpdate, CreateBookingWithSwapRequest, CombinedValidationErrors } from '../types/booking-with-swap-update.js';
import { validateBookingEditData, validateBookingEditUpdateData } from './booking-edit-validation.js';
import { validateSwapSpecificationData, validateSwapSpecificationUpdateData, validateCashAmountConsistency } from './swap-specification-validation.js';

/**
 * Validates combined booking and swap data
 */
export function validateBookingWithSwapUpdate(data: BookingWithSwapUpdate): CombinedValidationErrors {
  const errors: CombinedValidationErrors = {};

  // Validate booking data
  const bookingErrors = validateBookingEditData(data.bookingData);
  if (Object.keys(bookingErrors).length > 0) {
    errors.bookingErrors = bookingErrors;
  }

  // Validate swap data if present
  if (data.swapData) {
    const swapErrors = validateSwapSpecificationData(data.swapData);
    if (Object.keys(swapErrors).length > 0) {
      errors.swapErrors = swapErrors;
    }

    // Cross-validation between booking and swap data
    const crossValidationErrors = validateBookingSwapConsistency(data.bookingData, data.swapData);
    if (crossValidationErrors.length > 0) {
      errors.generalErrors = crossValidationErrors;
    }
  }

  return errors;
}

/**
 * Validates partial combined booking and swap data updates
 */
export function validateBookingWithSwapPartialUpdate(data: BookingWithSwapPartialUpdate): CombinedValidationErrors {
  const errors: CombinedValidationErrors = {};

  // Validate booking data if present
  if (data.bookingData) {
    const bookingErrors = validateBookingEditUpdateData(data.bookingData);
    if (Object.keys(bookingErrors).length > 0) {
      errors.bookingErrors = bookingErrors;
    }
  }

  // Validate swap data if present
  if (data.swapData) {
    const swapErrors = validateSwapSpecificationUpdateData(data.swapData);
    if (Object.keys(swapErrors).length > 0) {
      errors.swapErrors = swapErrors;
    }

    // Validate cash amount consistency
    const consistencyErrors = validateCashAmountConsistency(data.swapData);
    if (Object.keys(consistencyErrors).length > 0) {
      if (!errors.swapErrors) errors.swapErrors = {};
      Object.assign(errors.swapErrors, consistencyErrors);
    }
  }

  return errors;
}

/**
 * Validates create booking with swap request
 */
export function validateCreateBookingWithSwapRequest(data: CreateBookingWithSwapRequest): CombinedValidationErrors {
  const errors: CombinedValidationErrors = {};

  // Validate booking data
  const bookingErrors = validateBookingEditData(data.bookingData);
  if (Object.keys(bookingErrors).length > 0) {
    errors.bookingErrors = bookingErrors;
  }

  // Validate swap data if present
  if (data.swapData) {
    const swapErrors = validateSwapSpecificationData(data.swapData);
    if (Object.keys(swapErrors).length > 0) {
      errors.swapErrors = swapErrors;
    }

    // Cross-validation
    const crossValidationErrors = validateBookingSwapConsistency(data.bookingData, data.swapData);
    if (crossValidationErrors.length > 0) {
      errors.generalErrors = crossValidationErrors;
    }
  }

  return errors;
}

/**
 * Validates consistency between booking and swap data
 */
function validateBookingSwapConsistency(bookingData: any, swapData: any): string[] {
  const errors: string[] = [];

  // Ensure swap value is reasonable compared to original price
  if (bookingData.originalPrice && bookingData.swapValue) {
    const priceRatio = bookingData.swapValue / bookingData.originalPrice;
    if (priceRatio > 2.0) {
      errors.push('Swap value seems unusually high compared to original price');
    } else if (priceRatio < 0.1) {
      errors.push('Swap value seems unusually low compared to original price');
    }
  }

  // Validate cash amounts against booking value
  if (swapData.paymentTypes?.includes('cash') && bookingData.swapValue) {
    if (swapData.minCashAmount && swapData.minCashAmount > bookingData.swapValue * 1.5) {
      errors.push('Minimum cash amount is significantly higher than booking swap value');
    }
    if (swapData.maxCashAmount && swapData.maxCashAmount < bookingData.swapValue * 0.5) {
      errors.push('Maximum cash amount is significantly lower than booking swap value');
    }
  }

  // Validate auction end date against booking dates
  if (swapData.auctionEndDate && bookingData.dateRange?.checkIn) {
    const auctionEnd = new Date(swapData.auctionEndDate);
    const checkIn = new Date(bookingData.dateRange.checkIn);
    const daysBetween = (checkIn.getTime() - auctionEnd.getTime()) / (1000 * 60 * 60 * 24);

    if (daysBetween < 7) {
      errors.push('Auction should end at least 7 days before the booking check-in date');
    }
  }

  return errors;
}

/**
 * Checks if combined validation has any errors
 */
export function hasCombinedValidationErrors(errors: CombinedValidationErrors): boolean {
  return !!(
    (errors.bookingErrors && Object.keys(errors.bookingErrors).length > 0) ||
    (errors.swapErrors && Object.keys(errors.swapErrors).length > 0) ||
    (errors.generalErrors && errors.generalErrors.length > 0)
  );
}

/**
 * Gets a summary of all validation errors for display
 */
export function getCombinedValidationErrorSummary(errors: CombinedValidationErrors): string[] {
  const summary: string[] = [];

  if (errors.bookingErrors) {
    const bookingErrorMessages = Object.values(errors.bookingErrors).filter(error => error !== undefined) as string[];
    summary.push(...bookingErrorMessages.map(msg => `Booking: ${msg}`));
  }

  if (errors.swapErrors) {
    const swapErrorMessages = Object.values(errors.swapErrors).filter(error => error !== undefined) as string[];
    summary.push(...swapErrorMessages.map(msg => `Swap: ${msg}`));
  }

  if (errors.generalErrors) {
    summary.push(...errors.generalErrors);
  }

  return summary;
}

/**
 * Type guard to check if data is valid for combined operations
 */
export function isValidBookingWithSwapData(data: any): data is BookingWithSwapUpdate {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return (
    data.bookingData &&
    typeof data.bookingData === 'object' &&
    (!data.swapData || typeof data.swapData === 'object')
  );
}

/**
 * Validates data model separation - ensures booking data doesn't contain swap fields
 */
export function validateDataModelSeparation(bookingData: any, swapData: any): string[] {
  const errors: string[] = [];

  // Check that booking data doesn't contain swap-specific fields
  const swapFields = ['paymentTypes', 'minCashAmount', 'maxCashAmount', 'acceptanceStrategy', 'auctionEndDate', 'swapConditions', 'swapEnabled'];
  const bookingSwapFields = swapFields.filter(field => bookingData.hasOwnProperty(field));

  if (bookingSwapFields.length > 0) {
    errors.push(`Booking data contains swap-specific fields: ${bookingSwapFields.join(', ')}`);
  }

  // Check that swap data doesn't contain booking-specific fields (except bookingId)
  const bookingFields = ['title', 'description', 'location', 'dateRange', 'originalPrice', 'swapValue', 'providerDetails', 'type'];
  const swapBookingFields = bookingFields.filter(field => swapData && swapData.hasOwnProperty(field));

  if (swapBookingFields.length > 0) {
    errors.push(`Swap data contains booking-specific fields: ${swapBookingFields.join(', ')}`);
  }

  return errors;
}