import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingService, CreateBookingRequest } from '../BookingService';
import { BookingRepository } from '../../../database/repositories/BookingRepository';
import { HederaService } from '../../hedera/HederaService';
import { BookingValidationService } from '../BookingValidationService';
import { Booking, BookingStatus } from '@booking-swap/shared';
import { logger } from '../../../utils/logger';

// Mock dependencies
vi.mock('../../../database/repositories/BookingRepository');
vi.mock('../../hedera/HederaService');
vi.mock('../BookingValidationService');
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('BookingService', () => {
  let bookingService: BookingService;
  let mockBookingRepository: any;
  let mockHederaService: any;
  let mockValidationService: any;
  let mockCreateRequest: CreateBookingRequest;
  let mockBooking: Booking;

  beforeEach(() => {
    mockBookingRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUserId: vi.fn(),
      searchBookings: vi.fn(),
      findByFilters: vi.fn(),
      updateStatus: vi.fn(),
      updateVerificationStatus: vi.fn(),
      updateBlockchainInfo: vi.fn(),
    };
    
    mockHederaService = {
      getTopicId: vi.fn(),
      submitTransaction: vi.fn(),
    };
    
    mockValidationService = {
      validateBooking: vi.fn(),
    };

    bookingService = new BookingService(
      mockBookingRepository,
      mockHederaService,
      mockValidationService
    );

    mockCreateRequest = {
      userId: 'user123',
      type: 'hotel',
      title: 'Luxury Hotel Stay',
      description: 'Beautiful hotel in downtown',
      location: {
        city: 'New York',
        country: 'USA',
        coordinates: [-74.006, 40.7128],
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'booking.com',
        confirmationNumber: 'BK123456789',
        bookingReference: 'REF123456',
      },
    };

    mockBooking = {
      id: 'booking123',
      userId: 'user123',
      type: 'hotel',
      title: 'Luxury Hotel Stay',
      description: 'Beautiful hotel in downtown',
      location: {
        city: 'New York',
        country: 'USA',
        coordinates: [-74.006, 40.7128],
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'booking.com',
        confirmationNumber: 'BK123456789',
        bookingReference: 'REF123456',
      },
      verification: {
        status: 'pending',
        documents: [],
      },
      blockchain: {
        topicId: 'topic123',
        transactionId: 'tx123',
        consensusTimestamp: '1234567890',
      },
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.clearAllMocks();
  });

  describe('createBookingListing', () => {
    it('should create booking listing successfully', async () => {
      // Mock validation success
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: true,
        errors: [],
        warnings: [],
        documents: ['doc1', 'doc2'],
      });

      // Mock repository create
      mockBookingRepository.create.mockResolvedValueOnce(mockBooking);

      // Mock Hedera service
      mockHederaService.getTopicId.mockReturnValue('topic123');
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx123',
        consensusTimestamp: '1234567890',
        status: 'SUCCESS',
      });

      // Mock repository update
      const updatedBooking = { ...mockBooking, blockchain: { ...mockBooking.blockchain, transactionId: 'tx123' } };
      mockBookingRepository.updateBlockchainInfo.mockResolvedValueOnce(updatedBooking);

      const result = await bookingService.createBookingListing(mockCreateRequest);

      expect(result.booking).toEqual(updatedBooking);
      expect(result.blockchainTransaction.transactionId).toBe('tx123');
      expect(mockValidationService.validateBooking).toHaveBeenCalledWith(mockCreateRequest);
      expect(mockBookingRepository.create).toHaveBeenCalled();
      expect(mockHederaService.submitTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'booking_listing',
          payload: expect.objectContaining({
            bookingId: mockBooking.id,
            userId: mockBooking.userId,
          }),
        })
      );
      expect(logger.info).toHaveBeenCalledWith('Booking listing created successfully', expect.any(Object));
    });

    it('should fail when validation fails', async () => {
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid confirmation number'],
        warnings: [],
      });

      await expect(bookingService.createBookingListing(mockCreateRequest)).rejects.toThrow(
        'Booking validation failed: Invalid confirmation number'
      );

      expect(mockBookingRepository.create).not.toHaveBeenCalled();
      expect(mockHederaService.submitTransaction).not.toHaveBeenCalled();
    });

    it('should handle blockchain transaction failure', async () => {
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockBookingRepository.create.mockResolvedValueOnce(mockBooking);
      mockHederaService.getTopicId.mockReturnValue('topic123');
      mockHederaService.submitTransaction.mockRejectedValueOnce(new Error('Blockchain error'));

      await expect(bookingService.createBookingListing(mockCreateRequest)).rejects.toThrow('Blockchain error');

      expect(logger.error).toHaveBeenCalledWith('Failed to create booking listing', expect.any(Object));
    });

    it('should handle repository update failure', async () => {
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: true,
        errors: [],
        warnings: [],
      });

      mockBookingRepository.create.mockResolvedValueOnce(mockBooking);
      mockHederaService.getTopicId.mockReturnValue('topic123');
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx123',
        consensusTimestamp: '1234567890',
        status: 'SUCCESS',
      });

      mockBookingRepository.updateBlockchainInfo.mockResolvedValueOnce(null);

      await expect(bookingService.createBookingListing(mockCreateRequest)).rejects.toThrow(
        'Failed to update booking with blockchain information'
      );
    });
  });

  describe('updateBookingStatus', () => {
    it('should update booking status successfully', async () => {
      const updatedBooking = { ...mockBooking, status: 'locked' as BookingStatus };
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);
      mockBookingRepository.updateStatus.mockResolvedValueOnce(updatedBooking);
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx456',
        status: 'SUCCESS',
      });

      const result = await bookingService.updateBookingStatus('booking123', 'locked', 'user123');

      expect(result.status).toBe('locked');
      expect(mockBookingRepository.findById).toHaveBeenCalledWith('booking123');
      expect(mockBookingRepository.updateStatus).toHaveBeenCalledWith('booking123', 'locked');
      expect(mockHederaService.submitTransaction).toHaveBeenCalled();
    });

    it('should fail when user does not own booking', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);

      await expect(
        bookingService.updateBookingStatus('booking123', 'locked', 'different-user')
      ).rejects.toThrow('Unauthorized: User does not own this booking');

      expect(mockBookingRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('should fail when booking not found', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(null);

      await expect(
        bookingService.updateBookingStatus('booking123', 'locked', 'user123')
      ).rejects.toThrow('Booking not found');
    });

    it('should update status without user verification when userId not provided', async () => {
      const updatedBooking = { ...mockBooking, status: 'locked' as BookingStatus };
      mockBookingRepository.updateStatus.mockResolvedValueOnce(updatedBooking);
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx456',
        status: 'SUCCESS',
      });

      const result = await bookingService.updateBookingStatus('booking123', 'locked');

      expect(result.status).toBe('locked');
      expect(mockBookingRepository.findById).not.toHaveBeenCalled();
      expect(mockBookingRepository.updateStatus).toHaveBeenCalledWith('booking123', 'locked');
    });
  });

  describe('getBookingById', () => {
    it('should return booking when found', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);

      const result = await bookingService.getBookingById('booking123');

      expect(result).toEqual(mockBooking);
      expect(mockBookingRepository.findById).toHaveBeenCalledWith('booking123');
    });

    it('should return null when booking not found', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(null);

      const result = await bookingService.getBookingById('booking123');

      expect(result).toBeNull();
    });

    it('should handle repository errors', async () => {
      mockBookingRepository.findById.mockRejectedValueOnce(new Error('Database error'));

      await expect(bookingService.getBookingById('booking123')).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalledWith('Failed to get booking by ID', expect.any(Object));
    });
  });

  describe('getUserBookings', () => {
    it('should return user bookings', async () => {
      const userBookings = [mockBooking];
      mockBookingRepository.findByUserId.mockResolvedValueOnce(userBookings);

      const result = await bookingService.getUserBookings('user123');

      expect(result).toEqual(userBookings);
      expect(mockBookingRepository.findByUserId).toHaveBeenCalledWith('user123', 100, 0);
    });

    it('should handle custom limit and offset', async () => {
      const userBookings = [mockBooking];
      mockBookingRepository.findByUserId.mockResolvedValueOnce(userBookings);

      await bookingService.getUserBookings('user123', 50, 10);

      expect(mockBookingRepository.findByUserId).toHaveBeenCalledWith('user123', 50, 10);
    });
  });

  describe('searchBookings', () => {
    it('should search bookings with criteria', async () => {
      const searchResults = [mockBooking];
      const criteria = {
        query: 'hotel',
        location: { city: 'New York' },
        priceRange: { min: 100, max: 1000 },
      };

      mockBookingRepository.searchBookings.mockResolvedValueOnce(searchResults);

      const result = await bookingService.searchBookings(criteria);

      expect(result).toEqual(searchResults);
      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(criteria, 100, 0);
    });
  });

  describe('verifyBooking', () => {
    it('should verify booking successfully', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: true,
        errors: [],
        warnings: [],
      });

      const verifiedBooking = { ...mockBooking, verification: { ...mockBooking.verification, status: 'verified' as const } };
      mockBookingRepository.updateVerificationStatus.mockResolvedValueOnce(verifiedBooking);

      const result = await bookingService.verifyBooking('booking123');

      expect(result.verification.status).toBe('verified');
      expect(mockValidationService.validateBooking).toHaveBeenCalled();
      expect(mockBookingRepository.updateVerificationStatus).toHaveBeenCalledWith(
        'booking123',
        'verified',
        expect.any(Date)
      );
    });

    it('should mark booking as failed when validation fails', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);
      mockValidationService.validateBooking.mockResolvedValueOnce({
        isValid: false,
        errors: ['Invalid booking'],
        warnings: [],
      });

      const failedBooking = { ...mockBooking, verification: { ...mockBooking.verification, status: 'failed' as const } };
      mockBookingRepository.updateVerificationStatus.mockResolvedValueOnce(failedBooking);

      const result = await bookingService.verifyBooking('booking123');

      expect(result.verification.status).toBe('failed');
      expect(mockBookingRepository.updateVerificationStatus).toHaveBeenCalledWith(
        'booking123',
        'failed',
        undefined
      );
    });
  });

  describe('lockBooking', () => {
    it('should lock available booking successfully', async () => {
      // Mock the findById calls - one for lockBooking and one for updateBookingStatus
      mockBookingRepository.findById
        .mockResolvedValueOnce(mockBooking)  // First call in lockBooking
        .mockResolvedValueOnce(mockBooking); // Second call in updateBookingStatus
      
      const lockedBooking = { ...mockBooking, status: 'locked' as BookingStatus };
      mockBookingRepository.updateStatus.mockResolvedValueOnce(lockedBooking);
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx456',
        status: 'SUCCESS',
      });

      const result = await bookingService.lockBooking('booking123', 'user123');

      expect(result.status).toBe('locked');
    });

    it('should fail to lock non-available booking', async () => {
      const lockedBooking = { ...mockBooking, status: 'locked' as BookingStatus };
      mockBookingRepository.findById.mockResolvedValueOnce(lockedBooking);

      await expect(bookingService.lockBooking('booking123', 'user123')).rejects.toThrow(
        'Cannot lock booking with status: locked'
      );
    });

    it('should fail when user does not own booking', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);

      await expect(bookingService.lockBooking('booking123', 'different-user')).rejects.toThrow(
        'Unauthorized: User does not own this booking'
      );
    });
  });

  describe('unlockBooking', () => {
    it('should unlock locked booking successfully', async () => {
      const lockedBooking = { ...mockBooking, status: 'locked' as BookingStatus };
      // Mock the findById calls - one for unlockBooking and one for updateBookingStatus
      mockBookingRepository.findById
        .mockResolvedValueOnce(lockedBooking)  // First call in unlockBooking
        .mockResolvedValueOnce(lockedBooking); // Second call in updateBookingStatus
      
      const unlockedBooking = { ...mockBooking, status: 'available' as BookingStatus };
      mockBookingRepository.updateStatus.mockResolvedValueOnce(unlockedBooking);
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx456',
        status: 'SUCCESS',
      });

      const result = await bookingService.unlockBooking('booking123', 'user123');

      expect(result.status).toBe('available');
    });

    it('should fail to unlock non-locked booking', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);

      await expect(bookingService.unlockBooking('booking123', 'user123')).rejects.toThrow(
        'Cannot unlock booking with status: available'
      );
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      // Mock the findById calls - one for cancelBooking and one for updateBookingStatus
      mockBookingRepository.findById
        .mockResolvedValueOnce(mockBooking)  // First call in cancelBooking
        .mockResolvedValueOnce(mockBooking); // Second call in updateBookingStatus
      
      const cancelledBooking = { ...mockBooking, status: 'cancelled' as BookingStatus };
      mockBookingRepository.updateStatus.mockResolvedValueOnce(cancelledBooking);
      mockHederaService.submitTransaction.mockResolvedValueOnce({
        transactionId: 'tx456',
        status: 'SUCCESS',
      });

      const result = await bookingService.cancelBooking('booking123', 'user123');

      expect(result.status).toBe('cancelled');
    });

    it('should fail to cancel swapped booking', async () => {
      const swappedBooking = { ...mockBooking, status: 'swapped' as BookingStatus };
      mockBookingRepository.findById.mockResolvedValueOnce(swappedBooking);

      await expect(bookingService.cancelBooking('booking123', 'user123')).rejects.toThrow(
        'Cannot cancel a booking that has already been swapped'
      );
    });

    it('should fail when user does not own booking', async () => {
      mockBookingRepository.findById.mockResolvedValueOnce(mockBooking);

      await expect(bookingService.cancelBooking('booking123', 'different-user')).rejects.toThrow(
        'Unauthorized: User does not own this booking'
      );
    });
  });
});