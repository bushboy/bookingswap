/**
 * Tests for performance optimization utilities
 * 
 * This test suite validates the performance optimization features including
 * caching, lazy loading, state management optimizations, and monitoring.
 */

import { 
  PerformanceMonitor, 
  ComponentCache, 
  createLazyComponent,
  createMemoizedSelector,
  generatePerformanceReport,
  bookingDataCache,
  componentBundleCache,
} from '../performanceOptimizations';
import { 
  bookingCacheManager, 
  CacheKeys,
  useBookingCache,
  useNavigationCache,
} from '../bookingDataCache';
import { 
  optimizedSelectors,
  stateOptimizations,
  shallowEqual,
} from '../../store/optimizations/stateOptimizations';

// Mock data
const mockBooking = {
  id: 'booking-1',
  title: 'Test Booking',
  type: 'hotel' as const,
  description: 'Test description',
  location: { city: 'Test City', country: 'Test Country' },
  dateRange: { checkIn: new Date(), checkOut: new Date() },
  originalPrice: 100,
  swapValue: 100,
  providerDetails: { provider: 'Test Provider', confirmationNumber: '123', bookingReference: 'REF123' },
  userId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSwapPreferences = {
  paymentTypes: ['booking' as const],
  acceptanceStrategy: 'first-match' as const,
  swapConditions: [],
};

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = PerformanceMonitor.getInstance();
    monitor.clearMetrics();
  });

  it('should track component loading times', () => {
    const trackingId = monitor.startTracking('TestComponent', 'initial');
    
    // Simulate some work
    const start = performance.now();
    while (performance.now() - start < 10) {
      // Wait 10ms
    }
    
    monitor.endTracking('TestComponent', trackingId);
    
    const metrics = monitor.getMetrics('TestComponent');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].componentName).toBe('TestComponent');
    expect(metrics[0].loadType).toBe('initial');
    expect(metrics[0].endTime).toBeDefined();
  });

  it('should calculate average load times', () => {
    // Track multiple loads
    for (let i = 0; i < 3; i++) {
      const trackingId = monitor.startTracking('TestComponent', 'lazy');
      monitor.endTracking('TestComponent', trackingId);
    }
    
    const averageTime = monitor.getAverageLoadTime('TestComponent');
    expect(averageTime).toBeGreaterThanOrEqual(0);
  });

  it('should clear metrics for specific components', () => {
    monitor.startTracking('Component1', 'initial');
    monitor.startTracking('Component2', 'initial');
    
    monitor.clearMetrics('Component1');
    
    expect(monitor.getMetrics('Component1')).toHaveLength(0);
    expect(monitor.getMetrics('Component2')).toHaveLength(1);
  });
});

describe('ComponentCache', () => {
  let cache: ComponentCache<string>;

  beforeEach(() => {
    cache = new ComponentCache({
      maxAge: 1000, // 1 second for testing
      maxSize: 3,
      strategy: 'lru',
    });
  });

  it('should store and retrieve cached data', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return null for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should expire old entries', async () => {
    cache.set('key1', 'value1');
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    expect(cache.get('key1')).toBeNull();
  });

  it('should evict entries when cache is full', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1 (LRU)
    
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key4')).toBe('value4');
  });

  it('should update access count for LRU strategy', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    // Access key1 to make it more recently used
    cache.get('key1');
    
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key2, not key1
    
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBeNull();
  });

  it('should clear all entries', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    cache.clear();
    
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeNull();
    expect(cache.get('key2')).toBeNull();
  });
});

