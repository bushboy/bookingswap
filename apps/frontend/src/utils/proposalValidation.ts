import {
  CreateProposalFromBrowseRequest,
  ProposalFormData,
  EligibleSwap,
  ValidationResult,
  CompatibilityAnalysis,
  SwapWithProposalInfo
} from '@booking-swap/shared';

// Validation error types for proposals
export interface ProposalValidationErrors {
  selectedSwapId?: string;
  message?: string;
  conditions?: string;
  agreedToTerms?: string;
  eligibility?: string;
  compatibility?: string;
  general?: string;
}

// Real-time eligibility check results
export interface EligibilityCheckResult {
  isEligible: boolean;
  reasons: string[];
  warnings: string[];
  canProceed: boolean;
  eligibleSwapsCount: number;
}

// Compatibility threshold configuration
export const COMPATIBILITY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
  POOR: 0,
  MINIMUM_RECOMMENDED: 40,
  WARNING_THRESHOLD: 30
} as const;

// Validation rules configuration
export const VALIDATION_RULES = {
  MESSAGE_MAX_LENGTH: 500,
  MESSAGE_MIN_LENGTH: 0,
  CONDITIONS_MAX_COUNT: 10,
  CONDITION_MAX_LENGTH: 200,
  MINIMUM_COMPATIBILITY_SCORE: 20
} as const;

/**
 * Validates proposal form data in real-time
 */
export const validateProposalForm = (
  formData: ProposalFormData,
  eligibleSwaps: EligibleSwap[],
  targetSwap: SwapWithProposalInfo,
  compatibility?: CompatibilityAnalysis
): ProposalValidationErrors => {
  const errors: ProposalValidationErrors = {};

  // Validate swap selection
  if (!formData.selectedSwapId) {
    errors.selectedSwapId = 'Please select one of your swaps to propose';
  } else {
    const selectedSwap = eligibleSwaps.find(swap => swap.id === formData.selectedSwapId);
    if (!selectedSwap) {
      errors.selectedSwapId = 'Selected swap is no longer available';
    } else if (!selectedSwap.isCompatible && selectedSwap.compatibilityScore !== undefined) {
      if (selectedSwap.compatibilityScore < COMPATIBILITY_THRESHOLDS.MINIMUM_RECOMMENDED) {
        errors.selectedSwapId = `This swap has low compatibility (${selectedSwap.compatibilityScore}%). Consider selecting a more compatible option.`;
      }
    }
  }

  // Validate message
  if (formData.message) {
    if (formData.message.length > VALIDATION_RULES.MESSAGE_MAX_LENGTH) {
      errors.message = `Message must be ${VALIDATION_RULES.MESSAGE_MAX_LENGTH} characters or less (currently ${formData.message.length})`;
    }
    
    // Check for inappropriate content patterns
    const inappropriatePatterns = [
      /\b(contact|email|phone|call|text)\s*(me|us)\b/i,
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
    ];
    
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(formData.message)) {
        errors.message = 'Please avoid sharing personal contact information in messages. Use the platform\'s messaging system instead.';
        break;
      }
    }
  }

  // Validate conditions
  if (formData.conditions.length > VALIDATION_RULES.CONDITIONS_MAX_COUNT) {
    errors.conditions = `Too many conditions (maximum ${VALIDATION_RULES.CONDITIONS_MAX_COUNT})`;
  }

  for (const condition of formData.conditions) {
    if (condition.length > VALIDATION_RULES.CONDITION_MAX_LENGTH) {
      errors.conditions = `Each condition must be ${VALIDATION_RULES.CONDITION_MAX_LENGTH} characters or less`;
      break;
    }
  }

  // Validate terms agreement
  if (!formData.agreedToTerms) {
    errors.agreedToTerms = 'You must agree to the terms and conditions to proceed';
  }

  // Validate compatibility if available
  if (compatibility && compatibility.overallScore < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
    errors.compatibility = `Low compatibility score (${compatibility.overallScore}%). This proposal may have a lower chance of acceptance.`;
  }

  return errors;
};

/**
 * Validates the complete proposal request before submission
 */
