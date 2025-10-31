import { EventEmitter } from 'events';

/**
 * WebSocket error categories for proper error handling and recovery
 */
export enum WebSocketErrorCategory {
    CONNECTION = 'connection',
    AUTHENTICATION = 'authentication',
    PROTOCOL = 'protocol',
    NETWORK = 'network',
    SERVER = 'server',
    TIMEOUT = 'timeout',
    UNKNOWN = 'unknown'
}

/**
 * WebSocket error severity levels
 */
export enum WebSocketErrorSeverity {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

/**
 * WebSocket error interface with categorization
 */
export interface WebSocketError {
    category: WebSocketErrorCategory;
    severity: WebSocketErrorSeverity;
    code: string;
    message: string;
    originalError?: Error;
    timestamp: Date;
    context?: Record<string, any>;
    retryable: boolean;
    recoveryStrategy: string;
}

/**
 * Recovery action types for different error scenarios
 */
export enum RecoveryAction {
    RECONNECT = 'reconnect',
    REFRESH_TOKEN = 'refresh_token',
    FALLBACK_POLLING = 'fallback_polling',
    NOTIFY_USER = 'notify_user',
    LOG_ONLY = 'log_only',
    PERMANENT_FAILURE = 'permanent_failure'
}

/**
 * WebSocket Error Handler for categorizing and handling different types of connection errors
 */
export class WebSocketErrorHandler extends EventEmitter {
    private errorHistory: WebSocketError[] = [];
    private maxHistorySize: number = 100;

    constructor() {
        super();
    }

    /**
     * Categorize and handle connection errors
     */
    async handleConnectionError(error: Error, context?: Record<string, any>): Promise<void> {
        const categorizedError = this.categorizeError(error, WebSocketErrorCategory.CONNECTION, context);

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        // Emit error event for listeners
        this.emit('connectionError', categorizedError);

        // Execute recovery strategy
        await this.executeRecoveryStrategy(categorizedError);
    }

    /**
     * Handle authentication errors with token refresh logic
     */
    async handleAuthenticationError(error: Error, context?: Record<string, any>): Promise<void> {
        const categorizedError = this.categorizeError(error, WebSocketErrorCategory.AUTHENTICATION, context);

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        // Emit authentication error event
        this.emit('authenticationError', categorizedError);

        // Try token refresh if applicable
        if (categorizedError.retryable) {
            try {
                await this.attemptTokenRefresh();
                this.emit('authenticationRecovered');
            } catch (refreshError) {
                const refreshFailedError = this.categorizeError(
                    refreshError as Error,
                    WebSocketErrorCategory.AUTHENTICATION,
                    { ...context, refreshAttempt: true }
                );

                this.logError(refreshFailedError);
                this.emit('authenticationFailed', refreshFailedError);
            }
        }
    }

    /**
     * Handle protocol errors for malformed messages
     */
    handleProtocolError(error: Error, message?: any, context?: Record<string, any>): void {
        const categorizedError = this.categorizeError(
            error,
            WebSocketErrorCategory.PROTOCOL,
            { ...context, malformedMessage: message }
        );

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        // Emit protocol error event
        this.emit('protocolError', categorizedError);

        // Protocol errors are usually not retryable, just log and continue
        if (categorizedError.severity === WebSocketErrorSeverity.CRITICAL) {
            this.emit('criticalProtocolError', categorizedError);
        }
    }

    /**
     * Handle network-related errors
     */
    async handleNetworkError(error: Error, context?: Record<string, any>): Promise<void> {
        const categorizedError = this.categorizeError(error, WebSocketErrorCategory.NETWORK, context);

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        this.emit('networkError', categorizedError);
        await this.executeRecoveryStrategy(categorizedError);
    }

    /**
     * Handle server errors
     */
    async handleServerError(error: Error, context?: Record<string, any>): Promise<void> {
        const categorizedError = this.categorizeError(error, WebSocketErrorCategory.SERVER, context);

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        this.emit('serverError', categorizedError);
        await this.executeRecoveryStrategy(categorizedError);
    }

