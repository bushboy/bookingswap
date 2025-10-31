import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  RetryManager,
  ErrorMessageGenerator,
  ErrorHandler,
  withErrorHandling,
  withRetry,
  DEFAULT_RETRY_CONFIG,
} from '../errorHandling';
import {
  ValidationError,
  BlockchainError,
  IntegrationError,
  BusinessLogicError,
  AuthenticationError,
  AuthorizationError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock console methods
const mockConsole = {
  error: vi.fn(),
  info: vi.fn(),
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(mockConsole.error);
  vi.spyOn(console, 'info').mockImplementation(mockConsole.info);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      maxAttempts: 3,
      baseDelay: 10, // Short delay for tests
      maxDelay: 100,
      backoffFactor: 2,
    });
  });

  it('should succeed on first attempt', async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const validationError = new ValidationError('Invalid input');
    const operation = vi.fn().mockRejectedValue(validationError);

    await expect(retryManager.execute(operation)).rejects.toThrow(
      validationError
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('should respect max attempts', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(retryManager.execute(operation)).rejects.toThrow(
      'Network error'
    );
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should call onRetry callback', async () => {
    const onRetry = vi.fn();
    const manager = new RetryManager({
      ...DEFAULT_RETRY_CONFIG,
      maxAttempts: 2,
      baseDelay: 1,
      onRetry,
    });

    const operation = vi.fn().mockRejectedValue(new Error('Network error'));

    await expect(manager.execute(operation)).rejects.toThrow();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('should handle retryable blockchain errors', async () => {
    const blockchainError = new BlockchainError(
      ERROR_CODES.NETWORK_ERROR,
      'Network timeout',
      true
    );

    const operation = vi
      .fn()
      .mockRejectedValueOnce(blockchainError)
      .mockResolvedValue('success');

    const result = await retryManager.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });
});

describe('ErrorMessageGenerator', () => {
  describe('ValidationError handling', () => {
    it('should generate user-friendly validation error message', () => {
      const error = new ValidationError('Title is required');
      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Invalid Input');
      expect(message.message).toBe('Title is required');
      expect(message.severity).toBe('error');
      expect(message.dismissible).toBe(true);
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Fix Issues');
    });
  });

  describe('BlockchainError handling', () => {
    it('should generate blockchain error message with retry action', () => {
      const error = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network timeout',
        true
      );

      const message = ErrorMessageGenerator.generateUserMessage(error, {
        metadata: { retryAction: vi.fn() },
      });

      expect(message.title).toBe('Blockchain Error');
      expect(message.severity).toBe('error');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Retry Transaction');
    });

    it('should handle insufficient balance error', () => {
      const error = new BlockchainError(
        ERROR_CODES.INSUFFICIENT_BALANCE,
        'Insufficient balance',
        false
      );

      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.message).toContain('Insufficient balance');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Add Funds');
    });
  });

  describe('BusinessLogicError handling', () => {
    it('should handle booking not found error', () => {
      const error = new BusinessLogicError(
        ERROR_CODES.BOOKING_NOT_FOUND,
        'Booking not found'
      );

      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Booking Not Found');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Browse Bookings');
    });

    it('should handle swap already responded error', () => {
      const error = new BusinessLogicError(
        ERROR_CODES.SWAP_ALREADY_RESPONDED,
        'Swap already responded'
      );

      const message = ErrorMessageGenerator.generateUserMessage(error, {
        metadata: { swapId: 'swap123' },
      });

      expect(message.title).toBe('Swap Already Processed');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('View Swap');
    });
  });

  describe('AuthenticationError handling', () => {
    it('should generate authentication error message', () => {
      const error = new AuthenticationError(
        ERROR_CODES.INVALID_TOKEN,
        'Token expired'
      );

      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Authentication Required');
      expect(message.message).toBe('Please sign in to continue.');
      expect(message.dismissible).toBe(false);
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Sign In');
    });
  });

  describe('AuthorizationError handling', () => {
    it('should handle insufficient verification error', () => {
      const error = new AuthorizationError(
        ERROR_CODES.INSUFFICIENT_VERIFICATION,
        'Account not verified'
      );

      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Access Denied');
      expect(message.message).toContain('complete account verification');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Verify Account');
    });

    it('should handle insufficient reputation error', () => {
      const error = new AuthorizationError(
        ERROR_CODES.INSUFFICIENT_REPUTATION,
        'Low reputation score'
      );

      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.message).toContain('higher reputation score');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Learn More');
    });
  });

  describe('Generic error handling', () => {
    it('should handle network errors', () => {
      const error = new Error('fetch failed');
      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Something Went Wrong');
      expect(message.message).toContain('Network connection issue');
      expect(message.actions).toHaveLength(1);
      expect(message.actions![0].label).toBe('Try Again');
    });

    it('should handle timeout errors', () => {
      const error = new Error('Request timeout');
      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.message).toContain('timed out');
    });

    it('should handle unknown errors', () => {
      const error = new Error('Unknown error');
      const message = ErrorMessageGenerator.generateUserMessage(error);

      expect(message.title).toBe('Something Went Wrong');
      expect(message.message).toBe(
        'An unexpected error occurred. Please try again.'
      );
    });
  });
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler(
      {
        maxAttempts: 2,
        baseDelay: 1,
      },
      false
    ); // Disable error reporting for tests
  });

  describe('handleError', () => {
    it('should log errors when enabled', async () => {
      const error = new Error('Test error');

      await errorHandler.handleError(
        error,
        { userId: 'user123' },
        { logError: true }
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        'Error occurred:',
        expect.objectContaining({
          error: expect.objectContaining({
            name: 'Error',
            message: 'Test error',
          }),
          context: { userId: 'user123' },
        })
      );
    });

    it('should execute fallback action', async () => {
      const fallbackAction = vi.fn();
      const error = new Error('Test error');

      await errorHandler.handleError(error, undefined, { fallbackAction });

      expect(fallbackAction).toHaveBeenCalledTimes(1);
    });

    it('should handle fallback action errors gracefully', async () => {
      const fallbackAction = vi.fn().mockImplementation(() => {
        throw new Error('Fallback failed');
      });
      const error = new Error('Test error');

      // Should not throw
      const result = await errorHandler.handleError(error, undefined, {
        fallbackAction,
      });

      expect(result).toBeDefined();
      expect(fallbackAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeWithRetry', () => {
    it('should retry operations with custom config', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await errorHandler.executeWithRetry(
        operation,
        { operation: 'test' },
        { maxAttempts: 2, baseDelay: 1 }
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Utility functions', () => {
  describe('withErrorHandling', () => {
    it('should return data on success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withErrorHandling(operation);

      expect(result.data).toBe('success');
      expect(result.error).toBeUndefined();
    });

    it('should return error on failure', async () => {
      const error = new ValidationError('Invalid input');
      const operation = vi.fn().mockRejectedValue(error);

      const result = await withErrorHandling(operation);

      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error!.title).toBe('Invalid Input');
    });
  });

  describe('withRetry', () => {
    it('should retry operations', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw after max attempts', async () => {
      const operation = vi
        .fn()
        .mockRejectedValue(new Error('Persistent error'));

      await expect(
        withRetry(operation, undefined, { maxAttempts: 2, baseDelay: 1 })
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
