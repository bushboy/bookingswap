import React, { useState, useEffect } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { IncomingTargetInfo, OutgoingTargetInfo } from '@booking-swap/shared';
import { mobileTargetingNotifications } from '@/services/mobileTargetingNotifications';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingStatusIndicatorsProps {
    swapId: string;
    incomingTargets: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    onStatusChange?: (type: 'incoming' | 'outgoing', status: string) => void;
    enableHapticFeedback?: boolean;
    enableNotifications?: boolean;
}

/**
 * Mobile-appropriate targeting status indicators
 * Features visual feedback, haptic feedback, and status animations
 */
export const MobileTargetingStatusIndicators: React.FC<MobileTargetingStatusIndicatorsProps> = ({
    swapId,
    incomingTargets,
    outgoingTarget,
    onStatusChange,
    enableHapticFeedback = true,
    enableNotifications = true,
}) => {
    const { isMobile } = useResponsive();
    const [animatingTargets, setAnimatingTargets] = useState<Set<string>>(new Set());
    const [previousIncomingCount, setPreviousIncomingCount] = useState(incomingTargets.length);
    const [previousOutgoingStatus, setPreviousOutgoingStatus] = useState(outgoingTarget?.status);

    // Don't render on desktop
    if (!isMobile) {
        return null;
    }

    // Handle incoming targets changes
    useEffect(() => {
        const currentCount = incomingTargets.length;

        if (currentCount > previousIncomingCount) {
            // New incoming targets
            const newTargets = incomingTargets.slice(0, currentCount - previousIncomingCount);

            newTargets.forEach(target => {
                // Add animation
                setAnimatingTargets(prev => new Set([...prev, target.targetId]));

                // Remove animation after delay
                setTimeout(() => {
                    setAnimatingTargets(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(target.targetId);
                        return newSet;
                    });
                }, 2000);

                // Provide haptic feedback
                if (enableHapticFeedback) {
                    mobileTargetingNotifications.provideHapticFeedback({ type: 'notification' });
                }

                // Show notification
                if (enableNotifications) {
                    mobileTargetingNotifications.showTargetingProposalNotification(target);
                }

                // Notify parent
                if (onStatusChange) {
                    onStatusChange('incoming', 'new_proposal');
                }
            });
        }

        setPreviousIncomingCount(currentCount);
    }, [incomingTargets.length, previousIncomingCount, enableHapticFeedback, enableNotifications, onStatusChange]);

    // Handle outgoing target status changes
    useEffect(() => {
        if (outgoingTarget && previousOutgoingStatus && outgoingTarget.status !== previousOutgoingStatus) {
            const newStatus = outgoingTarget.status;

            // Provide haptic feedback based on status
            if (enableHapticFeedback) {
                switch (newStatus) {
                    case 'accepted':
                        mobileTargetingNotifications.provideHapticFeedback({ type: 'heavy' });
                        break;
                    case 'rejected':
                        mobileTargetingNotifications.provideHapticFeedback({ type: 'medium' });
                        break;
                    case 'cancelled':
                        mobileTargetingNotifications.provideHapticFeedback({ type: 'light' });
                        break;
                }
            }

            // Show notification
            if (enableNotifications && ['accepted', 'rejected', 'cancelled'].includes(newStatus)) {
                mobileTargetingNotifications.showTargetingStatusNotification(
                    outgoingTarget,
                    newStatus as 'accepted' | 'rejected' | 'cancelled'
                );
            }

            // Show success/error message
            switch (newStatus) {
                case 'accepted':
                    mobileTargetingNotifications.showMobileSuccessMessage(
                        `🎉 ${outgoingTarget.targetSwap.ownerName} accepted your swap proposal!`
                    );
                    break;
                case 'rejected':
                    mobileTargetingNotifications.showMobileErrorMessage(
                        `${outgoingTarget.targetSwap.ownerName} rejected your swap proposal`,
                        {
                            text: 'Find New Target',
                            handler: () => {
                                // This would trigger the browse targets flow
                                console.log('Browse targets triggered');
                            }
                        }
                    );
                    break;
            }

            // Notify parent
            if (onStatusChange) {
                onStatusChange('outgoing', newStatus);
            }
        }

        setPreviousOutgoingStatus(outgoingTarget?.status);
    }, [outgoingTarget?.status, previousOutgoingStatus, enableHapticFeedback, enableNotifications, onStatusChange, outgoingTarget]);

    const getIncomingStatusIndicator = () => {
        if (incomingTargets.length === 0) return null;

        const activeTargets = incomingTargets.filter(t => t.status === 'active');
        const hasNewTargets = Array.from(animatingTargets).some(id =>
            incomingTargets.some(t => t.targetId === id)
        );

        return (
            <div className={`${styles['mobile-targeting-status-indicator']} ${hasNewTargets ? styles.pulsing : ''}`}>
                <div className={styles['mobile-targeting-status-icon']}>
                    📥
                </div>
                <div className={styles['mobile-targeting-status-content']}>
                    <div className={styles['mobile-targeting-status-title']}>
                        Incoming Proposals
                    </div>
                    <div className={styles['mobile-targeting-status-subtitle']}>
                        {activeTargets.length} active • {incomingTargets.length} total
                    </div>
                </div>
                {hasNewTargets && (
                    <div className={styles['mobile-targeting-status-badge']}>
                        New
                    </div>
                )}
            </div>
        );
    };

    const getOutgoingStatusIndicator = () => {
        if (!outgoingTarget) return null;

        const { status, targetSwap } = outgoingTarget;
        const isStatusChanged = animatingTargets.has(outgoingTarget.targetId);

        let statusIcon = '📤';
        let statusText = 'Targeting';
        let statusColor = 'neutral';

        switch (status) {
            case 'accepted':
                statusIcon = '✅';
                statusText = 'Accepted';
                statusColor = 'success';
                break;
            case 'rejected':
                statusIcon = '❌';
                statusText = 'Rejected';
                statusColor = 'error';
                break;
            case 'cancelled':
                statusIcon = '🚫';
                statusText = 'Cancelled';
                statusColor = 'error';
                break;
            case 'active':
                statusIcon = '🎯';
                statusText = 'Active';
                statusColor = 'primary';
                break;
        }

        return (
            <div className={`${styles['mobile-targeting-status-indicator']} ${styles[statusColor]} ${isStatusChanged ? styles.pulsing : ''}`}>
                <div className={styles['mobile-targeting-status-icon']}>
                    {statusIcon}
                </div>
                <div className={styles['mobile-targeting-status-content']}>
                    <div className={styles['mobile-targeting-status-title']}>
                        {statusText}
                    </div>
                    <div className={styles['mobile-targeting-status-subtitle']}>
                        {targetSwap.ownerName} • {targetSwap.bookingDetails.location.city}
                    </div>
                </div>
                {status === 'accepted' && (
                    <div className={styles['mobile-targeting-status-celebration']}>
                        🎉
                    </div>
                )}
            </div>
        );
    };

    const hasAnyTargeting = incomingTargets.length > 0 || outgoingTarget;

    if (!hasAnyTargeting) {
        return null;
    }

    return (
        <div className={styles['mobile-targeting-status-indicators']}>
            {getIncomingStatusIndicator()}
            {getOutgoingStatusIndicator()}
        </div>
    );
};

export default MobileTargetingStatusIndicators;