    /**
     * Handle timeout errors
     */
    async handleTimeoutError(error: Error, context?: Record<string, any>): Promise<void> {
        const categorizedError = this.categorizeError(error, WebSocketErrorCategory.TIMEOUT, context);

        this.logError(categorizedError);
        this.addToHistory(categorizedError);

        this.emit('timeoutError', categorizedError);
        await this.executeRecoveryStrategy(categorizedError);
    }

    /**
     * Categorize an error based on its properties and context
     */
    private categorizeError(
        error: Error,
        defaultCategory: WebSocketErrorCategory,
        context?: Record<string, any>
    ): WebSocketError {
        let category = defaultCategory;
        let severity = WebSocketErrorSeverity.MEDIUM;
        let code = 'UNKNOWN_ERROR';
        let retryable = false;
        let recoveryStrategy = RecoveryAction.LOG_ONLY;

        const errorMessage = error.message.toLowerCase();

        // Categorize based on error message patterns
        if (errorMessage.includes('network') || errorMessage.includes('connection refused') ||
            errorMessage.includes('timeout') || errorMessage.includes('unreachable')) {
            category = WebSocketErrorCategory.NETWORK;
            severity = WebSocketErrorSeverity.HIGH;
            retryable = true;
            recoveryStrategy = RecoveryAction.RECONNECT;

            if (errorMessage.includes('timeout')) {
                category = WebSocketErrorCategory.TIMEOUT;
                code = 'CONNECTION_TIMEOUT';
            } else if (errorMessage.includes('connection refused')) {
                code = 'CONNECTION_REFUSED';
            } else {
                code = 'NETWORK_ERROR';
            }
        } else if (errorMessage.includes('auth') || errorMessage.includes('unauthorized') ||
            errorMessage.includes('forbidden') || errorMessage.includes('token')) {
            category = WebSocketErrorCategory.AUTHENTICATION;
            severity = WebSocketErrorSeverity.HIGH;
            retryable = true;
            recoveryStrategy = RecoveryAction.REFRESH_TOKEN;

            if (errorMessage.includes('token')) {
                code = 'INVALID_TOKEN';
            } else if (errorMessage.includes('unauthorized')) {
                code = 'UNAUTHORIZED';
            } else {
                code = 'AUTHENTICATION_FAILED';
            }
        } else if (errorMessage.includes('parse') || errorMessage.includes('malformed') ||
            errorMessage.includes('invalid json') || errorMessage.includes('protocol')) {
            category = WebSocketErrorCategory.PROTOCOL;
            severity = WebSocketErrorSeverity.MEDIUM;
            retryable = false;
            recoveryStrategy = RecoveryAction.LOG_ONLY;
            code = 'PROTOCOL_ERROR';
        } else if (errorMessage.includes('server') || errorMessage.includes('internal') ||
            errorMessage.includes('500') || errorMessage.includes('503')) {
            category = WebSocketErrorCategory.SERVER;
            severity = WebSocketErrorSeverity.HIGH;
            retryable = true;
            recoveryStrategy = RecoveryAction.RECONNECT;

            if (errorMessage.includes('500')) {
                code = 'INTERNAL_SERVER_ERROR';
            } else if (errorMessage.includes('503')) {
                code = 'SERVICE_UNAVAILABLE';
            } else {
                code = 'SERVER_ERROR';
            }
        }

        // Adjust severity based on context
        if (context?.attemptCount && context.attemptCount > 3) {
            severity = WebSocketErrorSeverity.CRITICAL;
            if (context.attemptCount > 10) {
                recoveryStrategy = RecoveryAction.PERMANENT_FAILURE;
            }
        }

        return {
            category,
            severity,
            code,
            message: error.message,
            originalError: error,
            timestamp: new Date(),
            context,
            retryable,
            recoveryStrategy
        };
    }

    /**
     * Execute recovery strategy based on error type
     */
    private async executeRecoveryStrategy(error: WebSocketError): Promise<void> {
        switch (error.recoveryStrategy) {
            case RecoveryAction.RECONNECT:
                this.emit('requestReconnection', error);
                break;

            case RecoveryAction.REFRESH_TOKEN:
                this.emit('requestTokenRefresh', error);
                break;

            case RecoveryAction.FALLBACK_POLLING:
                this.emit('requestFallbackMode', error);
                break;

            case RecoveryAction.NOTIFY_USER:
                this.emit('requestUserNotification', error);
                break;

            case RecoveryAction.PERMANENT_FAILURE:
                this.emit('permanentFailure', error);
                break;

            case RecoveryAction.LOG_ONLY:
            default:
                // Already logged, no additional action needed
                break;
        }
    }

