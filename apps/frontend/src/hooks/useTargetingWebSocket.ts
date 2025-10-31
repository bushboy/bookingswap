import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { useWebSocket } from './useWebSocket';
import {
    addNotification,
    updateNotificationStatus,
} from '../store/slices/notificationSlice';
import {
    updateSwapTargeting,
    addTargetingEvent,
    updateTargetingStatus,
    addIncomingTarget,
    removeIncomingTarget,
    updateOutgoingTarget,
    removeOutgoingTarget,
    updateAuctionCountdown,
} from '../store/slices/targetingSlice';

interface TargetingUpdateData {
    type: string;
    targetId: string;
    sourceSwapId: string;
    targetSwapId: string;
    sourceSwapTitle?: string;
    targetSwapTitle?: string;
    sourceUserName?: string;
    status?: string;
    reason?: string;
    updateType?: string;
    auctionInfo?: {
        endDate: Date;
        currentProposalCount: number;
        timeRemaining: string;
        isEnding: boolean;
    };
}

interface TargetingNotificationData {
    id: string;
    type: string;
    title: string;
    message: string;
    data: TargetingUpdateData;
    timestamp: Date;
    read: boolean;
}

interface UseTargetingWebSocketOptions {
    swapIds?: string[];
    autoSubscribe?: boolean;
    onTargetingProposalReceived?: (data: TargetingUpdateData) => void;
    onTargetingStatusChanged?: (data: TargetingUpdateData) => void;
    onTargetingRetargeted?: (data: TargetingUpdateData) => void;
    onAuctionCountdownUpdate?: (data: TargetingUpdateData) => void;
}

