import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders, createMockBooking, createMockSwap, createMockUser } from '@/test/testUtils';
import { BookingsPage } from '@/pages/BookingsPage';
import { BrowsePage } from '@/pages/BrowsePage';
import { UnifiedBookingData, SwapProposal } from '@booking-swap/shared';

// Mock API services
const mockCreateBookingWithSwap = vi.fn();
const mockGetBookingsWithSwapInfo = vi.fn();
const mockMakeInlineProposal = vi.fn();
const mockUpdateBookingWithSwap = vi.fn();

vi.mock('@/services/bookingService', () => ({
  bookingService: {
    createBookingWithSwap: (...args: any[]) => mockCreateBookingWithSwap(...args),
    updateBookingWithSwap: (...args: any[]) => mockUpdateBookingWithSwap(...args),
    getBookingsWithSwapInfo: (...args: any[]) => mockGetBookingsWithSwapInfo(...args),
    makeInlineProposal: (...args: any[]) => mockMakeInlineProposal(...args),
  },
}));

// Mock components that aren't the focus of integration tests
vi.mock('@/components/booking/UnifiedBookingForm', () => ({
  UnifiedBookingForm: ({ onSubmit, onClose, mode, booking }: any) => (
    <div data-testid="unified-booking-form">
      <h2>{mode === 'create' ? 'Create New Booking' : 'Edit Booking'}</h2>
      {booking && <div data-testid="existing-booking">{booking.title}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const formData: UnifiedBookingData = {
            type: 'hotel',
            title: 'Test Hotel Booking',
            description: 'A test hotel booking for integration testing',
            location: { city: 'Paris', country: 'France' },
            dateRange: {
              checkIn: new Date('2024-06-01'),
              checkOut: new Date('2024-06-05'),
            },
            originalPrice: 300,
            swapValue: 280,
            providerDetails: {
              provider: 'Booking.com',
              confirmationNumber: 'TEST123',
              bookingReference: 'REF123',
            },
            verification: { status: 'pending', documents: [] },
            swapEnabled: true,
            swapPreferences: {
              paymentTypes: ['booking', 'cash'],
              minCashAmount: 150,
              acceptanceStrategy: 'first-match',
              swapConditions: [],
            },
          };
          onSubmit(formData);
        }}
      >
        <button type="submit">
          {mode === 'create' ? 'Create Booking & Enable Swapping' : 'Update Booking'}
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </form>
    </div>
  ),
}));

vi.mock('@/components/booking/InlineProposalForm', () => ({
  InlineProposalForm: ({ booking, swapInfo, onSubmit, onCancel }: any) => (
    <div data-testid="inline-proposal-form">
      <h3>Make Proposal for {booking.title}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            type: 'cash',
            cashAmount: 200,
            message: 'Interested in this swap!',
          });
        }}
      >
        <button type="submit">Send Proposal</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  ),
}));

const mockCurrentUser = createMockUser({
  id: 'current-user',
  username: 'currentuser',
  email: 'current@example.com',
});

const mockBookingWithSwap = createMockBooking({
  id: 'booking-1',
  title: 'Paris Hotel Stay',
  userId: 'other-user',
  swapInfo: {
    swapId: 'swap-1',
    paymentTypes: ['booking', 'cash'],
    acceptanceStrategy: 'first-match',
    minCashAmount: 100,
    hasActiveProposals: true,
    activeProposalCount: 2,
    userProposalStatus: 'none',
  },
});

const initialState = {
  auth: {
    user: mockCurrentUser,
    isAuthenticated: true,
    loading: false,
    error: null,
  },
  bookings: {
    items: [],
    filters: {},
    loading: false,
    error: null,
  },
  swaps: {
    items: [],
    proposals: [],
    loading: false,
    error: null,
  },
  ui: {
    activeBookingForm: {
      isOpen: false,
      mode: 'create',
      swapEnabled: false,
    },
    inlineProposals: {},
    filters: {
      showSwappableOnly: false,
      showCashAccepting: false,
      showAuctions: false,
    },
  },
};

