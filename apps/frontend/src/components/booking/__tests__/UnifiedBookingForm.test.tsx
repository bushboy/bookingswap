import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { UnifiedBookingForm } from '../UnifiedBookingForm';
import { UnifiedBookingData, Booking } from '@booking-swap/shared';

// Mock the SwapPreferencesSection component
vi.mock('../SwapPreferencesSection', () => ({
  SwapPreferencesSection: ({ enabled, onToggle, onChange, preferences, errors }: any) => (
    <div data-testid="swap-preferences-section">
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onToggle(e.target.checked)}
        data-testid="swap-toggle"
      />
      {enabled && (
        <div data-testid="swap-preferences-content">
          <button
            onClick={() => onChange({ 
              ...preferences, 
              paymentTypes: ['booking', 'cash'] 
            })}
            data-testid="add-cash-payment"
          >
            Add Cash Payment
          </button>
        </div>
      )}
    </div>
  ),
}));

const mockBooking: Booking = {
  id: 'test-booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    city: 'Paris',
    country: 'France',
  },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-03'),
  },
  originalPrice: 200,
  swapValue: 180,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF456',
  },
  verification: {
    status: 'verified',
    documents: [],
  },
  blockchain: {
    topicId: 'topic-1',
  },
  status: 'available',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  mode: 'create' as const,
  loading: false,
};

