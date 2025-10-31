import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import {
  hederaErrorHandler,
  withHederaRetry,
  HederaCircuitBreaker,
  extractHederaErrorDetails,
  logHederaOperation,
  HederaEnhancedError,
} from '../hederaErrorHandling';
import { HederaErrorReporter, HederaErrorType } from '../../services/hedera/HederaErrorReporter';

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('hederaErrorHandling', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      url: '/api/nft/mint',
      method: 'POST',
      user: { id: 'user-123' },
    } as any;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('hederaErrorHandler', () => {
    it('should handle Hedera errors with proper HTTP status codes', () => {
      const hederaErrorDetails = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Insufficient balance',
        timestamp: new Date(),
        operation: 'NFT_MINTING',
        context: {},
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        retryable: false,
        recommendation: 'Add more HBAR to account',
      };

      const error: HederaEnhancedError = new Error('Test error');
      error.hederaErrorDetails = hederaErrorDetails;

      hederaErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402); // Payment Required
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Blockchain operation failed',
        message: expect.stringContaining('Insufficient account balance'),
        code: 'INSUFFICIENT_ACCOUNT_BALANCE',
        retryable: false,
        recommendation: 'Add more HBAR to account',
        transactionId: undefined,
        timestamp: hederaErrorDetails.timestamp.toISOString(),
      });
    });

    it('should pass non-Hedera errors to next handler', () => {
      const error = new Error('Regular error');

      hederaErrorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle different error types with appropriate status codes', () => {
      const testCases = [
        { errorType: HederaErrorType.INVALID_ACCOUNT, expectedStatus: 400 },
        { errorType: HederaErrorType.TOKEN_NOT_ASSOCIATED, expectedStatus: 403 },
        { errorType: HederaErrorType.TOKEN_WAS_DELETED, expectedStatus: 404 },
        { errorType: HederaErrorType.DUPLICATE_TRANSACTION, expectedStatus: 409 },
        { errorType: HederaErrorType.RATE_LIMITED, expectedStatus: 429 },
        { errorType: HederaErrorType.NETWORK_ERROR, expectedStatus: 500 },
      ];

      testCases.forEach(({ errorType, expectedStatus }) => {
        const hederaErrorDetails = {
          errorCode: errorType,
          errorMessage: 'Test error',
          timestamp: new Date(),
          operation: 'TEST',
          context: {},
          errorType,
          retryable: false,
        };

        const error: HederaEnhancedError = new Error('Test error');
        error.hederaErrorDetails = hederaErrorDetails;

        const mockResLocal = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
        };

        hederaErrorHandler(error, mockReq as Request, mockResLocal as any, mockNext);

        expect(mockResLocal.status).toHaveBeenCalledWith(expectedStatus);
      });
    });
  });

  describe('withHederaRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await withHederaRetry(operation, 'TEST_OPERATION');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ message: 'Network error' })
        .mockResolvedValue('success');

      const result = await withHederaRetry(operation, 'TEST_OPERATION', 3);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue({
        status: { toString: () => 'INSUFFICIENT_ACCOUNT_BALANCE' },
        message: 'Insufficient balance',
      });

      await expect(withHederaRetry(operation, 'TEST_OPERATION', 3))
        .rejects.toThrow('TEST_OPERATION failed');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const operation = vi.fn().mockRejectedValue({ message: 'Network error' });

      await expect(withHederaRetry(operation, 'TEST_OPERATION', 2))
        .rejects.toThrow('TEST_OPERATION failed after 2 attempts');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('HederaCircuitBreaker', () => {
    it('should allow operations when closed', async () => {
      const circuitBreaker = new HederaCircuitBreaker(3, 1000, 'TEST');
      const operation = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });

    it('should open after threshold failures', async () => {
      const circuitBreaker = new HederaCircuitBreaker(2, 1000, 'TEST');
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      // First failure
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('closed');

      // Second failure - should open circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('open');

      // Third attempt should be rejected immediately
      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow('Circuit breaker is open');
      
      expect(operation).toHaveBeenCalledTimes(2); // Not called on third attempt
    });

    it('should transition to half-open after timeout', async () => {
      const circuitBreaker = new HederaCircuitBreaker(1, 100, 'TEST'); // 100ms timeout
      const operation = vi.fn().mockRejectedValue(new Error('Test error'));

      // Trigger circuit open
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('open');

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next operation should transition to half-open
      operation.mockResolvedValueOnce('success');
      const result = await circuitBreaker.execute(operation);

      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('closed');
    });
  });

  describe('extractHederaErrorDetails', () => {
    it('should extract existing Hedera error details', () => {
      const hederaErrorDetails = {
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test message',
        timestamp: new Date(),
        operation: 'TEST',
        context: {},
        errorType: HederaErrorType.UNKNOWN,
        retryable: false,
      };

      const error: HederaEnhancedError = new Error('Test');
      error.hederaErrorDetails = hederaErrorDetails;

      const result = extractHederaErrorDetails(error);

      expect(result).toBe(hederaErrorDetails);
    });

    it('should create error details from error object', () => {
      const error = {
        status: { toString: () => 'INVALID_ACCOUNT_ID' },
        message: 'Invalid account',
      };

      const result = extractHederaErrorDetails(error);

      expect(result).toBeTruthy();
      expect(result?.errorType).toBe(HederaErrorType.INVALID_ACCOUNT);
    });

    it('should return null for non-Hedera errors', () => {
      const error = { someProperty: 'value' };

      const result = extractHederaErrorDetails(error);

      expect(result).toBeNull();
    });
  });

  describe('logHederaOperation', () => {
    it('should log operation start', () => {
      const { logger } = require('../logger');

      logHederaOperation('NFT_MINTING', 'started', { bookingId: 'test' });

      expect(logger.info).toHaveBeenCalledWith(
        'Hedera NFT_MINTING started',
        expect.objectContaining({
          category: 'hedera_operation',
          operation: 'NFT_MINTING',
          status: 'started',
          bookingId: 'test',
        })
      );
    });

    it('should log operation completion', () => {
      const { logger } = require('../logger');

      logHederaOperation('NFT_MINTING', 'completed', { transactionId: 'tx-123' });

      expect(logger.info).toHaveBeenCalledWith(
        'Hedera NFT_MINTING completed successfully',
        expect.objectContaining({
          category: 'hedera_operation',
          operation: 'NFT_MINTING',
          status: 'completed',
          transactionId: 'tx-123',
        })
      );
    });

    it('should log operation failure with error details', () => {
      const { logger } = require('../logger');
      
      const errorDetails = {
        errorCode: 'TEST_ERROR',
        errorMessage: 'Test error',
        timestamp: new Date(),
        operation: 'NFT_MINTING',
        context: {},
        errorType: HederaErrorType.UNKNOWN,
        retryable: false,
      };

      logHederaOperation('NFT_MINTING', 'failed', { bookingId: 'test' }, errorDetails);

      expect(logger.error).toHaveBeenCalledWith(
        'Hedera NFT_MINTING failed',
        expect.objectContaining({
          category: 'hedera_operation',
          operation: 'NFT_MINTING',
          status: 'failed',
          bookingId: 'test',
          errorDetails,
        })
      );
    });
  });
});