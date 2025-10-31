import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthErrorDisplay, AuthSuccessDisplay } from '../AuthErrorDisplay';

describe('AuthErrorDisplay', () => {
  it('renders nothing when no error', () => {
    const { container } = render(<AuthErrorDisplay error={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders validation error correctly', () => {
    const error = {
      type: 'validation' as const,
      message: 'Invalid input',
      details: ['Field is required', 'Must be valid email'],
    };

    render(<AuthErrorDisplay error={error} />);
    
    expect(screen.getByText('Validation Error')).toBeInTheDocument();
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
    expect(screen.getByText('Field is required')).toBeInTheDocument();
    expect(screen.getByText('Must be valid email')).toBeInTheDocument();
  });

  it('renders network error with retry button', () => {
    const mockRetry = vi.fn();
    const error = {
      type: 'network' as const,
      message: 'Connection failed',
      retryable: true,
    };

    render(<AuthErrorDisplay error={error} onRetry={mockRetry} />);
    
    expect(screen.getByText('Connection Error')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Try Again');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalled();
  });

  it('renders rate limit error', () => {
    const error = {
      type: 'rate_limit' as const,
      message: 'Too many requests',
    };

    render(<AuthErrorDisplay error={error} />);
    
    expect(screen.getByText('Too Many Attempts')).toBeInTheDocument();
    expect(screen.getByText('Too many requests')).toBeInTheDocument();
  });

  it('shows error code when provided', () => {
    const error = {
      type: 'server' as const,
      message: 'Server error',
      code: 'ERR_500',
    };

    render(<AuthErrorDisplay error={error} />);
    
    expect(screen.getByText('Error Code: ERR_500')).toBeInTheDocument();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const mockDismiss = vi.fn();
    const error = {
      type: 'validation' as const,
      message: 'Test error',
    };

    render(<AuthErrorDisplay error={error} onDismiss={mockDismiss} />);
    
    const dismissButton = screen.getByLabelText('Dismiss error');
    fireEvent.click(dismissButton);
    
    expect(mockDismiss).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    const error = {
      type: 'validation' as const,
      message: 'Test error',
    };

    render(<AuthErrorDisplay error={error} />);
    
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('AuthSuccessDisplay', () => {
  it('renders success message', () => {
    render(<AuthSuccessDisplay message="Operation successful" />);
    
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation successful')).toBeInTheDocument();
  });

  it('renders details when provided', () => {
    render(
      <AuthSuccessDisplay 
        message="Operation successful" 
        details="Additional information"
      />
    );
    
    expect(screen.getByText('Additional information')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const mockAction = vi.fn();
    render(
      <AuthSuccessDisplay 
        message="Operation successful"
        onAction={mockAction}
        actionLabel="Continue"
      />
    );
    
    const actionButton = screen.getByText('Continue');
    expect(actionButton).toBeInTheDocument();
    
    fireEvent.click(actionButton);
    expect(mockAction).toHaveBeenCalled();
  });

  it('has proper accessibility attributes', () => {
    render(<AuthSuccessDisplay message="Test success" />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});