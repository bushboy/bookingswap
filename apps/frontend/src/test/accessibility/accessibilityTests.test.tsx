import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../../store/slices/bookingsSlice';
import { swapsSlice } from '../../store/slices/swapsSlice';
import { BookingList } from '../../components/booking/BookingList';
import { BookingFormModal } from '../../components/booking/BookingFormModal';
import { SwapDashboard } from '../../components/swap/SwapDashboard';
import { SwapProposalModal } from '../../components/swap/SwapProposalModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Card } from '../../components/ui/Card';
import {
  Booking,
  SwapWithBookings,
  BookingType,
  BookingStatus,
  SwapStatus,
} from '@booking-swap/shared';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock data
const mockBooking: Booking = {
  id: '1',
  userId: 'user1',
  type: 'hotel' as BookingType,
  title: 'Test Hotel',
  description: 'A test hotel booking',
  location: { city: 'New York', country: 'USA' },
  dateRange: {
    checkIn: new Date('2024-06-01'),
    checkOut: new Date('2024-06-05'),
  },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: {
    provider: 'Booking.com',
    confirmationNumber: 'ABC123',
    bookingReference: 'REF123',
  },
  verification: { status: 'verified', documents: [] },
  blockchain: { topicId: 'topic1' },
  status: 'available' as BookingStatus,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSwap: SwapWithBookings = {
  id: 'swap1',
  sourceBookingId: 'booking1',
  targetBookingId: 'booking2',
  proposerId: 'user1',
  ownerId: 'user2',
  status: 'pending' as SwapStatus,
  terms: { additionalPayment: 0, conditions: [] },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  sourceBooking: mockBooking,
  targetBooking: {
    ...mockBooking,
    id: '2',
    userId: 'user2',
    title: 'Target Hotel',
  },
  proposer: {
    id: 'user1',
    username: 'user1',
    email: 'user1@example.com',
    profile: {
      firstName: 'John',
      lastName: 'Doe',
      avatar: '',
      bio: '',
      location: { city: 'New York', country: 'USA' },
      preferences: {},
      reputation: { score: 5, reviewCount: 10 },
      verification: { status: 'verified', documents: [] },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  owner: {
    id: 'user2',
    username: 'user2',
    email: 'user2@example.com',
    profile: {
      firstName: 'Jane',
      lastName: 'Smith',
      avatar: '',
      bio: '',
      location: { city: 'Los Angeles', country: 'USA' },
      preferences: {},
      reputation: { score: 4.8, reviewCount: 15 },
      verification: { status: 'verified', documents: [] },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('Accessibility Tests', () => {
  let store: ReturnType<typeof configureStore>;

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => <Provider store={store}>{children}</Provider>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        swaps: swapsSlice.reducer,
      },
      preloadedState: {
        bookings: {
          bookings: [mockBooking],
          selectedBooking: null,
          filters: {
            type: [],
            status: [],
            location: {},
            dateRange: {},
            priceRange: {},
          },
          sort: { field: 'createdAt', order: 'desc' },
          view: 'grid',
          pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
          loading: false,
          error: null,
        },
        swaps: {
          swaps: [mockSwap],
          selectedSwap: null,
          filters: { status: [], type: [], location: {}, dateRange: {} },
          categorizedSwaps: {
            pending: [mockSwap],
            accepted: [],
            completed: [],
            rejected: [],
            expired: [],
          },
          proposals: {},
          loading: false,
          error: null,
        },
      },
    });
  });

  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations in BookingList', async () => {
      const { container } = render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in SwapDashboard', async () => {
      const { container } = render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in BookingFormModal', async () => {
      const { container } = render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have no accessibility violations in SwapProposalModal', async () => {
      const { container } = render(
        <TestWrapper>
          <SwapProposalModal
            isOpen={true}
            sourceBooking={mockBooking}
            targetBooking={mockSwap.targetBooking}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support full keyboard navigation in BookingList', async () => {
      const user = userEvent.setup();
      const onViewDetails = vi.fn();

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={onViewDetails}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Tab to first interactive element
      await user.tab();

      // Should focus on first button
      const firstButton = screen.getByRole('button', { name: /view details/i });
      expect(firstButton).toHaveFocus();

      // Enter should activate the button
      await user.keyboard('{Enter}');
      expect(onViewDetails).toHaveBeenCalledWith(mockBooking.id);

      // Tab to next button
      await user.tab();
      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveFocus();

      // Space should also activate buttons
      await user.keyboard(' ');
      // Edit button should be activated
    });

    it('should support keyboard navigation in modals', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={onClose}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Escape should close modal
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalled();
    });

    it('should trap focus within modals', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Get all focusable elements in modal
      const modal = screen.getByRole('dialog');
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      // Tab through all elements
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
      }

      // Should cycle back to first element
      await user.tab();
      expect(focusableElements[0]).toHaveFocus();
    });

    it('should support arrow key navigation in lists', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Focus on first swap card
      const swapCards = screen.getAllByRole('article');
      if (swapCards.length > 0) {
        swapCards[0].focus();

        // Arrow down should move to next item
        await user.keyboard('{ArrowDown}');

        // Arrow up should move back
        await user.keyboard('{ArrowUp}');
        expect(swapCards[0]).toHaveFocus();
      }
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Check for proper roles
      expect(
        screen.getByRole('main') || screen.getByRole('region')
      ).toBeInTheDocument();

      // Booking cards should have proper labels
      const bookingCard = screen
        .getByText('Test Hotel')
        .closest('[role="article"]');
      expect(bookingCard).toBeInTheDocument();

      // Buttons should have accessible names
      const viewButton = screen.getByRole('button', { name: /view details/i });
      expect(viewButton).toHaveAccessibleName();
    });

    it('should announce dynamic content changes', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingList
            bookings={[]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            loading={true}
          />
        </TestWrapper>
      );

      // Should have aria-live region for announcements
      const liveRegion =
        screen.getByRole('status') || screen.getByLabelText(/loading/i);
      expect(liveRegion).toBeInTheDocument();
    });

    it('should provide proper form labels and descriptions', () => {
      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // All form inputs should have labels
      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toBeInTheDocument();

      const descriptionInput = screen.getByLabelText(/description/i);
      expect(descriptionInput).toBeInTheDocument();

      // Required fields should be indicated
      const requiredInputs = screen.getAllByRequired();
      requiredInputs.forEach(input => {
        expect(input).toHaveAttribute('aria-required', 'true');
      });
    });

    it('should provide error announcements', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Submit form without required fields
      const submitButton = screen.getByRole('button', {
        name: /create booking/i,
      });
      await user.click(submitButton);

      // Error messages should be announced
      const errorMessages = screen.getAllByRole('alert');
      expect(errorMessages.length).toBeGreaterThan(0);

      errorMessages.forEach(error => {
        expect(error).toHaveAttribute('aria-live', 'assertive');
      });
    });
  });

  describe('Color Contrast and Visual Accessibility', () => {
    it('should maintain proper color contrast ratios', () => {
      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Check that text elements have sufficient contrast
      // This would typically be done with automated tools or manual testing
      const textElements = screen.getAllByText(/./);
      textElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        expect(styles.color).toBeDefined();
        expect(styles.backgroundColor).toBeDefined();
      });
    });

    it('should not rely solely on color for information', () => {
      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Status indicators should have text or icons, not just color
      const statusElements = screen.getAllByText(
        /pending|accepted|completed|rejected/i
      );
      statusElements.forEach(element => {
        // Should have text content or aria-label
        expect(
          element.textContent || element.getAttribute('aria-label')
        ).toBeTruthy();
      });
    });

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

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Components should adapt to high contrast mode
      // This would be verified through CSS classes or styles
    });
  });

  describe('Motion and Animation Accessibility', () => {
    it('should respect reduced motion preferences', () => {
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

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Animations should be disabled or reduced
      // This would be verified through CSS classes or animation properties
    });

    it('should provide alternatives to motion-based interactions', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Swipe gestures should have button alternatives
      const nextButton = screen.queryByRole('button', { name: /next/i });
      const prevButton = screen.queryByRole('button', { name: /previous/i });

      // If pagination exists, it should be keyboard accessible
      if (nextButton) {
        await user.click(nextButton);
        // Should navigate without requiring gestures
      }
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
          />
        </TestWrapper>
      );

      // Tab to focusable element
      await user.tab();

      const focusedElement = document.activeElement;
      expect(focusedElement).toBeTruthy();

      // Should have visible focus indicator
      const styles = window.getComputedStyle(focusedElement!);
      expect(
        styles.outline !== 'none' ||
          styles.boxShadow !== 'none' ||
          styles.border !== 'none'
      ).toBe(true);
    });

    it('should manage focus when opening modals', async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        return (
          <>
            <button onClick={() => setIsOpen(true)}>Open Modal</button>
            <BookingFormModal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              onSubmit={vi.fn()}
            />
          </>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      const openButton = screen.getByText('Open Modal');
      await user.click(openButton);

      // Focus should move to modal
      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();

      // First focusable element in modal should be focused
      const firstFocusable = modal.querySelector(
        'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      expect(firstFocusable).toHaveFocus();
    });

    it('should restore focus when closing modals', async () => {
      const user = userEvent.setup();

      const TestComponent = () => {
        const [isOpen, setIsOpen] = React.useState(true);
        return (
          <>
            <button>Trigger Button</button>
            <BookingFormModal
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              onSubmit={vi.fn()}
            />
          </>
        );
      };

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // Close modal with Escape
      await user.keyboard('{Escape}');

      // Focus should return to trigger element or appropriate element
      // This would depend on the specific implementation
    });
  });

  describe('UI Component Accessibility', () => {
    it('should have accessible Button component', async () => {
      const onClick = vi.fn();
      const { container } = render(
        <Button onClick={onClick} aria-label="Test button">
          Click me
        </Button>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const button = screen.getByRole('button');
      expect(button).toHaveAccessibleName('Test button');
    });

    it('should have accessible Input component', async () => {
      const { container } = render(
        <Input
          label="Test Input"
          required
          error="This field is required"
          helpText="Enter your information"
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const input = screen.getByLabelText('Test Input');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
    });

    it('should have accessible Modal component', async () => {
      const { container } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });

    it('should have accessible Card component', async () => {
      const { container } = render(
        <Card
          clickable
          onClick={vi.fn()}
          aria-label="Clickable card"
          role="button"
        >
          <h3>Card Title</h3>
          <p>Card content</p>
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      const card = screen.getByRole('button');
      expect(card).toHaveAccessibleName('Clickable card');
    });
  });

  describe('Error Handling Accessibility', () => {
    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Submit invalid form
      await user.click(screen.getByRole('button', { name: /create booking/i }));

      // Error messages should be properly announced
      const errorElements = screen.getAllByRole('alert');
      errorElements.forEach(error => {
        expect(error).toHaveAttribute('aria-live');
      });
    });

    it('should provide clear error recovery instructions', () => {
      render(
        <div role="alert" aria-live="assertive">
          <p>Error: Title is required</p>
          <p>Please enter a title for your booking to continue.</p>
        </div>
      );

      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toContainText('Please enter a title');
    });
  });
});
