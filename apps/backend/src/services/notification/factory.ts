import { Pool } from 'pg';
import { NotificationService } from './NotificationService';
import { AuctionNotificationService } from './AuctionNotificationService';
import { PaymentNotificationService } from './PaymentNotificationService';
import { TimingNotificationService } from './TimingNotificationService';
import { TargetingNotificationService } from './TargetingNotificationService';
import { NotificationRepository } from '../../database/repositories/NotificationRepository';
import { UserRepository } from '../../database/repositories/UserRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { WebSocketService } from './WebSocketService';

let notificationService: NotificationService | null = null;
let auctionNotificationService: AuctionNotificationService | null = null;
let paymentNotificationService: PaymentNotificationService | null = null;
let timingNotificationService: TimingNotificationService | null = null;
let targetingNotificationService: TargetingNotificationService | null = null;

export function createNotificationService(pool: Pool, webSocketService?: WebSocketService): NotificationService {
  if (!notificationService) {
    const notificationRepository = new NotificationRepository(pool);
    const userRepository = new UserRepository(pool);

    // Use provided WebSocketService or create a mock one for testing
    const wsService = webSocketService || createMockWebSocketService();

    notificationService = new NotificationService(
      notificationRepository,
      userRepository,
      wsService
    );
  }

  return notificationService;
}

// Mock WebSocketService for cases where HTTP server is not available
function createMockWebSocketService(): WebSocketService {
  return {
    sendToUser: async () => ({ success: true, delivered: false }),
    sendToRoom: async () => ({ success: true, delivered: false }),
    broadcastToAll: async () => ({ success: true, delivered: false }),
    getUserSocketCount: () => 0,
    getTotalConnections: () => 0,
    joinRoom: async () => { },
    leaveRoom: async () => { },
  } as any;
}

export function createAuctionNotificationService(pool: Pool): AuctionNotificationService {
  if (!auctionNotificationService) {
    const notificationService = createNotificationService(pool);
    const userRepository = new UserRepository(pool);
    const swapRepository = new SwapRepository(pool);

    auctionNotificationService = new AuctionNotificationService(
      notificationService,
      userRepository,
      swapRepository
    );
  }

  return auctionNotificationService;
}

export function createPaymentNotificationService(pool: Pool): PaymentNotificationService {
  if (!paymentNotificationService) {
    const notificationService = createNotificationService(pool);

    paymentNotificationService = new PaymentNotificationService(
      notificationService
    );
  }

  return paymentNotificationService;
}

export function createTimingNotificationService(pool: Pool): TimingNotificationService {
  if (!timingNotificationService) {
    const notificationService = createNotificationService(pool);

    timingNotificationService = new TimingNotificationService(
      notificationService
    );
  }

  return timingNotificationService;
}

export function createTargetingNotificationService(pool: Pool, webSocketService?: WebSocketService): TargetingNotificationService {
  if (!targetingNotificationService) {
    const notificationService = createNotificationService(pool, webSocketService);
    const wsService = webSocketService || createMockWebSocketService();
    const swapRepository = new SwapRepository(pool);
    const userRepository = new UserRepository(pool);

    targetingNotificationService = new TargetingNotificationService(
      notificationService,
      wsService,
      swapRepository,
      userRepository
    );
  }

  return targetingNotificationService;
}

export function resetNotificationServices(): void {
  notificationService = null;
  auctionNotificationService = null;
  paymentNotificationService = null;
  timingNotificationService = null;
  targetingNotificationService = null;
}