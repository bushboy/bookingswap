/**
 * State management optimizations for separated booking and swap components
 * 
 * This module provides optimized selectors, middleware, and state management utilities
 * to reduce unnecessary re-renders and improve performance in separated interfaces.
 * 
 * Requirements addressed:
 * - 6.1: Intuitive navigation between booking editing and swap creation
 * - 6.2: Logical next steps after completing booking edits
 * - 6.3: Clear navigation back to booking management
 * - 6.4: Proper browser navigation handling
 * - 6.5: Deep linking support
 * - 6.6: Bookmark functionality
 * - 6.7: Appropriate URLs for sharing
 * - 6.8: Efficient navigation patterns for frequent context switching
 */

import { createSelector, createDraftSafeSelector } from '@reduxjs/toolkit';
import { RootState } from '@/store';
import { Booking, SwapPreferencesData } from '@booking-swap/shared';
import { bookingDataCache, createMemoizedSelector } from '@/utils/performanceOptimizations';

// Optimized selectors with memoization
export const selectBookingEditState = createDraftSafeSelector(
  (state: RootState) => state.bookingEdit,
  (bookingEdit) => bookingEdit
);

export const selectSwapSpecificationState = createDraftSafeSelector(
  (state: RootState) => state.swapSpecification,
  (swapSpecification) => swapSpecification
);

export const selectBookingsState = createDraftSafeSelector(
  (state: RootState) => state.bookings,
  (bookings) => bookings
);

// Memoized selector for booking edit form data
export const selectBookingEditFormData = createSelector(
  [selectBookingEditState],
  (bookingEdit) => ({
    formData: bookingEdit.formData,
    originalData: bookingEdit.originalData,
    hasUnsavedChanges: bookingEdit.hasUnsavedChanges,
    validationErrors: bookingEdit.validationErrors,
    isSubmitting: bookingEdit.isSubmitting,
  })
);

// Memoized selector for swap specification data
export const selectSwapSpecificationFormData = createSelector(
  [selectSwapSpecificationState],
  (swapSpec) => ({
    preferences: swapSpec.preferences,
    originalPreferences: swapSpec.originalPreferences,
    swapEnabled: swapSpec.swapEnabled,
    hasUnsavedChanges: swapSpec.hasUnsavedChanges,
    validationErrors: swapSpec.validationErrors,
    isSubmitting: swapSpec.isSubmitting,
  })
);

// Optimized selector for booking by ID with caching
export const selectBookingById = createMemoizedSelector(
  (state: RootState, bookingId: string) => {
    // Check cache first
    const cachedBooking = bookingDataCache.get(`booking-${bookingId}`);
    if (cachedBooking) {
      return cachedBooking;
    }

    // Fallback to state
    const booking = state.bookings.bookings.find(b => b.id === bookingId);
    if (booking) {
      // Cache the result
      bookingDataCache.set(`booking-${bookingId}`, booking);
    }
    return booking;
  },
  (a, b) => a?.id === b?.id && a?.updatedAt === b?.updatedAt
);

// Optimized selector for bookings list with filtering
export const selectFilteredBookings = createSelector(
  [
    selectBookingsState,
    (state: RootState, filters?: { type?: string; hasSwap?: boolean }) => filters,
  ],
  (bookingsState, filters) => {
    let bookings = bookingsState.bookings;

    if (filters?.type) {
      bookings = bookings.filter(b => b.type === filters.type);
    }

    if (filters?.hasSwap !== undefined) {
      bookings = bookings.filter(b => Boolean(b.swapInfo) === filters.hasSwap);
    }

    return {
      bookings,
      loading: bookingsState.loading,
      error: bookingsState.error,
    };
  }
);

// Selector for navigation state preservation
export const selectNavigationState = createSelector(
  [selectBookingEditState, selectSwapSpecificationState],
  (bookingEdit, swapSpec) => ({
    bookingEdit: {
      hasUnsavedChanges: bookingEdit.hasUnsavedChanges,
      preservedData: bookingEdit.preservedData,
    },
    swapSpecification: {
      hasUnsavedChanges: swapSpec.hasUnsavedChanges,
      preservedData: swapSpec.preservedData,
    },
  })
);

// Performance-optimized selector for UI state
export const selectUIOptimizations = createSelector(
  [(state: RootState) => state.ui],
  (ui) => ({
    theme: ui.theme,
    isMobile: ui.isMobile,
    isTablet: ui.isTablet,
    reducedMotion: ui.reducedMotion,
    highContrast: ui.highContrast,
  })
);

// Shallow equality comparison for objects
export const shallowEqual = <T extends Record<string, any>>(a: T, b: T): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      return false;
    }
  }

  return true;
};

// Custom hook for optimized state selection
export const useOptimizedSelector = <T>(
  selector: (state: RootState) => T,
  equalityFn: (a: T, b: T) => boolean = shallowEqual
) => {
  const memoizedSelector = createMemoizedSelector(selector, equalityFn);
  return memoizedSelector;
};

