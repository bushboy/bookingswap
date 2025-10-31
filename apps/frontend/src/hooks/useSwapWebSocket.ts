import { useEffect, useCallback, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { useWebSocket } from './useWebSocket';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import { useConflictResolution } from './useConflictResolution';
import { SwapEvent } from '../services/swapService';
import {
  updateSwapStatus,
  addSwapEvent,
  setCurrentSwap,
  setSwaps,
} from '../store/slices/swapsSlice';
import {
  addNotification,
  updateNotificationStatus,
} from '../store/slices/notificationSlice';

interface UseSwapWebSocketOptions {
  swapId?: string;
  autoJoinRoom?: boolean;
  onSwapUpdate?: (swapId: string, event: SwapEvent) => void;
  onProposalReceived?: (swapId: string, proposalId: string) => void;
}

export const useSwapWebSocket = (options: UseSwapWebSocketOptions = {}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { swapId, autoJoinRoom = true } = options;
  const lastUpdateTimestamp = useRef<Map<string, number>>(new Map());

  // Initialize optimistic updates and conflict resolution
  const {
    addOptimisticUpdate,
    confirmUpdate,
    rollbackUpdate,
    hasOptimisticUpdate,
    isUpdateProcessing,
  } = useOptimisticUpdates({
    timeoutMs: 10000,
    onRollback: (update) => {
      console.warn('Optimistic update rolled back:', update.id);
      // Refresh data from server
      if (update.type === 'proposal_accept' || update.type === 'proposal_reject') {
        // Could trigger a refresh of proposal data here
      }
    },
  });

  const { resolveProposalConflict, detectConflict } = useConflictResolution({
    defaultStrategy: 'merge',
    onConflictDetected: (conflict) => {
      console.warn('WebSocket conflict detected:', conflict);
    },
  });

  const handleSwapUpdate = useCallback(
    (data: {
      swapId: string;
      status: string;
      event: SwapEvent;
      timestamp: Date;
    }) => {
      const updateTimestamp = new Date(data.timestamp).getTime();
      const lastTimestamp = lastUpdateTimestamp.current.get(data.swapId) || 0;

      // Prevent duplicate or out-of-order updates
      if (updateTimestamp <= lastTimestamp) {
        console.log('Ignoring duplicate or out-of-order update:', data.swapId);
        return;
      }

      lastUpdateTimestamp.current.set(data.swapId, updateTimestamp);

      // Check if we have an optimistic update for this swap
      if (hasOptimisticUpdate(data.swapId)) {
        // Confirm the optimistic update if it matches
        confirmUpdate(data.swapId);
      }

      // Update swap status in Redux store
      dispatch(
        updateSwapStatus({
          swapId: data.swapId,
          status: data.status as any,
          lastUpdated: new Date(data.timestamp),
        })
      );

      // Add event to swap timeline
      dispatch(
        addSwapEvent({
          swapId: data.swapId,
          event: data.event,
        })
      );

      // Call custom handler if provided
      options.onSwapUpdate?.(data.swapId, data.event);
    },
    [dispatch, options.onSwapUpdate, hasOptimisticUpdate, confirmUpdate]
  );

  const handleSwapProposal = useCallback(
    (data: {
      swapId: string;
      proposalId: string;
      event: SwapEvent;
      proposal?: any;
      timestamp?: Date;
    }) => {
      const updateTimestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
      const proposalKey = `${data.swapId}-${data.proposalId}`;
      const lastTimestamp = lastUpdateTimestamp.current.get(proposalKey) || 0;

      // Prevent duplicate updates
      if (updateTimestamp <= lastTimestamp) {
        console.log('Ignoring duplicate proposal update:', proposalKey);
        return;
      }

      lastUpdateTimestamp.current.set(proposalKey, updateTimestamp);

      // Check for optimistic updates and resolve conflicts
      if (hasOptimisticUpdate(proposalKey) && data.proposal) {
        const optimisticUpdate = hasOptimisticUpdate(proposalKey);
        if (optimisticUpdate) {
          // Resolve any conflicts between optimistic and server data
          const resolvedProposal = resolveProposalConflict(
            proposalKey,
            optimisticUpdate,
            data.proposal
          );
          confirmUpdate(proposalKey);
        }
      }

      // Add event to timeline
      dispatch(
        addSwapEvent({
          swapId: data.swapId,
          event: data.event,
        })
      );

      // Call custom handler if provided
      options.onProposalReceived?.(data.swapId, data.proposalId);
    },
    [dispatch, options.onProposalReceived, hasOptimisticUpdate, confirmUpdate, resolveProposalConflict]
  );

  const handleSwapStatusChange = useCallback(
    (data: {
      swapId: string;
      oldStatus: string;
      newStatus: string;
      event: SwapEvent;
    }) => {
      // Update swap status
      dispatch(
        updateSwapStatus({
          swapId: data.swapId,
          status: data.newStatus as any,
          lastUpdated: new Date(),
        })
      );

      // Add status change event
      dispatch(
        addSwapEvent({
          swapId: data.swapId,
          event: data.event,
        })
      );

      // Note: In a real implementation, you might want to refresh the swaps list here
      // For now, we rely on the real-time updates
    },
    [dispatch]
  );

  const handleReconnect = useCallback(() => {
    // Note: In a real implementation, you might want to refresh all swap data here
    // For now, we'll just rejoin the room

    // Rejoin swap room if we were in one
    if (swapId && autoJoinRoom) {
      joinSwapRoom(swapId);
    }
  }, [swapId, autoJoinRoom]);

  const {
    isConnected,
    connectionError,
    joinSwapRoom,
    leaveSwapRoom,
    markNotificationAsRead,
    health,
    manualReconnect,
    fallbackPolling,
    manualPoll,
  } = useWebSocket({
    onSwapUpdate: handleSwapUpdate,
    onSwapProposal: handleSwapProposal,
    onSwapStatusChange: handleSwapStatusChange,
    onReconnect: handleReconnect,
    onNotification: notification => {
      // Handle swap-related notifications
      if (notification.type.startsWith('swap_')) {
        dispatch(addNotification(notification));
      }
    },
    enableHealthMonitoring: true,
    enableFallbackPolling: true,
    onHealthChange: (healthData) => {
      // Could dispatch health status to Redux store if needed
      console.log('WebSocket health changed:', healthData);
    },
  });

  // Auto-join swap room when swapId is provided
  useEffect(() => {
    if (swapId && autoJoinRoom && isConnected) {
      joinSwapRoom(swapId);

      return () => {
        leaveSwapRoom(swapId);
      };
    }
  }, [swapId, autoJoinRoom, isConnected, joinSwapRoom, leaveSwapRoom]);

  // Optimistic update helpers for proposal actions
  const optimisticAcceptProposal = useCallback((proposalId: string, proposalData: any) => {
    const optimisticData = {
      ...proposalData,
      status: 'accepted',
      lastModified: Date.now(),
      isProcessing: true,
    };

    return addOptimisticUpdate(
      `${swapId}-${proposalId}`,
      'proposal_accept',
      proposalData,
      optimisticData,
      // Redux action would go here
    );
  }, [swapId, addOptimisticUpdate]);

  const optimisticRejectProposal = useCallback((proposalId: string, proposalData: any, reason?: string) => {
    const optimisticData = {
      ...proposalData,
      status: 'rejected',
      rejectionReason: reason,
      lastModified: Date.now(),
      isProcessing: true,
    };

    return addOptimisticUpdate(
      `${swapId}-${proposalId}`,
      'proposal_reject',
      proposalData,
      optimisticData,
      // Redux action would go here
    );
  }, [swapId, addOptimisticUpdate]);

  const rollbackProposalAction = useCallback((proposalId: string) => {
    rollbackUpdate(`${swapId}-${proposalId}`);
  }, [swapId, rollbackUpdate]);

  return {
    isConnected,
    connectionError,
    joinSwapRoom,
    leaveSwapRoom,
    markNotificationAsRead,
    // Optimistic update methods
    optimisticAcceptProposal,
    optimisticRejectProposal,
    rollbackProposalAction,
    isProposalProcessing: (proposalId: string) => isUpdateProcessing(`${swapId}-${proposalId}`),
    // Health monitoring
    connectionHealth: health,
    manualReconnect,
    // Fallback polling
    fallbackPolling,
    manualPoll,
  };
};
