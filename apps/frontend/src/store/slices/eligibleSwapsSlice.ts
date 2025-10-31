import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  EligibleSwap,
  EligibleSwapsResponse,
  CompatibilityAnalysis,
} from '@booking-swap/shared';

// Eligible swaps state interface
interface EligibleSwapsState {
  // Current eligible swaps for proposal creation
  eligibleSwaps: EligibleSwap[];
  
  // Eligible swaps by target swap ID for caching
  eligibleSwapsByTarget: Record<string, EligibleSwap[]>;
  
  // Total count of eligible swaps
  totalCount: number;
  
  // Currently selected target swap ID
  currentTargetSwapId: string | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Filters for eligible swaps
  filters: {
    compatibilityThreshold?: number; // Minimum compatibility score (0-100)
    sortBy?: 'compatibility' | 'date' | 'value' | 'location';
    sortOrder?: 'asc' | 'desc';
    accommodationType?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
    valueRange?: {
      min: number;
      max: number;
    };
    guestCount?: {
      min: number;
      max: number;
    };
  };
  
  // Cache management
  lastFetchTime: Record<string, number>; // targetSwapId -> timestamp
  cacheExpiry: number; // 10 minutes
  
  // Real-time updates
  lastUpdateTime: number | null;
  
  // Selection state
  selectedSwapId: string | null;
  
  // Optimistic updates
  optimisticUpdates: {
    fetchingEligibleSwaps: string[]; // target swap IDs being fetched
    refreshingSwaps: string[]; // swap IDs being refreshed
  };
}

const initialState: EligibleSwapsState = {
  eligibleSwaps: [],
  eligibleSwapsByTarget: {},
  totalCount: 0,
  currentTargetSwapId: null,
  loading: false,
  error: null,
  filters: {
    compatibilityThreshold: 60, // Default minimum compatibility score
    sortBy: 'compatibility',
    sortOrder: 'desc',
  },
  lastFetchTime: {},
  cacheExpiry: 10 * 60 * 1000, // 10 minutes
  lastUpdateTime: null,
  selectedSwapId: null,
  optimisticUpdates: {
    fetchingEligibleSwaps: [],
    refreshingSwaps: [],
  },
};

