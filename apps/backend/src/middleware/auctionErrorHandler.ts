/**
 * Auction Error Handler Middleware
 * Provides comprehensive error handling for auction-related API endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
    AuctionCreationError,
    ValidationError,
    DateValidationError,
    AuctionSettingsValidationError,
    AuctionErrorUtils
} from '../utils/AuctionErrors';
import { AuctionErrorResponseBuilder } from '../utils/AuctionErrorResponseBuilder';
import { AuctionErrorMonitoringService } from '../services/monitoring/AuctionErrorMonitoringService';

export interface AuctionErrorHandlerOptions {
    includeStackTrace?: boolean;
    logErrors?: boolean;
    enableMonitoring?: boolean;
}

/**
 * Express middleware for handling auction-related errors with comprehensive logging and monitoring
 */
export function auctionErrorHandler(options: AuctionErrorHandlerOptions = {}) {
    const {
        includeStackTrace = process.env.NODE_ENV !== 'production',
        logErrors = true,
        enableMonitoring = true
    } = options;

    const errorMonitoringService = enableMonitoring ? AuctionErrorMonitoringService.getInstance() : null;

    return (error: Error, req: Request, res: Response, next: NextFunction) => {
        // Skip if response already sent
        if (res.headersSent) {
            return next(error);
        }

        // Extract request context
        const requestId = req.headers['x-request-id'] as string || `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const userId = (req as any).user?.id || 'anonymous';
        const operation = `${req.method} ${req.path}`;

        // Record error in monitoring service
        if (errorMonitoringService && AuctionErrorUtils.isAuctionError(error)) {
            errorMonitoringService.recordAuctionError(error, {
                operation,
                metadata: {
                    requestId,
                    userId,
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    body: req.body,
                    userAgent: req.headers['user-agent'],
                    ip: req.ip
                }
            });
        }

        // Enhanced error logging
        if (logErrors) {
            logger.error('Auction API error occurred', {
                category: 'auction_api_error',
                requestId,
                userId,
                method: req.method,
                path: req.path,
                query: req.query,
                error: {
                    name: error.name,
                    message: error.message,
                    stack: includeStackTrace ? error.stack : undefined,
                    type: error.constructor.name
                },
                isAuctionError: AuctionErrorUtils.isAuctionError(error),
                timestamp: new Date().toISOString()
            });
        }

        // Create structured error response
        const errorResponseBuilder = new AuctionErrorResponseBuilder(requestId);

        try {
            // Handle auction-specific errors
            if (AuctionErrorUtils.isAuctionError(error)) {
                const structuredResponse = errorResponseBuilder.buildErrorResponse(error, {
                    operation,
                    metadata: {
                        requestId,
                        userId,
                        method: req.method,
                        path: req.path
                    }
                });

                const statusCode = getStatusCodeForAuctionError(error);
                return res.status(statusCode).json(structuredResponse);
            }

            // Handle date validation errors specifically
            if (error instanceof DateValidationError) {
                const dateErrorResponse = AuctionErrorResponseBuilder.createDateValidationErrorResponse(error);
                return res.status(400).json(dateErrorResponse);
            }

            // Handle auction creation errors
            if (error instanceof AuctionCreationError) {
                if (error.phase === 'blockchain_recording') {
                    const blockchainErrorResponse = AuctionErrorResponseBuilder.createBlockchainErrorResponse(error, operation);
                    return res.status(503).json(blockchainErrorResponse);
                }

                const structuredResponse = errorResponseBuilder.buildErrorResponse(error, {
                    operation,
                    metadata: { requestId, userId }
                });
                return res.status(400).json(structuredResponse);
            }

            // Handle validation errors
            if (error instanceof ValidationError || error instanceof AuctionSettingsValidationError) {
                const structuredResponse = errorResponseBuilder.buildErrorResponse(error, {
                    operation,
                    metadata: { requestId, userId }
                });
                return res.status(400).json(structuredResponse);
            }

            // Handle generic errors
            const structuredResponse = errorResponseBuilder.buildErrorResponse(error, {
                operation,
                metadata: { requestId, userId }
            });
            return res.status(500).json(structuredResponse);

        } catch (responseError) {
            // Fallback error response if structured response creation fails
            logger.error('Failed to create structured error response', {
                category: 'error_handler_failure',
                requestId,
                originalError: error.message,
                responseError: responseError instanceof Error ? responseError.message : responseError
            });

            return res.status(500).json({
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred while processing your request',
                    timestamp: new Date().toISOString(),
                    requestId
                },
                context: {
                    retryable: true,
                    suggestions: [
                        'Try the request again after a brief delay',
                        'Contact support if the issue persists'
                    ]
                }
            });
        }
    };
}

/**
 * Get appropriate HTTP status code for auction errors
 */
function getStatusCodeForAuctionError(error: Error): number {
    if (error instanceof DateValidationError || error instanceof ValidationError || error instanceof AuctionSettingsValidationError) {
        return 400; // Bad Request
    }

    if (error instanceof AuctionCreationError) {
        switch (error.phase) {
            case 'validation':
                return 400; // Bad Request
            case 'blockchain_recording':
                return 503; // Service Unavailable
            case 'rollback':
                return 500; // Internal Server Error
            default:
                return 400; // Bad Request
        }
    }

    return 500; // Internal Server Error
}

/**
 * Middleware to add request ID to all auction-related requests
 */
export function addRequestId(req: Request, res: Response, next: NextFunction): void {
    if (!req.headers['x-request-id']) {
        req.headers['x-request-id'] = `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }
    next();
}

