import { EventEmitter } from 'events';
import { fallbackPollingService, FallbackPollingService } from './fallbackPollingService';
import { MessagePriority } from './messageQueue';
import { logger } from '@/utils/logger';

export enum FallbackMode {
    DISABLED = 'disabled',
    ACTIVATING = 'activating',
    ACTIVE = 'active',
    DEACTIVATING = 'deactivating'
}

export interface FallbackModeConfig {
    activationDelay: number; // Delay before activating fallback mode
    deactivationDelay: number; // Delay before deactivating fallback mode
    connectionFailureThreshold: number; // Number of failures before activating
    autoActivate: boolean; // Whether to automatically activate fallback mode
}

export interface FallbackModeStatus {
    mode: FallbackMode;
    activatedAt?: Date;
    deactivatedAt?: Date;
    connectionFailures: number;
    lastFailureAt?: Date;
    pollingActive: boolean;
}

/**
 * Manages automatic fallback mode activation and deactivation
 * Coordinates between WebSocket connection status and polling service
 */
export class FallbackModeManager extends EventEmitter {
    private config: FallbackModeConfig;
    private currentMode: FallbackMode = FallbackMode.DISABLED;
    private connectionFailures: number = 0;
    private activationTimer: NodeJS.Timeout | null = null;
    private deactivationTimer: NodeJS.Timeout | null = null;
    private activatedAt: Date | null = null;
    private deactivatedAt: Date | null = null;
    private lastFailureAt: Date | null = null;
    private pollingService: FallbackPollingService;
    private currentSubscriptions: string[] = [];

    constructor(
        pollingService: FallbackPollingService = fallbackPollingService,
        config: Partial<FallbackModeConfig> = {}
    ) {
        super();

        this.pollingService = pollingService;
        this.config = {
            activationDelay: config.activationDelay || 5000, // 5 seconds
            deactivationDelay: config.deactivationDelay || 10000, // 10 seconds
            connectionFailureThreshold: config.connectionFailureThreshold || 2,
            autoActivate: config.autoActivate ?? true,
        };

        logger.debug('FallbackModeManager initialized', this.config);

        // Listen to polling service events
        this.setupPollingServiceListeners();
    }

    /**
     * Detect connection failure and potentially activate fallback mode
     */
    public onConnectionFailure(reason: string): void {
        this.connectionFailures++;
        this.lastFailureAt = new Date();

        logger.warn('Connection failure detected', {
            reason,
            failureCount: this.connectionFailures,
            threshold: this.config.connectionFailureThreshold,
            currentMode: this.currentMode
        });

        this.emit('connectionFailure', {
            reason,
            failureCount: this.connectionFailures,
            timestamp: this.lastFailureAt
        });

        // Check if we should activate fallback mode
        if (this.shouldActivateFallback()) {
            this.scheduleActivation();
        }
    }

    /**
     * Detect connection failure scenarios that should trigger immediate fallback
     */
    public detectConnectionFailure(error: Error, context?: {
        connectionAttempts?: number;
        lastSuccessfulConnection?: Date;
        errorType?: 'network' | 'authentication' | 'timeout' | 'server';
    }): void {
        const errorType = this.categorizeConnectionError(error);
        const shouldActivateImmediately = this.shouldActivateImmediateFallback(error, errorType, context);

        logger.info('Connection failure detected for fallback evaluation', {
            error: error.message,
            errorType,
            shouldActivateImmediately,
            currentMode: this.currentMode,
            connectionAttempts: context?.connectionAttempts || 0
        });

        if (shouldActivateImmediately) {
            logger.warn('Immediate fallback activation triggered', {
                reason: error.message,
                errorType
            });
            this.forceActivation();
        } else {
            this.onConnectionFailure(error.message);
        }
    }