export const useTargetingWebSocket = (options: UseTargetingWebSocketOptions = {}) => {
    const dispatch = useDispatch<AppDispatch>();
    const { swapIds = [], autoSubscribe = true } = options;

    const handleTargetingProposalCreated = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Targeting proposal created:', data);

            // Add incoming target to the targeted swap
            dispatch(addIncomingTarget({
                swapId: data.targetSwapId,
                targetInfo: {
                    targetId: data.targetId,
                    sourceSwapId: data.sourceSwapId,
                    sourceSwap: {
                        id: data.sourceSwapId,
                        title: data.sourceSwapTitle || 'Unknown Booking',
                        ownerName: data.sourceUserName || 'Unknown User',
                    },
                    status: 'active',
                    createdAt: new Date(),
                },
            }));

            // Add targeting event to timeline
            dispatch(addTargetingEvent({
                swapId: data.targetSwapId,
                event: {
                    id: `targeting_${data.targetId}`,
                    type: 'targeting_received',
                    timestamp: new Date(),
                    data: {
                        targetId: data.targetId,
                        sourceSwapTitle: data.sourceSwapTitle,
                        sourceUserName: data.sourceUserName,
                    },
                },
            }));

            // Call custom handler
            options.onTargetingProposalReceived?.(data);
        },
        [dispatch, options.onTargetingProposalReceived]
    );

    const handleTargetingProposalAccepted = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Targeting proposal accepted:', data);

            // Update outgoing target status for the source swap
            dispatch(updateOutgoingTarget({
                swapId: data.sourceSwapId,
                targetUpdate: {
                    targetId: data.targetId,
                    status: 'accepted',
                    updatedAt: new Date(),
                },
            }));

            // Add targeting event
            dispatch(addTargetingEvent({
                swapId: data.sourceSwapId,
                event: {
                    id: `targeting_accepted_${data.targetId}`,
                    type: 'targeting_accepted',
                    timestamp: new Date(),
                    data: {
                        targetId: data.targetId,
                        targetSwapTitle: data.targetSwapTitle,
                    },
                },
            }));

            // Call custom handler
            options.onTargetingStatusChanged?.(data);
        },
        [dispatch, options.onTargetingStatusChanged]
    );

    const handleTargetingProposalRejected = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Targeting proposal rejected:', data);

            // Remove outgoing target for the source swap
            dispatch(removeOutgoingTarget({
                swapId: data.sourceSwapId,
                targetId: data.targetId,
            }));

            // Add targeting event
            dispatch(addTargetingEvent({
                swapId: data.sourceSwapId,
                event: {
                    id: `targeting_rejected_${data.targetId}`,
                    type: 'targeting_rejected',
                    timestamp: new Date(),
                    data: {
                        targetId: data.targetId,
                        targetSwapTitle: data.targetSwapTitle,
                        reason: data.reason,
                    },
                },
            }));

            // Call custom handler
            options.onTargetingStatusChanged?.(data);
        },
        [dispatch, options.onTargetingStatusChanged]
    );

    const handleTargetingRetargeted = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Targeting retargeted:', data);

            // Remove incoming target from the previous target swap
            dispatch(removeIncomingTarget({
                swapId: data.targetSwapId,
                targetId: data.targetId,
            }));

            // Add targeting event
            dispatch(addTargetingEvent({
                swapId: data.targetSwapId,
                event: {
                    id: `retargeting_${data.targetId}`,
                    type: 'retargeting_occurred',
                    timestamp: new Date(),
                    data: {
                        targetId: data.targetId,
                        sourceSwapTitle: data.sourceSwapTitle,
                    },
                },
            }));

            // Call custom handler
            options.onTargetingRetargeted?.(data);
        },
        [dispatch, options.onTargetingRetargeted]
    );

    const handleTargetingCancelled = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Targeting cancelled:', data);

            // Remove outgoing target for the source swap
            dispatch(removeOutgoingTarget({
                swapId: data.sourceSwapId,
                targetId: data.targetId,
            }));

            // Remove incoming target for the target swap
            dispatch(removeIncomingTarget({
                swapId: data.targetSwapId,
                targetId: data.targetId,
            }));

            // Add targeting event
            dispatch(addTargetingEvent({
                swapId: data.sourceSwapId,
                event: {
                    id: `targeting_cancelled_${data.targetId}`,
                    type: 'targeting_cancelled',
                    timestamp: new Date(),
                    data: {
                        targetId: data.targetId,
                        targetSwapTitle: data.targetSwapTitle,
                    },
                },
            }));

            // Call custom handler
            options.onTargetingStatusChanged?.(data);
        },
        [dispatch, options.onTargetingStatusChanged]
    );

    const handleAuctionCountdownUpdate = useCallback(
        (data: TargetingUpdateData) => {
            console.log('Auction countdown update:', data);

            if (data.auctionInfo) {
                // Update auction countdown information
                dispatch(updateAuctionCountdown({
                    swapId: data.targetSwapId,
                    auctionInfo: {
                        endDate: new Date(data.auctionInfo.endDate),
                        currentProposalCount: data.auctionInfo.currentProposalCount,
                        timeRemaining: data.auctionInfo.timeRemaining,
                        isEnding: data.auctionInfo.isEnding,
                    },
                }));

                // Add auction event if significant
                if (data.updateType === 'auction_ending' || data.updateType === 'auction_ended') {
                    dispatch(addTargetingEvent({
                        swapId: data.targetSwapId,
                        event: {
                            id: `auction_${data.updateType}_${data.targetId}`,
                            type: data.updateType,
                            timestamp: new Date(),
                            data: {
                                targetId: data.targetId,
                                auctionInfo: data.auctionInfo,
                            },
                        },
                    }));
                }
            }

            // Call custom handler
            options.onAuctionCountdownUpdate?.(data);
        },
        [dispatch, options.onAuctionCountdownUpdate]
    );

    const handleTargetingNotification = useCallback(
        (notification: TargetingNotificationData) => {
            console.log('Targeting notification received:', notification);

            // Add notification to the notification store
            dispatch(addNotification({
                id: notification.id,
                type: notification.type as any,
                title: notification.title,
                message: notification.message,
                data: notification.data,
                timestamp: notification.timestamp,
                read: notification.read,
                category: 'targeting',
            }));
        },
        [dispatch]
    );

    const handleTargetingUpdate = useCallback(
        (data: TargetingUpdateData) => {
            console.log('General targeting update:', data);

            // Update targeting status in the store
            dispatch(updateTargetingStatus({
                targetId: data.targetId,
                status: data.status || 'active',
                lastUpdated: new Date(),
            }));
        },
        [dispatch]
    );

    const {
        isConnected,
        connectionError,
        subscribeToTargeting,
        unsubscribeFromTargeting,
        markTargetingAsRead,
    } = useWebSocket({
        onTargetingUpdate: handleTargetingUpdate,
        onTargetingNotification: handleTargetingNotification,
        onTargetingProposalCreated: handleTargetingProposalCreated,
        onTargetingProposalAccepted: handleTargetingProposalAccepted,
        onTargetingProposalRejected: handleTargetingProposalRejected,
        onTargetingRetargeted: handleTargetingRetargeted,
        onTargetingCancelled: handleTargetingCancelled,
        onAuctionCountdownUpdate: handleAuctionCountdownUpdate,
        onReconnect: () => {
            // Re-subscribe to all swap targeting updates on reconnect
            if (autoSubscribe) {
                swapIds.forEach(swapId => {
                    subscribeToTargeting(swapId);
                });
            }
        },
    });

    // Auto-subscribe to targeting updates for provided swap IDs
    useEffect(() => {
        if (autoSubscribe && isConnected && swapIds.length > 0) {
            swapIds.forEach(swapId => {
                subscribeToTargeting(swapId);
            });

            return () => {
                swapIds.forEach(swapId => {
                    unsubscribeFromTargeting(swapId);
                });
            };
        }
    }, [swapIds, autoSubscribe, isConnected, subscribeToTargeting, unsubscribeFromTargeting]);

    return {
        isConnected,
        connectionError,
        subscribeToTargeting,
        unsubscribeFromTargeting,
        markTargetingAsRead,
    };
};