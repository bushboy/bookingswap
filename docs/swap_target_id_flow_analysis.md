# Swap Target ID Flow Analysis - Proposal Acceptance/Rejection

## Executive Summary

**CRITICAL BUG IDENTIFIED**: The `proposalId` field is incorrectly set to `source_swap_id` instead of `swap_targets.id` in the backend, causing proposal acceptance/rejection to fail when looking up the swap_target record.

---

## Flow Analysis

### 1. Backend: Data Retrieval (SwapTargetingRepository)

**File**: `apps/backend/src/database/repositories/SwapTargetingRepository.ts`
**Lines**: 1026-1075

When fetching incoming targets for a user's swaps:

```sql
SELECT 
    st.id as target_id,                    -- ✅ CORRECT: swap_targets.id
    st.target_swap_id,
    st.source_swap_id,
    st.source_swap_id as proposal_id,      -- ❌ BUG: Should be st.id!
    st.status,
    ...
FROM swap_targets st
WHERE st.target_swap_id = ANY($1) AND st.status = 'active'
```

**Mapping to Response**:
```javascript
{
    targetId: row.target_id,           // = swap_targets.id ✅
    proposalId: row.proposal_id,       // = source_swap_id ❌ WRONG!
    sourceSwapId: row.source_swap_id,
    ...
}
```

**Problem**: `proposalId` is set to `source_swap_id` instead of `swap_targets.id`.

---

### 2. Frontend: Data Display (ProposalDetailCard)

**File**: `apps/frontend/src/components/swap/ProposalDetailCard.tsx`
**Lines**: 167-191

When user accepts a proposal:

```typescript
const handleAccept = async () => {
    const result = await proposalService.acceptProposal({
        proposalId: proposal.proposalId,  // ❌ This is source_swap_id (wrong!)
        targetId: proposal.targetId,      // ✅ This is swap_targets.id (correct!)
        swapId: proposal.sourceSwap.id
    });
};
```

**Data Structure**: `IncomingTargetInfo` from `packages/shared/src/types/enhanced-swap-card.ts`:
```typescript
interface IncomingTargetInfo {
    targetId: string;       // swap_targets.id ✅
    proposalId: string;     // source_swap_id ❌ (from backend bug)
    sourceSwapId: string;
    ...
}
```

---

### 3. Frontend: API Call (ProposalAcceptanceAPI)

**File**: `apps/frontend/src/services/proposalAcceptanceAPI.ts`
**Lines**: 111-151

```typescript
async acceptProposal(request: AcceptProposalRequest): Promise<ProposalActionResponse> {
    const { proposalId, userId, autoProcessPayment = true, swapTargetId } = request;
    
    const requestBody: any = {
        userId,
        autoProcessPayment
    };
    
    // Include swapTargetId if provided (for booking proposals)
    if (swapTargetId) {
        requestBody.swapTargetId = swapTargetId;  // ✅ Frontend DOES send it
    }
    
    const response = await apiClient.post<ProposalActionResponse>(
        `/proposals/${proposalId}/accept`,  // ❌ proposalId is source_swap_id (wrong!)
        requestBody
    );
}
```

**Note**: The frontend sends `swapTargetId` in the request body, but it's NOT extracted from the `ProposalDetailCard` call chain.

---

### 4. Backend: API Endpoint (ProposalController)

**File**: `apps/backend/src/controllers/ProposalController.ts`
**Lines**: 17-106

```typescript
acceptProposal = async (req: Request, res: Response): Promise<void> => {
    const { proposalId } = req.params;  // ❌ This is source_swap_id (wrong!)
    const userId = req.user?.id;
    
    // ❌ CRITICAL BUG: swapTargetId from req.body is NOT extracted!
    
    const acceptanceRequest: ProposalAcceptanceRequest = {
        proposalId,  // ❌ source_swap_id
        userId,
        action: 'accept'
        // ❌ swapTargetId is NOT passed to the service!
    };
    
    const result = await this.proposalAcceptanceService.acceptProposal(acceptanceRequest);
};
```

**Problems**:
1. `proposalId` from URL params is `source_swap_id` (wrong!)
2. `swapTargetId` from request body is completely ignored
3. Service is not given the correct `swap_targets.id` to look up

---

### 5. Backend: Service Logic (ProposalAcceptanceService)

**File**: `apps/backend/src/services/swap/ProposalAcceptanceService.ts`
**Lines**: 1787-1963

