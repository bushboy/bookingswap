import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  WalletErrorBoundary,
  withWalletErrorBoundary,
  useWalletErrorHandler,
} from '../WalletErrorBoundary';
import { createWalletError } from '../../../utils/walletErrorHandling';
import { WalletErrorType } from '../../../types/wallet';

// Test component that throws an error
const ThrowingComponent: React.FC<{
  shouldThrow?: boolean;
  errorMessage?: string;
}> = ({ shouldThrow = false, errorMessage = 'Test error' }) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div>Working component</div>;
};

// Test component using the error handler hook
const ComponentWithErrorHandler: React.FC = () => {
  const { error, handleError, clearError, retryWithErrorHandling } =
    useWalletErrorHandler();

  const triggerError = () => {
    handleError(new Error('Test error from hook'));
  };

  const triggerRetryError = async () => {
    await retryWithErrorHandling(async () => {
      throw new Error('Retry error');
    });
  };

  if (error) {
    return (
      <div>
        <div>Error: {error.message}</div>
        <button onClick={clearError}>Clear Error</button>
      </div>
    );
  }

  return (
    <div>
      <div>No error</div>
      <button onClick={triggerError}>Trigger Error</button>
      <button onClick={triggerRetryError}>Trigger Retry Error</button>
    </div>
  );
};

