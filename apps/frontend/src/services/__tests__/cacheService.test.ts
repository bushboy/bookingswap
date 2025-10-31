import { CacheService, SwapCacheService } from '../cacheService';
import { EligibleSwapResponse, CompatibilityAnalysis } from '../../types/api';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    cacheService = new CacheService({
      defaultTTL: 1000, // 1 second for testing
      maxSize: 3,
      cleanupInterval: 500,
    });
  });

  afterEach(() => {
    cacheService.destroy();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve data', () => {
      const testData = { value: 'test' };
      cacheService.set('key1', testData);
      
      expect(cacheService.get('key1')).toEqual(testData);
      expect(cacheService.has('key1')).toBe(true);
    });

    it('should return null for non-existent keys', () => {
      expect(cacheService.get('nonexistent')).toBeNull();
      expect(cacheService.has('nonexistent')).toBe(false);
    });

    it('should delete entries', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
      
      const deleted = cacheService.delete('key1');
      expect(deleted).toBe(true);
      expect(cacheService.has('key1')).toBe(false);
    });

    it('should clear all entries', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      cacheService.clear();
      
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.has('key2')).toBe(false);
    });
  });

  describe('TTL (Time To Live)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should expire entries after TTL', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.has('key1')).toBe(true);
      
      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(1500);
      
      expect(cacheService.has('key1')).toBe(false);
      expect(cacheService.get('key1')).toBeNull();
    });

    it('should use custom TTL when provided', () => {
      cacheService.set('key1', 'value1', 2000); // 2 seconds TTL
      
      // Fast-forward time to 1.5 seconds (should still be valid)
      jest.advanceTimersByTime(1500);
      expect(cacheService.has('key1')).toBe(true);
      
      // Fast-forward to 2.5 seconds (should be expired)
      jest.advanceTimersByTime(1000);
      expect(cacheService.has('key1')).toBe(false);
    });

    it('should clean up expired entries automatically', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      // Fast-forward time beyond TTL
      jest.advanceTimersByTime(1500);
      
      // Fast-forward to trigger cleanup
      jest.advanceTimersByTime(500);
      
      const stats = cacheService.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Size Limits', () => {
    it('should evict oldest entries when max size is reached', () => {
      // Fill cache to max size
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      cacheService.set('key3', 'value3');
      
      expect(cacheService.getStats().size).toBe(3);
      
      // Add one more entry (should evict oldest)
      cacheService.set('key4', 'value4');
      
      expect(cacheService.getStats().size).toBe(3);
      expect(cacheService.has('key1')).toBe(false); // Oldest should be evicted
      expect(cacheService.has('key4')).toBe(true); // Newest should be present
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      cacheService.set('key1', 'value1');
      cacheService.set('key2', 'value2');
      
      const stats = cacheService.getStats();
      
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].key).toBe('key1');
      expect(stats.entries[1].key).toBe('key2');
    });
  });
});