// State normalization utilities
export interface NormalizedState<T> {
  byId: Record<string, T>;
  allIds: string[];
}

export const normalizeBookings = (bookings: Booking[]): NormalizedState<Booking> => {
  const byId: Record<string, Booking> = {};
  const allIds: string[] = [];

  bookings.forEach(booking => {
    byId[booking.id] = booking;
    allIds.push(booking.id);
  });

  return { byId, allIds };
};

export const denormalizeBookings = (normalized: NormalizedState<Booking>): Booking[] => {
  return normalized.allIds.map(id => normalized.byId[id]);
};

// Batch update utilities for reducing re-renders
export interface BatchUpdate<T> {
  type: 'SET' | 'UPDATE' | 'DELETE';
  id: string;
  data?: Partial<T>;
}

export const createBatchUpdater = <T extends { id: string }>() => {
  let pendingUpdates: BatchUpdate<T>[] = [];
  let timeoutId: NodeJS.Timeout | null = null;

  const flush = (callback: (updates: BatchUpdate<T>[]) => void) => {
    if (pendingUpdates.length > 0) {
      callback([...pendingUpdates]);
      pendingUpdates = [];
    }
    timeoutId = null;
  };

  const addUpdate = (update: BatchUpdate<T>, callback: (updates: BatchUpdate<T>[]) => void) => {
    pendingUpdates.push(update);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => flush(callback), 16); // Next frame
  };

  return { addUpdate, flush: (callback: (updates: BatchUpdate<T>[]) => void) => flush(callback) };
};

// Memory-efficient state updates
export const createOptimizedReducer = <T extends Record<string, any>>(
  initialState: T,
  reducers: Record<string, (state: T, action: any) => T>
) => {
  return (state = initialState, action: any): T => {
    const reducer = reducers[action.type];
    if (!reducer) {
      return state;
    }

    const newState = reducer(state, action);

    // Only return new state if it actually changed
    if (shallowEqual(state, newState)) {
      return state;
    }

    return newState;
  };
};

// Debounced state updates for form inputs
export const createDebouncedUpdater = <T>(
  updateFn: (value: T) => void,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (value: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      updateFn(value);
      timeoutId = null;
    }, delay);
  };
};

// State persistence utilities
export interface StateSnapshot {
  timestamp: number;
  bookingEdit?: any;
  swapSpecification?: any;
}

export const createStateSnapshot = (state: RootState): StateSnapshot => ({
  timestamp: Date.now(),
  bookingEdit: state.bookingEdit.hasUnsavedChanges ? {
    formData: state.bookingEdit.formData,
    validationErrors: state.bookingEdit.validationErrors,
  } : undefined,
  swapSpecification: state.swapSpecification.hasUnsavedChanges ? {
    preferences: state.swapSpecification.preferences,
    swapEnabled: state.swapSpecification.swapEnabled,
    validationErrors: state.swapSpecification.validationErrors,
  } : undefined,
});

export const restoreStateSnapshot = (snapshot: StateSnapshot) => {
  // This would dispatch actions to restore the state
  return {
    type: 'RESTORE_STATE_SNAPSHOT',
    payload: snapshot,
  };
};

// Performance monitoring for state updates
export const stateUpdateMonitor = {
  updateCounts: new Map<string, number>(),

  trackUpdate: (actionType: string) => {
    const current = stateUpdateMonitor.updateCounts.get(actionType) || 0;
    stateUpdateMonitor.updateCounts.set(actionType, current + 1);
  },

  getUpdateStats: () => {
    const stats: Record<string, number> = {};
    stateUpdateMonitor.updateCounts.forEach((count, actionType) => {
      stats[actionType] = count;
    });
    return stats;
  },

  reset: () => {
    stateUpdateMonitor.updateCounts.clear();
  },
};

// Middleware for performance monitoring
export const performanceMiddleware = (store: any) => (next: any) => (action: any) => {
  const startTime = performance.now();

  // Track the update
  stateUpdateMonitor.trackUpdate(action.type);

  const result = next(action);

  const endTime = performance.now();
  const duration = endTime - startTime;

  // Log slow updates in development
  if (import.meta.env.DEV && duration > 16) {
    console.warn(`Slow state update detected: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

// Export optimized selectors and utilities
export const optimizedSelectors = {
  selectBookingEditFormData,
  selectSwapSpecificationFormData,
  selectBookingById,
  selectFilteredBookings,
  selectNavigationState,
  selectUIOptimizations,
};

export const stateOptimizations = {
  normalizeBookings,
  denormalizeBookings,
  createBatchUpdater,
  createOptimizedReducer,
  createDebouncedUpdater,
  createStateSnapshot,
  restoreStateSnapshot,
  stateUpdateMonitor,
  performanceMiddleware,
};