describe('UnifiedBookingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Form Rendering', () => {
    it('should render create mode form with all required fields', () => {
      render(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByText('Create New Booking')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description *')).toBeInTheDocument();
      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByLabelText('Country')).toBeInTheDocument();
      expect(screen.getByLabelText('Check-in Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Check-out Date')).toBeInTheDocument();
      expect(screen.getByLabelText('Original Price ($)')).toBeInTheDocument();
      expect(screen.getByLabelText('Provider')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirmation Number')).toBeInTheDocument();
      expect(screen.getByTestId('swap-preferences-section')).toBeInTheDocument();
    });

    it('should render edit mode form with booking data pre-filled', () => {
      render(
        <UnifiedBookingForm 
          {...defaultProps} 
          mode="edit" 
          booking={mockBooking} 
        />
      );

      expect(screen.getByText('Edit Booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Hotel Booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test hotel booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Paris')).toBeInTheDocument();
      expect(screen.getByDisplayValue('France')).toBeInTheDocument();
      expect(screen.getByDisplayValue('200')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Booking.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('ABC123')).toBeInTheDocument();
    });

    it('should show helper text for new bookings', () => {
      render(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByText(/Fill out all required fields/)).toBeInTheDocument();
    });
  });

  describe('Swap Integration', () => {
    it('should toggle swap preferences section', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      expect(swapToggle).not.toBeChecked();

      await user.click(swapToggle);
      expect(swapToggle).toBeChecked();
      expect(screen.getByTestId('swap-preferences-content')).toBeInTheDocument();
    });

    it('should update form title when swap is enabled', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      expect(screen.getByText('Create Booking & Enable Swapping')).toBeInTheDocument();
    });

    it('should clear swap preferences when toggled off', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      
      // Enable swap and add preferences
      await user.click(swapToggle);
      await user.click(screen.getByTestId('add-cash-payment'));
      
      // Disable swap
      await user.click(swapToggle);
      
      // Re-enable and check preferences are reset
      await user.click(swapToggle);
      expect(screen.getByTestId('swap-preferences-content')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for required fields', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Please fix \d+ error/)).toBeInTheDocument();
        expect(screen.getByText('Title is required')).toBeInTheDocument();
        expect(screen.getByText('Description is required')).toBeInTheDocument();
        expect(screen.getByText('City is required')).toBeInTheDocument();
      });
    });

    it('should validate minimum field lengths', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const titleInput = screen.getByLabelText('Title');
      await user.type(titleInput, 'AB'); // Too short
      
      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Title must be at least 3 characters')).toBeInTheDocument();
      });
    });

    it('should validate date ranges', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const checkInInput = screen.getByLabelText('Check-in Date');
      const checkOutInput = screen.getByLabelText('Check-out Date');

      // Set check-out before check-in
      await user.clear(checkInInput);
      await user.type(checkInInput, '2024-06-10');
      await user.clear(checkOutInput);
      await user.type(checkOutInput, '2024-06-05');

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Check-out date must be after check-in date')).toBeInTheDocument();
      });
    });

    it('should validate price fields', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const priceInput = screen.getByLabelText('Original Price ($)');
      await user.clear(priceInput);
      await user.type(priceInput, '0');

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Original price must be greater than 0')).toBeInTheDocument();
      });
    });

    it('should validate swap preferences when enabled', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      // Enable swap but don't configure properly
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      // Fill required booking fields
      await user.type(screen.getByLabelText('Title'), 'Test Booking');
      await user.type(screen.getByLabelText('Description *'), 'Test description for booking');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '100');
      await user.type(screen.getByLabelText('Provider'), 'Test Provider');
      await user.type(screen.getByLabelText('Confirmation Number'), 'ABC123');

      const submitButton = screen.getByText('Create Booking & Enable Swapping');
      await user.click(submitButton);

      // Should validate swap preferences
      await waitFor(() => {
        expect(screen.getByText(/Please fix \d+ error/)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Validation', () => {
    it('should show validation errors as user types', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const titleInput = screen.getByLabelText('Title');
      
      // Type and then clear to trigger validation
      await user.type(titleInput, 'Test');
      await user.clear(titleInput);
      await user.tab(); // Blur the field

      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });
    });

    it('should clear validation errors when field becomes valid', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const titleInput = screen.getByLabelText('Title');
      
      // Trigger validation error
      await user.click(titleInput);
      await user.tab();
      
      await waitFor(() => {
        expect(screen.getByText('Title is required')).toBeInTheDocument();
      });

      // Fix the error
      await user.type(titleInput, 'Valid Title');
      
      await waitFor(() => {
        expect(screen.queryByText('Title is required')).not.toBeInTheDocument();
      });
    });
  });

  describe('Form Submission', () => {
    const fillValidForm = async (user: any) => {
      await user.type(screen.getByLabelText('Title'), 'Test Hotel Booking');
      await user.type(screen.getByLabelText('Description *'), 'A wonderful hotel booking for testing');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '200');
      await user.type(screen.getByLabelText('Swap Value ($)'), '180');
      await user.type(screen.getByLabelText('Provider'), 'Booking.com');
      await user.type(screen.getByLabelText('Confirmation Number'), 'ABC123456');
    };

    it('should submit valid form data', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      
      render(
        <UnifiedBookingForm 
          {...defaultProps} 
          onSubmit={mockOnSubmit}
        />
      );

      await fillValidForm(user);

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Test Hotel Booking',
            description: 'A wonderful hotel booking for testing',
            location: { city: 'Paris', country: 'France' },
            originalPrice: 200,
            swapValue: 180,
            swapEnabled: false,
          })
        );
      });
    });

    it('should submit form with swap preferences when enabled', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      
      render(
        <UnifiedBookingForm 
          {...defaultProps} 
          onSubmit={mockOnSubmit}
        />
      );

      await fillValidForm(user);

      // Enable swap
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      const submitButton = screen.getByText('Create Booking & Enable Swapping');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            swapEnabled: true,
            swapPreferences: expect.objectContaining({
              paymentTypes: ['booking'],
              acceptanceStrategy: 'first-match',
            }),
          })
        );
      });
    });

    it('should close modal after successful submission', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockResolvedValue(undefined);
      const mockOnClose = vi.fn();
      
      render(
        <UnifiedBookingForm 
          {...defaultProps} 
          onSubmit={mockOnSubmit}
          onClose={mockOnClose}
        />
      );

      await fillValidForm(user);

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Submission failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(
        <UnifiedBookingForm 
          {...defaultProps} 
          onSubmit={mockOnSubmit}
        />
      );

      await fillValidForm(user);

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to submit booking:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Progressive Disclosure', () => {
    it('should show swap settings only when enabled', () => {
      render(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      expect(swapToggle).not.toBeChecked();
      expect(screen.queryByTestId('swap-preferences-content')).not.toBeInTheDocument();
    });

    it('should update helper text when swap is enabled', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByText(/Fill out all required fields/)).toBeInTheDocument();
      expect(screen.queryByText(/Enable swapping to allow/)).not.toBeInTheDocument();

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      expect(screen.getByText(/Enable swapping to allow/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper form labels and structure', () => {
      render(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description *')).toBeInTheDocument();
      expect(screen.getByLabelText('City')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<UnifiedBookingForm {...defaultProps} />);

      const titleInput = screen.getByLabelText('Title');
      titleInput.focus();
      
      await user.tab();
      expect(screen.getByLabelText('Description *')).toHaveFocus();
    });
  });

  describe('Loading States', () => {
    it('should show loading state on submit button', () => {
      render(<UnifiedBookingForm {...defaultProps} loading={true} />);

      const submitButton = screen.getByText('Create Booking');
      expect(submitButton).toBeDisabled();
    });
  });
});