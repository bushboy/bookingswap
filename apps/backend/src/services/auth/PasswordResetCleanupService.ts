import { PasswordResetTokenRepository } from '../../database/repositories/PasswordResetTokenRepository';
import { logger } from '../../utils/logger';

export interface CleanupConfig {
  intervalMinutes: number;
  retentionDays: number;
  enableStatistics: boolean;
  statisticsIntervalMinutes: number;
}

export interface CleanupStatistics {
  totalTokens: number;
  activeTokens: number;
  expiredTokens: number;
  usedTokens: number;
  lastCleanupAt: Date;
  tokensCleanedUp: number;
}

export class PasswordResetCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statisticsInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastCleanupAt: Date | null = null;
  private tokensCleanedUp = 0;

  constructor(
    private passwordResetTokenRepository: PasswordResetTokenRepository,
    private config: CleanupConfig
  ) {}

  /**
   * Start the automated cleanup service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Password reset cleanup service is already running');
      return;
    }

    this.isRunning = true;
    
    // Start cleanup interval
    const cleanupIntervalMs = this.config.intervalMinutes * 60 * 1000;
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        logger.error('Password reset cleanup failed', { error: error.message });
      });
    }, cleanupIntervalMs);

    // Start statistics collection if enabled
    if (this.config.enableStatistics) {
      const statisticsIntervalMs = this.config.statisticsIntervalMinutes * 60 * 1000;
      this.statisticsInterval = setInterval(() => {
        this.collectStatistics().catch(error => {
          logger.error('Password reset statistics collection failed', { error: error.message });
        });
      }, statisticsIntervalMs);
    }

    // Perform initial cleanup
    this.performCleanup().catch(error => {
      logger.error('Initial password reset cleanup failed', { error: error.message });
    });

    logger.info('Password reset cleanup service started', {
      cleanupIntervalMinutes: this.config.intervalMinutes,
      retentionDays: this.config.retentionDays,
      statisticsEnabled: this.config.enableStatistics,
    });
  }

  /**
   * Stop the automated cleanup service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval);
      this.statisticsInterval = null;
    }

    this.isRunning = false;
    logger.info('Password reset cleanup service stopped');
  }

  /**
   * Perform cleanup of expired tokens
   */
  private async performCleanup(): Promise<void> {
    try {
      const startTime = Date.now();
      const cleanedCount = await this.passwordResetTokenRepository.cleanupExpiredTokens(this.config.retentionDays);
      const duration = Date.now() - startTime;

      this.lastCleanupAt = new Date();
      this.tokensCleanedUp += cleanedCount;

      logger.info('Password reset token cleanup completed', {
        tokensRemoved: cleanedCount,
        durationMs: duration,
        retentionDays: this.config.retentionDays,
      });

      // Log warning if cleanup took too long
      if (duration > 5000) {
        logger.warn('Password reset cleanup took longer than expected', {
          durationMs: duration,
          tokensRemoved: cleanedCount,
        });
      }
    } catch (error) {
      logger.error('Password reset cleanup operation failed', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Collect and log token statistics
   */
  private async collectStatistics(): Promise<void> {
    try {
      const statistics = await this.passwordResetTokenRepository.getTokenStatistics();
      
      logger.info('Password reset token statistics', {
        totalTokens: statistics.total,
        activeTokens: statistics.active,
        expiredTokens: statistics.expired,
        usedTokens: statistics.used,
        lastCleanupAt: this.lastCleanupAt,
        tokensCleanedUp: this.tokensCleanedUp,
      });

      // Log warnings for unusual patterns
      if (statistics.expired > statistics.used * 2) {
        logger.warn('High number of expired tokens detected', {
          expiredTokens: statistics.expired,
          usedTokens: statistics.used,
          ratio: statistics.expired / Math.max(statistics.used, 1),
        });
      }

      if (statistics.active > 100) {
        logger.warn('High number of active tokens detected', {
          activeTokens: statistics.active,
        });
      }
    } catch (error) {
      logger.error('Password reset statistics collection failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get current cleanup statistics
   */
  async getStatistics(): Promise<CleanupStatistics> {
    const repoStats = await this.passwordResetTokenRepository.getTokenStatistics();
    
    return {
      totalTokens: repoStats.total,
      activeTokens: repoStats.active,
      expiredTokens: repoStats.expired,
      usedTokens: repoStats.used,
      lastCleanupAt: this.lastCleanupAt || new Date(0),
      tokensCleanedUp: this.tokensCleanedUp,
    };
  }

  /**
   * Manually trigger cleanup (for testing or admin purposes)
   */
  async manualCleanup(): Promise<number> {
    logger.info('Manual password reset cleanup triggered');
    const cleanedCount = await this.passwordResetTokenRepository.cleanupExpiredTokens(this.config.retentionDays);
    this.lastCleanupAt = new Date();
    this.tokensCleanedUp += cleanedCount;
    return cleanedCount;
  }

  /**
   * Check if the service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get service configuration
   */
  getConfig(): CleanupConfig {
    return { ...this.config };
  }

  /**
   * Update service configuration (requires restart to take effect)
   */
  updateConfig(newConfig: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Password reset cleanup service configuration updated', {
      newConfig: this.config,
    });
  }
}