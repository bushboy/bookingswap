import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedBookingService } from '../UnifiedBookingService';

describe('UnifiedBookingService Integration', () => {
  let service: UnifiedBookingService;

  beforeEach(() => {
    // Mock localStorage for auth token
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'mock-auth-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    service = new UnifiedBookingService();
  });

  it('should create service instance successfully', () => {
    expect(service).toBeInstanceOf(UnifiedBookingService);
  });

  it('should have all required methods', () => {
    expect(typeof service.createBookingWithSwap).toBe('function');
    expect(typeof service.updateBookingWithSwap).toBe('function');
    expect(typeof service.getBookingsWithSwapInfo).toBe('function');
    expect(typeof service.makeInlineProposal).toBe('function');
    expect(typeof service.getUserRoleForBooking).toBe('function');
    expect(typeof service.getUserAvailableBookings).toBe('function');
  });

  it('should validate unified booking data correctly', () => {
    const validData = {
      type: 'hotel' as const,
      title: 'Test Hotel',
      description: 'A test hotel booking',
      location: {
        city: 'New York',
        country: 'USA',
      },
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      },
      originalPrice: 500,
      swapValue: 500,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF456',
      },
      swapEnabled: false,
    };

    // Access private method for testing
    const errors = (service as any).validateUnifiedBookingData(validData);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should validate swap preferences correctly', () => {
    const dataWithInvalidSwap = {
      type: 'hotel' as const,
      title: 'Test Hotel',
      description: 'A test hotel booking',
      location: {
        city: 'New York',
        country: 'USA',
      },
      dateRange: {
        checkIn: new Date('2024-06-01'),
        checkOut: new Date('2024-06-05'),
      },
      originalPrice: 500,
      swapValue: 500,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'ABC123',
        bookingReference: 'REF456',
      },
      swapEnabled: true,
      swapPreferences: {
        paymentTypes: [], // Invalid: empty array
        acceptanceStrategy: 'first-match' as const,
        swapConditions: [],
      },
    };

    const errors = (service as any).validateUnifiedBookingData(dataWithInvalidSwap);
    expect(errors.paymentTypes).toBe('At least one payment type must be selected');
  });

  it('should extract core booking filters correctly', () => {
    const enhancedFilters = {
      type: ['hotel', 'event'],
      location: { city: 'New York', country: 'USA' },
      dateRange: {
        start: new Date('2024-06-01'),
        end: new Date('2024-06-30'),
      },
      priceRange: { min: 100, max: 1000 },
      swapAvailable: true,
      acceptsCash: true,
      auctionMode: false,
    };

    const coreFilters = (service as any).extractCoreBookingFilters(enhancedFilters);
    
    expect(coreFilters).toEqual({
      type: ['hotel', 'event'],
      location: { city: 'New York', country: 'USA' },
      dateRange: {
        start: new Date('2024-06-01'),
        end: new Date('2024-06-30'),
      },
      priceRange: { min: 100, max: 1000 },
    });
    
    // Swap-specific filters should not be included
    expect(coreFilters.swapAvailable).toBeUndefined();
    expect(coreFilters.acceptsCash).toBeUndefined();
  });

  it('should map swap preferences to swap data correctly', () => {
    const swapPreferences = {
      paymentTypes: ['booking', 'cash'] as const,
      minCashAmount: 200,
      maxCashAmount: 800,
      acceptanceStrategy: 'auction' as const,
      auctionEndDate: new Date('2024-05-20'),
      swapConditions: ['Non-smoking', 'Pet-friendly'],
    };

    const swapData = (service as any).mapSwapPreferencesToSwapData(swapPreferences, 'booking-123');
    
    expect(swapData).toEqual({
      sourceBookingId: 'booking-123',
      paymentTypes: {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 200,
        preferredCashAmount: 800,
      },
      acceptanceStrategy: {
        type: 'auction',
        auctionEndDate: new Date('2024-05-20'),
        autoSelectHighest: true,
      },
      swapConditions: ['Non-smoking', 'Pet-friendly'],
      expirationDate: new Date('2024-05-20'),
    });
  });

  it('should validate inline proposal data correctly', () => {
    const validBookingProposal = {
      type: 'booking' as const,
      selectedBookingId: 'booking-456',
      message: 'Interested in swapping',
      conditions: ['Flexible dates'],
    };

    expect(() => {
      (service as any).validateInlineProposalData(validBookingProposal);
    }).not.toThrow();

    const invalidBookingProposal = {
      type: 'booking' as const,
      // Missing selectedBookingId
      message: 'Interested in swapping',
    };

    expect(() => {
      (service as any).validateInlineProposalData(invalidBookingProposal);
    }).toThrow('Selected booking is required for booking proposals');

    const validCashProposal = {
      type: 'cash' as const,
      cashAmount: 400,
      paymentMethodId: 'payment-123',
      message: 'Cash offer',
    };

    expect(() => {
      (service as any).validateInlineProposalData(validCashProposal);
    }).not.toThrow();

    const invalidCashProposal = {
      type: 'cash' as const,
      cashAmount: 0, // Invalid amount
      paymentMethodId: 'payment-123',
    };

    expect(() => {
      (service as any).validateInlineProposalData(invalidCashProposal);
    }).toThrow('Cash amount must be greater than 0');
  });
});