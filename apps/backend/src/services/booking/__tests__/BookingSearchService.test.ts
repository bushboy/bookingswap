import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { BookingSearchService, SearchFilters, RecommendationCriteria } from '../BookingSearchService';
import { BookingRepository, BookingSearchCriteria } from '../../../database/repositories/BookingRepository';
import { RedisService } from '../../../database/cache/RedisService';
import { Booking, BookingType } from '@booking-swap/shared';

// Mock dependencies
vi.mock('../../../database/repositories/BookingRepository');
vi.mock('../../../database/cache/RedisService');
vi.mock('../../../utils/logger');

describe('BookingSearchService', () => {
  let bookingSearchService: BookingSearchService;
  let mockBookingRepository: BookingRepository;
  let mockCacheService: RedisService;

  const mockBooking: Booking = {
    id: '1',
    userId: 'user1',
    type: 'hotel' as BookingType,
    title: 'Luxury Hotel in Paris',
    description: 'Beautiful hotel in the heart of Paris',
    location: {
      city: 'Paris',
      country: 'France',
      coordinates: [2.3522, 48.8566],
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
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-01-01'),
      documents: ['doc1.pdf'],
    },
    blockchain: {
      transactionId: 'tx123',
      consensusTimestamp: '1234567890',
      topicId: 'topic1',
    },
    status: 'available',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockBookingRepository = {
      searchBookings: vi.fn(),
    } as any;
    
    mockCacheService = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    bookingSearchService = new BookingSearchService(
      mockBookingRepository,
      mockCacheService
    );
  });

  describe('searchBookings', () => {
    it('should return search results with basic filters', async () => {
      const filters: SearchFilters = {
        query: 'Paris hotel',
        location: { city: 'Paris', country: 'France' },
        priceRange: { min: 100, max: 600 },
      };

      const mockBookings = [mockBooking];
      (mockBookingRepository.searchBookings as Mock).mockResolvedValue(mockBookings);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      expect(result).toEqual({
        bookings: mockBookings,
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      });

      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Paris hotel',
          location: { city: 'Paris', country: 'France' },
          priceRange: { min: 100, max: 600 },
        }),
        11, // limit + 1 to check for more results
        0
      );
    });

    it('should return cached results when available', async () => {
      const filters: SearchFilters = { query: 'test' };
      const cachedResult = {
        bookings: [mockBooking],
        total: 1,
        page: 1,
        limit: 10,
        hasMore: false,
      };

      (mockCacheService.get as Mock).mockResolvedValue(cachedResult);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      expect(result).toEqual(cachedResult);
      expect(mockBookingRepository.searchBookings).not.toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const filters: SearchFilters = { query: 'test' };
      const mockBookings = Array(11).fill(mockBooking); // 11 items to test hasMore

      (mockBookingRepository.searchBookings as Mock).mockResolvedValue(mockBookings);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      expect(result.hasMore).toBe(true);
      expect(result.bookings).toHaveLength(10);
    });

    it('should apply sorting correctly', async () => {
      const filters: SearchFilters = {
        query: 'test',
        sortBy: 'price',
        sortOrder: 'asc',
      };

      const booking1 = { ...mockBooking, swapValue: 300 };
      const booking2 = { ...mockBooking, swapValue: 500 };
      const mockBookings = [booking2, booking1]; // Unsorted

      (mockBookingRepository.searchBookings as Mock).mockResolvedValue(mockBookings);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      expect(result.bookings[0].swapValue).toBe(300);
      expect(result.bookings[1].swapValue).toBe(500);
    });

    it('should handle date range filters', async () => {
      const filters: SearchFilters = {
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-10'),
          flexible: true,
        },
      };

      (mockBookingRepository.searchBookings as Mock).mockResolvedValue([mockBooking]);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateRange: {
            checkIn: new Date('2024-06-01'),
            checkOut: new Date('2024-06-10'),
            flexible: true,
          },
        }),
        11,
        0
      );
    });

    it('should handle booking type filters', async () => {
      const filters: SearchFilters = {
        types: ['hotel', 'event'],
      };

      (mockBookingRepository.searchBookings as Mock).mockResolvedValue([mockBooking]);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          types: ['hotel', 'event'],
        }),
        11,
        0
      );
    });

    it('should cache search results', async () => {
      const filters: SearchFilters = { query: 'test' };
      const mockBookings = [mockBooking];

      (mockBookingRepository.searchBookings as Mock).mockResolvedValue(mockBookings);
      (mockCacheService.get as Mock).mockResolvedValue(null);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        300 // TTL
      );
    });
  });

  describe('getRecommendations', () => {
    it('should return personalized recommendations', async () => {
      const criteria: RecommendationCriteria = {
        userId: 'user1',
        userLocation: { city: 'Paris', country: 'France' },
        preferredTypes: ['hotel'],
        priceRange: { min: 100, max: 500 },
      };

      const mockBookings = [
        { ...mockBooking, userId: 'user2' }, // Different user
        { ...mockBooking, userId: 'user3', location: { city: 'Paris', country: 'France' } },
      ];

      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      // Mock the searchBookings call within getRecommendations
      const searchSpy = vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const result = await bookingSearchService.getRecommendations(criteria, 5);

      expect(result).toHaveLength(2);
      expect(result.every(booking => booking.userId !== criteria.userId)).toBe(true);
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          types: ['hotel'],
          priceRange: { min: 100, max: 500 },
          location: { city: 'Paris', country: 'France' },
          sortBy: 'relevance',
        }),
        1,
        10 // limit * 2
      );
    });

    it('should exclude user own bookings and specified booking IDs', async () => {
      const criteria: RecommendationCriteria = {
        userId: 'user1',
        excludeBookingIds: ['booking2'],
      };

      const mockBookings = [
        { ...mockBooking, id: 'booking1', userId: 'user2' },
        { ...mockBooking, id: 'booking2', userId: 'user3' }, // Should be excluded
        { ...mockBooking, id: 'booking3', userId: 'user1' }, // Should be excluded (own booking)
      ];

      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      const searchSpy = vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 3,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const result = await bookingSearchService.getRecommendations(criteria, 5);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('booking1');
    });

    it('should cache recommendations', async () => {
      const criteria: RecommendationCriteria = {
        userId: 'user1',
      };

      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: [{ ...mockBooking, userId: 'user2' }],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      await bookingSearchService.getRecommendations(criteria, 5);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('recommendations:user1'),
        expect.any(String),
        300
      );
    });

    it('should return cached recommendations when available', async () => {
      const criteria: RecommendationCriteria = {
        userId: 'user1',
      };

      const cachedRecommendations = [{ ...mockBooking, userId: 'user2' }];
      (mockCacheService.get as Mock).mockResolvedValue(cachedRecommendations);

      const result = await bookingSearchService.getRecommendations(criteria, 5);

      expect(result).toEqual(cachedRecommendations);
      expect(bookingSearchService.searchBookings).not.toHaveBeenCalled();
    });
  });

  describe('getPopularBookings', () => {
    it('should return popular bookings', async () => {
      const mockBookings = [
        { ...mockBooking, status: 'available' },
        { ...mockBooking, id: '2', status: 'available' },
      ];

      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      const searchSpy = vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const result = await bookingSearchService.getPopularBookings(5);

      expect(result).toHaveLength(2);
      expect(result.every(booking => booking.status === 'available')).toBe(true);
      expect(searchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'created',
          sortOrder: 'desc',
        }),
        1,
        10 // limit * 2
      );
    });

    it('should cache popular bookings with longer TTL', async () => {
      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: [mockBooking],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      await bookingSearchService.getPopularBookings(5);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'popular:bookings:5',
        expect.any(String),
        900 // 15 minutes
      );
    });

    it('should return cached popular bookings when available', async () => {
      const cachedBookings = [mockBooking];
      (mockCacheService.get as Mock).mockResolvedValue(cachedBookings);

      const result = await bookingSearchService.getPopularBookings(5);

      expect(result).toEqual(cachedBookings);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in search', async () => {
      const filters: SearchFilters = { query: 'test' };
      const error = new Error('Database error');

      (mockCacheService.get as Mock).mockResolvedValue(null);
      (mockBookingRepository.searchBookings as Mock).mockRejectedValue(error);

      await expect(bookingSearchService.searchBookings(filters)).rejects.toThrow('Database error');
    });

    it('should handle cache errors gracefully', async () => {
      const filters: SearchFilters = { query: 'test' };
      
      (mockCacheService.get as Mock).mockRejectedValue(new Error('Cache error'));
      (mockBookingRepository.searchBookings as Mock).mockResolvedValue([mockBooking]);

      // Should not throw, should fallback to database
      const result = await bookingSearchService.searchBookings(filters);
      
      expect(result.bookings).toEqual([mockBooking]);
      expect(mockBookingRepository.searchBookings).toHaveBeenCalled();
    });
  });

  describe('cache key generation', () => {
    it('should generate consistent cache keys for same filters', async () => {
      const filters: SearchFilters = {
        query: 'test',
        location: { city: 'Paris' },
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05'),
        },
      };

      (mockCacheService.get as Mock).mockResolvedValue(null);
      (mockBookingRepository.searchBookings as Mock).mockResolvedValue([mockBooking]);

      await bookingSearchService.searchBookings(filters, 1, 10);
      await bookingSearchService.searchBookings(filters, 1, 10);

      // Should use the same cache key both times
      expect(mockCacheService.get).toHaveBeenCalledTimes(2);
      const firstCall = (mockCacheService.get as Mock).mock.calls[0][0];
      const secondCall = (mockCacheService.get as Mock).mock.calls[1][0];
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('recommendation scoring', () => {
    it('should score bookings based on user preferences', async () => {
      const criteria: RecommendationCriteria = {
        userId: 'user1',
        userLocation: { city: 'Paris', country: 'France' },
        preferredTypes: ['hotel'],
        priceRange: { min: 100, max: 500 },
      };

      const mockBookings = [
        {
          ...mockBooking,
          id: 'booking1',
          userId: 'user2',
          type: 'event' as BookingType, // Not preferred type
          location: { city: 'London', country: 'UK' }, // Different location
          swapValue: 600, // Outside price range
          verification: { status: 'pending', documents: [] },
          createdAt: new Date('2024-01-01'),
        },
        {
          ...mockBooking,
          id: 'booking2',
          userId: 'user3',
          type: 'hotel' as BookingType, // Preferred type
          location: { city: 'Paris', country: 'France' }, // Same location
          swapValue: 400, // Within price range
          verification: { status: 'verified', documents: ['doc1'] },
          createdAt: new Date('2024-01-10'), // More recent
        },
      ];

      (mockCacheService.get as Mock).mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const result = await bookingSearchService.getRecommendations(criteria, 5);

      // booking2 should be ranked higher due to better scoring
      expect(result[0].id).toBe('booking2');
      expect(result[1].id).toBe('booking1');
    });
  });
});