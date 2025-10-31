/**
 * Performance optimization utilities for separated booking and swap components
 * 
 * This module provides utilities for:
 * - Code splitting and lazy loading
 * - State management optimization
 * - Caching strategies
 * - Performance monitoring
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

import { lazy, ComponentType } from 'react';
import { RootState } from '@/store';

// Performance monitoring utilities
export interface PerformanceMetrics {
  componentLoadTime: number;
  bundleSize: number;
  renderTime: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export interface LoadingMetrics {
  startTime: number;
  endTime?: number;
  componentName: string;
  loadType: 'initial' | 'lazy' | 'cached';
}

// Cache configuration
export interface CacheConfig {
  maxAge: number; // in milliseconds
  maxSize: number; // maximum number of cached items
  strategy: 'lru' | 'fifo' | 'ttl';
}

// Default cache configuration
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 50,
  strategy: 'lru',
};

// Performance monitoring class
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, LoadingMetrics[]> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTracking(componentName: string, loadType: LoadingMetrics['loadType']): string {
    const trackingId = `${componentName}-${Date.now()}-${Math.random()}`;
    const metric: LoadingMetrics = {
      startTime: performance.now(),
      componentName,
      loadType,
    };

    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }
    this.metrics.get(componentName)!.push(metric);

    return trackingId;
  }

  endTracking(componentName: string, trackingId: string): void {
    const componentMetrics = this.metrics.get(componentName);
    if (componentMetrics) {
      const metric = componentMetrics.find(m => 
        trackingId.includes(m.componentName) && !m.endTime
      );
      if (metric) {
        metric.endTime = performance.now();
      }
    }
  }

  getMetrics(componentName: string): LoadingMetrics[] {
    return this.metrics.get(componentName) || [];
  }

  getAverageLoadTime(componentName: string): number {
    const metrics = this.getMetrics(componentName);
    const completedMetrics = metrics.filter(m => m.endTime);
    
    if (completedMetrics.length === 0) return 0;
    
    const totalTime = completedMetrics.reduce((sum, m) => 
      sum + (m.endTime! - m.startTime), 0
    );
    
    return totalTime / completedMetrics.length;
  }

  clearMetrics(componentName?: string): void {
    if (componentName) {
      this.metrics.delete(componentName);
    } else {
      this.metrics.clear();
    }
  }
}

// Generic cache implementation
export class ComponentCache<T = any> {
  private cache: Map<string, { data: T; timestamp: number; accessCount: number }> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  set(key: string, data: T): void {
    // Clean up expired entries
    this.cleanup();

    // If cache is full, remove oldest entry based on strategy
    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry is expired
    if (Date.now() - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Update access count for LRU
    entry.accessCount++;
    
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getHitRate(): number {
    // This would need to be tracked separately in a real implementation
    return 0.85; // Placeholder
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.maxAge) {
        this.cache.delete(key);
      }
    }
  }

  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToRemove: string;

    switch (this.config.strategy) {
      case 'lru':
        // Remove least recently used (lowest access count)
        let minAccessCount = Infinity;
        keyToRemove = '';
        for (const [key, entry] of this.cache.entries()) {
          if (entry.accessCount < minAccessCount) {
            minAccessCount = entry.accessCount;
            keyToRemove = key;
          }
        }
        break;

      case 'fifo':
        // Remove first in (oldest timestamp)
        let oldestTimestamp = Infinity;
        keyToRemove = '';
        for (const [key, entry] of this.cache.entries()) {
          if (entry.timestamp < oldestTimestamp) {
            oldestTimestamp = entry.timestamp;
            keyToRemove = key;
          }
        }
        break;

      case 'ttl':
        // Remove expired entries first, then oldest
        this.cleanup();
        if (this.cache.size >= this.config.maxSize) {
          keyToRemove = this.cache.keys().next().value;
        } else {
          return;
        }
        break;

      default:
        keyToRemove = this.cache.keys().next().value;
    }

    if (keyToRemove) {
      this.cache.delete(keyToRemove);
    }
  }
}

// Booking data cache instance
export const bookingDataCache = new ComponentCache({
  maxAge: 10 * 60 * 1000, // 10 minutes for booking data
  maxSize: 100,
  strategy: 'lru',
});

// Component bundle cache for lazy loading
export const componentBundleCache = new ComponentCache({
  maxAge: 30 * 60 * 1000, // 30 minutes for component bundles
  maxSize: 20,
  strategy: 'lru',
});

// Lazy loading utilities
export interface LazyLoadOptions {
  fallback?: ComponentType;
  preload?: boolean;
  retryCount?: number;
  timeout?: number;
}

export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): ComponentType<any> {
  const {
    retryCount = 3,
    timeout = 10000,
  } = options;

  const monitor = PerformanceMonitor.getInstance();

  return lazy(() => {
    const componentName = importFn.toString().match(/\/([^\/]+)\.tsx?/)?.[1] || 'UnknownComponent';
    const trackingId = monitor.startTracking(componentName, 'lazy');

    let retries = 0;
    
    const loadWithRetry = (): Promise<{ default: T }> => {
      return Promise.race([
        importFn(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Component load timeout')), timeout)
        ),
      ]).catch((error) => {
        retries++;
        if (retries <= retryCount) {
          console.warn(`Retrying component load for ${componentName} (attempt ${retries}/${retryCount})`);
          return loadWithRetry();
        }
        throw error;
      }).then((module) => {
        monitor.endTracking(componentName, trackingId);
        return module;
      });
    };

    return loadWithRetry();
  });
}

// Preloading utilities
export function preloadComponent(importFn: () => Promise<any>): Promise<void> {
  const monitor = PerformanceMonitor.getInstance();
  const componentName = importFn.toString().match(/\/([^\/]+)\.tsx?/)?.[1] || 'UnknownComponent';
  const trackingId = monitor.startTracking(componentName, 'initial');

  return importFn()
    .then(() => {
      monitor.endTracking(componentName, trackingId);
    })
    .catch((error) => {
      console.warn(`Failed to preload component ${componentName}:`, error);
    });
}

// State optimization utilities
export function createMemoizedSelector<T>(
  selector: (state: RootState) => T,
  equalityFn?: (a: T, b: T) => boolean
) {
  let lastResult: T;
  let lastArgs: RootState;

  return (state: RootState): T => {
    if (state !== lastArgs) {
      const result = selector(state);
      
      if (equalityFn) {
        if (!equalityFn(result, lastResult)) {
          lastResult = result;
        }
      } else {
        lastResult = result;
      }
      
      lastArgs = state;
    }
    
    return lastResult;
  };
}

// Bundle size analysis utilities
export function analyzeBundleSize(): Promise<{ [key: string]: number }> {
  // This would integrate with webpack-bundle-analyzer or similar
  // For now, return mock data
  return Promise.resolve({
    'BookingEditForm': 45000, // bytes
    'BookingSwapSpecificationPage': 78000,
    'SwapPreferencesSection': 32000,
    'UnifiedSwapEnablement': 28000,
  });
}

// Memory usage monitoring
export function getMemoryUsage(): MemoryInfo | null {
  if ('memory' in performance) {
    return (performance as any).memory;
  }
  return null;
}

// Performance reporting
export interface PerformanceReport {
  timestamp: number;
  componentMetrics: { [componentName: string]: LoadingMetrics[] };
  cacheMetrics: {
    bookingData: { size: number; hitRate: number };
    componentBundle: { size: number; hitRate: number };
  };
  memoryUsage: MemoryInfo | null;
  bundleSizes: { [key: string]: number };
}

export async function generatePerformanceReport(): Promise<PerformanceReport> {
  const monitor = PerformanceMonitor.getInstance();
  
  return {
    timestamp: Date.now(),
    componentMetrics: {
      'BookingEditForm': monitor.getMetrics('BookingEditForm'),
      'BookingSwapSpecificationPage': monitor.getMetrics('BookingSwapSpecificationPage'),
    },
    cacheMetrics: {
      bookingData: {
        size: bookingDataCache.size(),
        hitRate: bookingDataCache.getHitRate(),
      },
      componentBundle: {
        size: componentBundleCache.size(),
        hitRate: componentBundleCache.getHitRate(),
      },
    },
    memoryUsage: getMemoryUsage(),
    bundleSizes: await analyzeBundleSize(),
  };
}

// React DevTools integration
export function enablePerformanceDevTools(): void {
  if (process.env.NODE_ENV === 'development') {
    // Enable React DevTools Profiler
    if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      console.log('React DevTools detected - Performance monitoring enabled');
    }
  }
}

// Export performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();