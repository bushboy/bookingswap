import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { SwapController } from '../controllers/SwapController';
import { createSwapRoutes } from '../routes/swaps';

// Mock the swap services for testing
const mockSwapProposalService = {
  createSwapProposal: vi.fn(),
  getUserSwapProposals: vi.fn(),
  getSwapProposalById: vi.fn(),
  cancelSwapProposal: vi.fn(),
  getPendingProposalsForBooking: vi.fn(),
};

const mockSwapResponseService = {
  acceptSwapProposal: vi.fn(),
  rejectSwapProposal: vi.fn(),
  getUserSwapResponses: vi.fn(),
};

// Mock auth middleware
const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', isAdmin: false };
    next();
  },
};

describe('Swap Operations API Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Create test app with mocked dependencies
    app = express();
    app.use(express.json());
    
    const swapController = new SwapController(
      mockSwapProposalService as any,
      mockSwapResponseService as any
    );
    const authMiddleware = mockAuthMiddleware as any;
    
    app.use('/api/swaps', createSwapRoutes(swapController, authMiddleware));
  });

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('POST /api/swaps', () => {
    it('should create a new swap proposal', async () => {
      const swapData = {
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        terms: {
          additionalPayment: 50,
          conditions: ['Flexible dates', 'Same hotel chain'],
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        },
      };

      const mockResult = {
        swap: {
          id: 'test-swap-id',
          sourceBookingId: swapData.sourceBookingId,
          targetBookingId: swapData.targetBookingId,
          proposerId: 'test-user-id',
          status: 'pending',
          terms: swapData.terms,
        },
        blockchainTransaction: {
          transactionId: 'test-tx-id',
          consensusTimestamp: '123456789.000000000',
        },
      };

      mockSwapProposalService.createSwapProposal.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/swaps')
        .send(swapData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap).toBeDefined();
      expect(response.body.data.swap.sourceBookingId).toBe(swapData.sourceBookingId);
      expect(response.body.data.swap.targetBookingId).toBe(swapData.targetBookingId);
      expect(response.body.data.swap.status).toBe('pending');
      expect(response.body.data.blockchain).toBeDefined();
      expect(mockSwapProposalService.createSwapProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceBookingId: swapData.sourceBookingId,
          targetBookingId: swapData.targetBookingId,
          proposerId: 'test-user-id',
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteSwapData = {
        sourceBookingId: 'source-booking-id',
        // Missing targetBookingId and terms
      };

      const response = await request(app)
        .post('/api/swaps')
        .send(incompleteSwapData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Missing required fields: sourceBookingId, targetBookingId, terms');
    });

    it('should return 400 for missing expiresAt in terms', async () => {
      const invalidSwapData = {
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        terms: {
          additionalPayment: 50,
          conditions: ['Flexible dates'],
          // Missing expiresAt
        },
      };

      const response = await request(app)
        .post('/api/swaps')
        .send(invalidSwapData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Terms must include expiresAt date');
    });

    it('should return 400 for past expiration date', async () => {
      const invalidSwapData = {
        sourceBookingId: 'source-booking-id',
        targetBookingId: 'target-booking-id',
        terms: {
          additionalPayment: 50,
          conditions: ['Flexible dates'],
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        },
      };

      const response = await request(app)
        .post('/api/swaps')
        .send(invalidSwapData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Expiration date must be in the future');
    });
  });

  describe('GET /api/swaps', () => {
    it('should return user swaps without status filter', async () => {
      const mockSwaps = [
        {
          id: 'swap-1',
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          status: 'pending',
        },
        {
          id: 'swap-2',
          sourceBookingId: 'booking-3',
          targetBookingId: 'booking-4',
          status: 'accepted',
        },
      ];

      mockSwapProposalService.getUserSwapProposals.mockResolvedValue(mockSwaps);

      const response = await request(app)
        .get('/api/swaps')
        .query({
          limit: 10,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swaps).toEqual(mockSwaps);
      expect(response.body.data.pagination).toBeDefined();
      expect(mockSwapProposalService.getUserSwapProposals).toHaveBeenCalledWith(
        'test-user-id',
        10,
        0
      );
    });

    it('should return user swaps with status filter', async () => {
      const mockSwaps = [
        {
          id: 'swap-1',
          sourceBookingId: 'booking-1',
          targetBookingId: 'booking-2',
          status: 'pending',
        },
      ];

      mockSwapResponseService.getUserSwapResponses.mockResolvedValue(mockSwaps);

      const response = await request(app)
        .get('/api/swaps')
        .query({
          status: 'pending',
          limit: 10,
          offset: 0,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swaps).toEqual(mockSwaps);
      expect(mockSwapResponseService.getUserSwapResponses).toHaveBeenCalledWith(
        'test-user-id',
        'pending',
        10,
        0
      );
    });
  });

  describe('GET /api/swaps/:id', () => {
    it('should return swap by ID for authorized user', async () => {
      const mockSwap = {
        id: 'test-swap-id',
        sourceBookingId: 'booking-1',
        targetBookingId: 'booking-2',
        proposerId: 'test-user-id',
        ownerId: 'other-user-id',
        status: 'pending',
      };

      mockSwapProposalService.getSwapProposalById.mockResolvedValue(mockSwap);

      const response = await request(app)
        .get('/api/swaps/test-swap-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap).toEqual(mockSwap);
      expect(mockSwapProposalService.getSwapProposalById).toHaveBeenCalledWith('test-swap-id');
    });

    it('should return 404 for non-existent swap', async () => {
      mockSwapProposalService.getSwapProposalById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/swaps/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('SWAP_NOT_FOUND');
    });

    it('should return 403 for unauthorized access', async () => {
      const mockSwap = {
        id: 'test-swap-id',
        proposerId: 'other-user-1',
        ownerId: 'other-user-2',
        status: 'pending',
      };

      mockSwapProposalService.getSwapProposalById.mockResolvedValue(mockSwap);

      const response = await request(app)
        .get('/api/swaps/test-swap-id')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/swaps/:id/accept', () => {
    it('should accept a swap proposal', async () => {
      const mockResult = {
        swap: {
          id: 'test-swap-id',
          status: 'accepted',
          timeline: {
            proposedAt: new Date(),
            respondedAt: new Date(),
          },
        },
        blockchainTransaction: {
          transactionId: 'accept-tx-id',
          consensusTimestamp: '123456790.000000000',
        },
      };

      mockSwapResponseService.acceptSwapProposal.mockResolvedValue(mockResult);

      const response = await request(app)
        .put('/api/swaps/test-swap-id/accept')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap.status).toBe('accepted');
      expect(response.body.data.blockchain).toBeDefined();
      expect(mockSwapResponseService.acceptSwapProposal).toHaveBeenCalledWith({
        swapId: 'test-swap-id',
        userId: 'test-user-id',
        response: 'accept',
      });
    });

    it('should return 404 for non-existent swap', async () => {
      mockSwapResponseService.acceptSwapProposal.mockRejectedValue(
        new Error('Swap proposal not found')
      );

      const response = await request(app)
        .put('/api/swaps/non-existent-id/accept')
        .expect(404);

      expect(response.body.error.code).toBe('SWAP_ACCEPTANCE_FAILED');
    });
  });

  describe('PUT /api/swaps/:id/reject', () => {
    it('should reject a swap proposal', async () => {
      const mockResult = {
        swap: {
          id: 'test-swap-id',
          status: 'rejected',
          timeline: {
            proposedAt: new Date(),
            respondedAt: new Date(),
          },
        },
        blockchainTransaction: {
          transactionId: 'reject-tx-id',
          consensusTimestamp: '123456791.000000000',
        },
      };

      mockSwapResponseService.rejectSwapProposal.mockResolvedValue(mockResult);

      const response = await request(app)
        .put('/api/swaps/test-swap-id/reject')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap.status).toBe('rejected');
      expect(response.body.data.blockchain).toBeDefined();
      expect(mockSwapResponseService.rejectSwapProposal).toHaveBeenCalledWith({
        swapId: 'test-swap-id',
        userId: 'test-user-id',
        response: 'reject',
      });
    });
  });

  describe('DELETE /api/swaps/:id', () => {
    it('should cancel a swap proposal', async () => {
      const mockCancelledSwap = {
        id: 'test-swap-id',
        status: 'cancelled',
        proposerId: 'test-user-id',
      };

      mockSwapProposalService.cancelSwapProposal.mockResolvedValue(mockCancelledSwap);

      const response = await request(app)
        .delete('/api/swaps/test-swap-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swap.status).toBe('cancelled');
      expect(mockSwapProposalService.cancelSwapProposal).toHaveBeenCalledWith(
        'test-swap-id',
        'test-user-id'
      );
    });

    it('should return 404 for non-existent swap', async () => {
      mockSwapProposalService.cancelSwapProposal.mockRejectedValue(
        new Error('Swap proposal not found')
      );

      const response = await request(app)
        .delete('/api/swaps/non-existent-id')
        .expect(404);

      expect(response.body.error.code).toBe('SWAP_CANCELLATION_FAILED');
    });
  });

  describe('GET /api/swaps/:id/status', () => {
    it('should return swap status for authorized user', async () => {
      const mockSwap = {
        id: 'test-swap-id',
        proposerId: 'test-user-id',
        ownerId: 'other-user-id',
        status: 'pending',
        timeline: {
          proposedAt: new Date(),
        },
        blockchain: {
          proposalTransactionId: 'proposal-tx-id',
        },
        terms: {
          additionalPayment: 50,
          conditions: ['Flexible dates'],
          expiresAt: new Date(),
        },
      };

      mockSwapProposalService.getSwapProposalById.mockResolvedValue(mockSwap);

      const response = await request(app)
        .get('/api/swaps/test-swap-id/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.swapId).toBe('test-swap-id');
      expect(response.body.data.status).toBe('pending');
      expect(response.body.data.timeline).toBeDefined();
      expect(response.body.data.blockchain).toBeDefined();
      expect(response.body.data.terms).toBeDefined();
    });

    it('should return 403 for unauthorized access to status', async () => {
      const mockSwap = {
        id: 'test-swap-id',
        proposerId: 'other-user-1',
        ownerId: 'other-user-2',
        status: 'pending',
      };

      mockSwapProposalService.getSwapProposalById.mockResolvedValue(mockSwap);

      const response = await request(app)
        .get('/api/swaps/test-swap-id/status')
        .expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/swaps/booking/:bookingId/proposals', () => {
    it('should return pending proposals for a booking', async () => {
      const mockProposals = [
        {
          id: 'proposal-1',
          sourceBookingId: 'other-booking-1',
          targetBookingId: 'target-booking-id',
          status: 'pending',
        },
        {
          id: 'proposal-2',
          sourceBookingId: 'other-booking-2',
          targetBookingId: 'target-booking-id',
          status: 'pending',
        },
      ];

      mockSwapProposalService.getPendingProposalsForBooking.mockResolvedValue(mockProposals);

      const response = await request(app)
        .get('/api/swaps/booking/target-booking-id/proposals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookingId).toBe('target-booking-id');
      expect(response.body.data.proposals).toEqual(mockProposals);
      expect(response.body.data.count).toBe(2);
      expect(mockSwapProposalService.getPendingProposalsForBooking).toHaveBeenCalledWith(
        'target-booking-id'
      );
    });

    it('should return empty array for booking with no proposals', async () => {
      mockSwapProposalService.getPendingProposalsForBooking.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/swaps/booking/no-proposals-booking/proposals')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.proposals).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });
  });
});