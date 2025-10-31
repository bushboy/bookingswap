/**
 * Real-time validation hooks for unified booking forms
 * Provides comprehensive validation with debouncing and cross-field validation
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDebounce } from './useDebounce';
import {
  UnifiedBookingData,
  SwapPreferencesData,
  UnifiedFormValidationErrors,
  InlineProposalData,
} from '@booking-swap/shared';
import {
  validateUnifiedBookingData,
  validateSwapPreferences,
  validateInlineProposal,
  validateUnifiedField,
  validateAuctionTiming,
  hasValidationErrors,
  getValidationErrorCount,
  getFieldError,
  clearFieldError,
} from '@booking-swap/shared';

export interface UseUnifiedFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  showErrorsImmediately?: boolean;
  debounceMs?: number;
}

export interface UnifiedFormValidationState {
  errors: UnifiedFormValidationErrors;
  warnings: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  hasBeenSubmitted: boolean;
  touchedFields: Set<string>;
  fieldValidationStates: Record<string, {
    isValidating: boolean;
    lastValidated: number;
  }>;
}

export interface UnifiedFormValidationActions {
  validateField: (fieldName: string, value: any, formData?: Partial<UnifiedBookingData>) => Promise<void>;
  validateForm: (formData: UnifiedBookingData) => Promise<boolean>;
  validateSwapPreferences: (preferences: SwapPreferencesData, eventDate: Date) => void;
  setFieldError: (fieldName: string, error: string) => void;
  clearFieldError: (fieldName: string) => void;
  clearAllErrors: () => void;
  markFieldTouched: (fieldName: string) => void;
  markFormSubmitted: () => void;
  reset: () => void;
  getFieldError: (fieldName: string) => string;
  hasErrors: () => boolean;
  getErrorCount: () => number;
}

/**
 * Main hook for unified form validation with real-time feedback
 */
