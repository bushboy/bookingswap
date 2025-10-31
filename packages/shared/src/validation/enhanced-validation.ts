/**
 * Enhanced validation utilities for separated data models
 * Provides comprehensive validation with error recovery guidance
 */

import {
  BookingEditData,
  BookingEditUpdateData,
  BookingEditErrors
} from '../types/booking-edit.js';
import {
  SwapSpecificationData,
  SwapSpecificationUpdateData,
  SwapSpecificationErrors
} from '../types/swap-specification.js';
import {
  validateBookingEditData,
  validateBookingEditUpdateData,
  sanitizeBookingEditData,
} from './booking-edit-validation.js';
import {
  validateSwapSpecificationData,
  validateSwapSpecificationUpdateData,
  sanitizeSwapSpecificationData,
  validateCashAmountConsistency,
  validateWalletRequirements,
} from './swap-specification-validation.js';
import {
  getBookingEditValidationGuidance,
  getSwapSpecificationValidationGuidance,
  createBookingEditRecoveryPlan,
  createSwapSpecificationRecoveryPlan,
  ErrorRecoveryPlan,
} from './error-recovery.js';

/**
 * Enhanced validation result interface
 */
export interface ValidationResult<TErrors> {
  isValid: boolean;
  errors: TErrors;
  warnings: string[];
  guidance: string[];
  recoveryPlan?: ErrorRecoveryPlan;
}

/**
 * Validation context for enhanced validation
 */
export interface ValidationContext {
  isUpdate?: boolean;
  walletConnected?: boolean;
  userRole?: string;
  skipWarnings?: boolean;
}

/**
 * Enhanced booking edit validation with recovery guidance
 */
export function validateBookingEditWithGuidance(
  data: BookingEditData,
  context: ValidationContext = {}
): ValidationResult<BookingEditErrors> {
  // Sanitize data first
  const sanitizedData = sanitizeBookingEditData(data);

  // Perform validation
  const errors = validateBookingEditData(sanitizedData);
  const isValid = Object.keys(errors).length === 0;

  // Generate guidance
  const guidance = isValid ? [] : getBookingEditValidationGuidance(errors);

  // Generate warnings
  const warnings: string[] = [];
  if (!context.skipWarnings) {
    warnings.push(...generateBookingEditWarnings(sanitizedData));
  }

  // Create recovery plan if there are errors
  let recoveryPlan: ErrorRecoveryPlan | undefined;
  if (!isValid) {
    const validationError = new Error('Booking validation failed');
    recoveryPlan = createBookingEditRecoveryPlan(validationError, errors);
  }

  return {
    isValid,
    errors,
    warnings,
    guidance,
    recoveryPlan,
  };
}

/**
 * Enhanced booking edit update validation with recovery guidance
 */
export function validateBookingEditUpdateWithGuidance(
  data: BookingEditUpdateData,
  context: ValidationContext = {}
): ValidationResult<BookingEditErrors> {
  // Perform validation
  const errors = validateBookingEditUpdateData(data);
  const isValid = Object.keys(errors).length === 0;

  // Generate guidance
  const guidance = isValid ? [] : getBookingEditValidationGuidance(errors);

  // Generate warnings for update operations
  const warnings: string[] = [];
  if (!context.skipWarnings) {
    warnings.push(...generateBookingEditUpdateWarnings(data));
  }

  // Create recovery plan if there are errors
  let recoveryPlan: ErrorRecoveryPlan | undefined;
  if (!isValid) {
    const validationError = new Error('Booking update validation failed');
    recoveryPlan = createBookingEditRecoveryPlan(validationError, errors);
  }

  return {
    isValid,
    errors,
    warnings,
    guidance,
    recoveryPlan,
  };
}

/**
 * Enhanced swap specification validation with recovery guidance
 */
