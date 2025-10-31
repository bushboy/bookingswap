import {
  PaymentTransaction,
  PaymentRequest,
  PaymentValidation,
  PaymentProcessingResult,
  EscrowAccount,
  EscrowRequest,
  EscrowReleaseRequest,
  EscrowCreationResult,
  PaymentMethod,
  PaymentFees,
  PaymentReceipt,
  PaymentErrorDetails,
  RiskAssessment,
  PaymentSecurityContext,
  FraudDetectionResult,
  PaymentStatus,
  EscrowStatus
} from '@booking-swap/shared';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';
import { HederaService } from '../hedera/HederaService';
import { FraudDetectionService } from './FraudDetectionService';
import { PaymentSecurityService } from './PaymentSecurityService';
import { PaymentErrorHandler, PaymentError } from './PaymentErrorHandler';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentGatewayConfig {
  apiKey: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
  webhookSecret: string;
}

export interface PlatformFeeConfig {
  percentage: number; // e.g., 0.05 for 5%
  minimumFee: number;
  maximumFee: number;
}

export class PaymentProcessingService {
  private readonly PLATFORM_FEE_CONFIG: PlatformFeeConfig = {
    percentage: 0.05, // 5%
    minimumFee: 1.00,
    maximumFee: 50.00
  };

  private readonly MINIMUM_CASH_AMOUNT = 10.00;
  private readonly MAXIMUM_CASH_AMOUNT = 10000.00;
  private readonly ESCROW_TIMEOUT_HOURS = 72; // 3 days

  private fraudDetectionService: FraudDetectionService;
  private paymentSecurityService: PaymentSecurityService;
  private errorHandler: PaymentErrorHandler;

  constructor(
    private paymentRepository: PaymentRepository,
    private hederaService: HederaService,
    private gatewayConfig: PaymentGatewayConfig,
    private paymentNotificationService: PaymentNotificationService,
    encryptionKey: string = process.env.PAYMENT_ENCRYPTION_KEY || 'default-key-change-in-production'
  ) {
    this.fraudDetectionService = new FraudDetectionService(paymentRepository);
    this.paymentSecurityService = new PaymentSecurityService(
      paymentRepository,
      this.fraudDetectionService,
      hederaService,
      encryptionKey
    );
    this.errorHandler = new PaymentErrorHandler();
  }

  /**
   * Validate payment method for cash offers
   */
  async validatePaymentMethod(
    userId: string,
    paymentMethodId: string,
    securityContext?: PaymentSecurityContext
  ): Promise<PaymentMethod> {
    try {
      logger.info('Validating payment method', { userId, paymentMethodId });

      // Skip database validation for default payment methods
      if (paymentMethodId === 'default-payment-method' || paymentMethodId.startsWith('default-')) {
        logger.info('Using default payment method, skipping database validation', { paymentMethodId });
        return {
          id: paymentMethodId,
          userId,
          type: 'credit_card',
          displayName: 'Default Payment Method',
          isVerified: true,
          metadata: { isDefault: true },
          createdAt: new Date(),
          updatedAt: new Date()
        } as PaymentMethod;
      }

      const paymentMethod = await this.paymentRepository.findById(paymentMethodId);
      if (!paymentMethod) {
        const error = this.errorHandler.createPaymentError(
          'PAYMENT_METHOD_INVALID',
          'Payment method not found',
          { userId, paymentMethodId, operation: 'payment_method_validation' }
        );
        throw error;
      }

      if (paymentMethod.userId !== userId) {
        const error = this.errorHandler.createPaymentError(
          'PAYMENT_METHOD_INVALID',
          'Payment method does not belong to user',
          { userId, paymentMethodId, operation: 'payment_method_validation' }
        );
        throw error;
      }

      if (!paymentMethod.isVerified) {
        const error = this.errorHandler.createPaymentError(
          'PAYMENT_METHOD_INVALID',
          'Payment method is not verified',
          { userId, paymentMethodId, operation: 'payment_method_validation' }
        );
        throw error;
      }

      // Enhanced security validation if context provided
      if (securityContext) {
        const securityValidation = await this.paymentSecurityService.validatePaymentMethodSecurity(
          paymentMethod,
          securityContext
        );

        if (!securityValidation.isValid) {
          const error = this.errorHandler.createPaymentError(
            'PAYMENT_METHOD_INVALID',
            `Payment method security validation failed: ${securityValidation.errors.join(', ')}`,
            { userId, paymentMethodId, operation: 'payment_method_validation' }
          );
          throw error;
        }

        if (securityValidation.securityScore < 70) {
          logger.warn('Payment method has low security score', {
            paymentMethodId,
            securityScore: securityValidation.securityScore,
            warnings: securityValidation.warnings
          });
        }
      }

      // Additional validation based on payment method type
      await this.validatePaymentMethodType(paymentMethod);

      logger.info('Payment method validated successfully', { paymentMethodId });
      return paymentMethod;
    } catch (error) {
      if (error instanceof PaymentError) {
        this.errorHandler.logPaymentError(error);
        throw error;
      }

      logger.error('Payment method validation failed', { error, userId, paymentMethodId });
      throw error;
    }
  }

