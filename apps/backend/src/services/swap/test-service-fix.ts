/**
 * Test script to verify the BookingService method availability fix
 */
import { Pool } from 'pg';
import { createSwapProposalService } from './factory';
import { BookingServiceFactory } from '../booking/factory';
import { createHederaService } from '../hedera/factory';
import { createAuctionManagementService } from '../auction/factory';
import { createPaymentProcessingService } from '../payment/factory';
import { logger } from '../../utils/logger';

export async function testServiceMethodAvailability(dbPool: Pool): Promise<boolean> {
    try {
        logger.info('Testing BookingService method availability fix...');

        // Create HederaService
        const hederaService = createHederaService();

        // Create BookingService using factory
        const bookingService = BookingServiceFactory.getInstance({
            dbPool,
            hederaService
        });

        // Verify BookingService integrity
        const integrity = bookingService.validateServiceIntegrity();
        if (!integrity.isValid) {
            logger.error('BookingService integrity validation failed', { errors: integrity.errors });
            return false;
        }

        // Create auction and payment services
        const auctionService = createAuctionManagementService(dbPool);
        const paymentService = createPaymentProcessingService(dbPool);

        // Create SwapProposalService - this should now work without errors
        const swapProposalService = createSwapProposalService(
            dbPool,
            bookingService,
            hederaService,
            auctionService,
            paymentService
        );

        // Verify that the service was created successfully
        if (!swapProposalService) {
            logger.error('SwapProposalService creation failed');
            return false;
        }

        // Test that we can call a method that uses BookingService internally
        try {
            // This should not throw the "getBookingById is not a function" error anymore
            await swapProposalService.getBookingDetails('test-booking-id');
        } catch (error: any) {
            // We expect this to fail with "Booking not found" or similar, not with method availability error
            if (error.message.includes('is not a function')) {
                logger.error('Method availability error still occurs', { error: error.message });
                return false;
            }
            // Other errors are expected (like booking not found)
            logger.info('Method call failed as expected (booking not found), but method is available');
        }

        logger.info('BookingService method availability fix test passed');
        return true;

    } catch (error: any) {
        logger.error('Service method availability test failed', { error: error.message });
        return false;
    }
}

export function validateServiceConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if required environment variables are set
    if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
        errors.push('Database configuration is missing');
    }

    if (!process.env.HEDERA_ACCOUNT_ID) {
        errors.push('Hedera configuration is missing');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}