export function validateSwapSpecificationWithGuidance(
  data: SwapSpecificationData,
  context: ValidationContext = {}
): ValidationResult<SwapSpecificationErrors> {
  // Sanitize data first
  const sanitizedData = sanitizeSwapSpecificationData(data);

  // Perform basic validation
  const errors = validateSwapSpecificationData(sanitizedData);

  // Add consistency validation
  const consistencyErrors = validateCashAmountConsistency(sanitizedData);
  Object.assign(errors, consistencyErrors);

  // Add wallet validation if context provided
  if (context.walletConnected !== undefined) {
    const walletErrors = validateWalletRequirements(sanitizedData, context.walletConnected);
    Object.assign(errors, walletErrors);
  }

  const isValid = Object.keys(errors).length === 0;

  // Generate guidance
  const guidance = isValid ? [] : getSwapSpecificationValidationGuidance(errors);

  // Generate warnings
  const warnings: string[] = [];
  if (!context.skipWarnings) {
    warnings.push(...generateSwapSpecificationWarnings(sanitizedData, context));
  }

  // Create recovery plan if there are errors
  let recoveryPlan: ErrorRecoveryPlan | undefined;
  if (!isValid) {
    const validationError = new Error('Swap specification validation failed');
    recoveryPlan = createSwapSpecificationRecoveryPlan(validationError, errors);
  }

  return {
    isValid,
    errors,
    warnings,
    guidance,
    recoveryPlan,
  };
}

/**
 * Enhanced swap specification update validation with recovery guidance
 */
export function validateSwapSpecificationUpdateWithGuidance(
  data: SwapSpecificationUpdateData,
  context: ValidationContext = {}
): ValidationResult<SwapSpecificationErrors> {
  // Perform validation
  const errors = validateSwapSpecificationUpdateData(data);

  // Add consistency validation
  const consistencyErrors = validateCashAmountConsistency(data);
  Object.assign(errors, consistencyErrors);

  const isValid = Object.keys(errors).length === 0;

  // Generate guidance
  const guidance = isValid ? [] : getSwapSpecificationValidationGuidance(errors);

  // Generate warnings for update operations
  const warnings: string[] = [];
  if (!context.skipWarnings) {
    warnings.push(...generateSwapSpecificationUpdateWarnings(data, context));
  }

  // Create recovery plan if there are errors
  let recoveryPlan: ErrorRecoveryPlan | undefined;
  if (!isValid) {
    const validationError = new Error('Swap specification update validation failed');
    recoveryPlan = createSwapSpecificationRecoveryPlan(validationError, errors);
  }

  return {
    isValid,
    errors,
    warnings,
    guidance,
    recoveryPlan,
  };
}

/**
 * Generate warnings for booking edit data
 */
function generateBookingEditWarnings(data: BookingEditData): string[] {
  const warnings: string[] = [];

  // Check for potential issues that aren't errors but could be improved
  if (data.title.length < 10) {
    warnings.push('Consider adding a more descriptive title for better visibility');
  }

  if (data.description.length < 50) {
    warnings.push('A more detailed description can help attract better swap offers');
  }

  if (data.swapValue > data.originalPrice * 1.5) {
    warnings.push('Your swap value is significantly higher than the original price');
  }

  if (data.swapValue < data.originalPrice * 0.5) {
    warnings.push('Your swap value is significantly lower than the original price');
  }

  // Check date range
  const checkInDate = new Date(data.dateRange.checkIn);
  const checkOutDate = new Date(data.dateRange.checkOut);
  const daysDifference = (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 3600 * 24);

  if (daysDifference > 30) {
    warnings.push('Long booking periods may be harder to swap');
  }

  if (daysDifference < 1) {
    warnings.push('Very short bookings may have limited swap interest');
  }

  return warnings;
}

/**
 * Generate warnings for booking edit update data
 */
function generateBookingEditUpdateWarnings(data: BookingEditUpdateData): string[] {
  const warnings: string[] = [];

  // Check for significant changes that might affect existing swaps
  if (data.swapValue !== undefined) {
    warnings.push('Changing the swap value may affect existing swap proposals');
  }

  if (data.dateRange !== undefined) {
    warnings.push('Changing dates may invalidate existing swap proposals');
  }

  if (data.location !== undefined) {
    warnings.push('Changing location may affect swap compatibility');
  }

  return warnings;
}

/**
 * Generate warnings for swap specification data
 */
