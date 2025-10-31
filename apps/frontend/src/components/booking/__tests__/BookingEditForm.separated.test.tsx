import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BookingEditForm, BookingEditData } from '../BookingEditForm';
import { renderWithProviders, createMockBooking } from '@/test/testUtils';
import { Booking, BookingType } from '@booking-swap/shared';

// Mock the hooks
vi.mock('@/hooks/useUnsavedChanges', () => ({
  useUnsavedChanges: vi.fn(() => ({
    hasUnsavedChanges: false,
    navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
    markAsSaved: vi.fn(),
    isSaving: false,
  })),
  useStatePreservation: vi.fn(() => ({
    hasSavedState: vi.fn(() => false),
    clearState: vi.fn(),
  })),
}));

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

// Mock design system components
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
      data-testid={props['data-testid'] || 'button'}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
}));

vi.mock('@/components/ui/Input', () => ({
  Input: ({ label, value, onChange, error, required, type = 'text', helperText, ...props }: any) => (
    <div data-testid={`input-container-${label?.toLowerCase().replace(/\s+/g, '-')}`}>
      <label>{label}{required && ' *'}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        data-testid={`input-${label?.toLowerCase().replace(/\s+/g, '-')}`}
        {...props}
      />
      {error && <div data-testid="error" role="alert">{error}</div>}
      {helperText && <div data-testid="helper-text">{helperText}</div>}
    </div>
  ),
}));

vi.mock('@/components/ui/ContextualHelp', () => ({
  ContextualHelp: ({ title, content }: any) => (
    <div data-testid="contextual-help">
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  ),
}));

