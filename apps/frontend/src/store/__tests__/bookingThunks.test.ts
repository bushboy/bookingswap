import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../slices/bookingsSlice';
import {
  fetchBookings,
  createBooking,
  updateBookingThunk,
  deleteBooking,
} from '../thunks/bookingThunks';
import { bookingService } from '../../services/bookingService';
import { Booking } from '@booking-swap/shared';

// Mock the booking service
vi.mock('../../services/bookingService');
const mockedBookingService = vi.mocked(bookingService);

describe('Booking Thunks', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    vi.clearAllMocks();

    store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
      },
    });
  });

  const mockBooking: Booking = {
    id: '1',
    userId: 'user1',
    type: 'hotel',
    title: 'Test Hotel',
    description: 'A test hotel booking',
    location: {
      city: 'New York',
      country: 'USA',
    },
    dateRange: {
      checkIn: new Date('2024-12-01'),
      checkOut: new Date('2024-12-05'),
    },
    originalPrice: 500,
    swapValue: 450,
    providerDetails: {
      provider: 'Booking.com',
      confirmationNumber: 'ABC123',
      bookingReference: 'REF456',
    },
    verification: {
      status: 'verified',
      verifiedAt: new Date(),
      documents: [],
    },
    blockchain: {
      transactionId: 'tx123',
      consensusTimestamp: '1234567890',
      topicId: 'topic1',
    },
    status: 'available',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('fetchBookings', () => {
    it('should fetch bookings successfully', async () => {
      const mockBookings = [mockBooking];
      mockedBookingService.getBookings.mockResolvedValue(mockBookings);

      const result = await store.dispatch(fetchBookings());

      expect(result.type).toBe('bookings/fetchBookings/fulfilled');
      expect(result.payload).toEqual(mockBookings);

      const state = store.getState();
      expect(state.bookings.bookings).toEqual(mockBookings);
      expect(state.bookings.loading).toBe(false);
      expect(state.bookings.error).toBe(null);
    });

    it('should handle fetch bookings error', async () => {
      const errorMessage = 'Failed to fetch bookings';
      mockedBookingService.getBookings.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await store.dispatch(fetchBookings());

      expect(result.type).toBe('bookings/fetchBookings/rejected');

      const state = store.getState();
      expect(state.bookings.loading).toBe(false);
      expect(state.bookings.error).toBe(errorMessage);
    });

    it('should use cache when available and valid', async () => {
      // Set up initial state with cached data
      const cachedBookings = [mockBooking];
      store.dispatch(bookingsSlice.actions.setBookings(cachedBookings));

      // Mock current time to make cache valid
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      const result = await store.dispatch(fetchBookings());

      expect(result.type).toBe('bookings/fetchBookings/fulfilled');
      expect(result.payload).toEqual(cachedBookings);
      expect(mockedBookingService.getBookings).not.toHaveBeenCalled();
    });
  });

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      const bookingData = {
        type: 'hotel' as const,
        title: 'New Hotel',
        description: 'A new hotel booking',
        location: { city: 'LA', country: 'USA' },
        dateRange: {
          checkIn: new Date('2024-12-01'),
          checkOut: new Date('2024-12-05'),
        },
        originalPrice: 600,
        swapValue: 550,
        providerDetails: {
          provider: 'Hotels.com',
          confirmationNumber: 'XYZ789',
          bookingReference: 'REF789',
        },
      };

      mockedBookingService.createBooking.mockResolvedValue(mockBooking);

      const result = await store.dispatch(createBooking(bookingData));

      expect(result.type).toBe('bookings/createBooking/fulfilled');
      expect(result.payload).toEqual(mockBooking);

      const state = store.getState();
      expect(state.bookings.bookings).toContain(mockBooking);
      expect(state.bookings.currentBooking).toEqual(mockBooking);
    });

    it('should handle create booking error', async () => {
      const bookingData = {
        type: 'hotel' as const,
        title: '',
        description: '',
        location: { city: '', country: '' },
        dateRange: {
          checkIn: new Date(),
          checkOut: new Date(),
        },
        originalPrice: 0,
        swapValue: 0,
        providerDetails: {
          provider: '',
          confirmationNumber: '',
          bookingReference: '',
        },
      };

      const errorMessage = 'Invalid booking data';
      mockedBookingService.createBooking.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await store.dispatch(createBooking(bookingData));

      expect(result.type).toBe('bookings/createBooking/rejected');

      const state = store.getState();
      expect(state.bookings.error).toBe(errorMessage);
    });
  });

  describe('updateBookingThunk', () => {
    it('should update booking successfully', async () => {
      const updateData = { title: 'Updated Hotel' };
      const updatedBooking = { ...mockBooking, title: 'Updated Hotel' };

      mockedBookingService.updateBooking.mockResolvedValue(updatedBooking);

      const result = await store.dispatch(
        updateBookingThunk({ id: '1', data: updateData })
      );

      expect(result.type).toBe('bookings/updateBooking/fulfilled');
      expect(result.payload).toEqual(updatedBooking);
      expect(mockedBookingService.updateBooking).toHaveBeenCalledWith(
        '1',
        updateData
      );
    });
  });

  describe('deleteBooking', () => {
    it('should delete booking successfully', async () => {
      // Set up initial state with booking
      store.dispatch(bookingsSlice.actions.addBooking(mockBooking));

      mockedBookingService.deleteBooking.mockResolvedValue(undefined);

      const result = await store.dispatch(deleteBooking('1'));

      expect(result.type).toBe('bookings/deleteBooking/fulfilled');
      expect(result.payload).toBe('1');

      const state = store.getState();
      expect(state.bookings.bookings).not.toContain(mockBooking);
    });

    it('should handle delete booking error', async () => {
      const errorMessage = 'Failed to delete booking';
      mockedBookingService.deleteBooking.mockRejectedValue(
        new Error(errorMessage)
      );

      const result = await store.dispatch(deleteBooking('1'));

      expect(result.type).toBe('bookings/deleteBooking/rejected');

      const state = store.getState();
      expect(state.bookings.error).toBe(errorMessage);
    });
  });
});
