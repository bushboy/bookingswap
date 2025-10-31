import { EventEmitter } from 'events';
import { realtimeService, RealtimeMessage } from './realtimeService';
import { SwapTarget, TargetingHistory, SwapTargetStatus } from '@booking-swap/shared';
import { store } from '../store';
import {
    addSwapTargetingMe,
    removeSwapTargetingMe,
    updateSwapTargetStatus,
    addTargetingHistoryEntry,
    setCurrentTarget,
    invalidateTargetingCache,
    updateLastUpdateTime,
} from '../store/slices/targetingSlice';
import { handleTargetingUpdate } from '../store/thunks/targetingThunks';

// Targeting-specific WebSocket message types
export interface TargetingWebSocketMessage extends RealtimeMessage {
    type:
    | 'targeting_created'
    | 'targeting_updated'
    | 'targeting_removed'
    | 'target_status_changed'
    | 'targeting_history_updated'
    | 'auction_targeting_update'
    | 'proposal_targeting_update';
    data: {
        target?: SwapTarget;
        targetId?: string;
        sourceSwapId?: string;
        targetSwapId?: string;
        status?: SwapTargetStatus;
        historyEntry?: TargetingHistory;
        userId?: string;
        auctionInfo?: any;
        proposalInfo?: any;
    };
}

/**
 * WebSocket service specifically for targeting-related real-time updates
 * Integrates with the main realtime service and manages targeting subscriptions
 */
export class TargetingWebSocketService extends EventEmitter {
    private isInitialized: boolean = false;
    private subscribedSwaps: Set<string> = new Set();
    private subscribedUsers: Set<string> = new Set();
    private currentUserId: string | null = null;

    constructor() {
        super();
        this.initialize();
    }

