import { Booking, BookingType, BookingStatus, VerificationStatus } from '@booking-swap/shared';
import { BookingRepository, BookingFilters, BookingSearchCriteria } from '../../database/repositories/BookingRepository';
import { HederaService, TransactionData } from '../hedera/HederaService';
import { BookingValidationService } from './BookingValidationService';
import { logger } from '../../utils/logger';

export interface CreateBookingRequest {
  userId: string;
  type: BookingType;
  title: string;
  description: string;
  location: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  dateRange: {
    checkIn: Date;
    checkOut: Date;
  };
  originalPrice: number;
  swapValue: number;
  providerDetails: {
    provider: string;
    confirmationNumber: string;
    bookingReference: string;
  };
}

export interface BookingListingResult {
  booking: Booking;
  blockchainTransaction: {
    transactionId: string;
    consensusTimestamp?: string;
  };
}

export class BookingService {
  constructor(
    private bookingRepository: BookingRepository,
    private hederaService: HederaService,
    private validationService: BookingValidationService
  ) {
    // Ensure all methods are properly bound to this instance
    this.bindMethods();
  }

  /**
   * Bind all methods to ensure proper 'this' context
   */
  private bindMethods(): void {
    const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(name => name !== 'constructor' && typeof (this as any)[name] === 'function');

    for (const methodName of methodNames) {
      if (methodName !== 'bindMethods') {
        (this as any)[methodName] = (this as any)[methodName].bind(this);
      }
    }

    logger.debug('BookingService methods bound', {
      boundMethods: methodNames.length,
      methods: methodNames
    });
  }

