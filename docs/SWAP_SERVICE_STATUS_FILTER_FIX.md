# Swap Service Status Filter Fix

## Issue Summary
The swap service was not returning data when filtering by status (Pending, Complete, etc.) from the `/swaps` view.

## Root Cause
When a status filter was applied (e.g., "pending", "completed", "accepted"), the backend was using a different code path that returned data in an incompatible format:

- **Without status filter**: Returns `data.swapCards` (EnhancedSwapCardData[])
- **With status filter**: Was returning `data.swaps` (Swap[]) from `getUserSwapResponses`

The frontend always expected `data.swapCards` with the SwapCardData structure, causing the data to not display when filters were applied.

## Solution Implemented

### File: `apps/backend/src/controllers/SwapController.ts`

**Before:**
```typescript
if (status) {
  // Get swaps with specific status (legacy behavior)
  const swaps = await this.swapResponseService.getUserSwapResponses(
    userId,
    status as SwapStatus,
    parsedLimit,
    parsedOffset
  );

  // Return legacy format for backward compatibility
  res.json({
    success: true,
    data: {
      swaps,  // ❌ Wrong key - should be swapCards
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: swaps.length,
      },
    },
  });
  return;
} else {
  swapCardData = await this.swapProposalService.getUserSwapsWithTargeting(userId, parsedLimit, parsedOffset);
}
```

**After:**
```typescript
// Get user swaps with proposals and targeting data (enhanced method)
let swapCardData = await this.swapProposalService.getUserSwapsWithTargeting(userId, parsedLimit, parsedOffset);

// Apply status filter if provided (client-side filtering)
if (status) {
  swapCardData = swapCardData.filter(card => card.userSwap.status === status);
}
```

## Changes Made

1. **Unified Data Fetching**: Now always uses `getUserSwapsWithTargeting()` which returns the correct `EnhancedSwapCardData[]` format
2. **Client-Side Status Filtering**: Status filter is now applied to the already-fetched data instead of using a separate database query
3. **Consistent Response Format**: Frontend always receives `data.swapCards` regardless of filters applied

## Benefits

1. ✅ **Consistent Data Structure**: All responses now use the same SwapCardData format
2. ✅ **Includes Targeting Data**: Status-filtered swaps now include targeting information (incoming/outgoing targets)
3. ✅ **Includes Proposal Data**: Properly formatted proposals from other users
4. ✅ **Better Performance**: Single query path with simpler filtering logic
5. ✅ **Frontend Compatibility**: No frontend changes required

## Testing Recommendations

1. Navigate to `/swaps` page
2. Test each filter tab:
   - All Swaps
   - Pending
   - Accepted
   - Completed
   - Has Targets
   - Targeting Others
   - No Targeting
3. Verify data displays correctly for each filter
4. Verify proposals and targeting information appear correctly

## API Response Structure

### Endpoint: `GET /api/swaps?status=pending`

**Response:**
```json
{
  "success": true,
  "data": {
    "swapCards": [
      {
        "userSwap": {
          "id": "swap-id",
          "bookingDetails": { ... },
          "status": "pending",
          "createdAt": "2025-01-01T00:00:00Z",
          "expiresAt": "2025-01-15T00:00:00Z",
          "proposerId": "user-id",
          "proposerName": "User Name"
        },
        "proposalsFromOthers": [
          {
            "id": "proposal-id",
            "proposerId": "other-user-id",
            "proposerName": "Other User",
            "targetBookingDetails": { ... },
            "status": "pending",
            "createdAt": "2025-01-02T00:00:00Z"
          }
        ],
        "proposalCount": 1,
        "targeting": {
          "incomingTargets": [ ... ],
          "incomingTargetCount": 2,
          "outgoingTarget": { ... },
          "canReceiveTargets": true,
          "canTarget": true
        }
      }
    ],
    "pagination": {
      "limit": 100,
      "offset": 0,
      "total": 5
    }
  },
  "metadata": {
    "performance": { ... },
    "dataQuality": { ... },
    "targeting": { ... }
  }
}
```

## Notes

- The fix maintains backward compatibility with the frontend
- No database schema changes required
- Status filtering is now done in-memory after fetching, which is acceptable for typical user swap counts
- For very high swap counts, consider moving status filtering back to the database query in the future

## Files Modified

- `apps/backend/src/controllers/SwapController.ts` - Modified `getUserSwaps` method

## Status

✅ **FIXED** - Build successful, ready for testing

