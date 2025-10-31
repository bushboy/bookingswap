import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ErrorBoundary,
  useErrorBoundary,
  withErrorBoundary,
  BookingErrorBoundary,
  SwapErrorBoundary,
  FormErrorBoundary,
} from '../ErrorBoundary';

// Mock console.error to avoid noise in tests
const mockConsoleError = vi.fn();
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(mockConsoleError);
  mockConsoleError.mockClear();
});

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; error?: Error }> = ({
  shouldThrow = true,
  error = new Error('Test error'),
}) => {
  if (shouldThrow) {
    throw error;
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/We're sorry, but something unexpected happened/)
    ).toBeInTheDocument();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should show retry button when allowRetry is true', () => {
    render(
      <ErrorBoundary allowRetry={true}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should hide retry button when allowRetry is false', () => {
    render(
      <ErrorBoundary allowRetry={false}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('should reset error state when retry is clicked', () => {
    const { rerender } = render(
      <ErrorBoundary allowRetry={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Click retry button
    fireEvent.click(screen.getByText('Try Again'));

    // Re-render with no error
    rerender(
      <ErrorBoundary allowRetry={true}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should show error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <ErrorBoundary>
        <ThrowError error={new Error('Detailed test error')} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Show Error Details')).toBeInTheDocument();

    // Click to show details
    fireEvent.click(screen.getByText('Show Error Details'));

    expect(screen.getByText('Hide Error Details')).toBeInTheDocument();
    expect(screen.getByText(/Detailed test error/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should show error ID when provided', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
  });

  it('should handle reload button click', () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Reload Page'));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('should handle go back button click', () => {
    // Mock window.history.back
    const mockBack = vi.fn();
    Object.defineProperty(window, 'history', {
      value: { back: mockBack },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByText('Go Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('useErrorBoundary', () => {
  const TestComponent: React.FC = () => {
    const { captureError, resetError } = useErrorBoundary();

    return (
      <div>
        <button onClick={() => captureError(new Error('Manual error'))}>
          Throw Error
        </button>
        <button onClick={resetError}>Reset Error</button>
        <span>Component rendered</span>
      </div>
    );
  };

  it('should throw error when captureError is called', () => {
    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Component rendered')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Throw Error'));

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.queryByText('Component rendered')).not.toBeInTheDocument();
  });
});

describe('withErrorBoundary', () => {
  const TestComponent: React.FC<{ shouldThrow?: boolean }> = ({
    shouldThrow = false,
  }) => {
    if (shouldThrow) {
      throw new Error('HOC test error');
    }
    return <div>HOC component rendered</div>;
  };

  it('should wrap component with error boundary', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent shouldThrow={false} />);

    expect(screen.getByText('HOC component rendered')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const WrappedComponent = withErrorBoundary(TestComponent);

    render(<WrappedComponent shouldThrow={true} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.queryByText('HOC component rendered')
    ).not.toBeInTheDocument();
  });

  it('should pass error boundary props to wrapper', () => {
    const onError = vi.fn();
    const WrappedComponent = withErrorBoundary(TestComponent, { onError });

    render(<WrappedComponent shouldThrow={true} />);

    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('Specialized Error Boundaries', () => {
  describe('BookingErrorBoundary', () => {
    it('should render booking-specific error message', () => {
      render(
        <BookingErrorBoundary>
          <ThrowError />
        </BookingErrorBoundary>
      );

      expect(screen.getByText('Booking Error')).toBeInTheDocument();
      expect(
        screen.getByText(/There was an issue loading your bookings/)
      ).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('SwapErrorBoundary', () => {
    it('should render swap-specific error message', () => {
      render(
        <SwapErrorBoundary>
          <ThrowError />
        </SwapErrorBoundary>
      );

      expect(screen.getByText('Swap Error')).toBeInTheDocument();
      expect(
        screen.getByText(/There was an issue with the swap functionality/)
      ).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  describe('FormErrorBoundary', () => {
    it('should render form-specific error message', () => {
      render(
        <FormErrorBoundary>
          <ThrowError />
        </FormErrorBoundary>
      );

      expect(screen.getByText('Form Error')).toBeInTheDocument();
      expect(
        screen.getByText(/The form encountered an error/)
      ).toBeInTheDocument();
    });

    it('should show retry button when onRetry is provided', () => {
      const onRetry = vi.fn();

      render(
        <FormErrorBoundary onRetry={onRetry}>
          <ThrowError />
        </FormErrorBoundary>
      );

      const retryButton = screen.getByText('Try Again');
      expect(retryButton).toBeInTheDocument();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('should not show retry button when onRetry is not provided', () => {
      render(
        <FormErrorBoundary>
          <ThrowError />
        </FormErrorBoundary>
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
    });
  });
});
