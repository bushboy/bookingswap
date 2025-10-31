import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { InlineProposalForm } from '../InlineProposalForm';
import { renderWithProviders, createMockBooking, createMockSwap, createMockUser } from '@/test/testUtils';
import { SwapWithBookings, InlineProposalData } from '@booking-swap/shared';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock hooks
const mockUseGetUserBookingsQuery = vi.fn();
vi.mock('@/hooks/useBookings', () => ({
  useGetUserBookingsQuery: () => mockUseGetUserBookingsQuery(),
}));

const mockBooking = createMockBooking({
  id: 'target-booking-1',
  title: 'Paris Hotel Stay',
  location: { city: 'Paris', country: 'France' },
  originalPrice: 300,
});

const mockSwapInfo: SwapWithBookings = {
  id: 'swap-1',
  sourceBookingId: 'target-booking-1',
  targetBookingId: null,
  proposerId: null,
  ownerId: 'owner-1',
  status: 'active',
  swapType: 'both',
  paymentTypes: ['booking', 'cash'],
  acceptanceStrategy: 'first-match',
  cashDetails: {
    minAmount: 100,
    maxAmount: 500,
    currency: 'USD',
  },
  auctionDetails: null,
  hasActiveProposals: true,
  activeProposalCount: 2,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceBooking: mockBooking,
  targetBooking: null,
  proposer: null,
  owner: createMockUser({ id: 'owner-1' }),
  proposals: [],
};

const mockUserBookings = [
  createMockBooking({
    id: 'user-booking-1',
    title: 'London Hotel',
    status: 'available',
    originalPrice: 250,
  }),
  createMockBooking({
    id: 'user-booking-2',
    title: 'Rome Apartment',
    status: 'available',
    originalPrice: 180,
  }),
  createMockBooking({
    id: 'user-booking-3',
    title: 'Unavailable Booking',
    status: 'cancelled',
    originalPrice: 200,
  }),
];

const defaultProps = {
  booking: mockBooking,
  swapInfo: mockSwapInfo,
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
};