export const validateProposalRequest = (
  request: CreateProposalFromBrowseRequest,
  eligibleSwaps: EligibleSwap[],
  targetSwap: SwapWithProposalInfo
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic field validation
  if (!request.targetSwapId) {
    errors.push('Target swap ID is required');
  }

  if (!request.sourceSwapId) {
    errors.push('Source swap ID is required');
  }

  if (!request.proposerId) {
    errors.push('Proposer ID is required');
  }

  if (!request.agreedToTerms) {
    errors.push('Terms and conditions must be accepted');
  }

  // Validate source swap eligibility
  const sourceSwap = eligibleSwaps.find(swap => swap.id === request.sourceSwapId);
  if (!sourceSwap) {
    errors.push('Selected swap is not eligible or no longer available');
  } else {
    // Check compatibility warnings
    if (sourceSwap.compatibilityScore !== undefined) {
      if (sourceSwap.compatibilityScore < COMPATIBILITY_THRESHOLDS.FAIR) {
        warnings.push(`Low compatibility score (${sourceSwap.compatibilityScore}%)`);
      }
      if (sourceSwap.compatibilityScore < COMPATIBILITY_THRESHOLDS.MINIMUM_RECOMMENDED) {
        warnings.push('This proposal may have a lower chance of acceptance due to compatibility');
      }
    }
  }

  // Validate message content
  if (request.message) {
    if (request.message.length > VALIDATION_RULES.MESSAGE_MAX_LENGTH) {
      errors.push(`Message exceeds maximum length of ${VALIDATION_RULES.MESSAGE_MAX_LENGTH} characters`);
    }
  }

  // Validate conditions
  if (request.conditions.length > VALIDATION_RULES.CONDITIONS_MAX_COUNT) {
    errors.push(`Too many conditions (maximum ${VALIDATION_RULES.CONDITIONS_MAX_COUNT})`);
  }

  const allowedStatuses = new Set(['active', 'available', 'open', 'pending', 'listed']);
  const sourceStatus: any = (sourceSwap as any)?.status;
  const targetStatus: any = (targetSwap as any)?.status ?? (targetSwap as any)?.sourceBooking?.status;

  const eligibilityChecks = {
    userOwnsSourceSwap: !!sourceSwap,
    // Consider swap available if status is one of allowed values or missing (optimistic UI)
    sourceSwapAvailable: !!sourceSwap && (sourceStatus == null || allowedStatuses.has(String(sourceStatus).toLowerCase())),
    targetSwapAvailable: targetStatus == null || allowedStatuses.has(String(targetStatus).toLowerCase()),
    noExistingProposal: true, // This would be checked by backend
    swapsAreCompatible: !sourceSwap || !sourceSwap.compatibilityScore || sourceSwap.compatibilityScore >= COMPATIBILITY_THRESHOLDS.MINIMUM_RECOMMENDED
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    eligibilityChecks
  };
};

/**
 * Performs real-time eligibility checking for proposal creation
 */
export const checkProposalEligibility = (
  userId: string,
  targetSwap: SwapWithProposalInfo,
  eligibleSwaps: EligibleSwap[]
): EligibilityCheckResult => {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let isEligible = true;

  // Check if user has any eligible swaps
  if (eligibleSwaps.length === 0) {
    isEligible = false;
    reasons.push('You don\'t have any eligible swaps to propose');
    reasons.push('Create a new swap or ensure your existing swaps are active');
  }

  // Check target swap availability (more permissive)
  const allowedStatuses = new Set(['active', 'available', 'open', 'pending', 'listed']);
  const targetStatus: any = (targetSwap as any)?.status ?? (targetSwap as any)?.sourceBooking?.status;
  if (!(targetStatus == null || allowedStatuses.has(String(targetStatus).toLowerCase()))) {
    isEligible = false;
    reasons.push('This swap is no longer available for proposals');
  }

  // Check if user owns the target swap
  if (targetSwap.userId === userId) {
    isEligible = false;
    reasons.push('You cannot make a proposal to your own swap');
  }

  // Check compatibility warnings
  const lowCompatibilitySwaps = eligibleSwaps.filter(
    swap => swap.compatibilityScore !== undefined && 
    swap.compatibilityScore < COMPATIBILITY_THRESHOLDS.FAIR
  );

  if (lowCompatibilitySwaps.length === eligibleSwaps.length && eligibleSwaps.length > 0) {
    warnings.push('All your eligible swaps have low compatibility with this swap');
    warnings.push('Consider the compatibility factors before proceeding');
  }

  // Check for high-value differences
  const targetValue = (targetSwap as any).estimatedValue || 0;
  const significantValueDifferences = eligibleSwaps.filter(swap => {
    const valueDiff = Math.abs(swap.bookingDetails.estimatedValue - targetValue);
    const percentDiff = valueDiff / Math.max(targetValue, swap.bookingDetails.estimatedValue);
    return percentDiff > 0.5; // 50% difference
  });

  if (significantValueDifferences.length > 0) {
    warnings.push('Some of your swaps have significantly different values');
    warnings.push('Large value differences may require additional negotiation');
  }

  return {
    isEligible,
    reasons,
    warnings,
    canProceed: isEligible,
    eligibleSwapsCount: eligibleSwaps.length
  };
};

