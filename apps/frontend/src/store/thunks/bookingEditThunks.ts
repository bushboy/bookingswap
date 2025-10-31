import { createAsyncThunk } from '@reduxjs/toolkit';
import { BookingEditData } from '@booking-swap/shared';
import { bookingEditService } from '../../services/bookingEditService';
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
  markFormSaved,
  setValidationErrors,
  clearValidationErrors,
} from '../slices/bookingEditSlice';
import { RootState } from '../index';
import { Booking, BookingStatus } from '@booking-swap/shared';
import {
  BookingFilters,
  SearchQuery,
} from '../../services/bookingService';

// Fetch user's bookings (pure booking data only)
export const fetchBookingsForEdit = createAsyncThunk(
  'bookingEdit/fetchBookings',
  async (filters?: BookingFilters, { dispatch, getState }) => {
    try {
      dispatch(setLoading(true));

      const state = getState() as RootState;

      // Check cache validity if no filters provided
      if (!filters && state.bookingEdit.lastFetchTime) {
        const cacheAge = Date.now() - state.bookingEdit.lastFetchTime;
        if (cacheAge < state.bookingEdit.cacheExpiry) {
          dispatch(setLoading(false));
          return state.bookingEdit.bookings;
        }
      }

      const bookings = await bookingEditService.getBookings(filters);
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

// Fetch a single booking for editing
export const fetchBookingForEdit = createAsyncThunk(
  'bookingEdit/fetchBooking',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const booking = await bookingEditService.getBooking(id);
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

// Create a new booking (pure booking data only)
export const createBookingOnly = createAsyncThunk(
  'bookingEdit/createBooking',
  async (bookingData: BookingEditData, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      dispatch(clearValidationErrors());

      // Validate booking data
      const validationResult = await bookingEditService.validateBookingData(bookingData);
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
        throw new Error('Validation failed');
      }

      const booking = await bookingEditService.createBooking(bookingData);
      dispatch(addBooking(booking));
      dispatch(setCurrentBooking(booking));
      dispatch(markFormSaved());
      return booking;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create booking';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Update an existing booking (pure booking data only)
export const updateBookingOnly = createAsyncThunk(
  'bookingEdit/updateBooking',
  async (
    { id, data }: { id: string; data: BookingEditData },
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));
      dispatch(clearValidationErrors());

      // Validate booking data
      const validationResult = await bookingEditService.validateBookingData(data);
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
        throw new Error('Validation failed');
      }

      const updatedBooking = await bookingEditService.updateBooking(id, data);
      dispatch(updateBooking(updatedBooking));
      dispatch(markFormSaved());
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
export const deleteBookingOnly = createAsyncThunk(
  'bookingEdit/deleteBooking',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      await bookingEditService.deleteBooking(id);
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

// Search bookings for editing
export const searchBookingsForEdit = createAsyncThunk(
  'bookingEdit/searchBookings',
  async (query: SearchQuery, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const searchResult = await bookingEditService.searchBookings(query);
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

// Fetch available bookings (pure booking data)
export const fetchAvailableBookingsForEdit = createAsyncThunk(
  'bookingEdit/fetchAvailableBookings',
  async (filters: BookingFilters, { dispatch }) => {
    try {
      dispatch(setLoading(true));
      const bookings = await bookingEditService.getAvailableBookings(filters);
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
export const updateBookingStatusOnly = createAsyncThunk(
  'bookingEdit/updateBookingStatus',
  async (
    { id, status }: { id: string; status: BookingStatus },
    { dispatch }
  ) => {
    try {
      // Optimistic update
      dispatch(optimisticUpdateBookingStatus({ id, status }));

      const updatedBooking = await bookingEditService.updateBookingStatus(id, status);
      dispatch(updateBooking(updatedBooking));
      return updatedBooking;
    } catch (error) {
      // Revert optimistic update by refetching
      dispatch(fetchBookingForEdit(id));

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
  'bookingEdit/checkBookingModifiable',
  async (bookingId: string) => {
    try {
      const canModify = await bookingEditService.canModifyBooking(bookingId);
      return { bookingId, canModify };
    } catch (error) {
      throw error;
    }
  }
);

// Validate booking data without saving
export const validateBookingDataOnly = createAsyncThunk(
  'bookingEdit/validateBookingData',
  async (bookingData: BookingEditData, { dispatch }) => {
    try {
      const validationResult = await bookingEditService.validateBookingData(bookingData);
      
      if (!validationResult.isValid) {
        dispatch(setValidationErrors(validationResult.errors));
      } else {
        dispatch(clearValidationErrors());
      }
      
      return validationResult;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to validate booking data';
      dispatch(setError(message));
      throw error;
    }
  }
);

// Refresh bookings data
export const refreshBookingsForEdit = createAsyncThunk(
  'bookingEdit/refreshBookings',
  async (_, { dispatch }) => {
    try {
      dispatch(invalidateCache());
      return await dispatch(fetchBookingsForEdit()).unwrap();
    } catch (error) {
      throw error;
    }
  }
);

// Batch update multiple bookings
export const batchUpdateBookingsOnly = createAsyncThunk(
  'bookingEdit/batchUpdateBookings',
  async (
    updates: Array<{ id: string; data: BookingEditData }>,
    { dispatch }
  ) => {
    try {
      dispatch(setLoading(true));

      const updatePromises = updates.map(({ id, data }) =>
        bookingEditService.updateBooking(id, data)
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

// Fetch bookings with retry mechanism
export const fetchBookingsForEditWithRetry = createAsyncThunk(
  'bookingEdit/fetchBookingsWithRetry',
  async (
    filters: BookingFilters | undefined,
    { dispatch, rejectWithValue }
  ) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await dispatch(fetchBookingsForEdit(filters)).unwrap();
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

// Auto-save booking data (for unsaved changes preservation)
export const autoSaveBookingData = createAsyncThunk(
  'bookingEdit/autoSaveBookingData',
  async (
    { id, data }: { id: string; data: BookingEditData },
    { dispatch }
  ) => {
    try {
      // This is a background operation, don't show loading state
      const updatedBooking = await bookingEditService.updateBooking(id, data);
      dispatch(updateBooking(updatedBooking));
      dispatch(markFormSaved());
      return updatedBooking;
    } catch (error) {
      // Auto-save failures should not show error to user
      console.warn('Auto-save failed:', error);
      throw error;
    }
  }
);

// Check booking ownership and permissions
export const checkBookingPermissions = createAsyncThunk(
  'bookingEdit/checkBookingPermissions',
  async ({ bookingId, userId }: { bookingId: string; userId: string }) => {
    try {
      const permissions = await bookingEditService.checkBookingPermissions(bookingId, userId);
      return { bookingId, permissions };
    } catch (error) {
      throw error;
    }
  }
);