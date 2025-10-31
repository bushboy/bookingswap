import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Notification } from '@booking-swap/shared';
import { SwapEvent } from '../services/swapService';

interface SwapUpdateData {
  swapId: string;
  status: string;
  event: SwapEvent;
  timestamp: Date;
}

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

interface UseWebSocketOptions {
  onNotification?: (notification: Notification) => void;
  onSwapUpdate?: (data: SwapUpdateData) => void;
  onSwapProposal?: (data: {
    swapId: string;
    proposalId: string;
    event: SwapEvent;
  }) => void;
  onSwapStatusChange?: (data: {
    swapId: string;
    oldStatus: string;
    newStatus: string;
    event: SwapEvent;
  }) => void;
  onTargetingUpdate?: (data: TargetingUpdateData) => void;
  onTargetingNotification?: (notification: TargetingNotificationData) => void;
  onTargetingProposalCreated?: (data: TargetingUpdateData) => void;
  onTargetingProposalAccepted?: (data: TargetingUpdateData) => void;
  onTargetingProposalRejected?: (data: TargetingUpdateData) => void;
  onTargetingRetargeted?: (data: TargetingUpdateData) => void;
  onTargetingCancelled?: (data: TargetingUpdateData) => void;
  onAuctionCountdownUpdate?: (data: TargetingUpdateData) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: () => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token) {
      // Disconnect if no token
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection
    const socket = io(
      import.meta.env.VITE_API_BASE_URL?.replace('/api', '') ||
      'http://localhost:3001',
      {
        auth: {
          token: token,
        },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      }
    );

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      options.onConnect?.();
    });

    socket.on('disconnect', reason => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      options.onDisconnect?.();
    });

    socket.on('reconnect', () => {
      console.log('WebSocket reconnected');
      setIsConnected(true);
      setConnectionError(null);
      options.onReconnect?.();
    });

    socket.on('connect_error', error => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Notification handlers
    socket.on('notification', (notification: Notification) => {
      console.log('Received notification:', notification);
      options.onNotification?.(notification);
    });

    socket.on('notification:read', (notificationId: string) => {
      console.log('Notification marked as read:', notificationId);
      // Handle notification read status update
    });

    // Swap update handlers
    socket.on('swap:update', (data: SwapUpdateData) => {
      console.log('Received swap update:', data);
      options.onSwapUpdate?.(data);
    });

    socket.on(
      'swap:proposal',
      (data: { swapId: string; proposalId: string; event: SwapEvent }) => {
        console.log('Received swap proposal:', data);
        options.onSwapProposal?.(data);
      }
    );

    socket.on(
      'swap:status_change',
      (data: {
        swapId: string;
        oldStatus: string;
        newStatus: string;
        event: SwapEvent;
      }) => {
        console.log('Received swap status change:', data);
        options.onSwapStatusChange?.(data);
      }
    );

    socket.on('swap:accepted', (data: SwapUpdateData) => {
      console.log('Swap accepted:', data);
      options.onSwapUpdate?.(data);
    });

    socket.on('swap:rejected', (data: SwapUpdateData) => {
      console.log('Swap rejected:', data);
      options.onSwapUpdate?.(data);
    });

    socket.on('swap:completed', (data: SwapUpdateData) => {
      console.log('Swap completed:', data);
      options.onSwapUpdate?.(data);
    });

    socket.on('swap:cancelled', (data: SwapUpdateData) => {
      console.log('Swap cancelled:', data);
      options.onSwapUpdate?.(data);
    });

    socket.on('swap:expired', (data: SwapUpdateData) => {
      console.log('Swap expired:', data);
      options.onSwapUpdate?.(data);
    });

    // Targeting event handlers
    socket.on('targeting:update', (data: TargetingUpdateData) => {
      console.log('Received targeting update:', data);
      options.onTargetingUpdate?.(data);

      // Route to specific handlers based on type
      switch (data.type) {
        case 'targeting_received':
          options.onTargetingProposalCreated?.(data);
          break;
        case 'targeting_accepted':
          options.onTargetingProposalAccepted?.(data);
          break;
        case 'targeting_rejected':
          options.onTargetingProposalRejected?.(data);
          break;
        case 'retargeting_occurred':
          options.onTargetingRetargeted?.(data);
          break;
        case 'targeting_cancelled':
          options.onTargetingCancelled?.(data);
          break;
        case 'auction_targeting_update':
        case 'auction_targeting_ended':
          options.onAuctionCountdownUpdate?.(data);
          break;
      }
    });

    socket.on('targeting:notification', (notification: TargetingNotificationData) => {
      console.log('Received targeting notification:', notification);
      options.onTargetingNotification?.(notification);
    });

    socket.on('targeting:activity', (data: TargetingUpdateData) => {
      console.log('Received targeting activity:', data);
      options.onTargetingUpdate?.(data);
    });

    socket.on('targeting:status_read', (targetId: string) => {
      console.log('Targeting notification marked as read:', targetId);
      // Handle targeting notification read status update
    });

    // Auction-specific targeting events
    socket.on('auction:countdown_update', (data: TargetingUpdateData) => {
      console.log('Received auction countdown update:', data);
      options.onAuctionCountdownUpdate?.(data);
    });

    socket.on('auction:proposal_added', (data: TargetingUpdateData) => {
      console.log('New proposal added to auction:', data);
      options.onTargetingUpdate?.(data);
    });

    socket.on('auction:ended', (data: TargetingUpdateData) => {
      console.log('Auction ended:', data);
      options.onAuctionCountdownUpdate?.(data);
    });

    // Typing indicators (for future chat feature)
    socket.on('typing:start', (data: { userId: string }) => {
      console.log('User started typing:', data.userId);
    });

    socket.on('typing:stop', (data: { userId: string }) => {
      console.log('User stopped typing:', data.userId);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [
    token,
    options.onNotification,
    options.onSwapUpdate,
    options.onConnect,
    options.onDisconnect,
  ]);

  // Helper functions
  const markNotificationAsRead = (notificationId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('notification:read', notificationId);
    }
  };

  const joinSwapRoom = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join:swap', swapId);
    }
  };

  const leaveSwapRoom = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave:swap', swapId);
    }
  };

  const startTyping = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:start', { swapId });
    }
  };

  const stopTyping = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing:stop', { swapId });
    }
  };

  // Targeting-specific helper functions
  const subscribeToTargeting = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('targeting:subscribe', { swapId });
    }
  };

  const unsubscribeFromTargeting = (swapId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('targeting:unsubscribe', { swapId });
    }
  };

  const markTargetingAsRead = (targetId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('targeting:status_read', { targetId });
    }
  };

  return {
    isConnected,
    connectionError,
    socket: socketRef.current,
    markNotificationAsRead,
    joinSwapRoom,
    leaveSwapRoom,
    startTyping,
    stopTyping,
    subscribeToTargeting,
    unsubscribeFromTargeting,
    markTargetingAsRead,
  };
};
