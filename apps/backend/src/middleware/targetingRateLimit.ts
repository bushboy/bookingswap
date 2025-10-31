import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
    TARGETING_RATE_LIMITS,
    TargetingOperation,
    TargetingErrorFactory,
    handleTargetingError
} from '../utils/targetingErrorHandling';

interface TargetingRateLimitOptions {
    operation: TargetingOperation;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export function createTargetingRateLimit(options: TargetingRateLimitOptions) {
    const { operation, keyGenerator, skipSuccessfulRequests = false, skipFailedRequests = true } = options;
    const config = TARGETING_RATE_LIMITS[operation];

    return rateLimit({
        windowMs: config.windowMs,
        max: config.limit,
        keyGenerator: keyGenerator || ((req: Request) => {
            // Default key generator uses user ID + IP for better security
            const userId = req.user?.id || 'anonymous';
            const ip = req.ip || req.connection.remoteAddress || 'unknown';
            return `targeting_${operation}_${userId}_${ip}`;
        }),
        skipSuccessfulRequests,
        skipFailedRequests,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req: Request, res: Response) => {
            const requestId = `rate-limit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const userId = req.user?.id;

            logger.warn('Targeting rate limit exceeded', {
                operation,
                userId,
                ip: req.ip,
                requestId,
                limit: config.limit,
                windowMs: config.windowMs,
                path: req.path,
                method: req.method
            });

            const rateLimitError = TargetingErrorFactory.createRateLimitError(
                config.limit,
                config.windowMs
            );

            handleTargetingError(
                rateLimitError,
                res,
                requestId,
                0, // No execution time for rate limit errors
                operation,
                userId,
                {
                    operation,
                    limit: config.limit,
                    windowMs: config.windowMs,
                    path: req.path,
                    method: req.method
                }
            );
        },
        onLimitReached: (req: Request) => {
            logger.warn('Targeting rate limit reached', {
                operation,
                userId: req.user?.id,
                ip: req.ip,
                limit: config.limit,
                windowMs: config.windowMs,
                path: req.path,
                method: req.method
            });
        }
    });
}

// Middleware to apply appropriate rate limiting based on the endpoint
export function applyTargetingRateLimit(operation: TargetingOperation) {
    return createTargetingRateLimit({ operation });
}