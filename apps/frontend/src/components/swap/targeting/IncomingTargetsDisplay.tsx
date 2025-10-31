import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { tokens } from '@/design-system/tokens';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { RootState } from '@/store';
import { selectIncomingTargets, selectAuctionInfo } from '@/store/slices/targetingSlice';
import { useTargetingWebSocket } from '@/hooks/useTargetingWebSocket';
import { useOptimisticTargeting } from '@/hooks/useOptimisticTargeting';
import { useResponsive } from '@/hooks/useResponsive';
import { MobileIncomingTargetsDisplay } from './MobileIncomingTargetsDisplay';

export interface IncomingTargetsDisplayProps {
    swapId: string;
    targets?: IncomingTargetInfo[];
    onAcceptTarget?: (targetId: string, proposalId: string) => Promise<void>;
    onRejectTarget?: (targetId: string, proposalId: string) => Promise<void>;
    className?: string;
    maxVisible?: number;
    showActions?: boolean;
    loading?: boolean;
    enableRealTimeUpdates?: boolean;
}

/**
 * Component for displaying incoming targeting proposals
 * Shows targeting user information, swap details, and accept/reject actions
 * Supports real-time updates via WebSocket
 */
export const IncomingTargetsDisplay: React.FC<IncomingTargetsDisplayProps> = ({
    swapId,
    targets: propTargets = [],
    onAcceptTarget,
    onRejectTarget,
    className = '',
    maxVisible = 5,
    showActions = true,
    loading = false,
    enableRealTimeUpdates = true,
}) => {
    const { isMobile } = useResponsive();
    const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
    const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
    const [newTargetIds, setNewTargetIds] = useState<Set<string>>(new Set());

    // Real-time data from Redux store
    const realtimeTargets = useSelector((state: RootState) =>
        selectIncomingTargets(state, swapId)
    );
    const auctionInfo = useSelector((state: RootState) =>
        selectAuctionInfo(state, swapId)
    );

    // Use real-time data if enabled, otherwise use props
    const targets = enableRealTimeUpdates ? realtimeTargets : propTargets;

    // Initialize optimistic targeting actions
    const {
        acceptTargetingProposal,
        rejectTargetingProposal,
        isActionPending,
    } = useOptimisticTargeting({
        enableOptimisticUpdates: true,
        showLoadingStates: true,
        retryOnFailure: true,
        maxRetries: 3,
    });

    // Initialize WebSocket connection for real-time updates
    const { isConnected } = useTargetingWebSocket({
        swapIds: enableRealTimeUpdates ? [swapId] : [],
        autoSubscribe: enableRealTimeUpdates,
        onTargetingProposalReceived: (data) => {
            // Highlight new targets for a brief period
            setNewTargetIds(prev => new Set([...prev, data.targetId]));
            setTimeout(() => {
                setNewTargetIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(data.targetId);
                    return newSet;
                });
            }, 3000);
        },
        onAuctionCountdownUpdate: () => {
            // Force re-render when auction countdown updates
        },
    });

    // Auto-expand new targets
    useEffect(() => {
        if (enableRealTimeUpdates && targets.length > 0) {
            const latestTarget = targets[0]; // Assuming newest targets are first
            if (latestTarget && !expandedTargets.has(latestTarget.targetId)) {
                setExpandedTargets(prev => new Set([...prev, latestTarget.targetId]));
            }
        }
    }, [targets.length, expandedTargets, enableRealTimeUpdates]);

    if (targets.length === 0) {
        return null;
    }

    // Use mobile component on mobile devices
    if (isMobile) {
        return (
            <MobileIncomingTargetsDisplay
                swapId={swapId}
                targets={targets}
                onAcceptTarget={onAcceptTarget}
                onRejectTarget={onRejectTarget}
                loading={loading}
                newTargetIds={newTargetIds}
            />
        );
    }

    const visibleTargets = targets.slice(0, maxVisible);
    const hasMore = targets.length > maxVisible;

    const toggleExpanded = (targetId: string) => {
        const newExpanded = new Set(expandedTargets);
        if (newExpanded.has(targetId)) {
            newExpanded.delete(targetId);
        } else {
            newExpanded.add(targetId);
        }
        setExpandedTargets(newExpanded);
    };

    const handleAction = async (
        action: 'accept' | 'reject',
        targetId: string,
        proposalId: string
    ) => {
        // Use optimistic updates for immediate feedback
        try {
            if (action === 'accept') {
                const result = await acceptTargetingProposal(swapId, targetId, proposalId);
                if (result.success && onAcceptTarget) {
                    // Call the original handler for any additional logic
                    await onAcceptTarget(targetId, proposalId);
                }
            } else {
                const result = await rejectTargetingProposal(swapId, targetId, proposalId);
                if (result.success && onRejectTarget) {
                    // Call the original handler for any additional logic
                    await onRejectTarget(targetId, proposalId);
                }
            }
        } catch (error) {
            console.error(`Failed to ${action} target:`, error);
        }
    };

    const formatTimeRemaining = (endDate: Date) => {
        const now = new Date();
        const diff = endDate.getTime() - now.getTime();

        if (diff <= 0) return 'Ended';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    };

    const getStatusBadgeProps = (target: IncomingTargetInfo) => {
        const { status } = target;

        // Use real-time auction info if available
        const targetAuctionInfo = auctionInfo || target.auctionInfo;

        if (targetAuctionInfo?.isAuction && targetAuctionInfo.endDate) {
            const timeRemaining = formatTimeRemaining(targetAuctionInfo.endDate);
            const isEnding = targetAuctionInfo.isEnding;
            return {
                variant: (timeRemaining === 'Ended' ? 'error' : isEnding ? 'warning' : 'info') as const,
                children: `Auction: ${timeRemaining}`,
            };
        }

        switch (status) {
            case 'active':
                return { variant: 'primary' as const, children: 'Active Proposal' };
            case 'accepted':
                return { variant: 'success' as const, children: 'Accepted' };
            case 'rejected':
                return { variant: 'error' as const, children: 'Rejected' };
            case 'cancelled':
                return { variant: 'error' as const, children: 'Cancelled' };
            default:
                return { variant: 'default' as const, children: String(status) };
        }
    };

    const targetItemStyles = {
        marginBottom: tokens.spacing[3],
        border: `1px solid ${tokens.colors.neutral[200]}`,
        borderRadius: tokens.borderRadius.lg,
        overflow: 'hidden' as const,
    };

    const targetHeaderStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.neutral[50],
        borderBottom: `1px solid ${tokens.colors.neutral[200]}`,
        cursor: 'pointer',
    };

    const userInfoStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
    };

    const avatarStyles = {
        width: '40px',
        height: '40px',
        borderRadius: tokens.borderRadius.full,
        backgroundColor: tokens.colors.primary[100],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: tokens.typography.fontSize.lg,
        fontWeight: tokens.typography.fontWeight.semibold,
        color: tokens.colors.primary[700],
    };

    const bookingDetailsStyles = {
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.white,
    };

    const detailRowStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: tokens.spacing[2],
        fontSize: tokens.typography.fontSize.sm,
        color: tokens.colors.neutral[600],
    };

    const actionsStyles = {
        display: 'flex',
        gap: tokens.spacing[2],
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.neutral[50],
        borderTop: `1px solid ${tokens.colors.neutral[200]}`,
        justifyContent: 'flex-end',
    };

    return (
        <Card className={`incoming-targets-display ${className}`} padding="none">
            <CardHeader>
                <CardTitle style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                    Incoming Targeting Proposals ({targets.length})
                    {enableRealTimeUpdates && !isConnected && (
                        <Badge variant="error" size="small" title="Real-time updates disconnected">
                            ⚠️
                        </Badge>
                    )}
                    {enableRealTimeUpdates && isConnected && newTargetIds.size > 0 && (
                        <Badge variant="success" size="small" title="New proposals received">
                            🔄
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>

            <CardContent style={{ padding: tokens.spacing[4] }}>
                {visibleTargets.map((target) => {
                    const isExpanded = expandedTargets.has(target.targetId);
                    const isActionLoading = actionLoading.has(target.targetId) ||
                        isActionPending('accept_target', target.targetId) ||
                        isActionPending('reject_target', target.targetId);
                    const isNewTarget = newTargetIds.has(target.targetId);
                    const statusProps = getStatusBadgeProps(target);

                    const itemStyles = {
                        ...targetItemStyles,
                        border: isNewTarget
                            ? `2px solid ${tokens.colors.primary[400]}`
                            : `1px solid ${tokens.colors.neutral[200]}`,
                        boxShadow: isNewTarget
                            ? `0 0 10px ${tokens.colors.primary[200]}`
                            : 'none',
                        transition: 'all 0.3s ease-in-out',
                    };

                    return (
                        <div key={target.targetId} style={itemStyles}>
                            <div
                                style={targetHeaderStyles}
                                onClick={() => toggleExpanded(target.targetId)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleExpanded(target.targetId);
                                    }
                                }}
                            >
                                <div style={userInfoStyles}>
                                    <div style={avatarStyles}>
                                        {target.sourceSwap.ownerAvatar ? (
                                            <img
                                                src={target.sourceSwap.ownerAvatar}
                                                alt={target.sourceSwap.ownerName}
                                                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
                                            />
                                        ) : (
                                            target.sourceSwap.ownerName.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div>
                                        <div style={{
                                            fontWeight: tokens.typography.fontWeight.semibold,
                                            color: tokens.colors.neutral[900],
                                        }}>
                                            {target.sourceSwap.ownerName}
                                        </div>
                                        <div style={{
                                            fontSize: tokens.typography.fontSize.sm,
                                            color: tokens.colors.neutral[600],
                                        }}>
                                            {target.sourceSwap.bookingDetails.title}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                                    <Badge {...statusProps} size="small" />
                                    <span style={{
                                        fontSize: tokens.typography.fontSize.sm,
                                        color: tokens.colors.neutral[500],
                                    }}>
                                        {isExpanded ? '▼' : '▶'}
                                    </span>
                                </div>
                            </div>

                            {isExpanded && (
                                <>
                                    <div style={bookingDetailsStyles}>
                                        <div style={detailRowStyles}>
                                            <span>Location:</span>
                                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                                {target.sourceSwap.bookingDetails.location.city}, {target.sourceSwap.bookingDetails.location.country}
                                            </span>
                                        </div>
                                        <div style={detailRowStyles}>
                                            <span>Check-in:</span>
                                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                                {new Date(target.sourceSwap.bookingDetails.dateRange.checkIn).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={detailRowStyles}>
                                            <span>Check-out:</span>
                                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                                {new Date(target.sourceSwap.bookingDetails.dateRange.checkOut).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={detailRowStyles}>
                                            <span>Proposed:</span>
                                            <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                                {new Date(target.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {(auctionInfo?.isAuction || target.auctionInfo?.isAuction) && (
                                            <>
                                                <div style={detailRowStyles}>
                                                    <span>Auction Proposals:</span>
                                                    <span style={{ fontWeight: tokens.typography.fontWeight.medium }}>
                                                        {auctionInfo?.currentProposalCount || target.auctionInfo?.currentProposalCount || 0}
                                                    </span>
                                                </div>
                                                {auctionInfo?.timeRemaining && (
                                                    <div style={detailRowStyles}>
                                                        <span>Time Remaining:</span>
                                                        <span style={{
                                                            fontWeight: tokens.typography.fontWeight.medium,
                                                            color: auctionInfo.isEnding ? tokens.colors.warning[600] : 'inherit'
                                                        }}>
                                                            {auctionInfo.timeRemaining}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {showActions && target.status === 'active' && (
                                        <div style={actionsStyles}>
                                            <Button
                                                variant="outline"
                                                size="small"
                                                onClick={() => handleAction('reject', target.targetId, target.proposalId)}
                                                disabled={isActionLoading || loading}
                                                loading={isActionLoading}
                                            >
                                                Reject
                                            </Button>
                                            <Button
                                                variant="primary"
                                                size="small"
                                                onClick={() => handleAction('accept', target.targetId, target.proposalId)}
                                                disabled={isActionLoading || loading}
                                                loading={isActionLoading}
                                            >
                                                Accept
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}

                {hasMore && (
                    <div style={{
                        textAlign: 'center',
                        padding: tokens.spacing[3],
                        color: tokens.colors.neutral[600],
                        fontSize: tokens.typography.fontSize.sm,
                    }}>
                        Showing {maxVisible} of {targets.length} proposals
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default IncomingTargetsDisplay;