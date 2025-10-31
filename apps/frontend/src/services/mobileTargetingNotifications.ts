import { IncomingTargetInfo, OutgoingTargetInfo } from '@booking-swap/shared';

export interface MobileNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: any;
    actions?: NotificationAction[];
    requireInteraction?: boolean;
    silent?: boolean;
    vibrate?: number[];
}

export interface HapticFeedbackOptions {
    type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification';
    pattern?: number[];
}

/**
 * Mobile targeting notifications service
 * Handles push notifications, haptic feedback, and mobile-specific targeting feedback
 */
export class MobileTargetingNotificationsService {
    private static instance: MobileTargetingNotificationsService;
    private notificationPermission: NotificationPermission = 'default';
    private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
    private hapticSupported: boolean = false;

    private constructor() {
        this.initialize();
    }

    public static getInstance(): MobileTargetingNotificationsService {
        if (!MobileTargetingNotificationsService.instance) {
            MobileTargetingNotificationsService.instance = new MobileTargetingNotificationsService();
        }
        return MobileTargetingNotificationsService.instance;
    }

    private async initialize() {
        // Check notification permission
        if ('Notification' in window) {
            this.notificationPermission = Notification.permission;
        }

        // Check haptic feedback support
        this.hapticSupported = 'vibrate' in navigator || 'hapticFeedback' in navigator;

        // Register service worker for push notifications
        if ('serviceWorker' in navigator) {
            try {
                this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js');
            } catch (error) {
                console.warn('Service worker registration failed:', error);
            }
        }
    }

    /**
     * Request notification permission
     */
    public async requestNotificationPermission(): Promise<NotificationPermission> {
        if (!('Notification' in window)) {
            return 'denied';
        }

        if (this.notificationPermission === 'default') {
            this.notificationPermission = await Notification.requestPermission();
        }

        return this.notificationPermission;
    }

    /**
     * Show targeting proposal notification
     */
    public async showTargetingProposalNotification(target: IncomingTargetInfo): Promise<void> {
        if (this.notificationPermission !== 'granted') {
            return;
        }

        const options: MobileNotificationOptions = {
            title: 'New Targeting Proposal',
            body: `${target.sourceSwap.ownerName} wants to swap with your booking`,
            icon: '/icons/targeting-proposal.png',
            badge: '/icons/badge.png',
            tag: `targeting-proposal-${target.targetId}`,
            data: {
                type: 'targeting_proposal',
                targetId: target.targetId,
                proposalId: target.proposalId,
                swapId: target.targetSwapId,
            },
            actions: [
                {
                    action: 'accept',
                    title: 'Accept',
                    icon: '/icons/accept.png',
                },
                {
                    action: 'reject',
                    title: 'Reject',
                    icon: '/icons/reject.png',
                },
                {
                    action: 'view',
                    title: 'View Details',
                    icon: '/icons/view.png',
                },
            ],
            requireInteraction: true,
            vibrate: [200, 100, 200],
        };

        await this.showNotification(options);
    }

    /**
     * Show targeting status update notification
     */
    public async showTargetingStatusNotification(
        target: OutgoingTargetInfo,
        status: 'accepted' | 'rejected' | 'cancelled'
    ): Promise<void> {
        if (this.notificationPermission !== 'granted') {
            return;
        }

        const statusMessages = {
            accepted: {
                title: '🎉 Targeting Accepted!',
                body: `${target.targetSwap.ownerName} accepted your swap proposal`,
                vibrate: [100, 50, 100, 50, 100],
            },
            rejected: {
                title: '❌ Targeting Rejected',
                body: `${target.targetSwap.ownerName} rejected your swap proposal`,
                vibrate: [200],
            },
            cancelled: {
                title: '🚫 Targeting Cancelled',
                body: 'Your targeting proposal has been cancelled',
                vibrate: [150],
            },
        };

        const message = statusMessages[status];
        const options: MobileNotificationOptions = {
            title: message.title,
            body: message.body,
            icon: '/icons/targeting-status.png',
            badge: '/icons/badge.png',
            tag: `targeting-status-${target.targetId}`,
            data: {
                type: 'targeting_status',
                targetId: target.targetId,
                status,
                swapId: target.sourceSwapId,
            },
            actions: status === 'accepted' ? [
                {
                    action: 'view',
                    title: 'View Swap',
                    icon: '/icons/view.png',
                },
            ] : [
                {
                    action: 'browse',
                    title: 'Find New Target',
                    icon: '/icons/browse.png',
                },
            ],
            vibrate: message.vibrate,
        };

        await this.showNotification(options);
    }

