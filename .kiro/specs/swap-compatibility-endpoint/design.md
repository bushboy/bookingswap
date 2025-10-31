# Design Document

## Overview

This design implements the missing `GET /api/swaps/{sourceSwapId}/compatibility/{targetSwapId}` endpoint that the frontend is already calling. The endpoint will leverage the existing `SwapMatchingService.getSwapCompatibility()` method to provide compatibility analysis between two swaps. This will fix the 404 errors users are experiencing when the MakeProposalModal tries to fetch compatibility scores.

## Architecture

The solution follows the existing backend architecture pattern:

```
Frontend Request → Route Handler → Controller Method → Service Layer → Response
```

**Components involved:**
- **Route**: New GET route in `swaps.ts`
- **Controller**: New method in `SwapController`
- **Service**: Existing `SwapMatchingService.getSwapCompatibility()`
- **Engine**: Existing `CompatibilityAnalysisEngine`
- **Cache**: Existing `SwapMatchingCacheService` for performance

## Components and Interfaces

### 1. Route Definition
**File**: `apps/backend/src/routes/swaps.ts`

Add new route:
```typescript
router.get('/:sourceSwapId/compatibility/:targetSwapId', swapController.getSwapCompatibility);
```

**Route Parameters:**
- `sourceSwapId`: UUID of the user's swap being proposed
- `targetSwapId`: UUID of the target swap to analyze compatibility against

### 2. Controller Method
**File**: `apps/backend/src/controllers/SwapController.ts`

New method: `getSwapCompatibility`

**Input Validation:**
- Validate UUID format for both swap IDs
- Ensure user has permission to view both swaps
- Prevent analysis of same swap (sourceSwapId !== targetSwapId)

**Authentication:**
- Require authenticated user
- Verify user can access both swaps (owns source swap or both are public)

### 3. Service Integration
**Existing Service**: `SwapMatchingService.getSwapCompatibility()`

The service already provides:
- Compatibility analysis using `CompatibilityAnalysisEngine`
- Caching via `SwapMatchingCacheService`
- Recommendation levels (highly_recommended, recommended, possible, not_recommended)
- Comprehensive factor scoring (location, date, value, accommodation, guest)

### 4. Response Format
**Type**: `CompatibilityResponse` (already defined in shared types)

```typescript
interface CompatibilityResponse {
  compatibility: CompatibilityAnalysis;
  recommendation: 'highly_recommended' | 'recommended' | 'possible' | 'not_recommended';
}

interface CompatibilityAnalysis {
  swapId: string;
  overallScore: number; // 0-100
  factors: {
    locationCompatibility: CompatibilityFactor;
    dateCompatibility: CompatibilityFactor;
    valueCompatibility: CompatibilityFactor;
    accommodationCompatibility: CompatibilityFactor;
    guestCompatibility: CompatibilityFactor;
  };
  recommendations: string[];
}
```

## Data Models

### Request Flow
1. **Route Parameters**: Extract `sourceSwapId` and `targetSwapId` from URL
2. **Authentication**: Verify user identity from JWT token
3. **Authorization**: Check user can access both swaps
4. **Service Call**: Call `SwapMatchingService.getSwapCompatibility()`
5. **Response**: Return `CompatibilityResponse` with proper HTTP status

### Caching Strategy
The existing `SwapMatchingCacheService` already handles:
- **Cache Key**: `compatibility:${sourceSwapId}:${targetSwapId}`
- **TTL**: 5 minutes (reasonable for compatibility analysis)
- **Invalidation**: When swap details change
- **Performance**: Reduces analysis time from ~500ms to ~50ms

### Database Queries
No new database queries needed. The existing service uses:
- `SwapRepository.findById()` for swap details
- `BookingService.getBookingById()` for booking information
- Existing indexes on swap and booking tables

## Error Handling

### HTTP Status Codes
- **200 OK**: Successful compatibility analysis
- **400 Bad Request**: Invalid swap IDs or same swap comparison
- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User lacks permission to view swaps
- **404 Not Found**: One or both swaps don't exist
- **500 Internal Server Error**: Analysis engine failure

