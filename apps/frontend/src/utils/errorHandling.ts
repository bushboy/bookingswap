import {
  SwapPlatformError,
  AuctionError,
  PaymentError,
  TimingError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Enhanced error message mapping for user-friendly display with detailed explanations
export const ERROR_MESSAGES = {
  // Auction timing errors with detailed explanations
  [ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT]: {
    title: 'Auction Timing Restriction',
    message:
      'Auctions must end at least one week before the event date to ensure sufficient time for booking transfers and coordination.',
    suggestion:
      'Please select an earlier auction end date or switch to first-match acceptance for immediate processing.',
    actions: ['adjust_end_date', 'switch_to_first_match'],
    explanation:
      'This restriction ensures that both parties have adequate time to complete the booking transfer process, handle any potential issues, and make necessary arrangements before the event.',
  },
  [ERROR_CODES.LAST_MINUTE_RESTRICTION]: {
    title: 'Last-Minute Booking Limitation',
    message:
      'Auctions are not available for events less than one week away to prevent complications with booking transfers.',
    suggestion:
      'Use first-match acceptance for immediate processing of your swap request.',
    actions: ['switch_to_first_match'],
    explanation:
      'For events happening soon, we prioritize quick matches to ensure successful booking transfers. Auctions require additional time for proposal collection and winner selection.',
  },
  [ERROR_CODES.AUCTION_EXPIRED]: {
    title: 'Auction Has Ended',
    message:
      'This auction has concluded and is no longer accepting new proposals. The owner is now reviewing submitted offers.',
    suggestion:
      'Look for other active swaps or create your own swap proposal to find alternative opportunities.',
    actions: ['browse_swaps', 'create_swap'],
    explanation:
      'Once an auction ends, no new proposals can be submitted. The auction owner has a limited time to select a winner from existing proposals.',
  },
  [ERROR_CODES.AUCTION_ALREADY_ENDED]: {
    title: 'Auction Completed',
    message: 'This auction has already concluded and a decision has been made.',
    suggestion:
      'Check if a winner has been selected or explore other available swap opportunities.',
    actions: ['view_results', 'browse_swaps'],
    explanation:
      'The auction process is complete. If you submitted a proposal, you should have received a notification about the outcome.',
  },
  [ERROR_CODES.PROPOSAL_ALREADY_SELECTED]: {
    title: 'Winner Already Selected',
    message:
      'A winning proposal has already been chosen for this auction and the swap process is underway.',
    suggestion:
      'Look for other active auctions or create your own swap to find new opportunities.',
    actions: ['browse_swaps', 'create_swap'],
    explanation:
      'Once a winner is selected, the auction is closed and the booking transfer process begins between the selected parties.',
  },

  // Payment errors with detailed explanations
  [ERROR_CODES.PAYMENT_METHOD_INVALID]: {
    title: 'Payment Method Issue',
    message:
      'The selected payment method is not valid, has expired, or cannot be used for this transaction.',
    suggestion:
      'Please verify your payment method details or select a different verified payment method.',
    actions: ['verify_payment_method', 'select_different_method'],
    explanation:
      "Payment methods must be current and verified to ensure secure transactions. Check that your card hasn't expired and that all details are correct.",
  },
  [ERROR_CODES.PAYMENT_METHOD_NOT_VERIFIED]: {
    title: 'Payment Verification Required',
    message:
      'Your payment method needs to be verified before you can make cash offers to ensure transaction security.',
    suggestion:
      'Complete the verification process by following the instructions sent to your email or phone.',
    actions: ['verify_payment_method'],
    explanation:
      'Verification helps protect both buyers and sellers by confirming payment method ownership and reducing fraud risk.',
  },
  [ERROR_CODES.CASH_OFFER_BELOW_MINIMUM]: {
    title: 'Offer Below Minimum',
    message:
      'Your cash offer is below the minimum amount specified by the swap owner.',
    suggestion:
      'Increase your offer to meet or exceed the minimum requirement to participate in this auction.',
    actions: ['increase_offer'],
    explanation:
      'Swap owners set minimum amounts to ensure offers meet their expectations. You can still submit a higher offer if the auction is active.',
  },
  [ERROR_CODES.INSUFFICIENT_FUNDS]: {
    title: 'Insufficient Funds',
    message:
      'There are not enough funds available in your account or payment method for this transaction.',
    suggestion:
      'Please check your account balance, add funds, or use a different payment method with sufficient balance.',
    actions: ['check_balance', 'add_funds', 'select_different_method'],
    explanation:
      'Cash offers require immediate fund availability to create a secure escrow. Ensure your payment method has sufficient funds plus any applicable fees.',
  },
  [ERROR_CODES.ESCROW_CREATION_FAILED]: {
    title: 'Escrow Setup Failed',
    message:
      'Unable to create the secure escrow account required for this cash transaction.',
    suggestion:
      'Please try again in a few moments or contact support if the problem persists.',
    actions: ['retry', 'contact_support'],
    explanation:
      'Escrow accounts protect both parties by holding funds securely until the booking transfer is complete. This ensures safe transactions for everyone.',
  },
  [ERROR_CODES.FRAUD_DETECTION_TRIGGERED]: {
    title: 'Security Review Required',
    message:
      'This transaction has been flagged by our security system and requires additional review.',
    suggestion:
      'Please contact our support team to verify your identity and complete the transaction.',
    actions: ['contact_support'],
    explanation:
      'Our fraud detection system helps protect all users. This review is a standard security measure and will be resolved quickly.',
  },

  // Enhanced validation errors
  [ERROR_CODES.INVALID_INPUT]: {
    title: 'Invalid Information',
    message:
      "Some of the information provided doesn't meet the required format or criteria.",
    suggestion:
      'Please review the highlighted fields and correct any errors before submitting.',
    actions: ['review_input'],
    explanation:
      'Each field has specific requirements to ensure data quality and system functionality. Check for proper formats, lengths, and valid values.',
  },
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: {
    title: 'Required Information Missing',
    message:
      'Please fill in all required fields marked with an asterisk (*) to continue.',
    suggestion:
      'Check the form for any empty required fields and complete them with valid information.',
    actions: ['complete_form'],
    explanation:
      'Required fields are essential for processing your request and ensuring all necessary information is available.',
  },

  // Enhanced business logic errors
  [ERROR_CODES.BOOKING_NOT_FOUND]: {
    title: 'Booking Unavailable',
    message:
      "The booking you're trying to swap is no longer available or has been removed.",
    suggestion:
      'The booking may have been cancelled, transferred, or is no longer active. Please refresh and try again.',
    actions: ['browse_bookings', 'refresh_page'],
    explanation:
      'Bookings can become unavailable due to cancellations, transfers, or other changes. Our system updates in real-time to reflect current availability.',
  },
  [ERROR_CODES.SWAP_ALREADY_RESPONDED]: {
    title: 'Already Responded',
    message: 'You have already submitted a response to this swap proposal.',
    suggestion:
      'Check your swap history to see the current status of your response.',
    actions: ['view_swap_history'],
    explanation:
      'Each user can only respond once to a swap proposal to prevent duplicate submissions and maintain fair auction processes.',
  },

  // Default error with helpful guidance
  DEFAULT: {
    title: 'Unexpected Error',
    message: 'Something unexpected happened while processing your request.',
    suggestion:
      'Please try again in a few moments. If the problem continues, our support team can help.',
    actions: ['retry', 'contact_support'],
    explanation:
      'Temporary issues can occur due to network conditions or system maintenance. Most problems resolve quickly with a retry.',
  },
};

export interface ErrorDisplayInfo {
  title: string;
  message: string;
  suggestion: string;
  actions: string[];
  severity: 'error' | 'warning' | 'info';
  retryable: boolean;
  explanation?: string;
  context?: Record<string, any>;
}

export const getErrorDisplayInfo = (
  error: Error | SwapPlatformError
): ErrorDisplayInfo => {
  let errorInfo = ERROR_MESSAGES.DEFAULT;
  let severity: 'error' | 'warning' | 'info' = 'error';
  let retryable = false;
  let context: Record<string, any> = {};

  if (error instanceof SwapPlatformError) {
    errorInfo =
      ERROR_MESSAGES[error.code as keyof typeof ERROR_MESSAGES] ||
      ERROR_MESSAGES.DEFAULT;
    retryable = error.retryable;
    context = error.context?.metadata || {};

    // Determine severity based on error category and specific codes
    switch (error.category) {
      case 'validation':
        severity = 'warning';
        break;
      case 'business':
        // Some business errors are more informational than problematic
        if (
          [
            ERROR_CODES.LAST_MINUTE_RESTRICTION,
            ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT,
            ERROR_CODES.AUCTION_EXPIRED,
          ].includes(error.code as any)
        ) {
          severity = 'info';
        } else {
          severity = 'warning';
        }
        break;
      case 'integration':
      case 'blockchain':
        severity = 'error';
        break;
      default:
        severity = 'error';
    }
  }

  return {
    ...errorInfo,
    severity,
    retryable,
    context,
  };
};

// Specific error handlers for different contexts
export class AuctionErrorHandler {
  static handleTimingError(
    error: TimingError,
    eventDate?: Date
  ): ErrorDisplayInfo {
    const baseInfo = getErrorDisplayInfo(error);

    if (
      error.code === ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT &&
      error.minimumRequiredDate
    ) {
      return {
        ...baseInfo,
        message: `Auction must end before ${error.minimumRequiredDate.toLocaleDateString()} (one week before the event).`,
        suggestion: `Set your auction end date before ${error.minimumRequiredDate.toLocaleDateString()} or switch to first-match acceptance.`,
      };
    }

    if (error.code === ERROR_CODES.LAST_MINUTE_RESTRICTION && eventDate) {
      return {
        ...baseInfo,
        message: `Your event on ${eventDate.toLocaleDateString()} is less than one week away.`,
        suggestion:
          'Use first-match acceptance for immediate processing of proposals.',
      };
    }

    return baseInfo;
  }

  static handleProposalError(
    error: SwapPlatformError,
    auctionEndDate?: Date
  ): ErrorDisplayInfo {
    const baseInfo = getErrorDisplayInfo(error);

    if (error.code === ERROR_CODES.AUCTION_EXPIRED && auctionEndDate) {
      return {
        ...baseInfo,
        message: `This auction ended on ${auctionEndDate.toLocaleDateString()}.`,
        suggestion: 'Look for other active auctions or create your own swap.',
      };
    }

    return baseInfo;
  }
}

export class PaymentErrorHandler {
  static handlePaymentMethodError(
    error: PaymentError,
    paymentMethodType?: string
  ): ErrorDisplayInfo {
    const baseInfo = getErrorDisplayInfo(error);

    if (
      error.code === ERROR_CODES.PAYMENT_METHOD_INVALID &&
      paymentMethodType
    ) {
      return {
        ...baseInfo,
        message: `Your ${paymentMethodType} payment method needs attention.`,
        suggestion: 'Please verify or update your payment method to continue.',
      };
    }

    return baseInfo;
  }

  static handleAmountError(
    error: PaymentError,
    minimumAmount?: number
  ): ErrorDisplayInfo {
    const baseInfo = getErrorDisplayInfo(error);

    if (error.code === ERROR_CODES.CASH_OFFER_BELOW_MINIMUM && minimumAmount) {
      return {
        ...baseInfo,
        message: `Your offer must be at least $${minimumAmount.toLocaleString()}.`,
        suggestion: `Increase your offer to $${minimumAmount.toLocaleString()} or more to meet the requirement.`,
      };
    }

    return baseInfo;
  }
}

// Error boundary helpers
export const shouldShowErrorBoundary = (error: Error): boolean => {
  // Don't show error boundary for validation errors or business logic errors
  if (error instanceof SwapPlatformError) {
    return !['validation', 'business'].includes(error.category);
  }

  return true;
};

export const getErrorBoundaryMessage = (error: Error): string => {
  if (error instanceof SwapPlatformError) {
    switch (error.category) {
      case 'blockchain':
        return 'There was an issue with the blockchain transaction. Please try again.';
      case 'integration':
        return "We're experiencing connectivity issues. Please try again in a moment.";
      case 'server_error':
        return 'Our servers are experiencing issues. Please try again later.';
      default:
        return 'Something unexpected happened. Please refresh the page and try again.';
    }
  }

  return 'An unexpected error occurred. Please refresh the page.';
};

// Retry logic
export const shouldRetry = (error: Error, attemptCount: number): boolean => {
  if (attemptCount >= 3) return false;

  if (error instanceof SwapPlatformError) {
    return error.retryable;
  }

  return false;
};

export const getRetryDelay = (attemptCount: number): number => {
  // Exponential backoff: 1s, 2s, 4s
  return Math.pow(2, attemptCount) * 1000;
};

// Graceful degradation helpers for auction features
export const createAuctionFallbackStrategy = (
  eventDate: Date,
  currentDate: Date = new Date()
) => {
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const timeUntilEvent = eventDate.getTime() - currentDate.getTime();
  const isLastMinute = timeUntilEvent < oneWeekInMs;

  return {
    isLastMinute,
    allowAuctions: !isLastMinute,
    timeUntilEvent,
    daysUntilEvent: Math.ceil(timeUntilEvent / (24 * 60 * 60 * 1000)),
    fallbackStrategy: {
      type: 'first_match' as const,
      reason: isLastMinute ? 'Event is less than one week away' : null,
      message: isLastMinute
        ? 'Your swap will use first-match acceptance for faster processing since your event is coming up soon.'
        : null,
    },
    maxAuctionEndDate: isLastMinute
      ? null
      : new Date(eventDate.getTime() - oneWeekInMs),
  };
};

export const createPaymentFallbackStrategy = (paymentError: PaymentError) => {
  const fallbackStrategies = {
    [ERROR_CODES.PAYMENT_METHOD_INVALID]: {
      fallback: 'booking_only',
      message:
        'You can still make booking exchange proposals while resolving payment method issues.',
      actions: ['verify_payment_method', 'make_booking_proposal'],
    },
    [ERROR_CODES.INSUFFICIENT_FUNDS]: {
      fallback: 'booking_only',
      message:
        'Consider making a booking exchange proposal instead of a cash offer.',
      actions: ['add_funds', 'make_booking_proposal'],
    },
    [ERROR_CODES.ESCROW_CREATION_FAILED]: {
      fallback: 'retry_later',
      message:
        'Payment processing is temporarily unavailable. You can try again later or make a booking proposal.',
      actions: ['retry_later', 'make_booking_proposal'],
    },
  };

  return (
    fallbackStrategies[
      paymentError.code as keyof typeof fallbackStrategies
    ] || {
      fallback: 'booking_only',
      message: 'You can still participate with booking exchange proposals.',
      actions: ['make_booking_proposal', 'contact_support'],
    }
  );
};

// Enhanced retry logic with context-aware decisions
export const createContextualRetryHandler = (
  context: 'auction' | 'payment' | 'general'
) => {
  const retryConfigs = {
    auction: { maxRetries: 2, baseDelay: 1000, backoffMultiplier: 1.5 },
    payment: { maxRetries: 3, baseDelay: 2000, backoffMultiplier: 2 },
    general: { maxRetries: 3, baseDelay: 1000, backoffMultiplier: 2 },
  };

  const config = retryConfigs[context];

  return async <T>(
    operation: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<T> => {
    let lastError: Error;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Context-specific retry logic
        if (shouldRetry && !shouldRetry(error as Error, attempt)) {
          throw error;
        }

        // Don't retry validation or authentication errors
        if (error instanceof SwapPlatformError) {
          if (
            ['validation', 'authentication', 'authorization'].includes(
              error.category
            )
          ) {
            throw error;
          }
        }

        if (attempt === config.maxRetries) {
          break;
        }

        // Context-aware delay
        const delay =
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
        const jitter = Math.random() * 0.1 * delay;
        await new Promise(resolve => setTimeout(resolve, delay + jitter));
      }
    }

    throw lastError!;
  };
};

