/**
 * Log levels for WebSocket operations
 */
export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn',
    INFO = 'info',
    DEBUG = 'debug'
}

/**
 * Log entry interface for structured logging
 */
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: string;
    message: string;
    context?: Record<string, any>;
    error?: Error;
    connectionId?: string;
    sessionId?: string;
    userId?: string;
}

/**
 * Connection context for logging
 */
export interface ConnectionContext {
    connectionId: string;
    sessionId?: string;
    userId?: string;
    url: string;
    attempt: number;
    startTime: Date;
    lastActivity?: Date;
}

/**
 * Diagnostic information for troubleshooting
 */
export interface DiagnosticInfo {
    timestamp: Date;
    connectionState: string;
    lastError?: Error;
    connectionAttempts: number;
    uptime: number;
    messagesSent: number;
    messagesReceived: number;
    lastHeartbeat?: Date;
    networkInfo?: {
        online: boolean;
        effectiveType?: string;
        downlink?: number;
        rtt?: number;
    };
    browserInfo: {
        userAgent: string;
        language: string;
        platform: string;
    };
}

/**
 * WebSocket Logger for structured logging and diagnostics
 */
export class WebSocketLogger {
    private logs: LogEntry[] = [];
    private maxLogSize: number = 1000;
    private currentLogLevel: LogLevel = LogLevel.WARN;
    private connectionContext: ConnectionContext | null = null;
    private diagnosticCollectors: Map<string, () => any> = new Map();

    constructor(logLevel: LogLevel = LogLevel.WARN) {
        this.currentLogLevel = logLevel;
        this.setupDiagnosticCollectors();
    }

    /**
     * Set the current log level
     */
    setLogLevel(level: LogLevel): void {
        this.currentLogLevel = level;
        this.info('Logger', `Log level set to ${level}`);
    }

    /**
     * Get the current log level
     */
    getLogLevel(): LogLevel {
        return this.currentLogLevel;
    }

    /**
     * Set connection context for all subsequent logs
     */
    setConnectionContext(context: ConnectionContext): void {
        this.connectionContext = context;
        this.info('Logger', 'Connection context updated', {
            connectionId: context.connectionId,
            url: context.url,
            attempt: context.attempt
        });
    }

    /**
     * Clear connection context
     */
    clearConnectionContext(): void {
        if (this.connectionContext) {
            this.info('Logger', 'Connection context cleared', {
                connectionId: this.connectionContext.connectionId
            });
        }
        this.connectionContext = null;
    }

    /**
     * Log error message
     */
    error(category: string, message: string, context?: Record<string, any>, error?: Error): void {
        this.log(LogLevel.ERROR, category, message, context, error);
    }

    /**
     * Log warning message
     */
    warn(category: string, message: string, context?: Record<string, any>, error?: Error): void {
        this.log(LogLevel.WARN, category, message, context, error);
    }

    /**
     * Log info message
     */
    info(category: string, message: string, context?: Record<string, any>, error?: Error): void {
        this.log(LogLevel.INFO, category, message, context, error);
    }

    /**
     * Log debug message
     */
    debug(category: string, message: string, context?: Record<string, any>, error?: Error): void {
        this.log(LogLevel.DEBUG, category, message, context, error);
    }

