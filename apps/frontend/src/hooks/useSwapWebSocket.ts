import { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { useWebSocket } from './useWebSocket';
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

  const handleSwapUpdate = useCallback(
    (data: {
      swapId: string;
      status: string;
      event: SwapEvent;
      timestamp: Date;
    }) => {
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

      // Note: In a real implementation, you might want to fetch updated swap data here
      // For now, we rely on the real-time updates
    },
    [dispatch, options.onSwapUpdate]
  );

  const handleSwapProposal = useCallback(
    (data: { swapId: string; proposalId: string; event: SwapEvent }) => {
      // Add event to timeline
      dispatch(
        addSwapEvent({
          swapId: data.swapId,
          event: data.event,
        })
      );

      // Call custom handler if provided
      options.onProposalReceived?.(data.swapId, data.proposalId);

      // Note: In a real implementation, you might want to fetch updated swap data here
      // For now, we rely on the real-time updates
    },
    [dispatch, options.onProposalReceived]
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

  return {
    isConnected,
    connectionError,
    joinSwapRoom,
    leaveSwapRoom,
    markNotificationAsRead,
  };
};
