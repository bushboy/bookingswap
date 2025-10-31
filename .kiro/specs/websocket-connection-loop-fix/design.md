# WebSocket Connection and HTTP API Throttling Fix - Design Document

## Overview

This design addresses both WebSocket connection loop issues and excessive HTTP API calls on the /swaps page by adding comprehensive throttling, debouncing, and proper state management. The solution prevents rapid successive connections and API calls without major architectural changes while maintaining responsive user experience.

## Architecture

### Core Components

1. **Connection Debouncer** - Delays and throttles WebSocket connection attempts
2. **Connection State Checker** - Verifies connection status before attempting connections
3. **Enhanced Middleware** - Adds throttling to Redux middleware
4. **Retry Delay Manager** - Manages delays between connection attempts
5. **API Call Throttler** - Throttles and debounces HTTP API requests
6. **Request Deduplicator** - Prevents duplicate API calls for identical requests
7. **SwapsPage Throttling Manager** - Manages throttling for SwapsPage-specific operations
8. **Proposal Data Throttler** - Throttles proposal data loading and refresh operations

### Component Relationships

```
Enhanced Middleware
├── Connection Debouncer
├── Connection State Checker
└── Existing WebSocket Services

WebSocket Services
├── Connection State Checker
├── Retry Delay Manager
└── Existing Connection Logic

SwapsPage Component
├── API Call Throttler
├── SwapsPage Throttling Manager
└── Existing SwapService

HTTP API Services
├── Request Deduplicator
├── API Call Throttler
├── Proposal Data Throttler
└── Existing Service Logic
```

## Components and Interfaces

### Connection Debouncer

**Purpose**: Throttle and delay WebSocket connection attempts to prevent rapid successive calls

**Key Methods**:
- `debounceConnection(serviceId, connectFn, delay)` - Debounce connection attempts
- `clearDebounce(serviceId)` - Clear pending debounced connections
- `isConnectionPending(serviceId)` - Check if connection is pending

**Throttling Logic**:
- Implements configurable delays between connection attempts
- Cancels pending connections when new ones are requested
- Tracks connection attempt timestamps

### Connection State Checker

**Purpose**: Verify WebSocket connection status before attempting new connections

**Key Methods**:
- `isConnected(service)` - Check if service is already connected
- `canConnect(service)` - Determine if connection attempt is allowed
- `getConnectionStatus(service)` - Get detailed connection status

**State Validation**:
- Checks existing connection status
- Prevents duplicate connection attempts
- Provides accurate connection state queries

### Enhanced Redux Middleware

**Improvements**:
- Connection debouncing before attempting connections
- Connection state checking to prevent duplicates
- Configurable throttling delays
- Minimal changes to existing logic

### API Call Throttler

**Purpose**: Throttle and debounce HTTP API requests to prevent server overload

**Key Methods**:
- `throttleApiCall(endpoint, requestFn, delay)` - Throttle API requests by endpoint
- `debounceApiCall(key, requestFn, delay)` - Debounce identical API requests
- `isRequestPending(key)` - Check if request is already in progress
- `cancelPendingRequest(key)` - Cancel pending API request

**Throttling Logic**:
- Implements per-endpoint rate limiting
- Debounces identical requests within time windows
- Tracks request timestamps and prevents rapid successive calls
- Provides request deduplication for identical parameters

### Request Deduplicator

**Purpose**: Prevent duplicate API calls for identical requests

**Key Methods**:
- `deduplicateRequest(requestKey, requestFn)` - Deduplicate identical requests
- `getRequestKey(endpoint, params)` - Generate unique key for request
- `isPendingRequest(key)` - Check if identical request is pending
- `clearCompletedRequest(key)` - Clean up completed request tracking

**Deduplication Logic**:
- Generates unique keys based on endpoint and parameters
- Returns existing promise for identical pending requests
- Automatically cleans up completed requests
- Handles error propagation for deduplicated requests

### SwapsPage Throttling Manager

**Purpose**: Manage throttling for SwapsPage-specific operations