    /**
     * Log connection attempt
     */
    logConnectionAttempt(url: string, attempt: number, context?: Record<string, any>): void {
        this.info('Connection', `Attempting connection to ${url} (attempt ${attempt})`, {
            url,
            attempt,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log successful connection
     */
    logConnectionSuccess(duration: number, context?: Record<string, any>): void {
        this.info('Connection', `Connection established successfully in ${duration}ms`, {
            duration,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log connection failure
     */
    logConnectionFailure(error: Error, attempt: number, context?: Record<string, any>): void {
        this.error('Connection', `Connection failed on attempt ${attempt}: ${error.message}`, {
            attempt,
            errorType: error.constructor.name,
            timestamp: new Date().toISOString(),
            ...context
        }, error);
    }

    /**
     * Log disconnection
     */
    logDisconnection(reason: string, wasExpected: boolean, context?: Record<string, any>): void {
        const level = wasExpected ? LogLevel.INFO : LogLevel.WARN;
        this.log(level, 'Connection', `Disconnected: ${reason}`, {
            reason,
            wasExpected,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log message sent
     */
    logMessageSent(event: string, data?: any, context?: Record<string, any>): void {
        this.debug('Message', `Sent: ${event}`, {
            event,
            dataSize: data ? JSON.stringify(data).length : 0,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log message received
     */
    logMessageReceived(event: string, data?: any, context?: Record<string, any>): void {
        this.debug('Message', `Received: ${event}`, {
            event,
            dataSize: data ? JSON.stringify(data).length : 0,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log authentication attempt
     */
    logAuthenticationAttempt(context?: Record<string, any>): void {
        this.info('Authentication', 'Attempting authentication', {
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log authentication success
     */
    logAuthenticationSuccess(context?: Record<string, any>): void {
        this.info('Authentication', 'Authentication successful', {
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log authentication failure
     */
    logAuthenticationFailure(error: Error, context?: Record<string, any>): void {
        this.error('Authentication', `Authentication failed: ${error.message}`, {
            errorType: error.constructor.name,
            timestamp: new Date().toISOString(),
            ...context
        }, error);
    }

    /**
     * Log heartbeat activity
     */
    logHeartbeat(type: 'sent' | 'received', latency?: number, context?: Record<string, any>): void {
        this.debug('Heartbeat', `Heartbeat ${type}${latency ? ` (${latency}ms)` : ''}`, {
            type,
            latency,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log reconnection attempt
     */
    logReconnectionAttempt(attempt: number, delay: number, context?: Record<string, any>): void {
        this.info('Reconnection', `Reconnection attempt ${attempt} scheduled in ${delay}ms`, {
            attempt,
            delay,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log fallback mode activation
     */
    logFallbackActivation(reason: string, context?: Record<string, any>): void {
        this.warn('Fallback', `Fallback mode activated: ${reason}`, {
            reason,
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, category: string, message: string, context?: Record<string, any>, error?: Error): void {
        // Check if we should log this level
        if (!this.shouldLog(level)) {
            return;
        }

        const logEntry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            context: {
                ...context,
                ...(this.connectionContext && {
                    connectionId: this.connectionContext.connectionId,
                    sessionId: this.connectionContext.sessionId,
                    userId: this.connectionContext.userId
                })
            },
            error,
            connectionId: this.connectionContext?.connectionId,
            sessionId: this.connectionContext?.sessionId,
            userId: this.connectionContext?.userId
        };

        // Add to internal log storage
        this.addToLogs(logEntry);

        // Output to console with appropriate formatting
        this.outputToConsole(logEntry);
    }

    /**
     * Check if we should log at this level
     */
    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
        const currentIndex = levels.indexOf(this.currentLogLevel);
        const messageIndex = levels.indexOf(level);

        return messageIndex <= currentIndex;
    }

    /**
     * Add log entry to internal storage
     */
    private addToLogs(entry: LogEntry): void {
        this.logs.push(entry);

        // Keep log size manageable
        if (this.logs.length > this.maxLogSize) {
            this.logs.shift();
        }
    }

    /**
     * Output log entry to console with formatting
     */
    private outputToConsole(entry: LogEntry): void {
        const timestamp = entry.timestamp.toISOString();
        const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;
        const message = `${prefix} ${entry.message}`;

        const contextInfo = entry.context && Object.keys(entry.context).length > 0
            ? entry.context
            : undefined;

        switch (entry.level) {
            case LogLevel.ERROR:
                if (entry.error) {
                    console.error(message, contextInfo, entry.error);
                } else {
                    console.error(message, contextInfo);
                }
                break;
            case LogLevel.WARN:
                console.warn(message, contextInfo);
                break;
            case LogLevel.INFO:
                console.info(message, contextInfo);
                break;
            case LogLevel.DEBUG:
                console.debug(message, contextInfo);
                break;
        }
    }

    /**
     * Get all logs
     */
    getLogs(): LogEntry[] {
        return [...this.logs];
    }

    /**
     * Get logs by level
     */
    getLogsByLevel(level: LogLevel): LogEntry[] {
        return this.logs.filter(log => log.level === level);
    }

    /**
     * Get logs by category
     */
    getLogsByCategory(category: string): LogEntry[] {
        return this.logs.filter(log => log.category === category);
    }

    /**
     * Get recent logs (last N entries)
     */
    getRecentLogs(count: number = 50): LogEntry[] {
        return this.logs.slice(-count);
    }

    /**
     * Get logs within time range
     */
    getLogsInTimeRange(startTime: Date, endTime: Date): LogEntry[] {
        return this.logs.filter(log =>
            log.timestamp >= startTime && log.timestamp <= endTime
        );
    }

    /**
     * Clear all logs
     */
    clearLogs(): void {
        this.logs = [];
        this.info('Logger', 'Log history cleared');
    }

    /**
     * Export logs as JSON
     */
    exportLogs(): string {
        return JSON.stringify(this.logs, null, 2);
    }

    /**
     * Add diagnostic collector
     */
    addDiagnosticCollector(name: string, collector: () => any): void {
        this.diagnosticCollectors.set(name, collector);
    }

    /**
     * Remove diagnostic collector
     */
    removeDiagnosticCollector(name: string): void {
        this.diagnosticCollectors.delete(name);
    }

    /**
     * Collect comprehensive diagnostic information
     */
    collectDiagnosticInfo(): DiagnosticInfo {
        const now = new Date();
        const connectionStartTime = this.connectionContext?.startTime || now;
        const uptime = now.getTime() - connectionStartTime.getTime();

        // Count messages
        const messagesSent = this.logs.filter(log =>
            log.category === 'Message' && log.message.startsWith('Sent:')
        ).length;

        const messagesReceived = this.logs.filter(log =>
            log.category === 'Message' && log.message.startsWith('Received:')
        ).length;

        // Get last heartbeat
        const lastHeartbeatLog = this.logs
            .filter(log => log.category === 'Heartbeat')
            .pop();

        const lastHeartbeat = lastHeartbeatLog?.timestamp;

        // Get last error
        const lastErrorLog = this.logs
            .filter(log => log.level === LogLevel.ERROR)
            .pop();

        const lastError = lastErrorLog?.error;

        // Count connection attempts
        const connectionAttempts = this.logs.filter(log =>
            log.category === 'Connection' && log.message.includes('Attempting connection')
        ).length;

        // Get network information if available
        const networkInfo = this.getNetworkInfo();

        // Collect custom diagnostic data
        const customDiagnostics: Record<string, any> = {};
        for (const [name, collector] of this.diagnosticCollectors) {
            try {
                customDiagnostics[name] = collector();
            } catch (error) {
                customDiagnostics[name] = { error: (error as Error).message };
            }
        }

        return {
            timestamp: now,
            connectionState: this.connectionContext ? 'connected' : 'disconnected',
            lastError,
            connectionAttempts,
            uptime,
            messagesSent,
            messagesReceived,
            lastHeartbeat,
            networkInfo,
            browserInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform
            },
            ...customDiagnostics
        };
    }

    /**
     * Setup default diagnostic collectors
     */
    private setupDiagnosticCollectors(): void {
        // Memory usage collector
        this.addDiagnosticCollector('memory', () => {
            if ('memory' in performance) {
                const memory = (performance as any).memory;
                return {
                    usedJSHeapSize: memory.usedJSHeapSize,
                    totalJSHeapSize: memory.totalJSHeapSize,
                    jsHeapSizeLimit: memory.jsHeapSizeLimit
                };
            }
            return null;
        });

        // Connection timing collector
        this.addDiagnosticCollector('timing', () => {
            if (this.connectionContext) {
                const now = Date.now();
                return {
                    connectionAge: now - this.connectionContext.startTime.getTime(),
                    lastActivity: this.connectionContext.lastActivity
                        ? now - this.connectionContext.lastActivity.getTime()
                        : null
                };
            }
            return null;
        });

        // Error statistics collector
        this.addDiagnosticCollector('errorStats', () => {
            const errors = this.getLogsByLevel(LogLevel.ERROR);
            const warnings = this.getLogsByLevel(LogLevel.WARN);

            return {
                totalErrors: errors.length,
                totalWarnings: warnings.length,
                recentErrors: errors.filter(log =>
                    Date.now() - log.timestamp.getTime() < 300000 // Last 5 minutes
                ).length
            };
        });
    }

    /**
     * Get network information if available
     */
    private getNetworkInfo(): DiagnosticInfo['networkInfo'] {
        if ('navigator' in window && 'onLine' in navigator) {
            const networkInfo: DiagnosticInfo['networkInfo'] = {
                online: navigator.onLine
            };

            // Add connection info if available
            if ('connection' in navigator) {
                const connection = (navigator as any).connection;
                if (connection) {
                    networkInfo.effectiveType = connection.effectiveType;
                    networkInfo.downlink = connection.downlink;
                    networkInfo.rtt = connection.rtt;
                }
            }

            return networkInfo;
        }

        return undefined;
    }
}

// Export singleton instance
export const websocketLogger = new WebSocketLogger();

// Configure log level from environment
const envLogLevel = import.meta.env.VITE_WS_LOG_LEVEL as LogLevel;
if (envLogLevel && Object.values(LogLevel).includes(envLogLevel)) {
    websocketLogger.setLogLevel(envLogLevel);
}