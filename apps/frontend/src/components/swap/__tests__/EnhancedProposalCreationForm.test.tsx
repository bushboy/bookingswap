import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  createMockUser,
  createMockBooking,
} from '../../../test/testUtils';
import { EnhancedProposalCreationForm } from '../EnhancedProposalCreationForm';
import { RootState } from '../../../store';
import * as swapThunks from '../../../store/thunks/swapThunks';
import { EnhancedSwap, PaymentMethod, BookingType } from '@booking-swap/shared';

// Mock the thunks
vi.mock('../../../store/thunks/swapThunks', () => ({
  createEnhancedProposalThunk: vi.fn(),
  validateCashOfferThunk: vi.fn(),
}));

describe('EnhancedProposalCreationForm', () => {
  const mockUser = createMockUser({ id: 'user-456' });
  const mockUserBooking = createMockBooking({
    id: 'booking-456',
    userId: 'user-456',
    title: 'London Hotel',
    location: { city: 'London', country: 'UK' },
    type: 'hotel' as BookingType,
  });

  const mockEnhancedSwap: EnhancedSwap = {
    id: 'swap-123',
    sourceBookingId: 'booking-123',
    targetBookingId: '',
    proposerId: 'user-123',
    ownerId: 'user-123',
    status: 'pending',
    terms: {
      conditions: [],
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    blockchain: { proposalTransactionId: 'tx-123' },
    timeline: { proposedAt: new Date() },
    paymentTypes: {
      bookingExchange: true,
      cashPayment: true,
      minimumCashAmount: 200,
      preferredCashAmount: 400,
    },
    acceptanceStrategy: { type: 'first_match' },
    cashDetails: {
      enabled: true,
      minimumAmount: 200,
      preferredAmount: 400,
      currency: 'USD',
      escrowRequired: true,
      platformFeePercentage: 5,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentMethod: PaymentMethod = {
    id: 'pm-123',
    userId: 'user-456',
    type: 'credit_card',
    displayName: 'Visa ****1234',
    isVerified: true,
    metadata: { cardToken: 'token-123' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultProps = {
    targetSwap: mockEnhancedSwap,
    targetBooking: mockUserBooking,
    userBookings: [mockUserBooking],
    userPaymentMethods: [mockPaymentMethod],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  const initialState: Partial<RootState> = {
    auth: {
      user: {
        id: mockUser.id,
        walletAddress: '0x123',
        displayName: mockUser.profile.firstName,
        email: mockUser.email,
        verificationLevel: 'verified' as const,
      },
      isAuthenticated: true,
      walletConnected: true,
      loading: false,
      error: null,
    },
    bookings: {
      bookings: [mockUserBooking],
      currentBooking: null,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 1 },
    },
    payments: {
      paymentMethods: [mockPaymentMethod],
      transactions: [],
      loading: false,
      error: null,
    },
    swaps: {
      swaps: [],
      currentSwap: null,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 0 },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render proposal creation form', () => {
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Create Proposal')).toBeInTheDocument();
      expect(
        screen.getByText(/minimum cash amount: \$200/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/preferred amount: \$400/i)).toBeInTheDocument();
    });

    it('should show proposal type selection', () => {
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByLabelText(/booking exchange/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cash offer/i)).toBeInTheDocument();
    });

    it('should disable cash option when not allowed by swap', () => {
      const bookingOnlySwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: true,
          cashPayment: false,
        },
      };

      renderWithProviders(
        <EnhancedProposalCreationForm
          {...defaultProps}
          targetSwap={bookingOnlySwap}
        />,
        { preloadedState: initialState }
      );

      const cashRadio = screen.getByLabelText(/cash offer/i);
      expect(cashRadio).toBeDisabled();
      expect(
        screen.getByText(/cash offers not accepted for this swap/i)
      ).toBeInTheDocument();
    });

    it('should disable booking option when not allowed by swap', () => {
      const cashOnlySwap = {
        ...mockEnhancedSwap,
        paymentTypes: {
          bookingExchange: false,
          cashPayment: true,
        },
      };

      renderWithProviders(
        <EnhancedProposalCreationForm
          {...defaultProps}
          targetSwap={cashOnlySwap}
        />,
        { preloadedState: initialState }
      );

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      expect(bookingRadio).toBeDisabled();
      expect(
        screen.getByText(/booking exchanges not accepted for this swap/i)
      ).toBeInTheDocument();
    });
  });

  describe('Booking Proposal Creation', () => {
    it('should show booking selection when booking proposal is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      expect(screen.getByText('Select Your Booking')).toBeInTheDocument();
      expect(screen.getByText('London Hotel')).toBeInTheDocument();
      expect(screen.getByText('London, UK')).toBeInTheDocument();
    });

    it('should allow selecting a booking for proposal', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const bookingCard = screen.getByTestId('booking-card-booking-456');
      await user.click(bookingCard);

      expect(bookingCard).toHaveClass('selected');
      expect(screen.getByText(/selected booking/i)).toBeInTheDocument();
    });

    it('should show booking compatibility analysis', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const bookingCard = screen.getByTestId('booking-card-booking-456');
      await user.click(bookingCard);

      expect(screen.getByText('Compatibility Analysis')).toBeInTheDocument();
      expect(screen.getByText(/value difference/i)).toBeInTheDocument();
      expect(screen.getByText(/location match/i)).toBeInTheDocument();
    });

    it('should submit booking proposal successfully', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.mocked(
        swapThunks.createEnhancedProposalThunk
      );
      mockCreateProposal.mockReturnValue({
        type: 'swaps/createProposal/fulfilled',
      } as any);

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Select booking proposal type
      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      // Select booking
      const bookingCard = screen.getByTestId('booking-card-booking-456');
      await user.click(bookingCard);

      // Add message
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Great booking for swap!');

      // Add conditions
      const conditionsInput = screen.getByLabelText(/conditions/i);
      await user.type(conditionsInput, 'Same check-in date');
      await user.keyboard('{Enter}');

      // Submit
      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateProposal).toHaveBeenCalledWith({
          swapId: 'swap-123',
          proposalType: 'booking',
          bookingId: 'booking-456',
          message: 'Great booking for swap!',
          conditions: ['Same check-in date'],
        });
      });
    });
  });

  describe('Cash Proposal Creation', () => {
    it('should show cash offer form when cash proposal is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      expect(screen.getByText('Cash Offer Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/offer amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/payment method/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/escrow agreement/i)).toBeInTheDocument();
    });

    it('should validate cash amount against minimum requirement', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '150'); // Below minimum of 200

      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(
          screen.getByText(/amount must be at least \$200/i)
        ).toBeInTheDocument();
      });
    });

    it('should show fee calculation for cash offers', async () => {
      const user = userEvent.setup();
      const mockValidateCashOffer = vi.mocked(
        swapThunks.validateCashOfferThunk
      );
      mockValidateCashOffer.mockReturnValue({
        type: 'swaps/validateCashOffer/fulfilled',
        payload: {
          isValid: true,
          errors: [],
          estimatedFees: {
            platformFee: 15,
            processingFee: 5,
            totalFees: 20,
            netAmount: 280,
          },
          requiresEscrow: true,
        },
      } as any);

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '300');

      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(screen.getByText(/platform fee: \$15/i)).toBeInTheDocument();
        expect(screen.getByText(/processing fee: \$5/i)).toBeInTheDocument();
        expect(screen.getByText(/total fees: \$20/i)).toBeInTheDocument();
        expect(
          screen.getByText(/recipient receives: \$280/i)
        ).toBeInTheDocument();
      });
    });

    it('should require payment method selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/payment method is required/i)
        ).toBeInTheDocument();
      });
    });

    it('should show payment method options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const paymentMethodSelect = screen.getByLabelText(/payment method/i);
      await user.click(paymentMethodSelect);

      expect(screen.getByText('Visa ****1234')).toBeInTheDocument();
    });

    it('should submit cash proposal successfully', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.mocked(
        swapThunks.createEnhancedProposalThunk
      );
      mockCreateProposal.mockReturnValue({
        type: 'swaps/createProposal/fulfilled',
      } as any);

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Select cash proposal type
      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      // Set amount
      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '350');

      // Select payment method
      const paymentMethodSelect = screen.getByLabelText(/payment method/i);
      await user.selectOptions(paymentMethodSelect, 'pm-123');

      // Agree to escrow
      const escrowCheckbox = screen.getByLabelText(/escrow agreement/i);
      await user.click(escrowCheckbox);

      // Add message
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'Cash offer for your booking');

      // Submit
      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockCreateProposal).toHaveBeenCalledWith({
          swapId: 'swap-123',
          proposalType: 'cash',
          cashOffer: {
            amount: 350,
            currency: 'USD',
            paymentMethodId: 'pm-123',
            escrowAgreement: true,
          },
          message: 'Cash offer for your booking',
          conditions: [],
        });
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/proposal type is required/i)
        ).toBeInTheDocument();
      });
    });

    it('should validate booking selection for booking proposals', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/booking selection is required/i)
        ).toBeInTheDocument();
      });
    });

    it('should validate cash offer details for cash proposals', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/offer amount is required/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/payment method is required/i)
        ).toBeInTheDocument();
      });
    });

    it('should show real-time validation feedback', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.type(amountInput, '50'); // Invalid amount

      expect(
        screen.getByText(/amount must be at least \$200/i)
      ).toBeInTheDocument();

      // Fix the amount
      await user.clear(amountInput);
      await user.type(amountInput, '250');

      await waitFor(() => {
        expect(
          screen.queryByText(/amount must be at least \$200/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('User Experience Features', () => {
    it('should show proposal preview before submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.clear(amountInput);
      await user.type(amountInput, '300');

      const paymentMethodSelect = screen.getByLabelText(/payment method/i);
      await user.selectOptions(paymentMethodSelect, 'pm-123');

      const previewButton = screen.getByRole('button', {
        name: /preview proposal/i,
      });
      await user.click(previewButton);

      expect(screen.getByText('Proposal Preview')).toBeInTheDocument();
      expect(screen.getByText('$300 USD')).toBeInTheDocument();
      expect(screen.getByText('Visa ****1234')).toBeInTheDocument();
    });

    it('should save draft proposals', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      const amountInput = screen.getByLabelText(/offer amount/i);
      await user.type(amountInput, '250');

      const saveDraftButton = screen.getByRole('button', {
        name: /save draft/i,
      });
      await user.click(saveDraftButton);

      expect(screen.getByText(/draft saved/i)).toBeInTheDocument();
    });

    it('should show competitive analysis for cash offers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      expect(screen.getByText('Competitive Analysis')).toBeInTheDocument();
      expect(screen.getByText(/minimum required: \$200/i)).toBeInTheDocument();
      expect(screen.getByText(/preferred amount: \$400/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByRole('form')).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: /proposal type/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/booking exchange/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cash offer/i)).toBeInTheDocument();
    });

    it('should announce form validation errors to screen readers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/proposal type is required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      bookingRadio.focus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByLabelText(/cash offer/i)).toHaveFocus();

      await user.keyboard('{Space}');
      expect(screen.getByLabelText(/cash offer/i)).toBeChecked();
    });

    it('should provide clear focus indicators', () => {
      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      bookingRadio.focus();

      expect(bookingRadio).toHaveClass('focus:ring-2');
    });
  });

  describe('Error Handling', () => {
    it('should display API errors', () => {
      const errorState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          error: 'Failed to create proposal: Payment method invalid',
        },
      };

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: errorState,
      });

      expect(
        screen.getByText(/failed to create proposal: payment method invalid/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.mocked(
        swapThunks.createEnhancedProposalThunk
      );
      mockCreateProposal.mockReturnValue({
        type: 'swaps/createProposal/rejected',
        error: { message: 'Network error' },
      } as any);

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: initialState,
      });

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const bookingCard = screen.getByTestId('booking-card-booking-456');
      await user.click(bookingCard);

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /retry/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state during proposal submission', () => {
      const loadingState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          loading: true,
        },
      };

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: loadingState,
      });

      const submitButton = screen.getByRole('button', {
        name: /submitting.../i,
      });
      expect(submitButton).toBeDisabled();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should disable form during loading', () => {
      const loadingState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          loading: true,
        },
      };

      renderWithProviders(<EnhancedProposalCreationForm {...defaultProps} />, {
        preloadedState: loadingState,
      });

      expect(screen.getByLabelText(/booking exchange/i)).toBeDisabled();
      expect(screen.getByLabelText(/cash offer/i)).toBeDisabled();
    });
  });
});