  /**
   * Validate cash offer against swap requirements
   */
  async validateCashOffer(
    amount: number,
    currency: string,
    minimumRequired: number,
    paymentMethodId: string,
    userId: string
  ): Promise<PaymentValidation> {
    try {
      logger.info('Validating cash offer', { amount, currency, minimumRequired, userId });

      const errors: string[] = [];
      const warnings: string[] = [];

      // Validate amount range
      if (amount < this.MINIMUM_CASH_AMOUNT) {
        errors.push(`Minimum cash amount is ${this.MINIMUM_CASH_AMOUNT} ${currency}`);
      }

      if (amount > this.MAXIMUM_CASH_AMOUNT) {
        errors.push(`Maximum cash amount is ${this.MAXIMUM_CASH_AMOUNT} ${currency}`);
      }

      if (amount < minimumRequired) {
        errors.push(`Amount must be at least ${minimumRequired} ${currency} as specified by swap owner`);
      }

      // Validate currency
      if (!this.isSupportedCurrency(currency)) {
        errors.push(`Currency ${currency} is not supported`);
      }

      // Validate payment method
      try {
        await this.validatePaymentMethod(userId, paymentMethodId);
      } catch (error) {
        errors.push(`Payment method validation failed: ${error.message}`);
      }

      // Calculate fees
      const fees = this.calculatePaymentFees(amount, currency);

      // Enhanced fraud detection
      const securityContext: PaymentSecurityContext = {
        userId,
        ipAddress: '0.0.0.0', // Would be provided by request context
        deviceFingerprint: undefined,
        previousTransactions: 0, // Would be calculated
        accountAge: 30 // Would be calculated from user creation date
      };

      const mockRequest: PaymentRequest = {
        amount,
        currency,
        payerId: userId,
        recipientId: 'temp',
        paymentMethodId,
        swapId: 'temp',
        proposalId: 'temp',
        escrowRequired: false
      };

      const fraudResult = await this.fraudDetectionService.detectFraud(securityContext, mockRequest);

      if (fraudResult.isSuspicious) {
        if (fraudResult.recommendedAction === 'reject') {
          errors.push('Transaction rejected due to high fraud risk');
        } else if (fraudResult.recommendedAction === 'review') {
          warnings.push('This transaction requires manual review due to risk factors');
        }
      }

      // Record fraud alert on blockchain if high risk
      if (fraudResult.riskScore >= 80) {
        try {
          await this.hederaService.recordFraudAlert(
            `validation_${uuidv4()}`,
            fraudResult.riskScore,
            fraudResult.flags
          );
        } catch (blockchainError) {
          logger.warn('Failed to record fraud alert on blockchain', { blockchainError });
        }
      }

      const isValid = errors.length === 0;
      const requiresEscrow = amount >= 100; // Require escrow for amounts >= $100

      logger.info('Cash offer validation completed', {
        isValid,
        errorsCount: errors.length,
        warningsCount: warnings.length,
        requiresEscrow
      });

      return {
        isValid,
        errors,
        warnings,
        estimatedFees: fees,
        requiresEscrow
      };
    } catch (error) {
      logger.error('Cash offer validation failed', { error, amount, currency, userId });
      throw error;
    }
  }

