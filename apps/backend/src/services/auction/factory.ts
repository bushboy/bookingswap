import { Pool } from 'pg';
import { AuctionManagementService } from './AuctionManagementService';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { createBookingService } from '../booking/factory';
import { createHederaService } from '../hedera/factory';
import { 
  createNotificationService, 
  createAuctionNotificationService,
  createPaymentNotificationService,
  createTimingNotificationService 
} from '../notification/factory';

let auctionManagementService: AuctionManagementService | null = null;

export function createAuctionManagementService(pool: Pool): AuctionManagementService {
  if (!auctionManagementService) {
    const auctionRepository = new AuctionRepository(pool);
    const swapRepository = new SwapRepository(pool);
    const bookingService = createBookingService(pool);
    const hederaService = createHederaService();
    const notificationService = createNotificationService(pool);
    const auctionNotificationService = createAuctionNotificationService(pool);
    const paymentNotificationService = createPaymentNotificationService(pool);
    const timingNotificationService = createTimingNotificationService(pool);

    auctionManagementService = new AuctionManagementService(
      auctionRepository,
      swapRepository,
      bookingService,
      hederaService,
      notificationService,
      auctionNotificationService,
      paymentNotificationService,
      timingNotificationService
    );
  }

  return auctionManagementService;
}

export function resetAuctionManagementService(): void {
  auctionManagementService = null;
}