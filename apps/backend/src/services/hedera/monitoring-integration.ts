import { NFTMonitoringService } from './NFTMonitoringService';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { Pool } from 'pg';
import { RedisService } from '../../database/cache/RedisService';

/**
 * Initialize and integrate NFT monitoring with the performance monitoring system
 */
export function initializeNFTMonitoring(dbPool: Pool, redisService: RedisService): void {
  const nftMonitoring = NFTMonitoringService.getInstance();
  const performanceMonitor = new PerformanceMonitor(dbPool, redisService);
  
  // Connect NFT monitoring with performance monitor
  nftMonitoring.setPerformanceMonitor(performanceMonitor);
  
  // Set up performance thresholds specific to NFT operations
  performanceMonitor.setThreshold('nft_mint_duration', 3000, 10000); // 3s warning, 10s critical
  performanceMonitor.setThreshold('nft_transfer_duration', 2000, 8000); // 2s warning, 8s critical
  performanceMonitor.setThreshold('nft_query_duration', 1000, 5000); // 1s warning, 5s critical
  performanceMonitor.setThreshold('nft_create_token_duration', 5000, 15000); // 5s warning, 15s critical
  
  // Configure NFT-specific alert thresholds
  nftMonitoring.updateAlertConfig({
    errorRateThreshold: 5, // 5% error rate threshold
    responseTimeThreshold: 5000, // 5 second response time threshold
    consecutiveFailuresThreshold: 3, // 3 consecutive failures
    alertCooldownPeriod: 300000, // 5 minute cooldown
  });
}

/**
 * Export metrics for external monitoring systems
 */
export function exportNFTMetricsForMonitoring(): {
  prometheus: string;
  json: object;
} {
  const nftMonitoring = NFTMonitoringService.getInstance();
  
  return {
    prometheus: nftMonitoring.exportPrometheusMetrics(),
    json: {
      healthStatus: nftMonitoring.getHealthStatus(),
      operationMetrics: nftMonitoring.getOperationMetrics('hour'),
      recentAlerts: nftMonitoring.getRecentAlerts(10),
    },
  };
}