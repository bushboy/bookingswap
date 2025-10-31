import React, { useState, useEffect } from 'react';
import { IncomingTargetInfo } from '@booking-swap/shared';
import { useResponsive } from '@/hooks/useResponsive';
import { useOptimisticTargeting } from '@/hooks/useOptimisticTargeting';
import styles from './mobile-targeting.module.css';

export interface MobileIncomingTargetsDisplayProps {
    swapId: string;
    targets: IncomingTargetInfo[];
    onAcceptTarget?: (targetId: string, proposalId: string) => Promise<void>;
    onRejectTarget?: (targetId: string, proposalId: string) => Promise<void>;
    loading?: boolean;
    newTargetIds?: Set<string>;
}

/**
 * Mobile-optimized component for displaying incoming targeting proposals
 * Features collapsible sections and touch-friendly actions
 */
export const MobileIncomingTargetsDisplay: React.FC<MobileIncomingTargetsDisplayProps> = ({
    swapId,
    targets,
    onAcceptTarget,
    onRejectTarget,
    loading = false,
    newTargetIds = new Set(),
}) => {
    const { isMobile } = useResponsive();
    const [isExpanded, setIsExpanded] = useState(false);
    const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set());

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

    // Don't render on desktop or if no targets
    if (!isMobile || targets.length === 0) {
        return null;
    }

    // Auto-expand when new targets arrive
    useEffect(() => {
        if (newTargetIds.size > 0) {
            setIsExpanded(true);
            // Auto-expand new proposals
            const newExpanded = new Set(expandedProposals);
            newTargetIds.forEach(targetId => {
                newExpanded.add(targetId);
            });
            setExpandedProposals(newExpanded);
        }
    }, [newTargetIds, expandedProposals]);

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    const toggleProposalExpanded = (targetId: string) => {
        const newExpanded = new Set(expandedProposals);
        if (newExpanded.has(targetId)) {
            newExpanded.delete(targetId);
        } else {
            newExpanded.add(targetId);
        }
        setExpandedProposals(newExpanded);
    };

    const handleAction = async (
        action: 'accept' | 'reject',
        targetId: string,
        proposalId: string
    ) => {
        try {
            if (action === 'accept') {
                const result = await acceptTargetingProposal(swapId, targetId, proposalId);
                if (result.success && onAcceptTarget) {
                    await onAcceptTarget(targetId, proposalId);
                }
            } else {
                const result = await rejectTargetingProposal(swapId, targetId, proposalId);
                if (result.success && onRejectTarget) {
                    await onRejectTarget(targetId, proposalId);
                }
            }
        } catch (error) {
            console.error(`Failed to ${action} target:`, error);
        }
    };

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadgeClass = (target: IncomingTargetInfo) => {
        const { status } = target;

        if (target.auctionInfo?.isAuction) {
            const timeRemaining = target.auctionInfo.endDate ?
                target.auctionInfo.endDate.getTime() - Date.now() : 0;
            if (timeRemaining <= 0) {
                return styles.rejected;
            } else if (timeRemaining < 3600000) { // Less than 1 hour
                return styles.auction;
            } else {
                return styles.incoming;
            }
        }

        switch (status) {
            case 'active':
                return styles.incoming;
            case 'accepted':
                return styles.accepted;
            case 'rejected':
                return styles.rejected;
            case 'cancelled':
                return styles.rejected;
            default:
                return styles.incoming;
        }
    };

    const getStatusText = (target: IncomingTargetInfo) => {
        if (target.auctionInfo?.isAuction && target.auctionInfo.endDate) {
            const timeRemaining = target.auctionInfo.endDate.getTime() - Date.now();
            if (timeRemaining <= 0) return 'Ended';

            const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

            if (hours > 0) {
                return `${hours}h ${minutes}m`;
            } else {
                return `${minutes}m`;
            }
        }

        return target.status.charAt(0).toUpperCase() + target.status.slice(1);
    };

    return (
        <div className={styles['mobile-targeting-container']}>
            <div className={styles['mobile-targeting-section']}>
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
                    aria-controls={`incoming-targets-${swapId}`}
                >
                    <div className={styles['mobile-targeting-header-content']}>
                        <h3 className={styles['mobile-targeting-title']}>
                            Incoming Proposals
                        </h3>
                        <div className={styles['mobile-targeting-count']}>
                            {targets.length}
                        </div>
                        {newTargetIds.size > 0 && (
                            <div className={`${styles['mobile-targeting-badge']} ${styles.incoming}`}>
                                <span>🔄</span>
                                <span>New</span>
                            </div>
                        )}
                    </div>
                    <div className={`${styles['mobile-targeting-chevron']} ${isExpanded ? styles.expanded : ''}`}>
                        ▶
                    </div>
                </div>

                <div
                    id={`incoming-targets-${swapId}`}
                    className={`${styles['mobile-targeting-content']} ${!isExpanded ? styles.collapsed : ''}`}
                >
                    {loading ? (
                        <div className={styles['mobile-targeting-loading']}>
                            <div className={styles['mobile-targeting-spinner']} />
                            <span>Loading proposals...</span>
                        </div>
                    ) : (
                        targets.map((target) => {
                            const isProposalExpanded = expandedProposals.has(target.targetId);
                            const isActionLoading =
                                isActionPending('accept_target', target.targetId) ||
                                isActionPending('reject_target', target.targetId);
                            const isNewTarget = newTargetIds.has(target.targetId);
                            const statusBadgeClass = getStatusBadgeClass(target);
                            const statusText = getStatusText(target);

                            return (
                                <div
                                    key={target.targetId}
                                    className={`${styles['mobile-targeting-proposal']} ${isNewTarget ? styles.new : ''}`}
                                >
                                    <div
                                        className={styles['mobile-targeting-proposal-header']}
                                        onClick={() => toggleProposalExpanded(target.targetId)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                toggleProposalExpanded(target.targetId);
                                            }
                                        }}
                                    >
                                        <div className={styles['mobile-targeting-avatar']}>
                                            {target.sourceSwap.ownerAvatar ? (
                                                <img
                                                    src={target.sourceSwap.ownerAvatar}
                                                    alt={target.sourceSwap.ownerName}
                                                    style={{ width: '100%', height: '100%', borderRadius: '50%' }}
                                                />
                                            ) : (
                                                target.sourceSwap.ownerName.charAt(0).toUpperCase()
                                            )}
                                        </div>

                                        <div className={styles['mobile-targeting-user-info']}>
                                            <h4 className={styles['mobile-targeting-user-name']}>
                                                {target.sourceSwap.ownerName}
                                            </h4>
                                            <p className={styles['mobile-targeting-booking-title']}>
                                                {target.sourceSwap.bookingDetails.title}
                                            </p>
                                        </div>

                                        <div className={styles['mobile-targeting-status']}>
                                            <div className={`${styles['mobile-targeting-badge']} ${statusBadgeClass}`}>
                                                <span>{statusText}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {isProposalExpanded && (
                                        <>
                                            <div className={styles['mobile-targeting-details']}>
                                                <div className={styles['mobile-targeting-detail']}>
                                                    <span className={styles['mobile-targeting-detail-label']}>Location</span>
                                                    <span className={styles['mobile-targeting-detail-value']}>
                                                        {target.sourceSwap.bookingDetails.location.city}, {target.sourceSwap.bookingDetails.location.country}
                                                    </span>
                                                </div>

                                                <div className={styles['mobile-targeting-detail']}>
                                                    <span className={styles['mobile-targeting-detail-label']}>Check-in</span>
                                                    <span className={styles['mobile-targeting-detail-value']}>
                                                        {formatDate(target.sourceSwap.bookingDetails.dateRange.checkIn)}
                                                    </span>
                                                </div>

                                                <div className={styles['mobile-targeting-detail']}>
                                                    <span className={styles['mobile-targeting-detail-label']}>Check-out</span>
                                                    <span className={styles['mobile-targeting-detail-value']}>
                                                        {formatDate(target.sourceSwap.bookingDetails.dateRange.checkOut)}
                                                    </span>
                                                </div>

                                                <div className={styles['mobile-targeting-detail']}>
                                                    <span className={styles['mobile-targeting-detail-label']}>Proposed</span>
                                                    <span className={styles['mobile-targeting-detail-value']}>
                                                        {formatDate(target.createdAt)}
                                                    </span>
                                                </div>

                                                {target.auctionInfo?.isAuction && (
                                                    <>
                                                        <div className={styles['mobile-targeting-detail']}>
                                                            <span className={styles['mobile-targeting-detail-label']}>Total Bids</span>
                                                            <span className={styles['mobile-targeting-detail-value']}>
                                                                {target.auctionInfo.currentProposalCount || 0}
                                                            </span>
                                                        </div>

                                                        {target.auctionInfo.endDate && (
                                                            <div className={styles['mobile-targeting-detail']}>
                                                                <span className={styles['mobile-targeting-detail-label']}>Auction Ends</span>
                                                                <span className={styles['mobile-targeting-detail-value']}>
                                                                    {new Date(target.auctionInfo.endDate).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {target.status === 'active' && (
                                                <div className={styles['mobile-targeting-actions']}>
                                                    <button
                                                        className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                                                        onClick={() => handleAction('reject', target.targetId, target.proposalId)}
                                                        disabled={isActionLoading || loading}
                                                        aria-label={`Reject proposal from ${target.sourceSwap.ownerName}`}
                                                    >
                                                        {isActionLoading ? (
                                                            <div className={styles['mobile-targeting-spinner']} />
                                                        ) : (
                                                            'Reject'
                                                        )}
                                                    </button>

                                                    <button
                                                        className={`${styles['mobile-targeting-action']} ${styles.primary}`}
                                                        onClick={() => handleAction('accept', target.targetId, target.proposalId)}
                                                        disabled={isActionLoading || loading}
                                                        aria-label={`Accept proposal from ${target.sourceSwap.ownerName}`}
                                                    >
                                                        {isActionLoading ? (
                                                            <div className={styles['mobile-targeting-spinner']} />
                                                        ) : (
                                                            'Accept'
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default MobileIncomingTargetsDisplay;