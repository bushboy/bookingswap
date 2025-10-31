import {
  Status,
  TransactionReceipt,
  TransactionId,
  AccountId,
  Hbar,
} from '@hashgraph/sdk';
import { logger } from '../../utils/logger';

/**
 * Comprehensive error details for Hedera operations
 */
export interface HederaErrorDetails {
  errorCode: string;
  errorMessage: string;
  transactionId?: string;
  status?: Status;
  receipt?: TransactionReceipt;
  accountBalance?: string;
  timestamp: Date;
  operation: string;
  context: Record<string, any>;
  errorType: HederaErrorType;
  retryable: boolean;
  recommendation?: string;
}

/**
 * Classification of Hedera error types for better handling
 */
export enum HederaErrorType {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_ACCOUNT_BALANCE',
  INVALID_ACCOUNT = 'INVALID_ACCOUNT_ID',
  TOKEN_NOT_ASSOCIATED = 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT',
  ACCOUNT_FROZEN = 'ACCOUNT_FROZEN_FOR_TOKEN',
  INSUFFICIENT_TOKEN_BALANCE = 'INSUFFICIENT_TOKEN_BALANCE',
  INVALID_TOKEN_ID = 'INVALID_TOKEN_ID',
  TOKEN_WAS_DELETED = 'TOKEN_WAS_DELETED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  TRANSACTION_EXPIRED = 'TRANSACTION_EXPIRED',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  CONSENSUS_SERVICE_ERROR = 'CONSENSUS_SERVICE_ERROR',
  CONTRACT_EXECUTION_ERROR = 'CONTRACT_EXECUTION_ERROR',
  TOPIC_NOT_FOUND = 'TOPIC_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RATE_LIMITED = 'BUSY',
  UNKNOWN = 'UNKNOWN_ERROR'
}

/**
 * Enhanced error reporter for Hedera operations with comprehensive error capture,
 * classification, and structured logging
 */
export class HederaErrorReporter {
  /**
   * Capture and classify error from Hedera operations
   */
  static captureError(
    error: any,
    operation: string,
    context: Record<string, any> = {}
  ): HederaErrorDetails {
    const timestamp = new Date();
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unknown error occurred';
    let status: Status | undefined;
    let receipt: TransactionReceipt | undefined;
    let transactionId: string | undefined;
    let errorType = HederaErrorType.UNKNOWN;
    let retryable = false;
    let recommendation: string | undefined;

    // Extract error information from different error types
    if (error?.status) {
      status = error.status;
      errorCode = status.toString();
      errorType = this.classifyErrorByStatus(status);
      retryable = this.isRetryableError(errorType);
      recommendation = this.getErrorRecommendation(errorType);
    }

    if (error?.receipt) {
      receipt = error.receipt;
      if (receipt.status) {
        status = receipt.status;
        errorCode = receipt.status.toString();
        errorType = this.classifyErrorByStatus(receipt.status);
      }
    }

    if (error?.transactionId) {
      transactionId = error.transactionId.toString();
    }

    // Handle different error message formats
    if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error?.toString) {
      errorMessage = error.toString();
    }

    // Classify error by message content if status is not available
    if (errorType === HederaErrorType.UNKNOWN && errorMessage) {
      errorType = this.classifyErrorByMessage(errorMessage);
      retryable = this.isRetryableError(errorType);
      recommendation = this.getErrorRecommendation(errorType);
    }

    // Handle network and timeout errors
    if (this.isNetworkError(error)) {
      errorType = HederaErrorType.NETWORK_ERROR;
      retryable = true;
      recommendation = 'Check network connectivity and retry the operation';
    }

    if (this.isTimeoutError(error)) {
      errorType = HederaErrorType.TIMEOUT_ERROR;
      retryable = true;
      recommendation = 'The operation timed out. Please retry after a short delay';
    }

    const errorDetails: HederaErrorDetails = {
      errorCode,
      errorMessage,
      transactionId,
      status,
      receipt,
      timestamp,
      operation,
      context: {
        ...context,
        originalError: error,
        errorName: error?.name,
        errorStack: error?.stack,
      },
      errorType,
      retryable,
      recommendation,
    };

    // Log the error with structured format
    this.logStructuredError(errorDetails);

