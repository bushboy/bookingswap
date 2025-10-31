import React from 'react';
import { tokens } from '@/design-system/tokens';

export interface AuthError {
  type: 'validation' | 'network' | 'server' | 'rate_limit' | 'authentication' | 'rate_limiting' | 'server_error';
  message: string;
  code?: string;
  retryable?: boolean;
  details?: string[];
  category?: 'validation' | 'authentication' | 'rate_limiting' | 'server_error';
  timestamp?: string;
  requestId?: string;
}

// Backend error response interface
export interface BackendErrorResponse {
  error: {
    code: string;
    message: string;
    category: 'validation' | 'authentication' | 'rate_limiting' | 'server_error';
    retryable?: boolean;
    timestamp?: string;
    requestId?: string;
    details?: Record<string, any>;
  };
}

// Utility function to convert backend error to frontend error
export const convertBackendError = (backendError: BackendErrorResponse): AuthError => {
  const { error } = backendError;
  
  // Map backend categories to frontend types
  let type: AuthError['type'];
  switch (error.category) {
    case 'validation':
      type = 'validation';
      break;
    case 'authentication':
      type = 'authentication';
      break;
    case 'rate_limiting':
      type = 'rate_limit';
      break;
    case 'server_error':
      type = 'server';
      break;
    default:
      type = 'server';
  }

  return {
    type,
    message: error.message,
    code: error.code,
    retryable: error.retryable,
    category: error.category,
    timestamp: error.timestamp,
    requestId: error.requestId,
    details: error.details ? Object.values(error.details).map(String) : undefined,
  };
};

