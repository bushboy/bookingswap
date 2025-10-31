import { Response } from 'express';
import { logger } from './logger';

export enum TargetingErrorCodes {
    // Authentication & Authorization - Enhanced for targeting
    UNAUTHORIZED = 'UNAUTHORIZED',
    FORBIDDEN = 'FORBIDDEN',
    TARGETING_TOKEN_VALIDATION_FAILED = 'TARGETING_TOKEN_VALIDATION_FAILED',
    TARGETING_PERMISSION_DENIED = 'TARGETING_PERMISSION_DENIED',
    CROSS_USER_ACCESS_DENIED = 'CROSS_USER_ACCESS_DENIED',
    TARGETING_SCOPE_REQUIRED = 'TARGETING_SCOPE_REQUIRED',
    SWAP_ACCESS_DENIED = 'SWAP_ACCESS_DENIED',

    // Validation Errors
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    INVALID_SWAP_ID = 'INVALID_SWAP_ID',
    MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',

    // Business Logic Errors
    SWAP_NOT_FOUND = 'SWAP_NOT_FOUND',
    CANNOT_TARGET_OWN_SWAP = 'CANNOT_TARGET_OWN_SWAP',
    AUCTION_ENDED = 'AUCTION_ENDED',
    PROPOSAL_PENDING = 'PROPOSAL_PENDING',
    CIRCULAR_TARGETING = 'CIRCULAR_TARGETING',
    SWAP_ALREADY_TARGETED = 'SWAP_ALREADY_TARGETED',
    TARGET_SWAP_UNAVAILABLE = 'TARGET_SWAP_UNAVAILABLE',
    CONCURRENT_TARGETING = 'CONCURRENT_TARGETING',

    // System Errors
    TARGETING_ERROR = 'TARGETING_ERROR',
    RETARGETING_ERROR = 'RETARGETING_ERROR',
    REMOVE_TARGET_ERROR = 'REMOVE_TARGET_ERROR',
    TARGETING_STATUS_ERROR = 'TARGETING_STATUS_ERROR',
    CAN_TARGET_CHECK_ERROR = 'CAN_TARGET_CHECK_ERROR',
    TARGETING_HISTORY_ERROR = 'TARGETING_HISTORY_ERROR',
    USER_TARGETING_ACTIVITY_ERROR = 'USER_TARGETING_ACTIVITY_ERROR',
    TARGETED_BY_ERROR = 'TARGETED_BY_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export interface TargetingErrorDetails {
    code: TargetingErrorCodes;
    message: string;
    category: 'authentication' | 'authorization' | 'validation' | 'business' | 'system' | 'rate_limit';
    statusCode: number;
    details?: Record<string, any>;
    isTargetingRelated?: boolean;
    preservesMainAuth?: boolean;
}

export class TargetingError extends Error {
    public readonly code: TargetingErrorCodes;
    public readonly category: string;
    public readonly statusCode: number;
    public readonly details?: Record<string, any>;
    public readonly isTargetingRelated: boolean;
    public readonly preservesMainAuth: boolean;

    constructor(errorDetails: TargetingErrorDetails) {
        super(errorDetails.message);
        this.name = 'TargetingError';
        this.code = errorDetails.code;
        this.category = errorDetails.category;
        this.statusCode = errorDetails.statusCode;
        this.details = errorDetails.details;
        this.isTargetingRelated = errorDetails.isTargetingRelated ?? true;
        this.preservesMainAuth = errorDetails.preservesMainAuth ?? true;
    }
}