// User-friendly error formatting with enhanced context
export const formatErrorForUser = (
  error: Error,
  context?: Record<string, any>
): {
  title: string;
  message: string;
  details?: string;
  explanation?: string;
  actions: Array<{
    label: string;
    action: string;
    primary?: boolean;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  }>;
  severity: 'error' | 'warning' | 'info';
} => {
  const errorInfo = getErrorDisplayInfo(error);

  const actionMap = {
    adjust_end_date: {
      label: 'Adjust End Date',
      action: 'adjust_end_date',
      primary: true,
      variant: 'primary' as const,
    },
    switch_to_first_match: {
      label: 'Use First Match',
      action: 'switch_to_first_match',
      variant: 'outline' as const,
    },
    verify_payment_method: {
      label: 'Verify Payment',
      action: 'verify_payment_method',
      primary: true,
      variant: 'primary' as const,
    },
    select_different_method: {
      label: 'Choose Different Method',
      action: 'select_different_method',
      variant: 'outline' as const,
    },
    increase_offer: {
      label: 'Increase Offer',
      action: 'increase_offer',
      primary: true,
      variant: 'primary' as const,
    },
    add_funds: {
      label: 'Add Funds',
      action: 'add_funds',
      variant: 'outline' as const,
    },
    check_balance: {
      label: 'Check Balance',
      action: 'check_balance',
      variant: 'ghost' as const,
    },
    make_booking_proposal: {
      label: 'Make Booking Proposal',
      action: 'make_booking_proposal',
      variant: 'outline' as const,
    },
    retry: {
      label: 'Try Again',
      action: 'retry',
      primary: true,
      variant: 'primary' as const,
    },
    retry_later: {
      label: 'Try Later',
      action: 'retry_later',
      variant: 'outline' as const,
    },
    contact_support: {
      label: 'Contact Support',
      action: 'contact_support',
      variant: 'ghost' as const,
    },
    browse_swaps: {
      label: 'Browse Swaps',
      action: 'browse_swaps',
      variant: 'outline' as const,
    },
    create_swap: {
      label: 'Create Swap',
      action: 'create_swap',
      variant: 'outline' as const,
    },
    view_results: {
      label: 'View Results',
      action: 'view_results',
      variant: 'ghost' as const,
    },
    view_swap_history: {
      label: 'View History',
      action: 'view_swap_history',
      variant: 'ghost' as const,
    },
    browse_bookings: {
      label: 'Browse Bookings',
      action: 'browse_bookings',
      variant: 'outline' as const,
    },
    refresh_page: {
      label: 'Refresh',
      action: 'refresh_page',
      variant: 'ghost' as const,
    },
    review_input: {
      label: 'Review Input',
      action: 'review_input',
      variant: 'outline' as const,
    },
    complete_form: {
      label: 'Complete Form',
      action: 'complete_form',
      primary: true,
      variant: 'primary' as const,
    },
  };

  const actions = errorInfo.actions.map(
    actionKey =>
      actionMap[actionKey as keyof typeof actionMap] || {
        label: 'OK',
        action: 'dismiss',
        variant: 'ghost' as const,
      }
  );

  return {
    title: errorInfo.title,
    message: errorInfo.message,
    details: errorInfo.suggestion,
    explanation: errorInfo.explanation,
    actions,
    severity: errorInfo.severity,
  };
};

// Global error handler for unhandled promise rejections
export const setupGlobalErrorHandling = () => {
  window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);

    // Don't prevent default for validation errors
    if (
      event.reason instanceof SwapPlatformError &&
      event.reason.category === 'validation'
    ) {
      return;
    }

    // Log to error reporting service
    // reportError(event.reason);
  });

  window.addEventListener('error', event => {
    console.error('Global error:', event.error);

    // Log to error reporting service
    // reportError(event.error);
  });
};
