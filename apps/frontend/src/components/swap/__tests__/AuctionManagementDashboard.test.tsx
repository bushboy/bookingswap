import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, createMockUser } from '../../../test/testUtils';
import { AuctionManagementDashboard } from '../AuctionManagementDashboard';
import { RootState } from '../../../store';
import * as auctionThunks from '../../../store/thunks/auctionThunks';
import { SwapAuction, AuctionProposal } from '@booking-swap/shared';

// Mock the thunks
vi.mock('../../../store/thunks/auctionThunks', () => ({
  selectAuctionWinnerThunk: vi.fn(),
  endAuctionThunk: vi.fn(),
  fetchAuctionDetailsThunk: vi.fn(),
}));

describe('AuctionManagementDashboard', () => {
  const mockUser = createMockUser({ id: 'user-123' });

  const mockAuction: SwapAuction = {
    id: 'auction-123',
    swapId: 'swap-123',
    ownerId: 'user-123',
    status: 'active',
    settings: {
      endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
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

  const mockBookingProposal: AuctionProposal = {
    id: 'proposal-booking-1',
    auctionId: 'auction-123',
    proposerId: 'user-456',
    proposalType: 'booking',
    bookingId: 'booking-456',
    message: 'Great London hotel for your Paris booking',
    conditions: ['Same star rating'],
    status: 'pending',
    submittedAt: new Date(),
    blockchain: { transactionId: 'tx-proposal-1' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCashProposal: AuctionProposal = {
    id: 'proposal-cash-1',
    auctionId: 'auction-123',
    proposerId: 'user-789',
    proposalType: 'cash',
    cashOffer: {
      amount: 350,
      currency: 'USD',
      paymentMethodId: 'pm-123',
      escrowRequired: true,
    },
    message: 'Cash offer for your booking',
    conditions: [],
    status: 'pending',
    submittedAt: new Date(),
    blockchain: { transactionId: 'tx-proposal-2' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const defaultProps = {
    auctionId: 'auction-123',
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
    auctions: {
      auctions: [mockAuction],
      currentAuction: mockAuction,
      proposals: [mockBookingProposal, mockCashProposal],
      loading: false,
      error: null,
      filters: {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render auction dashboard with auction details', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Auction Management')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText(/2 proposals received/i)).toBeInTheDocument();
    });

    it('should display auction countdown timer', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByTestId('auction-countdown')).toBeInTheDocument();
      expect(screen.getByText(/time remaining/i)).toBeInTheDocument();
    });

    it('should show auction settings', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(
        screen.getByText(/minimum cash offer: \$200/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/booking proposals: allowed/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/cash proposals: allowed/i)).toBeInTheDocument();
    });
  });

  describe('Proposal Display and Management', () => {
    it('should display booking proposals correctly', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Booking Proposals (1)')).toBeInTheDocument();
      expect(
        screen.getByText('Great London hotel for your Paris booking')
      ).toBeInTheDocument();
      expect(screen.getByText('Same star rating')).toBeInTheDocument();
    });

    it('should display cash proposals correctly', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByText('Cash Proposals (1)')).toBeInTheDocument();
      expect(screen.getByText('$350 USD')).toBeInTheDocument();
      expect(
        screen.getByText('Cash offer for your booking')
      ).toBeInTheDocument();
      expect(screen.getByText(/escrow required/i)).toBeInTheDocument();
    });

    it('should sort cash proposals by amount in descending order', () => {
      const additionalCashProposal: AuctionProposal = {
        ...mockCashProposal,
        id: 'proposal-cash-2',
        proposerId: 'user-999',
        cashOffer: {
          amount: 500, // Higher amount
          currency: 'USD',
          paymentMethodId: 'pm-456',
          escrowRequired: true,
        },
      };

      const stateWithMultipleCashProposals: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          proposals: [
            mockBookingProposal,
            mockCashProposal,
            additionalCashProposal,
          ],
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: stateWithMultipleCashProposals,
      });

      const cashAmounts = screen.getAllByText(/\$\d+ USD/);
      expect(cashAmounts[0]).toHaveTextContent('$500 USD'); // Higher amount first
      expect(cashAmounts[1]).toHaveTextContent('$350 USD');
    });

    it('should show proposal comparison view', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      const compareButton = screen.getByRole('button', {
        name: /compare proposals/i,
      });
      await user.click(compareButton);

      expect(screen.getByText('Proposal Comparison')).toBeInTheDocument();
      expect(screen.getByText('Booking vs Cash Analysis')).toBeInTheDocument();
    });

    it('should highlight recommended proposal', () => {
      const stateWithRecommendation: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            recommendedProposalId: 'proposal-cash-1',
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: stateWithRecommendation,
      });

      expect(screen.getByTestId('recommended-proposal')).toBeInTheDocument();
      expect(screen.getByText(/recommended/i)).toBeInTheDocument();
    });
  });

  describe('Auction Actions', () => {
    it('should allow ending auction early', async () => {
      const user = userEvent.setup();
      const mockEndAuction = vi.mocked(auctionThunks.endAuctionThunk);
      mockEndAuction.mockReturnValue({ type: 'auctions/end/fulfilled' } as any);

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

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

    it('should allow selecting winner from ended auction', async () => {
      const user = userEvent.setup();
      const mockSelectWinner = vi.mocked(
        auctionThunks.selectAuctionWinnerThunk
      );
      mockSelectWinner.mockReturnValue({
        type: 'auctions/selectWinner/fulfilled',
      } as any);

      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      // Select a proposal
      const selectWinnerButton = screen.getAllByRole('button', {
        name: /select as winner/i,
      })[0];
      await user.click(selectWinnerButton);

      // Confirm selection
      const confirmButton = screen.getByRole('button', {
        name: /confirm selection/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockSelectWinner).toHaveBeenCalledWith({
          auctionId: 'auction-123',
          proposalId: 'proposal-booking-1',
        });
      });
    });

    it('should disable winner selection for active auctions', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      const selectButtons = screen.queryAllByRole('button', {
        name: /select as winner/i,
      });
      expect(selectButtons).toHaveLength(0);

      expect(
        screen.getByText(/auction must end before selecting winner/i)
      ).toBeInTheDocument();
    });

    it('should show auto-selection countdown for ended auctions', () => {
      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
            endedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Ended 2 hours ago
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      expect(
        screen.getByTestId('auto-selection-countdown')
      ).toBeInTheDocument();
      expect(screen.getByText(/auto-selection in/i)).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should update proposal count when new proposals arrive', async () => {
      const { rerender } = renderWithProviders(
        <AuctionManagementDashboard {...defaultProps} />,
        {
          preloadedState: initialState,
        }
      );

      expect(screen.getByText(/2 proposals received/i)).toBeInTheDocument();

      // Simulate new proposal arriving
      const newProposal: AuctionProposal = {
        ...mockCashProposal,
        id: 'proposal-new',
        proposerId: 'user-new',
        cashOffer: { ...mockCashProposal.cashOffer!, amount: 400 },
      };

      const updatedState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          proposals: [...initialState.auctions!.proposals!, newProposal],
        },
      };

      rerender(<AuctionManagementDashboard {...defaultProps} />);

      // Update the provider with new state
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: updatedState,
      });

      expect(screen.getByText(/3 proposals received/i)).toBeInTheDocument();
    });

    it('should update countdown timer', async () => {
      vi.useFakeTimers();

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      const initialCountdown = screen.getByTestId('auction-countdown');
      const initialText = initialCountdown.textContent;

      // Advance time by 1 minute
      vi.advanceTimersByTime(60 * 1000);

      await waitFor(() => {
        const updatedCountdown = screen.getByTestId('auction-countdown');
        expect(updatedCountdown.textContent).not.toBe(initialText);
      });

      vi.useRealTimers();
    });
  });

  describe('Filtering and Sorting', () => {
    it('should allow filtering proposals by type', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      // Filter to show only cash proposals
      const cashFilterButton = screen.getByRole('button', {
        name: /cash only/i,
      });
      await user.click(cashFilterButton);

      expect(screen.getByText('Cash Proposals (1)')).toBeInTheDocument();
      expect(screen.queryByText('Booking Proposals')).not.toBeInTheDocument();
    });

    it('should allow sorting proposals by submission time', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      const sortDropdown = screen.getByLabelText(/sort proposals/i);
      await user.selectOptions(sortDropdown, 'newest-first');

      // Verify sorting is applied (would need to check order of proposals)
      expect(sortDropdown).toHaveValue('newest-first');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /auction details/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /proposals/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/auction status/i)).toBeInTheDocument();
    });

    it('should announce auction status changes to screen readers', () => {
      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        /auction has ended/i
      );
    });

    it('should support keyboard navigation for proposal selection', async () => {
      const user = userEvent.setup();
      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      const firstProposal = screen.getAllByRole('button', {
        name: /select as winner/i,
      })[0];
      firstProposal.focus();

      await user.keyboard('{Enter}');

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should provide clear focus indicators', () => {
      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: initialState,
      });

      const endAuctionButton = screen.getByRole('button', {
        name: /end auction early/i,
      });
      endAuctionButton.focus();

      expect(endAuctionButton).toHaveClass('focus:ring-2');
    });
  });

  describe('Error Handling', () => {
    it('should display error when auction fails to load', () => {
      const errorState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          error: 'Failed to load auction details',
          currentAuction: null,
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: errorState,
      });

      expect(
        screen.getByText(/failed to load auction details/i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });

    it('should handle winner selection errors gracefully', async () => {
      const user = userEvent.setup();
      const mockSelectWinner = vi.mocked(
        auctionThunks.selectAuctionWinnerThunk
      );
      mockSelectWinner.mockReturnValue({
        type: 'auctions/selectWinner/rejected',
        error: { message: 'Selection failed' },
      } as any);

      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
          },
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      const selectWinnerButton = screen.getAllByRole('button', {
        name: /select as winner/i,
      })[0];
      await user.click(selectWinnerButton);

      const confirmButton = screen.getByRole('button', {
        name: /confirm selection/i,
      });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/selection failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching auction details', () => {
      const loadingState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          loading: true,
          currentAuction: null,
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: loadingState,
      });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText(/loading auction details/i)).toBeInTheDocument();
    });

    it('should show loading state during winner selection', async () => {
      const endedAuctionState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          currentAuction: {
            ...mockAuction,
            status: 'ended',
          },
          loading: true,
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: endedAuctionState,
      });

      const selectButtons = screen.getAllByRole('button', {
        name: /selecting.../i,
      });
      expect(selectButtons.length).toBeGreaterThan(0);
      selectButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no proposals exist', () => {
      const emptyProposalsState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          proposals: [],
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: emptyProposalsState,
      });

      expect(
        screen.getByText(/no proposals received yet/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/share your auction to attract more proposals/i)
      ).toBeInTheDocument();
    });

    it('should show appropriate message for auction without cash proposals', () => {
      const bookingOnlyState: Partial<RootState> = {
        ...initialState,
        auctions: {
          ...initialState.auctions!,
          proposals: [mockBookingProposal],
        },
      };

      renderWithProviders(<AuctionManagementDashboard {...defaultProps} />, {
        preloadedState: bookingOnlyState,
      });

      expect(screen.getByText('Booking Proposals (1)')).toBeInTheDocument();
      expect(screen.getByText('Cash Proposals (0)')).toBeInTheDocument();
    });
  });
});
