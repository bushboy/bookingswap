import { Pool } from 'pg';
import { 
  Notification, 
  NotificationType, 
  NotificationChannel, 
  NotificationStatus,
  NotificationData 
} from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export class NotificationRepository {
  constructor(private db: Pool) {}

  async create(notification: Omit<Notification, 'id' | 'createdAt' | 'updatedAt'>): Promise<Notification> {
    const query = `
      INSERT INTO notifications (
        user_id, type, title, message, data, channel, status, 
        sent_at, delivered_at, read_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      notification.userId,
      notification.type,
      notification.title,
      notification.message,
      JSON.stringify(notification.data || {}),
      notification.channel,
      notification.status,
      notification.sentAt,
      notification.deliveredAt,
      notification.readAt,
      notification.expiresAt,
    ];

    try {
      const result = await this.db.query(query, values);
      return this.mapRowToNotification(result.rows[0]);
    } catch (error) {
      logger.error('Failed to create notification', { error, notification });
      throw error;
    }
  }

  async findById(id: string): Promise<Notification | null> {
    const query = 'SELECT * FROM notifications WHERE id = $1';
    
    try {
      const result = await this.db.query(query, [id]);
      return result.rows[0] ? this.mapRowToNotification(result.rows[0]) : null;
    } catch (error) {
      logger.error('Failed to find notification by id', { error, id });
      throw error;
    }
  }

  async findByUserId(
    userId: string, 
    options: {
      limit?: number;
      offset?: number;
      status?: NotificationStatus;
      type?: NotificationType;
      unreadOnly?: boolean;
    } = {}
  ): Promise<{ notifications: Notification[]; total: number }> {
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
    const values: any[] = [userId];
    let paramIndex = 2;

    // Add filters
    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${paramIndex}`;
      values.push(options.status);
      paramIndex++;
    }

    if (options.type) {
      query += ` AND type = $${paramIndex}`;
      countQuery += ` AND type = $${paramIndex}`;
      values.push(options.type);
      paramIndex++;
    }

    if (options.unreadOnly) {
      query += ` AND read_at IS NULL`;
      countQuery += ` AND read_at IS NULL`;
    }

    // Add ordering and pagination
    query += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(options.limit);
      paramIndex++;
    }

    if (options.offset) {
      query += ` OFFSET $${paramIndex}`;
      values.push(options.offset);
    }

    try {
      const [notificationsResult, countResult] = await Promise.all([
        this.db.query(query, values),
        this.db.query(countQuery, values.slice(0, paramIndex - (options.limit ? 1 : 0) - (options.offset ? 1 : 0)))
      ]);

      return {
        notifications: notificationsResult.rows.map(this.mapRowToNotification),
        total: parseInt(countResult.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to find notifications by user id', { error, userId, options });
      throw error;
    }
  }

  async updateStatus(id: string, status: NotificationStatus, timestamp?: Date): Promise<void> {
    let query = 'UPDATE notifications SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const values: any[] = [status];
    let paramIndex = 2;

    // Set appropriate timestamp based on status
    if (status === 'sent' && timestamp) {
      query += `, sent_at = $${paramIndex}`;
      values.push(timestamp);
      paramIndex++;
    } else if (status === 'delivered' && timestamp) {
      query += `, delivered_at = $${paramIndex}`;
      values.push(timestamp);
      paramIndex++;
    } else if (status === 'read' && timestamp) {
      query += `, read_at = $${paramIndex}`;
      values.push(timestamp);
      paramIndex++;
    }

    query += ` WHERE id = $${paramIndex}`;
    values.push(id);

    try {
      await this.db.query(query, values);
      logger.info('Notification status updated', { id, status });
    } catch (error) {
      logger.error('Failed to update notification status', { error, id, status });
      throw error;
    }
  }

  async markAsRead(id: string): Promise<void> {
    await this.updateStatus(id, 'read', new Date());
  }

  async markAllAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE notifications 
      SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND read_at IS NULL
    `;

    try {
      const result = await this.db.query(query, [userId]);
      logger.info('All notifications marked as read', { userId, count: result.rowCount });
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error, userId });
      throw error;
    }
  }

  async deleteExpired(): Promise<number> {
    const query = `
      DELETE FROM notifications 
      WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
    `;

    try {
      const result = await this.db.query(query);
      const deletedCount = result.rowCount || 0;
      logger.info('Expired notifications deleted', { count: deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to delete expired notifications', { error });
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    const query = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL';
    
    try {
      const result = await this.db.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId });
      throw error;
    }
  }

  private mapRowToNotification(row: any): Notification {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data ? JSON.parse(row.data) : undefined,
      channel: row.channel,
      status: row.status,
      sentAt: row.sent_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}