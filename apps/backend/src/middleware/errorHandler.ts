import { Request, Response, NextFunction } from 'express';
import { SwapPlatformError, ErrorResponse, ERROR_CODES } from '@booking-swap/shared';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { hederaErrorHandler, HederaEnhancedError } from '../utils/hederaErrorHandling';

/**
 * Request ID middleware to track requests across the system
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

/**
 * Comprehensive error handling middleware
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = req.requestId || uuidv4();
  
  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(error);
  }

  // Check if this is a Hedera-specific error first
  if ((error as HederaEnhancedError).hederaErrorDetails) {
    return hederaErrorHandler(error as HederaEnhancedError, req, res, next);
  }

  let platformError: SwapPlatformError;

  // Convert known errors to SwapPlatformError
  if (error instanceof SwapPlatformError) {
    platformError = error;
  } else if (error.name === 'ValidationError') {
    // Handle Joi/Zod validation errors
    platformError = new SwapPlatformError(
      ERROR_CODES.VALIDATION_ERROR,
      error.message,
      'validation',
      false,
      { requestId, operation: `${req.method} ${req.path}` },
      error
    );
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    // Handle network/connection errors
    platformError = new SwapPlatformError(
      ERROR_CODES.NETWORK_ERROR,
      'Network connection failed',
      'integration',
      true,
      { requestId, operation: `${req.method} ${req.path}` },
      error
    );
  } else if (error.code === '23505') {
    // Handle PostgreSQL unique constraint violation
    platformError = new SwapPlatformError(
      ERROR_CODES.VALIDATION_ERROR,
      'Duplicate entry detected',
      'validation',
      false,
      { requestId, operation: `${req.method} ${req.path}` },
      error
    );
  } else if (error.code === '23503') {
    // Handle PostgreSQL foreign key constraint violation
    platformError = new SwapPlatformError(
      ERROR_CODES.VALIDATION_ERROR,
      'Referenced resource not found',
      'validation',
      false,
      { requestId, operation: `${req.method} ${req.path}` },
      error
    );
  } else {
    // Handle unknown errors
    platformError = new SwapPlatformError(
      ERROR_CODES.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'production' 
        ? 'An internal server error occurred' 
        : error.message,
      'server_error',
      false,
      { requestId, operation: `${req.method} ${req.path}` },
      error
    );
  }

  // Log error with context
  const logContext = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: platformError.code,
      category: platformError.category,
    },
    request: {
      id: requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
    },
    context: platformError.context,
  };

  // Log based on error severity
  if (platformError.category === 'server_error') {
    logger.error('Server error occurred', logContext);
  } else if (platformError.category === 'blockchain') {
    logger.warn('Blockchain error occurred', logContext);
  } else if (platformError.category === 'integration') {
    logger.warn('Integration error occurred', logContext);
  } else {
    logger.info('Client error occurred', logContext);
  }

  // Determine HTTP status code
  const statusCode = getHttpStatusCode(platformError);

  // Send error response
  const errorResponse: ErrorResponse = {
    error: {
      code: platformError.code,
      message: platformError.message,
      category: platformError.category,
      retryable: platformError.retryable,
      timestamp: new Date().toISOString(),
      requestId,
      details: platformError.context?.metadata,
    },
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Map error categories to HTTP status codes
 */
function getHttpStatusCode(error: SwapPlatformError): number {
  switch (error.category) {
    case 'validation':
      return 400;
    case 'authentication':
      return 401;
    case 'authorization':
      return 403;
    case 'business':
      if (error.code === ERROR_CODES.BOOKING_NOT_FOUND || error.code === ERROR_CODES.SWAP_NOT_FOUND) {
        return 404;
      }
      return 409; // Conflict for business logic errors
    case 'rate_limiting':
      return 429;
    case 'blockchain':
    case 'integration':
      return 503; // Service unavailable
    case 'server_error':
      return 500;
    case 'routing':
      return 404;
    default:
      return 500;
  }
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<any>
) {
  return (req: T, res: U, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new SwapPlatformError(
    ERROR_CODES.NOT_FOUND,
    `Route ${req.method} ${req.originalUrl} not found`,
    'routing',
    false,
    { requestId: req.requestId, operation: `${req.method} ${req.path}` }
  );
  next(error);
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}