/**
 * Validates compatibility analysis and provides user-friendly feedback
 */
export const validateCompatibility = (
  compatibility: CompatibilityAnalysis,
  sourceSwap: EligibleSwap,
  targetSwap: SwapWithProposalInfo
): {
  isAcceptable: boolean;
  warnings: string[];
  recommendations: string[];
  criticalIssues: string[];
} => {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const criticalIssues: string[] = [];

  // Overall score assessment
  if (compatibility.overallScore < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
    criticalIssues.push(`Very low compatibility score (${compatibility.overallScore}%)`);
    criticalIssues.push('This proposal is unlikely to be accepted');
  } else if (compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR) {
    warnings.push(`Low compatibility score (${compatibility.overallScore}%)`);
    warnings.push('Consider addressing compatibility issues before proposing');
  }

  // Factor-specific validation
  Object.entries(compatibility.factors).forEach(([factorName, factor]) => {
    if (factor.score < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
      const friendlyName = factorName.replace('Compatibility', '').toLowerCase();
      criticalIssues.push(`Poor ${friendlyName} compatibility (${factor.score}%): ${factor.details}`);
    } else if (factor.score < COMPATIBILITY_THRESHOLDS.FAIR) {
      const friendlyName = factorName.replace('Compatibility', '').toLowerCase();
      warnings.push(`Low ${friendlyName} compatibility (${factor.score}%)`);
    }
  });

  // Add specific recommendations based on factors
  if (compatibility.factors.locationCompatibility.score < COMPATIBILITY_THRESHOLDS.GOOD) {
    recommendations.push('Consider mentioning flexibility with location preferences in your message');
  }

  if (compatibility.factors.dateCompatibility.score < COMPATIBILITY_THRESHOLDS.GOOD) {
    recommendations.push('Highlight any date flexibility you have in your proposal');
  }

  if (compatibility.factors.valueCompatibility.score < COMPATIBILITY_THRESHOLDS.GOOD) {
    recommendations.push('Be prepared to discuss value differences or additional compensation');
  }

  // Include existing recommendations from analysis
  recommendations.push(...compatibility.recommendations);

  return {
    isAcceptable: compatibility.overallScore >= COMPATIBILITY_THRESHOLDS.MINIMUM_RECOMMENDED,
    warnings,
    recommendations,
    criticalIssues
  };
};

/**
 * Checks if there are any validation errors in the form
 */
export const hasProposalValidationErrors = (errors: ProposalValidationErrors): boolean => {
  return Object.values(errors).some(error => error && error.length > 0);
};

/**
 * Gets the most critical error message for display
 */
export const getCriticalProposalError = (errors: ProposalValidationErrors): string | null => {
  // Priority order for displaying errors
  const errorPriority = [
    'eligibility',
    'selectedSwapId',
    'agreedToTerms',
    'message',
    'conditions',
    'compatibility',
    'general'
  ];

  for (const field of errorPriority) {
    const error = errors[field as keyof ProposalValidationErrors];
    if (error) {
      return error;
    }
  }

  return null;
};

/**
 * Validates proposal conditions for appropriateness and clarity
 */
