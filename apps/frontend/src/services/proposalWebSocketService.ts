import { EventEmitter } from 'events';
import { realtimeService, RealtimeMessage } from './realtimeService';
import { logger } from '@/utils/logger';
import {
    connectionThrottlingManager,
    connectionStateChecker,
    ConnectionThrottleConfig
} from '@/utils/connectionThrottling';
import { getServiceConfig, isThrottlingFeatureEnabled } from '@/config/connectionThrottling';

/**
 * Proposal-specific WebSocket message types
 */
export interface ProposalWebSocketMessage extends RealtimeMessage {
    type:
    | 'proposal_accepted'
    | 'proposal_rejected'
    | 'proposal_status_changed'
    | 'proposal_payment_updated'
    | 'proposal_blockchain_recorded';
    data: {
        proposalId: string;
        status?: 'pending' | 'accepted' | 'rejected' | 'expired';
        respondedBy?: string;
        respondedAt?: string;
        rejectionReason?: string;
        paymentStatus?: 'processing' | 'completed' | 'failed';
        paymentTransaction?: {
            id: string;
            amount: number;
            currency: string;
            status: 'processing' | 'completed' | 'failed';
        };
        blockchainTransaction?: {
            transactionId: string;
            consensusTimestamp?: string;
        };
        userId?: string;
        targetUserId?: string;
    };
}

/**
 * Proposal status update event data
 */
export interface ProposalStatusUpdate {
    proposalId: string;
    status: 'accepted' | 'rejected' | 'expired';
    respondedBy?: string;
    respondedAt: string;
    rejectionReason?: string;
    paymentStatus?: 'processing' | 'completed' | 'failed';
}

/**
 * Payment update event data
 */
export interface ProposalPaymentUpdate {
    proposalId: string;
    paymentTransaction: {
        id: string;
        amount: number;
        currency: string;
        status: 'processing' | 'completed' | 'failed';
    };
}

/**
 * Blockchain recording event data
 */
export interface ProposalBlockchainUpdate {
    proposalId: string;
    blockchainTransaction: {
        transactionId: string;
        consensusTimestamp?: string;
    };
}

/**
 * WebSocket service for real-time proposal updates
 * Implements requirements 7.1, 7.2, 7.5 from the design document
 */
export class ProposalWebSocketService extends EventEmitter {
    private static readonly SERVICE_ID = 'proposalWebSocketService';

    private isInitialized: boolean = false;
    private subscribedProposals: Set<string> = new Set();
    private subscribedUsers: Set<string> = new Set();
    private currentUserId: string | null = null;
    private connectionRetryCount: number = 0;
    private maxRetries: number = 5;
    private retryDelay: number = 2000;
    private throttleConfig: ConnectionThrottleConfig;

    constructor() {
        super();
        this.throttleConfig = getServiceConfig(ProposalWebSocketService.SERVICE_ID);
        this.initialize();
    }

    /**
     * Initialize the proposal WebSocket service
     * Requirements: 7.1, 7.2
     */
    private initialize(): void {
        if (this.isInitialized) {
            return;
        }

        // Listen to realtime service events
        realtimeService.on('connected', this.handleConnection.bind(this));
        realtimeService.on('disconnected', this.handleDisconnection.bind(this));
        realtimeService.on('error', this.handleError.bind(this));

        // Listen to proposal-specific message types
        realtimeService.on('proposal_accepted', this.handleProposalAccepted.bind(this));
        realtimeService.on('proposal_rejected', this.handleProposalRejected.bind(this));
        realtimeService.on('proposal_status_changed', this.handleProposalStatusChanged.bind(this));
        realtimeService.on('proposal_payment_updated', this.handleProposalPaymentUpdated.bind(this));
        realtimeService.on('proposal_blockchain_recorded', this.handleProposalBlockchainRecorded.bind(this));

        this.isInitialized = true;
        logger.info('ProposalWebSocketService initialized');
    }

