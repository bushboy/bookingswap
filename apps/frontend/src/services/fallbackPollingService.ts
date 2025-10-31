import { EventEmitter } from 'events';
import { apiClient } from './apiClient';
import { logger } from '@/utils/logger';
import { messageQueue, MessageQueue, MessagePriority } from './messageQueue';

export interface PollingEndpoint {
    url: string;
    method: 'GET' | 'POST';
    params?: Record<string, any>;
    data?: any;
    interval?: number; // Override default interval for this endpoint
}

export interface PollingConfig {
    defaultInterval: number;
    maxRetries: number;
    retryDelay: number;
    endpoints: PollingEndpoint[];
    enabled: boolean;
}

export interface PollingUpdate {
    endpoint: string;
    data: any;
    timestamp: Date;
    success: boolean;
    error?: Error;
}

/**
 * Fallback polling service for when WebSocket connections are unavailable
 * Provides alternative data fetching through HTTP polling
 */
export class FallbackPollingService extends EventEmitter {
    private config: PollingConfig;
    private pollingTimers: Map<string, NodeJS.Timeout> = new Map();
    private isPolling: boolean = false;
    private retryCounters: Map<string, number> = new Map();
    private lastSuccessfulPoll: Map<string, Date> = new Map();
    private messageQueue: MessageQueue;

    constructor(config: Partial<PollingConfig> = {}, messageQueueInstance: MessageQueue = messageQueue) {
        super();

        this.config = {
            defaultInterval: config.defaultInterval || parseInt(import.meta.env.VITE_FALLBACK_POLLING_INTERVAL) || 30000,
            maxRetries: config.maxRetries || 3,
            retryDelay: config.retryDelay || 5000,
            endpoints: config.endpoints || this.getDefaultEndpoints(),
            enabled: config.enabled ?? (import.meta.env.VITE_ENABLE_FALLBACK === 'true'),
        };

        this.messageQueue = messageQueueInstance;

        logger.debug('FallbackPollingService initialized', {
            defaultInterval: this.config.defaultInterval,
            endpointCount: this.config.endpoints.length,
            enabled: this.config.enabled
        });
    }

    /**
     * Start polling for all configured endpoints
     */
    public startPolling(endpoints?: PollingEndpoint[], interval?: number): void {
        if (!this.config.enabled) {
            logger.warn('Fallback polling is disabled');
            return;
        }

        if (this.isPolling) {
            logger.debug('Polling already active');
            return;
        }

        const endpointsToUse = endpoints || this.config.endpoints;
        const intervalToUse = interval || this.config.defaultInterval;

        logger.info('Starting fallback polling', {
            endpointCount: endpointsToUse.length,
            interval: intervalToUse
        });

        this.isPolling = true;
        this.emit('pollingStarted');

        // Start polling for each endpoint
        endpointsToUse.forEach(endpoint => {
            const endpointInterval = endpoint.interval || intervalToUse;
            this.startEndpointPolling(endpoint, endpointInterval);
        });
    }

    /**
     * Stop all polling activities
     */
    public stopPolling(): void {
        if (!this.isPolling) {
            return;
        }

        logger.info('Stopping fallback polling');

        // Clear all timers
        this.pollingTimers.forEach((timer, endpoint) => {
            clearInterval(timer);
            logger.debug('Stopped polling for endpoint', { endpoint });
        });

        this.pollingTimers.clear();
        this.retryCounters.clear();
        this.isPolling = false;

        this.emit('pollingStopped');
    }

    /**
     * Check if polling is currently active
     */
    public isPollingActive(): boolean {
        return this.isPolling;
    }

    /**
     * Poll for updates from all configured endpoints once
     */
    public async pollForUpdates(): Promise<PollingUpdate[]> {
        if (!this.config.enabled) {
            logger.warn('Fallback polling is disabled');
            return [];
        }

        logger.debug('Polling for updates from all endpoints');

        const updates: PollingUpdate[] = [];

        for (const endpoint of this.config.endpoints) {
            try {
                const update = await this.pollEndpoint(endpoint);
                updates.push(update);
            } catch (error) {
                logger.error('Failed to poll endpoint', {
                    endpoint: endpoint.url,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });

                updates.push({
                    endpoint: endpoint.url,
                    data: null,
                    timestamp: new Date(),
                    success: false,
                    error: error instanceof Error ? error : new Error('Unknown error')
                });
            }
        }

        this.emit('updatesPolled', updates);
        return updates;
    }

    /**
     * Add a new endpoint to poll
     */
    public addEndpoint(endpoint: PollingEndpoint): void {
        this.config.endpoints.push(endpoint);

        if (this.isPolling) {
            const interval = endpoint.interval || this.config.defaultInterval;
            this.startEndpointPolling(endpoint, interval);
        }

        logger.debug('Added polling endpoint', { url: endpoint.url });
    }

