# API Services Documentation - Separated Operations

This document provides comprehensive documentation for the separated booking and swap API operations, including error handling and recovery mechanisms.

## Overview

The API services have been separated into three main categories:

1. **Booking Edit Service** - Handles pure booking operations without swap functionality
2. **Swap Specification Service** - Handles pure swap operations without booking functionality  
3. **Combined Booking Swap Service** - Handles operations that require both booking and swap data

## Data Model Separation

### Booking Edit Data Model

```typescript
interface BookingEditData {
  type: BookingType;
  title: string;
  description: string;
  location: BookingLocation;
  dateRange: BookingDateRange;
  originalPrice: number;
  swapValue: number;
  providerDetails: BookingProviderDetails;
  // Note: No swap-related fields
}
```

### Swap Specification Data Model

```typescript
interface SwapSpecificationData {
  bookingId: string;
  paymentTypes: ('booking' | 'cash')[];
  minCashAmount?: number;
  maxCashAmount?: number;
  acceptanceStrategy: AcceptanceStrategyType;
  auctionEndDate?: Date;
  swapConditions: string[];
  swapEnabled: boolean;
  // Note: No booking-related fields
}
```

### Combined Operations Data Model

```typescript
interface BookingWithSwapUpdate {
  bookingData: BookingEditData;
  swapData?: SwapSpecificationData;
}
```

## Booking Edit Service API

### Core Operations

#### `createBooking(data: CreateBookingEditRequest): Promise<BookingEditResponse>`

Creates a new booking with only booking data (no swap functionality).

**Parameters:**
- `data`: Booking creation data excluding swap preferences

**Returns:**
- `BookingEditResponse` with created booking data and validation warnings

**Error Handling:**
- Validates booking data before API call
- Throws `ValidationError` for invalid data
- Throws `BusinessLogicError` for business rule violations

**Example:**
```typescript
const bookingData = {
  type: 'hotel',
  title: 'Luxury Hotel Stay',
  description: 'Beautiful hotel in Paris',
  location: { city: 'Paris', country: 'France' },
  dateRange: { checkIn: new Date('2024-06-01'), checkOut: new Date('2024-06-05') },
  originalPrice: 500,
  swapValue: 450,
  providerDetails: { provider: 'Booking.com', confirmationNumber: 'ABC123' }
};

const result = await bookingEditService.createBooking(bookingData);
```

#### `updateBooking(bookingId: string, data: UpdateBookingEditRequest): Promise<BookingEditResponse>`

Updates an existing booking with only booking data (no swap changes).

**Parameters:**
- `bookingId`: ID of the booking to update
- `data`: Partial booking update data

**Returns:**
- `BookingEditResponse` with updated booking data

**Error Handling:**
- Validates update data before API call
- Throws `BusinessLogicError` if booking has active swap proposals
- Handles partial update failures gracefully

#### `updateBookingWithRecovery(bookingId: string, data: UpdateBookingEditRequest): Promise<RecoveryResult>`

Updates booking data with partial failure recovery mechanism.

**Parameters:**
- `bookingId`: ID of the booking to update
- `data`: Partial booking update data

**Returns:**
```typescript
{
  success: boolean;
  booking?: BookingEditResponse['booking'];
  partialFailures?: Array<{
    field: string;
    error: string;
    originalValue?: any;
  }>;
  validationWarnings?: string[];
}
```

**Recovery Strategy:**
1. Attempts normal update first
2. If validation fails, attempts field-by-field updates
3. Returns detailed information about which fields succeeded/failed
4. Maintains data consistency throughout the process

### Utility Operations

#### `getBooking(bookingId: string): Promise<BookingData>`

Gets a booking by ID with only booking data (no swap info).

#### `getUserBookings(userId: string, filters?: BookingEditServiceFilters): Promise<BookingData[]>`

Gets user's bookings with only booking data (no swap info).

#### `canEditBooking(bookingId: string): Promise<{canEdit: boolean; reason?: string}>`

Checks if a booking can be edited (no active swap proposals).

#### `getBookingEditHistory(bookingId: string): Promise<EditHistoryEntry[]>`

Gets booking edit history for audit purposes.

## Swap Specification Service API

