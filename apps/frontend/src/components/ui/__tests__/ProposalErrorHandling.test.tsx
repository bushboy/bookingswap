import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ErrorMessage, 
  FieldValidationError, 
  UserFriendlyError, 
  InlineErrorAlert 
} from '../ProposalErrorHandling';
import { ValidationErrorSummary, CompactValidationErrors } from '../ValidationErrorSummary';
import { ProposalErrorBoundary } from '../ProposalErrorBoundary';

// Mock the design tokens
vi.mock('../../../design-system/tokens', () => ({
  tokens: {
    spacing: { 1: '4px', 2: '8px', 3: '12px', 4: '16px', 6: '24px', 8: '32px' },
    colors: {
      error: { 50: '#fef2f2', 200: '#fecaca', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b' },
      warning: { 50: '#fffbeb', 200: '#fed7aa', 600: '#d97706', 700: '#b45309' },
      primary: { 50: '#eff6ff', 200: '#bfdbfe', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' },
      neutral: { 600: '#525252', 700: '#404040' },
      success: { 500: '#10b981' },
    },
    typography: {
      fontSize: { sm: '14px', base: '16px', lg: '18px' },
      fontWeight: { medium: '500', semibold: '600' },
    },
    borderRadius: { sm: '4px', md: '8px' },
  },
}));

// Mock the error handling utility
vi.mock('../../../utils/errorHandling', () => ({
  formatErrorForUser: vi.fn((error) => ({
    title: 'Test Error',
    message: typeof error === 'string' ? error : error.message,
    details: 'Test details',
    actions: [{ label: 'Retry', action: 'retry' }],
    severity: 'error',
  })),
}));

describe('ErrorMessage Component', () => {
  const mockRetry = vi.fn();
  const mockDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error message with title and description', () => {
    render(
      <ErrorMessage
        error="Test error message"
        title="Test Error Title"
        onRetry={mockRetry}
        onDismiss={mockDismiss}
      />
    );

    expect(screen.getByText('Test Error Title')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows retry button when canRetry is true', () => {
    render(
      <ErrorMessage
        error="Test error"
        onRetry={mockRetry}
        canRetry={true}
      />
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when retrying', () => {
    render(
      <ErrorMessage
        error="Test error"
        onRetry={mockRetry}
        canRetry={true}
        isRetrying={true}
      />
    );

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled();
  });

  it('shows dismiss button and handles dismiss', () => {
    render(
      <ErrorMessage
        error="Test error"
        onDismiss={mockDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    expect(dismissButton).toBeInTheDocument();
    
    fireEvent.click(dismissButton);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('applies correct context styling', () => {
    const { rerender } = render(
      <ErrorMessage error="Test error" context="network" />
    );

    // Check for network context icon
    expect(screen.getByText('🌐')).toBeInTheDocument();

    rerender(<ErrorMessage error="Test error" context="authentication" />);
    expect(screen.getByText('🔐')).toBeInTheDocument();

    rerender(<ErrorMessage error="Test error" context="validation" />);
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });
});

describe('FieldValidationError Component', () => {
  it('renders single error message', () => {
    render(
      <FieldValidationError
        fieldName="email"
        error="Email is required"
      />
    );

    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('renders multiple error messages as list', () => {
    render(
      <FieldValidationError
        fieldName="password"
        errors={['Password is required', 'Password must be at least 8 characters']}
      />
    );

    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  it('renders warnings with warning icon', () => {
    render(
      <FieldValidationError
        fieldName="phone"
        warning="Phone number format may not be recognized"
      />
    );

    expect(screen.getByText('Phone number format may not be recognized')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders both errors and warnings', () => {
    render(
      <FieldValidationError
        fieldName="username"
        error="Username is required"
        warning="Username should be unique"
      />
    );

    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Username should be unique')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('does not render when no errors or warnings', () => {
    const { container } = render(
      <FieldValidationError fieldName="test" />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('UserFriendlyError Component', () => {
  const mockRetry = vi.fn();
  const mockContactSupport = vi.fn();
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders network error with appropriate icon and message', () => {
    render(
      <UserFriendlyError
        errorType="network"
        onRetry={mockRetry}
      />
    );

    expect(screen.getByText('🌐')).toBeInTheDocument();
    expect(screen.getByText('Connection Problem')).toBeInTheDocument();
    expect(screen.getByText(/unable to connect to our servers/i)).toBeInTheDocument();
  });

  it('renders authentication error with login button', () => {
    render(
      <UserFriendlyError
        errorType="authentication"
        onLogin={mockLogin}
      />
    );

    expect(screen.getByText('🔐')).toBeInTheDocument();
    expect(screen.getByText('Authentication Required')).toBeInTheDocument();
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    fireEvent.click(loginButton);
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('renders server error with retry and support options', () => {
    render(
      <UserFriendlyError
        errorType="server"
        onRetry={mockRetry}
        onContactSupport={mockContactSupport}
      />
    );

    expect(screen.getByText('🔧')).toBeInTheDocument();
    expect(screen.getByText('Server Error')).toBeInTheDocument();
    
    const retryButton = screen.getByRole('button', { name: /try again/i });
    const supportButton = screen.getByRole('button', { name: /contact support/i });
    
    fireEvent.click(retryButton);
    fireEvent.click(supportButton);
    
    expect(mockRetry).toHaveBeenCalledTimes(1);
    expect(mockContactSupport).toHaveBeenCalledTimes(1);
  });

  it('shows technical details when originalError is provided', () => {
    render(
      <UserFriendlyError
        errorType="unknown"
        originalError="Detailed error message for debugging"
      />
    );

    const detailsToggle = screen.getByText('Technical Details');
    fireEvent.click(detailsToggle);
    
    expect(screen.getByText('Detailed error message for debugging')).toBeInTheDocument();
  });
});

describe('InlineErrorAlert Component', () => {
  const mockDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error alert with message', () => {
    render(
      <InlineErrorAlert
        message="This is an error message"
        type="error"
      />
    );

    expect(screen.getByText('This is an error message')).toBeInTheDocument();
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('renders warning alert with warning icon', () => {
    render(
      <InlineErrorAlert
        message="This is a warning message"
        type="warning"
      />
    );

    expect(screen.getByText('This is a warning message')).toBeInTheDocument();
    expect(screen.getByText('⚠️')).toBeInTheDocument();
  });

  it('renders info alert with info icon', () => {
    render(
      <InlineErrorAlert
        message="This is an info message"
        type="info"
      />
    );

    expect(screen.getByText('This is an info message')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  it('handles dismiss functionality', () => {
    render(
      <InlineErrorAlert
        message="Dismissible message"
        onDismiss={mockDismiss}
      />
    );

    const dismissButton = screen.getByRole('button', { name: /dismiss alert/i });
    fireEvent.click(dismissButton);
    
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ValidationErrorSummary Component', () => {
  const mockFieldFocus = vi.fn();
  const mockDismiss = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders validation errors summary', () => {
    const errors = {
      email: 'Email is required',
      password: ['Password is required', 'Password too short'],
    };

    render(
      <ValidationErrorSummary
        errors={errors}
        onFieldFocus={mockFieldFocus}
      />
    );

    expect(screen.getByText('Please fix the following issues:')).toBeInTheDocument();
    expect(screen.getByText(/email.*email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/password.*password is required, password too short/i)).toBeInTheDocument();
  });

  it('handles field focus when clicking on error', () => {
    const errors = { email: 'Email is required' };

    render(
      <ValidationErrorSummary
        errors={errors}
        onFieldFocus={mockFieldFocus}
      />
    );

    const errorButton = screen.getByRole('button', { name: /focus on email field/i });
    fireEvent.click(errorButton);
    
    expect(mockFieldFocus).toHaveBeenCalledWith('email');
  });

  it('shows warnings section when warnings provided', () => {
    const errors = { email: 'Email is required' };
    const warnings = { phone: 'Phone format may not be recognized' };

    render(
      <ValidationErrorSummary
        errors={errors}
        warnings={warnings}
      />
    );

    expect(screen.getByText('Warnings:')).toBeInTheDocument();
    expect(screen.getByText(/phone.*phone format may not be recognized/i)).toBeInTheDocument();
  });

  it('limits displayed errors when maxErrors is set', () => {
    const errors = {
      field1: 'Error 1',
      field2: 'Error 2',
      field3: 'Error 3',
      field4: 'Error 4',
    };

    render(
      <ValidationErrorSummary
        errors={errors}
        maxErrors={2}
      />
    );

    expect(screen.getByText(/field1.*error 1/i)).toBeInTheDocument();
    expect(screen.getByText(/field2.*error 2/i)).toBeInTheDocument();
    expect(screen.getByText('And 2 more errors...')).toBeInTheDocument();
  });

  it('does not render when no errors or warnings', () => {
    const { container } = render(
      <ValidationErrorSummary errors={{}} />
    );

    expect(container.firstChild).toBeNull();
  });
});

describe('CompactValidationErrors Component', () => {
  it('renders compact error display', () => {
    const errors = ['First error', 'Second error', 'Third error'];

    render(
      <CompactValidationErrors errors={errors} />
    );

    expect(screen.getByText('First error')).toBeInTheDocument();
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.getByText('Third error')).toBeInTheDocument();
  });

  it('limits displayed errors and shows remaining count', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3', 'Error 4'];

    render(
      <CompactValidationErrors errors={errors} maxDisplay={2} />
    );

    expect(screen.getByText('Error 1')).toBeInTheDocument();
    expect(screen.getByText('Error 2')).toBeInTheDocument();
    expect(screen.getByText('+2 more errors')).toBeInTheDocument();
  });

  it('renders warnings when provided', () => {
    const errors = ['Error message'];
    const warnings = ['Warning message'];

    render(
      <CompactValidationErrors errors={errors} warnings={warnings} />
    );

    expect(screen.getByText('Error message')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('does not render when no errors or warnings', () => {
    const { container } = render(
      <CompactValidationErrors errors={[]} />
    );

    expect(container.firstChild).toBeNull();
  });
});

// Error Boundary Tests
describe('ProposalErrorBoundary Component', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
      throw new Error('Test error');
    }
    return <div>No error</div>;
  };

  it('renders children when no error occurs', () => {
    render(
      <ProposalErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ProposalErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('renders error UI when error occurs', () => {
    render(
      <ProposalErrorBoundary context="proposal-modal">
        <ThrowError shouldThrow={true} />
      </ProposalErrorBoundary>
    );

    expect(screen.getByText('Proposal System Error')).toBeInTheDocument();
    expect(screen.getByText(/something unexpected happened/i)).toBeInTheDocument();
  });

  it('shows retry button and handles retry', async () => {
    const { rerender } = render(
      <ProposalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ProposalErrorBoundary>
    );

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);

    // After retry, render without error
    rerender(
      <ProposalErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ProposalErrorBoundary>
    );

    await waitFor(() => {
      expect(screen.getByText('No error')).toBeInTheDocument();
    });
  });

  it('shows technical details when expanded', () => {
    render(
      <ProposalErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ProposalErrorBoundary>
    );

    const detailsToggle = screen.getByText('Technical Details');
    fireEvent.click(detailsToggle);

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
});