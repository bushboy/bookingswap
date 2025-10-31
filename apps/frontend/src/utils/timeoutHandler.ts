/**
 * Timeout Handler Utility
 * 
 * Provides comprehensive timeout detection and handling for proposal actions
 * Addresses Requirement 5.4: WHEN an action times out, THE Proposal_System SHALL provide clear timeout messaging
 */

export interface TimeoutConfig {
    /** Timeout duration in milliseconds */
    timeout: number;
    /** Whether to retry automatically on timeout */
    autoRetry?: boolean;
    /** Maximum number of retry attempts */
    maxRetries?: number;
    /** Delay between retry attempts in milliseconds */
    retryDelay?: number;
    /** Custom timeout message */
    timeoutMessage?: string;
    /** Callback when timeout occurs */
    onTimeout?: (attempt: number, totalAttempts: number) => void;
    /** Callback when retry is attempted */
    onRetry?: (attempt: number, totalAttempts: number) => void;
}

export interface TimeoutResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    timedOut: boolean;
    attempts: number;
    totalDuration: number;
}

/**
 * Enhanced timeout handler with retry logic and detailed error reporting
 */
export class TimeoutHandler {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly DEFAULT_MAX_RETRIES = 3;
    private static readonly DEFAULT_RETRY_DELAY = 2000; // 2 seconds

    /**
     * Execute a promise with timeout and retry logic
     */
    static async executeWithTimeout<T>(
        operation: () => Promise<T>,
        config: Partial<TimeoutConfig> = {}
    ): Promise<TimeoutResult<T>> {
        const {
            timeout = this.DEFAULT_TIMEOUT,
            autoRetry = false,
            maxRetries = this.DEFAULT_MAX_RETRIES,
            retryDelay = this.DEFAULT_RETRY_DELAY,
            timeoutMessage = 'Operation timed out',
            onTimeout,
            onRetry,
        } = config;

        const startTime = Date.now();
        let attempts = 0;
        let lastError: Error | undefined;

        while (attempts < (autoRetry ? maxRetries + 1 : 1)) {
            attempts++;

            try {
                const result = await this.executeWithTimeoutOnce(operation, timeout);

                if (result.timedOut) {
                    lastError = new Error(`${timeoutMessage} (attempt ${attempts})`);

                    if (onTimeout) {
                        onTimeout(attempts, maxRetries + 1);
                    }

                    // If auto-retry is enabled and we haven't exceeded max retries
                    if (autoRetry && attempts <= maxRetries) {
                        console.warn(`[TimeoutHandler] Timeout on attempt ${attempts}, retrying in ${retryDelay}ms...`);

                        if (onRetry) {
                            onRetry(attempts, maxRetries + 1);
                        }

                        await this.delay(retryDelay);
                        continue;
                    }

                    // No more retries, return timeout result
                    return {
                        success: false,
                        timedOut: true,
                        attempts,
                        totalDuration: Date.now() - startTime,
                        error: lastError,
                    };
                }

                // Success
                return {
                    success: true,
                    data: result.data,
                    timedOut: false,
                    attempts,
                    totalDuration: Date.now() - startTime,
                };

            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // If it's not a timeout error and auto-retry is enabled
                if (autoRetry && attempts <= maxRetries && !this.isTimeoutError(lastError)) {
                    console.warn(`[TimeoutHandler] Error on attempt ${attempts}, retrying in ${retryDelay}ms...`, error);

                    if (onRetry) {
                        onRetry(attempts, maxRetries + 1);
                    }

                    await this.delay(retryDelay);
                    continue;
                }

                // No more retries or not retryable, return error result
                return {
                    success: false,
                    timedOut: this.isTimeoutError(lastError),
                    attempts,
                    totalDuration: Date.now() - startTime,
                    error: lastError,
                };
            }
        }

        // Should never reach here, but just in case
        return {
            success: false,
            timedOut: false,
            attempts,
            totalDuration: Date.now() - startTime,
            error: lastError || new Error('Unknown error'),
        };
    }

