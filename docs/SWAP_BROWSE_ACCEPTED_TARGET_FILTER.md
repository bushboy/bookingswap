# Swap Browse Filtering: Accepted Targets

## Overview
This document describes the implementation of a new filtering rule for the swap browse functionality that excludes swaps with accepted targets from browse results.

## Problem Statement
When users browse available swaps, they were able to see swaps that had already been committed through the targeting system (with `status='accepted'` in the `swap_targets` table). This led to a confusing user experience where swaps appeared available but were actually no longer accepting new proposals.

## Solution
We implemented automatic filtering at the database query level to exclude any swap that has an accepted target relationship, regardless of whether it's acting as the source or target in that relationship.

## Technical Implementation

### Database Query Changes

**File**: `apps/backend/src/database/repositories/SwapRepository.ts`

Added a `NOT EXISTS` clause to the `findEnhancedSwaps` method:

```typescript
// Exclude swaps with accepted targets (either as source or target)
// This prevents "committed" swaps from appearing in browse results
conditions.push(`
  NOT EXISTS (
    SELECT 1 FROM swap_targets st
    WHERE (st.source_swap_id = s.id OR st.target_swap_id = s.id)
    AND st.status = 'accepted'
  )
`);
```

This ensures that:
1. **Source swaps** (swaps targeting others) with accepted targets are hidden
2. **Target swaps** (swaps being targeted) with accepted targets are hidden

### Service Layer Documentation

**File**: `apps/backend/src/services/swap/SwapProposalService.ts`

Updated the `getBrowsableSwaps` method documentation:

```typescript
/**
 * Get browsable swaps (swaps available for proposals, excluding user's own)
 * 
 * Excludes swaps that:
 * - Have status other than 'pending' or 'rejected'
 * - Have expired
 * - Have accepted targets in swap_targets table (committed swaps)
 * - Belong to the current user (if excludeOwnerId is provided)
 */
```

### Controller Documentation

**File**: `apps/backend/src/controllers/SwapController.ts`

Updated the `browseAvailableSwaps` endpoint documentation:

```typescript
/**
 * Browse available swaps (bookings with active swap proposals)
 * GET /api/swaps/browse
 * 
 * Returns swaps with status 'pending' or 'rejected' that:
 * - Are not owned by the current user
 * - Have not expired
 * - Do NOT have accepted targets (excludes committed swaps)
 * 
 * This ensures users only see swaps that are truly available for new proposals.
 */
```

## Filtering Rules Summary

### Included in Browse Results ✅
- Swaps with status `pending`
- Swaps with status `rejected` 
- Swaps that have NOT expired
- Swaps that do NOT have accepted targets
- Swaps not owned by the current user

### Excluded from Browse Results ❌
- Swaps with status `accepted`, `completed`, or `cancelled`
- Swaps that have expired
- **NEW**: Swaps with `accepted` target relationships in `swap_targets` table
- Swaps owned by the current user

## Test Results

Test script: `test-accepted-target-filter.js`

### Test Scenario
1. Create two test swaps (both with `status='pending'`)
2. Verify both appear in browse results → ✅ 2 swaps visible
3. Create an accepted target relationship between them
4. Verify both are excluded from browse results → ✅ 0 swaps visible

### Test Output
```
✅ SUCCESS: Both swaps correctly excluded from browse!
   - Source swap (targeting another) is hidden ✓
   - Target swap (being targeted) is hidden ✓
```

## Database Schema

### `swap_targets` Table Structure
```sql
CREATE TABLE swap_targets (
    id UUID PRIMARY KEY,
    source_swap_id UUID NOT NULL,  -- The swap making the proposal
    target_swap_id UUID NOT NULL,  -- The swap being proposed to
    status VARCHAR(50) NOT NULL,   -- 'active', 'accepted', 'rejected', 'cancelled'
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
);
```

### Key Status Values
- `active`: Target relationship is pending, both swaps still browsable
- **`accepted`**: Target relationship accepted, **both swaps excluded from browse**
- `rejected`: Target relationship rejected, both swaps remain browsable
- `cancelled`: Target relationship cancelled, both swaps remain browsable

## User Experience Impact

### Before This Change
- Users could see and attempt to propose to swaps that were already committed
- Led to confusion and wasted effort
- Proposals to committed swaps would fail validation

### After This Change
- ✅ Browse results only show truly available swaps
- ✅ Reduces user confusion
- ✅ Prevents wasted proposal attempts
- ✅ Cleaner, more accurate browse experience

## API Endpoint Affected

**Endpoint**: `GET /api/swaps/browse`

**Response Behavior**:
- Now automatically excludes swaps with accepted targets
- No change to request parameters required
- No change to response format
- Frontend code requires no modifications

## Performance Considerations

### Query Performance
- Uses `NOT EXISTS` subquery with indexed columns
- Indexes on `swap_targets`:
  - `idx_swap_targets_source`
  - `idx_swap_targets_target`
  - `idx_swap_targets_status`
- Expected performance impact: Minimal (< 5ms added to query time)

### Scalability
- Filter applied at database level for maximum efficiency
- No additional API round trips required
- Suitable for large datasets

## Testing Commands

### Run the Test
```bash
node test-accepted-target-filter.js
```

### Expected Output
```
🧪 Testing accepted target filter in browse results...
✅ SUCCESS: Both swaps correctly excluded from browse!
```

## Files Modified

1. ✅ `apps/backend/src/database/repositories/SwapRepository.ts`
   - Added NOT EXISTS clause to exclude accepted targets

2. ✅ `apps/backend/src/services/swap/SwapProposalService.ts`
   - Updated documentation for getBrowsableSwaps

3. ✅ `apps/backend/src/controllers/SwapController.ts`
   - Updated documentation for browseAvailableSwaps endpoint

4. ✅ `test-accepted-target-filter.js`
   - Created comprehensive test script

5. ✅ `SWAP_BROWSE_ACCEPTED_TARGET_FILTER.md`
   - This documentation file

## Related Documentation

- `SWAP_STATUS_FILTER_FIX_SUMMARY.md` - Previous status filtering implementation
- `apps/backend/src/database/migrations/023_create_swap_targeting_tables.sql` - Targeting schema
- `.kiro/specs/booking-swap-management/design.md` - Overall swap browsing design

## Future Enhancements

Potential improvements for future iterations:

1. **Soft Exclusion**: Add a filter toggle to show/hide committed swaps
2. **Status Badges**: Display "Committed" badge on swap cards before they're hidden
3. **Notification**: Notify users when their browsed swaps become committed
4. **Analytics**: Track how often users encounter committed swaps
5. **Audit Trail**: Log when swaps are excluded from browse due to accepted targets

## Status
✅ **IMPLEMENTED AND TESTED**

- Implementation complete: October 27, 2025
- Test passed successfully
- Ready for production deployment
- No breaking changes
- Zero downtime deployment possible

