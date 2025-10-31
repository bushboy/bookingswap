/**
 * UI Simplification Error Classes and Recovery Mechanisms
 * 
 * This module provides specialized error handling for the booking swap UI simplification feature,
 * including form validation errors, inline proposal errors, filter application failures,
 * and optimistic update rollback mechanisms.
 */

import { SwapPlatformError, ErrorContext } from '@booking-swap/shared';

/**
 * UI Simplification specific error codes
 */
export const UI_ERROR_CODES = {
  // Form validation errors
  FORM_VALIDATION_ERROR: 'FORM_VALIDATION_ERROR',
  CROSS_FIELD_VALIDATION_ERROR: 'CROSS_FIELD_VALIDATION_ERROR',
  SWAP_PREFERENCES_VALIDATION_ERROR: 'SWAP_PREFERENCES_VALIDATION_ERROR',
  
  // Inline proposal errors
  INLINE_PROPOSAL_ERROR: 'INLINE_PROPOSAL_ERROR',
  PROPOSAL_SUBMISSION_FAILED: 'PROPOSAL_SUBMISSION_FAILED',
  PROPOSAL_VALIDATION_FAILED: 'PROPOSAL_VALIDATION_FAILED',
  
  // Filter application errors
  FILTER_APPLICATION_ERROR: 'FILTER_APPLICATION_ERROR',
  FILTER_SERVICE_UNAVAILABLE: 'FILTER_SERVICE_UNAVAILABLE',
  INVALID_FILTER_VALUE: 'INVALID_FILTER_VALUE',
  
  // Optimistic update errors
  OPTIMISTIC_UPDATE_ERROR: 'OPTIMISTIC_UPDATE_ERROR',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
  STATE_SYNC_ERROR: 'STATE_SYNC_ERROR',
} as const;

/**
 * Base error class for UI simplification specific errors
 */
export class UISimplificationError extends SwapPlatformError {
  public readonly field?: string;
  public readonly component?: string;
  public readonly userAction?: string;

  constructor(
    code: string,
    message: string,
    field?: string,
    component?: string,
    userAction?: string,
    context?: ErrorContext
  ) {
    super(code, message, 'validation', false, context);
    this.name = 'UISimplificationError';
    this.field = field;
    this.component = component;
    this.userAction = userAction;
  }
}

/**
 * Form validation error with field-level display support
 */
export class FormValidationError extends UISimplificationError {
  public readonly validationRule?: string;
  public readonly expectedFormat?: string;
  public readonly currentValue?: any;

  constructor(
    field: string,
    message: string,
    validationRule?: string,
    expectedFormat?: string,
    currentValue?: any,
    context?: ErrorContext
  ) {
    super(
      'FORM_VALIDATION_ERROR',
      message,
      field,
      'UnifiedBookingForm',
      'form_validation',
      context
    );
    this.name = 'FormValidationError';
    this.validationRule = validationRule;
    this.expectedFormat = expectedFormat;
    this.currentValue = currentValue;
  }

  /**
   * Creates a field-specific error for display in the UI
   */
  static forField(
    field: string,
    message: string,
    options?: {
      rule?: string;
      format?: string;
      value?: any;
      context?: ErrorContext;
    }
  ): FormValidationError {
    return new FormValidationError(
      field,
      message,
      options?.rule,
      options?.format,
      options?.value,
      options?.context
    );
  }

  /**
   * Creates a cross-field validation error
   */
  static crossField(
    fields: string[],
    message: string,
    context?: ErrorContext
  ): FormValidationError {
    return new FormValidationError(
      fields.join(','),
      message,
      'cross_field_validation',
      undefined,
      undefined,
      context
    );
  }

  /**
   * Gets user-friendly error message for display
   */
  getDisplayMessage(): string {
    if (this.validationRule === 'required') {
      return `${this.field} is required`;
    }
    if (this.validationRule === 'format' && this.expectedFormat) {
      return `${this.field} must be in format: ${this.expectedFormat}`;
    }
    if (this.validationRule === 'min_value' && this.currentValue !== undefined) {
      return `${this.field} must be greater than ${this.currentValue}`;
    }
    return this.message;
  }
}

/**
 * Inline proposal error with retry mechanisms
 */
export class InlineProposalError extends UISimplificationError {
  public readonly proposalType: 'booking' | 'cash';
  public readonly bookingId: string;
  public readonly retryable: boolean;
  public readonly retryCount: number;
  public readonly maxRetries: number;

