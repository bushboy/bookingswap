import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { PaymentService } from '../PaymentService';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';
import { HederaService } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { 
  PaymentMethod,
  PaymentTransaction,
  EscrowAccount,
  CashOfferRequest,
  PaymentRequest,
  ValidationResult
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../database/repositories/PaymentRepository');
vi.mock('../hedera/HederaService');
vi.mock('../notification/NotificationService');

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockPaymentRepository: Mock;
  let mockHederaService: Mock;
  let mockNotificationService: Mock;

  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    userId: 'user-123',
    type: 'credit_card',
    displayName: 'Visa ****1234',
    isVerified: true,
    metadata: { cardToken: 'secure-token-123' },
    createdAt: new Date(),
  };

  const mockCashOffer: CashOfferRequest = {
    amount: 300,
    currency: 'USD',
    paymentMethodId: 'pm-123',
    escrowAgreement: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockPaymentRepository = vi.mocked(PaymentRepository);
    mockHederaService = vi.mocked(HederaService);
    mockNotificationService = vi.mocked(NotificationService);

    paymentService = new PaymentService(
      mockPaymentRepository.prototype,
      mockHederaService.prototype,
      mockNotificationService.prototype
    );
  });

  describe('validatePaymentMethod', () => {
    it('should validate verified payment method', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);

      const result = await paymentService.validatePaymentMethod('user-123', 'pm-123');

      expect(result).toEqual(mockPaymentMethod);
      expect(mockPaymentRepository.prototype.findByUserAndId).toHaveBeenCalledWith('user-123', 'pm-123');
    });

    it('should reject unverified payment method', async () => {
      const unverifiedMethod: PaymentMethod = {
        ...mockPaymentMethod,
        isVerified: false,
      };

      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(unverifiedMethod);

      await expect(
        paymentService.validatePaymentMethod('user-123', 'pm-123')
      ).rejects.toThrow('PAYMENT_METHOD_INVALID');
    });

    it('should reject non-existent payment method', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.validatePaymentMethod('user-123', 'pm-123')
      ).rejects.toThrow('PAYMENT_METHOD_INVALID');
    });

    it('should reject payment method belonging to different user', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.validatePaymentMethod('user-456', 'pm-123')
      ).rejects.toThrow('PAYMENT_METHOD_INVALID');
    });
  });

  describe('validateCashOffer', () => {
    it('should validate valid cash offer', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);

      const result = await paymentService.validateCashOffer(mockCashOffer);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject offer below platform minimum', async () => {
      const lowOffer: CashOfferRequest = {
        ...mockCashOffer,
        amount: 50, // Below $100 minimum
      };

      const result = await paymentService.validateCashOffer(lowOffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount below platform minimum of $100');
    });

    it('should reject offer above platform maximum', async () => {
      const highOffer: CashOfferRequest = {
        ...mockCashOffer,
        amount: 15000, // Above $10,000 maximum
      };

      const result = await paymentService.validateCashOffer(highOffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount exceeds platform maximum of $10,000');
    });

    it('should reject unsupported currency', async () => {
      const invalidCurrencyOffer: CashOfferRequest = {
        ...mockCashOffer,
        currency: 'XYZ',
      };

      const result = await paymentService.validateCashOffer(invalidCurrencyOffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported currency: XYZ');
    });

    it('should validate payment method exists and is verified', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(null);

      const result = await paymentService.validateCashOffer(mockCashOffer);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid payment method');
    });
  });

  describe('createEscrow', () => {
    it('should create escrow account successfully', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'created',
        createdAt: new Date(),
      };

      mockPaymentRepository.prototype.createEscrow = vi.fn().mockResolvedValue(mockEscrow);
      mockHederaService.prototype.recordEscrowCreation = vi.fn().mockResolvedValue('tx-escrow-123');

      const result = await paymentService.createEscrow(300, 'USD', 'user-123');

      expect(result).toEqual(mockEscrow);
      expect(mockPaymentRepository.prototype.createEscrow).toHaveBeenCalledWith({
        amount: 300,
        currency: 'USD',
        payerId: 'user-123',
        status: 'created',
      });
      expect(mockHederaService.prototype.recordEscrowCreation).toHaveBeenCalled();
    });

    it('should handle escrow creation failure', async () => {
      mockPaymentRepository.prototype.createEscrow = vi.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        paymentService.createEscrow(300, 'USD', 'user-123')
      ).rejects.toThrow('ESCROW_CREATION_FAILED');
    });

    it('should validate escrow amount limits', async () => {
      await expect(
        paymentService.createEscrow(50, 'USD', 'user-123') // Below minimum
      ).rejects.toThrow('Amount below minimum escrow limit');

      await expect(
        paymentService.createEscrow(15000, 'USD', 'user-123') // Above maximum
      ).rejects.toThrow('Amount exceeds maximum escrow limit');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow to recipient successfully', async () => {
      const fundedEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'funded',
        createdAt: new Date(),
      };

      const releasedEscrow: EscrowAccount = {
        ...fundedEscrow,
        status: 'released',
        releasedAt: new Date(),
      };

      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'completed',
        escrowId: 'escrow-123',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15, // 5% of 300
        netAmount: 285,
        createdAt: new Date(),
        completedAt: new Date(),
        blockchain: { transactionId: 'tx-release-123' },
      };

      mockPaymentRepository.prototype.findEscrowById = vi.fn().mockResolvedValue(fundedEscrow);
      mockPaymentRepository.prototype.releaseEscrow = vi.fn().mockResolvedValue(releasedEscrow);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockResolvedValue(mockTransaction);
      mockHederaService.prototype.recordEscrowRelease = vi.fn().mockResolvedValue('tx-release-123');
      mockNotificationService.prototype.sendPaymentCompletedNotification = vi.fn();

      const result = await paymentService.releaseEscrow('escrow-123', 'user-456');

      expect(result).toEqual(mockTransaction);
      expect(mockPaymentRepository.prototype.releaseEscrow).toHaveBeenCalledWith('escrow-123', 'user-456');
      expect(mockHederaService.prototype.recordEscrowRelease).toHaveBeenCalled();
      expect(mockNotificationService.prototype.sendPaymentCompletedNotification).toHaveBeenCalled();
    });

    it('should reject release of non-funded escrow', async () => {
      const createdEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'created', // Not funded yet
        createdAt: new Date(),
      };

      mockPaymentRepository.prototype.findEscrowById = vi.fn().mockResolvedValue(createdEscrow);

      await expect(
        paymentService.releaseEscrow('escrow-123', 'user-456')
      ).rejects.toThrow('Escrow is not in funded status');
    });

    it('should reject release of already released escrow', async () => {
      const releasedEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'released',
        createdAt: new Date(),
        releasedAt: new Date(),
      };

      mockPaymentRepository.prototype.findEscrowById = vi.fn().mockResolvedValue(releasedEscrow);

      await expect(
        paymentService.releaseEscrow('escrow-123', 'user-456')
      ).rejects.toThrow('Escrow has already been released');
    });
  });

  describe('refundEscrow', () => {
    it('should refund escrow to payer successfully', async () => {
      const fundedEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'funded',
        createdAt: new Date(),
      };

      const refundedEscrow: EscrowAccount = {
        ...fundedEscrow,
        status: 'refunded',
        refundedAt: new Date(),
      };

      const mockRefundTransaction: PaymentTransaction = {
        id: 'refund-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-123', // Refund to payer
        amount: 300,
        currency: 'USD',
        status: 'completed',
        escrowId: 'escrow-123',
        gatewayTransactionId: 'gateway-refund-123',
        platformFee: 0, // No fee on refunds
        netAmount: 300,
        createdAt: new Date(),
        completedAt: new Date(),
        blockchain: { transactionId: 'tx-refund-123' },
      };

      mockPaymentRepository.prototype.findEscrowById = vi.fn().mockResolvedValue(fundedEscrow);
      mockPaymentRepository.prototype.refundEscrow = vi.fn().mockResolvedValue(refundedEscrow);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockResolvedValue(mockRefundTransaction);
      mockHederaService.prototype.recordEscrowRefund = vi.fn().mockResolvedValue('tx-refund-123');
      mockNotificationService.prototype.sendRefundCompletedNotification = vi.fn();

      const result = await paymentService.refundEscrow('escrow-123', 'Swap cancelled');

      expect(result).toEqual(mockRefundTransaction);
      expect(mockPaymentRepository.prototype.refundEscrow).toHaveBeenCalledWith('escrow-123', 'Swap cancelled');
      expect(mockHederaService.prototype.recordEscrowRefund).toHaveBeenCalled();
      expect(mockNotificationService.prototype.sendRefundCompletedNotification).toHaveBeenCalled();
    });

    it('should handle refund processing failure', async () => {
      const fundedEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'funded',
        createdAt: new Date(),
      };

      mockPaymentRepository.prototype.findEscrowById = vi.fn().mockResolvedValue(fundedEscrow);
      mockPaymentRepository.prototype.refundEscrow = vi.fn().mockRejectedValue(new Error('Gateway error'));

      await expect(
        paymentService.refundEscrow('escrow-123', 'Test refund')
      ).rejects.toThrow('REFUND_FAILED');
    });
  });

  describe('processPayment', () => {
    const mockPaymentRequest: PaymentRequest = {
      swapId: 'swap-123',
      proposalId: 'proposal-123',
      payerId: 'user-123',
      recipientId: 'user-456',
      amount: 300,
      currency: 'USD',
      paymentMethodId: 'pm-123',
      escrowRequired: true,
    };

    it('should process payment with escrow successfully', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 300,
        currency: 'USD',
        status: 'funded',
        createdAt: new Date(),
      };

      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'processing',
        escrowId: 'escrow-123',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.prototype.createEscrow = vi.fn().mockResolvedValue(mockEscrow);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockResolvedValue(mockTransaction);
      mockHederaService.prototype.recordPaymentTransaction = vi.fn().mockResolvedValue('tx-payment-123');

      const result = await paymentService.processPayment(mockPaymentRequest);

      expect(result).toEqual(mockTransaction);
      expect(result.escrowId).toBe('escrow-123');
      expect(result.status).toBe('processing');
      expect(mockHederaService.prototype.recordPaymentTransaction).toHaveBeenCalled();
    });

    it('should process direct payment without escrow', async () => {
      const directPaymentRequest: PaymentRequest = {
        ...mockPaymentRequest,
        escrowRequired: false,
      };

      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'completed',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        completedAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockResolvedValue(mockTransaction);
      mockHederaService.prototype.recordPaymentTransaction = vi.fn().mockResolvedValue('tx-payment-123');

      const result = await paymentService.processPayment(directPaymentRequest);

      expect(result).toEqual(mockTransaction);
      expect(result.escrowId).toBeUndefined();
      expect(result.status).toBe('completed');
    });

    it('should handle payment processing failure', async () => {
      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockRejectedValue(new Error('Gateway error'));

      await expect(
        paymentService.processPayment(mockPaymentRequest)
      ).rejects.toThrow('PAYMENT_PROCESSING_FAILED');
    });

    it('should validate payment amount limits', async () => {
      const lowAmountRequest: PaymentRequest = {
        ...mockPaymentRequest,
        amount: 50, // Below minimum
      };

      await expect(
        paymentService.processPayment(lowAmountRequest)
      ).rejects.toThrow('Payment amount below minimum limit');

      const highAmountRequest: PaymentRequest = {
        ...mockPaymentRequest,
        amount: 15000, // Above maximum
      };

      await expect(
        paymentService.processPayment(highAmountRequest)
      ).rejects.toThrow('Payment amount exceeds maximum limit');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'completed',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        completedAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      mockPaymentRepository.prototype.findTransactionById = vi.fn().mockResolvedValue(mockTransaction);

      const result = await paymentService.getTransactionStatus('payment-123');

      expect(result.status).toBe('completed');
      expect(result.amount).toBe(300);
      expect(result.completedAt).toBeDefined();
    });

    it('should handle non-existent transaction', async () => {
      mockPaymentRepository.prototype.findTransactionById = vi.fn().mockResolvedValue(null);

      await expect(
        paymentService.getTransactionStatus('non-existent')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('generateReceipt', () => {
    it('should generate payment receipt', async () => {
      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'completed',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        completedAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      const mockReceipt = {
        transactionId: 'payment-123',
        amount: 300,
        currency: 'USD',
        fees: {
          platformFee: 15,
          processingFee: 0,
        },
        netAmount: 285,
        receiptUrl: 'https://receipts.example.com/payment-123.pdf',
        generatedAt: new Date(),
      };

      mockPaymentRepository.prototype.findTransactionById = vi.fn().mockResolvedValue(mockTransaction);
      mockPaymentRepository.prototype.generateReceipt = vi.fn().mockResolvedValue(mockReceipt);

      const result = await paymentService.generateReceipt('payment-123');

      expect(result).toEqual(mockReceipt);
      expect(result.receiptUrl).toBeDefined();
      expect(result.fees.platformFee).toBe(15);
    });

    it('should only generate receipts for completed transactions', async () => {
      const pendingTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'processing', // Not completed
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      mockPaymentRepository.prototype.findTransactionById = vi.fn().mockResolvedValue(pendingTransaction);

      await expect(
        paymentService.generateReceipt('payment-123')
      ).rejects.toThrow('Cannot generate receipt for incomplete transaction');
    });
  });

  describe('fraud detection', () => {
    it('should detect suspicious payment patterns', async () => {
      const suspiciousRequest: PaymentRequest = {
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 9999, // High amount
        currency: 'USD',
        paymentMethodId: 'pm-123',
        escrowRequired: true,
      };

      // Mock multiple recent transactions from same user
      const recentTransactions = Array(10).fill(null).map((_, i) => ({
        id: `tx-${i}`,
        payerId: 'user-123',
        amount: 1000,
        createdAt: new Date(Date.now() - i * 60 * 1000), // 1 minute apart
      }));

      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.prototype.getRecentTransactionsByUser = vi.fn().mockResolvedValue(recentTransactions);

      await expect(
        paymentService.processPayment(suspiciousRequest)
      ).rejects.toThrow('Suspicious activity detected');
    });

    it('should allow normal payment patterns', async () => {
      const normalRequest: PaymentRequest = {
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        paymentMethodId: 'pm-123',
        escrowRequired: true,
      };

      const normalTransactions = [
        {
          id: 'tx-1',
          payerId: 'user-123',
          amount: 250,
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
      ];

      const mockTransaction: PaymentTransaction = {
        id: 'payment-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 300,
        currency: 'USD',
        status: 'processing',
        gatewayTransactionId: 'gateway-tx-123',
        platformFee: 15,
        netAmount: 285,
        createdAt: new Date(),
        blockchain: { transactionId: 'tx-payment-123' },
      };

      mockPaymentRepository.prototype.findByUserAndId = vi.fn().mockResolvedValue(mockPaymentMethod);
      mockPaymentRepository.prototype.getRecentTransactionsByUser = vi.fn().mockResolvedValue(normalTransactions);
      mockPaymentRepository.prototype.createTransaction = vi.fn().mockResolvedValue(mockTransaction);
      mockHederaService.prototype.recordPaymentTransaction = vi.fn().mockResolvedValue('tx-payment-123');

      const result = await paymentService.processPayment(normalRequest);

      expect(result).toEqual(mockTransaction);
    });
  });
});