export const validateProposalConditions = (conditions: string[]): {
  validConditions: string[];
  invalidConditions: Array<{ condition: string; reason: string }>;
  warnings: string[];
} => {
  const validConditions: string[] = [];
  const invalidConditions: Array<{ condition: string; reason: string }> = [];
  const warnings: string[] = [];

  // Patterns to detect inappropriate conditions
  const inappropriatePatterns = [
    { pattern: /\b(cash|money|payment|pay|dollar|\$)\b/i, reason: 'Cash payments should be handled through the platform' },
    { pattern: /\b(contact|email|phone|call|text|whatsapp|telegram)\b/i, reason: 'Contact information should not be shared in conditions' },
    { pattern: /\b(meet|meetup|in person|face to face)\b/i, reason: 'In-person meetings are not recommended for safety' },
    { pattern: /\b(cancel|refund|chargeback)\b/i, reason: 'Cancellation terms are handled by platform policies' }
  ];

  conditions.forEach(condition => {
    if (!condition.trim()) {
      return; // Skip empty conditions
    }

    if (condition.length > VALIDATION_RULES.CONDITION_MAX_LENGTH) {
      invalidConditions.push({
        condition,
        reason: `Condition too long (max ${VALIDATION_RULES.CONDITION_MAX_LENGTH} characters)`
      });
      return;
    }

    // Check for inappropriate patterns
    let isInappropriate = false;
    for (const { pattern, reason } of inappropriatePatterns) {
      if (pattern.test(condition)) {
        invalidConditions.push({ condition, reason });
        isInappropriate = true;
        break;
      }
    }

    if (!isInappropriate) {
      validConditions.push(condition);
      
      // Add warnings for potentially problematic conditions
      if (condition.toLowerCase().includes('flexible') || condition.toLowerCase().includes('negotiable')) {
        warnings.push('Vague conditions like "flexible" may lead to misunderstandings');
      }
    }
  });

  return {
    validConditions,
    invalidConditions,
    warnings
  };
};

/**
 * Provides user-friendly error messages for common validation failures
 */
export const getProposalValidationMessage = (
  errorType: keyof ProposalValidationErrors,
  context?: any
): string => {
  const messages = {
    selectedSwapId: 'Please select one of your available swaps to propose',
    message: 'Please check your message for length and content guidelines',
    conditions: 'Please review your conditions for appropriateness and length',
    agreedToTerms: 'You must agree to the terms and conditions to proceed',
    eligibility: 'You are not eligible to make this proposal at this time',
    compatibility: 'This proposal has compatibility concerns that may affect acceptance',
    general: 'Please review and correct the highlighted issues'
  };

  return messages[errorType] || messages.general;
};

/**
 * Real-time validation for individual form fields
 */
export const validateProposalField = (
  fieldName: keyof ProposalFormData,
  value: any,
  formData: ProposalFormData,
  eligibleSwaps: EligibleSwap[]
): string => {
  switch (fieldName) {
    case 'selectedSwapId':
      if (!value) return 'Please select a swap to propose';
      const swap = eligibleSwaps.find(s => s.id === value);
      if (!swap) return 'Selected swap is not available';
      if (swap.compatibilityScore !== undefined && swap.compatibilityScore < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
        return `Low compatibility (${swap.compatibilityScore}%) - consider other options`;
      }
      return '';

    case 'message':
      if (value && value.length > VALIDATION_RULES.MESSAGE_MAX_LENGTH) {
        return `Message too long (${value.length}/${VALIDATION_RULES.MESSAGE_MAX_LENGTH})`;
      }
      // Check for contact info
      if (value && /\b(email|phone|call|contact)\b/i.test(value)) {
        return 'Avoid sharing contact information in messages';
      }
      return '';

    case 'conditions':
      if (value.length > VALIDATION_RULES.CONDITIONS_MAX_COUNT) {
        return `Too many conditions (max ${VALIDATION_RULES.CONDITIONS_MAX_COUNT})`;
      }
      return '';

    case 'agreedToTerms':
      if (!value) return 'You must agree to the terms and conditions';
      return '';

    default:
      return '';
  }
};

/**
 * Debounced validation for real-time feedback
 */
export const createDebouncedValidator = (
  validationFn: (...args: any[]) => any,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        resolve(validationFn(...args));
      }, delay);
    });
  };
};