describe('BookingCacheManager', () => {
  beforeEach(() => {
    bookingCacheManager.clearAllCaches();
  });

  it('should cache and retrieve booking data', () => {
    bookingCacheManager.cacheBooking(mockBooking, mockSwapPreferences);
    
    const cached = bookingCacheManager.getCachedBooking(mockBooking.id);
    expect(cached).toBeDefined();
    expect(cached?.booking.id).toBe(mockBooking.id);
    expect(cached?.swapPreferences).toEqual(mockSwapPreferences);
  });

  it('should get booking data optimized for edit interface', () => {
    bookingCacheManager.cacheBooking(mockBooking);
    
    const booking = bookingCacheManager.getBookingForEdit(mockBooking.id);
    expect(booking?.id).toBe(mockBooking.id);
  });

  it('should get booking data optimized for swap specification', () => {
    bookingCacheManager.cacheBooking(mockBooking, mockSwapPreferences);
    
    const data = bookingCacheManager.getBookingForSwapSpec(mockBooking.id);
    expect(data?.booking.id).toBe(mockBooking.id);
    expect(data?.swapPreferences).toEqual(mockSwapPreferences);
  });

  it('should invalidate booking cache', () => {
    bookingCacheManager.cacheBooking(mockBooking);
    
    bookingCacheManager.invalidateBooking(mockBooking.id);
    
    const cached = bookingCacheManager.getCachedBooking(mockBooking.id);
    expect(cached).toBeNull();
  });

  it('should cache navigation state', () => {
    const navState = {
      fromPath: '/bookings',
      toPath: '/bookings/1/swap-specification',
      timestamp: Date.now(),
      userIntent: 'swap' as const,
    };
    
    bookingCacheManager.cacheNavigationState(navState);
    
    const cached = bookingCacheManager.getNavigationState(navState.toPath);
    expect(cached).toEqual(navState);
  });

  it('should provide cache statistics', () => {
    bookingCacheManager.cacheBooking(mockBooking);
    
    const stats = bookingCacheManager.getCacheStats();
    expect(stats.bookingData.size).toBeGreaterThan(0);
    expect(stats.swapPreferences.size).toBeGreaterThanOrEqual(0);
    expect(stats.navigationState.size).toBeGreaterThanOrEqual(0);
  });
});

describe('State Optimizations', () => {
  describe('shallowEqual', () => {
    it('should return true for equal objects', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { a: 1, b: 2, c: 3 };
      
      expect(shallowEqual(obj1, obj2)).toBe(true);
    });

    it('should return false for objects with different values', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { a: 1, b: 2, c: 4 };
      
      expect(shallowEqual(obj1, obj2)).toBe(false);
    });

    it('should return false for objects with different keys', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2, c: 3 };
      
      expect(shallowEqual(obj1, obj2)).toBe(false);
    });
  });

  describe('normalizeBookings', () => {
    it('should normalize booking array to byId and allIds', () => {
      const bookings = [mockBooking];
      
      const normalized = stateOptimizations.normalizeBookings(bookings);
      
      expect(normalized.byId[mockBooking.id]).toEqual(mockBooking);
      expect(normalized.allIds).toEqual([mockBooking.id]);
    });
  });

  describe('denormalizeBookings', () => {
    it('should denormalize booking data back to array', () => {
      const normalized = {
        byId: { [mockBooking.id]: mockBooking },
        allIds: [mockBooking.id],
      };
      
      const bookings = stateOptimizations.denormalizeBookings(normalized);
      
      expect(bookings).toEqual([mockBooking]);
    });
  });

  describe('createBatchUpdater', () => {
    it('should batch updates and flush them', (done) => {
      const batchUpdater = stateOptimizations.createBatchUpdater<typeof mockBooking>();
      const updates: any[] = [];
      
      const callback = (batchedUpdates: any[]) => {
        updates.push(...batchedUpdates);
        expect(updates).toHaveLength(2);
        done();
      };
      
      batchUpdater.addUpdate({ type: 'SET', id: 'booking-1', data: mockBooking }, callback);
      batchUpdater.addUpdate({ type: 'UPDATE', id: 'booking-1', data: { title: 'Updated' } }, callback);
    });
  });

  describe('createDebouncedUpdater', () => {
    it('should debounce updates', (done) => {
      let updateCount = 0;
      const updateFn = () => { updateCount++; };
      
      const debouncedUpdater = stateOptimizations.createDebouncedUpdater(updateFn, 50);
      
      // Call multiple times quickly
      debouncedUpdater('value1');
      debouncedUpdater('value2');
      debouncedUpdater('value3');
      
      // Should only call updateFn once after debounce delay
      setTimeout(() => {
        expect(updateCount).toBe(1);
        done();
      }, 100);
    });
  });
});

