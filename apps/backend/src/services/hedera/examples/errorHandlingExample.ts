/**
 * Example usage of enhanced Hedera error handling infrastructure
 * 
 * This file demonstrates how to use the HederaErrorReporter and related utilities
 * for comprehensive error handling in Hedera operations.
 */

import { HederaErrorReporter, HederaErrorType } from '../HederaErrorReporter';
import { withHederaRetry, HederaCircuitBreaker, logHederaOperation } from '../../../utils/hederaErrorHandling';
import { logger } from '../../../utils/logger';

/**
 * Example: Basic error capture and logging
 */
export async function exampleBasicErrorHandling() {
  try {
    // Simulate a Hedera operation that fails
    throw {
      status: { toString: () => 'INSUFFICIENT_ACCOUNT_BALANCE' },
      message: 'Account 0.0.12345 has insufficient balance for transaction',
      transactionId: { toString: () => '0.0.12345@1234567890.123456789' },
    };
  } catch (error) {
    // Capture detailed error information
    const errorDetails = HederaErrorReporter.captureError(
      error,
      'NFT_MINTING',
      HederaErrorReporter.createNFTContext(
        'booking-123',
        'user-456',
        '0.0.12345',
        '0.0.67890',
        1,
        '5 HBAR'
      )
    );

    // Log the error with enhanced formatting
    logger.error('NFT minting failed', {
      error: errorDetails,
      formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
    });

    // Check if the error is retryable
    if (HederaErrorReporter.isRetryableError(errorDetails)) {
      logger.info('Error is retryable, considering retry logic');
    } else {
      logger.info('Error is not retryable, user intervention required');
      logger.info(`Recommendation: ${errorDetails.recommendation}`);
    }

    // Throw enhanced error for upstream handling
    const enhancedError = new Error(
      `NFT minting failed: ${errorDetails.errorMessage} (${errorDetails.errorCode})`
    );
    (enhancedError as any).hederaErrorDetails = errorDetails;
    throw enhancedError;
  }
}

/**
 * Example: Using retry wrapper for resilient operations
 */
export async function exampleRetryWrapper() {
  const operation = async () => {
    // Simulate a network operation that might fail
    if (Math.random() < 0.7) {
      throw new Error('Network timeout occurred');
    }
    return 'Operation successful';
  };

  try {
    const result = await withHederaRetry(
      operation,
      'ACCOUNT_BALANCE_QUERY',
      3, // max retries
      1000, // base delay
      { accountId: '0.0.12345' } // context
    );

    logger.info('Operation completed successfully', { result });
    return result;
  } catch (error) {
    logger.error('Operation failed after retries', { error });
    throw error;
  }
}

/**
 * Example: Using circuit breaker for fault tolerance
 */
export async function exampleCircuitBreaker() {
  const circuitBreaker = new HederaCircuitBreaker(3, 30000, 'NFT_OPERATIONS');

  const nftOperation = async () => {
    // Simulate an operation that might fail
    if (Math.random() < 0.8) {
      throw {
        status: { toString: () => 'NETWORK_ERROR' },
        message: 'Failed to connect to Hedera network',
      };
    }
    return 'NFT minted successfully';
  };

  try {
    const result = await circuitBreaker.execute(nftOperation);
    logger.info('NFT operation completed', { result });
    return result;
  } catch (error) {
    const errorDetails = HederaErrorReporter.captureError(
      error,
      'NFT_MINTING_WITH_CIRCUIT_BREAKER',
      { circuitBreakerState: circuitBreaker.getState() }
    );

    logger.error('NFT operation failed', {
      error: errorDetails,
      circuitBreakerState: circuitBreaker.getState(),
      failureCount: circuitBreaker.getFailureCount(),
    });

    throw error;
  }
}

/**
 * Example: Comprehensive NFT minting with all error handling features
 */
