/**
 * Error recovery utilities for separated validation systems
 * Provides guidance and recovery strategies for booking and swap validation errors
 */

import { BookingEditErrors } from '../types/booking-edit';
import { SwapSpecificationErrors } from '../types/swap-specification';

/**
 * Error recovery strategy types
 */
export type ErrorRecoveryStrategy =
  | 'retry'           // User can retry the same action
  | 'fix_and_retry'   // User needs to fix validation errors and retry
  | 'navigate_back'   // User should navigate back to previous screen
  | 'reload_page'     // User should reload the page
  | 'contact_support' // User should contact support
  | 'check_connection' // User should check their internet connection
  | 'reconnect_wallet' // User should reconnect their wallet
  | 'login_required'; // User needs to log in

/**
 * Error recovery guidance interface
 */
export interface ErrorRecoveryGuidance {
  strategy: ErrorRecoveryStrategy;
  title: string;
  message: string;
  actionText: string;
  priority: number; // Lower number = higher priority
  canAutoRecover: boolean;
  requiresUserAction: boolean;
}

/**
 * Booking edit error recovery strategies
 */
export const BOOKING_EDIT_ERROR_RECOVERY: Record<string, ErrorRecoveryGuidance> = {
  validation: {
    strategy: 'fix_and_retry',
    title: 'Fix Booking Information',
    message: 'Please correct the highlighted fields and try saving again.',
    actionText: 'Fix and Save',
    priority: 1,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  network: {
    strategy: 'check_connection',
    title: 'Connection Issue',
    message: 'Please check your internet connection and try again.',
    actionText: 'Retry',
    priority: 2,
    canAutoRecover: true,
    requiresUserAction: false,
  },
  authentication: {
    strategy: 'login_required',
    title: 'Login Required',
    message: 'You need to be logged in to edit bookings.',
    actionText: 'Log In',
    priority: 1,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  server_error: {
    strategy: 'retry',
    title: 'Server Error',
    message: 'There was a temporary server issue. Please try again.',
    actionText: 'Try Again',
    priority: 3,
    canAutoRecover: true,
    requiresUserAction: false,
  },
  unknown: {
    strategy: 'navigate_back',
    title: 'Unexpected Error',
    message: 'Something unexpected happened. You can go back and try again.',
    actionText: 'Go Back',
    priority: 4,
    canAutoRecover: false,
    requiresUserAction: true,
  },
};

/**
 * Swap specification error recovery strategies
 */
export const SWAP_SPECIFICATION_ERROR_RECOVERY: Record<string, ErrorRecoveryGuidance> = {
  validation: {
    strategy: 'fix_and_retry',
    title: 'Fix Swap Settings',
    message: 'Please correct the highlighted swap settings and try again.',
    actionText: 'Fix and Save',
    priority: 1,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  wallet_connection: {
    strategy: 'reconnect_wallet',
    title: 'Wallet Connection Issue',
    message: 'Please check your wallet connection and try again.',
    actionText: 'Reconnect Wallet',
    priority: 1,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  blockchain_error: {
    strategy: 'retry',
    title: 'Blockchain Transaction Failed',
    message: 'The blockchain transaction failed. Please try again.',
    actionText: 'Try Again',
    priority: 2,
    canAutoRecover: true,
    requiresUserAction: false,
  },
  network: {
    strategy: 'check_connection',
    title: 'Connection Issue',
    message: 'Please check your internet connection and try again.',
    actionText: 'Retry',
    priority: 2,
    canAutoRecover: true,
    requiresUserAction: false,
  },
  authentication: {
    strategy: 'login_required',
    title: 'Login Required',
    message: 'You need to be logged in to create swap specifications.',
    actionText: 'Log In',
    priority: 1,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  insufficient_funds: {
    strategy: 'contact_support',
    title: 'Insufficient Funds',
    message: 'You don\'t have enough funds for this transaction.',
    actionText: 'Contact Support',
    priority: 2,
    canAutoRecover: false,
    requiresUserAction: true,
  },
  unknown: {
    strategy: 'navigate_back',
    title: 'Unexpected Error',
    message: 'Something unexpected happened. You can go back and try again.',
    actionText: 'Go Back',
    priority: 4,
    canAutoRecover: false,
    requiresUserAction: true,
  },
};

/**
 * Determines the appropriate recovery strategy for a booking edit error
 */
export function getBookingEditRecoveryStrategy(
  error: Error,
  validationErrors?: BookingEditErrors
): ErrorRecoveryGuidance {
  // Validation errors take priority
  if (validationErrors && Object.keys(validationErrors).length > 0) {
    return BOOKING_EDIT_ERROR_RECOVERY.validation!;
  }

  // Check error message for specific patterns
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('network') || errorMessage.includes('fetch') || errorMessage.includes('connection')) {
    return BOOKING_EDIT_ERROR_RECOVERY.network!;
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication') || errorMessage.includes('login')) {
    return BOOKING_EDIT_ERROR_RECOVERY.authentication!;
  }

  if (errorMessage.includes('server') || errorMessage.includes('500') || errorMessage.includes('503')) {
    return BOOKING_EDIT_ERROR_RECOVERY.server_error!;
  }

  // Default to unknown error strategy
  return BOOKING_EDIT_ERROR_RECOVERY.unknown!;
}

/**
 * Determines the appropriate recovery strategy for a swap specification error
 */
export function getSwapSpecificationRecoveryStrategy(
  error: Error,
  validationErrors?: SwapSpecificationErrors
): ErrorRecoveryGuidance {
  // Validation errors take priority
  if (validationErrors && Object.keys(validationErrors).length > 0) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.validation!;
  }

  // Check error message for specific patterns
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('wallet') || errorMessage.includes('metamask') || errorMessage.includes('connection')) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.wallet_connection!;
  }

  if (errorMessage.includes('blockchain') || errorMessage.includes('transaction') || errorMessage.includes('gas')) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.blockchain_error!;
  }

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.network!;
  }

  if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication') || errorMessage.includes('login')) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.authentication!;
  }

  if (errorMessage.includes('insufficient') || errorMessage.includes('balance') || errorMessage.includes('funds')) {
    return SWAP_SPECIFICATION_ERROR_RECOVERY.insufficient_funds!;
  }

  // Default to unknown error strategy
  return SWAP_SPECIFICATION_ERROR_RECOVERY.unknown!;
}

