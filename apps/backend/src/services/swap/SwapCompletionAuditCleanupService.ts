import { Pool } from 'pg';
import { SwapCompletionAuditService } from './SwapCompletionAuditService';
import { logger } from '../../utils/logger';

/**
 * SwapCompletionAuditCleanupService manages scheduled cleanup of old completion audit records.
 * Provides automated cleanup procedures for audit record retention management.
 * 
 * Requirements: 6.4
 */
export class SwapCompletionAuditCleanupService {
    private auditService: SwapCompletionAuditService;
    private cleanupInterval: NodeJS.Timeout | null = null;
    private isRunning = false;

    constructor(
        private readonly pool: Pool,
        private readonly config: {
            retentionDays: number;
            batchSize: number;
            intervalHours: number; // e.g., 24 for daily cleanup
            enabled: boolean;
        }
    ) {
        this.auditService = new SwapCompletionAuditService(pool);
    }

    /**
     * Start the scheduled cleanup service
     * Initializes interval timer for automated audit record cleanup
     * 
     * Requirements: 6.4
     */
    start(): void {
        if (!this.config.enabled) {
            logger.info('Audit cleanup service is disabled');
            return;
        }

        if (this.cleanupInterval) {
            logger.warn('Audit cleanup service is already running');
            return;
        }

        try {
            const intervalMs = this.config.intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds

            this.cleanupInterval = setInterval(
                () => this.performScheduledCleanup(),
                intervalMs
            );

            logger.info('Audit cleanup service started', {
                intervalHours: this.config.intervalHours,
                retentionDays: this.config.retentionDays,
                batchSize: this.config.batchSize
            });

            // Perform initial cleanup after a short delay
            setTimeout(() => this.performScheduledCleanup(), 60000); // 1 minute delay

        } catch (error) {
            logger.error('Failed to start audit cleanup service', {
                error: error instanceof Error ? error.message : String(error),
                intervalHours: this.config.intervalHours
            });
            throw error;
        }
    }

