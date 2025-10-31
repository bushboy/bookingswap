import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ValidationResult,
  FieldValidation,
  validateField,
  createDebouncedValidator,
} from '@/utils/validation';

// Hook for real-time field validation
export const useFieldValidation = (
  initialValue: any = '',
  rules: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    custom?: (value: any) => string | null;
  },
  fieldName: string = 'Field',
  debounceMs: number = 300
) => {
  const [value, setValue] = useState(initialValue);
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [touched, setTouched] = useState(false);

  const validator = useMemo(
    () =>
      createDebouncedValidator(
        val => validateField(fieldName, val, rules),
        debounceMs
      ),
    [fieldName, rules, debounceMs]
  );

  const validateValue = useCallback(
    (val: any) => {
      validator(val, setValidation);
    },
    [validator]
  );

  const handleChange = useCallback(
    (newValue: any) => {
      setValue(newValue);
      if (touched) {
        validateValue(newValue);
      }
    },
    [touched, validateValue]
  );

  const handleBlur = useCallback(() => {
    setTouched(true);
    validateValue(value);
  }, [value, validateValue]);

  const reset = useCallback(() => {
    setValue(initialValue);
    setValidation({ isValid: true, errors: [], warnings: [] });
    setTouched(false);
  }, [initialValue]);

  return {
    value,
    setValue: handleChange,
    validation,
    touched,
    onBlur: handleBlur,
    reset,
    isValid: validation.isValid,
    errors: validation.errors,
    warnings: validation.warnings,
  };
};

// Hook for form-level validation
export const useFormValidation = <T extends Record<string, any>>(
  initialValues: T,
  validationRules: {
    [K in keyof T]?: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      min?: number;
      max?: number;
      pattern?: RegExp;
      custom?: (value: T[K], formData: T) => string | null;
    };
  }
) => {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, string[]>>(
    {} as Record<keyof T, string[]>
  );
  const [warnings, setWarnings] = useState<Record<keyof T, string[]>>(
    {} as Record<keyof T, string[]>
  );
  const [touched, setTouched] = useState<Record<keyof T, boolean>>(
    {} as Record<keyof T, boolean>
  );

  const validateField = useCallback(
    (fieldName: keyof T, value: any) => {
      const rules = validationRules[fieldName];
      if (!rules) return { isValid: true, errors: [], warnings: [] };

      const fieldErrors: string[] = [];
      const fieldWarnings: string[] = [];

      // Required validation
      if (
        rules.required &&
        (!value || (typeof value === 'string' && !value.trim()))
      ) {
        fieldErrors.push(`${String(fieldName)} is required`);
      }

      if (value) {
        // String validations
        if (typeof value === 'string') {
          if (rules.minLength && value.length < rules.minLength) {
            fieldErrors.push(
              `${String(fieldName)} must be at least ${rules.minLength} characters`
            );
          }
          if (rules.maxLength && value.length > rules.maxLength) {
            fieldErrors.push(
              `${String(fieldName)} cannot exceed ${rules.maxLength} characters`
            );
          }
          if (rules.pattern && !rules.pattern.test(value)) {
            fieldErrors.push(`${String(fieldName)} format is invalid`);
          }
        }

        // Number validations
        if (typeof value === 'number') {
          if (rules.min !== undefined && value < rules.min) {
            fieldErrors.push(
              `${String(fieldName)} must be at least ${rules.min}`
            );
          }
          if (rules.max !== undefined && value > rules.max) {
            fieldErrors.push(`${String(fieldName)} cannot exceed ${rules.max}`);
          }
        }

        // Custom validation
        if (rules.custom) {
          const customError = rules.custom(value, values);
          if (customError) {
            fieldErrors.push(customError);
          }
        }
      }

      return {
        isValid: fieldErrors.length === 0,
        errors: fieldErrors,
        warnings: fieldWarnings,
      };
    },
    [validationRules, values]
  );

  const validateAllFields = useCallback(() => {
    const newErrors: Record<keyof T, string[]> = {} as Record<
      keyof T,
      string[]
    >;
    const newWarnings: Record<keyof T, string[]> = {} as Record<
      keyof T,
      string[]
    >;
    let isFormValid = true;

    Object.keys(values).forEach(key => {
      const fieldName = key as keyof T;
      const result = validateField(fieldName, values[fieldName]);

      if (!result.isValid) {
        isFormValid = false;
        newErrors[fieldName] = result.errors;
      }

      if (result.warnings.length > 0) {
        newWarnings[fieldName] = result.warnings;
      }
    });

    setErrors(newErrors);
    setWarnings(newWarnings);
    return isFormValid;
  }, [values, validateField]);

  const handleFieldChange = useCallback(
    (fieldName: keyof T, value: any) => {
      setValues(prev => ({ ...prev, [fieldName]: value }));

      // Validate field if it has been touched
      if (touched[fieldName]) {
        const result = validateField(fieldName, value);
        setErrors(prev => ({ ...prev, [fieldName]: result.errors }));
        setWarnings(prev => ({ ...prev, [fieldName]: result.warnings }));
      }
    },
    [touched, validateField]
  );

  const handleFieldBlur = useCallback(
    (fieldName: keyof T) => {
      setTouched(prev => ({ ...prev, [fieldName]: true }));

      const result = validateField(fieldName, values[fieldName]);
      setErrors(prev => ({ ...prev, [fieldName]: result.errors }));
      setWarnings(prev => ({ ...prev, [fieldName]: result.warnings }));
    },
    [values, validateField]
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({} as Record<keyof T, string[]>);
    setWarnings({} as Record<keyof T, string[]>);
    setTouched({} as Record<keyof T, boolean>);
  }, [initialValues]);

  const isValid = useMemo(() => {
    return Object.values(errors).every(fieldErrors => fieldErrors.length === 0);
  }, [errors]);

  return {
    values,
    errors,
    warnings,
    touched,
    isValid,
    setFieldValue: handleFieldChange,
    setFieldTouched: handleFieldBlur,
    validateField,
    validateForm: validateAllFields,
    reset,
  };
};

