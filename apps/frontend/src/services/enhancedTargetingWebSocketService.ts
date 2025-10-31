import { EventEmitter } from 'events';
import { realtimeService, RealtimeMessage } from './realtimeService';
import { SwapTarget, TargetingHistory, SwapTargetStatus } from '@booking-swap/shared';
import { store } from '../store';
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
    updateLastUpdateTime,
} from '../store/slices/targetingSlice';
import { handleTargetingUpdate } from '../store/thunks/targetingThunks';

// Enhanced targeting WebSocket message types
export interface EnhancedTargetingWebSocketMessage extends RealtimeMessage {
    type:
    | 'targeting_created'
    | 'targeting_updated'
    | 'targeting_removed'
    | 'target_status_changed'
    | 'targeting_history_updated'
    | 'auction_targeting_update'
    | 'proposal_targeting_update'
    | 'targeting_batch_update'
    | 'targeting_sync_request'
    | 'targeting_heartbeat';
    data: {
        target?: SwapTarget;
        targets?: SwapTarget[];
        targetId?: string;
        sourceSwapId?: string;
        targetSwapId?: string;
        status?: SwapTargetStatus;
        historyEntry?: TargetingHistory;
        userId?: string;
        auctionInfo?: {
            endDate: Date;
            currentProposalCount: number;
            timeRemaining: string;
            isEnding: boolean;
        };
        proposalInfo?: any;
        batchUpdates?: Array<{
            type: string;
            targetId: string;
            data: any;
        }>;
        syncData?: {
            swapId: string;
            lastSyncTime: Date;
            fullSync: boolean;
        };
        heartbeat?: {
            timestamp: Date;
            activeConnections: number;
        };
    };
    metadata?: {
        timestamp: Date;
        sequenceId?: number;
        retryCount?: number;
        priority?: 'low' | 'normal' | 'high' | 'critical';
    };
}

interface ConnectionMetrics {
    connectTime: Date | null;
    lastMessageTime: Date | null;
    messageCount: number;
    errorCount: number;
    reconnectCount: number;
    averageLatency: number;
    latencyHistory: number[];
}

interface SubscriptionState {
    swaps: Set<string>;
    users: Set<string>;
    channels: Set<string>;
    lastActivity: Map<string, Date>;
}

interface QueuedMessage {
    id: string;
    message: EnhancedTargetingWebSocketMessage;
    timestamp: Date;
    retryCount: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Enhanced WebSocket service for targeting-related real-time updates
 * Provides improved error handling, retry logic, and optimistic updates
 */
export class EnhancedTargetingWebSocketService extends EventEmitter {
    private isInitialized: boolean = false;
    private subscriptions: SubscriptionState = {
        swaps: new Set(),
        users: new Set(),
        channels: new Set(),
        lastActivity: new Map(),
    };
    private currentUserId: string | null = null;
    private metrics: ConnectionMetrics = {
        connectTime: null,
        lastMessageTime: null,
        messageCount: 0,
        errorCount: 0,
        reconnectCount: 0,
        averageLatency: 0,
        latencyHistory: [],
    };
    private messageQueue: Map<string, QueuedMessage> = new Map();
    private processingQueue: boolean = false;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private syncInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    // Configuration
    private readonly config = {
        heartbeatInterval: 30000, // 30 seconds
        syncInterval: 300000, // 5 minutes
        maxRetries: 3,
        retryDelay: 2000,
        maxQueueSize: 100,
        latencyHistorySize: 50,
        reconnectDelay: 5000,
        maxReconnectDelay: 30000,
    };

    constructor() {
        super();
        this.initialize();
    }