    /**
     * Show auction countdown notification
     */
    public async showAuctionCountdownNotification(
        swapId: string,
        timeRemaining: string,
        proposalCount: number
    ): Promise<void> {
        if (this.notificationPermission !== 'granted') {
            return;
        }

        const options: MobileNotificationOptions = {
            title: '⏰ Auction Ending Soon',
            body: `${timeRemaining} left • ${proposalCount} proposals`,
            icon: '/icons/auction.png',
            badge: '/icons/badge.png',
            tag: `auction-countdown-${swapId}`,
            data: {
                type: 'auction_countdown',
                swapId,
                timeRemaining,
                proposalCount,
            },
            actions: [
                {
                    action: 'view',
                    title: 'View Proposals',
                    icon: '/icons/view.png',
                },
            ],
            vibrate: [100, 100, 100],
        };

        await this.showNotification(options);
    }

    /**
     * Provide haptic feedback for targeting actions
     */
    public async provideHapticFeedback(options: HapticFeedbackOptions): Promise<void> {
        if (!this.hapticSupported) {
            return;
        }

        try {
            // Use Web Vibration API
            if ('vibrate' in navigator) {
                let pattern: number[];

                switch (options.type) {
                    case 'light':
                        pattern = [50];
                        break;
                    case 'medium':
                        pattern = [100];
                        break;
                    case 'heavy':
                        pattern = [200];
                        break;
                    case 'selection':
                        pattern = [25];
                        break;
                    case 'impact':
                        pattern = [75, 25, 75];
                        break;
                    case 'notification':
                        pattern = [100, 50, 100];
                        break;
                    default:
                        pattern = options.pattern || [100];
                }

                navigator.vibrate(pattern);
            }

            // Use Haptic Feedback API if available (iOS Safari)
            if ('hapticFeedback' in navigator) {
                const hapticType = options.type === 'light' ? 'light' :
                    options.type === 'heavy' ? 'heavy' : 'medium';
                (navigator as any).hapticFeedback(hapticType);
            }
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
        }
    }

