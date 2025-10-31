import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { WebSocketNotificationData, NotificationDeliveryResult } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export class WebSocketService {
  private io: SocketIOServer;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      logger.info('User connected via WebSocket', { userId, socketId: socket.id });

      // Add socket to user's socket set
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Handle user joining their personal room
      socket.join(`user:${userId}`);

      // Join targeting-specific rooms
      socket.join(`targeting_activity:${userId}`);
      socket.join(`targeting_notifications:${userId}`);

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info('User disconnected from WebSocket', { userId, socketId: socket.id });
        const userSocketSet = this.userSockets.get(userId);
        if (userSocketSet) {
          userSocketSet.delete(socket.id);
          if (userSocketSet.size === 0) {
            this.userSockets.delete(userId);
          }
        }
      });

      // Handle notification acknowledgment
      socket.on('notification:read', (notificationId: string) => {
        logger.info('Notification marked as read', { userId, notificationId });
        // Emit to other user's sockets that notification was read
        socket.to(`user:${userId}`).emit('notification:read', notificationId);
      });

      // Handle targeting-specific events
      socket.on('targeting:subscribe', (data: { swapId?: string }) => {
        if (data.swapId) {
          socket.join(`targeting:${data.swapId}`);
          logger.info('User subscribed to targeting updates', { userId, swapId: data.swapId });
        }
      });

      socket.on('targeting:unsubscribe', (data: { swapId?: string }) => {
        if (data.swapId) {
          socket.leave(`targeting:${data.swapId}`);
          logger.info('User unsubscribed from targeting updates', { userId, swapId: data.swapId });
        }
      });

      // Handle proposal-specific events
      socket.on('proposal:subscribe', (data: { proposalId?: string }) => {
        if (data.proposalId) {
          socket.join(`proposal:${data.proposalId}`);
          logger.info('User subscribed to proposal updates', { userId, proposalId: data.proposalId });
        }
      });

      socket.on('proposal:unsubscribe', (data: { proposalId?: string }) => {
        if (data.proposalId) {
          socket.leave(`proposal:${data.proposalId}`);
          logger.info('User unsubscribed from proposal updates', { userId, proposalId: data.proposalId });
        }
      });

      socket.on('proposal:status_read', (data: { proposalId: string }) => {
        logger.info('Proposal status notification marked as read', { userId, proposalId: data.proposalId });
        socket.to(`user:${userId}`).emit('proposal:status_read', data.proposalId);
      });

      socket.on('targeting:status_read', (data: { targetId: string }) => {
        logger.info('Targeting notification marked as read', { userId, targetId: data.targetId });
        socket.to(`user:${userId}`).emit('targeting:status_read', data.targetId);
      });

      // Handle typing indicators for chat (future feature)
      socket.on('typing:start', (data: { swapId: string }) => {
        socket.to(`swap:${data.swapId}`).emit('typing:start', { userId });
      });

      socket.on('typing:stop', (data: { swapId: string }) => {
        socket.to(`swap:${data.swapId}`).emit('typing:stop', { userId });
      });
    });
  }

  private async authenticateSocket(socket: Socket, next: (err?: Error) => void): Promise<void> {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      (socket as any).userId = decoded.userId;

      next();
    } catch (error) {
      logger.error('WebSocket authentication failed', { error });
      next(new Error('Authentication failed'));
    }
  }

  async sendNotification(data: WebSocketNotificationData): Promise<NotificationDeliveryResult> {
    try {
      const { userId, notification } = data;

      logger.info('Sending WebSocket notification', {
        userId,
        notificationId: notification.id,
        type: notification.type
      });

      // Send to user's personal room
      this.io.to(`user:${userId}`).emit('notification', notification);

      // Check if user is connected
      const isConnected = this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;

      logger.info('WebSocket notification sent', {
        userId,
        notificationId: notification.id,
        isConnected
      });

      return {
        success: true,
        messageId: notification.id,
        deliveredAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to send WebSocket notification', { error, userId: data.userId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
      };
    }
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  // Send notification to specific swap participants
  async sendSwapNotification(swapId: string, notification: any): Promise<void> {
    this.io.to(`swap:${swapId}`).emit('swap:update', notification);
  }

  // Join user to swap room for real-time updates
  joinSwapRoom(userId: string, swapId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(`swap:${swapId}`);
        }
      });
    }
  }

  // Leave swap room
  leaveSwapRoom(userId: string, swapId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(`swap:${swapId}`);
        }
      });
    }
  }

  // Targeting-specific methods

  /**
   * Send targeting update to specific swap participants
   */
  async sendTargetingUpdate(swapId: string, update: any): Promise<void> {
    this.io.to(`targeting:${swapId}`).emit('targeting:update', update);
  }

  /**
   * Send targeting notification to user's targeting channels
   */
  async sendTargetingNotification(userId: string, notification: any): Promise<void> {
    this.io.to(`targeting_notifications:${userId}`).emit('targeting:notification', notification);
  }

  /**
   * Broadcast targeting activity to user's activity channel
   */
  async broadcastTargetingActivity(userId: string, activity: any): Promise<void> {
    this.io.to(`targeting_activity:${userId}`).emit('targeting:activity', activity);
  }

  /**
   * Join user to targeting room for specific swap
   */
  joinTargetingRoom(userId: string, swapId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(`targeting:${swapId}`);
        }
      });
    }
  }

  /**
   * Leave targeting room for specific swap
   */
  leaveTargetingRoom(userId: string, swapId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(`targeting:${swapId}`);
        }
      });
    }
  }

  /**
   * Send real-time proposal status update
   * Requirements: 7.5
   */
  async sendProposalStatusUpdate(data: {
    proposalId: string;
    status: 'accepted' | 'rejected';
    proposerId: string;
    targetUserId: string;
    respondedBy: string;
    respondedAt: Date;
    paymentStatus?: 'processing' | 'completed' | 'failed';
    swapId?: string;
    rejectionReason?: string;
  }): Promise<void> {
    const update = {
      proposalId: data.proposalId,
      status: data.status,
      respondedBy: data.respondedBy,
      respondedAt: data.respondedAt,
      paymentStatus: data.paymentStatus,
      swapId: data.swapId,
      rejectionReason: data.rejectionReason,
      timestamp: new Date()
    };

    // Send to both proposer and target user
    this.io.to(`user:${data.proposerId}`).emit('proposal:status_update', update);
    this.io.to(`user:${data.targetUserId}`).emit('proposal:status_update', update);

    // Also send to proposal-specific room if users are subscribed
    this.io.to(`proposal:${data.proposalId}`).emit('proposal:status_update', update);

    logger.info('Proposal status update sent via WebSocket', {
      proposalId: data.proposalId,
      status: data.status,
      proposerId: data.proposerId,
      targetUserId: data.targetUserId
    });
  }

  /**
   * Send real-time payment status update for proposals
   * Requirements: 7.4, 7.5
   */
  async sendProposalPaymentUpdate(data: {
    proposalId: string;
    transactionId: string;
    status: 'processing' | 'completed' | 'failed';
    amount: number;
    currency: string;
    recipientUserId: string;
    payerUserId: string;
    errorMessage?: string;
  }): Promise<void> {
    const update = {
      proposalId: data.proposalId,
      transactionId: data.transactionId,
      status: data.status,
      amount: data.amount,
      currency: data.currency,
      errorMessage: data.errorMessage,
      timestamp: new Date()
    };

    // Send to both recipient and payer
    this.io.to(`user:${data.recipientUserId}`).emit('proposal:payment_update', update);
    this.io.to(`user:${data.payerUserId}`).emit('proposal:payment_update', update);

    // Also send to proposal-specific room
    this.io.to(`proposal:${data.proposalId}`).emit('proposal:payment_update', update);

    logger.info('Proposal payment update sent via WebSocket', {
      proposalId: data.proposalId,
      transactionId: data.transactionId,
      status: data.status,
      recipientUserId: data.recipientUserId,
      payerUserId: data.payerUserId
    });
  }

  /**
   * Join user to proposal room for real-time updates
   */
  joinProposalRoom(userId: string, proposalId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(`proposal:${proposalId}`);
        }
      });
    }
  }

  /**
   * Leave proposal room
   */
  leaveProposalRoom(userId: string, proposalId: string): void {
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.leave(`proposal:${proposalId}`);
        }
      });
    }
  }

  /**
   * Get the io instance for direct access (used by TargetingNotificationService)
   */
  getIOInstance(): SocketIOServer {
    return this.io;
  }
}