import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentProcessingService } from '../PaymentProcessingService';
import { PaymentRepository } from '../../../database/repositories/PaymentRepository';
import { HederaService } from '../../hedera/HederaService';
import { FraudDetectionService } from '../FraudDetectionService';
import { 
  PaymentRequest,
  PaymentMethod,
  PaymentTransaction,
  EscrowAccount,
  PaymentValidation,
  EscrowRequest,
  EscrowReleaseRequest,
  PaymentStatus,
  EscrowStatus
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/PaymentRepository');
vi.mock('../../hedera/HederaService');
vi.mock('../FraudDetectionService');
vi.mock('../../../utils/logger');

describe('EnhancedPaymentProcessingService', () => {
  let paymentService: PaymentProcessingService;
  let mockPaymentRepository: any;
  let mockHederaService: any;
  let mockFraudDetectionService: any;

  const mockGatewayConfig = {
    apiKey: 'test-api-key',
    secretKey: 'test-secret-key',
    environment: 'sandbox' as const,
    webhookSecret: 'test-webhook-secret'
  };

  beforeEach(() => {
    mockPaymentRepository = {
      findById: vi.fn(),
      getUserPaymentStats: vi.fn(),
      createEscrow: vi.fn(),
      createPaymentTransaction: vi.fn(),
      update: vi.fn(),
      findEscrowAccounts: vi.fn(),
      findPayments: vi.fn(),
      updateEscrowStatus: vi.fn(),
      updatePaymentStatus: vi.fn(),
      findPaymentMethodsByUser: vi.fn(),
      findTransactionsBySwap: vi.fn(),
    };

    mockHederaService = {
      recordEscrowCreation: vi.fn(),
      recordPaymentTransaction: vi.fn(),
      recordEscrowRelease: vi.fn(),
      recordPaymentRefund: vi.fn(),
    };

    mockFraudDetectionService = {
      assessRisk: vi.fn(),
      validateTransaction: vi.fn(),
      checkSuspiciousActivity: vi.fn(),
    };
    
    paymentService = new PaymentProcessingService(
      mockPaymentRepository,
      mockHederaService,
      mockGatewayConfig,
      mockFraudDetectionService
    );

    vi.clearAllMocks();
  });

  describe('validateCashOffer - Enhanced Validation', () => {
    beforeEach(() => {
      // Mock user stats for risk assessment
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 1000,
        totalReceived: 500,
        completedPayments: 10,
        pendingPayments: 0,
        averagePaymentAmount: 150
      });

      // Mock payment method validation
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: { cardToken: 'token-123', expiryDate: '12/25' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);

      // Mock fraud detection
      mockFraudDetectionService.assessRisk.mockResolvedValue({
        riskLevel: 'low',
        factors: [],
        requiresManualReview: false,
        additionalVerificationRequired: false,
      });
    });

    it('should validate cash offer with auction minimum requirements', async () => {
      const result = await paymentService.validateCashOffer(
        250, // amount
        'USD', // currency
        200, // auction minimum required
        'pm-123', // payment method ID
        'user-123' // user ID
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.estimatedFees).toBeDefined();
      expect(result.estimatedFees.platformFee).toBeGreaterThan(0);
      expect(result.requiresEscrow).toBe(true);
    });

    it('should reject cash offer below auction minimum', async () => {
      const result = await paymentService.validateCashOffer(
        150, // amount
        'USD',
        200, // auction minimum required (higher than offer)
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be at least 200 USD as specified by swap owner');
    });

    it('should handle multiple currency validation', async () => {
      const eurResult = await paymentService.validateCashOffer(
        200,
        'EUR', // Different currency
        150,
        'pm-123',
        'user-123'
      );

      expect(eurResult.isValid).toBe(true);
      expect(eurResult.estimatedFees.platformFee).toBeGreaterThan(0);
    });

    it('should flag high-risk transactions for new users', async () => {
      // Mock new user stats
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 0,
        totalReceived: 0,
        completedPayments: 0,
        pendingPayments: 0,
        averagePaymentAmount: 0
      });

      mockFraudDetectionService.assessRisk.mockResolvedValue({
        riskLevel: 'high',
        factors: ['New user', 'High amount'],
        requiresManualReview: true,
        additionalVerificationRequired: true,
      });

      const result = await paymentService.validateCashOffer(
        2000, // High amount for new user
        'USD',
        100,
        'pm-123',
        'user-123'
      );

      expect(result.warnings).toContain('This transaction requires manual review due to risk factors');
      expect(result.isValid).toBe(true); // Still valid but flagged
    });

    it('should calculate correct fees for different amount tiers', async () => {
      // Test low amount (flat fee)
      const lowAmountResult = await paymentService.validateCashOffer(50, 'USD', 0, 'pm-123', 'user-123');
      expect(lowAmountResult.estimatedFees.platformFee).toBe(5); // Flat fee for amounts < 100

      // Test high amount (percentage fee)
      const highAmountResult = await paymentService.validateCashOffer(500, 'USD', 0, 'pm-123', 'user-123');
      expect(highAmountResult.estimatedFees.platformFee).toBe(25); // 5% of 500
    });

    it('should validate payment method ownership and verification', async () => {
      // Mock unverified payment method
      const unverifiedMethod: PaymentMethod = {
        id: 'pm-456',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****5678',
        isVerified: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPaymentRepository.findById.mockResolvedValue(unverifiedMethod);

      const result = await paymentService.validateCashOffer(200, 'USD', 100, 'pm-456', 'user-123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Payment method is not verified');
    });
  });

  describe('Enhanced Escrow Management', () => {
    it('should create escrow with auction-specific terms', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 500,
        currency: 'USD',
        status: 'created',
        releasedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.createEscrow.mockResolvedValue(mockEscrow);
      mockHederaService.recordEscrowCreation.mockResolvedValue('blockchain-tx-123');

      const escrowRequest: EscrowRequest = {
        amount: 500,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        swapId: 'swap-123',
        proposalId: 'proposal-123'
      };

      const result = await paymentService.createEscrow(escrowRequest);

      expect(result.escrowId).toBe('escrow-123');
      expect(result.status).toBe('created');
      expect(result.expiresAt).toBeDefined();
      expect(mockHederaService.recordEscrowCreation).toHaveBeenCalledWith({
        escrowId: 'escrow-123',
        amount: 500,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        swapId: 'swap-123',
        proposalId: 'proposal-123'
      });
    });

    it('should handle escrow expiration for auction scenarios', async () => {
      const expiredEscrow: EscrowAccount = {
        id: 'escrow-expired',
        transactionId: 'tx-expired',
        amount: 300,
        currency: 'USD',
        status: 'created',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        updatedAt: new Date(),
      };

      mockPaymentRepository.findEscrowAccounts.mockResolvedValue([expiredEscrow]);
      mockPaymentRepository.updateEscrowStatus.mockResolvedValue({
        ...expiredEscrow,
        status: 'refunded',
      });
      mockHederaService.recordPaymentRefund.mockResolvedValue('refund-tx-123');

      await paymentService.handleExpiredEscrows();

      expect(mockPaymentRepository.updateEscrowStatus).toHaveBeenCalledWith(
        'escrow-expired',
        'refunded',
        expect.any(Date)
      );
      expect(mockHederaService.recordPaymentRefund).toHaveBeenCalled();
    });

    it('should release escrow with proper validation for auction winners', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 500,
        currency: 'USD',
        status: 'funded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPayment: PaymentTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 500,
        currency: 'USD',
        status: 'processing',
        escrowId: 'escrow-123',
        gatewayTransactionId: 'gw-123',
        platformFee: 25,
        netAmount: 475,
        completedAt: undefined,
        blockchain: { transactionId: 'blockchain-tx-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findEscrowAccounts.mockResolvedValue([mockEscrow]);
      mockPaymentRepository.findPayments.mockResolvedValue([mockPayment]);
      mockPaymentRepository.updateEscrowStatus.mockResolvedValue({
        ...mockEscrow,
        status: 'released',
        releasedAt: new Date()
      });
      mockPaymentRepository.updatePaymentStatus.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
        completedAt: new Date()
      });
      mockHederaService.recordEscrowRelease.mockResolvedValue('release-tx-123');

      const releaseRequest: EscrowReleaseRequest = {
        escrowId: 'escrow-123',
        recipientId: 'user-456',
        reason: 'Auction winner selected and swap completed'
      };

      const result = await paymentService.releaseEscrow(releaseRequest);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
      expect(mockHederaService.recordEscrowRelease).toHaveBeenCalledWith({
        escrowId: 'escrow-123',
        recipientId: 'user-456',
        amount: 500,
        reason: 'Auction winner selected and swap completed'
      });
    });
  });

  describe('Auction Payment Integration', () => {
    it('should process payment for auction winner with escrow', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: { cardToken: 'token-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockTransaction: PaymentTransaction = {
        id: 'tx-auction-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'processing',
        escrowId: 'escrow-123',
        gatewayTransactionId: 'gw-auction-123',
        platformFee: 15,
        netAmount: 285,
        completedAt: undefined,
        blockchain: { transactionId: '' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 1000,
        completedPayments: 5,
        pendingPayments: 0,
        averagePaymentAmount: 200
      });
      mockFraudDetectionService.assessRisk.mockResolvedValue({
        riskLevel: 'low',
        factors: [],
        requiresManualReview: false,
        additionalVerificationRequired: false,
      });
      mockPaymentRepository.createPaymentTransaction.mockResolvedValue(mockTransaction);
      mockPaymentRepository.createEscrow.mockResolvedValue({
        id: 'escrow-123',
        transactionId: 'tx-auction-123',
        amount: 300,
        currency: 'USD',
        status: 'created',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockHederaService.recordPaymentTransaction.mockResolvedValue('blockchain-tx-123');
      mockHederaService.recordEscrowCreation.mockResolvedValue('blockchain-escrow-123');

      const paymentRequest: PaymentRequest = {
        amount: 300,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        paymentMethodId: 'pm-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: true
      };

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.transactionId).toBe('tx-auction-123');
      expect(result.escrowId).toBe('escrow-123');
      expect(result.fees.platformFee).toBe(15);
      expect(mockPaymentRepository.createEscrow).toHaveBeenCalled();
      expect(mockHederaService.recordEscrowCreation).toHaveBeenCalled();
    });

    it('should handle payment failures with proper rollback', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: { cardToken: 'token-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 1000,
        completedPayments: 5,
        pendingPayments: 0,
        averagePaymentAmount: 200
      });
      mockFraudDetectionService.assessRisk.mockResolvedValue({
        riskLevel: 'low',
        factors: [],
        requiresManualReview: false,
        additionalVerificationRequired: false,
      });

      // Mock payment gateway failure
      mockPaymentRepository.createPaymentTransaction.mockRejectedValue(
        new Error('Payment gateway error: Insufficient funds')
      );

      const paymentRequest: PaymentRequest = {
        amount: 300,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        paymentMethodId: 'pm-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: false
      };

      await expect(paymentService.processPayment(paymentRequest))
        .rejects.toThrow('Payment gateway error: Insufficient funds');

      // Verify no blockchain transaction was recorded on failure
      expect(mockHederaService.recordPaymentTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle EUR payments with correct fee calculation', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-eur',
        userId: 'user-123',
        type: 'bank_transfer',
        displayName: 'EUR Bank Account',
        isVerified: true,
        metadata: { iban: 'DE89370400440532013000' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 500,
        completedPayments: 3,
        pendingPayments: 0,
        averagePaymentAmount: 167
      });

      const result = await paymentService.validateCashOffer(
        250, // EUR amount
        'EUR',
        200, // minimum
        'pm-eur',
        'user-123'
      );

      expect(result.isValid).toBe(true);
      expect(result.estimatedFees.platformFee).toBe(12.5); // 5% of 250 EUR
      expect(result.estimatedFees.processingFee).toBe(2); // Fixed EUR processing fee
    });

    it('should reject unsupported currencies', async () => {
      const result = await paymentService.validateCashOffer(
        200,
        'JPY', // Unsupported currency
        100,
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Currency JPY is not supported');
    });
  });

  describe('Fraud Detection Integration', () => {
    it('should flag suspicious payment patterns', async () => {
      mockFraudDetectionService.assessRisk.mockResolvedValue({
        riskLevel: 'high',
        factors: ['Multiple failed attempts', 'Unusual payment pattern'],
        requiresManualReview: true,
        additionalVerificationRequired: true,
      });

      mockFraudDetectionService.checkSuspiciousActivity.mockResolvedValue([
        { type: 'velocity', description: 'Multiple large payments in short time' },
        { type: 'location', description: 'Payment from unusual location' }
      ]);

      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-suspicious',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: { cardToken: 'token-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 5000,
        completedPayments: 1,
        pendingPayments: 3,
        averagePaymentAmount: 1250
      });

      const result = await paymentService.validateCashOffer(
        1000,
        'USD',
        500,
        'pm-123',
        'user-suspicious'
      );

      expect(result.warnings).toContain('This transaction requires manual review due to risk factors');
      expect(result.warnings).toContain('Suspicious activity detected: Multiple large payments in short time');
    });

    it('should block payments from blacklisted users', async () => {
      mockFraudDetectionService.validateTransaction.mockResolvedValue({
        isValid: false,
        reason: 'User is blacklisted',
        riskScore: 100
      });

      const paymentRequest: PaymentRequest = {
        amount: 200,
        currency: 'USD',
        payerId: 'blacklisted-user',
        recipientId: 'user-456',
        paymentMethodId: 'pm-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: false
      };

      await expect(paymentService.processPayment(paymentRequest))
        .rejects.toThrow('Transaction blocked: User is blacklisted');
    });
  });
});