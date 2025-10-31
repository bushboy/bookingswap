import { Pool } from 'pg';
import { BookingService } from './BookingService';
import { BookingValidationService } from './BookingValidationService';
import { BookingRepository } from '../../database/repositories/BookingRepository';
import { HederaService } from '../hedera/HederaService';
import { getHederaService } from '../hedera/factory';
import { logger } from '../../utils/logger';

export interface BookingServiceDependencies {
  dbPool: Pool;
  hederaService: HederaService;
}

/**
 * Create a new BookingService instance
 */
export function createBookingService(dbPool: Pool, hederaService?: HederaService): BookingService {
  // Create repository
  const bookingRepository = new BookingRepository(dbPool);

  // Create validation service
  const validationService = new BookingValidationService();

  // Use provided HederaService or get the singleton instance
  const hedera = hederaService || getHederaService();

  // Create and return booking service
  const bookingService = new BookingService(
    bookingRepository,
    hedera,
    validationService
  );

  // Validate service integrity after creation
  const validation = bookingService.validateServiceIntegrity();
  if (!validation.isValid) {
    logger.error('BookingService failed integrity validation', { errors: validation.errors });
    throw new Error(`BookingService integrity validation failed: ${validation.errors.join(', ')}`);
  }

  logger.info('BookingService created and validated successfully');
  return bookingService;
}

export class BookingServiceFactory {
  private static instance: BookingService | null = null;

  /**
   * Create or get singleton instance of BookingService
   */
  static getInstance(dependencies: BookingServiceDependencies): BookingService {
    if (!this.instance) {
      this.instance = createBookingService(dependencies.dbPool, dependencies.hederaService);
      logger.info('BookingService instance created');
    }
    return this.instance;
  }

  /**
   * Create a new BookingService instance
   */
  static createBookingService(dependencies: BookingServiceDependencies): BookingService {
    return createBookingService(dependencies.dbPool, dependencies.hederaService);
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }
}