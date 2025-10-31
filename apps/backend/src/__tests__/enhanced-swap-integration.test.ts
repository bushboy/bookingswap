import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../index';
import { 
  EnhancedCreateSwapRequest,
  CreateEnhancedProposalRequest,
  BookingType 
} from '@booking-swap/shared';

describe('Enhanced Swap Integration Tests', () => {
  let app: any;
  let server: any;
  let authToken: string;
  let testUserId: string;
  let testBookingId: string;

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

    console.log('Register response:', registerResponse.status, registerResponse.body);
    
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

    // Create a test booking
    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'hotel' as BookingType,
        title: 'Test Hotel Booking',
        description: 'A test hotel booking for integration tests',
        location: {
          city: 'Paris',
          country: 'France',
          address: '123 Test Street',
          coordinates: { lat: 48.8566, lng: 2.3522 }
        },
        dateRange: {
          checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000).toISOString()
        },
        originalPrice: 500,
        currency: 'EUR',
        bookingReference: 'TEST123',
        provider: 'booking.com'
      });

    testBookingId = bookingResponse.body.data.booking.id;
  });

  describe('Enhanced Swap Creation', () => {
    it('should create enhanced swap with first-match strategy', async () => {
      const swapRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Test Enhanced Swap',
        description: 'Testing enhanced swap creation',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false
        },
        acceptanceStrategy: {
          type: 'first_match'
        },
        swapPreferences: {
          preferredLocations: ['London', 'Berlin'],
          additionalRequirements: ['Same star rating']
        },
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(swapRequest);

      console.log('Response status:', response.status);
      console.log('Response body:', response.body);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.swap).toBeDefined();
      expect(response.body.data.swap.paymentTypes.bookingExchange).toBe(true);
      expect(response.body.data.swap.paymentTypes.cashPayment).toBe(false);
      expect(response.body.data.swap.acceptanceStrategy.type).toBe('first_match');
      expect(response.body.data.auction).toBeUndefined();
    });

    it('should create enhanced swap with auction strategy', async () => {
      const auctionEndDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      
      const swapRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Test Auction Swap',
        description: 'Testing auction swap creation',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200,
          preferredCashAmount: 400
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate,
          autoSelectHighest: false
        },
        auctionSettings: {
          endDate: auctionEndDate,
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 200,
          autoSelectAfterHours: 24
        },
        swapPreferences: {
          preferredLocations: ['Tokyo', 'Seoul'],
          additionalRequirements: ['Pet-friendly']
        },
        expirationDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(swapRequest);

      console.log('Auction response status:', response.status);
      console.log('Auction response body:', response.body);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.swap).toBeDefined();
      expect(response.body.data.auction).toBeDefined();
      expect(response.body.data.swap.paymentTypes.cashPayment).toBe(true);
      expect(response.body.data.swap.acceptanceStrategy.type).toBe('auction');
      expect(response.body.data.auction.status).toBe('active');
    });

    it('should validate payment type requirements', async () => {
      const invalidRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Invalid Swap',
        description: 'Testing validation',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: false // Both disabled - should fail
        },
        acceptanceStrategy: {
          type: 'first_match'
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate cash payment configuration', async () => {
      const invalidCashRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Invalid Cash Swap',
        description: 'Testing cash validation',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true
          // Missing minimumCashAmount
        },
        acceptanceStrategy: {
          type: 'first_match'
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidCashRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate auction timing requirements', async () => {
      // Create a booking with event date too close for auction
      const nearEventBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'hotel' as BookingType,
          title: 'Near Event Booking',
          description: 'Booking with event too close for auction',
          location: {
            city: 'London',
            country: 'UK',
            address: '456 Test Avenue',
            coordinates: { lat: 51.5074, lng: -0.1278 }
          },
          dateRange: {
            checkIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
            checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          originalPrice: 300,
          currency: 'GBP',
          bookingReference: 'NEAR123',
          provider: 'expedia.com'
        });

      const nearEventBookingId = nearEventBooking.body.data.booking.id;

      const invalidTimingRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: nearEventBookingId,
        title: 'Invalid Timing Swap',
        description: 'Testing auction timing validation',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: false,
          autoSelectAfterHours: 24
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidTimingRequest);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('auction');
    });
  });

  describe('Enhanced Proposal Creation', () => {
    let testSwapId: string;
    let testAuctionSwapId: string;

    beforeEach(async () => {
      // Create a test swap for proposals
      const swapRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Swap for Proposals',
        description: 'Testing proposal creation',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 150
        },
        acceptanceStrategy: {
          type: 'first_match'
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(swapRequest);

      testSwapId = swapResponse.body.data.swap.id;

      // Create an auction swap
      const auctionRequest: EnhancedCreateSwapRequest = {
        ...swapRequest,
        title: 'Auction Swap for Proposals',
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 150,
          autoSelectAfterHours: 24
        }
      };

      const auctionResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(auctionRequest);

      testAuctionSwapId = auctionResponse.body.data.swap.id;
    });

    it('should create booking proposal for first-match swap', async () => {
      // Create another booking to propose
      const proposalBooking = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'hotel' as BookingType,
          title: 'Proposal Booking',
          description: 'Booking to use in proposal',
          location: {
            city: 'Berlin',
            country: 'Germany',
            address: '789 Proposal Street',
            coordinates: { lat: 52.5200, lng: 13.4050 }
          },
          dateRange: {
            checkIn: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(),
            checkOut: new Date(Date.now() + 39 * 24 * 60 * 60 * 1000).toISOString()
          },
          originalPrice: 400,
          currency: 'EUR',
          bookingReference: 'PROP123',
          provider: 'airbnb.com'
        });

      const proposalBookingId = proposalBooking.body.data.booking.id;

      const proposalRequest: CreateEnhancedProposalRequest = {
        swapId: testSwapId,
        proposalType: 'booking',
        bookingId: proposalBookingId,
        message: 'Great booking exchange opportunity',
        conditions: ['Same quality level', 'Similar location']
      };

      const response = await request(app)
        .post(`/api/swaps/${testSwapId}/proposals/enhanced`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(proposalRequest);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
    });

    it('should create cash proposal for cash-enabled swap', async () => {
      const cashProposal: CreateEnhancedProposalRequest = {
        swapId: testSwapId,
        proposalType: 'cash',
        cashOffer: {
          amount: 200,
          currency: 'EUR',
          paymentMethodId: 'pm-test-123',
          escrowAgreement: true
        },
        message: 'Cash offer for your booking',
        conditions: []
      };

      const response = await request(app)
        .post(`/api/swaps/${testSwapId}/proposals/enhanced`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cashProposal);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.proposalId).toBeDefined();
    });

    it('should validate cash offer meets minimum amount', async () => {
      const lowCashProposal: CreateEnhancedProposalRequest = {
        swapId: testSwapId,
        proposalType: 'cash',
        cashOffer: {
          amount: 100, // Below minimum of 150
          currency: 'EUR',
          paymentMethodId: 'pm-test-123',
          escrowAgreement: true
        },
        message: 'Low cash offer',
        conditions: []
      };

      const response = await request(app)
        .post(`/api/swaps/${testSwapId}/proposals/enhanced`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(lowCashProposal);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('minimum');
    });
  });

  describe('Auction Workflow Integration', () => {
    let auctionSwapId: string;
    let auctionId: string;

    beforeEach(async () => {
      // Create auction swap
      const auctionRequest: EnhancedCreateSwapRequest = {
        sourceBookingId: testBookingId,
        title: 'Auction Integration Test',
        description: 'Testing full auction workflow',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 200,
          autoSelectAfterHours: 24
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
      };

      const response = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', `Bearer ${authToken}`)
        .send(auctionRequest);

      auctionSwapId = response.body.data.swap.id;
      auctionId = response.body.data.auction.id;
    });

    it('should handle complete auction workflow', async () => {
      // 1. Add multiple proposals to auction
      const cashProposal1: CreateEnhancedProposalRequest = {
        swapId: auctionSwapId,
        proposalType: 'cash',
        cashOffer: {
          amount: 250,
          currency: 'EUR',
          paymentMethodId: 'pm-test-1',
          escrowAgreement: true
        },
        message: 'First cash offer',
        conditions: []
      };

      const proposal1Response = await request(app)
        .post(`/api/swaps/${auctionSwapId}/proposals/enhanced`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cashProposal1);

      expect(proposal1Response.status).toBe(201);

      const cashProposal2: CreateEnhancedProposalRequest = {
        swapId: auctionSwapId,
        proposalType: 'cash',
        cashOffer: {
          amount: 300,
          currency: 'EUR',
          paymentMethodId: 'pm-test-2',
          escrowAgreement: true
        },
        message: 'Higher cash offer',
        conditions: []
      };

      const proposal2Response = await request(app)
        .post(`/api/swaps/${auctionSwapId}/proposals/enhanced`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(cashProposal2);

      expect(proposal2Response.status).toBe(201);

      // 2. Get auction details with proposals
      const auctionResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(auctionResponse.status).toBe(200);
      expect(auctionResponse.body.data.auction.proposals).toHaveLength(2);

      // 3. Select winning proposal
      const winnerProposalId = proposal2Response.body.data.proposalId;
      
      const selectWinnerResponse = await request(app)
        .put(`/api/auctions/${auctionId}/select-winner`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ proposalId: winnerProposalId });

      expect(selectWinnerResponse.status).toBe(200);
      expect(selectWinnerResponse.body.data.auction.winningProposalId).toBe(winnerProposalId);
    });
  });

  afterAll(async () => {
    // Close the server
    if (server) {
      server.close();
    }
  });
});