    /**
     * Initialize the enhanced targeting WebSocket service
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Listen to realtime service events
        realtimeService.on('connected', this.handleConnection.bind(this));
        realtimeService.on('disconnected', this.handleDisconnection.bind(this));
        realtimeService.on('error', this.handleError.bind(this));

        // Listen to enhanced targeting message types
        realtimeService.on('targeting_created', this.handleTargetingCreated.bind(this));
        realtimeService.on('targeting_updated', this.handleTargetingUpdated.bind(this));
        realtimeService.on('targeting_removed', this.handleTargetingRemoved.bind(this));
        realtimeService.on('target_status_changed', this.handleTargetStatusChanged.bind(this));
        realtimeService.on('targeting_history_updated', this.handleTargetingHistoryUpdated.bind(this));
        realtimeService.on('auction_targeting_update', this.handleAuctionTargetingUpdate.bind(this));
        realtimeService.on('proposal_targeting_update', this.handleProposalTargetingUpdate.bind(this));
        realtimeService.on('targeting_batch_update', this.handleBatchUpdate.bind(this));
        realtimeService.on('targeting_sync_request', this.handleSyncRequest.bind(this));
        realtimeService.on('targeting_heartbeat', this.handleHeartbeat.bind(this));

        this.isInitialized = true;
    }

    /**
     * Connect to targeting WebSocket updates with enhanced error handling
     */
    public async connect(): Promise<void> {
        try {
            await realtimeService.connect();
            this.startHeartbeat();
            this.startPeriodicSync();
            this.emit('connected');
        } catch (error) {
            this.metrics.errorCount++;
            this.emit('error', error);
            this.scheduleReconnect();
            throw error;
        }
    }

    /**
     * Disconnect from targeting WebSocket updates
     */
    public disconnect(): void {
        this.stopHeartbeat();
        this.stopPeriodicSync();
        this.clearReconnectTimeout();
        this.unsubscribeFromAll();
        realtimeService.disconnect();
        this.emit('disconnected');
    }

    /**
     * Subscribe to targeting updates for specific swaps with enhanced tracking
     */
    public subscribeToSwapTargeting(swapIds: string[]): void {
        const newSwapIds = swapIds.filter(id => !this.subscriptions.swaps.has(id));

        if (newSwapIds.length > 0) {
            newSwapIds.forEach(id => {
                this.subscriptions.swaps.add(id);
                this.subscriptions.lastActivity.set(`swap:${id}`, new Date());
            });

            const channels = newSwapIds.map(id => `swap_targeting:${id}`);
            this.subscriptions.channels = new Set([...this.subscriptions.channels, ...channels]);

            realtimeService.subscribe(channels);
            this.emit('subscribed_swaps', newSwapIds);

            // Request initial sync for new subscriptions
            this.requestSync(newSwapIds);
        }
    }

    /**
     * Unsubscribe from targeting updates for specific swaps
     */
    public unsubscribeFromSwapTargeting(swapIds: string[]): void {
        const subscribedSwapIds = swapIds.filter(id => this.subscriptions.swaps.has(id));

        if (subscribedSwapIds.length > 0) {
            subscribedSwapIds.forEach(id => {
                this.subscriptions.swaps.delete(id);
                this.subscriptions.lastActivity.delete(`swap:${id}`);
            });

            const channels = subscribedSwapIds.map(id => `swap_targeting:${id}`);
            channels.forEach(channel => this.subscriptions.channels.delete(channel));

            realtimeService.unsubscribe(channels);
            this.emit('unsubscribed_swaps', subscribedSwapIds);
        }
    }

    /**
     * Subscribe to targeting updates for specific users
     */
    public subscribeToUserTargeting(userIds: string[]): void {
        const newUserIds = userIds.filter(id => !this.subscriptions.users.has(id));

        if (newUserIds.length > 0) {
            newUserIds.forEach(id => {
                this.subscriptions.users.add(id);
                this.subscriptions.lastActivity.set(`user:${id}`, new Date());
            });

            const channels = newUserIds.map(id => `user_targeting:${id}`);
            this.subscriptions.channels = new Set([...this.subscriptions.channels, ...channels]);

            realtimeService.subscribe(channels);
            this.emit('subscribed_users', newUserIds);
        }
    }