describe('Booking-Swap Workflow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('End-to-End Booking Creation with Swap', () => {
    it('should create booking with swap preferences and make it discoverable', async () => {
      const user = userEvent.setup();
      
      // Mock successful booking creation
      const createdBooking = createMockBooking({
        id: 'new-booking-1',
        title: 'Test Hotel Booking',
        userId: 'current-user',
      });
      
      const createdSwap = createMockSwap({
        id: 'new-swap-1',
        sourceBookingId: 'new-booking-1',
      });

      mockCreateBookingWithSwap.mockResolvedValue({
        booking: createdBooking,
        swap: createdSwap,
      });

      mockGetBookingsWithSwapInfo.mockResolvedValue([
        { ...createdBooking, swapInfo: { swapId: 'new-swap-1', hasActiveProposals: true } },
      ]);

      renderWithProviders(<BookingsPage />, { preloadedState: initialState });

      // Open booking creation form
      const createButton = screen.getByText('Create New Booking');
      await user.click(createButton);

      // Form should be displayed
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
      expect(screen.getByText('Create New Booking')).toBeInTheDocument();

      // Submit form with swap enabled
      const submitButton = screen.getByText('Create Booking & Enable Swapping');
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockCreateBookingWithSwap).toHaveBeenCalledWith({
          type: 'hotel',
          title: 'Test Hotel Booking',
          description: 'A test hotel booking for integration testing',
          location: { city: 'Paris', country: 'France' },
          dateRange: {
            checkIn: new Date('2024-06-01'),
            checkOut: new Date('2024-06-05'),
          },
          originalPrice: 300,
          swapValue: 280,
          providerDetails: {
            provider: 'Booking.com',
            confirmationNumber: 'TEST123',
            bookingReference: 'REF123',
          },
          verification: { status: 'pending', documents: [] },
          swapEnabled: true,
          swapPreferences: {
            paymentTypes: ['booking', 'cash'],
            minCashAmount: 150,
            acceptanceStrategy: 'first-match',
            swapConditions: [],
          },
        });
      });

      // Form should close after successful creation
      await waitFor(() => {
        expect(screen.queryByTestId('unified-booking-form')).not.toBeInTheDocument();
      });

      // Booking should appear in the list with swap indicator
      await waitFor(() => {
        expect(screen.getByText('Test Hotel Booking')).toBeInTheDocument();
        expect(screen.getByText('Available for Swap')).toBeInTheDocument();
      });
    });

    it('should handle booking creation errors gracefully', async () => {
      const user = userEvent.setup();
      
      mockCreateBookingWithSwap.mockRejectedValue(new Error('Network error'));

      renderWithProviders(<BookingsPage />, { preloadedState: initialState });

      const createButton = screen.getByText('Create New Booking');
      await user.click(createButton);

      const submitButton = screen.getByText('Create Booking & Enable Swapping');
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to create booking/i)).toBeInTheDocument();
      });

      // Form should remain open for retry
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
    });
  });

  describe('Booking Discovery and Filtering', () => {
    it('should filter bookings by swap availability', async () => {
      const user = userEvent.setup();
      
      const bookingsWithMixedSwapStatus = [
        createMockBooking({
          id: 'booking-1',
          title: 'Swappable Booking',
          swapInfo: { hasActiveProposals: true },
        }),
        createMockBooking({
          id: 'booking-2',
          title: 'Non-Swappable Booking',
          swapInfo: null,
        }),
      ];

      mockGetBookingsWithSwapInfo.mockResolvedValue(bookingsWithMixedSwapStatus);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      // Wait for bookings to load
      await waitFor(() => {
        expect(screen.getByText('Swappable Booking')).toBeInTheDocument();
        expect(screen.getByText('Non-Swappable Booking')).toBeInTheDocument();
      });

      // Apply swap filter
      const swapFilter = screen.getByLabelText('Available for swapping');
      await user.click(swapFilter);

      // Should only show swappable bookings
      await waitFor(() => {
        expect(screen.getByText('Swappable Booking')).toBeInTheDocument();
        expect(screen.queryByText('Non-Swappable Booking')).not.toBeInTheDocument();
      });

      // Verify API call with filters
      expect(mockGetBookingsWithSwapInfo).toHaveBeenCalledWith(
        expect.objectContaining({
          swapAvailable: true,
        }),
        'current-user'
      );
    });

    it('should combine multiple swap filters', async () => {
      const user = userEvent.setup();
      
      mockGetBookingsWithSwapInfo.mockResolvedValue([]);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      // Apply multiple filters
      const swapFilter = screen.getByLabelText('Available for swapping');
      const cashFilter = screen.getByLabelText('Accepts cash offers');
      const auctionFilter = screen.getByLabelText('Auction mode active');

      await user.click(swapFilter);
      await user.click(cashFilter);
      await user.click(auctionFilter);

      // Verify API call with combined filters
      await waitFor(() => {
        expect(mockGetBookingsWithSwapInfo).toHaveBeenCalledWith(
          expect.objectContaining({
            swapAvailable: true,
            acceptsCash: true,
            auctionMode: true,
          }),
          'current-user'
        );
      });
    });
  });

  describe('Inline Proposal Workflow', () => {
    it('should make proposal directly from booking listing', async () => {
      const user = userEvent.setup();
      
      mockGetBookingsWithSwapInfo.mockResolvedValue([mockBookingWithSwap]);
      mockMakeInlineProposal.mockResolvedValue({
        id: 'proposal-1',
        status: 'pending',
      });

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      // Wait for bookings to load
      await waitFor(() => {
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
      });

      // Click make proposal button
      const proposalButton = screen.getByText('Make Proposal');
      await user.click(proposalButton);

      // Inline proposal form should appear
      expect(screen.getByTestId('inline-proposal-form')).toBeInTheDocument();
      expect(screen.getByText('Make Proposal for Paris Hotel Stay')).toBeInTheDocument();

      // Submit proposal
      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockMakeInlineProposal).toHaveBeenCalledWith('booking-1', {
          type: 'cash',
          cashAmount: 200,
          message: 'Interested in this swap!',
        });
      });

      // Form should close after successful submission
      await waitFor(() => {
        expect(screen.queryByTestId('inline-proposal-form')).not.toBeInTheDocument();
      });

      // Should show success message
      expect(screen.getByText(/proposal sent successfully/i)).toBeInTheDocument();
    });

    it('should handle proposal submission errors', async () => {
      const user = userEvent.setup();
      
      mockGetBookingsWithSwapInfo.mockResolvedValue([mockBookingWithSwap]);
      mockMakeInlineProposal.mockRejectedValue(new Error('Proposal failed'));

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      await waitFor(() => {
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
      });

      const proposalButton = screen.getByText('Make Proposal');
      await user.click(proposalButton);

      const submitButton = screen.getByText('Send Proposal');
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/failed to send proposal/i)).toBeInTheDocument();
      });

      // Form should remain open for retry
      expect(screen.getByTestId('inline-proposal-form')).toBeInTheDocument();
    });

    it('should cancel proposal form', async () => {
      const user = userEvent.setup();
      
      mockGetBookingsWithSwapInfo.mockResolvedValue([mockBookingWithSwap]);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      await waitFor(() => {
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
      });

      const proposalButton = screen.getByText('Make Proposal');
      await user.click(proposalButton);

      expect(screen.getByTestId('inline-proposal-form')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      // Form should close
      expect(screen.queryByTestId('inline-proposal-form')).not.toBeInTheDocument();
    });
  });

  describe('Booking Edit with Swap Integration', () => {
    it('should update existing booking with new swap preferences', async () => {
      const user = userEvent.setup();
      
      const existingBooking = createMockBooking({
        id: 'existing-booking-1',
        title: 'Existing Hotel Booking',
        userId: 'current-user',
      });

      mockUpdateBookingWithSwap.mockResolvedValue({
        booking: { ...existingBooking, title: 'Updated Hotel Booking' },
        swap: createMockSwap({ id: 'new-swap-1' }),
      });

      const stateWithBooking = {
        ...initialState,
        bookings: {
          ...initialState.bookings,
          items: [existingBooking],
        },
        ui: {
          ...initialState.ui,
          activeBookingForm: {
            isOpen: true,
            mode: 'edit' as const,
            bookingId: 'existing-booking-1',
            swapEnabled: false,
          },
        },
      };

      renderWithProviders(<BookingsPage />, { preloadedState: stateWithBooking });

      // Form should be open in edit mode
      expect(screen.getByTestId('unified-booking-form')).toBeInTheDocument();
      expect(screen.getByText('Edit Booking')).toBeInTheDocument();
      expect(screen.getByTestId('existing-booking')).toHaveTextContent('Existing Hotel Booking');

      // Submit updated form
      const submitButton = screen.getByText('Update Booking');
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockUpdateBookingWithSwap).toHaveBeenCalledWith(
          'existing-booking-1',
          expect.objectContaining({
            title: 'Test Hotel Booking',
            swapEnabled: true,
          })
        );
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should update booking status when swap proposal is received', async () => {
      const user = userEvent.setup();
      
      const bookingWithoutProposals = createMockBooking({
        id: 'booking-1',
        title: 'My Booking',
        userId: 'current-user',
        swapInfo: {
          swapId: 'swap-1',
          hasActiveProposals: false,
          activeProposalCount: 0,
        },
      });

      const bookingWithProposals = {
        ...bookingWithoutProposals,
        swapInfo: {
          ...bookingWithoutProposals.swapInfo,
          hasActiveProposals: true,
          activeProposalCount: 1,
        },
      };

      // Initial state without proposals
      mockGetBookingsWithSwapInfo.mockResolvedValueOnce([bookingWithoutProposals]);

      renderWithProviders(<BookingsPage />, { preloadedState: initialState });

      await waitFor(() => {
        expect(screen.getByText('My Booking')).toBeInTheDocument();
        expect(screen.getByText('No proposals yet')).toBeInTheDocument();
      });

      // Simulate receiving a proposal (would normally come via WebSocket)
      mockGetBookingsWithSwapInfo.mockResolvedValueOnce([bookingWithProposals]);

      // Trigger refresh (in real app this would be automatic)
      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      // Should show updated proposal count
      await waitFor(() => {
        expect(screen.getByText('1 proposal received')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed operations', async () => {
      const user = userEvent.setup();
      
      // First call fails, second succeeds
      mockGetBookingsWithSwapInfo
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([mockBookingWithSwap]);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/failed to load bookings/i)).toBeInTheDocument();
      });

      // Click retry button
      const retryButton = screen.getByText('Retry');
      await user.click(retryButton);

      // Should show bookings after retry
      await waitFor(() => {
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
      });
    });

    it('should handle partial failures gracefully', async () => {
      const user = userEvent.setup();
      
      // Return some bookings but with errors for others
      const partialResults = [
        mockBookingWithSwap,
        { ...createMockBooking({ id: 'error-booking' }), error: 'Failed to load swap info' },
      ];

      mockGetBookingsWithSwapInfo.mockResolvedValue(partialResults);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      await waitFor(() => {
        // Should show successful booking
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
        
        // Should show error for failed booking
        expect(screen.getByText(/some bookings could not be loaded/i)).toBeInTheDocument();
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large numbers of bookings efficiently', async () => {
      const manyBookings = Array.from({ length: 100 }, (_, i) =>
        createMockBooking({
          id: `booking-${i}`,
          title: `Booking ${i}`,
          swapInfo: i % 2 === 0 ? { hasActiveProposals: true } : null,
        })
      );

      mockGetBookingsWithSwapInfo.mockResolvedValue(manyBookings);

      const startTime = performance.now();
      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      await waitFor(() => {
        expect(screen.getByText('Booking 0')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render within reasonable time
      expect(renderTime).toBeLessThan(2000); // 2 seconds for 100 bookings
    });

    it('should handle rapid filter changes efficiently', async () => {
      const user = userEvent.setup();
      
      mockGetBookingsWithSwapInfo.mockResolvedValue([mockBookingWithSwap]);

      renderWithProviders(<BrowsePage />, { preloadedState: initialState });

      await waitFor(() => {
        expect(screen.getByText('Paris Hotel Stay')).toBeInTheDocument();
      });

      const startTime = performance.now();

      // Rapidly toggle filters
      const swapFilter = screen.getByLabelText('Available for swapping');
      const cashFilter = screen.getByLabelText('Accepts cash offers');

      for (let i = 0; i < 10; i++) {
        await user.click(swapFilter);
        await user.click(cashFilter);
      }

      const interactionTime = performance.now() - startTime;
      
      // Should handle rapid interactions efficiently
      expect(interactionTime).toBeLessThan(1000); // Within 1 second
    });
  });
});