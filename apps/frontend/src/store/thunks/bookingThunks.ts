import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  bookingService,
  CreateBookingRequest,
  UpdateBookingRequest,
  BookingFilters,
  SearchQuery,
} from '../../services/bookingService';
import {
  setLoading,
  setError,
  setBookings,
  setCurrentBooking,
  setSearchResults,
  setAvailableBookings,
  addBooking,
  updateBooking,
  removeBooking,
  optimisticUpdateBookingStatus,
  invalidateCache,
} from '../slices/bookingsSlice';
import { RootState } from '../index';
import { Booking, BookingStatus } from '@booking-swap/shared';

// Fetch user's bookings
export const fetchBookings = createAsyncThunk(
  'bookings/fetchBookings',
  async (filters?: BookingFilters, { dispatch, getState }) => {
    try {
      dispatch(setLoading(true));

      const state = getState() as RootState;

      // Check cache validity if no filters provided
      if (!filters && state.bookings.lastFetchTime) {
        const cacheAge = Date.now() - state.bookings.lastFetchTime;
        if (cacheAge < state.bookings.cacheExpiry) {
          dispatch(setLoading(false));
          return state.bookings.bookings;
        }
      }

      const bookings = await bookingService.getBookings(filters);
      dispatch(setBookings(bookings));
      return bookings;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch bookings';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch a single booking
export const fetchBooking = createAsyncThunk(
  'bookings/fetchBooking',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const booking = await bookingService.getBooking(id);
      dispatch(setCurrentBooking(booking));
      return booking;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch booking';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Create a new booking
export const createBooking = createAsyncThunk(
  'bookings/createBooking',
  async (bookingData: CreateBookingRequest, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const booking = await bookingService.createBooking(bookingData);
      dispatch(addBooking(booking));
      dispatch(setCurrentBooking(booking));
      return booking;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create booking';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Update an existing booking
export const updateBookingThunk = createAsyncThunk(
  'bookings/updateBooking',
  async (
    { id, data }: { id: string; data: UpdateBookingRequest },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      const updatedBooking = await bookingService.updateBooking(id, data);
      dispatch(updateBooking(updatedBooking));
      return updatedBooking;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update booking';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Delete a booking
export const deleteBooking = createAsyncThunk(
  'bookings/deleteBooking',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      await bookingService.deleteBooking(id);
      dispatch(removeBooking(id));
      return id;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to delete booking';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Search bookings
export const searchBookings = createAsyncThunk(
  'bookings/searchBookings',
  async (query: SearchQuery, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const searchResult = await bookingService.searchBookings(query);
      dispatch(setSearchResults(searchResult));
      return searchResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to search bookings';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Fetch available bookings for swapping
export const fetchAvailableBookings = createAsyncThunk(
  'bookings/fetchAvailableBookings',
  async (filters: BookingFilters, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const bookings = await bookingService.getAvailableBookings(filters);
      dispatch(setAvailableBookings(bookings));
      return bookings;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to fetch available bookings';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Update booking status with optimistic updates
export const updateBookingStatus = createAsyncThunk(
  'bookings/updateBookingStatus',
  async (
    { id, status }: { id: string; status: BookingStatus },
    { dispatch }
  ) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateBookingStatus({ id, status }));

      const updatedBooking = await bookingService.updateBooking(id, { status });
      dispatch(updateBooking(updatedBooking));
      return updatedBooking;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchBooking(id));

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update booking status';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Check if booking can be modified
export const checkBookingModifiable = createAsyncThunk(
  'bookings/checkBookingModifiable',
  async (bookingId: string) => {
    try {
      const canModify = await bookingService.canModifyBooking(bookingId);
      return { bookingId, canModify };
    } catch (error) {
      throw error;
    }
  }
);

// Check if booking can be swapped
export const checkBookingSwappable = createAsyncThunk(
  'bookings/checkBookingSwappable',
  async (bookingId: string) => {
    try {
      const canSwap = await bookingService.canSwapBooking(bookingId);
      return { bookingId, canSwap };
    } catch (error) {
      throw error;
    }
  }
);

// Refresh bookings data
export const refreshBookings = createAsyncThunk(
  'bookings/refreshBookings',
  async (_, { dispatch }) => {
    try {
      dispatch(invalidateCache());
      return await dispatch(fetchBookings()).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Batch update multiple bookings
export const batchUpdateBookings = createAsyncThunk(
  'bookings/batchUpdateBookings',
  async (
    updates: Array<{ id: string; data: UpdateBookingRequest }>,
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));

      const updatePromises = updates.map(({ id, data }) =>
        bookingService.updateBooking(id, data)
      );

      const updatedBookings = await Promise.all(updatePromises);

      // Update each booking in the store
      updatedBookings.forEach(booking => {
        dispatch(updateBooking(booking));
      });

      return updatedBookings;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update bookings';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Validate booking data
export const validateBookingData = createAsyncThunk(
  'bookings/validateBookingData',
  async (bookingData: CreateBookingRequest) => {
    try {
      const validationResult =
        await bookingService.validateBooking(bookingData);
      return validationResult;
    } catch (error) {
      throw error;
    }
  }
);

// Fetch bookings with retry mechanism
export const fetchBookingsWithRetry = createAsyncThunk(
  'bookings/fetchBookingsWithRetry',
  async (
    filters: BookingFilters | undefined,
    { dispatch, rejectWithValue }
  ) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await dispatch(fetchBookings(filters)).unwrap();
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          return rejectWithValue(lastError.message);
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, attempt) * 1000)
        );
      }
    }

    return rejectWithValue(
      lastError?.message || 'Failed to fetch bookings after retries'
    );
  }
);
