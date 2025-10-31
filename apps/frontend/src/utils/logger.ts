type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: Record<string, any>;
}

class Logger {
    private isDevelopment = import.meta.env.DEV;

    private log(level: LogLevel, message: string, context?: Record<string, any>) {
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            context
        };

        // In development, log to console
        if (this.isDevelopment) {
            const contextStr = context ? ` ${JSON.stringify(context)}` : '';
            const logMessage = `[${entry.timestamp.toISOString()}] ${level.toUpperCase()}: ${message}${contextStr}`;

            switch (level) {
                case 'debug':
                    console.debug(logMessage);
                    break;
                case 'info':
                    console.info(logMessage);
                    break;
                case 'warn':
                    console.warn(logMessage);
                    break;
                case 'error':
                    console.error(logMessage);
                    break;
            }
        }

        // In production, you might want to send logs to a service
        // This is a placeholder for production logging
        if (!this.isDevelopment && level === 'error') {
            // Send to error tracking service
            this.sendToErrorService(entry);
        }
    }

    private sendToErrorService(_entry: LogEntry) {
        // Placeholder for error tracking service integration
        // e.g., Sentry, LogRocket, etc.
        // The _entry parameter will be used when implementing actual error service
    }

    debug(message: string, context?: Record<string, any>) {
        this.log('debug', message, context);
    }

    info(message: string, context?: Record<string, any>) {
        this.log('info', message, context);
    }

    warn(message: string, context?: Record<string, any>) {
        this.log('warn', message, context);
    }

    error(message: string, context?: Record<string, any>) {
        this.log('error', message, context);
    }
}

export const logger = new Logger();
export default logger;