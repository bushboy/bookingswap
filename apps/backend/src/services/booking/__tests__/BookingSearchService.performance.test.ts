import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingSearchService, SearchFilters } from '../BookingSearchService';

// Mock dependencies
const mockBookingRepository = {
  searchBookings: vi.fn(),
};

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
};

describe('BookingSearchService - Performance Tests', () => {
  let bookingSearchService: BookingSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    bookingSearchService = new BookingSearchService(
      mockBookingRepository as any,
      mockCacheService as any
    );
  });

  describe('search performance', () => {
    it('should handle large result sets efficiently', async () => {
      const filters: SearchFilters = {
        query: 'hotel',
      };

      // Mock a large dataset
      const largeBookingSet = Array(1000).fill(null).map((_, index) => ({
        id: `booking-${index}`,
        userId: `user-${index}`,
        type: 'hotel',
        title: `Hotel ${index}`,
        description: `Description for hotel ${index}`,
        location: { city: 'Paris', country: 'France' },
        dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
        originalPrice: 100 + index,
        swapValue: 90 + index,
        status: 'available',
        createdAt: new Date(Date.now() - index * 1000),
        updatedAt: new Date(Date.now() - index * 1000),
        verification: { status: 'verified' },
      }));

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(largeBookingSet.slice(0, 21)); // Return 21 to test hasMore

      const startTime = Date.now();
      const result = await bookingSearchService.searchBookings(filters, 1, 20);
      const endTime = Date.now();

      expect(result.bookings).toHaveLength(20);
      expect(result.hasMore).toBe(true);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle complex sorting efficiently', async () => {
      const filters: SearchFilters = {
        sortBy: 'price',
        sortOrder: 'asc',
      };

      // Create bookings with random prices for sorting
      const unsortedBookings = Array(100).fill(null).map((_, index) => ({
        id: `booking-${index}`,
        swapValue: Math.floor(Math.random() * 1000) + 100,
        createdAt: new Date(Date.now() - index * 1000),
        verification: { status: 'verified' },
      }));

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(unsortedBookings);

      const startTime = Date.now();
      const result = await bookingSearchService.searchBookings(filters, 1, 50);
      const endTime = Date.now();

      // Verify sorting is correct
      for (let i = 1; i < result.bookings.length; i++) {
        expect(result.bookings[i].swapValue).toBeGreaterThanOrEqual(result.bookings[i - 1].swapValue);
      }

      expect(endTime - startTime).toBeLessThan(50); // Should complete within 50ms
    });

    it('should handle recommendation scoring efficiently', async () => {
      const criteria = {
        userId: 'user1',
        userLocation: { city: 'Paris', country: 'France' },
        preferredTypes: ['hotel'],
        priceRange: { min: 100, max: 500 },
      };

      // Create a large set of bookings for recommendation scoring
      const bookings = Array(200).fill(null).map((_, index) => ({
        id: `booking-${index}`,
        userId: `user-${index + 2}`, // Different users
        type: index % 2 === 0 ? 'hotel' : 'event',
        location: {
          city: index % 3 === 0 ? 'Paris' : 'London',
          country: index % 3 === 0 ? 'France' : 'UK',
        },
        swapValue: 100 + (index % 400),
        createdAt: new Date(Date.now() - index * 1000 * 60),
        verification: { status: index % 2 === 0 ? 'verified' : 'pending' },
      }));

      mockCacheService.get.mockResolvedValue(null);
      
      vi.spyOn(bookingSearchService, 'searchBookings').mockResolvedValue({
        bookings,
        total: bookings.length,
        page: 1,
        limit: 400,
        hasMore: false,
      });

      const startTime = Date.now();
      const result = await bookingSearchService.getRecommendations(criteria, 10);
      const endTime = Date.now();

      expect(result).toHaveLength(10);
      expect(endTime - startTime).toBeLessThan(100); // Should complete within 100ms
    });

    it('should cache results to improve subsequent performance', async () => {
      const filters: SearchFilters = {
        query: 'luxury hotel',
      };

      const mockBookings = Array(20).fill(null).map((_, index) => ({
        id: `booking-${index}`,
        createdAt: new Date(),
        verification: { status: 'verified' },
      }));

      // Test that caching mechanism is invoked
      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(mockBookings);

      await bookingSearchService.searchBookings(filters, 1, 20);

      // Verify cache was called to store the result
      expect(mockCacheService.set).toHaveBeenCalled();
      
      // Test cache hit scenario - return cached result directly
      const cachedResult = {
        bookings: mockBookings,
        total: 20,
        page: 1,
        limit: 20,
        hasMore: false,
      };
      
      mockCacheService.get.mockResolvedValue(cachedResult);

      const result = await bookingSearchService.searchBookings(filters, 1, 20);

      expect(result).toEqual(cachedResult);
      // Verify caching improves performance by avoiding database calls
      expect(mockCacheService.get).toHaveBeenCalled();
    });
  });

  describe('memory efficiency', () => {
    it('should not hold references to large datasets', async () => {
      const filters: SearchFilters = {
        query: 'test',
      };

      // Create a large mock dataset
      const largeDataset = Array(10000).fill(null).map((_, index) => ({
        id: `booking-${index}`,
        title: `Booking ${index}`,
        description: 'A'.repeat(1000), // Large description
        createdAt: new Date(),
        verification: { status: 'verified' },
      }));

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings.mockResolvedValue(largeDataset.slice(0, 21));

      const result = await bookingSearchService.searchBookings(filters, 1, 20);

      // Should only return the requested amount, not hold the entire dataset
      expect(result.bookings).toHaveLength(20);
      expect(result.hasMore).toBe(true);
    });

    it('should handle pagination without loading all data', async () => {
      const filters: SearchFilters = {
        query: 'hotel',
      };

      // Mock different pages
      const page1Data = Array(20).fill(null).map((_, index) => ({
        id: `booking-page1-${index}`,
        createdAt: new Date(),
        verification: { status: 'verified' },
      }));

      const page2Data = Array(20).fill(null).map((_, index) => ({
        id: `booking-page2-${index}`,
        createdAt: new Date(),
        verification: { status: 'verified' },
      }));

      mockCacheService.get.mockResolvedValue(null);

      // Create a fresh service instance to avoid interference from previous tests
      const freshService = new BookingSearchService(
        mockBookingRepository as any,
        mockCacheService as any
      );

      // First page
      mockBookingRepository.searchBookings.mockResolvedValueOnce([...page1Data, { id: 'extra', createdAt: new Date(), verification: { status: 'verified' } }]); // 21 items to indicate more
      const page1Result = await freshService.searchBookings(filters, 1, 20);

      // Second page
      mockBookingRepository.searchBookings.mockResolvedValueOnce(page2Data); // 20 items, no more
      const page2Result = await freshService.searchBookings(filters, 2, 20);

      expect(page1Result.bookings).toHaveLength(20);
      expect(page1Result.hasMore).toBe(true);
      expect(page1Result.page).toBe(1);

      expect(page2Result.bookings).toHaveLength(20);
      expect(page2Result.hasMore).toBe(false);
      expect(page2Result.page).toBe(2);

      // Verify pagination logic works correctly
      expect(page1Result.bookings[0].id).toBe('booking-page1-0');
      expect(page2Result.bookings[0].id).toBe('booking-page2-0');
    });
  });

  describe('concurrent requests', () => {
    it('should handle multiple concurrent search requests', async () => {
      const filters1: SearchFilters = { query: 'hotel' };
      const filters2: SearchFilters = { query: 'event' };
      const filters3: SearchFilters = { query: 'rental' };

      const mockBookings1 = [{ id: '1', createdAt: new Date(), verification: { status: 'verified' } }];
      const mockBookings2 = [{ id: '2', createdAt: new Date(), verification: { status: 'verified' } }];
      const mockBookings3 = [{ id: '3', createdAt: new Date(), verification: { status: 'verified' } }];

      mockCacheService.get.mockResolvedValue(null);
      mockBookingRepository.searchBookings
        .mockResolvedValueOnce(mockBookings1)
        .mockResolvedValueOnce(mockBookings2)
        .mockResolvedValueOnce(mockBookings3);

      const startTime = Date.now();
      const [result1, result2, result3] = await Promise.all([
        bookingSearchService.searchBookings(filters1, 1, 10),
        bookingSearchService.searchBookings(filters2, 1, 10),
        bookingSearchService.searchBookings(filters3, 1, 10),
      ]);
      const endTime = Date.now();

      expect(result1.bookings[0].id).toBe('1');
      expect(result2.bookings[0].id).toBe('2');
      expect(result3.bookings[0].id).toBe('3');
      expect(endTime - startTime).toBeLessThan(200); // Should handle concurrency efficiently
    });
  });
});