import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { NotificationService } from '../NotificationService';
import { NotificationRepository } from '../../../database/repositories/NotificationRepository';
import { UserRepository } from '../../../database/repositories/UserRepository';
import { EmailService } from '../EmailService';
import { SMSService } from '../SMSService';
import { WebSocketService } from '../WebSocketService';
import { User, Booking, SwapTerms } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../EmailService');
vi.mock('../SMSService');
vi.mock('../WebSocketService');
vi.mock('../../../database/repositories/NotificationRepository');
vi.mock('../../../database/repositories/UserRepository');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockNotificationRepository: vi.Mocked<NotificationRepository>;
  let mockUserRepository: vi.Mocked<UserRepository>;
  let mockWebSocketService: vi.Mocked<WebSocketService>;

  const mockUser: User = {
    id: 'user-1',
    walletAddress: '0x123',
    profile: {
      displayName: 'Test User',
      email: 'test@example.com',
      phone: '+1234567890',
      preferences: {
        notifications: {
          email: true,
          sms: true,
          push: true,
          in_app: true,
          channels: {
            swap_proposal: ['email', 'in_app'],
            swap_accepted: ['email', 'sms', 'in_app'],
            swap_rejected: ['in_app'],
            swap_expired: ['email', 'in_app'],
            swap_cancelled: ['in_app'],
            booking_verified: ['email', 'in_app'],
            booking_expired: ['email', 'in_app'],
          },
        },
      },
    },
    verification: {
      level: 'verified',
      documents: [],
      verifiedAt: new Date(),
    },
    reputation: {
      score: 4.5,
      completedSwaps: 10,
      cancelledSwaps: 1,
      reviews: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
  };

  const mockBooking: Booking = {
    id: 'booking-1',
    userId: 'user-1',
    type: 'hotel',
    title: 'Test Hotel',
    description: 'A test hotel booking',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date('2024-01-01'),
      checkOut: new Date('2024-01-03'),
    },
    originalPrice: 200,
    swapValue: 180,
    providerDetails: {
      provider: 'booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF123',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date(),
      documents: [],
    },
    blockchain: {
      topicId: 'topic-1',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSwapTerms: SwapTerms = {
    additionalPayment: 50,
    conditions: ['No pets', 'Non-smoking'],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockNotificationRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      updateStatus: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      deleteExpired: vi.fn(),
      getUnreadCount: vi.fn(),
    } as any;

    mockUserRepository = {
      findById: vi.fn(),
    } as any;

    mockWebSocketService = {
      sendNotification: vi.fn(),
    } as any;

    notificationService = new NotificationService(
      mockNotificationRepository,
      mockUserRepository,
      mockWebSocketService
    );
  });

  describe('sendSwapProposalNotification', () => {
    it('should send swap proposal notification successfully', async () => {
      // Arrange
      const proposalData = {
        swapId: 'swap-1',
        recipientUserId: 'user-1',
        proposerUserId: 'user-2',
        sourceBooking: mockBooking,
        targetBooking: { ...mockBooking, id: 'booking-2', title: 'Target Hotel' },
        terms: mockSwapTerms,
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockNotificationRepository.create.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'swap_proposal',
        title: 'New Swap Proposal',
        message: 'Test message',
        channel: 'email',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Mock email service
      const mockEmailService = vi.mocked(EmailService);
      mockEmailService.prototype.sendEmail = vi.fn().mockResolvedValue({
        success: true,
        messageId: 'email-123',
        deliveredAt: new Date(),
      });

      // Mock WebSocket service
      mockWebSocketService.sendNotification.mockResolvedValue({
        success: true,
        messageId: 'ws-123',
        deliveredAt: new Date(),
      });

      // Act
      await notificationService.sendSwapProposalNotification(proposalData);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockNotificationRepository.create).toHaveBeenCalled();
      expect(mockNotificationRepository.updateStatus).toHaveBeenCalled();
    });

    it('should handle user not found gracefully', async () => {
      // Arrange
      const proposalData = {
        swapId: 'swap-1',
        recipientUserId: 'nonexistent-user',
        proposerUserId: 'user-2',
        sourceBooking: mockBooking,
        targetBooking: mockBooking,
        terms: mockSwapTerms,
      };

      mockUserRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(notificationService.sendSwapProposalNotification(proposalData))
        .resolves.not.toThrow();
      
      expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('sendSwapResponseNotification', () => {
    it('should send acceptance notification', async () => {
      // Arrange
      const responseData = {
        swapId: 'swap-1',
        recipientUserId: 'user-1',
        responderUserId: 'user-2',
        response: 'accepted' as const,
        sourceBooking: mockBooking,
        targetBooking: { ...mockBooking, id: 'booking-2' },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockNotificationRepository.create.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'swap_accepted',
        title: 'Swap Proposal Accepted',
        message: 'Test message',
        channel: 'email',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act
      await notificationService.sendSwapResponseNotification(responseData);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockNotificationRepository.create).toHaveBeenCalled();
    });

    it('should send rejection notification', async () => {
      // Arrange
      const responseData = {
        swapId: 'swap-1',
        recipientUserId: 'user-1',
        responderUserId: 'user-2',
        response: 'rejected' as const,
        sourceBooking: mockBooking,
        targetBooking: { ...mockBooking, id: 'booking-2' },
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockNotificationRepository.create.mockResolvedValue({
        id: 'notification-1',
        userId: 'user-1',
        type: 'swap_rejected',
        title: 'Swap Proposal Declined',
        message: 'Test message',
        channel: 'in_app',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      // Act
      await notificationService.sendSwapResponseNotification(responseData);

      // Assert
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
      expect(mockNotificationRepository.create).toHaveBeenCalled();
    });
  });

  describe('getUserNotifications', () => {
    it('should return user notifications with pagination', async () => {
      // Arrange
      const mockNotifications = [
        {
          id: 'notification-1',
          userId: 'user-1',
          type: 'swap_proposal',
          title: 'New Swap Proposal',
          message: 'Test message',
          channel: 'email',
          status: 'delivered',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockNotificationRepository.findByUserId.mockResolvedValue({
        notifications: mockNotifications as any,
        total: 1,
      });
      mockNotificationRepository.getUnreadCount.mockResolvedValue(0);

      // Act
      const result = await notificationService.getUserNotifications('user-1', {
        limit: 10,
        offset: 0,
      });

      // Assert
      expect(result).toEqual({
        notifications: mockNotifications,
        total: 1,
        unreadCount: 0,
      });
      expect(mockNotificationRepository.findByUserId).toHaveBeenCalledWith('user-1', {
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      // Arrange
      const notificationId = 'notification-1';
      const userId = 'user-1';
      const mockNotification = {
        id: notificationId,
        userId,
        type: 'swap_proposal',
        title: 'Test',
        message: 'Test message',
        channel: 'email',
        status: 'delivered',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.findById.mockResolvedValue(mockNotification as any);
      mockNotificationRepository.markAsRead.mockResolvedValue();

      // Act
      await notificationService.markAsRead(notificationId, userId);

      // Assert
      expect(mockNotificationRepository.findById).toHaveBeenCalledWith(notificationId);
      expect(mockNotificationRepository.markAsRead).toHaveBeenCalledWith(notificationId);
    });

    it('should throw error for unauthorized access', async () => {
      // Arrange
      const notificationId = 'notification-1';
      const userId = 'user-1';
      const mockNotification = {
        id: notificationId,
        userId: 'different-user',
        type: 'swap_proposal',
        title: 'Test',
        message: 'Test message',
        channel: 'email',
        status: 'delivered',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockNotificationRepository.findById.mockResolvedValue(mockNotification as any);

      // Act & Assert
      await expect(notificationService.markAsRead(notificationId, userId))
        .rejects.toThrow('Notification not found or access denied');
    });
  });

  describe('cleanupExpiredNotifications', () => {
    it('should delete expired notifications', async () => {
      // Arrange
      mockNotificationRepository.deleteExpired.mockResolvedValue(5);

      // Act
      const result = await notificationService.cleanupExpiredNotifications();

      // Assert
      expect(result).toBe(5);
      expect(mockNotificationRepository.deleteExpired).toHaveBeenCalled();
    });
  });
});