export const eligibleSwapsSlice = createSlice({
  name: 'eligibleSwaps',
  initialState,
  reducers: {
    // Loading and error states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },

    // Target swap management
    setCurrentTargetSwap: (state, action: PayloadAction<string | null>) => {
      state.currentTargetSwapId = action.payload;
      
      // Load cached eligible swaps if available
      if (action.payload && state.eligibleSwapsByTarget[action.payload]) {
        state.eligibleSwaps = state.eligibleSwapsByTarget[action.payload];
        state.totalCount = state.eligibleSwaps.length;
      } else {
        state.eligibleSwaps = [];
        state.totalCount = 0;
      }
      
      // Clear selection when target changes
      state.selectedSwapId = null;
    },

    // Eligible swaps data management
    setEligibleSwaps: (state, action: PayloadAction<EligibleSwapsResponse & { targetSwapId: string }>) => {
      const { eligibleSwaps, totalCount, targetSwapId } = action.payload;
      
      // Apply current filters and sorting
      const filteredAndSorted = applyFiltersAndSorting(eligibleSwaps, state.filters);
      
      state.eligibleSwaps = filteredAndSorted;
      state.totalCount = totalCount;
      state.currentTargetSwapId = targetSwapId;
      
      // Cache the results
      state.eligibleSwapsByTarget[targetSwapId] = eligibleSwaps;
      state.lastFetchTime[targetSwapId] = Date.now();
      
      state.loading = false;
      state.error = null;
      state.lastUpdateTime = Date.now();
    },
    addEligibleSwap: (state, action: PayloadAction<{ targetSwapId: string; swap: EligibleSwap }>) => {
      const { targetSwapId, swap } = action.payload;
      
      // Add to cache
      if (!state.eligibleSwapsByTarget[targetSwapId]) {
        state.eligibleSwapsByTarget[targetSwapId] = [];
      }
      
      const existingIndex = state.eligibleSwapsByTarget[targetSwapId].findIndex(s => s.id === swap.id);
      if (existingIndex === -1) {
        state.eligibleSwapsByTarget[targetSwapId].unshift(swap);
      } else {
        state.eligibleSwapsByTarget[targetSwapId][existingIndex] = swap;
      }
      
      // Update current eligible swaps if this is the current target
      if (state.currentTargetSwapId === targetSwapId) {
        const currentIndex = state.eligibleSwaps.findIndex(s => s.id === swap.id);
        if (currentIndex === -1) {
          state.eligibleSwaps.unshift(swap);
          state.totalCount += 1;
        } else {
          state.eligibleSwaps[currentIndex] = swap;
        }
        
        // Re-apply filters and sorting
        state.eligibleSwaps = applyFiltersAndSorting(state.eligibleSwaps, state.filters);
      }
    },
    updateEligibleSwap: (state, action: PayloadAction<EligibleSwap>) => {
      const swap = action.payload;
      
      // Update in all cached results
      Object.keys(state.eligibleSwapsByTarget).forEach(targetSwapId => {
        const swaps = state.eligibleSwapsByTarget[targetSwapId];
        const index = swaps.findIndex(s => s.id === swap.id);
        if (index !== -1) {
          swaps[index] = swap;
        }
      });
      
      // Update in current eligible swaps
      const currentIndex = state.eligibleSwaps.findIndex(s => s.id === swap.id);
      if (currentIndex !== -1) {
        state.eligibleSwaps[currentIndex] = swap;
        
        // Re-apply filters and sorting
        state.eligibleSwaps = applyFiltersAndSorting(state.eligibleSwaps, state.filters);
      }
      
      state.lastUpdateTime = Date.now();
    },
    removeEligibleSwap: (state, action: PayloadAction<string>) => {
      const swapId = action.payload;
      
      // Remove from all cached results
      Object.keys(state.eligibleSwapsByTarget).forEach(targetSwapId => {
        state.eligibleSwapsByTarget[targetSwapId] = state.eligibleSwapsByTarget[targetSwapId].filter(
          s => s.id !== swapId
        );
      });
      
      // Remove from current eligible swaps
      const wasSelected = state.selectedSwapId === swapId;
      state.eligibleSwaps = state.eligibleSwaps.filter(s => s.id !== swapId);
      state.totalCount = Math.max(0, state.totalCount - 1);
      
      // Clear selection if the removed swap was selected
      if (wasSelected) {
        state.selectedSwapId = null;
      }
    },

    // Selection management
    selectEligibleSwap: (state, action: PayloadAction<string | null>) => {
      state.selectedSwapId = action.payload;
    },

    // Filter management
    setEligibleSwapsFilters: (state, action: PayloadAction<Partial<EligibleSwapsState['filters']>>) => {
      state.filters = { ...state.filters, ...action.payload };
      
      // Re-apply filters to current eligible swaps
      if (state.currentTargetSwapId && state.eligibleSwapsByTarget[state.currentTargetSwapId]) {
        const originalSwaps = state.eligibleSwapsByTarget[state.currentTargetSwapId];
        state.eligibleSwaps = applyFiltersAndSorting(originalSwaps, state.filters);
      }
    },
    clearEligibleSwapsFilters: (state) => {
      state.filters = {
        compatibilityThreshold: 60,
        sortBy: 'compatibility',
        sortOrder: 'desc',
      };
      
      // Re-apply filters to current eligible swaps
      if (state.currentTargetSwapId && state.eligibleSwapsByTarget[state.currentTargetSwapId]) {
        const originalSwaps = state.eligibleSwapsByTarget[state.currentTargetSwapId];
        state.eligibleSwaps = applyFiltersAndSorting(originalSwaps, state.filters);
      }
    },

    // Cache management
    invalidateEligibleSwapsCache: (state, action: PayloadAction<string | undefined>) => {
      if (action.payload) {
        // Invalidate specific target swap cache
        delete state.lastFetchTime[action.payload];
        delete state.eligibleSwapsByTarget[action.payload];
        
        if (state.currentTargetSwapId === action.payload) {
          state.eligibleSwaps = [];
          state.totalCount = 0;
        }
      } else {
        // Invalidate all cache
        state.lastFetchTime = {};
        state.eligibleSwapsByTarget = {};
        state.eligibleSwaps = [];
        state.totalCount = 0;
      }
    },

    // Real-time updates
    updateLastUpdateTime: (state) => {
      state.lastUpdateTime = Date.now();
    },

    // Optimistic updates
    startFetchingEligibleSwaps: (state, action: PayloadAction<string>) => {
      const targetSwapId = action.payload;
      state.optimisticUpdates.fetchingEligibleSwaps.push(targetSwapId);
      state.loading = true;
    },
    completeFetchingEligibleSwaps: (state, action: PayloadAction<string>) => {
      const targetSwapId = action.payload;
      state.optimisticUpdates.fetchingEligibleSwaps = state.optimisticUpdates.fetchingEligibleSwaps.filter(
        id => id !== targetSwapId
      );
    },
    startRefreshingSwap: (state, action: PayloadAction<string>) => {
      const swapId = action.payload;
      state.optimisticUpdates.refreshingSwaps.push(swapId);
    },
    completeRefreshingSwap: (state, action: PayloadAction<string>) => {
      const swapId = action.payload;
      state.optimisticUpdates.refreshingSwaps = state.optimisticUpdates.refreshingSwaps.filter(
        id => id !== swapId
      );
    },

    // Reset state
    resetEligibleSwapsState: (state) => {
      Object.assign(state, initialState);
    },

    // Batch operations
    updateMultipleEligibleSwaps: (state, action: PayloadAction<EligibleSwap[]>) => {
      action.payload.forEach(swap => {
        // Update in all cached results
        Object.keys(state.eligibleSwapsByTarget).forEach(targetSwapId => {
          const swaps = state.eligibleSwapsByTarget[targetSwapId];
          const index = swaps.findIndex(s => s.id === swap.id);
          if (index !== -1) {
            swaps[index] = swap;
          }
        });
        
        // Update in current eligible swaps
        const currentIndex = state.eligibleSwaps.findIndex(s => s.id === swap.id);
        if (currentIndex !== -1) {
          state.eligibleSwaps[currentIndex] = swap;
        }
      });
      
      // Re-apply filters and sorting to current eligible swaps
      state.eligibleSwaps = applyFiltersAndSorting(state.eligibleSwaps, state.filters);
      state.lastUpdateTime = Date.now();
    },
  },
});

