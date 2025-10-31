import { configureStore } from '@reduxjs/toolkit';
import { bookingEditSlice, 
  setLoading, 
  setError, 
  setBookings, 
  startEditingBooking,
  updateEditFormData,
  markFormSaved,
  preserveFormData,
  restoreFormData,
  selectBookings,
  selectEditingBooking,
  selectHasUnsavedChanges,
  selectCanNavigateAway,
} from '../bookingEditSlice';
import { Booking, BookingEditData } from '@booking-swap/shared';

// Mock booking data
const mockBooking: Booking = {
  id: 'booking-1',
  userId: 'user-1',
  type: 'hotel',
  title: 'Test Hotel Booking',
  description: 'A test hotel booking',
  location: {
    address: '123 Test St',
    city: 'Test City',
    country: 'Test Country',
    coordinates: { lat: 0, lng: 0 },
  },
  dateRange: {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-03'),
  },
  originalPrice: 200,
  swapValue: 180,
  providerDetails: {
    name: 'Test Provider',
    contact: 'test@provider.com',
  },
  status: 'confirmed',
  verification: {
    status: 'verified',
    verifiedAt: new Date(),
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBookingEditData: BookingEditData = {
  type: 'hotel',
  title: 'Updated Hotel Booking',
  description: 'An updated test hotel booking',
  location: {
    address: '456 Updated St',
    city: 'Updated City',
    country: 'Updated Country',
    coordinates: { lat: 1, lng: 1 },
  },
  dateRange: {
    startDate: new Date('2024-02-01'),
    endDate: new Date('2024-02-03'),
  },
  originalPrice: 250,
  swapValue: 220,
  providerDetails: {
    name: 'Updated Provider',
    contact: 'updated@provider.com',
  },
};

describe('bookingEditSlice', () => {
  let store: ReturnType<typeof configureStore>;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        bookingEdit: bookingEditSlice.reducer,
      },
    });
  });

  describe('basic state management', () => {
    it('should handle initial state', () => {
      const state = store.getState().bookingEdit;
      expect(state.bookings).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.editingBooking).toBe(null);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle setLoading', () => {
      store.dispatch(setLoading(true));
      expect(store.getState().bookingEdit.loading).toBe(true);
      expect(store.getState().bookingEdit.error).toBe(null);
    });

    it('should handle setError', () => {
      store.dispatch(setError('Test error'));
      expect(store.getState().bookingEdit.error).toBe('Test error');
      expect(store.getState().bookingEdit.loading).toBe(false);
    });

    it('should handle setBookings', () => {
      store.dispatch(setBookings([mockBooking]));
      const state = store.getState().bookingEdit;
      expect(state.bookings).toEqual([mockBooking]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe(null);
      expect(state.lastFetchTime).toBeTruthy();
    });
  });

  describe('form state management', () => {
    it('should handle startEditingBooking', () => {
      store.dispatch(startEditingBooking(mockBooking));
      const state = store.getState().bookingEdit;
      
      expect(state.editingBooking).toEqual(mockBooking);
      expect(state.editFormData).toEqual({
        type: mockBooking.type,
        title: mockBooking.title,
        description: mockBooking.description,
        location: mockBooking.location,
        dateRange: mockBooking.dateRange,
        originalPrice: mockBooking.originalPrice,
        swapValue: mockBooking.swapValue,
        providerDetails: mockBooking.providerDetails,
      });
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.validationErrors).toEqual({});
    });

    it('should handle updateEditFormData', () => {
      store.dispatch(startEditingBooking(mockBooking));
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      
      const state = store.getState().bookingEdit;
      expect(state.editFormData?.title).toBe('Updated Title');
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('should handle markFormSaved', () => {
      store.dispatch(startEditingBooking(mockBooking));
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      store.dispatch(markFormSaved());
      
      const state = store.getState().bookingEdit;
      expect(state.hasUnsavedChanges).toBe(false);
    });
  });

  describe('navigation state preservation', () => {
    it('should handle preserveFormData', () => {
      store.dispatch(startEditingBooking(mockBooking));
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      store.dispatch(preserveFormData());
      
      const state = store.getState().bookingEdit;
      expect(state.navigationContext.preservedFormData).toBeTruthy();
      expect(state.navigationContext.preservedFormData?.title).toBe('Updated Title');
      expect(state.navigationContext.lastEditedBookingId).toBe(mockBooking.id);
    });

    it('should handle restoreFormData', () => {
      // Set up initial state
      store.dispatch(setBookings([mockBooking]));
      store.dispatch(startEditingBooking(mockBooking));
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      store.dispatch(preserveFormData());
      
      // Clear current editing state
      store.dispatch({ type: 'bookingEdit/cancelEditing' });
      
      // Restore form data
      store.dispatch(restoreFormData());
      
      const state = store.getState().bookingEdit;
      expect(state.editingBooking).toEqual(mockBooking);
      expect(state.editFormData?.title).toBe('Updated Title');
      expect(state.hasUnsavedChanges).toBe(true);
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.dispatch(setBookings([mockBooking]));
    });

    it('should select bookings', () => {
      const bookings = selectBookings(store.getState());
      expect(bookings).toEqual([mockBooking]);
    });

    it('should select editing booking', () => {
      store.dispatch(startEditingBooking(mockBooking));
      const editingBooking = selectEditingBooking(store.getState());
      expect(editingBooking).toEqual(mockBooking);
    });

    it('should select hasUnsavedChanges', () => {
      store.dispatch(startEditingBooking(mockBooking));
      expect(selectHasUnsavedChanges(store.getState())).toBe(false);
      
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      expect(selectHasUnsavedChanges(store.getState())).toBe(true);
    });

    it('should select canNavigateAway', () => {
      store.dispatch(startEditingBooking(mockBooking));
      expect(selectCanNavigateAway(store.getState())).toBe(true);
      
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      expect(selectCanNavigateAway(store.getState())).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle updateEditFormData when no form data exists', () => {
      store.dispatch(updateEditFormData({ title: 'Updated Title' }));
      const state = store.getState().bookingEdit;
      expect(state.editFormData).toBe(null);
      expect(state.hasUnsavedChanges).toBe(false);
    });

    it('should handle restoreFormData when no preserved data exists', () => {
      store.dispatch(restoreFormData());
      const state = store.getState().bookingEdit;
      expect(state.editingBooking).toBe(null);
      expect(state.editFormData).toBe(null);
    });

    it('should handle restoreFormData when booking no longer exists', () => {
      // Set up preserved data for non-existent booking
      store.dispatch({
        type: 'bookingEdit/setNavigationContext',
        payload: {
          preservedFormData: mockBookingEditData,
          lastEditedBookingId: 'non-existent-booking',
        },
      });
      
      store.dispatch(restoreFormData());
      const state = store.getState().bookingEdit;
      expect(state.editingBooking).toBe(null);
      expect(state.editFormData).toBe(null);
    });
  });
});