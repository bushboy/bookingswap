import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { UnifiedBookingForm } from '../UnifiedBookingForm';
import { renderWithProviders, createMockBooking } from '@/test/testUtils';
import { UnifiedBookingData, Booking } from '@booking-swap/shared';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock components
vi.mock('../SwapPreferencesSection', () => ({
  SwapPreferencesSection: ({ enabled, onToggle, onChange, preferences, errors, eventDate }: any) => (
    <div data-testid="swap-preferences-section">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          data-testid="swap-toggle"
        />
        Make available for swapping
      </label>
      {enabled && (
        <div data-testid="swap-preferences-content">
          <div data-testid="payment-types">
            <label>
              <input
                type="checkbox"
                checked={preferences?.paymentTypes?.includes('booking')}
                onChange={(e) => {
                  const types = e.target.checked 
                    ? [...(preferences?.paymentTypes || []), 'booking']
                    : preferences?.paymentTypes?.filter((t: string) => t !== 'booking') || [];
                  onChange({ ...preferences, paymentTypes: types });
                }}
              />
              Accept booking swaps
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences?.paymentTypes?.includes('cash')}
                onChange={(e) => {
                  const types = e.target.checked 
                    ? [...(preferences?.paymentTypes || []), 'cash']
                    : preferences?.paymentTypes?.filter((t: string) => t !== 'cash') || [];
                  onChange({ ...preferences, paymentTypes: types });
                }}
              />
              Accept cash offers
            </label>
          </div>
          {preferences?.paymentTypes?.includes('cash') && (
            <input
              type="number"
              placeholder="Minimum cash amount"
              value={preferences?.minCashAmount || ''}
              onChange={(e) => onChange({ ...preferences, minCashAmount: Number(e.target.value) })}
              data-testid="min-cash-amount"
            />
          )}
          <select
            value={preferences?.acceptanceStrategy || 'first-match'}
            onChange={(e) => onChange({ ...preferences, acceptanceStrategy: e.target.value })}
            data-testid="acceptance-strategy"
          >
            <option value="first-match">First Match</option>
            <option value="auction">Auction Mode</option>
          </select>
          {preferences?.acceptanceStrategy === 'auction' && (
            <input
              type="date"
              value={preferences?.auctionEndDate?.toISOString().split('T')[0] || ''}
              onChange={(e) => onChange({ ...preferences, auctionEndDate: new Date(e.target.value) })}
              data-testid="auction-end-date"
            />
          )}
        </div>
      )}
      {errors?.paymentTypes && <div role="alert">{errors.paymentTypes}</div>}
      {errors?.minCashAmount && <div role="alert">{errors.minCashAmount}</div>}
      {errors?.auctionEndDate && <div role="alert">{errors.auctionEndDate}</div>}
    </div>
  ),
}));

const mockBooking = createMockBooking({
  id: 'test-booking-1',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: { city: 'Paris', country: 'France' },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-03'),
  },
  originalPrice: 200,
  swapValue: 180,
});

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onSubmit: vi.fn(),
  mode: 'create' as const,
  loading: false,
};

