import { SwapProposalService } from './SwapProposalService';
import { logger } from '../../utils/logger';

export interface SwapExpirationServiceStatus {
  isRunning: boolean;
  checkIntervalMs: number;
  nextCheckIn?: number;
  startedAt?: Date;
  lastCheckAt?: Date;
  totalChecksPerformed: number;
  totalSwapsProcessed: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
  isShuttingDown?: boolean;
  shutdownStartedAt?: Date;
}

export class SwapExpirationService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly checkIntervalMs: number;
  private startedAt?: Date;
  private lastCheckAt?: Date;
  private totalChecksPerformed: number = 0;
  private totalSwapsProcessed: number = 0;
  private lastError?: { message: string; timestamp: Date };
  private isShuttingDown: boolean = false;
  private shutdownStartedAt?: Date;
  private currentCheckPromise?: Promise<void>;

  constructor(
    private swapProposalService: SwapProposalService,
    checkIntervalMinutes: number = 5 // Check every 5 minutes by default
  ) {
    this.checkIntervalMs = checkIntervalMinutes * 60 * 1000;
  }

  /**
   * Start the automatic expiration check service
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('Swap expiration service is already running');
      return;
    }

    this.startedAt = new Date();
    this.lastError = undefined;

    logger.info('Starting swap expiration service', {
      checkIntervalMinutes: this.checkIntervalMs / (60 * 1000),
      startedAt: this.startedAt.toISOString(),
    });

    // Run immediately on start
    this.checkExpiredProposals();

    // Then run at regular intervals
    this.intervalId = setInterval(() => {
      this.checkExpiredProposals();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the automatic expiration check service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.startedAt = undefined;
      logger.info('Swap expiration service stopped', {
        totalChecksPerformed: this.totalChecksPerformed,
        totalSwapsProcessed: this.totalSwapsProcessed,
      });
    }
  }

  /**
   * Stop the service gracefully with timeout handling
   * @param timeoutMs Maximum time to wait for graceful shutdown (default: 30 seconds)
   * @returns Promise that resolves when service is stopped or timeout is reached
   */
  async stopGracefully(timeoutMs: number = 30000): Promise<{ success: boolean; timedOut: boolean; error?: Error }> {
    if (!this.intervalId && !this.currentCheckPromise) {
      logger.info('SwapExpirationService is already stopped');
      return { success: true, timedOut: false };
    }

    this.isShuttingDown = true;
    this.shutdownStartedAt = new Date();

    logger.info('Starting graceful shutdown of SwapExpirationService', {
      timeoutMs,
      hasActiveInterval: !!this.intervalId,
      hasCurrentCheck: !!this.currentCheckPromise,
      shutdownStartedAt: this.shutdownStartedAt.toISOString()
    });

    try {
      // Stop the interval timer immediately
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        logger.debug('SwapExpirationService interval timer cleared');
      }

      // Wait for current check to complete with timeout
      if (this.currentCheckPromise) {
        logger.debug('Waiting for current expiration check to complete');

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Shutdown timeout')), timeoutMs);
        });

        try {
          await Promise.race([this.currentCheckPromise, timeoutPromise]);
          logger.debug('Current expiration check completed during shutdown');
        } catch (error) {
          if (error instanceof Error && error.message === 'Shutdown timeout') {
            logger.warn('Shutdown timeout reached while waiting for current check to complete', {
              timeoutMs,
              shutdownDuration: Date.now() - this.shutdownStartedAt!.getTime()
            });
            return { success: false, timedOut: true };
          }
          // If the current check failed, that's okay during shutdown
          logger.debug('Current check failed during shutdown, continuing with cleanup', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Calculate shutdown duration before cleanup
      const shutdownDuration = this.shutdownStartedAt ? Date.now() - this.shutdownStartedAt.getTime() : 0;

      // Final cleanup
      this.startedAt = undefined;
      this.isShuttingDown = false;
      this.shutdownStartedAt = undefined;
      this.currentCheckPromise = undefined;
      logger.info('SwapExpirationService graceful shutdown completed successfully', {
        shutdownDuration,
        totalChecksPerformed: this.totalChecksPerformed,
        totalSwapsProcessed: this.totalSwapsProcessed
      });

      return { success: true, timedOut: false };

    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      const shutdownDuration = this.shutdownStartedAt ? Date.now() - this.shutdownStartedAt.getTime() : 0;

      logger.error('Error during SwapExpirationService graceful shutdown', {
        error: errorInstance.message,
        stack: errorInstance.stack,
        shutdownDuration
      });

      // Ensure cleanup even on error
      this.intervalId = null;
      this.startedAt = undefined;
      this.isShuttingDown = false;
      this.shutdownStartedAt = undefined;
      this.currentCheckPromise = undefined;

      return { success: false, timedOut: false, error: errorInstance };
    }
  }

  /**
   * Check for and handle expired proposals
   */
  private async checkExpiredProposals(): Promise<void> {
    // Skip check if service is shutting down
    if (this.isShuttingDown) {
      logger.debug('Skipping expired proposals check - service is shutting down');
      return;
    }

    this.totalChecksPerformed++;
    this.lastCheckAt = new Date();

    // Track the current check promise for graceful shutdown
    this.currentCheckPromise = this.performExpirationCheck();

    try {
      await this.currentCheckPromise;
    } finally {
      this.currentCheckPromise = undefined;
    }
  }

  /**
   * Perform the actual expiration check logic
   */
  private async performExpirationCheck(): Promise<void> {
    try {
      logger.debug('Checking for expired swap proposals', {
        checkNumber: this.totalChecksPerformed,
        lastCheckAt: this.lastCheckAt?.toISOString(),
        isShuttingDown: this.isShuttingDown
      });

      // Double-check shutdown status before proceeding with potentially long operation
      if (this.isShuttingDown) {
        logger.debug('Aborting expiration check - shutdown initiated during check setup');
        return;
      }

      const result = await this.swapProposalService.handleExpiredProposals();

      // If handleExpiredProposals returns a count, track it
      if (typeof result === 'number') {
        this.totalSwapsProcessed += result;
      }

      // Clear any previous error on successful check
      this.lastError = undefined;

      logger.debug('Expired proposals check completed', {
        checkNumber: this.totalChecksPerformed,
        totalSwapsProcessed: this.totalSwapsProcessed,
        isShuttingDown: this.isShuttingDown
      });
    } catch (error) {
      // Don't log errors if we're shutting down
      if (this.isShuttingDown) {
        logger.debug('Expiration check failed during shutdown - this is expected', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.lastError = {
        message: errorMessage,
        timestamp: new Date(),
      };

      logger.error('Error during expired proposals check', {
        error: errorMessage,
        checkNumber: this.totalChecksPerformed,
        timestamp: this.lastError.timestamp.toISOString(),
      });
    }
  }

  /**
   * Force check for expired proposals (for manual triggering)
   */
  async forceCheck(): Promise<void> {
    logger.info('Forcing expired proposals check');
    await this.checkExpiredProposals();
  }

  /**
   * Get service status
   */
  getStatus(): SwapExpirationServiceStatus {
    return {
      isRunning: this.intervalId !== null,
      checkIntervalMs: this.checkIntervalMs,
      nextCheckIn: this.intervalId ? this.checkIntervalMs : undefined,
      startedAt: this.startedAt,
      lastCheckAt: this.lastCheckAt,
      totalChecksPerformed: this.totalChecksPerformed,
      totalSwapsProcessed: this.totalSwapsProcessed,
      lastError: this.lastError,
      isShuttingDown: this.isShuttingDown,
      shutdownStartedAt: this.shutdownStartedAt,
    };
  }
}