### Core Operations

#### `createSwapSpecification(data: CreateSwapSpecificationRequest, walletConnected: boolean): Promise<SwapSpecificationResponse>`

Creates a new swap specification for a booking.

**Parameters:**
- `data`: Swap specification data
- `walletConnected`: Whether user's wallet is connected

**Returns:**
- `SwapSpecificationResponse` with created swap data and NFT info

**Validation:**
- Validates swap specification data
- Validates wallet requirements for blockchain operations
- Ensures data model separation compliance

#### `updateSwapSpecification(swapId: string, data: UpdateSwapSpecificationRequest): Promise<SwapSpecificationResponse>`

Updates an existing swap specification.

#### `updateSwapSpecificationWithRecovery(swapId: string, data: UpdateSwapSpecificationRequest): Promise<RecoveryResult>`

Updates swap specification with partial failure recovery.

**Recovery Strategy:**
1. Attempts normal update first
2. If validation fails, attempts field-by-field updates
3. Handles blockchain-related failures gracefully
4. Maintains NFT consistency throughout the process

### Utility Operations

#### `getSwapSpecificationByBooking(bookingId: string): Promise<SwapSpecificationData | null>`

Gets swap specification by booking ID.

#### `getSwapSpecificationContext(bookingId: string): Promise<SwapSpecificationContext>`

Gets swap specification context including read-only booking info.

#### `enableSwapping(bookingId: string, swapData: SwapSpecificationData, walletAddress?: string): Promise<SwapSpecificationResponse>`

Enables swapping for a booking (creates swap specification and mints NFT).

#### `disableSwapping(bookingId: string): Promise<void>`

Disables swapping for a booking (removes swap specification and burns NFT).

## Combined Booking Swap Service API

### Atomic Operations

#### `createBookingWithSwap(data: CreateBookingWithSwapRequest): Promise<BookingWithSwapResponse>`

Creates a booking with immediate swap specification in a single atomic operation.

**Data Model Validation:**
- Validates data model separation
- Ensures no cross-contamination between booking and swap data
- Maintains referential integrity

#### `updateBookingWithSwap(bookingId: string, data: UpdateBookingWithSwapRequest): Promise<BookingWithSwapResponse>`

Updates both booking and swap data in a single atomic operation.

#### `performAtomicOperation(operation: AtomicBookingSwapOperation): Promise<CombinedOperationResult>`

Performs atomic operation with manual rollback strategy.

**Rollback Strategies:**
- `booking_first`: Execute booking operation first, rollback on swap failure
- `swap_first`: Execute swap operation first, rollback on booking failure  
- `transaction`: Use database transaction for true atomicity

### Recovery Operations

#### `updateBookingWithSwapRecovery(bookingId: string, data: UpdateBookingWithSwapRequest): Promise<RecoveryResult>`

Updates both booking and swap data with comprehensive recovery handling.

**Recovery Process:**
1. Attempts booking update with recovery
2. Attempts swap update with recovery (only if booking succeeded)
3. Reports detailed success/failure information for each operation
4. Maintains data consistency even with partial failures

#### `performSafeCombinedOperation(operation: AtomicBookingSwapOperation): Promise<SafeOperationResult>`

Performs combined operation with comprehensive error handling and recovery.

**Safety Features:**
- Data model separation validation
- Individual operation recovery
- Comprehensive error reporting
- Rollback capability

### Data Consistency

#### `getCombinedData(bookingId: string): Promise<CombinedDataResult>`

Gets combined booking and swap data for editing with permission checks.

#### `validateCombinedData(data: BookingWithSwapUpdate): CombinedValidationErrors`

Validates combined data without making API calls.

#### `validateSeparation(bookingData: any, swapData: any): string[]`

Checks data model separation compliance.

## Error Recovery Service API

### Snapshot Management

#### `createSnapshot(operationId: string, bookingId?: string, swapId?: string): Promise<DataSnapshot>`

Creates a data snapshot before performing operations.

**Use Cases:**
- Before complex operations that might fail
- For rollback capability
- For data consistency validation

#### `recoverFromPartialFailure(operationId: string, failures: PartialUpdateFailure[], strategy: RecoveryStrategy): Promise<RecoveryResult>`

