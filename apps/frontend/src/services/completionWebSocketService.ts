import { io, Socket } from 'socket.io-client';
import { logger } from '@/utils/logger';
import CompletionNotificationService from './completionNotificationService';
import {
    connectionThrottlingManager,
    connectionStateChecker,
    ConnectionThrottleConfig
} from '@/utils/connectionThrottling';
import { getServiceConfig, isThrottlingFeatureEnabled } from '@/config/connectionThrottling';

/**
 * CompletionWebSocketService handles real-time completion events
 * Manages WebSocket connections for swap completion status updates
 * 
 * Requirements: 8.5, 1.2, 1.3, 2.1
 */
export class CompletionWebSocketService {
    private static readonly SERVICE_ID = 'completionWebSocketService';

    private socket: Socket | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectDelay: number = 1000;
    private eventHandlers: Map<string, Function[]> = new Map();
    private throttleConfig: ConnectionThrottleConfig;

    constructor(private baseUrl: string = import.meta.env.VITE_WS_URL || 'http://localhost:3001') {
        this.throttleConfig = getServiceConfig(CompletionWebSocketService.SERVICE_ID);
        this.setupEventHandlers();
    }

    /**
     * Connect to WebSocket server with authentication and throttling
     * Requirements: 1.2, 1.3, 2.1
     */
    async connect(token: string): Promise<void> {
        // Check if throttling is enabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return this.connectDirect(token);
        }

        // Check connection state before attempting new connection
        if (!connectionStateChecker.canConnect(CompletionWebSocketService.SERVICE_ID)) {
            const status = connectionStateChecker.getConnectionStatus(CompletionWebSocketService.SERVICE_ID);

            if (status.isConnected) {
                logger.debug('CompletionWebSocketService already connected, skipping connection attempt');
                return;
            }

            if (status.throttlingStatus.isPending) {
                logger.debug('CompletionWebSocketService connection already pending, skipping duplicate attempt');
                return;
            }

            if (!status.canConnect) {
                const nextAttempt = status.throttlingStatus.nextAllowedAttempt;
                const message = nextAttempt
                    ? `Connection throttled until ${new Date(nextAttempt).toISOString()}`
                    : 'Connection throttled due to rate limiting or max retries';

                logger.warn('CompletionWebSocketService connection attempt blocked by throttling', {
                    attemptCount: status.throttlingStatus.attemptCount,
                    attemptsInWindow: status.throttlingStatus.attemptsInWindow,
                    nextAllowedAttempt: nextAttempt
                });

                throw new Error(message);
            }
        }