  constructor(
    message: string,
    bookingId: string,
    proposalType: 'booking' | 'cash',
    retryable: boolean = true,
    retryCount: number = 0,
    maxRetries: number = 3,
    context?: ErrorContext
  ) {
    super(
      'INLINE_PROPOSAL_ERROR',
      message,
      undefined,
      'InlineProposalForm',
      'submit_proposal',
      context
    );
    this.name = 'InlineProposalError';
    this.proposalType = proposalType;
    this.bookingId = bookingId;
    this.retryable = retryable;
    this.retryCount = retryCount;
    this.maxRetries = maxRetries;
  }

  /**
   * Creates a network-related proposal error that can be retried
   */
  static networkError(
    bookingId: string,
    proposalType: 'booking' | 'cash',
    retryCount: number = 0
  ): InlineProposalError {
    return new InlineProposalError(
      'Network error occurred while submitting proposal. Please try again.',
      bookingId,
      proposalType,
      true,
      retryCount,
      3,
      { operation: 'submit_proposal', metadata: { networkError: true } }
    );
  }

  /**
   * Creates a validation error for proposal data
   */
  static validationError(
    bookingId: string,
    proposalType: 'booking' | 'cash',
    validationMessage: string
  ): InlineProposalError {
    return new InlineProposalError(
      validationMessage,
      bookingId,
      proposalType,
      false,
      0,
      0,
      { operation: 'validate_proposal' }
    );
  }

  /**
   * Creates a business logic error (e.g., auction ended, insufficient funds)
   */
  static businessLogicError(
    bookingId: string,
    proposalType: 'booking' | 'cash',
    businessMessage: string
  ): InlineProposalError {
    return new InlineProposalError(
      businessMessage,
      bookingId,
      proposalType,
      false,
      0,
      0,
      { operation: 'business_validation' }
    );
  }

  /**
   * Checks if this error can be retried
   */
  canRetry(): boolean {
    return this.retryable && this.retryCount < this.maxRetries;
  }

  /**
   * Creates a new error instance for the next retry attempt
   */
  forRetry(): InlineProposalError {
    if (!this.canRetry()) {
      throw new Error('Cannot retry: maximum retries exceeded or error is not retryable');
    }

    return new InlineProposalError(
      this.message,
      this.bookingId,
      this.proposalType,
      this.retryable,
      this.retryCount + 1,
      this.maxRetries,
      this.context
    );
  }
}

/**
 * Filter application error with graceful degradation
 */
export class FilterApplicationError extends UISimplificationError {
  public readonly filterType: string;
  public readonly filterValue: any;
  public readonly fallbackAvailable: boolean;
  public readonly partialResults: boolean;

  constructor(
    filterType: string,
    message: string,
    filterValue?: any,
    fallbackAvailable: boolean = true,
    partialResults: boolean = false,
    context?: ErrorContext
  ) {
    super(
      'FILTER_APPLICATION_ERROR',
      message,
      filterType,
      'IntegratedFilterPanel',
      'apply_filter',
      context
    );
    this.name = 'FilterApplicationError';
    this.filterType = filterType;
    this.filterValue = filterValue;
    this.fallbackAvailable = fallbackAvailable;
    this.partialResults = partialResults;
  }

  /**
   * Creates a network error during filter application
   */
  static networkError(
    filterType: string,
    filterValue: any
  ): FilterApplicationError {
    return new FilterApplicationError(
      filterType,
      'Unable to apply filter due to network issues. Showing cached results.',
      filterValue,
      true,
      true,
      { operation: 'apply_filter', metadata: { networkError: true } }
    );
  }

  /**
   * Creates an invalid filter value error
   */
  static invalidValue(
    filterType: string,
    filterValue: any,
    expectedFormat: string
  ): FilterApplicationError {
    return new FilterApplicationError(
      filterType,
      `Invalid ${filterType} filter value. Expected: ${expectedFormat}`,
      filterValue,
      false,
      false,
      { operation: 'validate_filter', metadata: { expectedFormat } }
    );
  }

  /**
   * Creates a service unavailable error with fallback
   */
  static serviceUnavailable(
    filterType: string,
    filterValue: any
  ): FilterApplicationError {
    return new FilterApplicationError(
      filterType,
      'Filter service temporarily unavailable. Using basic filtering.',
      filterValue,
      true,
      true,
      { operation: 'apply_filter', metadata: { serviceUnavailable: true } }
    );
  }

  /**
   * Gets fallback strategy for this filter error
   */
  getFallbackStrategy(): {
    type: 'cached_results' | 'basic_filter' | 'no_filter';
    message: string;
    action?: string;
  } {
    if (!this.fallbackAvailable) {
      return {
        type: 'no_filter',
        message: 'Filter cannot be applied. Please try a different filter.',
        action: 'clear_filter'
      };
    }

    if (this.partialResults) {
      return {
        type: 'cached_results',
        message: 'Showing cached results. Some filters may not be applied.',
        action: 'retry_filter'
      };
    }

    return {
      type: 'basic_filter',
      message: 'Using simplified filtering. Some advanced options may not work.',
      action: 'retry_filter'
    };
  }
}

