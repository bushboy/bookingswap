# Targeting Debug Utilities

This document describes the debugging utilities created for inspecting and troubleshooting targeting data in the proposal view.

## Overview

The targeting debug utilities provide comprehensive debugging capabilities for the targeting system, including:

- **Debug Endpoints**: REST API endpoints for inspecting targeting data
- **Production-Safe Logging**: Configurable logging that can be enabled in production
- **Data Consistency Validation**: Tools to validate data integrity between database and display
- **Performance Monitoring**: Metrics and timing information for targeting operations

## Components

### 1. TargetingDebugUtils (`utils/targetingDebugUtils.ts`)

Core utility class providing debugging functionality:

- `createTargetingDataSnapshot(userId)`: Creates comprehensive data snapshot
- `generateDataConsistencyReport()`: System-wide consistency analysis
- `compareTableDataWithDisplay(userId)`: Compares database vs display data
- `logTransformationSteps(userId)`: Detailed transformation logging

### 2. TargetingDebugController (`controllers/TargetingDebugController.ts`)

REST API controller exposing debug endpoints:

- `GET /debug/targeting/health`: System health check
- `GET /debug/targeting/snapshot/:userId`: User data snapshot
- `GET /debug/targeting/consistency-report`: System consistency report
- `GET /debug/targeting/compare-display/:userId`: Data comparison
- `POST /debug/targeting/log-transformation/:userId`: Transformation logging

### 3. TargetingProductionLogger (`utils/targetingProductionLogger.ts`)

Production-safe logging utility:

- Configurable via environment variables
- Sensitive data filtering in production
- Performance metrics tracking
- Operation lifecycle logging

### 4. Debug Routes (`routes/targetingDebug.ts`)

Router configuration for debug endpoints with authentication and authorization.

## Usage

### Debug Endpoints

All debug endpoints are only available in non-production environments and require authentication.

#### Health Check
```bash
GET /api/debug/targeting/health
```

#### User Data Snapshot
```bash
GET /api/debug/targeting/snapshot/{userId}
Authorization: Bearer {token}
```

#### System Consistency Report (Admin Only)
```bash
GET /api/debug/targeting/consistency-report
Authorization: Bearer {admin-token}
```

#### Compare Database vs Display
```bash
GET /api/debug/targeting/compare-display/{userId}
Authorization: Bearer {token}
```

#### Log Transformation Steps
```bash
POST /api/debug/targeting/log-transformation/{userId}
Authorization: Bearer {token}
```

#### Get Service-Processed Data
```bash
GET /api/debug/targeting/service-data/{userId}
Authorization: Bearer {token}
```

### Production Logging

#### Enable/Disable Logging
```bash
# Enable logging
POST /api/debug/targeting/enable-logging
Authorization: Bearer {token}

# Disable logging
POST /api/debug/targeting/disable-logging
Authorization: Bearer {token}

# Get logging configuration
GET /api/debug/targeting/logging-config
Authorization: Bearer {token}
```

#### Environment Variables
```bash
# Enable targeting debug logging
TARGETING_DEBUG_LOGGING=true

# Enable sensitive data logging (non-production only)
TARGETING_DEBUG_SENSITIVE=true
```

### Programmatic Usage

```typescript
import { TargetingDebugUtils } from '../utils/targetingDebugUtils';
import { TargetingProductionLogger } from '../utils/targetingProductionLogger';

// Initialize debug utils
const debugUtils = new TargetingDebugUtils(pool, targetingRepo, swapRepo);

// Create data snapshot
const snapshot = await debugUtils.createTargetingDataSnapshot(userId);

// Enable production logging
TargetingProductionLogger.enableLogging();

// Log operation steps
TargetingProductionLogger.logOperationStart('operation', userId, requestId);
TargetingProductionLogger.logDataRetrievalStep('step1', userId, data);
TargetingProductionLogger.logOperationComplete('operation', userId, requestId, time, success);
```

