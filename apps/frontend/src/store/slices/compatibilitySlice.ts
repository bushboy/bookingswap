import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CompatibilityAnalysis,
  CompatibilityResponse,
  CompatibilityFactor,
} from '@booking-swap/shared';

// Compatibility analysis state interface
interface CompatibilityState {
  // Current compatibility analysis results
  currentAnalysis: CompatibilityAnalysis | null;
  
  // Compatibility analyses by swap pair for caching
  analysesByPair: Record<string, CompatibilityAnalysis>; // "sourceId-targetId" -> analysis
  
  // Currently analyzing swap pair
  currentSwapPair: {
    sourceSwapId: string;
    targetSwapId: string;
  } | null;
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Analysis history for debugging and insights
  analysisHistory: Array<{
    sourceSwapId: string;
    targetSwapId: string;
    analysis: CompatibilityAnalysis;
    timestamp: Date;
  }>;
  
  // Cache management
  lastFetchTime: Record<string, number>; // swap pair key -> timestamp
  cacheExpiry: number; // 15 minutes
  
  // Real-time updates
  lastUpdateTime: number | null;
  
  // Analysis settings
  settings: {
    weightings: {
      location: number;
      date: number;
      value: number;
      accommodation: number;
      guest: number;
    };
    thresholds: {
      excellent: number; // >= 90
      good: number; // >= 70
      fair: number; // >= 50
      poor: number; // < 50
    };
    autoRefresh: boolean;
    refreshInterval: number; // minutes
  };
  
  // Batch analysis state
  batchAnalysis: {
    isRunning: boolean;
    progress: number; // 0-100
    total: number;
    completed: number;
    results: Record<string, CompatibilityAnalysis>;
    errors: Array<{
      swapPair: string;
      error: string;
    }>;
  };
  
  // Optimistic updates
  optimisticUpdates: {
    analyzingPairs: string[]; // swap pair keys being analyzed
    refreshingAnalyses: string[]; // analysis keys being refreshed
  };
}

const initialState: CompatibilityState = {
  currentAnalysis: null,
  analysesByPair: {},
  currentSwapPair: null,
  loading: false,
  error: null,
  analysisHistory: [],
  lastFetchTime: {},
  cacheExpiry: 15 * 60 * 1000, // 15 minutes
  lastUpdateTime: null,
  settings: {
    weightings: {
      location: 0.25,
      date: 0.25,
      value: 0.20,
      accommodation: 0.15,
      guest: 0.15,
    },
    thresholds: {
      excellent: 90,
      good: 70,
      fair: 50,
      poor: 0,
    },
    autoRefresh: false,
    refreshInterval: 30, // 30 minutes
  },
  batchAnalysis: {
    isRunning: false,
    progress: 0,
    total: 0,
    completed: 0,
    results: {},
    errors: [],
  },
  optimisticUpdates: {
    analyzingPairs: [],
    refreshingAnalyses: [],
  },
};