    /**
     * Subscribe to current user's targeting updates with enhanced features
     */
    public subscribeToCurrentUserTargeting(userId: string): void {
        this.currentUserId = userId;
        this.subscribeToUserTargeting([userId]);

        // Subscribe to additional user-specific channels
        const additionalChannels = [
            `targeting_activity:${userId}`,
            `targeting_notifications:${userId}`,
            `targeting_priority:${userId}`,
        ];

        this.subscriptions.channels = new Set([...this.subscriptions.channels, ...additionalChannels]);
        realtimeService.subscribe(additionalChannels);
    }

    /**
     * Request sync for specific swaps
     */
    private requestSync(swapIds: string[]): void {
        if (!realtimeService.isConnected()) return;

        swapIds.forEach(swapId => {
            const syncMessage = {
                type: 'targeting_sync_request',
                data: {
                    syncData: {
                        swapId,
                        lastSyncTime: new Date(),
                        fullSync: true,
                    },
                },
                metadata: {
                    timestamp: new Date(),
                    priority: 'normal' as const,
                },
            };

            this.sendMessage(syncMessage);
        });
    }

    /**
     * Send message with queuing and retry logic
     */
    private sendMessage(message: EnhancedTargetingWebSocketMessage): void {
        const messageId = `${message.type}-${Date.now()}-${Math.random()}`;
        const queuedMessage: QueuedMessage = {
            id: messageId,
            message,
            timestamp: new Date(),
            retryCount: 0,
            priority: message.metadata?.priority || 'normal',
        };

        this.messageQueue.set(messageId, queuedMessage);
        this.processMessageQueue();
    }

    /**
     * Process message queue with priority and retry logic
     */
    private async processMessageQueue(): Promise<void> {
        if (this.processingQueue || this.messageQueue.size === 0) {
            return;
        }

        this.processingQueue = true;

        try {
            // Sort messages by priority and timestamp
            const messages = Array.from(this.messageQueue.values()).sort((a, b) => {
                const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return a.timestamp.getTime() - b.timestamp.getTime();
            });

            for (const queuedMessage of messages) {
                if (!realtimeService.isConnected()) {
                    break;
                }

                try {
                    // Send message (this would be implemented in the realtime service)
                    // For now, we'll simulate sending
                    console.log('Sending targeting message:', queuedMessage.message.type);

                    // Remove from queue on success
                    this.messageQueue.delete(queuedMessage.id);

                } catch (error) {
                    console.error('Failed to send message:', error);

                    // Retry logic
                    if (queuedMessage.retryCount < this.config.maxRetries) {
                        queuedMessage.retryCount++;
                        queuedMessage.timestamp = new Date(Date.now() + this.config.retryDelay * queuedMessage.retryCount);
                    } else {
                        // Remove failed message after max retries
                        this.messageQueue.delete(queuedMessage.id);
                        this.emit('message_failed', queuedMessage);
                    }
                }
            }
        } finally {
            this.processingQueue = false;
        }

        // Clean up old messages
        this.cleanupMessageQueue();
    }

    /**
     * Clean up old messages from queue
     */
    private cleanupMessageQueue(): void {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes

        for (const [messageId, queuedMessage] of this.messageQueue.entries()) {
            if (now - queuedMessage.timestamp.getTime() > maxAge) {
                this.messageQueue.delete(messageId);
            }
        }

        // Limit queue size
        if (this.messageQueue.size > this.config.maxQueueSize) {
            const messages = Array.from(this.messageQueue.entries())
                .sort(([, a], [, b]) => a.timestamp.getTime() - b.timestamp.getTime())
                .slice(0, this.config.maxQueueSize);

            this.messageQueue.clear();
            messages.forEach(([id, message]) => this.messageQueue.set(id, message));
        }
    }