/**
 * Optimistic update error with rollback support
 */
export class OptimisticUpdateError extends UISimplificationError {
  public readonly operation: string;
  public readonly originalState: any;
  public readonly optimisticState: any;
  public readonly rollbackData: any;

  constructor(
    operation: string,
    message: string,
    originalState: any,
    optimisticState: any,
    rollbackData: any,
    context?: ErrorContext
  ) {
    super(
      'OPTIMISTIC_UPDATE_ERROR',
      message,
      undefined,
      'OptimisticUpdate',
      operation,
      context
    );
    this.name = 'OptimisticUpdateError';
    this.operation = operation;
    this.originalState = originalState;
    this.optimisticState = optimisticState;
    this.rollbackData = rollbackData;
  }

  /**
   * Creates a booking creation optimistic update error
   */
  static bookingCreation(
    originalBookings: any[],
    optimisticBooking: any,
    error: Error
  ): OptimisticUpdateError {
    return new OptimisticUpdateError(
      'create_booking',
      'Failed to create booking. Changes have been reverted.',
      originalBookings,
      [...originalBookings, optimisticBooking],
      { bookingId: optimisticBooking.id, action: 'remove' },
      { operation: 'create_booking', metadata: { originalError: error.message } }
    );
  }

  /**
   * Creates a proposal submission optimistic update error
   */
  static proposalSubmission(
    originalProposals: any[],
    optimisticProposal: any,
    error: Error
  ): OptimisticUpdateError {
    return new OptimisticUpdateError(
      'submit_proposal',
      'Failed to submit proposal. Changes have been reverted.',
      originalProposals,
      [...originalProposals, optimisticProposal],
      { proposalId: optimisticProposal.id, action: 'remove' },
      { operation: 'submit_proposal', metadata: { originalError: error.message } }
    );
  }

  /**
   * Creates a swap status update optimistic update error
   */
  static swapStatusUpdate(
    originalSwap: any,
    optimisticSwap: any,
    error: Error
  ): OptimisticUpdateError {
    return new OptimisticUpdateError(
      'update_swap_status',
      'Failed to update swap status. Changes have been reverted.',
      originalSwap,
      optimisticSwap,
      { swapId: originalSwap.id, status: originalSwap.status },
      { operation: 'update_swap_status', metadata: { originalError: error.message } }
    );
  }

  /**
   * Gets rollback instructions for the UI
   */
  getRollbackInstructions(): {
    action: 'remove' | 'restore' | 'update';
    target: string;
    data: any;
  } {
    return {
      action: this.rollbackData.action || 'restore',
      target: this.rollbackData.bookingId || this.rollbackData.proposalId || this.rollbackData.swapId,
      data: this.rollbackData
    };
  }
}

/**
 * Error recovery strategies
 */
export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'rollback' | 'ignore';
  message: string;
  action?: () => Promise<void>;
  delay?: number;
  maxAttempts?: number;
}

/**
 * Error recovery manager for UI simplification errors
 */
export class UIErrorRecoveryManager {
  private retryAttempts: Map<string, number> = new Map();

  /**
   * Gets recovery strategy for a given error
   */
  getRecoveryStrategy(error: UISimplificationError): ErrorRecoveryStrategy {
    if (error instanceof FormValidationError) {
      return this.getFormValidationRecovery(error);
    }

    if (error instanceof InlineProposalError) {
      return this.getInlineProposalRecovery(error);
    }

    if (error instanceof FilterApplicationError) {
      return this.getFilterApplicationRecovery(error);
    }

    if (error instanceof OptimisticUpdateError) {
      return this.getOptimisticUpdateRecovery(error);
    }

    return {
      type: 'ignore',
      message: 'Unknown error type. Please try again or contact support.'
    };
  }

  private getFormValidationRecovery(error: FormValidationError): ErrorRecoveryStrategy {
    return {
      type: 'ignore',
      message: error.getDisplayMessage()
    };
  }