describe('SwapCacheService', () => {
  let swapCacheService: SwapCacheService;

  const mockEligibleSwapsResponse: EligibleSwapResponse = {
    swaps: [
      {
        id: 'swap-1',
        title: 'Test Swap 1',
        bookingDetails: {
          dateRange: {
            checkIn: new Date('2024-06-01'),
            checkOut: new Date('2024-06-07'),
          },
          location: 'Test Location 1',
          guests: 2,
          propertyType: 'apartment',
        },
        compatibilityScore: 85,
        eligibilityReasons: ['Great location match'],
        isEligible: true,
      },
    ],
    totalCount: 1,
    compatibilityThreshold: 60,
  };

  const mockCompatibilityAnalysis: CompatibilityAnalysis = {
    score: 88,
    factors: [
      { name: 'location', score: 90, weight: 0.3 },
      { name: 'dates', score: 85, weight: 0.4 },
      { name: 'property', score: 90, weight: 0.3 },
    ],
    reasons: ['Excellent location match', 'Good date overlap'],
    recommendations: ['Consider flexible check-in times'],
  };

  beforeEach(() => {
    swapCacheService = new SwapCacheService();
  });

  afterEach(() => {
    swapCacheService.destroy();
  });

  describe('Eligible Swaps Caching', () => {
    it('should cache and retrieve eligible swaps', () => {
      const userId = 'user-123';
      const targetSwapId = 'target-456';
      
      swapCacheService.setEligibleSwaps(userId, targetSwapId, mockEligibleSwapsResponse);
      
      const retrieved = swapCacheService.getEligibleSwaps(userId, targetSwapId);
      expect(retrieved).toEqual(mockEligibleSwapsResponse);
    });

    it('should return null for non-cached eligible swaps', () => {
      const retrieved = swapCacheService.getEligibleSwaps('user-123', 'target-456');
      expect(retrieved).toBeNull();
    });

    it('should invalidate eligible swaps for specific target', () => {
      const userId = 'user-123';
      const targetSwapId = 'target-456';
      
      swapCacheService.setEligibleSwaps(userId, targetSwapId, mockEligibleSwapsResponse);
      expect(swapCacheService.getEligibleSwaps(userId, targetSwapId)).not.toBeNull();
      
      swapCacheService.invalidateEligibleSwaps(userId, targetSwapId);
      expect(swapCacheService.getEligibleSwaps(userId, targetSwapId)).toBeNull();
    });

    it('should invalidate all eligible swaps for a user', () => {
      const userId = 'user-123';
      
      swapCacheService.setEligibleSwaps(userId, 'target-1', mockEligibleSwapsResponse);
      swapCacheService.setEligibleSwaps(userId, 'target-2', mockEligibleSwapsResponse);
      
      swapCacheService.invalidateEligibleSwaps(userId);
      
      expect(swapCacheService.getEligibleSwaps(userId, 'target-1')).toBeNull();
      expect(swapCacheService.getEligibleSwaps(userId, 'target-2')).toBeNull();
    });
  });

  describe('Compatibility Analysis Caching', () => {
    it('should cache and retrieve compatibility analysis', () => {
      const sourceSwapId = 'source-123';
      const targetSwapId = 'target-456';
      
      swapCacheService.setCompatibilityAnalysis(sourceSwapId, targetSwapId, mockCompatibilityAnalysis);
      
      const retrieved = swapCacheService.getCompatibilityAnalysis(sourceSwapId, targetSwapId);
      expect(retrieved).toEqual(mockCompatibilityAnalysis);
    });

    it('should return null for non-cached compatibility analysis', () => {
      const retrieved = swapCacheService.getCompatibilityAnalysis('source-123', 'target-456');
      expect(retrieved).toBeNull();
    });

    it('should invalidate specific compatibility analysis', () => {
      const sourceSwapId = 'source-123';
      const targetSwapId = 'target-456';
      
      swapCacheService.setCompatibilityAnalysis(sourceSwapId, targetSwapId, mockCompatibilityAnalysis);
      expect(swapCacheService.getCompatibilityAnalysis(sourceSwapId, targetSwapId)).not.toBeNull();
      
      swapCacheService.invalidateCompatibility(sourceSwapId, targetSwapId);
      expect(swapCacheService.getCompatibilityAnalysis(sourceSwapId, targetSwapId)).toBeNull();
    });

    it('should invalidate all compatibility analysis involving a swap', () => {
      const swapId = 'swap-123';
      
      swapCacheService.setCompatibilityAnalysis(swapId, 'target-1', mockCompatibilityAnalysis);
      swapCacheService.setCompatibilityAnalysis('source-1', swapId, mockCompatibilityAnalysis);
      swapCacheService.setCompatibilityAnalysis('other-1', 'other-2', mockCompatibilityAnalysis);
      
      swapCacheService.invalidateCompatibility(swapId);
      
      expect(swapCacheService.getCompatibilityAnalysis(swapId, 'target-1')).toBeNull();
      expect(swapCacheService.getCompatibilityAnalysis('source-1', swapId)).toBeNull();
      expect(swapCacheService.getCompatibilityAnalysis('other-1', 'other-2')).not.toBeNull();
    });
  });
});