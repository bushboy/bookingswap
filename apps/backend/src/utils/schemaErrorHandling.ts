import { Response } from 'express';
import { logger } from './logger';
import { DatabaseSchemaError, SwapMatchingError } from '../database/repositories/SwapRepository';

/**
 * Schema-related error codes for database function issues
 * Requirements: 3.1, 3.2
 */
export enum SchemaErrorCodes {
    COLUMN_NOT_FOUND = '42703',
    FUNCTION_NOT_FOUND = '42883',
    RELATION_NOT_FOUND = '42P01',
    UNDEFINED_TABLE = '42P01',
    SYNTAX_ERROR = '42601',
    PERMISSION_DENIED = '42501'
}

/**
 * Schema error details for comprehensive error handling
 */
export interface SchemaErrorDetails {
    code: string;
    message: string;
    category: 'schema_migration' | 'function_update' | 'permission' | 'syntax';
    statusCode: number;
    userMessage: string;
    resolution: string;
    retryable: boolean;
}

/**
 * Database schema error class for column reference and function issues
 * Requirements: 3.1, 3.2
 */
export class SchemaError extends Error {
    public readonly code: string;
    public readonly category: string;
    public readonly statusCode: number;
    public readonly userMessage: string;
    public readonly resolution: string;
    public readonly retryable: boolean;
    public readonly originalError?: Error;

    constructor(errorDetails: SchemaErrorDetails, originalError?: Error) {
        super(errorDetails.message);
        this.name = 'SchemaError';
        this.code = errorDetails.code;
        this.category = errorDetails.category;
        this.statusCode = errorDetails.statusCode;
        this.userMessage = errorDetails.userMessage;
        this.resolution = errorDetails.resolution;
        this.retryable = errorDetails.retryable;
        this.originalError = originalError;
    }
}

/**
 * Factory for creating schema-related errors
 * Requirements: 3.1, 3.2
 */
export class SchemaErrorFactory {
    /**
     * Create error for column reference issues (42703)
     */
    static createColumnNotFoundError(columnName: string, tableName?: string): SchemaError {
        return new SchemaError({
            code: SchemaErrorCodes.COLUMN_NOT_FOUND,
            message: `Column "${columnName}" does not exist${tableName ? ` in table "${tableName}"` : ''}`,
            category: 'schema_migration',
            statusCode: 500,
            userMessage: 'The system is experiencing database schema issues. Please try again later.',
            resolution: 'Run database migration to update schema for simplified column structure',
            retryable: false
        });
    }

    /**
     * Create error for function not found issues (42883)
     */
    static createFunctionNotFoundError(functionName: string): SchemaError {
        return new SchemaError({
            code: SchemaErrorCodes.FUNCTION_NOT_FOUND,
            message: `Function "${functionName}" does not exist`,
            category: 'function_update',
            statusCode: 500,
            userMessage: 'The system is experiencing database function issues. Please try again later.',
            resolution: 'Run database migration to create or update database functions',
            retryable: false
        });
    }

    /**
     * Create error for table/relation not found issues (42P01)
     */
    static createRelationNotFoundError(relationName: string): SchemaError {
        return new SchemaError({
            code: SchemaErrorCodes.RELATION_NOT_FOUND,
            message: `Relation "${relationName}" does not exist`,
            category: 'schema_migration',
            statusCode: 500,
            userMessage: 'The system is experiencing database structure issues. Please try again later.',
            resolution: 'Verify database schema and run necessary migrations',
            retryable: false
        });
    }

    /**
     * Create error for permission denied issues (42501)
     */
    static createPermissionDeniedError(operation: string): SchemaError {
        return new SchemaError({
            code: SchemaErrorCodes.PERMISSION_DENIED,
            message: `Permission denied for ${operation}`,
            category: 'permission',
            statusCode: 500,
            userMessage: 'The system is experiencing permission issues. Please contact support.',
            resolution: 'Check database user permissions and grant necessary access',
            retryable: false
        });
    }