    /**
     * Connect to proposal WebSocket updates with throttling and recovery
     * Requirements: 7.5, 1.2, 1.3, 2.1
     */
    public async connect(): Promise<void> {
        // Check if throttling is enabled
        if (!isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return this.connectDirect();
        }

        // Check connection state before attempting new connection
        if (!connectionStateChecker.canConnect(ProposalWebSocketService.SERVICE_ID)) {
            const status = connectionStateChecker.getConnectionStatus(ProposalWebSocketService.SERVICE_ID);

            if (status.isConnected) {
                logger.debug('ProposalWebSocketService already connected, skipping connection attempt');
                return;
            }

            if (status.throttlingStatus.isPending) {
                logger.debug('ProposalWebSocketService connection already pending, skipping duplicate attempt');
                return;
            }

            if (!status.canConnect) {
                const nextAttempt = status.throttlingStatus.nextAllowedAttempt;
                const message = nextAttempt
                    ? `Connection throttled until ${new Date(nextAttempt).toISOString()}`
                    : 'Connection throttled due to rate limiting or max retries';

                logger.warn('ProposalWebSocketService connection attempt blocked by throttling', {
                    attemptCount: status.throttlingStatus.attemptCount,
                    attemptsInWindow: status.throttlingStatus.attemptsInWindow,
                    nextAllowedAttempt: nextAttempt
                });

                throw new Error(message);
            }
        }

        // Use throttled connection with debouncing
        return connectionThrottlingManager.debounceConnection(
            ProposalWebSocketService.SERVICE_ID,
            () => this.connectDirect(),
            this.throttleConfig.debounceDelay
        );
    }

    /**
     * Direct connection method without throttling (internal use)
     * Requirements: 7.5
     */
    private async connectDirect(): Promise<void> {
        try {
            // Set connecting state
            connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, false);

            await realtimeService.connect();

            // Set connected state
            connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, true);

            this.connectionRetryCount = 0;
            this.emit('connected');
            logger.info('ProposalWebSocketService connected');

