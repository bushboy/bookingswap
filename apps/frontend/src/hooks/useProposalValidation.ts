import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ProposalFormData,
  EligibleSwap,
  SwapWithProposalInfo,
  CompatibilityAnalysis,
  CreateProposalFromBrowseRequest
} from '@booking-swap/shared';
import {
  ProposalValidationErrors,
  EligibilityCheckResult,
  validateProposalForm,
  validateProposalRequest,
  checkProposalEligibility,
  validateCompatibility,
  validateProposalField,
  hasProposalValidationErrors,
  getCriticalProposalError,
  createDebouncedValidator,
  COMPATIBILITY_THRESHOLDS
} from '../utils/proposalValidation';

interface UseProposalValidationOptions {
  enableRealTimeValidation?: boolean;
  debounceDelay?: number;
  validateOnMount?: boolean;
}

interface UseProposalValidationReturn {
  // Validation state
  errors: ProposalValidationErrors;
  isValid: boolean;
  isValidating: boolean;
  
  // Eligibility state
  eligibilityCheck: EligibilityCheckResult | null;
  canCreateProposal: boolean;
  
  // Compatibility state
  compatibilityValidation: {
    isAcceptable: boolean;
    warnings: string[];
    recommendations: string[];
    criticalIssues: string[];
  } | null;
  
  // Validation methods
  validateForm: (formData: ProposalFormData) => Promise<boolean>;
  validateField: (fieldName: keyof ProposalFormData, value: any, formData: ProposalFormData) => string;
  validateRequest: (request: CreateProposalFromBrowseRequest) => boolean;
  clearErrors: () => void;
  
  // Helper methods
  getCriticalError: () => string | null;
  getFieldError: (fieldName: keyof ProposalFormData) => string | undefined;
  hasErrors: boolean;
  
  // Real-time validation controls
  enableRealTime: () => void;
  disableRealTime: () => void;
}

export const useProposalValidation = (
  eligibleSwaps: EligibleSwap[],
  targetSwap: SwapWithProposalInfo,
  userId: string,
  compatibility?: CompatibilityAnalysis,
  options: UseProposalValidationOptions = {}
): UseProposalValidationReturn => {
  const {
    enableRealTimeValidation = true,
    debounceDelay = 300,
    validateOnMount = false
  } = options;

  // State
  const [errors, setErrors] = useState<ProposalValidationErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const [realTimeEnabled, setRealTimeEnabled] = useState(enableRealTimeValidation);
  const [eligibilityCheck, setEligibilityCheck] = useState<EligibilityCheckResult | null>(null);
  const [compatibilityValidation, setCompatibilityValidation] = useState<{
    isAcceptable: boolean;
    warnings: string[];
    recommendations: string[];
    criticalIssues: string[];
  } | null>(null);

  // Memoized debounced validator
  const debouncedValidateForm = useMemo(
    () => createDebouncedValidator(validateProposalForm, debounceDelay),
    [debounceDelay]
  );

  // Check eligibility on mount and when dependencies change
  useEffect(() => {
    const eligibility = checkProposalEligibility(userId, targetSwap, eligibleSwaps);
    setEligibilityCheck(eligibility);
  }, [userId, targetSwap, eligibleSwaps]);

  // Validate compatibility when it changes
  useEffect(() => {
    if (compatibility && eligibleSwaps.length > 0) {
      const selectedSwap = eligibleSwaps[0]; // Default to first swap for validation
      const validation = validateCompatibility(compatibility, selectedSwap, targetSwap);
      setCompatibilityValidation(validation);
    }
  }, [compatibility, eligibleSwaps, targetSwap]);

  // Validate form function
  const validateForm = useCallback(async (formData: ProposalFormData): Promise<boolean> => {
    setIsValidating(true);
    
    try {
      let validationErrors: ProposalValidationErrors;
      
      if (realTimeEnabled) {
        validationErrors = await debouncedValidateForm(
          formData,
          eligibleSwaps,
          targetSwap,
          compatibility
        ) as ProposalValidationErrors;
      } else {
        validationErrors = validateProposalForm(
          formData,
          eligibleSwaps,
          targetSwap,
          compatibility
        );
      }
      
      setErrors(validationErrors);
      return !hasProposalValidationErrors(validationErrors);
    } finally {
      setIsValidating(false);
    }
  }, [realTimeEnabled, debouncedValidateForm, eligibleSwaps, targetSwap, compatibility]);

  // Validate individual field
  const validateField = useCallback((
    fieldName: keyof ProposalFormData,
    value: any,
    formData: ProposalFormData
  ): string => {
    return validateProposalField(fieldName, value, formData, eligibleSwaps);
  }, [eligibleSwaps]);

  // Validate complete request
  const validateRequest = useCallback((request: CreateProposalFromBrowseRequest): boolean => {
    const result = validateProposalRequest(request, eligibleSwaps, targetSwap);
    
    if (!result.isValid) {
      const requestErrors: ProposalValidationErrors = {};
      result.errors.forEach(error => {
        if (error.includes('swap')) {
          requestErrors.selectedSwapId = error;
        } else if (error.includes('message')) {
          requestErrors.message = error;
        } else if (error.includes('terms')) {
          requestErrors.agreedToTerms = error;
        } else {
          requestErrors.general = error;
        }
      });
      setErrors(requestErrors);
    }
    
    return result.isValid;
  }, [eligibleSwaps, targetSwap]);

  // Clear errors
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  // Get critical error
  const getCriticalError = useCallback((): string | null => {
    return getCriticalProposalError(errors);
  }, [errors]);

  // Get field-specific error
  const getFieldError = useCallback((fieldName: keyof ProposalFormData): string | undefined => {
    return errors[fieldName];
  }, [errors]);

  // Real-time validation controls
  const enableRealTime = useCallback(() => {
    setRealTimeEnabled(true);
  }, []);

  const disableRealTime = useCallback(() => {
    setRealTimeEnabled(false);
  }, []);

  // Computed values
  const isValid = useMemo(() => {
    return !hasProposalValidationErrors(errors) && 
           eligibilityCheck?.isEligible === true;
  }, [errors, eligibilityCheck]);

  const canCreateProposal = useMemo(() => {
    return eligibilityCheck?.canProceed === true && 
           !hasProposalValidationErrors(errors);
  }, [eligibilityCheck, errors]);

  const hasErrors = useMemo(() => {
    return hasProposalValidationErrors(errors);
  }, [errors]);

  // Validate on mount if requested
  useEffect(() => {
    if (validateOnMount && eligibleSwaps.length > 0) {
      const initialFormData: ProposalFormData = {
        selectedSwapId: '',
        message: '',
        conditions: [],
        agreedToTerms: false
      };
      validateForm(initialFormData);
    }
  }, [validateOnMount, eligibleSwaps.length, validateForm]);

  return {
    // Validation state
    errors,
    isValid,
    isValidating,
    
    // Eligibility state
    eligibilityCheck,
    canCreateProposal,
    
    // Compatibility state
    compatibilityValidation,
    
    // Validation methods
    validateForm,
    validateField,
    validateRequest,
    clearErrors,
    
    // Helper methods
    getCriticalError,
    getFieldError,
    hasErrors,
    
    // Real-time validation controls
    enableRealTime,
    disableRealTime
  };
};

