import {
    NotificationType,
    TargetingNotificationData,
    TargetingStatusChangeData,
    RetargetingNotificationData
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';
import { NotificationService } from './NotificationService';
import { NotificationPreferencesService } from './NotificationPreferencesService';

interface BatchedNotification {
    userId: string;
    type: NotificationType;
    data: any;
    timestamp: Date;
}

interface NotificationBatch {
    userId: string;
    notifications: BatchedNotification[];
    scheduledSendTime: Date;
    timeoutId?: NodeJS.Timeout;
}

export class TargetingEmailBatchingService {
    private batches: Map<string, NotificationBatch> = new Map();
    private notificationService: NotificationService;
    private preferencesService: NotificationPreferencesService;

    constructor(
        notificationService: NotificationService,
        preferencesService: NotificationPreferencesService
    ) {
        this.notificationService = notificationService;
        this.preferencesService = preferencesService;
    }

    /**
     * Add notification to batch or send immediately based on user preferences
     */
    async addNotificationToBatch(
        userId: string,
        notificationType: NotificationType,
        notificationData: any
    ): Promise<void> {
        try {
            logger.info('Adding notification to batch', { userId, notificationType });

            // Check if batching is enabled for this user
            const targetingPreferences = await this.preferencesService.getTargetingNotificationPreferences(userId);

            if (!targetingPreferences.targetingReceived.batchingEnabled || this.shouldSendImmediately(notificationType)) {
                // Send immediately if batching is disabled or for urgent notifications
                await this.sendImmediateNotification(userId, notificationType, notificationData);
                return;
            }

            // Add to batch
            const batchKey = `${userId}_targeting`;
            let batch = this.batches.get(batchKey);

            if (!batch) {
                // Create new batch
                const batchingWindow = targetingPreferences.targetingReceived.batchingWindow;
                const scheduledSendTime = new Date(Date.now() + batchingWindow * 60 * 1000);

                batch = {
                    userId,
                    notifications: [],
                    scheduledSendTime,
                };

                // Schedule batch sending
                batch.timeoutId = setTimeout(() => {
                    this.sendBatch(batchKey);
                }, batchingWindow * 60 * 1000);

                this.batches.set(batchKey, batch);
                logger.info('Created new notification batch', {
                    userId,
                    batchKey,
                    scheduledSendTime,
                    batchingWindow
                });
            }

            // Add notification to batch
            batch.notifications.push({
                userId,
                type: notificationType,
                data: notificationData,
                timestamp: new Date()
            });

            logger.info('Added notification to existing batch', {
                userId,
                notificationType,
                batchSize: batch.notifications.length
            });

        } catch (error) {
            logger.error('Failed to add notification to batch', {
                error,
                userId,
                notificationType
            });

            // Fallback to immediate sending
            await this.sendImmediateNotification(userId, notificationType, notificationData);
        }
    }

    /**
     * Send batched notifications
     */
    private async sendBatch(batchKey: string): Promise<void> {
        try {
            const batch = this.batches.get(batchKey);
            if (!batch || batch.notifications.length === 0) {
                this.batches.delete(batchKey);
                return;
            }

            logger.info('Sending notification batch', {
                batchKey,
                notificationCount: batch.notifications.length
            });

            // Group notifications by type
            const groupedNotifications = this.groupNotificationsByType(batch.notifications);

            // Create batched email content
            const batchedEmailData = await this.createBatchedEmailContent(batch.userId, groupedNotifications);

            // Send the batched email
            await this.notificationService.sendNotification(
                'targeting_received', // Use a generic type for batched emails
                batch.userId,
                batchedEmailData,
                ['email']
            );

            // Send individual in-app notifications for real-time updates
            for (const notification of batch.notifications) {
                await this.notificationService.sendNotification(
                    notification.type,
                    notification.userId,
                    notification.data,
                    ['in_app']
                );
            }

            // Clean up batch
            if (batch.timeoutId) {
                clearTimeout(batch.timeoutId);
            }
            this.batches.delete(batchKey);

            logger.info('Successfully sent notification batch', {
                batchKey,
                notificationCount: batch.notifications.length
            });

        } catch (error) {
            logger.error('Failed to send notification batch', { error, batchKey });

            // Fallback: send individual notifications
            const batch = this.batches.get(batchKey);
            if (batch) {
                for (const notification of batch.notifications) {
                    await this.sendImmediateNotification(
                        notification.userId,
                        notification.type,
                        notification.data
                    );
                }
                this.batches.delete(batchKey);
            }
        }
    }

    /**
     * Send notification immediately without batching
     */
    private async sendImmediateNotification(
        userId: string,
        notificationType: NotificationType,
        notificationData: any
    ): Promise<void> {
        try {
            await this.notificationService.sendNotification(
                notificationType,
                userId,
                notificationData,
                ['email', 'in_app', 'push']
            );

            logger.info('Sent immediate notification', { userId, notificationType });
        } catch (error) {
            logger.error('Failed to send immediate notification', {
                error,
                userId,
                notificationType
            });
        }
    }

    /**
     * Check if notification should be sent immediately (urgent notifications)
     */
    private shouldSendImmediately(notificationType: NotificationType): boolean {
        const immediateTypes: NotificationType[] = [
            'targeting_accepted',
            'targeting_rejected',
            'auction_targeting_ended',
            'targeting_restriction_warning'
        ];
        return immediateTypes.includes(notificationType);
    }

    /**
     * Group notifications by type for batching
     */
    private groupNotificationsByType(notifications: BatchedNotification[]): Map<NotificationType, BatchedNotification[]> {
        const grouped = new Map<NotificationType, BatchedNotification[]>();

        for (const notification of notifications) {
            if (!grouped.has(notification.type)) {
                grouped.set(notification.type, []);
            }
            grouped.get(notification.type)!.push(notification);
        }

        return grouped;
    }

    /**
     * Create batched email content
     */
    private async createBatchedEmailContent(
        userId: string,
        groupedNotifications: Map<NotificationType, BatchedNotification[]>
    ): Promise<any> {
        const batchSummary = {
            totalNotifications: 0,
            targetingReceived: 0,
            retargetingOccurred: 0,
            auctionUpdates: 0,
            otherUpdates: 0,
            swapTitles: new Set<string>(),
            timeRange: {
                earliest: new Date(),
                latest: new Date(0)
            }
        };

        // Collect summary data
        for (const [type, notifications] of groupedNotifications) {
            batchSummary.totalNotifications += notifications.length;

            for (const notification of notifications) {
                // Update time range
                if (notification.timestamp < batchSummary.timeRange.earliest) {
                    batchSummary.timeRange.earliest = notification.timestamp;
                }
                if (notification.timestamp > batchSummary.timeRange.latest) {
                    batchSummary.timeRange.latest = notification.timestamp;
                }

                // Collect swap titles
                if (notification.data.sourceSwapDetails?.title) {
                    batchSummary.swapTitles.add(notification.data.sourceSwapDetails.title);
                }
                if (notification.data.targetSwapDetails?.title) {
                    batchSummary.swapTitles.add(notification.data.targetSwapDetails.title);
                }

                // Count by type
                switch (type) {
                    case 'targeting_received':
                        batchSummary.targetingReceived++;
                        break;
                    case 'retargeting_occurred':
                        batchSummary.retargetingOccurred++;
                        break;
                    case 'auction_targeting_update':
                        batchSummary.auctionUpdates++;
                        break;
                    default:
                        batchSummary.otherUpdates++;
                }
            }
        }

        // Create batched email data
        return {
            batchSummary,
            groupedNotifications: Array.from(groupedNotifications.entries()),
            dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
            targetingUrl: `${process.env.FRONTEND_URL}/dashboard/targeting`,
            subject: this.createBatchedEmailSubject(batchSummary),
            content: this.createBatchedEmailHtml(batchSummary, groupedNotifications)
        };
    }

    /**
     * Create subject line for batched email
     */
    private createBatchedEmailSubject(summary: any): string {
        const { totalNotifications, targetingReceived, swapTitles } = summary;

        if (totalNotifications === 1) {
            return `New Targeting Activity`;
        } else if (targetingReceived > 0) {
            return `${totalNotifications} New Targeting Updates (${targetingReceived} new requests)`;
        } else {
            return `${totalNotifications} Targeting Updates`;
        }
    }

    /**
     * Create HTML content for batched email
     */
    private createBatchedEmailHtml(
        summary: any,
        groupedNotifications: Map<NotificationType, BatchedNotification[]>
    ): string {
        const { totalNotifications, timeRange } = summary;

        let content = `
      <h2>📬 Targeting Activity Summary</h2>
      <p>You have ${totalNotifications} targeting update${totalNotifications > 1 ? 's' : ''} from ${this.formatTimeRange(timeRange)}.</p>
      
      <div style="background-color: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
        <h3>📊 Summary</h3>
        <ul>
    `;

        if (summary.targetingReceived > 0) {
            content += `<li><strong>${summary.targetingReceived}</strong> new targeting request${summary.targetingReceived > 1 ? 's' : ''}</li>`;
        }
        if (summary.retargetingOccurred > 0) {
            content += `<li><strong>${summary.retargetingOccurred}</strong> retargeting update${summary.retargetingOccurred > 1 ? 's' : ''}</li>`;
        }
        if (summary.auctionUpdates > 0) {
            content += `<li><strong>${summary.auctionUpdates}</strong> auction update${summary.auctionUpdates > 1 ? 's' : ''}</li>`;
        }
        if (summary.otherUpdates > 0) {
            content += `<li><strong>${summary.otherUpdates}</strong> other update${summary.otherUpdates > 1 ? 's' : ''}</li>`;
        }

        content += `
        </ul>
      </div>
    `;

        // Add details for each notification type
        for (const [type, notifications] of groupedNotifications) {
            content += this.createNotificationTypeSection(type, notifications);
        }

        content += `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL}/dashboard/targeting" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">View All Targeting Activity</a>
      </div>
      
      <p style="color: #666; font-size: 14px;">
        This is a batched summary of your targeting notifications. You can adjust your notification preferences in your dashboard settings.
      </p>
      
      <p>Best regards,<br>The Booking Swap Team</p>
    `;

        return content;
    }

    /**
     * Create section for specific notification type
     */
    private createNotificationTypeSection(type: NotificationType, notifications: BatchedNotification[]): string {
        const typeTitle = this.getNotificationTypeTitle(type);
        const count = notifications.length;

        let section = `
      <div style="background-color: #e3f2fd; padding: 15px; margin: 15px 0; border-radius: 8px;">
        <h4>${typeTitle} (${count})</h4>
    `;

        // Show first few notifications with details
        const maxShow = 3;
        const showNotifications = notifications.slice(0, maxShow);

        for (const notification of showNotifications) {
            section += this.createNotificationSummary(notification);
        }

        if (notifications.length > maxShow) {
            section += `<p><em>... and ${notifications.length - maxShow} more</em></p>`;
        }

        section += `</div>`;
        return section;
    }

    /**
     * Create summary for individual notification
     */
    private createNotificationSummary(notification: BatchedNotification): string {
        const data = notification.data;
        const time = notification.timestamp.toLocaleTimeString();

        switch (notification.type) {
            case 'targeting_received':
                return `<p><strong>${time}:</strong> ${data.sourceSwapDetails?.ownerName || 'Someone'} wants to target your ${data.targetSwapDetails?.title || 'swap'}</p>`;

            case 'retargeting_occurred':
                return `<p><strong>${time}:</strong> User switched from ${data.previousTargetTitle} to ${data.newTargetTitle}</p>`;

            case 'auction_targeting_update':
                return `<p><strong>${time}:</strong> Auction update for ${data.targetSwapTitle} - ${data.updateType}</p>`;

            default:
                return `<p><strong>${time}:</strong> Targeting update received</p>`;
        }
    }

    /**
     * Get human-readable title for notification type
     */
    private getNotificationTypeTitle(type: NotificationType): string {
        switch (type) {
            case 'targeting_received':
                return '🎯 New Targeting Requests';
            case 'retargeting_occurred':
                return '🔄 Retargeting Updates';
            case 'auction_targeting_update':
                return '🏆 Auction Updates';
            case 'targeting_cancelled':
                return '🚫 Cancelled Requests';
            default:
                return '📬 Other Updates';
        }
    }

    /**
     * Format time range for display
     */
    private formatTimeRange(timeRange: { earliest: Date; latest: Date }): string {
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - timeRange.earliest.getTime()) / (1000 * 60));

        if (diffMinutes < 60) {
            return `the last ${diffMinutes} minutes`;
        } else if (diffMinutes < 1440) {
            const hours = Math.floor(diffMinutes / 60);
            return `the last ${hours} hour${hours > 1 ? 's' : ''}`;
        } else {
            return timeRange.earliest.toLocaleDateString();
        }
    }

    /**
     * Force send all pending batches (useful for testing or shutdown)
     */
    async flushAllBatches(): Promise<void> {
        logger.info('Flushing all pending notification batches', {
            batchCount: this.batches.size
        });

        const batchKeys = Array.from(this.batches.keys());
        for (const batchKey of batchKeys) {
            await this.sendBatch(batchKey);
        }
    }

    /**
     * Get current batch statistics
     */
    getBatchStatistics(): { totalBatches: number; totalNotifications: number } {
        let totalNotifications = 0;
        for (const batch of this.batches.values()) {
            totalNotifications += batch.notifications.length;
        }

        return {
            totalBatches: this.batches.size,
            totalNotifications
        };
    }
}