    /**
     * Handle successful connection and potentially deactivate fallback mode
     */
    public onConnectionSuccess(): void {
        logger.info('Connection success detected', {
            previousFailures: this.connectionFailures,
            currentMode: this.currentMode
        });

        // Reset failure counter
        this.connectionFailures = 0;
        this.lastFailureAt = null;

        this.emit('connectionSuccess', {
            timestamp: new Date()
        });

        // Cancel any pending activation
        if (this.activationTimer) {
            clearTimeout(this.activationTimer);
            this.activationTimer = null;
            logger.debug('Cancelled pending fallback activation due to connection success');
        }

        // Schedule deactivation if in fallback mode
        if (this.currentMode === FallbackMode.ACTIVE) {
            this.scheduleDeactivation();
        }
    }

    /**
     * Manually activate fallback mode
     */
    public activateFallbackMode(): void {
        if (this.currentMode === FallbackMode.ACTIVE || this.currentMode === FallbackMode.ACTIVATING) {
            logger.debug('Fallback mode already active or activating');
            return;
        }

        logger.info('Manually activating fallback mode');
        this.performActivation();
    }

    /**
     * Manually deactivate fallback mode
     */
    public deactivateFallbackMode(): void {
        if (this.currentMode === FallbackMode.DISABLED || this.currentMode === FallbackMode.DEACTIVATING) {
            logger.debug('Fallback mode already disabled or deactivating');
            return;
        }

        logger.info('Manually deactivating fallback mode');
        this.performDeactivation();
    }

