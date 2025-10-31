import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { Notification } from '@booking-swap/shared';
import { SwapEvent } from '../services/swapService';
import { useWebSocketHealth } from './useWebSocketHealth';
import {
  connectionThrottlingManager,
  connectionStateChecker
} from '../utils/connectionThrottling';
import { getServiceConfig, isThrottlingFeatureEnabled } from '../config/connectionThrottling';

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
  // Health monitoring options
  enableHealthMonitoring?: boolean;
  onHealthChange?: (health: any) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    enableHealthMonitoring = true,
    onHealthChange,
    ...eventHandlers
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const serviceId = 'useWebSocket';

  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Get throttling configuration for this service
  const throttleConfig = getServiceConfig(serviceId);

  // Get token from localStorage since it's not stored in Redux state
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
  }, []);

  // Stable health change handler
  const handleHealthChange = useCallback((health: any) => {
    onHealthChange?.(health);
    // Update local connection state based on health
    const connected = health.status === 'connected';
    setIsConnected(connected);
    connectionStateChecker.setConnectionState(serviceId, connected);

    if (health.status === 'error' || health.status === 'disconnected') {
      setConnectionError(health.errorMessage || 'Connection lost');
      connectionStateChecker.setConnectionState(serviceId, false);
    } else {
      setConnectionError(null);
    }
  }, [onHealthChange, serviceId]);

  // Health monitoring
  const { health, manualReconnect, resetReconnectAttempts } = useWebSocketHealth({
    socket: socketRef.current,
    onHealthChange: handleHealthChange,
  });



  // Throttled connection function
  const createThrottledConnection = useCallback(async (): Promise<void> => {
    const token = getAuthToken();

    if (!token || !isAuthenticated) {
      throw new Error('No authentication token available');
    }

    // Check if we can connect (not already connected and throttling allows it)
    // Only check if throttling is enabled for useWebSocket
    if (isThrottlingFeatureEnabled('ENABLE_USE_WEBSOCKET_THROTTLING')) {
      if (!connectionStateChecker.canConnect(serviceId)) {
        const status = connectionStateChecker.getConnectionStatus(serviceId);
        if (status.isConnected) {
          console.log('WebSocket already connected, skipping connection attempt');
          return;
        }
        throw new Error('Connection throttled or rate limited');
      }
    }

    // Create socket connection without forceNew to prevent connection loops
    const socket = io(
      import.meta.env.VITE_API_BASE_URL?.replace('/api', '') ||
      'http://localhost:3001',
      {
        auth: {
          token: token,
        },
        transports: ['websocket', 'polling'],
        timeout: throttleConfig.connectionTimeout,
        // Removed forceNew: true to prevent connection loops
      }
    );

    socketRef.current = socket;
  }, [getAuthToken, isAuthenticated, serviceId, throttleConfig.connectionTimeout]);

  // Stable event handlers using useCallback
  const handleConnect = useCallback(() => {
    console.log('WebSocket connected');
    setIsConnected(true);
    setConnectionError(null);
    connectionStateChecker.setConnectionState(serviceId, true);

    // Only reset throttling if enabled
    if (isThrottlingFeatureEnabled('ENABLE_USE_WEBSOCKET_THROTTLING')) {
      connectionThrottlingManager.resetConnectionTracking(serviceId);
    }

    resetReconnectAttempts();
    eventHandlers.onConnect?.();
  }, [serviceId, resetReconnectAttempts, eventHandlers.onConnect]);

  const handleDisconnect = useCallback((reason: string) => {
    console.log('WebSocket disconnected:', reason);
    setIsConnected(false);
    connectionStateChecker.setConnectionState(serviceId, false);
    eventHandlers.onDisconnect?.();
  }, [serviceId, eventHandlers.onDisconnect]);

  const handleReconnect = useCallback(() => {
    console.log('WebSocket reconnected');
    setIsConnected(true);
    setConnectionError(null);
    connectionStateChecker.setConnectionState(serviceId, true);

    // Only reset throttling if enabled
    if (isThrottlingFeatureEnabled('ENABLE_USE_WEBSOCKET_THROTTLING')) {
      connectionThrottlingManager.resetConnectionTracking(serviceId);
    }

    resetReconnectAttempts();
    eventHandlers.onReconnect?.();
  }, [serviceId, resetReconnectAttempts, eventHandlers.onReconnect]);

  const handleConnectError = useCallback((error: any) => {
    console.error('WebSocket connection error:', error);
    setConnectionError(error.message);
    setIsConnected(false);
    connectionStateChecker.setConnectionState(serviceId, false);
  }, [serviceId]);

  // Stable event handlers for all socket events
  const handleNotification = useCallback((notification: Notification) => {
    console.log('Received notification:', notification);
    eventHandlers.onNotification?.(notification);
  }, [eventHandlers.onNotification]);

  const handleNotificationRead = useCallback((notificationId: string) => {
    console.log('Notification marked as read:', notificationId);
  }, []);

  const handleSwapUpdate = useCallback((data: SwapUpdateData) => {
    console.log('Received swap update:', data);
    eventHandlers.onSwapUpdate?.(data);
  }, [eventHandlers.onSwapUpdate]);

  const handleSwapProposal = useCallback((data: { swapId: string; proposalId: string; event: SwapEvent }) => {
    console.log('Received swap proposal:', data);
    eventHandlers.onSwapProposal?.(data);
  }, [eventHandlers.onSwapProposal]);

  const handleSwapStatusChange = useCallback((data: {
    swapId: string;
    oldStatus: string;
    newStatus: string;
    event: SwapEvent;
  }) => {
    console.log('Received swap status change:', data);
    eventHandlers.onSwapStatusChange?.(data);
  }, [eventHandlers.onSwapStatusChange]);

  const handleTargetingUpdate = useCallback((data: TargetingUpdateData) => {
    console.log('Received targeting update:', data);
    eventHandlers.onTargetingUpdate?.(data);

    // Route to specific handlers based on type
    switch (data.type) {
      case 'targeting_received':
        eventHandlers.onTargetingProposalCreated?.(data);
        break;
      case 'targeting_accepted':
        eventHandlers.onTargetingProposalAccepted?.(data);
        break;
      case 'targeting_rejected':
        eventHandlers.onTargetingProposalRejected?.(data);
        break;
      case 'retargeting_occurred':
        eventHandlers.onTargetingRetargeted?.(data);
        break;
      case 'targeting_cancelled':
        eventHandlers.onTargetingCancelled?.(data);
        break;
      case 'auction_targeting_update':
      case 'auction_targeting_ended':
        eventHandlers.onAuctionCountdownUpdate?.(data);
        break;
    }
  }, [
    eventHandlers.onTargetingUpdate,
    eventHandlers.onTargetingProposalCreated,
    eventHandlers.onTargetingProposalAccepted,
    eventHandlers.onTargetingProposalRejected,
    eventHandlers.onTargetingRetargeted,
    eventHandlers.onTargetingCancelled,
    eventHandlers.onAuctionCountdownUpdate
  ]);

  const handleTargetingNotification = useCallback((notification: TargetingNotificationData) => {
    console.log('Received targeting notification:', notification);
    eventHandlers.onTargetingNotification?.(notification);
  }, [eventHandlers.onTargetingNotification]);

  const handleTargetingActivity = useCallback((data: TargetingUpdateData) => {
    console.log('Received targeting activity:', data);
    eventHandlers.onTargetingUpdate?.(data);
  }, [eventHandlers.onTargetingUpdate]);

  const handleTargetingStatusRead = useCallback((targetId: string) => {
    console.log('Targeting notification marked as read:', targetId);
  }, []);

  const handleAuctionCountdownUpdate = useCallback((data: TargetingUpdateData) => {
    console.log('Received auction countdown update:', data);
    eventHandlers.onAuctionCountdownUpdate?.(data);
  }, [eventHandlers.onAuctionCountdownUpdate]);

  const handleAuctionProposalAdded = useCallback((data: TargetingUpdateData) => {
    console.log('New proposal added to auction:', data);
    eventHandlers.onTargetingUpdate?.(data);
  }, [eventHandlers.onTargetingUpdate]);

  const handleAuctionEnded = useCallback((data: TargetingUpdateData) => {
    console.log('Auction ended:', data);
    eventHandlers.onAuctionCountdownUpdate?.(data);
  }, [eventHandlers.onAuctionCountdownUpdate]);

  const handleTypingStart = useCallback((data: { userId: string }) => {
    console.log('User started typing:', data.userId);
  }, []);

  const handleTypingStop = useCallback((data: { userId: string }) => {
    console.log('User stopped typing:', data.userId);
  }, []);

  useEffect(() => {
    const token = getAuthToken();

    if (!token || !isAuthenticated) {
      // Disconnect if no token or not authenticated
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        connectionStateChecker.setConnectionState(serviceId, false);
      }
      return;
    }

    // Use throttled connection to prevent rapid successive attempts
    const connectWithThrottling = async () => {
      try {
        // Check if throttling is enabled for useWebSocket specifically
        if (isThrottlingFeatureEnabled('ENABLE_USE_WEBSOCKET_THROTTLING')) {
          await connectionThrottlingManager.debounceConnection(
            serviceId,
            createThrottledConnection,
            throttleConfig.debounceDelay
          );
        } else {
          // Direct connection without throttling for useWebSocket
          await createThrottledConnection();
        }

        if (!socketRef.current) {
          return;
        }

        // Set up all event handlers using stable callbacks
        socketRef.current.on('connect', handleConnect);
        socketRef.current.on('disconnect', handleDisconnect);
        socketRef.current.on('reconnect', handleReconnect);
        socketRef.current.on('connect_error', handleConnectError);

        // Notification handlers
        socketRef.current.on('notification', handleNotification);
        socketRef.current.on('notification:read', handleNotificationRead);

        // Swap update handlers
        socketRef.current.on('swap:update', handleSwapUpdate);
        socketRef.current.on('swap:proposal', handleSwapProposal);
        socketRef.current.on('swap:status_change', handleSwapStatusChange);
        socketRef.current.on('swap:accepted', handleSwapUpdate);
        socketRef.current.on('swap:rejected', handleSwapUpdate);
        socketRef.current.on('swap:completed', handleSwapUpdate);
        socketRef.current.on('swap:cancelled', handleSwapUpdate);
        socketRef.current.on('swap:expired', handleSwapUpdate);

        // Targeting event handlers
        socketRef.current.on('targeting:update', handleTargetingUpdate);
        socketRef.current.on('targeting:notification', handleTargetingNotification);
        socketRef.current.on('targeting:activity', handleTargetingActivity);
        socketRef.current.on('targeting:status_read', handleTargetingStatusRead);

        // Auction-specific targeting events
        socketRef.current.on('auction:countdown_update', handleAuctionCountdownUpdate);
        socketRef.current.on('auction:proposal_added', handleAuctionProposalAdded);
        socketRef.current.on('auction:ended', handleAuctionEnded);

        // Typing indicators
        socketRef.current.on('typing:start', handleTypingStart);
        socketRef.current.on('typing:stop', handleTypingStop);

      } catch (error) {
        console.error('Failed to establish throttled WebSocket connection:', error);
        setConnectionError(error instanceof Error ? error.message : 'Connection failed');
      }
    };

    // Initiate throttled connection
    connectWithThrottling();

    // Cleanup function
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setIsConnected(false);
      connectionStateChecker.setConnectionState(serviceId, false);

      // Only clear throttling if enabled
      if (isThrottlingFeatureEnabled('ENABLE_USE_WEBSOCKET_THROTTLING')) {
        connectionThrottlingManager.clearDebounce(serviceId);
      }
    };
  }, [
    isAuthenticated,
    getAuthToken,
    serviceId,
    throttleConfig.debounceDelay,
    throttleConfig.connectionTimeout,
    createThrottledConnection,
    handleConnect,
    handleDisconnect,
    handleReconnect,
    handleConnectError,
    handleNotification,
    handleNotificationRead,
    handleSwapUpdate,
    handleSwapProposal,
    handleSwapStatusChange,
    handleTargetingUpdate,
    handleTargetingNotification,
    handleTargetingActivity,
    handleTargetingStatusRead,
    handleAuctionCountdownUpdate,
    handleAuctionProposalAdded,
    handleAuctionEnded,
    handleTypingStart,
    handleTypingStop,
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
    // Health monitoring
    health,
    manualReconnect,
    resetReconnectAttempts,
  };
};
