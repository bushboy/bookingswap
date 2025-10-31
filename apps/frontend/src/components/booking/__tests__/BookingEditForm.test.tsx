import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingEditForm, BookingEditData } from '../BookingEditForm';
import { Booking, BookingType } from '@booking-swap/shared';

// Mock the validation utilities
vi.mock('@/utils/validation', () => ({
  validateField: vi.fn((field: string, value: any) => {
    if (field === 'title' && (!value || value.length < 3)) {
      return 'Title must be at least 3 characters';
    }
    if (field === 'description' && (!value || value.length < 10)) {
      return 'Description must be at least 10 characters';
    }
    if (field === 'city' && !value) {
      return 'City is required';
    }
    if (field === 'country' && !value) {
      return 'Country is required';
    }
    if (field === 'originalPrice' && (!value || value <= 0)) {
      return 'Original price must be greater than 0';
    }
    if (field === 'swapValue' && (!value || value <= 0)) {
      return 'Swap value must be greater than 0';
    }
    if (field === 'provider' && !value) {
      return 'Provider is required';
    }
    if (field === 'confirmationNumber' && (!value || value.length < 3)) {
      return 'Confirmation number must be at least 3 characters';
    }
    if (field === 'checkIn' && !value) {
      return 'Check-in date is required';
    }
    if (field === 'checkOut' && !value) {
      return 'Check-out date is required';
    }
    return '';
  }),
  getValidationErrorCount: vi.fn((errors: any) => {
    return Object.keys(errors).filter(key => errors[key]).length;
  }),
}));

// Mock the design system tokens
vi.mock('@/design-system/tokens', () => ({
  tokens: {
    spacing: {
      1: '4px',
      2: '8px',
      3: '12px',
      4: '16px',
      6: '24px',
    },
    typography: {
      fontSize: {
        sm: '14px',
        base: '16px',
      },
      fontWeight: {
        medium: '500',
      },
    },
    colors: {
      primary: {
        50: '#f0f9ff',
        200: '#bae6fd',
        700: '#0369a1',
        800: '#075985',
      },
      secondary: {
        50: '#f8fafc',
        300: '#cbd5e1',
        700: '#334155',
      },
      error: {
        50: '#fef2f2',
        200: '#fecaca',
        400: '#f87171',
        600: '#dc2626',
        700: '#b91c1c',
        800: '#991b1b',
      },
      neutral: {
        200: '#e5e7eb',
        300: '#d1d5db',
        700: '#374151',
        900: '#111827',
      },
    },
    borderRadius: {
      md: '6px',
    },
  },
}));

