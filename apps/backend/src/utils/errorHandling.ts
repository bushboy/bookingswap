import { Request, Response, NextFunction } from 'express';
import { 
  SwapPlatformError, 
  AuctionError, 
  PaymentError, 
  TimingError,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES 
} from '@booking-swap/shared';

// Extended Request interface to include request ID
interface ExtendedRequest extends Request {
  id?: string;
}

// Enhanced error handler middleware with specific auction and payment error handling
export const errorHandler = (
  error: Error,
  req: ExtendedRequest,
  res: Response,
  _next: NextFunction
) => {
  console.error('Error occurred:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Handle SwapPlatformError instances with enhanced context
  if (error instanceof SwapPlatformError) {
    const enhancedError = enhanceErrorWithContext(error, req);
    return res.status(getStatusCode(enhancedError)).json(enhancedError.toJSON());
  }

  // Handle validation errors from Joi or other validators
  if (error.name === 'ValidationError' || error.message.includes('validation')) {
    const validationError = new ValidationError(
      error.message,
      { originalError: error.message },
      { requestId: req.id, userId: req.user?.id }
    );
    return res.status(400).json(validationError.toJSON());
  }

  // Handle database errors
  if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
    const duplicateError = new BusinessLogicError(
      ERROR_CODES.INVALID_INPUT,
      'A record with this information already exists',
      { requestId: req.id, userId: req.user?.id }
    );
    return res.status(409).json(duplicateError.toJSON());
  }

  // Handle not found errors
  if (error.message.includes('not found') || error.message.includes('does not exist')) {
    const notFoundError = new BusinessLogicError(
      ERROR_CODES.BOOKING_NOT_FOUND,
      'The requested resource was not found',
      { requestId: req.id, userId: req.user?.id }
    );
    return res.status(404).json(notFoundError.toJSON());
  }

  // Default server error
  const serverError = new SwapPlatformError(
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    'server_error',
    true,
    { requestId: req.id, userId: req.user?.id },
    error
  );

  return res.status(500).json(serverError.toJSON());
};

// Enhance errors with additional context for better user feedback
const enhanceErrorWithContext = (error: SwapPlatformError, req: ExtendedRequest): SwapPlatformError => {
  const context = {
    ...error.context,
    requestId: req.id,
    userId: req.user?.id,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  };

  // Add specific context for auction timing errors
  if (error instanceof TimingError) {
    return new TimingError(
      error.code,
      getEnhancedTimingErrorMessage(error),
      error.eventDate,
      error.auctionEndDate,
      error.minimumRequiredDate,
      context
    );
  }

  // Add specific context for auction errors
  if (error instanceof AuctionError) {
    return new AuctionError(
      error.code,
      getEnhancedAuctionErrorMessage(error),
      error.auctionId,
      error.eventDate,
      context
    );
  }

  // Add specific context for payment errors
  if (error instanceof PaymentError) {
    return new PaymentError(
      error.code,
      getEnhancedPaymentErrorMessage(error),
      error.transactionId,
      error.paymentMethodId,
      error.escrowId,
      context
    );
  }

  return error;
};

// Get appropriate HTTP status code for SwapPlatformError
const getStatusCode = (error: SwapPlatformError): number => {
  switch (error.category) {
    case 'validation':
      return 400;
    case 'authentication':
      return 401;
    case 'authorization':
      return 403;
    case 'business':
      switch (error.code) {
        case ERROR_CODES.BOOKING_NOT_FOUND:
        case ERROR_CODES.SWAP_NOT_FOUND:
        case ERROR_CODES.AUCTION_NOT_FOUND:
          return 404;
        case ERROR_CODES.SWAP_ALREADY_RESPONDED:
        case ERROR_CODES.AUCTION_ALREADY_ENDED:
          return 409;
        default:
          return 400;
      }
    case 'rate_limiting':
      return 429;
    case 'server_error':
      return 500;
    default:
      return 500;
  }
};

// Auction-specific error handlers
export class AuctionErrorHandler {
  static handleTimingError(eventDate: Date, auctionEndDate?: Date): TimingError {
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const currentDate = new Date();
    const isLastMinute = eventDate.getTime() - currentDate.getTime() < oneWeekInMs;
    const minimumEndDate = new Date(eventDate.getTime() - oneWeekInMs);

    if (isLastMinute) {
      return new TimingError(
        ERROR_CODES.LAST_MINUTE_RESTRICTION,
        'Auctions are not allowed for events less than one week away',
        eventDate,
        auctionEndDate,
        minimumEndDate
      );
    }

    if (auctionEndDate && auctionEndDate >= minimumEndDate) {
      return new TimingError(
        ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT,
        'Auction must end at least one week before the event date',
        eventDate,
        auctionEndDate,
        minimumEndDate
      );
    }

    if (auctionEndDate && auctionEndDate <= currentDate) {
      return new TimingError(
        ERROR_CODES.INVALID_AUCTION_DURATION,
        'Auction end date must be in the future',
        eventDate,
        auctionEndDate,
        minimumEndDate
      );
    }

    throw new Error('No timing error detected');
  }

