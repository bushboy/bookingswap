import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../index';
import { WALLET_CONFIG } from '../../../../tests/fixtures/wallet-config';

// Mock database and external services for integration tests
vi.mock('../database', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue({
    query: vi.fn(),
    connect: vi.fn(),
  }),
}));

vi.mock('../database/cache', () => ({
  createRedisConnection: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  }),
}));

vi.mock('../services/hedera/factory', () => ({
  createHederaService: vi.fn().mockReturnValue({
    submitTransaction: vi.fn(),
    createSmartContract: vi.fn(),
    executeContract: vi.fn(),
  }),
}));

vi.mock('../services/hedera/WalletService', () => ({
  WalletService: vi.fn().mockImplementation(() => ({
    verifySignature: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('../database/repositories/UserRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByWalletAddress: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
      profile: {
        preferences: { notifications: true },
      },
      verification: {
        level: 'basic',
        documents: [],
      },
      reputation: {
        score: 100,
        completedSwaps: 0,
        cancelledSwaps: 0,
        reviews: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    updateLastActive: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
      profile: {
        preferences: { notifications: true },
      },
      verification: {
        level: 'basic',
        documents: [],
      },
      reputation: {
        score: 100,
        completedSwaps: 0,
        cancelledSwaps: 0,
        reviews: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
      profile: {
        displayName: 'Updated Name',
        preferences: { notifications: false },
      },
      verification: {
        level: 'basic',
        documents: [],
      },
      reputation: {
        score: 100,
        completedSwaps: 0,
        cancelledSwaps: 0,
        reviews: [],
      },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  })),
}));

vi.mock('../database/repositories/BookingRepository', () => ({
  BookingRepository: vi.fn().mockImplementation(() => ({
    findByFilters: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../database/repositories/SwapRepository', () => ({
  SwapRepository: vi.fn().mockImplementation(() => ({
    findByFilters: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Authentication Integration Tests', () => {
  let app: Express;

  beforeAll(async () => {
    // Set test environment variables
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.NODE_ENV = 'test';

    app = await createApp();
  });

  afterAll(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
  });

  describe('Authentication Flow', () => {
    let authToken: string;

    it('should generate challenge message', async () => {
      const response = await request(app)
        .post('/api/auth/challenge')
        .send({ walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('walletAddress', WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);
      expect(response.body.message).toContain('Booking Swap Platform');
      expect(response.body.message).toContain(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);
    });

    it('should authenticate user with wallet signature', async () => {
      const signatureData = {
        message: 'Test challenge message',
        signature: 'test-signature',
        publicKey: 'test-public-key',
        walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(signatureData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresAt');
      expect(response.body.user.walletAddress).toBe(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);

      authToken = response.body.token;
    });

    it('should validate token and return user info', async () => {
      const response = await request(app)
        .get('/api/auth/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokenPayload');
      expect(response.body.user.walletAddress).toBe(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);
    });

    it('should refresh authentication token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('expiresAt');
      expect(typeof response.body.token).toBe('string');
      expect(response.body.token.length).toBeGreaterThan(0);
    });

    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.walletAddress).toBe(WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT);
    });

    it('should update user profile', async () => {
      const updateData = {
        displayName: 'Updated Name',
        preferences: { notifications: false },
      };

      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.profile.displayName).toBe('Updated Name');
      expect(response.body.user.profile.preferences.notifications).toBe(false);
    });

    it('should get user dashboard', async () => {
      const response = await request(app)
        .get('/api/users/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('recentActivity');
    });

    it('should get user statistics', async () => {
      const response = await request(app)
        .get('/api/users/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(response.body).toHaveProperty('statistics');
      expect(response.body).toHaveProperty('reputation');
      expect(response.body).toHaveProperty('verification');
    });

    it('should get user transaction history', async () => {
      const response = await request(app)
        .get('/api/users/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('swaps');
      expect(response.body).toHaveProperty('bookings');
      expect(response.body).toHaveProperty('pagination');
    });
  });

  describe('Authentication Errors', () => {
    it('should return 401 for missing token', async () => {
      await request(app)
        .get('/api/users/profile')
        .expect(401);
    });

    it('should return 401 for invalid token', async () => {
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return 400 for invalid challenge request', async () => {
      await request(app)
        .post('/api/auth/challenge')
        .send({})
        .expect(400);
    });

    it('should return 400 for invalid login request', async () => {
      await request(app)
        .post('/api/auth/login')
        .send({ message: 'incomplete data' })
        .expect(400);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment', 'test');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});