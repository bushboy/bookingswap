import { Pool } from 'pg';
import { logger } from './logger';
import { DatabaseColumnValidator, ValidationResult } from './databaseValidation';
import { PostgresErrorHandler, PostgresError, ErrorContext } from './postgresErrorHandling';
import { QueryPerformanceLogger, measureQueryPerformance, QueryMetrics } from './queryPerformanceLogger';

/**
 * Repository error handling wrapper for proposal repository operations
 * Requirements: 4.3, 2.4, 3.3
 */

export interface RepositoryErrorHandlerOptions {
    enableColumnValidation?: boolean;
    enablePerformanceLogging?: boolean;
    enableFallbackStrategies?: boolean;
    performanceThresholds?: {
        slowQueryThreshold?: number;
        verySlowQueryThreshold?: number;
    };
}

export interface FallbackStrategy<T> {
    name: string;
    execute: () => Promise<T>;
    condition?: (error: any) => boolean;
}

export interface RepositoryOperation<T> {
    name: string;
    query: string;
    parameters?: any[];
    executor: () => Promise<T>;
    fallbackStrategies?: FallbackStrategy<T>[];
    context?: Record<string, any>;
}

/**
 * Enhanced repository error handler with comprehensive error handling and validation
 */
export class RepositoryErrorHandler {
    private columnValidator: DatabaseColumnValidator;
    private performanceLogger: QueryPerformanceLogger;
    private options: Required<RepositoryErrorHandlerOptions>;

    constructor(
        private pool: Pool,
        options: RepositoryErrorHandlerOptions = {}
    ) {
        this.columnValidator = new DatabaseColumnValidator(pool);
        this.performanceLogger = QueryPerformanceLogger.getInstance(options.performanceThresholds);

        this.options = {
            enableColumnValidation: true,
            enablePerformanceLogging: true,
            enableFallbackStrategies: true,
            performanceThresholds: {
                slowQueryThreshold: 1000,
                verySlowQueryThreshold: 5000,
                ...options.performanceThresholds
            },
            ...options
        };
    }

    /**
     * Execute repository operation with comprehensive error handling
     */
    async executeWithErrorHandling<T>(
        operation: RepositoryOperation<T>,
        errorContext: Partial<ErrorContext> = {}
    ): Promise<T> {
        const context: ErrorContext = {
            operation: operation.name,
            query: operation.query,
            parameters: operation.parameters,
            ...errorContext
        };

        try {
            // Pre-execution validation
            if (this.options.enableColumnValidation) {
                await this.validateQueryColumns(operation.query, context);
            }

            // Execute with performance monitoring
            if (this.options.enablePerformanceLogging) {
                const { result } = await measureQueryPerformance(
                    operation.name,
                    operation.query,
                    operation.parameters,
                    operation.executor,
                    {
                        rowCount: undefined, // Will be set by the executor if available
                        ...operation.context
                    }
                );
                return result;
            } else {
                return await operation.executor();
            }

        } catch (error) {
            return await this.handleRepositoryError(error, operation, context);
        }
    }

    /**
     * Handle repository errors with fallback strategies
     */
    private async handleRepositoryError<T>(
        error: any,
        operation: RepositoryOperation<T>,
        context: ErrorContext
    ): Promise<T> {
        const pgError = error as PostgresError;

        // Log the error with comprehensive context
        this.logRepositoryError(error, context);

        // Check if error is a PostgreSQL error we can handle
        const errorDetails = PostgresErrorHandler.detectPostgresError(pgError);

        if (errorDetails) {
            // Handle specific PostgreSQL errors
            if (errorDetails.code === '42703') {
                return await this.handleColumnNotFoundError(error, operation, context);
            }

            if (errorDetails.retryable && this.options.enableFallbackStrategies) {
                return await this.executeWithRetry(operation, context, 3);
            }
        }

        // Try fallback strategies if available
        if (this.options.enableFallbackStrategies && operation.fallbackStrategies) {
            return await this.executeFallbackStrategies(error, operation.fallbackStrategies, context);
        }

        // If no fallback worked, throw the original error with enhanced context
        throw this.enhanceError(error, context);
    }

    /**
     * Handle column not found errors with suggestions
     */
    private async handleColumnNotFoundError<T>(
        error: PostgresError,
        operation: RepositoryOperation<T>,
        context: ErrorContext
    ): Promise<T> {
        const columnMatch = error.message?.match(/column "([^"]+)" does not exist/i);
        const columnName = columnMatch ? columnMatch[1] : 'unknown';

        // Check if this is a deprecated column from schema simplification
        const deprecatedColumns = ['owner_id', 'proposer_id', 'target_booking_id'];