// Hook for auction timing validation
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

    const currentDate = new Date();
    const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
    const oneWeekBeforeEvent = new Date(eventDate.getTime() - oneWeekInMs);
    const isLastMinute =
      eventDate.getTime() - currentDate.getTime() < oneWeekInMs;

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if event is last-minute
    if (isLastMinute) {
      errors.push(
        'Auctions are not allowed for events less than one week away'
      );
    }

    // Check if auction end date is valid
    if (auctionEndDate <= currentDate) {
      errors.push('Auction end date must be in the future');
    }

    if (auctionEndDate >= oneWeekBeforeEvent) {
      errors.push('Auction must end at least one week before the event date');
    }

    // Add warnings for tight timing
    const timeUntilAuction = auctionEndDate.getTime() - currentDate.getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;
    const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

    if (timeUntilAuction < oneDayInMs && timeUntilAuction > 0) {
      warnings.push(
        'Auction ends in less than 24 hours - consider extending for more proposals'
      );
    } else if (timeUntilAuction < threeDaysInMs && timeUntilAuction > 0) {
      warnings.push(
        'Short auction duration may limit the number of proposals received'
      );
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings,
      isLastMinute,
      minimumEndDate: oneWeekBeforeEvent,
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

// Hook for payment method validation
export const usePaymentMethodValidation = () => {
  const [paymentMethod, setPaymentMethod] = useState<{
    id: string;
    type: string;
    isVerified: boolean;
  } | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    requiresVerification: boolean;
  }>({
    isValid: true,
    errors: [],
    warnings: [],
    requiresVerification: false,
  });

  useEffect(() => {
    if (!paymentMethod || amount <= 0) {
      setValidation({
        isValid: true,
        errors: [],
        warnings: [],
        requiresVerification: false,
      });
      return;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let requiresVerification = false;

    // Check if payment method is verified
    if (!paymentMethod.isVerified) {
      errors.push('Payment method must be verified before use');
      requiresVerification = true;
    }

    // Type-specific validations
    switch (paymentMethod.type) {
      case 'credit_card':
        if (amount > 5000) {
          warnings.push(
            'Large credit card transactions may have additional fees'
          );
        }
        if (amount > 10000) {
          requiresVerification = true;
          warnings.push(
            'Large credit card payments require additional verification'
          );
        }
        break;

      case 'bank_transfer':
        if (amount < 10) {
          warnings.push(
            'Bank transfers for small amounts may have high relative fees'
          );
        }
        if (amount > 25000) {
          requiresVerification = true;
          warnings.push('Large bank transfers require additional verification');
        }
        break;

      case 'digital_wallet':
        if (amount > 2500) {
          warnings.push('Digital wallet limits may apply for large amounts');
        }
        if (amount > 5000) {
          errors.push('Digital wallet payments are limited to $5,000');
        }
        break;
    }

    setValidation({
      isValid: errors.length === 0,
      errors,
      warnings,
      requiresVerification,
    });
  }, [paymentMethod, amount]);

  return {
    paymentMethod,
    setPaymentMethod,
    amount,
    setAmount,
    validation,
    requiresVerification: validation.requiresVerification,
  };
};
