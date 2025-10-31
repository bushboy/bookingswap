import React from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { formatErrorForUser, ErrorDisplayInfo } from '@/utils/errorHandling';

interface ErrorDisplayProps {
  error: Error;
  context?: Record<string, any>;
  onAction?: (action: string) => void;
  onDismiss?: () => void;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  context,
  onAction,
  onDismiss,
  className = '',
}) => {
  const errorInfo = formatErrorForUser(error, context);

  const handleAction = (action: string) => {
    if (action === 'dismiss' && onDismiss) {
      onDismiss();
    } else if (onAction) {
      onAction(action);
    }
  };

  // Get colors based on severity
  const getColorScheme = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'warning':
        return {
          bg: tokens.colors.warning[50],
          border: tokens.colors.warning[200],
          titleColor: tokens.colors.warning[800],
          textColor: tokens.colors.warning[700],
          subtextColor: tokens.colors.warning[600],
          iconColor: tokens.colors.warning[600],
          icon: '⚠️',
        };
      case 'info':
        return {
          bg: tokens.colors.primary[50],
          border: tokens.colors.primary[200],
          titleColor: tokens.colors.primary[800],
          textColor: tokens.colors.primary[700],
          subtextColor: tokens.colors.primary[600],
          iconColor: tokens.colors.primary[600],
          icon: 'ℹ️',
        };
      default:
        return {
          bg: tokens.colors.error[50],
          border: tokens.colors.error[200],
          titleColor: tokens.colors.error[800],
          textColor: tokens.colors.error[700],
          subtextColor: tokens.colors.error[600],
          iconColor: tokens.colors.error[600],
          icon: '❌',
        };
    }
  };

  const colorScheme = getColorScheme(errorInfo.severity);

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: colorScheme.bg,
        border: `1px solid ${colorScheme.border}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[3],
        }}
      >
        <div
          style={{
            fontSize: '20px',
            color: colorScheme.iconColor,
            marginTop: tokens.spacing[1],
          }}
        >
          {colorScheme.icon}
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: colorScheme.titleColor,
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            {errorInfo.title}
          </h3>

          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: colorScheme.textColor,
              margin: `0 0 ${tokens.spacing[2]} 0`,
              lineHeight: 1.5,
            }}
          >
            {errorInfo.message}
          </p>

          {errorInfo.details && (
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: colorScheme.subtextColor,
                margin: `0 0 ${tokens.spacing[2]} 0`,
                fontWeight: tokens.typography.fontWeight.medium,
              }}
            >
              💡 {errorInfo.details}
            </p>
          )}

          {errorInfo.explanation && (
            <div
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: colorScheme.subtextColor,
                margin: `0 0 ${tokens.spacing[3]} 0`,
                padding: tokens.spacing[3],
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                borderRadius: tokens.borderRadius.sm,
                borderLeft: `3px solid ${colorScheme.border}`,
              }}
            >
              <strong>Why this happened:</strong> {errorInfo.explanation}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
              marginTop: tokens.spacing[3],
            }}
          >
            {errorInfo.actions.map((action, index) => (
              <Button
                key={action.action}
                variant={
                  action.variant || (action.primary ? 'primary' : 'outline')
                }
                size="sm"
                onClick={() => handleAction(action.action)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              background: 'none',
              border: 'none',
              color: colorScheme.subtextColor,
              cursor: 'pointer',
              fontSize: '18px',
              padding: tokens.spacing[1],
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

interface InlineErrorProps {
  message: string;
  severity?: 'error' | 'warning' | 'info';
  className?: string;
}

export const InlineError: React.FC<InlineErrorProps> = ({
  message,
  severity = 'error',
  className = '',
}) => {
  const colors = {
    error: {
      bg: tokens.colors.error[50],
      border: tokens.colors.error[200],
      text: tokens.colors.error[700],
      icon: '❌',
    },
    warning: {
      bg: tokens.colors.warning[50],
      border: tokens.colors.warning[200],
      text: tokens.colors.warning[700],
      icon: '⚠️',
    },
    info: {
      bg: tokens.colors.primary[50],
      border: tokens.colors.primary[200],
      text: tokens.colors.primary[700],
      icon: 'ℹ️',
    },
  };

  const colorScheme = colors[severity];

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[2],
        padding: `${tokens.spacing[2]} ${tokens.spacing[3]}`,
        backgroundColor: colorScheme.bg,
        border: `1px solid ${colorScheme.border}`,
        borderRadius: tokens.borderRadius.sm,
        fontSize: tokens.typography.fontSize.sm,
        color: colorScheme.text,
      }}
    >
      <span>{colorScheme.icon}</span>
      <span>{message}</span>
    </div>
  );
};

interface FieldErrorProps {
  errors: string[];
  warnings?: string[];
  className?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({
  errors,
  warnings = [],
  className = '',
}) => {
  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className={className} style={{ marginTop: tokens.spacing[1] }}>
      {errors.map((error, index) => (
        <div
          key={`error-${index}`}
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.error[600],
            marginBottom: errors.length > 1 ? tokens.spacing[1] : 0,
          }}
        >
          {error}
        </div>
      ))}

      {warnings.map((warning, index) => (
        <div
          key={`warning-${index}`}
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.warning[600],
            marginBottom: warnings.length > 1 ? tokens.spacing[1] : 0,
          }}
        >
          ⚠️ {warning}
        </div>
      ))}
    </div>
  );
};

interface ValidationSummaryProps {
  errors: Record<string, string[]>;
  warnings?: Record<string, string[]>;
  onFieldFocus?: (fieldName: string) => void;
  className?: string;
}

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  errors,
  warnings = {},
  onFieldFocus,
  className = '',
}) => {
  const errorFields = Object.keys(errors).filter(
    field => errors[field].length > 0
  );
  const warningFields = Object.keys(warnings).filter(
    field => warnings[field].length > 0
  );

  if (errorFields.length === 0 && warningFields.length === 0) {
    return null;
  }

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.error[50],
        border: `1px solid ${tokens.colors.error[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <h4
        style={{
          fontSize: tokens.typography.fontSize.base,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.error[800],
          margin: `0 0 ${tokens.spacing[3]} 0`,
        }}
      >
        Please fix the following issues:
      </h4>

      <ul
        style={{
          margin: 0,
          paddingLeft: tokens.spacing[4],
          listStyle: 'none',
        }}
      >
        {errorFields.map(field => (
          <li key={field} style={{ marginBottom: tokens.spacing[2] }}>
            <button
              onClick={() => onFieldFocus?.(field)}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.error[700],
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
                textAlign: 'left',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              <strong>{field}:</strong> {errors[field].join(', ')}
            </button>
          </li>
        ))}

        {warningFields.map(field => (
          <li key={field} style={{ marginBottom: tokens.spacing[2] }}>
            <button
              onClick={() => onFieldFocus?.(field)}
              style={{
                background: 'none',
                border: 'none',
                color: tokens.colors.warning[700],
                cursor: 'pointer',
                fontSize: tokens.typography.fontSize.sm,
                textAlign: 'left',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              ⚠️ <strong>{field}:</strong> {warnings[field].join(', ')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface GracefulDegradationProps {
  title: string;
  message: string;
  fallbackAction?: {
    label: string;
    onClick: () => void;
  };
  explanation?: string;
  className?: string;
}

export const GracefulDegradation: React.FC<GracefulDegradationProps> = ({
  title,
  message,
  fallbackAction,
  explanation,
  className = '',
}) => {
  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.primary[50],
        border: `1px solid ${tokens.colors.primary[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[3],
        }}
      >
        <div
          style={{
            fontSize: '24px',
            marginTop: tokens.spacing[1],
          }}
        >
          🔄
        </div>

        <div style={{ flex: 1 }}>
          <h3
            style={{
              fontSize: tokens.typography.fontSize.lg,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: tokens.colors.primary[800],
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}
          >
            {title}
          </h3>

          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.primary[700],
              margin: `0 0 ${tokens.spacing[2]} 0`,
              lineHeight: 1.5,
            }}
          >
            {message}
          </p>

          {explanation && (
            <p
              style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.primary[600],
                margin: `0 0 ${tokens.spacing[3]} 0`,
                fontStyle: 'italic',
              }}
            >
              {explanation}
            </p>
          )}

          {fallbackAction && (
            <Button
              onClick={fallbackAction.onClick}
              variant="primary"
              size="sm"
            >
              {fallbackAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

interface RetryableErrorProps {
  error: Error;
  onRetry: () => void;
  retryCount: number;
  maxRetries?: number;
  className?: string;
}

export const RetryableError: React.FC<RetryableErrorProps> = ({
  error,
  onRetry,
  retryCount,
  maxRetries = 3,
  className = '',
}) => {
  const canRetry = retryCount < maxRetries;
  const errorInfo = formatErrorForUser(error);

  return (
    <div
      className={className}
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.warning[50],
        border: `1px solid ${tokens.colors.warning[200]}`,
        borderRadius: tokens.borderRadius.md,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '32px',
          marginBottom: tokens.spacing[3],
        }}
      >
        🔄
      </div>

      <h3
        style={{
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: tokens.colors.warning[800],
          margin: `0 0 ${tokens.spacing[2]} 0`,
        }}
      >
        {errorInfo.title}
      </h3>

      <p
        style={{
          fontSize: tokens.typography.fontSize.base,
          color: tokens.colors.warning[700],
          margin: `0 0 ${tokens.spacing[3]} 0`,
        }}
      >
        {errorInfo.message}
      </p>

      {canRetry ? (
        <div>
          <Button onClick={onRetry} variant="primary">
            Try Again {retryCount > 0 && `(${retryCount}/${maxRetries})`}
          </Button>
          <p
            style={{
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.warning[600],
              marginTop: tokens.spacing[2],
            }}
          >
            {errorInfo.details}
          </p>
        </div>
      ) : (
        <div>
          <p
            style={{
              fontSize: tokens.typography.fontSize.base,
              color: tokens.colors.error[700],
              marginBottom: tokens.spacing[3],
            }}
          >
            Maximum retry attempts reached. Please contact support if the
            problem persists.
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
        </div>
      )}
    </div>
  );
};