        if (deprecatedColumns.includes(columnName)) {
            logger.warn('Deprecated column usage detected in proposal repository', {
                columnName,
                operation: operation.name,
                query: operation.query.substring(0, 200) + '...',
                context,
                requirement: '2.4'
            });

            // If we have a fallback strategy for deprecated columns, use it
            const deprecatedColumnFallback = operation.fallbackStrategies?.find(
                strategy => strategy.name === 'deprecated_column_fallback'
            );

            if (deprecatedColumnFallback) {
                logger.info('Attempting deprecated column fallback strategy', {
                    operation: operation.name,
                    columnName,
                    requirement: '2.4'
                });

                try {
                    return await deprecatedColumnFallback.execute();
                } catch (fallbackError) {
                    logger.error('Deprecated column fallback strategy failed', {
                        operation: operation.name,
                        columnName,
                        fallbackError: fallbackError.message,
                        requirement: '2.4'
                    });
                }
            }
        }

        // Enhance error with column suggestions
        const enhancedError = new Error(
            `Column "${columnName}" does not exist. ${deprecatedColumns.includes(columnName)
                ? 'This column was removed in schema simplification. Use JOIN operations to derive user information from booking relationships.'
                : 'Please check the column name and update the query.'}`
        );

        enhancedError.name = 'DatabaseSchemaError';
        (enhancedError as any).code = error.code;
        (enhancedError as any).originalError = error;
        (enhancedError as any).context = context;

