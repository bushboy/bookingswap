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
import { BookingList } from '../../components/booking/BookingList';
import { BookingFormModal } from '../../components/booking/BookingFormModal';
import { bookingService } from '../../services/bookingService';
import { Booking, BookingType, BookingStatus } from '@booking-swap/shared';

// Mock services
vi.mock('../../services/bookingService');
const mockedBookingService = vi.mocked(bookingService);

// Mock file upload
Object.defineProperty(window, 'File', {
  value: class MockFile {
    constructor(
      public name: string,
      public type: string
    ) {}
  },
});

describe('Booking Workflow Integration Tests', () => {
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
          swaps: [],
          selectedSwap: null,
          filters: { status: [], type: [], location: {}, dateRange: {} },
          categorizedSwaps: {
            pending: [],
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

  describe('Complete Booking Creation Workflow', () => {
    it('should create a new booking from start to finish', async () => {
      // Mock successful booking creation
      mockedBookingService.createBooking.mockResolvedValue({
        ...mockBooking,
        id: 'new-booking',
        title: 'New Hotel Booking',
      });

      render(
        <TestWrapper>
          <BookingList
            bookings={[]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Fill out the booking form
      await user.type(screen.getByLabelText(/title/i), 'New Hotel Booking');
      await user.type(
        screen.getByLabelText(/description/i),
        'A beautiful hotel in Paris'
      );

      // Select booking type
      await user.selectOptions(screen.getByLabelText(/type/i), 'hotel');

      // Fill location
      await user.type(screen.getByLabelText(/city/i), 'Paris');
      await user.type(screen.getByLabelText(/country/i), 'France');

      // Fill dates
      const checkInInput = screen.getByLabelText(/check.?in/i);
      const checkOutInput = screen.getByLabelText(/check.?out/i);
      await user.type(checkInInput, '2024-07-01');
      await user.type(checkOutInput, '2024-07-05');

      // Fill pricing
      await user.type(screen.getByLabelText(/original price/i), '600');
      await user.type(screen.getByLabelText(/swap value/i), '550');

      // Fill provider details
      await user.type(screen.getByLabelText(/provider/i), 'Hotels.com');
      await user.type(screen.getByLabelText(/confirmation/i), 'CONF123');
      await user.type(screen.getByLabelText(/reference/i), 'REF456');

      // Submit the form
      const submitButton = screen.getByRole('button', {
        name: /create booking/i,
      });
      await user.click(submitButton);

      // Wait for the booking to be created
      await waitFor(() => {
        expect(mockedBookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Hotel Booking',
            description: 'A beautiful hotel in Paris',
            type: 'hotel',
            location: expect.objectContaining({
              city: 'Paris',
              country: 'France',
            }),
            originalPrice: 600,
            swapValue: 550,
          })
        );
      });
    });

    it('should handle booking creation with file uploads', async () => {
      const mockFile = new File(['test content'], 'booking-confirmation.pdf', {
        type: 'application/pdf',
      });

      mockedBookingService.createBooking.mockResolvedValue({
        ...mockBooking,
        id: 'new-booking-with-files',
      });

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Fill required fields
      await user.type(screen.getByLabelText(/title/i), 'Hotel with Documents');
      await user.selectOptions(screen.getByLabelText(/type/i), 'hotel');
      await user.type(screen.getByLabelText(/city/i), 'London');
      await user.type(screen.getByLabelText(/country/i), 'UK');

      // Upload file
      const fileInput = screen.getByLabelText(/upload documents/i);
      await user.upload(fileInput, mockFile);

      // Verify file is uploaded
      expect(screen.getByText('booking-confirmation.pdf')).toBeInTheDocument();

      // Submit form
      await user.click(screen.getByRole('button', { name: /create booking/i }));

      await waitFor(() => {
        expect(mockedBookingService.createBooking).toHaveBeenCalledWith(
          expect.objectContaining({
            documents: expect.arrayContaining([mockFile]),
          })
        );
      });
    });

    it('should handle validation errors during booking creation', async () => {
      mockedBookingService.createBooking.mockRejectedValue(
        new Error('Validation failed: Title is required')
      );

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Try to submit without required fields
      await user.click(screen.getByRole('button', { name: /create booking/i }));

      // Should show validation errors
      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Booking List and Filtering Workflow', () => {
    it('should filter bookings by type and status', async () => {
      const hotelBooking = { ...mockBooking, type: 'hotel' as BookingType };
      const eventBooking = {
        ...mockBooking,
        id: '2',
        type: 'event' as BookingType,
        title: 'Concert Tickets',
      };

      render(
        <TestWrapper>
          <BookingList
            bookings={[hotelBooking, eventBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Initially should show both bookings
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
      expect(screen.getByText('Concert Tickets')).toBeInTheDocument();

      // Filter by hotel type
      await user.click(screen.getByLabelText(/hotel/i));

      // Should only show hotel booking
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();
      expect(screen.queryByText('Concert Tickets')).not.toBeInTheDocument();
    });

    it('should search bookings by text', async () => {
      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Search for specific booking
      const searchInput = screen.getByPlaceholderText(/search bookings/i);
      await user.type(searchInput, 'Test Hotel');

      // Should show matching booking
      expect(screen.getByText('Test Hotel')).toBeInTheDocument();

      // Search for non-matching text
      await user.clear(searchInput);
      await user.type(searchInput, 'Non-existent');

      // Should show no results
      await waitFor(() => {
        expect(screen.getByText(/no bookings found/i)).toBeInTheDocument();
      });
    });

    it('should sort bookings by different criteria', async () => {
      const booking1 = { ...mockBooking, id: '1', originalPrice: 300 };
      const booking2 = { ...mockBooking, id: '2', originalPrice: 600 };

      render(
        <TestWrapper>
          <BookingList
            bookings={[booking1, booking2]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Change sort to price ascending
      const sortSelect = screen.getByDisplayValue(/date/i);
      await user.selectOptions(sortSelect, 'price');

      // Click sort order toggle
      const sortOrderButton = screen.getByTitle(/sort/i);
      await user.click(sortOrderButton);

      // Bookings should be sorted by price (lowest first)
      const bookingCards = screen.getAllByTestId(/booking-card/i);
      expect(bookingCards[0]).toHaveTextContent('$300');
      expect(bookingCards[1]).toHaveTextContent('$600');
    });
  });

  describe('Booking Actions Workflow', () => {
    it('should edit an existing booking', async () => {
      const onEditBooking = vi.fn();
      mockedBookingService.updateBooking.mockResolvedValue({
        ...mockBooking,
        title: 'Updated Hotel Title',
      });

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={onEditBooking}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);

      expect(onEditBooking).toHaveBeenCalledWith(mockBooking);
    });

    it('should delete a booking with confirmation', async () => {
      const onDeleteBooking = vi.fn();
      mockedBookingService.deleteBooking.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={onDeleteBooking}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      expect(onDeleteBooking).toHaveBeenCalledWith(mockBooking.id);
    });

    it('should create swap from booking', async () => {
      const onCreateSwap = vi.fn();

      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={onCreateSwap}
            variant="own"
          />
        </TestWrapper>
      );

      // Click create swap button
      const createSwapButton = screen.getByRole('button', {
        name: /create swap/i,
      });
      await user.click(createSwapButton);

      expect(onCreateSwap).toHaveBeenCalledWith(mockBooking);
    });
  });

  describe('Error Handling Workflow', () => {
    it('should handle network errors gracefully', async () => {
      mockedBookingService.createBooking.mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/title/i), 'Test Booking');
      await user.click(screen.getByRole('button', { name: /create booking/i }));

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should retry failed operations', async () => {
      mockedBookingService.createBooking
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValue(mockBooking);

      render(
        <TestWrapper>
          <BookingFormModal
            isOpen={true}
            onClose={vi.fn()}
            onSubmit={vi.fn()}
          />
        </TestWrapper>
      );

      // Fill and submit form
      await user.type(screen.getByLabelText(/title/i), 'Test Booking');
      await user.click(screen.getByRole('button', { name: /create booking/i }));

      // Should show error and retry button
      await waitFor(() => {
        expect(screen.getByText(/temporary error/i)).toBeInTheDocument();
      });

      // Click retry
      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      // Should succeed on retry
      await waitFor(() => {
        expect(mockedBookingService.createBooking).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Accessibility Workflow', () => {
    it('should support keyboard navigation', async () => {
      render(
        <TestWrapper>
          <BookingList
            bookings={[mockBooking]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
          />
        </TestWrapper>
      );

      // Navigate using keyboard
      await user.tab();
      expect(
        screen.getByRole('button', { name: /view details/i })
      ).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('button', { name: /edit/i })).toHaveFocus();

      // Activate with Enter key
      await user.keyboard('{Enter}');
      // Should trigger edit action
    });

    it('should announce changes to screen readers', async () => {
      render(
        <TestWrapper>
          <BookingList
            bookings={[]}
            onViewDetails={vi.fn()}
            onProposeSwap={vi.fn()}
            onEditBooking={vi.fn()}
            onDeleteBooking={vi.fn()}
            onCreateSwap={vi.fn()}
            variant="own"
            loading={true}
          />
        </TestWrapper>
      );

      // Should have aria-live region for announcements
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
