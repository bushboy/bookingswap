import { Request, Response, NextFunction } from 'express';
import { enhancedLogger } from './logger';
import { SwapPlatformError } from '@booking-swap/shared';

/**
 * Performance monitoring middleware
 */
export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    enhancedLogger.logApiRequest(
      req.method,
      req.path,
      res.statusCode,
      responseTime,
      req.user?.id,
      req.requestId
    );

    // Log slow requests
    if (responseTime > 1000) {
      enhancedLogger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        responseTime,
        userId: req.user?.id,
        requestId: req.requestId,
      });
    }

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

/**
 * Health check metrics
 */
export interface HealthMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    cache: ServiceHealth;
    blockchain: ServiceHealth;
  };
  metrics: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
    activeConnections: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: string;
  error?: string;
}

/**
 * Health monitoring service
 */
export class HealthMonitor {
  private static instance: HealthMonitor;
  private healthChecks: Map<string, () => Promise<ServiceHealth>> = new Map();
  private lastHealthCheck: HealthMetrics | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startHealthChecking();
  }

  public static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Register a health check for a service
   */
  registerHealthCheck(serviceName: string, checkFn: () => Promise<ServiceHealth>) {
    this.healthChecks.set(serviceName, checkFn);
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<HealthMetrics> {
    const startTime = Date.now();
    
    try {
      const services: Record<string, ServiceHealth> = {};
      
      // Run all health checks
      for (const [serviceName, checkFn] of this.healthChecks) {
        try {
          services[serviceName] = await checkFn();
        } catch (error) {
          services[serviceName] = {
            status: 'unhealthy',
            lastCheck: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      // Determine overall status
      const serviceStatuses = Object.values(services).map(s => s.status);
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      
      if (serviceStatuses.includes('unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (serviceStatuses.includes('degraded')) {
        overallStatus = 'degraded';
      }

      const healthMetrics: HealthMetrics = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: services as any,
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: 0, // This would be populated by connection tracking
        },
      };

      this.lastHealthCheck = healthMetrics;
      
      // Log health status changes
      if (overallStatus !== 'healthy') {
        enhancedLogger.warn('System health degraded', {
          status: overallStatus,
          services: Object.entries(services)
            .filter(([, health]) => health.status !== 'healthy')
            .map(([name, health]) => ({ name, status: health.status, error: health.error })),
        });
      }

      return healthMetrics;
    } catch (error) {
      enhancedLogger.error('Health check failed', { error: error.message });
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: {} as any,
        metrics: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: 0,
        },
      };
    }
  }

  /**
   * Start periodic health checking
   */
  private startHealthChecking() {
    const interval = parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'); // 30 seconds
    
    this.healthCheckInterval = setInterval(async () => {
      await this.getHealthStatus();
    }, interval);
  }

  /**
   * Stop health checking
   */
  stopHealthChecking() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get cached health status
   */
  getCachedHealthStatus(): HealthMetrics | null {
    return this.lastHealthCheck;
  }
}

/**
 * Error rate monitoring
 */
export class ErrorRateMonitor {
  private static instance: ErrorRateMonitor;
  private errorCounts: Map<string, number> = new Map();
  private requestCounts: Map<string, number> = new Map();
  private windowStart: number = Date.now();
  private readonly windowSize: number = 60000; // 1 minute

  private constructor() {
    this.startWindowReset();
  }

  public static getInstance(): ErrorRateMonitor {
    if (!ErrorRateMonitor.instance) {
      ErrorRateMonitor.instance = new ErrorRateMonitor();
    }
    return ErrorRateMonitor.instance;
  }

  /**
   * Record a request
   */
  recordRequest(endpoint: string) {
    const current = this.requestCounts.get(endpoint) || 0;
    this.requestCounts.set(endpoint, current + 1);
  }

  /**
   * Record an error
   */
  recordError(endpoint: string, error: SwapPlatformError) {
    const current = this.errorCounts.get(endpoint) || 0;
    this.errorCounts.set(endpoint, current + 1);

    // Log high error rates
    const errorRate = this.getErrorRate(endpoint);
    if (errorRate > 0.1) { // 10% error rate threshold
      enhancedLogger.warn('High error rate detected', {
        endpoint,
        errorRate,
        errorCount: current + 1,
        requestCount: this.requestCounts.get(endpoint) || 0,
        errorCode: error.code,
        errorCategory: error.category,
      });
    }
  }

  /**
   * Get error rate for an endpoint
   */
  getErrorRate(endpoint: string): number {
    const errors = this.errorCounts.get(endpoint) || 0;
    const requests = this.requestCounts.get(endpoint) || 0;
    
    return requests > 0 ? errors / requests : 0;
  }

  /**
   * Get all error rates
   */
  getAllErrorRates(): Record<string, { errorRate: number; errors: number; requests: number }> {
    const result: Record<string, { errorRate: number; errors: number; requests: number }> = {};
    
    for (const [endpoint] of this.requestCounts) {
      const errors = this.errorCounts.get(endpoint) || 0;
      const requests = this.requestCounts.get(endpoint) || 0;
      
      result[endpoint] = {
        errorRate: this.getErrorRate(endpoint),
        errors,
        requests,
      };
    }
    
    return result;
  }

  /**
   * Reset counters every window
   */
  private startWindowReset() {
    setInterval(() => {
      this.errorCounts.clear();
      this.requestCounts.clear();
      this.windowStart = Date.now();
    }, this.windowSize);
  }
}

/**
 * Middleware to track error rates
 */
export function errorRateTracking(req: Request, res: Response, next: NextFunction) {
  const monitor = ErrorRateMonitor.getInstance();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  monitor.recordRequest(endpoint);
  
  // Override error handling to track errors
  const originalNext = next;
  next = (error?: any) => {
    if (error && error instanceof SwapPlatformError) {
      monitor.recordError(endpoint, error);
    }
    originalNext(error);
  };
  
  next();
}

/**
 * Circuit breaker pattern for external services
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly monitoringWindow: number = 60000 // 1 minute
  ) {}

  async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        if (fallback) {
          enhancedLogger.warn('Circuit breaker open, using fallback');
          return fallback();
        }
        throw new SwapPlatformError(
          'CIRCUIT_BREAKER_OPEN',
          'Service temporarily unavailable',
          'integration',
          true
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    this.state = 'closed';
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
      enhancedLogger.warn('Circuit breaker opened', {
        failures: this.failures,
        threshold: this.threshold,
      });
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}