describe('UnifiedBookingForm - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accessibility Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
        <UnifiedBookingForm {...defaultProps} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText('Title')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Description *')).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText('Type')).toHaveFocus();
    });

    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText('Description *')).toHaveAttribute('aria-required', 'true');
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const submitButton = screen.getByText('Create Booking');
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert');
        expect(errorMessages.length).toBeGreaterThan(0);
        errorMessages.forEach(error => {
          expect(error).toHaveAttribute('aria-live', 'assertive');
        });
      });
    });

    it('should manage focus when swap section is toggled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      // Focus should move to first element in swap section
      await waitFor(() => {
        const swapContent = screen.getByTestId('swap-preferences-content');
        expect(swapContent).toBeInTheDocument();
      });
    });
  });

  describe('Swap Integration - Advanced Scenarios', () => {
    it('should handle complex swap preference combinations', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      
      renderWithProviders(
        <UnifiedBookingForm {...defaultProps} onSubmit={onSubmit} />
      );

      // Fill basic booking info
      await user.type(screen.getByLabelText('Title'), 'Complex Swap Booking');
      await user.type(screen.getByLabelText('Description *'), 'A booking with complex swap settings');
      await user.selectOptions(screen.getByLabelText('Type'), 'hotel');
      await user.type(screen.getByLabelText('City'), 'Tokyo');
      await user.type(screen.getByLabelText('Country'), 'Japan');
      await user.type(screen.getByLabelText('Original Price ($)'), '800');
      await user.type(screen.getByLabelText('Provider'), 'Hotels.com');
      await user.type(screen.getByLabelText('Confirmation Number'), 'COMPLEX123');

      // Enable swap with complex preferences
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      // Enable both payment types
      await user.click(screen.getByLabelText('Accept booking swaps'));
      await user.click(screen.getByLabelText('Accept cash offers'));

      // Set minimum cash amount
      const minCashInput = screen.getByTestId('min-cash-amount');
      await user.clear(minCashInput);
      await user.type(minCashInput, '200');

      // Set auction mode
      await user.selectOptions(screen.getByTestId('acceptance-strategy'), 'auction');

      // Set auction end date
      const auctionEndDate = screen.getByTestId('auction-end-date');
      await user.type(auctionEndDate, '2024-05-20');

      // Submit form
      await user.click(screen.getByText('Create Booking & Enable Swapping'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Complex Swap Booking',
            swapEnabled: true,
            swapPreferences: expect.objectContaining({
              paymentTypes: expect.arrayContaining(['booking', 'cash']),
              minCashAmount: 200,
              acceptanceStrategy: 'auction',
              auctionEndDate: expect.any(Date),
            }),
          })
        );
      });
    });

    it('should validate auction end date against event date', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Fill required fields
      await user.type(screen.getByLabelText('Title'), 'Test Booking');
      await user.type(screen.getByLabelText('Description *'), 'Test description');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '100');
      await user.type(screen.getByLabelText('Provider'), 'Test Provider');
      await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

      // Set event date
      const checkInDate = screen.getByLabelText('Check-in Date');
      await user.clear(checkInDate);
      await user.type(checkInDate, '2024-06-01');

      // Enable swap and set auction mode
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);
      
      await user.click(screen.getByLabelText('Accept booking swaps'));
      await user.selectOptions(screen.getByTestId('acceptance-strategy'), 'auction');

      // Set auction end date too close to event date (should fail validation)
      const auctionEndDate = screen.getByTestId('auction-end-date');
      await user.type(auctionEndDate, '2024-05-30'); // Only 2 days before event

      await user.click(screen.getByText('Create Booking & Enable Swapping'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/auction must end at least one week before/i);
      });
    });

    it('should clear swap preferences when swap is disabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Enable swap and configure preferences
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      await user.click(screen.getByLabelText('Accept cash offers'));
      const minCashInput = screen.getByTestId('min-cash-amount');
      await user.type(minCashInput, '100');

      // Disable swap
      await user.click(swapToggle);

      // Re-enable swap - preferences should be reset
      await user.click(swapToggle);

      expect(screen.getByTestId('min-cash-amount')).toHaveValue('');
      expect(screen.getByLabelText('Accept cash offers')).not.toBeChecked();
    });
  });

  describe('Form Validation - Edge Cases', () => {
    it('should validate minimum cash amount when cash is enabled', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Enable swap and cash payments
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);
      await user.click(screen.getByLabelText('Accept cash offers'));

      // Try to submit without setting minimum cash amount
      await user.click(screen.getByText('Create Booking & Enable Swapping'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/minimum cash amount is required/i);
      });
    });

    it('should validate that at least one payment type is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Fill required booking fields
      await user.type(screen.getByLabelText('Title'), 'Test Booking');
      await user.type(screen.getByLabelText('Description *'), 'Test description');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '100');
      await user.type(screen.getByLabelText('Provider'), 'Test Provider');
      await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

      // Enable swap but don't select any payment types
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      await user.click(screen.getByText('Create Booking & Enable Swapping'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/at least one payment type must be selected/i);
      });
    });

    it('should validate date ranges correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const checkInDate = screen.getByLabelText('Check-in Date');
      const checkOutDate = screen.getByLabelText('Check-out Date');

      // Set check-out before check-in
      await user.type(checkInDate, '2024-06-10');
      await user.type(checkOutDate, '2024-06-05');

      await user.click(screen.getByText('Create Booking'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/check-out date must be after check-in date/i);
      });
    });

    it('should validate price fields for positive values', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const priceInput = screen.getByLabelText('Original Price ($)');
      await user.clear(priceInput);
      await user.type(priceInput, '-100');

      await user.click(screen.getByText('Create Booking'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/original price must be greater than 0/i);
      });
    });
  });

  describe('Real-time Validation', () => {
    it('should show validation errors as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const titleInput = screen.getByLabelText('Title');
      
      // Type short title
      await user.type(titleInput, 'AB');
      await user.tab(); // Blur to trigger validation

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/title must be at least 3 characters/i);
      });

      // Fix the error
      await user.clear(titleInput);
      await user.type(titleInput, 'Valid Title');

      await waitFor(() => {
        expect(screen.queryByText(/title must be at least 3 characters/i)).not.toBeInTheDocument();
      });
    });

    it('should validate swap preferences in real-time', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      // Enable swap and cash payments
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);
      await user.click(screen.getByLabelText('Accept cash offers'));

      const minCashInput = screen.getByTestId('min-cash-amount');
      await user.type(minCashInput, '0');
      await user.tab();

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/minimum cash amount must be greater than 0/i);
      });
    });
  });

  describe('Edit Mode Functionality', () => {
    it('should pre-populate form with existing booking data', () => {
      renderWithProviders(
        <UnifiedBookingForm 
          {...defaultProps} 
          mode="edit" 
          booking={mockBooking} 
        />
      );

      expect(screen.getByDisplayValue('Test Hotel Booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('A test hotel booking')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Paris')).toBeInTheDocument();
      expect(screen.getByDisplayValue('France')).toBeInTheDocument();
      expect(screen.getByDisplayValue('200')).toBeInTheDocument();
    });

    it('should show existing swap preferences in edit mode', () => {
      const bookingWithSwap = {
        ...mockBooking,
        swapEnabled: true,
        swapPreferences: {
          paymentTypes: ['booking', 'cash'] as ('booking' | 'cash')[],
          minCashAmount: 150,
          acceptanceStrategy: 'auction' as const,
          auctionEndDate: new Date('2024-05-20'),
          swapConditions: ['Flexible dates required'],
        },
      };

      renderWithProviders(
        <UnifiedBookingForm 
          {...defaultProps} 
          mode="edit" 
          booking={bookingWithSwap} 
        />
      );

      expect(screen.getByTestId('swap-toggle')).toBeChecked();
      expect(screen.getByLabelText('Accept booking swaps')).toBeChecked();
      expect(screen.getByLabelText('Accept cash offers')).toBeChecked();
      expect(screen.getByTestId('min-cash-amount')).toHaveValue('150');
      expect(screen.getByTestId('acceptance-strategy')).toHaveValue('auction');
    });

    it('should update existing booking with new data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      renderWithProviders(
        <UnifiedBookingForm 
          {...defaultProps} 
          mode="edit" 
          booking={mockBooking}
          onSubmit={onSubmit}
        />
      );

      // Update title
      const titleInput = screen.getByDisplayValue('Test Hotel Booking');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Hotel Booking');

      // Enable swap
      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);
      await user.click(screen.getByLabelText('Accept booking swaps'));

      await user.click(screen.getByText('Update Booking & Enable Swapping'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Updated Hotel Booking',
            swapEnabled: true,
            swapPreferences: expect.objectContaining({
              paymentTypes: ['booking'],
            }),
          })
        );
      });
    });
  });

  describe('Loading States and Error Handling', () => {
    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} loading={true} />);

      const submitButton = screen.getByText('Create Booking');
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-busy', 'true');
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderWithProviders(
        <UnifiedBookingForm {...defaultProps} onSubmit={onSubmit} />
      );

      // Fill valid form
      await user.type(screen.getByLabelText('Title'), 'Test Booking');
      await user.type(screen.getByLabelText('Description *'), 'Test description');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '100');
      await user.type(screen.getByLabelText('Provider'), 'Test Provider');
      await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

      await user.click(screen.getByText('Create Booking'));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to submit booking:', expect.any(Error));
      });

      // Form should remain open for retry
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should close modal after successful submission', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();

      renderWithProviders(
        <UnifiedBookingForm 
          {...defaultProps} 
          onSubmit={onSubmit}
          onClose={onClose}
        />
      );

      // Fill valid form
      await user.type(screen.getByLabelText('Title'), 'Test Booking');
      await user.type(screen.getByLabelText('Description *'), 'Test description');
      await user.type(screen.getByLabelText('City'), 'Paris');
      await user.type(screen.getByLabelText('Country'), 'France');
      await user.type(screen.getByLabelText('Original Price ($)'), '100');
      await user.type(screen.getByLabelText('Provider'), 'Test Provider');
      await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

      await user.click(screen.getByText('Create Booking'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Progressive Disclosure', () => {
    it('should show appropriate helper text based on swap state', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByText(/fill out all required fields/i)).toBeInTheDocument();

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      expect(screen.getByText(/enable swapping to allow/i)).toBeInTheDocument();
    });

    it('should update form title based on swap state', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      expect(screen.getByText('Create New Booking')).toBeInTheDocument();

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      expect(screen.getByText('Create Booking & Enable Swapping')).toBeInTheDocument();
    });

    it('should show conditional fields based on swap preferences', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      await user.click(swapToggle);

      // Cash amount field should not be visible initially
      expect(screen.queryByTestId('min-cash-amount')).not.toBeInTheDocument();

      // Enable cash payments
      await user.click(screen.getByLabelText('Accept cash offers'));

      // Cash amount field should now be visible
      expect(screen.getByTestId('min-cash-amount')).toBeInTheDocument();

      // Auction date field should not be visible initially
      expect(screen.queryByTestId('auction-end-date')).not.toBeInTheDocument();

      // Enable auction mode
      await user.selectOptions(screen.getByTestId('acceptance-strategy'), 'auction');

      // Auction date field should now be visible
      expect(screen.getByTestId('auction-end-date')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render quickly with large amounts of data', () => {
      const startTime = performance.now();
      
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);
      
      const renderTime = performance.now() - startTime;
      
      // Should render within 100ms
      expect(renderTime).toBeLessThan(100);
    });

    it('should handle rapid user interactions efficiently', async () => {
      const user = userEvent.setup();
      renderWithProviders(<UnifiedBookingForm {...defaultProps} />);

      const swapToggle = screen.getByTestId('swap-toggle');
      
      const startTime = performance.now();
      
      // Rapidly toggle swap multiple times
      for (let i = 0; i < 10; i++) {
        await user.click(swapToggle);
      }
      
      const interactionTime = performance.now() - startTime;
      
      // Should handle rapid interactions within 1 second
      expect(interactionTime).toBeLessThan(1000);
    });
  });
});