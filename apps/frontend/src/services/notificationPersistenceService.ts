import { Notification } from '@booking-swap/shared';

export interface NotificationHistoryItem {
    id: string;
    notification: Notification;
    timestamp: Date;
    dismissed: boolean;
    interacted: boolean;
    interactionType?: 'clicked' | 'action_taken' | 'auto_dismissed';
}

export interface NotificationFilter {
    type?: string[];
    dateRange?: {
        start: Date;
        end: Date;
    };
    status?: 'read' | 'unread' | 'all';
    dismissed?: boolean;
}

export class NotificationPersistenceService {
    private static instance: NotificationPersistenceService;
    private readonly STORAGE_KEY = 'booking_swap_notification_history';
    private readonly MAX_HISTORY_ITEMS = 1000;
    private readonly CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

    private constructor() {
        this.setupPeriodicCleanup();
    }

    static getInstance(): NotificationPersistenceService {
        if (!NotificationPersistenceService.instance) {
            NotificationPersistenceService.instance = new NotificationPersistenceService();
        }
        return NotificationPersistenceService.instance;
    }

    /**
     * Add notification to persistent history
     * Requirements: 7.4
     */
    addToHistory(notification: Notification): void {
        try {
            const history = this.getHistory();

            const historyItem: NotificationHistoryItem = {
                id: notification.id,
                notification,
                timestamp: new Date(),
                dismissed: false,
                interacted: false,
            };

            // Add to beginning of array (most recent first)
            history.unshift(historyItem);

            // Limit history size
            if (history.length > this.MAX_HISTORY_ITEMS) {
                history.splice(this.MAX_HISTORY_ITEMS);
            }

            this.saveHistory(history);
        } catch (error) {
            console.warn('Failed to add notification to history:', error);
        }
    }

    /**
     * Mark notification as dismissed
     */
    markAsDismissed(notificationId: string, interactionType?: 'clicked' | 'action_taken' | 'auto_dismissed'): void {
        try {
            const history = this.getHistory();
            const item = history.find(h => h.id === notificationId);

            if (item) {
                item.dismissed = true;
                item.interacted = true;
                item.interactionType = interactionType || 'auto_dismissed';
                this.saveHistory(history);
            }
        } catch (error) {
            console.warn('Failed to mark notification as dismissed:', error);
        }
    }

    /**
     * Get notification history with optional filtering
     */
    getHistory(filter?: NotificationFilter): NotificationHistoryItem[] {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            let history: NotificationHistoryItem[] = stored ? JSON.parse(stored) : [];

            // Convert date strings back to Date objects
            history = history.map(item => ({
                ...item,
                timestamp: new Date(item.timestamp),
                notification: {
                    ...item.notification,
                    createdAt: new Date(item.notification.createdAt),
                    updatedAt: new Date(item.notification.updatedAt),
                    readAt: item.notification.readAt ? new Date(item.notification.readAt) : undefined,
                },
            }));

            if (filter) {
                history = this.applyFilter(history, filter);
            }

            return history;
        } catch (error) {
            console.warn('Failed to get notification history:', error);
            return [];
        }
    }

    /**
     * Get notification statistics
     */
    getStatistics(): {
        total: number;
        unread: number;
        dismissed: number;
        interacted: number;
        byType: Record<string, number>;
        last24Hours: number;
        last7Days: number;
    } {
        const history = this.getHistory();
        const now = new Date();
        const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const stats = {
            total: history.length,
            unread: history.filter(h => !h.notification.readAt).length,
            dismissed: history.filter(h => h.dismissed).length,
            interacted: history.filter(h => h.interacted).length,
            byType: {} as Record<string, number>,
            last24Hours: history.filter(h => h.timestamp > last24Hours).length,
            last7Days: history.filter(h => h.timestamp > last7Days).length,
        };

        // Count by type
        history.forEach(item => {
            const type = item.notification.type;
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });

        return stats;
    }

    /**
     * Clear old notifications (older than 30 days)
     */
    cleanup(): void {
        try {
            const history = this.getHistory();
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const filteredHistory = history.filter(item => item.timestamp > thirtyDaysAgo);

            if (filteredHistory.length !== history.length) {
                this.saveHistory(filteredHistory);
                console.log(`Cleaned up ${history.length - filteredHistory.length} old notifications`);
            }
        } catch (error) {
            console.warn('Failed to cleanup notification history:', error);
        }
    }

    /**
     * Clear all notification history
     */
    clearAll(): void {
        try {
            localStorage.removeItem(this.STORAGE_KEY);
        } catch (error) {
            console.warn('Failed to clear notification history:', error);
        }
    }

    /**
     * Export notification history as JSON
     */
    exportHistory(): string {
        const history = this.getHistory();
        return JSON.stringify(history, null, 2);
    }

    /**
     * Get proposal-specific notification history
     */
    getProposalHistory(proposalId: string): NotificationHistoryItem[] {
        const history = this.getHistory();
        return history.filter(item =>
            item.notification.data?.proposalId === proposalId ||
            item.notification.id.includes(proposalId)
        );
    }

    /**
     * Get recent proposal action notifications
     */
    getRecentProposalActions(hours: number = 24): NotificationHistoryItem[] {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const history = this.getHistory();

        return history.filter(item =>
            item.timestamp > cutoff &&
            ['proposal_accepted', 'proposal_rejected', 'proposal_payment_completed', 'proposal_payment_failed'].includes(item.notification.type)
        );
    }

    /**
     * Apply filter to history
     */
    private applyFilter(history: NotificationHistoryItem[], filter: NotificationFilter): NotificationHistoryItem[] {
        let filtered = [...history];

        if (filter.type && filter.type.length > 0) {
            filtered = filtered.filter(item => filter.type!.includes(item.notification.type));
        }

        if (filter.dateRange) {
            filtered = filtered.filter(item =>
                item.timestamp >= filter.dateRange!.start &&
                item.timestamp <= filter.dateRange!.end
            );
        }

        if (filter.status && filter.status !== 'all') {
            if (filter.status === 'read') {
                filtered = filtered.filter(item => item.notification.readAt);
            } else if (filter.status === 'unread') {
                filtered = filtered.filter(item => !item.notification.readAt);
            }
        }

        if (filter.dismissed !== undefined) {
            filtered = filtered.filter(item => item.dismissed === filter.dismissed);
        }

        return filtered;
    }

    /**
     * Save history to localStorage
     */
    private saveHistory(history: NotificationHistoryItem[]): void {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
        } catch (error) {
            console.warn('Failed to save notification history:', error);
            // If storage is full, try to cleanup and save again
            this.cleanup();
            try {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
            } catch (retryError) {
                console.error('Failed to save notification history after cleanup:', retryError);
            }
        }
    }

    /**
     * Setup periodic cleanup
     */
    private setupPeriodicCleanup(): void {
        setInterval(() => {
            this.cleanup();
        }, this.CLEANUP_INTERVAL);
    }
}

// Export singleton instance
export const notificationPersistenceService = NotificationPersistenceService.getInstance();