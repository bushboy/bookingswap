# Proposal Creation Fixes - Complete Summary

## Issues Found and Fixed

### Issue 1: ❌ "Invalid Proposal Data" Error on Frontend

**Problem:** The backend was returning a response that didn't match the frontend's expected `ProposalResponse` interface.

**Backend was returning:**
```json
{
  "proposalId": "...",
  "status": "pending",
  "swap": { ... },  // ❌ This field shouldn't be here
  "estimatedResponseTime": "2-3 business days"
}
```

**Frontend expected (`ProposalResponse` interface):**
```json
{
  "proposalId": "...",
  "status": "pending",
  "estimatedResponseTime": "2-3 business days"
}
```

**Fix:** Removed the `swap` field from the response in `SwapController.createProposal`.

**File:** `apps/backend/src/controllers/SwapController.ts`

---

### Issue 2: ❌ Wrong `proposalId` Type

**Problem:** The `proposalId` was being set to a swap ID instead of the actual proposal/targeting relationship ID.

**What was happening:**
- `proposalId` was set to `sourceSwap.id` (a swap ID)
- But in the new system (post-migration 027), proposals are tracked in the `swap_targets` table
- The actual proposal ID should be `swap_targets.id`

**Confusion about statuses:**
- **swap.status**: "pending" (the swap itself)
- **swap_targets.status**: "active" (the targeting relationship/proposal)
- These are different entities!

**Fix:** Changed `proposalId` to return `swap_targets.id` instead of `sourceSwap.id`.

**Files:**
- `apps/backend/src/services/swap/SwapTargetingService.ts` (targetSwap method)
- `apps/backend/src/services/swap/SwapTargetingService.ts` (retargetSwap method)

---

### Issue 3: ✅ Already Fixed - `ownerId` undefined

**Problem:** Source swap had `ownerId: undefined` because `findById` wasn't joining with the bookings table.

**Fix:** Overrode `findById` in `SwapRepository` to join with bookings table and derive `owner_id` from `bookings.user_id`.

**File:** `apps/backend/src/database/repositories/SwapRepository.ts`

---

### Issue 4: ✅ Already Fixed - Target Swap Counted as Existing Proposal

**Problem:** When checking for existing proposals, the target swap itself was included in the results.

**Fix:** Updated proposal checking methods to filter out the target swap.

**File:** `apps/backend/src/services/swap/SwapTargetingService.ts`

---

## Understanding the New System

### After Migration 027 (Schema Simplification):

```
┌─────────────────────────────────────────────────────────────┐
│                    PROPOSAL CREATION FLOW                    │
└─────────────────────────────────────────────────────────────┘

User wants to propose their swap to someone else's swap:

1. User owns SOURCE SWAP (60972aec-...)
   ├─ status: "pending" 
   ├─ ownerId: 38eab3e8-... (derived from booking.user_id)
   └─ sourceBookingId: user's booking

2. User targets TARGET SWAP (d82b6581-...)
   ├─ status: "pending"
   ├─ ownerId: 92d2a1de-... (belongs to someone else)
   └─ sourceBookingId: target user's booking

3. System creates SWAP_TARGET record (the proposal!)
   ├─ id: <UUID> ← THIS IS THE PROPOSAL ID
   ├─ source_swap_id: 60972aec-...
   ├─ target_swap_id: d82b6581-...
   ├─ proposal_id: 60972aec-... (for legacy compatibility)
   └─ status: "active"

4. API returns ProposalResponse:
   ├─ proposalId: <swap_targets.id>
   ├─ status: "pending"
   └─ estimatedResponseTime: "2-3 business days"
```

### Key Concepts:

| Entity | Table | Status Field | What It Represents |
|--------|-------|--------------|-------------------|
| **Swap** | `swaps` | `status: 'pending'` | A user's swap listing |
| **Proposal** | `swap_targets` | `status: 'active'` | A targeting relationship between two swaps |

**Important:** The proposal status ('active') is different from the swap status ('pending')!

---

## What Changed

### 1. Response Structure (SwapController.ts)

**Before:**
```typescript
const updatedSwap = await this.swapRepository.findById(actualSourceSwapId);
const result = {
  proposalId: targetingResult.proposalId,
  status: 'pending',
  swap: updatedSwap,  // ❌ Extra field
  estimatedResponseTime: '2-3 business days'
};
```

