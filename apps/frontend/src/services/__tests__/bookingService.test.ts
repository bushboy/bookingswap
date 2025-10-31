import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import {
  bookingService,
  CreateBookingRequest,
  BookingFilters,
} from '../bookingService';
import {
  Booking,
  BookingType,
  BookingStatus,
  ValidationError,
  BusinessLogicError,
  SwapPlatformError,
  ERROR_CODES,
} from '@booking-swap/shared';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('BookingService', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    mockLocalStorage.getItem.mockReturnValue('mock-token');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const mockBooking: Booking = {
    id: '1',
    userId: 'user1',
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A test hotel booking',
    location: {
      city: 'New York',
      country: 'USA',
      coordinates: [40.7128, -74.006],
    },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date(),
      documents: ['doc1', 'doc2'],
    },
    blockchain: {
      transactionId: 'tx123',
      consensusTimestamp: '1234567890',
      topicId: 'topic1',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getBookings', () => {
    it('should fetch bookings successfully', async () => {
      const mockBookings = [mockBooking];
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBookings();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {},
      });
      expect(result).toEqual(mockBookings);
    });

    it('should fetch bookings with filters', async () => {
      const mockBookings = [mockBooking];
      const filters: BookingFilters = {
        type: ['hotel'],
        status: ['available'],
        location: { city: 'New York' },
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBookings(filters);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {
          type: 'hotel',
          status: 'available',
          city: 'New York',
        },
      });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getAllBookings', () => {
    it('should fetch all bookings successfully', async () => {
      const mockBookings = [mockBooking];
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getAllBookings();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {},
      });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getBookingsExcludingUser', () => {
    it('should fetch bookings excluding specified user', async () => {
      const mockBookings = [mockBooking];
      const userId = 'user123';

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBookingsExcludingUser(userId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: { excludeUserId: userId },
      });
      expect(result).toEqual(mockBookings);
    });

    it('should throw ValidationError for empty userId', async () => {
      await expect(bookingService.getBookingsExcludingUser('')).rejects.toThrow(
        ValidationError
      );

      await expect(bookingService.getBookingsExcludingUser('   ')).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle invalid response format', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: false }
      });

      await expect(bookingService.getBookingsExcludingUser('user123')).rejects.toThrow(
        SwapPlatformError
      );
    });

    it('should handle non-array bookings data', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: 'invalid' }
        }
      });

      await expect(bookingService.getBookingsExcludingUser('user123')).rejects.toThrow(
        SwapPlatformError
      );
    });

    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        request: {},
        message: 'Network Error'
      });

      await expect(bookingService.getBookingsExcludingUser('user123')).rejects.toThrow(
        SwapPlatformError
      );
    });
  });

  describe('getBrowseBookings', () => {
    it('should return filtered bookings for authenticated user', async () => {
      const mockBookings = [mockBooking];
      const userId = 'user123';

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBrowseBookings(userId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: { excludeUserId: userId },
      });
      expect(result).toEqual(mockBookings);
    });

    it('should return all bookings for unauthenticated user (no userId)', async () => {
      const mockBookings = [mockBooking];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBrowseBookings();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {},
      });
      expect(result).toEqual(mockBookings);
    });

    it('should return all bookings for empty userId', async () => {
      const mockBookings = [mockBooking];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBrowseBookings('');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {},
      });
      expect(result).toEqual(mockBookings);
    });

    it('should return all bookings for whitespace-only userId', async () => {
      const mockBookings = [mockBooking];

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          data: { bookings: mockBookings }
        }
      });

      const result = await bookingService.getBrowseBookings('   ');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings', {
        params: {},
      });
      expect(result).toEqual(mockBookings);
    });

    it('should handle errors from underlying methods', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 500,
          data: { error: { message: 'Server error' } }
        }
      });

      await expect(bookingService.getBrowseBookings('user123')).rejects.toThrow(
        SwapPlatformError
      );
    });
  });

  describe('getBooking', () => {
    it('should fetch a single booking successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockBooking });

      const result = await bookingService.getBooking('1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings/1');
      expect(result).toEqual(mockBooking);
    });

    it('should handle booking not found error', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          status: 404,
          data: { error: { message: 'Booking not found' } },
        },
      });

      await expect(bookingService.getBooking('999')).rejects.toThrow(
        BusinessLogicError
      );
    });
  });

  describe('createBooking', () => {
    const validBookingData: CreateBookingRequest = {
      type: 'hotel',
      title: 'Test Hotel',
      description: 'A test hotel booking',
      location: {
        city: 'New York',
        country: 'USA',
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF456',
      },
    };

    it('should create a booking successfully', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: mockBooking });

      const result = await bookingService.createBooking(validBookingData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bookings',
        validBookingData,
        {
          headers: undefined,
        }
      );
      expect(result).toEqual(mockBooking);
    });

    it('should handle validation errors', async () => {
      const invalidData = { ...validBookingData, title: '' };

      await expect(bookingService.createBooking(invalidData)).rejects.toThrow(
        ValidationError
      );
    });

    it('should handle file uploads', async () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const dataWithFiles = { ...validBookingData, documents: [file] };

      mockAxiosInstance.post.mockResolvedValue({ data: mockBooking });

      await bookingService.createBooking(dataWithFiles);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/bookings',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
    });
  });

  describe('updateBooking', () => {
    it('should update a booking successfully', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedBooking = { ...mockBooking, title: 'Updated Title' };

      mockAxiosInstance.put.mockResolvedValue({ data: updatedBooking });

      const result = await bookingService.updateBooking('1', updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/bookings/1',
        updateData
      );
      expect(result).toEqual(updatedBooking);
    });
  });

  describe('deleteBooking', () => {
    it('should delete a booking successfully', async () => {
      mockAxiosInstance.delete.mockResolvedValue({});

      await bookingService.deleteBooking('1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/bookings/1');
    });
  });

  describe('searchBookings', () => {
    it('should search bookings successfully', async () => {
      const searchResult = {
        bookings: [mockBooking],
        total: 1,
        page: 1,
        totalPages: 1,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: searchResult });

      const result = await bookingService.searchBookings({
        query: 'hotel',
        sortBy: 'price',
        sortOrder: 'asc',
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/bookings/search', {
        params: {
          q: 'hotel',
          sortBy: 'price',
          sortOrder: 'asc',
          page: 1,
          limit: 20,
        },
      });
      expect(result).toEqual(searchResult);
    });
  });

  describe('validateBooking', () => {
    const validData: CreateBookingRequest = {
      type: 'hotel',
      title: 'Test Hotel',
      description: 'A test hotel booking',
      location: {
        city: 'New York',
        country: 'USA',
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      originalPrice: 500,
      swapValue: 450,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF456',
      },
    };

    it('should validate valid booking data', async () => {
      const result = await bookingService.validateBooking(validData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors for invalid data', async () => {
      const invalidData = {
        ...validData,
        title: '',
        originalPrice: -100,
        dateRange: {
          checkIn: new Date('2023-01-01'), // Past date
          checkOut: new Date('2023-01-01'), // Same as check-in
        },
      };

      const result = await bookingService.validateBooking(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
      expect(result.errors.some(e => e.field === 'originalPrice')).toBe(true);
      expect(result.errors.some(e => e.field === 'dateRange.checkIn')).toBe(
        true
      );
    });
  });

  describe('canModifyBooking', () => {
    it('should return true for available booking', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockBooking });

      const result = await bookingService.canModifyBooking('1');

      expect(result).toBe(true);
    });

    it('should return false for locked booking', async () => {
      const lockedBooking = { ...mockBooking, status: 'locked' };
      mockAxiosInstance.get.mockResolvedValue({ data: lockedBooking });

      const result = await bookingService.canModifyBooking('1');

      expect(result).toBe(false);
    });

    it('should return false when booking not found', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Not found'));

      const result = await bookingService.canModifyBooking('999');

      expect(result).toBe(false);
    });
  });

  describe('canSwapBooking', () => {
    it('should return true for available and verified booking', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockBooking });

      const result = await bookingService.canSwapBooking('1');

      expect(result).toBe(true);
    });

    it('should return false for unverified booking', async () => {
      const unverifiedBooking = {
        ...mockBooking,
        verification: { ...mockBooking.verification, status: 'pending' },
      };
      mockAxiosInstance.get.mockResolvedValue({ data: unverifiedBooking });

      const result = await bookingService.canSwapBooking('1');

      expect(result).toBe(false);
    });
  });
});
