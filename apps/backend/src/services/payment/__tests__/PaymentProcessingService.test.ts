import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentProcessingService } from '../PaymentProcessingService';
import { PaymentRepository } from '../../../database/repositories/PaymentRepository';
import { HederaService } from '../../hedera/HederaService';
import { 
  PaymentRequest,
  PaymentMethod,
  PaymentTransaction,
  EscrowAccount,
  PaymentStatus,
  EscrowStatus
} from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/PaymentRepository');
vi.mock('../../hedera/HederaService');
vi.mock('../../../utils/logger');

describe('PaymentProcessingService', () => {
  let paymentService: PaymentProcessingService;
  let mockPaymentRepository: any;
  let mockHederaService: any;

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
      findPaymentMethodsByUser: vi.fn()
    };

    mockHederaService = {
      recordEscrowCreation: vi.fn(),
      recordPaymentTransaction: vi.fn(),
      recordEscrowRelease: vi.fn()
    };
    
    paymentService = new PaymentProcessingService(
      mockPaymentRepository,
      mockHederaService,
      mockGatewayConfig
    );

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('validatePaymentMethod', () => {
    it('should validate a verified payment method successfully', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: {
          cardToken: 'token-123',
          expiryDate: '12/25'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);

      const result = await paymentService.validatePaymentMethod('user-123', 'pm-123');

      expect(result).toEqual(mockPaymentMethod);
      expect(mockPaymentRepository.findById).toHaveBeenCalledWith('pm-123');
    });

    it('should throw error for non-existent payment method', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.validatePaymentMethod('user-123', 'pm-123')
      ).rejects.toThrow('Payment method not found');
    });

    it('should throw error for payment method belonging to different user', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-456', // Different user
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);

      await expect(
        paymentService.validatePaymentMethod('user-123', 'pm-123')
      ).rejects.toThrow('Payment method does not belong to user');
    });

    it('should throw error for unverified payment method', async () => {
      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: false, // Not verified
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPaymentMethod);

      await expect(
        paymentService.validatePaymentMethod('user-123', 'pm-123')
      ).rejects.toThrow('Payment method is not verified');
    });
  });

  describe('validateCashOffer', () => {
    beforeEach(() => {
      // Mock user stats for risk assessment
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 500,
        totalReceived: 300,
        completedPayments: 5,
        pendingPayments: 0,
        averagePaymentAmount: 100
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
    });

    it('should validate a valid cash offer', async () => {
      const result = await paymentService.validateCashOffer(
        200, // amount
        'USD', // currency
        150, // minimum required
        'pm-123', // payment method ID
        'user-123' // user ID
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.estimatedFees).toBeDefined();
      expect(result.estimatedFees.platformFee).toBeGreaterThan(0);
      expect(result.requiresEscrow).toBe(true); // Amount >= 100
    });

    it('should reject cash offer below minimum platform amount', async () => {
      const result = await paymentService.validateCashOffer(
        5, // Below minimum of 10
        'USD',
        0,
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum cash amount is 10 USD');
    });

    it('should reject cash offer above maximum platform amount', async () => {
      const result = await paymentService.validateCashOffer(
        15000, // Above maximum of 10000
        'USD',
        0,
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum cash amount is 10000 USD');
    });

    it('should reject cash offer below swap minimum requirement', async () => {
      const result = await paymentService.validateCashOffer(
        100,
        'USD',
        150, // Minimum required is higher
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be at least 150 USD as specified by swap owner');
    });

    it('should reject unsupported currency', async () => {
      const result = await paymentService.validateCashOffer(
        200,
        'XYZ', // Unsupported currency
        150,
        'pm-123',
        'user-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Currency XYZ is not supported');
    });

    it('should add warning for high-risk transactions', async () => {
      // Mock high-risk user stats
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 0,
        totalReceived: 0,
        completedPayments: 0, // New user
        pendingPayments: 0,
        averagePaymentAmount: 0
      });

      const result = await paymentService.validateCashOffer(
        2000, // High amount for new user
        'USD',
        100,
        'pm-123',
        'user-123'
      );

      expect(result.warnings).toContain('This transaction requires manual review due to risk factors');
    });
  });

  describe('createEscrow', () => {
    it('should create escrow account successfully', async () => {
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

      // Mock user stats for validation
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 1000,
        totalReceived: 500,
        completedPayments: 10,
        pendingPayments: 0,
        averagePaymentAmount: 150
      });

      const escrowRequest = {
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
      expect(result.amount).toBe(500);
      expect(result.currency).toBe('USD');
      expect(result.expiresAt).toBeDefined();

      expect(mockPaymentRepository.createEscrow).toHaveBeenCalled();
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

    it('should throw error if escrow validation fails', async () => {
      const escrowRequest = {
        amount: 5, // Below minimum
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        swapId: 'swap-123',
        proposalId: 'proposal-123'
      };

      await expect(
        paymentService.createEscrow(escrowRequest)
      ).rejects.toThrow('Minimum escrow amount is 10 USD');
    });
  });

  describe('processPayment', () => {
    beforeEach(() => {
      // Mock payment method
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

      // Mock user stats
      mockPaymentRepository.getUserPaymentStats.mockResolvedValue({
        totalPaid: 1000,
        totalReceived: 500,
        completedPayments: 10,
        pendingPayments: 0,
        averagePaymentAmount: 150
      });

      // Mock transaction creation
      const mockTransaction: PaymentTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 200,
        currency: 'USD',
        status: 'processing',
        escrowId: undefined,
        gatewayTransactionId: 'gw-123',
        platformFee: 10,
        netAmount: 190,
        completedAt: undefined,
        blockchain: { transactionId: '' },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPaymentRepository.createPaymentTransaction.mockResolvedValue(mockTransaction);

      // Mock blockchain recording
      mockHederaService.recordPaymentTransaction.mockResolvedValue('blockchain-tx-123');

      // Mock repository update
      mockPaymentRepository.update.mockResolvedValue(mockTransaction);
    });

    it('should process payment successfully without escrow', async () => {
      const paymentRequest: PaymentRequest = {
        amount: 200,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        paymentMethodId: 'pm-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: false
      };

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.transactionId).toBe('tx-123');
      expect(result.status).toBe('processing');
      expect(result.escrowId).toBeUndefined();
      expect(result.fees.platformFee).toBeGreaterThan(0);
      expect(result.estimatedCompletionTime).toBeDefined();

      expect(mockPaymentRepository.createPaymentTransaction).toHaveBeenCalled();
      expect(mockHederaService.recordPaymentTransaction).toHaveBeenCalled();
    });

    it('should process payment successfully with escrow', async () => {
      // Mock escrow creation
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 200,
        currency: 'USD',
        status: 'created',
        releasedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      mockPaymentRepository.createEscrow.mockResolvedValue(mockEscrow);
      mockHederaService.recordEscrowCreation.mockResolvedValue('blockchain-escrow-123');

      const paymentRequest: PaymentRequest = {
        amount: 200,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        paymentMethodId: 'pm-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: true
      };

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.transactionId).toBe('tx-123');
      expect(result.escrowId).toBe('escrow-123');
      expect(mockPaymentRepository.createEscrow).toHaveBeenCalled();
    });

    it('should throw error if payment method validation fails', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      const paymentRequest: PaymentRequest = {
        amount: 200,
        currency: 'USD',
        payerId: 'user-123',
        recipientId: 'user-456',
        paymentMethodId: 'pm-invalid',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        escrowRequired: false
      };

      await expect(
        paymentService.processPayment(paymentRequest)
      ).rejects.toThrow('Payment method not found');
    });
  });

  describe('releaseEscrow', () => {
    it('should release escrow funds successfully', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 500,
        currency: 'USD',
        status: 'funded',
        releasedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
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

      const updatedPayment = { ...mockPayment, status: 'completed' as PaymentStatus, completedAt: new Date() };

      mockPaymentRepository.findEscrowAccounts.mockResolvedValue([mockEscrow]);
      mockPaymentRepository.findPayments.mockResolvedValue([mockPayment]);
      mockPaymentRepository.updateEscrowStatus.mockResolvedValue({
        ...mockEscrow,
        status: 'released',
        releasedAt: new Date()
      });
      mockPaymentRepository.updatePaymentStatus.mockResolvedValue(updatedPayment);
      mockHederaService.recordEscrowRelease.mockResolvedValue('blockchain-release-123');

      const releaseRequest = {
        escrowId: 'escrow-123',
        recipientId: 'user-456',
        reason: 'Swap completed successfully'
      };

      const result = await paymentService.releaseEscrow(releaseRequest);

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();

      expect(mockPaymentRepository.updateEscrowStatus).toHaveBeenCalledWith(
        'escrow-123',
        'released',
        expect.any(Date)
      );
      expect(mockPaymentRepository.updatePaymentStatus).toHaveBeenCalledWith(
        'tx-123',
        'completed',
        expect.any(Date)
      );
      expect(mockHederaService.recordEscrowRelease).toHaveBeenCalled();
    });

    it('should throw error for non-existent escrow', async () => {
      mockPaymentRepository.findEscrowAccounts.mockResolvedValue([]);

      const releaseRequest = {
        escrowId: 'escrow-invalid',
        recipientId: 'user-456',
        reason: 'Test release'
      };

      await expect(
        paymentService.releaseEscrow(releaseRequest)
      ).rejects.toThrow('Escrow account not found');
    });

    it('should throw error for escrow not in funded status', async () => {
      const mockEscrow: EscrowAccount = {
        id: 'escrow-123',
        transactionId: 'tx-123',
        amount: 500,
        currency: 'USD',
        status: 'created', // Not funded
        releasedAt: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findEscrowAccounts.mockResolvedValue([mockEscrow]);

      const releaseRequest = {
        escrowId: 'escrow-123',
        recipientId: 'user-456',
        reason: 'Test release'
      };

      await expect(
        paymentService.releaseEscrow(releaseRequest)
      ).rejects.toThrow('Cannot release escrow with status: created');
    });
  });

  describe('generateReceipt', () => {
    it('should generate receipt for completed transaction', async () => {
      const mockTransaction: PaymentTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 200,
        currency: 'USD',
        status: 'completed',
        escrowId: undefined,
        gatewayTransactionId: 'gw-123',
        platformFee: 10,
        netAmount: 190,
        completedAt: new Date(),
        blockchain: { transactionId: 'blockchain-tx-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockPaymentMethod: PaymentMethod = {
        id: 'pm-123',
        userId: 'user-123',
        type: 'credit_card',
        displayName: 'Visa ****1234',
        isVerified: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockTransaction);
      mockPaymentRepository.findPaymentMethodsByUser.mockResolvedValue([mockPaymentMethod]);

      const receipt = await paymentService.generateReceipt('tx-123');

      expect(receipt.transactionId).toBe('tx-123');
      expect(receipt.swapId).toBe('swap-123');
      expect(receipt.amount).toBe(200);
      expect(receipt.currency).toBe('USD');
      expect(receipt.fees.platformFee).toBe(10);
      expect(receipt.fees.netAmount).toBe(190);
      expect(receipt.paymentMethod).toBe('Visa ****1234');
      expect(receipt.completedAt).toBeDefined();
      expect(receipt.receiptUrl).toContain('/receipts/tx-123');
    });

    it('should throw error for non-existent transaction', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.generateReceipt('tx-invalid')
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw error for incomplete transaction', async () => {
      const mockTransaction: PaymentTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 200,
        currency: 'USD',
        status: 'processing', // Not completed
        escrowId: undefined,
        gatewayTransactionId: 'gw-123',
        platformFee: 10,
        netAmount: 190,
        completedAt: undefined,
        blockchain: { transactionId: 'blockchain-tx-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockTransaction);

      await expect(
        paymentService.generateReceipt('tx-123')
      ).rejects.toThrow('Cannot generate receipt for incomplete transaction');
    });
  });

  describe('getTransactionStatus', () => {
    it('should return transaction status', async () => {
      const mockTransaction: PaymentTransaction = {
        id: 'tx-123',
        swapId: 'swap-123',
        proposalId: 'proposal-123',
        payerId: 'user-123',
        recipientId: 'user-456',
        amount: 200,
        currency: 'USD',
        status: 'completed',
        escrowId: undefined,
        gatewayTransactionId: 'gw-123',
        platformFee: 10,
        netAmount: 190,
        completedAt: new Date(),
        blockchain: { transactionId: 'blockchain-tx-123' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPaymentRepository.findById.mockResolvedValue(mockTransaction);

      const status = await paymentService.getTransactionStatus('tx-123');

      expect(status).toBe('completed');
    });

    it('should throw error for non-existent transaction', async () => {
      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(
        paymentService.getTransactionStatus('tx-invalid')
      ).rejects.toThrow('Transaction not found');
    });
  });
});