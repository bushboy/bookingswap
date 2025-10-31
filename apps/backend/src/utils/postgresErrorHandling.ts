import { logger } from './logger';

/**
 * PostgreSQL error handling utilities for proposal repository
 * Requirements: 4.3, 5.5
 */

export interface PostgresError extends Error {
    code?: string;
    detail?: string;
    hint?: string;
    position?: string;
    internalPosition?: string;
    internalQuery?: string;
    where?: string;
    schema?: string;
    table?: string;
    column?: string;
    dataType?: string;
    constraint?: string;
    file?: string;
    line?: string;
    routine?: string;
    severity?: string;
}

export interface ErrorContext {
    operation: string;
    userId?: string;
    requestId?: string;
    query?: string;
    parameters?: any[];
    additionalContext?: Record<string, any>;
}

export interface PostgresErrorDetails {
    code: string;
    message: string;
    category: 'column_error' | 'constraint_error' | 'syntax_error' | 'permission_error' | 'connection_error' | 'unknown';
    severity: 'error' | 'warning' | 'info';
    retryable: boolean;
    userMessage: string;
    resolution: string;
    position?: number;
}

/**
 * PostgreSQL error codes relevant to proposal repository
 */
export const POSTGRES_ERROR_CODES = {
    // Column and relation errors
    COLUMN_NOT_FOUND: '42703',
    RELATION_NOT_FOUND: '42P01',
    FUNCTION_NOT_FOUND: '42883',

    // Constraint errors
    UNIQUE_VIOLATION: '23505',
    FOREIGN_KEY_VIOLATION: '23503',
    CHECK_VIOLATION: '23514',
    NOT_NULL_VIOLATION: '23502',

    // Syntax errors
    SYNTAX_ERROR: '42601',
    INVALID_NAME: '42602',

    // Permission errors
    INSUFFICIENT_PRIVILEGE: '42501',

    // Connection errors
    CONNECTION_FAILURE: '08006',
    CONNECTION_DOES_NOT_EXIST: '08003',

    // Transaction errors
    SERIALIZATION_FAILURE: '40001',
    DEADLOCK_DETECTED: '40P01'
} as const;

/**
 * Enhanced PostgreSQL error handler for proposal repository operations
 */
export class PostgresErrorHandler {

    /**
     * Detect and classify PostgreSQL errors
     */
    static detectPostgresError(error: any): PostgresErrorDetails | null {
        if (!error || !error.code) {
            return null;
        }

        const pgError = error as PostgresError;
        const errorCode = pgError.code;
        const errorMessage = pgError.message || '';

        switch (errorCode) {
            case POSTGRES_ERROR_CODES.COLUMN_NOT_FOUND:
                return this.handleColumnNotFoundError(pgError);

            case POSTGRES_ERROR_CODES.RELATION_NOT_FOUND:
                return this.handleRelationNotFoundError(pgError);

            case POSTGRES_ERROR_CODES.FUNCTION_NOT_FOUND:
                return this.handleFunctionNotFoundError(pgError);

            case POSTGRES_ERROR_CODES.UNIQUE_VIOLATION:
                return this.handleUniqueViolationError(pgError);

            case POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION:
                return this.handleForeignKeyViolationError(pgError);

            case POSTGRES_ERROR_CODES.CHECK_VIOLATION:
                return this.handleCheckViolationError(pgError);

            case POSTGRES_ERROR_CODES.NOT_NULL_VIOLATION:
                return this.handleNotNullViolationError(pgError);

            case POSTGRES_ERROR_CODES.SYNTAX_ERROR:
                return this.handleSyntaxError(pgError);

            case POSTGRES_ERROR_CODES.INSUFFICIENT_PRIVILEGE:
                return this.handlePermissionError(pgError);

            case POSTGRES_ERROR_CODES.CONNECTION_FAILURE:
            case POSTGRES_ERROR_CODES.CONNECTION_DOES_NOT_EXIST:
                return this.handleConnectionError(pgError);

            case POSTGRES_ERROR_CODES.SERIALIZATION_FAILURE:
            case POSTGRES_ERROR_CODES.DEADLOCK_DETECTED:
                return this.handleTransactionError(pgError);

            default:
                return this.handleUnknownError(pgError);
        }
    }

    /**
     * Handle column not found errors (42703)
     */
    private static handleColumnNotFoundError(error: PostgresError): PostgresErrorDetails {
        const columnMatch = error.message?.match(/column "([^"]+)" does not exist/i);
        const columnName = columnMatch ? columnMatch[1] : 'unknown';

        // Check if this is a deprecated column from schema simplification
        const deprecatedColumns = ['owner_id', 'proposer_id', 'target_booking_id'];
        const isDeprecated = deprecatedColumns.includes(columnName);

