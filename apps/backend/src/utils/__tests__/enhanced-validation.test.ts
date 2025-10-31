import { describe, it, expect } from 'vitest';
import { 
  validateAuctionTiming,
  validatePaymentTypePreference,
  validateCashOfferAmount,
  validateAcceptanceStrategy,
  validateEnhancedSwapRequest
} from '../../validation/enhanced-swap-validation';
import { 
  EnhancedCreateSwapRequest,
  PaymentTypePreference,
  AcceptanceStrategy,
  AuctionTimingValidation
} from '@booking-swap/shared';

describe('Enhanced Swap Validation', () => {
  describe('validateAuctionTiming', () => {
    it('should validate correct auction timing', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now (11 days before event)

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.isLastMinute).toBe(false);
    });

    it('should reject auction for events less than one week away', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 5); // 5 days from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 2); // 2 days from now

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.isLastMinute).toBe(true);
      expect(result.errors).toContain('Auctions are not allowed for events less than one week away');
    });

    it('should reject auction ending less than one week before event', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now (4 days before event)

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction must end at least one week before the event');
    });

    it('should reject auction ending in the past', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() - 1); // Yesterday

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction end date must be in the future');
    });

    it('should calculate correct minimum end date', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 10); // 10 days from now

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      const expectedMinimumEndDate = new Date(eventDate);
      expectedMinimumEndDate.setDate(expectedMinimumEndDate.getDate() - 7); // One week before event

      expect(result.minimumEndDate.getTime()).toBeCloseTo(expectedMinimumEndDate.getTime(), -1000);
    });

    it('should handle edge case of exactly one week before event', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const auctionEndDate = new Date();
      auctionEndDate.setDate(auctionEndDate.getDate() + 7); // Exactly 1 week from now (7 days before event)

      const result = validateAuctionTiming(eventDate, auctionEndDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validatePaymentTypePreference', () => {
    it('should validate booking-only preference', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: false,
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate cash-enabled preference with minimum amount', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 150,
        preferredCashAmount: 300,
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cash preference without minimum amount', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: true,
        // Missing minimumCashAmount
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum cash amount is required when cash payments are enabled');
    });

    it('should reject minimum amount below platform minimum', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 50, // Below platform minimum of 100
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum cash amount must be at least 100 USD');
    });

    it('should reject minimum amount above platform maximum', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 15000, // Above platform maximum of 10000
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum cash amount cannot exceed 10000 USD');
    });

    it('should reject preferred amount below minimum amount', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 200,
        preferredCashAmount: 150, // Below minimum
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Preferred cash amount must be greater than or equal to minimum amount');
    });

    it('should reject preference with neither booking nor cash enabled', () => {
      const preference: PaymentTypePreference = {
        bookingExchange: false,
        cashPayment: false,
      };

      const result = validatePaymentTypePreference(preference);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one payment type must be enabled');
    });
  });

  describe('validateCashOfferAmount', () => {
    it('should validate cash offer above minimum requirements', () => {
      const result = validateCashOfferAmount(250, 'USD', 200, 100);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject cash offer below platform minimum', () => {
      const result = validateCashOfferAmount(50, 'USD', 0, 100);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Minimum cash amount is 100 USD');
    });

    it('should reject cash offer above platform maximum', () => {
      const result = validateCashOfferAmount(15000, 'USD', 0, 100);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum cash amount is 10000 USD');
    });

    it('should reject cash offer below swap minimum requirement', () => {
      const result = validateCashOfferAmount(150, 'USD', 200, 100);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Amount must be at least 200 USD as specified by swap owner');
    });

    it('should reject unsupported currency', () => {
      const result = validateCashOfferAmount(200, 'XYZ', 100, 100);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Currency XYZ is not supported');
    });

    it('should validate EUR currency with correct limits', () => {
      const result = validateCashOfferAmount(200, 'EUR', 150, 100);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle edge case amounts', () => {
      // Test exactly at platform minimum
      const minResult = validateCashOfferAmount(100, 'USD', 100, 100);
      expect(minResult.isValid).toBe(true);

      // Test exactly at platform maximum
      const maxResult = validateCashOfferAmount(10000, 'USD', 5000, 100);
      expect(maxResult.isValid).toBe(true);
    });
  });

  describe('validateAcceptanceStrategy', () => {
    it('should validate first-match strategy', () => {
      const strategy: AcceptanceStrategy = {
        type: 'first_match',
      };

      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 10);

      const result = validateAcceptanceStrategy(strategy, eventDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate auction strategy with valid timing', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21); // 3 weeks from now

      const strategy: AcceptanceStrategy = {
        type: 'auction',
        auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        autoSelectHighest: true,
      };

      const result = validateAcceptanceStrategy(strategy, eventDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject auction strategy without end date', () => {
      const strategy: AcceptanceStrategy = {
        type: 'auction',
        // Missing auctionEndDate
      };

      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 21);

      const result = validateAcceptanceStrategy(strategy, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction end date is required for auction strategy');
    });

    it('should reject auction strategy for last-minute events', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 5); // 5 days from now

      const strategy: AcceptanceStrategy = {
        type: 'auction',
        auctionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      };

      const result = validateAcceptanceStrategy(strategy, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auctions are not allowed for events less than one week away');
    });

    it('should reject auction strategy with invalid timing', () => {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 14); // 2 weeks from now

      const strategy: AcceptanceStrategy = {
        type: 'auction',
        auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now (4 days before event)
      };

      const result = validateAcceptanceStrategy(strategy, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction must end at least one week before the event');
    });
  });

  describe('validateEnhancedSwapRequest', () => {
    const validRequest: EnhancedCreateSwapRequest = {
      sourceBookingId: 'booking-123',
      title: 'Test Swap',
      description: 'Test swap description',
      paymentTypes: {
        bookingExchange: true,
        cashPayment: true,
        minimumCashAmount: 200,
      },
      acceptanceStrategy: {
        type: 'first_match',
      },
      swapPreferences: {
        preferredLocations: ['London'],
      },
      expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 21);

    it('should validate complete valid request', () => {
      const result = validateEnhancedSwapRequest(validRequest, eventDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate auction request with settings', () => {
      const auctionRequest: EnhancedCreateSwapRequest = {
        ...validRequest,
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
        auctionSettings: {
          endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          allowBookingProposals: true,
          allowCashProposals: true,
          minimumCashOffer: 200,
          autoSelectAfterHours: 24,
        },
      };

      const result = validateEnhancedSwapRequest(auctionRequest, eventDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request with missing required fields', () => {
      const incompleteRequest = {
        ...validRequest,
        title: '', // Empty title
        description: '', // Empty description
      };

      const result = validateEnhancedSwapRequest(incompleteRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('Description is required');
    });

    it('should reject request with invalid payment types', () => {
      const invalidRequest = {
        ...validRequest,
        paymentTypes: {
          bookingExchange: false,
          cashPayment: false, // Neither enabled
        },
      };

      const result = validateEnhancedSwapRequest(invalidRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one payment type must be enabled');
    });

    it('should reject request with invalid acceptance strategy', () => {
      const invalidRequest = {
        ...validRequest,
        acceptanceStrategy: {
          type: 'auction',
          // Missing auctionEndDate
        },
      };

      const result = validateEnhancedSwapRequest(invalidRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction end date is required for auction strategy');
    });

    it('should reject request with expiration date in the past', () => {
      const invalidRequest = {
        ...validRequest,
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      };

      const result = validateEnhancedSwapRequest(invalidRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Expiration date must be in the future');
    });

    it('should reject auction request without auction settings', () => {
      const invalidRequest = {
        ...validRequest,
        acceptanceStrategy: {
          type: 'auction',
          auctionEndDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
        // Missing auctionSettings
      };

      const result = validateEnhancedSwapRequest(invalidRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Auction settings are required for auction strategy');
    });

    it('should accumulate multiple validation errors', () => {
      const multipleErrorsRequest = {
        ...validRequest,
        title: '', // Error 1
        paymentTypes: {
          bookingExchange: false,
          cashPayment: false, // Error 2
        },
        acceptanceStrategy: {
          type: 'auction',
          // Missing auctionEndDate - Error 3
        },
        expirationDate: new Date(Date.now() - 1000), // Error 4
      };

      const result = validateEnhancedSwapRequest(multipleErrorsRequest, eventDate);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('At least one payment type must be enabled');
      expect(result.errors).toContain('Auction end date is required for auction strategy');
      expect(result.errors).toContain('Expiration date must be in the future');
    });
  });
});