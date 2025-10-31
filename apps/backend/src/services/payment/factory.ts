import { Pool } from 'pg';
import { PaymentProcessingService, PaymentGatewayConfig } from './PaymentProcessingService';
import { EnhancedPaymentTransactionServiceImpl } from './EnhancedPaymentTransactionService';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';
import { createHederaService } from '../hedera/factory';
import { createPaymentNotificationService } from '../notification/factory';

let paymentProcessingService: PaymentProcessingService | null = null;
let enhancedPaymentTransactionService: EnhancedPaymentTransactionServiceImpl | null = null;

export function createPaymentProcessingService(pool: Pool): PaymentProcessingService {
  if (!paymentProcessingService) {
    const paymentRepository = new PaymentRepository(pool);
    const hederaService = createHederaService();
    const paymentNotificationService = createPaymentNotificationService(pool);

    // Payment gateway configuration from environment
    const gatewayConfig: PaymentGatewayConfig = {
      apiKey: process.env.PAYMENT_GATEWAY_API_KEY || 'test-api-key',
      secretKey: process.env.PAYMENT_GATEWAY_SECRET_KEY || 'test-secret-key',
      environment: (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox') as 'sandbox' | 'production',
      webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'test-webhook-secret'
    };

    paymentProcessingService = new PaymentProcessingService(
      paymentRepository,
      hederaService,
      gatewayConfig,
      paymentNotificationService
    );
  }

  return paymentProcessingService;
}

export function createEnhancedPaymentTransactionService(pool: Pool): EnhancedPaymentTransactionServiceImpl {
  if (!enhancedPaymentTransactionService) {
    const paymentRepository = new PaymentRepository(pool);
    enhancedPaymentTransactionService = new EnhancedPaymentTransactionServiceImpl(pool, paymentRepository);
  }

  return enhancedPaymentTransactionService;
}

export function resetPaymentProcessingService(): void {
  paymentProcessingService = null;
}

export function resetEnhancedPaymentTransactionService(): void {
  enhancedPaymentTransactionService = null;
}