    /**
     * Start heartbeat to monitor connection health
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatInterval = setInterval(() => {
            if (realtimeService.isConnected()) {
                const heartbeatMessage: EnhancedTargetingWebSocketMessage = {
                    type: 'targeting_heartbeat',
                    data: {
                        heartbeat: {
                            timestamp: new Date(),
                            activeConnections: this.subscriptions.swaps.size + this.subscriptions.users.size,
                        },
                    },
                    metadata: {
                        timestamp: new Date(),
                        priority: 'low',
                    },
                };

                this.sendMessage(heartbeatMessage);
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Start periodic sync to ensure data consistency
     */
    private startPeriodicSync(): void {
        this.stopPeriodicSync();

        this.syncInterval = setInterval(() => {
            if (realtimeService.isConnected() && this.subscriptions.swaps.size > 0) {
                this.requestSync(Array.from(this.subscriptions.swaps));
            }
        }, this.config.syncInterval);
    }

    /**
     * Stop periodic sync
     */
    private stopPeriodicSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnect(): void {
        this.clearReconnectTimeout();

        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(2, this.metrics.reconnectCount),
            this.config.maxReconnectDelay
        );

        this.reconnectTimeout = setTimeout(() => {
            this.metrics.reconnectCount++;
            this.connect().catch(error => {
                console.error('Reconnection failed:', error);
            });
        }, delay);
    }

