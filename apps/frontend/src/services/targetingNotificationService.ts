import { EventEmitter } from 'events';
import { SwapTarget } from '@booking-swap/shared';
import { targetingWebSocketService } from './targetingWebSocketService';

// Targeting notification types
export interface TargetingNotification {
    id: string;
    type:
    | 'targeting_received'
    | 'targeting_accepted'
    | 'targeting_rejected'
    | 'targeting_cancelled'
    | 'retargeting_occurred'
    | 'auction_targeting_update'
    | 'proposal_from_targeting';
    title: string;
    message: string;
    data: {
        targetId?: string;
        sourceSwapId?: string;
        targetSwapId?: string;
        sourceSwapTitle?: string;
        targetSwapTitle?: string;
        proposerId?: string;
        proposerName?: string;
        auctionInfo?: any;
        proposalInfo?: any;
    };
    timestamp: Date;
    read: boolean;
    actions?: TargetingNotificationAction[];
}

export interface TargetingNotificationAction {
    id: string;
    label: string;
    type: 'primary' | 'secondary' | 'danger';
    action: () => void;
}

/**
 * Service for managing targeting-related notifications
 * Integrates with WebSocket updates and the main notification system
 */
export class TargetingNotificationService extends EventEmitter {
    private isInitialized: boolean = false;
    private notifications: Map<string, TargetingNotification> = new Map();
    private notificationPreferences: {
        enableTargetingNotifications: boolean;
        enableAuctionUpdates: boolean;
        enableProposalUpdates: boolean;
        enableEmailNotifications: boolean;
        enablePushNotifications: boolean;
    } = {
            enableTargetingNotifications: true,
            enableAuctionUpdates: true,
            enableProposalUpdates: true,
            enableEmailNotifications: false,
            enablePushNotifications: true,
        };

    constructor() {
        super();
        this.initialize();
    }

    /**
     * Initialize the targeting notification service
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Listen to targeting WebSocket events
        targetingWebSocketService.on('targeting_created', this.handleTargetingCreated.bind(this));
        targetingWebSocketService.on('targeting_updated', this.handleTargetingUpdated.bind(this));
        targetingWebSocketService.on('targeting_removed', this.handleTargetingRemoved.bind(this));
        targetingWebSocketService.on('target_status_changed', this.handleTargetStatusChanged.bind(this));
        targetingWebSocketService.on('auction_targeting_update', this.handleAuctionTargetingUpdate.bind(this));
        targetingWebSocketService.on('proposal_targeting_update', this.handleProposalTargetingUpdate.bind(this));

        // Load notification preferences from localStorage
        this.loadNotificationPreferences();

        this.isInitialized = true;
    }

    /**
     * Create and display a targeting notification
     */
    public createNotification(
        type: TargetingNotification['type'],
        title: string,
        message: string,
        data: TargetingNotification['data'],
        actions?: TargetingNotificationAction[]
    ): TargetingNotification {
        const notification: TargetingNotification = {
            id: this.generateNotificationId(),
            type,
            title,
            message,
            data,
            timestamp: new Date(),
            read: false,
            actions,
        };

        this.notifications.set(notification.id, notification);

        // Show notification if enabled
        if (this.shouldShowNotification(type)) {
            this.displayNotification(notification);
        }

        this.emit('notification_created', notification);
        return notification;
    }

    /**
     * Mark a notification as read
     */
    public markAsRead(notificationId: string): void {
        const notification = this.notifications.get(notificationId);
        if (notification && !notification.read) {
            notification.read = true;
            this.emit('notification_read', notification);
        }
    }

    /**
     * Remove a notification
     */
    public removeNotification(notificationId: string): void {
        const notification = this.notifications.get(notificationId);
        if (notification) {
            this.notifications.delete(notificationId);
            this.emit('notification_removed', notification);
        }
    }

    /**
     * Get all targeting notifications
     */
    public getNotifications(): TargetingNotification[] {
        return Array.from(this.notifications.values()).sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
    }

    /**
     * Get unread targeting notifications
     */
    public getUnreadNotifications(): TargetingNotification[] {
        return this.getNotifications().filter(n => !n.read);
    }

    /**
     * Clear all targeting notifications
     */
    public clearAllNotifications(): void {
        this.notifications.clear();
        this.emit('notifications_cleared');
    }

    /**
     * Update notification preferences
     */
    public updatePreferences(preferences: Partial<typeof this.notificationPreferences>): void {
        this.notificationPreferences = { ...this.notificationPreferences, ...preferences };
        this.saveNotificationPreferences();
        this.emit('preferences_updated', this.notificationPreferences);
    }

    /**
     * Get current notification preferences
     */
    public getPreferences(): typeof this.notificationPreferences {
        return { ...this.notificationPreferences };
    }

    // Event handlers
    private handleTargetingCreated(target: SwapTarget): void {
        if (!this.notificationPreferences.enableTargetingNotifications) {
            return;
        }

        this.createNotification(
            'targeting_received',
            'New Targeting Request',
            `Someone has targeted your swap with their swap proposal.`,
            {
                targetId: target.id,
                sourceSwapId: target.sourceSwapId,
                targetSwapId: target.targetSwapId,
            },
            [
                {
                    id: 'view_proposal',
                    label: 'View Proposal',
                    type: 'primary',
                    action: () => this.navigateToProposal(target.proposalId),
                },
                {
                    id: 'view_swap',
                    label: 'View Their Swap',
                    type: 'secondary',
                    action: () => this.navigateToSwap(target.sourceSwapId),
                },
            ]
        );
    }

