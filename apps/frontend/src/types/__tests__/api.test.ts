/**
 * Tests for API types and utility functions
 * 
 * This test suite verifies that all API types are correctly defined
 * and that utility functions work as expected for compatibility scoring
 * and type guards.
 */

import {
  EligibleSwapResponse,
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
  ApiErrorResponse,
  CompatibilityLevel,
  CompatibilityScore,
  isApiErrorResponse,
  isValidationError,
  isNetworkError,
  getCompatibilityLevel,
  getCompatibilityDisplayText,
  getCompatibilityStyleClass,
  createCompatibilityScore,
} from '../api';

describe('API Types', () => {
  describe('Type Guards', () => {
    describe('isApiErrorResponse', () => {
      it('should return true for valid API error response', () => {
        const errorResponse: ApiErrorResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid data',
            details: { field: ['error message'] },
          },
          timestamp: '2023-01-01T00:00:00Z',
          requestId: 'req_123',
        };

        expect(isApiErrorResponse(errorResponse)).toBe(true);
      });

      it('should return false for invalid API error response', () => {
        const invalidResponse = {
          error: {
            code: 'VALIDATION_ERROR',
            // missing message
          },
          timestamp: '2023-01-01T00:00:00Z',
          requestId: 'req_123',
        };

        expect(isApiErrorResponse(invalidResponse)).toBe(false);
      });

      it('should return false for non-object values', () => {
        expect(isApiErrorResponse(null)).toBe(false);
        expect(isApiErrorResponse(undefined)).toBe(false);
        expect(isApiErrorResponse('string')).toBe(false);
        expect(isApiErrorResponse(123)).toBe(false);
      });
    });

    describe('isValidationError', () => {
      it('should return true for valid validation error array', () => {
        const validationErrors = [
          {
            field: 'sourceSwapId',
            message: 'Required field',
            code: 'REQUIRED',
          },
          {
            field: 'conditions',
            message: 'At least one condition required',
            code: 'MIN_ITEMS',
          },
        ];

        expect(isValidationError(validationErrors)).toBe(true);
      });

      it('should return false for invalid validation error array', () => {
        const invalidErrors = [
          {
            field: 'sourceSwapId',
            // missing message and code
          },
        ];

        expect(isValidationError(invalidErrors)).toBe(false);
      });

      it('should return false for non-array values', () => {
        expect(isValidationError({})).toBe(false);
        expect(isValidationError('string')).toBe(false);
        expect(isValidationError(null)).toBe(false);
      });
    });

    describe('isNetworkError', () => {
      it('should return true for valid network error', () => {
        const networkError = {
          type: 'timeout' as const,
          message: 'Request timed out',
          retryable: true,
        };

        expect(isNetworkError(networkError)).toBe(true);
      });

      it('should return false for invalid network error', () => {
        const invalidError = {
          type: 'invalid_type',
          message: 'Some error',
          retryable: true,
        };

        expect(isNetworkError(invalidError)).toBe(false);
      });
    });
  });

  describe('Compatibility Scoring', () => {
    describe('getCompatibilityLevel', () => {
      it('should return correct levels for different scores', () => {
        expect(getCompatibilityLevel(95)).toBe('excellent');
        expect(getCompatibilityLevel(80)).toBe('excellent');
        expect(getCompatibilityLevel(75)).toBe('good');
        expect(getCompatibilityLevel(60)).toBe('good');
        expect(getCompatibilityLevel(50)).toBe('fair');
        expect(getCompatibilityLevel(40)).toBe('fair');
        expect(getCompatibilityLevel(30)).toBe('poor');
        expect(getCompatibilityLevel(0)).toBe('poor');
      });
    });

    describe('getCompatibilityDisplayText', () => {
      it('should return correct display text for different scores', () => {
        expect(getCompatibilityDisplayText(95)).toBe('95% - Excellent Match');
        expect(getCompatibilityDisplayText(75)).toBe('75% - Good Match');
        expect(getCompatibilityDisplayText(50)).toBe('50% - Fair Match');
        expect(getCompatibilityDisplayText(30)).toBe('30% - Poor Match');
      });
    });

    describe('getCompatibilityStyleClass', () => {
      it('should return correct CSS classes for different scores', () => {
        expect(getCompatibilityStyleClass(95)).toBe('compatibility-excellent');
        expect(getCompatibilityStyleClass(75)).toBe('compatibility-good');
        expect(getCompatibilityStyleClass(50)).toBe('compatibility-fair');
        expect(getCompatibilityStyleClass(30)).toBe('compatibility-poor');
      });
    });

    describe('createCompatibilityScore', () => {
      it('should create complete compatibility score object', () => {
        const score = createCompatibilityScore(85);

        expect(score).toEqual({
          value: 85,
          level: 'excellent',
          displayText: '85% - Excellent Match',
          styleClass: 'compatibility-excellent',
        });
      });

      it('should handle edge cases correctly', () => {
        const poorScore = createCompatibilityScore(25);
        expect(poorScore.level).toBe('poor');

        const excellentScore = createCompatibilityScore(100);
        expect(excellentScore.level).toBe('excellent');
      });
    });
  });

  describe('Interface Compliance', () => {
    it('should allow valid EligibleSwapResponse', () => {
      const response: EligibleSwapResponse = {
        swaps: [
          {
            id: 'swap_123',
            title: 'Beach House in Miami',
            bookingDetails: {
              location: 'Miami, FL',
              dateRange: {
                checkIn: new Date('2023-06-01'),
                checkOut: new Date('2023-06-07'),
              },
              accommodationType: 'House',
              guests: 4,
              estimatedValue: 1200,
            },
            compatibilityScore: 85,
            eligibilityReasons: ['Similar location', 'Matching dates'],
            isEligible: true,
            restrictions: ['No pets'],
          },
        ],
        totalCount: 1,
        compatibilityThreshold: 60,
      };

      expect(response.swaps).toHaveLength(1);
      expect(response.swaps[0].compatibilityScore).toBe(85);
    });

    it('should allow valid CreateProposalRequest', () => {
      const request: CreateProposalRequest = {
        sourceSwapId: 'swap_456',
        message: 'I would love to swap with you!',
        conditions: ['Flexible check-in time', 'Pet-friendly'],
        agreedToTerms: true,
      };

      expect(request.sourceSwapId).toBe('swap_456');
      expect(request.conditions).toHaveLength(2);
      expect(request.agreedToTerms).toBe(true);
    });

    it('should allow valid ProposalResponse', () => {
      const response: ProposalResponse = {
        proposalId: 'proposal_789',
        status: 'pending',
        estimatedResponseTime: '2-3 business days',
      };

      expect(response.status).toBe('pending');
      expect(response.proposalId).toBe('proposal_789');
    });

    it('should allow valid CompatibilityAnalysis', () => {
      const analysis: CompatibilityAnalysis = {
        score: 75,
        reasons: ['Similar accommodation type', 'Overlapping dates'],
        isEligible: true,
        restrictions: ['Must be verified user'],
      };

      expect(analysis.score).toBe(75);
      expect(analysis.isEligible).toBe(true);
    });
  });
});