    /**
     * Remove an endpoint from polling
     */
    public removeEndpoint(url: string): void {
        // Stop polling for this endpoint
        const timer = this.pollingTimers.get(url);
        if (timer) {
            clearInterval(timer);
            this.pollingTimers.delete(url);
        }

        // Remove from configuration
        this.config.endpoints = this.config.endpoints.filter(endpoint => endpoint.url !== url);
        this.retryCounters.delete(url);
        this.lastSuccessfulPoll.delete(url);

        logger.debug('Removed polling endpoint', { url });
    }

    /**
     * Queue a message for later transmission when connection is restored
     */
    public queueMessage(event: string, data: any, priority: MessagePriority = MessagePriority.NORMAL): string {
        if (!this.config.enabled) {
            logger.warn('Cannot queue message - fallback polling is disabled');
            throw new Error('Fallback polling is disabled');
        }

        const messageId = this.messageQueue.queueMessage(event, data, {
            priority,
            maxRetries: 3,
            expiresIn: 24 * 60 * 60 * 1000 // 24 hours
        });

        logger.debug('Message queued for later transmission', {
            messageId,
            event,
            priority,
            queueSize: this.messageQueue.getStats().queueSize
        });

        return messageId;
    }

    /**
     * Flush queued messages by sending them via HTTP API
     */
    public async flushQueuedMessages(): Promise<void> {
        if (!this.config.enabled) {
            logger.warn('Cannot flush messages - fallback polling is disabled');
            return;
        }

        logger.info('Flushing queued messages via HTTP API');

        await this.messageQueue.flushQueue(async (event: string, data: any) => {
            // Convert WebSocket events to HTTP API calls
            await this.sendMessageViaHttp(event, data);
        });
    }

    /**
     * Get message queue statistics
     */
    public getMessageQueueStats() {
        return this.messageQueue.getStats();
    }

    /**
     * Clear all queued messages
     */
    public clearMessageQueue(): void {
        this.messageQueue.clearQueue();
        logger.info('Message queue cleared');
    }

    /**
     * Get all queued messages (for debugging/monitoring)
     */
    public getQueuedMessages() {
        return this.messageQueue.getQueuedMessages();
    }

    /**
     * Get polling statistics
     */
    public getPollingStats(): {
        isActive: boolean;
        endpointCount: number;
        lastSuccessfulPolls: Record<string, Date>;
        retryCounters: Record<string, number>;
        messageQueue: any;
    } {
        return {
            isActive: this.isPolling,
            endpointCount: this.config.endpoints.length,
            lastSuccessfulPolls: Object.fromEntries(this.lastSuccessfulPoll),
            retryCounters: Object.fromEntries(this.retryCounters),
            messageQueue: this.messageQueue.getStats()
        };
    }

    /**
     * Start polling for a specific endpoint
     */
    private startEndpointPolling(endpoint: PollingEndpoint, interval: number): void {
        const timer = setInterval(async () => {
            try {
                const update = await this.pollEndpoint(endpoint);
                this.handlePollingSuccess(endpoint.url, update);
            } catch (error) {
                this.handlePollingError(endpoint, error instanceof Error ? error : new Error('Unknown error'));
            }
        }, interval);

        this.pollingTimers.set(endpoint.url, timer);
        logger.debug('Started polling for endpoint', {
            url: endpoint.url,
            interval
        });

        // Perform initial poll immediately
        this.pollEndpoint(endpoint)
            .then(update => this.handlePollingSuccess(endpoint.url, update))
            .catch(error => this.handlePollingError(endpoint, error instanceof Error ? error : new Error('Unknown error')));
    }

