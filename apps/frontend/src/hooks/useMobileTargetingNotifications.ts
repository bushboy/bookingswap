import { useEffect, useCallback, useState } from 'react';
import { useResponsive } from './useResponsive';
import { IncomingTargetInfo, OutgoingTargetInfo } from '@booking-swap/shared';
import { mobileTargetingNotifications } from '@/services/mobileTargetingNotifications';

export interface UseMobileTargetingNotificationsOptions {
    enablePushNotifications?: boolean;
    enableHapticFeedback?: boolean;
    enableToastMessages?: boolean;
    autoRequestPermission?: boolean;
}

export interface MobileTargetingNotificationsState {
    notificationPermission: NotificationPermission;
    hapticSupported: boolean;
    isInitialized: boolean;
}

/**
 * Hook for managing mobile targeting notifications and feedback
 */
export const useMobileTargetingNotifications = (
    options: UseMobileTargetingNotificationsOptions = {}
) => {
    const {
        enablePushNotifications = true,
        enableHapticFeedback = true,
        enableToastMessages = true,
        autoRequestPermission = false,
    } = options;

    const { isMobile } = useResponsive();
    const [state, setState] = useState<MobileTargetingNotificationsState>({
        notificationPermission: 'default',
        hapticSupported: false,
        isInitialized: false,
    });

    // Initialize notifications on mobile
    useEffect(() => {
        if (!isMobile) return;

        const initialize = async () => {
            // Check notification permission
            const permission = 'Notification' in window ? Notification.permission : 'denied';

            // Check haptic support
            const hapticSupported = 'vibrate' in navigator || 'hapticFeedback' in navigator;

            setState({
                notificationPermission: permission,
                hapticSupported,
                isInitialized: true,
            });

            // Auto-request permission if enabled
            if (autoRequestPermission && permission === 'default') {
                await requestNotificationPermission();
            }
        };

        initialize();
    }, [isMobile, autoRequestPermission]);

    /**
     * Request notification permission
     */
    const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!isMobile || !enablePushNotifications) {
            return 'denied';
        }

        const permission = await mobileTargetingNotifications.requestNotificationPermission();
        setState(prev => ({ ...prev, notificationPermission: permission }));
        return permission;
    }, [isMobile, enablePushNotifications]);

    /**
     * Show notification for new targeting proposal
     */
    const notifyTargetingProposal = useCallback(async (target: IncomingTargetInfo) => {
        if (!isMobile) return;

        if (enablePushNotifications && state.notificationPermission === 'granted') {
            await mobileTargetingNotifications.showTargetingProposalNotification(target);
        }

        if (enableHapticFeedback) {
            await mobileTargetingNotifications.provideHapticFeedback({ type: 'notification' });
        }

        if (enableToastMessages) {
            mobileTargetingNotifications.showMobileSuccessMessage(
                `New proposal from ${target.sourceSwap.ownerName}`
            );
        }
    }, [isMobile, enablePushNotifications, enableHapticFeedback, enableToastMessages, state.notificationPermission]);

    /**
     * Show notification for targeting status change
     */
    const notifyTargetingStatusChange = useCallback(async (
        target: OutgoingTargetInfo,
        status: 'accepted' | 'rejected' | 'cancelled'
    ) => {
        if (!isMobile) return;

        if (enablePushNotifications && state.notificationPermission === 'granted') {
            await mobileTargetingNotifications.showTargetingStatusNotification(target, status);
        }

        if (enableHapticFeedback) {
            const hapticType = status === 'accepted' ? 'heavy' :
                status === 'rejected' ? 'medium' : 'light';
            await mobileTargetingNotifications.provideHapticFeedback({ type: hapticType });
        }

        if (enableToastMessages) {
            const messages = {
                accepted: `🎉 ${target.targetSwap.ownerName} accepted your proposal!`,
                rejected: `${target.targetSwap.ownerName} rejected your proposal`,
                cancelled: 'Your targeting proposal was cancelled',
            };

            if (status === 'accepted') {
                mobileTargetingNotifications.showMobileSuccessMessage(messages[status]);
            } else {
                mobileTargetingNotifications.showMobileErrorMessage(
                    messages[status],
                    status === 'rejected' ? {
                        text: 'Find New Target',
                        handler: () => {
                            // This would trigger the browse targets flow
                            console.log('Browse targets triggered from notification');
                        }
                    } : undefined
                );
            }
        }
    }, [isMobile, enablePushNotifications, enableHapticFeedback, enableToastMessages, state.notificationPermission]);

    /**
     * Show auction countdown notification
     */
    const notifyAuctionCountdown = useCallback(async (
        swapId: string,
        timeRemaining: string,
        proposalCount: number
    ) => {
        if (!isMobile) return;

        if (enablePushNotifications && state.notificationPermission === 'granted') {
            await mobileTargetingNotifications.showAuctionCountdownNotification(
                swapId,
                timeRemaining,
                proposalCount
            );
        }

        if (enableHapticFeedback) {
            await mobileTargetingNotifications.provideHapticFeedback({ type: 'impact' });
        }

        if (enableToastMessages) {
            mobileTargetingNotifications.showMobileErrorMessage(
                `⏰ Auction ending in ${timeRemaining} • ${proposalCount} proposals`,
                {
                    text: 'View Proposals',
                    handler: () => {
                        // This would navigate to the proposals view
                        console.log('View proposals triggered from countdown');
                    }
                }
            );
        }
    }, [isMobile, enablePushNotifications, enableHapticFeedback, enableToastMessages, state.notificationPermission]);

    /**
     * Provide haptic feedback for targeting actions
     */
    const provideHapticFeedback = useCallback(async (
        type: 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification'
    ) => {
        if (!isMobile || !enableHapticFeedback || !state.hapticSupported) return;

        await mobileTargetingNotifications.provideHapticFeedback({ type });
    }, [isMobile, enableHapticFeedback, state.hapticSupported]);

    /**
     * Show success message
     */
    const showSuccessMessage = useCallback((message: string) => {
        if (!isMobile || !enableToastMessages) return;

        mobileTargetingNotifications.showMobileSuccessMessage(message);
    }, [isMobile, enableToastMessages]);

    /**
     * Show error message with optional action
     */
    const showErrorMessage = useCallback((
        message: string,
        action?: { text: string; handler: () => void }
    ) => {
        if (!isMobile || !enableToastMessages) return;

        mobileTargetingNotifications.showMobileErrorMessage(message, action);
    }, [isMobile, enableToastMessages]);

    /**
     * Handle targeting action feedback
     */
    const handleActionFeedback = useCallback(async (
        action: 'accept' | 'reject' | 'cancel' | 'retarget',
        success: boolean,
        targetName?: string
    ) => {
        if (!isMobile) return;

        if (success) {
            // Provide success feedback
            if (enableHapticFeedback) {
                const hapticType = action === 'accept' ? 'heavy' : 'medium';
                await provideHapticFeedback(hapticType);
            }

            if (enableToastMessages) {
                const messages = {
                    accept: `✅ Accepted proposal${targetName ? ` from ${targetName}` : ''}`,
                    reject: `❌ Rejected proposal${targetName ? ` from ${targetName}` : ''}`,
                    cancel: '🚫 Cancelled targeting',
                    retarget: '🎯 Retargeting initiated',
                };
                showSuccessMessage(messages[action]);
            }
        } else {
            // Provide error feedback
            if (enableHapticFeedback) {
                await provideHapticFeedback('notification');
            }

            if (enableToastMessages) {
                const messages = {
                    accept: 'Failed to accept proposal',
                    reject: 'Failed to reject proposal',
                    cancel: 'Failed to cancel targeting',
                    retarget: 'Failed to retarget',
                };
                showErrorMessage(messages[action], {
                    text: 'Retry',
                    handler: () => {
                        // This would retry the action
                        console.log(`Retry ${action} triggered`);
                    }
                });
            }
        }
    }, [isMobile, enableHapticFeedback, enableToastMessages, provideHapticFeedback, showSuccessMessage, showErrorMessage]);

    return {
        // State
        ...state,
        isSupported: isMobile,

        // Actions
        requestNotificationPermission,
        notifyTargetingProposal,
        notifyTargetingStatusChange,
        notifyAuctionCountdown,
        provideHapticFeedback,
        showSuccessMessage,
        showErrorMessage,
        handleActionFeedback,
    };
};