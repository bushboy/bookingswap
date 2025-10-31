import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { globalErrorHandler, ErrorContext } from '@/utils/errorHandling';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: ErrorContext;
  showDetails?: boolean;
  allowRetry?: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error through global error handler
    globalErrorHandler.handleError(error, {
      ...this.props.context,
      component: 'ErrorBoundary',
      metadata: {
        ...this.props.context?.metadata,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={
            this.props.allowRetry !== false ? this.handleRetry : undefined
          }
          onReload={this.handleReload}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  onRetry?: () => void;
  onReload: () => void;
  showDetails?: boolean;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReload,
  showDetails = false,
}) => {
  const [detailsVisible, setDetailsVisible] = React.useState(false);

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: tokens.spacing[8],
    textAlign: 'center',
    backgroundColor: tokens.colors.neutral[50],
    border: `1px solid ${tokens.colors.neutral[200]}`,
    borderRadius: tokens.borderRadius.lg,
    margin: tokens.spacing[4],
  };

  const iconStyles: React.CSSProperties = {
    fontSize: '4rem',
    marginBottom: tokens.spacing[4],
    color: tokens.colors.error[500],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize['2xl'],
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.neutral[900],
    marginBottom: tokens.spacing[2],
  };

  const messageStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.neutral[600],
    marginBottom: tokens.spacing[6],
    maxWidth: '500px',
    lineHeight: 1.5,
  };

  const actionsStyles: React.CSSProperties = {
    display: 'flex',
    gap: tokens.spacing[3],
    marginBottom: tokens.spacing[4],
  };

  const detailsStyles: React.CSSProperties = {
    marginTop: tokens.spacing[4],
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.neutral[100],
    borderRadius: tokens.borderRadius.md,
    textAlign: 'left',
    fontSize: tokens.typography.fontSize.sm,
    fontFamily: 'monospace',
    maxWidth: '100%',
    overflow: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>💥</div>

      <h2 style={titleStyles}>Something went wrong</h2>

      <p style={messageStyles}>
        We're sorry, but something unexpected happened. The error has been
        reported and we're working to fix it. You can try refreshing the page or
        going back.
      </p>

      {errorId && (
        <p
          style={{
            fontSize: tokens.typography.fontSize.sm,
            color: tokens.colors.neutral[500],
            marginBottom: tokens.spacing[4],
          }}
        >
          Error ID: {errorId}
        </p>
      )}

      <div style={actionsStyles}>
        {onRetry && (
          <Button onClick={onRetry} variant="primary">
            Try Again
          </Button>
        )}

        <Button onClick={onReload} variant="outline">
          Reload Page
        </Button>

        <Button onClick={() => window.history.back()} variant="outline">
          Go Back
        </Button>
      </div>

      {(showDetails || process.env.NODE_ENV === 'development') && (
        <div>
          <Button
            onClick={() => setDetailsVisible(!detailsVisible)}
            variant="ghost"
            size="sm"
          >
            {detailsVisible ? 'Hide' : 'Show'} Error Details
          </Button>

          {detailsVisible && (
            <div style={detailsStyles}>
              <strong>Error:</strong> {error?.name || 'Unknown Error'}
              <br />
              <strong>Message:</strong>{' '}
              {error?.message || 'No message available'}
              <br />
              {error?.stack && (
                <>
                  <strong>Stack Trace:</strong>
                  <br />
                  {error.stack}
                </>
              )}
              {errorInfo?.componentStack && (
                <>
                  <br />
                  <strong>Component Stack:</strong>
                  <br />
                  {errorInfo.componentStack}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Hook for using error boundary functionality in functional components
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { captureError, resetError };
}

/**
 * Higher-order component for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Specialized error boundaries for different parts of the application
 */

export const BookingErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context={{
      component: 'BookingSection',
      operation: 'booking_management',
    }}
    fallback={
      <div
        style={{
          padding: tokens.spacing[6],
          textAlign: 'center',
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <h3
          style={{
            color: tokens.colors.error[600],
            marginBottom: tokens.spacing[2],
          }}
        >
          Booking Error
        </h3>
        <p
          style={{
            color: tokens.colors.neutral[600],
            marginBottom: tokens.spacing[4],
          }}
        >
          There was an issue loading your bookings. Please try refreshing the
          page.
        </p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const SwapErrorBoundary: React.FC<{ children: ReactNode }> = ({
  children,
}) => (
  <ErrorBoundary
    context={{
      component: 'SwapSection',
      operation: 'swap_management',
    }}
    fallback={
      <div
        style={{
          padding: tokens.spacing[6],
          textAlign: 'center',
          backgroundColor: tokens.colors.neutral[50],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.neutral[200]}`,
        }}
      >
        <h3
          style={{
            color: tokens.colors.error[600],
            marginBottom: tokens.spacing[2],
          }}
        >
          Swap Error
        </h3>
        <p
          style={{
            color: tokens.colors.neutral[600],
            marginBottom: tokens.spacing[4],
          }}
        >
          There was an issue with the swap functionality. Please try again.
        </p>
        <Button onClick={() => window.location.reload()}>Refresh</Button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

export const FormErrorBoundary: React.FC<{
  children: ReactNode;
  onRetry?: () => void;
}> = ({ children, onRetry }) => (
  <ErrorBoundary
    context={{
      component: 'Form',
      operation: 'form_interaction',
    }}
    allowRetry={!!onRetry}
    fallback={
      <div
        style={{
          padding: tokens.spacing[4],
          textAlign: 'center',
          backgroundColor: tokens.colors.error[50],
          borderRadius: tokens.borderRadius.md,
          border: `1px solid ${tokens.colors.error[200]}`,
        }}
      >
        <h4
          style={{
            color: tokens.colors.error[700],
            marginBottom: tokens.spacing[2],
          }}
        >
          Form Error
        </h4>
        <p
          style={{
            color: tokens.colors.error[600],
            marginBottom: tokens.spacing[3],
          }}
        >
          The form encountered an error. Please try again.
        </p>
        {onRetry && (
          <Button onClick={onRetry} size="sm">
            Try Again
          </Button>
        )}
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);
