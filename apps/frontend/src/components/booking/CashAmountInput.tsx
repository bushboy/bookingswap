import React from 'react';
import { Input } from '@/components/ui/Input';
import { tokens } from '@/design-system/tokens';

interface CashAmountInputProps {
  label: string;
  value?: number;
  onChange: (amount?: number) => void;
  error?: string;
  placeholder?: string;
  helperText?: string;
  minAmount?: number;
  maxAmount?: number;
}

export const CashAmountInput: React.FC<CashAmountInputProps> = ({
  label,
  value,
  onChange,
  error,
  placeholder,
  helperText,
  minAmount = 0,
  maxAmount,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    if (inputValue === '') {
      onChange(undefined);
      return;
    }

    const numericValue = parseFloat(inputValue);
    if (!isNaN(numericValue) && numericValue >= 0) {
      onChange(numericValue);
    }
  };

  const formatValue = (val?: number): string => {
    if (val === undefined || val === null) return '';
    return val.toString();
  };

  const getValidationError = (): string | undefined => {
    if (error) return error;
    
    if (value !== undefined) {
      if (value < minAmount) {
        return `Amount must be at least $${minAmount}`;
      }
      if (maxAmount && value > maxAmount) {
        return `Amount must not exceed $${maxAmount}`;
      }
    }
    
    return undefined;
  };

  const dollarIconStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[500],
    fontWeight: tokens.typography.fontWeight.medium,
  };

  const validationError = getValidationError();
  const displayHelperText = helperText && !validationError ? helperText : undefined;

  return (
    <Input
      label={label}
      type="number"
      min={minAmount}
      max={maxAmount}
      step="0.01"
      value={formatValue(value)}
      onChange={handleChange}
      error={validationError}
      helperText={displayHelperText}
      placeholder={placeholder}
      leftIcon={<span style={dollarIconStyles}>$</span>}
    />
  );
};