import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from '../slices/bookingsSlice';
import { uiSlice } from '../slices/uiSlice';

describe('Enhanced Store Integration', () => {
  it('should create store with enhanced slices', () => {
    const store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        ui: uiSlice.reducer,
      },
    });

    const initialState = store.getState();
    
    // Check bookings slice enhanced state
    expect(initialState.bookings.bookingsWithSwapInfo).toEqual([]);
    expect(initialState.bookings.swappableBookings).toEqual([]);
    expect(initialState.bookings.swapInfoCache).toEqual({});
    
    // Check UI slice enhanced state
    expect(initialState.ui.activeBookingForm.isOpen).toBe(false);
    expect(initialState.ui.activeBookingForm.swapEnabled).toBe(false);
    expect(initialState.ui.inlineProposals).toEqual({});
    expect(initialState.ui.filters.showSwappableOnly).toBe(false);
    expect(initialState.ui.expandedBookingCards).toEqual([]);
  });

  it('should handle basic enhanced actions', () => {
    const store = configureStore({
      reducer: {
        bookings: bookingsSlice.reducer,
        ui: uiSlice.reducer,
      },
    });

    // Test booking form actions
    store.dispatch(uiSlice.actions.openBookingForm({
      mode: 'create',
      swapEnabled: true,
    }));

    let state = store.getState();
    expect(state.ui.activeBookingForm.isOpen).toBe(true);
    expect(state.ui.activeBookingForm.swapEnabled).toBe(true);

    // Test swap filters
    store.dispatch(uiSlice.actions.setSwapFilters({
      showSwappableOnly: true,
    }));

    state = store.getState();
    expect(state.ui.filters.showSwappableOnly).toBe(true);
    expect(state.ui.filters.activeFiltersCount).toBe(1);

    // Test inline proposal
    store.dispatch(uiSlice.actions.openInlineProposal({
      bookingId: 'test-booking',
      proposalType: 'cash',
    }));

    state = store.getState();
    expect(state.ui.inlineProposals['test-booking']).toEqual({
      isOpen: true,
      proposalType: 'cash',
      loading: false,
    });
  });
});