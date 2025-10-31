/**
 * Validation utilities for unified booking and swap forms
 * Provides comprehensive validation for integrated booking-swap workflows
 */

import Joi from '@hapi/joi';
import {
  UnifiedBookingData,
  SwapPreferencesData,
  UnifiedFormValidationErrors,
  InlineProposalData,
} from '../types/enhanced-booking';
import {
  getBookingTypeValidationValues,
  getBookingTypeValidationMessage
} from '../config/booking-types.js';

// Validation schema for swap preferences
const swapPreferencesSchema = Joi.object({
  paymentTypes: Joi.array()
    .items(Joi.string().valid('booking', 'cash'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one payment type must be selected',
      'any.required': 'Payment types are required',
    }),

  minCashAmount: Joi.when('paymentTypes', {
    is: Joi.array().items(Joi.string().valid('cash')),
    then: Joi.number().positive().required().messages({
      'number.positive': 'Minimum cash amount must be greater than 0',
      'any.required': 'Minimum cash amount is required for cash swaps',
    }),
    otherwise: Joi.number().positive().optional(),
  }),

  maxCashAmount: Joi.when('minCashAmount', {
    is: Joi.exist(),
    then: Joi.number().greater(Joi.ref('minCashAmount')).optional().messages({
      'number.greater': 'Maximum cash amount must be greater than minimum',
    }),
    otherwise: Joi.number().positive().optional(),
  }),

  acceptanceStrategy: Joi.string()
    .valid('first-match', 'auction')
    .required()
    .messages({
      'any.only': 'Acceptance strategy must be either first-match or auction',
      'any.required': 'Acceptance strategy is required',
    }),

  auctionEndDate: Joi.when('acceptanceStrategy', {
    is: 'auction',
    then: Joi.date().greater('now').required().messages({
      'date.greater': 'Auction end date must be in the future',
      'any.required': 'Auction end date is required for auction mode',
    }),
    otherwise: Joi.date().optional(),
  }),

  swapConditions: Joi.array().items(Joi.string().max(500)).max(10).default([]),
});

// Enhanced unified booking validation schema
export const unifiedBookingSchema = Joi.object({
  // Core booking fields
  type: Joi.string()
    .valid(...getBookingTypeValidationValues())
    .required()
    .messages({
      'any.only': getBookingTypeValidationMessage(),
      'any.required': 'Booking type is required',
    }),

  title: Joi.string()
    .trim()
    .min(3)
    .max(255)
    .required()
    .messages({
      'string.empty': 'Title is required',
      'string.min': 'Title must be at least 3 characters',
      'string.max': 'Title must be less than 255 characters',
      'any.required': 'Title is required',
    }),

  description: Joi.string()
    .trim()
    .min(10)
    .max(1000)
    .required()
    .messages({
      'string.empty': 'Description is required',
      'string.min': 'Description must be at least 10 characters',
      'string.max': 'Description must be less than 1000 characters',
      'any.required': 'Description is required',
    }),

  location: Joi.object({
    city: Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'City is required',
      'string.min': 'City must be at least 2 characters',
      'any.required': 'City is required',
    }),
    country: Joi.string().trim().min(2).max(100).required().messages({
      'string.empty': 'Country is required',
      'string.min': 'Country must be at least 2 characters',
      'any.required': 'Country is required',
    }),
    coordinates: Joi.array().items(Joi.number()).length(2).optional(),
  }).required(),

  dateRange: Joi.object({
    checkIn: Joi.date().min('now').required().messages({
      'date.min': 'Check-in date cannot be in the past',
      'any.required': 'Check-in date is required',
    }),
    checkOut: Joi.date().greater(Joi.ref('checkIn')).required().messages({
      'date.greater': 'Check-out date must be after check-in date',
      'any.required': 'Check-out date is required',
    }),
  }).required(),

  originalPrice: Joi.number()
    .positive()
    .max(100000)
    .required()
    .messages({
      'number.positive': 'Original price must be greater than 0',
      'number.max': 'Original price seems too high (max $100,000)',
      'any.required': 'Original price is required',
    }),

  swapValue: Joi.number()
    .positive()
    .max(100000)
    .required()
    .messages({
      'number.positive': 'Swap value must be greater than 0',
      'number.max': 'Swap value seems too high (max $100,000)',
      'any.required': 'Swap value is required',
    }),

  providerDetails: Joi.object({
    provider: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Provider is required',
      'any.required': 'Provider is required',
    }),
    confirmationNumber: Joi.string().trim().min(3).max(100).required().messages({
      'string.empty': 'Confirmation number is required',
      'string.min': 'Confirmation number must be at least 3 characters',
      'any.required': 'Confirmation number is required',
    }),
    bookingReference: Joi.string().trim().max(100).optional().allow(''),
  }).required(),

  // Swap integration fields
  swapEnabled: Joi.boolean().default(false),

  swapPreferences: Joi.when('swapEnabled', {
    is: true,
    then: swapPreferencesSchema.required().messages({
      'any.required': 'Swap preferences are required when swap is enabled',
    }),
    otherwise: Joi.optional(),
  }),
});