describe('InlineProposalForm - Comprehensive Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetUserBookingsQuery.mockReturnValue({
      data: mockUserBookings,
      isLoading: false,
      error: null,
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
        <InlineProposalForm {...defaultProps} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      // Tab through form elements
      await user.tab();
      expect(screen.getByRole('radio', { name: /swap with my booking/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('radio', { name: /make cash offer/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-label');
      expect(screen.getByRole('textbox')).toHaveAttribute('aria-label');
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      // Try to submit without selecting a booking
      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
      });
    });

    it('should manage focus when switching proposal types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);

      // Focus should move to cash amount input
      await waitFor(() => {
        expect(screen.getByLabelText(/cash offer amount/i)).toHaveFocus();
      });
    });
  });

  describe('Proposal Type Selection', () => {
    it('should default to booking proposal when both types are available', () => {
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      expect(screen.getByRole('radio', { name: /swap with my booking/i })).toBeChecked();
      expect(screen.getByRole('radio', { name: /make cash offer/i })).not.toBeChecked();
    });

    it('should show only cash option when booking swaps are not accepted', () => {
      const cashOnlySwapInfo = {
        ...mockSwapInfo,
        paymentTypes: ['cash'] as ('booking' | 'cash')[],
      };

      renderWithProviders(
        <InlineProposalForm {...defaultProps} swapInfo={cashOnlySwapInfo} />
      );

      expect(screen.queryByRole('radio', { name: /swap with my booking/i })).not.toBeInTheDocument();
      expect(screen.getByText(/make cash offer/i)).toBeInTheDocument();
    });

    it('should show only booking option when cash is not accepted', () => {
      const bookingOnlySwapInfo = {
        ...mockSwapInfo,
        paymentTypes: ['booking'] as ('booking' | 'cash')[],
      };

      renderWithProviders(
        <InlineProposalForm {...defaultProps} swapInfo={bookingOnlySwapInfo} />
      );

      expect(screen.getByText(/swap with my booking/i)).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /make cash offer/i })).not.toBeInTheDocument();
    });

    it('should switch between proposal types correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      // Start with booking proposal
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.queryByLabelText(/cash offer amount/i)).not.toBeInTheDocument();

      // Switch to cash proposal
      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/cash offer amount/i)).toBeInTheDocument();

      // Switch back to booking proposal
      const bookingRadio = screen.getByRole('radio', { name: /swap with my booking/i });
      await user.click(bookingRadio);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.queryByLabelText(/cash offer amount/i)).not.toBeInTheDocument();
    });
  });

  describe('Booking Selection', () => {
    it('should display available user bookings', () => {
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const bookingSelect = screen.getByRole('combobox');
      expect(bookingSelect).toBeInTheDocument();

      // Should show available bookings (excluding cancelled ones)
      expect(screen.getByText('London Hotel')).toBeInTheDocument();
      expect(screen.getByText('Rome Apartment')).toBeInTheDocument();
      expect(screen.queryByText('Unavailable Booking')).not.toBeInTheDocument();
    });

    it('should exclude the target booking from selection', () => {
      const userBookingsWithTarget = [
        ...mockUserBookings,
        { ...mockBooking, userId: 'current-user' },
      ];

      mockUseGetUserBookingsQuery.mockReturnValue({
        data: userBookingsWithTarget,
        isLoading: false,
        error: null,
      });

      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      // Target booking should not appear in the list
      expect(screen.queryByText('Paris Hotel Stay')).not.toBeInTheDocument();
    });

    it('should show message when no bookings are available', () => {
      mockUseGetUserBookingsQuery.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      });

      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      expect(screen.getByText(/no available bookings/i)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /swap with my booking/i })).toBeDisabled();
    });

    it('should validate booking selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      // Try to submit without selecting a booking
      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/please select a booking/i);
      });
    });

    it('should show booking details in selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const bookingSelect = screen.getByRole('combobox');
      await user.click(bookingSelect);

      // Should show booking details
      expect(screen.getByText(/\$250/)).toBeInTheDocument(); // London Hotel price
      expect(screen.getByText(/\$180/)).toBeInTheDocument(); // Rome Apartment price
    });
  });

  describe('Cash Offer Input', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);
      
      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);
    });

    it('should validate minimum cash amount', async () => {
      const user = userEvent.setup();
      
      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.clear(cashInput);
      await user.type(cashInput, '50'); // Below minimum of 100

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/minimum amount is \$100/i);
      });
    });

    it('should validate maximum cash amount', async () => {
      const user = userEvent.setup();
      
      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.clear(cashInput);
      await user.type(cashInput, '600'); // Above maximum of 500

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/maximum amount is \$500/i);
      });
    });

    it('should accept valid cash amounts', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);

      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.clear(cashInput);
      await user.type(cashInput, '200');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'cash',
          cashAmount: 200,
          message: '',
        });
      });
    });

    it('should show currency symbol and formatting', () => {
      expect(screen.getByText('$')).toBeInTheDocument();
      expect(screen.getByText(/minimum: \$100/i)).toBeInTheDocument();
      expect(screen.getByText(/maximum: \$500/i)).toBeInTheDocument();
    });

    it('should handle decimal amounts', async () => {
      const user = userEvent.setup();
      
      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.clear(cashInput);
      await user.type(cashInput, '150.50');

      expect(cashInput).toHaveValue('150.50');
    });
  });

  describe('Message Input', () => {
    it('should allow optional message input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'I am very interested in this swap!');

      expect(messageInput).toHaveValue('I am very interested in this swap!');
    });

    it('should enforce character limit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      const longMessage = 'a'.repeat(600); // Exceeds 500 character limit

      await user.type(messageInput, longMessage);

      await waitFor(() => {
        expect(screen.getByText(/message is too long/i)).toBeInTheDocument();
      });
    });

    it('should show character count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Hello world');

      expect(screen.getByText(/11 \/ 500/)).toBeInTheDocument();
    });

    it('should include message in submission', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      // Select a booking
      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      // Add message
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Looking forward to this swap!');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'booking',
          selectedBookingId: 'user-booking-1',
          message: 'Looking forward to this swap!',
        });
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit booking proposal with correct data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'booking',
          selectedBookingId: 'user-booking-1',
          message: '',
        });
      });
    });

    it('should submit cash proposal with correct data', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);

      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.type(cashInput, '250');

      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Great deal!');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          type: 'cash',
          cashAmount: 250,
          message: 'Great deal!',
        });
      });
    });

    it('should disable submit button when form is invalid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const submitButton = screen.getByText('Send Proposal');
      expect(submitButton).toBeDisabled();

      // Select a booking to make form valid
      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      expect(submitButton).not.toBeDisabled();
    });

    it('should show loading state during submission', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      expect(screen.getByText('Sending...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    it('should handle submission errors gracefully', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onSubmit={onSubmit} />
      );

      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/failed to send proposal/i);
      });

      // Form should remain open for retry
      expect(screen.getByRole('form')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Form Cancellation', () => {
    it('should call onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onCancel={onCancel} />
      );

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when close button is clicked', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onCancel={onCancel} />
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onCancel when escape key is pressed', async () => {
      const user = userEvent.setup();
      const onCancel = vi.fn();
      
      renderWithProviders(
        <InlineProposalForm {...defaultProps} onCancel={onCancel} />
      );

      await user.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when fetching user bookings', () => {
      mockUseGetUserBookingsQuery.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      expect(screen.getByText(/loading your bookings/i)).toBeInTheDocument();
    });

    it('should show error state when booking fetch fails', () => {
      mockUseGetUserBookingsQuery.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch bookings'),
      });

      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      expect(screen.getByText(/failed to load your bookings/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Validation', () => {
    it('should validate cash amount as user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      await user.click(cashRadio);

      const cashInput = screen.getByLabelText(/cash offer amount/i);
      await user.type(cashInput, '50');

      // Should show error immediately
      await waitFor(() => {
        expect(screen.getByText(/minimum amount is \$100/i)).toBeInTheDocument();
      });

      // Fix the error
      await user.clear(cashInput);
      await user.type(cashInput, '150');

      await waitFor(() => {
        expect(screen.queryByText(/minimum amount is \$100/i)).not.toBeInTheDocument();
      });
    });

    it('should update submit button state based on form validity', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const submitButton = screen.getByText('Send Proposal');
      expect(submitButton).toBeDisabled();

      // Make form valid
      const bookingSelect = screen.getByRole('combobox');
      await user.selectOptions(bookingSelect, 'user-booking-1');

      expect(submitButton).not.toBeDisabled();

      // Make form invalid again
      await user.selectOptions(bookingSelect, '');

      expect(submitButton).toBeDisabled();
    });
  });

  describe('Performance', () => {
    it('should render quickly with many user bookings', () => {
      const manyBookings = Array.from({ length: 100 }, (_, i) =>
        createMockBooking({
          id: `booking-${i}`,
          title: `Booking ${i}`,
          status: 'available',
        })
      );

      mockUseGetUserBookingsQuery.mockReturnValue({
        data: manyBookings,
        isLoading: false,
        error: null,
      });

      const startTime = performance.now();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(100); // Should render within 100ms
    });

    it('should handle rapid user interactions efficiently', async () => {
      const user = userEvent.setup();
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const startTime = performance.now();

      // Rapidly switch between proposal types
      for (let i = 0; i < 10; i++) {
        const bookingRadio = screen.getByRole('radio', { name: /swap with my booking/i });
        const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
        
        await user.click(cashRadio);
        await user.click(bookingRadio);
      }

      const interactionTime = performance.now() - startTime;
      expect(interactionTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Mobile Responsiveness', () => {
    it('should adapt layout for mobile screens', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const form = screen.getByRole('form');
      expect(form).toHaveClass('mobile-layout');
    });

    it('should use appropriate input types for mobile', () => {
      renderWithProviders(<InlineProposalForm {...defaultProps} />);

      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      fireEvent.click(cashRadio);

      const cashInput = screen.getByLabelText(/cash offer amount/i);
      expect(cashInput).toHaveAttribute('inputMode', 'decimal');
    });
  });
});