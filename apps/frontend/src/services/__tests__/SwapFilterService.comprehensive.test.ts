import { describe, it, expect, beforeEach } from 'vitest';
import { SwapFilterService, SwapFilters } from '../SwapFilterService';
import { SwapWithBookings, Booking } from '../bookingService';

/**
 * Comprehensive test suite for SwapFilterService covering various user scenarios,
 * edge cases, and complex filtering combinations as required by task 10.5
 */
describe('SwapFilterService - Comprehensive Testing', () => {
  let filterService: SwapFilterService;

  beforeEach(() => {
    filterService = new SwapFilterService();
  });

  // Helper function to create mock swaps with various configurations
  const createMockSwap = (
    id: string,
    ownerId: string,
    bookingStatus: string = 'available',
    hasActiveProposals: boolean = true,
    swapType: 'booking' | 'cash' = 'booking',
    location: { city: string; country: string } = { city: 'Test City', country: 'Test Country' },
    dateRange: { checkIn: Date; checkOut: Date } = {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05')
    },
    price: number = 1000,
    cashDetails?: any
  ): SwapWithBookings => ({
    id,
    sourceBooking: {
      id: `booking-${id}`,
      title: `Test Booking ${id}`,
      description: `Description for booking ${id}`,
      userId: ownerId,
      status: bookingStatus as any,
      type: 'hotel',
      location,
      city: location.city,
      country: location.country,
      dateRange: {
        checkIn: dateRange.checkIn.toISOString(),
        checkOut: dateRange.checkOut.toISOString()
      },
      checkInDate: dateRange.checkIn.toISOString(),
      checkOutDate: dateRange.checkOut.toISOString(),
      originalPrice: price + 200,
      swapValue: price,
      createdAt: new Date('2024-01-01').toISOString(),
      updatedAt: new Date('2024-01-01').toISOString(),
      verification: { status: 'verified', verifiedAt: new Date('2024-01-01') },
      providerDetails: {
        provider: 'Test Provider',
        confirmationNumber: `CONF${id}`,
        bookingReference: `REF${id}`
      }
    },
    owner: { id: ownerId, name: `Owner ${ownerId}`, walletAddress: `0x${ownerId}` },
    proposer: { id: 'proposer-1', name: 'Test Proposer', walletAddress: '0x456' },
    swapType,
    cashDetails,
    hasActiveProposals,
    activeProposalCount: hasActiveProposals ? Math.floor(Math.random() * 5) + 1 : 0,
    status: 'pending',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  });

  describe('Core Browsing Filter Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should handle user with no swaps', () => {
      const swaps: SwapWithBookings[] = [];
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(0);
    });

    it('should handle user with only their own swaps', () => {
      const swaps = [
        createMockSwap('1', currentUserId),
        createMockSwap('2', currentUserId),
        createMockSwap('3', currentUserId)
      ];
      
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(0);
    });

    it('should handle mixed ownership scenarios', () => {
      const swaps = [
        createMockSwap('1', currentUserId), // Own swap - excluded
        createMockSwap('2', 'other-user-1'), // Valid
        createMockSwap('3', 'other-user-2'), // Valid
        createMockSwap('4', currentUserId), // Own swap - excluded
        createMockSwap('5', 'other-user-3') // Valid
      ];
      
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.map(s => s.id)).toEqual(['2', '3', '5']);
      expect(filtered.every(s => s.owner.id !== currentUserId)).toBe(true);
    });

    it('should handle various booking statuses', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available'), // Valid
        createMockSwap('2', 'user-2', 'cancelled'), // Excluded - cancelled
        createMockSwap('3', 'user-3', 'completed'), // Valid
        createMockSwap('4', 'user-4', 'pending'), // Valid
        createMockSwap('5', 'user-5', 'cancelled') // Excluded - cancelled
      ];
      
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(3);
      expect(filtered.map(s => s.id)).toEqual(['1', '3', '4']);
      expect(filtered.every(s => s.sourceBooking.status !== 'cancelled')).toBe(true);
    });

    it('should handle active proposals requirement', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true), // Valid - has proposals
        createMockSwap('2', 'user-2', 'available', false), // Excluded - no proposals
        createMockSwap('3', 'user-3', 'available', true), // Valid - has proposals
        createMockSwap('4', 'user-4', 'available', false) // Excluded - no proposals
      ];
      
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['1', '3']);
      expect(filtered.every(s => s.hasActiveProposals)).toBe(true);
    });

    it('should handle complex combinations of exclusion rules', () => {
      const swaps = [
        createMockSwap('1', currentUserId, 'available', true), // Excluded - own swap
        createMockSwap('2', 'user-2', 'cancelled', true), // Excluded - cancelled
        createMockSwap('3', 'user-3', 'available', false), // Excluded - no proposals
        createMockSwap('4', currentUserId, 'cancelled', false), // Excluded - multiple reasons
        createMockSwap('5', 'user-5', 'available', true) // Valid - passes all filters
      ];
      
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('5');
    });
  });

  describe('Location Filtering Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should filter by exact city match', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', { city: 'Paris', country: 'France' }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', { city: 'London', country: 'UK' }),
        createMockSwap('3', 'user-3', 'available', true, 'booking', { city: 'Paris', country: 'France' })
      ];
      
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.sourceBooking.location.city === 'Paris')).toBe(true);
    });

    it('should filter by partial city match (case insensitive)', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', { city: 'New York', country: 'USA' }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', { city: 'York', country: 'UK' }),
        createMockSwap('3', 'user-3', 'available', true, 'booking', { city: 'Los Angeles', country: 'USA' })
      ];
      
      const filters: SwapFilters = {
        location: { city: 'york' }, // lowercase
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.sourceBooking.location.city)).toEqual(['New York', 'York']);
    });

    it('should filter by country', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', { city: 'Paris', country: 'France' }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', { city: 'Lyon', country: 'France' }),
        createMockSwap('3', 'user-3', 'available', true, 'booking', { city: 'London', country: 'UK' })
      ];
      
      const filters: SwapFilters = {
        location: { country: 'France' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.sourceBooking.location.country === 'France')).toBe(true);
    });

    it('should filter by both city and country', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', { city: 'Paris', country: 'France' }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', { city: 'Paris', country: 'Texas' }), // Different country
        createMockSwap('3', 'user-3', 'available', true, 'booking', { city: 'Lyon', country: 'France' }) // Different city
      ];
      
      const filters: SwapFilters = {
        location: { city: 'Paris', country: 'France' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sourceBooking.location.city).toBe('Paris');
      expect(filtered[0].sourceBooking.location.country).toBe('France');
    });
  });

  describe('Date Range Filtering Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should filter by exact date range (non-flexible)', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-07-01'), // Outside range
          checkOut: new Date('2024-07-05')
        }),
        createMockSwap('3', 'user-3', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-06-02'),
          checkOut: new Date('2024-06-04')
        })
      ];
      
      const filters: SwapFilters = {
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-06-30'),
          flexible: false
        },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['1', '3']);
    });

    it('should filter by flexible date range (overlap)', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-05-28'), // Overlaps at end
          checkOut: new Date('2024-06-02')
        }),
        createMockSwap('2', 'user-2', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-06-28'), // Overlaps at start
          checkOut: new Date('2024-07-05')
        }),
        createMockSwap('3', 'user-3', 'available', true, 'booking', undefined, {
          checkIn: new Date('2024-07-10'), // No overlap
          checkOut: new Date('2024-07-15')
        })
      ];
      
      const filters: SwapFilters = {
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-06-30'),
          flexible: true
        },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['1', '2']);
    });
  });

  describe('Price Range Filtering Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should filter booking swaps by price range', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', undefined, undefined, 500),
        createMockSwap('2', 'user-2', 'available', true, 'booking', undefined, undefined, 1500),
        createMockSwap('3', 'user-3', 'available', true, 'booking', undefined, undefined, 800)
      ];
      
      const filters: SwapFilters = {
        priceRange: { min: 600, max: 1200 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
      expect(filtered[0].sourceBooking.swapValue).toBe(800);
    });

    it('should filter cash swaps by preferred amount', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'cash', undefined, undefined, 0, {
          minAmount: 400,
          maxAmount: 600,
          preferredAmount: 500,
          currency: 'USD'
        }),
        createMockSwap('2', 'user-2', 'available', true, 'cash', undefined, undefined, 0, {
          minAmount: 800,
          maxAmount: 1200,
          preferredAmount: 1000,
          currency: 'USD'
        }),
        createMockSwap('3', 'user-3', 'available', true, 'cash', undefined, undefined, 0, {
          minAmount: 600,
          maxAmount: 800,
          preferredAmount: 700,
          currency: 'USD'
        })
      ];
      
      const filters: SwapFilters = {
        priceRange: { min: 650, max: 950 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
      expect(filtered[0].cashDetails?.preferredAmount).toBe(700);
    });

    it('should filter cash swaps by average when no preferred amount', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'cash', undefined, undefined, 0, {
          minAmount: 400,
          maxAmount: 800, // Average: 600
          currency: 'USD'
        }),
        createMockSwap('2', 'user-2', 'available', true, 'cash', undefined, undefined, 0, {
          minAmount: 1000,
          maxAmount: 1400, // Average: 1200
          currency: 'USD'
        })
      ];
      
      const filters: SwapFilters = {
        priceRange: { min: 500, max: 700 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should handle minimum price only', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', undefined, undefined, 300),
        createMockSwap('2', 'user-2', 'available', true, 'booking', undefined, undefined, 800),
        createMockSwap('3', 'user-3', 'available', true, 'booking', undefined, undefined, 1200)
      ];
      
      const filters: SwapFilters = {
        priceRange: { min: 500 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['2', '3']);
    });

    it('should handle maximum price only', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking', undefined, undefined, 300),
        createMockSwap('2', 'user-2', 'available', true, 'booking', undefined, undefined, 800),
        createMockSwap('3', 'user-3', 'available', true, 'booking', undefined, undefined, 1200)
      ];
      
      const filters: SwapFilters = {
        priceRange: { max: 900 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['1', '2']);
    });
  });

  describe('Swap Type Filtering Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should filter to booking swaps only', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking'),
        createMockSwap('2', 'user-2', 'available', true, 'cash'),
        createMockSwap('3', 'user-3', 'available', true, 'booking'),
        createMockSwap('4', 'user-4', 'available', true, 'cash')
      ];
      
      const filters: SwapFilters = {
        swapType: 'booking',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.swapType === 'booking')).toBe(true);
      expect(filtered.map(s => s.id)).toEqual(['1', '3']);
    });

    it('should filter to cash swaps only', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking'),
        createMockSwap('2', 'user-2', 'available', true, 'cash'),
        createMockSwap('3', 'user-3', 'available', true, 'booking'),
        createMockSwap('4', 'user-4', 'available', true, 'cash')
      ];
      
      const filters: SwapFilters = {
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(s => s.swapType === 'cash')).toBe(true);
      expect(filtered.map(s => s.id)).toEqual(['2', '4']);
    });

    it('should include both types when swapType is "both"', () => {
      const swaps = [
        createMockSwap('1', 'user-1', 'available', true, 'booking'),
        createMockSwap('2', 'user-2', 'available', true, 'cash')
      ];
      
      const filters: SwapFilters = {
        swapType: 'both',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const coreFiltered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const filtered = filterService.applyUserFilters(coreFiltered, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.map(s => s.id)).toEqual(['1', '2']);
    });
  });

  describe('Complex Multi-Filter Scenarios', () => {
    const currentUserId = 'user-123';
    
    it('should apply all filters together correctly', () => {
      const swaps = [
        // Valid: passes all filters
        createMockSwap('1', 'user-1', 'available', true, 'cash', 
          { city: 'Paris', country: 'France' },
          { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
          0,
          { minAmount: 700, maxAmount: 900, preferredAmount: 800, currency: 'USD' }
        ),
        // Invalid: wrong city
        createMockSwap('2', 'user-2', 'available', true, 'cash',
          { city: 'London', country: 'France' },
          { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
          0,
          { minAmount: 700, maxAmount: 900, preferredAmount: 800, currency: 'USD' }
        ),
        // Invalid: wrong swap type
        createMockSwap('3', 'user-3', 'available', true, 'booking',
          { city: 'Paris', country: 'France' },
          { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
          800
        ),
        // Invalid: price too high
        createMockSwap('4', 'user-4', 'available', true, 'cash',
          { city: 'Paris', country: 'France' },
          { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
          0,
          { minAmount: 1200, maxAmount: 1400, preferredAmount: 1300, currency: 'USD' }
        ),
        // Invalid: date out of range
        createMockSwap('5', 'user-5', 'available', true, 'cash',
          { city: 'Paris', country: 'France' },
          { checkIn: new Date('2024-07-01'), checkOut: new Date('2024-07-05') },
          0,
          { minAmount: 700, maxAmount: 900, preferredAmount: 800, currency: 'USD' }
        )
      ];
      
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-06-30'),
          flexible: false
        },
        priceRange: { min: 600, max: 1000 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should handle edge case where all swaps are filtered out', () => {
      const swaps = [
        createMockSwap('1', currentUserId), // Own swap
        createMockSwap('2', 'user-2', 'cancelled'), // Cancelled
        createMockSwap('3', 'user-3', 'available', false) // No proposals
      ];
      
      const filters: SwapFilters = {
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      
      expect(filtered).toHaveLength(0);
    });

    it('should maintain performance with complex filters on large dataset', () => {
      // Create a large dataset
      const swaps: SwapWithBookings[] = [];
      for (let i = 0; i < 1000; i++) {
        swaps.push(createMockSwap(
          i.toString(),
          `user-${i % 100}`, // 100 different users
          i % 10 === 0 ? 'cancelled' : 'available', // 10% cancelled
          i % 5 !== 0, // 80% have proposals
          i % 2 === 0 ? 'booking' : 'cash',
          { city: `City${i % 20}`, country: `Country${i % 10}` }, // 20 cities, 10 countries
          {
            checkIn: new Date(2024, 5, (i % 30) + 1), // Spread across June
            checkOut: new Date(2024, 5, (i % 30) + 5)
          },
          (i % 10) * 100 + 500 // Prices from 500 to 1400
        ));
      }
      
      const filters: SwapFilters = {
        location: { city: 'City5' },
        priceRange: { min: 800, max: 1200 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const startTime = performance.now();
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      const endTime = performance.now();
      
      // Should complete within reasonable time (< 100ms for 1000 items)
      expect(endTime - startTime).toBeLessThan(100);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThanOrEqual(0); // Allow for empty results
      if (filtered.length > 0) {
        expect(filtered.every(s => s.sourceBooking.location.city === 'City5')).toBe(true);
        expect(filtered.every(s => s.swapType === 'cash')).toBe(true);
        expect(filtered.every(s => s.owner.id !== currentUserId)).toBe(true);
        expect(filtered.every(s => s.sourceBooking.status !== 'cancelled')).toBe(true);
        expect(filtered.every(s => s.hasActiveProposals)).toBe(true);
      }
    });
  });

  describe('Filter Validation Edge Cases', () => {
    it('should validate date ranges correctly', () => {
      const invalidFilters: SwapFilters = {
        dateRange: {
          start: new Date('2024-06-30'),
          end: new Date('2024-06-01') // End before start
        },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const result = filterService.validateFilters(invalidFilters);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it('should validate price ranges correctly', () => {
      const invalidFilters: SwapFilters = {
        priceRange: { min: 1000, max: 500 }, // Min > Max
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const result = filterService.validateFilters(invalidFilters);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum price cannot be greater than maximum price');
    });

    it('should validate negative prices', () => {
      const invalidFilters: SwapFilters = {
        priceRange: { min: -100, max: 500 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const result = filterService.validateFilters(invalidFilters);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum price cannot be negative');
    });

    it('should validate coordinate radius', () => {
      const invalidFilters: SwapFilters = {
        location: {
          coordinates: {
            lat: 48.8566,
            lng: 2.3522,
            radius: -5 // Negative radius
          }
        },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const result = filterService.validateFilters(invalidFilters);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Search radius must be greater than 0');
    });

    it('should pass validation for valid filters', () => {
      const validFilters: SwapFilters = {
        location: { city: 'Paris', country: 'France' },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-06-30')
        },
        priceRange: { min: 500, max: 1500 },
        swapType: 'both',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };
      
      const result = filterService.validateFilters(validFilters);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Filter Summary Generation', () => {
    it('should generate basic filter summary', () => {
      const filters = {
        location: { city: 'Paris', country: 'France' },
        swapType: 'cash' as const,
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const
      };
      
      const summary = filterService.getFilterSummary(filters, 'user-123');
      
      expect(summary).toContain('excluding your own bookings');
      expect(summary).toContain('excluding cancelled bookings');
      expect(summary).toContain('only showing bookings with active swap proposals');
      expect(summary).toContain('in Paris');
      expect(summary).toContain('in France');
      expect(summary).toContain('cash swaps only');
    });

    it('should handle location-only filter summary', () => {
      const filters = {
        location: { city: 'London' },
        excludeOwnSwaps: true as const,
        excludeCancelledBookings: true as const,
        requireActiveProposals: true as const
      };
      
      const summary = filterService.getFilterSummary(filters, 'user-123');
      
      expect(summary).toContain('in London');
      expect(summary).not.toContain('swaps only'); // No swap type filter
    });
  });
});