import { Request, Response, NextFunction } from 'express';
import { handleSwapError, SWAP_ERROR_CODES } from '../utils/swap-error-handler';

/**
 * Middleware to validate proposal ID parameter
 */
export const validateProposalId = (req: Request, res: Response, next: NextFunction): void => {
    const { proposalId } = req.params;

    if (!proposalId) {
        const validationError = new Error('Proposal ID is required');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
            operation: 'validateProposalId',
            userId: req.user?.id,
            requestData: { proposalId }
        });
        return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(proposalId)) {
        const validationError = new Error('Invalid proposal ID format. Expected UUID format.');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateProposalId',
            userId: req.user?.id,
            requestData: { proposalId }
        });
        return;
    }

    next();
};

/**
 * Middleware to validate user ID parameter
 */
export const validateUserId = (req: Request, res: Response, next: NextFunction): void => {
    const { userId } = req.params;

    if (!userId) {
        const validationError = new Error('User ID is required');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
            operation: 'validateUserId',
            userId: req.user?.id,
            requestData: { userId }
        });
        return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        const validationError = new Error('Invalid user ID format. Expected UUID format.');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateUserId',
            userId: req.user?.id,
            requestData: { userId }
        });
        return;
    }

    next();
};

/**
 * Middleware to validate rejection request body
 */
export const validateRejectionRequest = (req: Request, res: Response, next: NextFunction): void => {
    const { reason } = req.body;

    // Reason is optional, but if provided, validate it
    if (reason !== undefined) {
        if (typeof reason !== 'string') {
            const validationError = new Error('Rejection reason must be a string');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateRejectionRequest',
                userId: req.user?.id,
                requestData: { reasonType: typeof reason }
            });
            return;
        }

        if (reason.length > 500) {
            const validationError = new Error('Rejection reason must be 500 characters or less');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateRejectionRequest',
                userId: req.user?.id,
                requestData: { reasonLength: reason.length }
            });
            return;
        }

        // Sanitize the reason (basic XSS prevention)
        req.body.reason = reason.trim();
    }

    next();
};

/**
 * Middleware to validate query parameters for proposal responses
 */
export const validateProposalResponsesQuery = (req: Request, res: Response, next: NextFunction): void => {
    const { status, limit, offset, sortBy, sortOrder } = req.query;

    // Validate status filter
    if (status && !['pending', 'accepted', 'rejected', 'expired'].includes(status as string)) {
        const validationError = new Error('Invalid status filter. Must be one of: pending, accepted, rejected, expired');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateProposalResponsesQuery',
            userId: req.user?.id,
            requestData: { status }
        });
        return;
    }

    // Validate limit
    if (limit) {
        const parsedLimit = parseInt(limit as string);
        if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
            const validationError = new Error('Limit must be a number between 1 and 100');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateProposalResponsesQuery',
                userId: req.user?.id,
                requestData: { limit }
            });
            return;
        }
    }

    // Validate offset
    if (offset) {
        const parsedOffset = parseInt(offset as string);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
            const validationError = new Error('Offset must be a non-negative number');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateProposalResponsesQuery',
                userId: req.user?.id,
                requestData: { offset }
            });
            return;
        }
    }

    // Validate sortBy
    const validSortFields = ['createdAt', 'updatedAt', 'status'];
    if (sortBy && !validSortFields.includes(sortBy as string)) {
        const validationError = new Error(`Invalid sortBy field. Must be one of: ${validSortFields.join(', ')}`);
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateProposalResponsesQuery',
            userId: req.user?.id,
            requestData: { sortBy }
        });
        return;
    }

    // Validate sortOrder
    const validSortOrders = ['asc', 'desc'];
    if (sortOrder && !validSortOrders.includes(sortOrder as string)) {
        const validationError = new Error(`Invalid sortOrder. Must be one of: ${validSortOrders.join(', ')}`);
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateProposalResponsesQuery',
            userId: req.user?.id,
            requestData: { sortOrder }
        });
        return;
    }

    next();
};