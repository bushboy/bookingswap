# Swap Proposals Display Fix - Summary

## Issue Description

The `/swaps` view was not showing any swap proposals even though there were two users with swap proposals in the system. Each user could see their bookings, but swap proposals were not visible.

## Root Cause

The issue was caused by a mismatch between the database schema and the queries after **Migration 027: Schema Simplification** was applied.

### What Migration 027 Did

Migration 027 removed redundant foreign key columns from the `swaps` table:
- Removed: `target_booking_id`
- Removed: `proposer_id`  
- Removed: `owner_id`

The intention was to derive these relationships through the `bookings` table:
- `proposer_id` = derived from `source_booking_id -> booking.user_id`
- `owner_id` = derived from `source_booking_id -> booking.user_id` (same as proposer for enhanced swaps)
- Targeting relationships are now tracked in the `swap_targets` table

### The Problem

The `findCompleteSwapDataWithTargeting` query in `SwapRepository.ts` was still trying to use the removed `target_booking_id` column:

```sql
-- Line 2047 (OLD - BROKEN):
JOIN user_swaps us ON p.target_booking_id = us.source_booking_id
```

This caused the query to:
1. Fail or return no results because the column doesn't exist
2. Not find any incoming proposals for users

## Files Changed

### 1. `apps/backend/src/database/repositories/SwapRepository.ts`

#### Changes Made:

1. **Fixed `findCompleteSwapDataWithTargeting` method** (lines 1981-2177):
   - Updated `user_swaps` CTE to derive `owner_id` from `source_booking_id -> booking.user_id`
   - Completely rewrote `incoming_proposals` CTE to use `swap_targets` table instead of `target_booking_id`
   - Removed references to removed columns in SELECT and GROUP BY clauses

2. **Updated `mapRowToEntity` method** (lines 50-73):
   - Removed mapping of `targetBookingId`, `proposerId`, and `ownerId`
   - Added documentation noting these fields are now derived

3. **Updated `mapEntityToRow` method** (lines 94-108):
   - Removed mapping of `targetBookingId`, `proposerId`, and `ownerId`
   - Added documentation noting the schema simplification

4. **Updated `SwapFilters` interface** (lines 19-40):
   - Marked `proposerId`, `ownerId`, and `targetBookingId` as deprecated
   - Added new `userIdViaBooking` and `excludeUserIdViaBooking` filters

5. **Fixed `findEnhancedSwaps` method** (lines 319-445):
   - Updated filter handling to derive user relationships from bookings
   - Added join to `bookings` table to support user-based filters
   - Added backward compatibility for `targetBookingId` filter using `swap_targets`

## How Swap Proposals Work Now

### Old System (Before Migration 027):
```
swaps table had:
- source_booking_id (proposer's booking)
- target_booking_id (target user's booking)
- proposer_id (redundant)
- owner_id (redundant)
```

### New System (After Migration 027):
```
swaps table has:
- source_booking_id (links to booking, booking.user_id is the proposer/owner)

swap_targets table:
- source_swap_id (the proposer's swap)
- target_swap_id (the target user's swap)
- status ('active', 'cancelled', etc.)
```

### Query Logic:

**Finding Incoming Proposals** (proposals from others targeting my swaps):
```sql
1. Get my swaps (where booking.user_id = current_user_id)
2. Find swap_targets where target_swap_id = my swap id
3. Join to get the proposer's swap via source_swap_id
4. Join to get proposer info via proposer_swap.source_booking_id -> booking.user_id
```

**Finding Outgoing Targets** (my swaps targeting others):
```sql
1. Get my swaps (where booking.user_id = current_user_id)
2. Find swap_targets where source_swap_id = my swap id
3. Join to get the target swap via target_swap_id
4. Join to get target owner info via target_swap.source_booking_id -> booking.user_id
```

## Testing Recommendations

1. **Verify swap proposals display**:
   - Create test swaps for User A and User B
   - Have User A create a swap_target targeting User B's swap
   - User B should now see User A's proposal in the `/swaps` view

2. **Check database state**:
   ```sql
   -- Check swaps table structure
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'swaps';
   -- Should NOT include target_booking_id, proposer_id, owner_id
   
   -- Check swap_targets entries
   SELECT * FROM swap_targets WHERE status = 'active';
   ```

3. **API endpoint test**:
   ```bash
   # Test GET /api/swaps endpoint
   curl -H "Authorization: Bearer <token>" http://localhost:3000/api/swaps
   ```

## Migration Status

- ✅ Migration 027 was applied successfully
- ✅ Code updated to work with simplified schema
- ✅ Mapper functions updated
- ✅ Query methods updated to derive relationships
- ✅ No linter errors

## Related Files

- Migration: `apps/backend/src/database/migrations/027_simplify_swap_schema.sql`
- Type definitions: `packages/shared/src/types/swap.ts`
- Service: `apps/backend/src/services/swap/SwapProposalService.ts`
- Controller: `apps/backend/src/controllers/SwapController.ts`
- Routes: `apps/backend/src/routes/swaps.ts`


