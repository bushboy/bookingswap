import { Request, Response } from 'express';
import { NotificationService } from '../services/notification';
import { logger } from '../utils/logger';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  /**
   * Get user notifications with pagination
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { 
        limit = 20, 
        offset = 0, 
        unreadOnly = false 
      } = req.query;

      const result = await this.notificationService.getUserNotifications(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        unreadOnly: unreadOnly === 'true'
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to get notifications', { error, userId: (req as any).user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve notifications'
      });
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      
      const result = await this.notificationService.getUserNotifications(userId, {
        limit: 0,
        unreadOnly: true
      });

      res.json({
        success: true,
        data: {
          unreadCount: result.unreadCount
        }
      });
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId: (req as any).user?.userId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve unread count'
      });
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;
      const { notificationId } = req.params;

      await this.notificationService.markAsRead(notificationId, userId);

      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Failed to mark notification as read', { 
        error, 
        userId: (req as any).user?.userId,
        notificationId: req.params.notificationId
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to mark notification as read'
        });
      }
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user.userId;

      await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { 
        error, 
        userId: (req as any).user?.userId 
      });
      res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read'
      });
    }
  }

  /**
   * Test notification endpoint (development only)
   */
  async testNotification(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }

    try {
      const userId = (req as any).user.userId;
      const { type = 'swap_proposal' } = req.body;

      await this.notificationService.sendNotification(type, userId, {
        swapId: 'test-swap-123',
        sourceBookingTitle: 'Test Hotel Booking',
        targetBookingTitle: 'Test Event Ticket',
        sourceBookingLocation: 'New York, NY',
        targetBookingLocation: 'Los Angeles, CA',
        dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`,
        recipientName: 'Test User'
      });

      res.json({
        success: true,
        message: 'Test notification sent'
      });
    } catch (error) {
      logger.error('Failed to send test notification', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to send test notification'
      });
    }
  }
}