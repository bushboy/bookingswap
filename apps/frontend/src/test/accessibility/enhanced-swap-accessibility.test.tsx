import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
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
  PaymentMethod,
  BookingType,
} from '@booking-swap/shared';

expect.extend(toHaveNoViolations);

describe('Enhanced Swap Components Accessibility Tests', () => {
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

  describe('EnhancedSwapCreationModal Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Create Swap');

      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings.length).toBeGreaterThan(0);
    });

    it('should have proper form labels and descriptions', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Check that all form inputs have labels
      const titleInput = screen.getByLabelText(/swap title/i);
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).toHaveAttribute('aria-required', 'true');

      const descriptionInput = screen.getByLabelText(/description/i);
      expect(descriptionInput).toBeInTheDocument();
      expect(descriptionInput).toHaveAttribute('aria-required', 'true');

      // Check radio groups have proper labels
      const paymentTypeGroup = screen.getByRole('radiogroup', {
        name: /payment types/i,
      });
      expect(paymentTypeGroup).toBeInTheDocument();

      const acceptanceStrategyGroup = screen.getByRole('radiogroup', {
        name: /acceptance strategy/i,
      });
      expect(acceptanceStrategyGroup).toBeInTheDocument();
    });

    it('should have proper focus management', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Modal should trap focus
      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');

      // First focusable element should receive focus
      const titleInput = screen.getByLabelText(/swap title/i);
      expect(titleInput).toHaveFocus();
    });

    it('should announce validation errors properly', () => {
      const errorState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          error: 'Failed to create swap: Invalid auction timing',
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

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('AuctionManagementDashboard Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper landmark regions', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /auction details/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /proposals/i })
      ).toBeInTheDocument();
    });

    it('should have proper status announcements', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      const statusElement = screen.getByLabelText(/auction status/i);
      expect(statusElement).toBeInTheDocument();
      expect(statusElement).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible countdown timer', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      const countdown = screen.getByTestId('auction-countdown');
      expect(countdown).toHaveAttribute('aria-label');
      expect(countdown).toHaveAttribute('aria-live', 'polite');
    });

    it('should have accessible proposal actions', () => {
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

      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: endedAuctionState }
      );

      const selectButtons = screen.getAllByRole('button', {
        name: /select as winner/i,
      });
      selectButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-describedby');
      });
    });
  });

  describe('EnhancedProposalCreationForm Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(
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

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form structure', () => {
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

      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();

      const proposalTypeGroup = screen.getByRole('radiogroup', {
        name: /proposal type/i,
      });
      expect(proposalTypeGroup).toBeInTheDocument();
    });

    it('should have accessible booking selection', () => {
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

      const bookingCards = screen.getAllByRole('button', {
        name: /select booking/i,
      });
      bookingCards.forEach(card => {
        expect(card).toHaveAttribute('aria-describedby');
        expect(card).toHaveAttribute('aria-pressed');
      });
    });

    it('should have accessible payment method selection', () => {
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

      const paymentMethodSelect = screen.getByLabelText(/payment method/i);
      expect(paymentMethodSelect).toBeInTheDocument();
      expect(paymentMethodSelect).toHaveAttribute('aria-required', 'true');
    });

    it('should announce form validation errors', () => {
      const errorState: Partial<RootState> = {
        ...initialState,
        swaps: {
          ...initialState.swaps!,
          error: 'Failed to create proposal: Payment method invalid',
        },
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
        { preloadedState: errorState }
      );

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should have sufficient color contrast for all text elements', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // Check that important elements have proper contrast classes
      const primaryButton = screen.getByRole('button', {
        name: /create swap/i,
      });
      expect(primaryButton).toHaveClass('bg-primary-600', 'text-white');

      const secondaryButton = screen.getByRole('button', { name: /cancel/i });
      expect(secondaryButton).toHaveClass('border-gray-300', 'text-gray-700');
    });

    it('should not rely solely on color for information', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      // Status should have both color and text/icon indicators
      const statusElement = screen.getByText('Active');
      expect(statusElement).toBeInTheDocument();

      // Should have accompanying icon or additional text
      const statusIcon = screen.getByTestId('status-icon');
      expect(statusIcon).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation through all interactive elements', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      // All interactive elements should be focusable
      const interactiveElements = screen
        .getAllByRole('button')
        .concat(screen.getAllByRole('textbox'))
        .concat(screen.getAllByRole('radio'))
        .concat(screen.getAllByRole('checkbox'));

      interactiveElements.forEach(element => {
        expect(element).toHaveAttribute('tabindex');
      });
    });

    it('should support arrow key navigation for radio groups', () => {
      renderWithProviders(
        <EnhancedSwapCreationModal
          booking={mockBooking}
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />,
        { preloadedState: initialState }
      );

      const radioGroups = screen.getAllByRole('radiogroup');
      radioGroups.forEach(group => {
        const radios = screen.getAllByRole('radio');
        radios.forEach(radio => {
          expect(radio).toHaveAttribute('aria-describedby');
        });
      });
    });
  });

  describe('Screen Reader Support', () => {
    it('should provide proper alternative text for images', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      const images = screen.getAllByRole('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
      });
    });

    it('should provide descriptive link text', () => {
      renderWithProviders(
        <AuctionManagementDashboard auctionId="auction-123" />,
        { preloadedState: initialState }
      );

      const links = screen.getAllByRole('link');
      links.forEach(link => {
        const linkText = link.textContent || link.getAttribute('aria-label');
        expect(linkText).toBeTruthy();
        expect(linkText).not.toMatch(/^(click here|read more|link)$/i);
      });
    });

    it('should provide context for form controls', () => {
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

      const formControls = screen
        .getAllByRole('textbox')
        .concat(screen.getAllByRole('radio'))
        .concat(screen.getAllByRole('checkbox'))
        .concat(screen.getAllByRole('combobox'));

      formControls.forEach(control => {
        // Each control should have either a label or aria-label
        const hasLabel =
          control.getAttribute('aria-labelledby') ||
          control.getAttribute('aria-label') ||
          screen.queryByLabelText(control.getAttribute('name') || '');
        expect(hasLabel).toBeTruthy();
      });
    });
  });
});