  /**
   * Create a new booking listing with blockchain recording
   */
  async createBookingListing(request: CreateBookingRequest): Promise<BookingListingResult> {
    try {
      logger.info('Creating booking listing', { userId: request.userId, type: request.type });

      // Step 1: Validate booking details with external provider
      const validationResult = await this.validationService.validateBooking(request);
      if (!validationResult.isValid) {
        throw new Error(`Booking validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Step 2: Create booking entity with verified status
      const bookingData: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: request.userId,
        type: request.type,
        title: request.title,
        description: request.description,
        location: request.location,
        dateRange: request.dateRange,
        originalPrice: request.originalPrice,
        swapValue: request.swapValue,
        providerDetails: request.providerDetails,
        verification: {
          status: 'verified',
          documents: validationResult.documents || [],
        },
        blockchain: {
          topicId: this.hederaService.getTopicId() || '',
        },
        status: 'available',
      };

      // Step 3: Save to database
      const booking = await this.bookingRepository.create(bookingData);

      // Step 4: Record on blockchain
      const transactionData: TransactionData = {
        type: 'booking_listing',
        payload: {
          bookingId: booking.id,
          userId: booking.userId,
          type: booking.type,
          location: booking.location,
          dateRange: booking.dateRange,
          swapValue: booking.swapValue,
          providerDetails: {
            provider: booking.providerDetails.provider,
            confirmationNumber: booking.providerDetails.confirmationNumber,
          },
        },
        timestamp: new Date(),
      };

      const blockchainResult = await this.hederaService.submitTransaction(transactionData);

      // Step 5: Update booking with blockchain info
      const updatedBooking = await this.bookingRepository.updateBlockchainInfo(booking.id, {
        transactionId: blockchainResult.transactionId,
        consensusTimestamp: blockchainResult.consensusTimestamp,
        topicId: this.hederaService.getTopicId(),
      });

      if (!updatedBooking) {
        throw new Error('Failed to update booking with blockchain information');
      }

      logger.info('Booking listing created successfully', {
        bookingId: booking.id,
        transactionId: blockchainResult.transactionId,
      });

      return {
        booking: updatedBooking,
        blockchainTransaction: {
          transactionId: blockchainResult.transactionId,
          consensusTimestamp: blockchainResult.consensusTimestamp,
        },
      };
    } catch (error) {
      logger.error('Failed to create booking listing', { error, request });
      throw error;
    }
  }

  /**
   * Enable swapping for a booking and mint NFT
   */
  async enableSwappingForBooking(bookingId: string, userId: string, userWalletAddress?: string): Promise<{ booking: Booking; nftResult?: any }> {
    try {
      logger.info('Enabling swapping for booking', { bookingId, userId });

      // Step 1: Verify ownership
      const existingBooking = await this.bookingRepository.findById(bookingId);
      if (!existingBooking) {
        throw new Error('Booking not found');
      }
      if (existingBooking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      // Step 2: Check if booking is available for swapping
      if (existingBooking.status !== 'available') {
        throw new Error('Booking must be available to enable swapping');
      }

      // Step 3: Mint NFT for the booking (to user's wallet if available)
      let nftResult;
      if (userWalletAddress) {
        try {
          nftResult = await this.hederaService.getNFTService().mintBookingNFT(existingBooking, userWalletAddress);
          logger.info('NFT minted successfully to user wallet', {
            bookingId,
            userWalletAddress,
            tokenId: nftResult.tokenId,
            serialNumber: nftResult.serialNumber
          });
        } catch (nftError) {
          logger.error('Failed to mint NFT for booking', { error: nftError, bookingId, userWalletAddress });
          // Continue without NFT - this is non-critical for basic functionality
          logger.warn('Continuing without NFT minting', { bookingId });
        }
      } else {
        logger.warn('No wallet address provided, skipping NFT minting', { bookingId, userId });
      }

      // Step 4: Update booking with NFT information if minting was successful
      if (nftResult) {
        const updatedBooking = await this.bookingRepository.updateBlockchainInfo(bookingId, {
          nftTokenId: nftResult.tokenId,
          nftSerialNumber: nftResult.serialNumber,
          nftTransactionId: nftResult.transactionId,
        });

        if (!updatedBooking) {
          throw new Error('Failed to update booking with NFT information');
        }

        return { booking: updatedBooking, nftResult };
      }

      return { booking: existingBooking };
    } catch (error) {
      logger.error('Failed to enable swapping for booking', { error, bookingId, userId });
      throw error;
    }
  }

  /**
   * Update booking details
   */
  async updateBooking(bookingId: string, updateData: Partial<Booking>, userId: string): Promise<Booking> {
    try {
      logger.info('Updating booking', { bookingId, userId, updateFields: Object.keys(updateData) });

      // Step 1: Verify ownership
      const existingBooking = await this.bookingRepository.findById(bookingId);
      if (!existingBooking) {
        throw new Error('Booking not found');
      }
      if (existingBooking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      // Step 2: Validate update data
      if (updateData.dateRange) {
        if (updateData.dateRange.checkOut <= updateData.dateRange.checkIn) {
          throw new Error('Check-out date must be after check-in date');
        }
      }

      if (updateData.originalPrice !== undefined && updateData.originalPrice <= 0) {
        throw new Error('Original price must be greater than 0');
      }

      if (updateData.swapValue !== undefined && updateData.swapValue <= 0) {
        throw new Error('Swap value must be greater than 0');
      }

      // Step 3: Update booking
      const updatedBooking = await this.bookingRepository.updateBooking(bookingId, updateData);
      if (!updatedBooking) {
        throw new Error('Failed to update booking');
      }

      logger.info('Booking updated successfully', { bookingId, userId });
      return updatedBooking;
    } catch (error) {
      logger.error('Failed to update booking', { error, bookingId, userId });
      throw error;
    }
  }

  /**
   * Disable swapping for a booking and burn NFT
   */
  async disableSwappingForBooking(bookingId: string, userId: string): Promise<Booking> {
    try {
      logger.info('Disabling swapping for booking', { bookingId, userId });

      // Step 1: Verify ownership
      const existingBooking = await this.bookingRepository.findById(bookingId);
      if (!existingBooking) {
        throw new Error('Booking not found');
      }
      if (existingBooking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      // Step 2: Burn NFT if it exists
      if (existingBooking.blockchain?.nftTokenId && existingBooking.blockchain?.nftSerialNumber) {
        try {
          await this.hederaService.getNFTService().burnNFT(
            existingBooking.blockchain.nftTokenId,
            existingBooking.blockchain.nftSerialNumber
          );
          logger.info('NFT burned successfully for booking', {
            bookingId,
            tokenId: existingBooking.blockchain.nftTokenId,
            serialNumber: existingBooking.blockchain.nftSerialNumber
          });
        } catch (burnError) {
          logger.error('Failed to burn NFT for booking', { error: burnError, bookingId });
          // Continue without burning - this is non-critical for basic functionality
          logger.warn('Continuing without NFT burning', { bookingId });
        }
      }

      // Step 3: Update booking to remove NFT information
      const updatedBooking = await this.bookingRepository.updateBlockchainInfo(bookingId, {
        nftTokenId: null,
        nftSerialNumber: null,
        nftTransactionId: null,
      });

      if (!updatedBooking) {
        throw new Error('Failed to update booking with NFT information');
      }

      return updatedBooking;
    } catch (error) {
      logger.error('Failed to disable swapping for booking', { error, bookingId, userId });
      throw error;
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: string, status: BookingStatus, userId?: string): Promise<Booking> {
    try {
      logger.info('Updating booking status', { bookingId, status, userId });

      // Verify ownership if userId provided
      if (userId) {
        const existingBooking = await this.bookingRepository.findById(bookingId);
        if (!existingBooking) {
          throw new Error('Booking not found');
        }
        if (existingBooking.userId !== userId) {
          throw new Error('Unauthorized: User does not own this booking');
        }
      }

      const updatedBooking = await this.bookingRepository.updateStatus(bookingId, status);
      if (!updatedBooking) {
        throw new Error('Booking not found');
      }

      // Record status change on blockchain
      const transactionData: TransactionData = {
        type: 'booking_listing',
        payload: {
          bookingId,
          statusChange: {
            from: updatedBooking.status,
            to: status,
            timestamp: new Date(),
          },
        },
        timestamp: new Date(),
      };

      await this.hederaService.submitTransaction(transactionData);

      logger.info('Booking status updated successfully', { bookingId, status });
      return updatedBooking;
    } catch (error) {
      logger.error('Failed to update booking status', { error, bookingId, status });
      throw error;
    }
  }

  /**
   * Validate service integrity
   */
  validateServiceIntegrity(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if dependencies are available
    if (!this.bookingRepository) {
      errors.push('BookingRepository is not available');
    }

    if (!this.hederaService) {
      errors.push('HederaService is not available');
    }

    if (!this.validationService) {
      errors.push('BookingValidationService is not available');
    }

    // Check if critical methods are bound
    const criticalMethods = ['getBookingById', 'lockBooking', 'unlockBooking', 'createBookingListing'];
    for (const method of criticalMethods) {
      if (typeof (this as any)[method] !== 'function') {
        errors.push(`Method ${method} is not available or not a function`);
      }
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.error('BookingService integrity validation failed', { errors });
    } else {
      logger.debug('BookingService integrity validation passed');
    }

    return { isValid, errors };
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: string): Promise<Booking | null> {
    try {
      return await this.bookingRepository.findById(bookingId);
    } catch (error) {
      logger.error('Failed to get booking by ID', { error, bookingId });
      throw error;
    }
  }

  /**
   * Get bookings by user ID
   */
  async getUserBookings(userId: string, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    try {
      return await this.bookingRepository.findByUserId(userId, limit, offset);
    } catch (error) {
      logger.error('Failed to get user bookings', { error, userId });
      throw error;
    }
  }

  /**
   * Search bookings with filters
   */
  async searchBookings(criteria: BookingSearchCriteria, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    try {
      return await this.bookingRepository.searchBookings(criteria, limit, offset);
    } catch (error) {
      logger.error('Failed to search bookings', { error, criteria });
      throw error;
    }
  }

  /**
   * Get bookings with filters
   */
  async getBookingsWithFilters(filters: BookingFilters, limit: number = 100, offset: number = 0): Promise<Booking[]> {
    try {
      return await this.bookingRepository.findByFilters(filters, limit, offset);
    } catch (error) {
      logger.error('Failed to get bookings with filters', { error, filters });
      throw error;
    }
  }

  /**
   * Verify booking with external provider
   */
  async verifyBooking(bookingId: string): Promise<Booking> {
    try {
      logger.info('Verifying booking', { bookingId });

      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      const validationResult = await this.validationService.validateBooking({
        userId: booking.userId,
        type: booking.type,
        title: booking.title,
        description: booking.description,
        location: booking.location,
        dateRange: booking.dateRange,
        originalPrice: booking.originalPrice,
        swapValue: booking.swapValue,
        providerDetails: booking.providerDetails,
      });

      const verificationStatus: VerificationStatus = validationResult.isValid ? 'verified' : 'failed';
      const verifiedAt = validationResult.isValid ? new Date() : undefined;

      const updatedBooking = await this.bookingRepository.updateVerificationStatus(
        bookingId,
        verificationStatus,
        verifiedAt
      );

      if (!updatedBooking) {
        throw new Error('Failed to update booking verification status');
      }

      logger.info('Booking verification completed', { bookingId, status: verificationStatus });
      return updatedBooking;
    } catch (error) {
      logger.error('Failed to verify booking', { error, bookingId });
      throw error;
    }
  }

  /**
   * Lock booking for swap proposal
   */
  async lockBooking(bookingId: string, userId?: string): Promise<Booking> {
    try {
      logger.info('Locking booking for swap', { bookingId, userId });

      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'available') {
        throw new Error(`Cannot lock booking with status: ${booking.status}`);
      }

      if (userId && booking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      return await this.updateBookingStatus(bookingId, 'locked', userId);
    } catch (error) {
      logger.error('Failed to lock booking', { error, bookingId });
      throw error;
    }
  }

  /**
   * Unlock booking (release from swap proposal)
   */
  async unlockBooking(bookingId: string, userId?: string): Promise<Booking> {
    try {
      logger.info('Unlocking booking', { bookingId, userId });

      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'locked') {
        throw new Error(`Cannot unlock booking with status: ${booking.status}`);
      }

      if (userId && booking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      return await this.updateBookingStatus(bookingId, 'available', userId);
    } catch (error) {
      logger.error('Failed to unlock booking', { error, bookingId });
      throw error;
    }
  }

  /**
   * Cancel booking listing
   */
  async cancelBooking(bookingId: string, userId: string): Promise<Booking> {
    try {
      logger.info('Cancelling booking', { bookingId, userId });

      const booking = await this.bookingRepository.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.userId !== userId) {
        throw new Error('Unauthorized: User does not own this booking');
      }

      if (booking.status === 'swapped') {
        throw new Error('Cannot cancel a booking that has already been swapped');
      }

      return await this.updateBookingStatus(bookingId, 'cancelled', userId);
    } catch (error) {
      logger.error('Failed to cancel booking', { error, bookingId });
      throw error;
    }
  }
}