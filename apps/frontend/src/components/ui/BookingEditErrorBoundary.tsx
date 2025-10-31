import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { globalErrorHandler, ErrorContext } from '@/utils/errorHandling';
import { BookingEditErrors } from '@booking-swap/shared';

interface BookingEditErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  validationErrors?: BookingEditErrors;
}

interface BookingEditErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  onNavigateBack?: () => void;
  context?: ErrorContext;
  showDetails?: boolean;
}

/**
 * Specialized error boundary for booking edit interfaces
 * Provides booking-specific error handling and recovery options
 */
export class BookingEditErrorBoundary extends Component<
  BookingEditErrorBoundaryProps,
  BookingEditErrorBoundaryState
> {
  constructor(props: BookingEditErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): BookingEditErrorBoundaryState {
    // Check if this is a validation error
    const validationErrors = error.name === 'ValidationError' && 
      (error as any).validationErrors ? (error as any).validationErrors : undefined;

    return {
      hasError: true,
      error,
      validationErrors,
      errorId: `booking_edit_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error through global error handler with booking context
    globalErrorHandler.handleError(error, {
      ...this.props.context,
      component: 'BookingEditErrorBoundary',
      operation: 'booking_edit',
      metadata: {
        ...this.props.context?.metadata,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        interfaceType: 'booking_edit',
      },
    });
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      validationErrors: undefined 
    });
    
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  handleNavigateBack = () => {
    if (this.props.onNavigateBack) {
      this.props.onNavigateBack();
    } else {
      window.history.back();
    }
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

      // Default booking edit error UI
      return (
        <BookingEditErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          validationErrors={this.state.validationErrors}
          onRetry={this.props.onRetry ? this.handleRetry : undefined}
          onNavigateBack={this.handleNavigateBack}
          onReload={this.handleReload}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface BookingEditErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  validationErrors?: BookingEditErrors;
  onRetry?: () => void;
  onNavigateBack: () => void;
  onReload: () => void;
  showDetails?: boolean;
}

const BookingEditErrorFallback: React.FC<BookingEditErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  validationErrors,
  onRetry,
  onNavigateBack,
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
    border: `2px solid ${tokens.colors.error[200]}`,
    borderRadius: tokens.borderRadius.lg,
    margin: tokens.spacing[4],
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  };

  const iconStyles: React.CSSProperties = {
    fontSize: '3rem',
    marginBottom: tokens.spacing[4],
    color: tokens.colors.error[500],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.error[700],
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
    flexWrap: 'wrap',
    justifyContent: 'center',
  };

  const validationErrorsStyles: React.CSSProperties = {
    marginTop: tokens.spacing[4],
    padding: tokens.spacing[4],
    backgroundColor: tokens.colors.error[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.error[200]}`,
    textAlign: 'left',
    width: '100%',
    maxWidth: '500px',
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

  // Determine error type and customize message
  const isValidationError = validationErrors && Object.keys(validationErrors).length > 0;
  const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch');
  const isAuthError = error?.message?.includes('unauthorized') || error?.message?.includes('authentication');

  let title = 'Booking Edit Error';
  let message = 'There was an issue with editing your booking. Please try again or go back to your bookings.';

  if (isValidationError) {
    title = 'Booking Information Invalid';
    message = 'Some of the booking information is invalid. Please check the highlighted fields and try again.';
  } else if (isNetworkError) {
    title = 'Connection Error';
    message = 'Unable to save your booking changes due to a connection issue. Please check your internet connection and try again.';
  } else if (isAuthError) {
    title = 'Authentication Required';
    message = 'You need to be logged in to edit bookings. Please log in and try again.';
  }

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>📝</div>

      <h2 style={titleStyles}>{title}</h2>

      <p style={messageStyles}>{message}</p>

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

      {/* Display validation errors if present */}
      {isValidationError && validationErrors && (
        <div style={validationErrorsStyles}>
          <h4 style={{ 
            color: tokens.colors.error[700], 
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
          }}>
            Please fix the following issues:
          </h4>
          <ul style={{ 
            margin: 0, 
            paddingLeft: tokens.spacing[4],
            color: tokens.colors.error[600],
          }}>
            {Object.entries(validationErrors).map(([field, errorMessage]) => (
              errorMessage && (
                <li key={field} style={{ marginBottom: tokens.spacing[1] }}>
                  <strong>{field.charAt(0).toUpperCase() + field.slice(1)}:</strong> {errorMessage}
                </li>
              )
            ))}
          </ul>
        </div>
      )}

      <div style={actionsStyles}>
        {onRetry && (
          <Button onClick={onRetry} variant="primary">
            {isValidationError ? 'Fix and Try Again' : 'Try Again'}
          </Button>
        )}

        <Button onClick={onNavigateBack} variant="outline">
          Back to Bookings
        </Button>

        {(isNetworkError || isAuthError) && (
          <Button onClick={onReload} variant="outline">
            Reload Page
          </Button>
        )}
      </div>

      {(showDetails || process.env.NODE_ENV === 'development') && (
        <div>
          <Button
            onClick={() => setDetailsVisible(!detailsVisible)}
            variant="ghost"
            size="sm"
          >
            {detailsVisible ? 'Hide' : 'Show'} Technical Details
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
 * Higher-order component for wrapping booking edit components with error boundary
 */
export function withBookingEditErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<BookingEditErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <BookingEditErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </BookingEditErrorBoundary>
  );

  WrappedComponent.displayName = `withBookingEditErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for using booking edit error boundary functionality in functional components
 */
export function useBookingEditErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const captureError = React.useCallback((error: Error, validationErrors?: BookingEditErrors) => {
    // Enhance error with validation context if provided
    if (validationErrors) {
      (error as any).validationErrors = validationErrors;
      error.name = 'ValidationError';
    }
    setError(error);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  return { captureError, resetError };
}