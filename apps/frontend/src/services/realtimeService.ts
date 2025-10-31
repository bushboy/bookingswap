import { EventEmitter } from 'events';
import { Socket } from 'socket.io-client';
import { ConnectionManager, ConnectionStatus, ConnectionConfig } from './connectionManager';
import { getRealtimeConfig, RealtimeConfig } from '../config/realtimeConfig';
import { RealtimeLogger } from '../utils/realtimeLogger';

export interface RealtimeMessage {
  type: string;
  data: any;
  timestamp: string;
}

export interface RealtimeServiceConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

/**
 * Real-time service for Socket.IO communication
 * Handles booking and swap status updates, proposal notifications, and auction events
 */
export class RealtimeService extends EventEmitter {
  private connectionManager: ConnectionManager;
  private config: RealtimeServiceConfig;
  private realtimeConfig: RealtimeConfig;
  private logger: RealtimeLogger;
  private subscriptions: Set<string> = new Set();

  constructor(config: Partial<RealtimeServiceConfig> = {}) {
    super();

    // Load configuration from environment
    this.realtimeConfig = getRealtimeConfig();

    // Initialize logger with config
    this.logger = new RealtimeLogger(this.realtimeConfig.logLevel, this.realtimeConfig.debugMode);

    this.config = {
      url: config.url || this.realtimeConfig.serverUrl,
      reconnectInterval: config.reconnectInterval || this.realtimeConfig.reconnectInterval,
      maxReconnectAttempts: config.maxReconnectAttempts || this.realtimeConfig.maxReconnectAttempts,
      heartbeatInterval: config.heartbeatInterval || this.realtimeConfig.heartbeatInterval,
      connectionTimeout: config.connectionTimeout || this.realtimeConfig.connectionTimeout,
    };

    this.logger.info('RealtimeService initialized', {
      url: this.config.url,
      debugMode: this.realtimeConfig.debugMode,
      logLevel: this.realtimeConfig.logLevel,
    });

    // Create ConnectionManager with compatible config
    const connectionConfig: ConnectionConfig = {
      url: this.config.url,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      connectionTimeout: this.config.connectionTimeout,
      heartbeatInterval: this.config.heartbeatInterval,
      heartbeatTimeout: this.realtimeConfig.heartbeatTimeout,
    };

    this.connectionManager = new ConnectionManager(connectionConfig);
    this.setupConnectionManagerListeners();

    // Add default error handler to prevent unhandled error warnings
    this.on('error', (error) => {
      this.logger.logError(error, 'EventEmitter');
    });
  }

  /**
   * Connect to the Socket.IO server
   */
  public async connect(): Promise<void> {
    try {
      this.logger.logConnectionEvent('Attempting to connect');
      const socket = await this.connectionManager.establishConnection();
      this.setupSocketMessageHandlers(socket);
      this.resubscribe();
      this.logger.logConnectionEvent('Connection established successfully');
    } catch (error) {
      this.logger.logError(error as Error, 'Connection');
      throw error;
    }
  }

  /**
   * Disconnect from the Socket.IO server
   */
  public disconnect(): void {
    this.logger.logConnectionEvent('Disconnecting from server');
    this.connectionManager.disconnect();
    this.subscriptions.clear();
    this.logger.logConnectionEvent('Disconnected successfully');
  }

