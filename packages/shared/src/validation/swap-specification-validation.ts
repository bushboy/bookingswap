/**
 * Validation utilities for swap specification data models
 * Provides TypeScript validation and runtime checks for swap-only operations
 */

import { SwapSpecificationData, SwapSpecificationUpdateData, SwapSpecificationErrors, CreateSwapSpecificationRequest } from '../types/swap-specification';
import { AcceptanceStrategyType } from '../types/swap';

/**
 * Validates swap specification data for completeness and correctness
 */
export function validateSwapSpecificationData(data: SwapSpecificationData): SwapSpecificationErrors {
  const errors: SwapSpecificationErrors = {};

  // Booking ID validation
  if (!data.bookingId || data.bookingId.trim().length === 0) {
    errors.bookingId = 'Booking ID is required';
  }

  // Payment types validation
  if (!data.paymentTypes || data.paymentTypes.length === 0) {
    errors.paymentTypes = 'At least one payment type must be selected';
  } else {
    const validPaymentTypes = ['booking', 'cash'];
    const invalidTypes = data.paymentTypes.filter(type => !validPaymentTypes.includes(type));
    if (invalidTypes.length > 0) {
      errors.paymentTypes = `Invalid payment types: ${invalidTypes.join(', ')}`;
    }
  }

  // Cash amount validation (only if cash is enabled)
  if (data.paymentTypes?.includes('cash')) {
    if (data.minCashAmount !== undefined && data.minCashAmount <= 0) {
      errors.minCashAmount = 'Minimum cash amount must be greater than 0';
    }

    if (data.maxCashAmount !== undefined && data.maxCashAmount <= 0) {
      errors.maxCashAmount = 'Maximum cash amount must be greater than 0';
    }

    if (data.minCashAmount !== undefined && data.maxCashAmount !== undefined) {
      if (data.minCashAmount > data.maxCashAmount) {
        errors.maxCashAmount = 'Maximum cash amount must be greater than or equal to minimum cash amount';
      }
    }
  }

  // Acceptance strategy validation
  if (!data.acceptanceStrategy || !isValidAcceptanceStrategy(data.acceptanceStrategy)) {
    errors.acceptanceStrategy = 'Valid acceptance strategy is required';
  }

  // Auction end date validation (only if auction strategy is selected)
  if (data.acceptanceStrategy === 'auction') {
    if (!data.auctionEndDate) {
      errors.auctionEndDate = 'Auction end date is required for auction strategy';
    } else if (new Date(data.auctionEndDate) <= new Date()) {
      errors.auctionEndDate = 'Auction end date must be in the future';
    } else if (new Date(data.auctionEndDate) > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
      errors.auctionEndDate = 'Auction end date cannot be more than 30 days in the future';
    }
  }

  // Swap conditions validation
  if (!data.swapConditions || data.swapConditions.length === 0) {
    errors.swapConditions = 'At least one swap condition is required';
  } else {
    const invalidConditions = data.swapConditions.filter(condition => 
      !condition || condition.trim().length === 0
    );
    if (invalidConditions.length > 0) {
      errors.swapConditions = 'All swap conditions must be non-empty';
    }
  }

  return errors;
}

/**
 * Validates partial swap specification data for updates
 */
export function validateSwapSpecificationUpdateData(data: SwapSpecificationUpdateData): SwapSpecificationErrors {
  const errors: SwapSpecificationErrors = {};

  // Only validate fields that are present
  if (data.paymentTypes !== undefined) {
    if (data.paymentTypes.length === 0) {
      errors.paymentTypes = 'At least one payment type must be selected';
    } else {
      const validPaymentTypes = ['booking', 'cash'];
      const invalidTypes = data.paymentTypes.filter(type => !validPaymentTypes.includes(type));
      if (invalidTypes.length > 0) {
        errors.paymentTypes = `Invalid payment types: ${invalidTypes.join(', ')}`;
      }
    }
  }

  if (data.minCashAmount !== undefined) {
    if (data.minCashAmount <= 0) {
      errors.minCashAmount = 'Minimum cash amount must be greater than 0';
    }
  }

  if (data.maxCashAmount !== undefined) {
    if (data.maxCashAmount <= 0) {
      errors.maxCashAmount = 'Maximum cash amount must be greater than 0';
    }
  }

  // Cross-field validation for cash amounts
  if (data.minCashAmount !== undefined && data.maxCashAmount !== undefined) {
    if (data.minCashAmount > data.maxCashAmount) {
      errors.maxCashAmount = 'Maximum cash amount must be greater than or equal to minimum cash amount';
    }
  }

  if (data.acceptanceStrategy !== undefined) {
    if (!isValidAcceptanceStrategy(data.acceptanceStrategy)) {
      errors.acceptanceStrategy = 'Valid acceptance strategy is required';
    }
  }

  if (data.auctionEndDate !== undefined) {
    if (new Date(data.auctionEndDate) <= new Date()) {
      errors.auctionEndDate = 'Auction end date must be in the future';
    } else if (new Date(data.auctionEndDate) > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) {
      errors.auctionEndDate = 'Auction end date cannot be more than 30 days in the future';
    }
  }

  if (data.swapConditions !== undefined) {
    if (data.swapConditions.length === 0) {
      errors.swapConditions = 'At least one swap condition is required';
    } else {
      const invalidConditions = data.swapConditions.filter(condition => 
        !condition || condition.trim().length === 0
      );
      if (invalidConditions.length > 0) {
        errors.swapConditions = 'All swap conditions must be non-empty';
      }
    }
  }

  return errors;
}

