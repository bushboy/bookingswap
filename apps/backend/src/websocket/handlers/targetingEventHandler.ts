import { Server as SocketIOServer, Socket } from 'socket.io';
import { SwapTarget, SwapTargetStatus, TargetingHistory } from '@booking-swap/shared';
import { SwapTargetingRepository } from '../../database/repositories/SwapTargetingRepository';
import { logger } from '../../utils/logger';

interface TargetingEventData {
    targetId: string;
    sourceSwapId: string;
    targetSwapId: string;
    userId: string;
    status?: SwapTargetStatus;
    action?: string;
    reason?: string;
    metadata?: Record<string, any>;
}

interface TargetingSubscription {
    userId: string;
    swapIds: Set<string>;
    channels: Set<string>;
    lastActivity: Date;
}

/**
 * WebSocket event handler for real-time targeting updates
 * Manages subscriptions, broadcasts events, and handles targeting-related WebSocket communications
 */
export class TargetingEventHandler {
    private io: SocketIOServer;
    private swapTargetingRepository: SwapTargetingRepository;
    private subscriptions: Map<string, TargetingSubscription> = new Map();
    private socketToUser: Map<string, string> = new Map();
    private userToSockets: Map<string, Set<string>> = new Map();

    constructor(io: SocketIOServer, swapTargetingRepository: SwapTargetingRepository) {
        this.io = io;
        this.swapTargetingRepository = swapTargetingRepository;
        this.setupEventHandlers();
    }

    /**
     * Setup WebSocket event handlers for targeting
     */
    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            logger.info(`Client connected: ${socket.id}`);

            // Handle targeting subscription
            socket.on('targeting:subscribe', (data: { swapId: string }) => {
                this.handleSubscription(socket, data.swapId);
            });

            // Handle targeting unsubscription
            socket.on('targeting:unsubscribe', (data: { swapId: string }) => {
                this.handleUnsubscription(socket, data.swapId);
            });

            // Handle user targeting subscription
            socket.on('targeting:subscribe_user', (data: { userId: string }) => {
                this.handleUserSubscription(socket, data.userId);
            });

            // Handle targeting status read
            socket.on('targeting:status_read', (data: { targetId: string }) => {
                this.handleStatusRead(socket, data.targetId);
            });

            // Handle targeting sync request
            socket.on('targeting:sync_request', (data: { swapId: string; lastSyncTime?: Date }) => {
                this.handleSyncRequest(socket, data.swapId, data.lastSyncTime);
            });

            // Handle heartbeat
            socket.on('targeting:heartbeat', () => {
                this.handleHeartbeat(socket);
            });

            // Handle disconnection
            socket.on('disconnect', (reason: string) => {
                logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
                this.handleDisconnection(socket);
            });