  /**
   * Subscribe to specific channels for real-time updates
   */
  public subscribe(channels: string[]): void {
    this.logger.debug('Subscribing to channels', { channels });
    channels.forEach(channel => this.subscriptions.add(channel));

    // Update fallback mode manager with current subscriptions
    this.connectionManager.updateSubscriptions(Array.from(this.subscriptions));

    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      // Use Socket.IO room joining for better reliability
      channels.forEach(channel => {
        socket.emit('join', channel);
        socket.emit('subscribe', { channel });
        this.logger.debug('Subscribed to channel', { channel });
      });
    } else {
      this.logger.warn('Cannot subscribe: Socket not connected', { channels });
    }
  }

  /**
   * Unsubscribe from specific channels
   */
  public unsubscribe(channels: string[]): void {
    channels.forEach(channel => this.subscriptions.delete(channel));

    // Update fallback mode manager with current subscriptions
    this.connectionManager.updateSubscriptions(Array.from(this.subscriptions));

    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      // Use Socket.IO room leaving
      channels.forEach(channel => {
        socket.emit('leave', channel);
        socket.emit('unsubscribe', { channel });
      });
    }
  }

  /**
   * Monitor specific bookings for real-time updates
   */
  public monitorBookings(bookingIds: string[]): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      // Join booking-specific rooms
      bookingIds.forEach(bookingId => {
        const roomName = `booking:${bookingId}`;
        socket.emit('join', roomName);
        this.subscriptions.add(roomName);
      });

      // Update fallback mode manager with current subscriptions
      this.connectionManager.updateSubscriptions(Array.from(this.subscriptions));

      // Also emit the legacy event for backward compatibility
      socket.emit('monitor_bookings', { bookingIds });
    }
  }

  /**
   * Stop monitoring specific bookings
   */
  public unmonitorBookings(bookingIds: string[]): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      // Leave booking-specific rooms
      bookingIds.forEach(bookingId => {
        const roomName = `booking:${bookingId}`;
        socket.emit('leave', roomName);
        this.subscriptions.delete(roomName);
      });

      // Update fallback mode manager with current subscriptions
      this.connectionManager.updateSubscriptions(Array.from(this.subscriptions));

      // Also emit the legacy event for backward compatibility
      socket.emit('unmonitor_bookings', { bookingIds });
    }
  }

  /**
   * Check if Socket.IO is connected
   */
  public isConnected(): boolean {
    return this.connectionManager.getStatus() === ConnectionStatus.CONNECTED;
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionManager.getStatus();
  }

  /**
   * Get current active subscriptions
   */
  public getCurrentSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Send a message to the Socket.IO server
   * If not connected, queue the message for later transmission
   */
  private send(event: string, data: any): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      this.logger.debug('Sending message', { event, data });
      socket.emit(event, data);
    } else {
      this.logger.warn('Cannot send message: Socket.IO not connected, queuing for later', { event });
      // Queue message for transmission when connection is restored
      this.queueMessage(event, data);
    }
  }

  /**
   * Queue a message for later transmission when connection is restored
   */
  public queueMessage(event: string, data: any, priority?: 'low' | 'normal' | 'high' | 'critical'): string {
    // Delegate to connection manager's fallback service
    return this.connectionManager.queueMessage(event, data, priority);
  }

  /**
   * Flush all queued messages by attempting to send them
   */
  public async flushQueuedMessages(): Promise<void> {
    this.logger.info('Flushing queued messages');
    await this.connectionManager.flushQueuedMessages();
  }

  /**
   * Get message queue statistics
   */
  public getMessageQueueStats() {
    return this.connectionManager.getMessageQueueStats();
  }

  /**
   * Clear all queued messages
   */
  public clearMessageQueue(): void {
    this.connectionManager.clearMessageQueue();
    this.logger.info('Message queue cleared');
  }

  /**
   * Handle incoming Socket.IO messages
   */
  private handleMessage(message: RealtimeMessage): void {
    const { type, data } = message;

    this.logger.logMessageEvent('Received message', type, this.realtimeConfig.debugMode ? data : undefined);

    // Emit specific event types
    this.emit(type, data);

    // Emit general message event
    this.emit('message', message);

    // Handle specific message types
    switch (type) {
      case 'booking_updated':
        this.emit('bookingUpdated', data);
        break;

      case 'swap_status_changed':
        this.emit('swapStatusChanged', data);
        break;

      case 'proposal_created':
      case 'proposal_updated':
      case 'proposal_accepted':
      case 'proposal_rejected':
        this.emit('proposalUpdated', data);
        break;

      case 'auction_ending_soon':
        this.emit('auctionEndingSoon', data);
        break;

      case 'auction_ended':
        this.emit('auctionEnded', data);
        break;

      case 'heartbeat':
        // Respond to server heartbeat
        this.logger.debug('Received heartbeat, sending ack');
        this.send('heartbeat_ack', {});
        break;

      default:
        this.logger.warn('Unknown message type received', { type, data });
    }
  }

  /**
   * Setup ConnectionManager event listeners
   */
  private setupConnectionManagerListeners(): void {
    this.connectionManager.on('connected', () => {
      this.logger.logConnectionEvent('Socket.IO connected via ConnectionManager');
      // Resubscribe to all channels after connection is established
      this.resubscribe();

      // Flush any queued messages now that connection is restored
      this.flushQueuedMessages().catch(error => {
        this.logger.logError(error as Error, 'QueueFlush');
      });

      this.emit('connected');
    });

    this.connectionManager.on('disconnected', (event) => {
      this.logger.logConnectionEvent('Socket.IO disconnected via ConnectionManager', { reason: event.reason });
      this.emit('disconnected', event);
    });

    this.connectionManager.on('statusChanged', (event) => {
      this.logger.debug('Connection status changed', event);
      this.emit('statusChanged', event);
    });

    this.connectionManager.on('connectionFailed', (error) => {
      this.logger.logError(error, 'ConnectionManager');
      this.emit('error', error);
    });

    this.connectionManager.on('permanentFailure', (failure) => {
      this.logger.error('Permanent connection failure', failure);
      this.emit('permanentFailure', failure);
    });

    this.connectionManager.on('fallbackModeActivated', (event) => {
      this.logger.info('Fallback mode activated', event);
      this.emit('fallbackModeActivated', event);
    });

    this.connectionManager.on('fallbackModeDeactivated', (event) => {
      this.logger.info('Fallback mode deactivated', event);
      this.emit('fallbackModeDeactivated', event);
    });

    // Handle seamless transition events
    this.connectionManager.on('seamlessTransitionCompleted', (event) => {
      this.logger.info('Seamless transition completed', event);
      this.emit('seamlessTransitionCompleted', event);
    });

    // Forward polling updates from fallback mode
    this.connectionManager.on('pollingUpdate', (update) => {
      this.logger.debug('Polling update received', update);
      this.emit('pollingUpdate', update);
    });

    // Forward specific update events from fallback mode
    ['bookingsUpdate', 'swapsUpdate', 'proposalsUpdate', 'auctionsUpdate', 'genericUpdate'].forEach(eventName => {
      this.connectionManager.on(eventName, (data) => {
        this.logger.debug(`${eventName} received`, data);
        this.emit(eventName, data);
      });
    });
  }

  /**
   * Setup Socket.IO message handlers
   */
  private setupSocketMessageHandlers(socket: Socket): void {
    socket.on('message', (data: any) => {
      try {
        const message: RealtimeMessage = typeof data === 'string' ? JSON.parse(data) : data;
        this.handleMessage(message);
      } catch (error) {
        this.logger.logError(error as Error, 'MessageParsing');
        this.emit('error', error);
      }
    });

    // Handle specific Socket.IO events that might come directly
    socket.on('booking_updated', (data) => {
      this.emit('bookingUpdated', data);
    });

    socket.on('swap_status_changed', (data) => {
      this.emit('swapStatusChanged', data);
    });

    socket.on('proposal_created', (data) => {
      this.emit('proposalUpdated', data);
    });

    socket.on('proposal_updated', (data) => {
      this.emit('proposalUpdated', data);
    });

    socket.on('proposal_accepted', (data) => {
      this.emit('proposalUpdated', data);
    });

    socket.on('proposal_rejected', (data) => {
      this.emit('proposalUpdated', data);
    });

    socket.on('auction_ending_soon', (data) => {
      this.emit('auctionEndingSoon', data);
    });

    socket.on('auction_ended', (data) => {
      this.emit('auctionEnded', data);
    });

    // Backward compatibility events for useWebSocket hook
    socket.on('notification', (data) => {
      this.emit('notification', data);
    });

    socket.on('notification:read', (data) => {
      this.emit('notification:read', data);
    });

    socket.on('swap:update', (data) => {
      this.emit('swap:update', data);
    });

    socket.on('swap:proposal', (data) => {
      this.emit('swap:proposal', data);
    });

    socket.on('swap:status_change', (data) => {
      this.emit('swap:status_change', data);
    });

    socket.on('swap:accepted', (data) => {
      this.emit('swap:accepted', data);
    });

    socket.on('swap:rejected', (data) => {
      this.emit('swap:rejected', data);
    });

    socket.on('swap:completed', (data) => {
      this.emit('swap:completed', data);
    });

    socket.on('swap:cancelled', (data) => {
      this.emit('swap:cancelled', data);
    });

    socket.on('swap:expired', (data) => {
      this.emit('swap:expired', data);
    });

    socket.on('targeting:update', (data) => {
      this.emit('targeting:update', data);
    });

    socket.on('targeting:notification', (data) => {
      this.emit('targeting:notification', data);
    });

    socket.on('targeting:activity', (data) => {
      this.emit('targeting:activity', data);
    });

    socket.on('targeting:status_read', (data) => {
      this.emit('targeting:status_read', data);
    });

    socket.on('auction:countdown_update', (data) => {
      this.emit('auction:countdown_update', data);
    });

    socket.on('auction:proposal_added', (data) => {
      this.emit('auction:proposal_added', data);
    });

    socket.on('auction:ended', (data) => {
      this.emit('auction:ended', data);
    });

    socket.on('typing:start', (data) => {
      this.emit('typing:start', data);
    });

    socket.on('typing:stop', (data) => {
      this.emit('typing:stop', data);
    });
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribe(): void {
    if (this.subscriptions.size > 0) {
      const socket = this.connectionManager.getSocket();
      if (socket?.connected) {
        const channels = Array.from(this.subscriptions);
        this.logger.info('Resubscribing to channels after reconnection', { channels });

        // Resubscribe to all channels using Socket.IO rooms
        this.subscriptions.forEach(channel => {
          socket.emit('join', channel);
          socket.emit('subscribe', { channel });
        });
      }
    }
  }



  /**
   * Get connection metrics and diagnostics
   */
  public getMetrics() {
    const connectionDiagnostics = this.connectionManager.getConnectionDiagnostics();
    const loggerDiagnostics = this.logger.getDiagnostics();
    const messageQueueStats = this.getMessageQueueStats();

    return {
      connection: connectionDiagnostics,
      logging: loggerDiagnostics,
      messageQueue: messageQueueStats,
      subscriptions: {
        count: this.subscriptions.size,
        channels: Array.from(this.subscriptions),
      },
      config: {
        serverUrl: this.config.url,
        debugMode: this.realtimeConfig.debugMode,
        logLevel: this.realtimeConfig.logLevel,
        fallbackEnabled: this.realtimeConfig.enableFallback,
      },
    };
  }

  /**
   * Enable debug mode for detailed logging
   */
  public enableDebugMode(enabled: boolean): void {
    this.logger.setDebugMode(enabled);
    this.realtimeConfig.debugMode = enabled;
    this.logger.info(`Debug mode ${enabled ? 'enabled' : 'disabled'} for RealtimeService`);
  }

  /**
   * Set log level for the service
   */
  public setLogLevel(level: 'error' | 'warn' | 'info' | 'debug'): void {
    this.logger.setLogLevel(level);
    this.realtimeConfig.logLevel = level;
    this.logger.info(`Log level set to: ${level}`);
  }

  /**
   * Get log history for debugging
   */
  public getLogHistory() {
    return this.logger.getLogHistory();
  }

  /**
   * Clear log history
   */
  public clearLogHistory(): void {
    this.logger.clearHistory();
    this.logger.info('Log history cleared');
  }

  /**
   * Get comprehensive health check information
   */
  public getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    connection: {
      status: ConnectionStatus;
      isConnected: boolean;
      lastConnectedAt?: Date;
      uptime?: number;
    };
    subscriptions: {
      count: number;
      active: string[];
    };
    fallback: {
      enabled: boolean;
      active: boolean;
    };
    messageQueue: {
      queueSize: number;
      pendingMessages: number;
      failedMessages: number;
    };
    errors: {
      recent: number;
      lastError?: string;
    };
  } {
    const connectionDiagnostics = this.connectionManager.getConnectionDiagnostics();
    const loggerDiagnostics = this.logger.getDiagnostics();
    const messageQueueStats = this.getMessageQueueStats();
    const connectionStatus = this.getConnectionStatus();
    const isConnected = this.isConnected();

    // Determine overall health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (connectionStatus === ConnectionStatus.FAILED) {
      status = 'unhealthy';
    } else if (connectionStatus === ConnectionStatus.RECONNECTING ||
      loggerDiagnostics.recentErrors.length > 0 ||
      messageQueueStats.queueSize > 100) { // Consider degraded if too many queued messages
      status = 'degraded';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      connection: {
        status: connectionStatus,
        isConnected,
        lastConnectedAt: undefined, // Not available in current diagnostics
        uptime: connectionDiagnostics.uptime,
      },
      subscriptions: {
        count: this.subscriptions.size,
        active: Array.from(this.subscriptions),
      },
      fallback: {
        enabled: this.realtimeConfig.enableFallback,
        active: connectionDiagnostics.fallbackModeStatus?.mode === 'active',
      },
      messageQueue: {
        queueSize: messageQueueStats.queueSize,
        pendingMessages: messageQueueStats.pendingMessages,
        failedMessages: messageQueueStats.failedMessages,
      },
      errors: {
        recent: loggerDiagnostics.recentErrors.length,
        lastError: loggerDiagnostics.recentErrors[0]?.message,
      },
    };
  }

  /**
   * Get detailed diagnostic information for troubleshooting
   */
  public getDiagnosticInfo(): {
    service: {
      version: string;
      initialized: string;
      config: any;
    };
    connection: any;
    logging: any;
    subscriptions: {
      count: number;
      channels: string[];
      history: string[];
    };
    performance: {
      messageCount: number;
      errorCount: number;
      reconnectCount: number;
    };
    environment: {
      userAgent: string;
      url: string;
      timestamp: string;
    };
  } {
    const connectionDiagnostics = this.connectionManager.getConnectionDiagnostics();
    const loggerDiagnostics = this.logger.getDiagnostics();

    return {
      service: {
        version: '2.0.0', // Version of the realtime service
        initialized: new Date().toISOString(),
        config: {
          serverUrl: this.config.url,
          reconnectInterval: this.config.reconnectInterval,
          maxReconnectAttempts: this.config.maxReconnectAttempts,
          heartbeatInterval: this.config.heartbeatInterval,
          connectionTimeout: this.config.connectionTimeout,
          debugMode: this.realtimeConfig.debugMode,
          logLevel: this.realtimeConfig.logLevel,
          fallbackEnabled: this.realtimeConfig.enableFallback,
        },
      },
      connection: connectionDiagnostics,
      logging: loggerDiagnostics,
      subscriptions: {
        count: this.subscriptions.size,
        channels: Array.from(this.subscriptions),
        history: [], // Could be extended to track subscription history
      },
      performance: {
        messageCount: 0, // Not tracked in current diagnostics
        errorCount: loggerDiagnostics.recentErrors.length,
        reconnectCount: connectionDiagnostics.attemptCount || 0,
      },
      environment: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Test connection health by sending a ping
   */
  public async testConnection(): Promise<{
    success: boolean;
    latency?: number;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const socket = this.connectionManager.getSocket();

      if (!socket?.connected) {
        resolve({
          success: false,
          error: 'Socket not connected',
        });
        return;
      }

      const startTime = Date.now();
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Ping timeout',
        });
      }, 5000);

      // Send ping and wait for pong
      socket.emit('ping', { timestamp: startTime });

      const handlePong = () => {
        clearTimeout(timeout);
        const latency = Date.now() - startTime;
        socket.off('pong', handlePong);

        this.logger.debug('Connection test successful', { latency });
        resolve({
          success: true,
          latency,
        });
      };

      socket.on('pong', handlePong);
    });
  }

  /**
   * Get connection status report for monitoring systems
   */
  public getStatusReport(): {
    service: string;
    status: ConnectionStatus;
    healthy: boolean;
    timestamp: string;
    metrics: any;
  } {
    const healthCheck = this.getHealthCheck();
    const metrics = this.getMetrics();

    return {
      service: 'realtime-websocket',
      status: this.getConnectionStatus(),
      healthy: healthCheck.status === 'healthy',
      timestamp: new Date().toISOString(),
      metrics,
    };
  }

  /**
   * Get the underlying Socket instance (for backward compatibility)
   * @deprecated Use getConnectionStatus() instead
   */
  public getSocket(): Socket | null {
    console.warn('RealtimeService.getSocket() is deprecated. Use getConnectionStatus() instead.');
    return this.connectionManager.getSocket();
  }

  /**
   * Legacy method for direct socket emission (for backward compatibility)
   * @deprecated Use the specific methods like subscribe(), monitorBookings(), etc.
   */
  public emit(event: string, data?: any): boolean {
    if (typeof event === 'string' && data !== undefined) {
      // This is a socket emission, not an EventEmitter emission
      console.warn('RealtimeService.emit() for socket events is deprecated. Use specific methods instead.');
      this.send(event, data);
      return true;
    }
    // This is a regular EventEmitter emission
    return super.emit(event, data);
  }

  /**
   * Legacy connect method signature support
   * @deprecated The new connect() method returns a Promise
   */
  public connectLegacy(callback?: (error?: Error) => void): void {
    console.warn('RealtimeService.connectLegacy() is deprecated. Use async connect() instead.');

    this.connect()
      .then(() => callback?.())
      .catch(error => callback?.(error));
  }

  /**
   * Join a specific room (for backward compatibility with useWebSocket)
   */
  public joinRoom(room: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('join', room);
      this.subscriptions.add(room);
    }
  }

  /**
   * Leave a specific room (for backward compatibility with useWebSocket)
   */
  public leaveRoom(room: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('leave', room);
      this.subscriptions.delete(room);
    }
  }

  /**
   * Join swap room (for backward compatibility with useWebSocket)
   */
  public joinSwapRoom(swapId: string): void {
    this.joinRoom(`swap:${swapId}`);
  }

  /**
   * Leave swap room (for backward compatibility with useWebSocket)
   */
  public leaveSwapRoom(swapId: string): void {
    this.leaveRoom(`swap:${swapId}`);
  }

  /**
   * Subscribe to targeting updates (for backward compatibility with useWebSocket)
   */
  public subscribeToTargeting(swapId: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('targeting:subscribe', { swapId });
      this.subscriptions.add(`targeting:${swapId}`);
    }
  }

  /**
   * Unsubscribe from targeting updates (for backward compatibility with useWebSocket)
   */
  public unsubscribeFromTargeting(swapId: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('targeting:unsubscribe', { swapId });
      this.subscriptions.delete(`targeting:${swapId}`);
    }
  }

  /**
   * Mark notification as read (for backward compatibility with useWebSocket)
   */
  public markNotificationAsRead(notificationId: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('notification:read', notificationId);
    }
  }

  /**
   * Mark targeting as read (for backward compatibility with useWebSocket)
   */
  public markTargetingAsRead(targetId: string): void {
    const socket = this.connectionManager.getSocket();
    if (socket?.connected) {
      socket.emit('targeting:status_read', { targetId });
    }
  }


}

// Export singleton instance
export const realtimeService = new RealtimeService();

// Auto-connect when module is imported (can be disabled via environment variable)
if (import.meta.env.VITE_REALTIME_AUTO_CONNECT !== 'false') {
  realtimeService.connect().catch(error => {
    console.warn('Failed to auto-connect to WebSocket:', error);
  });
}

// Initialize monitoring endpoints in debug mode
if (import.meta.env.VITE_WS_DEBUG_MODE === 'true') {
  import('../utils/realtimeMonitoring').then(({ exposeMonitoringEndpoints }) => {
    exposeMonitoringEndpoints();
  });
}