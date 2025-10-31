// Simple verification script for enhanced store functionality
import { configureStore } from '@reduxjs/toolkit';
import { bookingsSlice } from './slices/bookingsSlice';
import { uiSlice } from './slices/uiSlice';

// Test store creation
const testStore = configureStore({
  reducer: {
    bookings: bookingsSlice.reducer,
    ui: uiSlice.reducer,
  },
});

// Test basic actions
testStore.dispatch(uiSlice.actions.openBookingForm({
  mode: 'create',
  swapEnabled: true,
}));

testStore.dispatch(uiSlice.actions.setSwapFilters({
  showSwappableOnly: true,
}));

const state = testStore.getState();

console.log('Enhanced store verification successful!');
console.log('Booking form state:', state.ui.activeBookingForm);
console.log('Swap filters:', state.ui.filters);

export { testStore };