Recovers from partial update failures using specified strategy.

**Recovery Strategies:**
- `retry`: Retry failed operations with exponential backoff
- `rollback`: Restore from snapshot
- `partial_accept`: Accept successful operations, ignore failures
- `user_intervention`: Require manual user action

### Data Consistency

#### `validateDataConsistency(bookingId: string, expectedBookingData?: any, expectedSwapData?: any): Promise<ConsistencyResult>`

Validates data consistency between booking and swap after operations.

#### `repairDataInconsistencies(bookingId: string, inconsistencies: Inconsistency[]): Promise<RepairResult>`

Attempts to repair data inconsistencies automatically.

### Recovery Recommendations

#### `getRecoveryRecommendations(failures: PartialUpdateFailure[]): RecoveryStrategy[]`

Gets recovery recommendations based on error patterns.

**Error Pattern Analysis:**
- Network errors → Retry strategy
- Validation errors → User intervention
- Permission errors → Rollback strategy

## Error Handling Patterns

### Validation Errors

```typescript
try {
  const result = await bookingEditService.updateBooking(bookingId, data);
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation errors
    console.error('Validation failed:', error.details);
  }
}
```

### Business Logic Errors

```typescript
try {
  const result = await bookingEditService.updateBooking(bookingId, data);
} catch (error) {
  if (error instanceof BusinessLogicError) {
    // Handle business rule violations
    if (error.code === ERROR_CODES.BOOKING_ALREADY_SWAPPED) {
      // Booking has active swap proposals
    }
  }
}
```

### Network Errors

```typescript
try {
  const result = await bookingEditService.updateBooking(bookingId, data);
} catch (error) {
  if (error instanceof SwapPlatformError && error.category === 'integration') {
    // Handle network errors with retry logic
    const recoveryService = apiErrorRecoveryService;
    // Implement retry logic
  }
}
```

### Partial Update Failures

```typescript
const result = await bookingEditService.updateBookingWithRecovery(bookingId, data);
if (!result.success && result.partialFailures) {
  // Handle partial failures
  result.partialFailures.forEach(failure => {
    console.error(`Field ${failure.field} failed: ${failure.error}`);
  });
}
```

## Best Practices

### Data Model Separation

1. **Never mix booking and swap fields** in the same data structure
2. **Use appropriate service** for each operation type
3. **Validate separation** before combined operations
4. **Maintain referential integrity** between booking and swap data

### Error Handling

1. **Use recovery methods** for critical operations
2. **Create snapshots** before complex operations
3. **Validate data consistency** after operations
4. **Implement appropriate retry logic** for network errors

### Performance Optimization

1. **Use separate services** to avoid loading unnecessary data
2. **Cache booking data** when navigating to swap specification
3. **Implement proper loading states** for each operation type
4. **Use atomic operations** only when necessary

### Security Considerations

1. **Validate user permissions** for both booking and swap operations
2. **Sanitize input data** before API calls
3. **Audit all operations** with proper logging
4. **Implement rate limiting** for recovery operations

## Migration Guide

### From Unified to Separated Services

1. **Replace UnifiedBookingForm** usage with appropriate separated service
2. **Update error handling** to use new error types
3. **Implement recovery mechanisms** for critical operations
4. **Add data consistency validation** where needed

### Backward Compatibility

- Existing API endpoints remain functional
- Gradual migration path available
- Feature flags control rollout
- Rollback capability maintained

## Testing Strategies

### Unit Testing

- Test each service independently
- Mock dependencies appropriately
- Test error handling paths
- Validate data model separation

### Integration Testing

- Test service interactions
- Validate atomic operations
- Test recovery mechanisms
- Verify data consistency

### End-to-End Testing

- Test complete user workflows
- Validate error recovery
- Test rollback scenarios
- Verify performance characteristics

## Monitoring and Observability

### Metrics to Track

- Operation success rates
- Recovery operation frequency
- Data consistency validation results
- Performance metrics for each service

### Logging

- All API operations with request/response data
- Error recovery attempts and results
- Data consistency validation results
- Performance timing information

### Alerting

- High error rates in any service
- Frequent recovery operations
- Data consistency failures
- Performance degradation