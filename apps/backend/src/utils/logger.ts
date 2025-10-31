import winston from 'winston';
import { SwapPlatformError } from '@booking-swap/shared';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service, ...meta } = info;
    
    const logEntry = {
      timestamp,
      level,
      message,
      service,
      environment: nodeEnv,
      ...meta,
    };

    return JSON.stringify(logEntry);
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: logLevel,
  defaultMeta: { 
    service: 'booking-swap-backend',
    version: process.env.npm_package_version || '1.0.0',
  },
  transports: [],
});

// Add transports based on environment
if (nodeEnv === 'production') {
  // Production: structured JSON logging
  logger.add(new winston.transports.Console({
    format: structuredFormat,
  }));
  
  // Add file transport for production (only if logs directory exists)
  try {
    const fs = require('fs');
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true });
    }
    
    logger.add(new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
    
    logger.add(new winston.transports.File({
      filename: 'logs/combined.log',
      format: structuredFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }));
  } catch (error) {
    // Fallback to console only if file logging fails
    console.warn('Failed to setup file logging:', error.message);
  }
} else {
  // Development: human-readable console logging
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

/**
 * Enhanced logging methods with context
 */
export class Logger {
  private static instance: Logger;
  private winston: winston.Logger;

  private constructor() {
    this.winston = logger;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Log blockchain transaction events
   */
  logBlockchainTransaction(
    operation: string,
    transactionId: string,
    status: 'pending' | 'success' | 'failed',
    metadata?: Record<string, any>
  ) {
    this.winston.info('Blockchain transaction', {
      category: 'blockchain',
      operation,
      transactionId,
      status,
      ...metadata,
    });
  }

  /**
   * Log API requests with performance metrics
   */
  logApiRequest(
    method: string,
    path: string,
    statusCode: number,
    responseTime: number,
    userId?: string,
    requestId?: string
  ) {
    this.winston.info('API request', {
      category: 'api',
      method,
      path,
      statusCode,
      responseTime,
      userId,
      requestId,
    });
  }

  /**
   * Log business events
   */
  logBusinessEvent(
    event: string,
    entityType: string,
    entityId: string,
    userId?: string,
    metadata?: Record<string, any>
  ) {
    this.winston.info('Business event', {
      category: 'business',
      event,
      entityType,
      entityId,
      userId,
      ...metadata,
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    ip?: string,
    metadata?: Record<string, any>
  ) {
    this.winston.warn('Security event', {
      category: 'security',
      event,
      severity,
      userId,
      ip,
      ...metadata,
    });
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ) {
    this.winston.info('Performance metric', {
      category: 'performance',
      operation,
      duration,
      success,
      ...metadata,
    });
  }

  /**
   * Log error with enhanced context
   */
  logError(
    error: Error | SwapPlatformError,
    context?: {
      operation?: string;
      userId?: string;
      requestId?: string;
      metadata?: Record<string, any>;
    }
  ) {
    const errorInfo = {
      category: 'error',
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error instanceof SwapPlatformError && {
        code: error.code,
        errorCategory: error.category,
        retryable: error.retryable,
        context: error.context,
      }),
      ...context,
    };

    this.winston.error('Error occurred', errorInfo);
  }

  // Proxy methods to winston logger
  info(message: string, meta?: any) {
    this.winston.info(message, meta);
  }

  warn(message: string, meta?: any) {
    this.winston.warn(message, meta);
  }

  error(message: string, meta?: any) {
    this.winston.error(message, meta);
  }

  debug(message: string, meta?: any) {
    this.winston.debug(message, meta);
  }
}

// Export singleton instance
export const enhancedLogger = Logger.getInstance();