## Testing

Run the test script to validate all utilities:

```bash
cd apps/backend
npm run ts-node src/debug/test-targeting-debug-utils.ts
```

Or programmatically:
```typescript
import { testTargetingDebugUtils } from './debug/test-targeting-debug-utils';
await testTargetingDebugUtils();
```

## Data Structures

### Targeting Data Snapshot
```typescript
interface TargetingDataSnapshot {
  timestamp: string;
  userId: string;
  rawDatabaseData: {
    swapTargetsTable: any[];
    swapsTable: any[];
    bookingsTable: any[];
  };
  transformedData: {
    incomingTargets: any[];
    outgoingTargets: any[];
  };
  validationResults: {
    dataIntegrity: boolean;
    missingReferences: string[];
    inconsistencies: string[];
  };
  performanceMetrics: {
    queryExecutionTime: number;
    transformationTime: number;
    totalExecutionTime: number;
  };
}
```

### Data Consistency Report
```typescript
interface DataConsistencyReport {
  swapTargetsCount: number;
  swapsCount: number;
  bookingsCount: number;
  orphanedTargets: any[];
  missingBookings: any[];
  inconsistentStatuses: any[];
  duplicateTargets: any[];
}
```

## Security Considerations

1. **Environment Restrictions**: Debug endpoints are disabled in production
2. **Authentication Required**: All endpoints require valid JWT tokens
3. **Authorization**: Users can only access their own data unless admin
4. **Sensitive Data Filtering**: Production logger filters sensitive information
5. **Rate Limiting**: Consider adding rate limiting for debug endpoints

## Troubleshooting Common Issues

### Issue: Targeting data not displaying in UI

1. **Check data consistency**:
   ```bash
   GET /api/debug/targeting/consistency-report
   ```

2. **Compare database vs display**:
   ```bash
   GET /api/debug/targeting/compare-display/{userId}
   ```

3. **Enable detailed logging**:
   ```bash
   POST /api/debug/targeting/enable-logging
   POST /api/debug/targeting/log-transformation/{userId}
   ```

4. **Create data snapshot**:
   ```bash
   GET /api/debug/targeting/snapshot/{userId}
   ```

### Issue: Performance problems

1. **Check performance metrics**:
   - Enable production logging
   - Monitor execution times in logs
   - Check database query performance

2. **Analyze data volume**:
   - Check consistency report for record counts
   - Monitor transformation times

### Issue: Data inconsistencies

1. **Run consistency report**:
   - Check for orphaned targets
   - Verify missing bookings
   - Identify status inconsistencies

2. **Compare raw vs transformed data**:
   - Use data snapshot to see transformation steps
   - Check validation results

## Integration with Existing Code

The production logger is integrated into `SwapProposalService.getUserSwapsWithTargeting()` method:

- Operation start/completion logging
- Performance metrics tracking
- Error logging with context
- Configurable via environment variables

## Environment Configuration

### Development/Staging
```bash
NODE_ENV=development
TARGETING_DEBUG_LOGGING=true
TARGETING_DEBUG_SENSITIVE=true
```

### Production
```bash
NODE_ENV=production
# Debug endpoints automatically disabled
# Production logging can be enabled as needed:
# TARGETING_DEBUG_LOGGING=true
```

## Monitoring and Alerting

Consider setting up monitoring for:

1. **Data Consistency Issues**: Alert on orphaned targets or missing references
2. **Performance Degradation**: Alert on slow targeting operations
3. **Error Rates**: Monitor targeting operation failures
4. **Debug Endpoint Usage**: Track usage of debug endpoints

## Future Enhancements

1. **Real-time Monitoring Dashboard**: Web interface for debug data
2. **Automated Data Repair**: Tools to fix common consistency issues
3. **Performance Benchmarking**: Baseline performance tracking
4. **Integration Testing**: Automated tests for targeting data flow
5. **Data Export**: Export debug data for offline analysis