export const useUnifiedFormValidation = (
  options: UseUnifiedFormValidationOptions = {}
): [UnifiedFormValidationState, UnifiedFormValidationActions] => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true,
    showErrorsImmediately = false,
    debounceMs = 300,
  } = options;

  const [state, setState] = useState<UnifiedFormValidationState>({
    errors: {},
    warnings: {},
    isValid: true,
    isValidating: false,
    hasBeenSubmitted: false,
    touchedFields: new Set(),
    fieldValidationStates: {},
  });

  const validationTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(validationTimeouts.current).forEach(clearTimeout);
    };
  }, []);

  const validateField = useCallback(
    async (fieldName: string, value: any, formData?: Partial<UnifiedBookingData>) => {
      // Clear existing timeout for this field
      if (validationTimeouts.current[fieldName]) {
        clearTimeout(validationTimeouts.current[fieldName]);
      }

      setState(prev => ({
        ...prev,
        fieldValidationStates: {
          ...prev.fieldValidationStates,
          [fieldName]: {
            isValidating: true,
            lastValidated: Date.now(),
          },
        },
      }));

      const performValidation = () => {
        try {
          const error = validateUnifiedField(fieldName, value, formData);

          setState(prev => {
            const shouldShowError =
              showErrorsImmediately ||
              prev.hasBeenSubmitted ||
              prev.touchedFields.has(fieldName);

            const newErrors = { ...prev.errors };
            const newFieldStates = { ...prev.fieldValidationStates };

            if (error && shouldShowError) {
              newErrors[fieldName] = error;
            } else {
              delete newErrors[fieldName];
            }

            newFieldStates[fieldName] = {
              isValidating: false,
              lastValidated: Date.now(),
            };

            return {
              ...prev,
              errors: newErrors,
              isValid: !hasValidationErrors(newErrors),
              fieldValidationStates: newFieldStates,
            };
          });
        } catch (error) {
          setState(prev => ({
            ...prev,
            errors: {
              ...prev.errors,
              [fieldName]: 'Validation error occurred',
            },
            isValid: false,
            fieldValidationStates: {
              ...prev.fieldValidationStates,
              [fieldName]: {
                isValidating: false,
                lastValidated: Date.now(),
              },
            },
          }));
        }
      };

      if (validateOnChange && debounceMs > 0) {
        validationTimeouts.current[fieldName] = setTimeout(performValidation, debounceMs);
      } else {
        performValidation();
      }
    },
    [validateOnChange, showErrorsImmediately, debounceMs]
  );

  const validateForm = useCallback(
    async (formData: UnifiedBookingData): Promise<boolean> => {
      if (!validateOnSubmit) return true;

      setState(prev => ({
        ...prev,
        isValidating: true,
        hasBeenSubmitted: true,
      }));

      try {
        const errors = validateUnifiedBookingData(formData);

        setState(prev => ({
          ...prev,
          errors,
          isValid: !hasValidationErrors(errors),
          isValidating: false,
          hasBeenSubmitted: true,
        }));

        return !hasValidationErrors(errors);
      } catch (error) {
        setState(prev => ({
          ...prev,
          errors: { general: 'Validation error occurred' },
          isValid: false,
          isValidating: false,
          hasBeenSubmitted: true,
        }));
        return false;
      }
    },
    [validateOnSubmit]
  );

  const validateSwapPreferencesCallback = useCallback(
    (preferences: SwapPreferencesData, eventDate: Date) => {
      const swapErrors = validateSwapPreferences(preferences, eventDate);

      setState(prev => {
        const newErrors = { ...prev.errors };

        // Clear existing swap-related errors
        Object.keys(newErrors).forEach(key => {
          if (key.startsWith('swapPreferences') || 
              ['paymentTypes', 'minCashAmount', 'maxCashAmount', 'acceptanceStrategy', 'auctionEndDate'].includes(key)) {
            delete newErrors[key];
          }
        });

        // Add new swap errors
        Object.assign(newErrors, swapErrors);

        return {
          ...prev,
          errors: newErrors,
          isValid: !hasValidationErrors(newErrors),
        };
      });
    },
    []
  );

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [fieldName]: error,
      },
      isValid: false,
    }));
  }, []);

  const clearFieldErrorCallback = useCallback((fieldName: string) => {
    setState(prev => {
      const newErrors = clearFieldError(prev.errors, fieldName);
      return {
        ...prev,
        errors: newErrors,
        isValid: !hasValidationErrors(newErrors),
      };
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setState(prev => ({
      ...prev,
      errors: {},
      warnings: {},
      isValid: true,
    }));
  }, []);

  const markFieldTouched = useCallback((fieldName: string) => {
    setState(prev => ({
      ...prev,
      touchedFields: new Set([...prev.touchedFields, fieldName]),
    }));
  }, []);

  const markFormSubmitted = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasBeenSubmitted: true,
    }));
  }, []);

  const reset = useCallback(() => {
    Object.values(validationTimeouts.current).forEach(clearTimeout);
    validationTimeouts.current = {};
    
    setState({
      errors: {},
      warnings: {},
      isValid: true,
      isValidating: false,
      hasBeenSubmitted: false,
      touchedFields: new Set(),
      fieldValidationStates: {},
    });
  }, []);

  const getFieldErrorCallback = useCallback(
    (fieldName: string) => getFieldError(state.errors, fieldName),
    [state.errors]
  );

  const hasErrors = useCallback(
    () => hasValidationErrors(state.errors),
    [state.errors]
  );

  const getErrorCount = useCallback(
    () => getValidationErrorCount(state.errors),
    [state.errors]
  );

  const actions: UnifiedFormValidationActions = {
    validateField,
    validateForm,
    validateSwapPreferences: validateSwapPreferencesCallback,
    setFieldError,
    clearFieldError: clearFieldErrorCallback,
    clearAllErrors,
    markFieldTouched,
    markFormSubmitted,
    reset,
    getFieldError: getFieldErrorCallback,
    hasErrors,
    getErrorCount,
  };

  return [state, actions];
};