/**
 * Validates create swap specification request data
 */
export function validateCreateSwapSpecificationRequest(data: CreateSwapSpecificationRequest): SwapSpecificationErrors {
  // Use the same validation as SwapSpecificationData
  const swapData: SwapSpecificationData = {
    bookingId: data.bookingId,
    paymentTypes: data.paymentTypes,
    minCashAmount: data.minCashAmount,
    maxCashAmount: data.maxCashAmount,
    acceptanceStrategy: data.acceptanceStrategy,
    auctionEndDate: data.auctionEndDate,
    swapConditions: data.swapConditions,
    swapEnabled: true, // Always enabled when creating
  };

  return validateSwapSpecificationData(swapData);
}

/**
 * Type guard to check if data is valid SwapSpecificationData
 */
export function isValidSwapSpecificationData(data: any): data is SwapSpecificationData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  return (
    typeof data.bookingId === 'string' &&
    Array.isArray(data.paymentTypes) &&
    data.paymentTypes.length > 0 &&
    data.paymentTypes.every((type: any) => ['booking', 'cash'].includes(type)) &&
    isValidAcceptanceStrategy(data.acceptanceStrategy) &&
    Array.isArray(data.swapConditions) &&
    data.swapConditions.length > 0 &&
    typeof data.swapEnabled === 'boolean'
  );
}

/**
 * Type guard to check if acceptance strategy is valid
 */
export function isValidAcceptanceStrategy(strategy: any): strategy is AcceptanceStrategyType {
  return ['first_match', 'auction'].includes(strategy);
}

/**
 * Checks if swap specification data has any validation errors
 */
export function hasSwapSpecificationErrors(errors: SwapSpecificationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Gets a summary of validation errors for display
 */
export function getSwapSpecificationErrorSummary(errors: SwapSpecificationErrors): string[] {
  return Object.values(errors).filter(error => error !== undefined) as string[];
}

/**
 * Sanitizes swap specification data by trimming strings and normalizing values
 */
export function sanitizeSwapSpecificationData(data: SwapSpecificationData): SwapSpecificationData {
  return {
    ...data,
    bookingId: data.bookingId?.trim() || '',
    swapConditions: data.swapConditions?.map(condition => condition?.trim() || '').filter(condition => condition.length > 0) || [],
  };
}

/**
 * Validates that cash amounts are consistent with payment types
 */
export function validateCashAmountConsistency(data: SwapSpecificationData | SwapSpecificationUpdateData): SwapSpecificationErrors {
  const errors: SwapSpecificationErrors = {};

  // If cash is not enabled, cash amounts should not be set
  if (data.paymentTypes && !data.paymentTypes.includes('cash')) {
    if (data.minCashAmount !== undefined) {
      errors.minCashAmount = 'Minimum cash amount should not be set when cash payments are disabled';
    }
    if (data.maxCashAmount !== undefined) {
      errors.maxCashAmount = 'Maximum cash amount should not be set when cash payments are disabled';
    }
  }

  // If auction strategy is not selected, auction end date should not be set
  if (data.acceptanceStrategy && data.acceptanceStrategy !== 'auction') {
    if (data.auctionEndDate !== undefined) {
      errors.auctionEndDate = 'Auction end date should not be set when auction strategy is not selected';
    }
  }

  return errors;
}

/**
 * Validates wallet connection requirements for swap specification
 */
export function validateWalletRequirements(data: SwapSpecificationData, walletConnected: boolean): SwapSpecificationErrors {
  const errors: SwapSpecificationErrors = {};

  if (data.swapEnabled && !walletConnected) {
    errors.walletConnection = 'Wallet connection is required to enable swapping';
  }

  return errors;
}