  /**
   * Create escrow account for cash transactions
   */
  async createEscrow(request: EscrowRequest): Promise<EscrowCreationResult> {
    try {
      logger.info('Creating escrow account', { request });

      // Basic validation for escrow creation
      if (request.amount < this.MINIMUM_CASH_AMOUNT) {
        throw new Error(`Minimum escrow amount is ${this.MINIMUM_CASH_AMOUNT} ${request.currency}`);
      }

      if (request.amount > this.MAXIMUM_CASH_AMOUNT) {
        throw new Error(`Maximum escrow amount is ${this.MAXIMUM_CASH_AMOUNT} ${request.currency}`);
      }

      if (!this.isSupportedCurrency(request.currency)) {
        throw new Error(`Currency ${request.currency} is not supported`);
      }

      // First create a payment transaction record
      const transactionData = {
        swapId: request.swapId,
        proposalId: request.proposalId,
        payerId: request.payerId,
        recipientId: request.recipientId,
        amount: request.amount,
        currency: request.currency,
        status: 'pending' as const,
        escrowId: null, // Will be updated after escrow creation
        gatewayTransactionId: `escrow_${uuidv4()}`, // Temporary ID for escrow transactions
        platformFee: 0,
        netAmount: request.amount,
        completedAt: null,
        blockchain: {
          transactionId: `pending_${uuidv4()}`, // Temporary ID until blockchain transaction is recorded
        },
      };

      const transaction = await this.paymentRepository.create(transactionData);

      // Create escrow account in database
      const escrowData: Omit<EscrowAccount, 'id' | 'createdAt' | 'updatedAt'> = {
        transactionId: transaction.id,
        amount: request.amount,
        currency: request.currency,
        status: 'created',
        releasedAt: undefined
      };

      const escrow = await this.paymentRepository.createEscrow(escrowData);

      // Update the transaction with the escrow ID
      await this.paymentRepository.update(transaction.id, { escrowId: escrow.id });

      // Record escrow creation on blockchain
      const blockchainTxId = await this.hederaService.recordEscrowCreation({
        escrowId: escrow.id,
        amount: request.amount,
        currency: request.currency,
        payerId: request.payerId,
        recipientId: request.recipientId,
        swapId: request.swapId,
        proposalId: request.proposalId
      });

      logger.info('Escrow account created successfully', {
        escrowId: escrow.id,
        blockchainTxId
      });

      return {
        escrowId: escrow.id,
        status: escrow.status,
        amount: escrow.amount,
        currency: escrow.currency,
        expiresAt: new Date(Date.now() + this.ESCROW_TIMEOUT_HOURS * 60 * 60 * 1000)
      };
    } catch (error) {
      logger.error('Escrow creation failed', { error, request });
      throw error;
    }
  }