// Inline proposal validation schema
export const inlineProposalSchema = Joi.object({
  type: Joi.string()
    .valid('booking', 'cash')
    .required()
    .messages({
      'any.only': 'Proposal type must be booking or cash',
      'any.required': 'Proposal type is required',
    }),

  selectedBookingId: Joi.when('type', {
    is: 'booking',
    then: Joi.string().required().messages({
      'any.required': 'A booking must be selected for booking proposals',
    }),
    otherwise: Joi.optional(),
  }),

  cashAmount: Joi.when('type', {
    is: 'cash',
    then: Joi.number().positive().required().messages({
      'number.positive': 'Cash amount must be greater than 0',
      'any.required': 'Cash amount is required for cash proposals',
    }),
    otherwise: Joi.optional(),
  }),

  paymentMethodId: Joi.when('type', {
    is: 'cash',
    then: Joi.string().required().messages({
      'any.required': 'Payment method is required for cash proposals',
    }),
    otherwise: Joi.optional(),
  }),

  message: Joi.string().max(500).optional(),

  conditions: Joi.array().items(Joi.string().max(200)).max(5).default([]),
});

/**
 * Validates unified booking data with integrated swap preferences
 */
export const validateUnifiedBookingData = (
  data: UnifiedBookingData
): UnifiedFormValidationErrors => {
  const { error } = unifiedBookingSchema.validate(data, {
    abortEarly: false,
    allowUnknown: false,
  });

  const errors: UnifiedFormValidationErrors = {};

  if (error) {
    error.details.forEach(detail => {
      const path = detail.path.join('.');
      errors[path] = detail.message;
    });
  }

  // Cross-field validation for auction timing
  if (data.swapEnabled && data.swapPreferences?.acceptanceStrategy === 'auction') {
    const auctionEndDate = data.swapPreferences.auctionEndDate;
    const eventDate = data.dateRange.checkIn;

    if (auctionEndDate && eventDate) {
      const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
      const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);

      if (auctionEndDate > oneWeekBeforeEvent) {
        errors.auctionEndDate = 'Auction must end at least one week before the event';
      }

      // Check if event is too soon for auction
      const currentDate = new Date();
      const timeUntilEvent = eventDate.getTime() - currentDate.getTime();
      if (timeUntilEvent < oneWeekInMs) {
        errors.acceptanceStrategy = 'Auctions are not allowed for events less than one week away';
      }
    }
  }

  return errors;
};

/**
 * Validates swap preferences independently
 */
export const validateSwapPreferences = (
  preferences: SwapPreferencesData,
  eventDate: Date
): Partial<UnifiedFormValidationErrors> => {
  const { error } = swapPreferencesSchema.validate(preferences, {
    abortEarly: false,
  });

  const errors: Partial<UnifiedFormValidationErrors> = {};

  if (error) {
    error.details.forEach(detail => {
      const path = detail.path.join('.');
      errors[path] = detail.message;
    });
  }

  // Cross-field validation for auction timing
  if (preferences.acceptanceStrategy === 'auction' && preferences.auctionEndDate) {
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);
    const currentDate = new Date();

    if (preferences.auctionEndDate > oneWeekBeforeEvent) {
      errors.auctionEndDate = 'Auction must end at least one week before the event';
    }

    // Check if event is too soon for auction
    const timeUntilEvent = eventDate.getTime() - currentDate.getTime();
    if (timeUntilEvent < oneWeekInMs) {
      errors.acceptanceStrategy = 'Auctions are not allowed for events less than one week away';
    }
  }

  return errors;
};

