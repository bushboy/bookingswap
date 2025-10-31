import axios from 'axios';
import { Notification } from '@booking-swap/shared';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export class NotificationService {
  private static instance: NotificationService;
  private baseURL: string;

  private constructor() {
    this.baseURL = `${API_BASE_URL}/notifications`;
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async getNotifications(
    options: {
      limit?: number;
      offset?: number;
      unreadOnly?: boolean;
    } = {}
  ): Promise<NotificationListResponse> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.unreadOnly) params.append('unreadOnly', 'true');

      const response = await axios.get(`${this.baseURL}?${params.toString()}`, {
        headers: this.getAuthHeaders(),
      });

      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      throw error;
    }
  }

  async getUnreadCount(): Promise<number> {
    try {
      const response = await axios.get(`${this.baseURL}/unread-count`, {
        headers: this.getAuthHeaders(),
      });

      return response.data.data.unreadCount;
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await axios.put(
        `${this.baseURL}/${notificationId}/read`,
        {},
        {
          headers: this.getAuthHeaders(),
        }
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<void> {
    try {
      await axios.put(
        `${this.baseURL}/read-all`,
        {},
        {
          headers: this.getAuthHeaders(),
        }
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      throw error;
    }
  }

  async sendTestNotification(type: string = 'swap_proposal'): Promise<void> {
    try {
      await axios.post(
        `${this.baseURL}/test`,
        { type },
        {
          headers: this.getAuthHeaders(),
        }
      );
    } catch (error) {
      console.error('Failed to send test notification:', error);
      throw error;
    }
  }

  // Helper method to format notification time
  static formatNotificationTime(date: Date | string): string {
    const notificationDate = new Date(date);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - notificationDate.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      // 24 hours
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  }

  // Helper method to get notification icon based on type
  static getNotificationIcon(type: string): string {
    const icons: Record<string, string> = {
      swap_proposal: '🔄',
      swap_accepted: '✅',
      swap_rejected: '❌',
      swap_expired: '⏰',
      swap_cancelled: '🚫',
      booking_verified: '✓',
      booking_expired: '⏰',
      proposal_accepted: '🎉',
      proposal_rejected: '❌',
      proposal_payment_completed: '💰',
      proposal_payment_failed: '⚠️',
      payment_processing: '⏳',
      payment_completed: '💰',
      payment_failed: '⚠️',
    };
    return icons[type] || '📢';
  }

  // Helper method to get notification color based on type
  static getNotificationColor(type: string): string {
    const colors: Record<string, string> = {
      swap_proposal: 'blue',
      swap_accepted: 'green',
      swap_rejected: 'red',
      swap_expired: 'orange',
      swap_cancelled: 'gray',
      booking_verified: 'green',
      booking_expired: 'orange',
      proposal_accepted: 'green',
      proposal_rejected: 'red',
      proposal_payment_completed: 'green',
      proposal_payment_failed: 'red',
      payment_processing: 'blue',
      payment_completed: 'green',
      payment_failed: 'red',
    };
    return colors[type] || 'gray';
  }
}