### Error Response Format
```typescript
{
  error: {
    code: string;
    message: string;
    category: 'authentication' | 'authorization' | 'validation' | 'system';
  },
  requestId: string;
  timestamp: string;
}
```

### Specific Error Scenarios
1. **Invalid UUID Format**: Return 400 with validation details
2. **Swap Not Found**: Return 404 with specific swap ID
3. **Same Swap Comparison**: Return 400 with explanation
4. **Permission Denied**: Return 403 with access requirements
5. **Analysis Engine Failure**: Return 500 with retry suggestion

## Testing Strategy

### Unit Tests
**File**: `apps/backend/src/__tests__/SwapController.getSwapCompatibility.test.ts`

Test scenarios:
- Valid compatibility request returns analysis
- Invalid swap IDs return 400 error
- Non-existent swaps return 404 error
- Same swap comparison returns 400 error
- Unauthorized access returns 401 error
- Permission denied returns 403 error
- Service failure returns 500 error

### Integration Tests
**File**: `apps/backend/src/__tests__/swap-compatibility-endpoint.integration.test.ts`

Test scenarios:
- End-to-end compatibility analysis flow
- Authentication middleware integration
- Route parameter extraction
- Response format validation
- Error handling integration
- Performance benchmarking

### API Tests
**File**: `tests/e2e/swap-compatibility.test.ts`

Test scenarios:
- Frontend compatibility with existing MakeProposalModal
- Cache behavior verification
- Rate limiting compliance
- Cross-browser compatibility

## Performance Considerations

### Response Time Targets
- **Cached Response**: < 100ms
- **Fresh Analysis**: < 1000ms
- **Timeout**: 10 seconds

### Optimization Strategies
1. **Caching**: Leverage existing 5-minute cache
2. **Parallel Processing**: Existing service already optimized
3. **Database Indexes**: Use existing swap and booking indexes
4. **Request Debouncing**: Frontend already implements debouncing

### Monitoring
- Track response times via existing `PerformanceMonitor`
- Monitor cache hit rates
- Alert on high error rates
- Track compatibility score distributions

## Security Considerations

### Access Control
- **Authentication**: JWT token validation (existing middleware)
- **Authorization**: User must own source swap OR both swaps must be public
- **Rate Limiting**: Apply existing API rate limits
- **Input Validation**: UUID format validation for swap IDs

### Data Privacy
- Don't expose private swap details in compatibility analysis
- Log requests for audit purposes (existing logging)
- Respect user privacy settings for swap visibility

### Attack Prevention
- **Parameter Injection**: UUID validation prevents injection
- **Enumeration**: Rate limiting prevents swap ID enumeration
- **DoS**: Existing circuit breaker and timeout protection
- **Cache Poisoning**: Secure cache key generation

## Implementation Notes

### Minimal Code Changes
This design leverages existing infrastructure:
- ✅ `SwapMatchingService.getSwapCompatibility()` already exists
- ✅ `CompatibilityAnalysisEngine` already implemented
- ✅ Caching layer already functional
- ✅ Error handling patterns established
- ✅ Authentication middleware ready

### Frontend Compatibility
The endpoint will return data in the exact format the frontend expects:
- ✅ `CompatibilityResponse` type already defined
- ✅ Frontend caching service already configured
- ✅ Error handling already implemented
- ✅ Loading states already managed

### Deployment Considerations
- **Zero Downtime**: New endpoint doesn't affect existing functionality
- **Backward Compatibility**: No breaking changes to existing APIs
- **Feature Flag**: Can be enabled/disabled via configuration
- **Rollback**: Simple route removal if issues arise

## Success Metrics

### Functional Metrics
- 404 errors from compatibility endpoint: 0%
- Compatibility analysis success rate: >95%
- Response time compliance: >90% under 1000ms
- Cache hit rate: >70%

### User Experience Metrics
- Proposal modal load time improvement: >50%
- User proposal completion rate increase: >10%
- Compatibility score display success: >95%
- Error rate in proposal flow: <5%

### Technical Metrics
- API endpoint availability: >99.9%
- Average response time: <500ms
- Error rate: <1%
- Cache efficiency: >70% hit rate