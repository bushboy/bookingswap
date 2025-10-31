import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../../store/slices/bookingsSlice';
import { swapsSlice } from '../../store/slices/swapsSlice';
import { authSlice } from '../../store/slices/authSlice';
import { SwapDashboard } from '../../components/swap/SwapDashboard';
import { SwapProposalModal } from '../../components/swap/SwapProposalModal';
import { ProposalResponseModal } from '../../components/swap/ProposalResponseModal';
import { SwapCompletionModal } from '../../components/swap/SwapCompletionModal';
import { swapService } from '../../services/swapService';
import {
  SwapWithBookings,
  SwapStatus,
  Booking,
  BookingType,
  BookingStatus,
} from '@booking-swap/shared';

// Mock services
vi.mock('../../services/swapService');
const mockedSwapService = vi.mocked(swapService);

// Mock WebSocket
vi.mock('../../hooks/useSwapWebSocket', () => ({
  useSwapWebSocket: () => ({
    isConnected: true,
    lastEvent: null,
    reconnect: vi.fn(),
  }),
}));

describe('Swap Workflow Integration Tests', () => {
  let store: ReturnType<typeof configureStore>;
  let user: ReturnType<typeof userEvent.setup>;

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
    terms: {
      additionalPayment: 0,
      conditions: [],
    },
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

  const TestWrapper: React.FC<{ children: React.ReactNode }> = ({
    children,
  }) => (
    <Provider store={store}>
      <BrowserRouter>{children}</BrowserRouter>
    </Provider>
  );

  beforeEach(() => {
    user = userEvent.setup();
    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        swaps: swapsSlice.reducer,
        auth: authSlice.reducer,
      },
      preloadedState: {
        auth: {
          isAuthenticated: true,
          user: {
            id: 'user1',
            username: 'testuser',
            email: 'test@example.com',
            profile: {
              firstName: 'Test',
              lastName: 'User',
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
          walletConnected: true,
          loading: false,
          error: null,
        },
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

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Complete Swap Creation Workflow', () => {
    it('should create a new swap proposal from start to finish', async () => {
      mockedSwapService.createSwap.mockResolvedValue({
        ...mockSwap,
        id: 'new-swap',
      });

      render(
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

      // Fill swap proposal details
      await user.type(
        screen.getByLabelText(/message/i),
        'I would like to swap my hotel booking'
      );

      // Add additional payment if needed
      const paymentInput = screen.getByLabelText(/additional payment/i);
      await user.type(paymentInput, '50');

      // Add conditions
      await user.type(
        screen.getByLabelText(/conditions/i),
        'Flexible check-in time required'
      );

      // Submit the proposal
      const submitButton = screen.getByRole('button', {
        name: /send proposal/i,
      });
      await user.click(submitButton);

      // Wait for the swap to be created
      await waitFor(() => {
        expect(mockedSwapService.createSwap).toHaveBeenCalledWith(
          expect.objectContaining({
            sourceBookingId: mockBooking.id,
            targetBookingId: mockSwap.targetBooking.id,
            terms: expect.objectContaining({
              additionalPayment: 50,
              conditions: expect.arrayContaining([
                'Flexible check-in time required',
              ]),
            }),
          })
        );
      });
    });

    it('should handle swap proposal validation errors', async () => {
      mockedSwapService.createSwap.mockRejectedValue(
        new Error('Validation failed: Message is required')
      );

      render(
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

      // Try to submit without required fields
      await user.click(screen.getByRole('button', { name: /send proposal/i }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/message is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Swap Dashboard and Management Workflow', () => {
    it('should display swaps categorized by status', async () => {
      const pendingSwap = { ...mockSwap, status: 'pending' as SwapStatus };
      const acceptedSwap = {
        ...mockSwap,
        id: 'swap2',
        status: 'accepted' as SwapStatus,
      };

      // Update store with multiple swaps
      store.dispatch(swapsSlice.actions.setSwaps([pendingSwap, acceptedSwap]));

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Should show tabs for different statuses
      expect(screen.getByRole('tab', { name: /pending/i })).toBeInTheDocument();
      expect(
        screen.getByRole('tab', { name: /accepted/i })
      ).toBeInTheDocument();

      // Pending tab should be active by default
      expect(screen.getByRole('tab', { name: /pending/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Should show pending swap
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();

      // Switch to accepted tab
      await user.click(screen.getByRole('tab', { name: /accepted/i }));

      // Should show accepted swap
      expect(screen.getByRole('tab', { name: /accepted/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('should filter swaps by search criteria', async () => {
      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Search for specific swap
      const searchInput = screen.getByPlaceholderText(/search swaps/i);
      await user.type(searchInput, 'Test Hotel');

      // Should show matching swap
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();

      // Search for non-matching text
      await user.clear(searchInput);
      await user.type(searchInput, 'Non-existent');

      // Should show no results
      await waitFor(() => {
        expect(screen.getByText(/no swaps found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Swap Response Workflow', () => {
    it('should accept a swap proposal', async () => {
      mockedSwapService.acceptSwap.mockResolvedValue({
        ...mockSwap,
        status: 'accepted' as SwapStatus,
      });

      render(
        <TestWrapper>
          <ProposalResponseModal
            isOpen={true}
            swap={mockSwap}
            onClose={vi.fn()}
            onAccept={vi.fn()}
            onReject={vi.fn()}
          />
        </TestWrapper>
      );

      // Review swap details
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
      expect(screen.getByText('Target Hotel')).toBeInTheDocument();

      // Accept the swap
      const acceptButton = screen.getByRole('button', { name: /accept/i });
      await user.click(acceptButton);

      // Confirm acceptance
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockedSwapService.acceptSwap).toHaveBeenCalledWith(mockSwap.id);
      });
    });

    it('should reject a swap proposal with reason', async () => {
      mockedSwapService.rejectSwap.mockResolvedValue({
        ...mockSwap,
        status: 'rejected' as SwapStatus,
      });

      render(
        <TestWrapper>
          <ProposalResponseModal
            isOpen={true}
            swap={mockSwap}
            onClose={vi.fn()}
            onAccept={vi.fn()}
            onReject={vi.fn()}
          />
        </TestWrapper>
      );

      // Reject the swap
      const rejectButton = screen.getByRole('button', { name: /reject/i });
      await user.click(rejectButton);

      // Provide rejection reason
      const reasonInput = screen.getByLabelText(/reason/i);
      await user.type(reasonInput, 'Dates no longer work for me');

      // Confirm rejection
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockedSwapService.rejectSwap).toHaveBeenCalledWith(
          mockSwap.id,
          'Dates no longer work for me'
        );
      });
    });
  });

  describe('Swap Completion Workflow', () => {
    it('should complete a swap with blockchain transaction', async () => {
      const acceptedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };

      mockedSwapService.completeSwap.mockResolvedValue({
        ...acceptedSwap,
        status: 'completed' as SwapStatus,
      });

      render(
        <TestWrapper>
          <SwapCompletionModal
            isOpen={true}
            swap={acceptedSwap}
            onClose={vi.fn()}
            onComplete={vi.fn()}
          />
        </TestWrapper>
      );

      // Review completion details
      expect(screen.getByText(/complete swap/i)).toBeInTheDocument();
      expect(screen.getByText(/blockchain transaction/i)).toBeInTheDocument();

      // Agree to terms
      const termsCheckbox = screen.getByLabelText(/agree to terms/i);
      await user.click(termsCheckbox);

      // Complete the swap
      const completeButton = screen.getByRole('button', {
        name: /complete swap/i,
      });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockedSwapService.completeSwap).toHaveBeenCalledWith(
          acceptedSwap.id
        );
      });
    });

    it('should handle blockchain transaction errors', async () => {
      const acceptedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };

      mockedSwapService.completeSwap.mockRejectedValue(
        new Error('Blockchain transaction failed')
      );

      render(
        <TestWrapper>
          <SwapCompletionModal
            isOpen={true}
            swap={acceptedSwap}
            onClose={vi.fn()}
            onComplete={vi.fn()}
          />
        </TestWrapper>
      );

      // Agree to terms and complete
      await user.click(screen.getByLabelText(/agree to terms/i));
      await user.click(screen.getByRole('button', { name: /complete swap/i }));

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/blockchain transaction failed/i)
        ).toBeInTheDocument();
      });

      // Should offer retry option
      expect(
        screen.getByRole('button', { name: /retry/i })
      ).toBeInTheDocument();
    });
  });

  describe('Real-time Updates Workflow', () => {
    it('should update swap status in real-time', async () => {
      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Initially shows pending swap
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();

      // Simulate real-time update
      const updatedSwap = { ...mockSwap, status: 'accepted' as SwapStatus };
      store.dispatch(swapsSlice.actions.updateSwap(updatedSwap));

      // Should move to accepted tab
      await waitFor(() => {
        // Switch to accepted tab to see the updated swap
        const acceptedTab = screen.getByRole('tab', { name: /accepted/i });
        expect(acceptedTab).toBeInTheDocument();
      });
    });

    it('should show notifications for swap events', async () => {
      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Simulate new proposal notification
      // This would typically come through WebSocket
      const notification = {
        type: 'swap_proposal',
        message: 'New swap proposal received',
        swapId: 'new-swap',
      };

      // Should show notification
      // Implementation would depend on notification system
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle expired swaps', async () => {
      const expiredSwap = {
        ...mockSwap,
        status: 'expired' as SwapStatus,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Update with expired swap
      store.dispatch(swapsSlice.actions.updateSwap(expiredSwap));

      // Should show in expired tab
      await user.click(screen.getByRole('tab', { name: /expired/i }));
      expect(screen.getByText(/expired/i)).toBeInTheDocument();
    });

    it('should handle network connectivity issues', async () => {
      mockedSwapService.getSwaps.mockRejectedValue(new Error('Network error'));

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      // Should show error state
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Should offer retry option
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      // Retry should work
      mockedSwapService.getSwaps.mockResolvedValue([mockSwap]);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Test Hotel')).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Large Datasets', () => {
    it('should handle large number of swaps efficiently', async () => {
      // Create 100 mock swaps
      const manySwaps = Array.from({ length: 100 }, (_, i) => ({
        ...mockSwap,
        id: `swap-${i}`,
        sourceBooking: {
          ...mockBooking,
          id: `booking-${i}`,
          title: `Hotel ${i}`,
        },
      }));

      store.dispatch(swapsSlice.actions.setSwaps(manySwaps));

      const startTime = performance.now();

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);

      // Should show pagination or virtualization
      expect(
        screen.getByText(/page/i) || screen.getByText(/showing/i)
      ).toBeInTheDocument();
    });

    it('should implement efficient search and filtering', async () => {
      const manySwaps = Array.from({ length: 1000 }, (_, i) => ({
        ...mockSwap,
        id: `swap-${i}`,
        sourceBooking: {
          ...mockBooking,
          id: `booking-${i}`,
          title: i % 2 === 0 ? `Hotel ${i}` : `Event ${i}`,
        },
      }));

      store.dispatch(swapsSlice.actions.setSwaps(manySwaps));

      render(
        <TestWrapper>
          <SwapDashboard />
        </TestWrapper>
      );

      const startTime = performance.now();

      // Search should be fast even with many items
      const searchInput = screen.getByPlaceholderText(/search swaps/i);
      await user.type(searchInput, 'Hotel');

      const endTime = performance.now();
      const searchTime = endTime - startTime;

      // Search should complete quickly (less than 500ms)
      expect(searchTime).toBeLessThan(500);
    });
  });
});