        throw enhancedError;
    }

    /**
     * Execute operation with retry logic
     */
    private async executeWithRetry<T>(
        operation: RepositoryOperation<T>,
        context: ErrorContext,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        let lastError: Error;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.info('Retrying repository operation', {
                    operation: operation.name,
                    attempt,
                    maxRetries,
                    requirement: '3.3'
                });

                return await operation.executor();
            } catch (error) {
                lastError = error as Error;

                // Don't retry certain types of errors
                const pgError = error as PostgresError;
                const errorDetails = PostgresErrorHandler.detectPostgresError(pgError);

                if (errorDetails && !errorDetails.retryable) {
                    break;
                }

                if (attempt === maxRetries) {
                    break;
                }

                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 0.1 * delay;
                await new Promise(resolve => setTimeout(resolve, delay + jitter));
            }
        }

        logger.error('Repository operation failed after all retries', {
            operation: operation.name,
            maxRetries,
            finalError: lastError!.message,
            requirement: '3.3'
        });

        throw lastError!;
    }

    /**
     * Execute fallback strategies in order
     */
    private async executeFallbackStrategies<T>(
        originalError: Error,
        strategies: FallbackStrategy<T>[],
        context: ErrorContext
    ): Promise<T> {
        for (const strategy of strategies) {
            // Check if strategy condition is met
            if (strategy.condition && !strategy.condition(originalError)) {
                continue;
            }

            try {
                logger.info('Attempting fallback strategy', {
                    strategy: strategy.name,
                    operation: context.operation,
                    requirement: '3.3'
                });

                const result = await strategy.execute();

                logger.info('Fallback strategy succeeded', {
                    strategy: strategy.name,
                    operation: context.operation,
                    requirement: '3.3'
                });

                return result;
            } catch (fallbackError) {
                logger.warn('Fallback strategy failed', {
                    strategy: strategy.name,
                    operation: context.operation,
                    error: fallbackError.message,
                    requirement: '3.3'
                });
            }
        }

        // All fallback strategies failed
        throw originalError;
    }

    /**
     * Validate query columns before execution
     */
    private async validateQueryColumns(query: string, context: ErrorContext): Promise<void> {
        try {
            const validation = await this.columnValidator.validateQueryColumns(query);

            if (!validation.isValid) {
                logger.warn('Query column validation failed', {
                    operation: context.operation,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    suggestions: validation.suggestions,
                    query: query.substring(0, 200) + '...',
                    requirement: '4.3'
                });

                // Don't throw for validation warnings, just log them
                if (validation.errors.length > 0) {
                    const error = new Error(`Query validation failed: ${validation.errors.join(', ')}`);
                    error.name = 'QueryValidationError';
                    (error as any).validation = validation;
                    throw error;
                }
            }

            if (validation.warnings.length > 0) {
                logger.warn('Query validation warnings', {
                    operation: context.operation,
                    warnings: validation.warnings,
                    suggestions: validation.suggestions,
                    requirement: '4.3'
                });
            }
        } catch (validationError) {
            logger.error('Query validation error', {
                operation: context.operation,
                error: validationError.message,
                requirement: '4.3'
            });

            // Don't fail the operation for validation errors in production
            // Just log and continue
        }
    }

    /**
     * Log repository errors with comprehensive context
     */
    private logRepositoryError(error: Error, context: ErrorContext): void {
        const pgError = error as PostgresError;
        const errorDetails = PostgresErrorHandler.detectPostgresError(pgError);

        const logData = {
            error: {
                message: error.message,
                name: error.name,
                stack: error.stack,
                code: pgError.code,
                detail: pgError.detail,
                hint: pgError.hint,
                position: pgError.position
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
                userMessage: errorDetails.userMessage,
                resolution: errorDetails.resolution
            } : undefined,
            timestamp: new Date().toISOString(),
            requirement: '4.3'
        };

        if (errorDetails?.severity === 'warning') {
            logger.warn('Repository operation warning', logData);
        } else {
            logger.error('Repository operation error', logData);
        }
    }

    /**
     * Enhance error with additional context
     */
    private enhanceError(error: Error, context: ErrorContext): Error {
        const enhancedError = new Error(error.message);
        enhancedError.name = error.name;
        enhancedError.stack = error.stack;

        // Add context as properties
        (enhancedError as any).context = context;
        (enhancedError as any).operation = context.operation;
        (enhancedError as any).timestamp = new Date().toISOString();
        (enhancedError as any).originalError = error;

        return enhancedError;
    }

    /**
     * Create a fallback strategy for deprecated column queries
     */
    static createDeprecatedColumnFallback<T>(
        alternativeQuery: string,
        alternativeParameters: any[],
        executor: (query: string, params: any[]) => Promise<T>
    ): FallbackStrategy<T> {
        return {
            name: 'deprecated_column_fallback',
            execute: () => executor(alternativeQuery, alternativeParameters),
            condition: (error: any) => {
                const pgError = error as PostgresError;
                if (pgError.code === '42703') {
                    const columnMatch = pgError.message?.match(/column "([^"]+)" does not exist/i);
                    const columnName = columnMatch ? columnMatch[1] : '';
                    const deprecatedColumns = ['owner_id', 'proposer_id', 'target_booking_id'];
                    return deprecatedColumns.includes(columnName);
                }
                return false;
            }
        };
    }

    /**
     * Create a fallback strategy for missing relationship data
     */
    static createMissingDataFallback<T>(
        fallbackValue: T,
        condition?: (error: any) => boolean
    ): FallbackStrategy<T> {
        return {
            name: 'missing_data_fallback',
            execute: () => Promise.resolve(fallbackValue),
            condition: condition || ((error: any) => {
                return error.message?.includes('not found') ||
                    error.message?.includes('does not exist');
            })
        };
    }

    /**
     * Get error handler statistics
     */
    getStats(): {
        columnValidationEnabled: boolean;
        performanceLoggingEnabled: boolean;
        fallbackStrategiesEnabled: boolean;
        performanceStats: any;
    } {
        return {
            columnValidationEnabled: this.options.enableColumnValidation,
            performanceLoggingEnabled: this.options.enablePerformanceLogging,
            fallbackStrategiesEnabled: this.options.enableFallbackStrategies,
            performanceStats: this.performanceLogger.getPerformanceSummary()
        };
    }

    /**
     * Clear caches and reset state
     */
    reset(): void {
        this.columnValidator.clearCache();
        this.performanceLogger.clearHistory();
    }
}

/**
 * Decorator function for repository methods to add error handling
 */
export function withRepositoryErrorHandling<T extends any[], R>(
    errorHandler: RepositoryErrorHandler,
    operationName: string,
    query: string
) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: T): Promise<R> {
            const operation: RepositoryOperation<R> = {
                name: `${target.constructor.name}.${operationName}`,
                query,
                parameters: args,
                executor: () => originalMethod.apply(this, args)
            };

            return errorHandler.executeWithErrorHandling(operation, {
                userId: (this as any).currentUserId,
                requestId: (this as any).currentRequestId
            });
        };

        return descriptor;
    };
}

/**
 * Utility function to wrap repository methods with error handling
 */
export function wrapRepositoryMethod<T extends any[], R>(
    method: (...args: T) => Promise<R>,
    errorHandler: RepositoryErrorHandler,
    operationName: string,
    query: string,
    fallbackStrategies?: FallbackStrategy<R>[]
): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
        const operation: RepositoryOperation<R> = {
            name: operationName,
            query,
            parameters: args,
            executor: () => method(...args),
            fallbackStrategies
        };

        return errorHandler.executeWithErrorHandling(operation);
    };
}