    return errorDetails;
  }

  /**
   * Format error details for logging with enhanced readability
   */
  static formatErrorForLogging(errorDetails: HederaErrorDetails): string {
    const {
      operation,
      errorType,
      errorCode,
      errorMessage,
      transactionId,
      retryable,
      recommendation,
      context,
    } = errorDetails;

    let formattedMessage = `Hedera ${operation} failed: ${errorMessage}`;
    
    if (errorCode !== 'UNKNOWN_ERROR') {
      formattedMessage += ` (Code: ${errorCode})`;
    }

    if (transactionId) {
      formattedMessage += ` [Transaction: ${transactionId}]`;
    }

    formattedMessage += `\n  Error Type: ${errorType}`;
    formattedMessage += `\n  Retryable: ${retryable}`;

    if (recommendation) {
      formattedMessage += `\n  Recommendation: ${recommendation}`;
    }

    if (context.accountId) {
      formattedMessage += `\n  Account: ${context.accountId}`;
    }

    if (context.tokenId) {
      formattedMessage += `\n  Token: ${context.tokenId}`;
    }

    if (context.accountBalance) {
      formattedMessage += `\n  Account Balance: ${context.accountBalance}`;
    }

    return formattedMessage;
  }

  /**
   * Check if an error is retryable based on its type
   */
  static isRetryableError(errorDetails: HederaErrorDetails | HederaErrorType): boolean {
    const errorType = typeof errorDetails === 'object' ? errorDetails.errorType : errorDetails;

    const retryableErrors = [
      HederaErrorType.NETWORK_ERROR,
      HederaErrorType.TIMEOUT_ERROR,
      HederaErrorType.RATE_LIMITED,
      HederaErrorType.CONSENSUS_SERVICE_ERROR,
    ];

    return retryableErrors.includes(errorType);
  }

  /**
   * Classify error by Hedera status code
   */
  private static classifyErrorByStatus(status: Status): HederaErrorType {
    const statusString = status.toString();

    switch (statusString) {
      case 'INSUFFICIENT_ACCOUNT_BALANCE':
        return HederaErrorType.INSUFFICIENT_BALANCE;
      case 'INVALID_ACCOUNT_ID':
        return HederaErrorType.INVALID_ACCOUNT;
      case 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT':
        return HederaErrorType.TOKEN_NOT_ASSOCIATED;
      case 'ACCOUNT_FROZEN_FOR_TOKEN':
        return HederaErrorType.ACCOUNT_FROZEN;
      case 'INSUFFICIENT_TOKEN_BALANCE':
        return HederaErrorType.INSUFFICIENT_TOKEN_BALANCE;
      case 'INVALID_TOKEN_ID':
        return HederaErrorType.INVALID_TOKEN_ID;
      case 'TOKEN_WAS_DELETED':
        return HederaErrorType.TOKEN_WAS_DELETED;
      case 'INVALID_SIGNATURE':
        return HederaErrorType.INVALID_SIGNATURE;
      case 'TRANSACTION_EXPIRED':
        return HederaErrorType.TRANSACTION_EXPIRED;
      case 'DUPLICATE_TRANSACTION':
        return HederaErrorType.DUPLICATE_TRANSACTION;
      case 'INVALID_TRANSACTION':
        return HederaErrorType.INVALID_TRANSACTION;
      case 'TOPIC_EXPIRED':
      case 'INVALID_TOPIC_ID':
        return HederaErrorType.TOPIC_NOT_FOUND;
      case 'NOT_SUPPORTED':
      case 'AUTHORIZATION_FAILED':
        return HederaErrorType.PERMISSION_DENIED;
      case 'BUSY':
        return HederaErrorType.RATE_LIMITED;
      default:
        return HederaErrorType.UNKNOWN;
    }
  }

  /**
   * Classify error by message content when status is not available
   */
  private static classifyErrorByMessage(message: string): HederaErrorType {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('insufficient') && lowerMessage.includes('balance')) {
      return HederaErrorType.INSUFFICIENT_BALANCE;
    }

    if (lowerMessage.includes('invalid') && lowerMessage.includes('account')) {
      return HederaErrorType.INVALID_ACCOUNT;
    }

    if (lowerMessage.includes('token') && lowerMessage.includes('not associated')) {
      return HederaErrorType.TOKEN_NOT_ASSOCIATED;
    }

    if (lowerMessage.includes('frozen')) {
      return HederaErrorType.ACCOUNT_FROZEN;
    }

    if (lowerMessage.includes('invalid') && lowerMessage.includes('token')) {
      return HederaErrorType.INVALID_TOKEN_ID;
    }

    if (lowerMessage.includes('signature')) {
      return HederaErrorType.INVALID_SIGNATURE;
    }

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return HederaErrorType.TIMEOUT_ERROR;
    }

    if (lowerMessage.includes('network') || lowerMessage.includes('connection')) {
      return HederaErrorType.NETWORK_ERROR;
    }

    if (lowerMessage.includes('expired')) {
      return HederaErrorType.TRANSACTION_EXPIRED;
    }

    if (lowerMessage.includes('duplicate')) {
      return HederaErrorType.DUPLICATE_TRANSACTION;
    }

    if (lowerMessage.includes('topic')) {
      return HederaErrorType.TOPIC_NOT_FOUND;
    }

    if (lowerMessage.includes('contract')) {
      return HederaErrorType.CONTRACT_EXECUTION_ERROR;
    }

    if (lowerMessage.includes('busy') || lowerMessage.includes('rate limit')) {
      return HederaErrorType.RATE_LIMITED;
    }

    return HederaErrorType.UNKNOWN;
  }

  /**
   * Check if error is a network-related error
   */
  private static isNetworkError(error: any): boolean {
    if (!error) return false;

    const networkIndicators = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ECONNRESET',
      'ETIMEDOUT',
      'network',
      'connection',
      'fetch',
    ];

    const errorString = error.toString().toLowerCase();
    return networkIndicators.some(indicator => errorString.includes(indicator));
  }

  /**
   * Check if error is a timeout-related error
   */
  private static isTimeoutError(error: any): boolean {
    if (!error) return false;

    const timeoutIndicators = [
      'timeout',
      'timed out',
      'ETIMEDOUT',
      'request timeout',
    ];

    const errorString = error.toString().toLowerCase();
    return timeoutIndicators.some(indicator => errorString.includes(indicator));
  }

  /**
   * Get recommendation for specific error types
   */
  private static getErrorRecommendation(errorType: HederaErrorType): string {
    switch (errorType) {
      case HederaErrorType.INSUFFICIENT_BALANCE:
        return 'Ensure the account has sufficient HBAR balance for the operation. Check minimum balance requirements.';
      
      case HederaErrorType.INVALID_ACCOUNT:
        return 'Verify the account ID format and ensure the account exists on the network.';
      
      case HederaErrorType.TOKEN_NOT_ASSOCIATED:
        return 'Associate the token with the account before attempting token operations.';
      
      case HederaErrorType.ACCOUNT_FROZEN:
        return 'The account is frozen for this token. Contact the token administrator to unfreeze the account.';
      
      case HederaErrorType.INSUFFICIENT_TOKEN_BALANCE:
        return 'Ensure the account has sufficient token balance for the operation.';
      
      case HederaErrorType.INVALID_TOKEN_ID:
        return 'Verify the token ID format and ensure the token exists on the network.';
      
      case HederaErrorType.TOKEN_WAS_DELETED:
        return 'The token has been deleted and cannot be used for operations.';
      
      case HederaErrorType.INVALID_SIGNATURE:
        return 'Check that the correct private key is being used and the signature is properly formatted.';
      
      case HederaErrorType.NETWORK_ERROR:
        return 'Check network connectivity and retry the operation. Verify Hedera network status.';
      
      case HederaErrorType.TIMEOUT_ERROR:
        return 'The operation timed out. Retry after a short delay or check network conditions.';
      
      case HederaErrorType.TRANSACTION_EXPIRED:
        return 'The transaction has expired. Create a new transaction with a fresh transaction ID.';
      
      case HederaErrorType.DUPLICATE_TRANSACTION:
        return 'A transaction with this ID already exists. Use a unique transaction ID.';
      
      case HederaErrorType.PERMISSION_DENIED:
        return 'The account does not have permission for this operation. Check account keys and permissions.';
      
      case HederaErrorType.RATE_LIMITED:
        return 'The request was rate limited. Wait before retrying or reduce request frequency.';
      
      case HederaErrorType.TOPIC_NOT_FOUND:
        return 'The specified topic does not exist or has expired. Verify the topic ID.';
      
      case HederaErrorType.CONTRACT_EXECUTION_ERROR:
        return 'Smart contract execution failed. Check contract parameters and gas limits.';
      
      default:
        return 'Review the error details and check Hedera documentation for specific guidance.';
    }
  }

  /**
   * Log error with structured format for monitoring and analysis
   */
  private static logStructuredError(errorDetails: HederaErrorDetails): void {
    const {
      operation,
      errorType,
      errorCode,
      errorMessage,
      transactionId,
      retryable,
      context,
      timestamp,
    } = errorDetails;

    logger.error('Hedera operation failed', {
      category: 'hedera_error',
      operation,
      errorType,
      errorCode,
      errorMessage,
      transactionId,
      retryable,
      timestamp: timestamp.toISOString(),
      context: {
        ...context,
        // Remove potentially sensitive information from logs
        originalError: undefined,
        errorStack: undefined,
      },
    });
  }

  /**
   * Create error context for NFT operations
   */
  static createNFTContext(
    bookingId?: string,
    userId?: string,
    userAccountId?: string,
    tokenId?: string,
    serialNumber?: number,
    accountBalance?: string
  ): Record<string, any> {
    return {
      bookingId,
      userId,
      userAccountId,
      tokenId,
      serialNumber,
      accountBalance,
      operationType: 'nft_operation',
    };
  }

  /**
   * Create error context for token operations
   */
  static createTokenContext(
    tokenId?: string,
    accountId?: string,
    amount?: string,
    accountBalance?: string
  ): Record<string, any> {
    return {
      tokenId,
      accountId,
      amount,
      accountBalance,
      operationType: 'token_operation',
    };
  }

  /**
   * Create error context for account operations
   */
  static createAccountContext(
    accountId?: string,
    accountBalance?: string,
    operation?: string
  ): Record<string, any> {
    return {
      accountId,
      accountBalance,
      operation,
      operationType: 'account_operation',
    };
  }
}