    /**
     * Attempt to refresh authentication token
     */
    private async attemptTokenRefresh(): Promise<void> {
        // This would typically call an authentication service
        // For now, we'll emit an event for the connection manager to handle
        return new Promise((resolve, reject) => {
            //console.log('WebSocketErrorHandler: Attempting token refresh');
            this.emit('tokenRefreshRequested', { resolve, reject });

            // Set a timeout for token refresh (reduced from 10s to 5s for better responsiveness)
            const timeoutId = setTimeout(() => {
                //console.error('WebSocketErrorHandler: Token refresh timeout after 5 seconds');
                reject(new Error('Token refresh timeout'));
            }, 5000);

            // Clear timeout if resolved before timeout
            const originalResolve = resolve;
            const originalReject = reject;

            resolve = (...args) => {
                clearTimeout(timeoutId);
                originalResolve(...args);
            };

            reject = (...args) => {
                clearTimeout(timeoutId);
                originalReject(...args);
            };
        });
    }

    /**
     * Log error with appropriate level based on severity
     */
    private logError(error: WebSocketError): void {
        const logMessage = `[${error.category.toUpperCase()}] ${error.code}: ${error.message}`;
        const contextInfo = error.context ? ` | Context: ${JSON.stringify(error.context)}` : '';

        switch (error.severity) {
            case WebSocketErrorSeverity.CRITICAL:
                //console.error(`🔴 CRITICAL ${logMessage}${contextInfo}`, error.originalError);
                break;
            case WebSocketErrorSeverity.HIGH:
                //console.error(`🟠 HIGH ${logMessage}${contextInfo}`, error.originalError);
                break;
            case WebSocketErrorSeverity.MEDIUM:
                //console.warn(`🟡 MEDIUM ${logMessage}${contextInfo}`, error.originalError);
                break;
            case WebSocketErrorSeverity.LOW:
                //console.info(`🟢 LOW ${logMessage}${contextInfo}`, error.originalError);
                break;
        }
    }

    /**
     * Add error to history for analysis
     */
    private addToHistory(error: WebSocketError): void {
        this.errorHistory.push(error);

        // Keep history size manageable
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }
    }

    /**
     * Get error history for analysis
     */
    getErrorHistory(): WebSocketError[] {
        return [...this.errorHistory];
    }

    /**
     * Get error statistics
     */
    getErrorStatistics(): {
        totalErrors: number;
        errorsByCategory: Record<WebSocketErrorCategory, number>;
        errorsBySeverity: Record<WebSocketErrorSeverity, number>;
        recentErrors: WebSocketError[];
    } {
        const now = Date.now();
        const oneHourAgo = now - (60 * 60 * 1000);

        const recentErrors = this.errorHistory.filter(
            error => error.timestamp.getTime() > oneHourAgo
        );

        const errorsByCategory = this.errorHistory.reduce((acc, error) => {
            acc[error.category] = (acc[error.category] || 0) + 1;
            return acc;
        }, {} as Record<WebSocketErrorCategory, number>);

        const errorsBySeverity = this.errorHistory.reduce((acc, error) => {
            acc[error.severity] = (acc[error.severity] || 0) + 1;
            return acc;
        }, {} as Record<WebSocketErrorSeverity, number>);

        return {
            totalErrors: this.errorHistory.length,
            errorsByCategory,
            errorsBySeverity,
            recentErrors
        };
    }

    /**
     * Clear error history
     */
    clearHistory(): void {
        this.errorHistory = [];
    }

    /**
     * Check if error pattern indicates a persistent issue
     */
    isPersistentIssue(category: WebSocketErrorCategory, timeWindowMs: number = 300000): boolean {
        const now = Date.now();
        const windowStart = now - timeWindowMs;

        const recentErrorsOfCategory = this.errorHistory.filter(
            error => error.category === category && error.timestamp.getTime() > windowStart
        );

        // Consider it persistent if we have more than 5 errors of the same category in the time window
        return recentErrorsOfCategory.length > 5;
    }
}