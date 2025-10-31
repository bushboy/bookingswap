import React from 'react';
import { Button } from './Button';
import { Card, CardContent } from './Card';
import { LoadingSpinner } from './LoadingIndicator';
import { tokens } from '../../design-system/tokens';
import { formatErrorForUser } from '../../utils/errorHandling';

// Enhanced error message component with retry actions
export interface ErrorMessageProps {
  error: string | Error;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryLabel?: string;
  canRetry?: boolean;
  isRetrying?: boolean;
  context?: 'api' | 'validation' | 'network' | 'authentication';
  className?: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  title,
  onRetry,
  onDismiss,
  retryLabel = 'Try Again',
  canRetry = true,
  isRetrying = false,
  context = 'api',
  className = '',
}) => {
  const errorInfo = typeof error === 'string' 
    ? { title: title || 'Error', message: error, details: undefined, actions: [], severity: 'error' as const }
    : formatErrorForUser(error);

  const getContextIcon = () => {
    switch (context) {
      case 'network': return '🌐';
      case 'authentication': return '🔐';
      case 'validation': return '⚠️';
      default: return '❌';
    }
  };

  const getContextColor = () => {
    switch (context) {
      case 'validation': return {
        bg: tokens.colors.warning[50],
        border: tokens.colors.warning[200],
        text: tokens.colors.warning[700],
        title: tokens.colors.warning[800],
      };
      case 'network': return {
        bg: tokens.colors.primary[50],
        border: tokens.colors.primary[200],
        text: tokens.colors.primary[700],
        title: tokens.colors.primary[800],
      };
      default: return {
        bg: tokens.colors.error[50],
        border: tokens.colors.error[200],
        text: tokens.colors.error[700],
        title: tokens.colors.error[800],
      };
    }
  };

  const colors = getContextColor();

  return (
    <Card 
      variant="outlined" 
      className={className}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        marginBottom: tokens.spacing[4],
      }}
    >
      <CardContent style={{ padding: tokens.spacing[4] }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[3],
        }}>
          <div style={{
            fontSize: '20px',
            marginTop: tokens.spacing[1],
          }}>
            {getContextIcon()}
          </div>

          <div style={{ flex: 1 }}>
            <h4 style={{
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: colors.title,
              margin: `0 0 ${tokens.spacing[2]} 0`,
            }}>
              {errorInfo.title}
            </h4>

            <p style={{
              fontSize: tokens.typography.fontSize.sm,
              color: colors.text,
              margin: `0 0 ${tokens.spacing[3]} 0`,
              lineHeight: 1.5,
            }}>
              {errorInfo.message}
            </p>

            {errorInfo.details && (
              <p style={{
                fontSize: tokens.typography.fontSize.sm,
                color: colors.text,
                margin: `0 0 ${tokens.spacing[3]} 0`,
                fontWeight: tokens.typography.fontWeight.medium,
                opacity: 0.8,
              }}>
                💡 {errorInfo.details}
              </p>
            )}

            <div style={{
              display: 'flex',
              gap: tokens.spacing[2],
              flexWrap: 'wrap',
            }}>
              {canRetry && onRetry && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRetry}
                  disabled={isRetrying}
                  aria-label={isRetrying ? 'Retrying...' : retryLabel}
                >
                  {isRetrying ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2] }}>
                      <LoadingSpinner size="sm" />
                      <span>Retrying...</span>
                    </div>
                  ) : (
                    retryLabel
                  )}
                </Button>
              )}

              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  aria-label="Dismiss error"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: colors.text,
                cursor: 'pointer',
                fontSize: '18px',
                padding: tokens.spacing[1],
                opacity: 0.7,
              }}
              aria-label="Close error message"
            >
              ×
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Field-specific validation error display
export interface FieldValidationErrorProps {
  fieldName: string;
  error?: string;
  errors?: string[];
  warning?: string;
  warnings?: string[];
  showIcon?: boolean;
  className?: string;
}

