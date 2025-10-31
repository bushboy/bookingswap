import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/Button';
import { tokens } from '@/design-system/tokens';
import { globalErrorHandler, ErrorContext } from '@/utils/errorHandling';
import { SwapSpecificationErrors } from '@booking-swap/shared';

interface SwapSpecificationErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  validationErrors?: SwapSpecificationErrors;
}

interface SwapSpecificationErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  onNavigateToBookingEdit?: () => void;
  onNavigateBack?: () => void;
  context?: ErrorContext;
  showDetails?: boolean;
}

/**
 * Specialized error boundary for swap specification interfaces
 * Provides swap-specific error handling and recovery options
 */
export class SwapSpecificationErrorBoundary extends Component<
  SwapSpecificationErrorBoundaryProps,
  SwapSpecificationErrorBoundaryState
> {
  constructor(props: SwapSpecificationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SwapSpecificationErrorBoundaryState {
    // Check if this is a validation error
    const validationErrors = error.name === 'ValidationError' && 
      (error as any).validationErrors ? (error as any).validationErrors : undefined;

    return {
      hasError: true,
      error,
      validationErrors,
      errorId: `swap_spec_error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error through global error handler with swap context
    globalErrorHandler.handleError(error, {
      ...this.props.context,
      component: 'SwapSpecificationErrorBoundary',
      operation: 'swap_specification',
      metadata: {
        ...this.props.context?.metadata,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        interfaceType: 'swap_specification',
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

  handleNavigateToBookingEdit = () => {
    if (this.props.onNavigateToBookingEdit) {
      this.props.onNavigateToBookingEdit();
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

      // Default swap specification error UI
      return (
        <SwapSpecificationErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          validationErrors={this.state.validationErrors}
          onRetry={this.props.onRetry ? this.handleRetry : undefined}
          onNavigateToBookingEdit={this.props.onNavigateToBookingEdit ? this.handleNavigateToBookingEdit : undefined}
          onNavigateBack={this.handleNavigateBack}
          onReload={this.handleReload}
          showDetails={this.props.showDetails}
        />
      );
    }

    return this.props.children;
  }
}

interface SwapSpecificationErrorFallbackProps {
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  validationErrors?: SwapSpecificationErrors;
  onRetry?: () => void;
  onNavigateToBookingEdit?: () => void;
  onNavigateBack: () => void;
  onReload: () => void;
  showDetails?: boolean;
}

const SwapSpecificationErrorFallback: React.FC<SwapSpecificationErrorFallbackProps> = ({
  error,
  errorInfo,
  errorId,
  validationErrors,
  onRetry,
  onNavigateToBookingEdit,
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
    border: `2px solid ${tokens.colors.warning[200]}`,
    borderRadius: tokens.borderRadius.lg,
    margin: tokens.spacing[4],
    maxWidth: '600px',
    marginLeft: 'auto',
    marginRight: 'auto',
  };

  const iconStyles: React.CSSProperties = {
    fontSize: '3rem',
    marginBottom: tokens.spacing[4],
    color: tokens.colors.warning[500],
  };

  const titleStyles: React.CSSProperties = {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.warning[700],
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
    backgroundColor: tokens.colors.warning[50],
    borderRadius: tokens.borderRadius.md,
    border: `1px solid ${tokens.colors.warning[200]}`,
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
  const isWalletError = error?.message?.includes('wallet') || error?.message?.includes('connection');
  const isNetworkError = error?.message?.includes('network') || error?.message?.includes('fetch');
  const isAuthError = error?.message?.includes('unauthorized') || error?.message?.includes('authentication');
  const isBlockchainError = error?.message?.includes('blockchain') || error?.message?.includes('transaction');

  let title = 'Swap Specification Error';
  let message = 'There was an issue with your swap specification. You can try again or return to edit your booking.';

  if (isValidationError) {
    title = 'Swap Settings Invalid';
    message = 'Some of your swap settings are invalid. Please check the highlighted fields and try again.';
  } else if (isWalletError) {
    title = 'Wallet Connection Issue';
    message = 'There was a problem with your wallet connection. Please check your wallet and try again.';
  } else if (isBlockchainError) {
    title = 'Blockchain Transaction Error';
    message = 'There was an issue processing the blockchain transaction. Please try again or check your wallet.';
  } else if (isNetworkError) {
    title = 'Connection Error';
    message = 'Unable to save your swap settings due to a connection issue. Please check your internet connection and try again.';
  } else if (isAuthError) {
    title = 'Authentication Required';
    message = 'You need to be logged in to create swap specifications. Please log in and try again.';
  }

  return (
    <div style={containerStyles}>
      <div style={iconStyles}>🔄</div>

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
            color: tokens.colors.warning[700], 
            marginBottom: tokens.spacing[2],
            fontSize: tokens.typography.fontSize.base,
            fontWeight: tokens.typography.fontWeight.semibold,
          }}>
            Please fix the following issues:
          </h4>
          <ul style={{ 
            margin: 0, 
            paddingLeft: tokens.spacing[4],
            color: tokens.colors.warning[600],
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

        {onNavigateToBookingEdit && (
          <Button onClick={onNavigateToBookingEdit} variant="outline">
            Edit Booking Instead
          </Button>
        )}

        <Button onClick={onNavigateBack} variant="outline">
          Back to Bookings
        </Button>

        {(isNetworkError || isAuthError || isWalletError) && (
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
 * Higher-order component for wrapping swap specification components with error boundary
 */
export function withSwapSpecificationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<SwapSpecificationErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <SwapSpecificationErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SwapSpecificationErrorBoundary>
  );

  WrappedComponent.displayName = `withSwapSpecificationErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for using swap specification error boundary functionality in functional components
 */
export function useSwapSpecificationErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  const captureError = React.useCallback((error: Error, validationErrors?: SwapSpecificationErrors) => {
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