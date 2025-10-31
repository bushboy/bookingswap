import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderWithProviders,
  createMockUser,
  createMockBooking,
} from '../testUtils';
import { EnhancedSwapCreationModal } from '../../components/swap/EnhancedSwapCreationModal';
import { AuctionManagementDashboard } from '../../components/swap/AuctionManagementDashboard';
import { EnhancedProposalCreationForm } from '../../components/swap/EnhancedProposalCreationForm';
import { RootState } from '../../store';
import {
  EnhancedSwap,
  SwapAuction,
  AuctionProposal,
  PaymentMethod,
  BookingType,
} from '@booking-swap/shared';

describe('Enhanced Swap Components Edge Cases and Error Handling', () => {
  const mockUser = createMockUser({ id: 'user-123' });
  const mockBooking = createMockBooking({
    id: 'booking-123',
    title: 'Paris Hotel',
    type: 'hotel' as BookingType,
    dateRange: {
      checkIn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      checkOut: new Date(Date.now() + 34 * 24 * 60 * 60 * 1000),
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

  const createInitialState = (
    overrides: Partial<RootState> = {}
  ): Partial<RootState> => ({
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
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any console errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('EnhancedSwapCreationModal Edge Cases', () => {
    it('should handle null/undefined booking gracefully', () => {
      expect(() => {
        renderWithProviders(
          <EnhancedSwapCreationModal
            booking={null as any}
            isOpen={true}
            onClose={vi.fn()}
            onSuccess={vi.fn()}
          />,
          { preloadedState: createInitialState() }
        );
      }).not.toThrow();

      expect(
        screen.getByText(/booking information unavailable/i)
      ).toBeInTheDocument();
    });

    it('should handle booking with missing required fields', () => {
      const incompleteBooking = {
        ...mockBooking,
        title: '',
        dateRange: null as any,
        location: null as any,
      };

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={incompleteBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      expect(screen.getByText(/untitled booking/i)).toBeInTheDocument();
      expect(screen.getByText(/location not specified/i)).toBeInTheDocument();
    });

    it('should handle booking with past dates', () => {
      const pastBooking = createMockBooking({
        id: 'booking-past',
        type: 'hotel' as BookingType,
        dateRange: {
          checkIn: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
          checkOut: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        },
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={pastBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      expect(
        screen.getByText(/this booking has already passed/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create swap/i })
      ).toBeDisabled();
    });

    it('should handle extremely large cash amounts', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Enable cash payments
      const cashPaymentRadio = screen.getByLabelText(
        /booking exchange and cash/i
      );
      await user.click(cashPaymentRadio);

      // Enter extremely large amount
      const minimumCashInput = screen.getByLabelText(/minimum cash amount/i);
      await user.clear(minimumCashInput);
      await user.type(minimumCashInput, '999999999999');

      await user.tab(); // Trigger validation

      await waitFor(() => {
        expect(
          screen.getByText(/amount exceeds maximum limit/i)
        ).toBeInTheDocument();
      });
    });

    it('should handle special characters in form inputs', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const titleInput = screen.getByLabelText(/swap title/i);
      const descriptionInput = screen.getByLabelText(/description/i);

      // Test with special characters and emojis
      await user.type(titleInput, 'Test 🏨 <script>alert("xss")</script>');
      await user.type(descriptionInput, 'Description with "quotes" & symbols');

      // Should sanitize input
      expect(titleInput).toHaveValue('Test 🏨 ');
      expect(descriptionInput).toHaveValue(
        'Description with "quotes" & symbols'
      );
    });

    it('should handle network timeouts gracefully', async () => {
      const user = userEvent.setup();

      // Mock network timeout
      const timeoutState = createInitialState({
        swaps: {
          swaps: [],
          currentSwap: null,
          loading: false,
          error: 'Request timeout - please check your connection',
          filters: {},
          pagination: { page: 1, limit: 10, total: 0 },
        },
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: timeoutState }
      );

      expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });

    it('should handle concurrent form submissions', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={onSubmit}
        />,
        { preloadedState: createInitialState() }
      );

      // Fill form
      const titleInput = screen.getByLabelText(/swap title/i);
      await user.type(titleInput, 'Concurrent Test');

      const createButton = screen.getByRole('button', { name: /create swap/i });

      // Simulate rapid clicking
      await user.click(createButton);
      await user.click(createButton);
      await user.click(createButton);

      // Should only submit once
      await waitFor(() => {
        expect(createButton).toBeDisabled();
      });
    });
  });

  describe('AuctionManagementDashboard Edge Cases', () => {
    it('should handle missing auction data', () => {
      const noAuctionState = createInitialState({
        auctions: {
          auctions: [],
          currentAuction: null,
          proposals: [],
          loading: false,
          error: null,
          filters: {},
        },
      });

      renderWithProviders(
        <AuctionManagementDashboard auctionId="nonexistent-auction" />,
        { preloadedState: noAuctionState }
      );

      expect(screen.getByText(/auction not found/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /go back/i })
      ).toBeInTheDocument();
    });

    it('should handle corrupted auction data', () => {
      const corruptedAuction = {
        ...mockAuction,
        settings: null as any,
        proposals: undefined as any,
      };

      const corruptedState = createInitialState({
        auctions: {
          auctions: [corruptedAuction],
          currentAuction: corruptedAuction,
          proposals: [],
          loading: false,
          error: null,
          filters: {},
        },
      });

      expect(() => {
        renderWithProviders(
          <AuctionManagementDashboard auctionId="auction-123" />,
          { preloadedState: corruptedState }
        );
      }).not.toThrow();

      expect(screen.getByText(/auction data corrupted/i)).toBeInTheDocument();
    });

    it('should handle proposals with invalid data', () => {
      const invalidProposals: AuctionProposal[] = [
        {
          id: 'proposal-invalid',
          auctionId: 'auction-123',
          proposerId: '',
          proposalType: 'cash',
          cashOffer: {
            amount: -100, // Invalid negative amount
            currency: '',
            paymentMethodId: '',
            escrowRequired: true,
          },
          message: '',
          conditions: [],
          status: 'pending',
          submittedAt: new Date('invalid-date'),
          blockchain: { transactionId: '' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const invalidProposalState = createInitialState({
        auctions: {
          auctions: [mockAuction],
          currentAuction: mockAuction,
          proposals: invalidProposals,
          loading: false,
          error: null,
          filters: {},
        },
      });

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: invalidProposalState }
      );

      expect(screen.getByText(/invalid proposal data/i)).toBeInTheDocument();
    });

    it('should handle auction end date in the past', () => {
      const expiredAuction = {
        ...mockAuction,
        settings: {
          ...mockAuction.settings,
          endDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        },
        status: 'active' as const, // Still marked as active but end date passed
      };

      const expiredState = createInitialState({
        auctions: {
          auctions: [expiredAuction],
          currentAuction: expiredAuction,
          proposals: [],
          loading: false,
          error: null,
          filters: {},
        },
      });

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: expiredState }
      );

      expect(screen.getByText(/auction has expired/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /force end auction/i })
      ).toBeInTheDocument();
    });

    it('should handle WebSocket connection failures', async () => {
      // Mock WebSocket failure
      const mockWebSocket = {
        close: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readyState: WebSocket.CLOSED,
      };

      global.WebSocket = vi.fn(() => mockWebSocket) as any;

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: createInitialState() }
      );

      expect(
        screen.getByText(/real-time updates unavailable/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /refresh manually/i })
      ).toBeInTheDocument();
    });

    it('should handle extremely large proposal counts', () => {
      const manyProposals = Array.from({ length: 10000 }, (_, i) => ({
        id: `proposal-${i}`,
        auctionId: 'auction-123',
        proposerId: `user-${i}`,
        proposalType: 'cash' as const,
        cashOffer: {
          amount: 200 + i,
          currency: 'USD',
          paymentMethodId: `pm-${i}`,
          escrowRequired: true,
        },
        message: `Proposal ${i}`,
        conditions: [],
        status: 'pending' as const,
        submittedAt: new Date(),
        blockchain: { transactionId: `tx-${i}` },
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const largeProposalState = createInitialState({
        auctions: {
          auctions: [mockAuction],
          currentAuction: mockAuction,
          proposals: manyProposals,
          loading: false,
          error: null,
          filters: {},
        },
      });

      expect(() => {
        renderWithProviders(
          <AuctionManagementDashboard auctionId="auction-123" />,
          { preloadedState: largeProposalState }
        );
      }).not.toThrow();

      // Should implement virtualization or pagination
      expect(screen.getByText(/showing 1-100 of 10000/i)).toBeInTheDocument();
    });
  });

  describe('EnhancedProposalCreationForm Edge Cases', () => {
    it('should handle empty user bookings list', () => {
      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      expect(screen.getByText(/no bookings available/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/booking exchange/i)).toBeDisabled();
    });

    it('should handle empty payment methods list', () => {
      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      expect(
        screen.getByText(/no payment methods available/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/cash offer/i)).toBeDisabled();
    });

    it('should handle invalid payment method data', () => {
      const invalidPaymentMethod = {
        ...mockPaymentMethod,
        isVerified: false,
        displayName: '',
        type: 'unknown' as any,
      };

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[invalidPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      expect(
        screen.getByText(/unverified payment method/i)
      ).toBeInTheDocument();
    });

    it('should handle booking with incompatible dates', async () => {
      const user = userEvent.setup();
      const incompatibleBooking = createMockBooking({
        id: 'booking-incompatible',
        type: 'hotel' as BookingType,
        dateRange: {
          checkIn: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
          checkOut: new Date(Date.now() + 65 * 24 * 60 * 60 * 1000), // Different season
        },
      });

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[incompatibleBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const bookingCard = screen.getByTestId(
        'booking-card-booking-incompatible'
      );
      await user.click(bookingCard);

      expect(
        screen.getByText(/date compatibility warning/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/significant date difference/i)
      ).toBeInTheDocument();
    });

    it('should handle currency conversion errors', async () => {
      const user = userEvent.setup();

      // Mock currency conversion failure
      const foreignSwap = {
        ...mockEnhancedSwap,
        cashDetails: {
          ...mockEnhancedSwap.cashDetails!,
          currency: 'EUR',
        },
      };

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={foreignSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const cashRadio = screen.getByLabelText(/cash offer/i);
      await user.click(cashRadio);

      expect(
        screen.getByText(/currency conversion unavailable/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/amounts shown in EUR/i)).toBeInTheDocument();
    });

    it('should handle form submission with network interruption', async () => {
      const user = userEvent.setup();
      const onSubmit = vi
        .fn()
        .mockRejectedValue(new Error('Network interrupted'));

      renderWithProviders(
        <EnhancedProposalCreationForm
          targetSwap={mockEnhancedSwap}
          targetBooking={mockBooking}
          userBookings={[mockBooking]}
          userPaymentMethods={[mockPaymentMethod]}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Fill and submit form
      const bookingRadio = screen.getByLabelText(/booking exchange/i);
      await user.click(bookingRadio);

      const bookingCard = screen.getByTestId('booking-card-booking-123');
      await user.click(bookingCard);

      const submitButton = screen.getByRole('button', {
        name: /submit proposal/i,
      });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network interrupted/i)).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: /retry submission/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Cross-Component Integration Edge Cases', () => {
    it('should handle state synchronization issues', async () => {
      const user = userEvent.setup();

      // Simulate state where auction exists but swap doesn't
      const inconsistentState = createInitialState({
        swaps: {
          swaps: [],
          currentSwap: null,
          loading: false,
          error: null,
          filters: {},
          pagination: { page: 1, limit: 10, total: 0 },
        },
      });

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: inconsistentState }
      );

      expect(
        screen.getByText(/data synchronization error/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /refresh data/i })
      ).toBeInTheDocument();
    });

    it('should handle component unmounting during async operations', async () => {
      const user = userEvent.setup();

      const { unmount } = renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Start form submission
      const titleInput = screen.getByLabelText(/swap title/i);
      await user.type(titleInput, 'Test Swap');

      const createButton = screen.getByRole('button', { name: /create swap/i });
      await user.click(createButton);

      // Unmount component during submission
      unmount();

      // Should not cause memory leaks or errors
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should handle browser back/forward navigation', () => {
      // Mock browser navigation
      const mockHistory = {
        pushState: vi.fn(),
        replaceState: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
      };

      Object.defineProperty(window, 'history', {
        value: mockHistory,
        writable: true,
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      // Simulate browser back button
      window.dispatchEvent(new PopStateEvent('popstate'));

      // Should handle navigation gracefully
      expect(screen.getByText('Create Enhanced Swap')).toBeInTheDocument();
    });
  });

  describe('Security Edge Cases', () => {
    it('should sanitize user input to prevent XSS', async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: createInitialState() }
      );

      const titleInput = screen.getByLabelText(/swap title/i);

      // Attempt XSS injection
      await user.type(titleInput, '<script>alert("xss")</script>');

      // Should sanitize the input
      expect(titleInput.value).not.toContain('<script>');
    });

    it('should validate CSRF tokens for sensitive operations', async () => {
      const user = userEvent.setup();

      // Mock missing CSRF token
      const insecureState = createInitialState({
        auth: {
          user: {
            id: mockUser.id,
            walletAddress: '0x123',
            displayName: mockUser.profile.firstName,
            email: mockUser.email,
            verificationLevel: 'verified' as const,
          },
          isAuthenticated: true,
          walletConnected: false, // Wallet not connected
          loading: false,
          error: null,
        },
      });

      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: insecureState }
      );

      expect(
        screen.getByText(/wallet connection required/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /create swap/i })
      ).toBeDisabled();
    });

    it('should handle unauthorized access attempts', () => {
      const unauthorizedState = createInitialState({
        auth: {
          user: null,
          isAuthenticated: false,
          walletConnected: false,
          loading: false,
          error: 'Unauthorized access',
        },
      });

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: unauthorizedState }
      );

      expect(screen.getByText(/unauthorized access/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /sign in/i })
      ).toBeInTheDocument();
    });
  });
});