  static handleProposalError(
    auctionId: string,
    auction: { status: string; settings: { endDate: Date } },
    userId: string,
    ownerId: string
  ): AuctionError {
    if (userId === ownerId) {
      return new AuctionError(
        ERROR_CODES.INVALID_PROPOSAL_TYPE,
        'Auction owners cannot submit proposals to their own auctions',
        auctionId
      );
    }

    if (auction.status !== 'active') {
      return new AuctionError(
        ERROR_CODES.AUCTION_EXPIRED,
        'This auction is no longer accepting proposals',
        auctionId
      );
    }

    if (new Date() >= auction.settings.endDate) {
      return new AuctionError(
        ERROR_CODES.AUCTION_ALREADY_ENDED,
        'This auction has already ended',
        auctionId,
        auction.settings.endDate
      );
    }

    throw new Error('No proposal error detected');
  }

  static handleWinnerSelectionError(
    auctionId: string,
    auction: { status: string; winningProposalId?: string },
    userId: string,
    ownerId: string
  ): AuctionError {
    if (userId !== ownerId) {
      return new AuctionError(
        ERROR_CODES.ACCESS_DENIED,
        'Only auction owners can select winners',
        auctionId
      );
    }

    if (auction.status !== 'ended') {
      return new AuctionError(
        ERROR_CODES.INVALID_AUCTION_TIMING,
        'Can only select winners from ended auctions',
        auctionId
      );
    }

    if (auction.winningProposalId) {
      return new AuctionError(
        ERROR_CODES.PROPOSAL_ALREADY_SELECTED,
        'A winner has already been selected for this auction',
        auctionId
      );
    }

    throw new Error('No winner selection error detected');
  }
}

// Payment-specific error handlers
export class PaymentErrorHandler {
  static handlePaymentMethodError(
    paymentMethodId: string,
    paymentMethod?: { isVerified: boolean; type: string }
  ): PaymentError {
    if (!paymentMethod) {
      return new PaymentError(
        ERROR_CODES.PAYMENT_METHOD_INVALID,
        'Payment method not found or is invalid',
        undefined,
        paymentMethodId
      );
    }

    if (!paymentMethod.isVerified) {
      return new PaymentError(
        ERROR_CODES.PAYMENT_METHOD_NOT_VERIFIED,
        'Payment method must be verified before use',
        undefined,
        paymentMethodId
      );
    }

    throw new Error('No payment method error detected');
  }

  static handleAmountError(
    amount: number,
    minimumAmount?: number,
    maximumAmount?: number
  ): PaymentError {
    if (amount <= 0) {
      return new PaymentError(
        ERROR_CODES.INVALID_INPUT,
        'Payment amount must be greater than 0'
      );
    }

    if (minimumAmount && amount < minimumAmount) {
      return new PaymentError(
        ERROR_CODES.CASH_OFFER_BELOW_MINIMUM,
        `Payment amount must be at least $${minimumAmount}`
      );
    }

    if (maximumAmount && amount > maximumAmount) {
      return new PaymentError(
        ERROR_CODES.INVALID_INPUT,
        `Payment amount cannot exceed $${maximumAmount}`
      );
    }

    throw new Error('No amount error detected');
  }

  static handleEscrowError(escrowId: string, operation: string): PaymentError {
    return new PaymentError(
      ERROR_CODES.ESCROW_CREATION_FAILED,
      `Failed to ${operation} escrow account`,
      undefined,
      undefined,
      escrowId
    );
  }

  static handleFraudError(transactionId: string, riskLevel: string): PaymentError {
    return new PaymentError(
      ERROR_CODES.FRAUD_DETECTION_TRIGGERED,
      `Transaction flagged for ${riskLevel} fraud risk`,
      transactionId
    );
  }
}

// Graceful degradation helpers
export const createGracefulFallback = <T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>,
  errorMessage: string = 'Primary operation failed, using fallback'
) => {
  return async (): Promise<T> => {
    try {
      return await primaryOperation();
    } catch (error) {
      console.warn(errorMessage, error);
      return await fallbackOperation();
    }
  };
};

export const withRetry = <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
) => {
  return async (): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry validation or business logic errors
        if (error instanceof SwapPlatformError && 
            ['validation', 'business', 'authentication', 'authorization'].includes(error.category)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempt - 1)));
      }
    }
    
    throw lastError!;
  };
};

// Enhanced error message generators for specific error types
const getEnhancedTimingErrorMessage = (error: TimingError): string => {
  switch (error.code) {
    case ERROR_CODES.LAST_MINUTE_RESTRICTION:
      return `Auctions are not available for events less than one week away. Your event is on ${error.eventDate?.toLocaleDateString()}, which is too close to allow sufficient time for auction completion and booking transfers.`;
    
    case ERROR_CODES.AUCTION_TOO_CLOSE_TO_EVENT:
      const minDate = error.minimumRequiredDate?.toLocaleDateString();
      return `Auction must end at least one week before the event date. Please set your auction end date before ${minDate} to allow time for booking transfers.`;
    
    case ERROR_CODES.INVALID_AUCTION_DURATION:
      return 'Auction end date must be in the future and allow sufficient time for proposals and selection.';
    
    default:
      return error.message;
  }
};