/**
 * Validates inline proposal data
 */
export const validateInlineProposal = (
  data: InlineProposalData,
  minCashAmount?: number,
  maxCashAmount?: number
): Record<string, string> => {
  const { error } = inlineProposalSchema.validate(data, {
    abortEarly: false,
  });

  const errors: Record<string, string> = {};

  if (error) {
    error.details.forEach(detail => {
      const path = detail.path.join('.');
      errors[path] = detail.message;
    });
  }

  // Additional cash amount validation
  if (data.type === 'cash' && data.cashAmount) {
    if (minCashAmount && data.cashAmount < minCashAmount) {
      errors.cashAmount = `Amount must be at least $${minCashAmount}`;
    }
    if (maxCashAmount && data.cashAmount > maxCashAmount) {
      errors.cashAmount = `Amount cannot exceed $${maxCashAmount}`;
    }
  }

  return errors;
};

/**
 * Validates a single field with context
 */
export const validateUnifiedField = (
  fieldName: string,
  value: any,
  formData?: Partial<UnifiedBookingData>
): string => {
  // Create a minimal object for validation
  const testData: any = { [fieldName]: value };

  // Add context data if available
  if (formData) {
    Object.assign(testData, formData);
  }

  const { error } = unifiedBookingSchema.validate(testData, {
    abortEarly: true,
    allowUnknown: true,
  });

  if (error) {
    const fieldError = error.details.find(detail =>
      detail.path.join('.') === fieldName || detail.path[0] === fieldName
    );
    return fieldError?.message || '';
  }

  return '';
};

/**
 * Checks if form has validation errors
 */
export const hasValidationErrors = (errors: UnifiedFormValidationErrors): boolean => {
  return Object.keys(errors).some(key => errors[key]);
};

/**
 * Gets count of validation errors
 */
export const getValidationErrorCount = (errors: UnifiedFormValidationErrors): number => {
  return Object.keys(errors).filter(key => errors[key]).length;
};

/**
 * Formats validation errors for display
 */
export const formatValidationErrors = (
  errors: UnifiedFormValidationErrors
): { field: string; message: string }[] => {
  return Object.entries(errors)
    .filter(([, message]) => message)
    .map(([field, message]) => ({ field, message: message! }));
};

/**
 * Gets field-specific error message
 */
export const getFieldError = (
  errors: UnifiedFormValidationErrors,
  fieldName: string
): string => {
  return errors[fieldName] || '';
};

/**
 * Clears specific field error
 */
export const clearFieldError = (
  errors: UnifiedFormValidationErrors,
  fieldName: string
): UnifiedFormValidationErrors => {
  const newErrors = { ...errors };
  delete newErrors[fieldName];
  return newErrors;
};

/**
 * Validates auction timing constraints
 */
export const validateUnifiedAuctionTiming = (
  auctionEndDate: Date,
  eventDate: Date
): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const currentDate = new Date();

  // Basic validations
  if (auctionEndDate <= currentDate) {
    errors.push('Auction end date must be in the future');
  }

  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);

  if (auctionEndDate > oneWeekBeforeEvent) {
    errors.push('Auction must end at least one week before the event');
  }

  // Check if event is too soon
  const timeUntilEvent = eventDate.getTime() - currentDate.getTime();
  if (timeUntilEvent < oneWeekInMs) {
    errors.push('Auctions are not allowed for events less than one week away');
  }

  // Timing warnings
  const timeUntilAuction = auctionEndDate.getTime() - currentDate.getTime();
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

  if (timeUntilAuction < oneDayInMs && timeUntilAuction > 0) {
    warnings.push('Auction ends in less than 24 hours - consider extending for more proposals');
  } else if (timeUntilAuction < threeDaysInMs && timeUntilAuction > 0) {
    warnings.push('Short auction duration may limit the number of proposals received');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};