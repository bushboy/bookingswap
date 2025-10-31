import React, { useState, useCallback, useEffect } from 'react';
import { Input, InputProps } from '@/components/ui/Input';
import {
  ValidationError,
  ValidationWarning,
} from '@/components/ui/ValidationError';
import { ValidationEngine } from '@/utils/validation';
import { useFieldValidation } from '@/hooks/useFormValidation';
import { tokens } from '@/design-system/tokens';

export interface ValidatedInputProps extends Omit<InputProps, 'error'> {
  validator?: ValidationEngine;
  fieldName: string;
  formData?: any;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showValidationIcon?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
}

export const ValidatedInput: React.FC<ValidatedInputProps> = ({
  validator,
  fieldName,
  formData,
  validateOnChange = true,
  validateOnBlur = true,
  showValidationIcon = true,
  onValidationChange,
  value,
  onChange,
  onBlur,
  ...inputProps
}) => {
  const [internalValue, setInternalValue] = useState(value || '');

  const fieldValidation = validator
    ? useFieldValidation(validator, fieldName, formData)
    : null;

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(value || '');
  }, [value]);

  // Notify parent of validation changes
  useEffect(() => {
    if (fieldValidation && onValidationChange) {
      onValidationChange(!fieldValidation.error, fieldValidation.error);
    }
  }, [fieldValidation?.error, onValidationChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);

      // Call parent onChange
      if (onChange) {
        onChange(e);
      }

      // Validate on change if enabled
      if (validateOnChange && fieldValidation) {
        fieldValidation.validateFieldDebounced(newValue);
      }
    },
    [onChange, validateOnChange, fieldValidation]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Mark field as touched
      if (fieldValidation) {
        fieldValidation.markTouched();
      }

      // Validate on blur if enabled
      if (validateOnBlur && fieldValidation) {
        fieldValidation.validateField(internalValue);
      }

      // Call parent onBlur
      if (onBlur) {
        onBlur(e);
      }
    },
    [onBlur, validateOnBlur, fieldValidation, internalValue]
  );

  const getValidationIcon = () => {
    if (!showValidationIcon || !fieldValidation) return null;

    if (fieldValidation.isValidating) {
      return (
        <span
          style={{
            color: tokens.colors.neutral[400],
            fontSize: tokens.typography.fontSize.sm,
            animation: 'spin 1s linear infinite',
          }}
        >
          ⟳
        </span>
      );
    }

    if (fieldValidation.error && fieldValidation.isTouched) {
      return (
        <span
          style={{
            color: tokens.colors.error[500],
            fontSize: tokens.typography.fontSize.sm,
          }}
        >
          ❌
        </span>
      );
    }

    if (!fieldValidation.error && fieldValidation.isTouched && internalValue) {
      return (
        <span
          style={{
            color: tokens.colors.success[500],
            fontSize: tokens.typography.fontSize.sm,
          }}
        >
          ✅
        </span>
      );
    }

    return null;
  };

  const hasError = fieldValidation?.error && fieldValidation.isTouched;
  const hasWarning = fieldValidation?.warning && fieldValidation.isTouched;

  return (
    <div>
      <Input
        {...inputProps}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        error={hasError ? fieldValidation.error : undefined}
        rightIcon={getValidationIcon()}
        style={{
          ...inputProps.style,
          borderColor: hasError
            ? tokens.colors.error[400]
            : hasWarning
              ? tokens.colors.warning[400]
              : undefined,
        }}
      />

      {hasError && <ValidationError error={fieldValidation.error} />}

      {hasWarning && !hasError && (
        <ValidationWarning warning={fieldValidation.warning} />
      )}
    </div>
  );
};

