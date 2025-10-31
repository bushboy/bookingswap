import { PerformanceMonitor, ApiPerformanceMonitor } from '../performanceMonitor';

// Mock performance.now()
const mockPerformanceNow = jest.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
  },
});

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let currentTime = 0;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      maxMetricsPerOperation: 5,
      enableConsoleLogging: false,
      slowOperationThreshold: 1000,
    });
    
    currentTime = 0;
    mockPerformanceNow.mockImplementation(() => currentTime);
  });

  describe('Timer Operations', () => {
    it('should start and end timers correctly', () => {
      const timerId = monitor.startTimer('test-operation');
      expect(timerId).toMatch(/^test-operation_\d+_\w+$/);
      
      currentTime = 500; // Simulate 500ms elapsed
      const metric = monitor.endTimer(timerId, 'test-operation', true);
      
      expect(metric).not.toBeNull();
      expect(metric!.name).toBe('test-operation');
      expect(metric!.duration).toBe(500);
      expect(metric!.success).toBe(true);
    });

    it('should handle missing timers gracefully', () => {
      const metric = monitor.endTimer('nonexistent-timer', 'test-operation');
      expect(metric).toBeNull();
    });

    it('should record metadata with metrics', () => {
      const metadata = { userId: 'user-123', endpoint: '/api/test' };
      const timerId = monitor.startTimer('test-operation', metadata);
      
      currentTime = 300;
      const metric = monitor.endTimer(timerId, 'test-operation', true, undefined, metadata);
      
      expect(metric!.metadata).toEqual(metadata);
    });

    it('should record errors with metrics', () => {
      const timerId = monitor.startTimer('test-operation');
      
      currentTime = 200;
      const metric = monitor.endTimer(timerId, 'test-operation', false, 'Network error');
      
      expect(metric!.success).toBe(false);
      expect(metric!.error).toBe('Network error');
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      // Add some test metrics
      monitor.recordMetric({
        name: 'operation-1',
        startTime: 0,
        endTime: 100,
        duration: 100,
        success: true,
      });
      
      monitor.recordMetric({
        name: 'operation-1',
        startTime: 200,
        endTime: 500,
        duration: 300,
        success: true,
      });
      
      monitor.recordMetric({
        name: 'operation-1',
        startTime: 600,
        endTime: 800,
        duration: 200,
        success: false,
        error: 'Test error',
      });
    });

    it('should calculate correct statistics', () => {
      const stats = monitor.getStats('operation-1');
      
      expect(stats).not.toBeNull();
      expect(stats!.name).toBe('operation-1');
      expect(stats!.count).toBe(3);
      expect(stats!.totalDuration).toBe(600);
      expect(stats!.averageDuration).toBe(200);
      expect(stats!.minDuration).toBe(100);
      expect(stats!.maxDuration).toBe(300);
      expect(stats!.successRate).toBe(66.67); // 2/3 * 100, rounded
    });

    it('should return null for non-existent operations', () => {
      const stats = monitor.getStats('nonexistent-operation');
      expect(stats).toBeNull();
    });

    it('should return all statistics', () => {
      monitor.recordMetric({
        name: 'operation-2',
        startTime: 0,
        endTime: 150,
        duration: 150,
        success: true,
      });

      const allStats = monitor.getAllStats();
      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.name)).toContain('operation-1');
      expect(allStats.map(s => s.name)).toContain('operation-2');
    });
  });

  describe('Slow Operations Detection', () => {
    it('should identify slow operations', () => {
      monitor.recordMetric({
        name: 'slow-operation',
        startTime: 0,
        endTime: 1500,
        duration: 1500, // Above 1000ms threshold
        success: true,
      });

      monitor.recordMetric({
        name: 'fast-operation',
        startTime: 0,
        endTime: 500,
        duration: 500, // Below threshold
        success: true,
      });

      const slowOps = monitor.getSlowOperations();
      expect(slowOps).toHaveLength(1);
      expect(slowOps[0].name).toBe('slow-operation');
    });
  });

  describe('Unreliable Operations Detection', () => {
    it('should identify unreliable operations', () => {
      // Add multiple failed operations
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          name: 'unreliable-operation',
          startTime: i * 100,
          endTime: (i + 1) * 100,
          duration: 100,
          success: i < 8, // 80% success rate
        });
      }

      const unreliableOps = monitor.getUnreliableOperations(90); // 90% threshold
      expect(unreliableOps).toHaveLength(1);
      expect(unreliableOps[0].name).toBe('unreliable-operation');
      expect(unreliableOps[0].successRate).toBe(80);
    });
  });

  describe('Async Measurement', () => {
    it('should measure async operations successfully', async () => {
      const asyncOperation = jest.fn().mockResolvedValue('success');
      
      currentTime = 0;
      const resultPromise = monitor.measureAsync('async-test', asyncOperation, { test: true });
      
      currentTime = 250;
      const result = await resultPromise;
      
      expect(result).toBe('success');
      expect(asyncOperation).toHaveBeenCalled();
      
      const stats = monitor.getStats('async-test');
      expect(stats!.count).toBe(1);
      expect(stats!.averageDuration).toBe(250);
      expect(stats!.successRate).toBe(100);
    });

    it('should measure async operations with errors', async () => {
      const asyncOperation = jest.fn().mockRejectedValue(new Error('Async error'));
      
      currentTime = 0;
      await expect(monitor.measureAsync('async-error-test', asyncOperation)).rejects.toThrow('Async error');
      
      const stats = monitor.getStats('async-error-test');
      expect(stats!.count).toBe(1);
      expect(stats!.successRate).toBe(0);
    });
  });

  describe('Sync Measurement', () => {
    it('should measure sync operations successfully', () => {
      const syncOperation = jest.fn().mockReturnValue('sync-result');
      
      currentTime = 0;
      const result = monitor.measureSync('sync-test', syncOperation, { test: true });
      currentTime = 150;
      
      expect(result).toBe('sync-result');
      expect(syncOperation).toHaveBeenCalled();
    });

    it('should measure sync operations with errors', () => {
      const syncOperation = jest.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      
      expect(() => monitor.measureSync('sync-error-test', syncOperation)).toThrow('Sync error');
      
      const stats = monitor.getStats('sync-error-test');
      expect(stats!.count).toBe(1);
      expect(stats!.successRate).toBe(0);
    });
  });

  describe('Performance Report', () => {
    beforeEach(() => {
      // Add various operations for comprehensive report
      monitor.recordMetric({
        name: 'frequent-op',
        startTime: 0,
        endTime: 100,
        duration: 100,
        success: true,
      });
      
      monitor.recordMetric({
        name: 'frequent-op',
        startTime: 200,
        endTime: 300,
        duration: 100,
        success: true,
      });
      
      monitor.recordMetric({
        name: 'slow-op',
        startTime: 0,
        endTime: 1500,
        duration: 1500,
        success: true,
      });
    });

    it('should generate comprehensive performance report', () => {
      const report = monitor.getPerformanceReport();
      
      expect(report.totalOperations).toBe(3);
      expect(report.uniqueOperations).toBe(2);
      expect(report.averageResponseTime).toBe(566.67); // (100 + 100 + 1500) / 3, rounded
      expect(report.topOperationsByFrequency[0].name).toBe('frequent-op');
      expect(report.slowOperations).toHaveLength(1);
    });
  });

  describe('Memory Management', () => {
    it('should limit metrics per operation', () => {
      // Add more metrics than the limit
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric({
          name: 'limited-operation',
          startTime: i * 100,
          endTime: (i + 1) * 100,
          duration: 100,
          success: true,
        });
      }

      const stats = monitor.getStats('limited-operation');
      expect(stats!.count).toBe(5); // Should be limited to maxMetricsPerOperation
    });
  });
});