    /**
     * Poll a specific endpoint
     */
    private async pollEndpoint(endpoint: PollingEndpoint): Promise<PollingUpdate> {
        logger.debug('Polling endpoint', { url: endpoint.url, method: endpoint.method });

        try {
            let response;

            switch (endpoint.method) {
                case 'GET':
                    response = await apiClient.get(endpoint.url, { params: endpoint.params });
                    break;
                case 'POST':
                    response = await apiClient.post(endpoint.url, endpoint.data, { params: endpoint.params });
                    break;
                default:
                    throw new Error(`Unsupported HTTP method: ${endpoint.method}`);
            }

            const update: PollingUpdate = {
                endpoint: endpoint.url,
                data: response.data,
                timestamp: new Date(),
                success: true
            };

            logger.debug('Endpoint poll successful', {
                url: endpoint.url,
                status: response.status
            });

            return update;
        } catch (error) {
            logger.error('Endpoint poll failed', {
                url: endpoint.url,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            throw error;
        }
    }

    /**
     * Handle successful polling response
     */
    private handlePollingSuccess(endpointUrl: string, update: PollingUpdate): void {
        this.lastSuccessfulPoll.set(endpointUrl, update.timestamp);
        this.retryCounters.delete(endpointUrl); // Reset retry counter on success

        // Emit specific events based on endpoint
        this.emitEndpointUpdate(endpointUrl, update.data);

        // Emit general update event
        this.emit('pollingUpdate', update);

        logger.debug('Polling success handled', { endpoint: endpointUrl });
    }

    /**
     * Handle polling errors with retry logic
     */
    private handlePollingError(endpoint: PollingEndpoint, error: Error): void {
        const currentRetries = this.retryCounters.get(endpoint.url) || 0;
        this.retryCounters.set(endpoint.url, currentRetries + 1);

        logger.warn('Polling error occurred', {
            endpoint: endpoint.url,
            error: error.message,
            retryCount: currentRetries + 1,
            maxRetries: this.config.maxRetries
        });

        if (currentRetries < this.config.maxRetries) {
            // Schedule retry
            setTimeout(() => {
                this.pollEndpoint(endpoint)
                    .then(update => this.handlePollingSuccess(endpoint.url, update))
                    .catch(retryError => this.handlePollingError(endpoint, retryError instanceof Error ? retryError : new Error('Unknown error')));
            }, this.config.retryDelay);
        } else {
            logger.error('Max retries exceeded for endpoint', {
                endpoint: endpoint.url,
                maxRetries: this.config.maxRetries
            });

            this.emit('pollingError', {
                endpoint: endpoint.url,
                error,
                retriesExceeded: true
            });
        }
    }

    /**
     * Emit specific events based on endpoint type
     */
    private emitEndpointUpdate(endpointUrl: string, data: any): void {
        // Map endpoints to specific event types
        if (endpointUrl.includes('/bookings')) {
            this.emit('bookingsUpdate', data);
        } else if (endpointUrl.includes('/swaps')) {
            this.emit('swapsUpdate', data);
        } else if (endpointUrl.includes('/proposals')) {
            this.emit('proposalsUpdate', data);
        } else if (endpointUrl.includes('/auctions')) {
            this.emit('auctionsUpdate', data);
        } else {
            this.emit('genericUpdate', { endpoint: endpointUrl, data });
        }
    }

    /**
     * Send a queued message via HTTP API instead of WebSocket
     */
    private async sendMessageViaHttp(event: string, data: any): Promise<void> {
        logger.debug('Converting WebSocket event to HTTP API call', { event, data });

        try {
            switch (event) {
                case 'subscribe':
                    // Handle subscription requests - these don't need HTTP equivalent
                    logger.debug('Skipping subscription event in HTTP mode');
                    break;

                case 'unsubscribe':
                    // Handle unsubscription requests - these don't need HTTP equivalent
                    logger.debug('Skipping unsubscription event in HTTP mode');
                    break;

                case 'monitor_bookings':
                    // Convert to HTTP request to update monitoring preferences
                    if (data.bookingIds && data.bookingIds.length > 0) {
                        await apiClient.post('/bookings/monitor', {
                            bookingIds: data.bookingIds,
                            action: 'add'
                        });
                    }
                    break;

                case 'unmonitor_bookings':
                    // Convert to HTTP request to remove monitoring preferences
                    if (data.bookingIds && data.bookingIds.length > 0) {
                        await apiClient.post('/bookings/monitor', {
                            bookingIds: data.bookingIds,
                            action: 'remove'
                        });
                    }
                    break;

                case 'proposal_action':
                    // Handle proposal accept/reject actions
                    if (data.proposalId && data.action) {
                        await apiClient.post(`/proposals/${data.proposalId}/${data.action}`, data);
                    }
                    break;

                case 'swap_action':
                    // Handle swap-related actions
                    if (data.swapId && data.action) {
                        await apiClient.post(`/swaps/${data.swapId}/${data.action}`, data);
                    }
                    break;

                case 'auction_bid':
                    // Handle auction bidding
                    if (data.auctionId && data.bidAmount) {
                        await apiClient.post(`/auctions/${data.auctionId}/bid`, {
                            amount: data.bidAmount,
                            ...data
                        });
                    }
                    break;

                case 'heartbeat_ack':
                case 'ping':
                case 'pong':
                    // Skip heartbeat messages in HTTP mode
                    logger.debug('Skipping heartbeat event in HTTP mode');
                    break;

                default:
                    logger.warn('Unknown WebSocket event type for HTTP conversion', { event });
                    // Try to send as generic POST request
                    await apiClient.post('/websocket-events', {
                        event,
                        data,
                        timestamp: new Date().toISOString()
                    });
                    break;
            }

            logger.debug('WebSocket event successfully converted to HTTP', { event });

        } catch (error) {
            logger.error('Failed to convert WebSocket event to HTTP', {
                event,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }

    /**
     * Get default polling endpoints based on common real-time data needs
     */
    private getDefaultEndpoints(): PollingEndpoint[] {
        return [
            {
                url: '/bookings/my-bookings',
                method: 'GET',
                params: { status: 'active' }
            },
            {
                url: '/swaps/my-swaps',
                method: 'GET',
                params: { status: 'active,pending' }
            },
            {
                url: '/proposals/received',
                method: 'GET',
                params: { status: 'pending' }
            },
            {
                url: '/proposals/sent',
                method: 'GET',
                params: { status: 'pending' }
            },
            {
                url: '/auctions/active',
                method: 'GET'
            }
        ];
    }
}

// Export singleton instance
export const fallbackPollingService = new FallbackPollingService();