    /**
     * Create error for syntax issues (42601)
     */
    static createSyntaxError(details: string): SchemaError {
        return new SchemaError({
            code: SchemaErrorCodes.SYNTAX_ERROR,
            message: `Syntax error: ${details}`,
            category: 'syntax',
            statusCode: 500,
            userMessage: 'The system is experiencing query syntax issues. Please try again later.',
            resolution: 'Review and fix SQL syntax in database functions or queries',
            retryable: false
        });
    }
}

/**
 * Detect and classify database schema errors
 * Requirements: 3.1, 3.2
 */
export function detectSchemaError(error: any): SchemaError | null {
    if (!error || !error.code) {
        return null;
    }

    const errorCode = error.code;
    const errorMessage = error.message || '';

    switch (errorCode) {
        case SchemaErrorCodes.COLUMN_NOT_FOUND:
            // Extract column name from error message
            const columnMatch = errorMessage.match(/column "([^"]+)" does not exist/i);
            const tableMatch = errorMessage.match(/relation "([^"]+)"/i);
            const columnName = columnMatch ? columnMatch[1] : 'unknown';
            const tableName = tableMatch ? tableMatch[1] : undefined;

            return SchemaErrorFactory.createColumnNotFoundError(columnName, tableName);

        case SchemaErrorCodes.FUNCTION_NOT_FOUND:
            // Extract function name from error message
            const functionMatch = errorMessage.match(/function ([^\s(]+)/i);
            const functionName = functionMatch ? functionMatch[1] : 'unknown';

            return SchemaErrorFactory.createFunctionNotFoundError(functionName);

        case SchemaErrorCodes.RELATION_NOT_FOUND:
            // Extract relation name from error message
            const relationMatch = errorMessage.match(/relation "([^"]+)" does not exist/i);
            const relationName = relationMatch ? relationMatch[1] : 'unknown';

            return SchemaErrorFactory.createRelationNotFoundError(relationName);

        case SchemaErrorCodes.PERMISSION_DENIED:
            // Extract operation from error message
            const operationMatch = errorMessage.match(/permission denied for (.+)/i);
            const operation = operationMatch ? operationMatch[1] : 'database operation';

            return SchemaErrorFactory.createPermissionDeniedError(operation);

        case SchemaErrorCodes.SYNTAX_ERROR:
            return SchemaErrorFactory.createSyntaxError(errorMessage);

        default:
            return null;
    }
}

/**
 * Handle schema errors with proper logging and user-friendly responses
 * Requirements: 3.1, 3.2
 */
export function handleSchemaError(
    error: any,
    res: Response,
    context: {
        operation: string;
        userId?: string;
        requestId?: string;
        additionalContext?: Record<string, any>;
    }
): boolean {
    const schemaError = detectSchemaError(error);

    if (!schemaError) {
        return false; // Not a schema error, let other handlers deal with it
    }

    // Log the schema error with comprehensive context
    logger.error('Database schema error detected', {
        error: schemaError.message,
        errorCode: schemaError.code,
        category: schemaError.category,
        operation: context.operation,
        userId: context.userId,
        requestId: context.requestId,
        resolution: schemaError.resolution,
        retryable: schemaError.retryable,
        originalError: error.message,
        stack: error.stack,
        requirement: '3.1',
        ...context.additionalContext
    });

    // Send user-friendly error response
    const response = {
        success: false,
        error: {
            code: schemaError.code,
            message: schemaError.userMessage,
            category: schemaError.category,
            retryable: schemaError.retryable,
            timestamp: new Date().toISOString()
        },
        metadata: {
            requestId: context.requestId,
            operation: context.operation,
            requirement: '3.2'
        }
    };

    res.status(schemaError.statusCode).json(response);
    return true; // Indicates the error was handled
}

/**
 * Graceful degradation for schema-related issues
 * Requirements: 3.2
 */
export function createSchemaFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T>,
    operationName: string
) {
    return async (): Promise<T> => {
        try {
            return await primaryOperation();
        } catch (error: any) {
            const schemaError = detectSchemaError(error);

            if (schemaError) {
                logger.warn(`Schema error in ${operationName}, attempting fallback`, {
                    error: schemaError.message,
                    errorCode: schemaError.code,
                    operation: operationName,
                    requirement: '3.2'
                });

                try {
                    return await fallbackOperation();
                } catch (fallbackError: any) {
                    logger.error(`Fallback also failed for ${operationName}`, {
                        primaryError: schemaError.message,
                        fallbackError: fallbackError.message,
                        operation: operationName,
                        requirement: '3.2'
                    });

                    // Throw the original schema error since fallback failed
                    throw new DatabaseSchemaError(schemaError.userMessage, error);
                }
            }

            // Not a schema error, re-throw original
            throw error;
        }
    };
}

