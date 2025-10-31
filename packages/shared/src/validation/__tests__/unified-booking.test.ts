/**
 * Tests for unified booking validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateUnifiedBookingData,
  validateSwapPreferences,
  validateInlineProposal,
  validateUnifiedField,
  validateUnifiedAuctionTiming,
  hasValidationErrors,
  getValidationErrorCount,
} from '../unified-booking';
import { UnifiedBookingData, SwapPreferencesData, InlineProposalData } from '../../types/enhanced-booking';

describe('validateUnifiedBookingData', () => {
  const validBookingData: UnifiedBookingData = {
    type: 'hotel',
    title: 'Test Hotel Booking',
    description: 'A nice hotel booking for testing',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
    swapEnabled: false,
  };

  it('should validate a complete booking without swap preferences', () => {
    const errors = validateUnifiedBookingData(validBookingData);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require title', () => {
    const data = { ...validBookingData, title: '' };
    const errors = validateUnifiedBookingData(data);
    expect(errors.title).toBeDefined();
  });

  it('should require title to be at least 3 characters', () => {
    const data = { ...validBookingData, title: 'AB' };
    const errors = validateUnifiedBookingData(data);
    expect(errors.title).toContain('at least 3 characters');
  });

  it('should require description', () => {
    const data = { ...validBookingData, description: '' };
    const errors = validateUnifiedBookingData(data);
    expect(errors.description).toBeDefined();
  });

  it('should require description to be at least 10 characters', () => {
    const data = { ...validBookingData, description: 'Short' };
    const errors = validateUnifiedBookingData(data);
    expect(errors.description).toContain('at least 10 characters');
  });

  it('should require city and country', () => {
    const data = { ...validBookingData, location: { city: '', country: '' } };
    const errors = validateUnifiedBookingData(data);
    expect(errors['location.city']).toBeDefined();
    expect(errors['location.country']).toBeDefined();
  });

  it('should require positive original price', () => {
    const data = { ...validBookingData, originalPrice: 0 };
    const errors = validateUnifiedBookingData(data);
    expect(errors.originalPrice).toContain('greater than 0');
  });

  it('should require positive swap value', () => {
    const data = { ...validBookingData, swapValue: -100 };
    const errors = validateUnifiedBookingData(data);
    expect(errors.swapValue).toContain('greater than 0');
  });

  it('should require check-out date after check-in date', () => {
    const data = {
      ...validBookingData,
      dateRange: {
        checkIn: new Date('2024-12-05'),
        checkOut: new Date('2024-12-01'),
      },
    };
    const errors = validateUnifiedBookingData(data);
    expect(errors['dateRange.checkOut']).toContain('after check-in');
  });

  it('should validate swap preferences when swap is enabled', () => {
    const data: UnifiedBookingData = {
      ...validBookingData,
      swapEnabled: true,
      swapPreferences: {
        paymentTypes: ['booking'],
        acceptanceStrategy: 'first-match',
        swapConditions: [],
      },
    };
    const errors = validateUnifiedBookingData(data);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require swap preferences when swap is enabled', () => {
    const data = { ...validBookingData, swapEnabled: true };
    const errors = validateUnifiedBookingData(data);
    expect(errors.swapPreferences).toBeDefined();
  });
});

describe('validateSwapPreferences', () => {
  const validPreferences: SwapPreferencesData = {
    paymentTypes: ['booking'],
    acceptanceStrategy: 'first-match',
    swapConditions: [],
  };

  const futureEventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

  it('should validate basic swap preferences', () => {
    const errors = validateSwapPreferences(validPreferences, futureEventDate);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require at least one payment type', () => {
    const preferences = { ...validPreferences, paymentTypes: [] as any };
    const errors = validateSwapPreferences(preferences, futureEventDate);
    expect(errors.paymentTypes).toContain('At least one payment type');
  });

  it('should require minimum cash amount for cash payments', () => {
    const preferences = {
      ...validPreferences,
      paymentTypes: ['cash'] as any,
    };
    const errors = validateSwapPreferences(preferences, futureEventDate);
    expect(errors.minCashAmount).toContain('required for cash swaps');
  });

  it('should validate cash amount constraints', () => {
    const preferences = {
      ...validPreferences,
      paymentTypes: ['cash'] as any,
      minCashAmount: 100,
      maxCashAmount: 50,
    };
    const errors = validateSwapPreferences(preferences, futureEventDate);
    expect(errors.maxCashAmount).toContain('greater than minimum');
  });

  it('should require auction end date for auction strategy', () => {
    const preferences = {
      ...validPreferences,
      acceptanceStrategy: 'auction' as any,
    };
    const errors = validateSwapPreferences(preferences, futureEventDate);
    expect(errors.auctionEndDate).toContain('required for auction mode');
  });

  it('should validate auction timing constraints', () => {
    const eventDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const auctionEndDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
    
    const preferences = {
      ...validPreferences,
      acceptanceStrategy: 'auction' as any,
      auctionEndDate,
    };
    
    const errors = validateSwapPreferences(preferences, eventDate);
    expect(errors.auctionEndDate).toContain('at least one week before');
  });

  it('should prevent auctions for last-minute events', () => {
    const eventDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    const auctionEndDate = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000); // 1 day from now
    
    const preferences = {
      ...validPreferences,
      acceptanceStrategy: 'auction' as any,
      auctionEndDate,
    };
    
    const errors = validateSwapPreferences(preferences, eventDate);
    expect(errors.acceptanceStrategy).toContain('less than one week away');
  });
});

describe('validateInlineProposal', () => {
  it('should validate booking proposal', () => {
    const proposal: InlineProposalData = {
      type: 'booking',
      selectedBookingId: 'booking-123',
      message: 'Interested in swapping',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should validate cash proposal', () => {
    const proposal: InlineProposalData = {
      type: 'cash',
      cashAmount: 200,
      paymentMethodId: 'pm-123',
      message: 'Cash offer',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal);
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should require booking ID for booking proposals', () => {
    const proposal: InlineProposalData = {
      type: 'booking',
      message: 'Interested in swapping',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal);
    expect(errors.selectedBookingId).toContain('must be selected');
  });

  it('should require cash amount for cash proposals', () => {
    const proposal: InlineProposalData = {
      type: 'cash',
      paymentMethodId: 'pm-123',
      message: 'Cash offer',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal);
    expect(errors.cashAmount).toContain('required for cash proposals');
  });

  it('should validate minimum cash amount', () => {
    const proposal: InlineProposalData = {
      type: 'cash',
      cashAmount: 50,
      paymentMethodId: 'pm-123',
      message: 'Cash offer',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal, 100);
    expect(errors.cashAmount).toContain('at least $100');
  });

  it('should validate maximum cash amount', () => {
    const proposal: InlineProposalData = {
      type: 'cash',
      cashAmount: 1500,
      paymentMethodId: 'pm-123',
      message: 'Cash offer',
      conditions: [],
    };
    
    const errors = validateInlineProposal(proposal, 100, 1000);
    expect(errors.cashAmount).toContain('cannot exceed $1000');
  });
});

describe('validateUnifiedField', () => {
  it('should validate individual fields', () => {
    expect(validateUnifiedField('title', 'Valid Title')).toBe('');
    expect(validateUnifiedField('title', '')).toContain('required');
    expect(validateUnifiedField('title', 'AB')).toContain('at least 3 characters');
  });

  it('should validate with form context', () => {
    const formData = {
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
    };
    
    expect(validateUnifiedField('dateRange.checkOut', new Date('2024-12-10'), formData)).toBe('');
    expect(validateUnifiedField('dateRange.checkOut', new Date('2024-11-30'), formData)).toContain('after check-in');
  });
});

describe('validateUnifiedAuctionTiming', () => {
  it('should validate valid auction timing', () => {
    const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const auctionEndDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days from now
    
    const result = validateUnifiedAuctionTiming(auctionEndDate, eventDate);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject past auction end dates', () => {
    const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const auctionEndDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // Yesterday
    
    const result = validateUnifiedAuctionTiming(auctionEndDate, eventDate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('must be in the future');
  });

  it('should reject auction end dates too close to event', () => {
    const eventDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days from now
    const auctionEndDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000); // 8 days from now
    
    const result = validateUnifiedAuctionTiming(auctionEndDate, eventDate);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('at least one week before');
  });

  it('should provide warnings for short auction durations', () => {
    const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const auctionEndDate = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20 hours from now
    
    const result = validateUnifiedAuctionTiming(auctionEndDate, eventDate);
    expect(result.warnings).toContain('less than 24 hours');
  });
});

describe('utility functions', () => {
  it('should detect validation errors', () => {
    expect(hasValidationErrors({})).toBe(false);
    expect(hasValidationErrors({ title: 'Error message' })).toBe(true);
    expect(hasValidationErrors({ title: '', description: 'Error' })).toBe(true);
  });

  it('should count validation errors', () => {
    expect(getValidationErrorCount({})).toBe(0);
    expect(getValidationErrorCount({ title: 'Error' })).toBe(1);
    expect(getValidationErrorCount({ title: 'Error', description: 'Another error' })).toBe(2);
    expect(getValidationErrorCount({ title: '', description: 'Error' })).toBe(1);
  });
});