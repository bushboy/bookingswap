import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from '../database/setup';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { AuctionRepository } from '../database/repositories/AuctionRepository';
import { BookingRepository } from '../database/repositories/BookingRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { PaymentRepository } from '../database/repositories/PaymentRepository';
import { 
  EnhancedSwap,
  SwapAuction,
  AuctionProposal,
  Booking,
  User,
  PaymentMethod
} from '@booking-swap/shared';

// Mock external services
vi.mock('../services/hedera/HederaService');
vi.mock('../services/notification/NotificationService');

describe('Auction Workflow Integration Tests', () => {
  let swapRepository: SwapRepository;
  let auctionRepository: AuctionRepository;
  let bookingRepository: BookingRepository;
  let userRepository: UserRepository;
  let paymentRepository: PaymentRepository;
  
  let testUser1: User;
  let testUser2: User;
  let testUser3: User;
  let testBooking1: Booking;
  let testBooking2: Booking;
  let testBooking3: Booking;
  let authToken1: string;
  let authToken2: string;
  let authToken3: string;

  beforeEach(async () => {
    await setupTestDatabase();
    
    // Initialize repositories
    swapRepository = new SwapRepository();
    auctionRepository = new AuctionRepository();
    bookingRepository = new BookingRepository();
    userRepository = new UserRepository();
    paymentRepository = new PaymentRepository();
    
    // Create test users
    testUser1 = await userRepository.create({
      email: 'user1@test.com',
      password: 'hashedpassword1',
      firstName: 'User',
      lastName: 'One',
      isVerified: true,
    });
    
    testUser2 = await userRepository.create({
      email: 'user2@test.com',
      password: 'hashedpassword2',
      firstName: 'User',
      lastName: 'Two',
      isVerified: true,
    });
    
    testUser3 = await userRepository.create({
      email: 'user3@test.com',
      password: 'hashedpassword3',
      firstName: 'User',
      lastName: 'Three',
      isVerified: true,
    });
    
    // Create test bookings
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30); // 30 days from now
    
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 35); // 35 days from now
    
    const futureDate3 = new Date();
    futureDate3.setDate(futureDate3.getDate() + 40); // 40 days from now
    
    testBooking1 = await bookingRepository.create({
      userId: testUser1.id,
      type: 'hotel',
      title: 'Paris Hotel',
      description: 'Luxury hotel in Paris',
      location: { city: 'Paris', country: 'France' },
      dateRange: {
        checkIn: futureDate1,
        checkOut: new Date(futureDate1.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'booking.com',
        confirmationNumber: 'PAR123',
        bookingReference: 'REF123',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { topicId: 'topic-123' },
      status: 'available',
    });
    
    testBooking2 = await bookingRepository.create({
      userId: testUser2.id,
      type: 'hotel',
      title: 'London Hotel',
      description: 'Boutique hotel in London',
      location: { city: 'London', country: 'UK' },
      dateRange: {
        checkIn: futureDate2,
        checkOut: new Date(futureDate2.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      originalPrice: 400,
      swapValue: 380,
      providerDetails: {
        provider: 'expedia.com',
        confirmationNumber: 'LON456',
        bookingReference: 'REF456',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { topicId: 'topic-456' },
      status: 'available',
    });
    
    testBooking3 = await bookingRepository.create({
      userId: testUser3.id,
      type: 'hotel',
      title: 'Rome Hotel',
      description: 'Historic hotel in Rome',
      location: { city: 'Rome', country: 'Italy' },
      dateRange: {
        checkIn: futureDate3,
        checkOut: new Date(futureDate3.getTime() + 5 * 24 * 60 * 60 * 1000),
      },
      originalPrice: 600,
      swapValue: 550,
      providerDetails: {
        provider: 'hotels.com',
        confirmationNumber: 'ROM789',
        bookingReference: 'REF789',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { topicId: 'topic-789' },
      status: 'available',
    });
    
    // Generate auth tokens (mock JWT tokens for testing)
    authToken1 = `Bearer test-token-${testUser1.id}`;
    authToken2 = `Bearer test-token-${testUser2.id}`;
    authToken3 = `Bearer test-token-${testUser3.id}`;
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('End-to-End Auction Creation and Completion', () => {
    it('should complete full auction workflow with booking proposals', async () => {
      // Step 1: Create enhanced swap with auction mode
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Paris Hotel Auction Swap',
        description: 'Auctioning my Paris hotel booking',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false,
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
          autoSelectHighest: false,
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: false,
          autoSelectAfterHours: 24,
        },
        swapPreferences: {
          preferredLocations: ['London', 'Rome'],
        },
        expirationDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      expect(swapResponse.body.swap).toBeDefined();
      expect(swapResponse.body.auction).toBeDefined();
      expect(swapResponse.body.swap.acceptanceStrategy.type).toBe('auction');
      
      const swapId = swapResponse.body.swap.id;
      const auctionId = swapResponse.body.auction.id;

      // Step 2: Submit booking proposals from multiple users
      const proposal1Request = {
        proposalType: 'booking',
        bookingId: testBooking2.id,
        message: 'Great London hotel for your Paris booking',
        conditions: ['Same quality level'],
      };

      const proposal1Response = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken2)
        .send(proposal1Request)
        .expect(201);

      expect(proposal1Response.body.proposalId).toBeDefined();
      expect(proposal1Response.body.status).toBe('pending');

      const proposal2Request = {
        proposalType: 'booking',
        bookingId: testBooking3.id,
        message: 'Historic Rome hotel - perfect swap',
        conditions: ['Flexible dates'],
      };

      const proposal2Response = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken3)
        .send(proposal2Request)
        .expect(201);

      expect(proposal2Response.body.proposalId).toBeDefined();

      // Step 3: Get auction details with proposals
      const auctionDetailsResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(auctionDetailsResponse.body.proposals).toHaveLength(2);
      expect(auctionDetailsResponse.body.status).toBe('active');

      // Step 4: End auction manually (simulate auction end)
      await request(app)
        .put(`/api/auctions/${auctionId}/end`)
        .set('Authorization', authToken1)
        .expect(200);

      // Step 5: Select winning proposal
      const winnerSelectionResponse = await request(app)
        .put(`/api/auctions/${auctionId}/select-winner`)
        .set('Authorization', authToken1)
        .send({ proposalId: proposal2Response.body.proposalId })
        .expect(200);

      expect(winnerSelectionResponse.body.winningProposalId).toBe(proposal2Response.body.proposalId);
      expect(winnerSelectionResponse.body.status).toBe('ended');

      // Step 6: Verify swap completion
      const finalSwapResponse = await request(app)
        .get(`/api/swaps/${swapId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(finalSwapResponse.body.status).toBe('accepted');
      expect(finalSwapResponse.body.targetBookingId).toBe(testBooking3.id);
    });

    it('should complete auction workflow with mixed proposal types', async () => {
      // Create payment method for cash proposal
      const paymentMethod: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser2.id,
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: { cardToken: 'token-123' },
      });

      // Step 1: Create enhanced swap accepting both booking and cash
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Mixed Auction Swap',
        description: 'Accepting both booking swaps and cash offers',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 300,
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 300,
          autoSelectAfterHours: 12,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const auctionId = swapResponse.body.auction.id;

      // Step 2: Submit booking proposal
      const bookingProposalRequest = {
        proposalType: 'booking',
        bookingId: testBooking2.id,
        message: 'London hotel booking swap',
        conditions: [],
      };

      await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken2)
        .send(bookingProposalRequest)
        .expect(201);

      // Step 3: Submit cash proposal
      const cashProposalRequest = {
        proposalType: 'cash',
        cashOffer: {
          amount: 400,
          currency: 'USD',
          paymentMethodId: paymentMethod.id,
          escrowAgreement: true,
        },
        message: 'Cash offer for your booking',
        conditions: [],
      };

      const cashProposalResponse = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken3)
        .send(cashProposalRequest)
        .expect(201);

      // Step 4: Get auction comparison view
      const auctionDetailsResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(auctionDetailsResponse.body.proposals).toHaveLength(2);
      
      const bookingProposals = auctionDetailsResponse.body.proposals.filter(
        (p: any) => p.proposalType === 'booking'
      );
      const cashProposals = auctionDetailsResponse.body.proposals.filter(
        (p: any) => p.proposalType === 'cash'
      );
      
      expect(bookingProposals).toHaveLength(1);
      expect(cashProposals).toHaveLength(1);
      expect(cashProposals[0].cashOffer.amount).toBe(400);

      // Step 5: End auction and select cash proposal
      await request(app)
        .put(`/api/auctions/${auctionId}/end`)
        .set('Authorization', authToken1)
        .expect(200);

      const winnerSelectionResponse = await request(app)
        .put(`/api/auctions/${auctionId}/select-winner`)
        .set('Authorization', authToken1)
        .send({ proposalId: cashProposalResponse.body.proposalId })
        .expect(200);

      expect(winnerSelectionResponse.body.winningProposalId).toBe(cashProposalResponse.body.proposalId);

      // Step 6: Verify payment processing initiated
      const paymentStatusResponse = await request(app)
        .get(`/api/payments/proposal/${cashProposalResponse.body.proposalId}`)
        .set('Authorization', authToken3)
        .expect(200);

      expect(paymentStatusResponse.body.status).toBe('processing');
      expect(paymentStatusResponse.body.escrowId).toBeDefined();
    });
  });

  describe('Payment Processing Integration with Escrow', () => {
    it('should handle complete payment flow with escrow management', async () => {
      // Create verified payment method
      const paymentMethod: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser2.id,
        type: 'credit_card',
        displayName: 'Visa ****5678',
        isVerified: true,
        metadata: { cardToken: 'secure-token-456' },
      });

      // Step 1: Create cash-enabled swap
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Cash Payment Test Swap',
        description: 'Testing payment processing',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 250,
        },
        acceptanceStrategy: {
          type: 'first_match',
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const swapId = swapResponse.body.swap.id;

      // Step 2: Submit cash proposal with escrow
      const cashProposalRequest = {
        swapId,
        proposalType: 'cash',
        cashOffer: {
          amount: 350,
          currency: 'USD',
          paymentMethodId: paymentMethod.id,
          escrowAgreement: true,
        },
        message: 'Cash offer with escrow protection',
        conditions: [],
      };

      const proposalResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(201);

      expect(proposalResponse.body.escrowId).toBeDefined();
      expect(proposalResponse.body.paymentStatus).toBe('escrow_created');

      // Step 3: Accept proposal (automatic for first_match)
      const acceptanceResponse = await request(app)
        .put(`/api/swaps/${swapId}/accept`)
        .set('Authorization', authToken1)
        .send({ proposalId: proposalResponse.body.id })
        .expect(200);

      expect(acceptanceResponse.body.status).toBe('accepted');

      // Step 4: Complete swap and release escrow
      const completionResponse = await request(app)
        .put(`/api/swaps/${swapId}/complete`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(completionResponse.body.status).toBe('completed');

      // Step 5: Verify escrow release
      const escrowStatusResponse = await request(app)
        .get(`/api/payments/escrow/${proposalResponse.body.escrowId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(escrowStatusResponse.body.status).toBe('released');
      expect(escrowStatusResponse.body.releasedAt).toBeDefined();

      // Step 6: Generate payment receipt
      const receiptResponse = await request(app)
        .get(`/api/payments/receipt/${proposalResponse.body.transactionId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(receiptResponse.body.amount).toBe(350);
      expect(receiptResponse.body.fees.platformFee).toBeGreaterThan(0);
      expect(receiptResponse.body.receiptUrl).toBeDefined();
    });

    it('should handle escrow refund on swap cancellation', async () => {
      // Create payment method
      const paymentMethod: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser3.id,
        type: 'bank_transfer',
        displayName: 'Bank Account ****9876',
        isVerified: true,
        metadata: { accountNumber: 'encrypted-account-9876' },
      });

      // Step 1: Create swap and proposal with escrow
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Escrow Refund Test',
        description: 'Testing escrow refund on cancellation',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 200,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const cashProposalRequest = {
        swapId: swapResponse.body.swap.id,
        proposalType: 'cash',
        cashOffer: {
          amount: 300,
          currency: 'USD',
          paymentMethodId: paymentMethod.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const proposalResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken3)
        .send(cashProposalRequest)
        .expect(201);

      // Step 2: Cancel swap before acceptance
      const cancellationResponse = await request(app)
        .put(`/api/swaps/${swapResponse.body.swap.id}/cancel`)
        .set('Authorization', authToken1)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(cancellationResponse.body.status).toBe('cancelled');

      // Step 3: Verify escrow refund
      const escrowStatusResponse = await request(app)
        .get(`/api/payments/escrow/${proposalResponse.body.escrowId}`)
        .set('Authorization', authToken3)
        .expect(200);

      expect(escrowStatusResponse.body.status).toBe('refunded');
      expect(escrowStatusResponse.body.refundedAt).toBeDefined();
    });
  });

  describe('Multi-User Auction Scenarios with Concurrent Proposals', () => {
    it('should handle concurrent proposal submissions correctly', async () => {
      // Create multiple payment methods for different users
      const paymentMethod2: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser2.id,
        type: 'credit_card',
        displayName: 'Visa ****1111',
        isVerified: true,
        metadata: { cardToken: 'token-1111' },
      });

      const paymentMethod3: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser3.id,
        type: 'credit_card',
        displayName: 'Visa ****2222',
        isVerified: true,
        metadata: { cardToken: 'token-2222' },
      });

      // Step 1: Create auction swap
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Concurrent Proposals Test',
        description: 'Testing concurrent proposal handling',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200,
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 200,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const auctionId = swapResponse.body.auction.id;

      // Step 2: Submit concurrent proposals
      const proposalPromises = [
        // Booking proposal from user 2
        request(app)
          .post(`/api/auctions/${auctionId}/proposals`)
          .set('Authorization', authToken2)
          .send({
            proposalType: 'booking',
            bookingId: testBooking2.id,
            message: 'Concurrent booking proposal',
            conditions: [],
          }),
        
        // Cash proposal from user 2
        request(app)
          .post(`/api/auctions/${auctionId}/proposals`)
          .set('Authorization', authToken2)
          .send({
            proposalType: 'cash',
            cashOffer: {
              amount: 250,
              currency: 'USD',
              paymentMethodId: paymentMethod2.id,
              escrowAgreement: true,
            },
            message: 'Concurrent cash proposal from user 2',
            conditions: [],
          }),
        
        // Cash proposal from user 3
        request(app)
          .post(`/api/auctions/${auctionId}/proposals`)
          .set('Authorization', authToken3)
          .send({
            proposalType: 'cash',
            cashOffer: {
              amount: 300,
              currency: 'USD',
              paymentMethodId: paymentMethod3.id,
              escrowAgreement: true,
            },
            message: 'Concurrent cash proposal from user 3',
            conditions: [],
          }),
      ];

      const proposalResponses = await Promise.all(proposalPromises);

      // Verify all proposals were created successfully
      proposalResponses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.proposalId).toBeDefined();
        expect(response.body.status).toBe('pending');
      });

      // Step 3: Verify auction state
      const auctionDetailsResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(auctionDetailsResponse.body.proposals).toHaveLength(3);
      
      const cashProposals = auctionDetailsResponse.body.proposals.filter(
        (p: any) => p.proposalType === 'cash'
      );
      expect(cashProposals).toHaveLength(2);
      
      // Verify cash amounts are correct
      const amounts = cashProposals.map((p: any) => p.cashOffer.amount).sort();
      expect(amounts).toEqual([250, 300]);
    });

    it('should prevent duplicate proposals from same user', async () => {
      // Step 1: Create auction
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Duplicate Prevention Test',
        description: 'Testing duplicate proposal prevention',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false,
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: false,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const auctionId = swapResponse.body.auction.id;

      // Step 2: Submit first proposal
      const firstProposalRequest = {
        proposalType: 'booking',
        bookingId: testBooking2.id,
        message: 'First proposal',
        conditions: [],
      };

      await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken2)
        .send(firstProposalRequest)
        .expect(201);

      // Step 3: Attempt duplicate proposal
      const duplicateProposalRequest = {
        proposalType: 'booking',
        bookingId: testBooking2.id, // Same booking
        message: 'Duplicate proposal attempt',
        conditions: [],
      };

      const duplicateResponse = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken2)
        .send(duplicateProposalRequest)
        .expect(400);

      expect(duplicateResponse.body.error).toContain('already submitted a proposal');
    });
  });

  describe('Auction Timeout and Automatic Winner Selection', () => {
    it('should automatically select highest cash offer on timeout', async () => {
      // Create payment methods
      const paymentMethod2: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser2.id,
        type: 'credit_card',
        displayName: 'Visa ****3333',
        isVerified: true,
        metadata: { cardToken: 'token-3333' },
      });

      const paymentMethod3: PaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser3.id,
        type: 'credit_card',
        displayName: 'Visa ****4444',
        isVerified: true,
        metadata: { cardToken: 'token-4444' },
      });

      // Step 1: Create auction with short timeout
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Auto-Selection Test',
        description: 'Testing automatic winner selection',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 150,
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 1000), // 1 second from now (will end immediately)
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 1000),
          allowBookingProposals: false,
          allowCashProposals: true,
          minimumCashOffer: 150,
          autoSelectAfterHours: 0.001, // Very short timeout for testing
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const auctionId = swapResponse.body.auction.id;

      // Step 2: Submit multiple cash proposals
      const proposal1Response = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken2)
        .send({
          proposalType: 'cash',
          cashOffer: {
            amount: 200,
            currency: 'USD',
            paymentMethodId: paymentMethod2.id,
            escrowAgreement: true,
          },
          message: 'Lower cash offer',
          conditions: [],
        })
        .expect(201);

      const proposal2Response = await request(app)
        .post(`/api/auctions/${auctionId}/proposals`)
        .set('Authorization', authToken3)
        .send({
          proposalType: 'cash',
          cashOffer: {
            amount: 350,
            currency: 'USD',
            paymentMethodId: paymentMethod3.id,
            escrowAgreement: true,
          },
          message: 'Higher cash offer',
          conditions: [],
        })
        .expect(201);

      // Step 3: Wait for auction to end and timeout to trigger
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 4: Trigger timeout handler manually (in real system this would be automatic)
      await request(app)
        .post('/api/auctions/handle-timeouts')
        .set('Authorization', 'Bearer admin-token') // Admin endpoint
        .expect(200);

      // Step 5: Verify automatic selection of highest offer
      const finalAuctionResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(finalAuctionResponse.body.status).toBe('ended');
      expect(finalAuctionResponse.body.winningProposalId).toBe(proposal2Response.body.proposalId);
      expect(finalAuctionResponse.body.autoSelected).toBe(true);
    });

    it('should handle timeout with no proposals gracefully', async () => {
      // Step 1: Create auction with short timeout
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'No Proposals Timeout Test',
        description: 'Testing timeout with no proposals',
        paymentTypes: {
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 500, // High minimum to discourage proposals
        },
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 1000),
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 500,
          autoSelectAfterHours: 0.001,
        },
        swapPreferences: {},
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      const auctionId = swapResponse.body.auction.id;

      // Step 2: Wait for auction to end
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Trigger timeout handler
      await request(app)
        .post('/api/auctions/handle-timeouts')
        .set('Authorization', 'Bearer admin-token')
        .expect(200);

      // Step 4: Verify auction ended without winner
      const finalAuctionResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(finalAuctionResponse.body.status).toBe('ended');
      expect(finalAuctionResponse.body.winningProposalId).toBeNull();
      expect(finalAuctionResponse.body.proposals).toHaveLength(0);

      // Step 5: Verify swap converted to first-match mode
      const swapResponse2 = await request(app)
        .get(`/api/swaps/${swapResponse.body.swap.id}`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(swapResponse2.body.acceptanceStrategy.type).toBe('first_match');
    });
  });
});