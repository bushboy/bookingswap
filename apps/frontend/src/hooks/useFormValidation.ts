import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ValidationEngine,
  ValidationResult,
  ValidationError as ValidationErrorType,
  formatValidationErrors,
  parseServerValidationErrors,
} from '@/utils/validation';

export interface UseFormValidationOptions {
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  validateOnSubmit?: boolean;
  showErrorsImmediately?: boolean;
}

export interface FormValidationState {
  errors: Record<string, string>;
  warnings: Record<string, string>;
  isValid: boolean;
  isValidating: boolean;
  hasBeenSubmitted: boolean;
  touchedFields: Set<string>;
}

export interface FormValidationActions {
  validateField: (
    fieldName: string,
    value: any,
    formData?: any
  ) => Promise<void>;
  validateForm: (formData: any) => Promise<boolean>;
  setFieldError: (fieldName: string, error: string) => void;
  clearFieldError: (fieldName: string) => void;
  clearAllErrors: () => void;
  setServerErrors: (error: any) => void;
  markFieldTouched: (fieldName: string) => void;
  markFormSubmitted: () => void;
  reset: () => void;
}

export const useFormValidation = (
  validator: ValidationEngine,
  options: UseFormValidationOptions = {}
): [FormValidationState, FormValidationActions] => {
  const {
    validateOnChange = true,
    validateOnBlur = true,
    validateOnSubmit = true,
    showErrorsImmediately = false,
  } = options;

  const [state, setState] = useState<FormValidationState>({
    errors: {},
    warnings: {},
    isValid: true,
    isValidating: false,
    hasBeenSubmitted: false,
    touchedFields: new Set(),
  });

  const validatorRef = useRef(validator);
  validatorRef.current = validator;

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      validatorRef.current.clearTimers();
    };
  }, []);

  const validateField = useCallback(
    async (fieldName: string, value: any, formData?: any) => {
      setState(prev => ({ ...prev, isValidating: true }));

      try {
        const result = await validatorRef.current.validateField(
          fieldName,
          value,
          formData
        );

        setState(prev => {
          const shouldShowError =
            showErrorsImmediately ||
            prev.hasBeenSubmitted ||
            prev.touchedFields.has(fieldName);

          const newErrors = { ...prev.errors };
          const newWarnings = { ...prev.warnings };

          if (result.errors.length > 0 && shouldShowError) {
            newErrors[fieldName] = result.errors[0].message;
          } else {
            delete newErrors[fieldName];
          }

          if (
            result.warnings &&
            result.warnings.length > 0 &&
            shouldShowError
          ) {
            newWarnings[fieldName] = result.warnings[0].message;
          } else {
            delete newWarnings[fieldName];
          }

          return {
            ...prev,
            errors: newErrors,
            warnings: newWarnings,
            isValid: Object.keys(newErrors).length === 0,
            isValidating: false,
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
          isValidating: false,
        }));
      }
    },
    [showErrorsImmediately]
  );

  const validateFieldDebounced = useCallback(
    (fieldName: string, value: any, formData?: any) => {
      if (!validateOnChange) return;

      setState(prev => ({ ...prev, isValidating: true }));

      validatorRef.current.validateFieldDebounced(
        fieldName,
        value,
        formData,
        result => {
          setState(prev => {
            const shouldShowError =
              showErrorsImmediately ||
              prev.hasBeenSubmitted ||
              prev.touchedFields.has(fieldName);

            const newErrors = { ...prev.errors };
            const newWarnings = { ...prev.warnings };

            if (result.errors.length > 0 && shouldShowError) {
              newErrors[fieldName] = result.errors[0].message;
            } else {
              delete newErrors[fieldName];
            }

            if (
              result.warnings &&
              result.warnings.length > 0 &&
              shouldShowError
            ) {
              newWarnings[fieldName] = result.warnings[0].message;
            } else {
              delete newWarnings[fieldName];
            }

            return {
              ...prev,
              errors: newErrors,
              warnings: newWarnings,
              isValid: Object.keys(newErrors).length === 0,
              isValidating: false,
            };
          });
        }
      );
    },
    [validateOnChange, showErrorsImmediately]
  );

  const validateForm = useCallback(
    async (formData: any): Promise<boolean> => {
      if (!validateOnSubmit) return true;

      setState(prev => ({
        ...prev,
        isValidating: true,
        hasBeenSubmitted: true,
      }));

      try {
        const result = await validatorRef.current.validateForm(formData);

        const newErrors = formatValidationErrors(result.errors);
        const newWarnings = result.warnings
          ? formatValidationErrors(
              result.warnings.map(w => ({ ...w, type: 'error' as const }))
            )
          : {};

        setState(prev => ({
          ...prev,
          errors: newErrors,
          warnings: newWarnings,
          isValid: result.isValid,
          isValidating: false,
          hasBeenSubmitted: true,
        }));

        return result.isValid;
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

  const clearFieldError = useCallback((fieldName: string) => {
    setState(prev => {
      const newErrors = { ...prev.errors };
      delete newErrors[fieldName];

      return {
        ...prev,
        errors: newErrors,
        isValid: Object.keys(newErrors).length === 0,
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

  const setServerErrors = useCallback((error: any) => {
    const validationErrors = parseServerValidationErrors(error);
    const formattedErrors = formatValidationErrors(validationErrors);

    setState(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        ...formattedErrors,
      },
      isValid: false,
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
    validatorRef.current.clearTimers();
    setState({
      errors: {},
      warnings: {},
      isValid: true,
      isValidating: false,
      hasBeenSubmitted: false,
      touchedFields: new Set(),
    });
  }, []);

  const actions: FormValidationActions = {
    validateField: validateOnBlur ? validateField : validateFieldDebounced,
    validateForm,
    setFieldError,
    clearFieldError,
    clearAllErrors,
    setServerErrors,
    markFieldTouched,
    markFormSubmitted,
    reset,
  };

  return [state, actions];
};

/**
 * Hook for handling field-level validation with real-time feedback
 */
export const useFieldValidation = (
  validator: ValidationEngine,
  fieldName: string,
  formData?: any
) => {
  const [fieldState, setFieldState] = useState({
    error: '',
    warning: '',
    isValidating: false,
    isTouched: false,
  });

  const validateField = useCallback(
    async (value: any) => {
      setFieldState(prev => ({ ...prev, isValidating: true }));

      try {
        const result = await validator.validateField(
          fieldName,
          value,
          formData
        );

        setFieldState(prev => ({
          ...prev,
          error: result.errors.length > 0 ? result.errors[0].message : '',
          warning:
            result.warnings && result.warnings.length > 0
              ? result.warnings[0].message
              : '',
          isValidating: false,
        }));

        return result.isValid;
      } catch (error) {
        setFieldState(prev => ({
          ...prev,
          error: 'Validation error occurred',
          isValidating: false,
        }));
        return false;
      }
    },
    [validator, fieldName, formData]
  );

  const validateFieldDebounced = useCallback(
    (value: any) => {
      setFieldState(prev => ({ ...prev, isValidating: true }));

      validator.validateFieldDebounced(fieldName, value, formData, result => {
        setFieldState(prev => ({
          ...prev,
          error:
            result.errors.length > 0 && prev.isTouched
              ? result.errors[0].message
              : '',
          warning:
            result.warnings && result.warnings.length > 0 && prev.isTouched
              ? result.warnings[0].message
              : '',
          isValidating: false,
        }));
      });
    },
    [validator, fieldName, formData]
  );

  const markTouched = useCallback(() => {
    setFieldState(prev => ({ ...prev, isTouched: true }));
  }, []);

  const clearError = useCallback(() => {
    setFieldState(prev => ({ ...prev, error: '', warning: '' }));
  }, []);

  return {
    ...fieldState,
    validateField,
    validateFieldDebounced,
    markTouched,
    clearError,
  };
};