    /**
     * Show mobile-appropriate error message
     */
    public showMobileErrorMessage(
        message: string,
        action?: { text: string; handler: () => void }
    ): void {
        // Create mobile-friendly error toast
        const errorToast = document.createElement('div');
        errorToast.className = 'mobile-targeting-error-toast';
        errorToast.innerHTML = `
            <div class="mobile-targeting-error-content">
                <span class="mobile-targeting-error-icon">⚠️</span>
                <span class="mobile-targeting-error-message">${message}</span>
                ${action ? `<button class="mobile-targeting-error-action">${action.text}</button>` : ''}
                <button class="mobile-targeting-error-close">✕</button>
            </div>
        `;

        // Add styles
        const styles = `
            .mobile-targeting-error-toast {
                position: fixed;
                bottom: 1rem;
                left: 1rem;
                right: 1rem;
                background-color: #fee2e2;
                border: 1px solid #fecaca;
                border-radius: 0.5rem;
                padding: 1rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                animation: slideUp 0.3s ease-out;
            }
            
            .mobile-targeting-error-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .mobile-targeting-error-icon {
                font-size: 1.25rem;
                flex-shrink: 0;
            }
            
            .mobile-targeting-error-message {
                flex: 1;
                font-size: 0.875rem;
                color: #991b1b;
                line-height: 1.4;
            }
            
            .mobile-targeting-error-action,
            .mobile-targeting-error-close {
                background: none;
                border: none;
                font-size: 0.875rem;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 0.25rem;
                flex-shrink: 0;
            }
            
            .mobile-targeting-error-action {
                color: #dc2626;
                font-weight: 500;
                text-decoration: underline;
            }
            
            .mobile-targeting-error-close {
                color: #6b7280;
                font-size: 1rem;
            }
            
            .mobile-targeting-error-action:active,
            .mobile-targeting-error-close:active {
                background-color: rgba(0, 0, 0, 0.1);
            }
            
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;

        // Add styles to document
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Add event listeners
        const actionButton = errorToast.querySelector('.mobile-targeting-error-action');
        const closeButton = errorToast.querySelector('.mobile-targeting-error-close');

        if (actionButton && action) {
            actionButton.addEventListener('click', () => {
                action.handler();
                this.removeErrorToast(errorToast, styleSheet);
            });
        }

        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.removeErrorToast(errorToast, styleSheet);
            });
        }

        // Add to document
        document.body.appendChild(errorToast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (document.body.contains(errorToast)) {
                this.removeErrorToast(errorToast, styleSheet);
            }
        }, 5000);

        // Provide haptic feedback
        this.provideHapticFeedback({ type: 'notification' });
    }

    /**
     * Show mobile success message
     */
    public showMobileSuccessMessage(message: string): void {
        // Similar to error message but with success styling
        const successToast = document.createElement('div');
        successToast.className = 'mobile-targeting-success-toast';
        successToast.innerHTML = `
            <div class="mobile-targeting-success-content">
                <span class="mobile-targeting-success-icon">✅</span>
                <span class="mobile-targeting-success-message">${message}</span>
                <button class="mobile-targeting-success-close">✕</button>
            </div>
        `;

        // Add success-specific styles
        const styles = `
            .mobile-targeting-success-toast {
                position: fixed;
                bottom: 1rem;
                left: 1rem;
                right: 1rem;
                background-color: #dcfce7;
                border: 1px solid #bbf7d0;
                border-radius: 0.5rem;
                padding: 1rem;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                z-index: 1000;
                animation: slideUp 0.3s ease-out;
            }
            
            .mobile-targeting-success-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .mobile-targeting-success-icon {
                font-size: 1.25rem;
                flex-shrink: 0;
            }
            
            .mobile-targeting-success-message {
                flex: 1;
                font-size: 0.875rem;
                color: #166534;
                line-height: 1.4;
            }
            
            .mobile-targeting-success-close {
                background: none;
                border: none;
                color: #6b7280;
                font-size: 1rem;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 0.25rem;
                flex-shrink: 0;
            }
            
            .mobile-targeting-success-close:active {
                background-color: rgba(0, 0, 0, 0.1);
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        const closeButton = successToast.querySelector('.mobile-targeting-success-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.removeErrorToast(successToast, styleSheet);
            });
        }

        document.body.appendChild(successToast);

        setTimeout(() => {
            if (document.body.contains(successToast)) {
                this.removeErrorToast(successToast, styleSheet);
            }
        }, 3000);

        // Provide haptic feedback
        this.provideHapticFeedback({ type: 'light' });
    }

    private async showNotification(options: MobileNotificationOptions): Promise<void> {
        try {
            if (this.serviceWorkerRegistration) {
                // Use service worker for better notification handling
                await this.serviceWorkerRegistration.showNotification(options.title, options);
            } else {
                // Fallback to regular notification
                new Notification(options.title, options);
            }
        } catch (error) {
            console.warn('Failed to show notification:', error);
        }
    }

    private removeErrorToast(toast: HTMLElement, styleSheet: HTMLElement): void {
        toast.style.animation = 'slideDown 0.3s ease-in forwards';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
            if (document.head.contains(styleSheet)) {
                document.head.removeChild(styleSheet);
            }
        }, 300);
    }
}

// Export singleton instance
export const mobileTargetingNotifications = MobileTargetingNotificationsService.getInstance();