const getEnhancedAuctionErrorMessage = (error: AuctionError): string => {
  switch (error.code) {
    case ERROR_CODES.AUCTION_EXPIRED:
      return 'This auction has ended and is no longer accepting proposals. The auction owner is now reviewing submitted proposals.';
    
    case ERROR_CODES.AUCTION_ALREADY_ENDED:
      return 'This auction has already concluded. Check if a winner has been selected or look for other active opportunities.';
    
    case ERROR_CODES.PROPOSAL_ALREADY_SELECTED:
      return 'A winning proposal has already been selected for this auction. The swap process is now in progress.';
    
    case ERROR_CODES.INVALID_PROPOSAL_TYPE:
      return 'This type of proposal is not accepted for this auction. Please check the auction requirements and try again.';
    
    default:
      return error.message;
  }
};

const getEnhancedPaymentErrorMessage = (error: PaymentError): string => {
  switch (error.code) {
    case ERROR_CODES.PAYMENT_METHOD_INVALID:
      return 'The selected payment method is not valid or has expired. Please verify your payment method or select a different one.';
    
    case ERROR_CODES.PAYMENT_METHOD_NOT_VERIFIED:
      return 'Your payment method needs to be verified before you can make cash offers. Please complete the verification process.';
    
    case ERROR_CODES.CASH_OFFER_BELOW_MINIMUM:
      return 'Your cash offer is below the minimum amount required by the swap owner. Please increase your offer to meet the requirement.';
    
    case ERROR_CODES.INSUFFICIENT_FUNDS:
      return 'There are insufficient funds available for this payment. Please check your account balance or use a different payment method.';
    
    case ERROR_CODES.ESCROW_CREATION_FAILED:
      return 'Unable to create the secure escrow account for this transaction. This is required for cash payments to protect both parties.';
    
    case ERROR_CODES.FRAUD_DETECTION_TRIGGERED:
      return 'This transaction has been flagged by our fraud detection system. Please contact support for assistance.';
    
    default:
      return error.message;
  }
};

// Graceful degradation for auction features on last-minute bookings
export const createLastMinuteBookingFallback = (eventDate: Date) => {
  const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
  const isLastMinute = eventDate.getTime() - Date.now() < oneWeekInMs;
  
  return {
    isLastMinute,
    allowAuctions: !isLastMinute,
    fallbackMessage: isLastMinute 
      ? 'Auction mode is not available for events less than one week away. Your swap will use first-match acceptance for faster processing.'
      : null,
    recommendedStrategy: isLastMinute ? 'first_match' : 'auction'
  };
};

// Payment processing retry mechanism with exponential backoff
export const createPaymentRetryHandler = (maxRetries: number = 3) => {
  return async <T>(
    operation: () => Promise<T>,
    errorHandler?: (error: Error, attempt: number) => boolean
  ): Promise<T> => {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry certain types of errors
        if (error instanceof PaymentError) {
          const nonRetryableCodes = [
            ERROR_CODES.PAYMENT_METHOD_INVALID,
            ERROR_CODES.PAYMENT_METHOD_NOT_VERIFIED,
            ERROR_CODES.CASH_OFFER_BELOW_MINIMUM,
            ERROR_CODES.FRAUD_DETECTION_TRIGGERED
          ];
          
          if (nonRetryableCodes.includes(error.code as any)) {
            throw error;
          }
        }
        
        // Custom error handler can decide whether to retry
        if (errorHandler && !errorHandler(error as Error, attempt)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff with jitter
        const baseDelay = 1000 * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * baseDelay;
        await new Promise(resolve => setTimeout(resolve, baseDelay + jitter));
      }
    }
    
    throw lastError!;
  };
};

// Request context helpers
export const addRequestContext = (req: ExtendedRequest): Partial<{ requestId: string; userId: string }> => {
  return {
    requestId: req.id,
    userId: req.user?.id
  };
};

// Error logging and monitoring
export const logError = (error: Error, context?: Record<string, any>) => {
  const logData: any = {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    ...context
  };

  if (error instanceof SwapPlatformError) {
    logData.code = error.code;
    logData.category = error.category;
    logData.retryable = error.retryable;
    logData.context = error.context;
  }

  console.error('Application Error:', logData);

  // In production, send to monitoring service
  // await sendToMonitoringService(logData);
};

// Async error wrapper for route handlers
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error formatter
export const formatValidationError = (error: any): ValidationError => {
  if (error.isJoi) {
    const details = error.details.map((detail: any) => ({
      field: detail.path.join('.'),
      message: detail.message,
      value: detail.context?.value
    }));

    return new ValidationError(
      'Validation failed',
      { validationErrors: details }
    );
  }

  return new ValidationError(error.message || 'Validation failed');
};

// Circuit breaker pattern for external services
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new SwapPlatformError(
          ERROR_CODES.INTERNAL_SERVER_ERROR,
          'Service temporarily unavailable',
          'integration',
          true
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }
}