/**
 * Provides user-friendly error messages for booking edit validation errors
 */
export function getBookingEditValidationGuidance(errors: BookingEditErrors): string[] {
  const guidance: string[] = [];

  if (errors.title) {
    guidance.push('Make sure your booking has a clear, descriptive title');
  }

  if (errors.description) {
    guidance.push('Add a detailed description of your booking');
  }

  if (errors.location) {
    guidance.push('Verify that the city and country are correct');
  }

  if (errors.dateRange) {
    guidance.push('Check that your check-in and check-out dates are valid and in the future');
  }

  if (errors.originalPrice || errors.swapValue) {
    guidance.push('Ensure all price values are positive numbers');
  }

  if (errors.providerDetails) {
    guidance.push('Complete all provider information including confirmation number');
  }

  return guidance;
}

/**
 * Provides user-friendly error messages for swap specification validation errors
 */
export function getSwapSpecificationValidationGuidance(errors: SwapSpecificationErrors): string[] {
  const guidance: string[] = [];

  if (errors.paymentTypes) {
    guidance.push('Select at least one payment type (booking or cash)');
  }

  if (errors.minCashAmount || errors.maxCashAmount) {
    guidance.push('Set valid cash amount ranges if cash payments are enabled');
  }

  if (errors.acceptanceStrategy) {
    guidance.push('Choose how you want to accept swap proposals');
  }

  if (errors.auctionEndDate) {
    guidance.push('Set a valid auction end date if using auction strategy');
  }

  if (errors.swapConditions) {
    guidance.push('Add at least one condition for your swap');
  }

  if (errors.walletConnection) {
    guidance.push('Connect your wallet to enable swapping functionality');
  }

  return guidance;
}