describe('WalletErrorBoundary', () => {
  // Suppress console.error for these tests since we're intentionally throwing errors
  const originalConsoleError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('WalletErrorBoundary', () => {
    it('should render children when there is no error', () => {
      render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </WalletErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('should catch errors and render default fallback', () => {
      render(
        <WalletErrorBoundary>
          <ThrowingComponent
            shouldThrow={true}
            errorMessage="Test error message"
          />
        </WalletErrorBoundary>
      );

      expect(screen.getByText('Connection Error')).toBeInTheDocument();
      expect(
        screen.getByText('An unexpected error occurred in the wallet component')
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Try Again' })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Refresh Page' })
      ).toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = vi.fn();

      render(
        <WalletErrorBoundary onError={onError}>
          <ThrowingComponent
            shouldThrow={true}
            errorMessage="Callback test error"
          />
        </WalletErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: WalletErrorType.UNKNOWN_ERROR,
          message: 'Callback test error',
        }),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should use custom fallback when provided', () => {
      const customFallback = (error: any, retry: () => void) => (
        <div>
          <div>Custom fallback: {error.message}</div>
          <button onClick={retry}>Custom Retry</button>
        </div>
      );

      render(
        <WalletErrorBoundary fallback={customFallback}>
          <ThrowingComponent
            shouldThrow={true}
            errorMessage="Custom fallback test"
          />
        </WalletErrorBoundary>
      );

      expect(screen.getByText(/Custom fallback:/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Custom Retry' })
      ).toBeInTheDocument();
    });

    it('should reset error state when retry is clicked', () => {
      const { rerender } = render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalletErrorBoundary>
      );

      // Error should be displayed
      expect(screen.getByText('Connection Error')).toBeInTheDocument();

      // Click retry
      const retryButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(retryButton);

      // Re-render with non-throwing component
      rerender(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </WalletErrorBoundary>
      );

      // Should show working component
      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('should handle refresh page action', () => {
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true,
      });

      render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalletErrorBoundary>
      );

      const refreshButton = screen.getByRole('button', {
        name: 'Refresh Page',
      });
      fireEvent.click(refreshButton);

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('should show technical details when expanded', () => {
      render(
        <WalletErrorBoundary>
          <ThrowingComponent
            shouldThrow={true}
            errorMessage="Technical details test"
          />
        </WalletErrorBoundary>
      );

      const detailsElement = screen.getByText('Technical Details');
      fireEvent.click(detailsElement);

      expect(
        screen.getByText(/Error: Technical details test/)
      ).toBeInTheDocument();
    });
  });

  describe('withWalletErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const WrappedComponent = withWalletErrorBoundary(ThrowingComponent);

      render(<WrappedComponent shouldThrow={false} />);
      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('should catch errors in wrapped component', () => {
      const WrappedComponent = withWalletErrorBoundary(ThrowingComponent);

      render(<WrappedComponent shouldThrow={true} />);
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });

    it('should pass through error boundary props', () => {
      const onError = vi.fn();
      const WrappedComponent = withWalletErrorBoundary(ThrowingComponent, {
        onError,
      });

      render(<WrappedComponent shouldThrow={true} />);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should set correct display name', () => {
      const TestComponent = () => <div>Test</div>;
      TestComponent.displayName = 'TestComponent';

      const WrappedComponent = withWalletErrorBoundary(TestComponent);
      expect(WrappedComponent.displayName).toBe(
        'withWalletErrorBoundary(TestComponent)'
      );
    });

    it('should handle components without display name', () => {
      const TestComponent = () => <div>Test</div>;

      const WrappedComponent = withWalletErrorBoundary(TestComponent);
      expect(WrappedComponent.displayName).toBe(
        'withWalletErrorBoundary(TestComponent)'
      );
    });
  });

  describe('useWalletErrorHandler hook', () => {
    it('should handle errors and provide clear function', () => {
      render(<ComponentWithErrorHandler />);

      expect(screen.getByText('No error')).toBeInTheDocument();

      // Trigger error
      const triggerButton = screen.getByRole('button', {
        name: 'Trigger Error',
      });
      fireEvent.click(triggerButton);

      expect(
        screen.getByText('Error: Test error from hook')
      ).toBeInTheDocument();

      // Clear error
      const clearButton = screen.getByRole('button', { name: 'Clear Error' });
      fireEvent.click(clearButton);

      expect(screen.getByText('No error')).toBeInTheDocument();
    });

    it('should handle wallet errors correctly', () => {
      const ComponentWithWalletError: React.FC = () => {
        const { error, handleError, clearError } = useWalletErrorHandler();

        const triggerWalletError = () => {
          const walletError = createWalletError(
            WalletErrorType.CONNECTION_REJECTED,
            'User rejected connection'
          );
          handleError(walletError);
        };

        if (error) {
          return (
            <div>
              <div>Wallet Error: {error.message}</div>
              <div>Type: {error.type}</div>
              <button onClick={clearError}>Clear Error</button>
            </div>
          );
        }

        return (
          <div>
            <div>No error</div>
            <button onClick={triggerWalletError}>Trigger Wallet Error</button>
          </div>
        );
      };

      render(<ComponentWithWalletError />);

      const triggerButton = screen.getByRole('button', {
        name: 'Trigger Wallet Error',
      });
      fireEvent.click(triggerButton);

      expect(
        screen.getByText('Wallet Error: User rejected connection')
      ).toBeInTheDocument();
      expect(screen.getByText('Type: CONNECTION_REJECTED')).toBeInTheDocument();
    });

    it('should handle retry with error handling', async () => {
      render(<ComponentWithErrorHandler />);

      const retryButton = screen.getByRole('button', {
        name: 'Trigger Retry Error',
      });
      fireEvent.click(retryButton);

      // Wait for async operation
      await screen.findByText('Error: Retry error');
      expect(screen.getByText('Error: Retry error')).toBeInTheDocument();
    });

    it('should convert generic errors to wallet errors', () => {
      const ComponentWithGenericError: React.FC = () => {
        const { error, handleError } = useWalletErrorHandler();

        const triggerGenericError = () => {
          handleError(new Error('Generic error message'));
        };

        if (error) {
          return (
            <div>
              <div>Error Type: {error.type}</div>
              <div>Error Message: {error.message}</div>
            </div>
          );
        }

        return (
          <button onClick={triggerGenericError}>Trigger Generic Error</button>
        );
      };

      render(<ComponentWithGenericError />);

      const triggerButton = screen.getByRole('button', {
        name: 'Trigger Generic Error',
      });
      fireEvent.click(triggerButton);

      expect(screen.getByText('Error Type: UNKNOWN_ERROR')).toBeInTheDocument();
      expect(
        screen.getByText('Error Message: Generic error message')
      ).toBeInTheDocument();
    });
  });

  describe('Default Error Fallback', () => {
    it('should show appropriate error icon', () => {
      render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalletErrorBoundary>
      );

      // Check for SVG icon
      const icon =
        screen.getByRole('img', { hidden: true }) ||
        document.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('should have proper styling classes', () => {
      const { container } = render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalletErrorBoundary>
      );

      const errorContainer = container.querySelector('.bg-gray-50');
      expect(errorContainer).toBeInTheDocument();
      expect(errorContainer).toHaveClass(
        'rounded-lg',
        'border',
        'border-gray-200'
      );
    });

    it('should be accessible', () => {
      render(
        <WalletErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </WalletErrorBoundary>
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('focus:outline-none');
      });
    });
  });
});