        return {
            code: POSTGRES_ERROR_CODES.COLUMN_NOT_FOUND,
            message: `Column "${columnName}" does not exist`,
            category: 'column_error',
            severity: 'error',
            retryable: false,
            userMessage: isDeprecated
                ? 'The system is updating to use simplified database relationships. Please try again.'
                : 'The requested data field is not available. Please contact support if this persists.',
            resolution: isDeprecated
                ? 'Update query to derive user information from booking relationships instead of removed columns'
                : 'Verify column name and update query to use existing columns',
            position: error.position ? parseInt(error.position) : undefined
        };
    }

    /**
     * Handle relation not found errors (42P01)
     */
    private static handleRelationNotFoundError(error: PostgresError): PostgresErrorDetails {
        const relationMatch = error.message?.match(/relation "([^"]+)" does not exist/i);
        const relationName = relationMatch ? relationMatch[1] : 'unknown';

        return {
            code: POSTGRES_ERROR_CODES.RELATION_NOT_FOUND,
            message: `Table or view "${relationName}" does not exist`,
            category: 'column_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The system is experiencing database structure issues. Please try again later.',
            resolution: 'Verify table name exists and run necessary database migrations'
        };
    }

    /**
     * Handle function not found errors (42883)
     */
    private static handleFunctionNotFoundError(error: PostgresError): PostgresErrorDetails {
        const functionMatch = error.message?.match(/function ([^\s(]+)/i);
        const functionName = functionMatch ? functionMatch[1] : 'unknown';

        return {
            code: POSTGRES_ERROR_CODES.FUNCTION_NOT_FOUND,
            message: `Database function "${functionName}" does not exist`,
            category: 'column_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The system is experiencing database function issues. Please try again later.',
            resolution: 'Run database migration to create or update required database functions'
        };
    }

    /**
     * Handle unique constraint violations (23505)
     */
    private static handleUniqueViolationError(error: PostgresError): PostgresErrorDetails {
        return {
            code: POSTGRES_ERROR_CODES.UNIQUE_VIOLATION,
            message: 'Duplicate record detected',
            category: 'constraint_error',
            severity: 'error',
            retryable: false,
            userMessage: 'This action would create a duplicate record. Please check your input.',
            resolution: 'Check for existing records before insertion or update unique constraints'
        };
    }

    /**
     * Handle foreign key violations (23503)
     */
    private static handleForeignKeyViolationError(error: PostgresError): PostgresErrorDetails {
        return {
            code: POSTGRES_ERROR_CODES.FOREIGN_KEY_VIOLATION,
            message: 'Referenced record does not exist',
            category: 'constraint_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The referenced item no longer exists. Please refresh and try again.',
            resolution: 'Verify referenced records exist before creating relationships'
        };
    }

    /**
     * Handle check constraint violations (23514)
     */
    private static handleCheckViolationError(error: PostgresError): PostgresErrorDetails {
        return {
            code: POSTGRES_ERROR_CODES.CHECK_VIOLATION,
            message: 'Data validation constraint violated',
            category: 'constraint_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The provided data does not meet validation requirements.',
            resolution: 'Review data validation rules and ensure input meets constraints'
        };
    }

    /**
     * Handle not null violations (23502)
     */
    private static handleNotNullViolationError(error: PostgresError): PostgresErrorDetails {
        const columnMatch = error.message?.match(/column "([^"]+)"/i);
        const columnName = columnMatch ? columnMatch[1] : 'unknown';

        return {
            code: POSTGRES_ERROR_CODES.NOT_NULL_VIOLATION,
            message: `Required field "${columnName}" cannot be empty`,
            category: 'constraint_error',
            severity: 'error',
            retryable: false,
            userMessage: `The field "${columnName}" is required and cannot be empty.`,
            resolution: 'Provide a value for the required field or update schema to allow null values'
        };
    }

    /**
     * Handle syntax errors (42601)
     */
    private static handleSyntaxError(error: PostgresError): PostgresErrorDetails {
        return {
            code: POSTGRES_ERROR_CODES.SYNTAX_ERROR,
            message: 'SQL syntax error detected',
            category: 'syntax_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The system encountered a query syntax error. Please contact support.',
            resolution: 'Review and fix SQL syntax in the query',
            position: error.position ? parseInt(error.position) : undefined
        };
    }

    /**
     * Handle permission errors (42501)
     */
    private static handlePermissionError(error: PostgresError): PostgresErrorDetails {
        return {
            code: POSTGRES_ERROR_CODES.INSUFFICIENT_PRIVILEGE,
            message: 'Insufficient database permissions',
            category: 'permission_error',
            severity: 'error',
            retryable: false,
            userMessage: 'The system lacks necessary permissions. Please contact support.',
            resolution: 'Grant necessary database permissions to the application user'
        };
    }

    /**
     * Handle connection errors
     */
    private static handleConnectionError(error: PostgresError): PostgresErrorDetails {
        return {
            code: error.code || POSTGRES_ERROR_CODES.CONNECTION_FAILURE,
            message: 'Database connection error',
            category: 'connection_error',
            severity: 'error',
            retryable: true,
            userMessage: 'The system is temporarily unavailable. Please try again in a moment.',
            resolution: 'Check database connection and network connectivity'
        };
    }

    /**
     * Handle transaction errors (serialization failures, deadlocks)
     */
    private static handleTransactionError(error: PostgresError): PostgresErrorDetails {
        return {
            code: error.code || POSTGRES_ERROR_CODES.SERIALIZATION_FAILURE,
            message: 'Transaction conflict detected',
            category: 'constraint_error',
            severity: 'warning',
            retryable: true,
            userMessage: 'A temporary conflict occurred. Please try again.',
            resolution: 'Retry the operation with exponential backoff'
        };
    }

    /**
     * Handle unknown errors
     */
    private static handleUnknownError(error: PostgresError): PostgresErrorDetails {
        return {
            code: error.code || 'UNKNOWN',
            message: error.message || 'Unknown database error',
            category: 'unknown',
            severity: 'error',
            retryable: false,
            userMessage: 'An unexpected error occurred. Please contact support if this persists.',
            resolution: 'Review error details and consult PostgreSQL documentation'
        };
    }

    /**
     * Log PostgreSQL error with comprehensive context
     */
    static logPostgresError(
        error: PostgresError,
        context: ErrorContext,
        errorDetails?: PostgresErrorDetails
    ): void {
        const logData = {
            error: {
                code: error.code,
                message: error.message,
                detail: error.detail,
                hint: error.hint,
                position: error.position,
                where: error.where,
                schema: error.schema,
                table: error.table,
                column: error.column,
                constraint: error.constraint,
                severity: error.severity
            },
            context: {
                operation: context.operation,
                userId: context.userId,
                requestId: context.requestId,
                query: context.query ? context.query.substring(0, 500) + '...' : undefined,
                parameters: context.parameters,
                ...context.additionalContext
            },
            classification: errorDetails ? {
                category: errorDetails.category,
                severity: errorDetails.severity,
                retryable: errorDetails.retryable,
                resolution: errorDetails.resolution
            } : undefined,
            timestamp: new Date().toISOString(),
            requirement: '4.3'
        };

        if (errorDetails?.severity === 'warning') {
            logger.warn('PostgreSQL warning detected', logData);
        } else {
            logger.error('PostgreSQL error detected', logData);
        }
    }

    /**
     * Create user-friendly error response
     */
    static createErrorResponse(
        error: PostgresError,
        context: ErrorContext
    ): {
        success: false;
        error: {
            code: string;
            message: string;
            category: string;
            retryable: boolean;
            timestamp: string;
        };
        metadata: {
            requestId?: string;
            operation: string;
            requirement: string;
        };
    } {
        const errorDetails = this.detectPostgresError(error);

        // Log the error
        this.logPostgresError(error, context, errorDetails || undefined);

        return {
            success: false,
            error: {
                code: errorDetails?.code || error.code || 'UNKNOWN',
                message: errorDetails?.userMessage || 'An unexpected error occurred',
                category: errorDetails?.category || 'unknown',
                retryable: errorDetails?.retryable || false,
                timestamp: new Date().toISOString()
            },
            metadata: {
                requestId: context.requestId,
                operation: context.operation,
                requirement: '4.3'
            }
        };
    }

    /**
     * Check if error is retryable
     */
    static isRetryableError(error: PostgresError): boolean {
        const errorDetails = this.detectPostgresError(error);
        return errorDetails?.retryable || false;
    }

    /**
     * Get error position in query if available
     */
    static getErrorPosition(error: PostgresError): number | null {
        if (error.position) {
            return parseInt(error.position);
        }
        return null;
    }

    /**
     * Extract query context around error position
     */
    static getQueryContext(query: string, position: number, contextLength: number = 50): string {
        if (!query || position < 1) {
            return query || '';
        }

        const start = Math.max(0, position - contextLength);
        const end = Math.min(query.length, position + contextLength);

        const before = query.substring(start, position - 1);
        const errorChar = query.charAt(position - 1);
        const after = query.substring(position, end);

        return `${before}>>>${errorChar}<<<${after}`;
    }
}

/**
 * Middleware function for handling PostgreSQL errors in Express routes
 */
export function handlePostgresError(
    error: any,
    context: ErrorContext
): { handled: boolean; response?: any } {
    const pgError = error as PostgresError;

    if (!pgError.code) {
        return { handled: false };
    }

    const response = PostgresErrorHandler.createErrorResponse(pgError, context);

    return {
        handled: true,
        response
    };
}