import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { SwapController } from '../controllers/SwapController';
import { createSwapRoutes } from '../routes/swaps';
import { createAuctionRoutes } from '../routes/auctions';
import { createPaymentRoutes } from '../routes/payments';
import { AuthMiddleware } from '../middleware/auth';

// Mock services
const mockSwapProposalService = {
  createEnhancedSwapProposal: vi.fn(),
  createEnhancedProposal: vi.fn(),
};

const mockSwapResponseService = {
  // Mock methods as needed
};

const mockAuctionService = {
  getAuctionById: vi.fn(),
  getAuctionProposals: vi.fn(),
  submitProposal: vi.fn(),
  selectWinningProposal: vi.fn(),
  getUserAuctions: vi.fn(),
};

const mockPaymentService = {
  createEscrow: vi.fn(),
  releaseEscrow: vi.fn(),
  getTransactionStatus: vi.fn(),
  generateReceipt: vi.fn(),
};

const mockAuthMiddleware = {
  requireAuth: () => (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id', isAdmin: false };
    next();
  },
};

describe('Enhanced Swap Endpoints', () => {
  let app: express.Application;
  let swapController: SwapController;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    swapController = new SwapController(
      mockSwapProposalService as any,
      mockSwapResponseService as any,
      mockAuctionService as any,
      mockPaymentService as any
    );

    // Mount routes
    app.use('/api/swaps', createSwapRoutes(swapController, mockAuthMiddleware as any));
    app.use('/api/auctions', createAuctionRoutes(swapController, mockAuthMiddleware as any));
    app.use('/api/payments', createPaymentRoutes(swapController, mockAuthMiddleware as any));

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('POST /api/swaps/enhanced', () => {
    it('should create enhanced swap with valid data', async () => {
      const mockResult = {
        swap: { id: 'swap-123', status: 'pending' },
        auction: null,
        validationWarnings: [],
      };

      mockSwapProposalService.createEnhancedSwapProposal.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .send({
          sourceBookingId: 'booking-123',
          title: 'Test Swap',
          description: 'Test Description',
          paymentTypes: {
            bookingExchange: true,
            cashPayment: true,
            minimumCashAmount: 100,
          },
          acceptanceStrategy: {
            type: 'first_match',
          },
          swapPreferences: {},
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.swap).toBeDefined();
      expect(mockSwapProposalService.createEnhancedSwapProposal).toHaveBeenCalledOnce();
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/swaps/enhanced')
        .send({
          sourceBookingId: 'booking-123',
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid payment types', async () => {
      const response = await request(app)
        .post('/api/swaps/enhanced')
        .send({
          sourceBookingId: 'booking-123',
          title: 'Test Swap',
          description: 'Test Description',
          paymentTypes: {
            bookingExchange: false,
            cashPayment: false, // Both disabled
          },
          acceptanceStrategy: {
            type: 'first_match',
          },
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auctions/:id', () => {
    it('should return auction details for authorized user', async () => {
      const mockAuction = {
        id: 'auction-123',
        ownerId: 'test-user-id',
        status: 'active',
        settings: {
          endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
        },
        proposals: [],
      };

      mockAuctionService.getAuctionById.mockResolvedValue(mockAuction);
      mockAuctionService.getAuctionProposals.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auctions/auction-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.auction).toBeDefined();
      expect(response.body.data.timeRemaining).toBeDefined();
    });

    it('should return 404 for non-existent auction', async () => {
      mockAuctionService.getAuctionById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auctions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('AUCTION_NOT_FOUND');
    });
  });

  describe('POST /api/payments/cash-offer', () => {
    it('should submit cash offer with valid data', async () => {
      const mockResult = {
        proposalId: 'proposal-123',
        validationResult: { isValid: true, errors: [], warnings: [] },
        requiresAuctionSubmission: false,
      };

      mockSwapProposalService.createEnhancedProposal.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/payments/cash-offer')
        .send({
          swapId: 'swap-123',
          amount: 200,
          currency: 'USD',
          paymentMethodId: 'pm-123',
          escrowAgreement: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/api/payments/cash-offer')
        .send({
          swapId: 'swap-123',
          amount: -100, // Invalid negative amount
          currency: 'USD',
          paymentMethodId: 'pm-123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/payments/escrow', () => {
    it('should create escrow account with valid data', async () => {
      const mockEscrowResult = {
        escrowId: 'escrow-123',
        status: 'created',
        amount: 500,
        currency: 'USD',
      };

      mockPaymentService.createEscrow.mockResolvedValue(mockEscrowResult);

      const response = await request(app)
        .post('/api/payments/escrow')
        .send({
          amount: 500,
          currency: 'USD',
          recipientId: 'recipient-123',
          swapId: 'swap-123',
          proposalId: 'proposal-123',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.escrow).toBeDefined();
    });
  });
});