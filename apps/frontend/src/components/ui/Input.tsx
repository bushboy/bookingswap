import React from 'react';
import { tokens } from '@/design-system/tokens';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  className,
  style,
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const inputStyles = {
    width: '100%',
    padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
    fontSize: tokens.typography.fontSize.base,
    lineHeight: tokens.typography.lineHeight.normal,
    border: `1px solid ${error ? tokens.colors.error[300] : tokens.colors.neutral[300]}`,
    borderRadius: tokens.borderRadius.md,
    backgroundColor: 'white',
    color: tokens.colors.neutral[900],
    outline: 'none',
    transition: 'all 0.2s ease-in-out',
    paddingLeft: leftIcon ? tokens.spacing[10] : tokens.spacing[4],
    paddingRight: rightIcon ? tokens.spacing[10] : tokens.spacing[4],
  };

  const focusStyles = {
    borderColor: error ? tokens.colors.error[500] : tokens.colors.primary[500],
    boxShadow: `0 0 0 3px ${error ? tokens.colors.error[200] : tokens.colors.primary[200]}`,
  };

  const containerStyles = {
    position: 'relative' as const,
    width: '100%',
  };

  const labelStyles = {
    display: 'block',
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.neutral[700],
    marginBottom: tokens.spacing[2],
  };

  const iconStyles = {
    position: 'absolute' as const,
    top: '50%',
    transform: 'translateY(-50%)',
    color: tokens.colors.neutral[400],
    pointerEvents: 'none' as const,
  };

  const leftIconStyles = {
    ...iconStyles,
    left: tokens.spacing[3],
  };

  const rightIconStyles = {
    ...iconStyles,
    right: tokens.spacing[3],
  };

  const errorStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
  };

  const helperTextStyles = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.neutral[500],
    marginTop: tokens.spacing[1],
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label htmlFor={inputId} style={labelStyles}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {leftIcon && <div style={leftIconStyles}>{leftIcon}</div>}
        <input
          id={inputId}
          style={{
            ...inputStyles,
            ...style,
          }}
          onFocus={e => {
            Object.assign(e.target.style, focusStyles);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            e.target.style.borderColor = error
              ? tokens.colors.error[300]
              : tokens.colors.neutral[300];
            e.target.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          {...props}
        />
        {rightIcon && <div style={rightIconStyles}>{rightIcon}</div>}
      </div>
      {error && <div style={errorStyles}>{error}</div>}
      {helperText && !error && <div style={helperTextStyles}>{helperText}</div>}
    </div>
  );
};
