/**
 * Tests for enhanced booking types
 */

import { describe, it, expect } from 'vitest';
import {
  UnifiedBookingData,
  BookingWithSwapInfo,
  InlineProposalData,
  EnhancedBookingFilters,
  SwapPreferencesData,
  SwapInfo
} from '../enhanced-booking';

describe('Enhanced Booking Types', () => {
  describe('UnifiedBookingData', () => {
    it('should create valid unified booking data with swap preferences', () => {
      const swapPreferences: SwapPreferencesData = {
        paymentTypes: ['booking', 'cash'],
        minCashAmount: 100,
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('2024-12-01'),
        swapConditions: ['No smoking', 'Pet-friendly']
      };

      const unifiedData: UnifiedBookingData = {
        type: 'hotel',
        title: 'Test Hotel Booking',
        description: 'A nice hotel in the city center',
        location: {
          city: 'New York',
          country: 'USA'
        },
        dateRange: {
          checkIn: new Date('2024-12-15'),
          checkOut: new Date('2024-12-20')
        },
        originalPrice: 500,
        swapValue: 450,
        providerDetails: {
          provider: 'Booking.com',
          confirmationNumber: 'ABC123',
          bookingReference: 'REF456'
        },
        swapEnabled: true,
        swapPreferences
      };

      expect(unifiedData.swapEnabled).toBe(true);
      expect(unifiedData.swapPreferences?.paymentTypes).toContain('booking');
      expect(unifiedData.swapPreferences?.paymentTypes).toContain('cash');
      expect(unifiedData.swapPreferences?.minCashAmount).toBe(100);
    });

    it('should create valid unified booking data without swap preferences', () => {
      const unifiedData: UnifiedBookingData = {
        type: 'event',
        title: 'Concert Tickets',
        description: 'Front row seats',
        location: {
          city: 'Los Angeles',
          country: 'USA'
        },
        dateRange: {
          checkIn: new Date('2024-11-10'),
          checkOut: new Date('2024-11-10')
        },
        originalPrice: 200,
        providerDetails: {
          provider: 'Ticketmaster',
          confirmationNumber: 'TM789',
          bookingReference: 'TICKET123'
        },
        swapEnabled: false
      };

      expect(unifiedData.swapEnabled).toBe(false);
      expect(unifiedData.swapPreferences).toBeUndefined();
    });
  });

  describe('BookingWithSwapInfo', () => {
    it('should extend booking with swap information', () => {
      const swapInfo: SwapInfo = {
        swapId: 'swap-123',
        paymentTypes: ['cash'],
        acceptanceStrategy: 'first-match',
        minCashAmount: 150,
        hasActiveProposals: true,
        activeProposalCount: 3,
        userProposalStatus: 'pending',
        swapConditions: []
      };

      const bookingWithSwap: BookingWithSwapInfo = {
        id: 'booking-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-123',
        type: 'hotel',
        title: 'Hotel Booking',
        description: 'Nice hotel',
        location: { city: 'Paris', country: 'France' },
        dateRange: { checkIn: new Date(), checkOut: new Date() },
        originalPrice: 300,
        swapValue: 280,
        providerDetails: {
          provider: 'Hotels.com',
          confirmationNumber: 'HTL456',
          bookingReference: 'REF789'
        },
        verification: {
          status: 'verified',
          verifiedAt: new Date(),
          documents: []
        },
        blockchain: {
          topicId: 'topic-123'
        },
        status: 'available',
        swapInfo
      };

      expect(bookingWithSwap.swapInfo?.swapId).toBe('swap-123');
      expect(bookingWithSwap.swapInfo?.hasActiveProposals).toBe(true);
      expect(bookingWithSwap.swapInfo?.activeProposalCount).toBe(3);
    });
  });

  describe('InlineProposalData', () => {
    it('should create valid booking proposal data', () => {
      const proposalData: InlineProposalData = {
        type: 'booking',
        selectedBookingId: 'booking-456',
        message: 'Would love to swap!',
        conditions: ['Flexible dates']
      };

      expect(proposalData.type).toBe('booking');
      expect(proposalData.selectedBookingId).toBe('booking-456');
      expect(proposalData.cashAmount).toBeUndefined();
    });

    it('should create valid cash proposal data', () => {
      const proposalData: InlineProposalData = {
        type: 'cash',
        cashAmount: 250,
        paymentMethodId: 'pm-123',
        message: 'Cash offer for your booking'
      };

      expect(proposalData.type).toBe('cash');
      expect(proposalData.cashAmount).toBe(250);
      expect(proposalData.selectedBookingId).toBeUndefined();
    });
  });

  describe('EnhancedBookingFilters', () => {
    it('should create comprehensive filter object', () => {
      const filters: EnhancedBookingFilters = {
        type: ['hotel', 'event'],
        location: {
          city: 'London',
          country: 'UK',
          radius: 50
        },
        dateRange: {
          start: new Date('2024-12-01'),
          end: new Date('2024-12-31')
        },
        priceRange: {
          min: 100,
          max: 1000
        },
        swapAvailable: true,
        acceptsCash: true,
        auctionMode: false,
        swapType: 'both',
        query: 'luxury hotel',
        sortBy: 'price',
        sortOrder: 'asc',
        limit: 20
      };

      expect(filters.swapAvailable).toBe(true);
      expect(filters.acceptsCash).toBe(true);
      expect(filters.swapType).toBe('both');
      expect(filters.type).toContain('hotel');
      expect(filters.location?.city).toBe('London');
    });
  });
});