    /**
     * Stop the scheduled cleanup service
     * Stops the interval timer and waits for current cleanup to complete
     * 
     * Requirements: 6.4
     */
    async stop(): Promise<void> {
        if (!this.cleanupInterval) {
            logger.info('Audit cleanup service is not running');
            return;
        }

        logger.info('Stopping audit cleanup service');

        // Stop the interval timer
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;

        // Wait for current cleanup to complete if running
        while (this.isRunning) {
            logger.debug('Waiting for current cleanup to complete');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        logger.info('Audit cleanup service stopped');
    }

    /**
     * Perform manual cleanup of old audit records
     * Allows on-demand cleanup outside of scheduled runs
     * 
     * Requirements: 6.4
     */
    async performManualCleanup(options?: {
        retentionDays?: number;
        batchSize?: number;
        dryRun?: boolean;
    }): Promise<{
        deletedCount: number;
        oldestRetainedDate: Date;
        batchesProcessed: number;
        durationMs: number;
    }> {
        if (this.isRunning) {
            throw new Error('Cleanup is already in progress');
        }

        const startTime = Date.now();
        this.isRunning = true;

        try {
            const cleanupOptions = {
                retentionDays: options?.retentionDays || this.config.retentionDays,
                batchSize: options?.batchSize || this.config.batchSize,
                dryRun: options?.dryRun || false
            };

            logger.info('Starting manual audit cleanup', cleanupOptions);

            const result = await this.auditService.cleanupOldAuditRecords(cleanupOptions);

            const durationMs = Date.now() - startTime;

            logger.info('Manual audit cleanup completed', {
                ...result,
                durationMs,
                dryRun: cleanupOptions.dryRun
            });

            return {
                ...result,
                durationMs
            };

        } catch (error) {
            logger.error('Manual audit cleanup failed', {
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startTime
            });
            throw error;

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Get cleanup service status and statistics
     * Provides information about cleanup service state and recent activity
     * 
     * Requirements: 6.4
     */
    getStatus(): {
        isEnabled: boolean;
        isRunning: boolean;
        hasScheduledJob: boolean;
        config: {
            retentionDays: number;
            batchSize: number;
            intervalHours: number;
        };
    } {
        return {
            isEnabled: this.config.enabled,
            isRunning: this.isRunning,
            hasScheduledJob: !!this.cleanupInterval,
            config: {
                retentionDays: this.config.retentionDays,
                batchSize: this.config.batchSize,
                intervalHours: this.config.intervalHours
            }
        };
    }

    /**
     * Update cleanup configuration
     * Allows runtime configuration changes
     * 
     * Requirements: 6.4
     */
    updateConfig(newConfig: Partial<{
        retentionDays: number;
        batchSize: number;
        intervalHours: number;
        enabled: boolean;
    }>): void {
        const oldConfig = { ...this.config };

        // Update configuration
        Object.assign(this.config, newConfig);

        logger.info('Audit cleanup configuration updated', {
            oldConfig,
            newConfig: this.config
        });

        // Restart service if interval changed and service is running
        if (newConfig.intervalHours && this.cleanupInterval) {
            logger.info('Restarting cleanup service due to interval change');
            this.stop().then(() => {
                if (this.config.enabled) {
                    this.start();
                }
            });
        }

        // Stop service if disabled
        if (newConfig.enabled === false && this.cleanupInterval) {
            logger.info('Stopping cleanup service due to configuration change');
            this.stop();
        }

        // Start service if enabled
        if (newConfig.enabled === true && !this.cleanupInterval) {
            logger.info('Starting cleanup service due to configuration change');
            this.start();
        }
    }

    /**
     * Perform scheduled cleanup (called by cron job)
     * Internal method for automated cleanup execution
     */
    private async performScheduledCleanup(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Skipping scheduled cleanup - previous cleanup still running');
            return;
        }

        const startTime = Date.now();
        this.isRunning = true;

        try {
            logger.info('Starting scheduled audit cleanup', {
                retentionDays: this.config.retentionDays,
                batchSize: this.config.batchSize
            });

            const result = await this.auditService.cleanupOldAuditRecords({
                retentionDays: this.config.retentionDays,
                batchSize: this.config.batchSize,
                dryRun: false
            });

            const durationMs = Date.now() - startTime;

            logger.info('Scheduled audit cleanup completed', {
                ...result,
                durationMs
            });

            // Log warning if cleanup took too long
            if (durationMs > 300000) { // 5 minutes
                logger.warn('Audit cleanup took longer than expected', {
                    durationMs,
                    deletedCount: result.deletedCount,
                    batchesProcessed: result.batchesProcessed
                });
            }

        } catch (error) {
            logger.error('Scheduled audit cleanup failed', {
                error: error instanceof Error ? error.message : String(error),
                durationMs: Date.now() - startTime
            });

            // Don't throw error to prevent cron job from stopping
            // The error is logged for monitoring and alerting

        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Estimate cleanup impact before execution
     * Provides information about what would be cleaned up
     * 
     * Requirements: 6.4
     */
    async estimateCleanupImpact(retentionDays?: number): Promise<{
        recordsToDelete: number;
        oldestRecordDate?: Date;
        newestRecordToDelete?: Date;
        estimatedBatches: number;
    }> {
        try {
            const effectiveRetentionDays = retentionDays || this.config.retentionDays;

            logger.debug('Estimating cleanup impact', { effectiveRetentionDays });

            // Perform dry run to get count
            const dryRunResult = await this.auditService.cleanupOldAuditRecords({
                retentionDays: effectiveRetentionDays,
                batchSize: this.config.batchSize,
                dryRun: true
            });

            const estimatedBatches = Math.ceil(dryRunResult.deletedCount / this.config.batchSize);

            // Get oldest record date for reference
            const statistics = await this.auditService.getCompletionStatistics({});

            return {
                recordsToDelete: dryRunResult.deletedCount,
                oldestRecordDate: undefined, // Could be enhanced to query oldest record
                newestRecordToDelete: dryRunResult.oldestRetainedDate,
                estimatedBatches
            };

        } catch (error) {
            logger.error('Failed to estimate cleanup impact', {
                retentionDays,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
}