**Key Methods**:
- `throttleLoadSwaps(userId, filters)` - Throttle swap loading operations
- `throttleRefreshActions()` - Throttle user-triggered refresh actions
- `throttleProposalActions(action, proposalId)` - Throttle proposal accept/reject actions
- `throttleTargetingActions(action, targetId)` - Throttle targeting operations

**SwapsPage-Specific Logic**:
- Debounces loadSwaps calls from multiple useEffect hooks
- Prevents rapid refresh button clicks
- Throttles proposal and targeting actions
- Coordinates with real-time update handling

### Proposal Data Throttler

**Purpose**: Throttle proposal data loading and refresh operations from useOptimizedProposalData hook

**Key Methods**:
- `throttleProposalRefresh(userId)` - Throttle proposal data refresh
- `throttleAutoRefresh(userId, interval)` - Manage auto-refresh intervals
- `throttleRetryLogic(userId, attempt)` - Throttle retry attempts with exponential backoff
- `deduplicateProposalRequests(userId)` - Prevent duplicate proposal data requests

**Proposal-Specific Logic**:
- Respects minimum intervals between auto-refreshes
- Implements intelligent retry logic with backoff
- Deduplicates simultaneous proposal data requests
- Coordinates with caching to reduce unnecessary API calls

## Data Models

### ConnectionThrottleConfig

```typescript
interface ConnectionThrottleConfig {
  debounceDelay: number;        // Delay between connection attempts (default: 1000ms)
  maxRetries: number;           // Maximum retry attempts (default: 3)
  retryDelay: number;           // Delay between retries (default: 2000ms)
  connectionTimeout: number;    // Connection timeout (default: 10000ms)
}
```

### ConnectionAttemptTracker

```typescript
interface ConnectionAttemptTracker {
  serviceId: string;
  lastAttempt: number;
  attemptCount: number;
  isConnecting: boolean;
  debounceTimer?: NodeJS.Timeout;
}
```

### APIThrottleConfig

```typescript
interface APIThrottleConfig {
  debounceDelay: number;        // Delay between API calls (default: 500ms)
  throttleDelay: number;        // Minimum time between requests (default: 1000ms)
  maxRetries: number;           // Maximum retry attempts (default: 3)
  retryDelay: number;           // Base delay between retries (default: 1000ms)
  maxConcurrentRequests: number; // Maximum concurrent requests (default: 5)
  requestTimeout: number;       // Request timeout (default: 15000ms)
}
```

### APIRequestTracker

```typescript
interface APIRequestTracker {
  endpoint: string;
  requestKey: string;
  lastRequest: number;
  requestCount: number;
  isRequesting: boolean;
  debounceTimer?: NodeJS.Timeout;
  throttleTimer?: NodeJS.Timeout;
  pendingPromise?: Promise<any>;
}
```

### SwapsPageThrottleConfig

```typescript
interface SwapsPageThrottleConfig {
  loadSwapsDebounce: number;    // Debounce delay for loadSwaps calls (default: 1000ms)
  refreshButtonThrottle: number; // Throttle delay for refresh button (default: 2000ms)
  proposalActionThrottle: number; // Throttle delay for proposal actions (default: 1500ms)
  targetingActionThrottle: number; // Throttle delay for targeting actions (default: 1000ms)
  realTimeUpdateDebounce: number; // Debounce delay for real-time updates (default: 500ms)
}
```

### ProposalDataThrottleConfig

```typescript
interface ProposalDataThrottleConfig {
  autoRefreshInterval: number;  // Minimum auto-refresh interval (default: 30000ms)
  manualRefreshThrottle: number; // Throttle for manual refresh (default: 2000ms)
  retryBackoffMultiplier: number; // Exponential backoff multiplier (default: 2)
  maxRetryDelay: number;        // Maximum retry delay (default: 30000ms)
  deduplicationWindow: number;  // Window for request deduplication (default: 5000ms)
}
```

## Error Handling

### Connection Throttling

