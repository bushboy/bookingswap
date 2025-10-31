import { logger } from './logger';

/**
 * Production-safe targeting logger that can be enabled/disabled via environment variables
 * This allows debugging in production without exposing sensitive debug endpoints
 */
export class TargetingProductionLogger {
    private static isEnabled(): boolean {
        return process.env.TARGETING_DEBUG_LOGGING === 'true';
    }

    private static shouldLogSensitiveData(): boolean {
        return process.env.TARGETING_DEBUG_SENSITIVE === 'true' && process.env.NODE_ENV !== 'production';
    }

    /**
     * Log targeting data retrieval step with optional sensitive data filtering
     */
    static logDataRetrievalStep(
        step: string,
        userId: string,
        data: any,
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled()) return;

        const logData: any = {
            category: 'targeting_debug',
            step,
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            timestamp: new Date().toISOString(),
            ...metadata
        };

        if (this.shouldLogSensitiveData()) {
            logData.data = data;
        } else {
            // Log only non-sensitive metadata in production
            logData.dataMetadata = {
                type: typeof data,
                isArray: Array.isArray(data),
                length: Array.isArray(data) ? data.length : undefined,
                hasData: !!data,
                keys: typeof data === 'object' && data ? Object.keys(data) : undefined
            };
        }

        logger.info(`Targeting Debug - ${step}`, logData);
    }

    /**
     * Log transformation step with performance metrics
     */
    static logTransformationStep(
        stepName: string,
        userId: string,
        input: any,
        output: any,
        executionTime: number,
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled()) return;

        const logData: any = {
            category: 'targeting_transformation',
            step: stepName,
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            executionTime,
            timestamp: new Date().toISOString(),
            performance: {
                executionTime,
                category: executionTime <= 100 ? 'fast' :
                    executionTime <= 500 ? 'normal' :
                        executionTime <= 1000 ? 'slow' : 'very_slow'
            },
            ...metadata
        };

        if (this.shouldLogSensitiveData()) {
            logData.input = input;
            logData.output = output;
        } else {
            // Log only structure and counts in production
            logData.inputMetadata = {
                type: typeof input,
                isArray: Array.isArray(input),
                length: Array.isArray(input) ? input.length : undefined
            };
            logData.outputMetadata = {
                type: typeof output,
                isArray: Array.isArray(output),
                length: Array.isArray(output) ? output.length : undefined
            };
        }

        logger.info(`Targeting Transformation - ${stepName}`, logData);
    }

    /**
     * Log validation results with issue details
     */
    static logValidationResults(
        userId: string,
        results: {
            dataIntegrity: boolean;
            missingReferences: string[];
            inconsistencies: string[];
        },
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled()) return;

        const logData: any = {
            category: 'targeting_validation',
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            timestamp: new Date().toISOString(),
            validation: {
                dataIntegrity: results.dataIntegrity,
                missingReferencesCount: results.missingReferences.length,
                inconsistenciesCount: results.inconsistencies.length,
                hasIssues: !results.dataIntegrity || results.missingReferences.length > 0 || results.inconsistencies.length > 0
            },
            ...metadata
        };

        if (this.shouldLogSensitiveData()) {
            logData.validation.missingReferences = results.missingReferences;
            logData.validation.inconsistencies = results.inconsistencies;
        } else {
            // In production, only log that issues exist, not the details
            if (results.missingReferences.length > 0) {
                logData.validation.hasMissingReferences = true;
            }
            if (results.inconsistencies.length > 0) {
                logData.validation.hasInconsistencies = true;
            }
        }

        const logLevel = results.dataIntegrity ? 'info' : 'warn';
        logger[logLevel]('Targeting Validation Results', logData);
    }

    /**
     * Log targeting display error with context
     */
    static logDisplayError(
        userId: string,
        error: Error,
        context: {
            operation: string;
            step?: string;
            data?: any;
        }
    ): void {
        if (!this.isEnabled()) return;

        const logData: any = {
            category: 'targeting_display_error',
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            timestamp: new Date().toISOString(),
            error: {
                message: error.message,
                name: error.name,
                code: (error as any).code
            },
            context: {
                operation: context.operation,
                step: context.step
            }
        };

        if (this.shouldLogSensitiveData() && context.data) {
            logData.context.data = context.data;
        }

        logger.error('Targeting Display Error', logData);
    }

    /**
     * Log performance metrics for targeting operations
     */
    static logPerformanceMetrics(
        operation: string,
        userId: string,
        metrics: {
            executionTime: number;
            queryTime?: number;
            transformationTime?: number;
            validationTime?: number;
            recordsProcessed?: number;
        }
    ): void {
        if (!this.isEnabled()) return;

        const logData = {
            category: 'targeting_performance',
            operation,
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            timestamp: new Date().toISOString(),
            metrics: {
                ...metrics,
                performanceCategory: metrics.executionTime <= 500 ? 'excellent' :
                    metrics.executionTime <= 1000 ? 'good' :
                        metrics.executionTime <= 2000 ? 'acceptable' : 'poor'
            }
        };

        logger.info(`Targeting Performance - ${operation}`, logData);
    }

    /**
     * Log data consistency check results
     */
    static logConsistencyCheck(
        userId: string,
        results: {
            tableCount: number;
            displayCount: number;
            missingCount: number;
            extraCount: number;
            differencesCount: number;
        }
    ): void {
        if (!this.isEnabled()) return;

        const hasIssues = results.missingCount > 0 || results.extraCount > 0 || results.differencesCount > 0;

        const logData = {
            category: 'targeting_consistency',
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            timestamp: new Date().toISOString(),
            consistency: {
                ...results,
                hasIssues,
                consistencyStatus: hasIssues ? 'inconsistent' : 'consistent'
            }
        };

        const logLevel = hasIssues ? 'warn' : 'info';
        logger[logLevel]('Targeting Data Consistency Check', logData);
    }

    /**
     * Enable targeting debug logging (for runtime configuration)
     */
    static enableLogging(): void {
        process.env.TARGETING_DEBUG_LOGGING = 'true';
        logger.info('Targeting debug logging enabled', {
            category: 'targeting_debug_config',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Disable targeting debug logging
     */
    static disableLogging(): void {
        process.env.TARGETING_DEBUG_LOGGING = 'false';
        logger.info('Targeting debug logging disabled', {
            category: 'targeting_debug_config',
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get current logging configuration
     */
    static getLoggingConfig(): {
        debugLoggingEnabled: boolean;
        sensitiveDataLogging: boolean;
        environment: string;
    } {
        return {
            debugLoggingEnabled: this.isEnabled(),
            sensitiveDataLogging: this.shouldLogSensitiveData(),
            environment: process.env.NODE_ENV || 'unknown'
        };
    }

    /**
     * Log targeting operation start
     */
    static logOperationStart(
        operation: string,
        userId: string,
        requestId: string,
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled()) return;

        logger.info(`Targeting Operation Started - ${operation}`, {
            category: 'targeting_operation',
            operation,
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            requestId,
            timestamp: new Date().toISOString(),
            phase: 'start',
            ...metadata
        });
    }

    /**
     * Log targeting operation completion
     */
    static logOperationComplete(
        operation: string,
        userId: string,
        requestId: string,
        executionTime: number,
        success: boolean,
        metadata?: Record<string, any>
    ): void {
        if (!this.isEnabled()) return;

        const logLevel = success ? 'info' : 'error';

        logger[logLevel](`Targeting Operation ${success ? 'Completed' : 'Failed'} - ${operation}`, {
            category: 'targeting_operation',
            operation,
            userId: this.shouldLogSensitiveData() ? userId : '[REDACTED]',
            requestId,
            timestamp: new Date().toISOString(),
            phase: 'complete',
            success,
            executionTime,
            performanceCategory: executionTime <= 500 ? 'fast' :
                executionTime <= 1000 ? 'normal' :
                    executionTime <= 2000 ? 'slow' : 'very_slow',
            ...metadata
        });
    }
}