export const compatibilitySlice = createSlice({
  name: 'compatibility',
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

    // Current swap pair management
    setCurrentSwapPair: (state, action: PayloadAction<{ sourceSwapId: string; targetSwapId: string } | null>) => {
      state.currentSwapPair = action.payload;
      
      if (action.payload) {
        const pairKey = `${action.payload.sourceSwapId}-${action.payload.targetSwapId}`;
        
        // Load cached analysis if available
        if (state.analysesByPair[pairKey]) {
          state.currentAnalysis = state.analysesByPair[pairKey];
        } else {
          state.currentAnalysis = null;
        }
      } else {
        state.currentAnalysis = null;
      }
    },

    // Compatibility analysis data management
    setCompatibilityAnalysis: (state, action: PayloadAction<{
      sourceSwapId: string;
      targetSwapId: string;
      analysis: CompatibilityAnalysis;
    }>) => {
      const { sourceSwapId, targetSwapId, analysis } = action.payload;
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      
      // Store the analysis
      state.analysesByPair[pairKey] = analysis;
      state.lastFetchTime[pairKey] = Date.now();
      
      // Update current analysis if this is the current pair
      if (state.currentSwapPair?.sourceSwapId === sourceSwapId && 
          state.currentSwapPair?.targetSwapId === targetSwapId) {
        state.currentAnalysis = analysis;
      }
      
      // Add to history
      state.analysisHistory.unshift({
        sourceSwapId,
        targetSwapId,
        analysis,
        timestamp: new Date(),
      });
      
      // Keep history to a reasonable size (last 100 analyses)
      if (state.analysisHistory.length > 100) {
        state.analysisHistory = state.analysisHistory.slice(0, 100);
      }
      
      state.loading = false;
      state.error = null;
      state.lastUpdateTime = Date.now();
    },
    updateCompatibilityAnalysis: (state, action: PayloadAction<{
      sourceSwapId: string;
      targetSwapId: string;
      updates: Partial<CompatibilityAnalysis>;
    }>) => {
      const { sourceSwapId, targetSwapId, updates } = action.payload;
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      
      if (state.analysesByPair[pairKey]) {
        state.analysesByPair[pairKey] = {
          ...state.analysesByPair[pairKey],
          ...updates,
        };
        
        // Update current analysis if this is the current pair
        if (state.currentSwapPair?.sourceSwapId === sourceSwapId && 
            state.currentSwapPair?.targetSwapId === targetSwapId) {
          state.currentAnalysis = {
            ...state.currentAnalysis!,
            ...updates,
          };
        }
        
        state.lastUpdateTime = Date.now();
      }
    },
    removeCompatibilityAnalysis: (state, action: PayloadAction<{
      sourceSwapId: string;
      targetSwapId: string;
    }>) => {
      const { sourceSwapId, targetSwapId } = action.payload;
      const pairKey = `${sourceSwapId}-${targetSwapId}`;
      
      // Remove from cache
      delete state.analysesByPair[pairKey];
      delete state.lastFetchTime[pairKey];
      
      // Clear current analysis if this is the current pair
      if (state.currentSwapPair?.sourceSwapId === sourceSwapId && 
          state.currentSwapPair?.targetSwapId === targetSwapId) {
        state.currentAnalysis = null;
      }
      
      // Remove from history
      state.analysisHistory = state.analysisHistory.filter(
        item => !(item.sourceSwapId === sourceSwapId && item.targetSwapId === targetSwapId)
      );
    },

    // Settings management
    updateCompatibilitySettings: (state, action: PayloadAction<Partial<CompatibilityState['settings']>>) => {
      state.settings = {
        ...state.settings,
        ...action.payload,
      };
      
      // If weightings changed, recalculate all cached analyses
      if (action.payload.weightings) {
        Object.keys(state.analysesByPair).forEach(pairKey => {
          const analysis = state.analysesByPair[pairKey];
          const newOverallScore = calculateOverallScore(analysis.factors, state.settings.weightings);
          state.analysesByPair[pairKey] = {
            ...analysis,
            overallScore: newOverallScore,
          };
        });
        
        // Update current analysis
        if (state.currentAnalysis) {
          const newOverallScore = calculateOverallScore(state.currentAnalysis.factors, state.settings.weightings);
          state.currentAnalysis = {
            ...state.currentAnalysis,
            overallScore: newOverallScore,
          };
        }
      }
    },
    resetCompatibilitySettings: (state) => {
      state.settings = initialState.settings;
    },

    // Batch analysis management
    startBatchAnalysis: (state, action: PayloadAction<{ total: number }>) => {
      state.batchAnalysis = {
        isRunning: true,
        progress: 0,
        total: action.payload.total,
        completed: 0,
        results: {},
        errors: [],
      };
    },
    updateBatchAnalysisProgress: (state, action: PayloadAction<{
      completed: number;
      pairKey?: string;
      analysis?: CompatibilityAnalysis;
      error?: string;
    }>) => {
      const { completed, pairKey, analysis, error } = action.payload;
      
      state.batchAnalysis.completed = completed;
      state.batchAnalysis.progress = (completed / state.batchAnalysis.total) * 100;
      
      if (pairKey && analysis) {
        state.batchAnalysis.results[pairKey] = analysis;
        
        // Also store in main cache
        state.analysesByPair[pairKey] = analysis;
        state.lastFetchTime[pairKey] = Date.now();
      }
      
      if (pairKey && error) {
        state.batchAnalysis.errors.push({
          swapPair: pairKey,
          error,
        });
      }
    },
    completeBatchAnalysis: (state) => {
      // Move results to main cache (already done in updateBatchAnalysisProgress)
      state.batchAnalysis.isRunning = false;
      state.lastUpdateTime = Date.now();
    },
    cancelBatchAnalysis: (state) => {
      state.batchAnalysis = {
        isRunning: false,
        progress: 0,
        total: 0,
        completed: 0,
        results: {},
        errors: [],
      };
    },

    // Cache management
    invalidateCompatibilityCache: (state, action: PayloadAction<string | undefined>) => {
      if (action.payload) {
        // Invalidate specific pair cache
        delete state.lastFetchTime[action.payload];
        delete state.analysesByPair[action.payload];
        
        // Clear current analysis if it matches
        const [sourceId, targetId] = action.payload.split('-');
        if (state.currentSwapPair?.sourceSwapId === sourceId && 
            state.currentSwapPair?.targetSwapId === targetId) {
          state.currentAnalysis = null;
        }
      } else {
        // Invalidate all cache
        state.lastFetchTime = {};
        state.analysesByPair = {};
        state.currentAnalysis = null;
        state.analysisHistory = [];
      }
    },

    // Real-time updates
    updateLastUpdateTime: (state) => {
      state.lastUpdateTime = Date.now();
    },

    // Optimistic updates
    startAnalyzingPair: (state, action: PayloadAction<string>) => {
      const pairKey = action.payload;
      state.optimisticUpdates.analyzingPairs.push(pairKey);
      state.loading = true;
    },
    completeAnalyzingPair: (state, action: PayloadAction<string>) => {
      const pairKey = action.payload;
      state.optimisticUpdates.analyzingPairs = state.optimisticUpdates.analyzingPairs.filter(
        key => key !== pairKey
      );
    },
    startRefreshingAnalysis: (state, action: PayloadAction<string>) => {
      const pairKey = action.payload;
      state.optimisticUpdates.refreshingAnalyses.push(pairKey);
    },
    completeRefreshingAnalysis: (state, action: PayloadAction<string>) => {
      const pairKey = action.payload;
      state.optimisticUpdates.refreshingAnalyses = state.optimisticUpdates.refreshingAnalyses.filter(
        key => key !== pairKey
      );
    },

    // Reset state
    resetCompatibilityState: (state) => {
      Object.assign(state, initialState);
    },

    // Bulk operations
    setBulkCompatibilityAnalyses: (state, action: PayloadAction<Array<{
      sourceSwapId: string;
      targetSwapId: string;
      analysis: CompatibilityAnalysis;
    }>>) => {
      const timestamp = Date.now();
      
      action.payload.forEach(({ sourceSwapId, targetSwapId, analysis }) => {
        const pairKey = `${sourceSwapId}-${targetSwapId}`;
        state.analysesByPair[pairKey] = analysis;
        state.lastFetchTime[pairKey] = timestamp;
        
        // Add to history
        state.analysisHistory.unshift({
          sourceSwapId,
          targetSwapId,
          analysis,
          timestamp: new Date(),
        });
      });
      
      // Keep history to a reasonable size
      if (state.analysisHistory.length > 100) {
        state.analysisHistory = state.analysisHistory.slice(0, 100);
      }
      
      state.lastUpdateTime = timestamp;
    },
  },
});

