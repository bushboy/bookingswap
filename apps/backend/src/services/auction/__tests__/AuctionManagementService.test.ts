import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuctionManagementService } from '../AuctionManagementService';
import { AuctionRepository } from '../../../database/repositories/AuctionRepository';
import { SwapRepository } from '../../../database/repositories/SwapRepository';
import { BookingService } from '../../booking/BookingService';
import { HederaService } from '../../hedera/HederaService';
import { NotificationService } from '../../notification/NotificationService';

// Mock dependencies
vi.mock('../../../database/repositories/AuctionRepository');
vi.mock('../../../database/repositories/SwapRepository');
vi.mock('../../booking/BookingService');
vi.mock('../../hedera/HederaService');
vi.mock('../../notification/NotificationService');

describe('AuctionManagementService', () => {
  let service: AuctionManagementService;
  let mockAuctionRepository: any;
  let mockSwapRepository: any;
  let mockBookingService: any;
  let mockHederaService: any;
  let mockNotificationService: any;

  beforeEach(() => {
    mockAuctionRepository = {
      findById: vi.fn(),
      findBySwapId: vi.fn(),
      findAuctions: vi.fn(),
      createAuction: vi.fn(),
      updateStatus: vi.fn(),
      update: vi.fn(),
      createProposal: vi.fn(),
      getAuctionProposals: vi.fn(),
      findExpiredAuctions: vi.fn(),
      selectWinningProposal: vi.fn(),
      updateProposalStatus: vi.fn(),
      findProposals: vi.fn(),
    };

    mockSwapRepository = {
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    mockBookingService = {
      getBookingById: vi.fn(),
      lockBooking: vi.fn(),
      unlockBooking: vi.fn(),
    };

    mockHederaService = {
      submitTransaction: vi.fn(),
    };

    mockNotificationService = {
      sendAuctionCreatedNotification: vi.fn(),
      sendAuctionEndedNotification: vi.fn(),
      sendAuctionProposalNotification: vi.fn(),
      sendAuctionWinnerNotification: vi.fn(),
      sendAuctionLoserNotification: vi.fn(),
      sendAuctionCancelledNotification: vi.fn(),
      sendAuctionConvertedNotification: vi.fn(),
      sendAutoSelectionNotification: vi.fn(),
      sendAuctionSelectionReminderNotification: vi.fn(),
    };

    service = new AuctionManagementService(
      mockAuctionRepository,
      mockSwapRepository,
      mockBookingService,
      mockHederaService,
      mockNotificationService
    );
  });

  describe('isLastMinuteBooking', () => {
    it('should return true for bookings less than one week away', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days from now

      const mockBooking = {
        id: 'booking-1',
        dateRange: {
          checkIn: futureDate,
          checkOut: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking as any);

      const result = await service.isLastMinuteBooking('booking-1');
      expect(result).toBe(true);
    });

    it('should return false for bookings more than one week away', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10); // 10 days from now

      const mockBooking = {
        id: 'booking-1',
        dateRange: {
          checkIn: futureDate,
          checkOut: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking as any);

      const result = await service.isLastMinuteBooking('booking-1');
      expect(result).toBe(false);
    });

    it('should throw error for non-existent booking', async () => {
      mockBookingService.getBookingById.mockResolvedValue(null);

      await expect(service.isLastMinuteBooking('non-existent')).rejects.toThrow('Booking not found');
    });
  });

  describe('validateAuctionTiming', () => {
    it('should validate correct auction timing', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 6); // 6 days from now (8 days before event)

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isLastMinute).toBe(false);
    });

    it('should reject auction for last-minute booking', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 5); // 5 days from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 2); // 2 days from now

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.isLastMinute).toBe(true);
      expect(result.errors).toContain('Auctions are not allowed for events less than one week away');
    });

    it('should reject auction ending too close to event', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now (4 days before event)

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction must end at least one week before the event');
    });

    it('should reject auction ending in the past', async () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() - 1); // Yesterday

      const result = await service.validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction end date must be in the future');
    });
  });

  describe('checkAuctionAvailability', () => {
    it('should return available for valid booking', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14); // 2 weeks from now

      const mockBooking = {
        id: 'booking-1',
        dateRange: {
          checkIn: futureDate,
          checkOut: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking as any);

      const result = await service.checkAuctionAvailability('booking-1');

      expect(result.available).toBe(true);
      expect(result.isLastMinute).toBe(false);
      expect(result.minimumAuctionEndDate).toBeDefined();
    });

    it('should return unavailable for last-minute booking', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5); // 5 days from now

      const mockBooking = {
        id: 'booking-1',
        dateRange: {
          checkIn: futureDate,
          checkOut: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      mockBookingService.getBookingById.mockResolvedValue(mockBooking as any);

      const result = await service.checkAuctionAvailability('booking-1');

      expect(result.available).toBe(false);
      expect(result.isLastMinute).toBe(true);
      expect(result.reason).toContain('less than one week away');
    });
  });

  describe('createAuction - Enhanced Validation', () => {
    beforeEach(() => {
      // Add missing mock services for enhanced validation tests
      service = new AuctionManagementService(
        mockAuctionRepository,
        mockSwapRepository,
        mockBookingService,
        mockHederaService,
        mockNotificationService,
        {} as any, // auctionNotificationService
        {} as any, // paymentNotificationService
        {} as any  // timingNotificationService
      );
    });

    it('should validate auction settings and create auction successfully', async () => {
      const futureEventDate = new Date();
      futureEventDate.setDate(futureEventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 6); // 6 days from now (8 days before event)

      const mockSwap = {
        id: 'swap-1',
        sourceBookingId: 'booking-1',
      };

      const mockBooking = {
        id: 'booking-1',
        userId: 'user-1',
        dateRange: {
          checkIn: futureEventDate,
          checkOut: new Date(futureEventDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      const mockAuction = {
        id: 'auction-1',
        swapId: 'swap-1',
        ownerId: 'user-1',
        status: 'active',
        settings: {
          endDate: auctionEndDate,
          allowBookingProposals: true,
          allowCashProposals: true,
        },
        blockchain: {
          creationTransactionId: '',
        },
      };

      const mockUpdatedAuction = {
        ...mockAuction,
        blockchain: {
          creationTransactionId: 'tx-123',
        },
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockBookingService.getBookingById.mockResolvedValue(mockBooking);
      mockAuctionRepository.createAuction.mockResolvedValue(mockAuction);
      mockHederaService.recordAuctionCreation = vi.fn().mockResolvedValue('tx-123');
      mockAuctionRepository.update.mockResolvedValue(mockUpdatedAuction);

      const request = {
        swapId: 'swap-1',
        settings: {
          endDate: auctionEndDate.toISOString(), // Test string date conversion
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 100,
          autoSelectAfterHours: 24,
        },
      };

      const result = await service.createAuction(request);

      expect(result.auction).toBeDefined();
      expect(result.blockchainTransaction.transactionId).toBe('tx-123');
      expect(mockHederaService.recordAuctionCreation).toHaveBeenCalledWith({
        auctionId: 'auction-1',
        swapId: 'swap-1',
        ownerId: 'user-1',
        settings: expect.objectContaining({
          endDate: expect.any(Date),
          allowBookingProposals: true,
          allowCashProposals: true,
        }),
      });
    });

    it('should reject invalid auction settings', async () => {
      const mockSwap = {
        id: 'swap-1',
        sourceBookingId: 'booking-1',
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);

      const request = {
        swapId: 'swap-1',
        settings: {
          endDate: 'invalid-date', // Invalid date
          allowBookingProposals: false,
          allowCashProposals: false, // Both proposal types disabled
        },
      };

      await expect(service.createAuction(request)).rejects.toThrow();
    });

    it('should reject auction for last-minute booking', async () => {
      const futureEventDate = new Date();
      futureEventDate.setDate(futureEventDate.getDate() + 5); // 5 days from now (last minute)

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 2); // 2 days from now

      const mockSwap = {
        id: 'swap-1',
        sourceBookingId: 'booking-1',
      };

      const mockBooking = {
        id: 'booking-1',
        userId: 'user-1',
        dateRange: {
          checkIn: futureEventDate,
          checkOut: new Date(futureEventDate.getTime() + 24 * 60 * 60 * 1000),
        },
      };

      mockSwapRepository.findById.mockResolvedValue(mockSwap);
      mockBookingService.getBookingById.mockResolvedValue(mockBooking);

      const request = {
        swapId: 'swap-1',
        settings: {
          endDate: auctionEndDate,
          allowBookingProposals: true,
          allowCashProposals: true,
        },
      };

      await expect(service.createAuction(request)).rejects.toThrow(/less than one week away/);
    });
  });
});