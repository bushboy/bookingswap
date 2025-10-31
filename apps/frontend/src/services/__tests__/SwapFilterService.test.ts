import { SwapFilterService } from '../SwapFilterService';
import { Booking } from '../bookingService';

describe('SwapFilterService', () => {
  let filterService: SwapFilterService;
  let mockBookings: Booking[];

  beforeEach(() => {
    filterService = new SwapFilterService();

    // Create mock bookings for testing
    mockBookings = [
      {
        id: '1',
        userId: 'user1',
        title: 'Hotel in Paris',
        description: 'Nice hotel',
        status: 'available',
        type: 'hotel',
        location: { city: 'Paris', country: 'France' },
        dateRange: { checkIn: '2024-06-01', checkOut: '2024-06-05' },
        originalPrice: 500,
        swapValue: 450,
        createdAt: '2024-01-01',
      } as Booking,
      {
        id: '2',
        userId: 'user2',
        title: 'Concert Tickets',
        description: 'Great seats',
        status: 'available',
        type: 'event',
        location: { city: 'London', country: 'UK' },
        dateRange: { checkIn: '2024-07-15', checkOut: '2024-07-15' },
        originalPrice: 200,
        swapValue: 180,
        createdAt: '2024-01-02',
      } as Booking,
      {
        id: '3',
        userId: 'user1',
        title: 'Cancelled Booking',
        description: 'This was cancelled',
        status: 'cancelled',
        type: 'hotel',
        location: { city: 'Rome', country: 'Italy' },
        dateRange: { checkIn: '2024-08-01', checkOut: '2024-08-05' },
        originalPrice: 300,
        swapValue: 280,
        createdAt: '2024-01-03',
      } as Booking,
      {
        id: '4',
        userId: 'user3',
        title: 'Flight to Tokyo',
        description: 'Business class',
        status: 'available',
        type: 'flight',
        location: { city: 'Tokyo', country: 'Japan' },
        dateRange: { checkIn: '2024-09-01', checkOut: '2024-09-01' },
        originalPrice: 1000,
        swapValue: 900,
        createdAt: '2024-01-04',
      } as Booking,
    ];
  });

  describe('applyCoreBrowsingFiltersToBookings', () => {
    it("should exclude user's own bookings", () => {
      const filtered = filterService.applyCoreBrowsingFiltersToBookings(
        mockBookings,
        'user1'
      );

      // Should exclude bookings with userId 'user1' (ids 1 and 3)
      expect(filtered).toHaveLength(2);
      expect(filtered.map(b => b.id)).toEqual(['2', '4']);
    });

    it('should exclude cancelled bookings', () => {
      const filtered = filterService.applyCoreBrowsingFiltersToBookings(
        mockBookings,
        'user2'
      );

      // Should exclude cancelled booking (id 3) and user2's own booking (id 2)
      expect(filtered).toHaveLength(2);
      expect(filtered.map(b => b.id)).toEqual(['1', '4']);
      expect(filtered.every(b => b.status !== 'cancelled')).toBe(true);
    });

    it('should exclude both own bookings and cancelled bookings', () => {
      const filtered = filterService.applyCoreBrowsingFiltersToBookings(
        mockBookings,
        'user1'
      );

      // Should exclude user1's bookings (ids 1, 3) and cancelled bookings (id 3)
      expect(filtered).toHaveLength(2);
      expect(filtered.map(b => b.id)).toEqual(['2', '4']);
      expect(filtered.every(b => b.userId !== 'user1')).toBe(true);
      expect(filtered.every(b => b.status !== 'cancelled')).toBe(true);
    });

    it('should return all available bookings when no user ID provided', () => {
      const filtered = filterService.applyCoreBrowsingFiltersToBookings(
        mockBookings,
        ''
      );

      // Should only exclude cancelled bookings
      expect(filtered).toHaveLength(3);
      expect(filtered.map(b => b.id)).toEqual(['1', '2', '4']);
      expect(filtered.every(b => b.status !== 'cancelled')).toBe(true);
    });
  });

  describe('applyUserFiltersToBookings', () => {
    it('should filter by location city', () => {
      const filters = {
        location: { city: 'Paris' },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const filtered = filterService.applyUserFiltersToBookings(
        mockBookings,
        filters
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
      expect(filtered[0].location.city).toBe('Paris');
    });

    it('should filter by price range', () => {
      const filters = {
        priceRange: { min: 400, max: 600 },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const filtered = filterService.applyUserFiltersToBookings(
        mockBookings,
        filters
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
      expect(filtered[0].swapValue).toBe(450);
    });

    it('should filter by date range', () => {
      const filters = {
        dateRange: {
          start: new Date('2024-07-01'),
          end: new Date('2024-07-31'),
          flexible: false,
        },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const filtered = filterService.applyUserFiltersToBookings(
        mockBookings,
        filters
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('applyAllFiltersToBookings', () => {
    it('should apply both core and user filters', () => {
      const filters = {
        location: { city: 'Paris' },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      // user1 owns the Paris booking, so it should be excluded
      const filtered = filterService.applyAllFiltersToBookings(
        mockBookings,
        'user1',
        filters
      );

      expect(filtered).toHaveLength(0);
    });

    it("should return filtered results when user doesn't own the matching booking", () => {
      const filters = {
        location: { city: 'Paris' },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      // user2 doesn't own the Paris booking, so it should be included
      const filtered = filterService.applyAllFiltersToBookings(
        mockBookings,
        'user2',
        filters
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
      expect(filtered[0].location.city).toBe('Paris');
    });
  });

  describe('validateFilters', () => {
    it('should validate correct filters', () => {
      const filters = {
        location: { city: 'Paris' },
        priceRange: { min: 100, max: 500 },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-06-30'),
        },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const result = filterService.validateFilters(filters);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid date range', () => {
      const filters = {
        dateRange: {
          start: new Date('2024-06-30'),
          end: new Date('2024-06-01'), // End before start
        },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const result = filterService.validateFilters(filters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it('should detect invalid price range', () => {
      const filters = {
        priceRange: { min: 500, max: 100 }, // Min greater than max
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const result = filterService.validateFilters(filters);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Minimum price cannot be greater than maximum price'
      );
    });
  });

  describe('getFilterSummary', () => {
    it('should generate a readable filter summary', () => {
      const filters = {
        location: { city: 'Paris', country: 'France' },
        priceRange: { min: 100, max: 500 },
        swapType: 'booking' as const,
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const,
      };

      const summary = filterService.getFilterSummary(filters, 'user1');

      expect(summary).toContain('excluding your own bookings');
      expect(summary).toContain('excluding cancelled bookings');
      expect(summary).toContain(
        'only showing bookings with active swap proposals'
      );
      expect(summary).toContain('in Paris');
      expect(summary).toContain('in France');
      expect(summary).toContain('priced between $100 - $500');
      expect(summary).toContain('booking swaps only');
    });
  });
});
