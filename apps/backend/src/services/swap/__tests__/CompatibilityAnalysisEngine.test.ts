import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CompatibilityAnalysisEngine, SwapBookingDetails } from '../CompatibilityAnalysisEngine';
import { CompatibilityAnalysis } from '@booking-swap/shared';

// Mock logger
vi.mock('../../../utils/logger');

describe('CompatibilityAnalysisEngine', () => {
  let engine: CompatibilityAnalysisEngine;

  const mockSourceBooking: SwapBookingDetails = {
    location: 'Paris, France',
    dateRange: {
      checkIn: new Date('2024-06-01'),
      checkOut: new Date('2024-06-05')
    },
    totalPrice: 500,
    accommodationType: 'hotel',
    guests: 2
  };

  const mockTargetBooking: SwapBookingDetails = {
    location: 'London, UK',
    dateRange: {
      checkIn: new Date('2024-06-10'),
      checkOut: new Date('2024-06-15')
    },
    totalPrice: 600,
    accommodationType: 'hotel',
    guests: 2
  };

  beforeEach(() => {
    engine = new CompatibilityAnalysisEngine();
  });

  describe('analyzeCompatibility', () => {
    it('should return comprehensive compatibility analysis', async () => {
      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Assert
      expect(result).toHaveProperty('overallScore');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      
      expect(result).toHaveProperty('factors');
      expect(result.factors).toHaveProperty('locationCompatibility');
      expect(result.factors).toHaveProperty('dateCompatibility');
      expect(result.factors).toHaveProperty('valueCompatibility');
      expect(result.factors).toHaveProperty('accommodationCompatibility');
      expect(result.factors).toHaveProperty('guestCompatibility');
      
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
      
      expect(result).toHaveProperty('potentialIssues');
      expect(Array.isArray(result.potentialIssues)).toBe(true);

      // Check factor structure
      Object.values(result.factors).forEach(factor => {
        expect(factor).toHaveProperty('score');
        expect(factor).toHaveProperty('weight');
        expect(factor).toHaveProperty('details');
        expect(factor).toHaveProperty('status');
        expect(factor.score).toBeGreaterThanOrEqual(0);
        expect(factor.score).toBeLessThanOrEqual(100);
        expect(['excellent', 'good', 'fair', 'poor']).toContain(factor.status);
      });
    });

    it('should handle custom weights correctly', async () => {
      // Arrange
      const customWeights = {
        location: 0.5,
        date: 0.2,
        value: 0.1,
        accommodation: 0.1,
        guest: 0.1
      };
      const customEngine = new CompatibilityAnalysisEngine(customWeights);

      // Act
      const result = await customEngine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Assert
      expect(result.factors.locationCompatibility.weight).toBe(0.5);
      expect(result.factors.dateCompatibility.weight).toBe(0.2);
      expect(result.factors.valueCompatibility.weight).toBe(0.1);
    });

    it('should handle missing or invalid data gracefully', async () => {
      // Arrange
      const incompleteBooking: SwapBookingDetails = {
        location: '',
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        },
        totalPrice: 0,
        accommodationType: '',
        guests: 0
      };

      // Act
      const result = await engine.analyzeCompatibility(incompleteBooking, mockTargetBooking);

      // Assert
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      // Should still return valid analysis even with incomplete data
    });
  });

  describe('Location Compatibility', () => {
    it('should give high score for exact location match', async () => {
      // Arrange
      const sameLocationBooking = { ...mockTargetBooking, location: 'Paris, France' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, sameLocationBooking);

      // Assert
      expect(result.factors.locationCompatibility.score).toBeGreaterThan(90);
      expect(result.factors.locationCompatibility.status).toBe('excellent');
    });

    it('should give moderate score for same country', async () => {
      // Arrange
      const sameCountryBooking = { ...mockTargetBooking, location: 'Lyon, France' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, sameCountryBooking);

      // Assert
      expect(result.factors.locationCompatibility.score).toBeGreaterThan(50);
      expect(result.factors.locationCompatibility.score).toBeLessThan(90);
    });

    it('should give lower score for different continents', async () => {
      // Arrange
      const differentContinentBooking = { ...mockTargetBooking, location: 'Tokyo, Japan' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, differentContinentBooking);

      // Assert
      expect(result.factors.locationCompatibility.score).toBeLessThan(50);
    });

    it('should handle empty locations', async () => {
      // Arrange
      const emptyLocationBooking = { ...mockTargetBooking, location: '' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, emptyLocationBooking);

      // Assert
      expect(result.factors.locationCompatibility.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.locationCompatibility.score).toBeLessThanOrEqual(100);
    });
  });

  describe('Date Compatibility', () => {
    it('should give high score for same duration', async () => {
      // Arrange - both bookings are 4 days
      const sameDurationBooking = {
        ...mockTargetBooking,
        dateRange: {
          checkIn: new Date('2024-07-01'),
          checkOut: new Date('2024-07-05') // Same 4-day duration
        }
      };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, sameDurationBooking);

      // Assert
      expect(result.factors.dateCompatibility.score).toBeGreaterThan(90);
      expect(result.factors.dateCompatibility.status).toBe('excellent');
    });

    it('should penalize overlapping dates', async () => {
      // Arrange - overlapping dates
      const overlappingBooking = {
        ...mockTargetBooking,
        dateRange: {
          checkIn: new Date('2024-06-03'), // Overlaps with source booking
          checkOut: new Date('2024-06-07')
        }
      };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, overlappingBooking);

      // Assert
      expect(result.factors.dateCompatibility.score).toBeLessThan(50);
      expect(result.factors.dateCompatibility.status).toBe('poor');
    });

    it('should handle very different durations', async () => {
      // Arrange - very different duration (14 days vs 4 days)
      const longDurationBooking = {
        ...mockTargetBooking,
        dateRange: {
          checkIn: new Date('2024-07-01'),
          checkOut: new Date('2024-07-15') // 14 days vs 4 days
        }
      };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, longDurationBooking);

      // Assert
      expect(result.factors.dateCompatibility.score).toBeLessThan(70);
    });

    it('should apply seasonal compatibility bonus', async () => {
      // Arrange - same season (both in summer)
      const sameSeason1 = {
        ...mockSourceBooking,
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        }
      };
      const sameSeason2 = {
        ...mockTargetBooking,
        dateRange: {
          checkIn: new Date('2024-07-01'),
          checkOut: new Date('2024-07-05')
        }
      };

      // Act
      const result = await engine.analyzeCompatibility(sameSeason1, sameSeason2);

      // Assert
      // Should have some seasonal bonus applied
      expect(result.factors.dateCompatibility.score).toBeGreaterThan(0);
    });
  });

  describe('Value Compatibility', () => {
    it('should give high score for similar values', async () => {
      // Arrange - very similar values
      const similarValueBooking = { ...mockTargetBooking, totalPrice: 510 }; // vs 500

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, similarValueBooking);

      // Assert
      expect(result.factors.valueCompatibility.score).toBeGreaterThan(90);
      expect(result.factors.valueCompatibility.status).toBe('excellent');
    });

    it('should give lower score for very different values', async () => {
      // Arrange - very different values
      const differentValueBooking = { ...mockTargetBooking, totalPrice: 1500 }; // vs 500

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, differentValueBooking);

      // Assert
      expect(result.factors.valueCompatibility.score).toBeLessThan(50);
      expect(result.factors.valueCompatibility.status).toBe('poor');
    });

    it('should handle zero values', async () => {
      // Arrange
      const zeroValueBooking = { ...mockTargetBooking, totalPrice: 0 };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, zeroValueBooking);

      // Assert
      expect(result.factors.valueCompatibility.score).toBe(50); // Default score
      expect(result.factors.valueCompatibility.status).toBe('fair');
    });

    it('should calculate percentage difference correctly', async () => {
      // Arrange - 20% difference (500 vs 600)
      const result = await engine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Assert
      expect(result.factors.valueCompatibility.score).toBeGreaterThan(60);
      expect(result.factors.valueCompatibility.score).toBeLessThan(90);
    });
  });

  describe('Accommodation Compatibility', () => {
    it('should give perfect score for identical accommodation types', async () => {
      // Arrange - both are hotels
      const result = await engine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Assert
      expect(result.factors.accommodationCompatibility.score).toBe(100);
      expect(result.factors.accommodationCompatibility.status).toBe('excellent');
    });

    it('should give good score for similar accommodation types', async () => {
      // Arrange - hotel vs resort (similar)
      const resortBooking = { ...mockTargetBooking, accommodationType: 'resort' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, resortBooking);

      // Assert
      expect(result.factors.accommodationCompatibility.score).toBeGreaterThan(60);
      expect(result.factors.accommodationCompatibility.score).toBeLessThan(100);
    });

    it('should give lower score for very different accommodation types', async () => {
      // Arrange - hotel vs hostel (different)
      const hostelBooking = { ...mockTargetBooking, accommodationType: 'hostel' };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, hostelBooking);

      // Assert
      expect(result.factors.accommodationCompatibility.score).toBeLessThan(60);
    });

    it('should normalize accommodation types correctly', async () => {
      // Arrange - test various accommodation type variations
      const testCases = [
        { type: 'Hotel', expected: 'hotel' },
        { type: 'APARTMENT', expected: 'apartment' },
        { type: 'Bed and Breakfast', expected: 'guesthouse' },
        { type: 'B&B', expected: 'guesthouse' }
      ];

      for (const testCase of testCases) {
        const booking = { ...mockTargetBooking, accommodationType: testCase.type };
        const result = await engine.analyzeCompatibility(mockSourceBooking, booking);
        
        // Should handle normalization without errors
        expect(result.factors.accommodationCompatibility.score).toBeGreaterThanOrEqual(0);
        expect(result.factors.accommodationCompatibility.score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Guest Compatibility', () => {
    it('should give perfect score for same guest count', async () => {
      // Arrange - both have 2 guests
      const result = await engine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Assert
      expect(result.factors.guestCompatibility.score).toBe(100);
      expect(result.factors.guestCompatibility.status).toBe('excellent');
    });

    it('should give good score for similar guest counts', async () => {
      // Arrange - 2 vs 3 guests
      const similarGuestBooking = { ...mockTargetBooking, guests: 3 };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, similarGuestBooking);

      // Assert
      expect(result.factors.guestCompatibility.score).toBeGreaterThan(70);
      expect(result.factors.guestCompatibility.status).toBe('good');
    });

    it('should give lower score for very different guest counts', async () => {
      // Arrange - 2 vs 8 guests
      const differentGuestBooking = { ...mockTargetBooking, guests: 8 };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, differentGuestBooking);

      // Assert
      expect(result.factors.guestCompatibility.score).toBeLessThan(50);
    });

    it('should handle zero or missing guest counts', async () => {
      // Arrange
      const zeroGuestBooking = { ...mockTargetBooking, guests: 0 };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, zeroGuestBooking);

      // Assert
      // Should default to 1 guest and calculate accordingly
      expect(result.factors.guestCompatibility.score).toBeGreaterThanOrEqual(0);
      expect(result.factors.guestCompatibility.score).toBeLessThanOrEqual(100);
    });

    it('should apply capacity utilization adjustments', async () => {
      // Arrange - test capacity utilization bonus/penalty
      const highCapacityBooking = { ...mockTargetBooking, guests: 10 };
      const lowCapacityBooking = { ...mockSourceBooking, guests: 1 };

      // Act
      const result = await engine.analyzeCompatibility(lowCapacityBooking, highCapacityBooking);

      // Assert
      // Should apply capacity mismatch penalty
      expect(result.factors.guestCompatibility.score).toBeLessThan(50);
    });
  });

  describe('Overall Score Calculation', () => {
    it('should calculate weighted overall score correctly', async () => {
      // Arrange
      const result = await engine.analyzeCompatibility(mockSourceBooking, mockTargetBooking);

      // Act
      const manualCalculation = 
        (result.factors.locationCompatibility.score * result.factors.locationCompatibility.weight) +
        (result.factors.dateCompatibility.score * result.factors.dateCompatibility.weight) +
        (result.factors.valueCompatibility.score * result.factors.valueCompatibility.weight) +
        (result.factors.accommodationCompatibility.score * result.factors.accommodationCompatibility.weight) +
        (result.factors.guestCompatibility.score * result.factors.guestCompatibility.weight);

      // Assert
      expect(result.overallScore).toBe(Math.round(manualCalculation));
    });

    it('should ensure overall score is within valid range', async () => {
      // Test with extreme values
      const extremeBooking1: SwapBookingDetails = {
        location: '',
        dateRange: {
          checkIn: new Date('2024-01-01'),
          checkOut: new Date('2024-01-02')
        },
        totalPrice: 1,
        accommodationType: 'unknown',
        guests: 1
      };

      const extremeBooking2: SwapBookingDetails = {
        location: 'Completely Different Location, Mars',
        dateRange: {
          checkIn: new Date('2024-12-01'),
          checkOut: new Date('2024-12-31')
        },
        totalPrice: 10000,
        accommodationType: 'spaceship',
        guests: 100
      };

      // Act
      const result = await engine.analyzeCompatibility(extremeBooking1, extremeBooking2);

      // Assert
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Recommendations and Issues', () => {
    it('should generate appropriate recommendations for high compatibility', async () => {
      // Arrange - create high compatibility scenario
      const highCompatibilityBooking = {
        ...mockSourceBooking,
        location: mockTargetBooking.location, // Same location
        totalPrice: mockTargetBooking.totalPrice, // Same price
        accommodationType: mockTargetBooking.accommodationType, // Same type
        guests: mockTargetBooking.guests // Same guests
      };

      // Act
      const result = await engine.analyzeCompatibility(highCompatibilityBooking, mockTargetBooking);

      // Assert
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => rec.includes('excellent') || rec.includes('highly recommended'))).toBe(true);
      expect(result.potentialIssues.length).toBe(0);
    });

    it('should identify potential issues for low compatibility', async () => {
      // Arrange - create low compatibility scenario
      const lowCompatibilityBooking: SwapBookingDetails = {
        location: 'Tokyo, Japan', // Different continent
        dateRange: {
          checkIn: new Date('2024-06-03'), // Overlapping dates
          checkOut: new Date('2024-06-20') // Very different duration
        },
        totalPrice: 2000, // Very different price
        accommodationType: 'hostel', // Different type
        guests: 10 // Very different guest count
      };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, lowCompatibilityBooking);

      // Assert
      expect(result.potentialIssues.length).toBeGreaterThan(0);
      expect(result.recommendations.some(rec => rec.includes('consider') || rec.includes('discuss'))).toBe(true);
    });

    it('should provide specific recommendations based on factor scores', async () => {
      // Arrange - scenario with mixed compatibility
      const mixedCompatibilityBooking = {
        ...mockTargetBooking,
        totalPrice: 1500, // Poor value compatibility
        location: 'London, UK' // Good location compatibility
      };

      // Act
      const result = await engine.analyzeCompatibility(mockSourceBooking, mixedCompatibilityBooking);

      // Assert
      expect(result.recommendations.length).toBeGreaterThan(0);
      // Should have recommendations about value differences
      expect(result.recommendations.some(rec => 
        rec.includes('value') || rec.includes('payment') || rec.includes('additional')
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid date ranges gracefully', async () => {
      // Arrange - invalid date range
      const invalidDateBooking = {
        ...mockTargetBooking,
        dateRange: {
          checkIn: new Date('2024-06-10'),
          checkOut: new Date('2024-06-05') // Check-out before check-in
        }
      };

      // Act & Assert
      // Should not throw error, but handle gracefully
      const result = await engine.analyzeCompatibility(mockSourceBooking, invalidDateBooking);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle null or undefined values gracefully', async () => {
      // Arrange
      const nullValueBooking = {
        location: null as any,
        dateRange: {
          checkIn: new Date('2024-06-01'),
          checkOut: new Date('2024-06-05')
        },
        totalPrice: null as any,
        accommodationType: undefined as any,
        guests: null as any
      };

      // Act & Assert
      // Should not throw error
      const result = await engine.analyzeCompatibility(mockSourceBooking, nullValueBooking);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });
  });
});