import { useEffect, useCallback, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { useWebSocket } from './useWebSocket';
import {
    addIncomingTarget,
    removeIncomingTarget,
    updateIncomingTarget,
    updateOutgoingTarget,
    setOutgoingTarget,
    removeOutgoingTarget,
    updateAuctionCountdown,
    addTargetingEvent,
    updateTargetingStatus,
    setConnectionStatus,
    invalidateTargetingCache,
} from '../store/slices/targetingSlice';
import { handleTargetingUpdate } from '../store/thunks/targetingThunks';
import { SwapTarget, SwapTargetStatus } from '@booking-swap/shared';

interface TargetingUpdateData {
    type: string;
    targetId: string;
    sourceSwapId: string;
    targetSwapId: string;
    sourceSwapTitle?: string;
    targetSwapTitle?: string;
    sourceUserName?: string;
    status?: SwapTargetStatus;
    reason?: string;
    updateType?: string;
    auctionInfo?: {
        endDate: Date;
        currentProposalCount: number;
        timeRemaining: string;
        isEnding: boolean;
    };
    target?: SwapTarget;
}

interface OptimisticUpdate {
    id: string;
    type: 'create' | 'update' | 'remove';
    swapId: string;
    targetId: string;
    originalData?: any;
    timestamp: number;
    retryCount: number;
}

interface UseTargetingRealtimeOptions {
    swapIds?: string[];
    userId?: string;
    autoSubscribe?: boolean;
    enableOptimisticUpdates?: boolean;
    retryFailedUpdates?: boolean;
    maxRetries?: number;
    retryDelay?: number;
}

export const useTargetingRealtime = (options: UseTargetingRealtimeOptions = {}) => {
    const {
        swapIds = [],
        userId,
        autoSubscribe = true,
        enableOptimisticUpdates = true,
        retryFailedUpdates = true,
        maxRetries = 3,
        retryDelay = 2000,
    } = options;

    const dispatch = useDispatch<AppDispatch>();
    const targetingState = useSelector((state: RootState) => state.targeting);

    // Track optimistic updates and failed operations
    const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());
    const [failedUpdates, setFailedUpdates] = useState<Map<string, OptimisticUpdate>>(new Map());
    const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
    const subscriptionRef = useRef<Set<string>>(new Set());

    // Handle targeting updates from WebSocket
    const handleTargetingUpdateEvent = useCallback((data: TargetingUpdateData) => {
        console.log('Received targeting update:', data);

        const eventId = `${data.type}-${data.targetId}-${Date.now()}`;

        // Add event to targeting timeline
        dispatch(addTargetingEvent({
            swapId: data.sourceSwapId || data.targetSwapId,
            event: {
                id: eventId,
                type: data.type,
                timestamp: new Date(),
                data,
            },
        }));

        // Handle specific update types
        switch (data.type) {
            case 'targeting_received':
                handleIncomingTargetCreated(data);
                break;
            case 'targeting_accepted':
                handleTargetAccepted(data);
                break;
            case 'targeting_rejected':
                handleTargetRejected(data);
                break;
            case 'retargeting_occurred':
                handleRetargeting(data);
                break;
            case 'targeting_cancelled':
                handleTargetCancelled(data);
                break;
            case 'auction_targeting_update':
                handleAuctionUpdate(data);
                break;
            case 'proposal_targeting_update':
                handleProposalUpdate(data);
                break;
            default:
                console.log('Unknown targeting update type:', data.type);
        }

        // Update global targeting status
        if (data.targetId && data.status) {
            dispatch(updateTargetingStatus({
                targetId: data.targetId,
                status: data.status,
                lastUpdated: new Date(),
            }));
        }

        // Remove any matching optimistic update since we got the real update
        if (optimisticUpdates.has(data.targetId)) {
            setOptimisticUpdates(prev => {
                const newMap = new Map(prev);
                newMap.delete(data.targetId);
                return newMap;
            });
        }

        // Remove from failed updates if it was there
        if (failedUpdates.has(data.targetId)) {
            setFailedUpdates(prev => {
                const newMap = new Map(prev);
                newMap.delete(data.targetId);
                return newMap;
            });
        }

    }, [dispatch, optimisticUpdates, failedUpdates]);

    // Handle incoming target created
    const handleIncomingTargetCreated = useCallback((data: TargetingUpdateData) => {
        if (data.target) {
            dispatch(addIncomingTarget({
                swapId: data.targetSwapId,
                targetInfo: {
                    targetId: data.targetId,
                    sourceSwapId: data.sourceSwapId,
                    sourceSwap: {
                        id: data.sourceSwapId,
                        title: data.sourceSwapTitle || 'Unknown Swap',
                        ownerName: data.sourceUserName || 'Unknown User',
                    },
                    status: data.status || 'active',
                    createdAt: new Date(),
                },
            }));
        }
    }, [dispatch]);

    // Handle target accepted
    const handleTargetAccepted = useCallback((data: TargetingUpdateData) => {
        // Update incoming target status
        dispatch(updateIncomingTarget({
            swapId: data.targetSwapId,
            targetId: data.targetId,
            updates: {
                status: 'accepted',
                updatedAt: new Date(),
            },
        }));

        // Update outgoing target status if this is our outgoing target
        dispatch(updateOutgoingTarget({
            swapId: data.sourceSwapId,
            targetUpdate: {
                targetId: data.targetId,
                status: 'accepted',
                updatedAt: new Date(),
            },
        }));
    }, [dispatch]);

    // Handle target rejected
    const handleTargetRejected = useCallback((data: TargetingUpdateData) => {
        // Update incoming target status
        dispatch(updateIncomingTarget({
            swapId: data.targetSwapId,
            targetId: data.targetId,
            updates: {
                status: 'rejected',
                updatedAt: new Date(),
            },
        }));

        // Update outgoing target status if this is our outgoing target
        dispatch(updateOutgoingTarget({
            swapId: data.sourceSwapId,
            targetUpdate: {
                targetId: data.targetId,
                status: 'rejected',
                updatedAt: new Date(),
            },
        }));
    }, [dispatch]);

    // Handle retargeting
    const handleRetargeting = useCallback((data: TargetingUpdateData) => {
        // Remove old outgoing target
        dispatch(removeOutgoingTarget({
            swapId: data.sourceSwapId,
            targetId: data.targetId,
        }));

        // Add new outgoing target if provided
        if (data.target) {
            dispatch(setOutgoingTarget({
                swapId: data.sourceSwapId,
                targetInfo: {
                    targetId: data.target.id,
                    targetSwapId: data.target.targetSwapId,
                    targetSwap: {
                        id: data.target.targetSwapId,
                        title: data.targetSwapTitle || 'Unknown Swap',
                        ownerName: 'Unknown User',
                    },
                    status: data.target.status,
                    createdAt: new Date(data.target.createdAt),
                },
            }));
        }
    }, [dispatch]);

    // Handle target cancelled
    const handleTargetCancelled = useCallback((data: TargetingUpdateData) => {
        // Remove incoming target
        dispatch(removeIncomingTarget({
            swapId: data.targetSwapId,
            targetId: data.targetId,
        }));

        // Remove outgoing target
        dispatch(removeOutgoingTarget({
            swapId: data.sourceSwapId,
            targetId: data.targetId,
        }));
    }, [dispatch]);

    // Handle auction updates
    const handleAuctionUpdate = useCallback((data: TargetingUpdateData) => {
        if (data.auctionInfo) {
            dispatch(updateAuctionCountdown({
                swapId: data.targetSwapId,
                auctionInfo: data.auctionInfo,
            }));
        }
    }, [dispatch]);

    // Handle proposal updates
    const handleProposalUpdate = useCallback((data: TargetingUpdateData) => {
        // Invalidate cache for affected swaps
        dispatch(invalidateTargetingCache(data.sourceSwapId));
        dispatch(invalidateTargetingCache(data.targetSwapId));

        // Trigger real-time update handler
        if (data.target) {
            dispatch(handleTargetingUpdate({
                type: 'target_updated',
                data: data.target,
            }));
        }
    }, [dispatch]);

    // Handle connection status changes
    const handleConnection = useCallback(() => {
        dispatch(setConnectionStatus({ isConnected: true }));

        // Resubscribe to all targeting channels
        if (autoSubscribe) {
            subscribeToTargeting([...swapIds]);
            if (userId) {
                subscribeToUserTargeting(userId);
            }
        }
    }, [dispatch, autoSubscribe, swapIds, userId]);

    const handleDisconnection = useCallback(() => {
        dispatch(setConnectionStatus({ isConnected: false }));
    }, [dispatch]);

    const handleConnectionError = useCallback((error: any) => {
        dispatch(setConnectionStatus({
            isConnected: false,
            error: error.message || 'Connection error'
        }));
    }, [dispatch]);

    // WebSocket connection
    const {
        isConnected,
        connectionError,
        subscribeToTargeting,
        unsubscribeFromTargeting,
        markTargetingAsRead,
    } = useWebSocket({
        onTargetingUpdate: handleTargetingUpdateEvent,
        onConnect: handleConnection,
        onDisconnect: handleDisconnection,
        onReconnect: handleConnection,
    });

    // Subscribe to user-specific targeting updates
    const subscribeToUserTargeting = useCallback((userIdToSubscribe: string) => {
        if (isConnected) {
            subscribeToTargeting(userIdToSubscribe);
            subscriptionRef.current.add(`user:${userIdToSubscribe}`);
        }
    }, [isConnected, subscribeToTargeting]);

    // Optimistic update functions
    const performOptimisticUpdate = useCallback((
        type: 'create' | 'update' | 'remove',
        swapId: string,
        targetId: string,
        updateData?: any
    ) => {
        if (!enableOptimisticUpdates) return;

        const optimisticId = `${type}-${targetId}-${Date.now()}`;
        const optimisticUpdate: OptimisticUpdate = {
            id: optimisticId,
            type,
            swapId,
            targetId,
            originalData: updateData,
            timestamp: Date.now(),
            retryCount: 0,
        };

        setOptimisticUpdates(prev => new Map(prev).set(targetId, optimisticUpdate));

        // Apply the optimistic update immediately
        switch (type) {
            case 'create':
                if (updateData) {
                    dispatch(addIncomingTarget({
                        swapId,
                        targetInfo: updateData,
                    }));
                }
                break;
            case 'update':
                if (updateData) {
                    dispatch(updateIncomingTarget({
                        swapId,
                        targetId,
                        updates: updateData,
                    }));
                }
                break;
            case 'remove':
                dispatch(removeIncomingTarget({ swapId, targetId }));
                break;
        }
    }, [enableOptimisticUpdates, dispatch]);

    // Retry failed updates
    const retryFailedUpdate = useCallback((failedUpdate: OptimisticUpdate) => {
        if (!retryFailedUpdates || failedUpdate.retryCount >= maxRetries) {
            return;
        }

        const retryId = `retry-${failedUpdate.id}`;
        const timeout = setTimeout(() => {
            console.log(`Retrying failed update: ${failedUpdate.id}, attempt ${failedUpdate.retryCount + 1}`);

            // Update retry count
            const updatedFailure = {
                ...failedUpdate,
                retryCount: failedUpdate.retryCount + 1,
            };

            setFailedUpdates(prev => {
                const newMap = new Map(prev);
                newMap.set(failedUpdate.targetId, updatedFailure);
                return newMap;
            });

            // Attempt to reapply the update
            performOptimisticUpdate(
                failedUpdate.type,
                failedUpdate.swapId,
                failedUpdate.targetId,
                failedUpdate.originalData
            );

            retryTimeouts.current.delete(retryId);
        }, retryDelay * Math.pow(2, failedUpdate.retryCount)); // Exponential backoff

        retryTimeouts.current.set(retryId, timeout);
    }, [retryFailedUpdates, maxRetries, retryDelay, performOptimisticUpdate]);

    // Handle update failures
    const handleUpdateFailure = useCallback((targetId: string, error: any) => {
        const optimisticUpdate = optimisticUpdates.get(targetId);
        if (optimisticUpdate) {
            // Move to failed updates
            setFailedUpdates(prev => new Map(prev).set(targetId, optimisticUpdate));
            setOptimisticUpdates(prev => {
                const newMap = new Map(prev);
                newMap.delete(targetId);
                return newMap;
            });

            // Schedule retry
            retryFailedUpdate(optimisticUpdate);
        }
    }, [optimisticUpdates, retryFailedUpdate]);

    // Auto-subscribe to targeting updates
    useEffect(() => {
        if (autoSubscribe && isConnected && swapIds.length > 0) {
            swapIds.forEach(swapId => {
                if (!subscriptionRef.current.has(swapId)) {
                    subscribeToTargeting(swapId);
                    subscriptionRef.current.add(swapId);
                }
            });
        }
    }, [autoSubscribe, isConnected, swapIds, subscribeToTargeting]);

    // Auto-subscribe to user targeting updates
    useEffect(() => {
        if (autoSubscribe && isConnected && userId) {
            const userKey = `user:${userId}`;
            if (!subscriptionRef.current.has(userKey)) {
                subscribeToUserTargeting(userId);
            }
        }
    }, [autoSubscribe, isConnected, userId, subscribeToUserTargeting]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
            retryTimeouts.current.clear();
        };
    }, []);

    // Public API
    const subscribeToSwapTargeting = useCallback((swapIdsToSubscribe: string[]) => {
        if (isConnected) {
            swapIdsToSubscribe.forEach(swapId => {
                subscribeToTargeting(swapId);
                subscriptionRef.current.add(swapId);
            });
        }
    }, [isConnected, subscribeToTargeting]);

    const unsubscribeFromSwapTargeting = useCallback((swapIdsToUnsubscribe: string[]) => {
        if (isConnected) {
            swapIdsToUnsubscribe.forEach(swapId => {
                unsubscribeFromTargeting(swapId);
                subscriptionRef.current.delete(swapId);
            });
        }
    }, [isConnected, unsubscribeFromTargeting]);

    const markAsRead = useCallback((targetId: string) => {
        if (isConnected) {
            markTargetingAsRead(targetId);
        }
    }, [isConnected, markTargetingAsRead]);

    return {
        // Connection status
        isConnected,
        connectionError,

        // Subscription management
        subscribeToSwapTargeting,
        unsubscribeFromSwapTargeting,
        subscribeToUserTargeting,

        // Optimistic updates
        performOptimisticUpdate,
        optimisticUpdates: Array.from(optimisticUpdates.values()),
        failedUpdates: Array.from(failedUpdates.values()),

        // Actions
        markAsRead,

        // Status
        hasOptimisticUpdates: optimisticUpdates.size > 0,
        hasFailedUpdates: failedUpdates.size > 0,
        retryCount: Array.from(failedUpdates.values()).reduce((sum, update) => sum + update.retryCount, 0),
    };
};