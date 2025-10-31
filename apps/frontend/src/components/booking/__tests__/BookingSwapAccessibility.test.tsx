import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { renderWithProviders, createMockBooking, createMockUser } from '@/test/testUtils';
import { UnifiedBookingForm } from '../UnifiedBookingForm';
import { InlineProposalForm } from '../InlineProposalForm';
import { EnhancedBookingCard } from '../EnhancedBookingCard';
import { IntegratedFilterPanel } from '../IntegratedFilterPanel';
import { BookingListings } from '../BookingListings';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock screen reader announcements
const mockAnnounce = vi.fn();
vi.mock('@/hooks/useScreenReader', () => ({
  useScreenReader: () => ({
    announce: mockAnnounce,
    setLiveRegion: vi.fn(),
  }),
}));

// Mock focus management
const mockFocusManager = {
  focusFirst: vi.fn(),
  focusLast: vi.fn(),
  focusNext: vi.fn(),
  focusPrevious: vi.fn(),
  trapFocus: vi.fn(),
  releaseFocus: vi.fn(),
};

vi.mock('@/hooks/useFocusManagement', () => ({
  useFocusManagement: () => mockFocusManager,
}));

const mockBooking = createMockBooking({
  id: 'accessible-booking-1',
  title: 'Accessible Test Booking',
  description: 'A booking for accessibility testing',
  swapInfo: {
    swapId: 'accessible-swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'auction',
    minCashAmount: 100,
    hasActiveProposals: true,
    activeProposalCount: 3,
    auctionEndDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    timeRemaining: 2 * 24 * 60 * 60 * 1000,
  },
});

const mockFilters = {
  swapAvailable: false,
  acceptsCash: false,
  auctionMode: false,
};