  /**
   * Process payment transaction with platform fees
   */
  async processPayment(
    request: PaymentRequest,
    securityContext?: PaymentSecurityContext
  ): Promise<PaymentProcessingResult> {
    return await this.errorHandler.executeWithRetry(async () => {
      try {
        logger.info('Processing payment transaction', { request });

        // Validate payment method with security context
        const paymentMethod = await this.validatePaymentMethod(
          request.payerId,
          request.paymentMethodId,
          securityContext
        );

        // Validate cash offer
        const validation = await this.validateCashOffer(
          request.amount,
          request.currency,
          0, // No minimum for processing
          request.paymentMethodId,
          request.payerId
        );

        if (!validation.isValid) {
          const error = this.errorHandler.createPaymentError(
            'PAYMENT_PROCESSING_FAILED',
            `Payment validation failed: ${validation.errors.join(', ')}`,
            {
              userId: request.payerId,
              paymentMethodId: request.paymentMethodId,
              amount: request.amount,
              currency: request.currency,
              operation: 'payment_processing'
            }
          );
          throw error;
        }

        // Calculate fees
        const fees = this.calculatePaymentFees(request.amount, request.currency);

        // Create escrow if required
        let escrowId: string | undefined;
        if (request.escrowRequired) {
          try {
            const escrowResult = await this.createEscrow({
              amount: request.amount,
              currency: request.currency,
              payerId: request.payerId,
              recipientId: request.recipientId,
              swapId: request.swapId,
              proposalId: request.proposalId
            });
            escrowId = escrowResult.escrowId;
          } catch (escrowError) {
            const error = this.errorHandler.createPaymentError(
              'ESCROW_CREATION_FAILED',
              `Escrow creation failed: ${escrowError.message}`,
              {
                userId: request.payerId,
                amount: request.amount,
                currency: request.currency,
                operation: 'escrow_creation'
              },
              true // retryable
            );
            throw error;
          }
        }

        // Process payment through gateway
        let gatewayTransactionId: string;
        try {
          gatewayTransactionId = await this.processPaymentThroughGateway(
            request,
            paymentMethod,
            fees
          );
        } catch (gatewayError) {
          const error = this.errorHandler.createPaymentError(
            'PAYMENT_PROCESSING_FAILED',
            `Gateway processing failed: ${gatewayError.message}`,
            {
              userId: request.payerId,
              paymentMethodId: request.paymentMethodId,
              amount: request.amount,
              currency: request.currency,
              operation: 'gateway_processing'
            },
            true // retryable
          );
          throw error;
        }

        // Create payment transaction record
        const transactionData: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'> = {
          swapId: request.swapId,
          proposalId: request.proposalId,
          payerId: request.payerId,
          recipientId: request.recipientId,
          amount: request.amount,
          currency: request.currency,
          status: 'processing',
          escrowId,
          gatewayTransactionId,
          platformFee: fees.platformFee,
          netAmount: fees.netAmount,
          completedAt: undefined,
          blockchain: {
            transactionId: '' // Will be updated when recorded on blockchain
          }
        };

        const transaction = await this.paymentRepository.createPaymentTransaction(transactionData);

        // Record transaction on blockchain
        const blockchainTxId = await this.hederaService.recordPaymentTransaction({
          transactionId: transaction.id,
          swapId: request.swapId,
          proposalId: request.proposalId,
          amount: request.amount,
          currency: request.currency,
          payerId: request.payerId,
          recipientId: request.recipientId,
          fees: fees
        });

        // Update transaction with blockchain ID
        await this.paymentRepository.update(transaction.id, {
          blockchain: { transactionId: blockchainTxId }
        });

        logger.info('Payment transaction processed successfully', {
          transactionId: transaction.id,
          gatewayTransactionId,
          blockchainTxId
        });

        // Send payment processing notification
        await this.paymentNotificationService.sendPaymentStatusNotification({
          transactionId: transaction.id,
          userId: request.payerId,
          amount: request.amount,
          currency: request.currency,
          swapId: request.swapId,
          proposalId: request.proposalId,
          status: transaction.status === 'completed' ? 'completed' : 'processing',
        });

        return {
          transactionId: transaction.id,
          status: transaction.status,
          gatewayTransactionId,
          escrowId,
          fees,
          estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        };
      } catch (error) {
        // Send payment failure notification
        await this.paymentNotificationService.sendPaymentStatusNotification({
          transactionId: 'failed-' + uuidv4(),
          userId: request.payerId,
          amount: request.amount,
          currency: request.currency,
          swapId: request.swapId,
          proposalId: request.proposalId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        if (error instanceof PaymentError) {
          this.errorHandler.logPaymentError(error, { request });
          throw error;
        }

        logger.error('Payment processing failed', { error, request });
        throw error;
      }
    }, 3); // Retry up to 3 times
  }

  /**
   * Release escrow funds to recipient
   */
  async releaseEscrow(request: EscrowReleaseRequest): Promise<PaymentTransaction> {
    try {
      logger.info('Releasing escrow funds', { request });

      // Find escrow account
      const escrowAccounts = await this.paymentRepository.findEscrowAccounts({
        transactionId: request.escrowId
      });

      const escrow = escrowAccounts.find(e => e.id === request.escrowId);
      if (!escrow) {
        throw new Error('Escrow account not found');
      }

      if (escrow.status !== 'funded') {
        throw new Error(`Cannot release escrow with status: ${escrow.status}`);
      }

      // Find associated payment transaction
      const payments = await this.paymentRepository.findPayments({
        escrowId: request.escrowId
      });

      const payment = payments[0];
      if (!payment) {
        throw new Error('Associated payment transaction not found');
      }

      // Validate release request
      if (payment.recipientId !== request.recipientId) {
        throw new Error('Recipient ID does not match payment transaction');
      }

      // Process escrow release through gateway
      const releaseAmount = request.releaseAmount || escrow.amount;
      await this.processEscrowReleaseThoughGateway(escrow.id, releaseAmount, request.recipientId);

      // Update escrow status
      await this.paymentRepository.updateEscrowStatus(
        escrow.id,
        'released',
        new Date()
      );

      // Update payment transaction status
      const updatedPayment = await this.paymentRepository.updatePaymentStatus(
        payment.id,
        'completed',
        new Date()
      );

      if (!updatedPayment) {
        throw new Error('Failed to update payment transaction');
      }

      // Record escrow release on blockchain
      const blockchainTxId = await this.hederaService.recordEscrowRelease({
        escrowId: escrow.id,
        transactionId: payment.id,
        releaseAmount,
        recipientId: request.recipientId,
        reason: request.reason
      });

      logger.info('Escrow funds released successfully', {
        escrowId: escrow.id,
        transactionId: payment.id,
        releaseAmount,
        blockchainTxId
      });

      return updatedPayment;
    } catch (error) {
      logger.error('Escrow release failed', { error, request });
      throw error;
    }
  }

  /**
   * Generate payment receipt
   */
  async generateReceipt(transactionId: string): Promise<PaymentReceipt> {
    try {
      logger.info('Generating payment receipt', { transactionId });

      const transaction = await this.paymentRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status !== 'completed') {
        throw new Error('Cannot generate receipt for incomplete transaction');
      }

      // Get payment method details
      const paymentMethods = await this.paymentRepository.findPaymentMethodsByUser(transaction.payerId);
      const paymentMethod = paymentMethods.find(pm => pm.isVerified); // Use first verified method as fallback

      const receipt: PaymentReceipt = {
        transactionId: transaction.id,
        swapId: transaction.swapId,
        amount: transaction.amount,
        currency: transaction.currency,
        fees: {
          platformFee: transaction.platformFee,
          processingFee: 0, // Included in platform fee
          totalFees: transaction.platformFee,
          netAmount: transaction.netAmount
        },
        paymentMethod: paymentMethod?.displayName || 'Unknown',
        completedAt: transaction.completedAt!,
        receiptUrl: `${process.env.FRONTEND_URL}/receipts/${transaction.id}`
      };

      logger.info('Payment receipt generated successfully', { transactionId });
      return receipt;
    } catch (error) {
      logger.error('Receipt generation failed', { error, transactionId });
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<PaymentStatus> {
    try {
      const transaction = await this.paymentRepository.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      return transaction.status;
    } catch (error) {
      logger.error('Failed to get transaction status', { error, transactionId });
      throw error;
    }
  }

  /**
   * Tokenize payment method data for secure storage
   */
  async tokenizePaymentMethod(
    userId: string,
    paymentMethodType: 'credit_card' | 'bank_transfer' | 'digital_wallet',
    sensitiveData: Record<string, any>
  ) {
    try {
      return await this.paymentSecurityService.tokenizePaymentMethod(
        userId,
        paymentMethodType,
        sensitiveData
      );
    } catch (error) {
      const paymentError = this.errorHandler.createPaymentError(
        'PAYMENT_METHOD_INVALID',
        `Payment method tokenization failed: ${error.message}`,
        { userId, operation: 'payment_method_tokenization' }
      );
      this.errorHandler.logPaymentError(paymentError);
      throw paymentError;
    }
  }

  /**
   * Verify payment method with additional security checks
   */
  async verifyPaymentMethod(
    userId: string,
    paymentMethodId: string,
    verificationData: Record<string, any>
  ) {
    try {
      return await this.paymentSecurityService.verifyPaymentMethod(
        userId,
        paymentMethodId,
        verificationData
      );
    } catch (error) {
      const paymentError = this.errorHandler.createPaymentError(
        'PAYMENT_METHOD_INVALID',
        `Payment method verification failed: ${error.message}`,
        { userId, paymentMethodId, operation: 'payment_method_verification' }
      );
      this.errorHandler.logPaymentError(paymentError);
      throw paymentError;
    }
  }

  /**
   * Perform comprehensive fraud detection
   */
  async detectFraud(
    securityContext: PaymentSecurityContext,
    request: PaymentRequest
  ): Promise<FraudDetectionResult> {
    try {
      return await this.fraudDetectionService.detectFraud(securityContext, request);
    } catch (error) {
      logger.error('Fraud detection failed', { error, securityContext, request });
      // Return high-risk result on error
      return {
        isSuspicious: true,
        riskScore: 100,
        flags: ['fraud_detection_error'],
        recommendedAction: 'reject'
      };
    }
  }

  /**
   * Handle payment refund with error handling and retry logic
   */
  async refundPayment(
    transactionId: string,
    refundAmount?: number,
    reason: string = 'User requested refund'
  ): Promise<PaymentTransaction> {
    return await this.errorHandler.executeWithRetry(async () => {
      try {
        logger.info('Processing payment refund', { transactionId, refundAmount, reason });

        const transaction = await this.paymentRepository.findById(transactionId);
        if (!transaction) {
          const error = this.errorHandler.createPaymentError(
            'REFUND_FAILED',
            'Transaction not found for refund',
            { transactionId, operation: 'payment_refund' }
          );
          throw error;
        }

        if (transaction.status !== 'completed') {
          const error = this.errorHandler.createPaymentError(
            'REFUND_FAILED',
            'Cannot refund transaction that is not completed',
            { transactionId, operation: 'payment_refund' }
          );
          throw error;
        }

        const actualRefundAmount = refundAmount || transaction.amount;

        // Process refund through gateway (mock implementation)
        await this.processRefundThroughGateway(transaction.gatewayTransactionId, actualRefundAmount);

        // Update transaction status
        const updatedTransaction = await this.paymentRepository.updatePaymentStatus(
          transactionId,
          'refunded',
          new Date()
        );

        if (!updatedTransaction) {
          throw new Error('Failed to update transaction status');
        }

        // Record refund on blockchain
        await this.hederaService.recordPaymentRefund(transactionId, actualRefundAmount, reason);

        logger.info('Payment refund processed successfully', {
          transactionId,
          refundAmount: actualRefundAmount
        });

        return updatedTransaction;
      } catch (error) {
        if (error instanceof PaymentError) {
          this.errorHandler.logPaymentError(error);
          throw error;
        }

        const paymentError = this.errorHandler.createPaymentError(
          'REFUND_FAILED',
          `Refund processing failed: ${error.message}`,
          { transactionId, operation: 'payment_refund' },
          true // retryable
        );
        this.errorHandler.logPaymentError(paymentError);
        throw paymentError;
      }
    }, 3); // Retry up to 3 times
  }

  /**
   * Calculate platform fees for payment
   */
  private calculatePaymentFees(amount: number, currency: string): PaymentFees {
    const platformFee = Math.min(
      Math.max(amount * this.PLATFORM_FEE_CONFIG.percentage, this.PLATFORM_FEE_CONFIG.minimumFee),
      this.PLATFORM_FEE_CONFIG.maximumFee
    );

    const processingFee = 0; // Included in platform fee
    const totalFees = platformFee + processingFee;
    const netAmount = amount - totalFees;

    return {
      platformFee,
      processingFee,
      totalFees,
      netAmount
    };
  }

  /**
   * Validate payment method type-specific requirements
   */
  private async validatePaymentMethodType(paymentMethod: PaymentMethod): Promise<void> {
    switch (paymentMethod.type) {
      case 'credit_card':
        if (!paymentMethod.metadata.cardToken) {
          throw new Error('Credit card token is required');
        }
        if (!paymentMethod.metadata.expiryDate) {
          throw new Error('Credit card expiry date is required');
        }
        break;

      case 'bank_transfer':
        if (!paymentMethod.metadata.accountNumber) {
          throw new Error('Bank account number is required');
        }
        if (!paymentMethod.metadata.routingNumber) {
          throw new Error('Bank routing number is required');
        }
        break;

      case 'digital_wallet':
        if (!paymentMethod.metadata.walletId) {
          throw new Error('Digital wallet ID is required');
        }
        break;

      default:
        throw new Error(`Unsupported payment method type: ${paymentMethod.type}`);
    }
  }

  /**
   * Check if currency is supported
   */
  private isSupportedCurrency(currency: string): boolean {
    const supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    return supportedCurrencies.includes(currency.toUpperCase());
  }



  /**
   * Process payment through external gateway (mock implementation)
   */
  private async processPaymentThroughGateway(
    request: PaymentRequest,
    paymentMethod: PaymentMethod,
    fees: PaymentFees
  ): Promise<string> {
    // This would integrate with actual payment gateway (Stripe, PayPal, etc.)
    // For now, return a mock transaction ID
    const gatewayTransactionId = `gw_${uuidv4()}`;

    logger.info('Payment processed through gateway', {
      gatewayTransactionId,
      amount: request.amount,
      currency: request.currency,
      paymentMethodType: paymentMethod.type
    });

    return gatewayTransactionId;
  }

  /**
   * Process escrow release through gateway (mock implementation)
   */
  private async processEscrowReleaseThoughGateway(
    escrowId: string,
    amount: number,
    recipientId: string
  ): Promise<void> {
    // This would integrate with actual payment gateway for escrow release
    logger.info('Escrow release processed through gateway', {
      escrowId,
      amount,
      recipientId
    });
  }

  /**
   * Process refund through gateway (mock implementation)
   */
  private async processRefundThroughGateway(
    gatewayTransactionId: string,
    refundAmount: number
  ): Promise<void> {
    // This would integrate with actual payment gateway for refunds
    logger.info('Refund processed through gateway', {
      gatewayTransactionId,
      refundAmount
    });
  }
}