    /**
     * Initialize the targeting WebSocket service
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Listen to realtime service events
        realtimeService.on('connected', this.handleConnection.bind(this));
        realtimeService.on('disconnected', this.handleDisconnection.bind(this));
        realtimeService.on('error', this.handleError.bind(this));

        // Listen to targeting-specific message types
        realtimeService.on('targeting_created', this.handleTargetingCreated.bind(this));
        realtimeService.on('targeting_updated', this.handleTargetingUpdated.bind(this));
        realtimeService.on('targeting_removed', this.handleTargetingRemoved.bind(this));
        realtimeService.on('target_status_changed', this.handleTargetStatusChanged.bind(this));
        realtimeService.on('targeting_history_updated', this.handleTargetingHistoryUpdated.bind(this));
        realtimeService.on('auction_targeting_update', this.handleAuctionTargetingUpdate.bind(this));
        realtimeService.on('proposal_targeting_update', this.handleProposalTargetingUpdate.bind(this));

        this.isInitialized = true;
    }

    /**
     * Connect to targeting WebSocket updates
     */
    public async connect(): Promise<void> {
        try {
            await realtimeService.connect();
            this.emit('connected');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Disconnect from targeting WebSocket updates
     */
    public disconnect(): void {
        this.unsubscribeFromAll();
        realtimeService.disconnect();
        this.emit('disconnected');
    }

    /**
     * Subscribe to targeting updates for specific swaps
     */
    public subscribeToSwapTargeting(swapIds: string[]): void {
        const newSwapIds = swapIds.filter(id => !this.subscribedSwaps.has(id));

        if (newSwapIds.length > 0) {
            newSwapIds.forEach(id => this.subscribedSwaps.add(id));

            const channels = newSwapIds.map(id => `swap_targeting:${id}`);
            realtimeService.subscribe(channels);

            this.emit('subscribed_swaps', newSwapIds);
        }
    }

    /**
     * Unsubscribe from targeting updates for specific swaps
     */
    public unsubscribeFromSwapTargeting(swapIds: string[]): void {
        const subscribedSwapIds = swapIds.filter(id => this.subscribedSwaps.has(id));

        if (subscribedSwapIds.length > 0) {
            subscribedSwapIds.forEach(id => this.subscribedSwaps.delete(id));

            const channels = subscribedSwapIds.map(id => `swap_targeting:${id}`);
            realtimeService.unsubscribe(channels);

            this.emit('unsubscribed_swaps', subscribedSwapIds);
        }
    }

    /**
     * Subscribe to targeting updates for specific users
     */
    public subscribeToUserTargeting(userIds: string[]): void {
        const newUserIds = userIds.filter(id => !this.subscribedUsers.has(id));

        if (newUserIds.length > 0) {
            newUserIds.forEach(id => this.subscribedUsers.add(id));

            const channels = newUserIds.map(id => `user_targeting:${id}`);
            realtimeService.subscribe(channels);

            this.emit('subscribed_users', newUserIds);
        }
    }

    /**
     * Unsubscribe from targeting updates for specific users
     */
    public unsubscribeFromUserTargeting(userIds: string[]): void {
        const subscribedUserIds = userIds.filter(id => this.subscribedUsers.has(id));

        if (subscribedUserIds.length > 0) {
            subscribedUserIds.forEach(id => this.subscribedUsers.delete(id));

            const channels = subscribedUserIds.map(id => `user_targeting:${id}`);
            realtimeService.unsubscribe(channels);

            this.emit('unsubscribed_users', subscribedUserIds);
        }
    }

    /**
     * Subscribe to current user's targeting updates
     */
    public subscribeToCurrentUserTargeting(userId: string): void {
        this.currentUserId = userId;
        this.subscribeToUserTargeting([userId]);

        // Also subscribe to general targeting events for this user
        realtimeService.subscribe([
            `targeting_activity:${userId}`,
            `targeting_notifications:${userId}`,
        ]);
    }

    /**
     * Unsubscribe from all targeting updates
     */
    public unsubscribeFromAll(): void {
        if (this.subscribedSwaps.size > 0) {
            this.unsubscribeFromSwapTargeting(Array.from(this.subscribedSwaps));
        }

        if (this.subscribedUsers.size > 0) {
            this.unsubscribeFromUserTargeting(Array.from(this.subscribedUsers));
        }

        if (this.currentUserId) {
            realtimeService.unsubscribe([
                `targeting_activity:${this.currentUserId}`,
                `targeting_notifications:${this.currentUserId}`,
            ]);
            this.currentUserId = null;
        }
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
    } {
        return {
            swaps: Array.from(this.subscribedSwaps),
            users: Array.from(this.subscribedUsers),
            currentUser: this.currentUserId,
            isConnected: this.isConnected(),
        };
    }

    // Event handlers
    private handleConnection(): void {
        console.log('Targeting WebSocket connected');
        this.emit('connected');

        // Resubscribe to all channels after reconnection
        this.resubscribeAll();
    }

    private handleDisconnection(event: CloseEvent): void {
        console.log('Targeting WebSocket disconnected:', event.code, event.reason);
        this.emit('disconnected', event);
    }

    private handleError(error: Event): void {
        console.error('Targeting WebSocket error:', error);
        this.emit('error', error);
    }

    private handleTargetingCreated(data: TargetingWebSocketMessage['data']): void {
        console.log('Targeting created:', data);

        if (data.target) {
            // Update Redux store
            store.dispatch(addSwapTargetingMe(data.target));

            // Handle real-time update
            store.dispatch(handleTargetingUpdate({
                type: 'target_created',
                data: data.target,
            }));

            this.emit('targeting_created', data.target);
        }
    }

    private handleTargetingUpdated(data: TargetingWebSocketMessage['data']): void {
        console.log('Targeting updated:', data);

        if (data.target) {
            // Update Redux store
            store.dispatch(addSwapTargetingMe(data.target));

            // Handle real-time update
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
        }
    }

    private handleTargetingRemoved(data: TargetingWebSocketMessage['data']): void {
        console.log('Targeting removed:', data);

        if (data.targetId) {
            // Update Redux store
            store.dispatch(removeSwapTargetingMe(data.targetId));

            // Handle real-time update
            store.dispatch(handleTargetingUpdate({
                type: 'target_removed',
                data: { targetId: data.targetId },
            }));

            // Clear current target if it matches
            const state = store.getState();
            if (state.targeting.currentTarget?.id === data.targetId) {
                store.dispatch(setCurrentTarget(null));
            }

            this.emit('targeting_removed', data.targetId);
        }
    }

    private handleTargetStatusChanged(data: TargetingWebSocketMessage['data']): void {
        console.log('Target status changed:', data);

        if (data.targetId && data.status) {
            // Update Redux store
            store.dispatch(updateSwapTargetStatus({
                targetId: data.targetId,
                status: data.status,
            }));

            this.emit('target_status_changed', {
                targetId: data.targetId,
                status: data.status,
            });
        }
    }

    private handleTargetingHistoryUpdated(data: TargetingWebSocketMessage['data']): void {
        console.log('Targeting history updated:', data);

        if (data.historyEntry) {
            // Update Redux store
            store.dispatch(addTargetingHistoryEntry(data.historyEntry));

            this.emit('targeting_history_updated', data.historyEntry);
        }
    }

    private handleAuctionTargetingUpdate(data: TargetingWebSocketMessage['data']): void {
        console.log('Auction targeting update:', data);

        // Invalidate auction-related cache
        if (data.targetSwapId) {
            store.dispatch(invalidateTargetingCache(data.targetSwapId));
        }

        this.emit('auction_targeting_update', data.auctionInfo);
    }

    private handleProposalTargetingUpdate(data: TargetingWebSocketMessage['data']): void {
        console.log('Proposal targeting update:', data);

        // Invalidate proposal-related cache
        if (data.sourceSwapId) {
            store.dispatch(invalidateTargetingCache(data.sourceSwapId));
        }
        if (data.targetSwapId) {
            store.dispatch(invalidateTargetingCache(data.targetSwapId));
        }

        this.emit('proposal_targeting_update', data.proposalInfo);
    }

    private resubscribeAll(): void {
        // Resubscribe to swap targeting
        if (this.subscribedSwaps.size > 0) {
            const channels = Array.from(this.subscribedSwaps).map(id => `swap_targeting:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to user targeting
        if (this.subscribedUsers.size > 0) {
            const channels = Array.from(this.subscribedUsers).map(id => `user_targeting:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to current user targeting
        if (this.currentUserId) {
            realtimeService.subscribe([
                `targeting_activity:${this.currentUserId}`,
                `targeting_notifications:${this.currentUserId}`,
            ]);
        }
    }

    /**
     * Update last update time in Redux store
     */
    private updateLastUpdateTime(): void {
        store.dispatch(updateLastUpdateTime());
    }
}

// Export singleton instance
export const targetingWebSocketService = new TargetingWebSocketService();
export default targetingWebSocketService;