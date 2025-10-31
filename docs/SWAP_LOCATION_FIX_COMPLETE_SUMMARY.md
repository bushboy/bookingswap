# Swap Location Data Fix - Complete Summary

## Issues Found and Fixed

### Location
**File:** `apps/backend/src/database/repositories/SwapRepository.ts`  
**Method:** `findSwapCardsWithProposals()`  
**Lines:** 897, 898, 900

### Root Causes
There were **TWO CRITICAL BUGS** in the SQL query that retrieves incoming swap proposals:

#### Bug #1: Wrong swap_targets JOIN Column (Lines 897-898)
**Impact:** No proposer booking data retrieved at all

**Original (Incorrect):**
```sql
LEFT JOIN swap_targets st ON s.id = st.source_swap_id AND st.status = 'active'
LEFT JOIN swaps ts ON st.target_swap_id = ts.id
```

**Fixed:**
```sql
LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'
LEFT JOIN swaps ts ON st.source_swap_id = ts.id
```

**Why this was wrong:**
- Used `st.source_swap_id` which means "the swap doing the targeting" (outgoing)
- Should use `st.target_swap_id` which means "the swap being targeted" (incoming)
- This caused the entire chain of JOINs to fail, returning NULL for all proposer data

#### Bug #2: Wrong users TABLE JOIN (Line 900)
**Impact:** Would show user's OWN name instead of proposer's name

**Original (Incorrect):**
```sql
JOIN users u ON sb.user_id = u.id
```

**Fixed:**
```sql
LEFT JOIN users u ON tb.user_id = u.id
```

**Why this was wrong:**
- Joined to `sb` (user's own booking) instead of `tb` (proposer's booking)
- This would show the current user's name/email for ALL proposals
- Made it impossible to identify who was making each proposal

## Complete Fix Applied

### Before (Broken):
```sql
FROM swaps s
JOIN bookings sb ON s.source_booking_id = sb.id
LEFT JOIN swap_targets st ON s.id = st.source_swap_id AND st.status = 'active'  -- BUG #1
LEFT JOIN swaps ts ON st.target_swap_id = ts.id
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
JOIN users u ON sb.user_id = u.id  -- BUG #2
WHERE sb.user_id = $1
```

### After (Fixed):
```sql
FROM swaps s
JOIN bookings sb ON s.source_booking_id = sb.id
LEFT JOIN swap_targets st ON s.id = st.target_swap_id AND st.status = 'active'  -- FIXED
LEFT JOIN swaps ts ON st.source_swap_id = ts.id                                  -- FIXED
LEFT JOIN bookings tb ON ts.source_booking_id = tb.id
LEFT JOIN users u ON tb.user_id = u.id                                           -- FIXED
WHERE sb.user_id = $1
```

## Data Flow (Corrected)

```
User's Swap (s)
    ↓ source_booking_id
User's Booking (sb) → Shows on LEFT side (My Swaps)
    ✓ title, city, country, check-in, check-out

swap_targets (st) where target_swap_id = s.id
    ↓ source_swap_id
Proposer's Swap (ts)
    ↓ source_booking_id
Proposer's Booking (tb) → Shows on RIGHT side (Others' Swaps)
    ✓ title, city, country, check-in, check-out
    ↓ user_id
Proposer User (u)
    ✓ display_name, email
```

## What Now Works

After both fixes, the right-hand side (incoming proposals) will now display:
- ✅ **Location:** City and country of proposer's booking
- ✅ **Dates:** Check-in and check-out dates of proposer's booking
- ✅ **Title:** Proposer's booking title/name
- ✅ **Proposer:** Correct name and email of person making the proposal

## Verification Steps

1. **Restart backend server** to load the updated query
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Test in the UI:**
   - Log in to the application
   - Navigate to the Swaps page
   - Look at incoming proposals (right-hand side)
   - Verify all fields are now populated with correct data

3. **Check the data:**
   - Location should show the proposer's booking location (not yours)
   - Dates should show the proposer's booking dates (not yours)
   - Name should show the proposer's name (not your own name)

## Additional Notes

- **No frontend changes needed** - This was purely a backend SQL query issue
- **No database migrations needed** - No schema changes, just query logic fix
- **No breaking changes** - The API response structure remains the same
- **Other queries verified** - The `findSwapCardsWithTargetingData()` method does NOT have these bugs

## Files Modified

1. `apps/backend/src/database/repositories/SwapRepository.ts` - Fixed SQL query
2. `SWAP_LOCATION_BUG_ANALYSIS.md` - Detailed analysis documentation
3. `apps/backend/verify-swap-joins.sql` - Diagnostic queries for verification

## Status

✅ **COMPLETE** - Both bugs identified and fixed. Ready for testing.