// Helper function to apply filters and sorting
function applyFiltersAndSorting(
  swaps: EligibleSwap[],
  filters: EligibleSwapsState['filters']
): EligibleSwap[] {
  let filtered = [...swaps];

  // Apply compatibility threshold filter
  if (filters.compatibilityThreshold !== undefined) {
    filtered = filtered.filter(swap => 
      (swap.compatibilityScore || 0) >= filters.compatibilityThreshold!
    );
  }

  // Apply accommodation type filter
  if (filters.accommodationType && filters.accommodationType.length > 0) {
    filtered = filtered.filter(swap =>
      filters.accommodationType!.includes(swap.bookingDetails.accommodationType)
    );
  }

  // Apply date range filter
  if (filters.dateRange) {
    filtered = filtered.filter(swap => {
      const swapStart = new Date(swap.bookingDetails.dateRange.checkIn);
      const swapEnd = new Date(swap.bookingDetails.dateRange.checkOut);
      const filterStart = filters.dateRange!.start;
      const filterEnd = filters.dateRange!.end;
      
      // Check for date overlap
      return swapStart <= filterEnd && swapEnd >= filterStart;
    });
  }

  // Apply value range filter
  if (filters.valueRange) {
    filtered = filtered.filter(swap => {
      const value = swap.bookingDetails.estimatedValue;
      return (!filters.valueRange!.min || value >= filters.valueRange!.min) &&
             (!filters.valueRange!.max || value <= filters.valueRange!.max);
    });
  }

  // Apply guest count filter
  if (filters.guestCount) {
    filtered = filtered.filter(swap => {
      const guests = swap.bookingDetails.guests;
      return (!filters.guestCount!.min || guests >= filters.guestCount!.min) &&
             (!filters.guestCount!.max || guests <= filters.guestCount!.max);
    });
  }

  // Apply sorting
  if (filters.sortBy) {
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (filters.sortBy) {
        case 'compatibility':
          aValue = a.compatibilityScore || 0;
          bValue = b.compatibilityScore || 0;
          break;
        case 'date':
          aValue = new Date(a.bookingDetails.dateRange.checkIn);
          bValue = new Date(b.bookingDetails.dateRange.checkIn);
          break;
        case 'value':
          aValue = a.bookingDetails.estimatedValue;
          bValue = b.bookingDetails.estimatedValue;
          break;
        case 'location':
          aValue = a.bookingDetails.location;
          bValue = b.bookingDetails.location;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return filters.sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return filters.sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  return filtered;
}

export const {
  // Loading and error states
  setLoading,
  setError,

  // Target swap management
  setCurrentTargetSwap,

  // Eligible swaps data management
  setEligibleSwaps,
  addEligibleSwap,
  updateEligibleSwap,
  removeEligibleSwap,
  updateMultipleEligibleSwaps,

  // Selection management
  selectEligibleSwap,

  // Filter management
  setEligibleSwapsFilters,
  clearEligibleSwapsFilters,

  // Cache management
  invalidateEligibleSwapsCache,

  // Real-time updates
  updateLastUpdateTime,

  // Optimistic updates
  startFetchingEligibleSwaps,
  completeFetchingEligibleSwaps,
  startRefreshingSwap,
  completeRefreshingSwap,

  // Reset state
  resetEligibleSwapsState,
} = eligibleSwapsSlice.actions;

// Selectors
export const selectEligibleSwaps = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.eligibleSwaps;
export const selectEligibleSwapsTotalCount = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.totalCount;
export const selectCurrentTargetSwapId = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.currentTargetSwapId;
export const selectSelectedSwapId = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.selectedSwapId;
export const selectEligibleSwapsLoading = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.loading;
export const selectEligibleSwapsError = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.error;
export const selectEligibleSwapsFilters = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.filters;
export const selectEligibleSwapsOptimisticUpdates = (state: { eligibleSwaps: EligibleSwapsState }) => 
  state.eligibleSwaps.optimisticUpdates;

// Computed selectors
export const selectEligibleSwapById = (state: { eligibleSwaps: EligibleSwapsState }, id: string) =>
  state.eligibleSwaps.eligibleSwaps.find(swap => swap.id === id);

export const selectSelectedEligibleSwap = (state: { eligibleSwaps: EligibleSwapsState }) => {
  if (!state.eligibleSwaps.selectedSwapId) return null;
  return state.eligibleSwaps.eligibleSwaps.find(swap => swap.id === state.eligibleSwaps.selectedSwapId);
};

export const selectEligibleSwapsForTarget = (
  state: { eligibleSwaps: EligibleSwapsState },
  targetSwapId: string
) => state.eligibleSwaps.eligibleSwapsByTarget[targetSwapId] || [];

export const selectIsEligibleSwapsCacheValid = (
  state: { eligibleSwaps: EligibleSwapsState },
  targetSwapId: string
) => {
  const lastFetchTime = state.eligibleSwaps.lastFetchTime[targetSwapId];
  if (!lastFetchTime) return false;
  return Date.now() - lastFetchTime < state.eligibleSwaps.cacheExpiry;
};

export const selectCompatibleEligibleSwaps = (
  state: { eligibleSwaps: EligibleSwapsState },
  minScore: number = 60
) => state.eligibleSwaps.eligibleSwaps.filter(swap => 
  (swap.compatibilityScore || 0) >= minScore
);

export const selectEligibleSwapsByCompatibility = (state: { eligibleSwaps: EligibleSwapsState }) => {
  const swaps = [...state.eligibleSwaps.eligibleSwaps];
  return swaps.sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));
};

