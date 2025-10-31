/**
 * Tests for BookingEditErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BookingEditErrorBoundary } from '../BookingEditErrorBoundary';
import { BookingEditErrors } from '@booking-swap/shared';

// Mock child component that can throw errors
const ThrowError: React.FC<{ shouldThrow?: boolean; errorType?: string }> = ({ 
  shouldThrow = false, 
  errorType = 'generic' 
}) => {
  if (shouldThrow) {
    if (errorType === 'validation') {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      (error as any).validationErrors = {
        title: 'Title is required',
        originalPrice: 'Price must be positive',
      } as BookingEditErrors;
      throw error;
    } else if (errorType === 'network') {
      throw new Error('Network connection failed');
    } else if (errorType === 'auth') {
      throw new Error('Unauthorized access');
    } else {
      throw new Error('Something went wrong');
    }
  }
  return <div>Child component</div>;
};

describe('BookingEditErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when no error occurs', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={false} />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
  });

  it('should render error fallback when child throws error', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Booking Edit Error')).toBeInTheDocument();
    expect(screen.getByText(/There was an issue with editing your booking/)).toBeInTheDocument();
  });

  it('should render validation-specific error for validation errors', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} errorType="validation" />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Booking Information Invalid')).toBeInTheDocument();
    expect(screen.getByText(/Some of the booking information is invalid/)).toBeInTheDocument();
    expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
    expect(screen.getByText(/Title: Title is required/)).toBeInTheDocument();
    expect(screen.getByText(/OriginalPrice: Price must be positive/)).toBeInTheDocument();
  });

  it('should render network-specific error for network errors', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} errorType="network" />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText(/Unable to save your booking changes due to a connection issue/)).toBeInTheDocument();
  });

  it('should render auth-specific error for authentication errors', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} errorType="auth" />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    expect(screen.getByText(/You need to be logged in to edit bookings/)).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const onRetry = jest.fn();

    render(
      <BookingEditErrorBoundary onRetry={onRetry}>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  it('should call onNavigateBack when back button is clicked', () => {
    const onNavigateBack = jest.fn();

    render(
      <BookingEditErrorBoundary onNavigateBack={onNavigateBack}>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    const backButton = screen.getByText('Back to Bookings');
    fireEvent.click(backButton);

    expect(onNavigateBack).toHaveBeenCalledTimes(1);
  });

  it('should show technical details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    const detailsButton = screen.getByText('Show Technical Details');
    fireEvent.click(detailsButton);

    expect(screen.getByText('Hide Technical Details')).toBeInTheDocument();
    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText(/Message:/)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;

    render(
      <BookingEditErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Booking Edit Error')).not.toBeInTheDocument();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <BookingEditErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      })
    );
  });

  it('should display error ID for tracking', () => {
    render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText(/Error ID: booking_edit_error_/)).toBeInTheDocument();
  });

  it('should show appropriate action buttons based on error type', () => {
    // Network error should show reload button
    const { rerender } = render(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} errorType="network" />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Reload Page')).toBeInTheDocument();

    // Validation error should not show reload button
    rerender(
      <BookingEditErrorBoundary>
        <ThrowError shouldThrow={true} errorType="validation" />
      </BookingEditErrorBoundary>
    );

    expect(screen.queryByText('Reload Page')).not.toBeInTheDocument();
  });

  it('should customize retry button text for validation errors', () => {
    render(
      <BookingEditErrorBoundary onRetry={jest.fn()}>
        <ThrowError shouldThrow={true} errorType="validation" />
      </BookingEditErrorBoundary>
    );

    expect(screen.getByText('Fix and Try Again')).toBeInTheDocument();
  });
});