export interface AuthErrorDisplayProps {
  error: AuthError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const AuthErrorDisplay: React.FC<AuthErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
}) => {
  if (!error) return null;

  const getErrorIcon = () => {
    switch (error.type) {
      case 'network':
        return '🌐';
      case 'rate_limit':
        return '⏱️';
      case 'authentication':
        return '🔒';
      case 'server':
        return '⚠️';
      case 'validation':
      default:
        return '❌';
    }
  };

  const getErrorColor = () => {
    switch (error.type) {
      case 'rate_limit':
      case 'rate_limiting':
        return tokens.colors.warning;
      case 'network':
        return tokens.colors.primary;
      default:
        return tokens.colors.error;
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case 'network':
        return 'Connection Error';
      case 'rate_limit':
      case 'rate_limiting':
        return 'Too Many Attempts';
      case 'authentication':
        return 'Authentication Error';
      case 'server':
      case 'server_error':
        return 'Server Error';
      case 'validation':
        return 'Validation Error';
      default:
        return 'Error';
    }
  };

  const getSuggestedAction = () => {
    switch (error.type) {
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'rate_limit':
      case 'rate_limiting':
        return 'Please wait a few minutes before trying again.';
      case 'authentication':
        return 'Please verify your information and try again.';
      case 'server':
      case 'server_error':
        return 'Our servers are experiencing issues. Please try again later.';
      case 'validation':
        return 'Please correct the highlighted fields and try again.';
      default:
        return 'Please try again or contact support if the problem persists.';
    }
  };

  const errorColor = getErrorColor();

  return (
    <div
      className={className}
      role="alert"
      aria-live="assertive"
      style={{
        padding: tokens.spacing[4],
        backgroundColor: errorColor[50],
        border: `1px solid ${errorColor[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacing[3],
      }}>
        <span
          style={{
            fontSize: '20px',
            flexShrink: 0,
            marginTop: '2px',
          }}
          aria-hidden="true"
        >
          {getErrorIcon()}
        </span>

        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: tokens.spacing[2],
          }}>
            <h4 style={{
              margin: 0,
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold,
              color: errorColor[800],
            }}>
              {getErrorTitle()}
            </h4>

            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  color: errorColor[600],
                  cursor: 'pointer',
                  padding: tokens.spacing[1],
                  borderRadius: tokens.borderRadius.sm,
                  fontSize: '16px',
                  lineHeight: 1,
                }}
                aria-label="Dismiss error"
                title="Dismiss"
              >
                ×
              </button>
            )}
          </div>

          <p style={{
            margin: `0 0 ${tokens.spacing[2]} 0`,
            fontSize: tokens.typography.fontSize.sm,
            color: errorColor[700],
            lineHeight: tokens.typography.lineHeight.normal,
          }}>
            {error.message}
          </p>

          {error.details && error.details.length > 0 && (
            <ul style={{
              margin: `0 0 ${tokens.spacing[3]} 0`,
              paddingLeft: tokens.spacing[4],
              fontSize: tokens.typography.fontSize.sm,
              color: errorColor[600],
            }}>
              {error.details.map((detail, index) => (
                <li key={index} style={{ marginBottom: tokens.spacing[1] }}>
                  {detail}
                </li>
              ))}
            </ul>
          )}

          <p style={{
            margin: `0 0 ${tokens.spacing[3]} 0`,
            fontSize: tokens.typography.fontSize.sm,
            color: errorColor[600],
            fontStyle: 'italic',
          }}>
            {getSuggestedAction()}
          </p>

          {error.retryable && onRetry && (
            <button
              onClick={onRetry}
              style={{
                backgroundColor: errorColor[600],
                color: 'white',
                border: 'none',
                padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease-in-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = errorColor[700];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = errorColor[600];
              }}
            >
              Try Again
            </button>
          )}

          {(error.code || error.requestId) && (
            <div style={{
              marginTop: tokens.spacing[3],
              padding: tokens.spacing[2],
              backgroundColor: errorColor[100],
              borderRadius: tokens.borderRadius.sm,
              fontSize: tokens.typography.fontSize.xs,
              color: errorColor[600],
              fontFamily: tokens.typography.fontFamily.mono.join(', '),
            }}>
              {error.code && <div>Error Code: {error.code}</div>}
              {error.requestId && <div>Request ID: {error.requestId}</div>}
              {error.timestamp && (
                <div>Time: {new Date(error.timestamp).toLocaleString()}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export interface AuthSuccessDisplayProps {
  message: string;
  details?: string;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

export const AuthSuccessDisplay: React.FC<AuthSuccessDisplayProps> = ({
  message,
  details,
  onAction,
  actionLabel = 'Continue',
  className = '',
}) => {
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      style={{
        padding: tokens.spacing[4],
        backgroundColor: tokens.colors.success[50],
        border: `1px solid ${tokens.colors.success[200]}`,
        borderRadius: tokens.borderRadius.md,
        marginBottom: tokens.spacing[4],
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: tokens.spacing[3],
      }}>
        <span
          style={{
            fontSize: '20px',
            flexShrink: 0,
            marginTop: '2px',
          }}
          aria-hidden="true"
        >
          ✅
        </span>

        <div style={{ flex: 1 }}>
          <h4 style={{
            margin: `0 0 ${tokens.spacing[2]} 0`,
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
            color: tokens.colors.success[800],
          }}>
            Success!
          </h4>

          <p style={{
            margin: `0 0 ${details ? tokens.spacing[2] : tokens.spacing[3]} 0`,
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.success[700],
            lineHeight: tokens.typography.lineHeight.normal,
          }}>
            {message}
          </p>

          {details && (
            <p style={{
              margin: `0 0 ${tokens.spacing[3]} 0`,
              fontSize: tokens.typography.fontSize.sm,
              color: tokens.colors.success[600],
              fontStyle: 'italic',
            }}>
              {details}
            </p>
          )}

          {onAction && (
            <button
              onClick={onAction}
              style={{
                backgroundColor: tokens.colors.success[600],
                color: 'white',
                border: 'none',
                padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                fontWeight: tokens.typography.fontWeight.medium,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease-in-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.success[700];
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = tokens.colors.success[600];
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};