/**
 * Checks if an error is recoverable automatically
 */
export function isAutoRecoverableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();

  // Network errors and temporary server errors are often auto-recoverable
  return (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('500') ||
    errorMessage.includes('503') ||
    errorMessage.includes('temporary')
  );
}

/**
 * Gets the retry delay for auto-recoverable errors
 */
export function getRetryDelay(attemptNumber: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  return Math.min(1000 * Math.pow(2, attemptNumber - 1), 30000);
}

/**
 * Determines if an error requires immediate user attention
 */
export function requiresImmediateAttention(error: Error, validationErrors?: BookingEditErrors | SwapSpecificationErrors): boolean {
  // Validation errors always require immediate attention
  if (validationErrors && Object.keys(validationErrors).length > 0) {
    return true;
  }

  const errorMessage = error.message.toLowerCase();

  // Authentication and wallet errors require immediate attention
  return (
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('authentication') ||
    errorMessage.includes('wallet') ||
    errorMessage.includes('insufficient')
  );
}

/**
 * Creates a comprehensive error recovery plan
 */
export interface ErrorRecoveryPlan {
  primaryStrategy: ErrorRecoveryGuidance;
  alternativeStrategies: ErrorRecoveryGuidance[];
  userGuidance: string[];
  canAutoRecover: boolean;
  retryDelay?: number;
}

export function createBookingEditRecoveryPlan(
  error: Error,
  validationErrors?: BookingEditErrors,
  attemptNumber: number = 1
): ErrorRecoveryPlan {
  const primaryStrategy = getBookingEditRecoveryStrategy(error, validationErrors);
  const userGuidance = validationErrors ? getBookingEditValidationGuidance(validationErrors) : [];
  const canAutoRecover = isAutoRecoverableError(error) && !requiresImmediateAttention(error, validationErrors);

  const alternativeStrategies: ErrorRecoveryGuidance[] = [];

  // Add alternative strategies based on primary strategy
  if (primaryStrategy.strategy !== 'navigate_back') {
    alternativeStrategies.push(BOOKING_EDIT_ERROR_RECOVERY.unknown!);
  }

  if (primaryStrategy.strategy !== 'reload_page' && !canAutoRecover) {
    alternativeStrategies.push({
      strategy: 'reload_page',
      title: 'Reload Page',
      message: 'Try reloading the page to reset the form.',
      actionText: 'Reload',
      priority: 5,
      canAutoRecover: false,
      requiresUserAction: true,
    });
  }

  return {
    primaryStrategy,
    alternativeStrategies,
    userGuidance,
    canAutoRecover,
    retryDelay: canAutoRecover ? getRetryDelay(attemptNumber) : undefined,
  };
}

export function createSwapSpecificationRecoveryPlan(
  error: Error,
  validationErrors?: SwapSpecificationErrors,
  attemptNumber: number = 1
): ErrorRecoveryPlan {
  const primaryStrategy = getSwapSpecificationRecoveryStrategy(error, validationErrors);
  const userGuidance = validationErrors ? getSwapSpecificationValidationGuidance(validationErrors) : [];
  const canAutoRecover = isAutoRecoverableError(error) && !requiresImmediateAttention(error, validationErrors);

  const alternativeStrategies: ErrorRecoveryGuidance[] = [];

  // Add alternative strategies based on primary strategy
  if (primaryStrategy.strategy !== 'navigate_back') {
    alternativeStrategies.push(SWAP_SPECIFICATION_ERROR_RECOVERY.unknown!);
  }

  if (primaryStrategy.strategy !== 'reload_page' && !canAutoRecover) {
    alternativeStrategies.push({
      strategy: 'reload_page',
      title: 'Reload Page',
      message: 'Try reloading the page to reset the swap specification.',
      actionText: 'Reload',
      priority: 5,
      canAutoRecover: false,
      requiresUserAction: true,
    });
  }

  return {
    primaryStrategy,
    alternativeStrategies,
    userGuidance,
    canAutoRecover,
    retryDelay: canAutoRecover ? getRetryDelay(attemptNumber) : undefined,
  };
}