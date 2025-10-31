import React, { Component, ErrorInfo, ReactNode } from 'react';
import { WalletError, WalletErrorType } from '../../types/wallet';
import {
  createWalletError,
  formatWalletErrorForUser,
} from '../../utils/walletErrorHandling';

interface WalletErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: WalletError, retry: () => void) => ReactNode;
  onError?: (error: WalletError, errorInfo: ErrorInfo) => void;
}

interface WalletErrorBoundaryState {
  hasError: boolean;
  error: WalletError | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary specifically for wallet-related components
 * Provides graceful error handling and recovery options
 */
export class WalletErrorBoundary extends Component<
  WalletErrorBoundaryProps,
  WalletErrorBoundaryState
> {
  constructor(props: WalletErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<WalletErrorBoundaryState> {
    // Convert generic error to WalletError
    const walletError = createWalletError(
      WalletErrorType.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred in the wallet component',
      { originalError: error }
    );

    return {
      hasError: true,
      error: walletError,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const walletError = createWalletError(
      WalletErrorType.UNKNOWN_ERROR,
      error.message || 'An unexpected error occurred in the wallet component',
      { originalError: error, componentStack: errorInfo.componentStack }
    );

    this.setState({
      errorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(walletError, errorInfo);

    // Log error for debugging
    console.error('Wallet Error Boundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default error UI
      return (
        <DefaultWalletErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default fallback component for wallet errors
 */
const DefaultWalletErrorFallback: React.FC<{
  error: WalletError;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  const errorInfo = formatWalletErrorForUser(error);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
      <div className="w-16 h-16 mb-4 text-gray-400">
        <svg fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-2">
        {errorInfo.title}
      </h3>

      <p className="text-gray-600 mb-4 max-w-md">{errorInfo.message}</p>

      {errorInfo.details && (
        <p className="text-sm text-gray-500 mb-4 max-w-md">
          {errorInfo.details}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Try Again
        </button>

        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Refresh Page
        </button>
      </div>

      {errorInfo.explanation && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Technical Details
          </summary>
          <div className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-600 max-w-md">
            <p className="mb-2">{errorInfo.explanation}</p>
            {error.details?.originalError && (
              <p className="font-mono text-xs">
                Error: {error.details.originalError.message || 'Unknown error'}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
};

/**
 * Higher-order component to wrap components with wallet error boundary
 */
export const withWalletErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<WalletErrorBoundaryProps, 'children'>
) => {
  const WrappedComponent = (props: P) => (
    <WalletErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </WalletErrorBoundary>
  );

  WrappedComponent.displayName = `withWalletErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

/**
 * Hook to handle errors in functional components
 */
export const useWalletErrorHandler = () => {
  const [error, setError] = React.useState<WalletError | null>(null);

  const handleError = React.useCallback((error: Error | WalletError) => {
    if ('type' in error && 'message' in error) {
      setError(error as WalletError);
    } else {
      setError(
        createWalletError(
          WalletErrorType.UNKNOWN_ERROR,
          error.message || 'An unexpected error occurred',
          { originalError: error }
        )
      );
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const retryWithErrorHandling = React.useCallback(
    async (operation: () => Promise<any>): Promise<any> => {
      try {
        clearError();
        return await operation();
      } catch (err) {
        handleError(err as Error);
        return null;
      }
    },
    [handleError, clearError]
  );

  return {
    error,
    handleError,
    clearError,
    retryWithErrorHandling,
  };
};
