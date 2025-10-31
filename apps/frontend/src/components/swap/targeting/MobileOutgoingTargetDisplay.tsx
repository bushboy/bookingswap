import React, { useState, useEffect } from 'react';
import { OutgoingTargetInfo } from '@booking-swap/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { useOptimisticTargeting } from '@/hooks/useOptimisticTargeting';
import styles from './mobile-targeting.module.css';

export interface MobileOutgoingTargetDisplayProps {
    swapId: string;
    target: OutgoingTargetInfo;
    onRetarget?: (currentTargetId: string) => Promise<void>;
    onCancelTargeting?: (targetId: string) => Promise<void>;
    onBrowseTargets?: () => void;
    loading?: boolean;
    statusChanged?: boolean;
}

/**
 * Mobile-optimized component for displaying outgoing targeting status
 * Features collapsible sections and touch-friendly actions
 */
export const MobileOutgoingTargetDisplay: React.FC<MobileOutgoingTargetDisplayProps> = ({
    swapId,
    target,
    onRetarget,
    onCancelTargeting,
    onBrowseTargets,
    loading = false,
    statusChanged = false,
}) => {
    const { isMobile } = useResponsive();
    const [isExpanded, setIsExpanded] = useState(false);

    // Initialize optimistic targeting actions
    const {
        cancelTargeting,
        retargetSwap,
        isActionPending,
    } = useOptimisticTargeting({
        enableOptimisticUpdates: true,
        showLoadingStates: true,
        retryOnFailure: true,
        maxRetries: 3,
    });

    // Don't render on desktop or if no target
    if (!isMobile || !target) {
        return null;
    }

    // Auto-expand when status changes
    useEffect(() => {
        if (statusChanged) {
            setIsExpanded(true);
        }
    }, [statusChanged]);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const handleAction = async (action: 'retarget' | 'cancel') => {
        try {
            if (action === 'retarget') {
                if (onRetarget) {
                    await onRetarget(target.targetId);
                }
            } else {
                const result = await cancelTargeting(swapId, target.targetId);
                if (result.success && onCancelTargeting) {
                    await onCancelTargeting(target.targetId);
                }
            }
        } catch (error) {
            console.error(`Failed to ${action} targeting:`, error);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
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

    const getStatusBadgeClass = () => {
        const { status, targetSwapInfo } = target;

        if (targetSwapInfo.auctionInfo?.isAuction && targetSwapInfo.auctionInfo.endDate) {
            const timeRemaining = targetSwapInfo.auctionInfo.endDate.getTime() - Date.now();
            if (timeRemaining <= 0) {
                return styles.rejected;
            } else if (timeRemaining < 3600000) { // Less than 1 hour
                return styles.auction;
            } else {
                return styles.outgoing;
            }
        }

        switch (status) {
            case 'active':
                return styles.outgoing;
            case 'accepted':
                return styles.accepted;
            case 'rejected':
                return styles.rejected;
            case 'cancelled':
                return styles.rejected;
            default:
                return styles.outgoing;
        }
    };

    const getStatusText = () => {
        const { status, targetSwapInfo } = target;

        if (targetSwapInfo.auctionInfo?.isAuction && targetSwapInfo.auctionInfo.endDate) {
            const timeRemaining = formatTimeRemaining(targetSwapInfo.auctionInfo.endDate);
            return timeRemaining === 'Ended' ? 'Ended' : timeRemaining;
        }

        switch (status) {
            case 'active':
                return 'Active';
            case 'accepted':
                return 'Accepted';
            case 'rejected':
                return 'Rejected';
            case 'cancelled':
                return 'Cancelled';
            default:
                return status.charAt(0).toUpperCase() + status.slice(1);
        }
    };

    const getActionButtons = () => {
        const { status, targetSwapInfo } = target;
        const isAuction = targetSwapInfo.auctionInfo?.isAuction;
        const auctionEnded = isAuction && targetSwapInfo.auctionInfo?.endDate &&
            new Date() > targetSwapInfo.auctionInfo.endDate;

        const isActionLoading =
            isActionPending('cancel_target', target.targetId) ||
            isActionPending('retarget', target.targetId);

        if (status === 'accepted') {
            return (
                <div className={styles['mobile-targeting-actions']}>
                    <div className={`${styles['mobile-targeting-action']} ${styles.accepted}`}>
                        🎉 Proposal Accepted!
                    </div>
                </div>
            );
        }

        if (status === 'rejected' || auctionEnded) {
            return (
                <div className={styles['mobile-targeting-actions']}>
                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                        onClick={onBrowseTargets}
                        disabled={loading}
                        aria-label="Find new target"
                    >
                        Find New Target
                    </button>

                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.primary}`}
                        onClick={() => handleAction('retarget')}
                        disabled={loading || isActionLoading}
                        aria-label="Retarget to different swap"
                    >
                        {isActionLoading ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            'Retarget'
                        )}
                    </button>
                </div>
            );
        }

        if (status === 'active') {
            return (
                <div className={styles['mobile-targeting-actions']}>
                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.danger}`}
                        onClick={() => handleAction('cancel')}
                        disabled={loading || isActionLoading}
                        aria-label="Cancel targeting"
                    >
                        {isActionLoading ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            'Cancel'
                        )}
                    </button>

                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                        onClick={() => handleAction('retarget')}
                        disabled={loading || isActionLoading}
                        aria-label="Retarget to different swap"
                    >
                        {isActionLoading ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            'Retarget'
                        )}
                    </button>
                </div>
            );
        }

        return null;
    };

    const statusBadgeClass = getStatusBadgeClass();
    const statusText = getStatusText();

    return (
        <div className={styles['mobile-targeting-container']}>
            <div className={`${styles['mobile-targeting-section']} ${statusChanged ? styles.new : ''}`}>
                <div
                    className={styles['mobile-targeting-header']}
                    onClick={toggleExpanded}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleExpanded();
                        }
                    }}
                    aria-expanded={isExpanded}
                    aria-controls={`outgoing-target-${swapId}`}
                >
                    <div className={styles['mobile-targeting-header-content']}>
                        <h3 className={styles['mobile-targeting-title']}>
                            Currently Targeting
                        </h3>
                        {statusChanged && (
                            <div className={`${styles['mobile-targeting-badge']} ${styles.incoming}`}>
                                <span>🔄</span>
                                <span>Updated</span>
                            </div>
                        )}
                    </div>
                    <div className={`${styles['mobile-targeting-chevron']} ${isExpanded ? styles.expanded : ''}`}>
                        ▶
                    </div>
                </div>

                <div
                    id={`outgoing-target-${swapId}`}
                    className={`${styles['mobile-targeting-content']} ${!isExpanded ? styles.collapsed : ''}`}
                >
                    {loading ? (
                        <div className={styles['mobile-targeting-loading']}>
                            <div className={styles['mobile-targeting-spinner']} />
                            <span>Loading target...</span>
                        </div>
                    ) : (
                        <div className={styles['mobile-targeting-proposal']}>
                            <div className={styles['mobile-targeting-proposal-header']}>
                                <div className={styles['mobile-targeting-avatar']}>
                                    {target.targetSwap.ownerAvatar ? (
                                        <img
                                            src={target.targetSwap.ownerAvatar}
                                            alt={target.targetSwap.ownerName}
                                            style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                        />
                                    ) : (
                                        target.targetSwap.ownerName.charAt(0).toUpperCase()
                                    )}
                                </div>

                                <div className={styles['mobile-targeting-user-info']}>
                                    <h4 className={styles['mobile-targeting-user-name']}>
                                        {target.targetSwap.ownerName}
                                    </h4>
                                    <p className={styles['mobile-targeting-booking-title']}>
                                        {target.targetSwap.bookingDetails.title}
                                    </p>
                                </div>

                                <div className={styles['mobile-targeting-status']}>
                                    <div className={`${styles['mobile-targeting-badge']} ${statusBadgeClass}`}>
                                        <span>{statusText}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles['mobile-targeting-details']}>
                                <div className={styles['mobile-targeting-detail']}>
                                    <span className={styles['mobile-targeting-detail-label']}>Location</span>
                                    <span className={styles['mobile-targeting-detail-value']}>
                                        {target.targetSwap.bookingDetails.location.city}, {target.targetSwap.bookingDetails.location.country}
                                    </span>
                                </div>

                                <div className={styles['mobile-targeting-detail']}>
                                    <span className={styles['mobile-targeting-detail-label']}>Check-in</span>
                                    <span className={styles['mobile-targeting-detail-value']}>
                                        {formatDate(target.targetSwap.bookingDetails.dateRange.checkIn)}
                                    </span>
                                </div>

                                <div className={styles['mobile-targeting-detail']}>
                                    <span className={styles['mobile-targeting-detail-label']}>Check-out</span>
                                    <span className={styles['mobile-targeting-detail-value']}>
                                        {formatDate(target.targetSwap.bookingDetails.dateRange.checkOut)}
                                    </span>
                                </div>

                                <div className={styles['mobile-targeting-detail']}>
                                    <span className={styles['mobile-targeting-detail-label']}>Strategy</span>
                                    <span className={styles['mobile-targeting-detail-value']}>
                                        {target.targetSwapInfo.acceptanceStrategy.type === 'auction' ? 'Auction' : 'First Come'}
                                    </span>
                                </div>

                                <div className={styles['mobile-targeting-detail']}>
                                    <span className={styles['mobile-targeting-detail-label']}>Targeted</span>
                                    <span className={styles['mobile-targeting-detail-value']}>
                                        {formatDate(target.createdAt)}
                                    </span>
                                </div>

                                {target.updatedAt !== target.createdAt && (
                                    <div className={styles['mobile-targeting-detail']}>
                                        <span className={styles['mobile-targeting-detail-label']}>Updated</span>
                                        <span className={styles['mobile-targeting-detail-value']}>
                                            {formatDate(target.updatedAt)}
                                        </span>
                                    </div>
                                )}

                                {target.targetSwapInfo.auctionInfo?.isAuction && (
                                    <>
                                        <div className={styles['mobile-targeting-detail']}>
                                            <span className={styles['mobile-targeting-detail-label']}>Total Bids</span>
                                            <span className={styles['mobile-targeting-detail-value']}>
                                                {target.targetSwapInfo.auctionInfo.currentProposalCount || 0}
                                            </span>
                                        </div>

                                        {target.targetSwapInfo.auctionInfo.endDate && (
                                            <div className={styles['mobile-targeting-detail']}>
                                                <span className={styles['mobile-targeting-detail-label']}>Auction Ends</span>
                                                <span className={styles['mobile-targeting-detail-value']}>
                                                    {new Date(target.targetSwapInfo.auctionInfo.endDate).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {getActionButtons()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MobileOutgoingTargetDisplay;