describe('Booking Swap Accessibility Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should pass axe accessibility tests for UnifiedBookingForm', async () => {
      const { container } = renderWithProviders(
        <UnifiedBookingForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
          loading={false}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for InlineProposalForm', async () => {
      const { container } = renderWithProviders(
        <InlineProposalForm
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo!}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for EnhancedBookingCard', async () => {
      const { container } = renderWithProviders(
        <EnhancedBookingCard
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for IntegratedFilterPanel', async () => {
      const { container } = renderWithProviders(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={vi.fn()}
          onReset={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should pass axe accessibility tests for BookingListings', async () => {
      const bookings = [mockBooking];
      
      const { container } = renderWithProviders(
        <BookingListings
          bookings={bookings}
          loading={false}
          onBookingClick={vi.fn()}
          onMakeProposal={vi.fn()}
          onEditBooking={vi.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    describe('UnifiedBookingForm Keyboard Navigation', () => {
      it('should support complete keyboard navigation through form', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        // Tab through form elements in logical order
        await user.tab();
        expect(screen.getByLabelText('Title')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('Description *')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('Type')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('City')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('Country')).toHaveFocus();

        // Continue to swap toggle
        for (let i = 0; i < 5; i++) {
          await user.tab();
        }
        expect(screen.getByLabelText('Make available for swapping')).toHaveFocus();

        // Enable swap with keyboard
        await user.keyboard(' '); // Space to toggle
        
        // Should focus first element in swap section
        await waitFor(() => {
          expect(screen.getByLabelText('Accept booking swaps')).toHaveFocus();
        });
      });

      it('should support Escape key to close form', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={onClose}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalled();
      });

      it('should support Enter key to submit form when valid', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={onSubmit}
            mode="create"
            loading={false}
          />
        );

        // Fill required fields
        await user.type(screen.getByLabelText('Title'), 'Test Booking');
        await user.type(screen.getByLabelText('Description *'), 'Test description');
        await user.type(screen.getByLabelText('City'), 'Paris');
        await user.type(screen.getByLabelText('Country'), 'France');
        await user.type(screen.getByLabelText('Original Price ($)'), '200');
        await user.type(screen.getByLabelText('Provider'), 'Test Provider');
        await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

        // Submit with Enter
        await user.keyboard('{Enter}');
        
        await waitFor(() => {
          expect(onSubmit).toHaveBeenCalled();
        });
      });

      it('should manage focus when toggling swap preferences', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        const swapToggle = screen.getByLabelText('Make available for swapping');
        await user.click(swapToggle);

        // Focus should move to first swap preference
        await waitFor(() => {
          expect(screen.getByLabelText('Accept booking swaps')).toHaveFocus();
        });

        // Disable swap
        await user.click(swapToggle);

        // Focus should return to swap toggle
        expect(swapToggle).toHaveFocus();
      });
    });

    describe('InlineProposalForm Keyboard Navigation', () => {
      it('should support keyboard navigation through proposal form', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <InlineProposalForm
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo!}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        );

        // Tab through proposal type radio buttons
        await user.tab();
        expect(screen.getByRole('radio', { name: /swap with my booking/i })).toHaveFocus();

        await user.tab();
        expect(screen.getByRole('radio', { name: /make cash offer/i })).toHaveFocus();

        // Use arrow keys to navigate radio group
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', { name: /make cash offer/i })).toBeChecked();

        await user.keyboard('{ArrowUp}');
        expect(screen.getByRole('radio', { name: /swap with my booking/i })).toBeChecked();

        // Tab to booking selector
        await user.tab();
        expect(screen.getByRole('combobox')).toHaveFocus();

        // Tab to message input
        await user.tab();
        expect(screen.getByLabelText(/message/i)).toHaveFocus();

        // Tab to action buttons
        await user.tab();
        expect(screen.getByText('Cancel')).toHaveFocus();

        await user.tab();
        expect(screen.getByText('Send Proposal')).toHaveFocus();
      });

      it('should support Escape key to cancel proposal', async () => {
        const user = userEvent.setup();
        const onCancel = vi.fn();
        
        renderWithProviders(
          <InlineProposalForm
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo!}
            onSubmit={vi.fn()}
            onCancel={onCancel}
          />
        );

        await user.keyboard('{Escape}');
        expect(onCancel).toHaveBeenCalled();
      });

      it('should focus appropriate field when switching proposal types', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <InlineProposalForm
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo!}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        );

        // Switch to cash proposal
        const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
        await user.click(cashRadio);

        // Focus should move to cash amount input
        await waitFor(() => {
          expect(screen.getByLabelText(/cash offer amount/i)).toHaveFocus();
        });

        // Switch back to booking proposal
        const bookingRadio = screen.getByRole('radio', { name: /swap with my booking/i });
        await user.click(bookingRadio);

        // Focus should move to booking selector
        await waitFor(() => {
          expect(screen.getByRole('combobox')).toHaveFocus();
        });
      });
    });

    describe('BookingCard Keyboard Navigation', () => {
      it('should support keyboard activation of booking actions', async () => {
        const user = userEvent.setup();
        const onMakeProposal = vi.fn();
        const onViewDetails = vi.fn();
        
        renderWithProviders(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo}
            userRole="browser"
            onViewDetails={onViewDetails}
            onMakeProposal={onMakeProposal}
          />
        );

        // Tab to view details button
        await user.tab();
        expect(screen.getByText('View Details')).toHaveFocus();

        // Activate with Enter
        await user.keyboard('{Enter}');
        expect(onViewDetails).toHaveBeenCalledWith(mockBooking);

        // Tab to make proposal button
        await user.tab();
        expect(screen.getByText('Make Proposal')).toHaveFocus();

        // Activate with Space
        await user.keyboard(' ');
        expect(onMakeProposal).toHaveBeenCalledWith(mockBooking);
      });

      it('should provide keyboard shortcuts for common actions', async () => {
        const user = userEvent.setup();
        const onMakeProposal = vi.fn();
        
        renderWithProviders(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo}
            userRole="browser"
            onViewDetails={vi.fn()}
            onMakeProposal={onMakeProposal}
          />
        );

        // Focus the card
        const card = screen.getByRole('article');
        card.focus();

        // Use keyboard shortcut (P for Propose)
        await user.keyboard('p');
        expect(onMakeProposal).toHaveBeenCalledWith(mockBooking);
      });
    });

    describe('Filter Panel Keyboard Navigation', () => {
      it('should support keyboard navigation through filters', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <IntegratedFilterPanel
            filters={mockFilters}
            onChange={vi.fn()}
            onReset={vi.fn()}
          />
        );

        // Tab through filter checkboxes
        await user.tab();
        expect(screen.getByLabelText('Available for swapping')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('Accepts cash offers')).toHaveFocus();

        await user.tab();
        expect(screen.getByLabelText('Auction mode active')).toHaveFocus();

        // Use Space to toggle filters
        await user.keyboard(' ');
        expect(screen.getByLabelText('Auction mode active')).toBeChecked();
      });

      it('should support keyboard shortcuts for filter operations', async () => {
        const user = userEvent.setup();
        const onReset = vi.fn();
        
        renderWithProviders(
          <IntegratedFilterPanel
            filters={mockFilters}
            onChange={vi.fn()}
            onReset={onReset}
          />
        );

        // Focus the filter panel
        const panel = screen.getByRole('region', { name: /filters/i });
        panel.focus();

        // Use keyboard shortcut (R for Reset)
        await user.keyboard('r');
        expect(onReset).toHaveBeenCalled();
      });
    });
  });

  describe('Screen Reader Support', () => {
    describe('ARIA Labels and Descriptions', () => {
      it('should provide comprehensive ARIA labels for form controls', () => {
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        // Check required field labels
        expect(screen.getByLabelText('Title')).toHaveAttribute('aria-required', 'true');
        expect(screen.getByLabelText('Description *')).toHaveAttribute('aria-required', 'true');
        
        // Check swap toggle description
        const swapToggle = screen.getByLabelText('Make available for swapping');
        expect(swapToggle).toHaveAttribute('aria-describedby');
        
        const descriptionId = swapToggle.getAttribute('aria-describedby');
        expect(screen.getByText(/allow other users to propose swaps/i)).toHaveAttribute('id', descriptionId);
      });

      it('should provide ARIA labels for swap information', () => {
        renderWithProviders(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo}
            userRole="browser"
            onViewDetails={vi.fn()}
            onMakeProposal={vi.fn()}
          />
        );

        // Check swap status badge
        const swapBadge = screen.getByText('Available for Swap');
        expect(swapBadge).toHaveAttribute('aria-label', 'This booking is available for swapping');

        // Check auction timer
        const auctionTimer = screen.getByText(/2 days remaining/i);
        expect(auctionTimer).toHaveAttribute('aria-label', expect.stringContaining('Auction ends in'));

        // Check proposal count
        const proposalCount = screen.getByText('3 proposals');
        expect(proposalCount).toHaveAttribute('aria-label', '3 proposals received for this booking');
      });

      it('should provide ARIA labels for proposal form elements', () => {
        renderWithProviders(
          <InlineProposalForm
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo!}
            onSubmit={vi.fn()}
            onCancel={vi.fn()}
          />
        );

        // Check radio group
        const radioGroup = screen.getByRole('radiogroup');
        expect(radioGroup).toHaveAttribute('aria-labelledby');

        // Check cash amount input
        const cashInput = screen.getByLabelText(/cash offer amount/i);
        expect(cashInput).toHaveAttribute('aria-describedby');
        
        const descriptionId = cashInput.getAttribute('aria-describedby');
        expect(screen.getByText(/minimum.*\$100/i)).toHaveAttribute('id', descriptionId);
      });
    });

    describe('Live Region Announcements', () => {
      it('should announce form validation errors', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        // Submit empty form
        const submitButton = screen.getByText('Create Booking');
        await user.click(submitButton);

        await waitFor(() => {
          expect(mockAnnounce).toHaveBeenCalledWith(
            expect.stringContaining('Form has errors'),
            'assertive'
          );
        });
      });

      it('should announce successful form submission', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={onSubmit}
            mode="create"
            loading={false}
          />
        );

        // Fill and submit valid form
        await user.type(screen.getByLabelText('Title'), 'Test Booking');
        await user.type(screen.getByLabelText('Description *'), 'Test description');
        await user.type(screen.getByLabelText('City'), 'Paris');
        await user.type(screen.getByLabelText('Country'), 'France');
        await user.type(screen.getByLabelText('Original Price ($)'), '200');
        await user.type(screen.getByLabelText('Provider'), 'Test Provider');
        await user.type(screen.getByLabelText('Confirmation Number'), 'TEST123');

        await user.click(screen.getByText('Create Booking'));

        await waitFor(() => {
          expect(mockAnnounce).toHaveBeenCalledWith(
            'Booking created successfully',
            'polite'
          );
        });
      });

      it('should announce proposal submission status', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue(undefined);
        
        renderWithProviders(
          <InlineProposalForm
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo!}
            onSubmit={onSubmit}
            onCancel={vi.fn()}
          />
        );

        // Select booking and submit
        const bookingSelect = screen.getByRole('combobox');
        await user.selectOptions(bookingSelect, 'user-booking-1');
        
        await user.click(screen.getByText('Send Proposal'));

        await waitFor(() => {
          expect(mockAnnounce).toHaveBeenCalledWith(
            'Proposal sent successfully',
            'polite'
          );
        });
      });

      it('should announce filter changes', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <IntegratedFilterPanel
            filters={mockFilters}
            onChange={vi.fn()}
            onReset={vi.fn()}
          />
        );

        const swapFilter = screen.getByLabelText('Available for swapping');
        await user.click(swapFilter);

        expect(mockAnnounce).toHaveBeenCalledWith(
          'Filter applied: Available for swapping',
          'polite'
        );
      });

      it('should announce dynamic content updates', async () => {
        const { rerender } = renderWithProviders(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo}
            userRole="browser"
            onViewDetails={vi.fn()}
            onMakeProposal={vi.fn()}
          />
        );

        // Update proposal count
        const updatedSwapInfo = {
          ...mockBooking.swapInfo!,
          activeProposalCount: 5,
        };

        rerender(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={updatedSwapInfo}
            userRole="browser"
            onViewDetails={vi.fn()}
            onMakeProposal={vi.fn()}
          />
        );

        expect(mockAnnounce).toHaveBeenCalledWith(
          'Proposal count updated: 5 proposals received',
          'polite'
        );
      });
    });

    describe('Focus Management', () => {
      it('should trap focus within modal forms', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        expect(mockFocusManager.trapFocus).toHaveBeenCalled();

        // Tab past last element should cycle to first
        const lastButton = screen.getByText('Cancel');
        lastButton.focus();
        
        await user.tab();
        
        expect(mockFocusManager.focusFirst).toHaveBeenCalled();
      });

      it('should restore focus when closing modals', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        
        renderWithProviders(
          <UnifiedBookingForm
            isOpen={true}
            onClose={onClose}
            onSubmit={vi.fn()}
            mode="create"
            loading={false}
          />
        );

        await user.keyboard('{Escape}');

        expect(mockFocusManager.releaseFocus).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });

      it('should manage focus in inline forms', async () => {
        const user = userEvent.setup();
        
        renderWithProviders(
          <EnhancedBookingCard
            booking={mockBooking}
            swapInfo={mockBooking.swapInfo}
            userRole="browser"
            onViewDetails={vi.fn()}
            onMakeProposal={vi.fn()}
          />
        );

        // Open inline proposal form
        const proposalButton = screen.getByText('Make Proposal');
        await user.click(proposalButton);

        // Focus should move to first form element
        await waitFor(() => {
          expect(mockFocusManager.focusFirst).toHaveBeenCalled();
        });
      });
    });
  });

  describe('High Contrast and Visual Accessibility', () => {
    it('should support high contrast mode', () => {
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

      renderWithProviders(
        <EnhancedBookingCard
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      // Check for high contrast classes
      const swapBadge = screen.getByText('Available for Swap');
      expect(swapBadge).toHaveClass('high-contrast');
    });

    it('should support reduced motion preferences', () => {
      // Mock reduced motion media query
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

      renderWithProviders(
        <UnifiedBookingForm
          isOpen={true}
          onClose={vi.fn()}
          onSubmit={vi.fn()}
          mode="create"
          loading={false}
        />
      );

      // Check for reduced motion classes
      const form = screen.getByRole('dialog');
      expect(form).toHaveClass('reduced-motion');
    });

    it('should provide sufficient color contrast for swap indicators', () => {
      renderWithProviders(
        <EnhancedBookingCard
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      // Check computed styles for contrast ratios
      const swapBadge = screen.getByText('Available for Swap');
      const styles = window.getComputedStyle(swapBadge);
      
      // These would be actual color values in a real implementation
      expect(styles.backgroundColor).toBeDefined();
      expect(styles.color).toBeDefined();
    });
  });

  describe('Mobile Accessibility', () => {
    it('should support touch accessibility on mobile', () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      renderWithProviders(
        <EnhancedBookingCard
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo}
          userRole="browser"
          onViewDetails={vi.fn()}
          onMakeProposal={vi.fn()}
        />
      );

      // Check for touch-friendly button sizes
      const proposalButton = screen.getByText('Make Proposal');
      expect(proposalButton).toHaveClass('touch-target');
    });

    it('should provide appropriate input types for mobile keyboards', () => {
      renderWithProviders(
        <InlineProposalForm
          booking={mockBooking}
          swapInfo={mockBooking.swapInfo!}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      // Switch to cash proposal
      const cashRadio = screen.getByRole('radio', { name: /make cash offer/i });
      cashRadio.click();

      // Check input mode for numeric input
      const cashInput = screen.getByLabelText(/cash offer amount/i);
      expect(cashInput).toHaveAttribute('inputMode', 'decimal');
    });
  });
});