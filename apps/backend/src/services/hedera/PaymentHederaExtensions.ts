import { HederaService, TransactionData, TransactionResult } from './HederaService';
import { PaymentFees } from '@booking-swap/shared';
import { logger } from '../../utils/logger';

export interface EscrowCreationData {
  escrowId: string;
  amount: number;
  currency: string;
  payerId: string;
  recipientId: string;
  swapId: string;
  proposalId: string;
}

export interface PaymentTransactionData {
  transactionId: string;
  swapId: string;
  proposalId: string;
  amount: number;
  currency: string;
  payerId: string;
  recipientId: string;
  fees: PaymentFees;
}

export interface EscrowReleaseData {
  escrowId: string;
  transactionId: string;
  releaseAmount: number;
  recipientId: string;
  reason: string;
}

/**
 * Extension of HederaService with payment-specific blockchain operations
 */
export class PaymentHederaExtensions {
  constructor(private hederaService: HederaService) {}

  /**
   * Record escrow account creation on blockchain
   */
  async recordEscrowCreation(data: EscrowCreationData): Promise<string> {
    try {
      logger.info('Recording escrow creation on blockchain', { escrowId: data.escrowId });

      const transactionData: TransactionData = {
        type: 'swap_execution', // Using existing type, could be extended
        payload: {
          action: 'escrow_creation',
          escrowId: data.escrowId,
          amount: data.amount,
          currency: data.currency,
          payerId: data.payerId,
          recipientId: data.recipientId,
          swapId: data.swapId,
          proposalId: data.proposalId,
          metadata: {
            escrowType: 'cash_payment',
            status: 'created'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Escrow creation recorded on blockchain', {
        escrowId: data.escrowId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record escrow creation on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record payment transaction on blockchain
   */
  async recordPaymentTransaction(data: PaymentTransactionData): Promise<string> {
    try {
      logger.info('Recording payment transaction on blockchain', { transactionId: data.transactionId });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'payment_transaction',
          transactionId: data.transactionId,
          swapId: data.swapId,
          proposalId: data.proposalId,
          amount: data.amount,
          currency: data.currency,
          payerId: data.payerId,
          recipientId: data.recipientId,
          fees: {
            platformFee: data.fees.platformFee,
            processingFee: data.fees.processingFee,
            totalFees: data.fees.totalFees,
            netAmount: data.fees.netAmount
          },
          metadata: {
            paymentType: 'cash_offer',
            status: 'processing'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Payment transaction recorded on blockchain', {
        transactionId: data.transactionId,
        blockchainTxId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record payment transaction on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record escrow release on blockchain
   */
  async recordEscrowRelease(data: EscrowReleaseData): Promise<string> {
    try {
      logger.info('Recording escrow release on blockchain', { escrowId: data.escrowId });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'escrow_release',
          escrowId: data.escrowId,
          transactionId: data.transactionId,
          releaseAmount: data.releaseAmount,
          recipientId: data.recipientId,
          reason: data.reason,
          metadata: {
            escrowType: 'cash_payment',
            status: 'released',
            releaseTimestamp: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Escrow release recorded on blockchain', {
        escrowId: data.escrowId,
        transactionId: data.transactionId,
        blockchainTxId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record escrow release on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record payment completion on blockchain
   */
  async recordPaymentCompletion(transactionId: string, completedAt: Date): Promise<string> {
    try {
      logger.info('Recording payment completion on blockchain', { transactionId });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'payment_completion',
          transactionId,
          completedAt: completedAt.toISOString(),
          metadata: {
            paymentType: 'cash_offer',
            status: 'completed'
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Payment completion recorded on blockchain', {
        transactionId,
        blockchainTxId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record payment completion on blockchain', { error, transactionId });
      throw error;
    }
  }

  /**
   * Record payment refund on blockchain
   */
  async recordPaymentRefund(transactionId: string, refundAmount: number, reason: string): Promise<string> {
    try {
      logger.info('Recording payment refund on blockchain', { transactionId, refundAmount });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'payment_refund',
          transactionId,
          refundAmount,
          reason,
          metadata: {
            paymentType: 'cash_offer',
            status: 'refunded',
            refundTimestamp: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Payment refund recorded on blockchain', {
        transactionId,
        refundAmount,
        blockchainTxId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record payment refund on blockchain', { error, transactionId });
      throw error;
    }
  }

  /**
   * Record cash offer submission on blockchain
   */
  async recordCashOfferSubmission(data: {
    proposalId: string;
    swapId: string;
    proposerId: string;
    amount: number;
    currency: string;
    paymentMethodId: string;
    escrowRequired: boolean;
  }): Promise<string> {
    try {
      logger.info('Recording cash offer submission on blockchain', { proposalId: data.proposalId });

      const transactionData: TransactionData = {
        type: 'cash_proposal_created',
        payload: {
          action: 'cash_offer_submission',
          proposalId: data.proposalId,
          swapId: data.swapId,
          proposerId: data.proposerId,
          amount: data.amount,
          currency: data.currency,
          paymentMethodId: data.paymentMethodId,
          escrowRequired: data.escrowRequired,
          metadata: {
            offerType: 'cash_proposal',
            status: 'submitted',
            submittedAt: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Cash offer submission recorded on blockchain', {
        proposalId: data.proposalId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record cash offer submission on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record dispute resolution on blockchain
   */
  async recordDisputeResolution(data: {
    transactionId: string;
    disputeId: string;
    resolution: 'refund' | 'release' | 'partial_refund';
    amount: number;
    reason: string;
    resolvedBy: string;
  }): Promise<string> {
    try {
      logger.info('Recording dispute resolution on blockchain', { disputeId: data.disputeId });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'dispute_resolution',
          transactionId: data.transactionId,
          disputeId: data.disputeId,
          resolution: data.resolution,
          amount: data.amount,
          reason: data.reason,
          resolvedBy: data.resolvedBy,
          metadata: {
            disputeType: 'payment_dispute',
            status: 'resolved',
            resolvedAt: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Dispute resolution recorded on blockchain', {
        disputeId: data.disputeId,
        transactionId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record dispute resolution on blockchain', { error, data });
      throw error;
    }
  }

  /**
   * Record fraud detection alert on blockchain
   */
  async recordFraudAlert(transactionId: string, riskScore: number, flags: string[]): Promise<string> {
    try {
      logger.info('Recording fraud alert on blockchain', { transactionId, riskScore });

      const transactionData: TransactionData = {
        type: 'swap_execution',
        payload: {
          action: 'fraud_alert',
          transactionId,
          riskScore,
          flags,
          metadata: {
            alertType: 'payment_fraud',
            status: 'flagged',
            alertTimestamp: new Date().toISOString()
          }
        },
        timestamp: new Date()
      };

      const result = await this.hederaService.submitTransaction(transactionData);
      
      logger.info('Fraud alert recorded on blockchain', {
        transactionId,
        riskScore,
        blockchainTxId: result.transactionId
      });

      return result.transactionId;
    } catch (error) {
      logger.error('Failed to record fraud alert on blockchain', { error, transactionId });
      throw error;
    }
  }
}