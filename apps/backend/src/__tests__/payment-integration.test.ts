import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { setupTestDatabase, cleanupTestDatabase } from '../database/setup';
import { PaymentRepository } from '../database/repositories/PaymentRepository';
import { SwapRepository } from '../database/repositories/SwapRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { BookingRepository } from '../database/repositories/BookingRepository';
import { 
  PaymentMethod,
  PaymentTransaction,
  EscrowAccount,
  EnhancedSwap,
  User,
  Booking
} from '@booking-swap/shared';

// Mock external services
vi.mock('../services/hedera/HederaService');
vi.mock('../services/notification/NotificationService');
vi.mock('../services/payment/PaymentGatewayService');

describe('Payment Integration Tests', () => {
  let paymentRepository: PaymentRepository;
  let swapRepository: SwapRepository;
  let userRepository: UserRepository;
  let bookingRepository: BookingRepository;
  
  let testUser1: User;
  let testUser2: User;
  let testBooking1: Booking;
  let testBooking2: Booking;
  let testPaymentMethod1: PaymentMethod;
  let testPaymentMethod2: PaymentMethod;
  let authToken1: string;
  let authToken2: string;

  beforeEach(async () => {
    await setupTestDatabase();
    
    // Initialize repositories
    paymentRepository = new PaymentRepository();
    swapRepository = new SwapRepository();
    userRepository = new UserRepository();
    bookingRepository = new BookingRepository();
    
    // Create test users
    testUser1 = await userRepository.create({
      email: 'payer@test.com',
      password: 'hashedpassword1',
      firstName: 'Payer',
      lastName: 'User',
      isVerified: true,
    });
    
    testUser2 = await userRepository.create({
      email: 'recipient@test.com',
      password: 'hashedpassword2',
      firstName: 'Recipient',
      lastName: 'User',
      isVerified: true,
    });
    
    // Create test bookings
    const futureDate1 = new Date();
    futureDate1.setDate(futureDate1.getDate() + 30);
    
    const futureDate2 = new Date();
    futureDate2.setDate(futureDate2.getDate() + 35);
    
    testBooking1 = await bookingRepository.create({
      userId: testUser1.id,
      type: 'hotel',
      title: 'Payment Test Hotel 1',
      description: 'Hotel for payment testing',
      location: { city: 'New York', country: 'USA' },
      dateRange: {
        checkIn: futureDate1,
        checkOut: new Date(futureDate1.getTime() + 3 * 24 * 60 * 60 * 1000),
      },
      originalPrice: 400,
      swapValue: 350,
      providerDetails: {
        provider: 'booking.com',
        confirmationNumber: 'PAY123',
        bookingReference: 'PAYREF123',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { topicId: 'topic-pay-123' },
      status: 'available',
    });
    
    testBooking2 = await bookingRepository.create({
      userId: testUser2.id,
      type: 'hotel',
      title: 'Payment Test Hotel 2',
      description: 'Hotel for payment testing',
      location: { city: 'Los Angeles', country: 'USA' },
      dateRange: {
        checkIn: futureDate2,
        checkOut: new Date(futureDate2.getTime() + 4 * 24 * 60 * 60 * 1000),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'expedia.com',
        confirmationNumber: 'PAY456',
        bookingReference: 'PAYREF456',
      },
      verification: { status: 'verified', documents: [] },
      blockchain: { topicId: 'topic-pay-456' },
      status: 'available',
    });
    
    // Create test payment methods
    testPaymentMethod1 = await paymentRepository.createPaymentMethod({
      userId: testUser1.id,
      type: 'credit_card',
      displayName: 'Visa ****1234',
      isVerified: true,
      metadata: { cardToken: 'secure-token-1234' },
    });
    
    testPaymentMethod2 = await paymentRepository.createPaymentMethod({
      userId: testUser2.id,
      type: 'credit_card',
      displayName: 'Mastercard ****5678',
      isVerified: true,
      metadata: { cardToken: 'secure-token-5678' },
    });
    
    // Generate auth tokens
    authToken1 = `Bearer test-token-${testUser1.id}`;
    authToken2 = `Bearer test-token-${testUser2.id}`;
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('Cash Payment Workflow', () => {
    it('should complete full cash payment workflow with escrow', async () => {
      // Step 1: Create cash-enabled swap
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Cash Payment Test Swap',
        description: 'Testing cash payment workflow',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 200,
          preferredCashAmount: 300,
        },
        acceptanceStrategy: {
          type: 'first_match',
        },
        swapPreferences: {
          preferredLocations: [],
          additionalRequirements: [],
        },
        expirationDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
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
          paymentMethodId: testPaymentMethod2.id,
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

      const escrowId = proposalResponse.body.escrowId;
      const proposalId = proposalResponse.body.id;

      // Step 3: Verify escrow creation
      const escrowResponse = await request(app)
        .get(`/api/payments/escrow/${escrowId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(escrowResponse.body.amount).toBe(350);
      expect(escrowResponse.body.status).toBe('created');

      // Step 4: Fund escrow (simulate payment gateway funding)
      await request(app)
        .put(`/api/payments/escrow/${escrowId}/fund`)
        .set('Authorization', authToken2)
        .send({ gatewayTransactionId: 'gateway-fund-123' })
        .expect(200);

      // Step 5: Accept proposal (automatic for first_match)
      const acceptanceResponse = await request(app)
        .put(`/api/swaps/${swapId}/accept`)
        .set('Authorization', authToken1)
        .send({ proposalId })
        .expect(200);

      expect(acceptanceResponse.body.status).toBe('accepted');

      // Step 6: Complete swap and release escrow
      const completionResponse = await request(app)
        .put(`/api/swaps/${swapId}/complete`)
        .set('Authorization', authToken1)
        .expect(200);

      expect(completionResponse.body.status).toBe('completed');

      // Step 7: Verify escrow release
      const finalEscrowResponse = await request(app)
        .get(`/api/payments/escrow/${escrowId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(finalEscrowResponse.body.status).toBe('released');
      expect(finalEscrowResponse.body.releasedAt).toBeDefined();

      // Step 8: Verify payment transaction
      const transactionResponse = await request(app)
        .get(`/api/payments/transaction/${proposalResponse.body.transactionId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(transactionResponse.body.status).toBe('completed');
      expect(transactionResponse.body.amount).toBe(350);
      expect(transactionResponse.body.platformFee).toBeGreaterThan(0);
      expect(transactionResponse.body.netAmount).toBeLessThan(350);
    });

    it('should handle escrow refund on swap cancellation', async () => {
      // Step 1: Create swap and cash proposal with escrow
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Escrow Refund Test',
        description: 'Testing escrow refund functionality',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 150,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
        expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
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
          amount: 250,
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const proposalResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(201);

      const escrowId = proposalResponse.body.escrowId;

      // Step 2: Fund escrow
      await request(app)
        .put(`/api/payments/escrow/${escrowId}/fund`)
        .set('Authorization', authToken2)
        .send({ gatewayTransactionId: 'gateway-fund-456' })
        .expect(200);

      // Step 3: Cancel swap before acceptance
      const cancellationResponse = await request(app)
        .put(`/api/swaps/${swapResponse.body.swap.id}/cancel`)
        .set('Authorization', authToken1)
        .send({ reason: 'Changed my mind' })
        .expect(200);

      expect(cancellationResponse.body.status).toBe('cancelled');

      // Step 4: Verify automatic escrow refund
      const escrowStatusResponse = await request(app)
        .get(`/api/payments/escrow/${escrowId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(escrowStatusResponse.body.status).toBe('refunded');
      expect(escrowStatusResponse.body.refundedAt).toBeDefined();

      // Step 5: Verify refund transaction
      const refundTransactionResponse = await request(app)
        .get(`/api/payments/refunds/escrow/${escrowId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(refundTransactionResponse.body.amount).toBe(250);
      expect(refundTransactionResponse.body.status).toBe('completed');
      expect(refundTransactionResponse.body.platformFee).toBe(0); // No fee on refunds
    });

    it('should handle payment method validation failures', async () => {
      // Step 1: Create cash-enabled swap
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Payment Validation Test',
        description: 'Testing payment method validation',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 100,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      // Step 2: Attempt cash proposal with invalid payment method
      const invalidCashProposal = {
        swapId: swapResponse.body.swap.id,
        proposalType: 'cash',
        cashOffer: {
          amount: 200,
          currency: 'USD',
          paymentMethodId: 'invalid-payment-method-id',
          escrowAgreement: true,
        },
        conditions: [],
      };

      const errorResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(invalidCashProposal)
        .expect(400);

      expect(errorResponse.body.error).toContain('Invalid payment method');

      // Step 3: Attempt cash proposal with unverified payment method
      const unverifiedPaymentMethod = await paymentRepository.createPaymentMethod({
        userId: testUser2.id,
        type: 'credit_card',
        displayName: 'Unverified Card ****9999',
        isVerified: false, // Not verified
        metadata: { cardToken: 'unverified-token' },
      });

      const unverifiedCashProposal = {
        swapId: swapResponse.body.swap.id,
        proposalType: 'cash',
        cashOffer: {
          amount: 200,
          currency: 'USD',
          paymentMethodId: unverifiedPaymentMethod.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const unverifiedErrorResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(unverifiedCashProposal)
        .expect(400);

      expect(unverifiedErrorResponse.body.error).toContain('Payment method not verified');
    });

    it('should enforce minimum cash amount requirements', async () => {
      // Step 1: Create swap with high minimum cash amount
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Minimum Amount Test',
        description: 'Testing minimum cash amount enforcement',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 500, // High minimum
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
        expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const swapResponse = await request(app)
        .post('/api/swaps/enhanced')
        .set('Authorization', authToken1)
        .send(swapRequest)
        .expect(201);

      // Step 2: Attempt cash proposal below minimum
      const lowCashProposal = {
        swapId: swapResponse.body.swap.id,
        proposalType: 'cash',
        cashOffer: {
          amount: 300, // Below minimum of 500
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const errorResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(lowCashProposal)
        .expect(400);

      expect(errorResponse.body.error).toContain('below minimum amount');
      expect(errorResponse.body.minimumRequired).toBe(500);

      // Step 3: Submit valid cash proposal meeting minimum
      const validCashProposal = {
        swapId: swapResponse.body.swap.id,
        proposalType: 'cash',
        cashOffer: {
          amount: 600, // Above minimum
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const successResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(validCashProposal)
        .expect(201);

      expect(successResponse.body.cashOffer.amount).toBe(600);
      expect(successResponse.body.escrowId).toBeDefined();
    });
  });

  describe('Payment Method Management', () => {
    it('should create and verify payment methods', async () => {
      // Step 1: Create new payment method
      const paymentMethodRequest = {
        type: 'credit_card',
        displayName: 'New Test Card ****1111',
        metadata: {
          cardToken: 'new-secure-token-1111',
          expiryMonth: '12',
          expiryYear: '2025',
          cardType: 'visa',
        },
      };

      const createResponse = await request(app)
        .post('/api/payments/methods')
        .set('Authorization', authToken1)
        .send(paymentMethodRequest)
        .expect(201);

      expect(createResponse.body.displayName).toBe('New Test Card ****1111');
      expect(createResponse.body.isVerified).toBe(false); // Initially unverified
      expect(createResponse.body.metadata.cardToken).toBe('new-secure-token-1111');

      const paymentMethodId = createResponse.body.id;

      // Step 2: Verify payment method
      const verificationRequest = {
        verificationCode: '123456',
        microDepositAmounts: [0.01, 0.02], // For bank account verification
      };

      const verifyResponse = await request(app)
        .put(`/api/payments/methods/${paymentMethodId}/verify`)
        .set('Authorization', authToken1)
        .send(verificationRequest)
        .expect(200);

      expect(verifyResponse.body.isVerified).toBe(true);

      // Step 3: List user payment methods
      const listResponse = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', authToken1)
        .expect(200);

      expect(listResponse.body.length).toBeGreaterThan(1); // Original + new method
      const newMethod = listResponse.body.find((pm: any) => pm.id === paymentMethodId);
      expect(newMethod.isVerified).toBe(true);
    });

    it('should handle payment method deletion', async () => {
      // Step 1: Create payment method
      const paymentMethodRequest = {
        type: 'bank_transfer',
        displayName: 'Test Bank Account ****9876',
        metadata: {
          accountNumber: 'encrypted-account-9876',
          routingNumber: 'encrypted-routing-123',
          accountType: 'checking',
        },
      };

      const createResponse = await request(app)
        .post('/api/payments/methods')
        .set('Authorization', authToken1)
        .send(paymentMethodRequest)
        .expect(201);

      const paymentMethodId = createResponse.body.id;

      // Step 2: Delete payment method
      await request(app)
        .delete(`/api/payments/methods/${paymentMethodId}`)
        .set('Authorization', authToken1)
        .expect(200);

      // Step 3: Verify deletion
      const listResponse = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', authToken1)
        .expect(200);

      const deletedMethod = listResponse.body.find((pm: any) => pm.id === paymentMethodId);
      expect(deletedMethod).toBeUndefined();
    });

    it('should prevent deletion of payment method with active transactions', async () => {
      // Step 1: Create swap and cash proposal using payment method
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Active Transaction Test',
        description: 'Testing payment method deletion with active transactions',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 100,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
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
          amount: 200,
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(201);

      // Step 2: Attempt to delete payment method with active transaction
      const deleteResponse = await request(app)
        .delete(`/api/payments/methods/${testPaymentMethod2.id}`)
        .set('Authorization', authToken2)
        .expect(400);

      expect(deleteResponse.body.error).toContain('active transactions');
    });
  });

  describe('Transaction History and Receipts', () => {
    it('should provide comprehensive transaction history', async () => {
      // Step 1: Create multiple transactions
      const transactions = [];
      
      for (let i = 0; i < 3; i++) {
        const swapRequest = {
          sourceBookingId: testBooking1.id,
          title: `History Test Swap ${i + 1}`,
          description: `Testing transaction history ${i + 1}`,
          paymentTypes: {
            bookingExchange: false,
            cashPayment: true,
            minimumCashAmount: 100,
          },
          acceptanceStrategy: { type: 'first_match' },
          swapPreferences: { preferredLocations: [], additionalRequirements: [] },
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };

        const swapResponse = await request(app)
          .post('/api/swaps/enhanced')
          .set('Authorization', authToken1)
          .send(swapRequest);

        const cashProposalRequest = {
          swapId: swapResponse.body.swap.id,
          proposalType: 'cash',
          cashOffer: {
            amount: 150 + (i * 50), // Different amounts
            currency: 'USD',
            paymentMethodId: testPaymentMethod2.id,
            escrowAgreement: true,
          },
          conditions: [],
        };

        const proposalResponse = await request(app)
          .post('/api/swaps/proposals')
          .set('Authorization', authToken2)
          .send(cashProposalRequest);

        transactions.push({
          swapId: swapResponse.body.swap.id,
          proposalId: proposalResponse.body.id,
          transactionId: proposalResponse.body.transactionId,
          amount: 150 + (i * 50),
        });
      }

      // Step 2: Get transaction history
      const historyResponse = await request(app)
        .get('/api/payments/transactions/history')
        .set('Authorization', authToken2)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(historyResponse.body.transactions.length).toBe(3);
      expect(historyResponse.body.total).toBe(3);
      
      // Verify transactions are sorted by date (newest first)
      const amounts = historyResponse.body.transactions.map((t: any) => t.amount);
      expect(amounts).toEqual([250, 200, 150]); // Newest first

      // Step 3: Filter transaction history
      const filteredResponse = await request(app)
        .get('/api/payments/transactions/history')
        .set('Authorization', authToken2)
        .query({ 
          minAmount: 200,
          status: 'processing',
          dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(200);

      expect(filteredResponse.body.transactions.length).toBe(2); // Only amounts >= 200
    });

    it('should generate and retrieve payment receipts', async () => {
      // Step 1: Complete a cash transaction
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Receipt Test Swap',
        description: 'Testing receipt generation',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 100,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
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
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const proposalResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(201);

      // Fund escrow and complete transaction
      await request(app)
        .put(`/api/payments/escrow/${proposalResponse.body.escrowId}/fund`)
        .set('Authorization', authToken2)
        .send({ gatewayTransactionId: 'gateway-receipt-test' });

      await request(app)
        .put(`/api/swaps/${swapResponse.body.swap.id}/accept`)
        .set('Authorization', authToken1)
        .send({ proposalId: proposalResponse.body.id });

      await request(app)
        .put(`/api/swaps/${swapResponse.body.swap.id}/complete`)
        .set('Authorization', authToken1);

      // Step 2: Generate receipt
      const receiptResponse = await request(app)
        .get(`/api/payments/receipt/${proposalResponse.body.transactionId}`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(receiptResponse.body.transactionId).toBe(proposalResponse.body.transactionId);
      expect(receiptResponse.body.amount).toBe(300);
      expect(receiptResponse.body.currency).toBe('USD');
      expect(receiptResponse.body.fees.platformFee).toBeGreaterThan(0);
      expect(receiptResponse.body.netAmount).toBeLessThan(300);
      expect(receiptResponse.body.receiptUrl).toBeDefined();
      expect(receiptResponse.body.generatedAt).toBeDefined();

      // Step 3: Download receipt PDF
      const pdfResponse = await request(app)
        .get(`/api/payments/receipt/${proposalResponse.body.transactionId}/pdf`)
        .set('Authorization', authToken2)
        .expect(200);

      expect(pdfResponse.headers['content-type']).toBe('application/pdf');
      expect(pdfResponse.headers['content-disposition']).toContain('attachment');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle payment gateway failures gracefully', async () => {
      // Mock payment gateway failure
      vi.mocked(require('../services/payment/PaymentGatewayService')).mockImplementation(() => ({
        processPayment: vi.fn().mockRejectedValue(new Error('Gateway timeout')),
        createEscrow: vi.fn().mockRejectedValue(new Error('Gateway unavailable')),
      }));

      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Gateway Failure Test',
        description: 'Testing payment gateway failure handling',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 100,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
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
          amount: 200,
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const errorResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(503); // Service unavailable

      expect(errorResponse.body.error).toContain('Payment service temporarily unavailable');
      expect(errorResponse.body.retryAfter).toBeDefined();
    });

    it('should handle concurrent escrow operations', async () => {
      // Create swap
      const swapRequest = {
        sourceBookingId: testBooking1.id,
        title: 'Concurrent Operations Test',
        description: 'Testing concurrent escrow operations',
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
          minimumCashAmount: 100,
        },
        acceptanceStrategy: { type: 'first_match' },
        swapPreferences: { preferredLocations: [], additionalRequirements: [] },
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
          amount: 200,
          currency: 'USD',
          paymentMethodId: testPaymentMethod2.id,
          escrowAgreement: true,
        },
        conditions: [],
      };

      const proposalResponse = await request(app)
        .post('/api/swaps/proposals')
        .set('Authorization', authToken2)
        .send(cashProposalRequest)
        .expect(201);

      const escrowId = proposalResponse.body.escrowId;

      // Attempt concurrent operations on same escrow
      const operations = [
        request(app)
          .put(`/api/payments/escrow/${escrowId}/fund`)
          .set('Authorization', authToken2)
          .send({ gatewayTransactionId: 'concurrent-1' }),
        
        request(app)
          .put(`/api/payments/escrow/${escrowId}/fund`)
          .set('Authorization', authToken2)
          .send({ gatewayTransactionId: 'concurrent-2' }),
        
        request(app)
          .put(`/api/payments/escrow/${escrowId}/cancel`)
          .set('Authorization', authToken2)
          .send({ reason: 'Changed mind' }),
      ];

      const results = await Promise.allSettled(operations);

      // Only one operation should succeed
      const successfulOps = results.filter(r => r.status === 'fulfilled' && (r.value as any).status === 200);
      const failedOps = results.filter(r => r.status === 'rejected' || (r.value as any).status !== 200);

      expect(successfulOps.length).toBe(1);
      expect(failedOps.length).toBe(2);
    });
  });
});