function generateSwapSpecificationWarnings(
  data: SwapSpecificationData,
  context: ValidationContext
): string[] {
  const warnings: string[] = [];

  // Check for potentially problematic configurations
  if (data.paymentTypes.includes('cash') && (!data.minCashAmount || data.minCashAmount < 50)) {
    warnings.push('Very low minimum cash amounts may attract low-quality proposals');
  }

  if (data.paymentTypes.includes('cash') && data.maxCashAmount && data.maxCashAmount > 10000) {
    warnings.push('Very high maximum cash amounts may require additional verification');
  }

  if (data.acceptanceStrategy === 'auction' && data.auctionEndDate) {
    const auctionEnd = new Date(data.auctionEndDate);
    const now = new Date();
    const hoursUntilEnd = (auctionEnd.getTime() - now.getTime()) / (1000 * 3600);

    if (hoursUntilEnd < 24) {
      warnings.push('Short auction periods may limit the number of proposals you receive');
    }

    if (hoursUntilEnd > 168) { // 7 days
      warnings.push('Very long auction periods may delay your swap completion');
    }
  }

  if (data.swapConditions.length > 10) {
    warnings.push('Too many conditions may discourage potential swappers');
  }

  if (data.swapConditions.some(condition => condition.length > 200)) {
    warnings.push('Very long conditions may be difficult for users to understand');
  }

  return warnings;
}

/**
 * Generate warnings for swap specification update data
 */
function generateSwapSpecificationUpdateWarnings(
  data: SwapSpecificationUpdateData,
  context: ValidationContext
): string[] {
  const warnings: string[] = [];

  // Check for changes that might affect existing proposals
  if (data.paymentTypes !== undefined) {
    warnings.push('Changing payment types may invalidate existing proposals');
  }

  if (data.minCashAmount !== undefined || data.maxCashAmount !== undefined) {
    warnings.push('Changing cash amount limits may affect existing cash proposals');
  }

  if (data.acceptanceStrategy !== undefined) {
    warnings.push('Changing acceptance strategy may affect how proposals are processed');
  }

  if (data.swapConditions !== undefined) {
    warnings.push('Changing swap conditions may require existing proposers to re-evaluate');
  }

  return warnings;
}

/**
 * Batch validation for multiple booking edits
 */
export function validateMultipleBookingEdits(
  bookings: BookingEditData[],
  context: ValidationContext = {}
): ValidationResult<Record<number, BookingEditErrors>> {
  const errors: Record<number, BookingEditErrors> = {};
  const warnings: string[] = [];
  const guidance: string[] = [];
  let hasAnyErrors = false;

  bookings.forEach((booking, index) => {
    const result = validateBookingEditWithGuidance(booking, context);

    if (!result.isValid) {
      errors[index] = result.errors;
      hasAnyErrors = true;
      guidance.push(...result.guidance.map(g => `Booking ${index + 1}: ${g}`));
    }

    warnings.push(...result.warnings.map(w => `Booking ${index + 1}: ${w}`));
  });

  return {
    isValid: !hasAnyErrors,
    errors,
    warnings,
    guidance,
  };
}

/**
 * Batch validation for multiple swap specifications
 */
export function validateMultipleSwapSpecifications(
  swapSpecs: SwapSpecificationData[],
  context: ValidationContext = {}
): ValidationResult<Record<number, SwapSpecificationErrors>> {
  const errors: Record<number, SwapSpecificationErrors> = {};
  const warnings: string[] = [];
  const guidance: string[] = [];
  let hasAnyErrors = false;

  swapSpecs.forEach((swapSpec, index) => {
    const result = validateSwapSpecificationWithGuidance(swapSpec, context);

    if (!result.isValid) {
      errors[index] = result.errors;
      hasAnyErrors = true;
      guidance.push(...result.guidance.map(g => `Swap ${index + 1}: ${g}`));
    }

    warnings.push(...result.warnings.map(w => `Swap ${index + 1}: ${w}`));
  });

  return {
    isValid: !hasAnyErrors,
    errors,
    warnings,
    guidance,
  };
}