import { Request, Response, NextFunction } from 'express';
import { 
  errorHandler, 
  requestIdMiddleware, 
  notFoundHandler, 
  asyncHandler 
} from '../errorHandler';
import { 
  SwapPlatformError, 
  ValidationError, 
  BlockchainError, 
  ERROR_CODES 
} from '@booking-swap/shared';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/test',
      originalUrl: '/test',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-agent'),
      requestId: 'test-request-id',
      headers: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      headersSent: false,
    };

    mockNext = vi.fn();

    // Clear mock calls
    vi.clearAllMocks();
  });

  describe('requestIdMiddleware', () => {
    it('should add request ID to request and response headers', () => {
      requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.requestId).toBeDefined();
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', mockRequest.requestId);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should use existing request ID from headers', () => {
      const existingId = 'existing-request-id';
      mockRequest.headers = { 'x-request-id': existingId };

      requestIdMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.requestId).toBe(existingId);
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
    });
  });

  describe('errorHandler', () => {
    it('should handle SwapPlatformError correctly', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          retryable: error.retryable,
          timestamp: expect.any(String),
          requestId: 'test-request-id',
          details: { field: 'email' },
        },
      });
    });

    it('should handle blockchain errors with 503 status', () => {
      const error = new BlockchainError(
        ERROR_CODES.NETWORK_ERROR,
        'Network connection failed',
        true
      );

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: error.code,
          message: error.message,
          category: error.category,
          retryable: error.retryable,
          timestamp: expect.any(String),
          requestId: 'test-request-id',
          details: undefined,
        },
      });
    });

    it('should handle unknown errors as internal server errors', () => {
      const error = new Error('Unknown error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: error.message,
          category: 'server_error',
          retryable: false,
          timestamp: expect.any(String),
          requestId: 'test-request-id',
          details: undefined,
        },
      });
    });

    it('should handle PostgreSQL unique constraint violations', () => {
      const error = { code: '23505', message: 'duplicate key value' };

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Duplicate entry detected',
          category: 'validation',
          retryable: false,
          timestamp: expect.any(String),
          requestId: 'test-request-id',
          details: undefined,
        },
      });
    });

    it('should handle network connection errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.NETWORK_ERROR,
          message: 'Network connection failed',
          category: 'integration',
          retryable: true,
          timestamp: expect.any(String),
          requestId: 'test-request-id',
          details: undefined,
        },
      });
    });

    it('should not send response if headers already sent', () => {
      mockResponse.headersSent = true;
      const error = new Error('Test error');

      errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should log errors with appropriate level', async () => {
      const { logger } = await import('../../utils/logger');
      const serverError = new SwapPlatformError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        'Server error',
        'server_error'
      );

      errorHandler(serverError, mockRequest as Request, mockResponse as Response, mockNext);

      expect(logger.error).toHaveBeenCalledWith('Server error occurred', expect.any(Object));
    });
  });

  describe('notFoundHandler', () => {
    it('should create and pass 404 error to next middleware', () => {
      notFoundHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ERROR_CODES.NOT_FOUND,
          category: 'routing',
          message: 'Route GET /test not found',
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncOperation = vi.fn().mockResolvedValue('success');
      const wrappedHandler = asyncHandler(asyncOperation);

      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncOperation).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass async errors to next middleware', async () => {
      const error = new Error('Async error');
      const asyncOperation = vi.fn().mockRejectedValue(error);
      const wrappedHandler = asyncHandler(asyncOperation);

      // Call the wrapped handler and wait for it to complete
      await wrappedHandler(mockRequest as Request, mockResponse as Response, mockNext);

      expect(asyncOperation).toHaveBeenCalledWith(mockRequest, mockResponse, mockNext);
      
      // Wait a bit for the promise rejection to be handled
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});