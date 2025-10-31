import { Request, Response, NextFunction } from 'express';
import { HederaErrorReporter, HederaErrorDetails, HederaErrorType } from '../services/hedera/HederaErrorReporter';
import { logger } from './logger';

/**
 * Enhanced error interface that includes Hedera error details
 */
export interface HederaEnhancedError extends Error {
  hederaErrorDetails?: HederaErrorDetails;
}

/**
 * Middleware to handle Hedera-specific errors with enhanced context
 */
export const hederaErrorHandler = (
  error: HederaEnhancedError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if this is a Hedera-related error
  if (error.hederaErrorDetails) {
    const { hederaErrorDetails } = error;
    
    logger.error('Hedera operation failed in API request', {
      category: 'hedera_api_error',
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
      errorDetails: hederaErrorDetails,
      formattedError: HederaErrorReporter.formatErrorForLogging(hederaErrorDetails),
    });

    // Return appropriate HTTP status and user-friendly message
    const statusCode = getHttpStatusForHederaError(hederaErrorDetails.errorType);
    const userMessage = getUserFriendlyMessage(hederaErrorDetails);

    return res.status(statusCode).json({
      error: 'Blockchain operation failed',
      message: userMessage,
      code: hederaErrorDetails.errorCode,
      retryable: hederaErrorDetails.retryable,
      recommendation: hederaErrorDetails.recommendation,
      transactionId: hederaErrorDetails.transactionId,
      timestamp: hederaErrorDetails.timestamp.toISOString(),
    });
  }

  // Pass to next error handler if not a Hedera error
  next(error);
};

/**
 * Get appropriate HTTP status code for Hedera error types
 */
