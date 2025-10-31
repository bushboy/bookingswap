/**
 * Tests for enhanced validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateBookingEditWithGuidance,
  validateBookingEditUpdateWithGuidance,
  validateSwapSpecificationWithGuidance,
  validateSwapSpecificationUpdateWithGuidance,
  validateMultipleBookingEdits,
  validateMultipleSwapSpecifications,
} from '../enhanced-validation';
import { BookingEditData } from '../../types/booking-edit';
import { SwapSpecificationData } from '../../types/swap-specification';

describe('Enhanced Validation', () => {
  describe('validateBookingEditWithGuidance', () => {
    const validBookingData: BookingEditData = {
      type: 'hotel',
      title: 'Luxury Hotel Stay in Paris',
      description: 'Beautiful 5-star hotel in the heart of Paris with amazing views and excellent service.',
      location: {
        city: 'Paris',
        country: 'France',
        address: '123 Champs-Élysées',
        coordinates: { lat: 48.8566, lng: 2.3522 },
      },
      dateRange: {
        checkIn: new Date('2024-12-01'),
        checkOut: new Date('2024-12-05'),
      },
      originalPrice: 1200,
      swapValue: 1000,
      providerDetails: {
        provider: 'Booking.com',
        confirmationNumber: 'BK123456789',
        bookingReference: 'REF-ABC-123',
        contactInfo: 'support@booking.com',
      },
    };

    it('should validate correct booking data successfully', () => {
      const result = validateBookingEditWithGuidance(validBookingData);

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
      expect(result.guidance).toHaveLength(0);
      expect(result.recoveryPlan).toBeUndefined();
    });

    it('should provide guidance for invalid booking data', () => {
      const invalidData: BookingEditData = {
        ...validBookingData,
        title: '', // Invalid: empty title
        originalPrice: -100, // Invalid: negative price
      };

      const result = validateBookingEditWithGuidance(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.title).toBeDefined();
      expect(result.errors.originalPrice).toBeDefined();
      expect(result.guidance.length).toBeGreaterThan(0);
      expect(result.recoveryPlan).toBeDefined();
      expect(result.recoveryPlan?.primaryStrategy.strategy).toBe('fix_and_retry');
    });

    it('should generate warnings for potentially problematic data', () => {
      const problematicData: BookingEditData = {
        ...validBookingData,
        title: 'Short', // Too short
        description: 'Brief', // Too brief
        swapValue: 2500, // Much higher than original price
      };

      const result = validateBookingEditWithGuidance(problematicData);

      expect(result.isValid).toBe(true); // Still valid, but has warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('descriptive title'))).toBe(true);
      expect(result.warnings.some(w => w.includes('detailed description'))).toBe(true);
      expect(result.warnings.some(w => w.includes('significantly higher'))).toBe(true);
    });

    it('should skip warnings when requested', () => {
      const problematicData: BookingEditData = {
        ...validBookingData,
        title: 'Short',
        description: 'Brief',
      };

      const result = validateBookingEditWithGuidance(problematicData, { skipWarnings: true });

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateSwapSpecificationWithGuidance', () => {
    const validSwapData: SwapSpecificationData = {
      bookingId: 'booking-123',
      paymentTypes: ['booking', 'cash'],
      minCashAmount: 100,
      maxCashAmount: 500,
      acceptanceStrategy: 'first_match',
      swapConditions: ['No smoking', 'Pet-friendly'],
      swapEnabled: true,
    };

    it('should validate correct swap specification successfully', () => {
      const result = validateSwapSpecificationWithGuidance(validSwapData);

      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
      expect(result.guidance).toHaveLength(0);
      expect(result.recoveryPlan).toBeUndefined();
    });

    it('should provide guidance for invalid swap specification', () => {
      const invalidData: SwapSpecificationData = {
        ...validSwapData,
        paymentTypes: [], // Invalid: empty payment types
        minCashAmount: -50, // Invalid: negative amount
        swapConditions: [], // Invalid: empty conditions
      };

      const result = validateSwapSpecificationWithGuidance(invalidData);

      expect(result.isValid).toBe(false);
      expect(result.errors.paymentTypes).toBeDefined();
      expect(result.errors.minCashAmount).toBeDefined();
      expect(result.errors.swapConditions).toBeDefined();
      expect(result.guidance.length).toBeGreaterThan(0);
      expect(result.recoveryPlan).toBeDefined();
      expect(result.recoveryPlan?.primaryStrategy.strategy).toBe('fix_and_retry');
    });

    it('should validate wallet requirements when context provided', () => {
      const result = validateSwapSpecificationWithGuidance(validSwapData, {
        walletConnected: false,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.walletConnection).toBeDefined();
      expect(result.guidance.some(g => g.includes('wallet'))).toBe(true);
    });

    it('should generate warnings for potentially problematic configurations', () => {
      const problematicData: SwapSpecificationData = {
        ...validSwapData,
        minCashAmount: 10, // Very low
        maxCashAmount: 15000, // Very high
        swapConditions: Array(15).fill('Condition'), // Too many conditions
      };

      const result = validateSwapSpecificationWithGuidance(problematicData);

      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('low minimum cash'))).toBe(true);
      expect(result.warnings.some(w => w.includes('high maximum cash'))).toBe(true);
      expect(result.warnings.some(w => w.includes('Too many conditions'))).toBe(true);
    });

    it('should validate auction-specific requirements', () => {
      const auctionData: SwapSpecificationData = {
        ...validSwapData,
        acceptanceStrategy: 'auction',
        auctionEndDate: new Date('2024-01-01'), // Past date
      };

      const result = validateSwapSpecificationWithGuidance(auctionData);

      expect(result.isValid).toBe(false);
      expect(result.errors.auctionEndDate).toBeDefined();
    });
  });

  describe('validateMultipleBookingEdits', () => {
    it('should validate multiple bookings and aggregate results', () => {
      const bookings: BookingEditData[] = [
        {
          type: 'hotel',
          title: 'Valid Booking 1',
          description: 'This is a valid booking with proper description.',
          location: { city: 'Paris', country: 'France', address: '123 Street', coordinates: { lat: 48.8566, lng: 2.3522 } },
          dateRange: { checkIn: new Date('2024-12-01'), checkOut: new Date('2024-12-05') },
          originalPrice: 1000,
          swapValue: 900,
          providerDetails: { provider: 'Test', confirmationNumber: '123', bookingReference: 'REF123', contactInfo: 'test@test.com' },
        },
        {
          type: 'hotel',
          title: '', // Invalid
          description: 'Valid description for second booking.',
          location: { city: 'London', country: 'UK', address: '456 Street', coordinates: { lat: 51.5074, lng: -0.1278 } },
          dateRange: { checkIn: new Date('2024-12-01'), checkOut: new Date('2024-12-05') },
          originalPrice: -500, // Invalid
          swapValue: 800,
          providerDetails: { provider: 'Test', confirmationNumber: '456', bookingReference: 'REF456', contactInfo: 'test@test.com' },
        },
      ];

      const result = validateMultipleBookingEdits(bookings);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBeUndefined(); // First booking is valid
      expect(result.errors[1]).toBeDefined(); // Second booking has errors
      expect(result.errors[1].title).toBeDefined();
      expect(result.errors[1].originalPrice).toBeDefined();
      expect(result.guidance.some(g => g.includes('Booking 2'))).toBe(true);
    });
  });

  describe('validateMultipleSwapSpecifications', () => {
    it('should validate multiple swap specifications and aggregate results', () => {
      const swapSpecs: SwapSpecificationData[] = [
        {
          bookingId: 'booking-1',
          paymentTypes: ['booking'],
          acceptanceStrategy: 'first_match',
          swapConditions: ['No smoking'],
          swapEnabled: true,
        },
        {
          bookingId: 'booking-2',
          paymentTypes: [], // Invalid
          acceptanceStrategy: 'first_match',
          swapConditions: [], // Invalid
          swapEnabled: true,
        },
      ];

      const result = validateMultipleSwapSpecifications(swapSpecs);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toBeUndefined(); // First spec is valid
      expect(result.errors[1]).toBeDefined(); // Second spec has errors
      expect(result.errors[1].paymentTypes).toBeDefined();
      expect(result.errors[1].swapConditions).toBeDefined();
      expect(result.guidance.some(g => g.includes('Swap 2'))).toBe(true);
    });
  });
});