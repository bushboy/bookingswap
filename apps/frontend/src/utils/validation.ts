import {
  UnifiedBookingData,
  UnifiedFormValidationErrors,
  SwapPreferencesData,
  validateUnifiedBookingData as validateUnifiedBookingDataShared,
  validateSwapPreferences as validateSwapPreferencesShared,
  validateUnifiedField as validateUnifiedFieldShared,
  hasValidationErrors as hasValidationErrorsShared,
  getValidationErrorCount as getValidationErrorCountShared
} from '@booking-swap/shared';

/**
 * Types for validation results
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FieldValidation {
  fieldName: string;
  value: any;
  result: ValidationResult;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationEngine {
  validate: (data: any) => ValidationResult;
  validateField: (field: string, value: any) => ValidationResult;
}

/**
 * Validates a single field value
 */
export const validateField = (field: string, value: any, formData?: UnifiedBookingData): string => {
  switch (field) {
    case 'title':
      if (!value?.trim()) return 'Title is required';
      if (value.length < 3) return 'Title must be at least 3 characters';
      if (value.length > 255) return 'Title must be less than 255 characters';
      return '';

    case 'description':
      if (!value?.trim()) return 'Description is required';
      if (value.length < 10) return 'Description must be at least 10 characters';
      if (value.length > 1000) return 'Description must be less than 1000 characters';
      return '';

    case 'city':
      if (!value?.trim()) return 'City is required';
      if (value.length < 2) return 'City must be at least 2 characters';
      return '';

    case 'country':
      if (!value?.trim()) return 'Country is required';
      if (value.length < 2) return 'Country must be at least 2 characters';
      return '';

    case 'originalPrice':
      if (!value || value <= 0) return 'Original price must be greater than 0';
      if (value > 100000) return 'Original price seems too high (max $100,000)';
      return '';

    case 'swapValue':
      if (!value || value <= 0) return 'Swap value must be greater than 0';
      if (value > 100000) return 'Swap value seems too high (max $100,000)';
      return '';

    case 'provider':
      if (!value?.trim()) return 'Provider is required';
      if (value.length < 2) return 'Provider name must be at least 2 characters';
      if (value.length > 100) return 'Provider name must be less than 100 characters';
      // Check for invalid characters (allow letters, numbers, spaces, hyphens, periods, apostrophes, and ampersands)
      const validProviderPattern = /^[a-zA-Z0-9\s\-\.'&]+$/;
      if (!validProviderPattern.test(value)) {
        return 'Provider name can only contain letters, numbers, spaces, hyphens, periods, apostrophes, and ampersands';
      }
      return '';

    case 'confirmationNumber':
      if (!value?.trim()) return 'Confirmation number is required';
      if (value.length < 3) return 'Confirmation number must be at least 3 characters';
      return '';

    case 'checkIn':
      if (!value) return 'Check-in date is required';
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(value) < today) return 'Check-in date cannot be in the past';
      return '';

    case 'checkOut':
      if (!value) return 'Check-out date is required';
      if (formData?.dateRange.checkIn && new Date(value) <= new Date(formData.dateRange.checkIn)) {
        return 'Check-out date must be after check-in date';
      }
      return '';

    default:
      return '';
  }
};

/**
 * Validates swap preferences when swap is enabled
 * Uses shared validation logic with frontend-specific enhancements
 */
export const validateSwapPreferences = (
  preferences: SwapPreferencesData,
  eventDate: Date
): Partial<UnifiedFormValidationErrors> => {
  return validateSwapPreferencesShared(preferences, eventDate);
};

/**
 * Validates the complete unified booking form
 * Uses shared validation logic with frontend-specific enhancements
 */
export const validateUnifiedBookingData = (data: UnifiedBookingData): UnifiedFormValidationErrors => {
  return validateUnifiedBookingDataShared(data);
};

/**
 * Checks if the form has any validation errors
 */
export const hasValidationErrors = (errors: UnifiedFormValidationErrors): boolean => {
  return hasValidationErrorsShared(errors);
};

/**
 * Gets the count of validation errors
 */
