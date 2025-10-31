# Swap Target ID Flow - Critical Bug Fixes Applied

## Executive Summary

**CRITICAL BUG FIXED**: The swap_target_id flow was completely broken due to incorrect database field mappings and missing parameter extraction in the backend. The frontend was correctly sending `swapTargetId`, but the backend was ignoring it and using wrong IDs for database lookups.

## Root Cause

The bug originated in `SwapTargetingRepository.getIncomingTargetsForSwaps()` where `proposalId` was incorrectly mapped to `source_swap_id` instead of `swap_targets.id`. This caused a cascade of failures throughout the proposal acceptance/rejection flow.

## Fixes Applied

### 1. Fixed SwapTargetingRepository Data Mapping (CRITICAL)

**Files**: `apps/backend/src/database/repositories/SwapTargetingRepository.ts`

**Problem**: Four SQL queries were using `st.source_swap_id as proposal_id` instead of `st.id as proposal_id`

**Fix**: Changed all instances to use the correct mapping:
```sql
-- BEFORE (BROKEN):
st.source_swap_id as proposal_id,  -- Use source_swap_id as proposal reference

-- AFTER (FIXED):
st.id as proposal_id,  -- Use swap_targets.id as proposal reference (FIXED: was source_swap_id)
```

**Impact**: This ensures that `proposalId` in the frontend corresponds to the actual `swap_targets.id` that can be used for database lookups.

### 2. Updated ProposalAcceptanceRequest Interface

**File**: `apps/backend/src/services/swap/ProposalAcceptanceService.ts`

**Problem**: Interface was missing `swapTargetId` field

**Fix**: Added the field with documentation:
```typescript
export interface ProposalAcceptanceRequest {
    proposalId: string;
    userId: string;
    action: 'accept' | 'reject';
    rejectionReason?: string;
    swapTargetId?: string; // Target swap ID for booking proposals - should be used as primary lookup ID
}
```

### 3. Updated ProposalController to Extract and Use swapTargetId

**File**: `apps/backend/src/controllers/ProposalController.ts`

**Problem**: Controller was completely ignoring `swapTargetId` from request body

**Fix**: Added extraction and usage in both `acceptProposal` and `rejectProposal` methods:
```typescript
// Extract swapTargetId from request body - this is the correct ID for swap_targets table lookups
const { swapTargetId } = req.body;

const acceptanceRequest: ProposalAcceptanceRequest = {
    proposalId: swapTargetId || proposalId, // Prefer swapTargetId if provided (it's the correct swap_targets.id)
    userId,
    action: 'accept',
    swapTargetId
};
```

### 4. Enhanced Logging for Debugging

**Files**: 
- `apps/backend/src/controllers/ProposalController.ts`
- `apps/backend/src/services/swap/ProposalAcceptanceService.ts`

**Added comprehensive logging**:
```typescript
logger.info('Processing proposal acceptance', {
    requestId,
    userId,
    proposalId,
    swapTargetId,
    usingSwapTargetId: !!swapTargetId
});
```

## Frontend Flow Verification

The frontend was already working correctly:

### ✅ ProposalDetailCard (Correct Implementation)
- Uses `IncomingTargetInfo` with correct `targetId` field
- Calls `proposalService.acceptProposal({ proposalId, targetId, swapId })`
- Sends to `/swaps/${proposalId}/accept` endpoint

### ✅ Redux Thunks (Now Fixed)
- `SwapProposalReview` component passes `swapTargetId` correctly
- `proposalAcceptanceThunks.ts` includes `swapTargetId` in API calls
- `proposalAcceptanceAPI.ts` sends `swapTargetId` in request body
- Backend now extracts and uses `swapTargetId` correctly

## Data Flow Summary

### Before Fix (BROKEN):
1. Frontend: `targetId` = `swap_targets.id` ✅
2. Backend: `proposalId` = `source_swap_id` ❌ (WRONG!)
3. Database lookup: `WHERE st.id = source_swap_id` ❌ (FAILS!)

### After Fix (WORKING):
1. Frontend: `targetId`/`swapTargetId` = `swap_targets.id` ✅
2. Backend: `proposalId` = `swapTargetId || proposalId` ✅ (CORRECT!)
3. Database lookup: `WHERE st.id = swap_targets.id` ✅ (WORKS!)

## Testing

Created `test-swap-target-id-flow.js` to verify:
1. ✅ SwapTargetingRepository returns correct `proposal_id` mapping
2. ✅ ProposalAcceptanceService can find proposals by `swap_targets.id`
3. ✅ No remaining incorrect mappings

## Impact

### Before Fix:
- ❌ Proposal acceptance/rejection would fail to find swap_target records
- ❌ Status updates would fail
- ❌ Blockchain transactions might reference wrong proposals
- ❌ Notifications could fail or reference wrong data

### After Fix:
- ✅ Proposal acceptance/rejection works correctly
- ✅ Status updates work with correct IDs
- ✅ Blockchain transactions reference correct proposals
- ✅ Notifications work with correct data
- ✅ Both frontend flows (ProposalDetailCard and Redux thunks) work

## Verification Steps

To verify the fix is working:

1. **Run the test script**:
   ```bash
   node test-swap-target-id-flow.js
   ```

2. **Check logs** for proposal acceptance/rejection:
   - Look for `usingSwapTargetId: true` in logs
   - Verify no "proposal not found" errors

3. **Test frontend flows**:
   - ProposalDetailCard: Accept/reject proposals from swap cards
   - ProposalResponseModal: Accept/reject proposals from modals

4. **Database verification**:
   ```sql
   -- Verify proposal_id mapping is correct
   SELECT 
       st.id as target_id,
       st.id as proposal_id_new,
       st.source_swap_id as proposal_id_old
   FROM swap_targets st 
   WHERE st.status = 'active'
   LIMIT 5;
   ```

## Files Modified

1. `apps/backend/src/database/repositories/SwapTargetingRepository.ts` - Fixed proposal_id mapping (4 locations)
2. `apps/backend/src/services/swap/ProposalAcceptanceService.ts` - Added swapTargetId field and logging
3. `apps/backend/src/controllers/ProposalController.ts` - Added swapTargetId extraction and usage
4. `test-swap-target-id-flow.js` - Created verification script

## Conclusion

The swap_target_id flow is now working correctly. The critical bug that prevented proposal acceptance/rejection from functioning has been fixed. Both frontend implementation patterns (direct service calls and Redux thunks) now work properly with the backend.