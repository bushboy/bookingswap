/**
 * Type verification script to ensure all API types work correctly
 * This file is used to verify that our types compile and work as expected
 */

import {
  EligibleSwapResponse,
  EligibleSwap,
  CreateProposalRequest,
  ProposalResponse,
  CompatibilityAnalysis,
  ApiErrorResponse,
  getCompatibilityLevel,
  createCompatibilityScore,
  isApiErrorResponse,
} from '../api';

import {
  validateProposalRequest,
  DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
  ValidationContext,
} from '../validation';

// Test that all interfaces can be properly instantiated
const testEligibleSwapResponse: EligibleSwapResponse = {
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

const testCreateProposalRequest: CreateProposalRequest = {
  sourceSwapId: 'swap_456',
  message: 'I would love to swap with you!',
  conditions: ['Flexible check-in time', 'Pet-friendly'],
  agreedToTerms: true,
};

const testProposalResponse: ProposalResponse = {
  proposalId: 'proposal_789',
  status: 'pending',
  estimatedResponseTime: '2-3 business days',
};

const testCompatibilityAnalysis: CompatibilityAnalysis = {
  score: 75,
  reasons: ['Similar accommodation type', 'Overlapping dates'],
  isEligible: true,
  restrictions: ['Must be verified user'],
};

const testApiErrorResponse: ApiErrorResponse = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid data',
    details: { field: ['error message'] },
  },
  timestamp: '2023-01-01T00:00:00Z',
  requestId: 'req_123',
};

// Test utility functions
const compatibilityLevel = getCompatibilityLevel(85);
const compatibilityScore = createCompatibilityScore(85);
const isError = isApiErrorResponse(testApiErrorResponse);

// Test validation functions
const validationResult = validateProposalRequest(testCreateProposalRequest);
const validationContext: ValidationContext = {
  userId: 'user_123',
  targetSwapId: 'target_456',
  existingProposals: [],
  userPermissions: ['create_proposal'],
};

const contextualValidation = validateProposalRequest(
  testCreateProposalRequest,
  DEFAULT_PROPOSAL_VALIDATION_SCHEMA,
  validationContext
);

// Export a verification function that can be called to ensure types work
export function verifyTypes(): boolean {
  // Basic type checks
  const hasSwaps = testEligibleSwapResponse.swaps.length > 0;
  const hasProposalId = testProposalResponse.proposalId.length > 0;
  const hasCompatibilityScore = testCompatibilityAnalysis.score > 0;
  const hasErrorCode = testApiErrorResponse.error.code.length > 0;
  
  // Utility function checks
  const levelIsCorrect = compatibilityLevel === 'excellent';
  const scoreIsCorrect = compatibilityScore.level === 'excellent';
  const errorDetectionWorks = isError === true;
  
  // Validation checks
  const validationWorks = validationResult.isValid === true;
  const contextualValidationWorks = contextualValidation.isValid === true;
  
  return (
    hasSwaps &&
    hasProposalId &&
    hasCompatibilityScore &&
    hasErrorCode &&
    levelIsCorrect &&
    scoreIsCorrect &&
    errorDetectionWorks &&
    validationWorks &&
    contextualValidationWorks
  );
}

// Log verification result
console.log('Type verification result:', verifyTypes());