    private handleTargetingUpdated(target: SwapTarget): void {
        if (!this.notificationPreferences.enableTargetingNotifications) {
            return;
        }

        this.createNotification(
            'retargeting_occurred',
            'Targeting Updated',
            `A targeting request has been updated.`,
            {
                targetId: target.id,
                sourceSwapId: target.sourceSwapId,
                targetSwapId: target.targetSwapId,
            }
        );
    }

    private handleTargetingRemoved(targetId: string): void {
        if (!this.notificationPreferences.enableTargetingNotifications) {
            return;
        }

        this.createNotification(
            'targeting_cancelled',
            'Targeting Cancelled',
            `A targeting request has been cancelled.`,
            {
                targetId,
            }
        );
    }

    private handleTargetStatusChanged(data: { targetId: string; status: string }): void {
        if (!this.notificationPreferences.enableTargetingNotifications) {
            return;
        }

        let title: string;
        let message: string;
        let type: TargetingNotification['type'];

        switch (data.status) {
            case 'accepted':
                title = 'Targeting Accepted';
                message = 'Your targeting request has been accepted!';
                type = 'targeting_accepted';
                break;
            case 'rejected':
                title = 'Targeting Rejected';
                message = 'Your targeting request has been rejected.';
                type = 'targeting_rejected';
                break;
            case 'cancelled':
                title = 'Targeting Cancelled';
                message = 'A targeting request has been cancelled.';
                type = 'targeting_cancelled';
                break;
            default:
                return; // Don't create notification for other statuses
        }

        this.createNotification(
            type,
            title,
            message,
            {
                targetId: data.targetId,
            }
        );
    }

    private handleAuctionTargetingUpdate(auctionInfo: any): void {
        if (!this.notificationPreferences.enableAuctionUpdates) {
            return;
        }

        this.createNotification(
            'auction_targeting_update',
            'Auction Update',
            `There has been an update to an auction you're targeting.`,
            {
                auctionInfo,
            }
        );
    }

    private handleProposalTargetingUpdate(proposalInfo: any): void {
        if (!this.notificationPreferences.enableProposalUpdates) {
            return;
        }

        this.createNotification(
            'proposal_from_targeting',
            'Proposal Update',
            `There has been an update to a proposal from targeting.`,
            {
                proposalInfo,
            }
        );
    }

    // Helper methods
    private shouldShowNotification(type: TargetingNotification['type']): boolean {
        switch (type) {
            case 'targeting_received':
            case 'targeting_accepted':
            case 'targeting_rejected':
            case 'targeting_cancelled':
            case 'retargeting_occurred':
                return this.notificationPreferences.enableTargetingNotifications;
            case 'auction_targeting_update':
                return this.notificationPreferences.enableAuctionUpdates;
            case 'proposal_from_targeting':
                return this.notificationPreferences.enableProposalUpdates;
            default:
                return true;
        }
    }

    private displayNotification(notification: TargetingNotification): void {
        // Log notification for debugging
        console.log('Targeting notification:', notification);

        // Fallback to browser notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id,
            });
        }
    }

    private getNotificationDisplayType(type: TargetingNotification['type']): 'success' | 'info' | 'warning' | 'error' {
        switch (type) {
            case 'targeting_accepted':
                return 'success';
            case 'targeting_rejected':
            case 'targeting_cancelled':
                return 'warning';
            case 'targeting_received':
            case 'retargeting_occurred':
            case 'auction_targeting_update':
            case 'proposal_from_targeting':
                return 'info';
            default:
                return 'info';
        }
    }

    private getNotificationDuration(type: TargetingNotification['type']): number {
        switch (type) {
            case 'targeting_accepted':
                return 8000; // 8 seconds for success
            case 'targeting_rejected':
            case 'targeting_cancelled':
                return 6000; // 6 seconds for warnings
            default:
                return 5000; // 5 seconds for info
        }
    }

    private generateNotificationId(): string {
        return `targeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private navigateToProposal(proposalId: string): void {
        // This should be implemented based on your routing system
        window.location.href = `/proposals/${proposalId}`;
    }

    private navigateToSwap(swapId: string): void {
        // This should be implemented based on your routing system
        window.location.href = `/swaps/${swapId}`;
    }

    private loadNotificationPreferences(): void {
        try {
            const saved = localStorage.getItem('targeting_notification_preferences');
            if (saved) {
                const preferences = JSON.parse(saved);
                this.notificationPreferences = { ...this.notificationPreferences, ...preferences };
            }
        } catch (error) {
            console.warn('Failed to load targeting notification preferences:', error);
        }
    }

    private saveNotificationPreferences(): void {
        try {
            localStorage.setItem(
                'targeting_notification_preferences',
                JSON.stringify(this.notificationPreferences)
            );
        } catch (error) {
            console.warn('Failed to save targeting notification preferences:', error);
        }
    }
}

// Export singleton instance
export const targetingNotificationService = new TargetingNotificationService();
export default targetingNotificationService;