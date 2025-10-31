import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SwapCard } from '../SwapCard';
import { MakeProposalModal } from '../MakeProposalModal';
import { ProposalCreationForm } from '../ProposalCreationForm';
import { SwapWithBookings, EligibleSwap, SwapWithProposalInfo, CompatibilityAnalysis } from '@booking-swap/shared';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock hooks
vi.mock('../../../hooks/useResponsive', () => ({
  useResponsive: () => ({ isMobile: false, isTablet: false }),
}));

vi.mock('../../../hooks/useAccessibility', () => ({
  useId: (prefix: string) => `${prefix}-test-id`,
  useAnnouncements: () => ({ announce: vi.fn() }),
  useFocusManagement: () => ({
    focusFirstError: vi.fn(),
    trapFocus: vi.fn(),
    restoreFocus: vi.fn(),
  }),
}));

// Mock data
const mockSwap: SwapWithBookings = {
  id: 'swap-123',
  sourceBookingId: 'booking-1',
  targetBookingId: null,
  proposerId: null,
  ownerId: 'owner-456',
  status: 'active',
  terms: null,
  blockchain: { proposalTransactionId: null },
  timeline: { createdAt: new Date('2024-05-01') },
  sourceBooking: {
    id: 'booking-1',
    userId: 'owner-456',
    type: 'hotel',
    title: 'Luxury Resort in Bali',
    description: 'Beautiful beachfront resort',
    location: { city: 'Ubud', country: 'Indonesia', coordinates: [-8.5069, 115.2625] },
    dateRange: { checkIn: new Date('2024-07-01'), checkOut: new Date('2024-07-07') },
    originalPrice: 1200,
    swapValue: 1100,
    providerDetails: { provider: 'Agoda', confirmationNumber: 'AG789', bookingReference: 'BALI123' },
    verification: { status: 'verified', verifiedAt: new Date('2024-04-15'), documents: [] },
    blockchain: { transactionId: 'tx-123', consensusTimestamp: '123', topicId: 'topic-123' },
    status: 'available',
    createdAt: new Date('2024-04-15'),
    updatedAt: new Date('2024-04-15'),
  },
  targetBooking: null,
  proposer: null,
  owner: {
    id: 'owner-456',
    walletAddress: '0x789',
    profile: { displayName: 'Sarah Wilson', bio: 'Travel blogger', avatar: 'avatar.jpg' },
    verification: { level: 'verified', verifiedAt: new Date('2024-01-15') },
    preferences: { notifications: { email: true, push: true, sms: false }, privacy: { showProfile: true, showBookings: true } },
    swapCriteria: { maxAdditionalPayment: 300, preferredLocations: ['Bali'] },
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  createdAt: new Date('2024-04-15'),
  updatedAt: new Date('2024-04-15'),
};

const mockTargetSwap: SwapWithProposalInfo = {
  id: 'target-swap-123',
  sourceBookingId: 'booking-target-1',
  targetBookingId: null,
  proposerId: null,
  ownerId: 'owner-456',
  status: 'active',
  terms: null,
  blockchain: { proposalTransactionId: null },
  timeline: { createdAt: new Date('2024-05-01') },
  createdAt: new Date('2024-05-01'),
  updatedAt: new Date('2024-05-01'),
  title: 'Luxury Villa in Tuscany',
  location: 'Florence, Italy',
  estimatedValue: 3500,
};

const mockEligibleSwaps: EligibleSwap[] = [
  {
    id: 'eligible-swap-1',
    sourceBookingId: 'booking-eligible-1',
    title: 'Beach House in Malibu',
    description: 'Oceanfront property',
    bookingDetails: {
      location: 'Malibu, CA',
      dateRange: { checkIn: new Date('2024-08-05'), checkOut: new Date('2024-08-12') },
      accommodationType: 'House',
      guests: 8,
      estimatedValue: 4000,
    },
    status: 'active',
    createdAt: new Date('2024-04-15'),
    isCompatible: true,
    compatibilityScore: 92,
  },
];

const mockCompatibility: CompatibilityAnalysis = {
  overallScore: 92,
  factors: {
    locationCompatibility: { score: 85, weight: 0.25, details: 'Good match', status: 'good' },
    dateCompatibility: { score: 95, weight: 0.20, details: 'Excellent overlap', status: 'excellent' },
    valueCompatibility: { score: 88, weight: 0.30, details: 'Well-matched', status: 'excellent' },
    accommodationCompatibility: { score: 90, weight: 0.15, details: 'Both luxury', status: 'excellent' },
    guestCompatibility: { score: 80, weight: 0.10, details: 'Good capacity', status: 'good' },
  },
  recommendations: ['Excellent match'],
  potentialIssues: []
};

describe('Proposal Workflow - Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SwapCard Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
          compatibilityScore={85}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper semantic structure', () => {
      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
        />
      );

      // Should use article for semantic meaning
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('aria-labelledby');

      // Should have proper heading structure
      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
    });

    it('provides comprehensive ARIA labels and descriptions', () => {
      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
          compatibilityScore={85}
        />
      );

      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toHaveAttribute('aria-describedby');
      
      const compatibilityIndicator = screen.getByLabelText(/compatibility/i);
      expect(compatibilityIndicator).toHaveAttribute('role', 'img');
      expect(compatibilityIndicator).toHaveAttribute('aria-label', expect.stringContaining('85%'));
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      const mockOnMakeProposal = vi.fn();
      const mockOnViewDetails = vi.fn();

      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={mockOnMakeProposal}
          onViewDetails={mockOnViewDetails}
        />
      );

      const card = screen.getByRole('article');
      const proposalButton = screen.getByRole('button', { name: /make proposal/i });

      // Tab to card
      await user.tab();
      expect(card).toHaveFocus();

      // Enter should trigger view details
      await user.keyboard('{Enter}');
      expect(mockOnViewDetails).toHaveBeenCalled();

      // Tab to proposal button
      await user.tab();
      expect(proposalButton).toHaveFocus();

      // Enter should trigger proposal
      await user.keyboard('{Enter}');
      expect(mockOnMakeProposal).toHaveBeenCalled();
    });

    it('provides proper focus indicators', () => {
      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
        />
      );

      const focusableElements = screen.getAllByRole('button');
      focusableElements.forEach(element => {
        expect(element).toHaveClass('focus-visible');
      });
    });

    it('announces status changes to screen readers', async () => {
      const mockAnnounce = vi.fn();
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      const { rerender } = render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
        />
      );

      // Simulate proposal being sent
      rerender(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          onMakeProposal={vi.fn()}
          userHasActiveProposal={true}
        />
      );

      expect(mockAnnounce).toHaveBeenCalledWith('Proposal sent successfully');
    });

    it('supports high contrast mode', () => {
      // Mock high contrast media query
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
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          compatibilityScore={85}
        />
      );

      const compatibilityIndicator = screen.getByTestId('compatibility-indicator');
      expect(compatibilityIndicator).toHaveClass('high-contrast');
    });
  });

  describe('MakeProposalModal Accessibility', () => {
    const defaultProps = {
      isOpen: true,
      targetSwap: mockTargetSwap,
      userEligibleSwaps: mockEligibleSwaps,
      onClose: vi.fn(),
      onSubmit: vi.fn(),
      loading: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(<MakeProposalModal {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('implements proper modal accessibility patterns', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-describedby');

      // Should have close button
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('traps focus within modal', async () => {
      const user = userEvent.setup();
      const mockTrapFocus = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useFocusManagement).mockReturnValue({
        focusFirstError: vi.fn(),
        trapFocus: mockTrapFocus,
        restoreFocus: vi.fn(),
      });

      render(<MakeProposalModal {...defaultProps} />);

      expect(mockTrapFocus).toHaveBeenCalled();

      // Tab through elements should stay within modal
      await user.tab(); // Close button
      await user.tab(); // First swap card
      await user.tab(); // Second swap card (if exists)
      await user.tab(); // Cancel button
      await user.tab(); // Should cycle back to close button

      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveFocus();
    });

    it('restores focus when modal closes', () => {
      const mockRestoreFocus = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useFocusManagement).mockReturnValue({
        focusFirstError: vi.fn(),
        trapFocus: vi.fn(),
        restoreFocus: mockRestoreFocus,
      });

      const { rerender } = render(<MakeProposalModal {...defaultProps} />);

      // Close modal
      rerender(<MakeProposalModal {...defaultProps} isOpen={false} />);

      expect(mockRestoreFocus).toHaveBeenCalled();
    });

    it('supports escape key to close modal', async () => {
      const user = userEvent.setup();
      const mockOnClose = vi.fn();

      render(<MakeProposalModal {...defaultProps} onClose={mockOnClose} />);

      await user.keyboard('{Escape}');
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('provides proper labels for swap selection', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const swapCards = screen.getAllByRole('button', { name: /select.*swap/i });
      swapCards.forEach((card, index) => {
        expect(card).toHaveAttribute('aria-describedby');
        expect(card).toHaveAttribute('aria-pressed'); // For toggle state
      });
    });

    it('announces selection changes', async () => {
      const user = userEvent.setup();
      const mockAnnounce = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      render(<MakeProposalModal {...defaultProps} />);

      const firstSwapCard = screen.getByRole('button', { name: /select.*beach house/i });
      await user.click(firstSwapCard);

      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining('Beach House in Malibu selected')
      );
    });
  });

  describe('ProposalCreationForm Accessibility', () => {
    const defaultProps = {
      targetSwap: mockTargetSwap,
      selectedSwap: mockEligibleSwaps[0],
      compatibility: mockCompatibility,
      onSubmit: vi.fn(),
      onCancel: vi.fn(),
      loading: false,
    };

    it('should have no accessibility violations', async () => {
      const { container } = render(<ProposalCreationForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper form structure and labels', () => {
      render(<ProposalCreationForm {...defaultProps} />);

      // All form controls should have labels
      const messageInput = screen.getByLabelText(/message/i);
      expect(messageInput).toBeInTheDocument();
      expect(messageInput).toHaveAttribute('required');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      expect(termsCheckbox).toBeInTheDocument();
      expect(termsCheckbox).toHaveAttribute('required');

      // Form should have proper structure
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });

    it('provides proper validation feedback', async () => {
      const user = userEvent.setup();

      render(<ProposalCreationForm {...defaultProps} />);

      const messageInput = screen.getByLabelText(/message/i);
      
      // Type invalid message
      await user.type(messageInput, 'Hi');
      fireEvent.blur(messageInput);

      // Should have proper ARIA attributes
      expect(messageInput).toHaveAttribute('aria-invalid', 'true');
      expect(messageInput).toHaveAttribute('aria-describedby');

      // Error message should be associated
      const errorId = messageInput.getAttribute('aria-describedby');
      const errorElement = document.getElementById(errorId!);
      expect(errorElement).toHaveTextContent(/must be at least/i);
      expect(errorElement).toHaveAttribute('role', 'alert');
    });

    it('manages focus for validation errors', async () => {
      const user = userEvent.setup();
      const mockFocusFirstError = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useFocusManagement).mockReturnValue({
        focusFirstError: mockFocusFirstError,
        trapFocus: vi.fn(),
        restoreFocus: vi.fn(),
      });

      render(<ProposalCreationForm {...defaultProps} />);

      // Try to submit invalid form
      const submitButton = screen.getByRole('button', { name: /submit/i });
      await user.click(submitButton);

      expect(mockFocusFirstError).toHaveBeenCalled();
    });

    it('provides keyboard shortcuts for common actions', async () => {
      const user = userEvent.setup();
      const mockOnSubmit = vi.fn();

      render(<ProposalCreationForm {...defaultProps} onSubmit={mockOnSubmit} />);

      // Fill required fields
      const messageInput = screen.getByLabelText(/message/i);
      await user.type(messageInput, 'This is a valid message with enough characters');

      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Ctrl+Enter should submit form
      await user.keyboard('{Control>}{Enter}{/Control}');
      expect(mockOnSubmit).toHaveBeenCalled();
    });

    it('supports screen reader navigation of compatibility info', () => {
      render(<ProposalCreationForm {...defaultProps} />);

      const compatibilitySection = screen.getByRole('region', { name: /compatibility analysis/i });
      expect(compatibilitySection).toBeInTheDocument();

      // Should have proper heading structure
      const compatibilityHeading = screen.getByRole('heading', { name: /compatibility/i });
      expect(compatibilityHeading).toBeInTheDocument();

      // Compatibility factors should be in a list
      const factorsList = screen.getByRole('list', { name: /compatibility factors/i });
      expect(factorsList).toBeInTheDocument();

      const factors = screen.getAllByRole('listitem');
      factors.forEach(factor => {
        expect(factor).toHaveAttribute('aria-label');
      });
    });

    it('provides proper progress indication', () => {
      render(<ProposalCreationForm {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow');
      expect(progressBar).toHaveAttribute('aria-valuemin', '0');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      expect(progressBar).toHaveAttribute('aria-label', /form completion/i);
    });

    it('announces form submission status', async () => {
      const user = userEvent.setup();
      const mockAnnounce = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      render(<ProposalCreationForm {...defaultProps} loading={true} />);

      expect(mockAnnounce).toHaveBeenCalledWith('Submitting proposal, please wait');

      // Simulate successful submission
      const { rerender } = render(<ProposalCreationForm {...defaultProps} loading={false} />);
      
      expect(mockAnnounce).toHaveBeenCalledWith('Proposal submitted successfully');
    });
  });

  describe('Reduced Motion Support', () => {
    it('respects prefers-reduced-motion setting', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
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
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          compatibilityScore={85}
        />
      );

      const card = screen.getByRole('article');
      expect(card).toHaveClass('reduced-motion');
    });
  });

  describe('Screen Reader Optimization', () => {
    it('provides skip links for complex content', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const skipLinks = screen.getAllByText(/skip to/i);
      expect(skipLinks.length).toBeGreaterThan(0);

      skipLinks.forEach(link => {
        expect(link).toHaveAttribute('href');
        expect(link).toHaveClass('sr-only');
      });
    });

    it('uses proper heading hierarchy', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const headings = screen.getAllByRole('heading');
      const headingLevels = headings.map(h => parseInt(h.tagName.charAt(1)));
      
      // Should start with h1 or h2 and not skip levels
      expect(headingLevels[0]).toBeLessThanOrEqual(2);
      
      for (let i = 1; i < headingLevels.length; i++) {
        expect(headingLevels[i] - headingLevels[i-1]).toBeLessThanOrEqual(1);
      }
    });

    it('provides context for dynamic content', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      // Select a swap
      const firstSwapCard = screen.getByRole('button', { name: /select.*beach house/i });
      await user.click(firstSwapCard);

      // Dynamic content should have live region
      const liveRegion = screen.getByRole('status');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Color and Contrast', () => {
    it('maintains sufficient color contrast', () => {
      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          compatibilityScore={85}
        />
      );

      // Test would require actual color contrast calculation
      // This is a placeholder for the concept
      const proposalButton = screen.getByRole('button', { name: /make proposal/i });
      expect(proposalButton).toHaveClass('high-contrast-compliant');
    });

    it('does not rely solely on color for information', () => {
      render(
        <SwapCard
          swap={mockSwap}
          mode="browse"
          currentUserId="user-123"
          compatibilityScore={85}
        />
      );

      const compatibilityIndicator = screen.getByTestId('compatibility-indicator');
      
      // Should have text or icon in addition to color
      expect(compatibilityIndicator).toHaveTextContent('85%');
      expect(compatibilityIndicator).toHaveAttribute('aria-label');
    });
  });
});