```typescript
private async getProposal(proposalId: string): Promise<SwapProposal | null> {
    // First, try swap_proposals table
    const proposalQuery = `SELECT ... FROM swap_proposals WHERE id = $1`;
    let result = await this.transactionManager.pool.query(proposalQuery, [proposalId]);
    
    // If not found, try swap_targets
    if (result.rows.length === 0) {
        const targetQuery = `
            SELECT ...
            FROM swap_targets st
            WHERE st.id = $1  -- ❌ Looking for swap_targets.id
        `;
        result = await this.transactionManager.pool.query(targetQuery, [proposalId]);
        // ❌ proposalId is source_swap_id, NOT swap_targets.id!
    }
}
```

**Problem**: 
- Service tries to find `swap_targets` record where `st.id = proposalId`
- But `proposalId` = `source_swap_id` (not `swap_targets.id`)
- This query will FAIL to find the swap_target record!

---

### 6. Backend: Update Status (ProposalAcceptanceService)

**File**: `apps/backend/src/services/swap/ProposalAcceptanceService.ts`  
**Lines**: 1461-1585

```typescript
private async updateProposalStatus(
    proposalId: string,  // ❌ This is source_swap_id, not swap_targets.id!
    status: 'accepted' | 'rejected',
    userId: string,
    rejectionReason?: string
): Promise<void> {
    // Check swap_proposals first
    const checkProposalQuery = `SELECT id FROM swap_proposals WHERE id = $1`;
    const proposalCheck = await this.transactionManager.pool.query(checkProposalQuery, [proposalId]);
    
    if (proposalCheck.rows.length === 0) {
        // Check swap_targets using proposalId as swap_targets.id
        const checkTargetQuery = `
            SELECT st.id, st.source_swap_id, st.target_swap_id
            FROM swap_targets st
            WHERE st.id = $1  -- ❌ Will fail: proposalId is source_swap_id!
        `;
    }
}
```

**Problem**: Cannot find the swap_target record to update its status.

---

## Root Cause

The bug originates in `SwapTargetingRepository.getIncomingTargetsForSwaps()` at line 1031:

```sql
st.source_swap_id as proposal_id,  -- ❌ Should be: st.id as proposal_id
```

This causes a cascade of failures throughout the acceptance/rejection flow.

---

## Impact

1. ❌ Proposal acceptance/rejection will FAIL to find the correct swap_target record
2. ❌ Status updates will fail because the wrong ID is used for lookups
3. ❌ Blockchain transactions may be recorded with incorrect proposal references
4. ❌ Notifications may fail or reference wrong proposals

---

## Required Fixes

### Fix 1: SwapTargetingRepository (CRITICAL)

**File**: `apps/backend/src/database/repositories/SwapTargetingRepository.ts`
**Line**: 1031

```sql
-- BEFORE:
st.source_swap_id as proposal_id,  -- Use source_swap_id as proposal reference

-- AFTER:
st.id as proposal_id,  -- Use swap_targets.id as proposal reference
```

### Fix 2: ProposalController (OPTIONAL - for robustness)

**File**: `apps/backend/src/controllers/ProposalController.ts`
**Lines**: 69-73

```typescript
// Extract swapTargetId from request body as a fallback
const { swapTargetId } = req.body;

const acceptanceRequest: ProposalAcceptanceRequest = {
    proposalId: swapTargetId || proposalId,  // Prefer swapTargetId if provided
    userId,
    action: 'accept'
};
```

---

## Verification Steps

After applying Fix 1:

1. ✅ Verify `proposalId` in frontend equals `swap_targets.id`
2. ✅ Test proposal acceptance - should find swap_target record
3. ✅ Test proposal rejection - should find swap_target record  
4. ✅ Verify status updates in `swap_targets` table
5. ✅ Check blockchain transaction references
6. ✅ Verify notifications use correct proposal IDs

---

## Additional Notes

- The `targetId` field is already correctly set to `swap_targets.id`
- The frontend does send `swapTargetId` in some API calls, but it's not consistently used
- The same bug likely exists in `getOutgoingTargetsForSwaps()` (line 1106 comment suggests same pattern)

---

## Recommendation

**Priority**: CRITICAL - Fix immediately

Apply Fix 1 to `SwapTargetingRepository.ts` and test thoroughly. This is a data integrity issue that prevents core functionality (proposal acceptance/rejection) from working correctly.