**After:**
```typescript
const result = {
  proposalId: targetingResult.proposalId,  // Now returns swap_targets.id
  status: 'pending',
  // No swap field!
  estimatedResponseTime: '2-3 business days'
};
```

### 2. Proposal ID (SwapTargetingService.ts)

**Before:**
```typescript
return {
  success: true,
  targetId: target.id,
  proposalId: proposalResult.proposalId, // Was sourceSwap.id
  warnings: validation.warnings
};
```

**After:**
```typescript
return {
  success: true,
  targetId: target.id,
  proposalId: target.id, // Now swap_targets.id (the actual proposal)
  warnings: validation.warnings
};
```

### 3. Added Debug Logging

Added comprehensive logging to help identify parameter issues:

```typescript
logger.debug('Proposal creation parameters', {
  targetSwapId,
  sourceSwapId,
  actualSourceSwapId,
  userId,
  requestBody: req.body,
});
```

---

## Testing

### Before Testing:
1. **Restart your backend server** (to load all changes)
2. **Clear your browser cache / hard refresh** (Ctrl+Shift+R)

### Test the Proposal Creation:

```bash
POST /api/swaps/d82b6581-c89b-4d0b-a250-25b91f689d2d/proposals
Authorization: Bearer <your-token>
Content-Type: application/json

{
  "sourceSwapId": "60972aec-71c8-4428-ba95-d617838f04ce",
  "message": "I'd love to swap!",
  "conditions": ["Flexible dates"],
  "agreedToTerms": true
}
```

### Expected Response:

```json
{
  "success": true,
  "data": {
    "proposalId": "<swap_targets.id - a UUID>",
    "status": "pending",
    "estimatedResponseTime": "2-3 business days"
  }
}
```

### What Should Happen:

1. ✅ No "Invalid Proposal Data" error
2. ✅ `proposalId` is a UUID (swap_targets.id), not a swap ID
3. ✅ No extra `swap` field in the response
4. ✅ Frontend successfully processes the response

### Check the Database:

```sql
-- Check the created proposal
SELECT 
  st.id as proposal_id,
  st.status as proposal_status,
  st.source_swap_id,
  st.target_swap_id,
  s_source.status as source_swap_status,
  s_target.status as target_swap_status
FROM swap_targets st
JOIN swaps s_source ON st.source_swap_id = s_source.id
JOIN swaps s_target ON st.target_swap_id = s_target.id
WHERE st.target_swap_id = 'd82b6581-c89b-4d0b-a250-25b91f689d2d'
ORDER BY st.created_at DESC
LIMIT 1;
```

**Expected results:**
- `proposal_status`: `'active'`
- `source_swap_status`: `'pending'`
- `target_swap_status`: `'pending'`
- `proposal_id`: A UUID (this should match the `proposalId` in the API response)

---

## Summary of All Fixes

| # | Issue | Status | Files Changed |
|---|-------|--------|---------------|
| 1 | Response structure mismatch | ✅ FIXED | `SwapController.ts` |
| 2 | Wrong proposalId (swap ID instead of swap_target ID) | ✅ FIXED | `SwapTargetingService.ts` |
| 3 | Source swap `ownerId` undefined | ✅ FIXED | `SwapRepository.ts` |
| 4 | Target swap counted as existing proposal | ✅ FIXED | `SwapTargetingService.ts` |
| 5 | Enhanced error logging | ✅ ADDED | Multiple files |
| 6 | Debug logging for parameters | ✅ ADDED | `SwapController.ts` |

---

## Files Modified

1. ✅ `apps/backend/src/database/repositories/SwapRepository.ts`
   - Overrode `findById` to join with bookings table for `ownerId`

2. ✅ `apps/backend/src/services/swap/SwapTargetingService.ts`
   - Fixed proposal counting to exclude target swap
   - Changed `proposalId` to return `swap_targets.id`
   - Enhanced error messages with detailed context

3. ✅ `apps/backend/src/controllers/SwapController.ts`
   - Removed `swap` field from response
   - Added debug logging for parameters
   - Enhanced error responses

4. ✅ `apps/frontend/src/services/swapApiService.ts`
   - Enhanced error logging to show full error details

---

## Next Steps

1. **Restart backend server**
2. **Refresh browser**
3. **Test proposal creation**
4. **Check backend logs** for the debug output
5. **Verify database** has correct swap_targets record

If you still see issues, check the backend logs for the "Proposal creation parameters" debug message - it will show exactly what IDs are being used.