export interface ValidatedTextareaProps {
  validator?: ValidationEngine;
  fieldName: string;
  formData?: any;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  showValidationIcon?: boolean;
  onValidationChange?: (isValid: boolean, error?: string) => void;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const ValidatedTextarea: React.FC<ValidatedTextareaProps> = ({
  validator,
  fieldName,
  formData,
  validateOnChange = true,
  validateOnBlur = true,
  showValidationIcon = true,
  onValidationChange,
  value,
  onChange,
  onBlur,
  label,
  placeholder,
  required,
  disabled,
  rows = 4,
  maxLength,
  className = '',
  style,
}) => {
  const [internalValue, setInternalValue] = useState(value || '');

  const fieldValidation = validator
    ? useFieldValidation(validator, fieldName, formData)
    : null;

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(value || '');
  }, [value]);

  // Notify parent of validation changes
  useEffect(() => {
    if (fieldValidation && onValidationChange) {
      onValidationChange(!fieldValidation.error, fieldValidation.error);
    }
  }, [fieldValidation?.error, onValidationChange]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);

      // Call parent onChange
      if (onChange) {
        onChange(e);
      }

      // Validate on change if enabled
      if (validateOnChange && fieldValidation) {
        fieldValidation.validateFieldDebounced(newValue);
      }
    },
    [onChange, validateOnChange, fieldValidation]
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLTextAreaElement>) => {
      // Mark field as touched
      if (fieldValidation) {
        fieldValidation.markTouched();
      }

      // Validate on blur if enabled
      if (validateOnBlur && fieldValidation) {
        fieldValidation.validateField(internalValue);
      }

      // Call parent onBlur
      if (onBlur) {
        onBlur(e);
      }
    },
    [onBlur, validateOnBlur, fieldValidation, internalValue]
  );

  const hasError = fieldValidation?.error && fieldValidation.isTouched;
  const hasWarning = fieldValidation?.warning && fieldValidation.isTouched;

  const textareaStyles: React.CSSProperties = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    border: `1px solid ${
      hasError
        ? tokens.colors.error[400]
        : hasWarning
          ? tokens.colors.warning[400]
          : tokens.colors.neutral[300]
    }`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: disabled ? tokens.colors.neutral[50] : 'white',
    color: disabled ? tokens.colors.neutral[500] : tokens.colors.neutral[900],
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    ...style,
  };

  return (
    <div className={className}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: tokens.typography.fontSize.sm,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.neutral[700],
            marginBottom: tokens.spacing[2],
          }}
        >
          {label}
          {required && (
            <span style={{ color: tokens.colors.error[500] }}> *</span>
          )}
        </label>
      )}

      <div style={{ position: 'relative' }}>
        <textarea
          value={internalValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          maxLength={maxLength}
          style={textareaStyles}
        />

        {showValidationIcon && fieldValidation && (
          <div
            style={{
              position: 'absolute',
              top: tokens.spacing[3],
              right: tokens.spacing[3],
              pointerEvents: 'none',
            }}
          >
            {fieldValidation.isValidating && (
              <span
                style={{
                  color: tokens.colors.neutral[400],
                  fontSize: tokens.typography.fontSize.sm,
                  animation: 'spin 1s linear infinite',
                }}
              >
                ⟳
              </span>
            )}

            {fieldValidation.error && fieldValidation.isTouched && (
              <span
                style={{
                  color: tokens.colors.error[500],
                  fontSize: tokens.typography.fontSize.sm,
                }}
              >
                ❌
              </span>
            )}

            {!fieldValidation.error &&
              fieldValidation.isTouched &&
              internalValue && (
                <span
                  style={{
                    color: tokens.colors.success[500],
                    fontSize: tokens.typography.fontSize.sm,
                  }}
                >
                  ✅
                </span>
              )}
          </div>
        )}
      </div>

      {maxLength && (
        <div
          style={{
            fontSize: tokens.typography.fontSize.xs,
            color: tokens.colors.neutral[500],
            textAlign: 'right',
            marginTop: tokens.spacing[1],
          }}
        >
          {internalValue.length}/{maxLength}
        </div>
      )}

      {hasError && <ValidationError error={fieldValidation.error} />}

      {hasWarning && !hasError && (
        <ValidationWarning warning={fieldValidation.warning} />
      )}
    </div>
  );
};
