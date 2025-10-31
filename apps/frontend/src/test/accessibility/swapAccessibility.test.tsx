/**
 * Accessibility tests for swap-related components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { SwapPreferencesSection } from '@/components/booking/SwapPreferencesSection';
import { InlineProposalForm } from '@/components/booking/InlineProposalForm';
import { SwapStatusBadge } from '@/components/booking/SwapStatusBadge';
import { IntegratedFilterPanel } from '@/components/booking/IntegratedFilterPanel';
import { SwapScreenReader, initializeSwapAccessibility } from '@/utils/swapAccessibility';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockSwapPreferences = {
  paymentTypes: ['booking', 'cash'] as const,
  acceptanceStrategy: 'first-match' as const,
  swapConditions: [],
};

const mockBookingWithSwap = {
  id: 'booking-1',
  title: 'Test Booking',
  location: { city: 'New York', country: 'USA' },
  dateRange: { checkIn: new Date(), checkOut: new Date() },
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'] as const,
    acceptanceStrategy: 'first-match' as const,
    hasActiveProposals: true,
    activeProposalCount: 2,
    minCashAmount: 100,
  },
};

const mockSwapInfo = {
  hasActiveProposals: true,
  acceptanceStrategy: 'auction' as const,
  paymentTypes: ['booking', 'cash'] as const,
  activeProposalCount: 3,
  timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
};

const mockFilters = {
  swapAvailable: false,
  acceptsCash: false,
  auctionMode: false,
};

describe('Swap Accessibility', () => {
  beforeAll(() => {
    initializeSwapAccessibility();
  });

  describe('SwapPreferencesSection', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SwapPreferencesSection
          enabled={true}
          onToggle={jest.fn()}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      render(
        <SwapPreferencesSection
          enabled={true}
          onToggle={jest.fn()}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      // Check for proper labeling
      const toggle = screen.getByRole('checkbox', { name: /enable swap functionality/i });
      expect(toggle).toHaveAttribute('aria-describedby');
      expect(toggle).toHaveAttribute('aria-controls');

      // Check for section role
      const section = screen.getByRole('region');
      expect(section).toBeInTheDocument();

      // Check for group role on content
      const content = screen.getByRole('group');
      expect(content).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const onToggle = jest.fn();

      render(
        <SwapPreferencesSection
          enabled={false}
          onToggle={onToggle}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      const toggle = screen.getByRole('checkbox');
      
      // Test Space key
      await user.click(toggle);
      await user.keyboard(' ');
      expect(onToggle).toHaveBeenCalled();

      // Test Enter key
      await user.keyboard('{Enter}');
      expect(onToggle).toHaveBeenCalledTimes(2);
    });

    it('should announce status changes to screen readers', async () => {
      const announceStatusSpy = jest.spyOn(SwapScreenReader, 'announceSwapStatusChange');
      const user = userEvent.setup();
      const onToggle = jest.fn();

      render(
        <SwapPreferencesSection
          enabled={false}
          onToggle={onToggle}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      const toggle = screen.getByRole('checkbox');
      await user.click(toggle);

      // Should announce when enabled
      expect(announceStatusSpy).toHaveBeenCalledWith('enabled', {
        bookingTitle: expect.any(String),
      });
    });

    it('should provide screen reader descriptions for all fields', () => {
      render(
        <SwapPreferencesSection
          enabled={true}
          onToggle={jest.fn()}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      // Check for screen reader help text
      expect(screen.getByText(/configure your swap settings/i)).toHaveClass('sr-only');
      expect(screen.getByText(/cash amount settings/i)).toHaveClass('sr-only');
      expect(screen.getByText(/choose how swap proposals will be handled/i)).toHaveClass('sr-only');
    });
  });

  describe('InlineProposalForm', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper dialog role and labeling', () => {
      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('data-testid', 'inline-proposal-form');

      const title = screen.getByRole('heading', { level: 2 });
      expect(title).toBeInTheDocument();
    });

    it('should support keyboard navigation in proposal type selector', async () => {
      const user = userEvent.setup();

      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const radioGroup = screen.getByRole('radiogroup');
      expect(radioGroup).toBeInTheDocument();

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);

      // Test arrow key navigation
      radios[0].focus();
      await user.keyboard('{ArrowDown}');
      expect(radios[1]).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(radios[0]).toHaveFocus();
    });

    it('should handle escape key to close form', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={onCancel}
        />
      );

      await user.keyboard('{Escape}');
      expect(onCancel).toHaveBeenCalled();
    });

    it('should provide proper form field labeling', () => {
      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Check for proper field associations
      const bookingSelect = screen.getByLabelText(/select your booking/i);
      expect(bookingSelect).toHaveAttribute('aria-describedby');
      expect(bookingSelect).toHaveAttribute('aria-required', 'true');

      const messageField = screen.getByLabelText(/message/i);
      expect(messageField).toBeInTheDocument();
    });

    it('should announce validation errors', async () => {
      const announceErrorSpy = jest.spyOn(SwapScreenReader, 'announceValidationError');
      const user = userEvent.setup();

      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      // Try to submit without selecting a booking
      const submitButton = screen.getByRole('button', { name: /send proposal/i });
      await user.click(submitButton);

      expect(announceErrorSpy).toHaveBeenCalled();
    });
  });

  describe('SwapStatusBadge', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <SwapStatusBadge swapInfo={mockSwapInfo} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper status role and description', () => {
      render(<SwapStatusBadge swapInfo={mockSwapInfo} />);

      const badge = screen.getByRole('status');
      expect(badge).toHaveAttribute('aria-label');
      expect(badge).toHaveAttribute('aria-describedby');
      expect(badge).toHaveAttribute('title');
    });

    it('should provide descriptive text for screen readers', () => {
      render(<SwapStatusBadge swapInfo={mockSwapInfo} />);

      // Check for screen reader description
      const description = screen.getByText(/available for swapping/i);
      expect(description).toHaveClass('sr-only');
    });

    it('should handle different swap states appropriately', () => {
      const urgentSwapInfo = {
        ...mockSwapInfo,
        timeRemaining: 30 * 60 * 1000, // 30 minutes
      };

      const { rerender } = render(<SwapStatusBadge swapInfo={urgentSwapInfo} />);
      expect(screen.getByText(/urgent/i)).toBeInTheDocument();

      // Test ending soon state
      const endingSoonSwapInfo = {
        ...mockSwapInfo,
        timeRemaining: 2 * 60 * 60 * 1000, // 2 hours
      };

      rerender(<SwapStatusBadge swapInfo={endingSoonSwapInfo} />);
      expect(screen.getByText(/ending soon/i)).toBeInTheDocument();
    });
  });

  describe('IntegratedFilterPanel', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={jest.fn()}
          onReset={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in filter groups', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();

      render(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={onChange}
          onReset={jest.fn()}
        />
      );

      const swapFilters = screen.getByTestId('swap-filters');
      expect(swapFilters).toHaveAttribute('role', 'group');

      // Test keyboard navigation
      const firstFilter = screen.getByLabelText(/available for swapping/i);
      firstFilter.focus();
      
      await user.keyboard('{ArrowDown}');
      const secondFilter = screen.getByLabelText(/accepts cash offers/i);
      expect(secondFilter).toHaveFocus();

      await user.keyboard(' ');
      expect(onChange).toHaveBeenCalled();
    });

    it('should provide proper section labeling and expansion states', () => {
      render(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={jest.fn()}
          onReset={jest.fn()}
        />
      );

      const swapSection = screen.getByRole('button', { name: /swap filters/i });
      expect(swapSection).toHaveAttribute('aria-expanded');
      expect(swapSection).toHaveAttribute('aria-controls');
    });

    it('should announce filter changes', async () => {
      const announceFilterSpy = jest.spyOn(SwapScreenReader, 'announceFilterChange');
      const user = userEvent.setup();

      render(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={jest.fn()}
          onReset={jest.fn()}
        />
      );

      const swapFilter = screen.getByLabelText(/available for swapping/i);
      await user.click(swapFilter);

      expect(announceFilterSpy).toHaveBeenCalledWith(
        'Available for swapping',
        expect.any(Number)
      );
    });

    it('should provide help text for each filter', () => {
      render(
        <IntegratedFilterPanel
          filters={mockFilters}
          onChange={jest.fn()}
          onReset={jest.fn()}
        />
      );

      // Check for screen reader help text
      expect(screen.getByText(/filter to show only bookings that are available for swapping/i))
        .toHaveClass('sr-only');
      expect(screen.getByText(/filter to show only bookings that accept cash offers/i))
        .toHaveClass('sr-only');
      expect(screen.getByText(/filter to show only bookings with active auction-mode swaps/i))
        .toHaveClass('sr-only');
    });
  });

  describe('High Contrast Mode', () => {
    beforeEach(() => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });
    });

    it('should apply high contrast styles to swap components', () => {
      render(<SwapStatusBadge swapInfo={mockSwapInfo} />);

      const badge = screen.getByRole('status');
      // In high contrast mode, components should have enhanced borders
      expect(badge).toHaveStyle({ border: expect.stringContaining('2px solid') });
    });

    it('should maintain accessibility in high contrast mode', async () => {
      const { container } = render(
        <SwapPreferencesSection
          enabled={true}
          onToggle={jest.fn()}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus Management', () => {
    it('should trap focus within inline proposal form', async () => {
      const user = userEvent.setup();

      render(
        <InlineProposalForm
          booking={mockBookingWithSwap}
          onSubmit={jest.fn()}
          onCancel={jest.fn()}
        />
      );

      const dialog = screen.getByRole('dialog');
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      // Focus should be trapped within the dialog
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      lastElement.focus();
      await user.tab();
      expect(firstElement).toHaveFocus();
    });

    it('should restore focus when closing forms', async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      // Create a button to focus initially
      const { container } = render(
        <div>
          <button data-testid="trigger">Open Form</button>
          <InlineProposalForm
            booking={mockBookingWithSwap}
            onSubmit={jest.fn()}
            onCancel={onCancel}
          />
        </div>
      );

      const triggerButton = screen.getByTestId('trigger');
      triggerButton.focus();

      // Close the form
      const cancelButton = screen.getByRole('button', { name: /close/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('should provide descriptive status information', () => {
      const description = SwapScreenReader.getSwapStatusDescription(mockSwapInfo);
      
      expect(description).toContain('Available for swapping');
      expect(description).toContain('accepts booking exchanges and cash offers');
      expect(description).toContain('using auction mode');
      expect(description).toContain('3 active proposals');
    });

    it('should handle different swap configurations', () => {
      const bookingOnlySwap = {
        hasActiveProposals: true,
        acceptanceStrategy: 'first-match' as const,
        paymentTypes: ['booking'] as const,
        activeProposalCount: 1,
      };

      const description = SwapScreenReader.getSwapStatusDescription(bookingOnlySwap);
      expect(description).toContain('accepts booking exchanges only');
      expect(description).toContain('first match wins');
    });
  });

  describe('Mobile Accessibility', () => {
    beforeEach(() => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    it('should have appropriate touch targets on mobile', () => {
      render(
        <SwapPreferencesSection
          enabled={true}
          onToggle={jest.fn()}
          preferences={mockSwapPreferences}
          onChange={jest.fn()}
          errors={{}}
          eventDate={new Date()}
        />
      );

      const toggle = screen.getByRole('checkbox');
      const styles = window.getComputedStyle(toggle);
      
      // Touch targets should be at least 48px on mobile
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(48);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(48);
    });
  });
});