    /**
     * Clear reconnect timeout
     */
    private clearReconnectTimeout(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * Calculate message latency
     */
    private calculateLatency(messageTimestamp: Date): number {
        const latency = Date.now() - messageTimestamp.getTime();

        this.metrics.latencyHistory.push(latency);
        if (this.metrics.latencyHistory.length > this.config.latencyHistorySize) {
            this.metrics.latencyHistory.shift();
        }

        this.metrics.averageLatency = this.metrics.latencyHistory.reduce((sum, l) => sum + l, 0) / this.metrics.latencyHistory.length;

        return latency;
    }

    // Event handlers
    private handleConnection(): void {
        console.log('Enhanced targeting WebSocket connected');
        this.metrics.connectTime = new Date();
        this.metrics.reconnectCount = 0;
        this.clearReconnectTimeout();

        store.dispatch(setConnectionStatus({ isConnected: true }));
        this.emit('connected');
        this.resubscribeAll();
    }

    private handleDisconnection(event: CloseEvent): void {
        console.log('Enhanced targeting WebSocket disconnected:', event.code, event.reason);
        this.metrics.connectTime = null;

        store.dispatch(setConnectionStatus({ isConnected: false }));
        this.emit('disconnected', event);

        if (!event.wasClean) {
            this.scheduleReconnect();
        }
    }

    private handleError(error: Event): void {
        console.error('Enhanced targeting WebSocket error:', error);
        this.metrics.errorCount++;

        store.dispatch(setConnectionStatus({
            isConnected: false,
            error: 'Connection error'
        }));
        this.emit('error', error);
    }

    // Enhanced message handlers with better error handling and validation
    private handleTargetingCreated(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.target) {
                console.warn('Targeting created event missing target data');
                return;
            }

            this.updateMetrics(data);

            store.dispatch(addIncomingTarget({
                swapId: data.target.targetSwapId,
                targetInfo: {
                    targetId: data.target.id,
                    sourceSwapId: data.target.sourceSwapId,
                    sourceSwap: {
                        id: data.target.sourceSwapId,
                        title: 'Swap', // This would come from the full data
                        ownerName: 'User', // This would come from the full data
                    },
                    status: data.target.status,
                    createdAt: new Date(data.target.createdAt),
                },
            }));

            store.dispatch(handleTargetingUpdate({
                type: 'target_created',
                data: data.target,
            }));

            this.emit('targeting_created', data.target);
        } catch (error) {
            console.error('Error handling targeting created:', error);
            this.metrics.errorCount++;
        }
    }

    private handleTargetingUpdated(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.target) {
                console.warn('Targeting updated event missing target data');
                return;
            }

            this.updateMetrics(data);

            store.dispatch(updateIncomingTarget({
                swapId: data.target.targetSwapId,
                targetId: data.target.id,
                updates: {
                    status: data.target.status,
                    updatedAt: new Date(),
                },
            }));

            store.dispatch(handleTargetingUpdate({
                type: 'target_updated',
                data: data.target,
            }));

            // Invalidate cache for affected swaps
            if (data.sourceSwapId) {
                store.dispatch(invalidateTargetingCache(data.sourceSwapId));
            }
            if (data.targetSwapId) {
                store.dispatch(invalidateTargetingCache(data.targetSwapId));
            }

            this.emit('targeting_updated', data.target);
        } catch (error) {
            console.error('Error handling targeting updated:', error);
            this.metrics.errorCount++;
        }
    }

    private handleTargetingRemoved(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.targetId) {
                console.warn('Targeting removed event missing target ID');
                return;
            }

            this.updateMetrics(data);

            if (data.targetSwapId) {
                store.dispatch(removeIncomingTarget({
                    swapId: data.targetSwapId,
                    targetId: data.targetId,
                }));
            }

            if (data.sourceSwapId) {
                store.dispatch(removeOutgoingTarget({
                    swapId: data.sourceSwapId,
                    targetId: data.targetId,
                }));
            }

            store.dispatch(handleTargetingUpdate({
                type: 'target_removed',
                data: { targetId: data.targetId },
            }));

            this.emit('targeting_removed', data.targetId);
        } catch (error) {
            console.error('Error handling targeting removed:', error);
            this.metrics.errorCount++;
        }
    }

    private handleTargetStatusChanged(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.targetId || !data.status) {
                console.warn('Target status changed event missing required data');
                return;
            }

            this.updateMetrics(data);

            store.dispatch(updateTargetingStatus({
                targetId: data.targetId,
                status: data.status,
                lastUpdated: new Date(),
            }));

            this.emit('target_status_changed', {
                targetId: data.targetId,
                status: data.status,
            });
        } catch (error) {
            console.error('Error handling target status changed:', error);
            this.metrics.errorCount++;
        }
    }

    private handleTargetingHistoryUpdated(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.historyEntry) {
                console.warn('Targeting history updated event missing history entry');
                return;
            }

            this.updateMetrics(data);
            this.emit('targeting_history_updated', data.historyEntry);
        } catch (error) {
            console.error('Error handling targeting history updated:', error);
            this.metrics.errorCount++;
        }
    }

    private handleAuctionTargetingUpdate(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.auctionInfo || !data.targetSwapId) {
                console.warn('Auction targeting update missing required data');
                return;
            }

            this.updateMetrics(data);

            store.dispatch(updateAuctionCountdown({
                swapId: data.targetSwapId,
                auctionInfo: data.auctionInfo,
            }));

            this.emit('auction_targeting_update', data.auctionInfo);
        } catch (error) {
            console.error('Error handling auction targeting update:', error);
            this.metrics.errorCount++;
        }
    }

    private handleProposalTargetingUpdate(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            this.updateMetrics(data);

            // Invalidate cache for affected swaps
            if (data.sourceSwapId) {
                store.dispatch(invalidateTargetingCache(data.sourceSwapId));
            }
            if (data.targetSwapId) {
                store.dispatch(invalidateTargetingCache(data.targetSwapId));
            }

            this.emit('proposal_targeting_update', data.proposalInfo);
        } catch (error) {
            console.error('Error handling proposal targeting update:', error);
            this.metrics.errorCount++;
        }
    }

    private handleBatchUpdate(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.batchUpdates) {
                console.warn('Batch update missing batch data');
                return;
            }

            this.updateMetrics(data);

            // Process batch updates
            data.batchUpdates.forEach(update => {
                switch (update.type) {
                    case 'targeting_created':
                        this.handleTargetingCreated({ target: update.data });
                        break;
                    case 'targeting_updated':
                        this.handleTargetingUpdated({ target: update.data });
                        break;
                    case 'targeting_removed':
                        this.handleTargetingRemoved({ targetId: update.targetId });
                        break;
                }
            });

            this.emit('batch_update', data.batchUpdates);
        } catch (error) {
            console.error('Error handling batch update:', error);
            this.metrics.errorCount++;
        }
    }

    private handleSyncRequest(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (!data.syncData) {
                console.warn('Sync request missing sync data');
                return;
            }

            this.updateMetrics(data);
            this.emit('sync_request', data.syncData);
        } catch (error) {
            console.error('Error handling sync request:', error);
            this.metrics.errorCount++;
        }
    }

    private handleHeartbeat(data: EnhancedTargetingWebSocketMessage['data']): void {
        try {
            if (data.heartbeat) {
                this.updateMetrics(data);
                this.emit('heartbeat', data.heartbeat);
            }
        } catch (error) {
            console.error('Error handling heartbeat:', error);
            this.metrics.errorCount++;
        }
    }

    private updateMetrics(data: EnhancedTargetingWebSocketMessage['data']): void {
        this.metrics.messageCount++;
        this.metrics.lastMessageTime = new Date();

        // Calculate latency if timestamp is available
        if (data.heartbeat?.timestamp) {
            this.calculateLatency(new Date(data.heartbeat.timestamp));
        }
    }

    private resubscribeAll(): void {
        // Resubscribe to swap targeting
        if (this.subscriptions.swaps.size > 0) {
            const channels = Array.from(this.subscriptions.swaps).map(id => `swap_targeting:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to user targeting
        if (this.subscriptions.users.size > 0) {
            const channels = Array.from(this.subscriptions.users).map(id => `user_targeting:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to current user targeting
        if (this.currentUserId) {
            realtimeService.subscribe([
                `targeting_activity:${this.currentUserId}`,
                `targeting_notifications:${this.currentUserId}`,
                `targeting_priority:${this.currentUserId}`,
            ]);
        }
    }

    private unsubscribeFromAll(): void {
        if (this.subscriptions.swaps.size > 0) {
            this.unsubscribeFromSwapTargeting(Array.from(this.subscriptions.swaps));
        }

        if (this.subscriptions.users.size > 0) {
            const channels = Array.from(this.subscriptions.users).map(id => `user_targeting:${id}`);
            realtimeService.unsubscribe(channels);
            this.subscriptions.users.clear();
        }

        if (this.currentUserId) {
            realtimeService.unsubscribe([
                `targeting_activity:${this.currentUserId}`,
                `targeting_notifications:${this.currentUserId}`,
                `targeting_priority:${this.currentUserId}`,
            ]);
            this.currentUserId = null;
        }

        this.subscriptions.channels.clear();
        this.subscriptions.lastActivity.clear();
    }

    /**
     * Get connection and performance metrics
     */
    public getMetrics(): ConnectionMetrics & {
        subscriptions: {
            swaps: number;
            users: number;
            channels: number;
        };
        queueStatus: {
            pending: number;
            processing: boolean;
        };
    } {
        return {
            ...this.metrics,
            subscriptions: {
                swaps: this.subscriptions.swaps.size,
                users: this.subscriptions.users.size,
                channels: this.subscriptions.channels.size,
            },
            queueStatus: {
                pending: this.messageQueue.size,
                processing: this.processingQueue,
            },
        };
    }

    /**
     * Check if connected to WebSocket
     */
    public isConnected(): boolean {
        return realtimeService.isConnected();
    }

    /**
     * Get current subscription status
     */
    public getSubscriptionStatus(): {
        swaps: string[];
        users: string[];
        currentUser: string | null;
        isConnected: boolean;
        lastActivity: Record<string, Date>;
    } {
        return {
            swaps: Array.from(this.subscriptions.swaps),
            users: Array.from(this.subscriptions.users),
            currentUser: this.currentUserId,
            isConnected: this.isConnected(),
            lastActivity: Object.fromEntries(this.subscriptions.lastActivity),
        };
    }
}

// Export singleton instance
export const enhancedTargetingWebSocketService = new EnhancedTargetingWebSocketService();
export default enhancedTargetingWebSocketService;