import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingValidationService, BookingValidationRequest } from '../BookingValidationService';
import axios from 'axios';
import { logger } from '../../../utils/logger';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

// Mock logger
vi.mock('../../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('BookingValidationService', () => {
  let validationService: BookingValidationService;
  let mockRequest: BookingValidationRequest;

  beforeEach(() => {
    validationService = new BookingValidationService();
    
    mockRequest = {
      type: 'hotel',
      providerDetails: {
        provider: 'booking.com',
        confirmationNumber: 'BK123456789',
        bookingReference: 'REF123456',
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      location: {
        city: 'New York',
        country: 'USA',
      },
      originalPrice: 500,
      title: 'Luxury Hotel Stay',
    };

    vi.clearAllMocks();
  });

  describe('validateBooking', () => {
    it('should validate a valid booking successfully', async () => {
      // Set up environment to have API key
      process.env.BOOKING_COM_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      // Mock successful API response
      mockedAxios.mockResolvedValueOnce({
        data: {
          status: 'confirmed',
          is_valid: true,
        },
      });

      const result = await serviceWithApiKey.validateBooking(mockRequest);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(logger.info).toHaveBeenCalledWith('Booking validation completed', expect.any(Object));
    });

    it('should fail validation for missing required fields', async () => {
      const invalidRequest = {
        ...mockRequest,
        providerDetails: {
          ...mockRequest.providerDetails,
          confirmationNumber: '',
        },
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Confirmation number is required');
    });

    it('should fail validation for past check-in date', async () => {
      const invalidRequest = {
        ...mockRequest,
        dateRange: {
          checkIn: new Date('2020-01-01'),
          checkOut: new Date('2020-01-05'),
        },
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Check-in date must be in the future');
    });

    it('should fail validation for invalid date range', async () => {
      const invalidRequest = {
        ...mockRequest,
        dateRange: {
          checkIn: new Date('2024-12-05'),
          checkOut: new Date('2024-12-01'),
        },
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Check-out date must be after check-in date');
    });

    it('should fail validation for negative price', async () => {
      const invalidRequest = {
        ...mockRequest,
        originalPrice: -100,
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Original price must be positive');
    });

    it('should add warning for booking too far in future', async () => {
      const futureRequest = {
        ...mockRequest,
        dateRange: {
          checkIn: new Date('2027-01-01'),
          checkOut: new Date('2027-01-05'),
        },
      };

      const result = await validationService.validateBooking(futureRequest);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Booking is more than 2 years in the future');
    });

    it('should fail validation for unsupported provider', async () => {
      const invalidRequest = {
        ...mockRequest,
        providerDetails: {
          ...mockRequest.providerDetails,
          provider: 'unsupported-provider',
        },
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Unsupported provider: unsupported-provider');
    });

    it('should fail validation for unsupported booking type for provider', async () => {
      const invalidRequest = {
        ...mockRequest,
        type: 'event' as const,
        providerDetails: {
          ...mockRequest.providerDetails,
          provider: 'booking.com', // booking.com only supports hotel
        },
      };

      const result = await validationService.validateBooking(invalidRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Provider booking.com does not support booking type: event');
    });

    it('should handle API timeout gracefully', async () => {
      // Set up environment to have API key
      process.env.BOOKING_COM_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      mockedAxios.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      });

      const result = await serviceWithApiKey.validateBooking(mockRequest);

      expect(result.isValid).toBe(true); // Should not fail validation due to API errors
      expect(result.warnings).toContain('External validation failed for booking.com: Provider API timeout');
    });

    it('should handle API 404 error', async () => {
      // Set up environment to have API key
      process.env.BOOKING_COM_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      mockedAxios.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { message: 'Booking not found' },
        },
      });

      const result = await serviceWithApiKey.validateBooking(mockRequest);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Booking not found with the provider');
    });

    it('should handle API 401 error', async () => {
      // Set up environment to have API key
      process.env.BOOKING_COM_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      mockedAxios.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      });

      const result = await serviceWithApiKey.validateBooking(mockRequest);

      expect(result.isValid).toBe(true); // Should not fail validation due to API errors
      expect(result.warnings).toContain('External validation failed for booking.com: Invalid API credentials');
    });

    it('should skip external validation when no API key is configured', async () => {
      // Create a new service instance to test without API keys
      delete process.env.BOOKING_COM_API_KEY;
      const serviceWithoutApiKey = new BookingValidationService();

      const result = await serviceWithoutApiKey.validateBooking(mockRequest);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('External validation skipped for booking.com - no API key configured');
      expect(logger.warn).toHaveBeenCalledWith(
        'No API key configured for provider, skipping external validation',
        { provider: 'booking.com' }
      );
    });
  });

  describe('Provider-specific request building', () => {
    it('should build correct request for booking.com', async () => {
      // Set up environment to have API key
      process.env.BOOKING_COM_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      mockedAxios.mockResolvedValueOnce({
        data: {
          status: 'confirmed',
          is_valid: true,
        },
      });

      await serviceWithApiKey.validateBooking(mockRequest);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservation_id: 'BK123456789',
            property_location: 'New York, USA',
          }),
        })
      );
    });

    it('should build correct request for expedia', async () => {
      // Set up environment to have API key
      process.env.EXPEDIA_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      const expediaRequest = {
        ...mockRequest,
        type: 'flight' as const,
        providerDetails: {
          ...mockRequest.providerDetails,
          provider: 'expedia',
        },
      };

      mockedAxios.mockResolvedValueOnce({
        data: {
          reservation_status: 'active',
        },
      });

      await serviceWithApiKey.validateBooking(expediaRequest);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            itinerary_id: 'BK123456789',
            trip_id: 'REF123456',
          }),
        })
      );
    });

    it('should build correct request for airbnb', async () => {
      // Set up environment to have API key
      process.env.AIRBNB_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      const airbnbRequest = {
        ...mockRequest,
        type: 'rental' as const,
        providerDetails: {
          ...mockRequest.providerDetails,
          provider: 'airbnb',
        },
      };

      mockedAxios.mockResolvedValueOnce({
        data: {
          reservation_status: 'accepted',
        },
      });

      await serviceWithApiKey.validateBooking(airbnbRequest);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservation_code: 'BK123456789',
            listing_location: mockRequest.location,
          }),
        })
      );
    });

    it('should build correct request for eventbrite', async () => {
      // Set up environment to have API key
      process.env.EVENTBRITE_API_KEY = 'test-api-key';
      const serviceWithApiKey = new BookingValidationService();
      
      const eventbriteRequest = {
        ...mockRequest,
        type: 'event' as const,
        providerDetails: {
          ...mockRequest.providerDetails,
          provider: 'eventbrite',
        },
      };

      mockedAxios.mockResolvedValueOnce({
        data: {
          order_status: 'placed',
          event_status: 'live',
        },
      });

      await serviceWithApiKey.validateBooking(eventbriteRequest);

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order_id: 'BK123456789',
            event_id: 'REF123456',
            event_date: mockRequest.dateRange.checkIn.toISOString(),
          }),
        })
      );
    });
  });

  describe('getSupportedProviders', () => {
    it('should return correct providers for hotel bookings', () => {
      const providers = validationService.getSupportedProviders('hotel');
      expect(providers).toContain('booking.com');
      expect(providers).toContain('expedia');
      expect(providers).not.toContain('eventbrite');
    });

    it('should return correct providers for event bookings', () => {
      const providers = validationService.getSupportedProviders('event');
      expect(providers).toContain('eventbrite');
      expect(providers).not.toContain('booking.com');
    });

    it('should return correct providers for rental bookings', () => {
      const providers = validationService.getSupportedProviders('rental');
      expect(providers).toContain('airbnb');
      expect(providers).not.toContain('eventbrite');
    });

    it('should return correct providers for flight bookings', () => {
      const providers = validationService.getSupportedProviders('flight');
      expect(providers).toContain('expedia');
      expect(providers).not.toContain('booking.com');
    });
  });

  describe('isProviderSupported', () => {
    it('should return true for supported provider', () => {
      expect(validationService.isProviderSupported('booking.com')).toBe(true);
    });

    it('should return false for unsupported provider', () => {
      expect(validationService.isProviderSupported('unknown-provider')).toBe(false);
    });

    it('should return true for supported provider and booking type', () => {
      expect(validationService.isProviderSupported('booking.com', 'hotel')).toBe(true);
    });

    it('should return false for supported provider but unsupported booking type', () => {
      expect(validationService.isProviderSupported('booking.com', 'event')).toBe(false);
    });
  });
});