import { NFTMonitoringService } from '../NFTMonitoringService';
import { HederaErrorType } from '../HederaErrorReporter';

describe('NFT Monitoring Integration', () => {
  it('should integrate monitoring with NFT operations', () => {
    const monitoring = NFTMonitoringService.getInstance();
    
    // Test basic functionality
    const context = {
      tokenId: '0.0.12345',
      accountId: '0.0.67890',
      bookingId: 'test-booking',
      userId: 'test-user',
    };

    // Record a successful operation
    monitoring.recordOperation('mint', true, 1500, context);
    
    // Get health status
    const health = monitoring.getHealthStatus();
    expect(health.status).toBe('healthy');
    expect(health.operationCounts.total).toBe(1);
    expect(health.operationCounts.successful).toBe(1);
    
    // Record a failed operation
    const error = {
      errorCode: 'TEST_ERROR',
      errorMessage: 'Test error message',
      errorType: HederaErrorType.NETWORK_ERROR,
      timestamp: new Date(),
      operation: 'mint',
      context: {},
      retryable: true,
    };
    
    monitoring.recordOperation('mint', false, 2000, context, error);
    
    // Check updated health status
    const updatedHealth = monitoring.getHealthStatus();
    expect(updatedHealth.operationCounts.total).toBe(2);
    expect(updatedHealth.operationCounts.failed).toBe(1);
    expect(updatedHealth.errorRate).toBe(50);
    
    // Test metrics export
    const metrics = monitoring.getOperationMetrics('hour');
    expect(metrics.successRate).toBe(50);
    expect(metrics.operationCounts.mint.total).toBe(2);
    
    // Test Prometheus export
    const prometheus = monitoring.exportPrometheusMetrics();
    expect(prometheus).toContain('nft_operation_success_rate');
    expect(prometheus).toContain('nft_service_health');
  });
});