import { PaymentErrorDetails } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export interface PaymentErrorContext {
  userId?: string;
  transactionId?: string;
  paymentMethodId?: string;
  escrowId?: string;
  amount?: number;
  currency?: string;
  operation: string;
}

export interface ErrorResponse {
  message: string;
  suggestion: string;
  allowedActions: string[];
  retryable: boolean;
  retryAfter?: number; // seconds
}

export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorDetails['code'],
    message: string,
    public context?: PaymentErrorContext,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

export class PaymentErrorHandler {
  private readonly RETRY_DELAYS = {
    'PAYMENT_PROCESSING_FAILED': 30, // 30 seconds
    'ESCROW_CREATION_FAILED': 60, // 1 minute
    'ESCROW_RELEASE_FAILED': 120, // 2 minutes
    'INSUFFICIENT_FUNDS': 0, // Not retryable
    'PAYMENT_METHOD_INVALID': 0, // Not retryable
    'REFUND_FAILED': 300 // 5 minutes
  };

  /**
   * Handle payment processing errors with appropriate responses
   */
  handlePaymentError(error: PaymentError): ErrorResponse {
    logger.error('Handling payment error', {
      code: error.code,
      message: error.message,
      context: error.context,
      retryable: error.retryable
    });

    switch (error.code) {
      case 'PAYMENT_METHOD_INVALID':
        return this.handlePaymentMethodInvalidError(error);
      
      case 'INSUFFICIENT_FUNDS':
        return this.handleInsufficientFundsError(error);
      
      case 'ESCROW_CREATION_FAILED':
        return this.handleEscrowCreationFailedError(error);
      
      case 'PAYMENT_PROCESSING_FAILED':
        return this.handlePaymentProcessingFailedError(error);
      
      case 'REFUND_FAILED':
        return this.handleRefundFailedError(error);
      
      case 'ESCROW_RELEASE_FAILED':
        return this.handleEscrowReleaseFailedError(error);
      
      default:
        return this.handleGenericPaymentError(error);
    }
  }

  /**
   * Handle payment method validation errors
   */
  private handlePaymentMethodInvalidError(error: PaymentError): ErrorResponse {
    return {
      message: 'The selected payment method is not valid or has expired',
      suggestion: 'Please verify your payment method details or select a different payment method',
      allowedActions: [
        'verify_payment_method',
        'select_different_method',
        'add_new_payment_method'
      ],
      retryable: false
    };
  }

  /**
   * Handle insufficient funds errors
   */
  private handleInsufficientFundsError(error: PaymentError): ErrorResponse {
    return {
      message: 'Insufficient funds available for this transaction',
      suggestion: 'Please ensure your payment method has sufficient funds or use a different payment method',
      allowedActions: [
        'check_balance',
        'add_funds',
        'select_different_method',
        'reduce_amount'
      ],
      retryable: false
    };
  }

  /**
   * Handle escrow creation failures
   */
  private handleEscrowCreationFailedError(error: PaymentError): ErrorResponse {
    return {
      message: 'Unable to create secure escrow account for this transaction',
      suggestion: 'This is usually a temporary issue. Please try again in a few minutes',
      allowedActions: [
        'retry_escrow_creation',
        'contact_support',
        'proceed_without_escrow'
      ],
      retryable: true,
      retryAfter: this.RETRY_DELAYS['ESCROW_CREATION_FAILED']
    };
  }

  /**
   * Handle payment processing failures
   */
  private handlePaymentProcessingFailedError(error: PaymentError): ErrorResponse {
    return {
      message: 'Payment processing failed due to a technical issue',
      suggestion: 'Please try again or contact your payment provider if the issue persists',
      allowedActions: [
        'retry_payment',
        'select_different_method',
        'contact_support',
        'check_payment_provider'
      ],
      retryable: true,
      retryAfter: this.RETRY_DELAYS['PAYMENT_PROCESSING_FAILED']
    };
  }

  /**
   * Handle refund failures
   */
  private handleRefundFailedError(error: PaymentError): ErrorResponse {
    return {
      message: 'Refund processing failed',
      suggestion: 'We will continue attempting to process your refund. Contact support if not resolved within 24 hours',
      allowedActions: [
        'retry_refund',
        'contact_support',
        'check_refund_status'
      ],
      retryable: true,
      retryAfter: this.RETRY_DELAYS['REFUND_FAILED']
    };
  }

  /**
   * Handle escrow release failures
   */
  private handleEscrowReleaseFailedError(error: PaymentError): ErrorResponse {
    return {
      message: 'Failed to release escrow funds',
      suggestion: 'This may be due to verification requirements. Please contact support for assistance',
      allowedActions: [
        'retry_escrow_release',
        'verify_identity',
        'contact_support',
        'check_escrow_status'
      ],
      retryable: true,
      retryAfter: this.RETRY_DELAYS['ESCROW_RELEASE_FAILED']
    };
  }

  /**
   * Handle generic payment errors
   */
  private handleGenericPaymentError(error: PaymentError): ErrorResponse {
    return {
      message: 'An unexpected payment error occurred',
      suggestion: 'Please try again or contact support if the issue persists',
      allowedActions: [
        'retry_operation',
        'contact_support'
      ],
      retryable: error.retryable,
      retryAfter: error.retryable ? 60 : undefined
    };
  }

  /**
   * Create a payment error with context
   */
  createPaymentError(
    code: PaymentErrorDetails['code'],
    message: string,
    context: PaymentErrorContext,
    retryable: boolean = false
  ): PaymentError {
    return new PaymentError(code, message, context, retryable);
  }

  /**
   * Determine if an error is retryable based on its characteristics
   */
  isRetryable(error: Error): boolean {
    if (error instanceof PaymentError) {
      return error.retryable;
    }

    // Check for common retryable error patterns
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /temporary/i,
      /service unavailable/i,
      /rate limit/i
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Get retry delay for a specific error
   */
  getRetryDelay(error: PaymentError): number {
    return this.RETRY_DELAYS[error.code] || 60;
  }

  /**
   * Log payment error with structured data
   */
  logPaymentError(error: PaymentError, additionalContext?: Record<string, any>): void {
    logger.error('Payment operation failed', {
      errorCode: error.code,
      errorMessage: error.message,
      context: error.context,
      retryable: error.retryable,
      stack: error.stack,
      ...additionalContext
    });
  }

  /**
   * Create user-friendly error message
   */
  createUserFriendlyMessage(error: PaymentError): string {
    const errorResponse = this.handlePaymentError(error);
    return `${errorResponse.message} ${errorResponse.suggestion}`;
  }

  /**
   * Handle retry logic with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (!this.isRetryable(error) || attempt === maxRetries) {
          throw error;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.info('Retrying payment operation', {
          attempt,
          maxRetries,
          delay,
          error: error.message
        });

        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate error context completeness
   */
  validateErrorContext(context: PaymentErrorContext): string[] {
    const missing: string[] = [];

    if (!context.operation) {
      missing.push('operation');
    }

    // Add specific validations based on operation type
    switch (context.operation) {
      case 'payment_processing':
        if (!context.userId) missing.push('userId');
        if (!context.paymentMethodId) missing.push('paymentMethodId');
        if (!context.amount) missing.push('amount');
        break;
      
      case 'escrow_creation':
        if (!context.userId) missing.push('userId');
        if (!context.amount) missing.push('amount');
        break;
      
      case 'escrow_release':
        if (!context.escrowId) missing.push('escrowId');
        if (!context.transactionId) missing.push('transactionId');
        break;
    }

    return missing;
  }
}