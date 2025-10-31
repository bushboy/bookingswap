import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Pool } from 'pg';
import { 
  createNotificationService, 
  createAuctionNotificationService, 
  createPaymentNotificationService,
  createTimingNotificationService 
} from '../factory';

// Mock dependencies
vi.mock('../../database/repositories/NotificationRepository');
vi.mock('../../database/repositories/UserRepository');
vi.mock('../../database/repositories/SwapRepository');
vi.mock('../WebSocketService');

describe('Notification Services Integration', () => {
  let mockPool: Pool;

  beforeEach(() => {
    mockPool = {} as Pool;
    vi.clearAllMocks();
  });

  describe('Factory Functions', () => {
    it('should create NotificationService', () => {
      const service = createNotificationService(mockPool);
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('NotificationService');
    });

    it('should create AuctionNotificationService', () => {
      const service = createAuctionNotificationService(mockPool);
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('AuctionNotificationService');
    });

    it('should create PaymentNotificationService', () => {
      const service = createPaymentNotificationService(mockPool);
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('PaymentNotificationService');
    });

    it('should create TimingNotificationService', () => {
      const service = createTimingNotificationService(mockPool);
      expect(service).toBeDefined();
      expect(service.constructor.name).toBe('TimingNotificationService');
    });
  });

  describe('Service Methods', () => {
    it('should have required methods on AuctionNotificationService', () => {
      const service = createAuctionNotificationService(mockPool);
      
      expect(typeof service.findInterestedUsers).toBe('function');
      expect(typeof service.notifyInterestedUsersOfAuction).toBe('function');
      expect(typeof service.sendAuctionEndingReminders).toBe('function');
      expect(typeof service.sendAuctionCompletionNotifications).toBe('function');
      expect(typeof service.sendAutoSelectionNotifications).toBe('function');
      expect(typeof service.sendEscalatingSelectionReminders).toBe('function');
    });

    it('should have required methods on PaymentNotificationService', () => {
      const service = createPaymentNotificationService(mockPool);
      
      expect(typeof service.sendPaymentStatusNotification).toBe('function');
      expect(typeof service.sendEscrowNotification).toBe('function');
      expect(typeof service.sendPaymentConfirmation).toBe('function');
      expect(typeof service.sendPaymentReminder).toBe('function');
      expect(typeof service.sendRefundNotification).toBe('function');
    });

    it('should have required methods on TimingNotificationService', () => {
      const service = createTimingNotificationService(mockPool);
      
      expect(typeof service.sendLastMinuteBookingRestriction).toBe('function');
      expect(typeof service.sendAuctionUnavailableExplanation).toBe('function');
      expect(typeof service.sendEscalatingAuctionSelectionReminders).toBe('function');
      expect(typeof service.isLastMinuteBooking).toBe('function');
      expect(typeof service.isValidAuctionTiming).toBe('function');
      expect(typeof service.getMaxAuctionEndDate).toBe('function');
    });
  });
});