// Helper function to calculate overall score based on weightings
function calculateOverallScore(
  factors: CompatibilityAnalysis['factors'],
  weightings: CompatibilityState['settings']['weightings']
): number {
  const weightedSum = 
    factors.locationCompatibility.score * weightings.location +
    factors.dateCompatibility.score * weightings.date +
    factors.valueCompatibility.score * weightings.value +
    factors.accommodationCompatibility.score * weightings.accommodation +
    factors.guestCompatibility.score * weightings.guest;
  
  return Math.round(weightedSum);
}

export const {
  // Loading and error states
  setLoading,
  setError,

  // Current swap pair management
  setCurrentSwapPair,

  // Compatibility analysis data management
  setCompatibilityAnalysis,
  updateCompatibilityAnalysis,
  removeCompatibilityAnalysis,
  setBulkCompatibilityAnalyses,

  // Settings management
  updateCompatibilitySettings,
  resetCompatibilitySettings,

  // Batch analysis management
  startBatchAnalysis,
  updateBatchAnalysisProgress,
  completeBatchAnalysis,
  cancelBatchAnalysis,

  // Cache management
  invalidateCompatibilityCache,

  // Real-time updates
  updateLastUpdateTime,

  // Optimistic updates
  startAnalyzingPair,
  completeAnalyzingPair,
  startRefreshingAnalysis,
  completeRefreshingAnalysis,

  // Reset state
  resetCompatibilityState,
} = compatibilitySlice.actions;

// Selectors
export const selectCurrentCompatibilityAnalysis = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.currentAnalysis;
export const selectCurrentSwapPair = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.currentSwapPair;
export const selectCompatibilityLoading = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.loading;
export const selectCompatibilityError = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.error;
export const selectCompatibilitySettings = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.settings;
export const selectBatchAnalysisState = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.batchAnalysis;
export const selectCompatibilityOptimisticUpdates = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.optimisticUpdates;
export const selectAnalysisHistory = (state: { compatibility: CompatibilityState }) => 
  state.compatibility.analysisHistory;

// Computed selectors
export const selectCompatibilityAnalysisForPair = (
  state: { compatibility: CompatibilityState },
  sourceSwapId: string,
  targetSwapId: string
) => {
  const pairKey = `${sourceSwapId}-${targetSwapId}`;
  return state.compatibility.analysesByPair[pairKey] || null;
};

