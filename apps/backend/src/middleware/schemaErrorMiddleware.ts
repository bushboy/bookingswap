import { Request, Response, NextFunction } from 'express';
import { schemaErrorMiddleware } from '../utils/schemaErrorHandling';
import { logger } from '../utils/logger';

/**
 * Express middleware for handling database schema errors
 * Requirements: 3.1, 3.2
 */
export const handleSchemaErrors = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Add request ID if not present
    if (!req.id) {
        req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Use the schema error middleware
    schemaErrorMiddleware(error, req, res, next);
};

/**
 * Middleware to add schema error context to requests
 * Requirements: 3.2
 */
export const addSchemaErrorContext = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Add request ID for error tracking
    if (!req.id) {
        req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add schema error handling context to response locals
    res.locals.schemaErrorContext = {
        requestId: req.id,
        userId: req.user?.id,
        operation: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
    };

    next();
};

/**
 * Async wrapper for route handlers with schema error handling
 * Requirements: 3.1, 3.2
 */
export const withSchemaErrorHandling = (
    handler: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await handler(req, res, next);
        } catch (error: any) {
            // Log the error with context
            logger.error('Route handler error with schema error handling', {
                error: error.message,
                errorCode: error.code,
                operation: `${req.method} ${req.path}`,
                userId: req.user?.id,
                requestId: req.id,
                requirement: '3.2'
            });

            // Pass to schema error middleware
            handleSchemaErrors(error, req, res, next);
        }
    };
};

/**
 * Health check middleware for database schema status
 * Requirements: 3.2
 */
export const schemaHealthCheck = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // This would typically check database schema version and function availability
        // For now, we'll just add a header indicating schema error handling is active
        res.setHeader('X-Schema-Error-Handling', 'active');
        next();
    } catch (error: any) {
        logger.warn('Schema health check failed', {
            error: error.message,
            requirement: '3.2'
        });
        next(); // Continue anyway, don't block requests
    }
};