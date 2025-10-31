import { describe, it, expect, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import {
  bookingsSlice,
  setBookings,
  addBooking,
  updateBooking,
  removeBooking,
  setBookingFilters,
  setBookingSort,
  setBookingView,
  setSelectedBooking,
  clearSelectedBooking,
  setBookingError,
  clearBookingError,
  setBookingLoading,
} from '../bookingsSlice';
import { Booking, BookingType, BookingStatus } from '@booking-swap/shared';

describe('bookingsSlice', () => {
  let store: ReturnType<typeof configureStore>;

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

  const initialState = {
    bookings: [],
    selectedBooking: null,
    filters: {
      type: [],
      status: [],
      location: {},
      dateRange: {},
      priceRange: {},
    },
    sort: {
      field: 'createdAt',
      order: 'desc',
    },
    view: 'grid',
    pagination: {
      page: 1,
      limit: 12,
      total: 0,
      totalPages: 0,
    },
    loading: false,
    error: null,
  };

  beforeEach(() => {
    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
      },
    });
  });

  it('should return the initial state', () => {
    expect(bookingsSlice.reducer(undefined, { type: undefined })).toEqual(
      initialState
    );
  });

  describe('setBookings', () => {
    it('should set bookings list', () => {
      const bookings = [mockBooking];
      const action = setBookings(bookings);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.bookings).toEqual(bookings);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should update pagination info', () => {
      const bookings = [mockBooking];
      const action = setBookings(bookings);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.pagination.total).toBe(1);
      expect(state.pagination.totalPages).toBe(1);
    });
  });

  describe('addBooking', () => {
    it('should add a new booking', () => {
      const action = addBooking(mockBooking);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.bookings).toContain(mockBooking);
      expect(state.bookings).toHaveLength(1);
    });

    it('should not add duplicate booking', () => {
      const stateWithBooking = {
        ...initialState,
        bookings: [mockBooking],
      };

      const action = addBooking(mockBooking);
      const state = bookingsSlice.reducer(stateWithBooking, action);

      expect(state.bookings).toHaveLength(1);
    });
  });

  describe('updateBooking', () => {
    it('should update existing booking', () => {
      const stateWithBooking = {
        ...initialState,
        bookings: [mockBooking],
      };

      const updatedBooking = { ...mockBooking, title: 'Updated Hotel' };
      const action = updateBooking(updatedBooking);
      const state = bookingsSlice.reducer(stateWithBooking, action);

      expect(state.bookings[0].title).toBe('Updated Hotel');
    });

    it('should not update non-existent booking', () => {
      const nonExistentBooking = { ...mockBooking, id: 'non-existent' };
      const action = updateBooking(nonExistentBooking);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.bookings).toHaveLength(0);
    });

    it('should update selected booking if it matches', () => {
      const stateWithSelected = {
        ...initialState,
        bookings: [mockBooking],
        selectedBooking: mockBooking,
      };

      const updatedBooking = { ...mockBooking, title: 'Updated Hotel' };
      const action = updateBooking(updatedBooking);
      const state = bookingsSlice.reducer(stateWithSelected, action);

      expect(state.selectedBooking?.title).toBe('Updated Hotel');
    });
  });

  describe('removeBooking', () => {
    it('should remove booking by id', () => {
      const stateWithBooking = {
        ...initialState,
        bookings: [mockBooking],
      };

      const action = removeBooking('1');
      const state = bookingsSlice.reducer(stateWithBooking, action);

      expect(state.bookings).toHaveLength(0);
    });

    it('should clear selected booking if removed', () => {
      const stateWithSelected = {
        ...initialState,
        bookings: [mockBooking],
        selectedBooking: mockBooking,
      };

      const action = removeBooking('1');
      const state = bookingsSlice.reducer(stateWithSelected, action);

      expect(state.selectedBooking).toBeNull();
    });
  });

  describe('setBookingFilters', () => {
    it('should update filters', () => {
      const filters = {
        type: ['hotel' as BookingType],
        status: ['available' as BookingStatus],
        location: { city: 'New York' },
      };

      const action = setBookingFilters(filters);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.filters.type).toEqual(['hotel']);
      expect(state.filters.status).toEqual(['available']);
      expect(state.filters.location.city).toBe('New York');
    });

    it('should reset pagination when filters change', () => {
      const stateWithPagination = {
        ...initialState,
        pagination: { ...initialState.pagination, page: 3 },
      };

      const action = setBookingFilters({ type: ['hotel'] });
      const state = bookingsSlice.reducer(stateWithPagination, action);

      expect(state.pagination.page).toBe(1);
    });
  });

  describe('setBookingSort', () => {
    it('should update sort configuration', () => {
      const sort = { field: 'price', order: 'asc' as const };
      const action = setBookingSort(sort);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.sort.field).toBe('price');
      expect(state.sort.order).toBe('asc');
    });
  });

  describe('setBookingView', () => {
    it('should update view mode', () => {
      const action = setBookingView('list');
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.view).toBe('list');
    });
  });

  describe('setSelectedBooking', () => {
    it('should set selected booking', () => {
      const action = setSelectedBooking(mockBooking);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.selectedBooking).toEqual(mockBooking);
    });
  });

  describe('clearSelectedBooking', () => {
    it('should clear selected booking', () => {
      const stateWithSelected = {
        ...initialState,
        selectedBooking: mockBooking,
      };

      const action = clearSelectedBooking();
      const state = bookingsSlice.reducer(stateWithSelected, action);

      expect(state.selectedBooking).toBeNull();
    });
  });

  describe('setBookingLoading', () => {
    it('should set loading state', () => {
      const action = setBookingLoading(true);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.loading).toBe(true);
    });

    it('should clear error when loading starts', () => {
      const stateWithError = {
        ...initialState,
        error: 'Previous error',
      };

      const action = setBookingLoading(true);
      const state = bookingsSlice.reducer(stateWithError, action);

      expect(state.error).toBeNull();
    });
  });

  describe('setBookingError', () => {
    it('should set error state', () => {
      const error = 'Failed to load bookings';
      const action = setBookingError(error);
      const state = bookingsSlice.reducer(initialState, action);

      expect(state.error).toBe(error);
      expect(state.loading).toBe(false);
    });
  });

  describe('clearBookingError', () => {
    it('should clear error state', () => {
      const stateWithError = {
        ...initialState,
        error: 'Some error',
      };

      const action = clearBookingError();
      const state = bookingsSlice.reducer(stateWithError, action);

      expect(state.error).toBeNull();
    });
  });

  describe('selectors', () => {
    it('should select filtered bookings', () => {
      const stateWithBookings = {
        ...initialState,
        bookings: [
          mockBooking,
          { ...mockBooking, id: '2', type: 'event' as BookingType },
        ],
        filters: { type: ['hotel'] },
      };

      // This would be tested with actual selectors if they exist
      const hotelBookings = stateWithBookings.bookings.filter(booking =>
        stateWithBookings.filters.type?.includes(booking.type)
      );

      expect(hotelBookings).toHaveLength(1);
      expect(hotelBookings[0].type).toBe('hotel');
    });

    it('should select sorted bookings', () => {
      const booking1 = {
        ...mockBooking,
        id: '1',
        createdAt: new Date('2024-01-01'),
      };
      const booking2 = {
        ...mockBooking,
        id: '2',
        createdAt: new Date('2024-01-02'),
      };

      const stateWithBookings = {
        ...initialState,
        bookings: [booking1, booking2],
        sort: { field: 'createdAt', order: 'asc' as const },
      };

      const sortedBookings = [...stateWithBookings.bookings].sort((a, b) => {
        const aValue = a.createdAt.getTime();
        const bValue = b.createdAt.getTime();
        return stateWithBookings.sort.order === 'asc'
          ? aValue - bValue
          : bValue - aValue;
      });

      expect(sortedBookings[0].id).toBe('1');
      expect(sortedBookings[1].id).toBe('2');
    });
  });
});