export async function exampleComprehensiveNFTMinting(
  bookingId: string,
  userId: string,
  userAccountId: string
) {
  const circuitBreaker = new HederaCircuitBreaker(5, 60000, 'NFT_MINTING');

  // Log operation start
  logHederaOperation('NFT_MINTING', 'started', {
    bookingId,
    userId,
    userAccountId,
  });

  try {
    const result = await circuitBreaker.execute(async () => {
      return await withHederaRetry(
        async () => {
          // Simulate NFT minting operation
          const mockNFTService = {
            async mintBookingNFT(bookingData: any, accountId: string) {
              // Simulate various error scenarios
              const errorScenarios = [
                {
                  condition: Math.random() < 0.1,
                  error: {
                    status: { toString: () => 'INSUFFICIENT_ACCOUNT_BALANCE' },
                    message: 'Insufficient HBAR balance',
                  },
                },
                {
                  condition: Math.random() < 0.1,
                  error: {
                    status: { toString: () => 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT' },
                    message: 'Token not associated with account',
                  },
                },
                {
                  condition: Math.random() < 0.1,
                  error: {
                    message: 'Network connection timeout',
                  },
                },
              ];

              for (const scenario of errorScenarios) {
                if (scenario.condition) {
                  throw scenario.error;
                }
              }

              // Success case
              return {
                tokenId: '0.0.67890',
                serialNumber: 1,
                transactionId: '0.0.12345@1234567890.123456789',
                metadata: { bookingId, userId },
              };
            },
          };

          return await mockNFTService.mintBookingNFT(
            { id: bookingId, userId },
            userAccountId
          );
        },
        'NFT_MINTING_OPERATION',
        3,
        1000,
        HederaErrorReporter.createNFTContext(
          bookingId,
          userId,
          userAccountId
        )
      );
    });

    // Log successful completion
    logHederaOperation('NFT_MINTING', 'completed', {
      bookingId,
      userId,
      result,
    });

    return result;
  } catch (error) {
    // Capture and log error details
    const errorDetails = HederaErrorReporter.captureError(
      error,
      'NFT_MINTING_COMPREHENSIVE',
      HederaErrorReporter.createNFTContext(
        bookingId,
        userId,
        userAccountId
      )
    );

    // Log operation failure
    logHederaOperation('NFT_MINTING', 'failed', {
      bookingId,
      userId,
      userAccountId,
    }, errorDetails);

    // Provide user-friendly error information
    logger.error('NFT minting failed with comprehensive error handling', {
      bookingId,
      userId,
      errorType: errorDetails.errorType,
      retryable: errorDetails.retryable,
      recommendation: errorDetails.recommendation,
      formattedError: HederaErrorReporter.formatErrorForLogging(errorDetails),
    });

    // Re-throw with enhanced error details
    const enhancedError = new Error(
      `NFT minting failed: ${errorDetails.errorMessage}`
    );
    (enhancedError as any).hederaErrorDetails = errorDetails;
    throw enhancedError;
  }
}

/**
 * Example: Error classification and handling strategies
 */
export function exampleErrorClassificationStrategies() {
  const errorExamples = [
    {
      name: 'Insufficient Balance',
      error: {
        status: { toString: () => 'INSUFFICIENT_ACCOUNT_BALANCE' },
        message: 'Account balance too low',
      },
      strategy: 'User needs to add HBAR to account',
    },
    {
      name: 'Token Not Associated',
      error: {
        status: { toString: () => 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT' },
        message: 'Token not associated',
      },
      strategy: 'Automatically associate token or guide user',
    },
    {
      name: 'Network Error',
      error: {
        message: 'ECONNREFUSED: Connection refused',
      },
      strategy: 'Retry with exponential backoff',
    },
    {
      name: 'Invalid Account',
      error: {
        status: { toString: () => 'INVALID_ACCOUNT_ID' },
        message: 'Account ID format invalid',
      },
      strategy: 'Validate account ID format before operations',
    },
  ];

  errorExamples.forEach(({ name, error, strategy }) => {
    const errorDetails = HederaErrorReporter.captureError(
      error,
      'ERROR_CLASSIFICATION_EXAMPLE',
      {}
    );

    logger.info(`Error Classification Example: ${name}`, {
      errorType: errorDetails.errorType,
      retryable: errorDetails.retryable,
      recommendation: errorDetails.recommendation,
      suggestedStrategy: strategy,
    });
  });
}

/**
 * Example: Integration with existing error handling middleware
 */
export async function exampleMiddlewareIntegration(req: any, res: any, next: any) {
  try {
    // Simulate a controller action that performs Hedera operations
    const result = await exampleComprehensiveNFTMinting(
      req.body.bookingId,
      req.user.id,
      req.body.userAccountId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // The error will be automatically handled by the enhanced error middleware
    // which will detect Hedera errors and provide appropriate responses
    next(error);
  }
}