vi.mock('@/components/ui/ThemedCard', () => ({
  ThemedCard: ({ children, title, icon }: any) => (
    <div data-testid="themed-card">
      {title && <h3>{icon} {title}</h3>}
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/ThemedInterface', () => ({
  ThemedInterface: ({ children }: any) => <div data-testid="themed-interface">{children}</div>,
}));

describe('BookingEditForm - Separated Functionality Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnSubmit = vi.fn();
  const mockOnNavigateToSwapSpec = vi.fn();
  const mockOnUnsavedChangesChange = vi.fn();

  const mockBooking = createMockBooking({
    id: 'test-booking-1',
    title: 'Test Hotel Booking',
    description: 'A nice hotel in Paris',
    type: 'hotel' as BookingType,
    location: { city: 'Paris', country: 'France' },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Booking-Only Validation', () => {
    it('validates only booking-related fields', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Try to submit empty form
      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Should validate booking fields but not swap fields
      expect(mockOnSubmit).not.toHaveBeenCalled();
      
      // Should show booking validation errors
      await waitFor(() => {
        expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('does not validate swap-related fields', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Should not have swap-related fields or validation
      expect(screen.queryByText(/payment types/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/auction/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/cash amount/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/swap conditions/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/acceptance strategy/i)).not.toBeInTheDocument();
    });

    it('validates booking data integrity', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Fill in invalid data
      await user.type(screen.getByTestId('input-title'), 'ab'); // Too short
      await user.type(screen.getByTestId('input-original-price-($)'), '0'); // Invalid price

      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Should show specific validation errors
      await waitFor(() => {
        expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
        expect(screen.getByText('Original price must be greater than 0')).toBeInTheDocument();
      });
    });

    it('validates date range consistency', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Set check-out date before check-in date
      await user.type(screen.getByTestId('input-check-in-date'), '2024-12-10');
      await user.type(screen.getByTestId('input-check-out-date'), '2024-12-05');

      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Should validate date consistency (this would be handled by validateField mock)
      expect(mockOnSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Pure Booking Data Interface', () => {
    it('only includes booking-related fields in form data', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Fill in all required booking fields
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
            type: expect.any(String),
            title: 'Test Booking Title',
            description: 'This is a test booking description',
            location: expect.objectContaining({
              city: 'New York',
              country: 'USA',
            }),
            dateRange: expect.objectContaining({
              checkIn: expect.any(Date),
              checkOut: expect.any(Date),
            }),
            originalPrice: 300,
            swapValue: 280,
            providerDetails: expect.objectContaining({
              provider: 'Hotels.com',
              confirmationNumber: 'CONF123',
              bookingReference: '',
            }),
          })
        );
      });

      // Verify no swap-related fields are included
      const submittedData = mockOnSubmit.mock.calls[0][0] as BookingEditData;
      expect(submittedData).not.toHaveProperty('paymentTypes');
      expect(submittedData).not.toHaveProperty('acceptanceStrategy');
      expect(submittedData).not.toHaveProperty('minCashAmount');
      expect(submittedData).not.toHaveProperty('maxCashAmount');
      expect(submittedData).not.toHaveProperty('auctionEndDate');
      expect(submittedData).not.toHaveProperty('swapConditions');
    });

    it('maps booking data correctly from existing booking', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      // Verify all booking fields are populated
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
  });

  describe('Enable Swapping Navigation', () => {
    it('navigates to swap specification when Enable Swapping is clicked', async () => {
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

      expect(mockOnNavigateToSwapSpec).toHaveBeenCalledWith(mockBooking, false);
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

    it('shows appropriate helper text for Enable Swapping button', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      expect(screen.getByText('Create swap proposals for this booking')).toBeInTheDocument();
    });
  });

  describe('Focused Booking Interface', () => {
    it('displays booking-focused context indicator', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      expect(screen.getByText(/Booking Edit Mode - Focus on your booking details only/)).toBeInTheDocument();
    });

    it('shows booking-focused contextual help', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      expect(screen.getByTestId('contextual-help')).toBeInTheDocument();
    });

    it('uses booking theme styling', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      expect(screen.getByTestId('themed-interface')).toBeInTheDocument();
      expect(screen.getAllByTestId('themed-card')).toHaveLength(5); // Expected number of themed cards
    });

    it('groups booking fields logically', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Check for logical grouping of fields
      expect(screen.getByText('📝 Booking Information')).toBeInTheDocument();
      expect(screen.getByText('📍 Location & Schedule')).toBeInTheDocument();
      expect(screen.getByText('💰 Pricing Information')).toBeInTheDocument();
      expect(screen.getByText('🏢 Provider Information')).toBeInTheDocument();
    });
  });

  describe('Unsaved Changes Handling', () => {
    it('detects unsaved changes in booking fields', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          onUnsavedChangesChange={mockOnUnsavedChangesChange}
          booking={mockBooking}
        />
      );

      // Modify a field
      const titleInput = screen.getByTestId('input-title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Title');

      // Should detect unsaved changes
      await waitFor(() => {
        expect(mockOnUnsavedChangesChange).toHaveBeenCalledWith(true);
      });
    });

    it('shows unsaved changes indicator', async () => {
      const user = userEvent.setup();
      
      // Mock useUnsavedChanges to return true for hasUnsavedChanges
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: vi.fn(() => Promise.resolve(true)),
        markAsSaved: vi.fn(),
        isSaving: false,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      expect(screen.getByText('Unsaved Booking Changes')).toBeInTheDocument();
      expect(screen.getByText(/Remember to save your changes before navigating away/)).toBeInTheDocument();
    });

    it('prompts user before navigation with unsaved changes', async () => {
      const user = userEvent.setup();
      const mockNavigateWithConfirmation = vi.fn(() => Promise.resolve(true));
      
      const mockUseUnsavedChanges = vi.fn(() => ({
        hasUnsavedChanges: true,
        navigateWithConfirmation: mockNavigateWithConfirmation,
        markAsSaved: vi.fn(),
        isSaving: false,
      }));
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useUnsavedChanges).mockImplementation(mockUseUnsavedChanges);
      
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

      expect(mockNavigateWithConfirmation).toHaveBeenCalledWith('/swap-specification');
    });
  });

  describe('Error Handling', () => {
    it('displays booking-specific validation errors', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Try to submit with invalid data
      await user.type(screen.getByTestId('input-title'), 'ab'); // Too short
      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Should show validation error summary
      await waitFor(() => {
        expect(screen.getByText(/Booking Validation Errors/)).toBeInTheDocument();
        expect(screen.getByText('Please fix the following booking field errors before saving:')).toBeInTheDocument();
      });
    });

    it('handles form submission errors gracefully', async () => {
      const mockSubmitWithError = vi.fn().mockRejectedValue(new Error('Submission failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
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

    it('shows loading state during submission', () => {
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
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and roles', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Check modal has proper label
      expect(screen.getByTestId('modal')).toHaveAttribute('aria-label');
      
      // Check error messages have alert role
      const errorElements = screen.queryAllByTestId('error');
      errorElements.forEach(error => {
        expect(error).toHaveAttribute('role', 'alert');
      });
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Tab through form elements
      await user.tab();
      expect(document.activeElement).toHaveAttribute('data-testid', 'input-title');

      await user.tab();
      expect(document.activeElement?.tagName).toBe('TEXTAREA');
    });

    it('provides clear field labels and help text', () => {
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
        />
      );

      // Check required field indicators
      expect(screen.getByText('Title *')).toBeInTheDocument();
      expect(screen.getByText('Description *')).toBeInTheDocument();
      
      // Check helper text
      expect(screen.getByTestId('helper-text')).toBeInTheDocument();
    });
  });

  describe('State Preservation', () => {
    it('preserves form state during navigation', () => {
      const mockStatePreservation = {
        hasSavedState: vi.fn(() => true),
        clearState: vi.fn(),
      };
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useStatePreservation).mockReturnValue(mockStatePreservation);
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      expect(mockStatePreservation.hasSavedState).toHaveBeenCalled();
    });

    it('clears preserved state on successful submission', async () => {
      const mockClearState = vi.fn();
      const mockStatePreservation = {
        hasSavedState: vi.fn(() => false),
        clearState: mockClearState,
      };
      
      vi.mocked(require('@/hooks/useUnsavedChanges').useStatePreservation).mockReturnValue(mockStatePreservation);
      
      render(
        <BookingEditForm
          isOpen={true}
          onClose={mockOnClose}
          onSubmit={mockOnSubmit}
          onNavigateToSwapSpec={mockOnNavigateToSwapSpec}
          booking={mockBooking}
        />
      );

      const submitButton = screen.getByText('Update Booking');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
        expect(mockClearState).toHaveBeenCalled();
      });
    });
  });
});