export class TargetingErrorFactory {
    static createUnauthorizedError(): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.UNAUTHORIZED,
            message: 'User authentication required',
            category: 'authentication',
            statusCode: 401,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createForbiddenError(message: string = 'Access denied'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.FORBIDDEN,
            message,
            category: 'authorization',
            statusCode: 403,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createTargetingTokenValidationError(message: string = 'Token validation failed for targeting operation'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.TARGETING_TOKEN_VALIDATION_FAILED,
            message,
            category: 'authentication',
            statusCode: 401,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createTargetingPermissionError(message: string = 'Insufficient permissions for targeting operation'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.TARGETING_PERMISSION_DENIED,
            message,
            category: 'authorization',
            statusCode: 403,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createCrossUserAccessError(message: string = 'Cross-user access not allowed for this targeting operation'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.CROSS_USER_ACCESS_DENIED,
            message,
            category: 'authorization',
            statusCode: 403,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createTargetingScopeError(message: string = 'Targeting scope required for this operation'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.TARGETING_SCOPE_REQUIRED,
            message,
            category: 'authorization',
            statusCode: 403,
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createSwapAccessError(swapId: string, message: string = 'Access denied to swap for targeting operation'): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.SWAP_ACCESS_DENIED,
            message,
            category: 'authorization',
            statusCode: 403,
            details: { swapId },
            isTargetingRelated: true,
            preservesMainAuth: true
        });
    }

    static createValidationError(message: string, details?: Record<string, any>): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.VALIDATION_ERROR,
            message,
            category: 'validation',
            statusCode: 400,
            details
        });
    }

    static createSwapNotFoundError(swapId: string): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.SWAP_NOT_FOUND,
            message: `Swap with ID ${swapId} not found`,
            category: 'business',
            statusCode: 404,
            details: { swapId }
        });
    }

    static createCannotTargetOwnSwapError(): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.CANNOT_TARGET_OWN_SWAP,
            message: 'Cannot target your own swap',
            category: 'business',
            statusCode: 400
        });
    }

    static createAuctionEndedError(swapId: string, endDate: Date): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.AUCTION_ENDED,
            message: 'Cannot target swap - auction has ended',
            category: 'business',
            statusCode: 409,
            details: { swapId, endDate: endDate.toISOString() }
        });
    }

    static createProposalPendingError(swapId: string): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.PROPOSAL_PENDING,
            message: 'Cannot target swap - proposal already pending',
            category: 'business',
            statusCode: 409,
            details: { swapId }
        });
    }

    static createCircularTargetingError(sourceSwapId: string, targetSwapId: string): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.CIRCULAR_TARGETING,
            message: 'Circular targeting detected',
            category: 'business',
            statusCode: 400,
            details: { sourceSwapId, targetSwapId }
        });
    }

    static createSwapAlreadyTargetedError(sourceSwapId: string, currentTargetId: string): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.SWAP_ALREADY_TARGETED,
            message: 'Swap is already targeting another swap',
            category: 'business',
            statusCode: 409,
            details: { sourceSwapId, currentTargetId }
        });
    }

    static createTargetSwapUnavailableError(targetSwapId: string, reason: string): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.TARGET_SWAP_UNAVAILABLE,
            message: `Target swap is unavailable: ${reason}`,
            category: 'business',
            statusCode: 409,
            details: { targetSwapId, reason }
        });
    }

    static createConcurrentTargetingError(): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.CONCURRENT_TARGETING,
            message: 'Concurrent targeting operation detected. Please try again.',
            category: 'business',
            statusCode: 409
        });
    }

    static createDatabaseError(operation: string, originalError: Error): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.DATABASE_ERROR,
            message: `Database error during ${operation}`,
            category: 'system',
            statusCode: 500,
            details: { operation, originalError: originalError.message }
        });
    }

    static createRateLimitError(limit: number, windowMs: number): TargetingError {
        return new TargetingError({
            code: TargetingErrorCodes.RATE_LIMIT_EXCEEDED,
            message: `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
            category: 'rate_limit',
            statusCode: 429,
            details: { limit, windowMs }
        });
    }
}

export interface StandardTargetingResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        category: string;
        details?: Record<string, any>;
        isTargetingRelated?: boolean;
        preservesMainAuth?: boolean;
    };
    metadata: {
        requestId: string;
        timestamp: string;
        executionTime: number;
        warnings?: string[];
        targetingOperation?: string;
        authenticationPreserved?: boolean;
    };
}

export function formatTargetingResponse<T>(
    success: boolean,
    requestId: string,
    executionTime: number,
    data?: T,
    error?: TargetingError,
    warnings?: string[]
): StandardTargetingResponse<T> {
    const response: StandardTargetingResponse<T> = {
        success,
        metadata: {
            requestId,
            timestamp: new Date().toISOString(),
            executionTime,
            warnings
        }
    };

    if (success && data !== undefined) {
        response.data = data;
    }

    if (!success && error) {
        response.error = {
            code: error.code,
            message: error.message,
            category: error.category,
            details: error.details,
            isTargetingRelated: error.isTargetingRelated,
            preservesMainAuth: error.preservesMainAuth
        };

        // Add targeting-specific metadata
        response.metadata.authenticationPreserved = error.preservesMainAuth;
    }

    return response;
}

export function handleTargetingError(
    error: any,
    res: Response,
    requestId: string,
    executionTime: number,
    operation: string,
    userId?: string,
    additionalContext?: Record<string, any>
): void {
    let targetingError: TargetingError;

    // Convert known errors to TargetingError
    if (error instanceof TargetingError) {
        targetingError = error;
    } else if (error.message?.includes('not found')) {
        targetingError = TargetingErrorFactory.createSwapNotFoundError(
            additionalContext?.swapId || 'unknown'
        );
    } else if (error.message?.includes('unauthorized')) {
        targetingError = TargetingErrorFactory.createUnauthorizedError();
    } else if (error.message?.includes('forbidden')) {
        targetingError = TargetingErrorFactory.createForbiddenError(error.message);
    } else if (error.message?.includes('validation')) {
        targetingError = TargetingErrorFactory.createValidationError(error.message);
    } else if (error.message?.includes('database') || error.message?.includes('connection')) {
        targetingError = TargetingErrorFactory.createDatabaseError(operation, error);
    } else {
        // Generic system error
        targetingError = new TargetingError({
            code: TargetingErrorCodes.TARGETING_ERROR,
            message: error.message || 'An unexpected error occurred',
            category: 'system',
            statusCode: 500,
            details: { operation, originalError: error.message }
        });
    }

    // Log the error with context
    logger.error(`Targeting ${operation} error`, {
        error: targetingError.message,
        errorCode: targetingError.code,
        errorCategory: targetingError.category,
        errorStack: error.stack,
        userId,
        requestId,
        executionTime,
        operation,
        ...additionalContext
    });

    // Send formatted error response
    const response = formatTargetingResponse(
        false,
        requestId,
        executionTime,
        undefined,
        targetingError
    );

    res.status(targetingError.statusCode).json(response);
}

export function logTargetingOperation(
    operation: string,
    success: boolean,
    requestId: string,
    userId: string,
    executionTime: number,
    details: Record<string, any>
): void {
    const logLevel = success ? 'info' : 'warn';
    const message = `Targeting ${operation} ${success ? 'successful' : 'failed'}`;

    logger[logLevel](message, {
        operation,
        success,
        requestId,
        userId,
        executionTime,
        ...details
    });
}

// Rate limiting configuration for targeting operations
export const TARGETING_RATE_LIMITS = {
    TARGET_SWAP: { limit: 10, windowMs: 60000 }, // 10 targeting operations per minute
    RETARGET_SWAP: { limit: 5, windowMs: 60000 }, // 5 retargeting operations per minute
    REMOVE_TARGET: { limit: 10, windowMs: 60000 }, // 10 removal operations per minute
    GET_STATUS: { limit: 100, windowMs: 60000 }, // 100 status checks per minute
    GET_HISTORY: { limit: 50, windowMs: 60000 }, // 50 history requests per minute
} as const;

export type TargetingOperation = keyof typeof TARGETING_RATE_LIMITS;