export const selectIsCompatibilityCacheValid = (
  state: { compatibility: CompatibilityState },
  sourceSwapId: string,
  targetSwapId: string
) => {
  const pairKey = `${sourceSwapId}-${targetSwapId}`;
  const lastFetchTime = state.compatibility.lastFetchTime[pairKey];
  if (!lastFetchTime) return false;
  return Date.now() - lastFetchTime < state.compatibility.cacheExpiry;
};

export const selectCompatibilityAnalysesByScore = (
  state: { compatibility: CompatibilityState },
  minScore: number = 0
) => {
  return Object.entries(state.compatibility.analysesByPair)
    .filter(([_, analysis]) => analysis.overallScore >= minScore)
    .map(([pairKey, analysis]) => {
      const [sourceSwapId, targetSwapId] = pairKey.split('-');
      return {
        sourceSwapId,
        targetSwapId,
        analysis,
        pairKey,
      };
    })
    .sort((a, b) => b.analysis.overallScore - a.analysis.overallScore);
};

export const selectCompatibilityStatistics = (state: { compatibility: CompatibilityState }) => {
  const analyses = Object.values(state.compatibility.analysesByPair);
  const total = analyses.length;
  
  if (total === 0) {
    return {
      total: 0,
      averageScore: 0,
      excellent: 0,
      good: 0,
      fair: 0,
      poor: 0,
      excellentRate: 0,
      goodRate: 0,
      fairRate: 0,
      poorRate: 0,
    };
  }
  
  const { thresholds } = state.compatibility.settings;
  const excellent = analyses.filter(a => a.overallScore >= thresholds.excellent).length;
  const good = analyses.filter(a => a.overallScore >= thresholds.good && a.overallScore < thresholds.excellent).length;
  const fair = analyses.filter(a => a.overallScore >= thresholds.fair && a.overallScore < thresholds.good).length;
  const poor = analyses.filter(a => a.overallScore < thresholds.fair).length;
  
  const averageScore = analyses.reduce((sum, analysis) => sum + analysis.overallScore, 0) / total;
  
  return {
    total,
    averageScore,
    excellent,
    good,
    fair,
    poor,
    excellentRate: (excellent / total) * 100,
    goodRate: (good / total) * 100,
    fairRate: (fair / total) * 100,
    poorRate: (poor / total) * 100,
  };
};

export const selectRecentCompatibilityAnalyses = (
  state: { compatibility: CompatibilityState },
  limit: number = 10
) => {
  return state.compatibility.analysisHistory
    .slice(0, limit)
    .map(item => ({
      ...item,
      pairKey: `${item.sourceSwapId}-${item.targetSwapId}`,
    }));
};

export const selectIsAnalyzingPair = (
  state: { compatibility: CompatibilityState },
  sourceSwapId: string,
  targetSwapId: string
) => {
  const pairKey = `${sourceSwapId}-${targetSwapId}`;
  return state.compatibility.optimisticUpdates.analyzingPairs.includes(pairKey);
};

export const selectIsRefreshingAnalysis = (
  state: { compatibility: CompatibilityState },
  sourceSwapId: string,
  targetSwapId: string
) => {
  const pairKey = `${sourceSwapId}-${targetSwapId}`;
  return state.compatibility.optimisticUpdates.refreshingAnalyses.includes(pairKey);
};

export const selectCompatibilityFactorBreakdown = (state: { compatibility: CompatibilityState }) => {
  const analyses = Object.values(state.compatibility.analysesByPair);
  
  if (analyses.length === 0) {
    return {
      location: { average: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } },
      date: { average: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } },
      value: { average: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } },
      accommodation: { average: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } },
      guest: { average: 0, distribution: { excellent: 0, good: 0, fair: 0, poor: 0 } },
    };
  }
  
  const { thresholds } = state.compatibility.settings;
  
  const calculateFactorStats = (factorName: keyof CompatibilityAnalysis['factors']) => {
    const scores = analyses.map(a => a.factors[factorName].score);
    const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    const distribution = {
      excellent: scores.filter(s => s >= thresholds.excellent).length,
      good: scores.filter(s => s >= thresholds.good && s < thresholds.excellent).length,
      fair: scores.filter(s => s >= thresholds.fair && s < thresholds.good).length,
      poor: scores.filter(s => s < thresholds.fair).length,
    };
    
    return { average, distribution };
  };
  
  return {
    location: calculateFactorStats('locationCompatibility'),
    date: calculateFactorStats('dateCompatibility'),
    value: calculateFactorStats('valueCompatibility'),
    accommodation: calculateFactorStats('accommodationCompatibility'),
    guest: calculateFactorStats('guestCompatibility'),
  };
};