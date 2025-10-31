import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { MakeProposalModal } from '../MakeProposalModal';
import { EligibleSwap, SwapWithProposalInfo, CompatibilityAnalysis } from '@booking-swap/shared';

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
  getSwapCompatibility: vi.fn(),
  createProposalFromBrowse: vi.fn(),
}));

// Mock the ProposalCreationForm component with enhanced functionality
vi.mock('../ProposalCreationForm', () => ({
  ProposalCreationForm: ({ 
    targetSwap, 
    selectedSwap, 
    compatibility,
    onSubmit, 
    onCancel,
    loading,
    validationErrors 
  }: any) => (
    <div data-testid="proposal-form">
      <div data-testid="target-swap">{targetSwap?.title}</div>
      <div data-testid="selected-swap">{selectedSwap?.title}</div>
      {compatibility && (
        <div data-testid="compatibility-score">{compatibility.overallScore}%</div>
      )}
      {validationErrors?.map((error: string, index: number) => (
        <div key={index} data-testid="validation-error">{error}</div>
      ))}
      <textarea data-testid="message-input" placeholder="Enter your message" />
      <input data-testid="conditions-input" placeholder="Add conditions" />
      <label>
        <input type="checkbox" data-testid="terms-checkbox" />
        I agree to the terms
      </label>
      <button 
        onClick={() => onSubmit({ 
          message: 'Test message',
          conditions: ['Test condition'],
          agreedToTerms: true 
        })}
        disabled={loading}
        data-testid="submit-button"
      >
        {loading ? 'Submitting...' : 'Submit Proposal'}
      </button>
      <button onClick={onCancel} data-testid="cancel-button">Cancel</button>
    </div>
  ),
}));

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
  description: 'Beautiful villa with vineyard views',
  dateRange: {
    checkIn: new Date('2024-08-01'),
    checkOut: new Date('2024-08-08'),
  },
  accommodationType: 'Villa',
  guests: 6,
};

const mockEligibleSwaps: EligibleSwap[] = [
  {
    id: 'eligible-swap-1',
    sourceBookingId: 'booking-eligible-1',
    title: 'Beach House in Malibu',
    description: 'Oceanfront property with private beach access',
    bookingDetails: {
      location: 'Malibu, CA',
      dateRange: {
        checkIn: new Date('2024-08-05'),
        checkOut: new Date('2024-08-12'),
      },
      accommodationType: 'House',
      guests: 8,
      estimatedValue: 4000,
    },
    status: 'active',
    createdAt: new Date('2024-04-15'),
    isCompatible: true,
    compatibilityScore: 92,
  },
  {
    id: 'eligible-swap-2',
    sourceBookingId: 'booking-eligible-2',
    title: 'Mountain Chalet in Switzerland',
    description: 'Cozy chalet with Alpine views',
    bookingDetails: {
      location: 'Zermatt, Switzerland',
      dateRange: {
        checkIn: new Date('2024-08-10'),
        checkOut: new Date('2024-08-17'),
      },
      accommodationType: 'Chalet',
      guests: 4,
      estimatedValue: 2800,
    },
    status: 'active',
    createdAt: new Date('2024-04-20'),
    isCompatible: true,
    compatibilityScore: 78,
  },
  {
    id: 'eligible-swap-3',
    sourceBookingId: 'booking-eligible-3',
    title: 'City Apartment in Tokyo',
    description: 'Modern apartment in Shibuya district',
    bookingDetails: {
      location: 'Tokyo, Japan',
      dateRange: {
        checkIn: new Date('2024-09-01'),
        checkOut: new Date('2024-09-05'),
      },
      accommodationType: 'Apartment',
      guests: 2,
      estimatedValue: 1500,
    },
    status: 'active',
    createdAt: new Date('2024-04-25'),
    isCompatible: false,
    compatibilityScore: 45,
  },
];

