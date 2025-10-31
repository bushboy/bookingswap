import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { notificationService } from '../notificationService';
import {
  Notification,
  NotificationType,
  NotificationPreferences,
  ValidationError,
  BusinessLogicError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('NotificationService', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockNotification: Notification = {
    id: '1',
    userId: 'user1',
    type: 'swap_proposal' as NotificationType,
    title: 'New Swap Proposal',
    message: 'You have received a new swap proposal',
    data: {
      swapId: 'swap1',
      proposerId: 'user2',
    },
    read: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getNotifications', () => {
    it('should fetch notifications successfully', async () => {
      const mockNotifications = [mockNotification];
      mockAxiosInstance.get.mockResolvedValue({ data: mockNotifications });

      const result = await notificationService.getNotifications();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 1, limit: 20 },
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should fetch notifications with pagination', async () => {
      const mockNotifications = [mockNotification];
      mockAxiosInstance.get.mockResolvedValue({ data: mockNotifications });

      const result = await notificationService.getNotifications({
        page: 2,
        limit: 10,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 2, limit: 10 },
      });
      expect(result).toEqual(mockNotifications);
    });

    it('should fetch unread notifications only', async () => {
      const mockNotifications = [mockNotification];
      mockAxiosInstance.get.mockResolvedValue({ data: mockNotifications });

      const result = await notificationService.getNotifications({
        unreadOnly: true,
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/notifications', {
        params: { page: 1, limit: 20, unreadOnly: true },
      });
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getUnreadCount', () => {
    it('should fetch unread notification count', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { count: 5 } });

      const result = await notificationService.getUnreadCount();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/notifications/unread-count'
      );
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('should mark single notification as read', async () => {
      const readNotification = { ...mockNotification, read: true };
      mockAxiosInstance.put.mockResolvedValue({ data: readNotification });

      const result = await notificationService.markAsRead('1');

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/notifications/1/read'
      );
      expect(result).toEqual(readNotification);
    });

    it('should mark multiple notifications as read', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: 2 } });

      const result = await notificationService.markAsRead(['1', '2']);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/notifications/mark-read',
        {
          notificationIds: ['1', '2'],
        }
      );
      expect(result).toEqual({ updated: 2 });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: 10 } });

      const result = await notificationService.markAllAsRead();

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/notifications/mark-all-read'
      );
      expect(result).toEqual({ updated: 10 });
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      await notificationService.deleteNotification('1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/notifications/1');
    });

    it('should handle notification not found error', async () => {
      mockAxiosInstance.delete.mockRejectedValue({
        response: {
          status: 404,
          data: { error: { message: 'Notification not found' } },
        },
      });

      await expect(
        notificationService.deleteNotification('999')
      ).rejects.toThrow(BusinessLogicError);
    });
  });

  describe('getPreferences', () => {
    it('should fetch notification preferences', async () => {
      const mockPreferences: NotificationPreferences = {
        email: {
          swapProposal: true,
          swapAccepted: true,
          swapRejected: false,
          swapCompleted: true,
          swapExpired: false,
          bookingReminder: true,
          systemUpdate: false,
        },
        push: {
          swapProposal: true,
          swapAccepted: true,
          swapRejected: true,
          swapCompleted: true,
          swapExpired: true,
          bookingReminder: false,
          systemUpdate: false,
        },
        inApp: {
          swapProposal: true,
          swapAccepted: true,
          swapRejected: true,
          swapCompleted: true,
          swapExpired: true,
          bookingReminder: true,
          systemUpdate: true,
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockPreferences });

      const result = await notificationService.getPreferences();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/notifications/preferences'
      );
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      const preferences = {
        email: { swapProposal: false },
        push: { swapAccepted: true },
      };

      const updatedPreferences = { ...preferences };
      mockAxiosInstance.put.mockResolvedValue({ data: updatedPreferences });

      const result = await notificationService.updatePreferences(preferences);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/notifications/preferences',
        preferences
      );
      expect(result).toEqual(updatedPreferences);
    });

    it('should validate preferences before updating', async () => {
      const invalidPreferences = {
        email: { invalidType: true },
      };

      await expect(
        notificationService.updatePreferences(invalidPreferences as any)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('sendTestNotification', () => {
    it('should send test notification', async () => {
      const testData = {
        type: 'swap_proposal' as NotificationType,
        channels: ['email', 'push'],
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { sent: true } });

      const result = await notificationService.sendTestNotification(testData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/notifications/test',
        testData
      );
      expect(result).toEqual({ sent: true });
    });
  });

  describe('subscribeToWebPush', () => {
    it('should subscribe to web push notifications', async () => {
      const subscription = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/...',
        keys: {
          p256dh: 'key1',
          auth: 'key2',
        },
      };

      mockAxiosInstance.post.mockResolvedValue({ data: { subscribed: true } });

      const result = await notificationService.subscribeToWebPush(subscription);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/notifications/web-push/subscribe',
        {
          subscription,
        }
      );
      expect(result).toEqual({ subscribed: true });
    });
  });

  describe('unsubscribeFromWebPush', () => {
    it('should unsubscribe from web push notifications', async () => {
      const endpoint = 'https://fcm.googleapis.com/fcm/send/...';

      mockAxiosInstance.delete.mockResolvedValue({
        data: { unsubscribed: true },
      });

      const result = await notificationService.unsubscribeFromWebPush(endpoint);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        '/notifications/web-push/unsubscribe',
        {
          data: { endpoint },
        }
      );
      expect(result).toEqual({ unsubscribed: true });
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(notificationService.getNotifications()).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle validation errors', async () => {
      mockAxiosInstance.put.mockRejectedValue({
        response: {
          status: 400,
          data: {
            error: {
              code: ERROR_CODES.VALIDATION_ERROR,
              message: 'Invalid preferences format',
            },
          },
        },
      });

      await expect(notificationService.updatePreferences({})).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle unauthorized errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 401, data: { error: { message: 'Unauthorized' } } },
      });

      await expect(notificationService.getNotifications()).rejects.toThrow();
    });
  });

  describe('local notification management', () => {
    it('should request notification permission', async () => {
      // Mock Notification API
      const mockNotification = {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      };
      Object.defineProperty(window, 'Notification', {
        value: mockNotification,
        configurable: true,
      });

      const result = await notificationService.requestNotificationPermission();

      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(result).toBe('granted');
    });

    it('should show local notification', () => {
      const mockNotificationConstructor = vi.fn();
      Object.defineProperty(window, 'Notification', {
        value: mockNotificationConstructor,
        configurable: true,
      });

      notificationService.showLocalNotification('Test Title', {
        body: 'Test message',
        icon: '/icon.png',
      });

      expect(mockNotificationConstructor).toHaveBeenCalledWith('Test Title', {
        body: 'Test message',
        icon: '/icon.png',
      });
    });
  });
});