        // Use throttled connection with debouncing
        return connectionThrottlingManager.debounceConnection(
            CompletionWebSocketService.SERVICE_ID,
            () => this.connectDirect(token),
            this.throttleConfig.debounceDelay
        );
    }

    /**
     * Direct connection method without throttling (internal use)
     * Requirements: 8.5
     */
    private async connectDirect(token: string): Promise<void> {
        try {
            // Set connecting state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, false);

            if (this.socket?.connected) {
                logger.info('Completion WebSocket already connected');
                connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, true);
                return;
            }

            this.socket = io(this.baseUrl, {
                auth: { token },
                transports: ['websocket', 'polling'],
                timeout: this.throttleConfig.connectionTimeout,
                forceNew: true
            });

            this.setupSocketEventListeners();

            return new Promise((resolve, reject) => {
                if (!this.socket) {
                    reject(new Error('Socket not initialized'));
                    return;
                }

                this.socket.on('connect', () => {
                    this.isConnected = true;
                    this.reconnectAttempts = 0;

                    // Set connected state
                    connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, true);

                    // Reset throttling tracking on successful connection
                    if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
                        connectionThrottlingManager.resetConnectionTracking(CompletionWebSocketService.SERVICE_ID);
                    }

                    logger.info('Completion WebSocket connected');
                    resolve();
                });

                this.socket.on('connect_error', (error) => {
                    logger.error('Completion WebSocket connection failed', { error });
                    reject(error);
                });

                // Set connection timeout
                setTimeout(() => {
                    if (!this.isConnected) {
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, this.throttleConfig.connectionTimeout);
            });
        } catch (error) {
            // Set disconnected state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, false);

            logger.error('Failed to connect completion WebSocket', { error });
            throw error;
        }
    }

    /**
     * Disconnect from WebSocket server
     * Requirements: 2.1
     */
    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;

            // Update connection state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, false);

            // Clear any pending throttled connections
            if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
                connectionThrottlingManager.clearDebounce(CompletionWebSocketService.SERVICE_ID);
            }

            logger.info('Completion WebSocket disconnected');
        }
    }

    /**
     * Subscribe to completion updates for a specific proposal
     */
    subscribeToCompletion(proposalId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('completion:subscribe', { proposalId });
            logger.info('Subscribed to completion updates', { proposalId });
        }
    }

    /**
     * Unsubscribe from completion updates for a specific proposal
     */
    unsubscribeFromCompletion(proposalId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('completion:unsubscribe', { proposalId });
            logger.info('Unsubscribed from completion updates', { proposalId });
        }
    }

    /**
     * Mark completion status as read
     */
    markCompletionStatusRead(proposalId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('completion:status_read', { proposalId });
            logger.info('Marked completion status as read', { proposalId });
        }
    }

    /**
     * Acknowledge ownership transfer
     */
    acknowledgeOwnershipTransfer(bookingId: string, proposalId: string): void {
        if (this.socket?.connected) {
            this.socket.emit('ownership:transfer_acknowledged', { bookingId, proposalId });
            logger.info('Acknowledged ownership transfer', { bookingId, proposalId });
        }
    }

    /**
     * Add event handler for completion events
     */
    on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    /**
     * Remove event handler
     */
    off(event: string, handler: Function): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * Emit event to registered handlers
     */
    private emit(event: string, data: any): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    logger.error('Error in completion event handler', { event, error });
                }
            });
        }
    }

    /**
     * Setup default event handlers
     */
    private setupEventHandlers(): void {
        // Handle completion status updates
        this.on('completion:status_update', (data: any) => {
            logger.info('Received completion status update', data);

            // Create appropriate notification based on status
            if (data.status === 'completed') {
                const notification = CompletionNotificationService.createCompletionSuccessNotification(
                    data,
                    'accepter' // This would need to be determined based on user context
                );
                this.emit('notification:created', notification);
            } else if (data.status === 'failed') {
                const notification = CompletionNotificationService.createCompletionFailureNotification({
                    proposalId: data.proposalId,
                    errorMessage: data.errorDetails || 'Completion failed',
                    rollbackSuccessful: data.status !== 'failed',
                    requiresManualIntervention: true
                });
                this.emit('notification:created', notification);
            }
        });

        // Handle ownership transfer updates
        this.on('ownership:transferred', (data: any) => {
            logger.info('Received ownership transfer update', data);

            // Determine user role based on current user context
            // This would need to be implemented based on your user context system
            const userRole = 'new_owner'; // This should be determined dynamically

            const notification = CompletionNotificationService.createOwnershipTransferNotification(
                data,
                userRole
            );
            this.emit('notification:created', notification);
        });

        // Handle validation warnings
        this.on('completion:validation_warning', (data: any) => {
            logger.info('Received completion validation warning', data);

            const notification = CompletionNotificationService.createValidationWarningNotification(data);
            this.emit('notification:created', notification);
        });
    }

    /**
     * Setup socket event listeners
     */
    private setupSocketEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;

            // Update connection state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, true);

            // Reset throttling tracking on successful connection
            if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
                connectionThrottlingManager.resetConnectionTracking(CompletionWebSocketService.SERVICE_ID);
            }

            logger.info('Completion WebSocket connected');
        });

        this.socket.on('disconnect', (reason) => {
            this.isConnected = false;

            // Update connection state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, false);

            logger.info('Completion WebSocket disconnected', { reason });

            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect automatically
                return;
            }

            this.attemptReconnect();
        });

        this.socket.on('connect_error', (error) => {
            logger.error('Completion WebSocket connection error', { error });

            // Update connection state
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, false);

            this.attemptReconnect();
        });

        // Completion-specific events
        this.socket.on('completion:status_update', (data) => {
            this.emit('completion:status_update', data);
        });

        this.socket.on('ownership:transferred', (data) => {
            this.emit('ownership:transferred', data);
        });

        this.socket.on('completion:validation_warning', (data) => {
            this.emit('completion:validation_warning', data);
        });

        // Handle read acknowledgments
        this.socket.on('completion:status_read', (proposalId) => {
            this.emit('completion:status_read', proposalId);
        });

        this.socket.on('ownership:transfer_acknowledged', (data) => {
            this.emit('ownership:transfer_acknowledged', data);
        });
    }

    /**
     * Attempt to reconnect with exponential backoff and throttling
     * Requirements: 1.2, 1.3, 2.1
     */
    private async attemptReconnect(): Promise<void> {
        // Use throttling config for max retries if available
        const maxRetries = isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')
            ? this.throttleConfig.maxRetries
            : this.maxReconnectAttempts;

        if (this.reconnectAttempts >= maxRetries) {
            logger.error('Max reconnection attempts reached for completion WebSocket');
            return;
        }

        this.reconnectAttempts++;

        // Use throttling config for retry delay if available and exponential backoff is enabled
        let delay = this.reconnectDelay;
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            delay = this.throttleConfig.retryDelay;
            if (isThrottlingFeatureEnabled('ENABLE_EXPONENTIAL_BACKOFF')) {
                delay = delay * Math.pow(2, this.reconnectAttempts - 1);
            }
        } else {
            delay = delay * Math.pow(2, this.reconnectAttempts - 1);
        }

        logger.info('Attempting to reconnect completion WebSocket', {
            attempt: this.reconnectAttempts,
            maxRetries,
            delay,
            throttlingEnabled: isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')
        });

        setTimeout(async () => {
            if (this.socket && !this.socket.connected) {
                try {
                    // Get the token from the socket auth or use a default
                    const token = (this.socket.auth as any)?.token || '';
                    await this.connect(token);
                } catch (error) {
                    logger.error('Retry connection failed', { error });
                }
            }
        }, delay);
    }

    /**
     * Get connection status with throttling awareness
     * Requirements: 2.1
     */
    isSocketConnected(): boolean {
        const socketConnected = this.isConnected && this.socket?.connected === true;
        const stateCheckerConnected = connectionStateChecker.isConnected(CompletionWebSocketService.SERVICE_ID);

        // Sync connection states if they differ
        if (socketConnected !== stateCheckerConnected) {
            connectionStateChecker.setConnectionState(CompletionWebSocketService.SERVICE_ID, socketConnected);
        }

        return socketConnected;
    }

    /**
     * Get socket instance for direct access (use with caution)
     */
    getSocket(): Socket | null {
        return this.socket;
    }

    /**
     * Get throttling status for debugging and monitoring
     * Requirements: 2.1
     */
    public getThrottlingStatus(): {
        serviceId: string;
        throttlingEnabled: boolean;
        connectionStatus: ReturnType<typeof connectionStateChecker.getConnectionStatus>;
        config: ConnectionThrottleConfig;
    } | null {
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return null;
        }

        return {
            serviceId: CompletionWebSocketService.SERVICE_ID,
            throttlingEnabled: true,
            connectionStatus: connectionStateChecker.getConnectionStatus(CompletionWebSocketService.SERVICE_ID),
            config: this.throttleConfig,
        };
    }

    /**
     * Force reset throttling state (for debugging/testing)
     * Requirements: 2.1
     */
    public resetThrottling(): void {
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            connectionStateChecker.resetConnectionState(CompletionWebSocketService.SERVICE_ID);
            logger.info('CompletionWebSocketService throttling state reset');
        }
    }

    /**
     * Get current connection and throttling status
     * Requirements: 2.1
     */
    public getConnectionStatus(): {
        isConnected: boolean;
        isSocketConnected: boolean;
        reconnectAttempts: number;
        maxReconnectAttempts: number;
        throttlingStatus?: ReturnType<typeof connectionStateChecker.getConnectionStatus>;
    } {
        const status = {
            isConnected: this.isConnected,
            isSocketConnected: this.isSocketConnected(),
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')
                ? this.throttleConfig.maxRetries
                : this.maxReconnectAttempts,
        };

        // Add throttling status if enabled
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return {
                ...status,
                throttlingStatus: connectionStateChecker.getConnectionStatus(CompletionWebSocketService.SERVICE_ID),
            };
        }

        return status;
    }
}

// Export singleton instance
export const completionWebSocketService = new CompletionWebSocketService();
export default completionWebSocketService;