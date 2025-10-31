import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { SwapCard } from '../SwapCard';
import { SwapWithBookings } from '@/services/swapService';
import { Booking } from '@booking-swap/shared';

// Mock hooks and services
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useId: (prefix: string) => `${prefix}-test-id`,
  useAnnouncements: () => ({ announce: vi.fn() }),
}));

vi.mock('../../../services/swapService', () => ({
  getUserEligibleSwaps: vi.fn(),
  createProposalFromBrowse: vi.fn(),
  getSwapCompatibility: vi.fn(),
}));

// Mock data for browse mode testing
const mockBrowseSwap: SwapWithBookings = {
  id: 'browse-swap-123',
  sourceBookingId: 'booking-browse-1',
  targetBookingId: null,
  proposerId: null,
  ownerId: 'other-user-456',
  status: 'active',
  terms: null,
  blockchain: { proposalTransactionId: null },
  timeline: { createdAt: new Date('2024-05-01') },
  sourceBooking: {
    id: 'booking-browse-1',
    userId: 'other-user-456',
    type: 'hotel',
    title: 'Luxury Resort in Bali',
    description: 'Beautiful beachfront resort with spa',
    location: {
      city: 'Ubud',
      country: 'Indonesia',
      coordinates: [-8.5069, 115.2625],
    },
    dateRange: {
      checkIn: new Date('2024-07-01'),
      checkOut: new Date('2024-07-07'),
    },
    originalPrice: 1200,
    swapValue: 1100,
    providerDetails: {
      provider: 'Agoda',
      confirmationNumber: 'AG789012',
      bookingReference: 'BALI123',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date('2024-04-15'),
      documents: ['bali-booking.pdf'],
    },
    blockchain: {
      transactionId: 'tx-bali-123',
      consensusTimestamp: '1234567890',
      topicId: 'topic-bali',
    },
    status: 'available',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-04-15'),
  },
  targetBooking: null,
  proposer: null,
  owner: {
    id: 'other-user-456',
    walletAddress: '0x789',
    profile: {
      displayName: 'Sarah Wilson',
      bio: 'Digital nomad and travel blogger',
      avatar: 'sarah-avatar.jpg',
    },
    verification: {
      level: 'verified',
      verifiedAt: new Date('2024-01-15'),
    },
    preferences: {
      notifications: { email: true, push: true, sms: false },
      privacy: { showProfile: true, showBookings: true },
    },
    swapCriteria: {
      maxAdditionalPayment: 300,
      preferredLocations: ['Bali', 'Thailand', 'Vietnam'],
    },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  createdAt: new Date('2024-04-15'),
  updatedAt: new Date('2024-04-15'),
};

describe('SwapCard - Proposal Functionality', () => {
  const mockOnMakeProposal = vi.fn();
  const mockOnViewDetails = vi.fn();
  const currentUserId = 'current-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Browse Mode - Make Proposal Button', () => {
    it('shows "Make Proposal" button when user can propose', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          onViewDetails={mockOnViewDetails}
        />
      );

      expect(screen.getByText('Make Proposal')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /make proposal/i })).toBeEnabled();
    });

    it('disables "Make Proposal" button when user has no eligible swaps', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          hasEligibleSwaps={false}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toBeDisabled();
      expect(proposalButton).toHaveAttribute('title', 'You have no eligible swaps for this proposal');
    });

    it('hides "Make Proposal" button for own swap', () => {
      const ownSwap = {
        ...mockBrowseSwap,
        ownerId: currentUserId,
      };

      render(
        <SwapCard
          swap={ownSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      expect(screen.queryByText('Make Proposal')).not.toBeInTheDocument();
    });

    it('calls onMakeProposal when "Make Proposal" button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      await user.click(proposalButton);

      expect(mockOnMakeProposal).toHaveBeenCalledWith(mockBrowseSwap.id);
    });

    it('shows loading state when proposal is being created', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          proposalLoading={true}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toBeDisabled();
      expect(screen.getByText('Creating...')).toBeInTheDocument();
    });

    it('supports keyboard navigation for proposal button', async () => {
      const user = userEvent.setup();

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      
      // Focus the button
      await user.tab();
      expect(proposalButton).toHaveFocus();

      // Activate with Enter
      await user.keyboard('{Enter}');
      expect(mockOnMakeProposal).toHaveBeenCalledWith(mockBrowseSwap.id);

      // Reset and test with Space
      mockOnMakeProposal.mockClear();
      await user.keyboard(' ');
      expect(mockOnMakeProposal).toHaveBeenCalledWith(mockBrowseSwap.id);
    });
  });

  describe('Proposal Eligibility Indicators', () => {
    it('shows compatibility score when available', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          compatibilityScore={85}
        />
      );

      expect(screen.getByText('85% Match')).toBeInTheDocument();
      expect(screen.getByLabelText('High compatibility')).toBeInTheDocument();
    });

    it('shows different compatibility levels with appropriate styling', () => {
      const testCases = [
        { score: 90, level: 'Excellent', className: 'excellent' },
        { score: 75, level: 'Good', className: 'good' },
        { score: 55, level: 'Fair', className: 'fair' },
        { score: 30, level: 'Poor', className: 'poor' },
      ];

      testCases.forEach(({ score, level, className }) => {
        const { rerender } = render(
          <SwapCard
            swap={mockBrowseSwap}
            mode="browse"
            currentUserId={currentUserId}
            compatibilityScore={score}
          />
        );

        expect(screen.getByText(`${score}% Match`)).toBeInTheDocument();
        expect(screen.getByLabelText(`${level} compatibility`)).toBeInTheDocument();
        expect(screen.getByTestId('compatibility-indicator')).toHaveClass(className);

        rerender(<div />); // Clear for next test
      });
    });

    it('shows proposal count when user has made proposals', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userProposalCount={3}
        />
      );

      expect(screen.getByText('3 proposals received')).toBeInTheDocument();
    });

    it('shows "No proposals yet" when no proposals exist', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userProposalCount={0}
        />
      );

      expect(screen.getByText('No proposals yet')).toBeInTheDocument();
    });
  });

  describe('Proposal Status Indicators', () => {
    it('shows "Proposal Sent" status when user has active proposal', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userHasActiveProposal={true}
        />
      );

      expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
      expect(screen.queryByText('Make Proposal')).not.toBeInTheDocument();
    });

    it('shows proposal status with timestamp', () => {
      const proposalDate = new Date('2024-05-20T10:30:00Z');
      
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userHasActiveProposal={true}
          proposalSentAt={proposalDate}
        />
      );

      expect(screen.getByText('Proposal Sent')).toBeInTheDocument();
      expect(screen.getByText(/Sent on May 20, 2024/)).toBeInTheDocument();
    });

    it('shows different proposal statuses correctly', () => {
      const statuses = [
        { status: 'pending', text: 'Proposal Sent', className: 'pending' },
        { status: 'accepted', text: 'Proposal Accepted', className: 'accepted' },
        { status: 'rejected', text: 'Proposal Rejected', className: 'rejected' },
        { status: 'expired', text: 'Proposal Expired', className: 'expired' },
      ];

      statuses.forEach(({ status, text, className }) => {
        const { rerender } = render(
          <SwapCard
            swap={mockBrowseSwap}
            mode="browse"
            currentUserId={currentUserId}
            proposalStatus={status as any}
          />
        );

        expect(screen.getByText(text)).toBeInTheDocument();
        expect(screen.getByTestId('proposal-status')).toHaveClass(className);

        rerender(<div />); // Clear for next test
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error message when proposal creation fails', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          proposalError="Failed to create proposal. Please try again."
        />
      );

      expect(screen.getByText('Failed to create proposal. Please try again.')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('clears error when user retries proposal', async () => {
      const user = userEvent.setup();
      const mockOnClearError = vi.fn();

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          proposalError="Network error occurred"
          onClearProposalError={mockOnClearError}
        />
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockOnClearError).toHaveBeenCalled();
      expect(mockOnMakeProposal).toHaveBeenCalledWith(mockBrowseSwap.id);
    });

    it('shows validation errors for ineligible proposals', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          validationErrors={[
            'You have already made a proposal for this swap',
            'Your swap dates overlap with this booking'
          ]}
        />
      );

      expect(screen.getByText('You have already made a proposal for this swap')).toBeInTheDocument();
      expect(screen.getByText('Your swap dates overlap with this booking')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /make proposal/i })).toBeDisabled();
    });
  });

  describe('Accessibility Features', () => {
    it('provides proper ARIA labels for proposal actions', () => {
      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          compatibilityScore={85}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toHaveAttribute('aria-describedby');
      
      const compatibilityIndicator = screen.getByLabelText('High compatibility');
      expect(compatibilityIndicator).toHaveAttribute('role', 'img');
    });

    it('announces proposal status changes to screen readers', () => {
      const mockAnnounce = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      const { rerender } = render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      // Simulate proposal being sent
      rerender(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          userHasActiveProposal={true}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Proposal sent successfully');
    });

    it('provides keyboard shortcuts for common actions', async () => {
      const user = userEvent.setup();

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
          onViewDetails={mockOnViewDetails}
        />
      );

      const card = screen.getByRole('article');
      
      // Test keyboard shortcut for viewing details (Enter)
      await user.click(card);
      await user.keyboard('{Enter}');
      expect(mockOnViewDetails).toHaveBeenCalledWith(mockBrowseSwap.id);

      // Test keyboard shortcut for making proposal (P key)
      await user.keyboard('p');
      expect(mockOnMakeProposal).toHaveBeenCalledWith(mockBrowseSwap.id);
    });

    it('supports high contrast mode for proposal indicators', () => {
      // Mock high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          compatibilityScore={85}
        />
      );

      const compatibilityIndicator = screen.getByTestId('compatibility-indicator');
      expect(compatibilityIndicator).toHaveClass('high-contrast');
    });
  });

  describe('Mobile Responsiveness', () => {
    it('adapts layout for mobile devices', () => {
      vi.mocked(require('../../../hooks/useResponsive').useResponsive).mockReturnValue({
        isMobile: true,
        isTablet: false
      });

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveClass('mobile-layout');
      
      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toHaveClass('mobile-button');
    });

    it('uses touch-friendly button sizes on mobile', () => {
      vi.mocked(require('../../../hooks/useResponsive').useResponsive).mockReturnValue({
        isMobile: true,
        isTablet: false
      });

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          onMakeProposal={mockOnMakeProposal}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      const buttonStyles = window.getComputedStyle(proposalButton);
      
      // Check minimum touch target size (44px)
      expect(parseInt(buttonStyles.minHeight)).toBeGreaterThanOrEqual(44);
      expect(parseInt(buttonStyles.minWidth)).toBeGreaterThanOrEqual(44);
    });
  });

  describe('Performance Optimizations', () => {
    it('memoizes expensive compatibility calculations', () => {
      const mockGetCompatibility = vi.fn().mockResolvedValue({ score: 85 });
      
      vi.mocked(require('../../../services/swapService').getSwapCompatibility)
        .mockImplementation(mockGetCompatibility);

      const { rerender } = render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userEligibleSwaps={['swap-1', 'swap-2']}
        />
      );

      // Re-render with same props
      rerender(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userEligibleSwaps={['swap-1', 'swap-2']}
        />
      );

      // Compatibility should only be calculated once due to memoization
      expect(mockGetCompatibility).toHaveBeenCalledTimes(1);
    });

    it('lazy loads proposal history when expanded', async () => {
      const user = userEvent.setup();
      const mockLoadProposalHistory = vi.fn();

      render(
        <SwapCard
          swap={mockBrowseSwap}
          mode="browse"
          currentUserId={currentUserId}
          userProposalCount={5}
          onLoadProposalHistory={mockLoadProposalHistory}
        />
      );

      const expandButton = screen.getByRole('button', { name: /view proposals/i });
      await user.click(expandButton);

      expect(mockLoadProposalHistory).toHaveBeenCalledWith(mockBrowseSwap.id);
    });
  });
});