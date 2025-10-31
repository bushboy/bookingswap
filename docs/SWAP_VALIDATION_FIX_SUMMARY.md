# Swap Validation Fix Summary

## Problem Description

The system was allowing users to create multiple swaps for the same booking, even when the booking already had:
1. An incomplete swap (status: 'pending')
2. A matched swap (status: 'accepted')

This could lead to data inconsistencies and booking conflicts.

## Root Cause

The validation logic in `SwapProposalService.ts` only checked:
- If the booking was available
- If the booking was verified
- If there were pending proposals between two specific bookings (in legacy method)

It **did not** check if the source booking already had any active swaps before allowing a new swap to be created.

## Solution Implemented

### 1. Added New Repository Method

**File:** `apps/backend/src/database/repositories/SwapRepository.ts`

Added `findBySourceBookingId(sourceBookingId: string)` method to retrieve all swaps associated with a specific source booking.

```typescript
async findBySourceBookingId(sourceBookingId: string): Promise<Swap[]> {
  const query = `
    SELECT s.*, b.user_id as proposer_id, b.user_id as owner_id
    FROM ${this.tableName} s
    JOIN bookings b ON s.source_booking_id = b.id
    WHERE s.source_booking_id = $1
    ORDER BY s.created_at DESC
  `;
  const result = await this.pool.query(query, [sourceBookingId]);
  return result.rows.map(row => this.mapRowToEntity(row));
}
```

### 2. Enhanced Swap Validation (Modern Path)

**File:** `apps/backend/src/services/swap/SwapProposalService.ts`
**Method:** `validateEnhancedSwapProposal()`

Added validation logic after booking verification check:

```typescript
// Validate that booking doesn't already have an incomplete or matched swap
const existingSwaps = await this.swapRepository.findBySourceBookingId(request.sourceBookingId);
const activeSwap = existingSwaps.find(swap => 
  ['pending', 'accepted'].includes(swap.status)
);

if (activeSwap) {
  if (activeSwap.status === 'pending') {
    throw new Error('This booking already has an incomplete swap. Please complete or cancel the existing swap before creating a new one.');
  }
  if (activeSwap.status === 'accepted') {
    throw new Error('This booking already has a matched swap. Cannot create a new swap for a booking that has been matched.');
  }
}
```

### 3. Legacy Swap Validation (Legacy Path)

**File:** `apps/backend/src/services/swap/SwapProposalService.ts`
**Method:** `validateSwapProposal()`

Added the same validation logic to the legacy swap creation path to ensure consistency.

## Validation Rules

The system now prevents creating a new swap when:

1. **Pending Swap Exists:** If the booking has a swap with status 'pending', a new swap cannot be created until the existing one is completed or cancelled.

2. **Accepted/Matched Swap Exists:** If the booking has a swap with status 'accepted' (matched with another booking), no new swaps can be created.

3. **Allowed Scenarios:** New swaps CAN be created when:
   - The booking has no existing swaps
   - All existing swaps have status 'completed', 'cancelled', or 'rejected'

## Swap Status Values

From the database schema:
- `pending` - Swap created but not yet matched
- `accepted` - Swap has been accepted/matched
- `rejected` - Swap was rejected
- `completed` - Swap transaction is complete
- `cancelled` - Swap was cancelled by user

## Affected Endpoints

The validation is applied to both swap creation paths:

1. **Enhanced Swap Creation:** `POST /api/swaps` 
   - Calls: `createEnhancedSwapProposal()`
   - Validates via: `validateEnhancedSwapProposal()`

2. **Legacy Swap Creation:** `POST /api/swaps/proposals`
   - Calls: `createSwapProposal()`
   - Validates via: `validateSwapProposal()`

## Testing

A test script has been created: `test-swap-validation.js`

To run the test:
```bash
TEST_USER_TOKEN=your_token node test-swap-validation.js
```

The test verifies:
- ✓ First swap creation succeeds
- ✓ Duplicate swap creation is rejected with appropriate error message
- The error message contains "already has an incomplete swap" or "already has a matched swap"

## Benefits

1. **Data Integrity:** Prevents booking conflicts and ensures one active swap per booking
2. **User Experience:** Clear error messages guide users to complete or cancel existing swaps
3. **Consistency:** Applied to both modern and legacy swap creation paths
4. **Maintainability:** Centralized validation logic in the service layer

## Migration Notes

- No database migrations required
- No breaking changes to existing API contracts
- Existing swaps are not affected
- Only prevents creation of new conflicting swaps

## Error Messages

Users will see one of these error messages when trying to create a duplicate swap:

- **For pending swaps:** "This booking already has an incomplete swap. Please complete or cancel the existing swap before creating a new one."
- **For matched swaps:** "This booking already has a matched swap. Cannot create a new swap for a booking that has been matched."

## Files Modified

1. `apps/backend/src/database/repositories/SwapRepository.ts`
   - Added: `findBySourceBookingId()` method

2. `apps/backend/src/services/swap/SwapProposalService.ts`
   - Enhanced: `validateEnhancedSwapProposal()` method
   - Enhanced: `validateSwapProposal()` method

## Verification Steps

To verify the fix is working:

1. Create a swap for a booking (should succeed)
2. Try to create another swap for the same booking (should fail with appropriate error)
3. Cancel the first swap
4. Try to create a new swap (should succeed)
5. Accept/match a swap
6. Try to create a new swap for either booking involved (should fail)

---

**Implementation Date:** October 27, 2025
**Status:** ✓ Complete