/**
 * Middleware to log auction API requests with performance metrics
 */
export function logAuctionApiRequests(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] as string;
    const userId = (req as any).user?.id || 'anonymous';

    // Log request start
    logger.info('Auction API request started', {
        category: 'auction_api_request',
        requestId,
        userId,
        method: req.method,
        path: req.path,
        query: req.query,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: new Date().toISOString()
    });

    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function (chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;

        logger.info('Auction API request completed', {
            category: 'auction_api_response',
            requestId,
            userId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date().toISOString()
        });

        // Call original end method and return its result
        return originalEnd.call(this, chunk, encoding);
    };

    next();
}

/**
 * Middleware to validate auction-related request parameters
 */
export function validateAuctionRequest(req: Request, res: Response, next: NextFunction): void | Response {
    const requestId = req.headers['x-request-id'] as string;

    try {
        // Validate common auction parameters
        if (req.body.auctionSettings) {
            const { endDate } = req.body.auctionSettings;

            // Pre-validate date format to provide early feedback
            if (endDate && typeof endDate === 'string') {
                const parsedDate = new Date(endDate);
                if (isNaN(parsedDate.getTime())) {
                    const dateError = new DateValidationError(
                        'Invalid date format for auction endDate',
                        'endDate',
                        endDate,
                        'ISO 8601 string or Date object'
                    );

                    const errorResponse = AuctionErrorResponseBuilder.createDateValidationErrorResponse(dateError);
                    return res.status(400).json(errorResponse);
                }

                // Check if date is in the future
                if (parsedDate <= new Date()) {
                    const dateError = new DateValidationError(
                        'Auction end date must be in the future',
                        'endDate',
                        endDate,
                        'Future date'
                    );

                    const errorResponse = AuctionErrorResponseBuilder.createDateValidationErrorResponse(dateError);
                    return res.status(400).json(errorResponse);
                }
            }
        }

        next();
    } catch (error) {
        logger.error('Request validation failed', {
            category: 'request_validation',
            requestId,
            error: error instanceof Error ? error.message : error,
            body: req.body
        });

        const errorResponseBuilder = new AuctionErrorResponseBuilder(requestId);
        const structuredResponse = errorResponseBuilder.buildErrorResponse(
            error instanceof Error ? error : new Error('Request validation failed'),
            {
                operation: 'request_validation',
                metadata: { requestId }
            }
        );

        return res.status(400).json(structuredResponse);
    }
}

/**
 * Get error monitoring metrics for health checks
 */
export function getErrorMonitoringHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    metrics: any;
    recommendations: string[];
} {
    const errorMonitoringService = AuctionErrorMonitoringService.getInstance();
    const summary = errorMonitoringService.getErrorSummary();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (summary.criticalIssues.length > 0) {
        status = 'critical';
    } else if (summary.hasRecentErrors) {
        status = 'warning';
    }

    return {
        status,
        metrics: {
            errorCount: summary.errorCount,
            hasRecentErrors: summary.hasRecentErrors,
            criticalIssues: summary.criticalIssues
        },
        recommendations: summary.recommendations
    };
}