export const getValidationErrorCount = (errors: UnifiedFormValidationErrors): number => {
  return getValidationErrorCountShared(errors);
};

/**
 * Validates a single field with enhanced frontend logic
 */
export const validateUnifiedField = (
  fieldName: string,
  value: any,
  formData?: Partial<UnifiedBookingData>
): string => {
  return validateUnifiedFieldShared(fieldName, value, formData);
};

/**
 * Validates custom provider input with enhanced rules
 */
export const validateCustomProvider = (value: string): string => {
  if (!value?.trim()) {
    return 'Custom provider name is required when "Other" is selected';
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length < 2) {
    return 'Provider name must be at least 2 characters';
  }

  if (trimmedValue.length > 100) {
    return 'Provider name must be less than 100 characters';
  }

  // Check for invalid characters (allow letters, numbers, spaces, hyphens, periods, apostrophes, and ampersands)
  const validProviderPattern = /^[a-zA-Z0-9\s\-\.'&]+$/;
  if (!validProviderPattern.test(trimmedValue)) {
    return 'Provider name can only contain letters, numbers, spaces, hyphens, periods, apostrophes, and ampersands';
  }

  // Check for excessive whitespace
  if (trimmedValue.includes('  ')) {
    return 'Provider name cannot contain multiple consecutive spaces';
  }

  // Check for leading/trailing special characters
  const firstChar = trimmedValue[0];
  const lastChar = trimmedValue[trimmedValue.length - 1];
  if (['-', '.', "'", '&'].includes(firstChar) || ['-', '.', "'", '&'].includes(lastChar)) {
    return 'Provider name cannot start or end with special characters';
  }

  return '';
};

/**
 * Validates provider selection with enhanced error messaging
 */
export const validateProviderSelection = (
  selectedProvider: string,
  customProvider: string,
  isOtherProvider: boolean
): string => {
  if (isOtherProvider) {
    return validateCustomProvider(customProvider);
  }

  if (!selectedProvider?.trim()) {
    return 'Please select a booking provider from the dropdown';
  }

  return '';
};

/**
 * Creates a debounced validator function for real-time validation feedback
 */
export const createDebouncedValidator = (
  validationFn: (...args: any[]) => any,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: any[]) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(validationFn(...args));
      }, delay);
    });
  };
};/**

 * Formats validation errors for display
 */
export const formatValidationErrors = (errors: ValidationError[]): string[] => {
  return errors.map(error => error.message);
};

/**
 * Parses server validation errors into a standardized format
 */
export const parseServerValidationErrors = (serverErrors: any): ValidationError[] => {
  if (!serverErrors) return [];

  if (Array.isArray(serverErrors)) {
    return serverErrors.map(error => ({
      field: error.field || 'unknown',
      message: error.message || 'Validation error',
      code: error.code
    }));
  }

  if (typeof serverErrors === 'object') {
    return Object.entries(serverErrors).map(([field, message]) => ({
      field,
      message: Array.isArray(message) ? message[0] : String(message)
    }));
  }

  return [{
    field: 'general',
    message: String(serverErrors)
  }];
};

/**
 * Validates swap creation form data
 * Returns validation results for each field that can be used for real-time validation
 */
