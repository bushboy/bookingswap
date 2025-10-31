import { Request, Response, NextFunction } from 'express';
import { TargetingErrorFactory } from '../utils/targetingErrorHandling';

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Simple validation middleware without express-validator dependency
export const validateTargetSwap = (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;
    const { sourceSwapId, message, conditions } = req.body;

    if (!id || !UUID_REGEX.test(id)) {
        const error = TargetingErrorFactory.createValidationError('Target swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    if (!sourceSwapId || !UUID_REGEX.test(sourceSwapId)) {
        const error = TargetingErrorFactory.createValidationError('Source swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    if (message && (typeof message !== 'string' || message.length > 500)) {
        const error = TargetingErrorFactory.createValidationError('Message must be a string with maximum 500 characters');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    if (conditions && (!Array.isArray(conditions) || conditions.length > 10)) {
        const error = TargetingErrorFactory.createValidationError('Conditions must be an array with maximum 10 items');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    next();
};

export const validateRetargetSwap = (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;
    const { sourceSwapId } = req.body;

    if (!id || !UUID_REGEX.test(id)) {
        const error = TargetingErrorFactory.createValidationError('New target swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    if (!sourceSwapId || !UUID_REGEX.test(sourceSwapId)) {
        const error = TargetingErrorFactory.createValidationError('Source swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    next();
};

export const validateRemoveTarget = (req: Request, res: Response, next: NextFunction): void => {
    const { sourceSwapId } = req.body;

    if (!sourceSwapId || !UUID_REGEX.test(sourceSwapId)) {
        const error = TargetingErrorFactory.createValidationError('Source swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    next();
};

export const validateSwapId = (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
        const error = TargetingErrorFactory.createValidationError('Swap ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    next();
};

export const validateUserIdParam = (req: Request, res: Response, next: NextFunction): void => {
    const { id } = req.params;

    if (!id || !UUID_REGEX.test(id)) {
        const error = TargetingErrorFactory.createValidationError('User ID must be a valid UUID');
        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                category: error.category
            }
        });
        return;
    }

    next();
};

export const validatePagination = (req: Request, res: Response, next: NextFunction): void => {
    const { limit, offset } = req.query;

    if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            const error = TargetingErrorFactory.createValidationError('Limit must be an integer between 1 and 100');
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    category: error.category
                }
            });
            return;
        }
    }

    if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
            const error = TargetingErrorFactory.createValidationError('Offset must be a non-negative integer');
            res.status(error.statusCode).json({
                success: false,
                error: {
                    code: error.code,
                    message: error.message,
                    category: error.category
                }
            });
            return;
        }
    }

    next();
};

export const validateSwapIdWithPagination = [validateSwapId, validatePagination];
export const validateUserIdWithPagination = [validateUserIdParam, validatePagination];

// Custom validation functions
export function validateSwapIds(sourceSwapId: string, targetSwapId: string): void {
    if (!UUID_REGEX.test(sourceSwapId)) {
        throw TargetingErrorFactory.createValidationError('Invalid source swap ID format');
    }

    if (!UUID_REGEX.test(targetSwapId)) {
        throw TargetingErrorFactory.createValidationError('Invalid target swap ID format');
    }

    if (sourceSwapId === targetSwapId) {
        throw TargetingErrorFactory.createCannotTargetOwnSwapError();
    }
}

export function validateUserId(userId: string): void {
    if (!userId || !UUID_REGEX.test(userId)) {
        throw TargetingErrorFactory.createValidationError('Invalid user ID format');
    }
}

export function validatePaginationParams(limit?: string, offset?: string): { limit: number; offset: number } {
    const parsedLimit = limit ? parseInt(limit) : 50;
    const parsedOffset = offset ? parseInt(offset) : 0;

    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw TargetingErrorFactory.createValidationError('Limit must be between 1 and 100');
    }

    if (isNaN(parsedOffset) || parsedOffset < 0) {
        throw TargetingErrorFactory.createValidationError('Offset must be non-negative');
    }

    return { limit: parsedLimit, offset: parsedOffset };
}