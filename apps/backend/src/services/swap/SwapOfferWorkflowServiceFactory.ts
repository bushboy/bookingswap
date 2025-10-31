import { Pool } from 'pg';
import { SwapOfferWorkflowService, SwapOfferWorkflowServiceImpl } from './SwapOfferWorkflowService';
import { EnhancedPaymentTransactionServiceImpl } from '../payment/EnhancedPaymentTransactionService';
import { EnhancedAuctionProposalService } from '../auction/EnhancedAuctionProposalService';
import { PaymentRepository } from '../../database/repositories/PaymentRepository';

/**
 * Factory for creating SwapOfferWorkflowService instances
 */
export class SwapOfferWorkflowServiceFactory {
    /**
     * Creates a new SwapOfferWorkflowService instance with all dependencies
     */
    static create(
        pool: Pool,
        paymentRepository: PaymentRepository,
        auctionService: EnhancedAuctionProposalService
    ): SwapOfferWorkflowService {
        const paymentService = new EnhancedPaymentTransactionServiceImpl(
            pool,
            paymentRepository
        );

        return new SwapOfferWorkflowServiceImpl(
            pool,
            paymentService,
            auctionService
        );
    }
}