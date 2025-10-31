/**
 * Logging utility for realtime service with configurable log levels
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    data?: any;
    context?: string;
}

export class RealtimeLogger {
    private logLevel: LogLevel;
    private debugMode: boolean;
    private logHistory: LogEntry[] = [];
    private maxHistorySize: number = 100;

    constructor(logLevel: LogLevel = 'warn', debugMode: boolean = false) {
        this.logLevel = logLevel;
        this.debugMode = debugMode;
    }

    /**
     * Set the log level
     */
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        if (enabled) {
            this.info('Debug mode enabled for RealtimeService');
        }
    }

    /**
     * Check if a log level should be output
     */
    private shouldLog(level: LogLevel): boolean {
        const levels: Record<LogLevel, number> = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
        };

        return levels[level] <= levels[this.logLevel];
    }

    /**
     * Create a log entry
     */
    private createLogEntry(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            data,
            context,
        };
    }

    /**
     * Add log entry to history
     */
    private addToHistory(entry: LogEntry): void {
        this.logHistory.push(entry);
        if (this.logHistory.length > this.maxHistorySize) {
            this.logHistory.shift();
        }
    }

    /**
     * Format log message for console output
     */
    private formatMessage(entry: LogEntry): string {
        const prefix = `[RealtimeService${entry.context ? `:${entry.context}` : ''}]`;
        const timestamp = this.debugMode ? `[${entry.timestamp}]` : '';
        return `${timestamp}${prefix} ${entry.message}`;
    }

    /**
     * Log error message
     */
    error(message: string, data?: any, context?: string): void {
        const entry = this.createLogEntry('error', message, data, context);
        this.addToHistory(entry);

        if (this.shouldLog('error')) {
            console.error(this.formatMessage(entry), data || '');
        }
    }

    /**
     * Log warning message
     */
    warn(message: string, data?: any, context?: string): void {
        const entry = this.createLogEntry('warn', message, data, context);
        this.addToHistory(entry);

        if (this.shouldLog('warn')) {
            console.warn(this.formatMessage(entry), data || '');
        }
    }

    /**
     * Log info message
     */
    info(message: string, data?: any, context?: string): void {
        const entry = this.createLogEntry('info', message, data, context);
        this.addToHistory(entry);

        if (this.shouldLog('info')) {
            console.info(this.formatMessage(entry), data || '');
        }
    }

    /**
     * Log debug message
     */
    debug(message: string, data?: any, context?: string): void {
        const entry = this.createLogEntry('debug', message, data, context);
        this.addToHistory(entry);

        if (this.shouldLog('debug')) {
            console.debug(this.formatMessage(entry), data || '');
        }
    }

    /**
     * Log connection event with detailed information
     */
    logConnectionEvent(event: string, details?: any): void {
        const message = `Connection event: ${event}`;
        this.info(message, details, 'Connection');
    }

    /**
     * Log authentication event
     */
    logAuthEvent(event: string, details?: any): void {
        const message = `Authentication event: ${event}`;
        // Don't log sensitive auth data in production
        const safeDetails = this.debugMode ? details : { ...details, token: '[REDACTED]' };
        this.info(message, safeDetails, 'Auth');
    }

    /**
     * Log message handling event
     */
    logMessageEvent(event: string, messageType?: string, details?: any): void {
        const message = `Message event: ${event}${messageType ? ` (${messageType})` : ''}`;
        this.debug(message, details, 'Message');
    }

    /**
     * Log error with stack trace in debug mode
     */
    logError(error: Error, context?: string): void {
        const message = `Error: ${error.message}`;
        const data = this.debugMode ? { stack: error.stack, ...error } : { message: error.message };
        this.error(message, data, context);
    }

    /**
     * Get log history
     */
    getLogHistory(): LogEntry[] {
        return [...this.logHistory];
    }

    /**
     * Clear log history
     */
    clearHistory(): void {
        this.logHistory = [];
    }

    /**
     * Get diagnostic information
     */
    getDiagnostics(): {
        logLevel: LogLevel;
        debugMode: boolean;
        historySize: number;
        recentErrors: LogEntry[];
    } {
        const recentErrors = this.logHistory
            .filter(entry => entry.level === 'error')
            .slice(-5);

        return {
            logLevel: this.logLevel,
            debugMode: this.debugMode,
            historySize: this.logHistory.length,
            recentErrors,
        };
    }
}