const mockCompatibilityAnalysis: CompatibilityAnalysis = {
  overallScore: 92,
  factors: {
    locationCompatibility: { score: 85, weight: 0.25, details: 'Different continents but both premium destinations', status: 'good' },
    dateCompatibility: { score: 95, weight: 0.20, details: 'Excellent date overlap and similar duration', status: 'excellent' },
    valueCompatibility: { score: 88, weight: 0.30, details: 'Well-matched property values', status: 'excellent' },
    accommodationCompatibility: { score: 90, weight: 0.15, details: 'Both luxury vacation properties', status: 'excellent' },
    guestCompatibility: { score: 80, weight: 0.10, details: 'Good capacity match', status: 'good' },
  },
  recommendations: [
    'Excellent overall compatibility',
    'Both properties offer luxury vacation experiences',
    'Consider highlighting unique features of your property'
  ],
  potentialIssues: []
};

describe('MakeProposalModal - Enhanced Functionality', () => {
  const defaultProps = {
    isOpen: true,
    targetSwap: mockTargetSwap,
    userEligibleSwaps: mockEligibleSwaps,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Swap Selection and Compatibility', () => {
    it('displays eligible swaps sorted by compatibility score', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const swapCards = screen.getAllByTestId('eligible-swap-card');
      expect(swapCards).toHaveLength(3);

      // Should be sorted by compatibility score (highest first)
      expect(screen.getByText('Beach House in Malibu')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument(); // Highest score first
      
      expect(screen.getByText('Mountain Chalet in Switzerland')).toBeInTheDocument();
      expect(screen.getByText('78%')).toBeInTheDocument();
      
      expect(screen.getByText('City Apartment in Tokyo')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument(); // Lowest score last
    });

    it('shows compatibility indicators with appropriate styling', () => {
      render(<MakeProposalModal {...defaultProps} />);

      // High compatibility (92%)
      const highCompatibility = screen.getByTestId('compatibility-92');
      expect(highCompatibility).toHaveClass('compatibility-excellent');
      expect(highCompatibility).toHaveAttribute('aria-label', 'Excellent compatibility: 92%');

      // Medium compatibility (78%)
      const mediumCompatibility = screen.getByTestId('compatibility-78');
      expect(mediumCompatibility).toHaveClass('compatibility-good');

      // Low compatibility (45%)
      const lowCompatibility = screen.getByTestId('compatibility-45');
      expect(lowCompatibility).toHaveClass('compatibility-poor');
    });

    it('filters out incompatible swaps when filter is applied', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      // Apply compatibility filter
      const filterToggle = screen.getByRole('checkbox', { name: /show only compatible swaps/i });
      await user.click(filterToggle);

      // Should only show compatible swaps (score >= 60)
      expect(screen.getByText('Beach House in Malibu')).toBeInTheDocument();
      expect(screen.getByText('Mountain Chalet in Switzerland')).toBeInTheDocument();
      expect(screen.queryByText('City Apartment in Tokyo')).not.toBeInTheDocument();
    });

    it('loads detailed compatibility analysis when swap is selected', async () => {
      const user = userEvent.setup();
      const mockGetCompatibility = vi.fn().mockResolvedValue(mockCompatibilityAnalysis);
      
      vi.mocked(require('../../../services/swapService').getSwapCompatibility)
        .mockImplementation(mockGetCompatibility);

      render(<MakeProposalModal {...defaultProps} />);

      // Select first swap
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);

      await waitFor(() => {
        expect(mockGetCompatibility).toHaveBeenCalledWith('eligible-swap-1', 'target-swap-123');
      });

      // Should show detailed compatibility analysis
      expect(screen.getByTestId('detailed-compatibility')).toBeInTheDocument();
      expect(screen.getByText('92% Overall Compatibility')).toBeInTheDocument();
    });
  });

  describe('Form Validation and Error Handling', () => {
    it('validates proposal form before submission', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      // Select a swap and proceed to form
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);

      const continueButton = screen.getByText('Continue to Proposal');
      await user.click(continueButton);

      // Try to submit without required fields
      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText('Message is required')).toBeInTheDocument();
        expect(screen.getByText('You must agree to the terms')).toBeInTheDocument();
      });
    });

    it('shows real-time validation feedback', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      // Navigate to form
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);
      await user.click(screen.getByText('Continue to Proposal'));

      // Type in message field
      const messageInput = screen.getByTestId('message-input');
      await user.type(messageInput, 'A');
      
      // Should show character count
      expect(screen.getByText('1/500 characters')).toBeInTheDocument();

      // Type too much
      await user.type(messageInput, 'A'.repeat(500));
      expect(screen.getByText('Message is too long')).toBeInTheDocument();
    });

    it('handles API errors gracefully', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.fn().mockRejectedValue(new Error('Network error'));
      
      vi.mocked(require('../../../services/swapService').createProposalFromBrowse)
        .mockImplementation(mockCreateProposal);

      render(<MakeProposalModal {...defaultProps} />);

      // Complete the form
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);
      await user.click(screen.getByText('Continue to Proposal'));

      // Fill form and submit
      const messageInput = screen.getByTestId('message-input');
      await user.type(messageInput, 'This is a test message');
      
      const termsCheckbox = screen.getByTestId('terms-checkbox');
      await user.click(termsCheckbox);

      const submitButton = screen.getByTestId('submit-button');
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to create proposal. Please try again.')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
    });

    it('prevents duplicate submissions', async () => {
      const user = userEvent.setup();
      const mockCreateProposal = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );
      
      vi.mocked(require('../../../services/swapService').createProposalFromBrowse)
        .mockImplementation(mockCreateProposal);

      render(<MakeProposalModal {...defaultProps} />);

      // Complete the form
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);
      await user.click(screen.getByText('Continue to Proposal'));

      const submitButton = screen.getByTestId('submit-button');
      
      // Submit multiple times quickly
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only call API once
      expect(mockCreateProposal).toHaveBeenCalledTimes(1);
      expect(submitButton).toBeDisabled();
      expect(screen.getByText('Submitting...')).toBeInTheDocument();
    });
  });

  describe('User Experience Enhancements', () => {
    it('shows swap comparison side by side', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);

      // Should show comparison view
      expect(screen.getByTestId('swap-comparison')).toBeInTheDocument();
      expect(screen.getByText('Your Swap')).toBeInTheDocument();
      expect(screen.getByText('Their Swap')).toBeInTheDocument();
      
      // Should show key details for comparison
      expect(screen.getByText('Beach House in Malibu')).toBeInTheDocument();
      expect(screen.getByText('Luxury Villa in Tuscany')).toBeInTheDocument();
    });

    it('provides helpful recommendations based on compatibility', async () => {
      const user = userEvent.setup();
      
      vi.mocked(require('../../../services/swapService').getSwapCompatibility)
        .mockResolvedValue(mockCompatibilityAnalysis);

      render(<MakeProposalModal {...defaultProps} />);

      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);

      await waitFor(() => {
        expect(screen.getByText('Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Excellent overall compatibility')).toBeInTheDocument();
        expect(screen.getByText('Consider highlighting unique features of your property')).toBeInTheDocument();
      });
    });

    it('shows estimated response time and next steps', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);
      await user.click(screen.getByText('Continue to Proposal'));

      expect(screen.getByText('What happens next?')).toBeInTheDocument();
      expect(screen.getByText('The swap owner will review your proposal')).toBeInTheDocument();
      expect(screen.getByText('You\'ll receive a notification when they respond')).toBeInTheDocument();
      expect(screen.getByText('Estimated response time: 2-3 business days')).toBeInTheDocument();
    });

    it('saves draft proposal automatically', async () => {
      const user = userEvent.setup();
      const mockSaveDraft = vi.fn();

      render(<MakeProposalModal {...defaultProps} onSaveDraft={mockSaveDraft} />);

      // Navigate to form
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);
      await user.click(screen.getByText('Continue to Proposal'));

      // Type in message
      const messageInput = screen.getByTestId('message-input');
      await user.type(messageInput, 'This is a draft message');

      // Should auto-save after typing stops
      await waitFor(() => {
        expect(mockSaveDraft).toHaveBeenCalledWith({
          targetSwapId: 'target-swap-123',
          sourceSwapId: 'eligible-swap-1',
          message: 'This is a draft message',
          conditions: [],
          agreedToTerms: false
        });
      }, { timeout: 3000 });

      expect(screen.getByText('Draft saved')).toBeInTheDocument();
    });
  });

  describe('Accessibility Features', () => {
    it('provides proper ARIA labels and descriptions', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby', 'make-proposal-title');
      expect(modal).toHaveAttribute('aria-describedby', 'make-proposal-description');

      const swapCards = screen.getAllByRole('button', { name: /select swap/i });
      swapCards.forEach(card => {
        expect(card).toHaveAttribute('aria-describedby');
      });
    });

    it('supports keyboard navigation throughout the modal', async () => {
      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      // Tab through elements
      await user.tab(); // Close button
      await user.tab(); // First swap card
      await user.tab(); // Second swap card
      await user.tab(); // Third swap card
      await user.tab(); // Filter checkbox
      await user.tab(); // Cancel button

      // Should cycle back to close button
      await user.tab();
      expect(screen.getByRole('button', { name: /close/i })).toHaveFocus();
    });

    it('announces important changes to screen readers', async () => {
      const user = userEvent.setup();
      const mockAnnounce = vi.fn();
      
      vi.mocked(require('../../../hooks/useAccessibility').useAnnouncements).mockReturnValue({
        announce: mockAnnounce
      });

      render(<MakeProposalModal {...defaultProps} />);

      // Select a swap
      const firstSwapCard = screen.getByTestId('eligible-swap-card-eligible-swap-1');
      await user.click(firstSwapCard);

      expect(mockAnnounce).toHaveBeenCalledWith('Beach House in Malibu selected. Compatibility: 92%');

      // Continue to form
      await user.click(screen.getByText('Continue to Proposal'));
      expect(mockAnnounce).toHaveBeenCalledWith('Proposal form loaded. Please fill in your message and conditions.');
    });

    it('provides clear focus indicators and skip links', () => {
      render(<MakeProposalModal {...defaultProps} />);

      const skipLink = screen.getByText('Skip to proposal form');
      expect(skipLink).toHaveClass('sr-only');
      expect(skipLink).toHaveAttribute('href', '#proposal-form');

      // Focus indicators should be visible
      const focusableElements = screen.getAllByRole('button');
      focusableElements.forEach(element => {
        expect(element).toHaveClass('focus-visible');
      });
    });
  });

  describe('Mobile Responsiveness', () => {
    it('adapts layout for mobile devices', () => {
      vi.mocked(require('../../../hooks/useResponsive').useResponsive).mockReturnValue({
        isMobile: true,
        isTablet: false
      });

      render(<MakeProposalModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveClass('mobile-modal');

      // Should use vertical layout on mobile
      const swapGrid = screen.getByTestId('eligible-swaps-grid');
      expect(swapGrid).toHaveClass('mobile-vertical-layout');
    });

    it('uses swipe gestures for swap selection on mobile', async () => {
      vi.mocked(require('../../../hooks/useResponsive').useResponsive).mockReturnValue({
        isMobile: true,
        isTablet: false
      });

      const user = userEvent.setup();

      render(<MakeProposalModal {...defaultProps} />);

      const swapContainer = screen.getByTestId('swaps-container');
      
      // Simulate swipe gesture
      fireEvent.touchStart(swapContainer, {
        touches: [{ clientX: 100, clientY: 0 }]
      });
      fireEvent.touchMove(swapContainer, {
        touches: [{ clientX: 50, clientY: 0 }]
      });
      fireEvent.touchEnd(swapContainer);

      // Should navigate to next swap
      await waitFor(() => {
        expect(screen.getByTestId('swap-indicator-1')).toHaveClass('active');
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('virtualizes large lists of eligible swaps', () => {
      const manySwaps = Array.from({ length: 100 }, (_, i) => ({
        ...mockEligibleSwaps[0],
        id: `eligible-swap-${i}`,
        title: `Swap ${i}`,
      }));

      render(<MakeProposalModal {...defaultProps} userEligibleSwaps={manySwaps} />);

      // Should only render visible items
      const renderedSwaps = screen.getAllByTestId(/eligible-swap-card/);
      expect(renderedSwaps.length).toBeLessThan(20); // Only visible items rendered

      // Should show total count
      expect(screen.getByText('100 eligible swaps')).toBeInTheDocument();
    });

    it('debounces search input for performance', async () => {
      const user = userEvent.setup();
      const mockSearch = vi.fn();

      render(<MakeProposalModal {...defaultProps} onSearchSwaps={mockSearch} />);

      const searchInput = screen.getByPlaceholderText('Search your swaps...');
      
      // Type quickly
      await user.type(searchInput, 'beach');

      // Should debounce the search calls
      await waitFor(() => {
        expect(mockSearch).toHaveBeenCalledTimes(1);
        expect(mockSearch).toHaveBeenCalledWith('beach');
      }, { timeout: 1000 });
    });
  });
});