  private getInlineProposalRecovery(error: InlineProposalError): ErrorRecoveryStrategy {
    if (error.canRetry()) {
      const attemptKey = `${error.bookingId}-${error.proposalType}`;
      const attempts = this.retryAttempts.get(attemptKey) || 0;

      if (attempts < error.maxRetries) {
        this.retryAttempts.set(attemptKey, attempts + 1);
        
        return {
          type: 'retry',
          message: `Retrying proposal submission (attempt ${attempts + 1}/${error.maxRetries})...`,
          delay: Math.pow(2, attempts) * 1000, // Exponential backoff
          maxAttempts: error.maxRetries
        };
      }
    }

    // Fallback to manual retry or different proposal type
    if (error.proposalType === 'cash') {
      return {
        type: 'fallback',
        message: 'Cash proposal failed. Try making a booking exchange proposal instead.'
      };
    }

    return {
      type: 'fallback',
      message: 'Proposal submission failed. Please try again later or contact the booking owner directly.'
    };
  }

  private getFilterApplicationRecovery(error: FilterApplicationError): ErrorRecoveryStrategy {
    const fallbackStrategy = error.getFallbackStrategy();

    if (fallbackStrategy.type === 'cached_results') {
      return {
        type: 'fallback',
        message: fallbackStrategy.message
      };
    }

    if (fallbackStrategy.type === 'basic_filter') {
      return {
        type: 'fallback',
        message: fallbackStrategy.message
      };
    }

    return {
      type: 'retry',
      message: 'Filter application failed. Retrying with simplified options...',
      delay: 1000,
      maxAttempts: 2
    };
  }

  private getOptimisticUpdateRecovery(error: OptimisticUpdateError): ErrorRecoveryStrategy {
    return {
      type: 'rollback',
      message: error.message,
      action: async () => {
        // Rollback logic would be implemented by the calling component
        console.log('Rolling back optimistic update:', error.getRollbackInstructions());
      }
    };
  }

  /**
   * Clears retry attempts for a specific operation
   */
  clearRetryAttempts(key: string): void {
    this.retryAttempts.delete(key);
  }

  /**
   * Resets all retry attempts
   */
  resetRetryAttempts(): void {
    this.retryAttempts.clear();
  }
}

/**
 * Utility functions for error handling
 */
export const UIErrorUtils = {
  /**
   * Checks if an error is a UI simplification error
   */
  isUISimplificationError(error: Error): error is UISimplificationError {
    return error instanceof UISimplificationError;
  },

  /**
   * Extracts field errors from a list of validation errors
   */
  extractFieldErrors(errors: FormValidationError[]): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};

    errors.forEach(error => {
      if (error.field) {
        if (!fieldErrors[error.field]) {
          fieldErrors[error.field] = [];
        }
        fieldErrors[error.field].push(error.getDisplayMessage());
      }
    });

    return fieldErrors;
  },

  /**
   * Groups errors by component
   */
  groupErrorsByComponent(errors: UISimplificationError[]): Record<string, UISimplificationError[]> {
    const grouped: Record<string, UISimplificationError[]> = {};

    errors.forEach(error => {
      const component = error.component || 'unknown';
      if (!grouped[component]) {
        grouped[component] = [];
      }
      grouped[component].push(error);
    });

    return grouped;
  },

  /**
   * Creates a user-friendly error summary
   */
  createErrorSummary(errors: UISimplificationError[]): {
    title: string;
    message: string;
    actionable: boolean;
    severity: 'low' | 'medium' | 'high';
  } {
    if (errors.length === 0) {
      return {
        title: 'No errors',
        message: 'All operations completed successfully.',
        actionable: false,
        severity: 'low'
      };
    }

    const hasFormErrors = errors.some(e => e instanceof FormValidationError);
    const hasProposalErrors = errors.some(e => e instanceof InlineProposalError);
    const hasFilterErrors = errors.some(e => e instanceof FilterApplicationError);
    const hasOptimisticErrors = errors.some(e => e instanceof OptimisticUpdateError);

    if (hasFormErrors) {
      return {
        title: 'Form Validation Issues',
        message: 'Please correct the highlighted fields and try again.',
        actionable: true,
        severity: 'medium'
      };
    }

    if (hasProposalErrors) {
      return {
        title: 'Proposal Submission Failed',
        message: 'There was an issue submitting your proposal. Please try again.',
        actionable: true,
        severity: 'high'
      };
    }

    if (hasFilterErrors) {
      return {
        title: 'Filter Issues',
        message: 'Some filters could not be applied. Results may be incomplete.',
        actionable: false,
        severity: 'low'
      };
    }

    if (hasOptimisticErrors) {
      return {
        title: 'Update Failed',
        message: 'Your changes could not be saved and have been reverted.',
        actionable: true,
        severity: 'high'
      };
    }

    return {
      title: 'Multiple Issues',
      message: `${errors.length} issues occurred. Please review and try again.`,
      actionable: true,
      severity: 'medium'
    };
  }
};

/**
 * Export the error recovery manager instance
 */
export const uiErrorRecoveryManager = new UIErrorRecoveryManager();