/**
 * Hook for real-time field validation with debouncing
 */
export const useFieldValidation = (
  fieldName: string,
  initialValue: any = '',
  formData?: Partial<UnifiedBookingData>,
  debounceMs: number = 300
) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  const debouncedValue = useDebounce(value, debounceMs);

  useEffect(() => {
    if (isTouched && debouncedValue !== undefined) {
      setIsValidating(true);
      
      try {
        const validationError = validateUnifiedField(fieldName, debouncedValue, formData);
        setError(validationError);
      } catch (err) {
        setError('Validation error occurred');
      } finally {
        setIsValidating(false);
      }
    }
  }, [debouncedValue, fieldName, formData, isTouched]);

  const handleChange = useCallback((newValue: any) => {
    setValue(newValue);
  }, []);

  const handleBlur = useCallback(() => {
    setIsTouched(true);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
    setError('');
    setIsValidating(false);
    setIsTouched(false);
  }, [initialValue]);

  return {
    value,
    setValue: handleChange,
    error,
    isValidating,
    isTouched,
    onBlur: handleBlur,
    reset,
    isValid: !error,
  };
};

/**
 * Hook for auction timing validation with real-time feedback
 */
export const useAuctionTimingValidation = (eventDate?: Date) => {
  const [auctionEndDate, setAuctionEndDate] = useState<Date | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    isLastMinute: boolean;
    minimumEndDate?: Date;
  }>({
    isValid: true,
    errors: [],
    warnings: [],
    isLastMinute: false,
  });

  useEffect(() => {
    if (!eventDate || !auctionEndDate) {
      setValidation({
        isValid: true,
        errors: [],
        warnings: [],
        isLastMinute: false,
      });
      return;
    }

    const result = validateAuctionTiming(auctionEndDate, eventDate);
    const currentDate = new Date();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const isLastMinute = eventDate.getTime() - currentDate.getTime() < oneWeekInMs;
    const minimumEndDate = new Date(eventDate.getTime() - oneWeekInMs);

    setValidation({
      ...result,
      isLastMinute,
      minimumEndDate,
    });
  }, [eventDate, auctionEndDate]);

  return {
    auctionEndDate,
    setAuctionEndDate,
    validation,
    isLastMinute: validation.isLastMinute,
    minimumEndDate: validation.minimumEndDate,
  };
};

/**
 * Hook for inline proposal validation
 */
export const useInlineProposalValidation = (
  minCashAmount?: number,
  maxCashAmount?: number
) => {
  const [proposalData, setProposalData] = useState<Partial<InlineProposalData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validateProposal = useCallback(
    (data: InlineProposalData) => {
      setIsValidating(true);
      
      try {
        const validationErrors = validateInlineProposal(data, minCashAmount, maxCashAmount);
        setErrors(validationErrors);
        return Object.keys(validationErrors).length === 0;
      } catch (error) {
        setErrors({ general: 'Validation error occurred' });
        return false;
      } finally {
        setIsValidating(false);
      }
    },
    [minCashAmount, maxCashAmount]
  );

  const updateField = useCallback((field: keyof InlineProposalData, value: any) => {
    setProposalData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  }, [errors]);

  const reset = useCallback(() => {
    setProposalData({});
    setErrors({});
    setIsValidating(false);
  }, []);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  return {
    proposalData,
    errors,
    isValidating,
    isValid,
    validateProposal,
    updateField,
    reset,
  };
};

/**
 * Hook for cross-field validation (e.g., date dependencies)
 */
export const useCrossFieldValidation = (
  dependencies: Record<string, any>,
  validationRules: Record<string, (deps: Record<string, any>) => string>
) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const newErrors: Record<string, string> = {};

    Object.entries(validationRules).forEach(([field, rule]) => {
      const error = rule(dependencies);
      if (error) {
        newErrors[field] = error;
      }
    });

    setErrors(newErrors);
  }, [dependencies, validationRules]);

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
};