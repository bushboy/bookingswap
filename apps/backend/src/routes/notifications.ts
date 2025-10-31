import { Router } from 'express';
import { NotificationController } from '../controllers/NotificationController';
import { AuthMiddleware } from '../middleware/auth';

export function createNotificationRoutes(
  notificationController: NotificationController,
  authMiddleware: AuthMiddleware
): Router {
  const router = Router();

  // Apply authentication middleware to all routes
  router.use(authMiddleware.requireAuth());

// Get user notifications
router.get('/', notificationController.getNotifications.bind(notificationController));

// Get unread notification count
router.get('/unread-count', notificationController.getUnreadCount.bind(notificationController));

// Mark notification as read
router.put('/:notificationId/read', notificationController.markAsRead.bind(notificationController));

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead.bind(notificationController));

  // Test notification endpoint (development only)
  router.post('/test', notificationController.testNotification.bind(notificationController));

  return router;
}