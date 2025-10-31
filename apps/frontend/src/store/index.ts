import { configureStore } from '@reduxjs/toolkit';
import { authSlice } from './slices/authSlice';
import { bookingsSlice } from './slices/bookingsSlice';
import { bookingEditSlice } from './slices/bookingEditSlice';
import { swapSpecificationSlice } from './slices/swapSpecificationSlice';
import { swapsSlice } from './slices/swapsSlice';
import { auctionSlice } from './slices/auctionSlice';
import { uiSlice } from './slices/uiSlice';
import { dashboardSlice } from './slices/dashboardSlice';
import { walletSlice } from './slices/walletSlice';
import { proposalSlice } from './slices/proposalSlice';
import { proposalAcceptanceSlice } from './slices/proposalAcceptanceSlice';
import { eligibleSwapsSlice } from './slices/eligibleSwapsSlice';
import { compatibilitySlice } from './slices/compatibilitySlice';
import targetingReducer from './slices/targetingSlice';
import notificationReducer from './slices/notificationSlice';
import { performanceMiddleware } from './optimizations/stateOptimizations';
import { proposalWebSocketMiddleware } from './middleware/proposalWebSocketMiddleware';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    bookings: bookingsSlice.reducer,
    bookingEdit: bookingEditSlice.reducer,
    swapSpecification: swapSpecificationSlice.reducer,
    swaps: swapsSlice.reducer,
    auctions: auctionSlice.reducer,
    ui: uiSlice.reducer,
    dashboard: dashboardSlice.reducer,
    wallet: walletSlice.reducer,
    proposals: proposalSlice.reducer,
    proposalAcceptance: proposalAcceptanceSlice.reducer,
    eligibleSwaps: eligibleSwapsSlice.reducer,
    compatibility: compatibilitySlice.reducer,
    targeting: targetingReducer,
    notifications: notificationReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(performanceMiddleware, proposalWebSocketMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export enhanced thunks
export * from './thunks/unifiedBookingThunks';
export * from './thunks/bookingEditThunks';
export * from './thunks/swapSpecificationThunks';
export * from './thunks/combinedBookingSwapThunks';
export * from './thunks/proposalThunks';
export * from './thunks/proposalAcceptanceThunks';
export * from './thunks/targetingThunks';

// Export enhanced selectors
export * from './selectors/enhancedBookingSelectors';
export * from './selectors/separatedBookingSelectors';
export * from './selectors/proposalSelectors';
export * from './selectors/proposalAcceptanceSelectors';