            // Handle connection errors
            socket.on('error', (error: Error) => {
                logger.error(`Socket error for ${socket.id}:`, error);
            });
        });
    }

    /**
     * Handle targeting subscription for a specific swap
     */
    private handleSubscription(socket: Socket, swapId: string): void {
        try {
            const userId = this.getUserIdFromSocket(socket);
            if (!userId) {
                socket.emit('targeting:error', { message: 'Authentication required' });
                return;
            }

            // Get or create subscription
            let subscription = this.subscriptions.get(userId);
            if (!subscription) {
                subscription = {
                    userId,
                    swapIds: new Set(),
                    channels: new Set(),
                    lastActivity: new Date(),
                };
                this.subscriptions.set(userId, subscription);
            }

            // Add swap to subscription
            subscription.swapIds.add(swapId);
            subscription.lastActivity = new Date();

            // Join socket rooms
            const swapRoom = `swap_targeting:${swapId}`;
            socket.join(swapRoom);
            subscription.channels.add(swapRoom);

            // Track socket to user mapping
            this.socketToUser.set(socket.id, userId);
            if (!this.userToSockets.has(userId)) {
                this.userToSockets.set(userId, new Set());
            }
            this.userToSockets.get(userId)!.add(socket.id);

            logger.info(`User ${userId} subscribed to targeting for swap ${swapId}`);

            // Send initial targeting data
            this.sendInitialTargetingData(socket, swapId, userId);

            // Acknowledge subscription
            socket.emit('targeting:subscribed', { swapId, timestamp: new Date() });

        } catch (error) {
            logger.error('Error handling targeting subscription:', error);
            socket.emit('targeting:error', { message: 'Subscription failed' });
        }
    }

    /**
     * Handle targeting unsubscription for a specific swap
     */
    private handleUnsubscription(socket: Socket, swapId: string): void {
        try {
            const userId = this.getUserIdFromSocket(socket);
            if (!userId) return;

            const subscription = this.subscriptions.get(userId);
            if (!subscription) return;

            // Remove swap from subscription
            subscription.swapIds.delete(swapId);
            subscription.lastActivity = new Date();

            // Leave socket room
            const swapRoom = `swap_targeting:${swapId}`;
            socket.leave(swapRoom);
            subscription.channels.delete(swapRoom);

            logger.info(`User ${userId} unsubscribed from targeting for swap ${swapId}`);

            // Acknowledge unsubscription
            socket.emit('targeting:unsubscribed', { swapId, timestamp: new Date() });

        } catch (error) {
            logger.error('Error handling targeting unsubscription:', error);
        }
    }

    /**
     * Handle user-level targeting subscription
     */
    private handleUserSubscription(socket: Socket, userId: string): void {
        try {
            const socketUserId = this.getUserIdFromSocket(socket);
            if (!socketUserId || socketUserId !== userId) {
                socket.emit('targeting:error', { message: 'Unauthorized' });
                return;
            }

            // Join user-specific rooms
            const userRooms = [
                `user_targeting:${userId}`,
                `targeting_activity:${userId}`,
                `targeting_notifications:${userId}`,
            ];

            userRooms.forEach(room => socket.join(room));

            logger.info(`User ${userId} subscribed to user targeting updates`);

            // Send initial user targeting data
            this.sendInitialUserTargetingData(socket, userId);

            // Acknowledge subscription
            socket.emit('targeting:user_subscribed', { userId, timestamp: new Date() });

        } catch (error) {
            logger.error('Error handling user targeting subscription:', error);
            socket.emit('targeting:error', { message: 'User subscription failed' });
        }
    }

    /**
     * Handle targeting status read acknowledgment
     */
    private handleStatusRead(socket: Socket, targetId: string): void {
        try {
            const userId = this.getUserIdFromSocket(socket);
            if (!userId) return;

            logger.info(`User ${userId} marked targeting ${targetId} as read`);

            // Broadcast read status to other user sessions
            const userSockets = this.userToSockets.get(userId);
            if (userSockets) {
                userSockets.forEach(socketId => {
                    if (socketId !== socket.id) {
                        this.io.to(socketId).emit('targeting:status_read', {
                            targetId,
                            userId,
                            timestamp: new Date(),
                        });
                    }
                });
            }

        } catch (error) {
            logger.error('Error handling targeting status read:', error);
        }
    }

    /**
     * Handle targeting sync request
     */
    private async handleSyncRequest(socket: Socket, swapId: string, lastSyncTime?: Date): Promise<void> {
        try {
            const userId = this.getUserIdFromSocket(socket);
            if (!userId) return;

            logger.info(`Sync request for swap ${swapId} from user ${userId}`);

            // Get targeting data since last sync
            const targetingData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);
            const swapTargeting = targetingData.find(data =>
                data.userSwap.id === swapId ||
                data.incomingTargets.some(t => t.sourceSwapId === swapId) ||
                data.outgoingTarget?.targetSwapId === swapId
            );

            if (swapTargeting) {
                socket.emit('targeting:sync_response', {
                    swapId,
                    data: swapTargeting,
                    syncTime: new Date(),
                    fullSync: !lastSyncTime,
                });
            }

        } catch (error) {
            logger.error('Error handling targeting sync request:', error);
            socket.emit('targeting:sync_error', { swapId, message: 'Sync failed' });
        }
    }

    /**
     * Handle heartbeat to maintain connection
     */
    private handleHeartbeat(socket: Socket): void {
        const userId = this.getUserIdFromSocket(socket);
        if (userId) {
            const subscription = this.subscriptions.get(userId);
            if (subscription) {
                subscription.lastActivity = new Date();
            }
        }

        socket.emit('targeting:heartbeat_ack', {
            timestamp: new Date(),
            subscriptions: userId ? Array.from(this.subscriptions.get(userId)?.swapIds || []) : [],
        });
    }

    /**
     * Handle client disconnection
     */
    private handleDisconnection(socket: Socket): void {
        const userId = this.socketToUser.get(socket.id);
        if (userId) {
            // Remove socket from user mapping
            this.socketToUser.delete(socket.id);
            const userSockets = this.userToSockets.get(userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    this.userToSockets.delete(userId);
                    // Clean up subscription if no more sockets
                    this.subscriptions.delete(userId);
                    logger.info(`Cleaned up targeting subscription for user ${userId}`);
                }
            }
        }
    }

    /**
     * Send initial targeting data for a swap
     */
    private async sendInitialTargetingData(socket: Socket, swapId: string, userId: string): Promise<void> {
        try {
            const targetingData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);
            const swapTargeting = targetingData.find(data =>
                data.userSwap.id === swapId ||
                data.incomingTargets.some(t => t.sourceSwapId === swapId) ||
                data.outgoingTarget?.targetSwapId === swapId
            );

            if (swapTargeting) {
                socket.emit('targeting:initial_data', {
                    swapId,
                    data: swapTargeting,
                    timestamp: new Date(),
                });
            }

        } catch (error) {
            logger.error('Error sending initial targeting data:', error);
        }
    }

    /**
     * Send initial user targeting data
     */
    private async sendInitialUserTargetingData(socket: Socket, userId: string): Promise<void> {
        try {
            const targetingData = await this.swapTargetingRepository.getTargetingDataForUserSwaps(userId);

            socket.emit('targeting:initial_user_data', {
                userId,
                data: targetingData,
                timestamp: new Date(),
            });

        } catch (error) {
            logger.error('Error sending initial user targeting data:', error);
        }
    }

    /**
     * Broadcast targeting created event
     */
    public async broadcastTargetingCreated(eventData: TargetingEventData): Promise<void> {
        try {
            const { targetId, sourceSwapId, targetSwapId, userId } = eventData;

            // Get full targeting data
            const target = await this.swapTargetingRepository.getSwapTarget(targetId);
            if (!target) return;

            // Broadcast to source swap subscribers (outgoing target)
            this.io.to(`swap_targeting:${sourceSwapId}`).emit('targeting:update', {
                type: 'targeting_created',
                targetId,
                sourceSwapId,
                targetSwapId,
                target,
                timestamp: new Date(),
            });

            // Broadcast to target swap subscribers (incoming target)
            this.io.to(`swap_targeting:${targetSwapId}`).emit('targeting:update', {
                type: 'targeting_received',
                targetId,
                sourceSwapId,
                targetSwapId,
                target,
                timestamp: new Date(),
            });

            // Broadcast to user activity feed
            this.io.to(`targeting_activity:${userId}`).emit('targeting:activity', {
                type: 'targeting_created',
                targetId,
                sourceSwapId,
                targetSwapId,
                timestamp: new Date(),
            });

            logger.info(`Broadcasted targeting created: ${targetId}`);

        } catch (error) {
            logger.error('Error broadcasting targeting created:', error);
        }
    }

    /**
     * Broadcast targeting status changed event
     */
    public async broadcastTargetingStatusChanged(eventData: TargetingEventData): Promise<void> {
        try {
            const { targetId, sourceSwapId, targetSwapId, status, action, reason } = eventData;

            const broadcastData = {
                type: `targeting_${action || status}`,
                targetId,
                sourceSwapId,
                targetSwapId,
                status,
                reason,
                timestamp: new Date(),
            };

            // Broadcast to both swap subscribers
            this.io.to(`swap_targeting:${sourceSwapId}`).emit('targeting:update', broadcastData);
            this.io.to(`swap_targeting:${targetSwapId}`).emit('targeting:update', broadcastData);

            // Broadcast to user activity feeds
            this.io.to(`targeting_activity:${eventData.userId}`).emit('targeting:activity', broadcastData);

            logger.info(`Broadcasted targeting status changed: ${targetId} -> ${status}`);

        } catch (error) {
            logger.error('Error broadcasting targeting status changed:', error);
        }
    }

    /**
     * Broadcast targeting removed event
     */
    public async broadcastTargetingRemoved(eventData: TargetingEventData): Promise<void> {
        try {
            const { targetId, sourceSwapId, targetSwapId, reason } = eventData;

            const broadcastData = {
                type: 'targeting_cancelled',
                targetId,
                sourceSwapId,
                targetSwapId,
                reason,
                timestamp: new Date(),
            };

            // Broadcast to both swap subscribers
            this.io.to(`swap_targeting:${sourceSwapId}`).emit('targeting:update', broadcastData);
            this.io.to(`swap_targeting:${targetSwapId}`).emit('targeting:update', broadcastData);

            // Broadcast to user activity feed
            this.io.to(`targeting_activity:${eventData.userId}`).emit('targeting:activity', broadcastData);

            logger.info(`Broadcasted targeting removed: ${targetId}`);

        } catch (error) {
            logger.error('Error broadcasting targeting removed:', error);
        }
    }

    /**
     * Broadcast auction targeting update
     */
    public async broadcastAuctionTargetingUpdate(swapId: string, auctionInfo: any): Promise<void> {
        try {
            const broadcastData = {
                type: 'auction_targeting_update',
                targetSwapId: swapId,
                auctionInfo,
                timestamp: new Date(),
            };

            // Broadcast to swap subscribers
            this.io.to(`swap_targeting:${swapId}`).emit('targeting:update', broadcastData);

            logger.info(`Broadcasted auction targeting update for swap: ${swapId}`);

        } catch (error) {
            logger.error('Error broadcasting auction targeting update:', error);
        }
    }

    /**
     * Broadcast proposal targeting update
     */
    public async broadcastProposalTargetingUpdate(sourceSwapId: string, targetSwapId: string, proposalInfo: any): Promise<void> {
        try {
            const broadcastData = {
                type: 'proposal_targeting_update',
                sourceSwapId,
                targetSwapId,
                proposalInfo,
                timestamp: new Date(),
            };

            // Broadcast to both swap subscribers
            this.io.to(`swap_targeting:${sourceSwapId}`).emit('targeting:update', broadcastData);
            this.io.to(`swap_targeting:${targetSwapId}`).emit('targeting:update', broadcastData);

            logger.info(`Broadcasted proposal targeting update: ${sourceSwapId} -> ${targetSwapId}`);

        } catch (error) {
            logger.error('Error broadcasting proposal targeting update:', error);
        }
    }

    /**
     * Broadcast batch targeting updates
     */
    public async broadcastBatchTargetingUpdates(updates: Array<{
        type: string;
        targetId: string;
        data: any;
    }>): Promise<void> {
        try {
            const broadcastData = {
                type: 'targeting_batch_update',
                batchUpdates: updates,
                timestamp: new Date(),
            };

            // Get all affected swap IDs
            const affectedSwaps = new Set<string>();
            updates.forEach(update => {
                if (update.data.sourceSwapId) affectedSwaps.add(update.data.sourceSwapId);
                if (update.data.targetSwapId) affectedSwaps.add(update.data.targetSwapId);
            });

            // Broadcast to all affected swaps
            affectedSwaps.forEach(swapId => {
                this.io.to(`swap_targeting:${swapId}`).emit('targeting:update', broadcastData);
            });

            logger.info(`Broadcasted batch targeting updates: ${updates.length} updates`);

        } catch (error) {
            logger.error('Error broadcasting batch targeting updates:', error);
        }
    }

    /**
     * Get user ID from socket (from authentication middleware)
     */
    private getUserIdFromSocket(socket: Socket): string | null {
        return socket.data?.userId || socket.handshake.auth?.userId || null;
    }

    /**
     * Get subscription statistics
     */
    public getSubscriptionStats(): {
        totalSubscriptions: number;
        activeUsers: number;
        totalSwapSubscriptions: number;
        averageSwapsPerUser: number;
    } {
        const totalSubscriptions = this.subscriptions.size;
        const activeUsers = this.userToSockets.size;
        const totalSwapSubscriptions = Array.from(this.subscriptions.values())
            .reduce((sum, sub) => sum + sub.swapIds.size, 0);
        const averageSwapsPerUser = totalSubscriptions > 0 ? totalSwapSubscriptions / totalSubscriptions : 0;

        return {
            totalSubscriptions,
            activeUsers,
            totalSwapSubscriptions,
            averageSwapsPerUser,
        };
    }

    /**
     * Clean up inactive subscriptions
     */
    public cleanupInactiveSubscriptions(maxInactiveTime: number = 30 * 60 * 1000): void {
        const now = Date.now();
        const inactiveUsers: string[] = [];

        this.subscriptions.forEach((subscription, userId) => {
            if (now - subscription.lastActivity.getTime() > maxInactiveTime) {
                inactiveUsers.push(userId);
            }
        });

        inactiveUsers.forEach(userId => {
            this.subscriptions.delete(userId);
            this.userToSockets.delete(userId);
            logger.info(`Cleaned up inactive targeting subscription for user: ${userId}`);
        });

        if (inactiveUsers.length > 0) {
            logger.info(`Cleaned up ${inactiveUsers.length} inactive targeting subscriptions`);
        }
    }
}

export default TargetingEventHandler;