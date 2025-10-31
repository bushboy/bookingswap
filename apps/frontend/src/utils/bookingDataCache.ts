/**
 * Booking data caching strategies for performance optimization
 * 
 * This module provides intelligent caching for booking data when navigating
 * between separated booking edit and swap specification interfaces.
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

import { Booking, SwapPreferencesData } from '@booking-swap/shared';
import { ComponentCache, bookingDataCache } from '@/utils/performanceOptimizations';

// Specialized cache configurations for different data types
const BOOKING_CACHE_CONFIG = {
  maxAge: 15 * 60 * 1000, // 15 minutes
  maxSize: 100,
  strategy: 'lru' as const,
};

const SWAP_PREFERENCES_CACHE_CONFIG = {
  maxAge: 10 * 60 * 1000, // 10 minutes
  maxSize: 50,
  strategy: 'lru' as const,
};

const NAVIGATION_STATE_CACHE_CONFIG = {
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxSize: 20,
  strategy: 'ttl' as const,
};

// Specialized caches
export const swapPreferencesCache = new ComponentCache<SwapPreferencesData>(SWAP_PREFERENCES_CACHE_CONFIG);
export const navigationStateCache = new ComponentCache<any>(NAVIGATION_STATE_CACHE_CONFIG);

// Cache keys
export const CacheKeys = {
  booking: (id: string) => `booking-${id}`,
  bookingWithSwap: (id: string) => `booking-swap-${id}`,
  swapPreferences: (bookingId: string) => `swap-prefs-${bookingId}`,
  navigationState: (path: string) => `nav-state-${path}`,
  userBookings: (userId: string) => `user-bookings-${userId}`,
  bookingValidation: (bookingId: string) => `booking-validation-${bookingId}`,
} as const;

// Booking data with metadata for intelligent caching
export interface CachedBookingData {
  booking: Booking;
  lastAccessed: number;
  accessCount: number;
  hasSwapInfo: boolean;
  swapPreferences?: SwapPreferencesData;
  validationState?: any;
}

// Navigation state for preserving context between interfaces
export interface NavigationState {
  fromPath: string;
  toPath: string;
  timestamp: number;
  preservedData?: any;
  userIntent: 'edit' | 'swap' | 'browse' | 'manage';
}

// Intelligent booking cache manager
export class BookingCacheManager {
  private static instance: BookingCacheManager;
  private accessPatterns: Map<string, number[]> = new Map();
  private preloadQueue: Set<string> = new Set();

  static getInstance(): BookingCacheManager {
    if (!BookingCacheManager.instance) {
      BookingCacheManager.instance = new BookingCacheManager();
    }
    return BookingCacheManager.instance;
  }

  // Cache booking data with intelligent metadata
  cacheBooking(booking: Booking, swapPreferences?: SwapPreferencesData): void {
    const cacheKey = CacheKeys.booking(booking.id);
    const cachedData: CachedBookingData = {
      booking,
      lastAccessed: Date.now(),
      accessCount: this.getAccessCount(booking.id) + 1,
      hasSwapInfo: Boolean(booking.swapInfo),
      swapPreferences,
    };

    bookingDataCache.set(cacheKey, cachedData);

    // Cache swap preferences separately if provided
    if (swapPreferences) {
      swapPreferencesCache.set(CacheKeys.swapPreferences(booking.id), swapPreferences);
    }

    // Track access pattern
    this.trackAccess(booking.id);
  }

  // Get cached booking with access tracking
  getCachedBooking(bookingId: string): CachedBookingData | null {
    const cacheKey = CacheKeys.booking(bookingId);
    const cachedData = bookingDataCache.get(cacheKey) as CachedBookingData | null;

    if (cachedData) {
      // Update access metadata
      cachedData.lastAccessed = Date.now();
      cachedData.accessCount++;
      this.trackAccess(bookingId);
    }

    return cachedData;
  }

  // Get booking data optimized for edit interface
  getBookingForEdit(bookingId: string): Booking | null {
    const cachedData = this.getCachedBooking(bookingId);
    return cachedData?.booking || null;
  }

  // Get booking data optimized for swap specification interface
  getBookingForSwapSpec(bookingId: string): { booking: Booking; swapPreferences?: SwapPreferencesData } | null {
    const cachedData = this.getCachedBooking(bookingId);
    if (!cachedData) return null;

    const swapPreferences = swapPreferencesCache.get(CacheKeys.swapPreferences(bookingId));
    
    return {
      booking: cachedData.booking,
      swapPreferences: swapPreferences || cachedData.swapPreferences,
    };
  }

  // Cache navigation state for seamless transitions
  cacheNavigationState(state: NavigationState): void {
    const cacheKey = CacheKeys.navigationState(state.toPath);
    navigationStateCache.set(cacheKey, state);
  }

  // Get cached navigation state
  getNavigationState(path: string): NavigationState | null {
    const cacheKey = CacheKeys.navigationState(path);
    return navigationStateCache.get(cacheKey);
  }

  // Preload booking data based on user behavior patterns
  async preloadBooking(bookingId: string): Promise<void> {
    if (this.preloadQueue.has(bookingId)) {
      return; // Already queued
    }

    this.preloadQueue.add(bookingId);

    try {
      // This would typically make an API call
      // For now, we'll simulate the preload
      console.log(`Preloading booking data for ${bookingId}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Remove from queue
      this.preloadQueue.delete(bookingId);
    } catch (error) {
      console.warn(`Failed to preload booking ${bookingId}:`, error);
      this.preloadQueue.delete(bookingId);
    }
  }

  // Intelligent preloading based on access patterns
  preloadRelatedBookings(currentBookingId: string): void {
    const accessPattern = this.accessPatterns.get(currentBookingId) || [];
    
    // Find frequently accessed bookings after this one
    const relatedBookings = this.findRelatedBookings(accessPattern);
    
    // Preload top 3 related bookings
    relatedBookings.slice(0, 3).forEach(bookingId => {
      this.preloadBooking(bookingId).catch(console.warn);
    });
  }

  // Cache user's booking list for faster navigation
  cacheUserBookings(userId: string, bookings: Booking[]): void {
    const cacheKey = CacheKeys.userBookings(userId);
    bookingDataCache.set(cacheKey, {
      bookings,
      timestamp: Date.now(),
      userId,
    });

    // Cache individual bookings as well
    bookings.forEach(booking => {
      this.cacheBooking(booking);
    });
  }

  // Get cached user bookings
  getCachedUserBookings(userId: string): Booking[] | null {
    const cacheKey = CacheKeys.userBookings(userId);
    const cachedData = bookingDataCache.get(cacheKey);
    return cachedData?.bookings || null;
  }

  // Invalidate cache when booking is updated
  invalidateBooking(bookingId: string): void {
    const bookingKey = CacheKeys.booking(bookingId);
    const swapPrefsKey = CacheKeys.swapPreferences(bookingId);
    const validationKey = CacheKeys.bookingValidation(bookingId);

    bookingDataCache.delete(bookingKey);
    swapPreferencesCache.delete(swapPrefsKey);
    bookingDataCache.delete(validationKey);

    // Clear related navigation states
    this.clearNavigationStatesForBooking(bookingId);
  }

  // Batch invalidation for multiple bookings
  invalidateBookings(bookingIds: string[]): void {
    bookingIds.forEach(id => this.invalidateBooking(id));
  }

  // Clear all cached data
  clearAllCaches(): void {
    bookingDataCache.clear();
    swapPreferencesCache.clear();
    navigationStateCache.clear();
    this.accessPatterns.clear();
    this.preloadQueue.clear();
  }

  // Get cache statistics
  getCacheStats() {
    return {
      bookingData: {
        size: bookingDataCache.size(),
        hitRate: bookingDataCache.getHitRate(),
      },
      swapPreferences: {
        size: swapPreferencesCache.size(),
        hitRate: swapPreferencesCache.getHitRate(),
      },
      navigationState: {
        size: navigationStateCache.size(),
        hitRate: navigationStateCache.getHitRate(),
      },
      accessPatterns: this.accessPatterns.size,
      preloadQueue: this.preloadQueue.size,
    };
  }

  // Private helper methods
  private getAccessCount(bookingId: string): number {
    const pattern = this.accessPatterns.get(bookingId) || [];
    return pattern.length;
  }

  private trackAccess(bookingId: string): void {
    const pattern = this.accessPatterns.get(bookingId) || [];
    pattern.push(Date.now());
    
    // Keep only last 10 accesses
    if (pattern.length > 10) {
      pattern.shift();
    }
    
    this.accessPatterns.set(bookingId, pattern);
  }

  private findRelatedBookings(accessPattern: number[]): string[] {
    // This would analyze access patterns to find related bookings
    // For now, return empty array
    return [];
  }

  private clearNavigationStatesForBooking(bookingId: string): void {
    // Clear navigation states that reference this booking
    const keysToDelete: string[] = [];
    
    // This would iterate through navigation cache and find related keys
    // For now, we'll just clear all navigation states
    navigationStateCache.clear();
  }
}

// Singleton instance
export const bookingCacheManager = BookingCacheManager.getInstance();

// Hook for React components to use caching
export const useBookingCache = () => {
  const cacheBooking = (booking: Booking, swapPreferences?: SwapPreferencesData) => {
    bookingCacheManager.cacheBooking(booking, swapPreferences);
  };

  const getCachedBooking = (bookingId: string) => {
    return bookingCacheManager.getCachedBooking(bookingId);
  };

  const getBookingForEdit = (bookingId: string) => {
    return bookingCacheManager.getBookingForEdit(bookingId);
  };

  const getBookingForSwapSpec = (bookingId: string) => {
    return bookingCacheManager.getBookingForSwapSpec(bookingId);
  };

  const preloadBooking = (bookingId: string) => {
    return bookingCacheManager.preloadBooking(bookingId);
  };

  const invalidateBooking = (bookingId: string) => {
    bookingCacheManager.invalidateBooking(bookingId);
  };

  const getCacheStats = () => {
    return bookingCacheManager.getCacheStats();
  };

  return {
    cacheBooking,
    getCachedBooking,
    getBookingForEdit,
    getBookingForSwapSpec,
    preloadBooking,
    invalidateBooking,
    getCacheStats,
  };
};

// Navigation state management for seamless transitions
export const useNavigationCache = () => {
  const cacheNavigationState = (state: NavigationState) => {
    bookingCacheManager.cacheNavigationState(state);
  };

  const getNavigationState = (path: string) => {
    return bookingCacheManager.getNavigationState(path);
  };

  const createNavigationState = (
    fromPath: string,
    toPath: string,
    userIntent: NavigationState['userIntent'],
    preservedData?: any
  ): NavigationState => {
    return {
      fromPath,
      toPath,
      timestamp: Date.now(),
      preservedData,
      userIntent,
    };
  };

  return {
    cacheNavigationState,
    getNavigationState,
    createNavigationState,
  };
};

// Performance optimization hooks
export const usePerformanceOptimizations = () => {
  const preloadRelatedBookings = (currentBookingId: string) => {
    bookingCacheManager.preloadRelatedBookings(currentBookingId);
  };

  const cacheUserBookings = (userId: string, bookings: Booking[]) => {
    bookingCacheManager.cacheUserBookings(userId, bookings);
  };

  const getCachedUserBookings = (userId: string) => {
    return bookingCacheManager.getCachedUserBookings(userId);
  };

  const clearAllCaches = () => {
    bookingCacheManager.clearAllCaches();
  };

  const getCacheStats = () => {
    return bookingCacheManager.getCacheStats();
  };

  return {
    preloadRelatedBookings,
    cacheUserBookings,
    getCachedUserBookings,
    clearAllCaches,
    getCacheStats,
  };
};