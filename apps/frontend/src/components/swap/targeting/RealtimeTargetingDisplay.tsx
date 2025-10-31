import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../store';
import { useTargetingRealtime } from '../../../hooks/useTargetingRealtime';
import {
    selectSwapTargeting,
    selectTargetingConnectionStatus,
    selectUnreadTargetingCount,
    markTargetingAsRead,
    resetUnreadTargetingCount,
} from '../../../store/slices/targetingSlice';
import { SwapTargetStatus } from '@booking-swap/shared';
import './realtime-targeting-display.module.css';

interface RealtimeTargetingDisplayProps {
    swapId: string;
    userId?: string;
    showConnectionStatus?: boolean;
    enableOptimisticUpdates?: boolean;
    autoMarkAsRead?: boolean;
    className?: string;
}

interface TargetingActionButtonProps {
    targetId: string;
    action: 'accept' | 'reject' | 'retarget' | 'cancel';
    status: SwapTargetStatus;
    isOptimistic?: boolean;
    onAction: (targetId: string, action: string) => Promise<void>;
    disabled?: boolean;
}

const TargetingActionButton: React.FC<TargetingActionButtonProps> = ({
    targetId,
    action,
    status,
    isOptimistic = false,
    onAction,
    disabled = false,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = useCallback(async () => {
        if (disabled || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            await onAction(targetId, action);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Action failed');
        } finally {
            setIsLoading(false);
        }
    }, [targetId, action, onAction, disabled, isLoading]);

    const getButtonText = () => {
        if (isLoading) return 'Processing...';
        if (isOptimistic) return `${action} (pending)`;

        switch (action) {
            case 'accept': return 'Accept';
            case 'reject': return 'Reject';
            case 'retarget': return 'Retarget';
            case 'cancel': return 'Cancel';
            default: return action;
        }
    };

    const getButtonClass = () => {
        const baseClass = 'targeting-action-btn';
        const actionClass = `targeting-action-btn--${action}`;
        const stateClass = isOptimistic ? 'targeting-action-btn--optimistic' : '';
        const loadingClass = isLoading ? 'targeting-action-btn--loading' : '';
        const errorClass = error ? 'targeting-action-btn--error' : '';

        return [baseClass, actionClass, stateClass, loadingClass, errorClass]
            .filter(Boolean)
            .join(' ');
    };

    return (
        <div className="targeting-action-container">
            <button
                className={getButtonClass()}
                onClick={handleClick}
                disabled={disabled || isLoading}
                title={error || undefined}
            >
                {getButtonText()}
            </button>
            {error && (
                <div className="targeting-action-error" role="alert">
                    {error}
                </div>
            )}
        </div>
    );
};

interface ConnectionStatusIndicatorProps {
    isConnected: boolean;
    error?: string;
    hasOptimisticUpdates: boolean;
    hasFailedUpdates: boolean;
    retryCount: number;
}

const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
    isConnected,
    error,
    hasOptimisticUpdates,
    hasFailedUpdates,
    retryCount,
}) => {
    const getStatusClass = () => {
        if (!isConnected || error) return 'connection-status--error';
        if (hasFailedUpdates) return 'connection-status--warning';
        if (hasOptimisticUpdates) return 'connection-status--pending';
        return 'connection-status--connected';
    };

    const getStatusText = () => {
        if (!isConnected) return 'Disconnected';
        if (error) return `Error: ${error}`;
        if (hasFailedUpdates) return `${retryCount} retries`;
        if (hasOptimisticUpdates) return 'Updating...';
        return 'Connected';
    };

    const getStatusIcon = () => {
        if (!isConnected || error) return '⚠️';
        if (hasFailedUpdates) return '🔄';
        if (hasOptimisticUpdates) return '⏳';
        return '✅';
    };

    return (
        <div className={`connection-status ${getStatusClass()}`}>
            <span className="connection-status__icon" aria-hidden="true">
                {getStatusIcon()}
            </span>
            <span className="connection-status__text">
                {getStatusText()}
            </span>
        </div>
    );
};