    /**
     * Implement seamless transition from WebSocket to polling
     */
    private performSeamlessTransitionToPolling(): void {
        logger.info('Performing seamless transition from WebSocket to polling');

        try {
            // 1. Preserve current subscriptions and state
            const currentSubscriptions = this.getCurrentSubscriptions();
            const pendingMessages = this.getPendingMessages();

            logger.debug('Preserving state for seamless transition', {
                subscriptions: currentSubscriptions.length,
                pendingMessages: pendingMessages.length
            });

            // 2. Start polling service with preserved state
            this.pollingService.startPolling();

            // 3. Restore subscriptions in polling mode
            this.restoreSubscriptionsInPollingMode(currentSubscriptions);

            // 4. Queue any pending messages for HTTP transmission
            this.queuePendingMessagesForHttp(pendingMessages);

            // 5. Emit transition complete event
            this.emit('seamlessTransitionCompleted', {
                from: 'websocket',
                to: 'polling',
                timestamp: new Date(),
                preservedSubscriptions: currentSubscriptions.length,
                queuedMessages: pendingMessages.length
            });

            logger.info('Seamless transition to polling completed successfully');

        } catch (error) {
            logger.error('Failed to perform seamless transition to polling', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Fallback to basic polling activation
            this.pollingService.startPolling();
        }
    }

    /**
     * Implement seamless transition from polling to WebSocket
     */
    private performSeamlessTransitionToWebSocket(): void {
        logger.info('Performing seamless transition from polling to WebSocket');

        try {
            // 1. Preserve current polling state
            const pollingStats = this.pollingService.getPollingStats();
            const queuedMessages = this.pollingService.getMessageQueueStats();

            logger.debug('Preserving polling state for seamless transition', {
                pollingActive: pollingStats.isActive,
                queuedMessages: queuedMessages.queueSize
            });

            // 2. Flush any queued messages before stopping polling
            this.pollingService.flushQueuedMessages().catch(error => {
                logger.warn('Failed to flush messages during transition', {
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            });

            // 3. Stop polling service
            this.pollingService.stopPolling();

            // 4. Emit transition complete event
            this.emit('seamlessTransitionCompleted', {
                from: 'polling',
                to: 'websocket',
                timestamp: new Date(),
                flushedMessages: queuedMessages.queueSize
            });

            logger.info('Seamless transition to WebSocket completed successfully');

        } catch (error) {
            logger.error('Failed to perform seamless transition to WebSocket', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            // Ensure polling is stopped even if transition fails
            this.pollingService.stopPolling();
        }
    }

    /**
     * Get current fallback mode status
     */
    public getStatus(): FallbackModeStatus {
        return {
            mode: this.currentMode,
            activatedAt: this.activatedAt || undefined,
            deactivatedAt: this.deactivatedAt || undefined,
            connectionFailures: this.connectionFailures,
            lastFailureAt: this.lastFailureAt || undefined,
            pollingActive: this.pollingService.isPollingActive()
        };
    }

    /**
     * Check if fallback mode is currently active
     */
    public isActive(): boolean {
        return this.currentMode === FallbackMode.ACTIVE;
    }

    /**
     * Force immediate transition to fallback mode (for emergency scenarios)
     */
    public forceActivation(): void {
        logger.warn('Force activating fallback mode');

        // Cancel any pending timers
        this.cancelPendingTimers();

        // Immediately activate
        this.performActivation();
    }

    /**
     * Queue a message for later transmission when connection is restored
     */
    public queueMessage(event: string, data: any, priority?: MessagePriority): string {
        return this.pollingService.queueMessage(event, data, priority);
    }

    /**
     * Get message queue statistics
     */
    public getMessageQueueStats() {
        return this.pollingService.getMessageQueueStats();
    }

    /**
     * Clear all queued messages
     */
    public clearMessageQueue(): void {
        this.pollingService.clearMessageQueue();
    }

    /**
     * Get all queued messages (for debugging/monitoring)
     */
    public getQueuedMessages() {
        return this.pollingService.getQueuedMessages();
    }

    /**
     * Flush queued messages by sending them via HTTP API
     */
    public async flushQueuedMessages(): Promise<void> {
        await this.pollingService.flushQueuedMessages();
    }

    /**
     * Reset the fallback mode manager state
     */
    public reset(): void {
        logger.info('Resetting fallback mode manager');

        this.cancelPendingTimers();
        this.connectionFailures = 0;
        this.lastFailureAt = null;

        if (this.currentMode === FallbackMode.ACTIVE) {
            this.performDeactivation();
        } else {
            this.setMode(FallbackMode.DISABLED);
        }
    }

    /**
     * Schedule fallback mode activation after delay
     */
    private scheduleActivation(): void {
        if (this.activationTimer) {
            logger.debug('Activation already scheduled');
            return;
        }

        logger.info('Scheduling fallback mode activation', {
            delay: this.config.activationDelay
        });

        this.setMode(FallbackMode.ACTIVATING);

        this.activationTimer = setTimeout(() => {
            this.activationTimer = null;
            this.performActivation();
        }, this.config.activationDelay);
    }

    /**
     * Schedule fallback mode deactivation after delay
     */
    private scheduleDeactivation(): void {
        if (this.deactivationTimer) {
            logger.debug('Deactivation already scheduled');
            return;
        }

        logger.info('Scheduling fallback mode deactivation', {
            delay: this.config.deactivationDelay
        });

        this.setMode(FallbackMode.DEACTIVATING);

        this.deactivationTimer = setTimeout(() => {
            this.deactivationTimer = null;
            this.performDeactivation();
        }, this.config.deactivationDelay);
    }

    /**
     * Actually activate fallback mode
     */
    private performActivation(): void {
        logger.info('Activating fallback mode');

        this.cancelPendingTimers();
        this.setMode(FallbackMode.ACTIVE);
        this.activatedAt = new Date();

        // Perform seamless transition to polling
        this.performSeamlessTransitionToPolling();

        this.emit('fallbackActivated', {
            timestamp: this.activatedAt,
            reason: 'connection_failure',
            failureCount: this.connectionFailures
        });
    }

    /**
     * Actually deactivate fallback mode
     */
    private performDeactivation(): void {
        logger.info('Deactivating fallback mode');

        this.cancelPendingTimers();
        this.setMode(FallbackMode.DISABLED);
        this.deactivatedAt = new Date();

        // Perform seamless transition to WebSocket
        this.performSeamlessTransitionToWebSocket();

        this.emit('fallbackDeactivated', {
            timestamp: this.deactivatedAt,
            reason: 'connection_restored'
        });
    }

    /**
     * Set the current mode and emit change event
     */
    private setMode(mode: FallbackMode): void {
        const previousMode = this.currentMode;
        this.currentMode = mode;

        logger.debug('Fallback mode changed', {
            from: previousMode,
            to: mode
        });

        this.emit('modeChanged', {
            previousMode,
            currentMode: mode,
            timestamp: new Date()
        });
    }

    /**
     * Check if fallback mode should be activated
     */
    private shouldActivateFallback(): boolean {
        return (
            this.config.autoActivate &&
            this.connectionFailures >= this.config.connectionFailureThreshold &&
            this.currentMode === FallbackMode.DISABLED
        );
    }

    /**
     * Cancel any pending activation or deactivation timers
     */
    private cancelPendingTimers(): void {
        if (this.activationTimer) {
            clearTimeout(this.activationTimer);
            this.activationTimer = null;
            logger.debug('Cancelled pending activation timer');
        }

        if (this.deactivationTimer) {
            clearTimeout(this.deactivationTimer);
            this.deactivationTimer = null;
            logger.debug('Cancelled pending deactivation timer');
        }
    }

    /**
     * Setup listeners for polling service events
     */
    private setupPollingServiceListeners(): void {
        this.pollingService.on('pollingStarted', () => {
            logger.debug('Polling service started');
            this.emit('pollingStarted');
        });

        this.pollingService.on('pollingStopped', () => {
            logger.debug('Polling service stopped');
            this.emit('pollingStopped');
        });

        this.pollingService.on('pollingError', (error) => {
            logger.warn('Polling service error', error);
            this.emit('pollingError', error);
        });

        this.pollingService.on('pollingUpdate', (update) => {
            // Forward polling updates
            this.emit('pollingUpdate', update);
        });

        // Forward specific update events
        ['bookingsUpdate', 'swapsUpdate', 'proposalsUpdate', 'auctionsUpdate', 'genericUpdate'].forEach(eventName => {
            this.pollingService.on(eventName, (data) => {
                this.emit(eventName, data);
            });
        });
    }

    /**
     * Get current subscriptions from the application state
     * This would typically integrate with the RealtimeService to get active subscriptions
     */
    private getCurrentSubscriptions(): string[] {
        // This will be populated by the integration layer (RealtimeService)
        // when the fallback mode manager is properly integrated
        return this.currentSubscriptions || [];
    }

    /**
     * Set current subscriptions (called by RealtimeService during integration)
     */
    public setCurrentSubscriptions(subscriptions: string[]): void {
        this.currentSubscriptions = subscriptions;
        logger.debug('Updated current subscriptions for fallback mode', {
            subscriptionCount: subscriptions.length
        });
    }

    /**
     * Get pending messages that need to be transmitted
     */
    private getPendingMessages(): Array<{ event: string; data: any; timestamp: Date }> {
        // In a real implementation, this would get pending messages from a message queue
        // For now, return empty array as this is handled by the message queue service
        return [];
    }

    /**
     * Restore subscriptions in polling mode by configuring appropriate polling endpoints
     */
    private restoreSubscriptionsInPollingMode(subscriptions: string[]): void {
        if (subscriptions.length === 0) {
            logger.debug('No subscriptions to restore in polling mode');
            return;
        }

        logger.info('Restoring subscriptions in polling mode', {
            subscriptionCount: subscriptions.length
        });

        // Convert WebSocket subscriptions to polling endpoints
        const pollingEndpoints = this.convertSubscriptionsToPollingEndpoints(subscriptions);

        // Add the converted endpoints to the polling service
        pollingEndpoints.forEach(endpoint => {
            this.pollingService.addEndpoint(endpoint);
        });

        logger.debug('Subscriptions restored as polling endpoints', {
            endpointCount: pollingEndpoints.length
        });
    }

    /**
     * Queue pending messages for HTTP transmission
     */
    private queuePendingMessagesForHttp(messages: Array<{ event: string; data: any; timestamp: Date }>): void {
        if (messages.length === 0) {
            logger.debug('No pending messages to queue for HTTP transmission');
            return;
        }

        logger.info('Queuing pending messages for HTTP transmission', {
            messageCount: messages.length
        });

        messages.forEach(message => {
            try {
                this.pollingService.queueMessage(message.event, message.data, MessagePriority.NORMAL);
            } catch (error) {
                logger.warn('Failed to queue message for HTTP transmission', {
                    event: message.event,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });
    }

    /**
     * Convert WebSocket subscriptions to appropriate polling endpoints
     */
    private convertSubscriptionsToPollingEndpoints(subscriptions: string[]): Array<{
        url: string;
        method: 'GET' | 'POST';
        params?: Record<string, any>;
        interval?: number;
    }> {
        const endpoints: Array<{
            url: string;
            method: 'GET' | 'POST';
            params?: Record<string, any>;
            interval?: number;
        }> = [];

        subscriptions.forEach(subscription => {
            // Convert subscription patterns to HTTP endpoints
            if (subscription.startsWith('booking:')) {
                const bookingId = subscription.replace('booking:', '');
                endpoints.push({
                    url: `/bookings/${bookingId}`,
                    method: 'GET',
                    interval: 10000 // Poll booking updates every 10 seconds
                });
            } else if (subscription.startsWith('swap:')) {
                const swapId = subscription.replace('swap:', '');
                endpoints.push({
                    url: `/swaps/${swapId}`,
                    method: 'GET',
                    interval: 5000 // Poll swap updates every 5 seconds
                });
            } else if (subscription.startsWith('proposal:')) {
                const proposalId = subscription.replace('proposal:', '');
                endpoints.push({
                    url: `/proposals/${proposalId}`,
                    method: 'GET',
                    interval: 5000 // Poll proposal updates every 5 seconds
                });
            } else if (subscription.startsWith('auction:')) {
                const auctionId = subscription.replace('auction:', '');
                endpoints.push({
                    url: `/auctions/${auctionId}`,
                    method: 'GET',
                    interval: 2000 // Poll auction updates every 2 seconds (more frequent)
                });
            } else if (subscription.startsWith('targeting:')) {
                const targetId = subscription.replace('targeting:', '');
                endpoints.push({
                    url: `/targeting/${targetId}`,
                    method: 'GET',
                    interval: 15000 // Poll targeting updates every 15 seconds
                });
            } else {
                // Generic subscription - try to convert to a reasonable endpoint
                logger.debug('Converting generic subscription to polling endpoint', {
                    subscription
                });
                endpoints.push({
                    url: `/realtime/${subscription}`,
                    method: 'GET',
                    interval: 30000 // Default polling interval
                });
            }
        });

        return endpoints;
    }

    /**
     * Categorize connection errors to determine appropriate fallback behavior
     */
    private categorizeConnectionError(error: Error): 'network' | 'authentication' | 'timeout' | 'server' | 'unknown' {
        const message = error.message.toLowerCase();

        if (message.includes('network') || message.includes('connection refused') ||
            message.includes('connection failed') || message.includes('net::')) {
            return 'network';
        }

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

        return 'unknown';
    }

    /**
     * Determine if immediate fallback activation is needed based on error type and context
     */
    private shouldActivateImmediateFallback(
        _error: Error,
        errorType: string,
        context?: {
            connectionAttempts?: number;
            lastSuccessfulConnection?: Date;
            errorType?: string;
        }
    ): boolean {
        // Immediate activation for certain error types
        if (errorType === 'server' && context?.connectionAttempts && context.connectionAttempts > 2) {
            return true;
        }

        // Immediate activation if we haven't had a successful connection in a while
        if (context?.lastSuccessfulConnection) {
            const timeSinceLastConnection = Date.now() - context.lastSuccessfulConnection.getTime();
            if (timeSinceLastConnection > 60000) { // 1 minute
                return true;
            }
        }

        // Immediate activation for persistent network issues
        if (errorType === 'network' && this.connectionFailures >= 3) {
            return true;
        }

        return false;
    }
}

// Export singleton instance
export const fallbackModeManager = new FallbackModeManager();