    /**
     * Execute a single operation with timeout
     */
    private static async executeWithTimeoutOnce<T>(
        operation: () => Promise<T>,
        timeout: number
    ): Promise<{ data?: T; timedOut: boolean }> {
        return new Promise((resolve) => {
            let completed = false;

            // Set up timeout
            const timeoutId = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    resolve({ timedOut: true });
                }
            }, timeout);

            // Execute operation
            operation()
                .then((data) => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutId);
                        resolve({ data, timedOut: false });
                    }
                })
                .catch((error) => {
                    if (!completed) {
                        completed = true;
                        clearTimeout(timeoutId);
                        throw error;
                    }
                });
        });
    }

    /**
     * Check if an error is a timeout error
     */
    private static isTimeoutError(error: Error): boolean {
        const message = error.message.toLowerCase();
        return message.includes('timeout') ||
            message.includes('timed out') ||
            message.includes('request timeout') ||
            message.includes('operation timeout');
    }

    /**
     * Delay utility for retry logic
     */
    private static delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create a timeout error with detailed information
     */
    static createTimeoutError(
        operation: string,
        timeout: number,
        attempt: number,
        totalAttempts: number
    ): Error {
        const error = new Error(
            `${operation} timed out after ${timeout}ms (attempt ${attempt}/${totalAttempts})`
        );
        error.name = 'TimeoutError';
        return error;
    }

    /**
     * Format timeout duration for user display
     */
    static formatTimeout(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        } else if (ms < 60000) {
            return `${(ms / 1000).toFixed(1)}s`;
        } else {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }
    }

    /**
     * Get timeout configuration based on operation type
     */
    static getTimeoutConfig(operationType: 'accept' | 'reject' | 'refresh' | 'general'): TimeoutConfig {
        const baseConfig = {
            autoRetry: true,
            maxRetries: 2,
            retryDelay: 2000,
        };

        switch (operationType) {
            case 'accept':
                return {
                    ...baseConfig,
                    timeout: 45000, // 45 seconds for accept operations
                    timeoutMessage: 'Proposal acceptance timed out',
                };
            case 'reject':
                return {
                    ...baseConfig,
                    timeout: 30000, // 30 seconds for reject operations
                    timeoutMessage: 'Proposal rejection timed out',
                };
            case 'refresh':
                return {
                    ...baseConfig,
                    timeout: 20000, // 20 seconds for refresh operations
                    maxRetries: 1, // Fewer retries for refresh
                    timeoutMessage: 'Data refresh timed out',
                };
            case 'general':
            default:
                return {
                    ...baseConfig,
                    timeout: 30000, // 30 seconds default
                    timeoutMessage: 'Operation timed out',
                };
        }
    }

    /**
     * Wrap a proposal action with timeout handling
     */
    static async wrapProposalAction<T>(
        action: () => Promise<T>,
        actionType: 'accept' | 'reject' | 'refresh',
        proposalId: string,
        onTimeout?: (error: Error) => void,
        onRetry?: (attempt: number) => void
    ): Promise<T> {
        const config = this.getTimeoutConfig(actionType);

        const result = await this.executeWithTimeout(action, {
            ...config,
            onTimeout: (attempt, total) => {
                const error = this.createTimeoutError(
                    `Proposal ${actionType} for ${proposalId}`,
                    config.timeout,
                    attempt,
                    total
                );

                console.error(`[TimeoutHandler] ${error.message}`);

                if (onTimeout) {
                    onTimeout(error);
                }
            },
            onRetry: (attempt, total) => {
                console.log(`[TimeoutHandler] Retrying ${actionType} for proposal ${proposalId} (${attempt}/${total})`);

                if (onRetry) {
                    onRetry(attempt);
                }
            },
        });

        if (!result.success) {
            throw result.error || new Error(`${actionType} operation failed`);
        }

        return result.data!;
    }
}

export default TimeoutHandler;