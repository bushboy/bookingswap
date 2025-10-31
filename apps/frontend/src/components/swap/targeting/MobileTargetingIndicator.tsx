import React from 'react';
import { IncomingTargetInfo, OutgoingTargetInfo, TargetingMode } from '@booking-swap/shared';
import { useResponsive } from '@/hooks/useResponsive';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingIndicatorProps {
    swapId: string;
    incomingTargets?: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    mode?: TargetingMode;
    compact?: boolean;
    showLabels?: boolean;
    onTap?: () => void;
}

/**
 * Mobile-optimized targeting indicator component
 * Displays targeting status with touch-friendly interface
 */
export const MobileTargetingIndicator: React.FC<MobileTargetingIndicatorProps> = ({
    swapId,
    incomingTargets = [],
    outgoingTarget,
    mode = 'one_for_one',
    compact = false,
    showLabels = true,
    onTap,
}) => {
    const { isMobile } = useResponsive();

    // Don't render on desktop or if no targeting activity
    if (!isMobile || (incomingTargets.length === 0 && !outgoingTarget)) {
        return null;
    }

    const hasIncomingTargets = incomingTargets.length > 0;
    const hasOutgoingTarget = !!outgoingTarget;
    const isAuctionMode = mode === 'auction';

    const getIncomingBadgeProps = () => {
        const count = incomingTargets.length;

        if (isAuctionMode) {
            return {
                className: `${styles['mobile-targeting-badge']} ${styles.auction}`,
                icon: '🎯',
                text: showLabels ? `${count} bid${count !== 1 ? 's' : ''}` : count.toString(),
            };
        } else {
            return {
                className: `${styles['mobile-targeting-badge']} ${styles.incoming}`,
                icon: '📥',
                text: showLabels ? `${count} targeting` : count.toString(),
            };
        }
    };

    const getOutgoingBadgeProps = () => {
        if (!outgoingTarget) return null;

        const { status } = outgoingTarget;

        let className = `${styles['mobile-targeting-badge']} `;
        let icon = '📤';
        let text = 'targeting';

        switch (status) {
            case 'accepted':
                className += styles.accepted;
                icon = '✅';
                text = 'accepted';
                break;
            case 'rejected':
                className += styles.rejected;
                icon = '❌';
                text = 'rejected';
                break;
            case 'cancelled':
                className += styles.rejected;
                icon = '🚫';
                text = 'cancelled';
                break;
            case 'active':
                if (isAuctionMode) {
                    className += styles.auction;
                    icon = '🎯';
                    text = 'bidding';
                } else {
                    className += styles.outgoing;
                    icon = '📤';
                    text = 'targeting';
                }
                break;
            default:
                className += styles.outgoing;
                break;
        }

        return {
            className,
            icon,
            text: showLabels ? text : '',
        };
    };

    const incomingProps = hasIncomingTargets ? getIncomingBadgeProps() : null;
    const outgoingProps = hasOutgoingTarget ? getOutgoingBadgeProps() : null;

    const containerClassName = `${styles['mobile-targeting-indicator']} ${compact ? styles.compact : ''}`;

    return (
        <div
            className={containerClassName}
            onClick={onTap}
            role={onTap ? 'button' : undefined}
            tabIndex={onTap ? 0 : undefined}
            onKeyDown={onTap ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTap();
                }
            } : undefined}
            aria-label={`Targeting status: ${hasIncomingTargets ? `${incomingTargets.length} incoming` : ''} ${hasOutgoingTarget ? 'has outgoing' : ''}`}
        >
            {incomingProps && (
                <div className={incomingProps.className}>
                    <span>{incomingProps.icon}</span>
                    {incomingProps.text && <span>{incomingProps.text}</span>}
                </div>
            )}

            {outgoingProps && (
                <div className={outgoingProps.className}>
                    <span>{outgoingProps.icon}</span>
                    {outgoingProps.text && <span>{outgoingProps.text}</span>}
                </div>
            )}
        </div>
    );
};

export default MobileTargetingIndicator;