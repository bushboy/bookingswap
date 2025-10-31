import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  createMockUser,
  createMockBooking,
} from '../testUtils';
import { RootState } from '../../store';
import * as swapThunks from '../../store/thunks/swapThunks';
import * as auctionThunks from '../../store/thunks/auctionThunks';
import {
  EnhancedSwap,
  SwapAuction,
  AuctionProposal,
  PaymentMethod,
  BookingType,
} from '@booking-swap/shared';
import { EnhancedSwapCreationModal } from '../../components/swap/EnhancedSwapCreationModal';
import { AuctionManagementDashboard } from '../../components/swap/AuctionManagementDashboard';
import { EnhancedProposalCreationForm } from '../../components/swap/EnhancedProposalCreationForm';

// Mock API calls
vi.mock('../../store/thunks/swapThunks', () => ({
  createEnhancedSwapThunk: vi.fn(),
  createEnhancedProposalThunk: vi.fn(),
  validateCashOfferThunk: vi.fn(),
}));
vi.mock('../../store/thunks/auctionThunks', () => ({
  selectAuctionWinnerThunk: vi.fn(),
  endAuctionThunk: vi.fn(),
  fetchAuctionDetailsThunk: vi.fn(),
}));

describe('Enhanced Swap Workflow Integration Tests', () => {
  const mockUser = createMockUser({ id: 'user-123' });
  const mockBooking = createMockBooking({
    id: 'booking-123',
    title: 'Paris Hotel',
    type: 'hotel' as BookingType,
    dateRange: {
      checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000), // 34 days from now
    },
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
    acceptanceStrategy: {
      type: 'auction',
      auctionEndDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
    auctionId: 'auction-123',
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

  const mockAuction: SwapAuction = {
    id: 'auction-123',
    swapId: 'swap-123',
    ownerId: 'user-123',
    status: 'active',
    settings: {
      endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      allowBookingProposals: true,
      allowCashProposals: true,
      minimumCashOffer: 200,
      autoSelectAfterHours: 24,
    },
    proposals: [],
    blockchain: { creationTransactionId: 'tx-123' },
    createdAt: new Date(),
    updatedAt: new Date(),
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
      bookings: [mockBooking],
      currentBooking: null,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 1 },
    },
    swaps: {
      swaps: [mockEnhancedSwap],
      currentSwap: mockEnhancedSwap,
      loading: false,
      error: null,
      filters: {},
      pagination: { page: 1, limit: 10, total: 1 },
    },
    auctions: {
      auctions: [mockAuction],
      currentAuction: mockAuction,
      proposals: [],
      loading: false,
      error: null,
      filters: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Enhanced Swap Creation Workflow', () => {
    it('should create enhanced swap with auction mode end-to-end', async () => {
      const user = userEvent.setup();
      const mockCreateSwap = vi.mocked(swapThunks.createEnhancedSwapThunk);
      mockCreateSwap.mockReturnValue({
        type: 'swaps/createEnhanced/fulfilled',
        payload: mockEnhancedSwap,
      } as any);

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Fill in swap details
      const titleInput = screen.getByLabelText(/swap title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      await user.type(titleInput, 'Paris Hotel Auction Swap');
      await user.type(
        descriptionInput,
        'Looking for equivalent hotel in London'
      );

      // Enable cash payments
      const cashPaymentRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(cashPaymentRadio);

      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '300');

      // Select auction mode
      const auctionRadio = screen.getByLabelText(/auction mode/i);
      await user.click(auctionRadio);

      // Set auction end date
      const auctionEndDateInput = screen.getByLabelText(/auction end date/i);
      const validEndDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      await user.clear(auctionEndDateInput);
      await user.type(
        auctionEndDateInput,
        validEndDate.toISOString().split('T')[0]
      );

      // Submit form
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateSwap).toHaveBeenCalledWith({
          sourceBookingId: 'booking-123',
          title: 'Paris Hotel Auction Swap',
          description: 'Looking for equivalent hotel in London',
          paymentTypes: {
            bookingExchange: true,
            cashPayment: true,
            minimumCashAmount: 300,
          },
          acceptanceStrategy: {
            type: 'auction',
            auctionEndDate: expect.any(Date),
            autoSelectHighest: false,
          },
          auctionSettings: {
            endDate: expect.any(Date),
            allowBookingProposals: true,
            allowCashProposals: true,
            minimumCashOffer: 300,
            autoSelectAfterHours: 24,
          },
          swapPreferences: {
            preferredLocations: [],
            additionalRequirements: [],
          },
          expirationDate: expect.any(Date),
        });
      });
    });

    it('should handle auction management workflow', async () => {
      const user = userEvent.setup();
      const mockEndAuction = vi.mocked(auctionThunks.endAuctionThunk);
      mockEndAuction.mockReturnValue({ type: 'auctions/end/fulfilled' } as any);

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      // Verify auction details are displayed
      expect(screen.getByText('Auction Management')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();

      // End auction early
      const endAuctionButton = screen.getByRole('button', {
        name: /end auction early/i,
      });
      await user.click(endAuctionButton);

      // Confirm in modal
      const confirmButton = screen.getByRole('button', {
        name: /confirm end auction/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockEndAuction).toHaveBeenCalledWith('auction-123');
      });
    });

    it('should handle proposal creation workflow', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.mocked(
        swapThunks.createEnhancedProposalThunk
      );
      mockCreateProposal.mockReturnValue({
        type: 'swaps/createProposal/fulfilled',
      } as any);

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

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Select cash proposal type
      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      // Set cash amount
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
      await user.type(messageInput, 'Cash offer for your Paris booking');

      // Submit proposal
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
          message: 'Cash offer for your Paris booking',
          conditions: [],
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle auction timing validation errors', async () => {
      const user = userEvent.setup();

      const lastMinuteBooking = createMockBooking({
        id: 'booking-last-minute',
        type: 'hotel' as BookingType,
        dateRange: {
          checkIn: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          checkOut: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={lastMinuteBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Auction mode should be disabled for last-minute bookings
      const auctionRadio = screen.getByLabelText(/auction mode/i);
      expect(auctionRadio).toBeDisabled();
      expect(
        screen.getByText(
          /auction mode is not available for bookings less than one week away/i
        )
      ).toBeInTheDocument();
    });

    it('should handle payment validation errors', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Enable cash payments
      const cashPaymentRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(cashPaymentRadio);

      // Enter invalid minimum amount
      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '50'); // Below platform minimum

      // Try to submit
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        expect(
          screen.getByText(/minimum cash amount must be at least \$100/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle network errors gracefully', async () => {
      const user = userEvent.setup();
      const mockCreateSwap = vi.mocked(swapThunks.createEnhancedSwapThunk);
      mockCreateSwap.mockReturnValue({
        type: 'swaps/createEnhanced/rejected',
        error: { message: 'Network connection failed' },
      } as any);

      const errorState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          error: 'Network connection failed',
        },
      };

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: errorState }
      );

      expect(
        screen.getByText(/network connection failed/i)
      ).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should support keyboard navigation throughout workflow', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      const titleInput = screen.getByLabelText(/swap title/i);
      titleInput.focus();

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/description/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/booking exchange only/i)).toHaveFocus();

      // Use arrow keys to navigate radio buttons
      await user.keyboard('{ArrowDown}');
      expect(screen.getByLabelText(/booking exchange and cash/i)).toHaveFocus();
    });

    it('should provide proper ARIA labels and screen reader support', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: /payment types/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radiogroup', { name: /acceptance strategy/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/swap title/i)).toHaveAttribute(
        'aria-required',
        'true'
      );
    });

    it('should announce validation errors to screen readers', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Try to submit without filling required fields
      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      await waitFor(() => {
        const errorMessage = screen.getByText(/title is required/i);
        expect(errorMessage).toHaveAttribute('role', 'alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      });
    });
  });
});
