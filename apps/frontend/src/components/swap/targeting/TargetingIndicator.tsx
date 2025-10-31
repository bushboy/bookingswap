import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/design-system/tokens';
import { IncomingTargetInfo, OutgoingTargetInfo, TargetingMode } from '@booking-swap/shared';
import { RootState } from '@/store';
import { selectIncomingTargets, selectOutgoingTarget, selectAuctionInfo } from '@/store/slices/targetingSlice';
import { useTargetingWebSocket } from '@/hooks/useTargetingWebSocket';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileTargetingIndicator } from './MobileTargetingIndicator';

export interface TargetingIndicatorProps {
    swapId: string;
    incomingTargets?: IncomingTargetInfo[];
    outgoingTarget?: OutgoingTargetInfo;
    mode?: TargetingMode;
    className?: string;
    size?: 'small' | 'medium' | 'large';
    showLabels?: boolean;
    enableRealTimeUpdates?: boolean;
    onTap?: () => void;
}

/**
 * Visual indicator component for swap targeting status
 * Shows incoming and outgoing targeting with different styles for auction vs one-for-one mode
 * Supports real-time updates via WebSocket
 */
export const TargetingIndicator: React.FC<TargetingIndicatorProps> = ({
    swapId,
    incomingTargets: propIncomingTargets = [],
    outgoingTarget: propOutgoingTarget,
    mode = 'one_for_one',
    className = '',
    size = 'medium',
    showLabels = true,
    enableRealTimeUpdates = true,
    onTap,
}) => {
    const { isMobile } = useResponsive();
    // Real-time data from Redux store
    const realtimeIncomingTargets = useSelector((state: RootState) =>
        selectIncomingTargets(state, swapId)
    );
    const realtimeOutgoingTarget = useSelector((state: RootState) =>
        selectOutgoingTarget(state, swapId)
    );
    const auctionInfo = useSelector((state: RootState) =>
        selectAuctionInfo(state, swapId)
    );

    // Animation state for smooth transitions
    const [isAnimating, setIsAnimating] = useState(false);
    const [previousCount, setPreviousCount] = useState(0);

    // Use real-time data if enabled, otherwise use props
    const incomingTargets = enableRealTimeUpdates ? realtimeIncomingTargets : propIncomingTargets;
    const outgoingTarget = enableRealTimeUpdates ? realtimeOutgoingTarget : propOutgoingTarget;

    // Initialize WebSocket connection for real-time updates
    const { isConnected } = useTargetingWebSocket({
        swapIds: enableRealTimeUpdates ? [swapId] : [],
        autoSubscribe: enableRealTimeUpdates,
        onTargetingProposalReceived: () => {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 500);
        },
        onTargetingStatusChanged: () => {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 500);
        },
    });

    const hasIncomingTargets = incomingTargets.length > 0;
    const hasOutgoingTarget = !!outgoingTarget;
    const isAuctionMode = mode === 'auction';

    // Animate count changes
    useEffect(() => {
        const currentCount = incomingTargets.length;
        if (currentCount !== previousCount && previousCount > 0) {
            setIsAnimating(true);
            setTimeout(() => setIsAnimating(false), 500);
        }
        setPreviousCount(currentCount);
    }, [incomingTargets.length, previousCount]);

    // Don't render if no targeting activity
    if (!hasIncomingTargets && !hasOutgoingTarget) {
        return null;
    }

    // Use mobile component on mobile devices
    if (isMobile) {
        return (
            <MobileTargetingIndicator
                swapId={swapId}
                incomingTargets={incomingTargets}
                outgoingTarget={outgoingTarget}
                mode={mode}
                compact={size === 'small'}
                showLabels={showLabels}
                onTap={onTap}
            />
        );
    }

    const containerStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        flexWrap: 'wrap' as const,
    };

    const getIncomingIndicatorProps = () => {
        const count = incomingTargets.length;
        const auctionCount = auctionInfo?.currentProposalCount || count;

        // Use auction count if available and in auction mode
        const displayCount = isAuctionMode && auctionInfo ? auctionCount : count;

        if (isAuctionMode) {
            const isEnding = auctionInfo?.isEnding;
            return {
                variant: (isEnding ? 'warning' : 'info') as const,
                children: (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[1],
                            transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                    >
                        <span>{isEnding ? '⏰' : '🎯'}</span>
                        <span style={{ fontWeight: 'bold' }}>{displayCount}</span>
                        {showLabels && <span>bid{displayCount !== 1 ? 's' : ''}</span>}
                        {auctionInfo?.timeRemaining && (
                            <span style={{ fontSize: '0.8em', opacity: 0.8 }}>
                                ({auctionInfo.timeRemaining})
                            </span>
                        )}
                    </div>
                ),
            };
        } else {
            return {
                variant: 'primary' as const,
                children: (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: tokens.spacing[1],
                            transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 0.3s ease-in-out',
                        }}
                    >
                        <span>📥</span>
                        <span style={{ fontWeight: 'bold' }}>{displayCount}</span>
                        {showLabels && <span>targeting</span>}
                    </div>
                ),
            };
        }
    };

    const getOutgoingIndicatorProps = () => {
        const status = outgoingTarget?.status;

        let variant: 'warning' | 'success' | 'info' | 'error' = 'warning';
        let icon = '📤';
        let label = 'targeting';

        if (status === 'accepted') {
            variant = 'success';
            icon = '✅';
            label = 'accepted';
        } else if (status === 'rejected') {
            variant = 'error';
            icon = '❌';
            label = 'rejected';
        } else if (status === 'cancelled') {
            variant = 'error';
            icon = '🚫';
            label = 'cancelled';
        } else if (status === 'active') {
            variant = isAuctionMode ? 'info' : 'warning';
            icon = isAuctionMode ? '🎯' : '📤';
            label = isAuctionMode ? 'bidding' : 'targeting';
        }

        return {
            variant,
            children: (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: tokens.spacing[1],
                        transform: isAnimating ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.3s ease-in-out',
                    }}
                >
                    <span>{icon}</span>
                    {showLabels && <span>{label}</span>}
                </div>
            ),
        };
    };

    // Responsive sizing based on screen size
    const responsiveStyles = {
        '@media (max-width: 768px)': {
            gap: tokens.spacing[1],
        },
    };

    // Desktop-specific styles
    const desktopContainerStyles = {
        ...containerStyles,
        ...responsiveStyles,
    };

    return (
        <div
            className={`targeting-indicator ${className} ${isAnimating ? 'animating' : ''}`}
            style={desktopContainerStyles}
            role="status"
            aria-label={`Targeting status: ${hasIncomingTargets ? `${incomingTargets.length} incoming` : ''} ${hasOutgoingTarget ? 'has outgoing' : ''}`}
            data-testid="targeting-indicator"
            onClick={onTap}
            onKeyDown={onTap ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTap();
                }
            } : undefined}
            tabIndex={onTap ? 0 : undefined}
        >
            {hasIncomingTargets && (
                <Badge
                    size={size}
                    {...getIncomingIndicatorProps()}
                    title={`${incomingTargets.length} ${isAuctionMode ? 'auction bids' : 'targeting proposals'} received${auctionInfo?.timeRemaining ? ` - ${auctionInfo.timeRemaining} remaining` : ''}`}
                />
            )}

            {hasOutgoingTarget && (
                <Badge
                    size={size}
                    {...getOutgoingIndicatorProps()}
                    title={`Currently ${outgoingTarget.status === 'active' ? 'targeting' : outgoingTarget.status} ${outgoingTarget.targetSwap?.bookingDetails?.title || 'Unknown Booking'}`}
                />
            )}

            {/* Connection status indicator (only show when disconnected) */}
            {enableRealTimeUpdates && !isConnected && (
                <Badge
                    size="small"
                    variant="error"
                    title="Real-time updates disconnected"
                >
                    <span style={{ fontSize: '0.8em' }}>⚠️</span>
                </Badge>
            )}
        </div>
    );
};

export default TargetingIndicator;