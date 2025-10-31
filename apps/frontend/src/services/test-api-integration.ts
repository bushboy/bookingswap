/**
 * Simple test script to verify API integration implementation
 */

import { unifiedBookingService } from './UnifiedBookingService';
import { cacheService } from './cacheService';
import { realtimeService } from './realtimeService';

// Test basic functionality
async function testApiIntegration() {
  console.log('Testing API integration implementation...');
  
  try {
    // Test cache service
    console.log('Testing cache service...');
    cacheService.set('test-key', { data: 'test' }, 1000);
    const cached = cacheService.get('test-key');
    console.log('Cache test:', cached ? 'PASS' : 'FAIL');
    
    // Test cache stats
    const stats = cacheService.getStats();
    console.log('Cache stats:', stats);
    
    // Test real-time service connection (will fail without server, but should not throw)
    console.log('Testing real-time service...');
    try {
      await realtimeService.connect();
      console.log('Real-time service: CONNECTED');
    } catch (error) {
      console.log('Real-time service: EXPECTED FAILURE (no server)');
    }
    
    // Test unified booking service initialization
    console.log('Testing unified booking service...');
    const serviceStats = unifiedBookingService.getCacheStats();
    console.log('Service cache stats:', serviceStats);
    
    // Test cache invalidation
    console.log('Testing cache invalidation...');
    cacheService.set('booking-123', { id: '123' });
    cacheService.set('swap-info-123', { swapId: 'swap-123' });
    
    const beforeInvalidation = cacheService.getStats().size;
    cacheService.invalidate('booking-', 'Test invalidation');
    const afterInvalidation = cacheService.getStats().size;
    
    console.log(`Cache invalidation: ${beforeInvalidation} -> ${afterInvalidation}`);
    
    console.log('API integration test completed successfully!');
    
  } catch (error) {
    console.error('API integration test failed:', error);
  } finally {
    // Cleanup
    unifiedBookingService.cleanup();
    cacheService.destroy();
  }
}

// Export for potential use in tests
export { testApiIntegration };

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testApiIntegration();
}