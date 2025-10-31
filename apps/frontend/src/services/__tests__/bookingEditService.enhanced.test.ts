import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { bookingEditService } from '../bookingEditService';
import { ValidationError } from '@booking-swap/shared';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('BookingEditService - Enhanced Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock axios.create
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
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('updateBookingWithRecovery', () => {
    it('should return success when normal update succeeds', async () => {
      const mockBookingData = {
        id: 'booking-123',
        title: 'Updated Booking',
        type: 'hotel',
        dateRange: {
          checkIn: '2024-06-01T00:00:00.000Z',
          checkOut: '2024-06-05T00:00:00.000Z',
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      const mockResponse = {
        data: {
          success: true,
          data: {
            booking: mockBookingData,
            validationWarnings: ['Minor warning'],
          },
        },
      };

      // Mock the axios instance put method
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put).mockResolvedValue(mockResponse);

      const updateData = {
        title: 'Updated Booking',
        description: 'Updated description',
      };

      const result = await bookingEditService.updateBookingWithRecovery('booking-123', updateData);

      expect(result.success).toBe(true);
      expect(result.booking).toBeDefined();
      expect(result.booking?.title).toBe('Updated Booking');
      expect(result.validationWarnings).toEqual(['Minor warning']);
      expect(result.partialFailures).toBeUndefined();
    });

    it('should attempt partial recovery when validation fails', async () => {
      const validationError = new ValidationError('Validation failed', {
        errors: [
          { field: 'title', message: 'Title is required' },
          { field: 'description', message: 'Description too long' },
        ],
      });

      // Mock the first call to fail with validation error
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put)
        .mockRejectedValueOnce(validationError)
        // Mock individual field updates
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: {
              booking: {
                id: 'booking-123',
                title: 'Updated Title',
                dateRange: { checkIn: new Date(), checkOut: new Date() },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        })
        .mockRejectedValueOnce(new Error('Description validation failed'));

      const updateData = {
        title: 'Updated Title',
        description: 'This description is way too long and will fail validation',
      };

      const result = await bookingEditService.updateBookingWithRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.booking).toBeDefined(); // Should have the successful title update
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].field).toBe('description');
      expect(result.partialFailures?.[0].error).toBe('Description validation failed');
    });

    it('should handle complete failure gracefully', async () => {
      const networkError = new Error('Network error');
      
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put).mockRejectedValue(networkError);

      const updateData = {
        title: 'Updated Title',
      };

      await expect(
        bookingEditService.updateBookingWithRecovery('booking-123', updateData)
      ).rejects.toThrow('Network error');
    });

    it('should handle partial success with multiple fields', async () => {
      const validationError = new ValidationError('Multiple field validation failed', {
        errors: [
          { field: 'title', message: 'Title invalid' },
          { field: 'description', message: 'Description invalid' },
          { field: 'originalPrice', message: 'Price invalid' },
        ],
      });

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.put)
        .mockRejectedValueOnce(validationError)
        // Mock individual field updates - some succeed, some fail
        .mockResolvedValueOnce({ // title succeeds
          data: {
            success: true,
            data: {
              booking: {
                id: 'booking-123',
                title: 'Valid Title',
                dateRange: { checkIn: new Date(), checkOut: new Date() },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        })
        .mockRejectedValueOnce(new Error('Description still invalid')) // description fails
        .mockResolvedValueOnce({ // originalPrice succeeds
          data: {
            success: true,
            data: {
              booking: {
                id: 'booking-123',
                title: 'Valid Title',
                originalPrice: 500,
                dateRange: { checkIn: new Date(), checkOut: new Date() },
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        });

      const updateData = {
        title: 'Valid Title',
        description: 'Still invalid description',
        originalPrice: 500,
      };

      const result = await bookingEditService.updateBookingWithRecovery('booking-123', updateData);

      expect(result.success).toBe(false);
      expect(result.booking).toBeDefined();
      expect(result.booking?.title).toBe('Valid Title');
      expect(result.booking?.originalPrice).toBe(500);
      expect(result.partialFailures).toHaveLength(1);
      expect(result.partialFailures?.[0].field).toBe('description');
    });
  });

  describe('canEditBooking', () => {
    it('should return true when booking can be edited', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            canEdit: true,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await bookingEditService.canEditBooking('booking-123');

      expect(result.canEdit).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false with reason when booking cannot be edited', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            canEdit: false,
            reason: 'Booking has active swap proposals',
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await bookingEditService.canEditBooking('booking-123');

      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Booking has active swap proposals');
    });

    it('should handle API errors gracefully', async () => {
      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockRejectedValue(new Error('API Error'));

      const result = await bookingEditService.canEditBooking('booking-123');

      expect(result.canEdit).toBe(false);
      expect(result.reason).toBe('Unable to verify edit permissions');
    });
  });

  describe('getBookingEditHistory', () => {
    it('should return edit history with parsed dates', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          changes: {
            title: { from: 'Old Title', to: 'New Title' },
            description: { from: 'Old Desc', to: 'New Desc' },
          },
          editedAt: '2024-01-01T12:00:00.000Z',
          editedBy: 'user-123',
        },
        {
          id: 'history-2',
          changes: {
            originalPrice: { from: 400, to: 500 },
          },
          editedAt: '2024-01-02T12:00:00.000Z',
          editedBy: 'user-123',
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            history: mockHistory,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await bookingEditService.getBookingEditHistory('booking-123');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('history-1');
      expect(result[0].editedAt).toBeInstanceOf(Date);
      expect(result[0].changes.title).toEqual({ from: 'Old Title', to: 'New Title' });
      expect(result[1].changes.originalPrice).toEqual({ from: 400, to: 500 });
    });

    it('should handle empty history', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            history: [],
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await bookingEditService.getBookingEditHistory('booking-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('getUserBookings', () => {
    it('should return user bookings with filters', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          title: 'Hotel Booking',
          type: 'hotel',
          dateRange: {
            checkIn: '2024-06-01T00:00:00.000Z',
            checkOut: '2024-06-05T00:00:00.000Z',
          },
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
        {
          id: 'booking-2',
          title: 'Flight Booking',
          type: 'flight',
          dateRange: {
            checkIn: '2024-07-01T00:00:00.000Z',
            checkOut: '2024-07-02T00:00:00.000Z',
          },
          createdAt: '2024-01-03T00:00:00.000Z',
          updatedAt: '2024-01-04T00:00:00.000Z',
        },
      ];

      const mockResponse = {
        data: {
          success: true,
          data: {
            bookings: mockBookings,
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const filters = {
        type: ['hotel', 'flight'],
        status: ['available'],
      };

      const result = await bookingEditService.getUserBookings('user-123', filters);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('booking-1');
      expect(result[0].dateRange.checkIn).toBeInstanceOf(Date);
      expect(result[1].type).toBe('flight');
    });

    it('should handle no bookings found', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            bookings: [],
          },
        },
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.get).mockResolvedValue(mockResponse);

      const result = await bookingEditService.getUserBookings('user-123');

      expect(result).toHaveLength(0);
    });
  });

  describe('validation methods', () => {
    it('should validate booking data without API calls', () => {
      const validBookingData = {
        type: 'hotel' as const,
        title: 'Valid Hotel Booking',
        description: 'A nice hotel stay',
        location: {
          city: 'Paris',
          country: 'France',
          address: '123 Main St',
          coordinates: { lat: 48.8566, lng: 2.3522 },
        },
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05'),
        },
        originalPrice: 500,
        swapValue: 450,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'ABC123',
          bookingReference: 'REF456',
        },
      };

      const errors = bookingEditService.validateBookingData(validBookingData);

      // Should return empty errors object for valid data
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should validate booking update data without API calls', () => {
      const validUpdateData = {
        title: 'Updated Title',
        description: 'Updated description',
        originalPrice: 600,
      };

      const errors = bookingEditService.validateBookingUpdateData(validUpdateData);

      // Should return empty errors object for valid data
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});