export const RealtimeTargetingDisplay: React.FC<RealtimeTargetingDisplayProps> = ({
    swapId,
    userId,
    showConnectionStatus = true,
    enableOptimisticUpdates = true,
    autoMarkAsRead = true,
    className = '',
}) => {
    const dispatch = useDispatch<AppDispatch>();

    // Redux state
    const swapTargeting = useSelector((state: RootState) => selectSwapTargeting(state, swapId));
    const connectionStatus = useSelector(selectTargetingConnectionStatus);
    const unreadCount = useSelector(selectUnreadTargetingCount);

    // Real-time WebSocket hook
    const {
        isConnected,
        connectionError,
        subscribeToSwapTargeting,
        unsubscribeFromSwapTargeting,
        subscribeToUserTargeting,
        performOptimisticUpdate,
        optimisticUpdates,
        failedUpdates,
        markAsRead,
        hasOptimisticUpdates,
        hasFailedUpdates,
        retryCount,
    } = useTargetingRealtime({
        swapIds: [swapId],
        userId,
        autoSubscribe: true,
        enableOptimisticUpdates,
        retryFailedUpdates: true,
        maxRetries: 3,
        retryDelay: 2000,
    });

    // Local state for UI interactions
    const [expandedTargets, setExpandedTargets] = useState<Set<string>>(new Set());
    const [actionStates, setActionStates] = useState<Map<string, { loading: boolean; error?: string }>>(new Map());

    // Subscribe to targeting updates on mount
    useEffect(() => {
        subscribeToSwapTargeting([swapId]);
        if (userId) {
            subscribeToUserTargeting(userId);
        }

        return () => {
            unsubscribeFromSwapTargeting([swapId]);
        };
    }, [swapId, userId, subscribeToSwapTargeting, unsubscribeFromSwapTargeting, subscribeToUserTargeting]);

    // Auto-mark as read when component is visible
    useEffect(() => {
        if (autoMarkAsRead && swapTargeting?.incomingTargets.length > 0) {
            const timer = setTimeout(() => {
                dispatch(markTargetingAsRead({ swapId }));
            }, 2000); // Mark as read after 2 seconds

            return () => clearTimeout(timer);
        }
    }, [autoMarkAsRead, swapTargeting?.incomingTargets.length, swapId, dispatch]);

    // Handle targeting actions with optimistic updates
    const handleTargetingAction = useCallback(async (targetId: string, action: string) => {
        const actionKey = `${targetId}-${action}`;

        // Set loading state
        setActionStates(prev => new Map(prev).set(actionKey, { loading: true }));

        try {
            // Perform optimistic update
            if (enableOptimisticUpdates) {
                const optimisticData = {
                    status: action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'cancelled',
                    updatedAt: new Date(),
                };

                performOptimisticUpdate('update', swapId, targetId, optimisticData);
            }

            // Simulate API call (replace with actual service call)
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Mark as read
            markAsRead(targetId);

            // Clear loading state
            setActionStates(prev => {
                const newMap = new Map(prev);
                newMap.delete(actionKey);
                return newMap;
            });

        } catch (error) {
            // Set error state
            setActionStates(prev => new Map(prev).set(actionKey, {
                loading: false,
                error: error instanceof Error ? error.message : 'Action failed'
            }));

            // Re-throw to let the button handle it
            throw error;
        }
    }, [enableOptimisticUpdates, performOptimisticUpdate, swapId, markAsRead]);

    // Toggle target expansion
    const toggleTargetExpansion = useCallback((targetId: string) => {
        setExpandedTargets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(targetId)) {
                newSet.delete(targetId);
            } else {
                newSet.add(targetId);
            }
            return newSet;
        });
    }, []);

    // Memoized optimistic updates map for performance
    const optimisticUpdatesMap = useMemo(() => {
        return new Map(optimisticUpdates.map(update => [update.targetId, update]));
    }, [optimisticUpdates]);

    // Memoized failed updates map for performance
    const failedUpdatesMap = useMemo(() => {
        return new Map(failedUpdates.map(update => [update.targetId, update]));
    }, [failedUpdates]);

    // Check if a target has optimistic updates
    const hasOptimisticUpdate = useCallback((targetId: string) => {
        return optimisticUpdatesMap.has(targetId);
    }, [optimisticUpdatesMap]);

    // Check if a target has failed updates
    const hasFailedUpdate = useCallback((targetId: string) => {
        return failedUpdatesMap.has(targetId);
    }, [failedUpdatesMap]);

    if (!swapTargeting) {
        return (
            <div className={`realtime-targeting-display ${className}`}>
                <div className="targeting-loading">
                    Loading targeting information...
                </div>
            </div>
        );
    }

    const { incomingTargets, outgoingTarget, auctionInfo, events } = swapTargeting;

    return (
        <div className={`realtime-targeting-display ${className}`}>
            {showConnectionStatus && (
                <ConnectionStatusIndicator
                    isConnected={isConnected}
                    error={connectionError}
                    hasOptimisticUpdates={hasOptimisticUpdates}
                    hasFailedUpdates={hasFailedUpdates}
                    retryCount={retryCount}
                />
            )}

            {/* Unread count indicator */}
            {unreadCount > 0 && (
                <div className="unread-indicator">
                    <span className="unread-count">{unreadCount}</span>
                    <span className="unread-text">new targeting updates</span>
                    <button
                        className="mark-all-read-btn"
                        onClick={() => dispatch(resetUnreadTargetingCount())}
                    >
                        Mark all as read
                    </button>
                </div>
            )}

            {/* Incoming targets */}
            {incomingTargets.length > 0 && (
                <div className="targeting-section">
                    <h3 className="targeting-section__title">
                        Incoming Targets ({incomingTargets.length})
                    </h3>
                    <div className="targeting-list">
                        {incomingTargets.map(target => {
                            const isOptimistic = hasOptimisticUpdate(target.targetId);
                            const hasFailed = hasFailedUpdate(target.targetId);
                            const isExpanded = expandedTargets.has(target.targetId);
                            const actionState = actionStates.get(`${target.targetId}-accept`) ||
                                actionStates.get(`${target.targetId}-reject`);

                            return (
                                <div
                                    key={target.targetId}
                                    className={`targeting-item ${isOptimistic ? 'targeting-item--optimistic' : ''} ${hasFailed ? 'targeting-item--failed' : ''}`}
                                >
                                    <div className="targeting-item__header">
                                        <div className="targeting-item__info">
                                            <span className="targeting-item__title">
                                                {target.sourceSwap.title}
                                            </span>
                                            <span className="targeting-item__owner">
                                                by {target.sourceSwap.ownerName}
                                            </span>
                                            <span className={`targeting-item__status targeting-item__status--${target.status}`}>
                                                {target.status}
                                            </span>
                                        </div>
                                        <button
                                            className="targeting-item__toggle"
                                            onClick={() => toggleTargetExpansion(target.targetId)}
                                            aria-expanded={isExpanded}
                                        >
                                            {isExpanded ? '▼' : '▶'}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className="targeting-item__details">
                                            <div className="targeting-item__timestamps">
                                                <span>Created: {target.createdAt.toLocaleString()}</span>
                                                {target.updatedAt && (
                                                    <span>Updated: {target.updatedAt.toLocaleString()}</span>
                                                )}
                                            </div>

                                            {target.status === 'active' && (
                                                <div className="targeting-item__actions">
                                                    <TargetingActionButton
                                                        targetId={target.targetId}
                                                        action="accept"
                                                        status={target.status}
                                                        isOptimistic={isOptimistic}
                                                        onAction={handleTargetingAction}
                                                        disabled={actionState?.loading}
                                                    />
                                                    <TargetingActionButton
                                                        targetId={target.targetId}
                                                        action="reject"
                                                        status={target.status}
                                                        isOptimistic={isOptimistic}
                                                        onAction={handleTargetingAction}
                                                        disabled={actionState?.loading}
                                                    />
                                                </div>
                                            )}

                                            {hasFailed && (
                                                <div className="targeting-item__error" role="alert">
                                                    Update failed. Retrying...
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Outgoing target */}
            {outgoingTarget && (
                <div className="targeting-section">
                    <h3 className="targeting-section__title">Outgoing Target</h3>
                    <div className="targeting-item">
                        <div className="targeting-item__info">
                            <span className="targeting-item__title">
                                {outgoingTarget.targetSwap.title}
                            </span>
                            <span className="targeting-item__owner">
                                by {outgoingTarget.targetSwap.ownerName}
                            </span>
                            <span className={`targeting-item__status targeting-item__status--${outgoingTarget.status}`}>
                                {outgoingTarget.status}
                            </span>
                        </div>

                        {outgoingTarget.status === 'active' && (
                            <div className="targeting-item__actions">
                                <TargetingActionButton
                                    targetId={outgoingTarget.targetId}
                                    action="retarget"
                                    status={outgoingTarget.status}
                                    onAction={handleTargetingAction}
                                />
                                <TargetingActionButton
                                    targetId={outgoingTarget.targetId}
                                    action="cancel"
                                    status={outgoingTarget.status}
                                    onAction={handleTargetingAction}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Auction info */}
            {auctionInfo && (
                <div className="targeting-section">
                    <h3 className="targeting-section__title">Auction Status</h3>
                    <div className="auction-info">
                        <div className="auction-info__countdown">
                            Time remaining: {auctionInfo.timeRemaining}
                        </div>
                        <div className="auction-info__proposals">
                            Proposals: {auctionInfo.currentProposalCount}
                        </div>
                        {auctionInfo.isEnding && (
                            <div className="auction-info__ending" role="alert">
                                Auction ending soon!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Recent events */}
            {events.length > 0 && (
                <div className="targeting-section">
                    <h3 className="targeting-section__title">Recent Activity</h3>
                    <div className="targeting-events">
                        {events.slice(0, 5).map(event => (
                            <div key={event.id} className="targeting-event">
                                <span className="targeting-event__type">{event.type}</span>
                                <span className="targeting-event__time">
                                    {event.timestamp.toLocaleTimeString()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {incomingTargets.length === 0 && !outgoingTarget && (
                <div className="targeting-empty">
                    <p>No targeting activity for this swap.</p>
                </div>
            )}
        </div>
    );
};

export default RealtimeTargetingDisplay;