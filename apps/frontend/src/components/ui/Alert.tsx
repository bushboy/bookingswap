import React from 'react';
import { tokens } from '@/design-system/tokens';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning' | 'error';
  className?: string;
  style?: React.CSSProperties;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  className,
  style,
}) => {
  const variantStyles = {
    info: {
      backgroundColor: tokens.colors.primary[50],
      borderColor: tokens.colors.primary[200],
      color: tokens.colors.primary[800],
    },
    success: {
      backgroundColor: tokens.colors.success[50],
      borderColor: tokens.colors.success[200],
      color: tokens.colors.success[800],
    },
    warning: {
      backgroundColor: tokens.colors.warning[50],
      borderColor: tokens.colors.warning[200],
      color: tokens.colors.warning[800],
    },
    error: {
      backgroundColor: tokens.colors.error[50],
      borderColor: tokens.colors.error[200],
      color: tokens.colors.error[800],
    },
  };

  const alertStyles = {
    padding: tokens.spacing[4],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid`,
    fontSize: tokens.typography.fontSize.sm,
    ...variantStyles[variant],
  };

  return (
    <div
      className={className}
      style={{ ...alertStyles, ...style }}
      role="alert"
    >
      {children}
    </div>
  );
};

interface AlertDescriptionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({
  children,
  className,
  style,
}) => {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
};