describe('ApiPerformanceMonitor', () => {
  let apiMonitor: ApiPerformanceMonitor;
  let currentTime = 0;

  beforeEach(() => {
    apiMonitor = new ApiPerformanceMonitor();
    currentTime = 0;
    mockPerformanceNow.mockImplementation(() => currentTime);
  });

  describe('API Call Measurement', () => {
    it('should measure API calls with proper naming', async () => {
      const apiCall = jest.fn().mockResolvedValue({ data: 'test' });
      
      currentTime = 0;
      const result = await apiMonitor.measureApiCall('/users/123', 'GET', apiCall, { userId: '123' });
      currentTime = 300;
      
      expect(result).toEqual({ data: 'test' });
      
      const stats = apiMonitor.getStats('API_GET_/users/123');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
    });

    it('should include API-specific metadata', async () => {
      const apiCall = jest.fn().mockResolvedValue({ data: 'test' });
      
      await apiMonitor.measureApiCall('/swaps/456', 'POST', apiCall, { swapId: '456' });
      
      const stats = apiMonitor.getStats('API_POST_/swaps/456');
      expect(stats!.recentMetrics[0].metadata).toEqual({
        endpoint: '/swaps/456',
        method: 'POST',
        swapId: '456',
      });
    });
  });

  describe('API Insights', () => {
    beforeEach(() => {
      // Add various API metrics
      apiMonitor.recordMetric({
        name: 'API_GET_/users/123',
        startTime: 0,
        endTime: 200,
        duration: 200,
        success: true,
      });
      
      apiMonitor.recordMetric({
        name: 'API_GET_/users/123',
        startTime: 300,
        endTime: 500,
        duration: 200,
        success: true,
      });
      
      apiMonitor.recordMetric({
        name: 'API_POST_/swaps/456',
        startTime: 0,
        endTime: 2000,
        duration: 2000,
        success: true,
      });
      
      apiMonitor.recordMetric({
        name: 'API_GET_/error-prone',
        startTime: 0,
        endTime: 100,
        duration: 100,
        success: false,
      });
    });

    it('should provide API-specific insights', () => {
      const insights = apiMonitor.getApiInsights();
      
      expect(insights.slowestEndpoints[0].name).toBe('API_POST_/swaps/456');
      expect(insights.mostFrequentEndpoints[0].name).toBe('API_GET_/users/123');
      expect(insights.errorProneEndpoints[0].name).toBe('API_GET_/error-prone');
      expect(insights.averageApiResponseTime).toBe(625); // (200 + 200 + 2000 + 100) / 4
    });

    it('should filter out non-API operations from insights', () => {
      // Add non-API operation
      apiMonitor.recordMetric({
        name: 'non-api-operation',
        startTime: 0,
        endTime: 100,
        duration: 100,
        success: true,
      });

      const insights = apiMonitor.getApiInsights();
      const allEndpoints = [
        ...insights.slowestEndpoints,
        ...insights.mostFrequentEndpoints,
        ...insights.errorProneEndpoints,
      ];
      
      expect(allEndpoints.every(endpoint => endpoint.name.startsWith('API_'))).toBe(true);
    });
  });
});