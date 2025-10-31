import { Pool } from 'pg';
import { SwapProposalService } from './SwapProposalService';
import { SwapResponseService } from './SwapResponseService';
import { SwapExpirationService } from './SwapExpirationService';
import { SwapMatchingService } from './SwapMatchingService';
import { SwapMatchingCacheService } from './SwapMatchingCacheService';
import { SwapCacheInvalidationService } from './SwapCacheInvalidationService';
import { SwapRepository } from '../../database/repositories/SwapRepository';
import { SwapTargetingRepository } from '../../database/repositories/SwapTargetingRepository';
import { EnhancedProposalRepository } from '../../database/repositories/EnhancedProposalRepository';
import { UserRepository } from '../../database/repositories/UserRepository';
import { AuctionRepository } from '../../database/repositories/AuctionRepository';
import { BookingService } from '../booking/BookingService';
import { HederaService } from '../hedera/HederaService';
import { NotificationService } from '../notification/NotificationService';
import { AuctionNotificationService } from '../notification/AuctionNotificationService';
import { PaymentNotificationService } from '../notification/PaymentNotificationService';
import { TimingNotificationService } from '../notification/TimingNotificationService';
import { AuctionManagementService } from '../auction/AuctionManagementService';
import { PaymentProcessingService } from '../payment/PaymentProcessingService';
import { RedisService } from '../../database/cache/RedisService';
import { getCacheService } from '../../database/cache/config';
import { getSwapMatchingCacheConfig } from './cache-config';
import { SwapMatchingQueryOptimizer } from '../../database/optimizations/SwapMatchingQueryOptimizer';
import { ProposalAcceptanceService } from './ProposalAcceptanceService';
import { ProposalTransactionManager } from './ProposalTransactionManager';
import {
  createNotificationService,
  createAuctionNotificationService,
  createPaymentNotificationService,
  createTimingNotificationService
} from '../notification/factory';

export function createSwapProposalService(
  pool: Pool,
  bookingService: BookingService,
  hederaService: HederaService,
  auctionService: AuctionManagementService,
  paymentService: PaymentProcessingService
): SwapProposalService {
  const swapRepository = new SwapRepository(pool);
  const swapTargetingRepository = new SwapTargetingRepository(pool);
  const auctionRepository = new AuctionRepository(pool);
  const notificationService = createNotificationService(pool);
  const auctionNotificationService = createAuctionNotificationService(pool);
  const paymentNotificationService = createPaymentNotificationService(pool);
  const timingNotificationService = createTimingNotificationService(pool);

  return new SwapProposalService(
    swapRepository,
    swapTargetingRepository,
    auctionRepository,
    bookingService,
    hederaService,
    notificationService,
    auctionNotificationService,
    paymentNotificationService,
    timingNotificationService,
    auctionService,
    paymentService
  );
}

export function createProposalAcceptanceService(
  pool: Pool,
  bookingService: BookingService,
  hederaService: HederaService,
  paymentService: PaymentProcessingService
): ProposalAcceptanceService {
  const swapRepository = new SwapRepository(pool);
  const notificationService = createNotificationService(pool);
  const transactionManager = new ProposalTransactionManager(pool);
  const enhancedProposalRepository = new EnhancedProposalRepository(pool);

  return new ProposalAcceptanceService(
    paymentService,
    hederaService,
    notificationService,
    swapRepository,
    bookingService,
    transactionManager,
    enhancedProposalRepository
  );
}

export function createSwapResponseService(
  pool: Pool,
  bookingService: BookingService,
  hederaService: HederaService,
  auctionService: AuctionManagementService,
  paymentService: PaymentProcessingService
): SwapResponseService {
  const swapRepository = new SwapRepository(pool);
  const auctionRepository = new AuctionRepository(pool);
  const notificationService = createNotificationService(pool);
  const auctionNotificationService = createAuctionNotificationService(pool);
  const paymentNotificationService = createPaymentNotificationService(pool);
  const proposalAcceptanceService = createProposalAcceptanceService(
    pool,
    bookingService,
    hederaService,
    paymentService
  );

  return new SwapResponseService(
    swapRepository,
    auctionRepository,
    bookingService,
    hederaService,
    notificationService,
    auctionNotificationService,
    paymentNotificationService,
    auctionService,
    paymentService,
    proposalAcceptanceService
  );
}

export function createSwapExpirationService(
  swapProposalService: SwapProposalService,
  checkIntervalMinutes?: number
): SwapExpirationService {
  const { getSwapExpirationConfig } = require('./expiration-config');

  // Use provided parameter, configuration, or default to 5 minutes
  const config = getSwapExpirationConfig();
  const intervalMinutes = checkIntervalMinutes || config.checkIntervalMinutes;

  return new SwapExpirationService(swapProposalService, intervalMinutes);
}

export function createSwapMatchingCacheService(): SwapMatchingCacheService {
  const redisService = getCacheService();
  const cacheConfig = getSwapMatchingCacheConfig();

  return new SwapMatchingCacheService(redisService, cacheConfig);
}

export function createSwapCacheInvalidationService(
  cacheService?: SwapMatchingCacheService
): SwapCacheInvalidationService {
  const swapCacheService = cacheService || createSwapMatchingCacheService();
  return new SwapCacheInvalidationService(swapCacheService);
}

export function createSwapMatchingQueryOptimizer(pool: Pool): SwapMatchingQueryOptimizer {
  return new SwapMatchingQueryOptimizer(pool);
}

export function createSwapMatchingService(
  pool: Pool,
  bookingService: BookingService,
  hederaService?: HederaService,
  notificationService?: NotificationService,
  cacheService?: SwapMatchingCacheService
): SwapMatchingService {
  const swapRepository = new SwapRepository(pool);
  const userRepository = new UserRepository(pool);
  const swapProposalService = createSwapProposalService(
    pool,
    bookingService,
    hederaService!,
    {} as AuctionManagementService, // Mock for now
    {} as PaymentProcessingService  // Mock for now
  );

  const swapCacheService = cacheService || createSwapMatchingCacheService();

  return new SwapMatchingService(
    swapRepository,
    bookingService,
    swapProposalService,
    userRepository,
    hederaService,
    notificationService,
    swapCacheService
  );
}