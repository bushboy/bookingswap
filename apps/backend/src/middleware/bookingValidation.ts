import { Request, Response, NextFunction } from 'express';
import {
    createBookingSchema,
    updateBookingSchema,
    getEnabledBookingTypes,
    getBookingTypeValidationMessage,
    BOOKING_TYPE_CONFIGS
} from '@booking-swap/shared';
import { logger, enhancedLogger } from '../utils/logger';

/**
 * Middleware for validating booking creation requests
 * Ensures booking data conforms to the centralized validation schema
 */
export const validateBookingCreation = (req: Request & { id?: string }, res: Response, next: NextFunction): void => {
    try {
        // Add request ID if not present
        if (!req.id) {
            req.id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        }

        logger.debug('Validating booking creation request', {
            userId: (req as any).user?.id,
            bookingType: req.body.type,
            requestId: req.id
        });

        // Validate request body against the centralized schema
        const { error, value } = createBookingSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const validationErrors = error.details.map((detail: any) => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            // Check if this is a booking type validation error
            const bookingTypeError = error.details.find((detail: any) =>
                detail.path.includes('type') && detail.type === 'any.only'
            );

            // Enhanced logging for booking validation failures
            enhancedLogger.logBusinessEvent(
                'booking_validation_failed',
                'booking',
                String(req.body.id || 'new'),
                (req as any).user?.id,
                {
                    bookingType: req.body.type,
                    errors: validationErrors,
                    isBookingTypeError: !!bookingTypeError,
                    requestId: req.id,
                    validationErrorCount: validationErrors.length,
                    providedBookingType: req.body.type,
                    acceptedBookingTypes: bookingTypeError ? getEnabledBookingTypes() : undefined
                }
            );

            logger.warn('Booking validation failed', {
                userId: (req as any).user?.id,
                bookingType: req.body.type,
                errors: validationErrors,
                isBookingTypeError: !!bookingTypeError,
                requestId: req.id
            });

            // Enhanced error response with accepted booking types
            const errorResponse: any = {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid booking data provided',
                    category: 'validation',
                    details: validationErrors
                }
            };

            // Add accepted booking types for booking type validation errors
            if (bookingTypeError) {
                const enabledTypes = getEnabledBookingTypes();
                errorResponse.error.acceptedBookingTypes = enabledTypes.map(type => ({
                    value: type,
                    label: BOOKING_TYPE_CONFIGS[type].label,
                    icon: BOOKING_TYPE_CONFIGS[type].icon
                }));
                errorResponse.error.message = getBookingTypeValidationMessage();
                errorResponse.error.code = 'INVALID_BOOKING_TYPE';
            }

            res.status(400).json(errorResponse);
            return;
        }

        // Replace request body with validated and sanitized data
        req.body = value;

        // Log successful validation
        enhancedLogger.logBusinessEvent(
            'booking_validation_passed',
            'booking',
            String(req.body.id || 'new'),
            (req as any).user?.id,
            {
                bookingType: req.body.type,
                requestId: req.id
            }
        );

        logger.debug('Booking validation passed', {
            userId: (req as any).user?.id,
            bookingType: req.body.type,
            requestId: req.id
        });

        next();
    } catch (error: any) {
        logger.error('Booking validation middleware error', {
            error: error.message,
            errorStack: error.stack,
            userId: (req as any).user?.id,
            requestId: req.id
        });

        res.status(500).json({
            error: {
                code: 'VALIDATION_MIDDLEWARE_ERROR',
                message: 'Internal validation error',
                category: 'system'
            }
        });
    }
};

/**
 * Middleware for validating booking update requests
 * Ensures booking update data conforms to the validation schema
 */
export const validateBookingUpdate = (req: Request & { id?: string }, res: Response, next: NextFunction): void => {
    try {
        // Add request ID if not present
        if (!req.id) {
            req.id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
        }

        logger.debug('Validating booking update request', {
            userId: (req as any).user?.id,
            bookingId: req.params.id,
            requestId: req.id
        });

        // Validate request body against the update schema
        const { error, value } = updateBookingSchema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });

        if (error) {
            const validationErrors = error.details.map((detail: any) => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            // Check if this is a booking type validation error
            const bookingTypeError = error.details.find((detail: any) =>
                detail.path.includes('type') && detail.type === 'any.only'
            );

            // Enhanced logging for booking update validation failures
            enhancedLogger.logBusinessEvent(
                'booking_update_validation_failed',
                'booking',
                String(req.params.id),
                (req as any).user?.id,
                {
                    bookingType: req.body.type,
                    errors: validationErrors,
                    isBookingTypeError: !!bookingTypeError,
                    requestId: req.id,
                    validationErrorCount: validationErrors.length,
                    providedBookingType: req.body.type,
                    acceptedBookingTypes: bookingTypeError ? getEnabledBookingTypes() : undefined
                }
            );

            logger.warn('Booking update validation failed', {
                userId: (req as any).user?.id,
                bookingId: req.params.id,
                errors: validationErrors,
                isBookingTypeError: !!bookingTypeError,
                requestId: req.id
            });

            // Enhanced error response with accepted booking types
            const errorResponse: any = {
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid booking update data provided',
                    category: 'validation',
                    details: validationErrors
                }
            };

            // Add accepted booking types for booking type validation errors
            if (bookingTypeError) {
                const enabledTypes = getEnabledBookingTypes();
                errorResponse.error.acceptedBookingTypes = enabledTypes.map(type => ({
                    value: type,
                    label: BOOKING_TYPE_CONFIGS[type].label,
                    icon: BOOKING_TYPE_CONFIGS[type].icon
                }));
                errorResponse.error.message = getBookingTypeValidationMessage();
                errorResponse.error.code = 'INVALID_BOOKING_TYPE';
            }

            res.status(400).json(errorResponse);
            return;
        }

        // Replace request body with validated and sanitized data
        req.body = value;

        // Log successful update validation
        enhancedLogger.logBusinessEvent(
            'booking_update_validation_passed',
            'booking',
            String(req.params.id),
            (req as any).user?.id,
            {
                bookingType: req.body.type,
                requestId: req.id
            }
        );

        logger.debug('Booking update validation passed', {
            userId: (req as any).user?.id,
            bookingId: req.params.id,
            requestId: req.id
        });

        next();
    } catch (error: any) {
        logger.error('Booking update validation middleware error', {
            error: error.message,
            errorStack: error.stack,
            userId: (req as any).user?.id,
            bookingId: req.params.id,
            requestId: req.id
        });

        res.status(500).json({
            error: {
                code: 'VALIDATION_MIDDLEWARE_ERROR',
                message: 'Internal validation error',
                category: 'system'
            }
        });
    }
};