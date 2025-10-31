/**
 * Error types and interfaces for the Booking Swap Platform
 */

export type ErrorCategory = 'validation' | 'blockchain' | 'integration' | 'business' | 'authentication' | 'authorization' | 'rate_limiting' | 'server_error' | 'routing';

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    retryable?: boolean;
    timestamp?: string;
    details?: Record<string, any>;
    requestId?: string;
  };
}

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

/**
 * Base error class for all platform errors
 */
export class SwapPlatformError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly retryable: boolean;
  public readonly context?: ErrorContext;
  public readonly originalError?: Error;

  constructor(
    code: string,
    message: string,
    category: ErrorCategory,
    retryable: boolean = false,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'SwapPlatformError';
    this.code = code;
    this.category = category;
    this.retryable = retryable;
    this.context = context;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SwapPlatformError);
    }
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        retryable: this.retryable,
        timestamp: new Date().toISOString(),
        details: this.context?.metadata,
        requestId: this.context?.requestId,
      },
    };
  }
}

/**
 * Validation error for invalid input data
 */
export class ValidationError extends SwapPlatformError {
  constructor(message: string, details?: Record<string, any>, context?: ErrorContext) {
    super('VALIDATION_ERROR', message, 'validation', false, {
      ...context,
      metadata: { ...context?.metadata, ...details },
    });
    this.name = 'ValidationError';
  }
}

/**
 * Blockchain-related errors
 */
export class BlockchainError extends SwapPlatformError {
  constructor(
    code: string,
    message: string,
    retryable: boolean = true,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(code, message, 'blockchain', retryable, context, originalError);
    this.name = 'BlockchainError';
  }
}

/**
 * External service integration errors
 */
export class IntegrationError extends SwapPlatformError {
  constructor(
    service: string,
    message: string,
    retryable: boolean = true,
    context?: ErrorContext,
    originalError?: Error
  ) {
    super(`${service.toUpperCase()}_ERROR`, message, 'integration', retryable, context, originalError);
    this.name = 'IntegrationError';
  }
}

/**
 * Business logic errors
 */
export class BusinessLogicError extends SwapPlatformError {
  constructor(code: string, message: string, context?: ErrorContext) {
    super(code, message, 'business', false, context);
    this.name = 'BusinessLogicError';
  }
}

/**
 * Authentication errors
 */
