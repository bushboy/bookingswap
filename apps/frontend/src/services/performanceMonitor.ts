/**
 * Performance metric data structure
 */
interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
  success?: boolean;
  error?: string;
}

/**
 * Performance statistics for a specific operation
 */
interface PerformanceStats {
  name: string;
  count: number;
  totalDuration: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  lastExecuted: number;
  recentMetrics: PerformanceMetric[];
}

/**
 * Configuration for performance monitoring
 */
interface PerformanceMonitorConfig {
  maxMetricsPerOperation: number;
  enableConsoleLogging: boolean;
  slowOperationThreshold: number; // milliseconds
  enableDetailedLogging: boolean;
}

/**
 * Performance monitoring service for API calls and operations
 * Tracks timing, success rates, and provides performance insights
 */
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>();
  private activeTimers = new Map<string, number>();
  private config: PerformanceMonitorConfig;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = {
      maxMetricsPerOperation: 50,
      enableConsoleLogging: false,
      slowOperationThreshold: 2000, // 2 seconds
      enableDetailedLogging: false,
      ...config,
    };
  }

  /**
   * Start timing an operation
   */
  startTimer(operationName: string, metadata?: Record<string, any>): string {
    const timerId = `${operationName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const startTime = performance.now();
    
    this.activeTimers.set(timerId, startTime);
    
    if (this.config.enableDetailedLogging) {
      console.log(`[PerformanceMonitor] Started: ${operationName}`, metadata);
    }
    
    return timerId;
  }

  /**
   * End timing an operation and record the metric
   */
  endTimer(timerId: string, operationName: string, success = true, error?: string, metadata?: Record<string, any>): PerformanceMetric | null {
    const startTime = this.activeTimers.get(timerId);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] Timer not found: ${timerId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.activeTimers.delete(timerId);

    const metric: PerformanceMetric = {
      name: operationName,
      startTime,
      endTime,
      duration,
      success,
      error,
      metadata,
    };

    this.recordMetric(metric);
    
    if (this.config.enableConsoleLogging) {
      const status = success ? 'SUCCESS' : 'ERROR';
      const durationFormatted = duration.toFixed(2);
      console.log(`[PerformanceMonitor] ${status}: ${operationName} (${durationFormatted}ms)`, metadata);
      
      if (duration > this.config.slowOperationThreshold) {
        console.warn(`[PerformanceMonitor] SLOW OPERATION: ${operationName} took ${durationFormatted}ms`);
      }
    }

    return metric;
  }

  /**
   * Record a metric directly (for operations that don't use start/end pattern)
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const operationMetrics = this.metrics.get(metric.name)!;
    operationMetrics.push(metric);

    // Keep only the most recent metrics to prevent memory leaks
    if (operationMetrics.length > this.config.maxMetricsPerOperation) {
      operationMetrics.shift();
    }
  }

  /**
   * Get performance statistics for a specific operation
   */
  getStats(operationName: string): PerformanceStats | null {
    const operationMetrics = this.metrics.get(operationName);
    if (!operationMetrics || operationMetrics.length === 0) {
      return null;
    }

    const durations = operationMetrics
      .filter(m => m.duration !== undefined)
      .map(m => m.duration!);
    
    const successfulOperations = operationMetrics.filter(m => m.success !== false);
    
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = durations.length > 0 ? totalDuration / durations.length : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const successRate = operationMetrics.length > 0 ? (successfulOperations.length / operationMetrics.length) * 100 : 0;
    const lastExecuted = Math.max(...operationMetrics.map(m => m.startTime));

    return {
      name: operationName,
      count: operationMetrics.length,
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      successRate,
      lastExecuted,
      recentMetrics: [...operationMetrics].slice(-10), // Last 10 metrics
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): PerformanceStats[] {
    return Array.from(this.metrics.keys())
      .map(name => this.getStats(name))
      .filter((stats): stats is PerformanceStats => stats !== null)
      .sort((a, b) => b.lastExecuted - a.lastExecuted);
  }

  /**
   * Get slow operations (above threshold)
   */
  getSlowOperations(): PerformanceStats[] {
    return this.getAllStats().filter(stats => 
      stats.averageDuration > this.config.slowOperationThreshold
    );
  }

  /**
   * Get operations with low success rates
   */
  getUnreliableOperations(threshold = 90): PerformanceStats[] {
    return this.getAllStats().filter(stats => 
      stats.successRate < threshold && stats.count >= 5
    );
  }

  /**
   * Clear metrics for a specific operation
   */
  clearMetrics(operationName: string): void {
    this.metrics.delete(operationName);
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.activeTimers.clear();
  }

  /**
   * Get a summary report of performance metrics
   */
  getPerformanceReport(): {
    totalOperations: number;
    uniqueOperations: number;
    slowOperations: PerformanceStats[];
    unreliableOperations: PerformanceStats[];
    topOperationsByFrequency: PerformanceStats[];
    averageResponseTime: number;
  } {
    const allStats = this.getAllStats();
    const slowOperations = this.getSlowOperations();
    const unreliableOperations = this.getUnreliableOperations();
    
    const totalOperations = allStats.reduce((sum, stats) => sum + stats.count, 0);
    const totalDuration = allStats.reduce((sum, stats) => sum + stats.totalDuration, 0);
    const averageResponseTime = totalOperations > 0 ? totalDuration / totalOperations : 0;
    
    const topOperationsByFrequency = [...allStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalOperations,
      uniqueOperations: allStats.length,
      slowOperations,
      unreliableOperations,
      topOperationsByFrequency,
      averageResponseTime,
    };
  }

  /**
   * Enable or disable console logging
   */
  setConsoleLogging(enabled: boolean): void {
    this.config.enableConsoleLogging = enabled;
  }

  /**
   * Set slow operation threshold
   */
  setSlowOperationThreshold(threshold: number): void {
    this.config.slowOperationThreshold = threshold;
  }

  /**
   * Measure an async operation
   */
  async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(operationName, metadata);
    
    try {
      const result = await operation();
      this.endTimer(timerId, operationName, true, undefined, metadata);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.endTimer(timerId, operationName, false, errorMessage, metadata);
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(
    operationName: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    const timerId = this.startTimer(operationName, metadata);
    
    try {
      const result = operation();
      this.endTimer(timerId, operationName, true, undefined, metadata);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.endTimer(timerId, operationName, false, errorMessage, metadata);
      throw error;
    }
  }
}

/**
 * Specialized performance monitor for API operations
 */
export class ApiPerformanceMonitor extends PerformanceMonitor {
  constructor() {
    super({
      maxMetricsPerOperation: 100,
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      slowOperationThreshold: 3000, // 3 seconds for API calls
      enableDetailedLogging: process.env.NODE_ENV === 'development',
    });
  }

  /**
   * Measure an API call with additional metadata
   */
  async measureApiCall<T>(
    endpoint: string,
    method: string,
    operation: () => Promise<T>,
    additionalMetadata?: Record<string, any>
  ): Promise<T> {
    const operationName = `API_${method.toUpperCase()}_${endpoint}`;
    const metadata = {
      endpoint,
      method: method.toUpperCase(),
      ...additionalMetadata,
    };

    return this.measureAsync(operationName, operation, metadata);
  }

  /**
   * Get API-specific performance insights
   */
  getApiInsights(): {
    slowestEndpoints: PerformanceStats[];
    mostFrequentEndpoints: PerformanceStats[];
    errorProneEndpoints: PerformanceStats[];
    averageApiResponseTime: number;
  } {
    const apiStats = this.getAllStats().filter(stats => 
      stats.name.startsWith('API_')
    );

    const slowestEndpoints = [...apiStats]
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    const mostFrequentEndpoints = [...apiStats]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const errorProneEndpoints = [...apiStats]
      .filter(stats => stats.successRate < 95 && stats.count >= 3)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 5);

    const totalApiDuration = apiStats.reduce((sum, stats) => sum + stats.totalDuration, 0);
    const totalApiCalls = apiStats.reduce((sum, stats) => sum + stats.count, 0);
    const averageApiResponseTime = totalApiCalls > 0 ? totalApiDuration / totalApiCalls : 0;

    return {
      slowestEndpoints,
      mostFrequentEndpoints,
      errorProneEndpoints,
      averageApiResponseTime,
    };
  }
}

// Export singleton instances
export const performanceMonitor = new PerformanceMonitor();
export const apiPerformanceMonitor = new ApiPerformanceMonitor();