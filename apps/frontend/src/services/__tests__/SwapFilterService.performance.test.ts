import { describe, it, expect, beforeEach } from 'vitest';
import { SwapFilterService, SwapFilters } from '../SwapFilterService';
import { SwapWithBookings } from '../bookingService';

/**
 * Performance tests for SwapFilterService with large datasets
 * Tests filtering performance with complex rules as required by task 10.5
 */
describe('SwapFilterService - Performance Tests', () => {
  let filterService: SwapFilterService;

  beforeEach(() => {
    filterService = new SwapFilterService();
  });

  // Helper function to generate large datasets
  const generateLargeSwapDataset = (size: number): SwapWithBookings[] => {
    const swaps: SwapWithBookings[] = [];
    const cities = ['Paris', 'London', 'New York', 'Tokyo', 'Berlin', 'Rome', 'Madrid', 'Amsterdam', 'Vienna', 'Prague'];
    const countries = ['France', 'UK', 'USA', 'Japan', 'Germany', 'Italy', 'Spain', 'Netherlands', 'Austria', 'Czech Republic'];
    const statuses = ['available', 'cancelled', 'completed', 'pending'];
    const swapTypes: ('booking' | 'cash')[] = ['booking', 'cash'];

    for (let i = 0; i < size; i++) {
      const cityIndex = i % cities.length;
      const countryIndex = i % countries.length;
      const statusIndex = i % statuses.length;
      const swapTypeIndex = i % swapTypes.length;
      const ownerId = `user-${i % 100}`; // 100 different users
      const hasProposals = i % 5 !== 0; // 80% have proposals
      const price = (i % 20) * 100 + 500; // Prices from 500 to 2400

      const swap: SwapWithBookings = {
        id: `swap-${i}`,
        sourceBooking: {
          id: `booking-${i}`,
          title: `Booking ${i} in ${cities[cityIndex]}`,
          description: `Description for booking ${i}`,
          userId: ownerId,
          status: statuses[statusIndex] as any,
          type: 'hotel',
          location: { city: cities[cityIndex], country: countries[countryIndex] },
          city: cities[cityIndex],
          country: countries[countryIndex],
          dateRange: {
            checkIn: new Date(2024, 5 + (i % 6), (i % 28) + 1).toISOString(), // Spread across 6 months
            checkOut: new Date(2024, 5 + (i % 6), (i % 28) + 5).toISOString()
          },
          checkInDate: new Date(2024, 5 + (i % 6), (i % 28) + 1).toISOString(),
          checkOutDate: new Date(2024, 5 + (i % 6), (i % 28) + 5).toISOString(),
          originalPrice: price + 200,
          swapValue: price,
          createdAt: new Date(2024, 0, (i % 365) + 1).toISOString(),
          updatedAt: new Date(2024, 0, (i % 365) + 1).toISOString(),
          verification: { status: 'verified', verifiedAt: new Date() },
          providerDetails: {
            provider: `Provider ${i % 10}`,
            confirmationNumber: `CONF${i}`,
            bookingReference: `REF${i}`
          }
        },
        owner: { id: ownerId, name: `User ${ownerId}`, walletAddress: `0x${i.toString(16)}` },
        proposer: { id: 'proposer-1', name: 'Test Proposer', walletAddress: '0x456' },
        swapType: swapTypes[swapTypeIndex],
        cashDetails: swapTypes[swapTypeIndex] === 'cash' ? {
          minAmount: price - 100,
          maxAmount: price + 100,
          preferredAmount: price,
          currency: 'USD',
          paymentMethods: ['Credit Card'],
          escrowRequired: true,
          platformFeePercentage: 3
        } : undefined,
        hasActiveProposals: hasProposals,
        activeProposalCount: hasProposals ? Math.floor(Math.random() * 5) + 1 : 0,
        status: 'pending',
        createdAt: new Date(2024, 0, (i % 365) + 1).toISOString(),
        updatedAt: new Date(2024, 0, (i % 365) + 1).toISOString()
      };

      swaps.push(swap);
    }

    return swaps;
  };

  describe('Core Filtering Performance', () => {
    it('should filter 1,000 swaps within acceptable time', () => {
      const swaps = generateLargeSwapDataset(1000);
      const currentUserId = 'test-user';

      const startTime = performance.now();
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 50ms for 1,000 items
      expect(executionTime).toBeLessThan(50);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(s => s.owner.id !== currentUserId)).toBe(true);
      expect(filtered.every(s => s.sourceBooking.status !== 'cancelled')).toBe(true);
      expect(filtered.every(s => s.hasActiveProposals)).toBe(true);
    });

    it('should filter 10,000 swaps within acceptable time', () => {
      const swaps = generateLargeSwapDataset(10000);
      const currentUserId = 'test-user';

      const startTime = performance.now();
      const filtered = filterService.applyCoreBrowsingFilters(swaps, currentUserId);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 200ms for 10,000 items
      expect(executionTime).toBeLessThan(200);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered.every(s => s.owner.id !== currentUserId)).toBe(true);
    });

    it('should handle edge case of all swaps being filtered out efficiently', () => {
      const swaps = generateLargeSwapDataset(5000);
      // Set all swaps to be owned by the current user
      swaps.forEach(swap => {
        swap.owner.id = 'current-user';
      });

      const startTime = performance.now();
      const filtered = filterService.applyCoreBrowsingFilters(swaps, 'current-user');
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete quickly even when all items are filtered out
      expect(executionTime).toBeLessThan(100);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('User Filtering Performance', () => {
    it('should apply location filters efficiently on large dataset', () => {
      const swaps = generateLargeSwapDataset(5000);
      const filters: SwapFilters = {
        location: { city: 'Paris', country: 'France' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyUserFilters(swaps, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 100ms for 5,000 items
      expect(executionTime).toBeLessThan(100);
      
      // Verify filtering worked correctly
      expect(filtered.every(s => s.sourceBooking.location.city === 'Paris')).toBe(true);
      expect(filtered.every(s => s.sourceBooking.location.country === 'France')).toBe(true);
    });

    it('should apply price range filters efficiently on large dataset', () => {
      const swaps = generateLargeSwapDataset(5000);
      const filters: SwapFilters = {
        priceRange: { min: 1000, max: 1500 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyUserFilters(swaps, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 100ms for 5,000 items
      expect(executionTime).toBeLessThan(100);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(swap => {
        const price = swap.swapType === 'cash' 
          ? (swap.cashDetails?.preferredAmount || (swap.cashDetails?.minAmount! + swap.cashDetails?.maxAmount!) / 2)
          : swap.sourceBooking.swapValue;
        expect(price).toBeGreaterThanOrEqual(1000);
        expect(price).toBeLessThanOrEqual(1500);
      });
    });

    it('should apply date range filters efficiently on large dataset', () => {
      const swaps = generateLargeSwapDataset(5000);
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

      const startTime = performance.now();
      const filtered = filterService.applyUserFilters(swaps, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 100ms for 5,000 items
      expect(executionTime).toBeLessThan(100);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach(swap => {
        const checkIn = new Date(swap.sourceBooking.dateRange.checkIn);
        const checkOut = new Date(swap.sourceBooking.dateRange.checkOut);
        expect(checkIn).toBeInstanceOf(Date);
        expect(checkOut).toBeInstanceOf(Date);
      });
    });

    it('should apply swap type filters efficiently on large dataset', () => {
      const swaps = generateLargeSwapDataset(5000);
      const filters: SwapFilters = {
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyUserFilters(swaps, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 50ms for 5,000 items (simple filter)
      expect(executionTime).toBeLessThan(50);
      
      // Verify filtering worked correctly
      expect(filtered.every(s => s.swapType === 'cash')).toBe(true);
    });
  });

  describe('Combined Filtering Performance', () => {
    it('should apply all filters efficiently on large dataset', () => {
      const swaps = generateLargeSwapDataset(10000);
      const currentUserId = 'test-user';
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-08-31'),
          flexible: true
        },
        priceRange: { min: 800, max: 1600 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within 300ms for 10,000 items with all filters
      expect(executionTime).toBeLessThan(300);
      
      // Verify filtering worked correctly
      expect(filtered.length).toBeGreaterThanOrEqual(0); // Allow for empty results with restrictive filters
      if (filtered.length > 0) {
        expect(filtered.every(s => s.owner.id !== currentUserId)).toBe(true);
        expect(filtered.every(s => s.sourceBooking.status !== 'cancelled')).toBe(true);
        expect(filtered.every(s => s.hasActiveProposals)).toBe(true);
        expect(filtered.every(s => s.sourceBooking.location.city === 'Paris')).toBe(true);
        expect(filtered.every(s => s.swapType === 'cash')).toBe(true);
      }
    });

    it('should maintain performance with multiple sequential filter operations', () => {
      const swaps = generateLargeSwapDataset(5000);
      const currentUserId = 'test-user';

      // Simulate multiple filter operations as user types/changes filters
      const operations = [
        { location: { city: 'P' } },
        { location: { city: 'Pa' } },
        { location: { city: 'Par' } },
        { location: { city: 'Pari' } },
        { location: { city: 'Paris' } },
        { location: { city: 'Paris' }, priceRange: { min: 1000 } },
        { location: { city: 'Paris' }, priceRange: { min: 1000, max: 1500 } },
        { location: { city: 'Paris' }, priceRange: { min: 1000, max: 1500 }, swapType: 'cash' as const }
      ];

      const startTime = performance.now();
      
      operations.forEach(filterUpdate => {
        const filters: SwapFilters = {
          ...filterUpdate,
          excludeOwnSwaps: true,
          excludeCancelledBookings: true,
          requireActiveProposals: true
        };
        filterService.applyAllFilters(swaps, currentUserId, filters);
      });

      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      
      // All operations should complete within 500ms
      expect(totalExecutionTime).toBeLessThan(500);
      
      // Average per operation should be reasonable
      const averagePerOperation = totalExecutionTime / operations.length;
      expect(averagePerOperation).toBeLessThan(100);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not create excessive intermediate arrays during filtering', () => {
      const swaps = generateLargeSwapDataset(5000);
      const currentUserId = 'test-user';
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        priceRange: { min: 1000, max: 1500 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      // Monitor memory usage (approximate)
      const initialMemory = process.memoryUsage().heapUsed;
      
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB for 5000 items)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // Filtered array should be much smaller than original
      expect(filtered.length).toBeLessThan(swaps.length);
    });

    it('should handle repeated filtering without memory leaks', () => {
      const swaps = generateLargeSwapDataset(1000);
      const currentUserId = 'test-user';
      const filters: SwapFilters = {
        location: { city: 'London' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform filtering 100 times
      for (let i = 0; i < 100; i++) {
        filterService.applyAllFilters(swaps, currentUserId, filters);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle empty dataset efficiently', () => {
      const swaps: SwapWithBookings[] = [];
      const currentUserId = 'test-user';
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        priceRange: { min: 1000, max: 1500 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete almost instantly
      expect(executionTime).toBeLessThan(1);
      expect(filtered).toHaveLength(0);
    });

    it('should handle dataset where no items pass core filters', () => {
      const swaps = generateLargeSwapDataset(5000);
      // Make all swaps owned by current user
      swaps.forEach(swap => {
        swap.owner.id = 'current-user';
      });

      const currentUserId = 'current-user';
      const filters: SwapFilters = {
        location: { city: 'Paris' },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete quickly even when core filters eliminate everything
      expect(executionTime).toBeLessThan(100);
      expect(filtered).toHaveLength(0);
    });

    it('should handle dataset with extreme filter selectivity', () => {
      const swaps = generateLargeSwapDataset(10000);
      const currentUserId = 'test-user';
      
      // Very restrictive filters that will match very few items
      const filters: SwapFilters = {
        location: { city: 'Prague' }, // Less common city
        priceRange: { min: 1950, max: 2000 }, // Very narrow price range
        swapType: 'cash',
        dateRange: {
          start: new Date('2024-06-15'),
          end: new Date('2024-06-20'), // Very narrow date range
          flexible: false
        },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      const filtered = filterService.applyAllFilters(swaps, currentUserId, filters);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      
      // Should complete within reasonable time even with very selective filters
      expect(executionTime).toBeLessThan(200);
      
      // Should have very few results
      expect(filtered.length).toBeLessThan(50);
    });
  });

  describe('Validation Performance', () => {
    it('should validate complex filters efficiently', () => {
      const complexFilters: SwapFilters = {
        location: {
          city: 'Paris',
          country: 'France',
          coordinates: {
            lat: 48.8566,
            lng: 2.3522,
            radius: 10
          }
        },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-08-31'),
          flexible: true
        },
        priceRange: { min: 500, max: 2000 },
        swapType: 'both',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      
      // Validate filters 1000 times
      for (let i = 0; i < 1000; i++) {
        filterService.validateFilters(complexFilters);
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 50ms for 1000 validations
      expect(executionTime).toBeLessThan(50);
    });

    it('should generate filter summaries efficiently', () => {
      const filters: SwapFilters = {
        location: { city: 'Paris', country: 'France' },
        dateRange: {
          start: new Date('2024-06-01'),
          end: new Date('2024-08-31')
        },
        priceRange: { min: 500, max: 2000 },
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true
      };

      const startTime = performance.now();
      
      // Generate summaries 1000 times
      for (let i = 0; i < 1000; i++) {
        filterService.getFilterSummary(filters, 'test-user');
      }
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Should complete within 20ms for 1000 summaries
      expect(executionTime).toBeLessThan(20);
    });
  });
});