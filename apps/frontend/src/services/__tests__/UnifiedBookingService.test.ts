import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import axios from 'axios';
import { UnifiedBookingService } from '../UnifiedBookingService';
import { bookingService } from '../bookingService';
import { swapService } from '../swapService';
import {
  UnifiedBookingData,
  BookingWithSwapInfo,
  InlineProposalData,
  EnhancedBookingFilters,
  UpdateBookingWithSwapRequest,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock the existing services
vi.mock('../bookingService');
vi.mock('../swapService');

const mockBookingService = bookingService as any;
const mockSwapService = swapService as any;

describe('UnifiedBookingService', () => {
  let service: UnifiedBookingService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    
    // Create service instance
    service = new UnifiedBookingService();
  });

  describe('createBookingWithSwap', () => {
    const mockUnifiedBookingData: UnifiedBookingData = {
      type: 'hotel',
      title: 'Test Hotel Booking',
      description: 'A test hotel booking',
      location: {
        city: 'New York',
        country: 'USA',
      },
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      },
      originalPrice: 500,
      swapValue: 500,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF456',
      },
      swapEnabled: true,
      swapPreferences: {
        paymentTypes: ['booking', 'cash'],
        minCashAmount: 200,
        acceptanceStrategy: 'first-match',
        swapConditions: ['Non-smoking room'],
      },
    };

    const mockBooking = {
      id: 'booking-123',
      userId: 'user-123',
      ...mockUnifiedBookingData,
      status: 'available',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create booking with swap preferences successfully', async () => {
      // Mock booking service response
      mockBookingService.createBooking.mockResolvedValue(mockBooking);
      
      // Mock swap creation response
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: 'swap-123',
          status: 'active',
        },
      });

      const result = await service.createBookingWithSwap(mockUnifiedBookingData);

      expect(mockBookingService.createBooking).toHaveBeenCalledWith({
        type: mockUnifiedBookingData.type,
        title: mockUnifiedBookingData.title,
        description: mockUnifiedBookingData.description,
        location: mockUnifiedBookingData.location,
        dateRange: mockUnifiedBookingData.dateRange,
        originalPrice: mockUnifiedBookingData.originalPrice,
        swapValue: mockUnifiedBookingData.swapValue,
        providerDetails: mockUnifiedBookingData.providerDetails,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/swaps/enhanced', expect.objectContaining({
        sourceBookingId: mockBooking.id,
        paymentTypes: expect.objectContaining({
          bookingExchange: true,
          cashPayment: true,
          minimumCashAmount: 200,
        }),
        acceptanceStrategy: expect.objectContaining({
          type: 'first-match',
        }),
      }));

      expect(result).toEqual({
        booking: mockBooking,
        swap: {
          id: 'swap-123',
          status: 'active',
          paymentTypes: ['booking', 'cash'],
          acceptanceStrategy: 'first-match',
        },
      });
    });

    it('should create booking without swap when swap is disabled', async () => {
      const bookingDataWithoutSwap = {
        ...mockUnifiedBookingData,
        swapEnabled: false,
        swapPreferences: undefined,
      };

      mockBookingService.createBooking.mockResolvedValue(mockBooking);

      const result = await service.createBookingWithSwap(bookingDataWithoutSwap);

      expect(mockBookingService.createBooking).toHaveBeenCalled();
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
      expect(result).toEqual({
        booking: mockBooking,
        swap: undefined,
      });
    });

    it('should validate booking data and throw error for invalid data', async () => {
      const invalidData = {
        ...mockUnifiedBookingData,
        title: '', // Invalid: empty title
      };

      await expect(service.createBookingWithSwap(invalidData)).rejects.toThrow('Invalid booking data');
    });

    it('should validate swap preferences when enabled', async () => {
      const invalidSwapData = {
        ...mockUnifiedBookingData,
        swapPreferences: {
          paymentTypes: [], // Invalid: no payment types
          acceptanceStrategy: 'first-match' as const,
          swapConditions: [],
        },
      };

      await expect(service.createBookingWithSwap(invalidSwapData)).rejects.toThrow('At least one payment type must be selected');
    });

    it('should validate auction end date for auction strategy', async () => {
      const invalidAuctionData = {
        ...mockUnifiedBookingData,
        swapPreferences: {
          paymentTypes: ['booking'] as const,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date('2024-05-30'), // Too close to event date
          swapConditions: [],
        },
      };

      await expect(service.createBookingWithSwap(invalidAuctionData)).rejects.toThrow('Auction must end at least one week before the event');
    });
  });

  describe('updateBookingWithSwap', () => {
    const bookingId = 'booking-123';
    const updateRequest: UpdateBookingWithSwapRequest = {
      bookingData: {
        title: 'Updated Hotel Booking',
        description: 'Updated description',
      },
      swapEnabled: true,
      swapPreferences: {
        paymentTypes: ['cash'],
        minCashAmount: 300,
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('2024-05-20'),
        swapConditions: ['Updated conditions'],
      },
    };

    const mockUpdatedBooking = {
      id: bookingId,
      title: 'Updated Hotel Booking',
      description: 'Updated description',
    };

    it('should update booking and create new swap when no existing swap', async () => {
      mockBookingService.updateBooking.mockResolvedValue(mockUpdatedBooking);
      
      // Mock no existing swap (404 error)
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 404 } });
      
      // Mock swap creation
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'swap-456', status: 'active' },
      });

      const result = await service.updateBookingWithSwap(bookingId, updateRequest);

      expect(mockBookingService.updateBooking).toHaveBeenCalledWith(bookingId, {
        title: 'Updated Hotel Booking',
        description: 'Updated description',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/swaps/enhanced', expect.any(Object));
      expect(result.swap).toBeDefined();
    });

    it('should update existing swap when swap already exists', async () => {
      mockBookingService.updateBooking.mockResolvedValue(mockUpdatedBooking);
      
      // Mock existing swap
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'existing-swap-123' },
      });
      
      // Mock swap update
      mockAxiosInstance.put.mockResolvedValue({
        data: { id: 'existing-swap-123', status: 'updated' },
      });

      const result = await service.updateBookingWithSwap(bookingId, updateRequest);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/swaps/enhanced/existing-swap-123',
        expect.any(Object)
      );
      expect(result.swap?.id).toBe('existing-swap-123');
    });

    it('should cancel existing swap when swap is disabled', async () => {
      const disableSwapRequest = {
        ...updateRequest,
        swapEnabled: false,
        swapPreferences: undefined,
      };

      mockBookingService.updateBooking.mockResolvedValue(mockUpdatedBooking);
      
      // Mock existing swap
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: 'existing-swap-123' },
      });
      
      // Mock swap cancellation
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });

      const result = await service.updateBookingWithSwap(bookingId, disableSwapRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/swaps/existing-swap-123/cancel',
        { reason: 'Swap disabled by user' }
      );
      expect(result.swap).toBeUndefined();
    });
  });

  describe('getBookingsWithSwapInfo', () => {
    const mockFilters: EnhancedBookingFilters = {
      swapAvailable: true,
      acceptsCash: true,
      location: { city: 'New York' },
      priceRange: { min: 100, max: 1000 },
    };

    const mockBookings = [
      {
        id: 'booking-1',
        userId: 'other-user',
        title: 'Hotel 1',
        status: 'available',
        originalPrice: 500,
        swapValue: 500,
        createdAt: new Date(),
      },
      {
        id: 'booking-2',
        userId: 'current-user',
        title: 'Hotel 2',
        status: 'available',
        originalPrice: 300,
        swapValue: 300,
        createdAt: new Date(),
      },
    ];

    const mockSwapInfo = {
      swapId: 'swap-1',
      paymentTypes: ['booking', 'cash'],
      acceptanceStrategy: 'first-match',
      hasActiveProposals: true,
      activeProposalCount: 2,
      minCashAmount: 200,
    };

    it('should return bookings with swap information and apply filters', async () => {
      mockBookingService.getBookings.mockResolvedValue(mockBookings);
      
      // Mock swap info for first booking
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockSwapInfo })
        .mockRejectedValueOnce({ response: { status: 404 } }); // No swap info for second booking

      const result = await service.getBookingsWithSwapInfo(mockFilters, 'current-user');

      expect(mockBookingService.getBookings).toHaveBeenCalledWith({
        location: { city: 'New York' },
        priceRange: { min: 100, max: 1000 },
      });

      // Should exclude current user's booking and apply swap filters
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking-1');
      expect(result[0].swapInfo).toEqual(mockSwapInfo);
    });

    it('should apply auction mode filter', async () => {
      const auctionFilters = {
        ...mockFilters,
        auctionMode: true,
      };

      const auctionSwapInfo = {
        ...mockSwapInfo,
        acceptanceStrategy: 'auction' as const,
        auctionEndDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
      };

      mockBookingService.getBookings.mockResolvedValue([mockBookings[0]]);
      mockAxiosInstance.get.mockResolvedValue({ data: auctionSwapInfo });

      const result = await service.getBookingsWithSwapInfo(auctionFilters, 'current-user');

      expect(result).toHaveLength(1);
      expect(result[0].swapInfo?.acceptanceStrategy).toBe('auction');
    });

    it('should apply sorting when specified', async () => {
      const sortedFilters = {
        ...mockFilters,
        sortBy: 'price' as const,
        sortOrder: 'desc' as const,
      };

      const bookingsWithDifferentPrices = [
        { ...mockBookings[0], originalPrice: 300, userId: 'other-user-1' },
        { ...mockBookings[0], id: 'booking-3', originalPrice: 600, userId: 'other-user-2' },
      ];

      mockBookingService.getBookings.mockResolvedValue(bookingsWithDifferentPrices);
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });

      const result = await service.getBookingsWithSwapInfo(sortedFilters, 'current-user');

      expect(result[0].originalPrice).toBe(600); // Higher price first (desc order)
      expect(result[1].originalPrice).toBe(300);
    });
  });

  describe('makeInlineProposal', () => {
    const bookingId = 'booking-123';
    const mockSwapInfo = {
      swapId: 'swap-123',
      paymentTypes: ['booking', 'cash'],
      hasActiveProposals: true,
    };

    it('should create booking proposal successfully', async () => {
      const proposalData: InlineProposalData = {
        type: 'booking',
        selectedBookingId: 'user-booking-456',
        message: 'Interested in swapping',
        conditions: ['Flexible dates'],
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'proposal-123', status: 'pending' },
      });

      const result = await service.makeInlineProposal(bookingId, proposalData);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/swaps/info/${bookingId}`);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/swaps/${mockSwapInfo.swapId}/proposals/booking`,
        {
          bookingId: 'user-booking-456',
          message: 'Interested in swapping',
          conditions: ['Flexible dates'],
        }
      );
      expect(result.id).toBe('proposal-123');
    });

    it('should create cash proposal successfully', async () => {
      const proposalData: InlineProposalData = {
        type: 'cash',
        cashAmount: 400,
        paymentMethodId: 'payment-method-123',
        message: 'Cash offer',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: 'proposal-456', status: 'pending' },
      });

      const result = await service.makeInlineProposal(bookingId, proposalData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        `/swaps/${mockSwapInfo.swapId}/proposals/cash`,
        {
          amount: 400,
          currency: 'USD',
          paymentMethodId: 'payment-method-123',
          message: 'Cash offer',
        }
      );
      expect(result.id).toBe('proposal-456');
    });

    it('should throw error when no swap exists for booking', async () => {
      const proposalData: InlineProposalData = {
        type: 'booking',
        selectedBookingId: 'user-booking-456',
      };

      mockAxiosInstance.get.mockResolvedValue({ data: null });

      await expect(service.makeInlineProposal(bookingId, proposalData)).rejects.toThrow(
        'No active swap found for this booking'
      );
    });

    it('should validate proposal data', async () => {
      const invalidProposalData: InlineProposalData = {
        type: 'booking',
        // Missing selectedBookingId
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });

      await expect(service.makeInlineProposal(bookingId, invalidProposalData)).rejects.toThrow(
        'Selected booking ID is required for booking proposals'
      );
    });
  });

  describe('getUserRoleForBooking', () => {
    const bookingId = 'booking-123';
    const userId = 'user-123';

    it('should return owner role when user owns the booking', async () => {
      const mockBooking = {
        id: bookingId,
        userId: userId,
        title: 'Test Booking',
      };

      mockBookingService.getBooking.mockResolvedValue(mockBooking);

      const role = await service.getUserRoleForBooking(bookingId, userId);

      expect(role).toBe('owner');
    });

    it('should return proposer role when user has made proposals', async () => {
      const mockBooking = {
        id: bookingId,
        userId: 'other-user',
        title: 'Test Booking',
      };

      const mockSwapInfo = {
        swapId: 'swap-123',
        userProposalStatus: 'pending',
      };

      mockBookingService.getBooking.mockResolvedValue(mockBooking);
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });

      const role = await service.getUserRoleForBooking(bookingId, userId);

      expect(role).toBe('proposer');
    });

    it('should return browser role by default', async () => {
      const mockBooking = {
        id: bookingId,
        userId: 'other-user',
        title: 'Test Booking',
      };

      const mockSwapInfo = {
        swapId: 'swap-123',
        userProposalStatus: 'none',
      };

      mockBookingService.getBooking.mockResolvedValue(mockBooking);
      mockAxiosInstance.get.mockResolvedValue({ data: mockSwapInfo });

      const role = await service.getUserRoleForBooking(bookingId, userId);

      expect(role).toBe('browser');
    });
  });

  describe('getUserAvailableBookings', () => {
    const userId = 'user-123';

    it('should return available verified bookings excluding specified booking', async () => {
      const mockUserBookings = [
        {
          id: 'booking-1',
          status: 'available',
          verification: { status: 'verified' },
        },
        {
          id: 'booking-2',
          status: 'locked',
          verification: { status: 'verified' },
        },
        {
          id: 'booking-3',
          status: 'available',
          verification: { status: 'pending' },
        },
        {
          id: 'booking-4',
          status: 'available',
          verification: { status: 'verified' },
        },
      ];

      mockBookingService.getUserBookings.mockResolvedValue(mockUserBookings);

      const result = await service.getUserAvailableBookings(userId, 'booking-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking-4');
    });
  });

  describe('applyBrowsingRestrictions', () => {
    it('should filter out user own bookings and cancelled bookings', () => {
      const mockBookings: BookingWithSwapInfo[] = [
        {
          id: 'booking-1',
          userId: 'current-user',
          status: 'available',
          swapInfo: { hasActiveProposals: true } as any,
        } as any,
        {
          id: 'booking-2',
          userId: 'other-user',
          status: 'cancelled',
          swapInfo: { hasActiveProposals: true } as any,
        } as any,
        {
          id: 'booking-3',
          userId: 'other-user',
          status: 'available',
          swapInfo: { hasActiveProposals: true } as any,
        } as any,
        {
          id: 'booking-4',
          userId: 'other-user',
          status: 'available',
          swapInfo: { hasActiveProposals: false } as any,
        } as any,
      ];

      const result = (service as any).applyBrowsingRestrictions(mockBookings, 'current-user');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking-3');
    });
  });
});