export const validateSwapCreationForm = (
  formData: any,
  eventDate?: Date
): Record<string, ValidationResult> => {
  const results: Record<string, ValidationResult> = {};

  // Validate title
  results.title = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!formData.title?.trim()) {
    results.title.isValid = false;
    results.title.errors.push('Title is required');
  } else if (formData.title.length < 5) {
    results.title.isValid = false;
    results.title.errors.push('Title must be at least 5 characters');
  } else if (formData.title.length > 200) {
    results.title.isValid = false;
    results.title.errors.push('Title must be less than 200 characters');
  }

  // Validate description
  results.description = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!formData.description?.trim()) {
    results.description.isValid = false;
    results.description.errors.push('Description is required');
  } else if (formData.description.length < 20) {
    results.description.isValid = false;
    results.description.errors.push('Description must be at least 20 characters');
  } else if (formData.description.length > 2000) {
    results.description.isValid = false;
    results.description.errors.push('Description must be less than 2000 characters');
  }

  // Validate expiration date
  results.expirationDate = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (!formData.expirationDate) {
    results.expirationDate.isValid = false;
    results.expirationDate.errors.push('Expiration date is required');
  } else {
    const expirationDate = new Date(formData.expirationDate);
    const now = new Date();

    if (expirationDate <= now) {
      results.expirationDate.isValid = false;
      results.expirationDate.errors.push('Expiration date must be in the future');
    }

    // Check if expiration is too far in the future (more than 6 months)
    const sixMonthsFromNow = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
    if (expirationDate > sixMonthsFromNow) {
      results.expirationDate.warnings.push('Expiration date is more than 6 months away');
    }
  }

  // Validate payment types
  results.paymentTypes = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (formData.paymentTypes) {
    const { bookingExchange, cashPayment, minimumCashAmount } = formData.paymentTypes;

    if (!bookingExchange && !cashPayment) {
      results.paymentTypes.isValid = false;
      results.paymentTypes.errors.push('At least one payment type must be enabled');
    }

    if (cashPayment && minimumCashAmount && minimumCashAmount <= 0) {
      results.paymentTypes.isValid = false;
      results.paymentTypes.errors.push('Minimum cash amount must be greater than 0');
    }
  }

  // Validate acceptance strategy and auction settings
  results.acceptanceStrategy = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (formData.acceptanceStrategy) {
    const { type, auctionEndDate } = formData.acceptanceStrategy;

    if (type === 'auction') {
      if (!auctionEndDate) {
        results.acceptanceStrategy.isValid = false;
        results.acceptanceStrategy.errors.push('Auction end date is required for auction mode');
      } else {
        const endDate = new Date(auctionEndDate);
        const now = new Date();

        if (endDate <= now) {
          results.acceptanceStrategy.isValid = false;
          results.acceptanceStrategy.errors.push('Auction end date must be in the future');
        }

        // Check auction timing relative to event date
        if (eventDate) {
          const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
          const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);
          const isLastMinute = eventDate.getTime() - now.getTime() < oneWeekInMs;

          if (isLastMinute) {
            results.acceptanceStrategy.isValid = false;
            results.acceptanceStrategy.errors.push('Auctions are not allowed for events less than one week away');
          } else if (endDate >= oneWeekBeforeEvent) {
            results.acceptanceStrategy.isValid = false;
            results.acceptanceStrategy.errors.push('Auction must end at least one week before the event date');
          }
        }

        // Check if auction end date is before expiration date
        if (formData.expirationDate) {
          const expirationDate = new Date(formData.expirationDate);
          if (endDate >= expirationDate) {
            results.acceptanceStrategy.isValid = false;
            results.acceptanceStrategy.errors.push('Auction end date must be before swap expiration date');
          }
        }
      }
    }
  }

  // Validate auction settings if present
  if (formData.auctionSettings) {
    results.auctionSettings = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const { allowBookingProposals, allowCashProposals, minimumCashOffer } = formData.auctionSettings;

    if (!allowBookingProposals && !allowCashProposals) {
      results.auctionSettings.isValid = false;
      results.auctionSettings.errors.push('At least one proposal type must be allowed');
    }

    if (allowCashProposals && minimumCashOffer && minimumCashOffer <= 0) {
      results.auctionSettings.isValid = false;
      results.auctionSettings.errors.push('Minimum cash offer must be greater than 0');
    }
  }

  // Validate swap preferences
  results.swapPreferences = {
    isValid: true,
    errors: [],
    warnings: []
  };

  if (formData.swapPreferences) {
    const { preferredLocations, additionalRequirements } = formData.swapPreferences;

    if (preferredLocations && preferredLocations.length > 10) {
      results.swapPreferences.warnings.push('Too many preferred locations may limit matches');
    }

    if (additionalRequirements) {
      for (const requirement of additionalRequirements) {
        if (requirement && requirement.length > 500) {
          results.swapPreferences.isValid = false;
          results.swapPreferences.errors.push('Each additional requirement must be less than 500 characters');
          break;
        }
      }
    }
  }

  return results;
};