// Mock UI components
vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen, title }: any) =>
    isOpen ? <div data-testid="modal" aria-label={title}>{children}</div> : null,
}));

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children, onClick, type, variant, loading, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      type={type}
      disabled={loading || disabled}
      data-variant={variant}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: ({ label, value, onChange, error, required, type = 'text', ...props }: any) => (
    <div>
      <label>{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        data-testid={`input-${label?.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
      {error && <div data-testid="error">{error}</div>}
    </div>
  ),
}));

const mockBooking: Booking = {
  id: 'test-booking-1',
  userId: 'user-1',
  type: 'hotel' as BookingType,
  title: 'Test Hotel Booking',
  description: 'A nice hotel in Paris',
  location: {
    city: 'Paris',
    country: 'France',
  },
  dateRange: {
    checkIn: new Date('2024-12-01'),
    checkOut: new Date('2024-12-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456',
  },
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
    documents: [],
  },
  blockchain: {
    topicId: 'topic-1',
  },
  status: 'available',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BookingEditForm', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnNavigateToSwapSpec = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form when open', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    expect(screen.getByTestId('modal')).toBeInTheDocument();
    expect(screen.getByLabelText('Edit Booking')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <BookingEditForm
        isOpen={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('populates form with booking data when editing', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={mockBooking}
      />
    );

    expect(screen.getByDisplayValue('Test Hotel Booking')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A nice hotel in Paris')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Paris')).toBeInTheDocument();
    expect(screen.getByDisplayValue('France')).toBeInTheDocument();
    expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    expect(screen.getByDisplayValue('450')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Booking.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ABC123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('REF456')).toBeInTheDocument();
  });

  it('shows booking-focused helper text', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    expect(screen.getByText(/Edit your booking details below/)).toBeInTheDocument();
    expect(screen.getByText(/Use "Enable Swapping" to create swap proposals/)).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    const submitButton = screen.getByText('Update Booking');
    fireEvent.click(submitButton);

    // The form should not submit when validation fails
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits valid booking data', async () => {
    const user = userEvent.setup();

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    // Fill in all required fields
    await user.type(screen.getByTestId('input-title'), 'Test Booking Title');
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'This is a test booking description');
    await user.type(screen.getByTestId('input-city'), 'New York');
    await user.type(screen.getByTestId('input-country'), 'USA');
    await user.type(screen.getByTestId('input-original-price-($)'), '300');
    await user.type(screen.getByTestId('input-swap-value-($)'), '280');
    await user.type(screen.getByTestId('input-provider'), 'Hotels.com');
    await user.type(screen.getByTestId('input-confirmation-number'), 'CONF123');

    const submitButton = screen.getByText('Update Booking');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test Booking Title',
          description: 'This is a test booking description',
          location: {
            city: 'New York',
            country: 'USA',
          },
          originalPrice: 300,
          swapValue: 280,
          providerDetails: {
            provider: 'Hotels.com',
            confirmationNumber: 'CONF123',
            bookingReference: '',
          },
        })
      );
    });
  });

  it('calls onNavigateToSwapSpec when Enable Swapping is clicked', async () => {
    const user = userEvent.setup();

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={mockBooking}
      />
    );

    const enableSwappingButton = screen.getByText('🔄 Enable Swapping');
    await user.click(enableSwappingButton);

    expect(mockOnNavigateToSwapSpec).toHaveBeenCalledWith(mockBooking);
  });

  it('disables Enable Swapping button when no booking is provided', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    const enableSwappingButton = screen.getByText('🔄 Enable Swapping');
    expect(enableSwappingButton).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows loading state on submit button', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('validates individual fields on change after being touched', async () => {
    const user = userEvent.setup();

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    const titleInput = screen.getByTestId('input-title');

    // Touch the field first
    await user.type(titleInput, 'ab');
    await user.clear(titleInput);
    await user.type(titleInput, 'a');

    // Should show validation error for short title (may appear in multiple places)
    await waitFor(() => {
      expect(screen.getAllByText('Title must be at least 3 characters')).toHaveLength(2);
    });
  });

  it('does not include swap-related fields or validation', () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    // Should not have swap-related fields
    expect(screen.queryByText(/payment types/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/auction/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/cash amount/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/swap conditions/i)).not.toBeInTheDocument();
  });

  it('resets form data when modal opens with different booking', () => {
    const { rerender } = render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={mockBooking}
      />
    );

    expect(screen.getByDisplayValue('Test Hotel Booking')).toBeInTheDocument();

    const differentBooking = {
      ...mockBooking,
      id: 'different-booking',
      title: 'Different Booking Title',
    };

    rerender(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={differentBooking}
      />
    );

    expect(screen.getByDisplayValue('Different Booking Title')).toBeInTheDocument();
  });

  it('handles form submission errors gracefully', async () => {
    const mockSubmitWithError = vi.fn().mockRejectedValue(new Error('Submission failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockSubmitWithError}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={mockBooking}
      />
    );

    const submitButton = screen.getByText('Update Booking');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitWithError).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to submit booking:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('keeps modal open when submission fails with validation errors', async () => {
    const mockSubmitWithError = vi.fn().mockRejectedValue(new Error('Validation failed: Title is required'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockSubmitWithError}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        booking={mockBooking}
      />
    );

    const submitButton = screen.getByText('Update Booking');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmitWithError).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to submit booking:', expect.any(Error));
    });

    // Verify that onClose was NOT called (modal should stay open)
    expect(mockOnClose).not.toHaveBeenCalled();

    // Verify that the error handling log message was shown
    expect(consoleLogSpy).toHaveBeenCalledWith('Form submission failed, keeping modal open for user to retry');

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('handles provider dropdown selection correctly', async () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    // Find the provider dropdown
    const providerSelect = screen.getByLabelText(/provider/i);
    expect(providerSelect).toBeInTheDocument();

    // Should have default empty option
    expect(providerSelect).toHaveValue('');

    // Select a predefined provider
    fireEvent.change(providerSelect, { target: { value: 'Booking.com' } });
    expect(providerSelect).toHaveValue('Booking.com');

    // Select "Other" option
    fireEvent.change(providerSelect, { target: { value: 'Other' } });
    expect(providerSelect).toHaveValue('Other');

    // Custom provider input should appear
    await waitFor(() => {
      const customProviderInput = screen.getByLabelText(/custom provider/i);
      expect(customProviderInput).toBeInTheDocument();
    });
  });

  it('validates custom provider input when Other is selected', async () => {
    render(
      <BookingEditForm
        isOpen={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
      />
    );

    // Select "Other" provider
    const providerSelect = screen.getByLabelText(/provider/i);
    fireEvent.change(providerSelect, { target: { value: 'Other' } });

    // Custom provider input should appear
    await waitFor(() => {
      const customProviderInput = screen.getByLabelText(/custom provider/i);
      expect(customProviderInput).toBeInTheDocument();

      // Enter a custom provider name
      fireEvent.change(customProviderInput, { target: { value: 'My Custom Provider' } });
      expect(customProviderInput).toHaveValue('My Custom Provider');
    });
  });
});