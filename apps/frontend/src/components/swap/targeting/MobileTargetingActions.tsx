import React, { useState, useRef } from 'react';
import { useResponsive } from '@/hooks/useResponsive';
import { useOptimisticTargeting } from '@/hooks/useOptimisticTargeting';
import { IncomingTargetInfo, OutgoingTargetInfo } from '@booking-swap/shared';
import { MobileTargetingConfirmation } from './MobileTargetingConfirmation';
import styles from './mobile-targeting.module.css';

export interface MobileTargetingActionsProps {
    swapId: string;
    target?: IncomingTargetInfo | OutgoingTargetInfo;
    type: 'incoming' | 'outgoing';
    onAccept?: (targetId: string, proposalId: string) => Promise<void>;
    onReject?: (targetId: string, proposalId: string) => Promise<void>;
    onRetarget?: (targetId: string) => Promise<void>;
    onCancel?: (targetId: string) => Promise<void>;
    onBrowse?: () => void;
    loading?: boolean;
    disabled?: boolean;
    enableSwipeGestures?: boolean;
}

/**
 * Mobile-optimized targeting actions component
 * Features touch-friendly buttons, swipe gestures, and confirmation dialogs
 */
export const MobileTargetingActions: React.FC<MobileTargetingActionsProps> = ({
    swapId,
    target,
    type,
    onAccept,
    onReject,
    onRetarget,
    onCancel,
    onBrowse,
    loading = false,
    disabled = false,
    enableSwipeGestures = true,
}) => {
    const { isMobile } = useResponsive();
    const [showConfirmation, setShowConfirmation] = useState<string | null>(null);
    const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

    const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize optimistic targeting actions
    const {
        acceptTargetingProposal,
        rejectTargetingProposal,
        cancelTargeting,
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

    // Touch event handlers for swipe gestures
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!enableSwipeGestures || disabled || loading) return;

        const touch = e.touches[0];
        touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            time: Date.now(),
        };
        setSwipeDirection(null);
        setSwipeDistance(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!enableSwipeGestures || !touchStartRef.current || disabled || loading) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = touch.clientY - touchStartRef.current.y;

        // Only handle horizontal swipes
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 20) {
            e.preventDefault();

            const direction = deltaX > 0 ? 'right' : 'left';
            setSwipeDirection(direction);

            // Visual feedback for swipe
            if (containerRef.current) {
                const maxSwipe = 100;
                const clampedDistance = Math.min(Math.abs(deltaX), maxSwipe);
                const opacity = clampedDistance / maxSwipe;

                if (direction === 'right' && type === 'incoming') {
                    // Swipe right to accept
                    containerRef.current.style.backgroundColor = `rgba(34, 197, 94, ${opacity * 0.2})`;
                    containerRef.current.style.borderColor = `rgba(34, 197, 94, ${opacity})`;
                } else if (direction === 'left' && type === 'incoming') {
                    // Swipe left to reject
                    containerRef.current.style.backgroundColor = `rgba(239, 68, 68, ${opacity * 0.2})`;
                    containerRef.current.style.borderColor = `rgba(239, 68, 68, ${opacity})`;
                } else if (direction === 'left' && type === 'outgoing') {
                    // Swipe left to cancel
                    containerRef.current.style.backgroundColor = `rgba(239, 68, 68, ${opacity * 0.2})`;
                    containerRef.current.style.borderColor = `rgba(239, 68, 68, ${opacity})`;
                }
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!enableSwipeGestures || !touchStartRef.current || disabled || loading) return;

        const touchEnd = e.changedTouches[0];
        const deltaX = touchEnd.clientX - touchStartRef.current.x;
        const deltaTime = Date.now() - touchStartRef.current.time;

        // Reset visual feedback
        if (containerRef.current) {
            containerRef.current.style.backgroundColor = '';
            containerRef.current.style.borderColor = '';
        }

        // Check if swipe was significant enough
        const isSignificantSwipe = Math.abs(deltaX) > 80 && deltaTime < 500;

        if (isSignificantSwipe && swipeDirection) {
            if (type === 'incoming') {
                if (swipeDirection === 'right' && onAccept) {
                    handleAction('accept');
                } else if (swipeDirection === 'left' && onReject) {
                    handleAction('reject');
                }
            } else if (type === 'outgoing') {
                if (swipeDirection === 'left' && onCancel) {
                    handleAction('cancel');
                }
            }
        }

        touchStartRef.current = null;
        setSwipeDirection(null);
    };

    const handleAction = async (action: string) => {
        if (!target || disabled || loading) return;

        // Show confirmation for destructive actions
        if (['reject', 'cancel'].includes(action)) {
            setShowConfirmation(action);
            return;
        }

        await executeAction(action);
    };

    const executeAction = async (action: string) => {
        if (!target) return;

        try {
            switch (action) {
                case 'accept':
                    if (type === 'incoming' && onAccept) {
                        const result = await acceptTargetingProposal(swapId, target.targetId, target.proposalId);
                        if (result.success) {
                            await onAccept(target.targetId, target.proposalId);
                        }
                    }
                    break;

                case 'reject':
                    if (type === 'incoming' && onReject) {
                        const result = await rejectTargetingProposal(swapId, target.targetId, target.proposalId);
                        if (result.success) {
                            await onReject(target.targetId, target.proposalId);
                        }
                    }
                    break;

                case 'retarget':
                    if (type === 'outgoing' && onRetarget) {
                        await onRetarget(target.targetId);
                    }
                    break;

                case 'cancel':
                    if (type === 'outgoing' && onCancel) {
                        const result = await cancelTargeting(swapId, target.targetId);
                        if (result.success) {
                            await onCancel(target.targetId);
                        }
                    }
                    break;
            }
        } catch (error) {
            console.error(`Failed to ${action} targeting:`, error);
        } finally {
            setShowConfirmation(null);
        }
    };

    const getActionButtons = () => {
        if (type === 'incoming') {
            const incomingTarget = target as IncomingTargetInfo;

            if (incomingTarget.status !== 'active') {
                return null;
            }

            return (
                <>
                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                        onClick={() => handleAction('reject')}
                        disabled={disabled || loading || isActionPending('reject_target', target.targetId)}
                        aria-label={`Reject proposal from ${incomingTarget.sourceSwap.ownerName}`}
                    >
                        {isActionPending('reject_target', target.targetId) ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            <>
                                <span>❌</span>
                                <span>Reject</span>
                            </>
                        )}
                    </button>

                    <button
                        className={`${styles['mobile-targeting-action']} ${styles.primary}`}
                        onClick={() => handleAction('accept')}
                        disabled={disabled || loading || isActionPending('accept_target', target.targetId)}
                        aria-label={`Accept proposal from ${incomingTarget.sourceSwap.ownerName}`}
                    >
                        {isActionPending('accept_target', target.targetId) ? (
                            <div className={styles['mobile-targeting-spinner']} />
                        ) : (
                            <>
                                <span>✅</span>
                                <span>Accept</span>
                            </>
                        )}
                    </button>
                </>
            );
        } else {
            const outgoingTarget = target as OutgoingTargetInfo;
            const { status, targetSwapInfo } = outgoingTarget;
            const isAuction = targetSwapInfo.auctionInfo?.isAuction;
            const auctionEnded = isAuction && targetSwapInfo.auctionInfo?.endDate &&
                new Date() > targetSwapInfo.auctionInfo.endDate;

            if (status === 'accepted') {
                return (
                    <div className={`${styles['mobile-targeting-action']} ${styles.accepted}`}>
                        <span>🎉</span>
                        <span>Proposal Accepted!</span>
                    </div>
                );
            }

            if (status === 'rejected' || auctionEnded) {
                return (
                    <>
                        <button
                            className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                            onClick={onBrowse}
                            disabled={disabled || loading}
                            aria-label="Find new target"
                        >
                            <span>🔍</span>
                            <span>Find New</span>
                        </button>

                        <button
                            className={`${styles['mobile-targeting-action']} ${styles.primary}`}
                            onClick={() => handleAction('retarget')}
                            disabled={disabled || loading || isActionPending('retarget', target.targetId)}
                            aria-label="Retarget to different swap"
                        >
                            {isActionPending('retarget', target.targetId) ? (
                                <div className={styles['mobile-targeting-spinner']} />
                            ) : (
                                <>
                                    <span>🎯</span>
                                    <span>Retarget</span>
                                </>
                            )}
                        </button>
                    </>
                );
            }

            if (status === 'active') {
                return (
                    <>
                        <button
                            className={`${styles['mobile-targeting-action']} ${styles.danger}`}
                            onClick={() => handleAction('cancel')}
                            disabled={disabled || loading || isActionPending('cancel_target', target.targetId)}
                            aria-label="Cancel targeting"
                        >
                            {isActionPending('cancel_target', target.targetId) ? (
                                <div className={styles['mobile-targeting-spinner']} />
                            ) : (
                                <>
                                    <span>🚫</span>
                                    <span>Cancel</span>
                                </>
                            )}
                        </button>

                        <button
                            className={`${styles['mobile-targeting-action']} ${styles.secondary}`}
                            onClick={() => handleAction('retarget')}
                            disabled={disabled || loading || isActionPending('retarget', target.targetId)}
                            aria-label="Retarget to different swap"
                        >
                            {isActionPending('retarget', target.targetId) ? (
                                <div className={styles['mobile-targeting-spinner']} />
                            ) : (
                                <>
                                    <span>🎯</span>
                                    <span>Retarget</span>
                                </>
                            )}
                        </button>
                    </>
                );
            }

            return null;
        }
    };

    const getConfirmationProps = () => {
        if (!showConfirmation) return null;

        const actionText = showConfirmation === 'reject' ? 'reject this proposal' : 'cancel targeting';
        const actionIcon = showConfirmation === 'reject' ? '❌' : '🚫';
        const confirmText = showConfirmation === 'reject' ? 'Reject' : 'Cancel';

        return {
            title: 'Confirm Action',
            message: `Are you sure you want to ${actionText}?`,
            confirmText,
            confirmVariant: 'danger' as const,
            icon: actionIcon,
        };
    };

    const actionButtons = getActionButtons();

    if (!actionButtons) {
        return null;
    }

    return (
        <>
            <div
                ref={containerRef}
                className={styles['mobile-targeting-actions']}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transition: swipeDirection ? 'none' : 'all 0.2s ease',
                }}
            >
                {enableSwipeGestures && type === 'incoming' && (
                    <div className={styles['mobile-targeting-swipe-hint']}>
                        <span>← Swipe left to reject • Swipe right to accept →</span>
                    </div>
                )}

                {enableSwipeGestures && type === 'outgoing' && (
                    <div className={styles['mobile-targeting-swipe-hint']}>
                        <span>← Swipe left to cancel</span>
                    </div>
                )}

                {actionButtons}
            </div>

            {showConfirmation && (
                <MobileTargetingConfirmation
                    isOpen={!!showConfirmation}
                    {...getConfirmationProps()!}
                    onConfirm={() => executeAction(showConfirmation)}
                    onCancel={() => setShowConfirmation(null)}
                    loading={loading}
                />
            )}
        </>
    );
};

export default MobileTargetingActions;