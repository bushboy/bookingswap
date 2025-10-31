import { logger } from '../../utils/logger';
import { NotificationService } from './NotificationService';

export interface PaymentNotificationData {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  swapId?: string;
  proposalId?: string;
}

export interface EscrowNotificationData {
  escrowId: string;
  userId: string;
  amount: number;
  currency: string;
  swapId?: string;
  counterpartyId?: string;
}

export class PaymentNotificationService {
  constructor(private notificationService: NotificationService) {}

  /**
   * Send payment processing status notifications with retry logic
   */
  async sendPaymentStatusNotification(
    data: PaymentNotificationData & { status: 'processing' | 'completed' | 'failed'; error?: string }
  ): Promise<void> {
    try {
      await this.notificationService.sendPaymentProcessingNotification({
        userId: data.userId,
        transactionId: data.transactionId,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        swapId: data.swapId,
      });

      // If payment failed, also send detailed error information
      if (data.status === 'failed' && data.error) {
        await this.sendPaymentFailureDetails({
          userId: data.userId,
          transactionId: data.transactionId,
          error: data.error,
          amount: data.amount,
          currency: data.currency,
          swapId: data.swapId,
        });
      }

      logger.info('Payment status notification sent', { 
        transactionId: data.transactionId, 
        status: data.status 
      });
    } catch (error) {
      logger.error('Failed to send payment status notification', { 
        error, 
        transactionId: data.transactionId 
      });
    }
  }

  /**
   * Send detailed payment failure information
   */
  private async sendPaymentFailureDetails(data: {
    userId: string;
    transactionId: string;
    error: string;
    amount: number;
    currency: string;
    swapId?: string;
  }): Promise<void> {
    const errorMessages: Record<string, string> = {
      'insufficient_funds': 'Your payment method has insufficient funds',
      'card_declined': 'Your payment method was declined',
      'expired_card': 'Your payment method has expired',
      'invalid_payment_method': 'The payment method is invalid or not supported',
      'network_error': 'A network error occurred during processing',
      'fraud_detected': 'The transaction was flagged for security review',
      'processing_error': 'An error occurred while processing your payment',
    };

    const userFriendlyMessage = errorMessages[data.error] || 'An unexpected error occurred';

    await this.notificationService.sendNotification('payment_failed', data.userId, {
      transactionId: data.transactionId,
      error: data.error,
      userFriendlyMessage,
      amount: data.amount,
      currency: data.currency,
      swapId: data.swapId,
      retryUrl: `${process.env.FRONTEND_URL}/payments/retry/${data.transactionId}`,
      supportUrl: `${process.env.FRONTEND_URL}/support`,
    });
  }

  /**
   * Send escrow account notifications
   */
  async sendEscrowNotification(
    data: EscrowNotificationData & { status: 'created' | 'released' | 'refunded' }
  ): Promise<void> {
    try {
      await this.notificationService.sendEscrowNotification({
        userId: data.userId,
        escrowId: data.escrowId,
        status: data.status,
        amount: data.amount,
        currency: data.currency,
        swapId: data.swapId,
      });

      // If there's a counterparty, notify them too
      if (data.counterpartyId && data.status === 'created') {
        await this.notificationService.sendEscrowNotification({
          userId: data.counterpartyId,
          escrowId: data.escrowId,
          status: data.status,
          amount: data.amount,
          currency: data.currency,
          swapId: data.swapId,
        });
      }

      logger.info('Escrow notification sent', { 
        escrowId: data.escrowId, 
        status: data.status 
      });
    } catch (error) {
      logger.error('Failed to send escrow notification', { 
        error, 
        escrowId: data.escrowId 
      });
    }
  }

  /**
   * Send payment confirmation with receipt
   */
  async sendPaymentConfirmation(data: PaymentNotificationData & {
    receiptUrl: string;
    platformFee: number;
    netAmount: number;
  }): Promise<void> {
    try {
      await this.notificationService.sendNotification('payment_completed', data.userId, {
        transactionId: data.transactionId,
        amount: data.amount,
        currency: data.currency,
        platformFee: data.platformFee,
        netAmount: data.netAmount,
        receiptUrl: data.receiptUrl,
        swapId: data.swapId,
        dashboardUrl: data.swapId ? 
          `${process.env.FRONTEND_URL}/swaps/${data.swapId}` : 
          `${process.env.FRONTEND_URL}/payments`,
      });

      logger.info('Payment confirmation sent', { transactionId: data.transactionId });
    } catch (error) {
      logger.error('Failed to send payment confirmation', { 
        error, 
        transactionId: data.transactionId 
      });
    }
  }

  /**
   * Send payment reminder for pending transactions
   */
  async sendPaymentReminder(data: PaymentNotificationData & {
    daysOverdue: number;
    reminderLevel: 'first' | 'second' | 'final';
  }): Promise<void> {
    try {
      await this.notificationService.sendNotification('payment_processing', data.userId, {
        transactionId: data.transactionId,
        amount: data.amount,
        currency: data.currency,
        daysOverdue: data.daysOverdue,
        reminderLevel: data.reminderLevel,
        isUrgent: data.reminderLevel === 'final',
        swapId: data.swapId,
        paymentUrl: `${process.env.FRONTEND_URL}/payments/${data.transactionId}`,
      });

      logger.info('Payment reminder sent', { 
        transactionId: data.transactionId, 
        reminderLevel: data.reminderLevel 
      });
    } catch (error) {
      logger.error('Failed to send payment reminder', { 
        error, 
        transactionId: data.transactionId 
      });
    }
  }

  /**
   * Send refund notification
   */
  async sendRefundNotification(data: PaymentNotificationData & {
    refundReason: string;
    refundAmount: number;
    processingDays: number;
  }): Promise<void> {
    try {
      await this.notificationService.sendNotification('payment_completed', data.userId, {
        transactionId: data.transactionId,
        type: 'refund',
        originalAmount: data.amount,
        refundAmount: data.refundAmount,
        currency: data.currency,
        refundReason: data.refundReason,
        processingDays: data.processingDays,
        swapId: data.swapId,
        dashboardUrl: `${process.env.FRONTEND_URL}/payments`,
      });

      logger.info('Refund notification sent', { transactionId: data.transactionId });
    } catch (error) {
      logger.error('Failed to send refund notification', { 
        error, 
        transactionId: data.transactionId 
      });
    }
  }
}