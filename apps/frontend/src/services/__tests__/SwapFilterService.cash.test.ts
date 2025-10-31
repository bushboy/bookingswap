import { describe, it, expect } from 'vitest';
import { swapFilterService, SwapFilters } from '../SwapFilterService';
import { SwapWithBookings } from '../bookingService';

const createMockSwap = (
  id: string,
  swapType: 'booking' | 'cash',
  ownerId: string,
  bookingStatus: string = 'available',
  hasActiveProposals: boolean = true,
  cashDetails?: any
): SwapWithBookings => ({
  id,
  sourceBooking: {
    id: `booking-${id}`,
    title: `Test Booking ${id}`,
    type: 'hotel',
    location: { city: 'Test City', country: 'Test Country' },
    dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
    swapValue: 1000,
    originalPrice: 1200,
    status: bookingStatus as any,
    userId: ownerId,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    verification: { status: 'verified', verifiedAt: new Date('2024-01-01') },
    providerDetails: { provider: 'Test Provider', confirmationNumber: 'TEST123', bookingReference: 'REF123' },
  },
  owner: { id: ownerId, name: 'Test Owner', walletAddress: '0x123' },
  proposer: { id: 'proposer-1', name: 'Test Proposer', walletAddress: '0x456' },
  swapType,
  cashDetails,
  hasActiveProposals,
  activeProposalCount: hasActiveProposals ? 1 : 0,
  status: 'pending',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

describe('SwapFilterService - Cash Swap Filtering', () => {
  const currentUserId = 'test-user';
  
  const bookingSwap = createMockSwap('1', 'booking', 'owner-1');
  const cashSwap = createMockSwap('2', 'cash', 'owner-2', 'available', true, {
    minAmount: 500,
    maxAmount: 1000,
    preferredAmount: 750,
    currency: 'USD',
    paymentMethods: ['Credit Card'],
    escrowRequired: true,
    platformFeePercentage: 3,
  });
  const ownSwap = createMockSwap('3', 'cash', currentUserId);
  const cancelledSwap = createMockSwap('4', 'cash', 'owner-3', 'cancelled');
  const noProposalsSwap = createMockSwap('5', 'booking', 'owner-4', 'available', false);

  const allSwaps = [bookingSwap, cashSwap, ownSwap, cancelledSwap, noProposalsSwap];

  describe('Core Browsing Filters', () => {
    it('excludes user own swaps', () => {
      const filtered = swapFilterService.applyCoreBrowsingFilters(allSwaps, currentUserId);
      
      expect(filtered).not.toContain(ownSwap);
      // Should exclude: ownSwap, cancelledSwap, noProposalsSwap = 3 excluded, 2 remaining
      expect(filtered).toHaveLength(2);
    });

    it('excludes cancelled bookings', () => {
      const filtered = swapFilterService.applyCoreBrowsingFilters(allSwaps, currentUserId);
      
      expect(filtered).not.toContain(cancelledSwap);
      expect(filtered.some(swap => swap.sourceBooking.status === 'cancelled')).toBe(false);
    });

    it('excludes swaps without active proposals', () => {
      const filtered = swapFilterService.applyCoreBrowsingFilters(allSwaps, currentUserId);
      
      expect(filtered).not.toContain(noProposalsSwap);
      expect(filtered.every(swap => swap.hasActiveProposals)).toBe(true);
    });

    it('includes valid booking and cash swaps', () => {
      const filtered = swapFilterService.applyCoreBrowsingFilters(allSwaps, currentUserId);
      
      expect(filtered).toContain(bookingSwap);
      expect(filtered).toContain(cashSwap);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('Swap Type Filtering', () => {
    const validSwaps = [bookingSwap, cashSwap];

    it('filters to booking swaps only', () => {
      const filters: SwapFilters = {
        swapType: 'booking',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(validSwaps, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(bookingSwap);
      expect(filtered[0].swapType).toBe('booking');
    });

    it('filters to cash swaps only', () => {
      const filters: SwapFilters = {
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(validSwaps, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(cashSwap);
      expect(filtered[0].swapType).toBe('cash');
    });

    it('includes both types when swapType is "both"', () => {
      const filters: SwapFilters = {
        swapType: 'both',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(validSwaps, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(bookingSwap);
      expect(filtered).toContain(cashSwap);
    });

    it('includes both types when swapType is not specified', () => {
      const filters: SwapFilters = {
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(validSwaps, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(bookingSwap);
      expect(filtered).toContain(cashSwap);
    });
  });

  describe('Price Range Filtering for Cash Swaps', () => {
    const cashSwapLowPrice = createMockSwap('low', 'cash', 'owner-low', 'available', true, {
      minAmount: 200,
      maxAmount: 400,
      preferredAmount: 300,
      currency: 'USD',
      paymentMethods: ['Credit Card'],
      escrowRequired: true,
      platformFeePercentage: 3,
    });

    const cashSwapHighPrice = createMockSwap('high', 'cash', 'owner-high', 'available', true, {
      minAmount: 1500,
      maxAmount: 2000,
      preferredAmount: 1750,
      currency: 'USD',
      paymentMethods: ['Credit Card'],
      escrowRequired: true,
      platformFeePercentage: 3,
    });

    const swapsWithVariedPrices = [cashSwapLowPrice, cashSwap, cashSwapHighPrice];

    it('filters cash swaps by minimum price using preferred amount', () => {
      const filters: SwapFilters = {
        priceRange: { min: 700, max: 2000 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(swapsWithVariedPrices, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(cashSwap); // preferred: 750
      expect(filtered).toContain(cashSwapHighPrice); // preferred: 1750
      expect(filtered).not.toContain(cashSwapLowPrice); // preferred: 300
    });

    it('filters cash swaps by maximum price', () => {
      const filters: SwapFilters = {
        priceRange: { min: 0, max: 800 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters(swapsWithVariedPrices, filters);
      
      expect(filtered).toHaveLength(2);
      expect(filtered).toContain(cashSwapLowPrice); // preferred: 300
      expect(filtered).toContain(cashSwap); // preferred: 750
      expect(filtered).not.toContain(cashSwapHighPrice); // preferred: 1750
    });

    it('uses average of min/max when no preferred amount is set', () => {
      const cashSwapNoPreferred = createMockSwap('no-pref', 'cash', 'owner-no-pref', 'available', true, {
        minAmount: 600,
        maxAmount: 800,
        currency: 'USD',
        paymentMethods: ['Credit Card'],
        escrowRequired: true,
        platformFeePercentage: 3,
      });

      const filters: SwapFilters = {
        priceRange: { min: 650, max: 750 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyUserFilters([cashSwapNoPreferred], filters);
      
      // Average of 600-800 is 700, which is within 650-750 range
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(cashSwapNoPreferred);
    });
  });

  describe('Combined Filtering', () => {
    it('applies all filters together correctly', () => {
      const filters: SwapFilters = {
        swapType: 'cash',
        priceRange: { min: 500, max: 1000 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const filtered = swapFilterService.applyAllFilters(allSwaps, currentUserId, filters);
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toBe(cashSwap);
      expect(filtered[0].swapType).toBe('cash');
      expect(filtered[0].cashDetails?.preferredAmount).toBe(750); // Within price range
    });
  });

  describe('Filter Summary', () => {
    it('includes swap type in filter summary', () => {
      const filters: SwapFilters = {
        swapType: 'cash',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const summary = swapFilterService.getFilterSummary(filters, currentUserId);
      
      expect(summary).toContain('cash swaps only');
      expect(summary).toContain('excluding your own bookings');
      expect(summary).toContain('excluding cancelled bookings');
      expect(summary).toContain('only showing bookings with active swap proposals');
    });

    it('does not include swap type when set to "both"', () => {
      const filters: SwapFilters = {
        swapType: 'both',
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const summary = swapFilterService.getFilterSummary(filters, currentUserId);
      
      expect(summary).not.toContain('swaps only');
      expect(summary).toContain('excluding your own bookings');
    });
  });

  describe('Filter Validation', () => {
    it('validates swap type filters correctly', () => {
      const validFilters: SwapFilters = {
        swapType: 'cash',
        priceRange: { min: 100, max: 1000 },
        excludeOwnSwaps: true,
        excludeCancelledBookings: true,
        requireActiveProposals: true,
      };

      const result = swapFilterService.validateFilters(validFilters);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});