            // Reset throttling tracking on successful connection
            if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
                connectionThrottlingManager.resetConnectionTracking(ProposalWebSocketService.SERVICE_ID);
            }
        } catch (error) {
            // Set disconnected state
            connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, false);

            logger.error('Failed to connect ProposalWebSocketService', { error });
            this.emit('error', error);
            await this.handleConnectionError();
            throw error;
        }
    }

    /**
     * Disconnect from proposal WebSocket updates
     */
    public disconnect(): void {
        this.unsubscribeFromAll();
        realtimeService.disconnect();

        // Update connection state
        connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, false);

        // Clear any pending throttled connections
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            connectionThrottlingManager.clearDebounce(ProposalWebSocketService.SERVICE_ID);
        }

        this.emit('disconnected');
        logger.info('ProposalWebSocketService disconnected');
    }

    /**
     * Subscribe to updates for specific proposals
     * Requirements: 7.1, 7.2
     */
    public subscribeToProposals(proposalIds: string[]): void {
        const newProposalIds = proposalIds.filter(id => !this.subscribedProposals.has(id));

        if (newProposalIds.length > 0) {
            newProposalIds.forEach(id => this.subscribedProposals.add(id));

            const channels = newProposalIds.map(id => `proposal:${id}`);
            realtimeService.subscribe(channels);

            logger.debug('Subscribed to proposal updates', { proposalIds: newProposalIds });
            this.emit('subscribed_proposals', newProposalIds);
        }
    }

    /**
     * Unsubscribe from updates for specific proposals
     */
    public unsubscribeFromProposals(proposalIds: string[]): void {
        const subscribedProposalIds = proposalIds.filter(id => this.subscribedProposals.has(id));

        if (subscribedProposalIds.length > 0) {
            subscribedProposalIds.forEach(id => this.subscribedProposals.delete(id));

            const channels = subscribedProposalIds.map(id => `proposal:${id}`);
            realtimeService.unsubscribe(channels);

            logger.debug('Unsubscribed from proposal updates', { proposalIds: subscribedProposalIds });
            this.emit('unsubscribed_proposals', subscribedProposalIds);
        }
    }

    /**
     * Subscribe to proposal updates for specific users
     * Requirements: 7.1, 7.2
     */
    public subscribeToUserProposals(userIds: string[]): void {
        const newUserIds = userIds.filter(id => !this.subscribedUsers.has(id));

        if (newUserIds.length > 0) {
            newUserIds.forEach(id => this.subscribedUsers.add(id));

            const channels = newUserIds.map(id => `user_proposals:${id}`);
            realtimeService.subscribe(channels);

            logger.debug('Subscribed to user proposal updates', { userIds: newUserIds });
            this.emit('subscribed_users', newUserIds);
        }
    }

    /**
     * Unsubscribe from proposal updates for specific users
     */
    public unsubscribeFromUserProposals(userIds: string[]): void {
        const subscribedUserIds = userIds.filter(id => this.subscribedUsers.has(id));

        if (subscribedUserIds.length > 0) {
            subscribedUserIds.forEach(id => this.subscribedUsers.delete(id));

            const channels = subscribedUserIds.map(id => `user_proposals:${id}`);
            realtimeService.unsubscribe(channels);

            logger.debug('Unsubscribed from user proposal updates', { userIds: subscribedUserIds });
            this.emit('unsubscribed_users', subscribedUserIds);
        }
    }

    /**
     * Subscribe to current user's proposal updates
     * Requirements: 7.1, 7.2
     */
    public subscribeToCurrentUserProposals(userId: string): void {
        this.currentUserId = userId;
        this.subscribeToUserProposals([userId]);

        // Subscribe to general proposal activity for this user
        realtimeService.subscribe([
            `proposal_activity:${userId}`,
            `proposal_notifications:${userId}`,
        ]);

        logger.info('Subscribed to current user proposal updates', { userId });
    }

    /**
     * Unsubscribe from all proposal updates
     */
    public unsubscribeFromAll(): void {
        if (this.subscribedProposals.size > 0) {
            this.unsubscribeFromProposals(Array.from(this.subscribedProposals));
        }

        if (this.subscribedUsers.size > 0) {
            this.unsubscribeFromUserProposals(Array.from(this.subscribedUsers));
        }

        if (this.currentUserId) {
            realtimeService.unsubscribe([
                `proposal_activity:${this.currentUserId}`,
                `proposal_notifications:${this.currentUserId}`,
            ]);
            this.currentUserId = null;
        }

        logger.info('Unsubscribed from all proposal updates');
    }

    /**
     * Check if connected to WebSocket
     * Requirements: 2.1
     */
    public isConnected(): boolean {
        const realtimeConnected = realtimeService.isConnected();
        const stateCheckerConnected = connectionStateChecker.isConnected(ProposalWebSocketService.SERVICE_ID);

        // Sync connection states if they differ
        if (realtimeConnected !== stateCheckerConnected) {
            connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, realtimeConnected);
        }

        return realtimeConnected;
    }

    /**
     * Get current subscription status
     * Requirements: 2.1
     */
    public getSubscriptionStatus(): {
        proposals: string[];
        users: string[];
        currentUser: string | null;
        isConnected: boolean;
        connectionStatus?: ReturnType<typeof connectionStateChecker.getConnectionStatus>;
    } {
        const status = {
            proposals: Array.from(this.subscribedProposals),
            users: Array.from(this.subscribedUsers),
            currentUser: this.currentUserId,
            isConnected: this.isConnected(),
        };

        // Add throttling status if enabled
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            return {
                ...status,
                connectionStatus: connectionStateChecker.getConnectionStatus(ProposalWebSocketService.SERVICE_ID),
            };
        }

        return status;
    }

    // Event handlers for connection management
    private handleConnection(): void {
        logger.info('Proposal WebSocket connected');
        this.connectionRetryCount = 0;

        // Update connection state
        connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, true);

        // Reset throttling tracking on successful connection
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            connectionThrottlingManager.resetConnectionTracking(ProposalWebSocketService.SERVICE_ID);
        }

        this.emit('connected');
        this.resubscribeAll();
    }

    private handleDisconnection(event: CloseEvent): void {
        logger.warn('Proposal WebSocket disconnected', {
            code: event.code,
            reason: event.reason
        });

        // Update connection state
        connectionStateChecker.setConnectionState(ProposalWebSocketService.SERVICE_ID, false);

        this.emit('disconnected', event);

        // Attempt to reconnect if not a clean disconnect
        if (!event.wasClean) {
            this.handleConnectionError();
        }
    }

    private handleError(error: Event): void {
        logger.error('Proposal WebSocket error', { error });
        this.emit('error', error);
    }

    /**
     * Handle connection errors with retry logic and throttling
     * Requirements: 7.5, 1.2, 1.3
     */
    private async handleConnectionError(): Promise<void> {
        // Use throttling config for max retries if available
        const maxRetries = isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')
            ? this.throttleConfig.maxRetries
            : this.maxRetries;

        if (this.connectionRetryCount >= maxRetries) {
            logger.error('Max connection retries reached for ProposalWebSocketService');
            this.emit('max_retries_reached');
            return;
        }

        this.connectionRetryCount++;

        // Use throttling config for retry delay if available and exponential backoff is enabled
        let delay = this.retryDelay;
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            delay = this.throttleConfig.retryDelay;
            if (isThrottlingFeatureEnabled('ENABLE_EXPONENTIAL_BACKOFF')) {
                delay = delay * Math.pow(2, this.connectionRetryCount - 1);
            }
        } else {
            delay = delay * Math.pow(2, this.connectionRetryCount - 1);
        }

        logger.info('Retrying proposal WebSocket connection', {
            attempt: this.connectionRetryCount,
            maxRetries,
            delay,
            throttlingEnabled: isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')
        });

        setTimeout(async () => {
            try {
                await this.connect();
            } catch (error) {
                logger.error('Retry connection failed', { error });
            }
        }, delay);
    }

    // Event handlers for proposal-specific messages
    private handleProposalAccepted(data: ProposalWebSocketMessage['data']): void {
        logger.info('Proposal accepted event received', { proposalId: data.proposalId });

        const statusUpdate: ProposalStatusUpdate = {
            proposalId: data.proposalId,
            status: 'accepted',
            respondedBy: data.respondedBy,
            respondedAt: data.respondedAt || new Date().toISOString(),
            paymentStatus: data.paymentStatus,
        };

        this.emit('proposal_accepted', statusUpdate);
        this.emit('proposal_status_update', statusUpdate);
    }

    private handleProposalRejected(data: ProposalWebSocketMessage['data']): void {
        logger.info('Proposal rejected event received', {
            proposalId: data.proposalId,
            reason: data.rejectionReason
        });

        const statusUpdate: ProposalStatusUpdate = {
            proposalId: data.proposalId,
            status: 'rejected',
            respondedBy: data.respondedBy,
            respondedAt: data.respondedAt || new Date().toISOString(),
            rejectionReason: data.rejectionReason,
        };

        this.emit('proposal_rejected', statusUpdate);
        this.emit('proposal_status_update', statusUpdate);
    }

    private handleProposalStatusChanged(data: ProposalWebSocketMessage['data']): void {
        logger.debug('Proposal status changed', {
            proposalId: data.proposalId,
            status: data.status
        });

        if (data.status && data.status !== 'pending') {
            const statusUpdate: ProposalStatusUpdate = {
                proposalId: data.proposalId,
                status: data.status as 'accepted' | 'rejected' | 'expired',
                respondedBy: data.respondedBy,
                respondedAt: data.respondedAt || new Date().toISOString(),
                rejectionReason: data.rejectionReason,
                paymentStatus: data.paymentStatus,
            };

            this.emit('proposal_status_update', statusUpdate);
        }
    }

    private handleProposalPaymentUpdated(data: ProposalWebSocketMessage['data']): void {
        logger.info('Proposal payment updated', {
            proposalId: data.proposalId,
            paymentStatus: data.paymentStatus
        });

        if (data.paymentTransaction) {
            const paymentUpdate: ProposalPaymentUpdate = {
                proposalId: data.proposalId,
                paymentTransaction: data.paymentTransaction,
            };

            this.emit('proposal_payment_update', paymentUpdate);
        }
    }

    private handleProposalBlockchainRecorded(data: ProposalWebSocketMessage['data']): void {
        logger.info('Proposal blockchain recorded', {
            proposalId: data.proposalId,
            transactionId: data.blockchainTransaction?.transactionId
        });

        if (data.blockchainTransaction) {
            const blockchainUpdate: ProposalBlockchainUpdate = {
                proposalId: data.proposalId,
                blockchainTransaction: data.blockchainTransaction,
            };

            this.emit('proposal_blockchain_update', blockchainUpdate);
        }
    }

    /**
     * Resubscribe to all channels after reconnection
     * Requirements: 7.5
     */
    private resubscribeAll(): void {
        // Resubscribe to proposal updates
        if (this.subscribedProposals.size > 0) {
            const channels = Array.from(this.subscribedProposals).map(id => `proposal:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to user proposal updates
        if (this.subscribedUsers.size > 0) {
            const channels = Array.from(this.subscribedUsers).map(id => `user_proposals:${id}`);
            realtimeService.subscribe(channels);
        }

        // Resubscribe to current user proposal updates
        if (this.currentUserId) {
            realtimeService.subscribe([
                `proposal_activity:${this.currentUserId}`,
                `proposal_notifications:${this.currentUserId}`,
            ]);
        }

        logger.info('Resubscribed to all proposal channels after reconnection');
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
            serviceId: ProposalWebSocketService.SERVICE_ID,
            throttlingEnabled: true,
            connectionStatus: connectionStateChecker.getConnectionStatus(ProposalWebSocketService.SERVICE_ID),
            config: this.throttleConfig,
        };
    }

    /**
     * Force reset throttling state (for debugging/testing)
     * Requirements: 2.1
     */
    public resetThrottling(): void {
        if (isThrottlingFeatureEnabled('ENABLE_CONNECTION_THROTTLING')) {
            connectionStateChecker.resetConnectionState(ProposalWebSocketService.SERVICE_ID);
            logger.info('ProposalWebSocketService throttling state reset');
        }
    }
}

// Export singleton instance
export const proposalWebSocketService = new ProposalWebSocketService();
export default proposalWebSocketService;