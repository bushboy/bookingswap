import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';
import { Pool } from 'pg';

// Mock database and services
vi.mock('../database/config', () => ({
  createDatabasePool: vi.fn(() => ({
    query: vi.fn(),
    end: vi.fn(),
  })),
  getDatabaseConfig: vi.fn(() => ({})),
}));

vi.mock('../database/cache/config', () => ({
  initializeCache: vi.fn(() => ({
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  })),
}));

vi.mock('../services/hedera/factory', () => ({
  createHederaService: vi.fn(() => ({
    submitTransaction: vi.fn(),
    queryTransaction: vi.fn(),
  })),
}));

describe('Notification API Integration Tests', () => {
  let app: any;
  let server: any;
  let authToken: string;

  beforeEach(async () => {
    const appResult = await createApp();
    app = appResult.app;
    server = appResult.server;

    // Mock authentication token
    authToken = 'Bearer mock-jwt-token';

    // Mock JWT verification
    vi.mock('jsonwebtoken', () => ({
      verify: vi.fn(() => ({ userId: 'test-user-id' })),
      sign: vi.fn(() => 'mock-jwt-token'),
    }));
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    vi.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return user notifications', async () => {
      // Mock database response
      const mockNotifications = [
        {
          id: 'notification-1',
          user_id: 'test-user-id',
          type: 'swap_proposal',
          title: 'New Swap Proposal',
          message: 'Someone wants to swap with you',
          channel: 'in_app',
          status: 'delivered',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: mockNotifications }) // notifications query
          .mockResolvedValueOnce({ rows: [{ count: '1' }] }), // count query
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.notifications).toHaveLength(1);
      expect(response.body.data.notifications[0].title).toBe('New Swap Proposal');
    });

    it('should handle pagination parameters', async () => {
      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      await request(app)
        .get('/api/notifications?limit=10&offset=20')
        .set('Authorization', authToken)
        .expect(200);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining(['test-user-id', 10, 20])
      );
    });

    it('should filter unread notifications only', async () => {
      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Authorization', authToken)
        .expect(200);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('read_at IS NULL'),
        expect.any(Array)
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/notifications')
        .expect(401);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [{ count: '5' }] }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.unreadCount).toBe(5);
    });
  });

  describe('PUT /api/notifications/:notificationId/read', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        id: 'notification-1',
        user_id: 'test-user-id',
        type: 'swap_proposal',
        title: 'Test',
        message: 'Test message',
        channel: 'in_app',
        status: 'delivered',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [mockNotification] }) // findById
          .mockResolvedValueOnce({ rowCount: 1 }), // update
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .put('/api/notifications/notification-1/read')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Notification marked as read');
    });

    it('should return 404 for non-existent notification', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValueOnce({ rows: [] }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      await request(app)
        .put('/api/notifications/non-existent/read')
        .set('Authorization', authToken)
        .expect(404);
    });

    it('should return 404 for unauthorized access', async () => {
      const mockNotification = {
        id: 'notification-1',
        user_id: 'different-user-id',
        type: 'swap_proposal',
        title: 'Test',
        message: 'Test message',
        channel: 'in_app',
        status: 'delivered',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockDb = {
        query: vi.fn().mockResolvedValueOnce({ rows: [mockNotification] }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      await request(app)
        .put('/api/notifications/notification-1/read')
        .set('Authorization', authToken)
        .expect(404);
    });
  });

  describe('PUT /api/notifications/read-all', () => {
    it('should mark all notifications as read', async () => {
      const mockDb = {
        query: vi.fn().mockResolvedValueOnce({ rowCount: 3 }),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .put('/api/notifications/read-all')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('All notifications marked as read');
    });
  });

  describe('POST /api/notifications/test', () => {
    it('should send test notification in development', async () => {
      // Set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const mockUser = {
        id: 'test-user-id',
        profile: {
          displayName: 'Test User',
          email: 'test@example.com',
          preferences: {
            notifications: {
              email: true,
              in_app: true,
              channels: {
                swap_proposal: ['email', 'in_app'],
              },
            },
          },
        },
      };

      const mockDb = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [mockUser] }) // findById
          .mockResolvedValueOnce({ rows: [{ id: 'notification-1' }] }), // create notification
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', authToken)
        .send({ type: 'swap_proposal' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test notification sent');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    it('should return 404 in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await request(app)
        .post('/api/notifications/test')
        .set('Authorization', authToken)
        .expect(404);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockDb = {
        query: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };

      vi.mocked(require('../database/config').createDatabasePool).mockReturnValue(mockDb);

      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve notifications');
    });
  });
});