import { Request, Response, NextFunction } from 'express';
import { handleSwapError, SWAP_ERROR_CODES } from '../utils/swap-error-handler';

/**
 * Middleware to validate swap ID parameter for completion endpoints
 */
export const validateSwapId = (req: Request, res: Response, next: NextFunction): void => {
    const { swapId } = req.params;

    if (!swapId) {
        const validationError = new Error('Swap ID is required');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
            operation: 'validateSwapId',
            userId: req.user?.id,
            requestData: { swapId }
        });
        return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(swapId)) {
        const validationError = new Error('Invalid swap ID format. Expected UUID format.');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateSwapId',
            userId: req.user?.id,
            requestData: { swapId }
        });
        return;
    }

    next();
};

/**
 * Middleware to validate completion ID parameter
 */
export const validateCompletionId = (req: Request, res: Response, next: NextFunction): void => {
    const { completionId } = req.params;

    if (!completionId) {
        const validationError = new Error('Completion ID is required');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
            operation: 'validateCompletionId',
            userId: req.user?.id,
            requestData: { completionId }
        });
        return;
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(completionId)) {
        const validationError = new Error('Invalid completion ID format. Expected UUID format.');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateCompletionId',
            userId: req.user?.id,
            requestData: { completionId }
        });
        return;
    }

    next();
};

/**
 * Middleware to validate proposal acceptance request with completion flags
 */
export const validateProposalAcceptanceWithCompletion = (req: Request, res: Response, next: NextFunction): void => {
    const { ensureCompletion, validationLevel } = req.body;

    // Validate ensureCompletion flag if provided
    if (ensureCompletion !== undefined && typeof ensureCompletion !== 'boolean') {
        const validationError = new Error('ensureCompletion must be a boolean');
        (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
        handleSwapError(validationError, res, {
            operation: 'validateProposalAcceptanceWithCompletion',
            userId: req.user?.id,
            requestData: { ensureCompletionType: typeof ensureCompletion }
        });
        return;
    }

    // Validate validationLevel if provided
    if (validationLevel !== undefined) {
        const validLevels = ['basic', 'comprehensive'];
        if (!validLevels.includes(validationLevel)) {
            const validationError = new Error(`Invalid validation level. Must be one of: ${validLevels.join(', ')}`);
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateProposalAcceptanceWithCompletion',
                userId: req.user?.id,
                requestData: { validationLevel }
            });
            return;
        }
    }

    next();
};

/**
 * Middleware to validate completion validation request body
 */
export const validateCompletionValidationRequest = (req: Request, res: Response, next: NextFunction): void => {
    const { swapIds, bookingIds, proposalIds } = req.body;

    // At least one ID array must be provided
    if (!swapIds && !bookingIds && !proposalIds) {
        const validationError = new Error('At least one of swapIds, bookingIds, or proposalIds must be provided');
        (validationError as any).code = SWAP_ERROR_CODES.MISSING_REQUIRED_FIELDS;
        handleSwapError(validationError, res, {
            operation: 'validateCompletionValidationRequest',
            userId: req.user?.id,
            requestData: { hasSwapIds: !!swapIds, hasBookingIds: !!bookingIds, hasProposalIds: !!proposalIds }
        });
        return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Validate swapIds if provided
    if (swapIds !== undefined) {
        if (!Array.isArray(swapIds)) {
            const validationError = new Error('swapIds must be an array');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { swapIdsType: typeof swapIds }
            });
            return;
        }

        if (swapIds.length > 50) {
            const validationError = new Error('Maximum 50 swap IDs allowed per request');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { swapIdsLength: swapIds.length }
            });
            return;
        }

        for (const swapId of swapIds) {
            if (typeof swapId !== 'string' || !uuidRegex.test(swapId)) {
                const validationError = new Error('All swap IDs must be valid UUIDs');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'validateCompletionValidationRequest',
                    userId: req.user?.id,
                    requestData: { invalidSwapId: swapId }
                });
                return;
            }
        }
    }

    // Validate bookingIds if provided
    if (bookingIds !== undefined) {
        if (!Array.isArray(bookingIds)) {
            const validationError = new Error('bookingIds must be an array');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { bookingIdsType: typeof bookingIds }
            });
            return;
        }

        if (bookingIds.length > 50) {
            const validationError = new Error('Maximum 50 booking IDs allowed per request');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { bookingIdsLength: bookingIds.length }
            });
            return;
        }

        for (const bookingId of bookingIds) {
            if (typeof bookingId !== 'string' || !uuidRegex.test(bookingId)) {
                const validationError = new Error('All booking IDs must be valid UUIDs');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'validateCompletionValidationRequest',
                    userId: req.user?.id,
                    requestData: { invalidBookingId: bookingId }
                });
                return;
            }
        }
    }

    // Validate proposalIds if provided
    if (proposalIds !== undefined) {
        if (!Array.isArray(proposalIds)) {
            const validationError = new Error('proposalIds must be an array');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { proposalIdsType: typeof proposalIds }
            });
            return;
        }

        if (proposalIds.length > 50) {
            const validationError = new Error('Maximum 50 proposal IDs allowed per request');
            (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
            handleSwapError(validationError, res, {
                operation: 'validateCompletionValidationRequest',
                userId: req.user?.id,
                requestData: { proposalIdsLength: proposalIds.length }
            });
            return;
        }

        for (const proposalId of proposalIds) {
            if (typeof proposalId !== 'string' || !uuidRegex.test(proposalId)) {
                const validationError = new Error('All proposal IDs must be valid UUIDs');
                (validationError as any).code = SWAP_ERROR_CODES.INVALID_REQUEST_DATA;
                handleSwapError(validationError, res, {
                    operation: 'validateCompletionValidationRequest',
                    userId: req.user?.id,
                    requestData: { invalidProposalId: proposalId }
                });
                return;
            }
        }
    }

    next();
};