import { CleanupConfig } from './PasswordResetCleanupService';

/**
 * Default configuration for password reset token cleanup
 */
export const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  // Run cleanup every 30 minutes
  intervalMinutes: 30,
  
  // Keep expired tokens for 1 day before deletion (for audit purposes)
  retentionDays: 1,
  
  // Enable statistics collection
  enableStatistics: true,
  
  // Collect statistics every 60 minutes
  statisticsIntervalMinutes: 60,
};

/**
 * Get cleanup configuration from environment variables with fallbacks
 */
export function getCleanupConfig(): CleanupConfig {
  return {
    intervalMinutes: parseInt(process.env.PASSWORD_RESET_CLEANUP_INTERVAL_MINUTES || '30'),
    retentionDays: parseInt(process.env.PASSWORD_RESET_RETENTION_DAYS || '1'),
    enableStatistics: process.env.PASSWORD_RESET_ENABLE_STATISTICS !== 'false',
    statisticsIntervalMinutes: parseInt(process.env.PASSWORD_RESET_STATISTICS_INTERVAL_MINUTES || '60'),
  };
}

/**
 * Validate cleanup configuration
 */
export function validateCleanupConfig(config: CleanupConfig): void {
  if (config.intervalMinutes < 1) {
    throw new Error('Cleanup interval must be at least 1 minute');
  }
  
  if (config.intervalMinutes > 1440) { // 24 hours
    throw new Error('Cleanup interval cannot exceed 24 hours');
  }
  
  if (config.retentionDays < 0) {
    throw new Error('Retention days cannot be negative');
  }
  
  if (config.retentionDays > 30) {
    throw new Error('Retention days cannot exceed 30 days');
  }
  
  if (config.statisticsIntervalMinutes < 1) {
    throw new Error('Statistics interval must be at least 1 minute');
  }
  
  if (config.statisticsIntervalMinutes > 1440) { // 24 hours
    throw new Error('Statistics interval cannot exceed 24 hours');
  }
}