export const FieldValidationError: React.FC<FieldValidationErrorProps> = ({
  fieldName,
  error,
  errors,
  warning,
  warnings,
  showIcon = true,
  className = '',
}) => {
  const errorList = errors || (error ? [error] : []);
  const warningList = warnings || (warning ? [warning] : []);

  if (errorList.length === 0 && warningList.length === 0) {
    return null;
  }

  return (
    <div 
      className={className}
      role="alert"
      aria-live="polite"
      aria-label={`Validation errors for ${fieldName}`}
    >
      {errorList.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[2],
          marginTop: tokens.spacing[1],
        }}>
          {showIcon && (
            <span style={{
              color: tokens.colors.error[500],
              fontSize: tokens.typography.fontSize.sm,
              marginTop: '2px',
              flexShrink: 0,
            }}>
              ❌
            </span>
          )}
          <div style={{ flex: 1 }}>
            {errorList.length === 1 ? (
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.error[600],
              }}>
                {errorList[0]}
              </span>
            ) : (
              <ul style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                listStyle: 'disc',
              }}>
                {errorList.map((err, index) => (
                  <li 
                    key={index} 
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.error[600],
                      marginBottom: tokens.spacing[1],
                    }}
                  >
                    {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {warningList.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: tokens.spacing[2],
          marginTop: errorList.length > 0 ? tokens.spacing[2] : tokens.spacing[1],
        }}>
          {showIcon && (
            <span style={{
              color: tokens.colors.warning[500],
              fontSize: tokens.typography.fontSize.sm,
              marginTop: '2px',
              flexShrink: 0,
            }}>
              ⚠️
            </span>
          )}
          <div style={{ flex: 1 }}>
            {warningList.length === 1 ? (
              <span style={{
                fontSize: tokens.typography.fontSize.sm,
                color: tokens.colors.warning[600],
              }}>
                {warningList[0]}
              </span>
            ) : (
              <ul style={{
                margin: 0,
                paddingLeft: tokens.spacing[4],
                listStyle: 'disc',
              }}>
                {warningList.map((warn, index) => (
                  <li 
                    key={index} 
                    style={{
                      fontSize: tokens.typography.fontSize.sm,
                      color: tokens.colors.warning[600],
                      marginBottom: tokens.spacing[1],
                    }}
                  >
                    {warn}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// User-friendly error messages for different error types
export interface UserFriendlyErrorProps {
  errorType: 'network' | 'authentication' | 'authorization' | 'validation' | 'server' | 'timeout' | 'unknown';
  originalError?: string;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onLogin?: () => void;
  className?: string;
}

export const UserFriendlyError: React.FC<UserFriendlyErrorProps> = ({
  errorType,
  originalError,
  onRetry,
  onContactSupport,
  onLogin,
  className = '',
}) => {
  const getErrorConfig = () => {
    switch (errorType) {
      case 'network':
        return {
          icon: '🌐',
          title: 'Connection Problem',
          message: 'Unable to connect to our servers. Please check your internet connection.',
          suggestion: 'Try refreshing the page or check your network connection.',
          actions: [
            { label: 'Try Again', onClick: onRetry, variant: 'primary' as const },
          ],
          color: tokens.colors.primary,
        };

      case 'authentication':
        return {
          icon: '🔐',
          title: 'Authentication Required',
          message: 'You need to be logged in to perform this action.',
          suggestion: 'Please log in to continue with your proposal.',
          actions: [
            { label: 'Log In', onClick: onLogin, variant: 'primary' as const },
          ],
          color: tokens.colors.warning,
        };

      case 'authorization':
        return {
          icon: '🚫',
          title: 'Access Denied',
          message: "You don't have permission to access this swap or perform this action.",
          suggestion: 'This swap may be private or no longer available to you.',
          actions: [
            { label: 'Go Back', onClick: () => window.history.back(), variant: 'outline' as const },
          ],
          color: tokens.colors.error,
        };

      case 'validation':
        return {
          icon: '⚠️',
          title: 'Invalid Information',
          message: 'Some of the information provided is not valid.',
          suggestion: 'Please check the highlighted fields and correct any errors.',
          actions: [
            { label: 'Review Form', onClick: () => {}, variant: 'primary' as const },
          ],
          color: tokens.colors.warning,
        };

      case 'no_content':
        return {
          icon: '📭',
          title: 'Nothing Available',
          message: 'There are no items available at the moment.',
          suggestion: 'Try again later or create some content to get started.',
          actions: [
            { label: 'Refresh', onClick: onRetry, variant: 'primary' as const },
          ],
          color: tokens.colors.neutral,
        };

      case 'server':
        return {
          icon: '🔧',
          title: 'Server Error',
          message: 'Our servers are experiencing issues right now.',
          suggestion: 'Please try again in a few minutes. If the problem persists, contact support.',
          actions: [
            { label: 'Try Again', onClick: onRetry, variant: 'primary' as const },
            { label: 'Contact Support', onClick: onContactSupport, variant: 'ghost' as const },
          ],
          color: tokens.colors.error,
        };

      case 'timeout':
        return {
          icon: '⏱️',
          title: 'Request Timeout',
          message: 'The request took too long to complete.',
          suggestion: 'This might be due to slow internet or server load. Please try again.',
          actions: [
            { label: 'Try Again', onClick: onRetry, variant: 'primary' as const },
          ],
          color: tokens.colors.warning,
        };

      default:
        return {
          icon: '❓',
          title: 'Something Went Wrong',
          message: 'An unexpected error occurred while processing your request.',
          suggestion: 'Please try again or contact support if the problem continues.',
          actions: [
            { label: 'Try Again', onClick: onRetry, variant: 'primary' as const },
            { label: 'Contact Support', onClick: onContactSupport, variant: 'ghost' as const },
          ],
          color: tokens.colors.error,
        };
    }
  };

  const config = getErrorConfig();

  return (
    <Card 
      variant="outlined" 
      className={className}
      style={{
        backgroundColor: `${config.color[50]}`,
        borderColor: config.color[200],
        textAlign: 'center',
        padding: tokens.spacing[6],
      }}
    >
      <CardContent>
        <div style={{
          fontSize: '48px',
          marginBottom: tokens.spacing[4],
        }}>
          {config.icon}
        </div>

        <h3 style={{
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: tokens.typography.fontWeight.semibold,
          color: config.color[800],
          margin: `0 0 ${tokens.spacing[3]} 0`,
        }}>
          {config.title}
        </h3>

        <p style={{
          fontSize: tokens.typography.fontSize.base,
          color: config.color[700],
          margin: `0 0 ${tokens.spacing[2]} 0`,
          lineHeight: 1.5,
        }}>
          {config.message}
        </p>

        <p style={{
          fontSize: tokens.typography.fontSize.sm,
          color: config.color[600],
          margin: `0 0 ${tokens.spacing[4]} 0`,
          fontStyle: 'italic',
        }}>
          {config.suggestion}
        </p>

        <div style={{
          display: 'flex',
          gap: tokens.spacing[3],
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}>
          {config.actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant}
              onClick={action.onClick}
              disabled={!action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>

        {originalError && (
          <details style={{ marginTop: tokens.spacing[4] }}>
            <summary style={{
              fontSize: tokens.typography.fontSize.sm,
              color: config.color[600],
              cursor: 'pointer',
              marginBottom: tokens.spacing[2],
            }}>
              Technical Details
            </summary>
            <pre style={{
              fontSize: tokens.typography.fontSize.xs,
              color: config.color[600],
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              padding: tokens.spacing[3],
              borderRadius: tokens.borderRadius.md,
              overflow: 'auto',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {originalError}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
};

// Inline error alert for form sections
export interface InlineErrorAlertProps {
  message: string;
  type?: 'error' | 'warning' | 'info';
  onDismiss?: () => void;
  className?: string;
}

export const InlineErrorAlert: React.FC<InlineErrorAlertProps> = ({
  message,
  type = 'error',
  onDismiss,
  className = '',
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'warning':
        return {
          icon: '⚠️',
          color: tokens.colors.warning,
        };
      case 'info':
        return {
          icon: 'ℹ️',
          color: tokens.colors.primary,
        };
      default:
        return {
          icon: '❌',
          color: tokens.colors.error,
        };
    }
  };

  const config = getTypeConfig();

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing[3],
        padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
        backgroundColor: config.color[50],
        border: `1px solid ${config.color[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[3],
      }}
      role="alert"
      aria-live="polite"
    >
      <span style={{ fontSize: '16px' }}>
        {config.icon}
      </span>

      <span style={{
        flex: 1,
        fontSize: tokens.typography.fontSize.sm,
        color: config.color[700],
      }}>
        {message}
      </span>

      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: config.color[600],
            cursor: 'pointer',
            fontSize: '16px',
            padding: tokens.spacing[1],
          }}
          aria-label="Dismiss alert"
        >
          ×
        </button>
      )}
    </div>
  );
};