1. **Debouncing**: Delay connection attempts to prevent rapid successive calls
2. **State Checking**: Verify connection status before attempting new connections
3. **Retry Delays**: Implement delays between failed connection attempts
4. **Connection Limiting**: Limit frequency of connection attempts

### API Call Throttling

1. **Request Debouncing**: Delay API calls to prevent rapid successive requests
2. **Rate Limiting**: Enforce minimum intervals between API calls per endpoint
3. **Request Deduplication**: Prevent duplicate requests for identical parameters
4. **Exponential Backoff**: Implement intelligent retry logic for failed requests
5. **Circuit Breaking**: Temporarily disable API calls after repeated failures

### Error Recovery

1. **Delayed Retry**: Retry connections and API calls with configurable delays
2. **Connection Status Validation**: Check existing connections before creating new ones
3. **Request Status Validation**: Check pending requests before making new ones
4. **Error Logging**: Log throttled operations for debugging and monitoring
5. **Graceful Degradation**: Continue operation when requests are throttled or rate-limited
6. **User Feedback**: Provide clear feedback when operations are throttled or delayed

### Throttling-Specific Error Handling

1. **Throttle Bypass**: Allow critical operations to bypass throttling when necessary
2. **Queue Management**: Handle queued requests when throttling is active
3. **Timeout Handling**: Manage timeouts for throttled operations
4. **Memory Management**: Clean up throttling timers and tracking data
5. **Concurrent Request Limiting**: Handle scenarios when max concurrent requests are reached

## Testing Strategy

### Unit Tests

1. **WebSocketConnectionManager**
   - Connection state management
   - Service registration and lifecycle
   - Error handling and recovery

2. **ConnectionStateTracker**
   - Loop detection algorithms
   - Rate limiting functionality
   - Circuit breaker behavior

3. **Enhanced Middleware**
   - Connection debouncing
   - Subscription management
   - Cleanup procedures

### Integration Tests

1. **End-to-End Connection Flow**
   - Full connection lifecycle
   - Multiple service coordination
   - Error scenarios and recovery

2. **Performance Tests**
   - Connection attempt rate limiting
   - Memory usage during connection loops
   - CPU usage optimization

### Load Tests

1. **Connection Stress Testing**
   - Multiple simultaneous connection attempts
   - High-frequency Redux actions
   - Network interruption scenarios

## Implementation Plan

### Phase 1: Core Infrastructure
- Implement WebSocketConnectionManager
- Create ConnectionStateTracker
- Add connection debouncing utilities

### Phase 2: Middleware Enhancement
- Update proposalWebSocketMiddleware
- Update completionWebSocketMiddleware
- Add proper connection state checks

### Phase 3: Integration and Testing
- Integrate components with existing services
- Add comprehensive error handling
- Implement monitoring and logging

### Phase 4: Optimization
- Fine-tune connection parameters
- Add performance monitoring
- Implement advanced features like connection pooling

## Configuration

### Default Throttling Settings

```typescript
const defaultThrottleConfig: ConnectionThrottleConfig = {
  debounceDelay: 1000,      // 1 second delay between connection attempts
  maxRetries: 3,            // Maximum 3 retry attempts
  retryDelay: 2000,         // 2 second delay between retries
  connectionTimeout: 10000  // 10 second connection timeout
};
```

### Environment-Specific Overrides

- Development: More aggressive retry settings for faster feedback
- Production: Conservative settings for stability
- Testing: Minimal delays for faster test execution

## Monitoring and Observability

### Metrics to Track

1. **Connection Metrics**
   - Connection success/failure rates
   - Connection attempt frequency
   - Average connection duration

2. **Performance Metrics**
   - Memory usage during connections
   - CPU usage during connection attempts
   - Network bandwidth utilization

3. **Error Metrics**
   - Connection loop detection events
   - Circuit breaker activations
   - Retry attempt distributions

### Logging Strategy

1. **Connection Events**: Log all connection attempts, successes, and failures
2. **Loop Detection**: Log when connection loops are detected and prevented
3. **Performance Issues**: Log when connection attempts exceed thresholds
4. **Error Details**: Detailed error logging for debugging connection issues