// Hook for real-time field validation
export const useFieldValidation = (
  fieldName: keyof ProposalFormData,
  eligibleSwaps: EligibleSwap[],
  debounceDelay: number = 300
) => {
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const debouncedValidate = useMemo(
    () => createDebouncedValidator(validateProposalField, debounceDelay),
    [debounceDelay]
  );

  const validate = useCallback(async (value: any, formData: ProposalFormData) => {
    setIsValidating(true);
    try {
      const validationError = await debouncedValidate(
        fieldName,
        value,
        formData,
        eligibleSwaps
      ) as string;
      setError(validationError);
      return !validationError;
    } finally {
      setIsValidating(false);
    }
  }, [fieldName, debouncedValidate, eligibleSwaps]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  return {
    error,
    isValidating,
    validate,
    clearError,
    hasError: !!error
  };
};

// Hook for compatibility threshold warnings
export const useCompatibilityWarnings = (
  compatibility?: CompatibilityAnalysis,
  selectedSwap?: EligibleSwap
) => {
  const warnings = useMemo(() => {
    const warningList: string[] = [];

    if (!compatibility) return warningList;

    // Overall score warnings
    if (compatibility.overallScore < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
      warningList.push(`Very low compatibility score (${compatibility.overallScore}%)`);
    } else if (compatibility.overallScore < COMPATIBILITY_THRESHOLDS.FAIR) {
      warningList.push(`Low compatibility score (${compatibility.overallScore}%)`);
    }

    // Factor-specific warnings
    Object.entries(compatibility.factors).forEach(([factorName, factor]) => {
      if (factor.score < COMPATIBILITY_THRESHOLDS.WARNING_THRESHOLD) {
        const friendlyName = factorName.replace('Compatibility', '').toLowerCase();
        warningList.push(`Poor ${friendlyName} compatibility (${factor.score}%)`);
      }
    });

    // Selected swap specific warnings
    if (selectedSwap?.compatibilityScore !== undefined) {
      if (selectedSwap.compatibilityScore < COMPATIBILITY_THRESHOLDS.FAIR) {
        warningList.push('Selected swap has low compatibility with target');
      }
    }

    return warningList;
  }, [compatibility, selectedSwap]);

  const hasWarnings = warnings.length > 0;
  const hasCriticalWarnings = warnings.some(warning => 
    warning.includes('Very low') || warning.includes('Poor')
  );

  return {
    warnings,
    hasWarnings,
    hasCriticalWarnings,
    shouldShowWarning: hasWarnings,
    shouldBlockSubmission: hasCriticalWarnings
  };
};