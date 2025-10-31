import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingSearchService, SearchFilters } from '../BookingSearchService';

// Mock the dependencies
const mockBookingRepository = {
  searchBookings: vi.fn(),
};

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('BookingSearchService - Integration Tests', () => {
  let bookingSearchService: BookingSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    bookingSearchService = new BookingSearchService(
      mockBookingRepository as any,
      mockCacheService as any
    );
  });

  describe('searchBookings', () => {
    it('should perform search with full-text query', async () => {
      const filters: SearchFilters = {
        query: 'luxury hotel paris',
        location: { city: 'Paris', country: 'France' },
        priceRange: { min: 200, max: 800 },
        types: ['hotel'],
        sortBy: 'relevance',
        sortOrder: 'desc',
      };

      const mockBookings = [
        {
          id: '1',
          userId: 'user1',
          type: 'hotel',
          title: 'Luxury Hotel in Paris',
          description: 'Beautiful luxury hotel in the heart of Paris',
          location: { city: 'Paris', country: 'France' },
          dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
          originalPrice: 600,
          swapValue: 550,
          status: 'available',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

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
          query: 'luxury hotel paris',
          location: { city: 'Paris', country: 'France' },
          priceRange: { min: 200, max: 800 },
          types: ['hotel'],
        }),
        11, // limit + 1 to check for more results
        0
      );
    });

    it('should handle location-based search with coordinates', async () => {
      const filters: SearchFilters = {
        location: {
          coordinates: [2.3522, 48.8566], // Paris coordinates
          radius: 10, // 10km radius
        },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue([]);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          location: {
            coordinates: [2.3522, 48.8566],
            radius: 10,
          },
        }),
        11,
        0
      );
    });

    it('should handle date range filtering with flexible dates', async () => {
      const filters: SearchFilters = {
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-10'),
          flexible: true,
        },
      };

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue([]);

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

    it('should handle multiple booking types filter', async () => {
      const filters: SearchFilters = {
        types: ['hotel', 'event', 'rental'],
      };

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue([]);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockBookingRepository.searchBookings).toHaveBeenCalledWith(
        expect.objectContaining({
          types: ['hotel', 'event', 'rental'],
        }),
        11,
        0
      );
    });

    it('should apply price-based sorting', async () => {
      const filters: SearchFilters = {
        sortBy: 'price',
        sortOrder: 'asc',
      };

      const mockBookings = [
        { id: '1', swapValue: 500, createdAt: new Date('2024-01-01') },
        { id: '2', swapValue: 300, createdAt: new Date('2024-01-02') },
        { id: '3', swapValue: 700, createdAt: new Date('2024-01-03') },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      // Should be sorted by price ascending
      expect(result.bookings[0].swapValue).toBe(300);
      expect(result.bookings[1].swapValue).toBe(500);
      expect(result.bookings[2].swapValue).toBe(700);
    });

    it('should apply date-based sorting', async () => {
      const filters: SearchFilters = {
        sortBy: 'date',
        sortOrder: 'desc',
      };

      const mockBookings = [
        { id: '1', dateRange: { checkIn: new Date('2024-06-01') }, createdAt: new Date('2024-01-01') },
        { id: '2', dateRange: { checkIn: new Date('2024-07-01') }, createdAt: new Date('2024-01-02') },
        { id: '3', dateRange: { checkIn: new Date('2024-05-01') }, createdAt: new Date('2024-01-03') },
      ];

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      const result = await bookingSearchService.searchBookings(filters, 1, 10);

      // Should be sorted by check-in date descending
      expect(result.bookings[0].dateRange.checkIn.getTime()).toBe(new Date('2024-07-01').getTime());
      expect(result.bookings[1].dateRange.checkIn.getTime()).toBe(new Date('2024-06-01').getTime());
      expect(result.bookings[2].dateRange.checkIn.getTime()).toBe(new Date('2024-05-01').getTime());
    });

    it('should handle pagination with hasMore flag', async () => {
      const mockBookings = Array(11).fill({ id: '1', createdAt: new Date() });

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      const result = await bookingSearchService.searchBookings({}, 1, 10);

      expect(result.hasMore).toBe(true);
      expect(result.bookings).toHaveLength(10);
    });

    it('should cache search results', async () => {
      const filters: SearchFilters = { query: 'test' };
      const mockBookings = [{ id: '1', createdAt: new Date() }];

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      await bookingSearchService.searchBookings(filters, 1, 10);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        300 // TTL
      );
    });
  });

  describe('getRecommendations', () => {
    it('should generate personalized recommendations', async () => {
      const criteria = {
        userId: 'user1',
        userLocation: { city: 'Paris', country: 'France' },
        preferredTypes: ['hotel'],
        priceRange: { min: 100, max: 500 },
      };

      const mockBookings = [
        { 
          id: '1', 
          userId: 'user2', 
          type: 'hotel', 
          location: { city: 'Paris', country: 'France' },
          createdAt: new Date('2024-01-01'),
          verification: { status: 'verified' }
        },
        { 
          id: '2', 
          userId: 'user3', 
          type: 'event', 
          location: { city: 'London', country: 'UK' },
          createdAt: new Date('2024-01-02'),
          verification: { status: 'pending' }
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      
      // Mock the internal searchBookings call
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
        10
      );
    });

    it('should exclude specified booking IDs', async () => {
      const criteria = {
        userId: 'user1',
        excludeBookingIds: ['booking2'],
      };

      const mockBookings = [
        { 
          id: 'booking1', 
          userId: 'user2',
          createdAt: new Date('2024-01-01'),
          verification: { status: 'verified' }
        },
        { 
          id: 'booking2', 
          userId: 'user3',
          createdAt: new Date('2024-01-02'),
          verification: { status: 'pending' }
        },
        { 
          id: 'booking3', 
          userId: 'user4',
          createdAt: new Date('2024-01-03'),
          verification: { status: 'verified' }
        },
      ];

      mockCacheService.get.mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 3,
        page: 1,
        limit: 20,
        hasMore: false,
      });

      const result = await bookingSearchService.getRecommendations(criteria, 5);

      expect(result).toHaveLength(2);
      expect(result.find(b => b.id === 'booking2')).toBeUndefined();
    });
  });

  describe('getPopularBookings', () => {
    it('should return popular bookings sorted by creation date', async () => {
      const mockBookings = [
        { id: '1', status: 'available', createdAt: new Date('2024-01-03') },
        { id: '2', status: 'available', createdAt: new Date('2024-01-02') },
        { id: '3', status: 'locked', createdAt: new Date('2024-01-01') },
      ];

      mockCacheService.get.mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings: mockBookings,
        total: 3,
        page: 1,
        limit: 10,
        hasMore: false,
      });

      const result = await bookingSearchService.getPopularBookings(5);

      expect(result).toHaveLength(2); // Only available bookings
      expect(result.every(booking => booking.status === 'available')).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      const filters: SearchFilters = { query: 'test' };
      const error = new Error('Database connection failed');

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockRejectedValue(error);

      await expect(bookingSearchService.searchBookings(filters)).rejects.toThrow('Database connection failed');
    });

    it('should handle cache errors gracefully and fallback to database', async () => {
      const filters: SearchFilters = { query: 'test' };
      const mockBookings = [{ id: '1', createdAt: new Date() }];

      mockCacheService.get.mockRejectedValue(new Error('Cache unavailable'));
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      const result = await bookingSearchService.searchBookings(filters);

      expect(result.bookings).toEqual(mockBookings);
      expect(mockBookingRepository.searchBookings).toHaveBeenCalled();
    });
  });
});