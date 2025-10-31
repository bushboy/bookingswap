import { Request, Response, NextFunction } from 'express';
import { 
  performanceMonitoring, 
  errorRateTracking, 
  HealthMonitor, 
  ErrorRateMonitor, 
  CircuitBreaker 
} from '../monitoring';
import { SwapPlatformError, ERROR_CODES } from '@booking-swap/shared';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock logger
vi.mock('../logger', () => ({
  enhancedLogger: {
    logApiRequest: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Monitoring Utilities', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      method: 'GET',
      path: '/test',
      user: { id: 'user-123' },
      requestId: 'request-123',
      route: { path: '/test' },
    };

    mockResponse = {
      statusCode: 200,
      end: vi.fn(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  describe('performanceMonitoring', () => {
    it('should log API requests with response time', (done) => {
      const originalEnd = mockResponse.end;
      
      performanceMonitoring(mockRequest as Request, mockResponse as Response, mockNext);

      // Simulate response end after some time
      setTimeout(() => {
        mockResponse.end!();
        
        expect(enhancedLogger.logApiRequest).toHaveBeenCalledWith(
          'GET',
          '/test',
          200,
          expect.any(Number),
          'user-123',
          'request-123'
        );
        done();
      }, 10);
    });

    it('should warn about slow requests', (done) => {
      performanceMonitoring(mockRequest as Request, mockResponse as Response, mockNext);

      // Mock a slow response
      setTimeout(() => {
        mockResponse.end!();
        
        expect(enhancedLogger.warn).toHaveBeenCalledWith(
          'Slow request detected',
          expect.objectContaining({
            method: 'GET',
            path: '/test',
            responseTime: expect.any(Number),
          })
        );
        done();
      }, 1100); // Over 1 second threshold
    });
  });

  describe('HealthMonitor', () => {
    let healthMonitor: HealthMonitor;

    beforeEach(() => {
      healthMonitor = HealthMonitor.getInstance();
    });

    afterEach(() => {
      healthMonitor.stopHealthChecking();
    });

    it('should register and execute health checks', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        status: 'healthy',
        responseTime: 50,
        lastCheck: new Date().toISOString(),
      });

      healthMonitor.registerHealthCheck('test-service', mockHealthCheck);
      const healthStatus = await healthMonitor.getHealthStatus();

      expect(mockHealthCheck).toHaveBeenCalled();
      expect(healthStatus.services['test-service']).toEqual({
        status: 'healthy',
        responseTime: 50,
        lastCheck: expect.any(String),
      });
      expect(healthStatus.status).toBe('healthy');
    });

    it('should handle health check failures', async () => {
      const mockHealthCheck = vi.fn().mockRejectedValue(new Error('Service down'));

      healthMonitor.registerHealthCheck('failing-service', mockHealthCheck);
      const healthStatus = await healthMonitor.getHealthStatus();

      expect(healthStatus.services['failing-service']).toEqual({
        status: 'unhealthy',
        lastCheck: expect.any(String),
        error: 'Service down',
      });
      expect(healthStatus.status).toBe('unhealthy');
    });

    it('should determine overall status based on service health', async () => {
      const healthyCheck = vi.fn().mockResolvedValue({
        status: 'healthy',
        lastCheck: new Date().toISOString(),
      });
      
      const degradedCheck = vi.fn().mockResolvedValue({
        status: 'degraded',
        lastCheck: new Date().toISOString(),
      });

      healthMonitor.registerHealthCheck('healthy-service', healthyCheck);
      healthMonitor.registerHealthCheck('degraded-service', degradedCheck);
      
      const healthStatus = await healthMonitor.getHealthStatus();
      expect(healthStatus.status).toBe('degraded');
    });
  });

  describe('ErrorRateMonitor', () => {
    let errorRateMonitor: ErrorRateMonitor;

    beforeEach(() => {
      errorRateMonitor = ErrorRateMonitor.getInstance();
    });

    it('should track request and error counts', () => {
      const endpoint = 'GET /test';
      
      errorRateMonitor.recordRequest(endpoint);
      errorRateMonitor.recordRequest(endpoint);
      
      const error = new SwapPlatformError(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error',
        'validation'
      );
      errorRateMonitor.recordError(endpoint, error);

      const errorRate = errorRateMonitor.getErrorRate(endpoint);
      expect(errorRate).toBe(0.5); // 1 error out of 2 requests
    });

    it('should warn about high error rates', () => {
      const endpoint = 'GET /test';
      const error = new SwapPlatformError(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error',
        'validation'
      );

      // Record requests and errors to exceed threshold
      for (let i = 0; i < 10; i++) {
        errorRateMonitor.recordRequest(endpoint);
        if (i < 2) { // 20% error rate
          errorRateMonitor.recordError(endpoint, error);
        }
      }

      expect(enhancedLogger.warn).toHaveBeenCalledWith(
        'High error rate detected',
        expect.objectContaining({
          endpoint,
          errorRate: expect.any(Number),
        })
      );
    });

    it('should return all error rates', () => {
      const endpoint1 = 'GET /test1';
      const endpoint2 = 'GET /test2';
      const error = new SwapPlatformError(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error',
        'validation'
      );

      errorRateMonitor.recordRequest(endpoint1);
      errorRateMonitor.recordError(endpoint1, error);
      
      errorRateMonitor.recordRequest(endpoint2);
      errorRateMonitor.recordRequest(endpoint2);

      const allRates = errorRateMonitor.getAllErrorRates();
      
      expect(allRates[endpoint1]).toEqual({
        errorRate: 1,
        errors: 1,
        requests: 1,
      });
      
      expect(allRates[endpoint2]).toEqual({
        errorRate: 0,
        errors: 0,
        requests: 2,
      });
    });
  });

  describe('errorRateTracking middleware', () => {
    it('should track requests and errors', () => {
      const errorRateMonitor = ErrorRateMonitor.getInstance();
      const recordRequestSpy = vi.spyOn(errorRateMonitor, 'recordRequest');
      const recordErrorSpy = vi.spyOn(errorRateMonitor, 'recordError');

      errorRateTracking(mockRequest as Request, mockResponse as Response, mockNext);

      expect(recordRequestSpy).toHaveBeenCalledWith('GET /test');
      expect(mockNext).toHaveBeenCalled();

      // Simulate error
      const error = new SwapPlatformError(
        ERROR_CODES.VALIDATION_ERROR,
        'Test error',
        'validation'
      );
      
      const nextFunction = mockNext.mock.calls[0][0];
      if (typeof nextFunction === 'function') {
        nextFunction(error);
        expect(recordErrorSpy).toHaveBeenCalledWith('GET /test', error);
      }
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(2, 1000); // 2 failures, 1 second timeout
    });

    it('should execute operation successfully when circuit is closed', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalled();
      expect(circuitBreaker.getState().state).toBe('closed');
    });

    it('should open circuit after threshold failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Fail twice to reach threshold
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      
      expect(circuitBreaker.getState().state).toBe('open');
      expect(circuitBreaker.getState().failures).toBe(2);
    });

    it('should reject requests when circuit is open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Open the circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      
      // Next request should be rejected without calling operation
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Service temporarily unavailable');
      expect(operation).toHaveBeenCalledTimes(2); // Not called for the third attempt
    });

    it('should use fallback when circuit is open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const fallback = vi.fn().mockResolvedValue('fallback result');
      
      // Open the circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      
      // Use fallback
      const result = await circuitBreaker.execute(operation, fallback);
      expect(result).toBe('fallback result');
      expect(fallback).toHaveBeenCalled();
    });

    it('should transition to half-open after timeout', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce('success');
      
      // Open the circuit
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      await expect(circuitBreaker.execute(operation)).rejects.toThrow();
      
      expect(circuitBreaker.getState().state).toBe('open');
      
      // Wait for timeout (simulate by manipulating time)
      vi.advanceTimersByTime(1100);
      
      // Next request should succeed and close the circuit
      const result = await circuitBreaker.execute(operation);
      expect(result).toBe('success');
      expect(circuitBreaker.getState().state).toBe('closed');
    });
  });
});

// Setup timer mocks
vi.useFakeTimers();