function getHttpStatusForHederaError(errorType: HederaErrorType): number {
  switch (errorType) {
    case HederaErrorType.INSUFFICIENT_BALANCE:
    case HederaErrorType.INSUFFICIENT_TOKEN_BALANCE:
      return 402; // Payment Required
    
    case HederaErrorType.INVALID_ACCOUNT:
    case HederaErrorType.INVALID_TOKEN_ID:
    case HederaErrorType.INVALID_SIGNATURE:
    case HederaErrorType.INVALID_TRANSACTION:
      return 400; // Bad Request
    
    case HederaErrorType.TOKEN_NOT_ASSOCIATED:
    case HederaErrorType.ACCOUNT_FROZEN:
    case HederaErrorType.PERMISSION_DENIED:
      return 403; // Forbidden
    
    case HederaErrorType.TOKEN_WAS_DELETED:
    case HederaErrorType.TOPIC_NOT_FOUND:
      return 404; // Not Found
    
    case HederaErrorType.DUPLICATE_TRANSACTION:
      return 409; // Conflict
    
    case HederaErrorType.TRANSACTION_EXPIRED:
      return 410; // Gone
    
    case HederaErrorType.RATE_LIMITED:
      return 429; // Too Many Requests
    
    case HederaErrorType.NETWORK_ERROR:
    case HederaErrorType.TIMEOUT_ERROR:
    case HederaErrorType.CONSENSUS_SERVICE_ERROR:
    case HederaErrorType.CONTRACT_EXECUTION_ERROR:
    case HederaErrorType.UNKNOWN:
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Get user-friendly error messages for different Hedera error types
 */
function getUserFriendlyMessage(errorDetails: HederaErrorDetails): string {
  const { errorType, operation } = errorDetails;

  switch (errorType) {
    case HederaErrorType.INSUFFICIENT_BALANCE:
      return 'Insufficient account balance to complete the blockchain operation. Please ensure your account has enough HBAR for transaction fees.';
    
    case HederaErrorType.INVALID_ACCOUNT:
      return 'The provided account ID is invalid or does not exist on the Hedera network.';
    
    case HederaErrorType.TOKEN_NOT_ASSOCIATED:
      return 'Your account is not associated with the required token. Please associate the token with your account first.';
    
    case HederaErrorType.ACCOUNT_FROZEN:
      return 'Your account is frozen for this token and cannot perform the requested operation.';
    
    case HederaErrorType.INSUFFICIENT_TOKEN_BALANCE:
      return 'Insufficient token balance to complete the operation.';
    
    case HederaErrorType.INVALID_TOKEN_ID:
      return 'The specified token does not exist or is invalid.';
    
    case HederaErrorType.TOKEN_WAS_DELETED:
      return 'The token has been deleted and is no longer available for operations.';
    
    case HederaErrorType.INVALID_SIGNATURE:
      return 'Invalid signature detected. Please check your account keys and permissions.';
    
    case HederaErrorType.NETWORK_ERROR:
      return 'Network connectivity issue with the Hedera network. Please try again later.';
    
    case HederaErrorType.TIMEOUT_ERROR:
      return 'The blockchain operation timed out. Please try again.';
    
    case HederaErrorType.TRANSACTION_EXPIRED:
      return 'The transaction has expired. Please create a new transaction.';
    
    case HederaErrorType.DUPLICATE_TRANSACTION:
      return 'A transaction with this ID already exists. Please use a unique transaction ID.';
    
    case HederaErrorType.PERMISSION_DENIED:
      return 'You do not have permission to perform this blockchain operation.';
    
    case HederaErrorType.RATE_LIMITED:
      return 'Too many requests. Please wait before trying again.';
    
    case HederaErrorType.TOPIC_NOT_FOUND:
      return 'The specified consensus topic does not exist or has expired.';
    
    case HederaErrorType.CONTRACT_EXECUTION_ERROR:
      return 'Smart contract execution failed. Please check the contract parameters.';
    
    default:
      if (operation.includes('NFT')) {
        return 'NFT operation failed due to a blockchain error. Please try again or contact support.';
      }
      return 'A blockchain operation failed. Please try again or contact support if the issue persists.';
  }
}

/**
 * Retry wrapper for Hedera operations with exponential backoff
 */
export async function withHederaRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context: Record<string, any> = {}
): Promise<T> {
  let lastError: HederaErrorDetails | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorDetails = HederaErrorReporter.captureError(
        error,
        operationName,
        { ...context, attempt, maxRetries }
      );

      lastError = errorDetails;

      // Don't retry non-retryable errors
      if (!HederaErrorReporter.isRetryableError(errorDetails)) {
        logger.info('Non-retryable Hedera error, not retrying', {
          operation: operationName,
          errorType: errorDetails.errorType,
          attempt,
        });
        break;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        logger.error('Max retries reached for Hedera operation', {
          operation: operationName,
          attempts: maxRetries,
          finalError: errorDetails,
        });
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * delay;
      const totalDelay = delay + jitter;

      logger.warn('Retrying Hedera operation after error', {
        operation: operationName,
        attempt,
        maxRetries,
        errorType: errorDetails.errorType,
        retryDelay: totalDelay,
      });

      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  // Throw the last error if all retries failed
  if (lastError) {
    const enhancedError = new Error(
      `${operationName} failed after ${maxRetries} attempts: ${lastError.errorMessage}`
    ) as HederaEnhancedError;
    enhancedError.hederaErrorDetails = lastError;
    throw enhancedError;
  }

  // This should never happen, but just in case
  throw new Error(`${operationName} failed with unknown error`);
}

/**
 * Circuit breaker for Hedera operations to prevent cascading failures
 */
export class HederaCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private timeout: number = 60000, // 1 minute
    private operationName: string = 'hedera_operation'
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
        logger.info('Circuit breaker transitioning to half-open', {
          operation: this.operationName,
        });
      } else {
        const error = new Error(
          'Circuit breaker is open - Hedera service temporarily unavailable'
        ) as HederaEnhancedError;
        error.hederaErrorDetails = HederaErrorReporter.captureError(
          error,
          this.operationName,
          { circuitBreakerState: 'open' }
        );
        throw error;
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
    if (this.state === 'half-open') {
      this.state = 'closed';
      logger.info('Circuit breaker closed after successful operation', {
        operation: this.operationName,
      });
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.error('Circuit breaker opened due to repeated failures', {
        operation: this.operationName,
        failures: this.failures,
        threshold: this.threshold,
      });
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Helper to extract Hedera error details from any error
 */
export function extractHederaErrorDetails(error: any): HederaErrorDetails | null {
  if (error?.hederaErrorDetails) {
    return error.hederaErrorDetails;
  }

  // Try to create error details from the error object
  if (error?.status || error?.message) {
    return HederaErrorReporter.captureError(error, 'UNKNOWN_OPERATION', {});
  }

  return null;
}

/**
 * Structured logging for Hedera operations
 */
export function logHederaOperation(
  operation: string,
  status: 'started' | 'completed' | 'failed',
  context: Record<string, any> = {},
  errorDetails?: HederaErrorDetails
) {
  const logData = {
    category: 'hedera_operation',
    operation,
    status,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (errorDetails) {
    logData.errorDetails = errorDetails;
    logData.formattedError = HederaErrorReporter.formatErrorForLogging(errorDetails);
  }

  switch (status) {
    case 'started':
      logger.info(`Hedera ${operation} started`, logData);
      break;
    case 'completed':
      logger.info(`Hedera ${operation} completed successfully`, logData);
      break;
    case 'failed':
      logger.error(`Hedera ${operation} failed`, logData);
      break;
  }
}