export class AuthenticationError extends SwapPlatformError {
  constructor(code: string, message: string, context?: ErrorContext) {
    super(code, message, 'authentication', false, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * Authorization errors
 */
export class AuthorizationError extends SwapPlatformError {
  constructor(code: string, message: string, context?: ErrorContext) {
    super(code, message, 'authorization', false, context);
    this.name = 'AuthorizationError';
  }
}

/**
 * Auction-specific errors
 */
export class AuctionError extends SwapPlatformError {
  public readonly auctionId?: string;
  public readonly eventDate?: Date;

  constructor(
    code: string,
    message: string,
    auctionId?: string,
    eventDate?: Date,
    context?: ErrorContext
  ) {
    super(code, message, 'business', false, context);
    this.name = 'AuctionError';
    this.auctionId = auctionId;
    this.eventDate = eventDate;
  }
}

/**
 * Payment-specific errors
 */
export class PaymentError extends SwapPlatformError {
  public readonly transactionId?: string;
  public readonly paymentMethodId?: string;
  public readonly escrowId?: string;

  constructor(
    code: string,
    message: string,
    transactionId?: string,
    paymentMethodId?: string,
    escrowId?: string,
    context?: ErrorContext
  ) {
    super(code, message, 'business', false, context);
    this.name = 'PaymentError';
    this.transactionId = transactionId;
    this.paymentMethodId = paymentMethodId;
    this.escrowId = escrowId;
  }
}

/**
 * Timing-specific errors for auctions
 */
export class TimingError extends SwapPlatformError {
  public readonly eventDate?: Date;
  public readonly auctionEndDate?: Date;
  public readonly minimumRequiredDate?: Date;

  constructor(
    code: string,
    message: string,
    eventDate?: Date,
    auctionEndDate?: Date,
    minimumRequiredDate?: Date,
    context?: ErrorContext
  ) {
    super(code, message, 'business', false, context);
    this.name = 'TimingError';
    this.eventDate = eventDate;
    this.auctionEndDate = auctionEndDate;
    this.minimumRequiredDate = minimumRequiredDate;
  }
}

/**
 * Common error codes
 */
export const ERROR_CODES = {
  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Authentication errors
  MISSING_TOKEN: 'MISSING_TOKEN',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  
  // Authorization errors
  ACCESS_DENIED: 'ACCESS_DENIED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  INSUFFICIENT_VERIFICATION: 'INSUFFICIENT_VERIFICATION',
  INSUFFICIENT_REPUTATION: 'INSUFFICIENT_REPUTATION',
  
  // Business logic errors
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',
  BOOKING_ALREADY_SWAPPED: 'BOOKING_ALREADY_SWAPPED',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  SWAP_NOT_FOUND: 'SWAP_NOT_FOUND',
  SWAP_ALREADY_RESPONDED: 'SWAP_ALREADY_RESPONDED',
  INVALID_SWAP_STATE: 'INVALID_SWAP_STATE',
  DOUBLE_SPENDING_ATTEMPT: 'DOUBLE_SPENDING_ATTEMPT',
  
  // Auction errors
  AUCTION_NOT_FOUND: 'AUCTION_NOT_FOUND',
  AUCTION_EXPIRED: 'AUCTION_EXPIRED',
  AUCTION_ALREADY_ENDED: 'AUCTION_ALREADY_ENDED',
  INVALID_AUCTION_TIMING: 'INVALID_AUCTION_TIMING',
  LAST_MINUTE_RESTRICTION: 'LAST_MINUTE_RESTRICTION',
  AUCTION_TOO_CLOSE_TO_EVENT: 'AUCTION_TOO_CLOSE_TO_EVENT',
  EVENT_DATE_PASSED: 'EVENT_DATE_PASSED',
  INVALID_AUCTION_DURATION: 'INVALID_AUCTION_DURATION',
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_ALREADY_SELECTED: 'PROPOSAL_ALREADY_SELECTED',
  INVALID_PROPOSAL_TYPE: 'INVALID_PROPOSAL_TYPE',
  
  // Payment errors
  PAYMENT_METHOD_INVALID: 'PAYMENT_METHOD_INVALID',
  PAYMENT_METHOD_NOT_VERIFIED: 'PAYMENT_METHOD_NOT_VERIFIED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  ESCROW_CREATION_FAILED: 'ESCROW_CREATION_FAILED',
  ESCROW_RELEASE_FAILED: 'ESCROW_RELEASE_FAILED',
  PAYMENT_PROCESSING_FAILED: 'PAYMENT_PROCESSING_FAILED',
  REFUND_FAILED: 'REFUND_FAILED',
  CASH_OFFER_BELOW_MINIMUM: 'CASH_OFFER_BELOW_MINIMUM',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
  FRAUD_DETECTION_TRIGGERED: 'FRAUD_DETECTION_TRIGGERED',
  
  // Blockchain errors
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  CONTRACT_EXECUTION_FAILED: 'CONTRACT_EXECUTION_FAILED',
  CONSENSUS_TIMEOUT: 'CONSENSUS_TIMEOUT',
  
  // Integration errors
  BOOKING_PROVIDER_ERROR: 'BOOKING_PROVIDER_ERROR',
  VERIFICATION_SERVICE_ERROR: 'VERIFICATION_SERVICE_ERROR',
  NOTIFICATION_SERVICE_ERROR: 'NOTIFICATION_SERVICE_ERROR',
  
  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  CACHE_ERROR: 'CACHE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Routing
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];