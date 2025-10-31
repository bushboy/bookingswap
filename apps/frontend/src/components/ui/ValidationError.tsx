import React from 'react';
import { tokens } from '@/design-system/tokens';

export interface ValidationErrorProps {
  error?: string;
  errors?: string[];
  className?: string;
  showIcon?: boolean;
}

export const ValidationError: React.FC<ValidationErrorProps> = ({
  error,
  errors,
  className = '',
  showIcon = true,
}) => {
  const errorList = errors || (error ? [error] : []);

  if (errorList.length === 0) {
    return null;
  }

  const baseStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.error[600],
    marginTop: tokens.spacing[1],
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[1],
  };

  if (errorList.length === 1) {
    return (
      <div className={className} style={baseStyles}>
        {showIcon && (
          <span
            style={{
              color: tokens.colors.error[500],
              fontSize: tokens.typography.fontSize.xs,
              marginTop: '2px',
              flexShrink: 0,
            }}
          >
            ⚠️
          </span>
        )}
        <span>{errorList[0]}</span>
      </div>
    );
  }

  return (
    <div className={className} style={baseStyles}>
      {showIcon && (
        <span
          style={{
            color: tokens.colors.error[500],
            fontSize: tokens.typography.fontSize.xs,
            marginTop: '2px',
            flexShrink: 0,
          }}
        >
          ⚠️
        </span>
      )}
      <ul
        style={{
          margin: 0,
          paddingLeft: tokens.spacing[4],
          listStyle: 'disc',
        }}
      >
        {errorList.map((err, index) => (
          <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
            {err}
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface ValidationWarningProps {
  warning?: string;
  warnings?: string[];
  className?: string;
  showIcon?: boolean;
}

export const ValidationWarning: React.FC<ValidationWarningProps> = ({
  warning,
  warnings,
  className = '',
  showIcon = true,
}) => {
  const warningList = warnings || (warning ? [warning] : []);

  if (warningList.length === 0) {
    return null;
  }

  const baseStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.sm,
    color: tokens.colors.warning[700],
    marginTop: tokens.spacing[1],
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacing[1],
  };

  if (warningList.length === 1) {
    return (
      <div className={className} style={baseStyles}>
        {showIcon && (
          <span
            style={{
              color: tokens.colors.warning[500],
              fontSize: tokens.typography.fontSize.xs,
              marginTop: '2px',
              flexShrink: 0,
            }}
          >
            ⚡
          </span>
        )}
        <span>{warningList[0]}</span>
      </div>
    );
  }

  return (
    <div className={className} style={baseStyles}>
      {showIcon && (
        <span
          style={{
            color: tokens.colors.warning[500],
            fontSize: tokens.typography.fontSize.xs,
            marginTop: '2px',
            flexShrink: 0,
          }}
        >
          ⚡
        </span>
      )}
      <ul
        style={{
          margin: 0,
          paddingLeft: tokens.spacing[4],
          listStyle: 'disc',
        }}
      >
        {warningList.map((warn, index) => (
          <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
            {warn}
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface ValidationSummaryProps {
  errors: string[];
  warnings?: string[];
  title?: string;
  className?: string;
  onDismiss?: () => void;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  warnings = [],
  title = 'Please fix the following issues:',
  className = '',
  onDismiss,
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        backgroundColor: tokens.colors.error[50],
        border: `1px solid ${tokens.colors.error[200]}`,
        borderRadius: tokens.borderRadius.md,
        padding: tokens.spacing[4],
        marginBottom: tokens.spacing[4],
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom:
            errors.length > 0 || warnings.length > 0 ? tokens.spacing[3] : 0,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.medium,
            color: tokens.colors.error[800],
          }}
        >
          {title}
        </h4>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: tokens.colors.error[600],
              cursor: 'pointer',
              padding: tokens.spacing[1],
              fontSize: tokens.typography.fontSize.lg,
              lineHeight: 1,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <ValidationError errors={errors} showIcon={false} />
      )}

      {warnings.length > 0 && (
        <ValidationWarning warnings={warnings} showIcon={false} />
      )}
    </div>
  );
};
