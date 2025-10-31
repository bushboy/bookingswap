import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Status, TransactionReceipt, TransactionId } from '@hashgraph/sdk';
import { HederaErrorReporter, HederaErrorType, HederaErrorDetails } from '../HederaErrorReporter';

// Mock the logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('HederaErrorReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('captureError', () => {
    it('should capture error with Hedera status', () => {
      const mockError = {
        status: Status.InsufficientAccountBalance,
        message: 'Insufficient account balance',
        transactionId: { toString: () => 'test-tx-id' },
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'NFT_MINTING',
        { bookingId: 'test-booking' }
      );

      expect(result.errorType).toBe(HederaErrorType.INSUFFICIENT_BALANCE);
      expect(result.errorCode).toBe('INSUFFICIENT_ACCOUNT_BALANCE');
      expect(result.errorMessage).toBe('Insufficient account balance');
      expect(result.transactionId).toBe('test-tx-id');
      expect(result.operation).toBe('NFT_MINTING');
      expect(result.retryable).toBe(false);
      expect(result.recommendation).toContain('sufficient HBAR balance');
      expect(result.context.bookingId).toBe('test-booking');
    });

    it('should classify error by message when status is not available', () => {
      const mockError = {
        message: 'Token not associated to account',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'TOKEN_TRANSFER',
        {}
      );

      expect(result.errorType).toBe(HederaErrorType.TOKEN_NOT_ASSOCIATED);
      expect(result.recommendation).toContain('Associate the token');
    });

    it('should detect network errors', () => {
      const mockError = {
        message: 'ECONNREFUSED: Connection refused',
        code: 'ECONNREFUSED',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'ACCOUNT_BALANCE_QUERY',
        {}
      );

      expect(result.errorType).toBe(HederaErrorType.NETWORK_ERROR);
      expect(result.retryable).toBe(true);
      expect(result.recommendation).toContain('network connectivity');
    });

    it('should detect timeout errors', () => {
      const mockError = {
        message: 'Request timed out after 30 seconds',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'TRANSACTION_SUBMIT',
        {}
      );

      expect(result.errorType).toBe(HederaErrorType.TIMEOUT_ERROR);
      expect(result.retryable).toBe(true);
      expect(result.recommendation).toContain('timed out');
    });

    it('should handle string errors', () => {
      const result = HederaErrorReporter.captureError(
        'Invalid account ID format',
        'ACCOUNT_VALIDATION',
        {}
      );

      expect(result.errorMessage).toBe('Invalid account ID format');
      expect(result.errorType).toBe(HederaErrorType.INVALID_ACCOUNT);
    });

    it('should handle unknown errors', () => {
      const mockError = {
        message: 'Some unknown error occurred',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'UNKNOWN_OPERATION',
        {}
      );

      expect(result.errorType).toBe(HederaErrorType.UNKNOWN);
      expect(result.retryable).toBe(false);
    });
  });

  describe('formatErrorForLogging', () => {
    it('should format error details for logging', () => {
      const errorDetails = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Insufficient account balance',
        transactionId: 'test-tx-id',
        timestamp: new Date(),
        operation: 'NFT_MINTING',
        context: {
          bookingId: 'test-booking',
          accountId: '0.0.12345',
          accountBalance: '10 HBAR',
        },
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        retryable: false,
        recommendation: 'Ensure sufficient HBAR balance',
      };

      const formatted = HederaErrorReporter.formatErrorForLogging(errorDetails);

      expect(formatted).toContain('Hedera NFT_MINTING failed');
      expect(formatted).toContain('Code: INSUFFICIENT_ACCOUNT_BALANCE');
      expect(formatted).toContain('Transaction: test-tx-id');
      expect(formatted).toContain('Error Type: INSUFFICIENT_ACCOUNT_BALANCE');
      expect(formatted).toContain('Retryable: false');
      expect(formatted).toContain('Recommendation: Ensure sufficient HBAR balance');
      expect(formatted).toContain('Account: 0.0.12345');
      expect(formatted).toContain('Account Balance: 10 HBAR');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.NETWORK_ERROR)).toBe(true);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.TIMEOUT_ERROR)).toBe(true);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.RATE_LIMITED)).toBe(true);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.CONSENSUS_SERVICE_ERROR)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.INSUFFICIENT_BALANCE)).toBe(false);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.INVALID_ACCOUNT)).toBe(false);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.TOKEN_NOT_ASSOCIATED)).toBe(false);
      expect(HederaErrorReporter.isRetryableError(HederaErrorType.INVALID_SIGNATURE)).toBe(false);
    });

    it('should work with error details object', () => {
      const errorDetails = {
        errorType: HederaErrorType.NETWORK_ERROR,
        retryable: true,
      } as any;

      expect(HederaErrorReporter.isRetryableError(errorDetails)).toBe(true);
    });
  });

  describe('context creation helpers', () => {
    it('should create NFT context', () => {
      const context = HederaErrorReporter.createNFTContext(
        'booking-123',
        'user-456',
        '0.0.12345',
        '0.0.67890',
        1,
        '100 HBAR'
      );

      expect(context).toEqual({
        bookingId: 'booking-123',
        userId: 'user-456',
        userAccountId: '0.0.12345',
        tokenId: '0.0.67890',
        serialNumber: 1,
        accountBalance: '100 HBAR',
        operationType: 'nft_operation',
      });
    });

    it('should create token context', () => {
      const context = HederaErrorReporter.createTokenContext(
        '0.0.67890',
        '0.0.12345',
        '50',
        '100 HBAR'
      );

      expect(context).toEqual({
        tokenId: '0.0.67890',
        accountId: '0.0.12345',
        amount: '50',
        accountBalance: '100 HBAR',
        operationType: 'token_operation',
      });
    });

    it('should create account context', () => {
      const context = HederaErrorReporter.createAccountContext(
        '0.0.12345',
        '100 HBAR',
        'balance_query'
      );

      expect(context).toEqual({
        accountId: '0.0.12345',
        accountBalance: '100 HBAR',
        operation: 'balance_query',
        operationType: 'account_operation',
      });
    });
  });

  describe('error classification by status', () => {
    const testCases = [
      { status: 'INSUFFICIENT_ACCOUNT_BALANCE', expected: HederaErrorType.INSUFFICIENT_BALANCE },
      { status: 'INVALID_ACCOUNT_ID', expected: HederaErrorType.INVALID_ACCOUNT },
      { status: 'TOKEN_NOT_ASSOCIATED_TO_ACCOUNT', expected: HederaErrorType.TOKEN_NOT_ASSOCIATED },
      { status: 'ACCOUNT_FROZEN_FOR_TOKEN', expected: HederaErrorType.ACCOUNT_FROZEN },
      { status: 'INSUFFICIENT_TOKEN_BALANCE', expected: HederaErrorType.INSUFFICIENT_TOKEN_BALANCE },
      { status: 'INVALID_TOKEN_ID', expected: HederaErrorType.INVALID_TOKEN_ID },
      { status: 'TOKEN_WAS_DELETED', expected: HederaErrorType.TOKEN_WAS_DELETED },
      { status: 'INVALID_SIGNATURE', expected: HederaErrorType.INVALID_SIGNATURE },
      { status: 'TRANSACTION_EXPIRED', expected: HederaErrorType.TRANSACTION_EXPIRED },
      { status: 'DUPLICATE_TRANSACTION', expected: HederaErrorType.DUPLICATE_TRANSACTION },
      { status: 'BUSY', expected: HederaErrorType.RATE_LIMITED },
    ];

    testCases.forEach(({ status, expected }) => {
      it(`should classify ${status} correctly`, () => {
        const mockError = {
          status: { toString: () => status },
          message: `Error with status ${status}`,
        };

        const result = HederaErrorReporter.captureError(
          mockError,
          'TEST_OPERATION',
          {}
        );

        expect(result.errorType).toBe(expected);
      });
    });
  });

  describe('error classification by message', () => {
    const testCases = [
      { message: 'insufficient balance for operation', expected: HederaErrorType.INSUFFICIENT_BALANCE },
      { message: 'invalid account id provided', expected: HederaErrorType.INVALID_ACCOUNT },
      { message: 'token not associated with account', expected: HederaErrorType.TOKEN_NOT_ASSOCIATED },
      { message: 'account is frozen for token', expected: HederaErrorType.ACCOUNT_FROZEN },
      { message: 'invalid token id format', expected: HederaErrorType.INVALID_TOKEN_ID },
      { message: 'signature verification failed', expected: HederaErrorType.INVALID_SIGNATURE },
      { message: 'operation timed out', expected: HederaErrorType.TIMEOUT_ERROR },
      { message: 'network connection failed', expected: HederaErrorType.NETWORK_ERROR },
      { message: 'transaction has expired', expected: HederaErrorType.TRANSACTION_EXPIRED },
      { message: 'duplicate transaction detected', expected: HederaErrorType.DUPLICATE_TRANSACTION },
      { message: 'topic not found', expected: HederaErrorType.TOPIC_NOT_FOUND },
      { message: 'contract execution failed', expected: HederaErrorType.CONTRACT_EXECUTION_ERROR },
      { message: 'rate limit exceeded', expected: HederaErrorType.RATE_LIMITED },
    ];

    testCases.forEach(({ message, expected }) => {
      it(`should classify "${message}" correctly`, () => {
        const result = HederaErrorReporter.captureError(
          { message },
          'TEST_OPERATION',
          {}
        );

        expect(result.errorType).toBe(expected);
      });
    });
  });

  describe('error receipt handling', () => {
    it('should extract status from transaction receipt', () => {
      const mockReceipt = {
        status: Status.InsufficientAccountBalance,
        transactionId: { toString: () => 'receipt-tx-id' },
      };

      const mockError = {
        receipt: mockReceipt,
        message: 'Transaction failed',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'TRANSACTION_EXECUTION',
        {}
      );

      expect(result.errorType).toBe(HederaErrorType.INSUFFICIENT_BALANCE);
      expect(result.receipt).toBe(mockReceipt);
    });

    it('should handle errors with both status and receipt', () => {
      const mockReceipt = {
        status: Status.TokenNotAssociatedToAccount,
      };

      const mockError = {
        status: Status.InsufficientAccountBalance, // Different status
        receipt: mockReceipt,
        message: 'Conflicting status error',
      };

      const result = HederaErrorReporter.captureError(
        mockError,
        'COMPLEX_ERROR',
        {}
      );

      // Should use receipt status over direct status
      expect(result.errorType).toBe(HederaErrorType.TOKEN_NOT_ASSOCIATED);
      expect(result.receipt).toBe(mockReceipt);
    });
  });

  describe('comprehensive error context', () => {
    it('should preserve original error information in context', () => {
      const originalError = new Error('Original error message');
      originalError.name = 'CustomError';
      originalError.stack = 'Error stack trace';

      const result = HederaErrorReporter.captureError(
        originalError,
        'CONTEXT_TEST',
        { customField: 'customValue' }
      );

      expect(result.context.originalError).toBe(originalError);
      expect(result.context.errorName).toBe('CustomError');
      expect(result.context.errorStack).toBe('Error stack trace');
      expect(result.context.customField).toBe('customValue');
    });

    it('should handle null and undefined errors gracefully', () => {
      const nullResult = HederaErrorReporter.captureError(
        null,
        'NULL_ERROR',
        {}
      );

      const undefinedResult = HederaErrorReporter.captureError(
        undefined,
        'UNDEFINED_ERROR',
        {}
      );

      expect(nullResult.errorMessage).toBe('An unknown error occurred');
      expect(nullResult.errorType).toBe(HederaErrorType.UNKNOWN);
      expect(undefinedResult.errorMessage).toBe('An unknown error occurred');
      expect(undefinedResult.errorType).toBe(HederaErrorType.UNKNOWN);
    });
  });

  describe('error recommendations', () => {
    it('should provide specific recommendations for each error type', () => {
      const errorTypes = [
        HederaErrorType.INSUFFICIENT_BALANCE,
        HederaErrorType.INVALID_ACCOUNT,
        HederaErrorType.TOKEN_NOT_ASSOCIATED,
        HederaErrorType.ACCOUNT_FROZEN,
        HederaErrorType.INSUFFICIENT_TOKEN_BALANCE,
        HederaErrorType.INVALID_TOKEN_ID,
        HederaErrorType.TOKEN_WAS_DELETED,
        HederaErrorType.INVALID_SIGNATURE,
        HederaErrorType.NETWORK_ERROR,
        HederaErrorType.TIMEOUT_ERROR,
        HederaErrorType.TRANSACTION_EXPIRED,
        HederaErrorType.DUPLICATE_TRANSACTION,
        HederaErrorType.PERMISSION_DENIED,
        HederaErrorType.RATE_LIMITED,
        HederaErrorType.TOPIC_NOT_FOUND,
        HederaErrorType.CONTRACT_EXECUTION_ERROR,
      ];

      errorTypes.forEach(errorType => {
        const mockError = {
          status: { toString: () => errorType },
          message: `Error of type ${errorType}`,
        };

        const result = HederaErrorReporter.captureError(
          mockError,
          'RECOMMENDATION_TEST',
          {}
        );

        expect(result.recommendation).toBeDefined();
        expect(result.recommendation).not.toBe('');
        expect(typeof result.recommendation).toBe('string');
      });
    });
  });

  describe('structured logging', () => {
    it('should log structured error information', () => {
      const mockLogger = vi.mocked(require('../../../utils/logger').logger);
      
      const mockError = {
        status: Status.InsufficientAccountBalance,
        message: 'Test error for logging',
        transactionId: { toString: () => 'log-test-tx' },
      };

      HederaErrorReporter.captureError(
        mockError,
        'LOGGING_TEST',
        { testContext: 'logging' }
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Hedera operation failed',
        expect.objectContaining({
          category: 'hedera_error',
          operation: 'LOGGING_TEST',
          errorType: HederaErrorType.INSUFFICIENT_BALANCE,
          errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
          errorMessage: 'Test error for logging',
          transactionId: 'log-test-tx',
          retryable: false,
          timestamp: expect.any(String),
          context: expect.objectContaining({
            testContext: 'logging',
          }),
        })
      );
    });

    it('should exclude sensitive information from logs', () => {
      const mockLogger = vi.mocked(require('../../../utils/logger').logger);
      
      const mockError = new Error('Test error');
      mockError.stack = 'Sensitive stack trace';

      HederaErrorReporter.captureError(
        mockError,
        'SENSITIVE_TEST',
        {}
      );

      const logCall = mockLogger.error.mock.calls[0];
      const loggedContext = logCall[1].context;
      
      expect(loggedContext.originalError).toBeUndefined();
      expect(loggedContext.errorStack).toBeUndefined();
    });
  });
});