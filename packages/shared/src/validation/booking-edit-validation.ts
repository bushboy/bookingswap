/**
 * Validation utilities for booking edit data models
 * Provides TypeScript validation and runtime checks for booking-only operations
 */

import { BookingEditData, BookingEditUpdateData, BookingEditErrors, CreateBookingEditRequest } from '../types/booking-edit';
import { BookingType } from '../types/booking';
import {
  validateBookingType,
  getBookingTypeValidationMessage
} from '../config/booking-types.js';

/**
 * Validates booking edit data for completeness and correctness
 */
export function validateBookingEditData(data: BookingEditData): BookingEditErrors {
  const errors: BookingEditErrors = {};

  // Title validation
  if (!data.title || data.title.trim().length === 0) {
    errors.title = 'Title is required';
  } else if (data.title.length > 200) {
    errors.title = 'Title must be less than 200 characters';
  }

  // Description validation
  if (!data.description || data.description.trim().length === 0) {
    errors.description = 'Description is required';
  } else if (data.description.length > 1000) {
    errors.description = 'Description must be less than 1000 characters';
  }

  // Type validation
  if (!data.type || !validateBookingType(data.type)) {
    errors.type = getBookingTypeValidationMessage();
  }

  // Location validation
  if (!data.location?.city || data.location.city.trim().length === 0) {
    errors.location = 'City is required';
  } else if (!data.location?.country || data.location.country.trim().length === 0) {
    errors.location = 'Country is required';
  }

  // Date range validation
  if (!data.dateRange?.checkIn) {
    errors.dateRange = 'Check-in date is required';
  } else if (new Date(data.dateRange.checkIn) <= new Date()) {
    errors.dateRange = 'Check-in date must be in the future';
  } else if (!data.dateRange?.checkOut) {
    errors.dateRange = 'Check-out date is required';
  } else if (new Date(data.dateRange.checkOut) <= new Date(data.dateRange.checkIn)) {
    errors.dateRange = 'Check-out date must be after check-in date';
  }

  // Price validation
  if (!data.originalPrice || data.originalPrice <= 0) {
    errors.originalPrice = 'Original price must be greater than 0';
  }

  if (!data.swapValue || data.swapValue <= 0) {
    errors.swapValue = 'Swap value must be greater than 0';
  }

  // Provider details validation
  if (!data.providerDetails?.provider || data.providerDetails.provider.trim().length === 0) {
    errors.providerDetails = 'Provider name is required';
  } else if (!data.providerDetails?.confirmationNumber || data.providerDetails.confirmationNumber.trim().length === 0) {
    errors.providerDetails = 'Confirmation number is required';
  } else if (!data.providerDetails?.bookingReference || data.providerDetails.bookingReference.trim().length === 0) {
    errors.providerDetails = 'Booking reference is required';
  }

  return errors;
}

/**
 * Validates partial booking edit data for updates
 */
export function validateBookingEditUpdateData(data: BookingEditUpdateData): BookingEditErrors {
  const errors: BookingEditErrors = {};

  // Only validate fields that are present
  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) {
      errors.title = 'Title cannot be empty';
    } else if (data.title.length > 200) {
      errors.title = 'Title must be less than 200 characters';
    }
  }

  if (data.description !== undefined) {
    if (!data.description || data.description.trim().length === 0) {
      errors.description = 'Description cannot be empty';
    } else if (data.description.length > 1000) {
      errors.description = 'Description must be less than 1000 characters';
    }
  }

  if (data.location !== undefined) {
    if (!data.location?.city || data.location.city.trim().length === 0) {
      errors.location = 'City is required';
    } else if (!data.location?.country || data.location.country.trim().length === 0) {
      errors.location = 'Country is required';
    }
  }

  if (data.dateRange !== undefined) {
    if (!data.dateRange?.checkIn) {
      errors.dateRange = 'Check-in date is required';
    } else if (new Date(data.dateRange.checkIn) <= new Date()) {
      errors.dateRange = 'Check-in date must be in the future';
    } else if (!data.dateRange?.checkOut) {
      errors.dateRange = 'Check-out date is required';
    } else if (new Date(data.dateRange.checkOut) <= new Date(data.dateRange.checkIn)) {
      errors.dateRange = 'Check-out date must be after check-in date';
    }
  }

  if (data.originalPrice !== undefined) {
    if (!data.originalPrice || data.originalPrice <= 0) {
      errors.originalPrice = 'Original price must be greater than 0';
    }
  }

  if (data.swapValue !== undefined) {
    if (!data.swapValue || data.swapValue <= 0) {
      errors.swapValue = 'Swap value must be greater than 0';
    }
  }

  if (data.providerDetails !== undefined) {
    if (!data.providerDetails?.provider || data.providerDetails.provider.trim().length === 0) {
      errors.providerDetails = 'Provider name is required';
    } else if (!data.providerDetails?.confirmationNumber || data.providerDetails.confirmationNumber.trim().length === 0) {
      errors.providerDetails = 'Confirmation number is required';
    } else if (!data.providerDetails?.bookingReference || data.providerDetails.bookingReference.trim().length === 0) {
      errors.providerDetails = 'Booking reference is required';
    }
  }

  return errors;
}

/**
 * Validates create booking request data
 */
export function validateCreateBookingEditRequest(data: CreateBookingEditRequest): BookingEditErrors {
  // Use the same validation as BookingEditData since they have the same structure
  const bookingData: BookingEditData = {
    type: data.type,
    title: data.title,
    description: data.description,
    location: data.location,
    dateRange: data.dateRange,
    originalPrice: data.originalPrice,
    swapValue: data.swapValue,
    providerDetails: data.providerDetails,
  };

  return validateBookingEditData(bookingData);
}

/**
 * Type guard to check if data is valid BookingEditData
 */
export function isValidBookingEditData(data: any): data is BookingEditData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return (
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    validateBookingType(data.type) &&
    data.location &&
    typeof data.location.city === 'string' &&
    typeof data.location.country === 'string' &&
    data.dateRange &&
    data.dateRange.checkIn &&
    data.dateRange.checkOut &&
    typeof data.originalPrice === 'number' &&
    typeof data.swapValue === 'number' &&
    data.providerDetails &&
    typeof data.providerDetails.provider === 'string' &&
    typeof data.providerDetails.confirmationNumber === 'string' &&
    typeof data.providerDetails.bookingReference === 'string'
  );
}

/**
 * Type guard to check if booking type is valid
 * @deprecated Use validateBookingType from booking-types config instead
 */
export function isValidBookingType(type: any): type is BookingType {
  return validateBookingType(type);
}

/**
 * Checks if booking edit data has any validation errors
 */
export function hasBookingEditErrors(errors: BookingEditErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Gets a summary of validation errors for display
 */
export function getBookingEditErrorSummary(errors: BookingEditErrors): string[] {
  return Object.values(errors).filter(error => error !== undefined) as string[];
}

/**
 * Sanitizes booking edit data by trimming strings and normalizing values
 */
export function sanitizeBookingEditData(data: BookingEditData): BookingEditData {
  return {
    ...data,
    title: data.title?.trim() || '',
    description: data.description?.trim() || '',
    location: {
      ...data.location,
      city: data.location?.city?.trim() || '',
      country: data.location?.country?.trim() || '',
    },
    providerDetails: {
      ...data.providerDetails,
      provider: data.providerDetails?.provider?.trim() || '',
      confirmationNumber: data.providerDetails?.confirmationNumber?.trim() || '',
      bookingReference: data.providerDetails?.bookingReference?.trim() || '',
    },
  };
}