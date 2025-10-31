import { EventEmitter } from 'events';
import { io, Socket } from 'socket.io-client';
import { ExponentialBackoff } from './exponentialBackoff';
import { WebSocketErrorHandler } from './websocketErrorHandler';
import { websocketLogger } from './websocketLogger';
import { PermanentFailureHandler, PermanentFailureReason } from './permanentFailureHandler';
import { fallbackModeManager, FallbackModeManager } from './fallbackModeManager';
import { MessagePriority } from './messageQueue';

export enum ConnectionStatus {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    CONNECTED = 'connected',
    RECONNECTING = 'reconnecting',
    FAILED = 'failed'
}

export interface ConnectionConfig {
    url: string;
    maxReconnectAttempts: number;
    connectionTimeout: number;
    heartbeatInterval: number;
    heartbeatTimeout: number;
}

/**
 * ConnectionManager handles Socket.IO connection lifecycle, reconnection logic, and health monitoring
 */
export class ConnectionManager extends EventEmitter {
    private socket: Socket | null = null;
    private config: ConnectionConfig;
    private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
    private backoff: ExponentialBackoff;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;
    private isConnecting: boolean = false;
    private lastHeartbeatResponse: number = 0;
    private connectionHealthTimer: NodeJS.Timeout | null = null;
    private connectionStartTime: number = 0;
    private errorHandler: WebSocketErrorHandler;
    private permanentFailureHandler: PermanentFailureHandler;
    private fallbackModeManager: FallbackModeManager;
    private connectionId: string;

    constructor(config: ConnectionConfig) {
        super();
        this.config = config;
        this.backoff = new ExponentialBackoff(1000, 30000, true);
        this.errorHandler = new WebSocketErrorHandler();
        this.permanentFailureHandler = new PermanentFailureHandler(config.maxReconnectAttempts);
        this.fallbackModeManager = fallbackModeManager;
        this.connectionId = this.generateConnectionId();

        // Set up error handler listeners
        this.setupErrorHandlerListeners();

        // Set up permanent failure handler listeners
        this.setupPermanentFailureHandlerListeners();

        // Set up fallback mode manager listeners
        this.setupFallbackModeManagerListeners();

        // Set up token refresh listener
        this.setupTokenRefreshListener();

        // Configure logger
        websocketLogger.setConnectionContext({
            connectionId: this.connectionId,
            url: config.url,
            attempt: 0,
            startTime: new Date()
        });
    }

