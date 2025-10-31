# Design Document

## Overview

This design outlines the approach for removing the fallback polling mechanism from the swap proposal system. The current implementation uses `useFallbackPolling` as a backup when WebSocket connections become unhealthy, but this is causing hanging issues and unnecessary server load. The solution involves cleanly removing the polling code while maintaining all WebSocket functionality.

## Architecture

### Current Architecture
```
SwapsPage Component
├── useWebSocket Hook
│   ├── WebSocket Connection Management
│   ├── useWebSocketHealth Hook
│   └── useFallbackPolling Hook (TO BE REMOVED)
└── Real-time Event Handlers
```

### Target Architecture
```
SwapsPage Component
├── useWebSocket Hook
│   ├── WebSocket Connection Management
│   ├── useWebSocketHealth Hook (simplified)
│   └── Connection Status Display
└── Real-time Event Handlers
```

## Components and Interfaces

### 1. useFallbackPolling Hook Removal

**Current Implementation:**
- Located at `apps/frontend/src/hooks/useFallbackPolling.ts`
- Provides polling functionality with configurable intervals
- Manages polling state and error handling
- Used as fallback when WebSocket is unhealthy

**Design Decision:** Complete removal of this hook as it's the source of the hanging issue.

### 2. useWebSocket Hook Modifications

**Current Integration:**
```typescript
const fallbackPolling = useFallbackPolling({
  enabled: enableFallbackPolling && !health.isHealthy,
  interval: fallbackPollingInterval,
  onPoll: async () => { /* polling logic */ }
});
```

**Target Design:**
- Remove all `useFallbackPolling` imports and usage
- Remove `enableFallbackPolling` and `fallbackPollingInterval` options
- Remove polling-related return values from the hook
- Simplify the interface by removing polling configuration

### 3. WebSocket Health Handling

**Current Behavior:**
- When WebSocket becomes unhealthy, fallback polling activates
- Polling continues until WebSocket recovers

**New Behavior:**
- When WebSocket becomes unhealthy, display connection status
- Provide manual reconnection option
- No automatic polling fallback

### 4. User Experience Improvements

**Connection Status Display:**
- Show clear connection status indicators
- Provide manual refresh/reconnect buttons
- Display appropriate messages when WebSocket is disconnected

## Data Models

### WebSocket Hook Interface (Updated)

```typescript
interface UseWebSocketOptions {
  // Remove polling-related options:
  // enableFallbackPolling?: boolean;
  // fallbackPollingInterval?: number;
  
  // Keep existing options:
  onNotification?: (notification: Notification) => void;
  onSwapUpdate?: (data: SwapUpdateData) => void;
  enableHealthMonitoring?: boolean;
  onHealthChange?: (health: any) => void;
  // ... other existing options
}

interface UseWebSocketReturn {
  // Remove polling-related returns:
  // fallbackPolling: PollingState;
  // manualPoll: () => void;
  
  // Keep existing returns:
  isConnected: boolean;
  connectionError: string | null;
  health: HealthState;
  manualReconnect: () => void;
  // ... other existing returns
}
```

## Error Handling

### Connection Failure Scenarios

1. **WebSocket Connection Lost:**
   - Display "Connection lost" message
   - Show manual reconnect button
   - Disable real-time features gracefully

2. **WebSocket Never Connects:**
   - Display "Unable to connect" message
   - Provide retry mechanism
   - Allow basic functionality without real-time updates

3. **Intermittent Connection Issues:**
   - Show connection status indicator
   - Automatic reconnection attempts (WebSocket native)
   - No polling fallback

### Graceful Degradation

- Core swap proposal functionality remains available
- Manual refresh options for data updates
- Clear user feedback about connection status
- No hanging or blocking behavior

## Testing Strategy

### Unit Tests

1. **useFallbackPolling Hook Tests:**
   - Remove all test files related to `useFallbackPolling`
   - Update `useWebSocketEnhancements.test.ts` to remove polling tests

2. **useWebSocket Hook Tests:**
   - Update tests to verify polling options are removed
   - Test connection failure handling without polling
   - Verify clean interface without polling methods

### Integration Tests

1. **SwapsPage Component:**
   - Test page loading without hanging
   - Verify WebSocket connection handling
   - Test manual refresh functionality

2. **Connection Scenarios:**
   - Test behavior when WebSocket fails to connect
   - Test behavior when WebSocket disconnects
   - Verify no polling requests are made

### Performance Tests

1. **Network Traffic:**
   - Verify no automatic polling requests
   - Monitor WebSocket connection efficiency
   - Test reduced server load

2. **UI Responsiveness:**
   - Verify page doesn't hang during loading
   - Test smooth interaction during connection issues
   - Measure improved performance metrics

## Implementation Phases

### Phase 1: Remove Polling Hook
- Delete `useFallbackPolling.ts` file
- Remove related test files
- Update imports in dependent files

### Phase 2: Update WebSocket Hook
- Remove polling integration from `useWebSocket.ts`
- Update interface definitions
- Remove polling configuration options

### Phase 3: Update Components
- Remove polling-related props from components
- Update SwapsPage to handle connection status
- Add manual refresh mechanisms

### Phase 4: Testing and Validation
- Run all tests to ensure no regressions
- Test connection failure scenarios
- Verify performance improvements

## Security Considerations

- No security implications from removing polling
- WebSocket connections maintain existing authentication
- No new attack vectors introduced
- Reduced server load improves overall security posture

## Performance Impact

### Positive Impacts
- Eliminated unnecessary polling requests
- Reduced server load and network traffic
- Improved UI responsiveness
- Faster page loading without hanging

### Considerations
- Slightly reduced resilience to connection failures
- Users may need to manually refresh during outages
- Real-time updates depend entirely on WebSocket health

## Migration Strategy

### Backward Compatibility
- No breaking changes to public APIs
- Existing WebSocket functionality preserved
- Component interfaces remain stable (except polling removal)

### Rollback Plan
- Keep polling code in version control for potential rollback
- Monitor connection reliability after deployment
- Have manual refresh mechanisms as fallback

## Monitoring and Observability

### Metrics to Track
- WebSocket connection success rates
- User-initiated refresh frequency
- Page load performance improvements
- Server resource utilization reduction

### Alerts
- WebSocket connection failure rates
- Unusual manual refresh patterns
- Performance regression indicators