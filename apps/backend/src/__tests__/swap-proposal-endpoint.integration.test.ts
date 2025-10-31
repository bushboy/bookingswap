import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createApp } from '../index';
import { BookingType } from '@booking-swap/shared';
import { WALLET_CONFIG } from '../../../../tests/fixtures/wallet-config';

// Mock external dependencies for integration tests
vi.mock('../database', () => ({
  createDatabaseConnection: vi.fn().mockResolvedValue({
    query: vi.fn(),
    connect: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('../database/cache', () => ({
  createRedisConnection: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock('../services/hedera/factory', () => ({
  createHederaService: vi.fn().mockReturnValue({
    submitTransaction: vi.fn().mockResolvedValue({
      transactionId: 'test-tx-id',
      consensusTimestamp: '123456789.000000000',
    }),
    createSmartContract: vi.fn(),
    executeContract: vi.fn(),
  }),
}));

vi.mock('../services/hedera/WalletService', () => ({
  WalletService: vi.fn().mockImplementation(() => ({
    verifySignature: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock database repositories
vi.mock('../database/repositories/UserRepository', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findByWalletAddress: vi.fn(),
    create: vi.fn(),
    updateLastActive: vi.fn(),
    findById: vi.fn().mockResolvedValue({
      id: 'test-user-id',
      walletAddress: WALLET_CONFIG.PRIMARY_TESTNET_ACCOUNT,
      profile: { preferences: { notifications: true } },
      verification: { level: 'basic', documents: [] },
      reputation: { score: 100, completedSwaps: 0, cancelledSwaps: 0, reviews: [] },
      lastActiveAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    update: vi.fn(),
  })),
}));

vi.mock('../database/repositories/BookingRepository', () => ({
  BookingRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      id: 'test-booking-id',
      userId: 'test-user-id',
      type: 'hotel',
      title: 'Test Hotel Booking',
      description: 'A test hotel booking',
      location: {
        city: 'Paris',
        country: 'France',
        address: '123 Test Street',
        coordinates: { lat: 48.8566, lng: 2.3522 }
      },
      dateRange: {
        checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000)
      },
      originalPrice: 500,
      currency: 'EUR',
      bookingReference: 'TEST123',
      provider: 'booking.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findById: vi.fn().mockResolvedValue({
      id: 'test-booking-id',
      userId: 'test-user-id',
      type: 'hotel',
      title: 'Test Hotel Booking',
      description: 'A test hotel booking',
      location: {
        city: 'Paris',
        country: 'France',
        address: '123 Test Street',
        coordinates: { lat: 48.8566, lng: 2.3522 }
      },
      dateRange: {
        checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000)
      },
      originalPrice: 500,
      currency: 'EUR',
      bookingReference: 'TEST123',
      provider: 'booking.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('../database/repositories/SwapRepository', () => ({
  SwapRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      id: 'test-swap-id',
      sourceBookingId: 'source-booking-id',
      targetBookingId: 'target-booking-id',
      proposerId: 'test-user-id',
      status: 'pending',
      terms: {
        additionalPayment: 0,
        conditions: [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      timeline: {
        proposedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findById: vi.fn().mockResolvedValue({
      id: 'target-swap-id',
      sourceBookingId: 'target-booking-id',
      targetBookingId: null,
      proposerId: 'other-user-id',
      status: 'available',
      terms: {
        additionalPayment: 0,
        conditions: [],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      timeline: {
        proposedAt: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    findByUserId: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findExistingProposal: vi.fn().mockResolvedValue(null),
  })),
}));

describe('Swap Proposal Endpoint Integration Tests', () => {
  let app: Express;
  let server: any;
  let authToken: string;
  let testUserId: string;
  let sourceBookingId: string;
  let targetSwapId: string;

  beforeAll(async () => {
    // Initialize the app
    const appResult = await createApp();
    app = appResult.app;
    server = appResult.server;

    // Setup test user and authentication
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

    if (registerResponse.status === 201) {
      authToken = registerResponse.body.token || registerResponse.body.data?.token;
      testUserId = registerResponse.body.user?.id || registerResponse.body.data?.user?.id;
    } else {
      // Try to login if user already exists
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      authToken = loginResponse.body.token || loginResponse.body.data?.token;
      testUserId = loginResponse.body.user?.id || loginResponse.body.data?.user?.id;
    }

    // Create test bookings for proposals
    const sourceBookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'hotel' as BookingType,
        title: 'Source Hotel Booking',
        description: 'Source booking for proposal tests',
        location: {
          city: 'London',
          country: 'UK',
          address: '456 Source Street',
          coordinates: { lat: 51.5074, lng: -0.1278 }
        },
        dateRange: {
          checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString()
        },
        originalPrice: 400,
        currency: 'GBP',
        bookingReference: 'SOURCE123',
        provider: 'booking.com'
      });

    sourceBookingId = sourceBookingResponse.body.data?.booking?.id || 'source-booking-id';

    // Create a target swap for proposals
    const targetSwapResponse = await request(app)
      .post('/api/swaps')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sourceBookingId: sourceBookingId,
        targetBookingId: null, // Available for proposals
        terms: {
          additionalPayment: 0,
          conditions: ['Flexible dates'],
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

    targetSwapId = targetSwapResponse.body.data?.swap?.id || 'target-swap-id';
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe('POST /api/swaps/:id/proposals - Success Cases', () => {
    it('should create proposal successfully with valid data', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'I would like to propose a swap',
        conditions: ['Flexible check-in time', 'Same hotel chain'],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.proposalId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.swap).toBeDefined();
      expect(response.body.data.swap.proposerId).toBe(testUserId);
      expect(response.body.data.swap.terms.conditions).toEqual(proposalData.conditions);
    });

    it('should create proposal with minimal required data', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.swap.terms.conditions).toEqual([]);
    });

    it('should create proposal with blockchain transaction details', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'Blockchain proposal test',
        conditions: ['Same location'],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.blockchainTransaction).toBeDefined();
      expect(response.body.data.blockchainTransaction.transactionId).toBe('test-tx-id');
      expect(response.body.data.blockchainTransaction.consensusTimestamp).toBe('123456789.000000000');
    });

    it('should handle backward compatibility with bookingId field', async () => {
      const proposalData = {
        bookingId: 'legacy-booking-id', // Using legacy field name
        message: 'Legacy compatibility test',
        conditions: [],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
    });
  });

  describe('POST /api/swaps/:id/proposals - Authentication Errors', () => {
    it('should return 401 when no authentication token is provided', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .send(proposalData)
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toContain('authentication');
    });

    it('should return 401 when invalid authentication token is provided', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', 'Bearer invalid-token')
        .send(proposalData)
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when malformed authorization header is provided', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', 'InvalidFormat token')
        .send(proposalData)
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('POST /api/swaps/:id/proposals - Validation Errors', () => {
    it('should return 400 when sourceSwapId is missing', async () => {
      const proposalData = {
        message: 'Missing source swap ID',
        conditions: [],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('sourceSwapId');
    });

    it('should return 400 when agreedToTerms is false', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'Terms not agreed',
        conditions: [],
        agreedToTerms: false,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('TERMS_NOT_AGREED');
      expect(response.body.error.message).toContain('terms');
    });

    it('should return 400 when conditions is not an array', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'Invalid conditions',
        conditions: 'not-an-array',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_CONDITIONS');
      expect(response.body.error.message).toContain('conditions');
    });

    it('should return 400 when target swap ID is invalid format', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post('/api/swaps/invalid-uuid/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_TARGET_SWAP');
    });

    it('should return 400 when source swap ID is invalid format', async () => {
      const proposalData = {
        sourceSwapId: 'invalid-uuid',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_SOURCE_SWAP');
    });

    it('should return 400 when message exceeds maximum length', async () => {
      const longMessage = 'a'.repeat(1001); // Assuming 1000 char limit
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: longMessage,
        conditions: [],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('PROPOSAL_MESSAGE_TOO_LONG');
    });
  });

  describe('POST /api/swaps/:id/proposals - Business Logic Errors', () => {
    it('should return 404 when target swap does not exist', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock the repository to return null for non-existent swap
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/swaps/non-existent-swap-id/proposals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(404);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('SWAP_NOT_FOUND');
    });

    it('should return 409 when user already has a proposal for this swap', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock existing proposal
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.findExistingProposal.mockResolvedValueOnce({
        id: 'existing-proposal-id',
        sourceSwapId: 'source-swap-id',
        targetSwapId: targetSwapId,
        proposerId: testUserId,
        status: 'pending',
      });

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(409);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('EXISTING_PROPOSAL');
    });

    it('should return 403 when user tries to propose to their own swap', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock swap owned by the same user
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.findById.mockResolvedValueOnce({
        id: targetSwapId,
        proposerId: testUserId, // Same user as the one making the proposal
        status: 'available',
      });

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(403);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('USER_NOT_AUTHORIZED');
    });

    it('should return 400 when source swap is not available', async () => {
      const proposalData = {
        sourceSwapId: 'unavailable-swap-id',
        agreedToTerms: true,
      };

      // Mock unavailable source swap
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.findById
        .mockResolvedValueOnce({ // Target swap (first call)
          id: targetSwapId,
          proposerId: 'other-user-id',
          status: 'available',
        })
        .mockResolvedValueOnce({ // Source swap (second call)
          id: 'unavailable-swap-id',
          proposerId: testUserId,
          status: 'completed', // Not available for new proposals
        });

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('SWAP_NOT_AVAILABLE');
    });
  });

  describe('POST /api/swaps/:id/proposals - Rate Limiting', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock rate limiter to throw rate limit error
      const mockRateLimiter = vi.mocked(require('../utils/proposalErrorHandling').ProposalRateLimiter);
      mockRateLimiter.checkRateLimit.mockRejectedValueOnce({
        code: 'PROPOSAL_RATE_LIMIT_EXCEEDED',
        message: 'Too many proposal attempts',
        retryAfter: 60,
      });

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(429);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('PROPOSAL_RATE_LIMIT_EXCEEDED');
      expect(response.headers['retry-after']).toBe('60');
    });
  });

  describe('POST /api/swaps/:id/proposals - Database and Network Failures', () => {
    it('should return 500 when database connection fails', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock database connection failure
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.findById.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      expect(response.body.error.category).toBe('server');
    });

    it('should return 500 when blockchain service fails', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock blockchain service failure
      const mockHederaService = vi.mocked(require('../services/hedera/factory').createHederaService);
      mockHederaService().submitTransaction.mockRejectedValueOnce(new Error('Blockchain network error'));

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('BLOCKCHAIN_ERROR');
    });

    it('should handle timeout errors gracefully', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      // Mock timeout error
      const timeoutError = new Error('Request timeout') as any;
      timeoutError.code = 'TIMEOUT';

      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      mockSwapRepo.prototype.create.mockRejectedValueOnce(timeoutError);

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(500);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('REQUEST_TIMEOUT');
    });
  });

  describe('POST /api/swaps/:id/proposals - Response Format Consistency', () => {
    it('should return consistent success response format', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'Consistent format test',
        conditions: ['Test condition'],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      // Verify response structure
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('proposalId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('swap');
      expect(response.body.data.swap).toHaveProperty('id');
      expect(response.body.data.swap).toHaveProperty('proposerId');
      expect(response.body.data.swap).toHaveProperty('status');
      expect(response.body.data.swap).toHaveProperty('terms');
      expect(response.body.data.swap.terms).toHaveProperty('conditions');
      expect(response.body.data.swap.terms).toHaveProperty('expiresAt');

      // Verify optional blockchain transaction
      if (response.body.data.blockchainTransaction) {
        expect(response.body.data.blockchainTransaction).toHaveProperty('transactionId');
        expect(response.body.data.blockchainTransaction).toHaveProperty('consensusTimestamp');
      }
    });

    it('should return consistent error response format', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: false, // This will cause validation error
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(400);

      // Verify error response structure
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('category');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('requestId');
    });

    it('should include proper HTTP headers in responses', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('POST /api/swaps/:id/proposals - Edge Cases', () => {
    it('should handle very long valid UUID correctly', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      const proposalData = {
        sourceSwapId: validUuid,
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${validUuid}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle empty conditions array correctly', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        conditions: [],
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap.terms.conditions).toEqual([]);
    });

    it('should handle empty message string correctly', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: '',
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle maximum allowed conditions array', async () => {
      const maxConditions = Array.from({ length: 10 }, (_, i) => `Condition ${i + 1}`);
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        conditions: maxConditions,
        agreedToTerms: true,
      };

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap.terms.conditions).toEqual(maxConditions);
    });
  });

  describe('POST /api/swaps/:id/proposals - Complete Flow Integration', () => {
    it('should complete full proposal creation flow from request to database storage', async () => {
      const proposalData = {
        sourceSwapId: 'source-swap-id',
        message: 'Full integration test proposal',
        conditions: ['Same star rating', 'Pet-friendly'],
        agreedToTerms: true,
      };

      // Track all service calls
      const mockSwapRepo = vi.mocked(require('../database/repositories/SwapRepository').SwapRepository);
      const mockHederaService = vi.mocked(require('../services/hedera/factory').createHederaService);

      const response = await request(app)
        .post(`/api/swaps/${targetSwapId}/proposals`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalData)
        .expect(201);

      // Verify the complete flow
      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
      expect(response.body.data.status).toBe('pending');

      // Verify database interactions
      expect(mockSwapRepo.prototype.findById).toHaveBeenCalled();
      expect(mockSwapRepo.prototype.create).toHaveBeenCalled();

      // Verify blockchain interaction
      expect(mockHederaService().submitTransaction).toHaveBeenCalled();

      // Verify response contains all expected data
      expect(response.body.data.swap.terms.conditions).toEqual(proposalData.conditions);
      expect(response.body.data.blockchainTransaction.transactionId).toBe('test-tx-id');
    });
  });
});