/**
 * Middleware for handling schema errors in Express routes
 * Requirements: 3.1, 3.2
 */
export function schemaErrorMiddleware(
    error: any,
    req: any,
    res: Response,
    next: any
): void {
    const handled = handleSchemaError(error, res, {
        operation: `${req.method} ${req.path}`,
        userId: req.user?.id,
        requestId: req.id,
        additionalContext: {
            url: req.url,
            method: req.method,
            userAgent: req.get('User-Agent')
        }
    });

    if (!handled) {
        next(error); // Pass to next error handler if not a schema error
    }
}

/**
 * Validate database function availability
 * Requirements: 3.2
 */
export async function validateDatabaseFunctions(
    pool: any,
    requiredFunctions: string[]
): Promise<{ available: string[]; missing: string[] }> {
    const available: string[] = [];
    const missing: string[] = [];

    for (const functionName of requiredFunctions) {
        try {
            const query = `
        SELECT EXISTS (
          SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON p.pronamespace = n.oid
          WHERE p.proname = $1 AND n.nspname = 'public'
        ) as exists
      `;

            const result = await pool.query(query, [functionName]);

            if (result.rows[0].exists) {
                available.push(functionName);
            } else {
                missing.push(functionName);
            }
        } catch (error: any) {
            logger.warn(`Failed to check function ${functionName}`, {
                error: error.message,
                functionName,
                requirement: '3.2'
            });
            missing.push(functionName);
        }
    }

    return { available, missing };
}

/**
 * Check if database schema is up to date
 * Requirements: 3.2
 */
export async function validateSchemaVersion(
    pool: any,
    expectedVersion: string
): Promise<{ isUpToDate: boolean; currentVersion?: string; error?: string }> {
    try {
        const query = `
      SELECT version FROM schema_migrations 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

        const result = await pool.query(query);

        if (result.rows.length === 0) {
            return {
                isUpToDate: false,
                error: 'No schema migrations found'
            };
        }

        const currentVersion = result.rows[0].version;
        const isUpToDate = currentVersion >= expectedVersion;

        return {
            isUpToDate,
            currentVersion
        };
    } catch (error: any) {
        logger.error('Failed to validate schema version', {
            error: error.message,
            expectedVersion,
            requirement: '3.2'
        });

        return {
            isUpToDate: false,
            error: error.message
        };
    }
}

/**
 * Common schema error patterns and their resolutions
 */
export const SCHEMA_ERROR_PATTERNS = {
    REMOVED_COLUMNS: {
        pattern: /column "(owner_id|proposer_id|target_booking_id)" does not exist/i,
        resolution: 'These columns were removed in schema simplification. Update queries to derive this information from booking relationships.',
        migrationRequired: '030_update_database_functions_for_simplified_schema.sql'
    },
    OUTDATED_FUNCTIONS: {
        pattern: /function "(find_eligible_swaps_optimized|has_existing_proposal_optimized)" does not exist/i,
        resolution: 'Database functions need to be updated for simplified schema.',
        migrationRequired: '030_update_database_functions_for_simplified_schema.sql'
    },
    MISSING_INDEXES: {
        pattern: /could not create unique index|duplicate key value violates unique constraint/i,
        resolution: 'Database indexes may need to be updated for the simplified schema.',
        migrationRequired: '030_update_database_functions_for_simplified_schema.sql'
    }
} as const;

/**
 * Get specific resolution for common schema error patterns
 */
export function getSchemaErrorResolution(errorMessage: string): {
    resolution: string;
    migrationRequired?: string;
} | null {
    for (const [, pattern] of Object.entries(SCHEMA_ERROR_PATTERNS)) {
        if (pattern.pattern.test(errorMessage)) {
            return {
                resolution: pattern.resolution,
                migrationRequired: pattern.migrationRequired
            };
        }
    }

    return null;
}