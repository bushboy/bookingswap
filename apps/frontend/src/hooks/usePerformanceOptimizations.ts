/**
 * Performance optimization hooks for separated booking and swap components
 * 
 * This module provides React hooks for performance monitoring, optimization,
 * and intelligent loading strategies for the separated interfaces.
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

import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import {
  performanceMonitor,
  PerformanceReport,
  generatePerformanceReport,
  getMemoryUsage
} from '@/utils/performanceOptimizations';
import {
  bookingCacheManager,
  useBookingCache,
  useNavigationCache,
  NavigationState
} from '@/utils/bookingDataCache';
import { intelligentPreload } from '@/router/lazyComponents';

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const trackingIdRef = useRef<string | null>(null);
  const mountTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Start tracking on mount
    trackingIdRef.current = performanceMonitor.startTracking(componentName, 'initial');

    return () => {
      // End tracking on unmount
      if (trackingIdRef.current) {
        performanceMonitor.endTracking(componentName, trackingIdRef.current);
      }
    };
  }, [componentName]);

  const trackAction = useCallback((actionName: string) => {
    const trackingId = performanceMonitor.startTracking(`${componentName}-${actionName}`, 'lazy');

    return () => {
      performanceMonitor.endTracking(`${componentName}-${actionName}`, trackingId);
    };
  }, [componentName]);

  const getComponentMetrics = useCallback(() => {
    return performanceMonitor.getMetrics(componentName);
  }, [componentName]);

  const getAverageLoadTime = useCallback(() => {
    return performanceMonitor.getAverageLoadTime(componentName);
  }, [componentName]);

  return {
    trackAction,
    getComponentMetrics,
    getAverageLoadTime,
    mountTime: mountTimeRef.current,
  };
};

// Intelligent preloading hook
export const useIntelligentPreloading = () => {
  const [preloadedComponents, setPreloadedComponents] = useState<Set<string>>(new Set());
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const preloadOnHover = useCallback((componentType: 'swap' | 'booking' | 'secondary') => {
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    preloadTimeoutRef.current = setTimeout(() => {
      switch (componentType) {
        case 'swap':
          if (!preloadedComponents.has('swap')) {
            intelligentPreload.onSwapButtonHover();
            setPreloadedComponents(prev => new Set(prev).add('swap'));
          }
          break;
        case 'booking':
          if (!preloadedComponents.has('booking')) {
            intelligentPreload.onBookingsPageLoad();
            setPreloadedComponents(prev => new Set(prev).add('booking'));
          }
          break;
        case 'secondary':
          if (!preloadedComponents.has('secondary')) {
            intelligentPreload.onMainContentLoaded();
            setPreloadedComponents(prev => new Set(prev).add('secondary'));
          }
          break;
      }
    }, 100); // Small delay to avoid unnecessary preloads
  }, [preloadedComponents]);

  const preloadBasedOnUserHistory = useCallback((visitedPages: string[]) => {
    intelligentPreload.onUserPreferencesLoad(visitedPages);
  }, []);

  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  return {
    preloadOnHover,
    preloadBasedOnUserHistory,
    preloadedComponents: Array.from(preloadedComponents),
  };
};

// Optimized state selection hook
export const useOptimizedState = <T>(
  selector: (state: RootState) => T,
  deps: any[] = []
) => {
  const memoizedSelector = useMemo(() => selector, deps);
  return useSelector(memoizedSelector);
};

// Navigation optimization hook
export const useNavigationOptimization = () => {
  const { cacheNavigationState, getNavigationState, createNavigationState } = useNavigationCache();
  const { preloadBooking } = useBookingCache();

  const optimizeNavigation = useCallback((
    fromPath: string,
    toPath: string,
    userIntent: NavigationState['userIntent'],
    bookingId?: string,
    preservedData?: any
  ) => {
    // Cache navigation state
    const navState = createNavigationState(fromPath, toPath, userIntent, preservedData);
    cacheNavigationState(navState);

    // Preload booking data if navigating to booking-related page
    if (bookingId && (toPath.includes('swap-specification') || toPath.includes('edit'))) {
      preloadBooking(bookingId).catch(console.warn);
    }

    // Preload related components based on intent
    if (userIntent === 'swap') {
      intelligentPreload.onSwapButtonHover();
    } else if (userIntent === 'edit') {
      intelligentPreload.onBookingsPageLoad();
    }
  }, [cacheNavigationState, createNavigationState, preloadBooking]);

  const getOptimizedNavigationState = useCallback((path: string) => {
    return getNavigationState(path);
  }, [getNavigationState]);

  return {
    optimizeNavigation,
    getOptimizedNavigationState,
  };
};

// Memory usage monitoring hook
export const useMemoryMonitoring = (interval: number = 30000) => {
  const [memoryUsage, setMemoryUsage] = useState<MemoryInfo | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateMemoryUsage = () => {
      const usage = getMemoryUsage();
      setMemoryUsage(usage);
    };

    // Initial measurement
    updateMemoryUsage();

    // Set up interval
    intervalRef.current = setInterval(updateMemoryUsage, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval]);

  const isMemoryPressure = useMemo(() => {
    if (!memoryUsage) return false;

    // Consider memory pressure if used heap is > 80% of limit
    const usageRatio = memoryUsage.usedJSHeapSize / memoryUsage.jsHeapSizeLimit;
    return usageRatio > 0.8;
  }, [memoryUsage]);

  return {
    memoryUsage,
    isMemoryPressure,
  };
};

// Cache optimization hook
export const useCacheOptimization = () => {
  const { getCacheStats, clearAllCaches } = useBookingCache();
  const [cacheStats, setCacheStats] = useState(getCacheStats());

  const updateCacheStats = useCallback(() => {
    setCacheStats(getCacheStats());
  }, [getCacheStats]);

  const optimizeCache = useCallback(() => {
    const stats = getCacheStats();

    // Clear caches if hit rate is too low
    if (stats.bookingData.hitRate < 0.3) {
      console.warn('Low cache hit rate detected, clearing caches');
      clearAllCaches();
      updateCacheStats();
    }
  }, [getCacheStats, clearAllCaches, updateCacheStats]);

  useEffect(() => {
    // Update cache stats periodically
    const interval = setInterval(updateCacheStats, 60000); // Every minute

    return () => clearInterval(interval);
  }, [updateCacheStats]);

  return {
    cacheStats,
    updateCacheStats,
    optimizeCache,
  };
};

// Performance report hook
export const usePerformanceReport = () => {
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    try {
      const newReport = await generatePerformanceReport();
      setReport(newReport);
    } catch (error) {
      console.error('Failed to generate performance report:', error);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearReport = useCallback(() => {
    setReport(null);
  }, []);

  return {
    report,
    isGenerating,
    generateReport,
    clearReport,
  };
};

// Render optimization hook
export const useRenderOptimization = (componentName: string) => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());

  // Track renders using refs to avoid infinite loops
  const currentRenderCount = ++renderCountRef.current;
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;

  // Warn about excessive re-renders in development
  if (process.env.NODE_ENV === 'development' && currentRenderCount > 10) {
    const timeSinceMount = now - (lastRenderTimeRef.current - timeSinceLastRender * currentRenderCount);
    if (timeSinceMount < 5000) { // More than 10 renders in 5 seconds
      console.warn(`Excessive re-renders detected in ${componentName}: ${currentRenderCount} renders in ${timeSinceMount}ms`);
    }
  }

  // Get current stats without causing re-renders
  const getCurrentStats = useCallback(() => ({
    count: renderCountRef.current,
    averageTime: timeSinceLastRender,
    lastRenderTime: lastRenderTimeRef.current,
  }), []);

  const resetRenderStats = useCallback(() => {
    renderCountRef.current = 0;
    lastRenderTimeRef.current = Date.now();
  }, []);

  return {
    renderStats: getCurrentStats(),
    resetRenderStats,
  };
};

// Bundle size monitoring hook
export const useBundleOptimization = () => {
  const [bundleSizes, setBundleSizes] = useState<{ [key: string]: number }>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeBundleSizes = useCallback(async () => {
    setIsAnalyzing(true);
    try {
      // This would integrate with webpack-bundle-analyzer
      // For now, return mock data
      const sizes = {
        'BookingEditForm': 45000,
        'BookingSwapSpecificationPage': 78000,
        'SwapPreferencesSection': 32000,
        'UnifiedSwapEnablement': 28000,
      };
      setBundleSizes(sizes);
    } catch (error) {
      console.error('Failed to analyze bundle sizes:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const getTotalBundleSize = useCallback(() => {
    return Object.values(bundleSizes).reduce((total, size) => total + size, 0);
  }, [bundleSizes]);

  const getLargestBundles = useCallback((count: number = 3) => {
    return Object.entries(bundleSizes)
      .sort(([, a], [, b]) => b - a)
      .slice(0, count);
  }, [bundleSizes]);

  return {
    bundleSizes,
    isAnalyzing,
    analyzeBundleSizes,
    getTotalBundleSize,
    getLargestBundles,
  };
};

// Combined performance optimization hook
export const usePerformanceOptimizations = (componentName: string) => {
  const performanceMonitor = usePerformanceMonitor(componentName);
  const intelligentPreloading = useIntelligentPreloading();
  const navigationOptimization = useNavigationOptimization();
  const memoryMonitoring = useMemoryMonitoring();
  const cacheOptimization = useCacheOptimization();
  const renderOptimization = useRenderOptimization(componentName);

  return {
    ...performanceMonitor,
    ...intelligentPreloading,
    ...navigationOptimization,
    ...memoryMonitoring,
    ...cacheOptimization,
    ...renderOptimization,
  };
};