    /**
     * Establish a Socket.IO connection
     */
    async establishConnection(): Promise<Socket> {
        if (this.socket?.connected) {
            return this.socket;
        }

        if (this.isConnecting) {
            return new Promise((resolve, reject) => {
                this.once('connected', () => resolve(this.socket!));
                this.once('connectionFailed', reject);
            });
        }

        this.isConnecting = true;
        this.setStatus(ConnectionStatus.CONNECTING);

        try {
            const authToken = this.getAuthToken();

            this.socket = io(this.config.url, {
                transports: ['websocket', 'polling'],
                timeout: this.config.connectionTimeout,
                auth: {
                    token: authToken
                }
            });

            this.setupSocketEventHandlers();

            return new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, this.config.connectionTimeout);

                this.once('connected', () => {
                    clearTimeout(connectionTimeout);
                    resolve(this.socket!);
                });

                this.once('connectionFailed', (error) => {
                    clearTimeout(connectionTimeout);
                    reject(error);
                });
            });

        } catch (error) {
            this.isConnecting = false;
            this.setStatus(ConnectionStatus.FAILED);
            throw error;
        }
    }

    /**
     * Handle disconnection and schedule reconnection if needed
     */
    handleDisconnection(reason: string): void {
        const wasExpected = reason === 'io server disconnect' || reason === 'io client disconnect';
        websocketLogger.logDisconnection(reason, wasExpected);

        this.isConnecting = false;
        this.stopHeartbeat();
        this.stopConnectionHealthMonitoring();

        if (reason === 'io server disconnect') {
            // Server initiated disconnect, don't reconnect automatically
            this.setStatus(ConnectionStatus.DISCONNECTED);
            this.emit('disconnected', { reason, willReconnect: false });
            return;
        }

        // Client-side disconnect or network issue, attempt reconnection
        if (this.backoff.getCurrentAttempt() < this.config.maxReconnectAttempts &&
            !this.permanentFailureHandler.isInPermanentFailure()) {
            this.scheduleReconnection();
        } else {
            this.permanentFailureHandler.emitPermanentFailure(
                PermanentFailureReason.MAX_RECONNECTION_ATTEMPTS
            );
        }

        this.emit('disconnected', { reason, willReconnect: true });
    }

    /**
     * Schedule a reconnection attempt with exponential backoff
     */
    scheduleReconnection(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.backoff.increment();
        const delay = this.backoff.getNextDelay();

        websocketLogger.logReconnectionAttempt(this.backoff.getCurrentAttempt(), delay);

        this.setStatus(ConnectionStatus.RECONNECTING);

        this.reconnectTimer = setTimeout(async () => {
            try {
                websocketLogger.logConnectionAttempt(this.config.url, this.backoff.getCurrentAttempt());
                await this.establishConnection();
            } catch (error) {
                websocketLogger.logConnectionFailure(error as Error, this.backoff.getCurrentAttempt());
                this.handleDisconnection('reconnection_failed');
            }
        }, delay);
    }

    /**
     * Authenticate the Socket.IO connection
     */
    async authenticateConnection(socket: Socket): Promise<void> {
        return new Promise((resolve, reject) => {
            const authTimeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 5000);

            socket.once('auth_success', () => {
                clearTimeout(authTimeout);
                resolve();
            });

            socket.once('auth_error', (error) => {
                clearTimeout(authTimeout);
                reject(new Error(`Authentication failed: ${error.message || error}`));
            });

            // Send authentication if not already handled by connection options
            const token = this.getAuthToken();
            if (token) {
                socket.emit('authenticate', { token });
            }
        });
    }

    /**
     * Refresh authentication token
     */
    async refreshAuthToken(): Promise<string> {
        try {
            const currentToken = this.getAuthToken();

            if (!currentToken) {
                throw new Error('No authentication token available');
            }

            // For now, return the current token as a simple refresh
            // In a real implementation, this would call an API endpoint to get a new token
            console.log('Token refresh: Using current token as refresh');
            return currentToken;
        } catch (error) {
            console.error('Failed to refresh authentication token:', error);
            throw error;
        }
    }

    /**
     * Start heartbeat mechanism
     */
    startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.socket?.connected) {
                this.lastHeartbeatResponse = 0;
                this.socket.emit('ping', { timestamp: Date.now() });
                websocketLogger.logHeartbeat('sent');

                // Set timeout for heartbeat response
                this.heartbeatTimeoutTimer = setTimeout(() => {
                    if (this.lastHeartbeatResponse === 0) {
                        const timeoutError = new Error('Heartbeat timeout - connection may be unhealthy');
                        this.errorHandler.handleTimeoutError(timeoutError, {
                            connectionId: this.connectionId,
                            heartbeatTimeout: this.config.heartbeatTimeout
                        });

                        this.emit('heartbeatTimeout');
                        this.handleDisconnection('heartbeat_timeout');
                    }
                }, this.config.heartbeatTimeout);
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat mechanism
     */
    stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }

    /**
     * Check connection health
     */
    checkConnectionHealth(): boolean {
        if (!this.socket?.connected) {
            return false;
        }

        // Check if we've received a recent heartbeat response
        const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeatResponse;
        const isHealthy = timeSinceLastHeartbeat < (this.config.heartbeatInterval * 2);

        return isHealthy;
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Get the current socket instance
     */
    getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Disconnect and cleanup
     */
    disconnect(): void {
        this.stopHeartbeat();
        this.stopConnectionHealthMonitoring();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.setStatus(ConnectionStatus.DISCONNECTED);
        this.backoff.reset();
    }

    /**
     * Set connection status and emit status change event
     */
    private setStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            const previousStatus = this.status;
            this.status = status;
            this.emit('statusChanged', { status, previousStatus });
        }
    }

    /**
     * Setup Socket.IO event handlers
     */
    private setupSocketEventHandlers(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            const connectionDuration = Date.now() - this.connectionStartTime;
            websocketLogger.logConnectionSuccess(connectionDuration);

            this.isConnecting = false;
            this.connectionStartTime = Date.now();
            this.setStatus(ConnectionStatus.CONNECTED);
            this.backoff.reset();
            this.permanentFailureHandler.reset();
            this.fallbackModeManager.onConnectionSuccess();
            this.startHeartbeat();
            this.startConnectionHealthMonitoring();
            this.emit('connected');
        });

        this.socket.on('disconnect', (reason: string) => {
            // Notify fallback mode manager of disconnection with context
            const disconnectError = new Error(`WebSocket disconnected: ${reason}`);
            this.fallbackModeManager.detectConnectionFailure(disconnectError, {
                connectionAttempts: this.backoff.getCurrentAttempt(),
                lastSuccessfulConnection: this.connectionStartTime > 0 ? new Date(this.connectionStartTime) : undefined,
                errorType: 'network'
            });
            this.handleDisconnection(reason);
        });

        this.socket.on('connect_error', (error: Error) => {
            websocketLogger.logConnectionFailure(error, this.backoff.getCurrentAttempt());
            this.isConnecting = false;

            // Notify fallback mode manager of connection failure with enhanced context
            this.fallbackModeManager.detectConnectionFailure(error, {
                connectionAttempts: this.backoff.getCurrentAttempt(),
                lastSuccessfulConnection: this.connectionStartTime > 0 ? new Date(this.connectionStartTime) : undefined,
                errorType: this.categorizeError(error)
            });

            // Use error handler to categorize and handle the error
            if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
                this.errorHandler.handleAuthenticationError(error, {
                    connectionId: this.connectionId,
                    attempt: this.backoff.getCurrentAttempt()
                });
            } else if (error.message.includes('network') || error.message.includes('timeout')) {
                this.errorHandler.handleNetworkError(error, {
                    connectionId: this.connectionId,
                    attempt: this.backoff.getCurrentAttempt()
                });
            } else {
                this.errorHandler.handleConnectionError(error, {
                    connectionId: this.connectionId,
                    attempt: this.backoff.getCurrentAttempt()
                });
            }

            this.setStatus(ConnectionStatus.FAILED);
            this.emit('connectionFailed', error);
        });

        this.socket.on('auth_error', (error: any) => {
            websocketLogger.logAuthenticationFailure(error);
            this.errorHandler.handleAuthenticationError(error, {
                connectionId: this.connectionId,
                attempt: this.backoff.getCurrentAttempt()
            });
        });

        this.socket.on('pong', () => {
            const now = Date.now();
            const latency = this.lastHeartbeatResponse > 0 ? now - this.lastHeartbeatResponse : undefined;
            this.lastHeartbeatResponse = now;

            websocketLogger.logHeartbeat('received', latency);

            if (this.heartbeatTimeoutTimer) {
                clearTimeout(this.heartbeatTimeoutTimer);
                this.heartbeatTimeoutTimer = null;
            }
        });
    }



    /**
     * Get authentication token from localStorage
     */
    private getAuthToken(): string | null {
        return localStorage.getItem('authToken');
    }

    /**
     * Generate unique connection ID
     */
    private generateConnectionId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Setup error handler event listeners
     */
    private setupErrorHandlerListeners(): void {
        this.errorHandler.on('connectionError', (error) => {
            this.permanentFailureHandler.trackReconnectionAttempt(error);
        });

        this.errorHandler.on('authenticationError', (error) => {
            // Check if this should trigger permanent failure
            if (this.permanentFailureHandler.shouldTriggerPermanentFailure(error)) {
                this.permanentFailureHandler.handleAuthenticationFailure(error);
            }
        });

        this.errorHandler.on('networkError', (error) => {
            this.permanentFailureHandler.trackReconnectionAttempt(error);
        });

        this.errorHandler.on('serverError', (error) => {
            this.permanentFailureHandler.trackReconnectionAttempt(error);
        });

        this.errorHandler.on('timeoutError', (error) => {
            this.permanentFailureHandler.trackReconnectionAttempt(error);
        });

        this.errorHandler.on('protocolError', (error) => {
            // Protocol errors don't usually require reconnection
            websocketLogger.warn('ConnectionManager', 'Protocol error occurred', {
                errorCode: error.code,
                message: error.message
            });
        });
    }

    /**
     * Setup permanent failure handler event listeners
     */
    private setupPermanentFailureHandlerListeners(): void {
        this.permanentFailureHandler.on('permanentFailure', (failure) => {
            websocketLogger.error('ConnectionManager', 'Permanent failure detected', {
                reason: failure.reason,
                attemptCount: failure.attemptCount
            });

            this.setStatus(ConnectionStatus.FAILED);
            this.emit('permanentFailure', failure);
        });

        this.permanentFailureHandler.on('stopReconnection', () => {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
        });

        this.permanentFailureHandler.on('retryConnection', () => {
            this.establishConnection().catch(error => {
                websocketLogger.error('ConnectionManager', 'Retry connection failed', {}, error);
            });
        });

        this.permanentFailureHandler.on('enableFallbackMode', () => {
            this.emit('requestFallbackMode');
        });

        this.permanentFailureHandler.on('requestReauthentication', () => {
            this.emit('requestReauthentication');
        });
    }

    /**
     * Get error handler instance
     */
    getErrorHandler(): WebSocketErrorHandler {
        return this.errorHandler;
    }

    /**
     * Set up token refresh listener
     */
    private setupTokenRefreshListener(): void {
        this.errorHandler.on('tokenRefreshRequested', async ({ resolve, reject }) => {
            try {
                console.log('ConnectionManager: Token refresh requested');
                const newToken = await this.refreshAuthToken();
                console.log('ConnectionManager: Token refresh successful');
                resolve();
            } catch (error) {
                console.error('ConnectionManager: Token refresh failed', error);
                reject(error);
            }
        });
    }

    /**
     * Get permanent failure handler instance
     */
    getPermanentFailureHandler(): PermanentFailureHandler {
        return this.permanentFailureHandler;
    }

    /**
     * Setup fallback mode manager event listeners
     */
    private setupFallbackModeManagerListeners(): void {
        this.fallbackModeManager.on('fallbackActivated', (event) => {
            websocketLogger.info('ConnectionManager', 'Fallback mode activated', {
                reason: event.reason,
                failureCount: event.failureCount
            });
            this.emit('fallbackModeActivated', event);
        });

        this.fallbackModeManager.on('fallbackDeactivated', (event) => {
            websocketLogger.info('ConnectionManager', 'Fallback mode deactivated', {
                reason: event.reason
            });
            this.emit('fallbackModeDeactivated', event);
        });

        this.fallbackModeManager.on('modeChanged', (event) => {
            this.emit('fallbackModeChanged', event);
        });

        // Forward polling events
        this.fallbackModeManager.on('pollingUpdate', (update) => {
            this.emit('pollingUpdate', update);
        });

        ['bookingsUpdate', 'swapsUpdate', 'proposalsUpdate', 'auctionsUpdate', 'genericUpdate'].forEach(eventName => {
            this.fallbackModeManager.on(eventName, (data) => {
                this.emit(eventName, data);
            });
        });
    }

    /**
     * Get fallback mode manager instance
     */
    getFallbackModeManager(): FallbackModeManager {
        return this.fallbackModeManager;
    }

    /**
     * Update current subscriptions in fallback mode manager
     */
    public updateSubscriptions(subscriptions: string[]): void {
        this.fallbackModeManager.setCurrentSubscriptions(subscriptions);
    }

    /**
     * Get connection diagnostics
     */
    getConnectionDiagnostics() {
        return {
            connectionId: this.connectionId,
            status: this.status,
            uptime: this.connectionStartTime > 0 ? Date.now() - this.connectionStartTime : 0,
            attemptCount: this.backoff.getCurrentAttempt(),
            errorHistory: this.errorHandler.getErrorHistory(),
            permanentFailureState: this.permanentFailureHandler.getPermanentFailureState(),
            fallbackModeStatus: this.fallbackModeManager.getStatus(),
            loggerDiagnostics: websocketLogger.collectDiagnosticInfo()
        };
    }

    /**
     * Start periodic connection health monitoring
     */
    private startConnectionHealthMonitoring(): void {
        this.stopConnectionHealthMonitoring();

        // Check connection health every 10 seconds
        this.connectionHealthTimer = setInterval(() => {
            this.performConnectionHealthCheck();
        }, 10000);
    }

    /**
     * Stop connection health monitoring
     */
    private stopConnectionHealthMonitoring(): void {
        if (this.connectionHealthTimer) {
            clearInterval(this.connectionHealthTimer);
            this.connectionHealthTimer = null;
        }
    }

    /**
     * Perform a comprehensive connection health check
     */
    private performConnectionHealthCheck(): void {
        const now = Date.now();

        if (!this.socket?.connected) {
            this.emit('healthCheck', {
                healthy: false,
                reason: 'Socket not connected',
                timestamp: now
            });
            return;
        }

        // Check heartbeat responsiveness
        const timeSinceLastHeartbeat = now - this.lastHeartbeatResponse;
        const heartbeatHealthy = this.lastHeartbeatResponse === 0 ||
            timeSinceLastHeartbeat < (this.config.heartbeatInterval * 2);

        // Check connection uptime
        const uptime = this.connectionStartTime > 0 ? now - this.connectionStartTime : 0;

        const healthStatus = {
            healthy: heartbeatHealthy,
            uptime,
            timeSinceLastHeartbeat,
            heartbeatHealthy,
            timestamp: now
        };

        this.emit('healthCheck', healthStatus);

        // If unhealthy, consider reconnection
        if (!heartbeatHealthy) {
            console.warn('Connection health check failed - considering reconnection');
            this.handleDisconnection('health_check_failed');
        }
    }

    /**
     * Categorize connection errors for fallback mode decision making
     */
    private categorizeError(error: Error): 'network' | 'authentication' | 'timeout' | 'server' {
        const message = error.message.toLowerCase();

        if (message.includes('auth') || message.includes('unauthorized') ||
            message.includes('forbidden') || message.includes('token')) {
            return 'authentication';
        }

        if (message.includes('timeout') || message.includes('timed out')) {
            return 'timeout';
        }

        if (message.includes('server') || message.includes('internal') ||
            message.includes('503') || message.includes('502') || message.includes('500')) {
            return 'server';
        }

        // Default to network error for connection issues
        return 'network';
    }

    /**
     * Queue a message for later transmission when connection is restored
     */
    public queueMessage(event: string, data: any, priority?: 'low' | 'normal' | 'high' | 'critical'): string {
        // Convert priority string to MessagePriority enum
        let messagePriority: MessagePriority;
        switch (priority) {
            case 'low':
                messagePriority = MessagePriority.LOW;
                break;
            case 'normal':
                messagePriority = MessagePriority.NORMAL;
                break;
            case 'high':
                messagePriority = MessagePriority.HIGH;
                break;
            case 'critical':
                messagePriority = MessagePriority.CRITICAL;
                break;
            default:
                messagePriority = MessagePriority.NORMAL;
        }

        return this.fallbackModeManager.queueMessage(event, data, messagePriority);
    }

    /**
     * Flush all queued messages by attempting to send them
     */
    public async flushQueuedMessages(): Promise<void> {
        // If we have an active socket connection, flush messages through WebSocket
        if (this.socket?.connected) {
            const queueStats = this.fallbackModeManager.getMessageQueueStats();
            if (queueStats.queueSize > 0) {
                websocketLogger.info('QueueFlush', 'Flushing queued messages through WebSocket');

                // Get queued messages and send them through the socket
                const queuedMessages = this.fallbackModeManager.getQueuedMessages();

                for (const message of queuedMessages) {
                    try {
                        this.socket.emit(message.event, message.data);
                        websocketLogger.logMessageSent(message.event, message.data, { source: 'queue' });
                    } catch (error) {
                        websocketLogger.error('QueueFlush', 'Failed to send queued message', { event: message.event }, error as Error);
                    }
                }

                // Clear the queue after successful transmission
                this.fallbackModeManager.clearMessageQueue();
            }
        } else {
            // If no socket connection, delegate to fallback mode manager for HTTP transmission
            await this.fallbackModeManager.flushQueuedMessages();
        }
    }

    /**
     * Get message queue statistics
     */
    public getMessageQueueStats() {
        return this.fallbackModeManager.getMessageQueueStats();
    }

    /**
     * Clear all queued messages
     */
    public clearMessageQueue(): void {
        this.fallbackModeManager.clearMessageQueue();
    }

    /**
     * Get all queued messages (for debugging/monitoring)
     */
    public getQueuedMessages() {
        return this.fallbackModeManager.getQueuedMessages();
    }

}