export const selectEligibleSwapsStatistics = (state: { eligibleSwaps: EligibleSwapsState }) => {
  const swaps = state.eligibleSwaps.eligibleSwaps;
  const total = swaps.length;
  const compatible = swaps.filter(s => s.isCompatible).length;
  const highCompatibility = swaps.filter(s => (s.compatibilityScore || 0) >= 80).length;
  const mediumCompatibility = swaps.filter(s => {
    const score = s.compatibilityScore || 0;
    return score >= 60 && score < 80;
  }).length;
  const lowCompatibility = swaps.filter(s => (s.compatibilityScore || 0) < 60).length;

  const averageCompatibility = total > 0 
    ? swaps.reduce((sum, swap) => sum + (swap.compatibilityScore || 0), 0) / total 
    : 0;

  return {
    total,
    compatible,
    highCompatibility,
    mediumCompatibility,
    lowCompatibility,
    averageCompatibility,
    compatibilityRate: total > 0 ? (compatible / total) * 100 : 0,
  };
};

export const selectIsFetchingEligibleSwaps = (
  state: { eligibleSwaps: EligibleSwapsState },
  targetSwapId: string
) => state.eligibleSwaps.optimisticUpdates.fetchingEligibleSwaps.includes(targetSwapId);

export const selectIsRefreshingSwap = (
  state: { eligibleSwaps: EligibleSwapsState },
  swapId: string
) => state.eligibleSwaps.optimisticUpdates.refreshingSwaps.includes(swapId);