describe('createMemoizedSelector', () => {
  it('should memoize selector results', () => {
    let callCount = 0;
    const selector = (state: any) => {
      callCount++;
      return state.value;
    };
    
    const memoizedSelector = createMemoizedSelector(selector);
    
    const state1 = { value: 'test' };
    const state2 = { value: 'test' };
    
    const result1 = memoizedSelector(state1);
    const result2 = memoizedSelector(state1); // Same reference
    const result3 = memoizedSelector(state2); // Different reference but same value
    
    expect(result1).toBe('test');
    expect(result2).toBe('test');
    expect(result3).toBe('test');
    expect(callCount).toBe(2); // Should only call twice due to memoization
  });
});

describe('generatePerformanceReport', () => {
  it('should generate a performance report', async () => {
    const report = await generatePerformanceReport();
    
    expect(report).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.componentMetrics).toBeDefined();
    expect(report.cacheMetrics).toBeDefined();
    expect(report.bundleSizes).toBeDefined();
  });
});

describe('Global Cache Instances', () => {
  it('should have booking data cache available', () => {
    expect(bookingDataCache).toBeDefined();
    expect(typeof bookingDataCache.set).toBe('function');
    expect(typeof bookingDataCache.get).toBe('function');
  });

  it('should have component bundle cache available', () => {
    expect(componentBundleCache).toBeDefined();
    expect(typeof componentBundleCache.set).toBe('function');
    expect(typeof componentBundleCache.get).toBe('function');
  });
});

describe('Cache Keys', () => {
  it('should generate consistent cache keys', () => {
    const bookingId = 'booking-123';
    const userId = 'user-456';
    
    expect(CacheKeys.booking(bookingId)).toBe('booking-booking-123');
    expect(CacheKeys.swapPreferences(bookingId)).toBe('swap-prefs-booking-123');
    expect(CacheKeys.userBookings(userId)).toBe('user-bookings-user-456');
  });
});

// Integration tests
describe('Performance Optimization Integration', () => {
  beforeEach(() => {
    bookingCacheManager.clearAllCaches();
  });

  it('should integrate caching with booking operations', () => {
    // Cache a booking
    bookingCacheManager.cacheBooking(mockBooking, mockSwapPreferences);
    
    // Retrieve for edit
    const editBooking = bookingCacheManager.getBookingForEdit(mockBooking.id);
    expect(editBooking?.id).toBe(mockBooking.id);
    
    // Retrieve for swap specification
    const swapData = bookingCacheManager.getBookingForSwapSpec(mockBooking.id);
    expect(swapData?.booking.id).toBe(mockBooking.id);
    expect(swapData?.swapPreferences).toEqual(mockSwapPreferences);
  });

  it('should handle cache invalidation properly', () => {
    // Cache multiple bookings
    bookingCacheManager.cacheBooking(mockBooking);
    bookingCacheManager.cacheBooking({ ...mockBooking, id: 'booking-2' });
    
    // Invalidate one booking
    bookingCacheManager.invalidateBooking(mockBooking.id);
    
    // First booking should be gone, second should remain
    expect(bookingCacheManager.getCachedBooking(mockBooking.id)).toBeNull();
    expect(bookingCacheManager.getCachedBooking('booking-2')).toBeDefined();
  });

  it('should maintain performance metrics across operations', () => {
    const monitor = PerformanceMonitor.getInstance();
    
    // Track some operations
    const trackingId1 = monitor.startTracking('BookingEditForm', 'initial');
    monitor.endTracking('BookingEditForm', trackingId1);
    
    const trackingId2 = monitor.startTracking('BookingSwapSpecificationPage', 'lazy');
    monitor.endTracking('BookingSwapSpecificationPage', trackingId2);
    
    // Check metrics
    expect(monitor.getMetrics('BookingEditForm')).toHaveLength(1);
    expect(monitor.getMetrics('BookingSwapSpecificationPage')).toHaveLength(1);
    
    // Check average times
    expect(monitor.getAverageLoadTime('BookingEditForm')).toBeGreaterThanOrEqual(0);
    expect(monitor.getAverageLoadTime('BookingSwapSpecificationPage')).toBeGreaterThanOrEqual(0);
  });
});