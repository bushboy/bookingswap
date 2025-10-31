import { NFTMonitoringService } from '../NFTMonitoringService';
import { HederaErrorType } from '../HederaErrorReporter';

describe('NFTMonitoringService', () => {
  let monitoringService: NFTMonitoringService;

  beforeEach(() => {
    // Get a fresh instance for each test
    monitoringService = NFTMonitoringService.getInstance();
    
    // Clear any existing metrics
    (monitoringService as any).metrics = [];
    (monitoringService as any).alerts = [];
    (monitoringService as any).consecutiveFailures = 0;
    (monitoringService as any).lastSuccessfulOperation = null;
  });

  describe('recordOperation', () => {
    it('should record successful NFT minting operation', () => {
      const context = {
        tokenId: '0.0.12345',
        accountId: '0.0.67890',
        bookingId: 'booking-123',
        userId: 'user-456',
      };

      monitoringService.recordOperation('mint', true, 1500, context);

      const healthStatus = monitoringService.getHealthStatus();
      expect(healthStatus.operationCounts.total).toBe(1);
      expect(healthStatus.operationCounts.successful).toBe(1);
      expect(healthStatus.operationCounts.failed).toBe(0);
      expect(healthStatus.status).toBe('healthy');
    });

    it('should record failed NFT operation with error details', () => {
      const context = {
        tokenId: '0.0.12345',
        accountId: '0.0.67890',
      };

      const error = {
        errorCode: 'INSUFFICIENT_ACCOUNT_BALANCE',
        errorMessage: 'Insufficient balance',
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      };

      monitoringService.recordOperation('mint', false, 2000, context, error);

      const healthStatus = monitoringService.getHealthStatus();
      expect(healthStatus.operationCounts.total).toBe(1);
      expect(healthStatus.operationCounts.successful).toBe(0);
      expect(healthStatus.operationCounts.failed).toBe(1);
      expect(healthStatus.errorRate).toBe(100);
      expect(healthStatus.errorBreakdown[HederaErrorType.INSUFFICIENT_BALANCE]).toBe(1);
    });

    it('should track consecutive failures', () => {
      const context = { tokenId: '0.0.12345' };
      const error = {
        errorCode: 'NETWORK_ERROR',
        errorMessage: 'Network timeout',
        errorType: HederaErrorType.NETWORK_ERROR,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: true,
      };

      // Record 3 consecutive failures
      monitoringService.recordOperation('mint', false, 1000, context, error);
      monitoringService.recordOperation('mint', false, 1000, context, error);
      monitoringService.recordOperation('mint', false, 1000, context, error);

      expect((monitoringService as any).consecutiveFailures).toBe(3);

      // Record a success - should reset consecutive failures
      monitoringService.recordOperation('mint', true, 1000, context);
      expect((monitoringService as any).consecutiveFailures).toBe(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status with no operations', () => {
      const healthStatus = monitoringService.getHealthStatus();
      
      expect(healthStatus.status).toBe('healthy');
      expect(healthStatus.errorRate).toBe(0);
      expect(healthStatus.operationCounts.total).toBe(0);
      expect(healthStatus.recentErrors).toHaveLength(0);
    });

    it('should return degraded status with high error rate', () => {
      const context = { tokenId: '0.0.12345' };
      const error = {
        errorCode: 'TIMEOUT',
        errorMessage: 'Operation timeout',
        errorType: HederaErrorType.TIMEOUT_ERROR,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: true,
      };

      // Record operations with 20% error rate (2 failures out of 10)
      for (let i = 0; i < 8; i++) {
        monitoringService.recordOperation('mint', true, 1000, context);
      }
      for (let i = 0; i < 2; i++) {
        monitoringService.recordOperation('mint', false, 1000, context, error);
      }

      const healthStatus = monitoringService.getHealthStatus();
      expect(healthStatus.status).toBe('degraded');
      expect(healthStatus.errorRate).toBe(20);
    });

    it('should return unhealthy status with very high error rate', () => {
      const context = { tokenId: '0.0.12345' };
      const error = {
        errorCode: 'CRITICAL_ERROR',
        errorMessage: 'Critical system error',
        errorType: HederaErrorType.UNKNOWN,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      };

      // Record operations with 50% error rate
      for (let i = 0; i < 5; i++) {
        monitoringService.recordOperation('mint', true, 1000, context);
        monitoringService.recordOperation('mint', false, 1000, context, error);
      }

      const healthStatus = monitoringService.getHealthStatus();
      expect(healthStatus.status).toBe('unhealthy');
      expect(healthStatus.errorRate).toBe(50);
    });
  });

  describe('getOperationMetrics', () => {
    beforeEach(() => {
      const context = { tokenId: '0.0.12345' };
      
      // Record various operations
      monitoringService.recordOperation('mint', true, 1500, context);
      monitoringService.recordOperation('transfer', true, 1200, context);
      monitoringService.recordOperation('query', true, 800, context);
      monitoringService.recordOperation('mint', false, 2000, context, {
        errorCode: 'ERROR',
        errorMessage: 'Test error',
        errorType: HederaErrorType.UNKNOWN,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      });
    });

    it('should calculate correct success rate', () => {
      const metrics = monitoringService.getOperationMetrics('hour');
      
      expect(metrics.successRate).toBe(75); // 3 success out of 4 total
      expect(metrics.averageResponseTime).toBe(1375); // (1500 + 1200 + 800 + 2000) / 4
    });

    it('should break down operations by type', () => {
      const metrics = monitoringService.getOperationMetrics('hour');
      
      expect(metrics.operationCounts.mint.total).toBe(2);
      expect(metrics.operationCounts.mint.successful).toBe(1);
      expect(metrics.operationCounts.mint.failed).toBe(1);
      
      expect(metrics.operationCounts.transfer.total).toBe(1);
      expect(metrics.operationCounts.transfer.successful).toBe(1);
      expect(metrics.operationCounts.transfer.failed).toBe(0);
      
      expect(metrics.operationCounts.query.total).toBe(1);
      expect(metrics.operationCounts.query.successful).toBe(1);
      expect(metrics.operationCounts.query.failed).toBe(0);
    });
  });

  describe('exportPrometheusMetrics', () => {
    it('should export metrics in Prometheus format', () => {
      const context = { tokenId: '0.0.12345' };
      
      // Record some operations
      monitoringService.recordOperation('mint', true, 1500, context);
      monitoringService.recordOperation('mint', false, 2000, context, {
        errorCode: 'ERROR',
        errorMessage: 'Test error',
        errorType: HederaErrorType.INSUFFICIENT_BALANCE,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      });

      const prometheusMetrics = monitoringService.exportPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('nft_operation_success_rate');
      expect(prometheusMetrics).toContain('nft_operation_response_time_ms');
      expect(prometheusMetrics).toContain('nft_operations_total');
      expect(prometheusMetrics).toContain('nft_errors_total');
      expect(prometheusMetrics).toContain('nft_service_health');
      expect(prometheusMetrics).toContain('nft_consecutive_failures');
    });
  });

  describe('alert configuration', () => {
    it('should update alert configuration', () => {
      const newConfig = {
        errorRateThreshold: 15,
        responseTimeThreshold: 3000,
        consecutiveFailuresThreshold: 2,
        alertCooldownPeriod: 600000,
      };

      monitoringService.updateAlertConfig(newConfig);
      
      // Verify configuration was updated by checking if alerts are triggered correctly
      const context = { tokenId: '0.0.12345' };
      
      // This should trigger an alert with the new threshold
      for (let i = 0; i < 10; i++) {
        if (i < 8) {
          monitoringService.recordOperation('mint', true, 1000, context);
        } else {
          monitoringService.recordOperation('mint', false, 1000, context, {
            errorCode: 'ERROR',
            errorMessage: 'Test error',
            errorType: HederaErrorType.UNKNOWN,
            timestamp: new Date(),
            operation: 'mint',
            context: {},
            retryable: false,
          });
        }
      }

      const alerts = monitoringService.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('alert generation', () => {
    it('should generate alert for high error rate', () => {
      const context = { tokenId: '0.0.12345' };
      const error = {
        errorCode: 'ERROR',
        errorMessage: 'Test error',
        errorType: HederaErrorType.UNKNOWN,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      };

      // Generate enough failures to trigger error rate alert (default threshold is 10%)
      for (let i = 0; i < 10; i++) {
        if (i < 8) {
          monitoringService.recordOperation('mint', true, 1000, context);
        } else {
          monitoringService.recordOperation('mint', false, 1000, context, error);
        }
      }

      const alerts = monitoringService.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const errorRateAlert = alerts.find(alert => alert.type === 'error_rate');
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert?.severity).toBe('warning');
    });

    it('should generate alert for slow response time', () => {
      const context = { tokenId: '0.0.12345' };
      
      // Record operation with response time exceeding threshold (default is 5000ms)
      monitoringService.recordOperation('mint', true, 6000, context);

      const alerts = monitoringService.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const responseTimeAlert = alerts.find(alert => alert.type === 'response_time');
      expect(responseTimeAlert).toBeDefined();
      expect(responseTimeAlert?.severity).toBe('warning');
    });

    it('should generate alert for consecutive failures', () => {
      const context = { tokenId: '0.0.12345' };
      const error = {
        errorCode: 'ERROR',
        errorMessage: 'Test error',
        errorType: HederaErrorType.UNKNOWN,
        timestamp: new Date(),
        operation: 'mint',
        context: {},
        retryable: false,
      };

      // Record consecutive failures (default threshold is 5)
      for (let i = 0; i < 5; i++) {
        monitoringService.recordOperation('mint', false, 1000, context, error);
      }

      const alerts = monitoringService.getRecentAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      
      const consecutiveFailuresAlert = alerts.find(alert => alert.type === 'consecutive_failures');
      expect(consecutiveFailuresAlert).toBeDefined();
      expect(consecutiveFailuresAlert?.severity).toBe('critical');
    });
  });
});